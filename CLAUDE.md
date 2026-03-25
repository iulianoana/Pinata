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
