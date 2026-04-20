import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../styles/theme";
import { getOfflineStatus, getWeekCacheStatus } from "../lib/offlineStatus";
import { prefetchAll, cacheQuizData } from "../lib/offline-cache";
import { cachePdf } from "../lib/pdf-cache";
import { fetchWeeks, fetchLessons, fetchQuizzes, fetchQuizData, getLessonPdfUrl } from "../lib/api";
import { fetchVerbs, fetchPacksByIds } from "../lib/conjugar/api";
import { fetchVocabulary } from "../useVocabulary";
import { flush, usePendingCount, useLastFlushError, clearPending } from "../lib/syncQueue";
import { relativeTime } from "../utils/helpers";


// ── SVG Icons ──

const BackIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const BookIcon = ({ bg, stroke }) => (
  <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  </div>
);

const GridIcon = ({ bg, stroke }) => (
  <div style={{ width: 24, height: 24, borderRadius: 6, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  </div>
);

const DocIcon = ({ bg, stroke }) => (
  <div style={{ width: 24, height: 24, borderRadius: 6, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  </div>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CloudIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
  </svg>
);

const ChatBubbleIcon = () => (
  <div style={{ width: 28, height: 28, borderRadius: 8, background: C.quizLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.quiz} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  </div>
);

const LoaderIcon = () => (
  <div style={{ width: 28, height: 28, borderRadius: 8, background: C.amberLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  </div>
);

const SyncSpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ animation: "syncSpin 0.8s linear infinite" }}>
    <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const Spinner = ({ size = 12, color = C.accent }) => (
  <div style={{
    width: size, height: size,
    border: `2px solid ${C.accentLight}`,
    borderTopColor: color,
    borderRadius: "50%",
    animation: "syncSpin 0.8s linear infinite",
  }} />
);

// ── Status badge ──

function StatusBadge({ status, syncing }) {
  if (syncing) {
    return (
      <span style={{
        padding: "4px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800,
        background: C.accentLight, color: C.accent,
        animation: "syncPulse 1.2s ease-in-out infinite",
      }}>Syncing...</span>
    );
  }
  const map = {
    cached: { bg: C.successLight, color: C.success, text: "Cached" },
    partial: { bg: C.amberLight, color: C.amberDark, text: "Partial" },
    none: { bg: C.errorLight, color: C.error, text: "Not cached" },
    empty: { bg: C.border, color: C.muted, text: "No content" },
  };
  const s = map[status] || map.none;
  return (
    <span style={{
      padding: "4px 10px", borderRadius: 12, fontSize: 10, fontWeight: 800,
      background: s.bg, color: s.color,
    }}>{s.text}</span>
  );
}

// ── Lesson icon colors ──

function isLessonFullyCached(lesson) {
  const pdfOk = !lesson.pdf_name || lesson.pdfCached;
  const cacheableQuizzes = lesson.quizzes.filter((q) => q.question_count);
  const quizzesOk = cacheableQuizzes.every((q) => q.dataCached);
  return pdfOk && quizzesOk;
}

function getLessonIconStyle(lesson) {
  const allCached = isLessonFullyCached(lesson);
  const someCached = lesson.pdfCached || lesson.quizzes.some((q) => q.dataCached);

  if (allCached) return { bg: C.successLight, stroke: C.success };
  if (someCached) return { bg: C.accentLight, stroke: C.accent };
  return { bg: C.amberLight, stroke: C.amber };
}

// ── Main Screen ──

export default function StorageScreen({ session }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState(null);
  const [openWeeks, setOpenWeeks] = useState(new Set());
  const [syncProgress, setSyncProgress] = useState(null);
  const [downloadingItems, setDownloadingItems] = useState(new Set());
  const [error, setError] = useState(null);
  const initialOpenDone = useRef(false);

  // Live pending-writes queue (separate from the download cache).
  const pendingCount = usePendingCount();
  const lastFlushError = useLastFlushError();

  const loadStatus = useCallback(async () => {
    try {
      const s = await getOfflineStatus();
      setStatus(s);
      setError(null);
      // Default: open first week (only on initial load)
      if (!initialOpenDone.current && s.weeks.length > 0) {
        setOpenWeeks(new Set([s.weeks[0].id]));
        initialOpenDone.current = true;
      }
    } catch {
      setError("Unable to check cache status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const toggleWeek = (weekId) => {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekId)) next.delete(weekId);
      else next.add(weekId);
      return next;
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress({ phase: "uploading", current: 0, total: 1 });
    try {
      // Push any queued writes first so the badge clears before we download.
      await flush();
      setSyncProgress({ phase: "metadata", current: 0, total: 1 });
      await prefetchAll(fetchWeeks, fetchLessons, fetchQuizzes, {
        fetchVerbsFn: fetchVerbs,
        fetchPacksByIdsFn: fetchPacksByIds,
        fetchVocabularyFn: fetchVocabulary,
        onProgress: (phase, current, total) => {
          setSyncProgress({ phase, current, total });
        },
      });
    } catch {}
    setSyncing(false);
    setSyncProgress(null);
    await loadStatus();
  };

  const handleClearPending = () => {
    if (window.confirm("Discard pending writes that keep failing? They won't reach the server.")) {
      clearPending();
    }
  };

  const handleDownloadQuiz = async (quizId) => {
    const key = `quiz-${quizId}`;
    setDownloadingItems((prev) => new Set(prev).add(key));
    try {
      const qd = await fetchQuizData(quizId);
      if (qd?.quiz_data) {
        await cacheQuizData(quizId, qd.quiz_data);
      }
    } catch {}
    setDownloadingItems((prev) => { const n = new Set(prev); n.delete(key); return n; });
    await loadStatus();
  };

  const handleDownloadPdf = async (lessonId) => {
    const key = `pdf-${lessonId}`;
    setDownloadingItems((prev) => new Set(prev).add(key));
    try {
      const urlData = await getLessonPdfUrl(lessonId);
      if (urlData?.url) {
        const res = await fetch(urlData.url);
        if (res.ok) {
          const blob = await res.blob();
          await cachePdf(lessonId, blob);
        }
      }
    } catch {}
    setDownloadingItems((prev) => { const n = new Set(prev); n.delete(key); return n; });
    await loadStatus();
  };

  // Progress bar percentage
  const progressPct = syncProgress
    ? syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0
    : 0;

  const phaseLabels = {
    uploading: "Uploading pending changes...",
    metadata: "Fetching course data...",
    quizzes: "Downloading quizzes...",
    lessons: "Downloading lessons...",
    pdfs: "Downloading PDFs...",
    verbs: "Downloading verbs...",
    drillPacks: "Downloading conjugation exercises...",
  };

  // Count total cached / total items. Must match getWeekCacheStatus semantics:
  // PDFs count only for lessons with pdf_name; quizzes count only if they have questions.
  const { totalItems, cachedItems } = (status?.weeks || []).reduce((acc, w) => {
    for (const l of w.lessons) {
      if (l.pdf_name) {
        acc.totalItems++;
        if (l.pdfCached) acc.cachedItems++;
      }
      for (const q of l.quizzes) {
        if (!q.question_count) continue;
        acc.totalItems++;
        if (q.dataCached) acc.cachedItems++;
      }
    }
    for (const q of w.weekQuizzes || []) {
      if (!q.question_count) continue;
      acc.totalItems++;
      if (q.dataCached) acc.cachedItems++;
    }
    return acc;
  }, { totalItems: 0, cachedItems: 0 });

  const allSynced = totalItems > 0 && cachedItems === totalItems;
  const hasSynced = status?.lastSyncTime != null;

  if (loading) {
    return (
      <div className="fade-in" style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ minHeight: "100vh", background: C.bg, paddingBottom: 100 }}>
      <div className="desktop-main" style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Header */}
        <div className="safe-top" style={{ padding: "16px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => navigate("/")}
              style={{
                width: 36, height: 36, borderRadius: 12,
                border: `1.5px solid ${C.border}`, background: C.card,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <BackIcon />
            </button>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: C.text }}>Offline storage</h1>
          </div>

          {/* Last synced / syncing text */}
          <p style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: C.muted, marginTop: 8 }}>
            {syncing
              ? <span style={{ color: C.accent }}>Syncing...</span>
              : status?.lastSyncTime
                ? `Last synced: ${relativeTime(status.lastSyncTime)}`
                : "Not synced yet"}
          </p>
        </div>

        {/* Progress bar (only during sync) */}
        {syncing && syncProgress && (
          <div style={{ padding: "8px 20px 0" }}>
            <div style={{ height: 6, borderRadius: 3, background: C.accentLight, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                background: "linear-gradient(90deg, #43C6AC, #2BA88C)",
                width: `${progressPct}%`,
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>
                {phaseLabels[syncProgress.phase] || "Syncing..."}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.muted }}>{progressPct}%</span>
            </div>
          </div>
        )}

        {/* Storage summary card */}
        <div style={{ padding: "12px 20px 0" }}>
          <div style={{
            background: C.accentLight, borderRadius: 14, padding: "14px 16px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.accentHover }}>Storage used</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.accentHover }}>
                {status?.storageEstimate?.used || "—"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {syncing ? (
                <>
                  <SyncSpinnerIcon />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>Syncing</span>
                </>
              ) : allSynced ? (
                <>
                  <CheckIcon />
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.success }}>All synced</span>
                </>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>
                  {cachedItems} of {totalItems} items
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px 20px", textAlign: "center" }}>
            <p style={{ color: C.error, fontSize: 13, fontWeight: 700 }}>{error}</p>
          </div>
        )}

        {/* Course content section */}
        <div style={{
          fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase",
          letterSpacing: 0.5, padding: "12px 20px 6px",
        }}>Course content</div>

        {/* Week cards */}
        {status?.weeks.map((week) => {
          const weekStatus = getWeekCacheStatus(week);
          const isOpen = openWeeks.has(week.id);
          const lessonCount = week.lessons.length;
          const quizCount = week.lessons.reduce((s, l) => s + l.quizzes.length, 0);

          return (
            <div key={week.id} style={{
              background: C.card, borderRadius: 16, margin: "0 16px 12px",
              border: `1.5px solid ${syncing ? C.accent : C.border}`,
              overflow: "hidden",
            }}>
              {/* Week header */}
              <button
                onClick={() => toggleWeek(week.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "14px 16px", background: "none", border: "none",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <ChevronIcon open={isOpen} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                    Week {week.week_number}: {week.title}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
                    {lessonCount} lesson{lessonCount !== 1 ? "s" : ""} · {quizCount} quiz{quizCount !== 1 ? "zes" : ""}
                  </div>
                </div>
                <StatusBadge status={weekStatus} syncing={syncing} />
              </button>

              {/* Week items (expanded) */}
              {isOpen && (
                <div style={{ borderTop: `1px solid ${C.border}` }}>
                  {week.lessons.map((lesson) => {
                    const iconStyle = getLessonIconStyle(lesson);
                    const lessonAllCached = isLessonFullyCached(lesson);

                    return (
                      <div key={lesson.id}>
                        {/* Lesson row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px 12px 48px" }}>
                          <BookIcon bg={iconStyle.bg} stroke={iconStyle.stroke} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 12, fontWeight: 700, color: C.text,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>{lesson.title}</div>
                            <div style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>
                              Lesson {lesson.sort_order || ""}
                            </div>
                          </div>
                          {syncing ? <Spinner size={14} /> : lessonAllCached ? <CheckIcon /> : <span style={{ color: C.muted }}>—</span>}
                        </div>

                        {/* Quiz rows */}
                        {lesson.quizzes.map((quiz) => {
                          const qKey = `quiz-${quiz.id}`;
                          const isDownloading = downloadingItems.has(qKey);

                          return (
                            <div key={quiz.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 64px" }}>
                              <GridIcon
                                bg={quiz.dataCached ? C.successLight : C.accentLight}
                                stroke={quiz.dataCached ? C.success : C.accent}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: 12, fontWeight: 700, color: C.text,
                                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                }}>{quiz.title}</div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>
                                  {quiz.question_count} question{quiz.question_count !== 1 ? "s" : ""}
                                </div>
                              </div>
                              {isDownloading || syncing ? (
                                <Spinner size={14} />
                              ) : quiz.dataCached ? (
                                <CheckIcon />
                              ) : (
                                <button
                                  onClick={() => handleDownloadQuiz(quiz.id)}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
                                >
                                  <DownloadIcon />
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* PDF row */}
                        {lesson.pdf_name && (() => {
                          const pKey = `pdf-${lesson.id}`;
                          const isDownloading = downloadingItems.has(pKey);
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 64px" }}>
                              <DocIcon
                                bg={lesson.pdfCached ? C.successLight : C.amberLight}
                                stroke={lesson.pdfCached ? C.success : C.amber}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Lesson PDF</div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>
                                  {lesson.pdfCached ? (lesson.pdfSize || "Downloaded") : "Not downloaded"}
                                </div>
                              </div>
                              {isDownloading || syncing ? (
                                <Spinner size={14} />
                              ) : lesson.pdfCached ? (
                                <CheckIcon />
                              ) : (
                                <button
                                  onClick={() => handleDownloadPdf(lesson.id)}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
                                >
                                  <DownloadIcon />
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        {/* Show PDF row even if no pdf_name, but only if lesson has no pdf */}
                        {!lesson.pdf_name && (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 64px" }}>
                            <DocIcon bg={C.amberLight} stroke={C.amber} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Lesson PDF</div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: C.muted }}>No PDF uploaded</div>
                            </div>
                            <span style={{ color: C.muted }}>—</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Other data section */}
        <div style={{
          fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase",
          letterSpacing: 0.5, padding: "12px 20px 6px",
        }}>Other data</div>

        {/* Chat history */}
        <div style={{
          background: C.card, borderRadius: 16, margin: "0 16px 12px",
          border: `1.5px solid ${C.border}`, padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <ChatBubbleIcon />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Chat history</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
              {status?.chatSessionCount || 0} session{status?.chatSessionCount !== 1 ? "s" : ""} · Cloud only
            </div>
          </div>
          <CloudIcon />
        </div>

        {/* Pending sync */}
        <div style={{
          background: C.card, borderRadius: 16, margin: "0 16px 12px",
          border: `1.5px solid ${lastFlushError && pendingCount > 0 ? C.error : C.border}`,
          padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <LoaderIcon />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Pending sync</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>
              {pendingCount > 0
                ? `${pendingCount} item${pendingCount !== 1 ? "s" : ""} waiting`
                : "All synced"}
            </div>
            {pendingCount > 0 && lastFlushError && (
              <div style={{
                fontSize: 10, fontWeight: 600, color: C.error,
                marginTop: 4, wordBreak: "break-word",
              }}>
                Last error: {lastFlushError.message}
              </div>
            )}
          </div>
          {pendingCount > 0 && lastFlushError && (
            <button
              onClick={handleClearPending}
              style={{
                background: C.errorLight, color: C.error,
                border: "none", borderRadius: 8,
                padding: "6px 10px", fontSize: 10, fontWeight: 800,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif",
              }}
            >Discard</button>
          )}
        </div>

        {/* Sync button */}
        <div style={{ padding: "8px 16px 16px" }}>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              width: "100%", padding: 14, borderRadius: 14,
              background: syncing ? C.muted : C.accent, border: "none",
              color: "#fff", fontWeight: 800, fontSize: 14,
              cursor: syncing ? "default" : "pointer",
              fontFamily: "'Nunito', sans-serif",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? (
              <>
                <Spinner size={14} color="#fff" />
                Syncing...
              </>
            ) : hasSynced ? "Sync again" : "Sync everything now"}
          </button>
        </div>
      </div>


    </div>
  );
}
