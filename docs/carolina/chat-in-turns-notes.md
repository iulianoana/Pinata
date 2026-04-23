# Chat in turns — notes

## What ships
A pre-call toggle on `/dialog` called **Chat in turns** (default ON, persisted in `localStorage`). When ON, the call runs as strict turns: Carolina greets first while the user is muted; on her `turnComplete` the mic auto-unmutes (existing behavior); the user then speaks and presses a green **Done speaking** pill, which mutes + flushes immediately (no 1.5s silence wait). When OFF the existing VAD-with-silence-debounce flow is unchanged.

## Files edited
- `src/lib/useInstantMode.js` — added `turnModeRef`. `startSession(unitContext, { turnMode })` snapshots the flag and starts the session muted when ON. **Turn mode bypasses Deepgram entirely**: in `sendPCM`, every mic chunk is sent straight to Gemini via `realtimeInput.mediaChunks` (the `gemini-2.5-flash-native-audio-preview-12-2025` model accepts streaming audio). `endTurn()` simply sends `clientContent.turnComplete: true` — no STT, no flush, no buffering. If the user pressed Done without speaking (`isSpeakingRef` never flipped), we send a Spanish "pass" nudge so Carolina continues. Added `inputAudioTranscription: {}` to the setup so the user's words appear in the UI transcript. `handleMessage` now appends `inputTranscription` text to a streaming user bubble and closes it out when `modelTurn` arrives. `cleanup()` resets `turnModeRef`.
- `src/screens/DialogScreen.jsx` — new `chatInTurns` state read from/written to `localStorage` key `pinata.carolina.chatInTurns`; `activeTurnMode` snapshot for the live call (so flipping the toggle doesn't affect the in-flight session). Added a card under "Add lessons" with `<Switch>`. Active-call status text + orb ring tint switch to green during user's turn. New green "Done speaking" pill renders above the existing controls only when `isUserTurn`. Two new SVG helper components (`TurnsIcon`, `CheckCircleIcon`).

## Non-obvious decisions
- **Why bypass Deepgram in turn mode.** The original Deepgram-then-text path costs ~200-400ms STT round-trip on top of Gemini's ~300-500ms first-chunk latency. With audio streamed live to Gemini's native-audio model, the only latency after Done is the model's response generation (~300-500ms). Non-turn mode keeps the Deepgram path unchanged.
- **No new endpoint, no DB change.** Pure client + Gemini wire-protocol change.
- **Auto-unmute on Carolina's `turnComplete` was already implemented** (line ~304) for the mute-as-end-of-turn UX shipped in commit 1268695. In turn mode this naturally hands the floor back to the user — no new state machine needed.
- **Mute button stays active during the call in turn mode.** Tapping it during the user's turn is equivalent to Done speaking. Tapping during Carolina's turn would unmute — left as a power-user override rather than disabling the control.
- **Spanish pass nudge:** `(El usuario no dijo nada. Continúa la conversación con una pregunta o un comentario breve.)` — chosen so Carolina elaborates instead of saying "I didn't catch that."
- **Toggle UI uses `<div role="button">` not `<button>`** — shadcn `<Switch>` is itself a `<button>`, so wrapping it in another `<button>` produces a hydration error.
- **`activeTurnMode` is captured at `handleStartInstant`** so flipping the toggle during a live call has no effect (matches mock — toggle is pre-call only).

## Gotchas for a future agent
- The hook's `turnModeRef` is reset to `false` in `cleanup()`. Do **not** read it after `endSession()` — it'll be stale.
- `startSession` now takes a second `options` arg. The old single-arg call still works (turnMode defaults to false).
- The active call's accent color is derived from `isUserTurn` — if you add a third state (e.g. "thinking"), update `accentPrimary` / `accentRing` / `accentSoft`.
- `handleToggleChatInTurns` is intentionally idempotent re: the button's onClick AND the Switch's onCheckedChange firing in sequence — the Switch has `stopPropagation` to prevent that double-fire.

## Manual test checklist
1. Pre-call shows the toggle ON by default; flipping it persists across reload ✅
2. Start a call with toggle ON → user is muted while Carolina greets; orb ring is blue; status reads "Carolina is speaking…" / "Your turn is next" ✅
3. After her greeting → mic auto-unmutes; orb ring turns green; status reads "Your turn"; green "Done speaking" pill is visible above hangup ✅
4. Speak, press Done → response sent to Gemini immediately (no 1.5s wait); Carolina answers; loop repeats ✅
5. Toggle OFF → call behaves exactly as before (1.5s silence cutoff, no Done pill, no green tint, no auto-mute on start) ✅
