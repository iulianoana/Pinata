# Redacción · Session 4 — AI correction + review UI

**Status:** Blocked on Session 3 (needs real editor + `Attempt` rows with essays)
**Ships:** Submit for correction, inline screenshot-ready review UI, v2 revision flow, attempts stepper.

---

## 1. Why this session exists

This closes the loop: *prompt → draft → corrections → revision → share with tutor*. The correction view is the most visually opinionated surface in the feature — every note must be visible without hover because the user screenshots the review and sends it to a human tutor. No tooltips, no accordions, no "click to expand". Everything inline, all the time.

---

## 2. Context you need

### What exists now (post Sessions 1–3)
- Full editor at `/lessons/[lessonId]/redaccion/[assignmentId]`
- `Attempt` rows with real essays, autosaved
- *Corregir* button rendered **disabled** with a word-count threshold tooltip — you're enabling it this session
- Attempts-stepper slot in the top of the editor is empty / single-item — you're populating it
- `Correction` Prisma model exists (from Session 1) but has never been written to

### AI plumbing
Reuse `lib/ai/provider.js` and the prompt-loader pattern established in Session 2. Register a new feature (e.g. `redaccion_correction`) in `lib/ai/models.js` with its own default model + user override. Put the prompt at `prompts/redaccion/correction.md`.

---

## 3. Mocks to follow

### Primary
- **`05-correction-review.html`** — full desktop layout + the critical legend + the inline rendering pattern. The callouts at the bottom of that file are **non-negotiable spec**:
  - **Screenshot-ready** — every note and correction visible without interaction
  - **Major vs minor** distinction — red strikethrough + green replacement for major; amber dotted underline + bracketed suggestion for minor
  - **Reassembly check** — server validates that reassembling `segments` into plain text roughly matches the submitted essay; on mismatch, retry once then error
- **`06-mobile-screens.html` — section 09 (mobile correction review).** Note the **3-column compact score grid** on mobile vs **stacked horizontal bars** on desktop. Different component, same data.
- **`10-component-states.html`** — three panels matter here:
  - **"Correction segments · 3 kinds"** — exact rendering for `ok` / `major` / `minor` segments
  - **"Attempts stepper · progression"** — all four states: drafting, corrected, v2 drafting, max reached. Wire all four.
  - **"Corrigiendo tu redacción…"** — loading skeleton to show while the correction call is in flight

---

## 4. Tasks

### Prompt + provider wiring
- Create `prompts/redaccion/correction.md`
- Register `redaccion_correction` feature in `lib/ai/models.js` + Settings per-feature override (same pattern as generation in Session 2)

### Correction prompt outline

Inputs via `{{variable}}` interpolation:
- The full `brief` JSON (so the tutor knows what was asked)
- The student's `essay`

System-instruction rules (encode in the `.md` template):
- "You are a Spanish tutor correcting an A1–A2 learner's essay."
- Return strict JSON matching the schema below — no prose wrapper, no markdown fences
- `segments` must be an ordered array covering the **entire** essay, each segment typed `ok` | `major` | `minor`
- Classify as `major` anything that breaks comprehension or grammar rules (wrong conjugation, wrong gender agreement, wrong verb choice)
- Classify as `minor` stylistic improvements or more natural phrasings
- Keep notes short (1 sentence), in Spanish, written at learner level
- Do **not** rewrite the whole essay — preserve the student's voice
- The `summary` should explicitly comment on whether the student used the required grammar/vocab from `brief.requisitos` — this is the feedback that makes the review feel pedagogical rather than just a spellcheck
- `scoreGrammar`, `scoreVocabulary`, `scoreStructure` are integers 0–10, encouraging but honest

### Correction JSON schema (Prisma `Correction` column)
```json
{
  "segments": [
    { "type": "ok",    "text": "Mi familia " },
    { "type": "major", "original": "son", "correction": "es", "note": "'La familia' es singular." },
    { "type": "ok",    "text": " grande. Mi madre " },
    { "type": "minor", "original": "es muy simpática", "suggestion": "es muy cariñosa", "note": "Más natural en este contexto." }
  ],
  "summary": "Buen uso de posesivos. Revisa la concordancia entre sujeto y verbo.",
  "scoreGrammar": 7,
  "scoreVocabulary": 8,
  "scoreStructure": 8
}
```
`segments` must cover the **entire essay** in order. Server-side validation:
1. Parse JSON strictly
2. Reassemble by concatenating `text` (for `ok`) / `original` (for `major` and `minor`)
3. Compare to the submitted essay with loose whitespace normalization
4. On mismatch: retry the LLM once, then surface an error (don't persist partial results)

### Endpoint
- `attempt.correct` — accepts `{ attemptId }`:
  1. Load brief + essay
  2. Call LLM
  3. Validate JSON + reassembly
  4. Persist as `Correction` (1:1 with `Attempt`)
  5. Return the attempt with its correction
- Bearer token + Supabase RLS like all other routes

### Enable *Corregir*
- Enable when `wordCount >= Math.round(brief.extensionMin * 0.7)` (threshold from Session 3)
- Clicking shows the **"Corrigiendo tu redacción…"** skeleton from `10-component-states.html`
- On success: flip the same route into **review mode** (see below)
- On error: keep the essay intact, surface retry

### Review mode (same route, different render)
The same `/lessons/[lessonId]/redaccion/[assignmentId]` URL renders review mode when the currently-selected attempt has a `Correction`.

Desktop layout (per `05-correction-review.html`):
- Top: summary (1–2 sentences) + three horizontal score bars (Gramática, Vocabulario, Estructura, 0–10)
- Middle: the essay, rendered with inline segments
  - `ok`: plain text
  - `major`: `~~original~~` (red strikethrough) **correction** (green) *(note)* in italic grey
  - `minor`: *original* with amber dotted underline, then `[→ suggestion]` and *(note)* inline
- Bottom: *Escribir versión 2* (primary) + *Volver* (secondary)

Mobile (per `06-mobile-screens.html` section 09):
- Replace the stacked horizontal bars with a **3-column compact score grid**
- Otherwise the inline rendering is identical

### v2 flow
- *Escribir versión 2* creates a new `Attempt` with `versionNumber = currentVersion + 1`, `essay` prefilled with v1's text
- Routes the user back to editor mode on that new attempt
- Corrections don't propagate — the new attempt starts uncorrected

### Attempts stepper
Per `10-component-states.html` "Attempts stepper · progression":
- Show only when the assignment has >1 attempt
- Four visual states to wire: drafting, corrected, v2 drafting, max reached
- Tapping a step navigates to that version — editor mode if it's a draft, review mode if it has a correction
- **Cap:** 3 attempts per assignment. At 3, render *Escribir versión 2* disabled with a tooltip and show the "max reached" stepper state.

---

## 5. Acceptance criteria

- `Corregir` enables at the right threshold, shows the skeleton, persists a `Correction` on success
- Malformed LLM output is retried once; a second failure shows an error and does **not** persist a half-written row
- Reassembly check catches LLM drift (segments that don't reconstruct the essay)
- Inline rendering matches the mock exactly for `ok`, `major`, `minor` — no hover, no tooltips, all notes visible
- Desktop shows stacked score bars; mobile shows the 3-column compact grid; same data
- *Escribir versión 2* creates a v2 attempt prefilled with v1, routes into the editor on v2
- Attempts stepper appears once >1 attempt exists, cycles through all four states correctly, and navigates between versions (editor vs review based on attempt state)
- 3-attempt cap enforced with the correct stepper state + disabled primary button
- Screenshot of the review page shows 100% of feedback with no interaction required

---

## 6. Edge cases you must handle

- **LLM correction failure**: keep the essay intact; surface error with retry; do not persist a partial `Correction`
- **Correction returns text that doesn't reassemble to the essay**: treat as failure; retry once; then error
- **User hits correct with content below threshold**: button is disabled in the first place; defensively reject on the server too
- **v2 attempt created while v1 still lacks a correction**: shouldn't be possible via UI; server rejects if the previous attempt has no correction
- **3rd attempt corrected**: block further v2 creation (the cap)

---

## 7. Out of scope for this session

- Word/PDF export with embedded comments (screenshot is the ship-here mechanism)
- Sharing URL for tutor read-only view
- Feedback-informed next-assignment generation (factoring tutor's offline corrections into future prompts)
- Difficulty scaling based on past scores
- Audio dictation of essay as alternative input
