import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";

// Controlled textarea with cursor + scroll restoration. The parent owns the
// text value (so it survives mobile view-switching) and supplies the cursor
// offset / scroll top to restore when the editor remounts on tab switch.
const EssayEditor = forwardRef(function EssayEditor({
  value,
  onChange,
  onCursorChange,
  onScrollChange,
  onBlur,
  cursorOffset = null,
  scrollTop = null,
  autoFocus = false,
  readOnly = false,
  placeholder = "Empieza a escribir tu redacción aquí…",
  maxWidth = 640,
}, ref) {
  const taRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => taRef.current?.focus(),
  }));

  // Restore cursor + scroll on mount / remount (mobile tab switching).
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    if (cursorOffset != null) {
      try { ta.setSelectionRange(cursorOffset, cursorOffset); } catch { /* ignore */ }
    }
    if (scrollTop != null) {
      ta.scrollTop = scrollTop;
    }
    if (autoFocus) ta.focus();
    // Run only on mount — restoration is one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    onChange?.(e.target.value);
    onCursorChange?.(e.target.selectionStart);
  };

  const handleSelect = (e) => {
    onCursorChange?.(e.target.selectionStart);
  };

  const handleScroll = (e) => {
    onScrollChange?.(e.target.scrollTop);
  };

  return (
    <div className="w-full h-full flex justify-center">
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onScroll={handleScroll}
        onBlur={onBlur}
        placeholder={placeholder}
        spellCheck="true"
        lang="es"
        readOnly={readOnly}
        className={`font-inter w-full h-full resize-none border-0 outline-none bg-transparent text-[17px] leading-[1.75] text-[#0F1720] py-4 placeholder:text-[#9CA3AF] ${readOnly ? "cursor-not-allowed" : ""}`}
        style={{ maxWidth }}
      />
    </div>
  );
});

export default EssayEditor;
