# Conjugation Drill Fixes — Design

**Date:** 2026-04-20
**Status:** Draft — awaiting review

## Background

Bugs and UX issues surfaced during in-flight use of conjugation drills:

1. Not every exercise card shows which verb/tense is being drilled.
2. Writing exercises (fill-in-the-blank types) lack per-blank hints about which person/tense is expected.
3. Drill attempts completed offline are lost (fetch fails silently, no sync).
4. When AI generation fails for a verb, the verb row persists in the DB with zero drill packs ("orphan verb"), and the per-verb error is not surfaced to the user.
5. Current freeform `💡 Pista: …` text on `gap_fill` / `mini_story` should be removed in favor of structured verb/tense/person labels.
6. `chat_bubble` inputs show `___` as placeholder text — should be a styled underline blank.
7. `multiple_choice` sentences show literal `___` in text; selecting an option doesn't visually insert the word into the blank.

Item "Writing exercise (already planned)" from the bug list is out of scope for this spec — tracked separately.

## Goals

- Consistent exercise-card header across all 7 exercise types showing infinitive + tense.
- Per-blank verb/tense/person label on writing exercises.
- Drill attempts survive offline and sync on reconnect.
- AI generation surfaces per-verb errors and never leaves orphan verbs in the DB.
- Clean blank visuals (no literal `___` rendering) with an inline inserted word on `multiple_choice` after selection.

## Non-goals

- Multi-blank expansion of `mini_story` (deferred to the separate "Writing exercise" work).
- New per-attempt `drilled_at` column (current server `created_at` is acceptable).
- Keeping a long-term UI for orphan-verb deletion (one-shot SQL cleanup instead).

## Design

### 1. Unified exercise-card header (items 1, 2, 5)

**New shared component** `src/components/conjugar/ExerciseHeader.jsx`:

```
🎯 Opción múltiple          (existing type-label row — meta.icon + meta.label)
hablar · Presente           (NEW row — infinitive + tense, prominent)
```

- Consumed by all 7 exercise components: `ClassicTableExercise`, `GapFillExercise`, `SpotErrorExercise`, `MultipleChoiceExercise`, `ChatBubbleExercise`, `OddOneOutExercise`, `MiniStoryExercise`.
- Data source: `exercise._verb` (infinitive) and `exercise._tense` → resolved to label via `SPANISH_TENSES`. Both already present via `buildSession` enrichment in `src/lib/conjugar/validation.js:106-117`.
- Replaces the ad-hoc `{verb} · {tenseLabel}` lines already present in `MultipleChoiceExercise`, `OddOneOutExercise`, `ClassicTableExercise` — those three stop rendering their own verb/tense rows.

**Remove tip boxes:**
- `GapFillExercise`: delete the `{exercise.hint && (<div>💡 Pista …</div>)}` block (lines 46-50).
- `MiniStoryExercise`: delete the `{exercise.hint && …}` block (lines 74-78).

**Per-blank person/tense label** on writing exercises:
- New shared `src/components/conjugar/BlankLabel.jsx` — small caption rendered directly under each input: e.g., `tú · presente`.
- Used by `GapFillExercise`, `ChatBubbleExercise`, `MiniStoryExercise` — one label per input.
- Data source: `exercise.person` (already in schema `src/lib/conjugar/schemas.js`) + `exercise._tense` via `SPANISH_TENSES`.

**Note:** `mini_story` currently has exactly 1 blank per the prompt (`prompts/conjugar/generate-exercises.md:9`), so one label suffices. Multi-blank expansion is out of scope.

### 2. Offline attempt save (item 3)

**Problem:** `DrillSession.finishDrill` (`src/components/conjugar/DrillSession.jsx:146-149`) catches and swallows the `saveAttempt` error, so offline attempts are never synced.

**Changes:**

- **Move `calculateGrade`** — currently only imported server-side in `app/api/conjugar/attempts/route.js`. Re-export from `src/lib/conjugar/constants.js` (it already lives there; just ensure it's usable client-side).
- **`src/lib/conjugar/api.js` — modify `saveAttempt`:**
  - On `fetch` failure, compute percentage + grade client-side, then enqueue to `syncQueue`:

    ```js
    enqueue({
      table: "drill_attempts",
      method: "insert",
      payload: {
        user_id: session.user.id,
        pack_ids: packIds,
        score, total, percentage, grade,
        details,
      },
    });
    ```

  - `user_id` is read from `getCachedSession()` (same pattern as `authHeaders()`).
  - Return a sentinel `{ queued: true }` so callers can distinguish.
- **`DrillSession.finishDrill`:** no behavioral change needed beyond the new `saveAttempt` path — results screen still navigates as today.
- **RLS:** `drill_attempts` already accepts `user_id = auth.uid()` inserts (server route confirms, line 35 of `attempts/route.js`).
- **Flush:** existing `syncQueue.flush()` is wired up to reconnect events; no new code required.
- **UI:** existing pending-sync badge already reflects queue depth.

### 3. AI generation failure handling (item 4)

**Problem:** The two-step flow (`createVerbs` then `generatePacks`) can leave orphan verbs when AI generation fails mid-loop. Errors surface as a single 502 for the whole batch.

**New endpoint:** `POST /api/conjugar/generate-batch/route.js`

**Request:** `{ infinitives: string[], tense: string }`

**Per-infinitive sequence (inside `try/catch`):**
1. `detectVerbType(infinitive)` → throw on invalid ending.
2. Call AI provider with the existing `conjugar/generate-exercises` prompt.
3. Parse + validate against `aiResponseSchema`.
4. **Only if steps 1-3 succeed:** insert the verb row (upsert on `(user_id, infinitive)`), then insert the `drill_packs` row.
5. On success, push `{ infinitive, verb, pack }` to `created`.
6. On failure, push `{ infinitive, error: <friendly message> }` to `failed`. No DB writes.

**Response:** `200 { created: Array, failed: Array }` — partial success is not an error.

**Friendly error shapes:**
- `"Invalid ending (-ar/-er/-ir)"` — `detectVerbType` returned null.
- `"AI response couldn't be parsed"` — `JSON.parse` threw.
- `"Invalid conjugation table"` — `aiResponseSchema` rejected.
- `"AI provider error: <message>"` — provider call threw.

**Existing endpoints:**
- `POST /api/conjugar/verbs` — the only consumer is `AddVerbModal`, which is switching to the new endpoint. Remove the POST handler. **Keep the GET handler** — it's used by `fetchVerbs` in `src/lib/conjugar/api.js:28`.
- `POST /api/conjugar/generate` — kept for "add another tense to an existing verb." Apply the same per-verb `try/catch` treatment for consistency (return `{ created, failed }` instead of 502 on first failure).

**Client changes:**

- `src/lib/conjugar/api.js` — new `generateVerbsWithPacks(infinitives, tense)` wrapping `/api/conjugar/generate-batch`.
- `src/components/conjugar/AddVerbModal.jsx`:
  - Replace `createVerbs` + `generatePacks` with the single call.
  - After call: if `failed.length === 0`, `onSuccess()` + close. Otherwise stay open, show a red error list:
    ```
    comir — Invalid ending (-ar/-er/-ir)
    xxxx — AI response couldn't be parsed
    ```
  - Input text preserved so user can edit + retry. Retry only runs entries not yet in `created` (client filters).
  - Progress UI: keep the animated spinner + verb pills. Update pills at end-of-batch with ✓ / ✗ per verb. No SSE streaming.
- `generatePacks` (existing function) — updated to handle the new `{ created, failed }` response shape for parity with the existing "regenerate a tense" path.

**Orphan cleanup:** new SQL migration `supabase/migrations/<timestamp>_delete_orphan_verbs.sql`:

```sql
DELETE FROM verbs
WHERE id NOT IN (SELECT DISTINCT verb_id FROM drill_packs WHERE verb_id IS NOT NULL);
```

User runs once in the Supabase dashboard. With the new flow, no new orphans can appear.

### 4. Blank visuals (items 6, 8)

**New shared component** `src/components/conjugar/Blank.jsx`:

- Props: `value`, `onChange?`, `readonly`, `feedback`, `expected`.
- **Empty state:** underline (`border-b-2`, min-width ~5ch), empty content, no placeholder dashes.
- **Filled state:** inline text with the same underline, typography matches surrounding sentence.
- **Feedback state:** green/red underline; if wrong, small green caption below with expected answer.

**`ChatBubbleExercise`:** input wrapped in `<Blank>` — remove `placeholder="___"` (line 51). Typing still works normally.

**`MultipleChoiceExercise`:**
- Split `exercise.sentence` on `___` (same pattern as `GapFillExercise`).
- Render: `parts[0]` + `<Blank readonly value={selected !== null ? exercise.options[selected] : ""} />` + `parts[1]`.
- Options grid stays visible after selection so user can change mind pre-check.
- After check: `<Blank>` colors itself via `feedback` prop. If wrong, the correct word appears beneath.

**`GapFillExercise` / `MiniStoryExercise`:** refactor existing inputs to use `<Blank>` for visual consistency. No UX change.

**No schema changes.** `exercise.sentence` already uses `___` as the delimiter for both `gap_fill` and `multiple_choice`.

## Data / schema impact

- **None.** All changes are presentational or client/server logic around existing fields.
- `exercise.person` (already in schema) is now surfaced in the UI via `BlankLabel`.
- New migration: `delete_orphan_verbs.sql` (one-shot cleanup).

## Risks

- **Client-side `calculateGrade`:** if grade cutoffs ever diverge between client and server, offline-synced attempts could have stale grades. Mitigation: `calculateGrade` is a pure function in `constants.js` — same source of truth for both.
- **`syncQueue` dedup:** user could finish a drill, go offline, refresh, come back online — the `drill_attempts` insert would fire twice only if retries are triggered during the same session. Current `syncQueue` enqueues once; low risk.
- **Batch endpoint timeouts:** generating many verbs in one call could exceed serverless timeout limits. Current loop is sequential; unchanged. If this becomes an issue, batch size limit (already capped at 20 via `createVerbsSchema`) is the backstop.

## Out of scope (tracked elsewhere)

- "Writing exercise (already planned)" — new exercise type, separate spec.
- Multi-blank `mini_story` — deferred; would require prompt + schema changes.
