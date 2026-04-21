# Redacción · Session 4 — notes for future agents

## What shipped
AI correction + review UI. One attempt per assignment — **no v2/stepper/cap**.

## Files created
- `prompts/redaccion/correction.md` — LLM prompt, Spanish tutor voice, A1–A2
- `src/lib/redaccion/correction-schema.js` — Zod + JSON schema
- `src/lib/redaccion/correct-attempt.js` — LLM call + reassembly check + retry-once
- `app/api/attempts/[id]/correct/route.js` — idempotent POST
- `src/components/redaccion/SegmentRenderer.jsx` — inline typed-segment renderer
- `src/components/redaccion/CorrectionReview.jsx` — desktop + mobile review UI (variant prop)

## Files modified
- `lib/ai/models.js` — added `redaccion_correction` feature
- `src/screens/SettingsScreen.jsx` — added Settings tile for that feature
- `app/api/assignments/[id]/draft-attempt/route.js` — now returns `{ ...attempt, correction }` and **never creates a v2**; only inserts v1 if zero attempts exist
- `app/api/attempts/[id]/route.js` — PATCH returns 409 when `submitted_at` is set
- `src/lib/api.js` — added `correctAttempt(attemptId)` + comment on new shape
- `src/screens/RedaccionAssignmentRoute.jsx` — 3-state view derivation + auto-resume on mount
- `src/components/redaccion/AssignmentEditorDesktop.jsx` + `AssignmentEditorMobile.jsx` — branch on view, glow overlay in correcting, review pane in review
- `src/components/redaccion/EssayEditor.jsx` — `readOnly` prop pass-through

## State model
View derived from the server: `correction ? "review" : attempt.submitted_at ? "correcting" : "editor"`.

## Reload-resume contract
`POST /api/attempts/:id/correct` is **idempotent**:
1. If a `corrections` row exists → return it (no LLM call).
2. If `submitted_at` is set but no correction → redo the LLM call.
3. If neither → set `submitted_at = now()`, then LLM call.

On page mount in `correcting` state, the client auto-fires this endpoint once (guarded by a ref so StrictMode doesn't double-call). On total failure it surfaces an inline error pill with *Reintentar* inside the glow overlay.

## Reassembly check
`segments` must reconstruct the essay exactly. Server normalizes both (`/\s+/ → " "`, trim) and compares. Mismatch → retry once, then error — no partial `corrections` row ever written.

## Why no multi-attempt
User directive: "one attempt, if you want another go make a new assignment." This cut the stepper, v2 button, 3-attempt cap, and prev-attempts widget from the brief. Simpler model, fewer edge cases.

## Glow animation
Reuses `animate-skeleton-glow` (teal-tinted pulsing box-shadow, already in `tailwind.config.js`). Paired with a static `border-[#10B981]/40` and a "Corrigiendo tu redacción…" pill anchored top-right of the essay card.

## Gotchas
- `fetchOrCreateDraftAttempt` now returns `{ ...attempt, correction: {...} | null }` — callers must destructure the correction.
- The autosave hook stays mounted in all views but idles naturally when the textarea is read-only (value never changes → hook short-circuits).
- `EssayEditor` autoFocus should be false in non-editor views to avoid focus-stealing on reload.
