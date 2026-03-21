import { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { C } from "../../styles/theme";
import PdfBadge from "./PdfBadge";
import { isCached } from "../../lib/pdf-cache";

function stripMarkdown(md) {
  return (md || "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[>\-|]/g, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 60);
}

export default function LessonRow({ lesson, onSelect, onDelete, quizCount = 0 }) {
  const [hovered, setHovered] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const [pdfCached, setPdfCached] = useState(false);

  useEffect(() => {
    if (lesson.pdf_path) {
      isCached(lesson.id).then(setPdfCached).catch(() => {});
    }
  }, [lesson.id, lesson.pdf_path]);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lesson.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const preview = stripMarkdown(lesson.markdown_content);

  // Mobile swipe-to-delete
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    setSwiping(false);
  };
  const handleTouchMove = (e) => {
    const diff = e.touches[0].clientX - touchStartX.current;
    if (diff < -10) {
      setSwiping(true);
      setSwipeX(Math.max(diff, -80));
    }
  };
  const handleTouchEnd = () => {
    if (swipeX < -50) setSwipeX(-80);
    else setSwipeX(0);
    setSwiping(false);
  };

  return (
    <div ref={setNodeRef} style={{ ...style, position: "relative", overflow: "hidden" }}>
      {/* Delete button revealed by swipe */}
      {swipeX < 0 && (
        <button onClick={() => onDelete(lesson)} style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 80,
          background: C.error, border: "none", color: "#fff", fontWeight: 800,
          fontSize: 13, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "0 10px 10px 0",
        }}>Delete</button>
      )}

      <div
        onClick={() => !swiping && onSelect(lesson)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 14px",
          background: hovered ? "#F8FDFC" : C.card, cursor: "pointer",
          transition: "background 0.15s, transform 0.15s",
          borderRadius: 10, transform: `translateX(${swipeX}px)`,
        }}
      >
        {/* Document icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        </svg>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {lesson.title}
          </div>
          {preview && (
            <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
              {preview}
            </div>
          )}
          {(lesson.pdf_path || quizCount > 0) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {lesson.pdf_path && <PdfBadge isCached={pdfCached} />}
              {quizCount > 0 && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  padding: "2px 8px", borderRadius: 6,
                  background: "#EDE9FE", color: "#8B5CF6",
                  fontSize: 11, fontWeight: 800, flexShrink: 0,
                }}>
                  🧩 {quizCount}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Desktop delete button (hover only) */}
        <button
          className="lesson-delete-hover"
          onClick={(e) => { e.stopPropagation(); onDelete(lesson); }}
          style={{
            background: "none", border: "none", color: C.error, fontSize: 13,
            fontWeight: 700, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            opacity: hovered ? 1 : 0, transition: "opacity 0.15s",
            padding: "4px 8px", flexShrink: 0,
          }}
        >Delete</button>

        {/* Drag handle */}
        <div {...attributes} {...listeners} style={{
          cursor: "grab", padding: "4px 2px", color: C.border, fontSize: 16,
          userSelect: "none", touchAction: "none", flexShrink: 0,
        }}>
          ⋮⋮
        </div>
      </div>
    </div>
  );
}
