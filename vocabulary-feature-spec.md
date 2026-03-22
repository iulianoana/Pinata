# Vocabulary Feature — Claude Code Prompts

---

## Session 1: Backend + Infrastructure + Navigation

**Attach:** `vocabulary-feature-spec.md`

**No images needed for this session.**

---

### Prompt

```
I'm adding a Vocabulary feature to Piñata. Read the attached spec for full context. This session covers backend, API, hooks, and navigation only — UI components come in session 2.

## Task 1: Database migration

Create a new Supabase migration for the `vocabulary` table:

- id (UUID, PK, gen_random_uuid)
- user_id (UUID, FK → profiles.id, ON DELETE CASCADE)
- word (TEXT, NOT NULL) — the Spanish word (corrected if AI was used)
- original_input (TEXT, nullable) — what the user originally typed before AI correction
- explanation_es (TEXT, nullable) — Spanish explanation in markdown
- explanation_en (TEXT, nullable) — English explanation in markdown
- ai_generated (BOOLEAN, DEFAULT FALSE)
- created_at (TIMESTAMPTZ, DEFAULT NOW())
- updated_at (TIMESTAMPTZ, DEFAULT NOW())

Indexes:
- Composite index on (user_id, word) for fast lookups
- Index on (user_id, created_at DESC) for list ordering

RLS policies (same pattern as existing tables):
- Users can SELECT/INSERT/UPDATE/DELETE their own rows (auth.uid() = user_id)

## Task 2: API routes

### /api/vocabulary/route.ts — CRUD

- GET: Fetch all vocabulary for the authenticated user, ordered by created_at DESC. Support optional `search` query param that filters by word (case-insensitive, partial match using ILIKE).
- POST: Insert one or more vocabulary words. Accept body: `{ words: [{ word: string, explanation_es?: string, explanation_en?: string }] }`. Return the inserted rows.
- PATCH: Update a single vocabulary entry by id. Accept body with optional fields: word, explanation_es, explanation_en.
- DELETE: Delete a single vocabulary entry by id.

Use the same auth pattern (iron-session) and error handling as existing API routes in the project.

### /api/vocabulary/explain/route.ts — AI explanation

- POST: Accept `{ word: string }`.
- Call the AI (use whatever model/provider is already configured in the project — check existing API routes for the pattern).
- System prompt should instruct the AI to:
  1. Correct the word (fix spelling, accents)
  2. Generate a brief Spanish explanation (2-3 sentences, markdown formatted, meaning + example in context)
  3. Generate a brief English explanation (2-3 sentences, markdown formatted, meaning + example in context)
- Response must be JSON: `{ corrected_word, explanation_es, explanation_en }`
- Return the parsed JSON to the client.

## Task 3: TanStack Query hooks

Create /hooks/useVocabulary.ts with:

- useVocabulary() — fetches all vocabulary (with optional search param), returns { data, isLoading, error }
- useAddVocabulary() — mutation that POSTs words, invalidates the vocabulary query on success
- useUpdateVocabulary() — mutation that PATCHes a single word
- useDeleteVocabulary() — mutation that DELETEs a single word
- useExplainWord() — mutation that calls /api/vocabulary/explain, returns the AI response

Follow the same TanStack Query patterns used elsewhere in the project (check existing hooks for query key conventions, optimistic updates if applicable, error handling).

## Task 4: Navigation

- Add "Vocabulary" to the desktop sidebar nav, under the LEARN section. Place it between "Lessons" and "History". Use a book/dictionary icon from Lucide (BookOpen or Languages — pick whichever is already imported, or import BookOpen).
- Add "Vocab" to the mobile bottom tab bar. Place it between "Lessons" and "History". Same icon.
- Follow the exact same pattern as the existing nav items for both desktop and mobile.

## Important

- Look at existing code patterns before writing anything. Match the project's conventions for auth, error handling, API route structure, hooks, and navigation.
- Don't create any UI components or pages yet — that's session 2.
- Run the migration and verify it works.
- Test the API routes work by checking types compile and the route handlers are valid.
```

---

## Session 2: UI Components + Page

**Attach:**

1. `vocabulary-feature-spec.md` (same spec)
2. The 2 original Piñata screenshots (desktop lessons page + mobile lessons page) — for design reference
3. Screenshots of the mockups (all the mockup images from our design session) — for layout/state reference

---

### Prompt

```
I'm building the Vocabulary page UI for Piñata. The backend (DB, API routes, hooks) is already done from a previous session. Read the attached spec for full context. The mockup images show the exact designs to follow.

Reference the existing hooks in /hooks/useVocabulary.ts — these are already implemented:
- useVocabulary(search?) — fetches vocabulary list
- useAddVocabulary() — mutation to add words
- useUpdateVocabulary() — mutation to update a word
- useDeleteVocabulary() — mutation to delete a word
- useExplainWord() — mutation for AI explanation

## Task 1: Vocabulary page — /app/vocabulary/page.tsx

The main page that ties everything together:
- Header with title "Vocabulary", word count, and "+ Add words" button (desktop)
- Search bar that filters in real-time (client-side filtering on the fetched data, using the search param from the hook)
- Renders VocabularyList when there are words, VocabularyEmptyState when empty
- FAB (floating action button) on mobile for quick add — see the mobile mockups

## Task 2: VocabularyEmptyState.tsx

See the empty state mockup:
- Centered layout with a book icon in a green circle
- "Your vocabulary is empty" heading
- "Start adding Spanish words to build your personal dictionary" subtext
- Primary "+ Add words" button that opens the add modal

## Task 3: VocabularyList.tsx

Container that renders VocabularyCard components. Simple flex column with gap. Just maps over the vocabulary data and renders cards.

## Task 4: VocabularyCard.tsx

Each word is a card — see the mockup designs carefully:
- Word displayed as the card title (bold, larger text)
- "AI" badge if the word was AI-generated
- Three-dot menu (⋮) with actions: Edit, Re-run AI, Delete
- Spanish explanation rendered as markdown (use the existing MarkdownRenderer component in the project)
- Collapsible English section:
  - Default: collapsed, showing "🇬🇧 Show English" with a chevron
  - On click/tap: expands to show the English explanation (also markdown rendered)
  - Desktop: can also expand on hover
- Smooth expand/collapse animation (use CSS transition on max-height or use framer-motion/motion if already in the project)

Design tokens (from mockups):
- Card background: use the secondary background color (matches the mobile mockups)
- Green accent color: #2BAB8F (the Piñata brand green, used for AI badges, example text in italics)
- Card border-radius: 12px
- Font: Nunito (the project's font)

## Task 5: AddVocabularyModal.tsx

This is the most complex component. See all the mockup states carefully:

**Desktop:** Modal dialog with backdrop overlay
**Mobile:** Bottom sheet (slides up from bottom with drag handle)

**States the component must handle:**

### State 1: Input mode (AI ON)
- Textarea for word input (supports comma and newline separated bulk input)
- Live word count: "X words detected" shown when multiple words are parsed
- Parsed words shown as green pill/chip badges below the textarea
- "Explain with AI" toggle — styled as a card with description, toggle switch on the right, defaults to ON
- Submit button: "Add word" (single) or "Add X words" (bulk, showing count)

### State 2: Input mode (AI OFF)
- When toggled off, the textarea changes to a single text input for the word
- Two additional textarea fields appear: "Spanish explanation (optional)" and "English explanation (optional)"
- Both have "Supports markdown formatting" helper text
- Note: manual mode is single-word only (no bulk) since the user would need to write explanations per word

### State 3: Processing (AI running)
- Modal transitions to a processing view
- Progress bar showing "Generating explanations — X / Y"
- Per-word status list:
  - ✓ checkmark + "done" for completed words
  - Spinning loader + "processing..." for the current word (highlighted with green border)
  - Empty circle + "queued" for pending words (dimmed/faded)
- Footer note: "Words are saved as they complete. You can close this."
- Implementation: fire individual API calls in parallel using Promise.allSettled with a concurrency limit of 3-5. Update the UI progressively as each word completes.

### State 4: Complete — all succeeded
- Success icon (green checkmark in circle)
- "X words added" heading
- If any words were spelling-corrected by AI, show "Y spelling corrected by AI" subtitle
- Per-word result list with checkmarks
- Corrected words highlighted with amber/yellow background and "corrected from [original]" note
- "Done" button to close

### State 5: Complete — partial failure
- Warning icon (amber triangle)
- "X of Y words added" heading
- "Z words couldn't be processed" subtitle
- Failed words shown with red X icon and a "Retry" button per word
- "Skip failed" secondary button + "Done" primary button

## Important implementation notes

- Follow the project's existing modal/dialog pattern. If there's a reusable Modal component, use it. If not, create one.
- For the mobile bottom sheet behavior, check if there's an existing sheet component. If not, implement a simple one with: backdrop, slides up from bottom, drag handle at top, prevents body scroll.
- Use the project's existing MarkdownRenderer for rendering explanations.
- Match the Piñata design system: Nunito font, Jardín tropical palette (#2BAB8F green), rounded corners, clean spacing.
- Look at existing components for spacing conventions, button styles, and form patterns — match them exactly.
- The mockup images attached are the source of truth for layout and visual design. Follow them closely.
```

---

## Notes for Iulian

### Session boundaries

- **Session 1** produces: migration, 2 API route files, 1 hook file, nav changes. No visual output. ~30 min of Claude Code work.
- **Session 2** produces: 1 page + 5 components. All visual. ~45-60 min of Claude Code work. This is the heavier session.

### Why 2 sessions instead of 1

The modal alone has 5 distinct states with real async logic (concurrent API calls, progress tracking, error handling). If Claude Code tries to do all of that PLUS the backend in one session, it'll likely rush the later components. Splitting means session 2 gets full context budget for the UI work.

### Could it be 1 session?

Technically yes if you strip back scope. You'd sacrifice: the processing progress UI (just show a spinner), the partial failure state (just show success/error), and the mobile bottom sheet (just use the same modal on mobile). If you're okay with those tradeoffs, merge both prompts into one and tell Claude Code to keep the modal simple.

### What to attach per session

| Session | Files to attach            | Images to attach                                                                                                       |
| ------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1       | vocabulary-feature-spec.md | None                                                                                                                   |
| 2       | vocabulary-feature-spec.md | 2 original Piñata screenshots (desktop + mobile lessons page) + screenshots of all the mockups from our design session |
