# Redacción — Writing Assignments Feature

**App:** Piñata
**Feature area:** Lessons → Redacción
**Status:** Draft PRD
**Owner:** Iulian

---

## 1. Overview

Add a **Redacción** (composition) feature to every lesson. Users can generate an AI-written Spanish essay assignment scoped to either a single lesson or a full unit, write their response inside the app with autosave and live word count, and submit it for AI correction. Corrections are rendered inline with visible strikethroughs, suggestions, and notes — no hover required — so the whole review is screenshot-friendly for a human tutor.

The core goal is to give the user a structured writing practice loop that mirrors school homework: *prompt → draft → corrections → revision → share with tutor*.

---

## 2. Goals & Non-Goals

### Goals
- Generate pedagogically useful writing assignments from lesson content (outcomes, vocab, grammar targets)
- Persist assignments per lesson with support for multiple assignments per lesson over time
- Provide a focused writing environment on both desktop and mobile
- Deliver AI corrections that are fully visible inline (screenshot-ready)
- Support revision cycles (v1 → corrections → v2) to build a progress loop

### Non-Goals (v1)
- Word/PDF export with embedded comments (screenshot covers it)
- Rich-text copy with comments preserved
- Sharing with the tutor via the app (tutor is offline/external)
- Feedback-informed next-assignment generation (factoring tutor's manual corrections into future prompts) — interesting future work, out of scope now
- Multi-language support (assignments are Spanish-only)

---

## 3. User Stories

- As a learner, I want to generate a writing assignment for the lesson I just studied, so I can practice the exact grammar and vocab while it's fresh.
- As a learner, I want assignments scoped to a full unit, so I can do a weekly review that pulls from 3 lessons at once.
- As a learner, I want to write inside the app with autosave, so I never lose work.
- As a learner, I want to see how many words I've written vs the target, so I know when I'm done.
- As a learner, I want the AI to correct my essay with errors marked inline, so I can screenshot the result and share it with my tutor.
- As a learner, I want to write a version 2 after corrections, so I can internalize the feedback.
- As a learner on mobile, I want to toggle between the brief and my essay without losing my place, so I can check requirements mid-sentence.

---

## 4. Core User Flows

### 4.1 Generate assignment
1. User opens a lesson
2. Scrolls to **Redacción** card (between Quizzes and Links)
3. Taps `+ Generar redacción`
4. Modal asks: *Solo esta lección* or *Unidad completa* (default)
5. Taps *Generar*
6. Loading state (LLM call)
7. Lands on assignment page with fresh brief + empty textarea

### 4.2 Write
1. User types into textarea
2. Autosaves every 3s after last keystroke, on blur, on route change
3. Word count updates live, colored against target range
4. Mobile: user can tap `Tarea` in the segmented control at any time to re-read the brief, tap `Escribir` to return

### 4.3 Regenerate
1. User taps *Regenerar tema* on assignment page
2. If essay is empty: replaces brief silently
3. If essay has content: confirm dialog *"Vas a perder tu redacción actual. ¿Continuar?"*

### 4.4 Correct
1. User taps *Corregir* (only enabled when word count ≥ minimum target)
2. LLM call with assignment brief + essay + correction rubric
3. Review UI renders: summary, scores, inline-corrected essay
4. User can screenshot, or tap *Escribir versión 2* to revise

### 4.5 Revise (v2)
1. From correction view, tap *Escribir versión 2*
2. New attempt created, textarea prefilled with v1
3. User revises, submits for correction again
4. All attempts are visible in a small stepper at the top of the assignment page

---

## 5. UI Specifications

### 5.1 Lesson page integration

New card between **Quizzes** and **Links**, styled identically to the Quizzes card:

- Header: icon + *Redacción* + count on right
- List of existing assignments, each showing: *Título · N palabras · fecha generada · estado (borrador / corregida)*
- Dashed `+ Generar redacción` button at the bottom
- Tap an existing assignment → navigate to assignment page

### 5.2 Scope selection modal

- Desktop: shadcn `Dialog`, centered, ~420px wide
- Mobile: shadcn `Sheet`, bottom, full-width
- Two radio cards:
  - **Solo esta lección** — *"Basado en el contenido de esta lección."*
  - **Unidad completa** — *"Basado en las lecciones de la unidad."* (default, badge: *Recomendado*)
- Primary button: *Generar*
- Secondary: *Cancelar*

### 5.3 Assignment page — desktop

URL: `/lessons/[lessonId]/redaccion/[assignmentId]`

Two-column layout, 40/60 split:

- **Left column (sticky, internally scrollable)**: brief
  - Título, extensión target, nivel
  - Misión
  - Requisitos obligatorios
  - Estructura sugerida
  - Preguntas de apoyo
  - Consejo del día
- **Right column (internally scrollable)**: editor
  - Large textarea, comfortable line-height (`text-base` or `text-lg`), generous max-width
  - Sticky footer inside the column: word count (`142 / 180–220`), save indicator (*Guardado* / *Guardando…*), *Regenerar tema*, *Corregir* (primary)

Both columns scroll independently. The brief is always visible.

### 5.4 Assignment page — mobile

- Segmented control pinned to the top: `[ Tarea | Escribir ]`
- Stays visible even with keyboard open
- **Tarea view**: brief full-width, comfortable reading
- **Escribir view**: textarea fills viewport, sticky bottom bar with word count + save indicator + action buttons
- Swipe left/right also switches between views
- State persists across switches (no reset of scroll or cursor position)

### 5.5 Word count behavior

- Format: `{current} / {min}–{max}`
- Below `min`: grey/muted
- Within range: green
- Above `max`: amber (soft warning, not blocking)
- Update live on every keystroke (no debounce for visual; debounce only for save)

### 5.6 Save indicator

- `Guardando…` while debounced save is in flight
- `Guardado` after success, shown as muted text next to word count
- On failure: `Error al guardar` in red, with a *Reintentar* link

### 5.7 Correction review UI

Rendered after *Corregir* returns. Same page, different mode.

Top of page:
- Overall summary (1-2 sentences of plain-Spanish feedback)
- Three horizontal score bars: *Gramática*, *Vocabulario*, *Estructura* (each 0–10)

Below: the essay, rendered with inline corrections. No hover dependencies.

**Major error (red):**
- Original text with red strikethrough
- Correction in green immediately after
- Note in small italic grey text on the line below or inline parenthetical
- Example:  ~~son~~ **es** *(concordancia: "la familia" es singular)*

**Minor issue (amber):**
- Suggested text shown in amber with dotted underline
- Suggestion appears inline in brackets
- Example: *muy simpática* \[→ muy cariñosa\] *(más natural aquí)*

**OK segments:** rendered as plain text, unchanged.

All notes are visible by default. This makes the entire review screenshot-ready — the tutor sees everything without needing to interact with the UI.

Bottom of review:
- *Escribir versión 2* (primary)
- *Volver* (secondary)

### 5.8 Attempts stepper

If an assignment has more than one attempt, show a small stepper at the top of the page:

`Versión 1 · corregida` → `Versión 2 · borrador`

Tapping a step navigates to that version's view (editor for drafts, review for corrected).

---

## 6. Data Model

Three new tables. Prisma schema:

```prisma
model Assignment {
  id          String   @id @default(cuid())
  lessonId    String
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  userId      String
  scope       AssignmentScope  // SINGLE_LESSON | UNIT
  title       String
  brief       Json     // structured brief: mision, requisitos, estructura, preguntas, consejo, extensionMin, extensionMax, nivel
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  attempts    Attempt[]

  @@index([lessonId, userId])
}

model Attempt {
  id            String   @id @default(cuid())
  assignmentId  String
  assignment    Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  versionNumber Int      // 1, 2, 3...
  essay         String   @db.Text
  wordCount     Int      @default(0)
  submittedAt   DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  correction    Correction?

  @@unique([assignmentId, versionNumber])
}

model Correction {
  id          String   @id @default(cuid())
  attemptId   String   @unique
  attempt     Attempt  @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  segments    Json     // array of { type: "ok" | "major" | "minor", text?, original?, correction?, suggestion?, note? }
  summary     String   @db.Text
  scoreGrammar     Int
  scoreVocabulary  Int
  scoreStructure   Int
  createdAt   DateTime @default(now())
}

enum AssignmentScope {
  SINGLE_LESSON
  UNIT
}
```

Notes:
- `brief` is stored as JSON to stay flexible during prompt iteration
- `segments` is JSON for the same reason; if the shape stabilizes, consider normalizing later
- Each assignment can have many attempts; each attempt has at most one correction
- Cascading deletes keep the lesson → assignment → attempt → correction chain clean

---

## 7. LLM Integration

### 7.1 Generation

Input context to the LLM:
- Lesson markdown(s) — one if `SINGLE_LESSON`, all lessons in the unit if `UNIT`
- Overall lesson summary (for context beyond target scope, optional)
- User profile snippets: city (Estepona), partner (Sabina), hobbies (jiu-jitsu, pickleball, weights, coding)

System instruction outline:
- "You are generating a Spanish writing assignment for an A1–A2 learner."
- Output must be 100% in Spanish
- Must respect grammar and vocab introduced in the provided lessons
- Must include: título, misión, extensión target (min–max), requisitos obligatorios, estructura sugerida, preguntas de apoyo, consejo del día
- Personalize lightly using the user profile but do not force it
- Return structured JSON matching the `brief` schema

Extension targets by estimated progress:
- First ~15 lessons: 120–180 words
- Lessons 15–40: 180–220 words
- Lessons 40+: 250–350 words

For v1, keep it simple: default to 180–220 and tune later.

### 7.2 Correction

Input to the LLM:
- The full `brief` (so it knows what the student was asked to do)
- The student's `essay`
- The correction rubric (system instruction)

System instruction outline:
- "You are a Spanish tutor correcting an A1–A2 learner's essay."
- Return structured JSON with:
  - `segments`: ordered array covering the **entire** essay, each segment typed `ok` | `major` | `minor`
  - `summary`: 1–2 sentences, encouraging but honest
  - `scoreGrammar`, `scoreVocabulary`, `scoreStructure`: 0–10 integers
- Classify as `major` anything that breaks comprehension or grammar rules (wrong conjugation, wrong gender agreement, wrong verb choice)
- Classify as `minor` stylistic improvements or more natural phrasings
- Keep notes short (1 sentence), in Spanish, written at learner level
- Do not rewrite the whole essay — preserve the student's voice

Expected JSON shape:

```json
{
  "segments": [
    { "type": "ok", "text": "Mi familia " },
    { "type": "major", "original": "son", "correction": "es", "note": "'La familia' es singular." },
    { "type": "ok", "text": " grande. Mi madre " },
    { "type": "minor", "original": "es muy simpática", "suggestion": "es muy cariñosa", "note": "Más natural en este contexto." }
  ],
  "summary": "Buen uso de posesivos. Revisa la concordancia entre sujeto y verbo.",
  "scoreGrammar": 7,
  "scoreVocabulary": 8,
  "scoreStructure": 8
}
```

Validation on the server: reassemble `segments` into plain text and verify it roughly matches the submitted essay (catch malformed LLM output). If mismatch, retry once, then error.

---

## 8. Edge Cases & Error States

- **No lessons in unit yet**: *Unidad completa* option disabled if only one lesson exists in the unit
- **Regenerate with content**: confirm dialog, destructive styling
- **Delete assignment**: confirm dialog, cascades to all attempts + corrections
- **LLM generation failure**: show retry button, don't persist a half-generated assignment
- **LLM correction failure**: keep the essay intact, show error with retry
- **Correction returns text that doesn't reassemble to the essay**: treat as failure, retry once
- **Essay below minimum word count**: *Corregir* button disabled with tooltip *"Escribe al menos X palabras"*
- **Network drop mid-autosave**: retry with exponential backoff, show `Error al guardar · Reintentar`
- **Offline**: editor continues to work, autosave queues locally (reuse existing offline patterns in app), syncs on reconnect
- **Lesson deleted with assignments attached**: cascade delete

---

## 9. Session Breakdown

Four sessions. Each is independently shippable and testable.

### Session 1 — Data model + lesson page card

**Goal:** Structural foundation. Users can see the Redacción card and open the scope modal, but generation is mocked.

Tasks:
- Prisma schema: `Assignment`, `Attempt`, `Correction`, `AssignmentScope` enum
- Migration
- Add `assignments` relation to `Lesson` and `User`
- tRPC/route handlers for:
  - `assignment.listByLesson`
  - `assignment.create` (mocked brief for now)
  - `assignment.delete`
- Lesson page: add **Redacción** card between Quizzes and Links
- List existing assignments (title, word count, date, status badge)
- `+ Generar redacción` button
- Scope selection modal (Dialog on desktop, Sheet on mobile) with *Solo esta lección* / *Unidad completa*
- On submit: call `assignment.create` with a hardcoded mock brief, redirect to a placeholder assignment page

Acceptance:
- Card visible, lists assignments, can open modal, can create mock assignment, lands on placeholder page
- Delete works
- Works on mobile and desktop

---

### Session 2 — Generation (LLM)

**Goal:** Real assignment briefs generated from lesson content.

Tasks:
- Server endpoint `assignment.generate` that:
  - Loads lesson(s) based on scope
  - Loads user profile snippets (city, partner, hobbies)
  - Calls the configured LLM with the generation prompt
  - Validates structured JSON output
  - Persists as `Assignment.brief`
- Replace the mocked create path with real generation
- Add `assignment.regenerate` endpoint (updates brief, leaves attempts untouched)
- Regenerate button on assignment page (placeholder page is fine for now)
- Confirm dialog if any attempt has essay content
- Loading state during generation (skeleton or spinner)
- Error handling with retry

Acceptance:
- Generated briefs are in Spanish, relevant to lesson content, respect structure
- Regenerate works with and without existing essay
- Errors show a retry button, don't leave orphan records

---

### Session 3 — Editor (desktop + mobile)

**Goal:** Real writing experience. No corrections yet.

Tasks:
- Route `/lessons/[lessonId]/redaccion/[assignmentId]`
- Desktop two-column layout (40/60, sticky brief, sticky editor footer)
- Mobile segmented control with swipe between `Tarea` and `Escribir`
- Brief rendering component (shared between desktop and mobile)
- Textarea component with:
  - 3s debounced autosave
  - Save on blur
  - Save on route change / unmount
  - Word count (live)
  - Save indicator
- Word count component with target range coloring
- `attempt.updateEssay` endpoint
- On first load, ensure an `Attempt` v1 exists for the assignment (create on demand)
- Delete assignment from this page
- Handle offline / network failure gracefully

Acceptance:
- Can type, leave, come back, see text restored
- Word count updates live, colors correctly
- Mobile segmented control works smoothly, stays visible with keyboard
- Autosave is reliable across tab close, refresh, offline

---

### Session 4 — AI correction + review UI

**Goal:** Submit essay, get inline-visible corrections, support v2.

Tasks:
- Server endpoint `attempt.correct` that:
  - Loads brief + essay
  - Calls LLM with correction prompt
  - Validates JSON shape
  - Validates segment reassembly matches essay
  - Persists as `Correction`
- *Corregir* button on assignment page (enabled at min word count)
- Loading state during correction
- Review UI:
  - Summary block + 3 score bars at top
  - Inline-rendered segments (ok / major / minor) with all notes visible
  - No tooltips, no hover dependencies — screenshot-ready
- *Escribir versión 2* button that creates a new `Attempt` with `versionNumber + 1`, prefilled with v1 essay
- Attempts stepper at top of assignment page when >1 attempt exists
- Route between attempts cleanly (editor vs review based on attempt state)

Acceptance:
- Corrections render inline correctly for major and minor
- All feedback visible without hover — full screenshot captures everything
- Score bars and summary display
- v2 flow works end to end
- Can navigate between v1 and v2 via stepper

---

## 10. Out of Scope (future work)

- Factoring tutor's offline feedback into next assignment generation (would need a "paste tutor corrections" input and context carry-over)
- Difficulty scaling based on past scores
- Streaks / gamification tied to Redacción
- Audio dictation of essay as alternative input
- Export to PDF with comments
- Sharing URL for tutor read-only view

---

## 11. Open Questions

- Minimum word count threshold to enable *Corregir* — default to `briefExtensionMin × 0.7`?
- Should we cap attempts per assignment (e.g., max 3 versions) to prevent infinite retries?
- Should the correction prompt try to notice whether the student used the required grammar/vocab from the brief and surface that in the summary? (Probably yes — adds real value, marginal prompt cost.)
