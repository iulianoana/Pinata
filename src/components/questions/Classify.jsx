import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { shuffle } from "../../utils/helpers";

export default function Classify({ q, value, onChange }) {
  const allItems = useMemo(() => shuffle(Object.values(q.categories).flat()), [q]);
  const placements = value?.placements || {};
  const selected = value?._selected || null;
  const placed = Object.values(placements).flat();
  const unplaced = allItems.filter((it) => !placed.includes(it));

  const [dragging, setDragging] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [hoveredCat, setHoveredCat] = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const catRefs = useRef({});
  const hoveredCatRef = useRef(null);
  const dragItemRef = useRef(null);
  const placementsRef = useRef(placements);
  const onChangeRef = useRef(onChange);
  useEffect(() => { placementsRef.current = placements; }, [placements]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const startDrag = (item, clientX, clientY, rect) => {
    dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
    dragItemRef.current = item;
    setDragging(item);
    setDragPos({ x: clientX, y: clientY });
  };

  const handleTouchStart = (item, e) => {
    const touch = e.touches[0];
    startDrag(item, touch.clientX, touch.clientY, e.currentTarget.getBoundingClientRect());
  };

  const handleMouseDown = (item, e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    startDrag(item, e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  };

  useEffect(() => {
    if (!dragging) return;
    const hitTest = (cx, cy) => {
      let found = null;
      for (const [cat, el] of Object.entries(catRefs.current)) {
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) { found = cat; break; }
      }
      hoveredCatRef.current = found;
      setHoveredCat(found);
    };
    const dropItem = () => {
      const cat = hoveredCatRef.current;
      const item = dragItemRef.current;
      if (cat && item) {
        const np = { ...placementsRef.current };
        Object.keys(np).forEach((k) => (np[k] = (np[k] || []).filter((x) => x !== item)));
        np[cat] = [...(np[cat] || []), item];
        onChangeRef.current({ placements: np, _selected: null });
      }
      setDragging(null); setDragPos(null); setHoveredCat(null);
      hoveredCatRef.current = null; dragItemRef.current = null;
    };
    const onTouchMove = (e) => { e.preventDefault(); const t = e.touches[0]; setDragPos({ x: t.clientX, y: t.clientY }); hitTest(t.clientX, t.clientY); };
    const onMouseMove = (e) => { setDragPos({ x: e.clientX, y: e.clientY }); hitTest(e.clientX, e.clientY); };
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", dropItem);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", dropItem);
    return () => { document.removeEventListener("touchmove", onTouchMove); document.removeEventListener("touchend", dropItem); document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", dropItem); };
  }, [dragging]);

  const selectItem = (item) => {
    if (dragging) return;
    onChange({ ...value, placements, _selected: selected === item ? null : item });
  };
  const placeInCategory = (cat) => {
    if (!selected) return;
    const np = { ...placements };
    Object.keys(np).forEach((k) => (np[k] = (np[k] || []).filter((x) => x !== selected)));
    np[cat] = [...(np[cat] || []), selected];
    onChange({ placements: np, _selected: null });
  };
  const removeFromCategory = (item, cat) => {
    const np = { ...placements };
    np[cat] = (np[cat] || []).filter((x) => x !== item);
    onChange({ ...value, placements: np, _selected: null });
  };

  const chipClass = (isSel, isPlaced) => cn(
    "inline-flex items-center rounded-[20px] font-semibold cursor-pointer transition-all select-none min-h-[44px] border-[2.5px]",
    isPlaced ? "px-3.5 py-2 text-[13px]" : "px-[18px] py-2.5 text-sm",
    isSel || isPlaced ? "border-accent bg-accent-light text-accent-hover" : "border-border bg-white text-text"
  );

  return (
    <div>
      {unplaced.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {unplaced.map((item) => (
            <span key={item} onClick={() => selectItem(item)} onTouchStart={(e) => handleTouchStart(item, e)}
              onMouseDown={(e) => handleMouseDown(item, e)}
              className={chipClass(selected === item, false)}
              style={{ opacity: dragging === item ? 0.3 : 1, cursor: "grab" }}>
              {item}
            </span>
          ))}
        </div>
      )}
      {selected && !dragging && (
        <p className="text-accent text-[13px] font-semibold mb-3">
          Tap a category below to place "{selected}"
        </p>
      )}
      <div className="flex flex-col gap-3">
        {Object.keys(q.categories).map((cat) => (
          <div key={cat} ref={(el) => (catRefs.current[cat] = el)}>
            <div onClick={() => placeInCategory(cat)}
              style={{
                border: `2.5px ${placements[cat]?.length ? "solid" : "dashed"} ${hoveredCat === cat ? "var(--color-accent)" : selected ? "rgba(0,180,160,0.53)" : "var(--color-border)"}`,
                borderRadius: 14, padding: 14, minHeight: 56,
                cursor: selected ? "pointer" : "default", transition: "all 0.2s",
                background: hoveredCat === cat ? "var(--color-accent-light)" : selected ? "rgba(224,245,241,0.27)" : "transparent",
                transform: hoveredCat === cat ? "scale(1.01)" : "none",
              }}>
              <p className={cn(
                "text-[11px] font-bold text-muted uppercase tracking-wider",
                placements[cat]?.length && "mb-2.5"
              )}>{cat}</p>
              {placements[cat]?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {placements[cat].map((item) => (
                    <span key={item} onClick={(e) => { e.stopPropagation(); removeFromCategory(item, cat); }}
                      className={chipClass(false, true)}>{item} ×</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {dragging && dragPos && createPortal(
        <div style={{
          position: "fixed", left: dragPos.x - dragOffset.current.x, top: dragPos.y - dragOffset.current.y,
          zIndex: 9999, pointerEvents: "none", display: "inline-flex", alignItems: "center",
          padding: "10px 18px", borderRadius: 20, fontSize: 14, fontWeight: 600,
          background: "var(--color-accent-light)", border: "2.5px solid var(--color-accent)", color: "var(--color-accent-hover)",
          boxShadow: "0 8px 24px rgba(0,60,50,0.15)", transform: "scale(1.05)", whiteSpace: "nowrap",
        }}>{dragging}</div>,
        document.body
      )}
    </div>
  );
}
