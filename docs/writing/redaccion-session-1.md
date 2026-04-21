# Redacción · Session 1 — Data model + lesson page card

**Status:** Ready to build
**Ships:** Visible Redacción card on every lesson, scope-selection modal, mocked assignment creation with real CRUD.

---

## 1. Why this session exists

Before we touch the LLM we need the structural shell: a database that can hold assignments, a card on the lesson page that lists them, and a modal that lets the user pick scope (single lesson vs unit). Generation is **mocked** — `assignment.create` persists a hardcoded brief and redirects to a placeholder assignment page. This unblocks all UI work downstream without dragging prompt iteration into the same session.

Low risk, high value: it makes the feature visible, exercises the Prisma schema end-to-end, and validates the card geometry before we invest in the editor.

---

## 2. Context you need

Piñata is a Spanish-learning PWA. Lessons live under weeks. The lesson page already has cards for **Quizzes** and **Links** — the new **Redacción** card sits between them and should look and behave like the Quizzes card (same header pattern, same row density, same dashed "add" footer). See `CLAUDE.md` for the broader architecture (dual Next.js + React Router setup, offline-first API wrapper in `src/lib/api.js`, Supabase auth with Bearer token on every API route).

Future sessions will:
- **Session 2** fill in real LLM generation behind `assignment.create` / `assignment.regenerate`.
- **Session 3** build the full editor at `/lessons/[lessonId]/redaccion/[assignmentId]`.
- **Session 4** add correction + review.

Your placeholder assignment page in this session is throwaway — any route that shows "Assignment {id}" and a delete button is fine. Session 3 replaces it.

---

## 3. Mocks to follow

All mocks live in `docs/writing/`. Open each in a browser before starting.

### Primary
- **`02-lesson-page.html`** — card geometry, placement in right rail, row states (*Corregida* / *Borrador*), populated vs empty, "NEW" ribbon. This is the exact target: match row layout, badge styling, and the dashed `+ Generar redacción` footer.
- **`03-scope-dialog.html`** — 480px centered dialog, two radio cards, **Unidad completa** as the recommended default (badge), contributing-lesson chips visible under the unit option so the user can see which lessons will feed the prompt.
- **`06-mobile-screens.html`** — sections **06** (mobile card) and **07** (bottom-sheet scope picker). **Ignore sections 08 and 09 this session** — those belong to Sessions 3 and 4.

### Reference
- **`10-component-states.html`** — the "Card · empty state" panel. Match this when a lesson has 0 assignments.

---

## 4. Tasks

### Schema

Three new models + one enum. Prisma:

```prisma
model Assignment {
  id          String   @id @default(cuid())
  lessonId    String
  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  userId      String
  scope       AssignmentScope  // SINGLE_LESSON | UNIT
  title       String
  brief       Json     // structured brief — shape locked in Session 2
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
  segments    Json     // correction segments — shape locked in Session 4
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

Additional work:
- Add `assignments` relation to `Lesson` and `User` models
- Cascade deletes must chain: lesson → assignment → attempt → correction
- `brief` and `segments` stay as `Json` for now — they will iterate during prompt tuning, and normalization can come later if the shapes stabilize
- Generate and run the migration. Migrations in this project are applied via the Supabase dashboard, not CLI (see `supabase/migrations/`)

### API / route handlers
Three endpoints in `app/api/`:
- `assignment.listByLesson` — returns assignments for a lesson, ordered newest first, each with `{ id, title, latestAttempt: { wordCount, status }, createdAt }`
- `assignment.create` — accepts `{ lessonId, scope }`, writes an `Assignment` row with a **hardcoded mock brief** (reuse any plausible title + structure — Session 2 swaps this out), returns the full record
- `assignment.delete` — deletes by id, cascades

All three must validate the Bearer token and use the Supabase client so RLS applies (see `CLAUDE.md`).

### UI
- Add the **Redacción** card to the lesson page between Quizzes and Links
- Card header: icon + *Redacción* + count on right
- Rows: *Título · N palabras · fecha · badge (Borrador | Corregida)* — tapping a row navigates to `/lessons/[lessonId]/redaccion/[assignmentId]` (placeholder page is fine)
- Dashed `+ Generar redacción` footer button
- Empty state per `10-component-states.html`
- **Scope modal**:
  - Desktop: shadcn `Dialog`, ~420–480px wide
  - Mobile: shadcn `Sheet`, bottom, full-width
  - Two radio cards: *Solo esta lección* and *Unidad completa* (default, *Recomendado* badge, chips of contributing lessons)
  - Disable *Unidad completa* if the unit contains only one lesson
  - Primary *Generar*, secondary *Cancelar*
- On generate: call `assignment.create`, redirect to the placeholder assignment page

### Placeholder assignment page
Route `/lessons/[lessonId]/redaccion/[assignmentId]`. Minimal — title, "Assignment page coming in Session 3", delete button that calls `assignment.delete` and routes back to the lesson.

---

## 5. Acceptance criteria

- Card renders between Quizzes and Links on every lesson, on desktop and mobile
- Empty state matches the mock panel in `10-component-states.html`
- Opening the modal works on desktop (Dialog) and mobile (Sheet)
- Submitting the modal creates an `Assignment` row with a mock brief and navigates to the placeholder page
- List refreshes and shows the new assignment
- Delete works and cascades cleanly (no orphan attempts/corrections if they somehow exist)
- *Unidad completa* is disabled when the unit has only one lesson
- Rows show the correct status badge based on whether any attempt has a correction

---

## 6. Edge cases you must handle

- **No lessons in unit yet**: disable *Unidad completa* if the unit contains only one lesson
- **Delete assignment**: confirm dialog; cascade deletes all attempts + corrections (schema does this for you, but verify no orphan rows in a manual test)
- **Lesson deleted with assignments attached**: cascade delete — already covered by the `onDelete: Cascade` on `Assignment.lesson`

---

## 7. Out of scope for this session

- Real LLM generation (Session 2)
- The editor / brief rendering / autosave / word count (Session 3)
- The *Regenerar tema* button — its endpoint can wait until Session 2
- Corrections, review UI, attempts stepper, v2 flow (Session 4)
