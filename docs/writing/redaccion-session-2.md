# Redacción · Session 2 — Generation (LLM)

**Status:** Blocked on Session 1 (needs schema + `assignment.create` endpoint)
**Ships:** Real LLM-generated briefs persisted to `Assignment.brief`. Replaces Session 1's mocked create path.

---

## 1. Why this session exists

Session 1 put a card, a modal, and a schema in place — but the `brief` JSON was hardcoded. This session wires up the real LLM call. It is intentionally isolated from editor work (Session 3) so prompt iteration doesn't destabilize the writing experience. Nothing in the editor depends on anything you do here except the shape of `Assignment.brief` — and that shape is already locked by the mocks.

---

## 2. Context you need

### What exists now (post Session 1)
- Prisma models: `Assignment`, `Attempt`, `Correction`
- Endpoints: `assignment.listByLesson`, `assignment.create` (mocked), `assignment.delete`
- Lesson-page card + scope modal that drive into `assignment.create`
- A placeholder assignment page

### Piñata's AI plumbing
The app already has a provider dispatcher you should reuse — don't roll your own HTTP client. From `CLAUDE.md`:
- `lib/ai/provider.js` dispatches to `lib/ai/providers/{anthropic,openai}.js`
- `lib/ai/models.js` defines available models and per-feature defaults
- `prompts/` holds markdown prompt templates, loaded by `lib/ai/prompts/load-prompt.js` with `{{variable}}` interpolation

Register a new feature (e.g. `redaccion_generation`) in `lib/ai/models.js` with a sensible default model, add a per-feature user override to the `user_models` table flow, and put the prompt template in `prompts/redaccion/generation.md`.

User profile context for personalization (already available in the codebase — check the `user` / profile tables): city is Estepona, partner Sabina, hobbies are jiu-jitsu, pickleball, weights, coding. Use lightly, don't force it into every prompt.

---

## 3. Mocks to follow

### Primary
- **`04-assignment-editor.html` — LEFT COLUMN ONLY (the brief surface).** This defines the exact JSON shape your LLM must output. The visible fields on the brief are the contract:
  - **Título**
  - **Extensión target** (min–max words) + **Nivel**
  - **Misión**
  - **Requisitos obligatorios** (list)
  - **Estructura sugerida** (list)
  - **Preguntas de apoyo** (list)
  - **Consejo del día**

  The Prisma `Assignment.brief` Json column **must use these exact field names** (camelCased equivalents below). Future sessions render the brief directly from this JSON — any rename breaks them.

- **`10-component-states.html`** — the **"Loading · generation & correction"** panel (the *Generando tema…* skeleton) is what the scope modal and the regenerate flow should show while the LLM is working. Also match the **"Save indicator"** error state for generation failures (the *Error al guardar · Reintentar* pattern applies here too — just with different copy: *No pudimos generar el tema · Reintentar*).

### Reference
- **`06-mobile-screens.html` — section 08A (mobile Tarea view).** Confirms the brief renders identically on mobile from the same JSON. You're not building that screen in this session, but make sure the JSON you produce has everything that view needs.

---

## 4. Tasks

### Prompt + provider wiring
- Create `prompts/redaccion/generation.md` with a system + user template.
- Register `redaccion_generation` feature in `lib/ai/models.js`. Default model: match what other Spanish-content features use (check `models.md`).
- Add a Settings entry so the user can override the model per-feature (same pattern as `carolina_chat`, `vocabulary`, `pdf_processing`).

### Generation prompt outline

Input context the prompt should receive via `{{variable}}` interpolation:
- The lesson's markdown body — one lesson if `scope === SINGLE_LESSON`, all lessons in the unit if `scope === UNIT`
- An overall lesson summary for wider context (optional, if available)
- User profile snippets: city (Estepona), partner (Sabina), hobbies (jiu-jitsu, pickleball, weights, coding)

System-instruction rules (encode in the `.md` template):
- "You are generating a Spanish writing assignment for an A1–A2 learner."
- Output is 100% Spanish
- Respect the grammar and vocabulary introduced in the provided lessons — don't reach beyond them
- Must produce all seven brief field groups (titulo, nivel, extensionMin/Max, mision, requisitos, estructura, preguntas, consejo)
- Personalize lightly using the profile snippets, but don't force them — not every brief needs to reference Sabina or jiu-jitsu
- Return strict JSON matching the brief schema below — no prose wrapper, no markdown code fences

### Brief JSON schema (Prisma `Assignment.brief` column)
```json
{
  "titulo": "string",
  "nivel": "A1" | "A2",
  "extensionMin": 120,
  "extensionMax": 220,
  "mision": "string",
  "requisitos": ["string", ...],
  "estructura": ["string", ...],
  "preguntas": ["string", ...],
  "consejo": "string"
}
```
Validate on the server after the LLM returns. Reject + retry once on malformed output.

### Extension target defaults
Ideal progression:
- First ~15 lessons: 120–180
- Lessons 15–40: 180–220
- Lessons 40+: 250–350

For v1, default to 180–220 and tune later. A simple lesson-index-based heuristic is enough. The values end up in `brief.extensionMin` / `brief.extensionMax` and drive the editor's word-count display in Session 3.

### Endpoints
- Replace `assignment.create`'s mocked brief with a real call:
  1. Load the lesson (or all lessons in the unit if `scope === UNIT`)
  2. Load the user's profile snippets
  3. Load + interpolate the prompt
  4. Call the configured LLM via `lib/ai/provider.js`
  5. Validate JSON
  6. Persist as `Assignment.brief`, return the record
- Add **`assignment.regenerate`** — accepts `{ assignmentId }`, re-runs generation, **updates `brief` in place, leaves attempts untouched**. Returns the updated record.
- Both endpoints use Bearer-token validation + Supabase RLS like all other `app/api/` routes.

### UI integration
- Scope modal *Generar* button: show the skeleton state from `10-component-states.html` while the call is in flight. On failure, show the retry pattern; don't persist a half-generated assignment.
- On the placeholder assignment page: add a *Regenerar tema* button.
  - If the assignment's current attempt has no essay text: regenerate silently
  - If the current attempt has content: confirm dialog — *"Vas a perder tu redacción actual. ¿Continuar?"* (destructive styling)
  - Same skeleton + error handling as generation

### Error handling details
- Generation failure: no orphan `Assignment` row. Wrap creation in a transaction or defer insert until after validation.
- Retry once on malformed JSON before surfacing the error.
- Timeout: set a reasonable upper bound (e.g. 45s) so a stuck provider doesn't freeze the modal.

---

## 5. Acceptance criteria

- Generated briefs are fully in Spanish, structurally match the JSON schema, and are relevant to the lesson(s) in scope
- The unit-scoped path loads all lessons in the unit and reflects them in the brief content
- Personalization shows up lightly (a prompt or example referencing a hobby / partner / city) without being forced
- Skeleton state renders during generation on both desktop and mobile
- Regenerate works with and without existing essay content, with correct confirm-dialog behavior
- Generation or regeneration failures show a retry control and leave no orphan records
- The brief JSON is shape-complete for the Session 3 editor's left-column render (all seven field groups present)

---

## 6. Out of scope for this session

- Rendering the brief in a real editor layout (Session 3)
- Anything in the right-column editor (textarea, autosave, word count, save indicator) — Session 3
- Correction pipeline (Session 4)
- Difficulty scaling based on past scores, feedback-informed generation (future work, PRD §10)
