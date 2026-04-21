# Redacción · Session 5 — Resizable writing panel (desktop)

**Status:** Ready to build. Depends on Session 4 (the two-panel editor + review UI already ships).
**Ships:** A draggable divider on the desktop redacción page. User sets how wide the writing/review panel is; brief reflows to fill the rest. Width persists per-browser.

---

## 1. Why this session exists

On wide screens, users want more room for the essay itself — the brief panel (`LA TAREA · MISIÓN · REQUISITOS`) is useful as a reference but doesn't need 40% of the screen once they're mid-essay. On narrower desktops, others want the opposite. The current fixed `2fr 3fr` grid doesn't serve either group. Same applies in review mode, where the corrected essay with inline notes benefits from more horizontal space.

Mobile is untouched — it already uses tabs to switch between brief and editor and has no splitter concept.

---

## 2. Context you need

### Files that matter
- `src/components/redaccion/AssignmentEditorDesktop.jsx` — the desktop shell; line 98 is the grid definition that we're replacing
- `src/components/redaccion/AssignmentEditorMobile.jsx` — **do not touch**; mobile keeps tab layout
- `src/components/redaccion/BriefView.jsx`, `EssayEditor.jsx`, `CorrectionReview.jsx` — children that must reflow inside whatever width we give them

### The pattern to copy
`src/components/lessons/LessonReader.jsx` already ships a draggable panel (the right-side resources/PDF panel on the lesson page). Copy its approach verbatim for visual + interaction consistency:
- `PANEL_STORAGE_KEY = "pinata-side-panel-width"` (LessonReader.jsx:98)
- `getEffectiveWidth()` pattern that computes a default from container width on first load (lines 209–215)
- `onResizeStart` mousedown handler — locks `body.cursor = "col-resize"` and `body.userSelect = "none"` during drag (lines 217–245)
- Drag handle: 6px-wide absolutely-positioned strip on the panel's inside edge, transparent by default, turns `C.border` gray on hover, stays gray while `isResizing` (lines 680–689)
- Save to `localStorage` on mouseup, not on every pointer move

---

## 3. Tasks

### Replace the grid with flex in `AssignmentEditorDesktop.jsx`
Change:
```jsx
<div className="flex-1 grid min-h-0" style={{ gridTemplateColumns: "2fr 3fr" }}>
```
to a flex container:
```jsx
<div ref={bodyRef} className="flex-1 flex min-h-0 relative">
  <div className="min-w-0 flex-1 ...">{/* brief column */}</div>
  <div style={{ width: editorWidth }} className="relative shrink-0 ...">
    {/* drag handle on left edge */}
    {/* editor or review */}
  </div>
</div>
```
The brief keeps all its existing Tailwind classes (`border-r bg-[#FAFAF7] flex flex-col`) and picks up `flex-1 min-w-0`. The right column becomes a fixed pixel width from state.

### State + persistence
- `PANEL_STORAGE_KEY = "pinata-redaccion-editor-width"`
- `DEFAULT_EDITOR_PCT = 60` (matches today's 3-of-5 split)
- `MIN_EDITOR_W = 400`
- `MIN_BRIEF_W = 280`
- `const [editorWidth, setEditorWidth] = useState(getSavedWidth())` — null until measured
- `const bodyRef = useRef(null)`, `editorWidthRef` mirror for the mouseup save
- `const [isResizing, setIsResizing] = useState(false)` for handle visual state
- `getEffectiveWidth()` — returns saved width if present, else `clamp(MIN_EDITOR_W, bodyW * 0.6, bodyW - MIN_BRIEF_W)`

### Drag handler (copy from LessonReader.jsx:217–245, flip the sign)
Because our handle is on the **left** edge of the **right** panel (same position as the lesson reader), the math stays identical:
```js
const startW = getEffectiveWidth();
const onMove = (ev) => {
  const bodyW = bodyRef.current?.offsetWidth || 1;
  let newW = startW + (startX - ev.clientX);
  newW = Math.max(MIN_EDITOR_W, Math.min(newW, bodyW - MIN_BRIEF_W));
  setEditorWidth(Math.round(newW));
};
```
On mouseup: `localStorage.setItem(PANEL_STORAGE_KEY, String(editorWidthRef.current))`, unlock body cursor, `setIsResizing(false)`.

### Window resize re-clamp
Add a `resize` listener: if `editorWidth > bodyW - MIN_BRIEF_W`, clamp it down. Write the new value to state (no localStorage write on auto-clamp — only user drags persist).

### Handle placement
Inside the right column, before the editor/review content — **match `LessonReader.jsx:681–689` verbatim** so the interaction and visuals are identical to the lesson page's side panel:
```jsx
<div
  onMouseDown={onResizeStart}
  style={{
    position: "absolute", left: 0, top: 0, bottom: 0, width: 6,
    cursor: "col-resize", zIndex: 5, background: "transparent",
  }}
  onMouseEnter={(e) => (e.currentTarget.style.background = C.border)}
  onMouseLeave={(e) => { if (!isResizing) e.currentTarget.style.background = "transparent"; }}
/>
```
The background stays "on" during drag because the `if (!isResizing)` check keeps mouseLeave from clearing it. Import `C` from `src/styles/theme.js` (already used throughout the codebase).

### Both views use the same container
Session 4's code already renders `CorrectionReview` inside the same right column as the editor — the resize applies to both without any view-specific branching. Confirm nothing inside `CorrectionReview` has a hardcoded pixel width that would break at ≥400px.

---

## 4. Acceptance criteria

- Dragging the divider on ≥1024px screens smoothly resizes the writing column; brief fills the remaining space
- Cursor becomes `col-resize` while hovering the handle or while dragging
- Handle strip is invisible at rest, gray on hover, stays gray throughout the drag
- Releasing the mouse persists the width to `localStorage`; reloading the page restores it
- Editor column cannot shrink below 400px; brief cannot shrink below 280px
- Switching between writing mode and review mode (same assignment, before/after `Corregir`) preserves the user's chosen width
- Shrinking the browser window re-clamps the width if it would push the brief below 280px; widening the window doesn't auto-expand
- Mobile (<1024px) is untouched — the tab layout still works
- Essay text in the editor and corrected segments in review both reflow correctly at min and max widths; no horizontal scrollbar appears on the right column's inner content at 400px

---

## 5. Edge cases

- **First visit on a narrow-but-still-desktop window (say 1100px wide):** `MIN_EDITOR_W + MIN_BRIEF_W = 680`, so there's room. Default uses 60% → 660px editor, 440px brief. Fine.
- **First visit on a very narrow "desktop" window (say 1024px exactly, minus the 220px left nav = 804px body):** 60% is ~482px editor / 322px brief. Both above mins. Fine.
- **User saves 900px editor width on a big monitor, later opens on a laptop where body is only 900px:** Re-clamp kicks in; editor clamps to `900 − 280 = 620px`. Don't persist the clamp.
- **Resize mid-correction (while the `CorrectingOverlay` animation is running):** The overlay uses `overflow-visible` for its glow effect — confirm the glow/beam animation still looks right at narrow widths. If the beam extends beyond the column it's fine (already absolute/positioned in LessonReader pattern).
- **SSR:** `localStorage` reads are guarded (`typeof window !== "undefined"`). Initial render uses `null`, first `useEffect` measures the container and applies the default. Same pattern as LessonReader.

---

## 6. Verification before merging

1. Desktop ≥1400px: drag handle left and right; confirm smooth resize, brief text reflows, no layout jump
2. Desktop 1100px: confirm default split fits, can drag within bounds, hits mins cleanly
3. Reload after drag: width restored
4. Open the review (after `Corregir`) on a previously-resized assignment: same width applies, corrected segments reflow
5. Shrink window while editor column is at a large width: clamps down; essay still readable
6. Mobile (375px): open the same route, confirm tabs still work and no divider/handle is visible

---

## 7. Out of scope

- Vertical resizing (top/bottom split)
- Double-click on divider to reset to default (not in the lesson reader either — keep consistent)
- Touch/pointer drag on mobile (mobile uses tabs, not a splitter)
- Per-assignment width memory (one global width for the whole redacción feature, same as the lesson reader's one global width)
- Animated transition when width changes programmatically (e.g., on resize re-clamp) — instant is fine
