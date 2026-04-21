# Redacción · Session 3 — Editor (desktop + mobile)

**Status:** Blocked on Session 2 (needs real `Assignment.brief` JSON)
**Ships:** The full writing experience — 40/60 desktop split, mobile segmented control, autosave, live word count. No corrections yet.

---

## 1. Why this session exists

This is the bulk of the UI work and the first session where the user can actually *use* the feature to draft essays. Corrections (Session 4) close the loop, but the editor is independently valuable — you can start using it to practice immediately, even before AI review is wired up.

The editor reads the brief produced by Session 2 and writes to `Attempt.essay`. It doesn't touch the `Correction` model at all.

---

## 2. Context you need

### What exists now (post Sessions 1–2)
- Prisma schema complete, migrations applied
- Real LLM generation behind `assignment.create` and `assignment.regenerate`
- Lesson-page card + scope modal drive into real generation
- A placeholder assignment page at `/lessons/[lessonId]/redaccion/[assignmentId]` that you will **replace** in this session
- `Assignment.brief` JSON has the shape Session 2 defined (titulo, nivel, extensionMin/Max, mision, requisitos, estructura, preguntas, consejo)

### Offline-first patterns you must reuse
Piñata has an established offline story (see `CLAUDE.md`):
- `src/lib/api.js` wraps all API calls with network-first + cache-fallback
- `src/lib/offline-cache.js` caches responses in IndexedDB (Dexie)
- `src/lib/syncQueue.js` queues write operations in localStorage when offline, auto-flushes on reconnect

Autosave **must** plug into `syncQueue.js` — don't invent a parallel mechanism. Offline editing should "just work" because of it.

### Styling context
The app is mid-migration from inline `style={{}}` + a `C` color object to Tailwind + shadcn. Both coexist. For this session, prefer Tailwind + shadcn — the editor is a greenfield surface and this is a chance to stay on the new stack. `cn()` helper is in `src/lib/utils.js`.

---

## 3. Mocks to follow

### Primary
- **`04-assignment-editor.html`** — the whole screen. Covers:
  - Top bar (back to lesson, assignment title, regenerate + delete)
  - Attempts stepper location (top, below top bar) — **the stepper UI itself lives in Session 4; leave the slot but it can be empty with a single v1 attempt**
  - 40/60 column split (brief left, editor right)
  - Sticky left column, internally scrollable
  - Sticky editor footer inside the right column: word count + save indicator + *Regenerar tema* + *Corregir*
  - **Note:** *Corregir* is rendered disabled in this session. Tooltip: *"Escribe al menos {N} palabras"*. Session 4 wires it up.
- **`06-mobile-screens.html`** — sections **08A (Tarea view)** and **08B (Escribir view with keyboard open)**. The handoff-notes column at the bottom of that file spells out segmented-control behavior — **read it before coding**. Key points:
  - Segmented control `[ Tarea | Escribir ]` pinned to top
  - Stays visible with the keyboard open
  - Swipe left/right switches views
  - State persists across switches (scroll position, cursor position, textarea content)
- **`10-component-states.html`** — the two most spec'd-out components of the session are here:
  - **"Word count · 4 states"** — below min (muted), in range (green), over max (amber), empty
  - **"Save indicator · 4 states"** — idle, *Guardando…*, *Guardado*, *Error al guardar · Reintentar*

### Reference
- **`02-lesson-page.html`** — just to confirm the "open assignment" navigation pattern from a card row (tap row → navigate). You already did the nav in Session 1; just sanity-check it still lands on the real editor now.

---

## 4. Tasks

### Route
Replace the Session 1 placeholder at `/lessons/[lessonId]/redaccion/[assignmentId]` with the real editor.

### Attempt bootstrap
On first load of an assignment, ensure an `Attempt` with `versionNumber: 1` exists. Create on demand if missing. The editor always operates on the latest draft attempt.

Add endpoint:
- `attempt.updateEssay` — accepts `{ attemptId, essay, wordCount }`, persists. Word count recomputed server-side as a safety net.

### Brief renderer (shared component)
Renders the `Assignment.brief` JSON into the seven field groups. Used by both desktop left column and mobile *Tarea* view — same component, different parent container.

### Desktop layout
- 40/60 split
- Sticky brief column (internally scrollable if the brief is long)
- Sticky editor footer inside the right column with word count, save indicator, *Regenerar tema*, *Corregir* (disabled)
- Textarea: comfortable line-height (`text-base` or `text-lg`), generous max-width

### Mobile layout
- Segmented control pinned top
- Swipe between *Tarea* and *Escribir*
- Keyboard stays well-behaved — segmented control visible, no scroll jumps
- State preserved across switches: scroll position on *Tarea*, cursor + scroll on *Escribir*
- Sticky bottom bar in *Escribir* with word count + save indicator + action buttons

### Autosave
- Debounced 3s after last keystroke
- Save on blur
- Save on route change / unmount (best effort — `navigator.sendBeacon` or equivalent for the unmount case)
- Use `syncQueue.js` so offline works transparently
- Show save-indicator states as specified in `10-component-states.html`
- On failure: *Error al guardar · Reintentar* link triggers a manual flush

### Word count
- Live on every keystroke (no debounce on the visual — debounce only on the save)
- Format `{current} / {min}–{max}` pulled from `brief.extensionMin` / `extensionMax`
- Color states per the mock: muted below min, green in range, amber over max (soft, non-blocking)

### Regenerate
Already wired in Session 2. Confirm it still works from the real editor: the button lives in the sticky editor footer; the confirm-dialog-if-content behavior is already implemented.

### Delete assignment
Button in the top bar. Confirm dialog, then call `assignment.delete`, route back to the lesson.

### *Corregir* button
Render it, disabled, with a tooltip *"Escribe al menos {threshold} palabras"*. Threshold: `Math.round(brief.extensionMin * 0.7)`. Session 4 enables it.

---

## 5. Acceptance criteria

- Can type, blur, reload, come back — text is restored
- Word count updates live on every keystroke and colors correctly through all four states from the mock
- Save indicator cycles through all four states correctly; *Reintentar* works
- Autosave is reliable across tab close, hard refresh, and going offline mid-write (queues and flushes on reconnect)
- Mobile segmented control stays visible with keyboard open
- Swipe between views works and preserves state
- Desktop sticky columns behave — brief stays put, editor footer stays put
- Brief renders identically on desktop left column and mobile *Tarea* view
- *Corregir* is disabled below the threshold with a tooltip; no pipeline wired yet
- Delete works and routes back to the lesson

---

## 6. Edge cases you must handle

- **Network drop mid-autosave**: retry with exponential backoff; show *Error al guardar · Reintentar*
- **Offline**: editor continues to work; autosave queues via `syncQueue.js` and syncs on reconnect
- **Essay below minimum word count**: *Corregir* disabled with the tooltip
- **Tab close / hard refresh mid-edit**: the on-unmount save must fire (use `navigator.sendBeacon` for the unmount path or equivalent)
- **Switching tabs/views on mobile mid-edit**: no state loss (cursor, scroll, textarea content all preserved)

---

## 7. Out of scope for this session

- Corrections pipeline, review UI, score bars, segment rendering (Session 4)
- Attempts stepper UI and v2 flow (Session 4) — single-v1 slot is fine here
- Any changes to the LLM prompt or generation flow (Session 2 territory)
