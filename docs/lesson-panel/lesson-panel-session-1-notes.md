# Lesson side-panel · Session 1 — unified tabbed resizable panel

Merges the two separate right-hand surfaces on the lesson-detail screen (fixed 320 px Resources sidebar + slide-in Course PDF panel) into **one always-visible tabbed panel** on desktop, with a resize handle whose width persists per-device.

## Files edited

- `src/components/lessons/LessonReader.jsx` — merged the two `<div>` panels at the end of `.lesson-reader-body` into one `.side-panel-desktop`; removed the header "Course PDF / Attach PDF" button; renamed `panelTab` → `sideTab` (`"resources" | "pdf"`, default `"resources"`); renamed storage key; auto-load PDF effect now keys off `sideTab === "pdf"` instead of `pdfPanelOpen`.
- `app/globals.css` + `src/styles/theme.js` — both hold the same desktop-layout rules. Renamed `.pdf-side-panel-desktop` → `.side-panel-desktop`; deleted `.quiz-sidebar-desktop` and the `.lesson-reader-panel-open` override; `.lesson-reader-container` desktop max-width is now 100% (was 860 px with a toggled override).

Mobile paths are untouched — `.pdf-section-inline` and `.quiz-section-mobile` still render inline below markdown and the desktop panel stays `display:none` there.

## Non-obvious decisions

- **Resize handle is always rendered now.** Previously it only mounted when `pdfPanelOpen` was true. Its hit strip is `position:absolute; left:0; width:6px; zIndex:5` inside the panel's `padding:"10px 12px"` tab row, so it doesn't steal clicks from the Resources/Course PDF buttons.
- **Width bounds tightened.** `MIN_PANEL_W` went 300 → 320 (matches the retired fixed sidebar's floor). `MAX_PANEL_PCT` stays at 70 %. Default on first load is a flat 400 px (`DEFAULT_PANEL_W`), no longer `50% of body width`.
- **Storage key renamed**, not migrated. `pinata-pdf-panel-width` → `pinata-side-panel-width`. The semantics changed (the panel is no longer PDF-only), and any existing saved width was chosen for PDF-viewing context. Users reset once to 400 px then re-set to taste.
- **PDF blob load is lazy on tab.** Effect now fires when the user switches to the `pdf` tab, not on mount. Cheaper for users who never look at the PDF.
- **Tab underline is teal (`C.accent`) for both tabs** — previous panel had one teal, one purple. Equal-weight top-level tabs read cleaner with a single accent.
- **Content column max-width is now 100 % on desktop** (was 860 px + a `.lesson-reader-panel-open` override that bumped it to 100 %). Flex shrinking handles narrow remaining space when the panel is dragged wide.

## Gotchas for future agents

- `theme.js` injects the same stylesheet as `globals.css` at runtime (legacy). **Any CSS edit for lesson layout must be applied to both files** or the rules diverge between SSR and first client render.
- The mobile inline sections (`.quiz-section-mobile`, `.pdf-section-inline`) live inside the markdown column and are completely separate code paths. Desktop tab state has zero effect on them.
- The iframe-remount-on-resize trick (`setIframeKey((k) => k + 1)` in `onMouseUp`) is load-bearing — browsers' PDF viewer doesn't recalc zoom on width changes without it.
- No schema, API, or migration changes. Zero backend impact.
