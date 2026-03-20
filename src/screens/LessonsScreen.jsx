import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../styles/theme";
import { fetchWeeks, createWeek, deleteWeek as apiDeleteWeek, createLesson, deleteLesson as apiDeleteLesson, fetchLessons } from "../lib/api";
import WeekCard from "../components/lessons/WeekCard";
import LessonReader from "../components/lessons/LessonReader";
import LessonSearch from "../components/lessons/LessonSearch";
import AddWeekModal from "../components/lessons/AddWeekModal";
import AddLessonModal from "../components/lessons/AddLessonModal";
import ConfirmModal from "../components/ConfirmModal";

export default function LessonsScreen({ session }) {
  const navigate = useNavigate();
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState(new Set());
  const [refreshKeys, setRefreshKeys] = useState({}); // { weekId: counter } to trigger lesson re-fetch
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [selectedWeekContext, setSelectedWeekContext] = useState("");
  const [returnToWeekId, setReturnToWeekId] = useState(null);
  const [showAddWeek, setShowAddWeek] = useState(false);
  const [addLessonWeek, setAddLessonWeek] = useState(null);
  const [searchActive, setSearchActive] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [headerH, setHeaderH] = useState(0);

  const headerRef = useRef(null);
  useEffect(() => {
    if (!headerRef.current) return;
    const ro = new ResizeObserver(([e]) => setHeaderH(e.contentRect.height + parseFloat(getComputedStyle(e.target).paddingTop) + parseFloat(getComputedStyle(e.target).paddingBottom)));
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { loadWeeks(); }, []);

  const loadWeeks = async () => {
    try {
      const data = await fetchWeeks();
      setWeeks(data);
    } catch (e) {
      console.error("Failed to load weeks:", e);
    } finally {
      setLoading(false);
    }
  };

  const bumpRefreshKey = (weekId) => {
    setRefreshKeys((prev) => ({ ...prev, [weekId]: (prev[weekId] || 0) + 1 }));
  };

  const displayName = session?.user?.user_metadata?.display_name
    || session?.user?.user_metadata?.full_name
    || session?.user?.email?.split("@")[0] || "there";

  const nextWeekNumber = useMemo(() => {
    if (weeks.length === 0) return 1;
    return Math.max(...weeks.map((w) => w.week_number)) + 1;
  }, [weeks]);

  const toggleWeek = (weekId) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  };

  const handleCreateWeek = async (weekNumber, title) => {
    await createWeek(weekNumber, title);
    await loadWeeks();
  };

  const handleDeleteWeek = (week) => {
    setDeleteConfirm({
      type: "week",
      item: week,
      title: "Delete week?",
      message: `Delete Week ${week.week_number} and all its lessons? This cannot be undone.`,
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "week") {
        await apiDeleteWeek(deleteConfirm.item.id);
        setExpandedWeeks((prev) => {
          const next = new Set(prev);
          next.delete(deleteConfirm.item.id);
          return next;
        });
        await loadWeeks();
      } else {
        await apiDeleteLesson(deleteConfirm.item.id);
        const weekId = deleteConfirm.item._weekId;
        if (weekId) bumpRefreshKey(weekId);
        await loadWeeks();
      }
    } catch (e) {
      console.error("Delete failed:", e);
    }
    setDeleteConfirm(null);
  };

  const handleDeleteLesson = (lesson, weekId) => {
    setDeleteConfirm({
      type: "lesson",
      item: { ...lesson, _weekId: weekId },
      title: "Delete lesson?",
      message: `Delete "${lesson.title}"? This cannot be undone.`,
    });
  };

  const handleSelectLesson = (lesson, week) => {
    setSelectedLesson(lesson);
    setSelectedWeekContext(`Week ${week.week_number} · ${week.title || `Week ${week.week_number}`}`);
    setReturnToWeekId(week.id);
  };

  const handleAddLesson = async (title, markdownContent) => {
    if (!addLessonWeek) return;
    await createLesson(addLessonWeek.id, title, markdownContent);
    bumpRefreshKey(addLessonWeek.id);
    await loadWeeks();
  };

  const handleSearchSelect = async (result) => {
    try {
      const lessons = await fetchLessons(result.week_id);
      const lesson = lessons.find((l) => l.id === result.id);
      if (lesson) {
        setSelectedLesson(lesson);
        setSelectedWeekContext(`Week ${result.week_number} · ${result.week_title}`);
        setReturnToWeekId(result.week_id);
      }
    } catch (e) {
      console.error("Failed to load lesson:", e);
    }
  };

  const handleBackFromReader = () => {
    setSelectedLesson(null);
    setSelectedWeekContext("");
    // Re-expand the week the lesson belonged to
    if (returnToWeekId) {
      setExpandedWeeks((prev) => new Set([...prev, returnToWeekId]));
    }
    setReturnToWeekId(null);
  };

  // Lesson reader view
  if (selectedLesson) {
    return (
      <div className="desktop-main safe-top">
        <LessonReader
          lesson={selectedLesson}
          weekContext={selectedWeekContext}
          onBack={handleBackFromReader}
        />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ minHeight: "100vh", background: C.bg }}>
      {/* Fixed header */}
      <div ref={headerRef} className="safe-top desktop-main desktop-header-fixed" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 20,
        background: C.bg, padding: "16px 20px 0",
      }}>
        <div className="app-header-inner">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: C.text, lineHeight: 1.3 }}>Hola, {displayName}</h1>
              <p style={{ color: C.muted, fontSize: 14, fontWeight: 600, marginTop: 2 }}>Ready to practice?</p>
            </div>
          </div>

          {/* Mobile tab bar (hidden on desktop via CSS) */}
          <div className="mobile-tab-bar" style={{ display: "flex", borderRadius: 12, background: C.accentLight, padding: 4, marginBottom: 16 }}>
            {[
              { label: "Quizzes", id: "quizzes" },
              { label: "Lessons", id: "lessons" },
              { label: "History", id: "history" },
              { label: "Hablar", id: "hablar" },
            ].map((tab) => (
              <button key={tab.id} onClick={() => {
                if (tab.id === "lessons") return;
                if (tab.id === "hablar") navigate("/dialog");
                else if (tab.id === "history") navigate("/?tab=history");
                else navigate("/");
              }} style={{
                flex: 1, padding: "8px 0",
                background: tab.id === "lessons" ? C.card : "transparent",
                border: "none", borderRadius: 10,
                color: tab.id === "lessons" ? C.accentHover : C.muted,
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                fontFamily: "'Nunito', sans-serif", transition: "all 0.15s",
                boxShadow: tab.id === "lessons" ? "0 1px 3px rgba(0,60,50,0.08)" : "none",
              }}>{tab.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Spacer for fixed header */}
      <div style={{ height: headerH }} />

      {/* Content */}
      <div className="app-container desktop-main" style={{ padding: "0 16px 32px" }}>
        {/* Search bar + New Week button row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <LessonSearch onSelectResult={handleSearchSelect} onActiveChange={setSearchActive} />
          </div>
          <button className="new-week-btn-desktop" onClick={() => setShowAddWeek(true)} style={{
            display: "none", alignItems: "center", gap: 6,
            padding: "10px 18px", borderRadius: 12, border: "none",
            background: C.accent, color: "#fff", fontWeight: 800, fontSize: 14,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            whiteSpace: "nowrap", transition: "filter 0.15s", flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New week
          </button>
        </div>

        {/* Accordion list of weeks (hidden when search is active) */}
        {!searchActive && (
          <div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="skeleton skeleton-glow" style={{ height: 80, borderRadius: 16 }} />
                ))}
              </div>
            ) : weeks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 20px" }}>
                <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.8 }}>📖</div>
                <p style={{ color: C.text, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>No weeks yet</p>
                <p style={{ color: C.muted, fontSize: 14, fontWeight: 600, lineHeight: 1.6 }}>
                  Create your first week to start adding lessons!
                </p>
              </div>
            ) : (
              <div className="lessons-accordion" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
                {weeks.map((week) => (
                  <WeekCard
                    key={week.id}
                    week={week}
                    expanded={expandedWeeks.has(week.id)}
                    refreshKey={refreshKeys[week.id] || 0}
                    onToggle={() => toggleWeek(week.id)}
                    onSelectLesson={(lesson) => handleSelectLesson(lesson, week)}
                    onAddLesson={() => {
                      setAddLessonWeek(week);
                      setExpandedWeeks((prev) => new Set([...prev, week.id]));
                    }}
                    onDeleteLesson={(lesson) => handleDeleteLesson(lesson, week.id)}
                    onDeleteWeek={handleDeleteWeek}
                  />
                ))}
              </div>
            )}

            {/* Bottom helper text (mobile only) */}
            {weeks.length > 0 && (
              <p className="lessons-footer-text" style={{
                textAlign: "center", color: C.muted, fontSize: 12, fontWeight: 600,
                marginTop: 24, padding: "0 20px",
              }}>
                All weeks collapsed · tap a week to expand · FAB adds new week
              </p>
            )}
          </div>
        )}
      </div>

      {/* Mobile FAB for new week (hidden on desktop via CSS) */}
      <button className="fab-new-week" onClick={() => setShowAddWeek(true)} style={{
        position: "fixed", bottom: 24, right: 24, width: 56, height: 56,
        borderRadius: "50%", border: "none", background: C.accent,
        color: "#fff", fontSize: 28, fontWeight: 300, cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,180,160,0.3)", zIndex: 15,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.06)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,180,160,0.4)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,180,160,0.3)"; }}>
        +
      </button>

      {/* Modals */}
      <AddWeekModal
        open={showAddWeek}
        onClose={() => setShowAddWeek(false)}
        onCreate={handleCreateWeek}
        nextWeekNumber={nextWeekNumber}
      />

      <AddLessonModal
        open={addLessonWeek !== null}
        onClose={() => setAddLessonWeek(null)}
        onCreate={handleAddLesson}
        weekLabel={addLessonWeek ? `Week ${addLessonWeek.week_number} · ${addLessonWeek.title || `Week ${addLessonWeek.week_number}`}` : ""}
      />

      <ConfirmModal
        open={deleteConfirm !== null}
        title={deleteConfirm?.title || ""}
        message={deleteConfirm?.message || ""}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
