# Carolina sidebar + history redesign notes

## What ships
Desktop sidebar CAROLINA section no longer shows the starred/recent/search list. It now has two stacked buttons: **Carolina Chat** (→ `/carolina`) and **Call Carolina** (→ `/dialog`). The `/carolina` desktop header gained a clock icon (left of the phone icon) that opens a shadcn `Sheet` (side="right") with starred/recent/search — same component used on mobile now. Clicking a mode card no longer creates a DB session; the session is created lazily on the first user message, and the mode's opening assistant message is seeded server-side at that moment.

## Files edited
- `src/components/DesktopSidebar.jsx` — stripped all Carolina fetching/search state, dropped `getAuthHeaders`/`useCallback`/`renderConversationItem`/`handleSelectSession` and the `carolina-sessions-changed` listener. Added `renderCarolinaButton` helper, `phone` icon, a `flex: 1` spacer div (the scrollable list used to fill that space). `handleChatClick` dispatches a `carolina-reset` CustomEvent when already on `/carolina`, then navigates.
- `src/screens/CarolinaScreen.jsx` — `handleSelectMode` is now synchronous, purely local: it sets mode, resources, messages (with a local `"opening-<ts>"` id), and `activeSessionId = "pending"`. No fetch, no URL mutation. `handleSend` detects `hasLocalOpening` via `m.id.startsWith("opening-")` and passes `openingMessage` in the POST body when lazy-creating. Added `carolina-reset` listener (calls `handleNewChat`). Removed `isMobile` prop from `CarolinaHeader` and unguarded the clock icon so it shows on desktop too (styled to match the phone icon: 36px circle, bubbleBorder). `ConversationsOverlay` became `CarolinaHistorySheet` using shadcn `Sheet`/`SheetContent`/`SheetHeader`/`SheetTitle` with `side="right"` and `w-full sm:max-w-md`. Dropped both `window.dispatchEvent("carolina-sessions-changed")` calls — no listeners remain and the sheet re-fetches on open.
- `app/api/carolina/chat/route.js` — POST body now accepts `openingMessage`. When creating a session lazily (sessionId omitted), if an opening is provided it's inserted into `chat_messages` as `role: "assistant"` before the user message lands, so Claude sees the full conversation and reloads show the original greeting.

## Files created
- `docs/carolina/carolina-sidebar-redesign-notes.md` — this file

## Non-obvious decisions
- **Opening message travels from client, not a server constant.** `OPENING_MESSAGES` lives in `CarolinaScreen.jsx`. Rather than duplicate it into the route, the client sends its local opening text in the POST body. Server only seeds if it's a non-empty string. Trade-off: if the client's `OPENING_MESSAGES` ever drifts from what the server expects, the seeded message follows the client. Given these are mode greetings (user-visible), that's the correct source of truth.
- **Detection via id prefix, not a separate flag.** `messages.some(m => m.id.startsWith("opening-"))` is how `handleSend` knows to include `openingMessage`. Local openings get `"opening-<timestamp>"` ids; DB-loaded messages get UUIDs. No extra state needed.
- **`carolina-reset` CustomEvent.** Clicking "Carolina Chat" in the sidebar when already on `/carolina` can't rely on `navigate()` to re-mount (React Router keeps the component). The event lets the screen call its own `handleNewChat` to wipe state and the session URL param.
- **Sheet fetches on open, no sidebar cache sync needed.** That's why the `carolina-sessions-changed` dispatches were safe to delete.
- **`twMerge` in `cn()`** means the `w-full sm:max-w-md` override on `SheetContent` correctly overrides the variant's `w-3/4 sm:max-w-sm`. Don't change the override to something weaker.

## Gotchas for a future agent
- `handleSend` sets `activeSessionId = "pending"` and, if `mode` isn't set, defaults it to `"conversation"`. Be careful not to overwrite an already-selected mode — current code guards with `if (!mode) setMode(effectiveMode)`.
- The old "New chat" button on the full-screen overlay was preserved inside the new Sheet's header (green circle "+"). It dispatches `onNewChat()` then closes the sheet. Keep that — it's the only way to "reset" from inside the history on mobile (sidebar isn't there).
- `handleSelectMode` is no longer async. If you add DB work back, remember to make it async again and handle errors.
- `isMobile` was removed from `CarolinaHeader`'s signature but is still a state on the main screen (used for `ChatInput` and enterKeyHint). Don't confuse the two.
- The `History` link under LEARN in the sidebar still goes to `/history` (quiz results). It is NOT Carolina history — user explicitly kept it.

## Manual test checklist
1. Sidebar → `Carolina Chat` from any page → `/carolina` shows empty state with 4 mode cards (no DB row created) ✅
2. Click `Essay practice` card → Carolina's "¡Vamos a escribir!" opening appears, no `?session=` in URL ✅
3. Refresh the page → empty state again (because no session was ever created) ✅
4. Click `Essay practice`, type "hola", send → session is created server-side with opening + user + assistant rows; URL gains `?session=<id>` ✅
5. Click clock icon in header → right-side Sheet slides in with Starred/Recent and search ✅
6. Sidebar → `Call Carolina` → `/dialog` loads (untouched) ✅
