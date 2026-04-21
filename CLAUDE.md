# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js dev server (http://localhost:3000)
npm run build    # Production build (next build --webpack)
npm run start    # Serve production build
```

No test runner or linter is configured.

## Architecture

Pinata is a Spanish language learning PWA. The frontend is a React 18 SPA using React Router for client-side navigation, hosted inside a Next.js 16 shell that provides SSR, API routes, and PWA support via `@ducanh2912/next-pwa`.

### Dual routing system

- **Next.js App Router** (`app/[[...path]]/page.jsx`): Catch-all route that renders the React SPA. All server logic lives in `app/api/` routes.
- **React Router** (`src/App.jsx`): Client-side routing for all screens. Every route except `/login` is auth-gated (requires Supabase session).

### Directory layout

| Directory | Purpose |
|---|---|
| `app/api/` | Next.js API routes (server-side). Each validates Bearer token and uses Supabase with RLS. |
| `src/screens/` | Page-level React components, one per route |
| `src/components/` | Reusable UI components, organized by feature (`lessons/`, `quizzes/`, `questions/`, `vocabulary/`, `ui/`) |
| `src/lib/` | Frontend utilities: API client (`api.js`), Supabase client (`supabase.js`), offline cache (`offline-cache.js`), sync queue (`syncQueue.js`) |
| `lib/ai/` | Server-side AI provider infrastructure: provider dispatcher, model registry, prompt loader |
| `prompts/` | External LLM prompt templates as `.md` files, loaded by `lib/ai/prompts/load-prompt.js` with `{{variable}}` interpolation |
| `supabase/migrations/` | SQL migration files (run via Supabase dashboard, not CLI) |

### Offline-first pattern

The app uses a network-first-with-cache-fallback pattern:
1. `src/lib/api.js` wraps all API calls. On success, data is cached to IndexedDB via Dexie (`src/lib/offline-cache.js`). On failure, cached data is returned.
2. Write operations queue to localStorage (`src/lib/syncQueue.js`) when offline, auto-flushing on reconnect.
3. Service worker (Workbox via next-pwa) caches API responses and static assets with per-route strategies configured in `next.config.mjs`.

### AI provider system

- `lib/ai/provider.js` dispatches to `lib/ai/providers/{anthropic,openai}.js`
- `lib/ai/models.js` defines available models and per-feature defaults
- Users choose their preferred model per feature (carolina_chat, vocabulary, pdf_processing) via the Settings screen; stored in `user_models` table
- Prompts live in `prompts/` as markdown files, organized by feature (`carolina/`, `lesson/`, `vocab/`). Reference `models.md` for the full prompt-to-feature mapping.

### Styling

The app is mid-migration from inline `style={{}}` props (using a `C` color object from `src/styles/theme.js`) to Tailwind CSS + shadcn/ui. Both systems coexist:
- **Tailwind**: configured in `tailwind.config.js` with custom colors, breakpoints, and animations. CSS variables in `app/globals.css`.
- **shadcn/ui**: 13 components in `src/components/ui/`, configured via `components.json`. Uses `cn()` from `src/lib/utils.js`.
- **Legacy**: Many components still use inline styles with `C.accent`, `C.bg`, etc. and `onMouseEnter/onMouseLeave` for hover effects.
- Path alias: `@/*` maps to `./src/*` (see `jsconfig.json`).

### Auth

Supabase Auth with magic link (email). Session managed client-side via `supabase.auth.getSession()` / `onAuthStateChange()`. API routes extract the Bearer token from the Authorization header and pass it to Supabase client, which enforces RLS policies.

### Key data entities

Weeks > Lessons > Quizzes (hierarchy). Quizzes belong to either a lesson or a week (not both). Quiz questions are stored as JSONB in `quiz_data`. Other entities: `chat_sessions`/`chat_messages` (Carolina), `vocabulary`, `lesson_links`, `user_models`.

## Dev workflow

Use this for non-trivial coding sessions (new features, multi-file changes, anything with DB migrations). Skip for typos, one-line fixes, pure questions.

### 1. Plan first

Enter plan mode. Explore the codebase with `Explore` subagents before proposing anything. Produce a plan file that lists: context, the decisions, critical file paths, references to existing utilities to reuse, and a verification section.

### 2. Ask plenty of questions, in plain English

Use `AskUserQuestion` (up to 4 per batch) to resolve unknowns before writing the plan. Rules:
- **Plain English only.** No jargon. Dumb it down. Assume the user doesn't know what Prisma, Dexie, RLS, etc. mean.
- Always **recommend an option** (put it first, add "(Recommended)").
- Spell out the tradeoff behind each option in one sentence.
- Prefer asking over assuming. It's cheap.

Only call `ExitPlanMode` once the plan is final.

### 3. Code to the codebase, not to your preferences

**The existing style wins, always.** Before writing new code, read neighbor files and match their conventions — routing (`/lesson/:id` is singular), Tailwind token names (the config overrides defaults), inline-style-vs-Tailwind choices per component, API route patterns (`getSupabase(req)` helper copied per-file, not shared), migration file naming (`YYYYMMDD_description.sql`). If the doc you're working from conflicts with the codebase, the codebase wins — flag the mismatch to the user but follow the existing pattern.

Keep tasks tracked via `TaskCreate`/`TaskUpdate` as you go.

### 4. Write a 50-line notes file for future agents

When coding is done, save a condensed markdown summary alongside the session brief (e.g. `docs/<feature>/<feature>-session-N-notes.md`). Include: files created/edited, schema shape, non-obvious decisions, deviations from the original plan, and gotchas a future agent would trip on. Keep it under 50 lines. This is a tech doc for agents, not prose for humans.

### 5. Give the user a plain-English wrap-up

Present in the chat, dumbed down:
- **1-paragraph summary** of what now works end-to-end.
- **Any manual steps** they need to run (SQL migrations, env changes, dashboard actions) — spelled out with file paths.
- **A 5-step test plan**, each step with a ✅ pass criterion. Cover: happy path, at least one edge case, mobile if relevant.

### 6. Wait for the OK before committing

Don't commit or push until the user confirms the test passed. When they confirm:
- Commit message follows the repo's conventional style from `git log`: `feat(area): …`, `fix(area): …`, `docs(area): …`, `refactor(area): …`.
- Keep the default `Co-Authored-By: Claude …` trailer.
- Push to `main` only after commit succeeds — this repo ships direct to main.
- Never `--no-verify`, `--force-push`, or `--amend` a published commit.
