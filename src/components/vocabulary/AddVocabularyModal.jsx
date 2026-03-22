import { useState, useEffect, useCallback, useRef } from "react";
import { C } from "../../styles/theme";
import { useAddVocabulary, useExplainWord } from "../../useVocabulary";


// ── Helpers ──

function parseWords(text) {
  return text
    .split(/[,\n]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

// ── Main Component ──

export default function AddVocabularyModal({ open, onClose, onSuccess }) {
  const isMobile = useIsMobile();
  const { addWords } = useAddVocabulary();
  const { explain, explainBulk } = useExplainWord();

  // State machine: "input" | "processing" | "complete"
  const [phase, setPhase] = useState("input");
  const [aiEnabled, setAiEnabled] = useState(true);

  // Input state
  const [inputText, setInputText] = useState("");
  const [manualWord, setManualWord] = useState("");
  const [manualEs, setManualEs] = useState("");
  const [manualEn, setManualEn] = useState("");

  // Processing state
  const [wordStatuses, setWordStatuses] = useState([]);
  // Each: { word, status: "queued"|"processing"|"done"|"failed", result?, error? }

  // Complete state
  const [results, setResults] = useState([]);
  const abortRef = useRef(false);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setPhase("input");
      setAiEnabled(true);
      setInputText("");
      setManualWord("");
      setManualEs("");
      setManualEn("");
      setWordStatuses([]);
      setResults([]);
      abortRef.current = false;
    }
  }, [open]);

  // Prevent body scroll when open on mobile
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open, isMobile]);

  const parsedWords = aiEnabled ? parseWords(inputText) : [];

  // ── Submit handler ──

  const handleSubmit = useCallback(async () => {
    if (!aiEnabled) {
      // Manual mode: single word
      const word = manualWord.trim();
      if (!word) return;
      try {
        await addWords([{
          word,
          explanation_es: manualEs.trim() || null,
          explanation_en: manualEn.trim() || null,
        }]);
        setResults([{ word, status: "done", corrected: false }]);
        setPhase("complete");
        onSuccess?.();
      } catch {
        setResults([{ word, status: "failed" }]);
        setPhase("complete");
      }
      return;
    }

    // AI mode — single bulk request
    const words = parseWords(inputText);
    if (words.length === 0) return;

    // Mark all words as processing (single AI call handles them all)
    setWordStatuses(words.map((w) => ({ word: w, status: "processing" })));
    setPhase("processing");

    try {
      // One AI request for all words
      const aiResponse = words.length === 1
        ? await explain(words[0])
        : await explainBulk(words);

      // Normalize to array of results
      const aiResults = words.length === 1
        ? [{ original: words[0], corrected_word: aiResponse.corrected_word, explanation_es: aiResponse.explanation_es, explanation_en: aiResponse.explanation_en }]
        : (aiResponse.results || []);

      // Save all words to DB in one batch
      const wordsToSave = aiResults.map((r, i) => {
        const original = words[i] || r.original;
        const corrected = r.corrected_word || original;
        const wasCorrected = corrected.toLowerCase() !== original.toLowerCase();
        return {
          word: corrected,
          original_input: wasCorrected ? original : null,
          explanation_es: r.explanation_es,
          explanation_en: r.explanation_en,
          ai_generated: true,
        };
      });

      await addWords(wordsToSave);

      // Build final results
      const finalResults = aiResults.map((r, i) => {
        const original = words[i] || r.original;
        const corrected = r.corrected_word || original;
        const wasCorrected = corrected.toLowerCase() !== original.toLowerCase();
        return {
          word: corrected,
          originalInput: wasCorrected ? original : null,
          status: "done",
          corrected: wasCorrected,
        };
      });

      setWordStatuses(finalResults.map((r) => ({ word: r.word, status: "done" })));
      setResults(finalResults);
      setPhase("complete");
      onSuccess?.();
    } catch {
      // Entire request failed — mark all as failed
      const failedResults = words.map((w) => ({ word: w, status: "failed" }));
      setWordStatuses(failedResults.map((r) => ({ word: r.word, status: "failed" })));
      setResults(failedResults);
      setPhase("complete");
    }
  }, [aiEnabled, inputText, manualWord, manualEs, manualEn, addWords, explain, explainBulk, onSuccess]);

  // ── Retry a failed word ──

  const handleRetry = useCallback(async (idx) => {
    const word = results[idx]?.word;
    if (!word) return;

    setResults((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], status: "processing" };
      return next;
    });

    try {
      const aiResult = await explain(word);
      const correctedWord = aiResult.corrected_word || word;
      const wasCorrected = correctedWord.toLowerCase() !== word.toLowerCase();

      await addWords([{
        word: correctedWord,
        original_input: wasCorrected ? word : null,
        explanation_es: aiResult.explanation_es,
        explanation_en: aiResult.explanation_en,
        ai_generated: true,
      }]);

      setResults((prev) => {
        const next = [...prev];
        next[idx] = {
          word: correctedWord,
          originalInput: wasCorrected ? word : null,
          status: "done",
          corrected: wasCorrected,
        };
        return next;
      });
      onSuccess?.();
    } catch {
      setResults((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: "failed" };
        return next;
      });
    }
  }, [results, explain, addWords, onSuccess]);

  const handleClose = () => {
    abortRef.current = true;
    onClose();
  };

  if (!open) return null;

  // ── Render phases ──

  const renderInput = () => (
    <>
      {/* Title */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>Add vocabulary</h2>
        {!isMobile && (
          <button onClick={handleClose} style={{
            background: "none", border: `1.5px solid ${C.border}`, borderRadius: "50%",
            width: 32, height: 32, cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", color: C.muted,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {aiEnabled ? (
        <>
          {/* Label + word count */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <label style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Words</label>
            {parsedWords.length > 1 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>
                {parsedWords.length} words detected
              </span>
            )}
          </div>
          {/* Textarea */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a Spanish word..."
            rows={4}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: `1.5px solid ${C.border}`, background: C.card,
              fontSize: 16, fontWeight: 700, color: C.text,
              fontFamily: "'Nunito', sans-serif", outline: "none",
              resize: "vertical", minHeight: 100,
            }}
            onFocus={(e) => { e.target.style.borderColor = C.accent; }}
            onBlur={(e) => { e.target.style.borderColor = C.border; }}
          />
          <p style={{ fontSize: 13, fontWeight: 600, color: C.muted, margin: "6px 0 0" }}>
            Separate multiple words with commas or new lines
          </p>

          {/* Word pills */}
          {parsedWords.length > 1 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {parsedWords.map((w, i) => (
                <span key={i} style={{
                  padding: "4px 14px", borderRadius: 20,
                  border: `1.5px solid ${C.accent}`, color: C.accent,
                  fontSize: 13, fontWeight: 700, background: "transparent",
                }}>
                  {w}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Manual mode: single word input */}
          <label style={{ fontSize: 14, fontWeight: 800, color: C.text, display: "block", marginBottom: 6 }}>Word</label>
          <input
            type="text"
            value={manualWord}
            onChange={(e) => setManualWord(e.target.value)}
            placeholder="Type a Spanish word..."
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: `1.5px solid ${C.border}`, background: C.card,
              fontSize: 16, fontWeight: 700, color: C.text,
              fontFamily: "'Nunito', sans-serif", outline: "none",
            }}
            onFocus={(e) => { e.target.style.borderColor = C.accent; }}
            onBlur={(e) => { e.target.style.borderColor = C.border; }}
          />

          {/* Spanish explanation */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 800, color: C.text, display: "block", marginBottom: 6 }}>
              Spanish explanation <span style={{ fontWeight: 600, color: C.muted }}>(optional)</span>
            </label>
            <textarea
              value={manualEs}
              onChange={(e) => setManualEs(e.target.value)}
              placeholder="Describe in Spanish..."
              rows={3}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: `1.5px solid ${C.border}`, background: C.card,
                fontSize: 15, fontWeight: 600, color: C.text,
                fontFamily: "'Nunito', sans-serif", outline: "none",
                resize: "vertical",
              }}
              onFocus={(e) => { e.target.style.borderColor = C.accent; }}
              onBlur={(e) => { e.target.style.borderColor = C.border; }}
            />
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, margin: "4px 0 0" }}>
              Supports markdown formatting
            </p>
          </div>

          {/* English explanation */}
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 14, fontWeight: 800, color: C.text, display: "block", marginBottom: 6 }}>
              English explanation <span style={{ fontWeight: 600, color: C.muted }}>(optional)</span>
            </label>
            <textarea
              value={manualEn}
              onChange={(e) => setManualEn(e.target.value)}
              placeholder="Describe in English..."
              rows={3}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: `1.5px solid ${C.border}`, background: C.card,
                fontSize: 15, fontWeight: 600, color: C.text,
                fontFamily: "'Nunito', sans-serif", outline: "none",
                resize: "vertical",
              }}
              onFocus={(e) => { e.target.style.borderColor = C.accent; }}
              onBlur={(e) => { e.target.style.borderColor = C.border; }}
            />
            <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, margin: "4px 0 0" }}>
              Supports markdown formatting
            </p>
          </div>
        </>
      )}

      {/* AI Toggle card */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", borderRadius: 12,
        background: C.accentLight, marginTop: 20,
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>Explain with AI</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>
            Auto-correct spelling + generate explanations
          </div>
        </div>
        {/* Toggle switch */}
        <button
          onClick={() => setAiEnabled(!aiEnabled)}
          style={{
            width: 48, height: 28, borderRadius: 14, border: "none",
            background: aiEnabled ? C.accent : "#ccc",
            cursor: "pointer", position: "relative", flexShrink: 0,
            transition: "background 0.2s",
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: "50%", background: "white",
            position: "absolute", top: 3,
            left: aiEnabled ? 23 : 3,
            transition: "left 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
          }} />
        </button>
      </div>

      {/* Action buttons */}
      <div style={{
        display: "flex", gap: 12, marginTop: 24,
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "flex-end",
      }}>
        {!isMobile && (
          <button onClick={handleClose} style={{
            padding: "14px 24px", borderRadius: 14,
            border: `2px solid ${C.border}`, background: "transparent",
            color: C.text, fontWeight: 700, fontSize: 15,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 48,
          }}>Cancel</button>
        )}
        <button
          onClick={handleSubmit}
          disabled={aiEnabled ? parsedWords.length === 0 : !manualWord.trim()}
          style={{
            padding: "14px 28px", borderRadius: 14, border: "none",
            background: C.accent, color: "white", fontWeight: 800, fontSize: 15,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 48,
            opacity: (aiEnabled ? parsedWords.length === 0 : !manualWord.trim()) ? 0.5 : 1,
            flex: isMobile ? undefined : undefined,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
        >
          {aiEnabled
            ? parsedWords.length > 1
              ? `Add ${parsedWords.length} words`
              : "Add word"
            : "Add word"}
        </button>
      </div>
    </>
  );

  const renderProcessing = () => {
    const doneCount = wordStatuses.filter((s) => s.status === "done" || s.status === "failed").length;
    const total = wordStatuses.length;
    const progress = total > 0 ? (doneCount / total) * 100 : 0;

    return (
      <>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 16px" }}>
          Processing words...
        </h2>

        {/* Progress bar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Generating explanations</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>{doneCount} / {total}</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: C.border, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4, background: C.accent,
              width: `${progress}%`, transition: "width 0.4s ease",
            }} />
          </div>
        </div>

        {/* Word status list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {wordStatuses.map((ws, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderRadius: 10,
              background: ws.status === "processing" ? C.card : C.inputBg,
              border: ws.status === "processing" ? `1.5px solid ${C.accent}` : `1px solid transparent`,
              opacity: ws.status === "queued" ? 0.5 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {ws.status === "done" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {ws.status === "processing" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ animation: "syncSpin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.2-8.6" />
                  </svg>
                )}
                {ws.status === "queued" && (
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%",
                    border: `2px solid ${C.border}`,
                  }} />
                )}
                {ws.status === "failed" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.error} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                )}
                <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{ws.word}</span>
              </div>
              <span style={{
                fontSize: 13, fontWeight: 600,
                color: ws.status === "done" ? C.muted : ws.status === "processing" ? C.accent : ws.status === "failed" ? C.error : C.muted,
              }}>
                {ws.status === "done" ? "done" : ws.status === "processing" ? "processing..." : ws.status === "failed" ? "failed" : "queued"}
              </span>
            </div>
          ))}
        </div>

        <p style={{
          textAlign: "center", fontSize: 13, fontWeight: 600,
          color: C.muted, marginTop: 20,
        }}>
          Words are saved as they complete. You can close this.
        </p>
      </>
    );
  };

  const renderComplete = () => {
    const successResults = results.filter((r) => r.status === "done");
    const failedResults = results.filter((r) => r.status === "failed");
    const correctedCount = successResults.filter((r) => r.corrected).length;
    const allSuccess = failedResults.length === 0;

    return (
      <>
        {/* Icon + heading */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          {allSuccess ? (
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: C.successLight,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: C.amberLight,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          )}
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>
              {allSuccess
                ? `${successResults.length} word${successResults.length !== 1 ? "s" : ""} added`
                : `${successResults.length} of ${results.length} words added`}
            </h2>
            {allSuccess && correctedCount > 0 && (
              <p style={{ fontSize: 14, fontWeight: 600, color: C.muted, margin: 0 }}>
                {correctedCount} spelling corrected by AI
              </p>
            )}
            {!allSuccess && (
              <p style={{ fontSize: 14, fontWeight: 600, color: C.muted, margin: 0 }}>
                {failedResults.length} word{failedResults.length !== 1 ? "s" : ""} couldn&apos;t be processed
              </p>
            )}
          </div>
        </div>

        {/* Results list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Success items */}
          {results.map((r, i) => r.status === "done" && (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 14px", borderRadius: 10,
              background: r.corrected ? C.amberLight : C.inputBg,
              border: r.corrected ? `1.5px solid ${C.amber}` : "1px solid transparent",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.word}</span>
              {r.corrected && r.originalInput && (
                <span style={{ fontSize: 12, fontWeight: 600, color: C.amberDark }}>
                  corrected from &ldquo;{r.originalInput}&rdquo;
                </span>
              )}
            </div>
          ))}

          {/* Failed items */}
          {results.map((r, i) => r.status === "failed" && (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderRadius: 10,
              background: C.errorLight, border: `1.5px solid ${C.error}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.error} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.word}</span>
              </div>
              <button
                onClick={() => handleRetry(i)}
                disabled={r.status === "processing"}
                style={{
                  padding: "6px 16px", borderRadius: 8,
                  border: `1.5px solid ${C.error}`, background: "transparent",
                  color: C.error, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                }}
              >Retry</button>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{
          display: "flex", gap: 12, marginTop: 24,
          justifyContent: "flex-end",
          flexDirection: isMobile ? "column" : "row",
        }}>
          {!allSuccess && (
            <button
              onClick={handleClose}
              style={{
                padding: "14px 24px", borderRadius: 14,
                border: `2px solid ${C.border}`, background: "transparent",
                color: C.text, fontWeight: 700, fontSize: 15,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 48,
              }}
            >Skip failed</button>
          )}
          <button
            onClick={handleClose}
            style={{
              padding: "14px 28px", borderRadius: 14, border: "none",
              background: C.accent, color: "white", fontWeight: 800, fontSize: 15,
              cursor: "pointer", fontFamily: "'Nunito', sans-serif", minHeight: 48,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
          >Done</button>
        </div>
      </>
    );
  };

  // ── Render content by phase ──

  const content = phase === "input" ? renderInput()
    : phase === "processing" ? renderProcessing()
    : renderComplete();

  // ── Desktop: centered modal ──

  if (!isMobile) {
    return (
      <div
        onClick={phase === "input" ? handleClose : undefined}
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: C.overlay, animation: "overlayFade 0.2s ease-out",
        }}
      >
        <div
          className="slide-up"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: C.card, borderRadius: 16, padding: 32,
            maxWidth: 520, width: "calc(100% - 48px)",
            boxShadow: "0 8px 32px rgba(0,60,50,0.15)",
            maxHeight: "85vh", overflowY: "auto",
          }}
        >
          {content}
        </div>
      </div>
    );
  }

  // ── Mobile: bottom sheet ──

  return (
    <div
      onClick={phase === "input" ? handleClose : undefined}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: C.overlay, animation: "overlayFade 0.2s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: C.card, borderRadius: "16px 16px 0 0",
          padding: "12px 20px 24px",
          paddingBottom: "max(24px, env(safe-area-inset-bottom, 24px))",
          maxHeight: "90vh", overflowY: "auto",
          animation: "sheetUp 0.3s ease-out",
        }}
      >
        {/* Drag handle */}
        <div style={{
          width: 40, height: 4, borderRadius: 2, background: "#ccc",
          margin: "0 auto 16px",
        }} />
        {content}
      </div>
    </div>
  );
}
