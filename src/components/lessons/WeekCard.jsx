import { useState, useEffect, useRef } from "react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { C } from "../../styles/theme";
import LessonRow from "./LessonRow";
import { fetchLessons, reorderLessons } from "../../lib/api";

export default function WeekCard({ week, expanded, refreshKey, onToggle, onSelectLesson, onAddLesson, onDeleteLesson, onDeleteWeek, quizCounts, onAddUnitQuiz }) {
  const [lessons, setLessons] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const lastRefreshKey = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Fetch lessons when expanded for the first time, or when refreshKey changes
  useEffect(() => {
    if (!expanded) return;
    if (lessons !== null && refreshKey === lastRefreshKey.current) return;
    lastRefreshKey.current = refreshKey;
    setLoading(true);
    fetchLessons(week.id)
      .then((data) => setLessons(data))
      .catch(() => setLessons([]))
      .finally(() => setLoading(false));
  }, [expanded, week.id, refreshKey]);

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !lessons) return;

    const oldIndex = lessons.findIndex((l) => l.id === active.id);
    const newIndex = lessons.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(lessons, oldIndex, newIndex);
    const original = [...lessons];

    // Optimistic update
    setLessons(reordered);

    // Persist new order
    const updates = reordered.map((l, i) => ({ id: l.id, sort_order: i }));
    try {
      await reorderLessons(updates);
    } catch {
      setLessons(original);
    }
  };

  // Context menu for week deletion (desktop: right-click)
  const handleContextMenu = (e) => {
    e.preventDefault();
    onDeleteWeek(week);
  };

  // Long press for mobile
  const longPressTimer = useRef(null);
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => onDeleteWeek(week), 600);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  };

  return (
    <div style={{
      background: C.card, borderRadius: 16, overflow: "hidden",
      border: expanded ? `2px solid ${C.accent}` : `1px solid ${C.border}`,
      transition: "border-color 0.2s, box-shadow 0.2s",
      boxShadow: hovered ? "0 4px 12px rgba(0,60,50,0.08)" : "0 1px 4px rgba(0,60,50,0.06)",
    }}>
      {/* Week header */}
      <div
        onClick={onToggle}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
          cursor: "pointer", userSelect: "none",
        }}
      >
        {/* Week number badge */}
        <div style={{
          width: 38, height: 38, borderRadius: 10, display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800,
          background: expanded ? C.accent : C.accentLight,
          color: expanded ? "#fff" : C.accentHover,
          flexShrink: 0, transition: "all 0.2s",
        }}>
          {week.week_number}
        </div>

        {/* Title + lesson count + quiz count */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {week.title || `Week ${week.week_number}`}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 2 }}>
            {week.lesson_count} lesson{week.lesson_count !== 1 ? "s" : ""}
            {(quizCounts?.weekTotal?.[week.id] || 0) > 0 && (
              <> · {quizCounts.weekTotal[week.id]} quiz{quizCounts.weekTotal[week.id] !== 1 ? "zes" : ""}</>
            )}
          </div>
        </div>

        {/* Chevron */}
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{
            transition: "transform 0.2s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {/* Week markdown content (if any) */}
          {week.markdown_content && (
            <div style={{ padding: "14px 18px", fontSize: 13, color: C.muted, fontWeight: 600, lineHeight: 1.6, background: "#FAFFFE" }}>
              {week.markdown_content}
            </div>
          )}

          {/* Lessons list */}
          {loading ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>Loading lessons...</div>
            </div>
          ) : lessons && lessons.length > 0 ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <div style={{ padding: "4px 8px" }}>
                  {lessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      onSelect={onSelectLesson}
                      onDelete={onDeleteLesson}
                      quizCount={quizCounts?.perLesson?.[lesson.id] || 0}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : lessons && lessons.length === 0 ? (
            <div style={{ padding: "16px 18px", textAlign: "center" }}>
              <p style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>No lessons yet</p>
            </div>
          ) : null}

          {/* Footer actions */}
          <div style={{ display: "flex", borderTop: `1px solid ${C.border}` }}>
            <button onClick={() => onAddLesson(week)} style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              flex: 1, padding: "12px", border: "none",
              background: "transparent", color: C.accent, fontWeight: 700, fontSize: 13,
              cursor: "pointer", fontFamily: "'Nunito', sans-serif",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.accentLight)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
              + Add lesson
            </button>
            {onAddUnitQuiz && (
              <button onClick={() => onAddUnitQuiz(week)} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                flex: 1, padding: "12px", border: "none",
                borderLeft: `1px solid ${C.border}`,
                background: "transparent", color: "#8B5CF6", fontWeight: 700, fontSize: 13,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#EDE9FE")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                + Add unit quiz
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
