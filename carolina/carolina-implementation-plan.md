# Piñata — Carolina Chat Feature: Implementation Plan

## Overview

3 Claude Code sessions to build a full ChatGPT-like text chat feature inside the Piñata app, powered by Claude Sonnet 4.6, with access to lesson materials, conversation history, search, and voice call integration.

---

## Session 1: Database & API Foundation

**Goal**: Schema migration + all backend API routes

**Estimated complexity**: Medium (mostly SQL + API boilerplate)

**Prompt file**: `session-1-database-and-api.md`

**Resources to attach**:

- The prompt file
- Screenshot of your current Supabase dashboard showing the `chat_sessions` table schema (so the agent can see the exact current state)
- Your existing Supabase client setup file (e.g., `lib/supabase.ts` or similar) so it matches your patterns
- An example of an existing API route file (so the agent copies your auth pattern, error handling, etc.)
- Your `.env.local.example` or equivalent (so it knows which env vars exist)

**Environment setup before starting**:

- Get an Anthropic API key from https://console.anthropic.com (if you don't already have one)
- Add `ANTHROPIC_API_KEY` to your `.env.local`
- Have Supabase running and accessible

**Testing checklist** (do these before moving to Session 2):

- [ ] Migration runs without errors — new columns added to `chat_sessions`
- [ ] `chat_messages` table created with search_vector column
- [ ] RLS policies active on `chat_messages`
- [ ] `search_chat_messages` RPC function exists and callable
- [ ] POST /api/carolina/sessions creates a new session with type='chat'
- [ ] GET /api/carolina/sessions returns only type='chat' sessions
- [ ] POST /api/carolina/chat accepts a message and returns a streaming response from Claude
- [ ] Messages are saved to `chat_messages` table after streaming completes
- [ ] GET /api/carolina/sessions/[id]/messages returns messages in order
- [ ] GET /api/carolina/search?q=hola returns matching messages
- [ ] GET /api/carolina/resources returns weeks with their lessons
- [ ] Existing voice call sessions (type='voice') are unaffected
- [ ] `npm install @anthropic-ai/sdk` completed successfully

---

## Session 2: Chat UI Core

**Goal**: The Carolina chat page — empty state, mode selector, chat view, streaming, resource attachment

**Estimated complexity**: High (most complex UI work, streaming, state management)

**Prompt file**: `session-2-chat-ui.md`

**Resources to attach**:

- The prompt file
- Desktop mockup screenshot: empty state (the one with mode cards and sidebar showing Carolina section)
- Desktop mockup screenshot: active chat (the one with messages and corrections)
- Mobile mockup screenshots: empty state with mode cards, and attach resources bottom sheet
- Your existing design system file if you have one (e.g., `design-system.md`, tailwind config)
- A screenshot of the current app (so the agent can see the existing design language)
- The API route files from Session 1 (so the agent knows the exact request/response formats)

**Testing checklist** (do these before moving to Session 3):

- [ ] Carolina page renders at its route (e.g., /carolina)
- [ ] Empty state shows with 4 mode cards (essay, grammar, vocab, conversation)
- [ ] Clicking a mode card creates a session and shows Carolina's opening message
- [ ] Typing a message and sending works — message appears as a teal bubble
- [ ] Carolina's response streams in progressively (not all at once)
- [ ] Inline corrections render: red strikethrough → green correction
- [ ] Markdown in Carolina's responses renders properly (bold, lists, etc.)
- [ ] "+" button opens resource picker — shows weeks and lessons
- [ ] Selecting resources shows amber pills above the input
- [ ] Removing a resource pill works (X button)
- [ ] Auto-scroll works when new messages arrive
- [ ] Enter sends message, Shift+Enter creates newline
- [ ] Send button is disabled when input is empty
- [ ] Refreshing the page with a session ID reloads the conversation
- [ ] Mobile layout looks correct — full width, bottom sheet for resources
- [ ] Desktop layout looks correct — centered content, dropdown for resources
- [ ] Star button renders (placeholder, non-functional for now is OK)
- [ ] Call button renders (placeholder, non-functional for now is OK)

---

## Session 3: Sidebar, History, Search & Voice Integration

**Goal**: Wire everything together — sidebar navigation, conversation history, search, starring, voice call

**Estimated complexity**: Medium-High (touches many existing components, lots of wiring)

**Prompt file**: `session-3-sidebar-history-search.md`

**Resources to attach**:

- The prompt file
- Desktop mockup: empty state (shows the full sidebar with Carolina section, Starred, Recent)
- Desktop mockup: active chat (shows sidebar with highlighted active conversation)
- Mobile mockup: conversation history overlay (with search, starred, recent)
- Screenshot of the current sidebar code (or just tell the agent which file it's in)
- Screenshot of the current mobile tab bar / navigation (so the agent knows what to modify)
- The existing voice call page/component file path (so the agent knows how to integrate it)
- The Carolina page from Session 2 (it will need to modify it to accept session routing)

**Testing checklist**:

- [ ] Desktop sidebar shows LEARN + CAROLINA sections (no more TOOLS, no more Hablar)
- [ ] "New chat" button in sidebar → Carolina empty state
- [ ] Starting a conversation → appears in "Recent" in sidebar immediately
- [ ] Clicking a conversation in sidebar → loads that conversation in main view
- [ ] Active conversation is highlighted in sidebar (teal background)
- [ ] Star button in chat header works — star fills amber, conversation moves to Starred
- [ ] Unstar works — conversation moves back to Recent
- [ ] Empty Starred section is hidden (label doesn't show)
- [ ] Search bar in sidebar: typing shows results, clearing restores normal view
- [ ] Search finds message content, not just titles
- [ ] Search results clicking loads the right conversation
- [ ] Call button launches existing voice call feature
- [ ] Mobile: "Carolina" tab replaces "Hablar" in tab bar
- [ ] Mobile: history icon opens full-screen conversation overlay
- [ ] Mobile: overlay has search, Starred, Recent sections
- [ ] Mobile: tapping a conversation in overlay loads it and closes overlay
- [ ] Mobile: "+" in overlay starts new chat
- [ ] All other features still work (Quizzes, Lessons, History)
- [ ] Voice call sessions don't appear in Carolina conversation lists
- [ ] Search returns results for Spanish content (stemming works: "comí" finds "comer")

---

## Key Technical Decisions Summary

| Decision               | Choice                                       | Rationale                                                                                            |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| LLM Model              | Claude Sonnet 4.6                            | Best instruction-following for tutoring, excellent Spanish, prompt caching, ~$3-4/month at daily use |
| Messages storage       | Separate `chat_messages` table               | Enables full-text search with Spanish stemming via PostgreSQL tsvector + GIN index                   |
| Session metadata       | Extended `chat_sessions` table               | Reuses existing table, backward-compatible with voice sessions via `type` column                     |
| Resource references    | JSONB `resources` column                     | Simple, flexible, no junction table needed — array of {type, id} objects                             |
| Search                 | PostgreSQL full-text search (Spanish config) | Near-instant, handles conjugation stemming, no external service needed                               |
| Streaming              | Anthropic SDK SSE → fetch ReadableStream     | Native browser streaming, progressive rendering, no WebSocket needed                                 |
| Chat history (desktop) | Inside the existing sidebar                  | No second sidebar — conversations listed under "Carolina" section                                    |
| Chat history (mobile)  | Full-screen overlay                          | Triggered by history icon, same content as sidebar Carolina section                                  |
| Voice integration      | Button in chat header → existing voice call  | Carolina is the unified AI hub — text chat primary, voice call secondary                             |
| Navigation (mobile)    | Rename "Hablar" tab to "Carolina"            | Minimal disruption, keeps the feature discoverable                                                   |

---

## Estimated Cost (API usage)

| Usage Pattern                           | Monthly Cost           |
| --------------------------------------- | ---------------------- |
| Light (3 sessions/week, 15 msgs each)   | ~$1.50                 |
| Moderate (daily, 20 msgs each)          | ~$3.50                 |
| Heavy (daily, 40 msgs each)             | ~$7.00                 |
| With prompt caching (90% input savings) | 30-40% less than above |

These are estimates for Claude Sonnet 4.6 at $3/$15 per 1M input/output tokens.
