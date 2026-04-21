# Redacción · Session 1 — Implementation notes

Built the shell for Spanish writing assignments. Generation is **mocked** (hardcoded brief pool); Sessions 2–4 swap in the LLM + editor + corrections.

## Files

**New:**
- `supabase/migrations/20260421_assignments.sql` — apply via Supabase dashboard (not CLI)
- `app/api/assignments/route.js` — GET (list by `lesson_id`, nested join to latest attempt + correction), POST (mock brief)
- `app/api/assignments/[id]/route.js` — GET (for placeholder page) + DELETE
- `src/components/redaccion/RedaccionCard.jsx` — card with loading/empty/populated states + CTA
- `src/components/redaccion/AssignmentMiniCard.jsx` — row with status-aware icon (Pencil = Borrador, CheckCircle = Corregida)
- `src/components/redaccion/ScopePicker.jsx` — responsive Dialog/Sheet in one component (viewport `< 1024` → Sheet)
- `src/screens/RedaccionAssignmentRoute.jsx` — placeholder page, replaced in Session 3

**Edited:**
- `src/lib/api.js` — `fetchAssignmentsByLesson`, `fetchAssignment`, `createAssignment`, `deleteAssignment`
- `src/lib/offline-cache.js` — Dexie bumped to v4, new `assignments: "id, lesson_id"` store; `cacheAssignments()` replaces per lesson (avoids delete ghosts)
- `src/components/lessons/LessonReader.jsx` — `<RedaccionCard>` between Quizzes and Links in both render paths (desktop sidebar + mobile inline)
- `src/App.jsx` — route `/lesson/:lessonId/redaccion/:assignmentId`

## Schema (snake_case, not the doc's Prisma casing)

`assignments(id, lesson_id → lessons CASCADE, user_id → auth.users CASCADE, scope TEXT CHECK 'single_lesson'|'unit', title, brief JSONB, …)`
`attempts(id, assignment_id CASCADE, version_number, essay, word_count, submitted_at, UNIQUE(assignment_id, version_number))` — unused in S1
`corrections(id, attempt_id UNIQUE CASCADE, segments JSONB, summary, score_* INTEGER)` — unused in S1

RLS: `assignments` uses `auth.uid() = user_id`. `attempts`/`corrections` policies use `EXISTS` subquery up the chain. Cascade flows `lessons → assignments → attempts → corrections`.

## Non-obvious decisions / gotchas

- **Route path is singular** (`/lesson/:lessonId/redaccion/:assignmentId`) to match the existing `/lesson/:lessonId` convention in `App.jsx`. The session doc's `/lessons/` path was Next.js-style notation, not the actual React Router convention.
- **Not Prisma.** Project uses raw SQL migrations on Supabase; the doc's Prisma schema was translated.
- **"Unidad" = week.** No separate unit table in this project. `scope='unit'` uses `lesson.week_id` to fetch siblings via `fetchLessons(weekId)`.
- **Scope picker hides (not disables) "Unidad completa"** when `siblings.length <= 1`, per design.
- **Colors use Tailwind arbitrary values** (`bg-[#FEF3C7]`, `border-[#F59E0B]`) because `tailwind.config.js` overrides the default amber scale to just `amber / amber-light / amber-dark`. Full `amber-50…700` would have broken.
- **Mock brief** is built in `app/api/assignments/route.js::buildMockBrief()` — random pick from `MOCK_TITLES`, fixed prompt, tagged `_mock: true` so Session 2 can grep it out.
- **Responsive modal pattern** copied from `src/components/conjugar/AddVerbModal.jsx` — `window.innerWidth < 1024` at render time, render either `<Sheet>` or `<Dialog>` (both from shadcn, Radix under the hood).
- **Offline cache** invalidates per-lesson on write: `cacheAssignments(lessonId, rows)` deletes existing rows for that lesson before bulkPut so a delete doesn't leave ghost rows.
- **Card row meta line logic** lives in `AssignmentMiniCard.jsx`: `null latest_attempt` → `Sin empezar · <date> · Borrador`; attempt without correction → `N palabras · <date> · Borrador`; attempt with correction → `N palabras · <date> · Corregida`. `formatRelative()` returns `hoy` or `<day> <mes>` in Spanish.
- **Placeholder page** is deliberately minimal (title, scope label, back, delete) — Session 3 replaces it entirely.
