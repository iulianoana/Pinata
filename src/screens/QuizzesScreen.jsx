import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../styles/theme";
import { fetchQuizzes, deleteQuiz as apiDeleteQuiz } from "../lib/api";
import { getOfflineStatus, getWeekCacheStatus } from "../lib/offlineStatus";
import SkeletonCard from "../components/SkeletonCard";
import ConfirmModal from "../components/ConfirmModal";
import MobileNavBar from "../components/MobileNavBar";

export default function QuizzesScreen({ session }) {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [showSyncDot, setShowSyncDot] = useState(false);
  const [gearHover, setGearHover] = useState(false);

  // Check if anything needs syncing (non-blocking)
  useEffect(() => {
    getOfflineStatus().then((s) => {
      const needsSync = s.weeks.some((w) => getWeekCacheStatus(w) !== "cached");
      setShowSyncDot(needsSync);
    }).catch(() => {});
  }, []);

  const loadQuizzes = useCallback(() => {
    setLoading(true);
    fetchQuizzes()
      .then((data) => { setQuizzes(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadQuizzes(); }, [loadQuizzes]);

  // Build filter chips from quizzes data
  const filterChips = useMemo(() => {
    const chips = [{ type: "all", id: "all", label: "All" }];
    const weeks = new Map();
    const lessons = new Map();

    quizzes.forEach((q) => {
      if (q.week) {
        if (!weeks.has(q.week.id)) {
          weeks.set(q.week.id, {
            type: "week", id: q.week.id,
            label: `Unit ${q.week.week_number}: ${q.week.title}`,
            order: q.week.week_number,
          });
        }
      }
      if (q.lesson) {
        if (!lessons.has(q.lesson.id)) {
          lessons.set(q.lesson.id, { type: "lesson", id: q.lesson.id, label: q.lesson.title });
        }
        if (q.lesson.week && !weeks.has(q.lesson.week.id)) {
          weeks.set(q.lesson.week.id, {
            type: "week", id: q.lesson.week.id,
            label: `Unit ${q.lesson.week.week_number}: ${q.lesson.week.title}`,
            order: q.lesson.week.week_number,
          });
        }
      }
    });

    chips.push(...Array.from(weeks.values()).sort((a, b) => a.order - b.order));
    chips.push(...Array.from(lessons.values()));
    return chips;
  }, [quizzes]);

  // Filtered quizzes
  const filteredQuizzes = useMemo(() => {
    if (activeFilter === "all") return quizzes;
    const chip = filterChips.find((c) => c.id === activeFilter);
    if (!chip) return quizzes;
    if (chip.type === "week") {
      return quizzes.filter((q) =>
        q.week_id === chip.id || (q.lesson && q.lesson.week_id === chip.id)
      );
    }
    if (chip.type === "lesson") {
      return quizzes.filter((q) => q.lesson_id === chip.id);
    }
    return quizzes;
  }, [quizzes, activeFilter, filterChips]);

  // Global stats
  const stats = useMemo(() => {
    const scored = filteredQuizzes.filter((q) => q.avg_score != null);
    if (scored.length === 0) return null;
    const avg = Math.round(scored.reduce((s, q) => s + q.avg_score, 0) / scored.length);
    const bestCandidates = filteredQuizzes.filter((q) => q.best_score != null);
    const best = bestCandidates.length > 0 ? Math.max(...bestCandidates.map((q) => q.best_score)) : null;
    return { avg, best };
  }, [filteredQuizzes]);

  const inProgressCount = filteredQuizzes.filter((q) => q.progress_status === "in_progress").length;

  const handleQuizClick = (quiz) => {
    navigate(`/quiz/${quiz.id}?q=1`, { state: { from: "quizzes" } });
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await apiDeleteQuiz(deleteConfirmId);
      setQuizzes((prev) => prev.filter((q) => q.id !== deleteConfirmId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
    setDeleteConfirmId(null);
  };

  const getStatusBadge = (quiz) => {
    if (quiz.week_id && !quiz.lesson_id) return { label: "Unit Quiz", bg: C.unitQuizLight, color: C.unitQuiz };
    if (quiz.progress_status === "in_progress") return { label: "In progress", bg: C.accent, color: "#fff" };
    if (quiz.attempt_count > 0) return null;
    return { label: "New", bg: C.quizLight, color: C.quiz };
  };

  const getParentInfo = (quiz) => {
    if (quiz.lesson) return { label: quiz.lesson.title, icon: "\ud83d\udcd6", color: C.quiz };
    if (quiz.week) return { label: `Unit ${quiz.week.week_number}`, icon: "\ud83d\udcc1", color: C.unitQuiz };
    return null;
  };

  const getProgressPct = (quiz) => {
    if (!quiz.progress?.answers) return 0;
    const answered = Object.keys(quiz.progress.answers).length;
    return Math.round((answered / quiz.question_count) * 100);
  };

  return (
    <div className="fade-in" style={{ minHeight: "100vh", background: C.bg }}>
      <div className="desktop-main quizzes-page">
        {/* Header */}
        <div className="safe-top" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: C.text, lineHeight: 1.2 }}>Quizzes</h1>
              <p style={{ color: C.muted, fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                All your quizzes in one place
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
              {stats && (
                <>
                  <span style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 800,
                    background: C.accentLight, color: C.accentHover,
                  }}>Avg: {stats.avg}%</span>
                  {stats.best != null && (
                    <span style={{
                      padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 800,
                      background: "#FEF3C7", color: "#92400E",
                    }}>Best: {stats.best}%</span>
                  )}
                </>
              )}
              <button
                onClick={() => navigate("/storage")}
                onMouseEnter={() => setGearHover(true)}
                onMouseLeave={() => setGearHover(false)}
                style={{
                  width: 36, height: 36, borderRadius: 12,
                  border: `1.5px solid ${gearHover ? C.accent : C.border}`,
                  background: C.card, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative", transition: "border-color 0.15s",
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={gearHover ? C.accent : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.15s" }}>
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                {showSyncDot && (
                  <span style={{
                    position: "absolute", top: -3, right: -3,
                    width: 8, height: 8, borderRadius: "50%",
                    background: C.amber, border: `2px solid ${C.bg}`,
                  }} />
                )}
              </button>
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 16 }}>
            <div className="filter-chips-scroll" style={{ display: "flex", gap: 8, flex: 1 }}>
              {filterChips.map((chip) => {
                const isActive = activeFilter === chip.id;
                return (
                  <button key={chip.id} onClick={() => setActiveFilter(chip.id)} style={{
                    padding: "7px 16px", borderRadius: 20,
                    border: isActive ? "none" : `1.5px solid ${C.border}`,
                    background: isActive ? C.quiz : C.card,
                    color: isActive ? "#fff" : C.text,
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                    fontFamily: "'Nunito', sans-serif", whiteSpace: "nowrap",
                    transition: "all 0.15s", flexShrink: 0,
                  }}>
                    {chip.label}
                  </button>
                );
              })}
            </div>
            <span className="quizzes-meta-text" style={{
              fontSize: 12, fontWeight: 600, color: C.muted, whiteSpace: "nowrap",
            }}>
              {filteredQuizzes.length} quiz{filteredQuizzes.length !== 1 ? "zes" : ""}
              {inProgressCount > 0 ? ` \u00b7 ${inProgressCount} in progress` : ""}
            </span>
          </div>
        </div>

        {/* Quiz grid */}
        {loading ? (
          <div className="quizzes-grid">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} variant="progress" />)}
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.8 }}>{"\ud83d\udcda"}</div>
            <p style={{ color: C.text, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              {activeFilter === "all" ? "No quizzes yet" : "No quizzes here"}
            </p>
            <p style={{ color: C.muted, fontSize: 14, fontWeight: 600, lineHeight: 1.6 }}>
              {activeFilter === "all"
                ? "Add quizzes to your lessons to get started."
                : `No quizzes in ${filterChips.find((c) => c.id === activeFilter)?.label || "this filter"}`}
            </p>
          </div>
        ) : (
          <div className="quizzes-grid">
            {filteredQuizzes.map((quiz) => {
              const badge = getStatusBadge(quiz);
              const parent = getParentInfo(quiz);
              const progressPct = getProgressPct(quiz);
              const isInProgress = quiz.progress_status === "in_progress";

              return (
                <div key={quiz.id} onClick={() => handleQuizClick(quiz)} style={{
                  background: C.card, borderRadius: 16, padding: 20,
                  border: `1.5px solid ${isInProgress ? C.accent : C.border}`,
                  cursor: "pointer", transition: "all 0.15s",
                  position: "relative", display: "flex", flexDirection: "column",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,60,50,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>

                  {/* Status badge */}
                  {badge && (
                    <span style={{
                      position: "absolute", top: 14, right: 14,
                      padding: "4px 12px", borderRadius: 20,
                      fontSize: 11, fontWeight: 800,
                      background: badge.bg, color: badge.color,
                    }}>{badge.label}</span>
                  )}

                  {/* Delete button */}
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(quiz.id); }} style={{
                    position: "absolute", top: 8, right: 8, background: "none", border: "none",
                    color: C.muted, cursor: "pointer", fontSize: 18, padding: 4, opacity: 0,
                    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s", borderRadius: "50%", zIndex: 3,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.background = C.errorLight; e.currentTarget.style.color = C.error; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "0"; e.currentTarget.style.background = "none"; e.currentTarget.style.color = C.muted; }}>
                    {"\u00d7"}
                  </button>

                  {/* Title */}
                  <h3 style={{
                    fontSize: 16, fontWeight: 800, color: C.text,
                    marginBottom: 6, paddingRight: badge ? 100 : 0,
                    lineHeight: 1.3,
                  }}>{quiz.title}</h3>

                  {/* Parent + question count */}
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 14 }}>
                    {parent && (
                      <span style={{ color: parent.color }}>{parent.icon} {parent.label}</span>
                    )}
                    {parent && <span> {"\u00b7"} </span>}
                    {quiz.question_count} question{quiz.question_count !== 1 ? "s" : ""}
                  </p>

                  {/* Stats row */}
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, marginBottom: 12 }}>
                    <span>Best: <strong style={{ color: quiz.best_score != null ? C.text : C.muted }}>
                      {quiz.best_score != null ? `${quiz.best_score}%` : "\u2014"}</strong></span>
                    {"    "}
                    <span>Avg: <strong style={{ color: quiz.avg_score != null ? C.text : C.muted }}>
                      {quiz.avg_score != null ? `${quiz.avg_score}%` : "\u2014"}</strong></span>
                    {"    "}
                    <span>Attempts: <strong style={{ color: C.text }}>{quiz.attempt_count}</strong></span>
                  </div>

                  {/* Progress bar */}
                  <div style={{
                    height: 6, borderRadius: 3, background: "#E0F5F1",
                    marginBottom: 16, overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      background: progressPct > 0 ? "linear-gradient(90deg, #43C6AC, #2BA88C)" : "transparent",
                      width: `${progressPct}%`,
                      transition: "width 0.3s ease",
                    }} />
                  </div>

                  {/* Spacer */}
                  <div style={{ flex: 1 }} />

                  {/* Action button */}
                  <button onClick={(e) => { e.stopPropagation(); handleQuizClick(quiz); }} style={{
                    width: "100%", padding: "12px", borderRadius: 12,
                    border: `1.5px solid ${C.border}`, background: "transparent",
                    color: C.text, fontWeight: 700, fontSize: 14,
                    cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.borderColor = C.accent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = C.border; }}>
                    {isInProgress ? "Continue \u2192" : "Start \u2192"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MobileNavBar active="quizzes" />

      <ConfirmModal
        open={deleteConfirmId !== null}
        title="Delete quiz?"
        message="You'll lose all progress and saved data for this quiz."
        confirmLabel="Delete" cancelLabel="Cancel" destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
