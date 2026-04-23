import { useState, useRef, useEffect } from "react";
import { getCachedSession } from "./supabase.js";

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++)
    binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function pcm16ToFloat32(buffer) {
  const int16 = new Int16Array(buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
  return float32;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function pcm16ToWav(pcmBuffer, sampleRate) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const pcmBytes = new Uint8Array(pcmBuffer);
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);

  writeString(view, 36, "data");
  view.setUint32(40, pcmBytes.length, true);

  return new Blob([header, pcmBytes], { type: "audio/wav" });
}

/**
 * Mic gate configuration — tweak these to control how easily
 * background noise triggers AI interruptions.
 *
 * RMS (Root Mean Square) measures audio volume: 0.0 = silence, ~0.02–0.15 = normal speech.
 */
export const MIC_GATE = {
  /** When AI is NOT speaking: minimum RMS to consider as speech.
   *  0 = send everything (most responsive). */
  idleThreshold: 0.002,

  /** When AI IS speaking: minimum RMS to allow an interrupt.
   *  Higher = harder to interrupt = less sensitive to background noise.
   *  Recommended: 0.03 (quiet room) → 0.08 (noisy car). */
  interruptThreshold: 0.06,
};

/** Milliseconds of silence before we consider the user done speaking. */
const SILENCE_TIMEOUT = 1500;

export function useInstantMode() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const micStreamRef = useRef(null);
  const nodesRef = useRef([]);
  const timerRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef([]);
  const connectingRef = useRef(false); // sync guard against rapid clicks
  const setupDoneRef = useRef(false);
  const userAudioBufferRef = useRef([]);
  const aiRespondingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const isMutedRef = useRef(false);
  const turnModeRef = useRef(false);
  const activityStartedRef = useRef(false);

  const clearPlayback = () => {
    for (const s of activeSourcesRef.current) {
      try {
        s.stop();
      } catch {}
    }
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
  };

  const cleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      // Remove handlers before closing to prevent re-entrant cleanup
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try {
        ws.close(1000);
      } catch {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    for (const node of nodesRef.current) {
      try {
        node.disconnect();
      } catch {}
    }
    nodesRef.current = [];
    clearPlayback();
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    connectingRef.current = false;
    setupDoneRef.current = false;
    userAudioBufferRef.current = [];
    aiRespondingRef.current = false;
    isSpeakingRef.current = false;
    isMutedRef.current = false;
    turnModeRef.current = false;
    activityStartedRef.current = false;
    setIsConnecting(false);
    setIsSessionActive(false);
    setIsAISpeaking(false);
    setIsMuted(false);
  };

  const playPCMChunk = (base64Data, mimeType) => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state === "closed") return;

    const buffer = base64ToArrayBuffer(base64Data);
    const float32 = pcm16ToFloat32(buffer);

    const rateMatch = mimeType?.match(/rate=(\d+)/);
    const rate = rateMatch ? parseInt(rateMatch[1]) : 24000;

    const audioBuffer = ctx.createBuffer(1, float32.length, rate);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now + 0.01, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;

    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(
        (s) => s !== source
      );
    };
  };

  // Called when local VAD detects the user stopped speaking.
  // Transcribes audio via Deepgram, then sends TEXT to Gemini.
  const handleEndOfSpeech = async () => {
    const chunks = userAudioBufferRef.current;
    userAudioBufferRef.current = [];

    if (chunks.length === 0) return;

    const entryId = Date.now() + Math.random();
    setTranscript((prev) => [
      ...prev,
      { role: "user", text: "...", id: entryId },
    ]);

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const combined = new Int16Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const wavBlob = pcm16ToWav(combined.buffer, 16000);

    try {
      const res = await fetch("/api/stt", {
        method: "POST",
        headers: { "Content-Type": "audio/wav" },
        body: wavBlob,
      });
      const data = await res.json();
      const text = data.text?.trim();

      if (text) {
        setTranscript((prev) =>
          prev.map((e) =>
            e.id === entryId ? { ...e, text, done: true } : e
          )
        );

        // Send transcribed text to Gemini instead of raw audio
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              clientContent: {
                turns: [{ parts: [{ text }] }],
                turnComplete: true,
              },
            })
          );
        }
      } else {
        setTranscript((prev) => prev.filter((e) => e.id !== entryId));
      }
    } catch (err) {
      console.error("[STT] Transcription failed:", err);
      setTranscript((prev) => prev.filter((e) => e.id !== entryId));
    }
  };

  const handleMessage = (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    if (msg.serverContent) {
      const { modelTurn, turnComplete, interrupted, generationComplete } =
        msg.serverContent;

      if (modelTurn?.parts) {
        aiRespondingRef.current = true;
        setIsAISpeaking(true);
        // Close out any in-progress user transcript bubble — Carolina is replying now.
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "user" && !last.done) {
            return [...prev.slice(0, -1), { ...last, done: true }];
          }
          return prev;
        });
        for (const part of modelTurn.parts) {
          if (part.inlineData?.data) {
            playPCMChunk(part.inlineData.data, part.inlineData.mimeType);
          }
        }
      }

      // Output audio transcription
      const outputText = msg.serverContent.outputTranscription?.text;
      if (outputText) {
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "model" && !last.done) {
            return [
              ...prev.slice(0, -1),
              { ...last, text: last.text + outputText },
            ];
          }
          return [...prev, { role: "model", text: outputText }];
        });
      }

      // Input audio transcription (turn mode: Gemini transcribes the user's speech)
      const inputText = msg.serverContent.inputTranscription?.text;
      if (inputText) {
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "user" && !last.done) {
            return [
              ...prev.slice(0, -1),
              { ...last, text: last.text + inputText },
            ];
          }
          return [...prev, { role: "user", text: inputText }];
        });
      }


      // generationComplete marks the end of one model utterance
      if (generationComplete) {
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === "model") {
            return [...prev.slice(0, -1), { ...last, done: true }];
          }
          return prev;
        });
      }

      if (turnComplete) {
        setIsAISpeaking(false);
        aiRespondingRef.current = false;
        // Auto-unmute when Carolina finishes her reply
        if (isMutedRef.current) {
          isMutedRef.current = false;
          setIsMuted(false);
        }
        // Turn mode: signal the start of the user's turn.
        if (turnModeRef.current && !activityStartedRef.current) {
          const wsAs = wsRef.current;
          if (wsAs && wsAs.readyState === WebSocket.OPEN) {
            wsAs.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
            activityStartedRef.current = true;
          }
        }
      }

      if (interrupted) {
        setIsAISpeaking(false);
        aiRespondingRef.current = false;
        clearPlayback();
      }

    }
  };

  const setupMicStreaming = async (audioCtx, micStream, ws) => {
    const source = audioCtx.createMediaStreamSource(micStream);
    nodesRef.current.push(source);

    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    silentGain.connect(audioCtx.destination);
    nodesRef.current.push(silentGain);

    const sendPCM = (buffer) => {
      // While muted: ignore mic entirely (no buffering, no interrupt)
      if (isMutedRef.current) return;

      // --- Turn mode: stream audio straight to Gemini, skip Deepgram. ---
      // Uses the Live API's button-controlled mode: activityStart was sent on
      // unmute, audio chunks stream as `realtimeInput.audio`, and endTurn
      // sends activityEnd. Server VAD is disabled (see setup).
      if (turnModeRef.current) {
        // Track whether the user actually spoke (drives the empty-pass branch in endTurn)
        const int16Tm = new Int16Array(buffer);
        let sumSqTm = 0;
        for (let i = 0; i < int16Tm.length; i++) {
          const s = int16Tm[i] / 32768;
          sumSqTm += s * s;
        }
        const rmsTm = Math.sqrt(sumSqTm / int16Tm.length);
        if (rmsTm >= MIC_GATE.idleThreshold) isSpeakingRef.current = true;

        const wsTm = wsRef.current;
        if (wsTm && wsTm.readyState === WebSocket.OPEN && activityStartedRef.current) {
          wsTm.send(
            JSON.stringify({
              realtimeInput: {
                audio: {
                  mimeType: "audio/pcm;rate=16000",
                  data: arrayBufferToBase64(buffer),
                },
              },
            })
          );
        }
        return;
      }

      // --- Local VAD: detect speech, buffer audio, detect silence ---
      const int16 = new Int16Array(buffer);
      let sumSq = 0;
      for (let i = 0; i < int16.length; i++) {
        const s = int16[i] / 32768;
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / int16.length);

      const threshold = aiRespondingRef.current
        ? MIC_GATE.interruptThreshold
        : MIC_GATE.idleThreshold;

      if (rms >= threshold) {
        // User is speaking
        if (aiRespondingRef.current) {
          // Interrupt AI playback
          clearPlayback();
          setIsAISpeaking(false);
          aiRespondingRef.current = false;
        }

        userAudioBufferRef.current.push(int16.slice());
        isSpeakingRef.current = true;

        // Reset silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (isSpeakingRef.current) {
        // Was speaking, now quiet — start silence countdown.
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            isSpeakingRef.current = false;
            silenceTimerRef.current = null;
            handleEndOfSpeech();
          }, SILENCE_TIMEOUT);
        }
      }
      // Audio is NOT sent to Gemini — we send Deepgram text instead
    };

    try {
      await audioCtx.audioWorklet.addModule("/pcm-processor.js");
      const worklet = new AudioWorkletNode(audioCtx, "pcm-processor");
      nodesRef.current.push(worklet);

      worklet.port.onmessage = (e) => sendPCM(e.data);

      source.connect(worklet);
      worklet.connect(silentGain);
    } catch {
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      nodesRef.current.push(processor);
      const ratio = audioCtx.sampleRate / 16000;
      let readIdx = 0;

      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const output = [];

        while (readIdx < input.length - 1) {
          const idx = Math.floor(readIdx);
          const frac = readIdx - idx;
          const sample =
            input[idx] * (1 - frac) +
            input[Math.min(idx + 1, input.length - 1)] * frac;
          const s = Math.max(-1, Math.min(1, sample));
          output.push(s < 0 ? s * 0x8000 : s * 0x7fff);
          readIdx += ratio;
        }
        readIdx -= input.length;
        if (readIdx < 0) readIdx = 0;

        if (output.length > 0) {
          sendPCM(new Int16Array(output).buffer);
        }
      };

      source.connect(processor);
      processor.connect(silentGain);
    }
  };

  const startSession = async (unitContext, options = {}) => {
    // Sync guard: prevents multiple concurrent startSession calls
    if (connectingRef.current || wsRef.current) return;
    const turnMode = !!options.turnMode;
    connectingRef.current = true;
    setupDoneRef.current = false;
    setIsConnecting(true);
    setError(null);
    setTranscript([]);
    setSessionDuration(0);
    setIsAISpeaking(false);
    userAudioBufferRef.current = [];
    aiRespondingRef.current = false;
    isSpeakingRef.current = false;
    turnModeRef.current = turnMode;
    // In turn mode, user is muted while Carolina greets; auto-unmutes on her turnComplete.
    isMutedRef.current = turnMode;
    setIsMuted(turnMode);
    try {
      // Read from localStorage — supabase.auth.getSession() blocks up to 30s offline.
      const authSession = getCachedSession();
      const configRes = await fetch("/api/gemini-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authSession?.access_token && { Authorization: `Bearer ${authSession.access_token}` }),
        },
        body: JSON.stringify({ unitContext }),
      });
      const config = await configRes.json();
      if (!configRes.ok) {
        setError(config.error || "Failed to start session.");
        connectingRef.current = false;
        setIsConnecting(false);
        return;
      }

      // AudioContext (on user gesture for iOS)
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      if (audioCtx.state === "suspended") await audioCtx.resume();

      // Microphone
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: 1,
          echoCancellation: true,
        },
      });
      micStreamRef.current = micStream;

      // WebSocket
      // Live API: v1alpha is required for the newer fields used in turn mode
      // (realtimeInput.audio singular blob, activityStart/activityEnd, and
      // realtimeInputConfig.automaticActivityDetection). v1beta accepts the
      // older mediaChunks-array shape only.
      const wsApiVersion = turnMode ? "v1alpha" : "v1beta";
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${wsApiVersion}.GenerativeService.BidiGenerateContent?key=${config.apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[Gemini] WebSocket opened, sending setup...");
        const setupMsg = {
          setup: {
            model: `models/${config.model}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Aoede" },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: config.systemInstruction }],
            },
            outputAudioTranscription: {},
          },
        };
        // Turn mode: button-controlled turn end. Disable server VAD and enable
        // input audio transcription so the user's words appear in the UI.
        if (turnMode) {
          setupMsg.setup.realtimeInputConfig = {
            automaticActivityDetection: { disabled: true },
          };
          setupMsg.setup.inputAudioTranscription = {};
        }
        ws.send(JSON.stringify(setupMsg));
      };

      ws.onmessage = async (event) => {
        let raw = event.data;
        if (raw instanceof Blob) {
          raw = await raw.text();
        } else if (raw instanceof ArrayBuffer) {
          raw = new TextDecoder().decode(raw);
        }

        let msg;
        try {
          msg = JSON.parse(raw);
        } catch (e) {
          console.warn("[Gemini] Could not parse message:", e, raw);
          return;
        }

        if (msg.setupComplete) {
          console.log("[Gemini] Setup complete, starting mic stream...");
          setupDoneRef.current = true;
          connectingRef.current = false;
          setIsConnecting(false);
          setIsSessionActive(true);
          setupMicStreaming(audioCtx, micStream, ws);
          timerRef.current = setInterval(() => {
            setSessionDuration((d) => d + 1);
          }, 1000);

          // Kick off Carolina's greeting via text
          // (no audio is sent, so we trigger her with a text turn)
          ws.send(
            JSON.stringify({
              clientContent: {
                turns: [{ parts: [{ text: "hola" }] }],
                turnComplete: true,
              },
            })
          );
          return;
        }

        handleMessage(raw);
      };

      ws.onerror = (e) => {
        console.error("[Gemini] WebSocket error:", e);
        setError("Connection error. Please try again.");
        cleanup();
      };

      ws.onclose = (event) => {
        console.log(
          "[Gemini] WebSocket closed:",
          event.code,
          event.reason
        );
        // Only set error if we didn't close it ourselves
        if (wsRef.current !== null && event.code !== 1000) {
          if (!setupDoneRef.current) {
            setError(
              `Could not connect to Gemini (code ${event.code}). Check your API key and model name.`
            );
          } else {
            setError("Session disconnected unexpectedly.");
          }
        }
        cleanup();
      };
    } catch (e) {
      console.error("[Gemini] startSession error:", e);
      if (e.name === "NotAllowedError") {
        setError(
          "Microphone access denied. Please enable it in your device settings."
        );
      } else {
        setError("Could not start session: " + e.message);
      }
      cleanup();
    }
  };

  const endSession = () => cleanup();

  const clearError = () => setError(null);

  // Toggle mute. When muting, immediately flush any pending speech to Carolina
  // (skips the silence-debounce wait) so she can reply right away.
  const toggleMute = () => {
    const next = !isMutedRef.current;
    isMutedRef.current = next;
    setIsMuted(next);

    if (!next) return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (isSpeakingRef.current || userAudioBufferRef.current.length > 0) {
      isSpeakingRef.current = false;
      handleEndOfSpeech();
    }
  };

  // Turn mode: explicitly end the user's turn. Audio has been streaming straight
  // to Gemini in sendPCM, so all we do here is mute the mic and send the
  // Live API's `activityEnd` signal — no Deepgram, no STT round-trip. If the
  // user pressed Done without speaking, send a "pass" text turn instead so
  // Carolina keeps the conversation going.
  const endTurn = () => {
    if (isMutedRef.current) return;

    isMutedRef.current = true;
    setIsMuted(true);

    const hadAudio = isSpeakingRef.current;
    isSpeakingRef.current = false;
    activityStartedRef.current = false;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (hadAudio) {
      ws.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
    } else {
      ws.send(
        JSON.stringify({
          clientContent: {
            turns: [
              {
                parts: [
                  {
                    text: "(El usuario no dijo nada. Continúa la conversación con una pregunta o un comentario breve.)",
                  },
                ],
              },
            ],
            turnComplete: true,
          },
        })
      );
    }
  };

  useEffect(() => () => cleanup(), []);

  return {
    isSessionActive,
    isConnecting,
    isAISpeaking,
    isMuted,
    transcript,
    sessionDuration,
    error,
    startSession,
    endSession,
    toggleMute,
    endTurn,
    clearError,
  };
}
