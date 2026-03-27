import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchWeeks, createWeek, deleteWeek as apiDeleteWeek,
  createLesson, deleteLesson as apiDeleteLesson,
  fetchQuizzes, uploadLessonPdf, fetchLessons,
} from "../lib/api";
import { getAllPdfMeta } from "../lib/pdf-cache";
import { Plus, Search, Download, X } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import CurrentUnitSection from "../components/lessons/CurrentUnitSection";
import CompletedUnitsSection from "../components/lessons/CompletedUnitsSection";
import AddWeekModal from "../components/lessons/AddWeekModal";
import AddLessonModal from "../components/lessons/AddLessonModal";
import AddQuizModal from "../components/quizzes/AddQuizModal";
import ConfirmModal from "../components/ConfirmModal";
import GenerateFromPDFDialog from "../components/lessons/GenerateFromPDFDialog";

export default function LessonsScreen({ session }) {
  const navigate = useNavigate();
  const [weeks, setWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddWeek, setShowAddWeek] = useState(false);
  const [addLessonWeek, setAddLessonWeek] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [quizCounts, setQuizCounts] = useState({ perLesson: {}, weekTotal: {} });
  const [addQuizWeek, setAddQuizWeek] = useState(null);
  const [addQuizLesson, setAddQuizLesson] = useState(null);
  const [uploadState, setUploadState] = useState(null);
  const [generatePdfWeek, setGeneratePdfWeek] = useState(null);
  const [pdfCachedMap, setPdfCachedMap] = useState(new Map());
  const [currentUnitLessons, setCurrentUnitLessons] = useState(null);
  const [currentUnitLoading, setCurrentUnitLoading] = useState(false);
  const [refreshKeys, setRefreshKeys] = useState({});

  const uploadRef = useRef(null);
  const uploadTargetRef = useRef(null);

  useEffect(() => { loadWeeks(); loadQuizCounts(); loadPdfMeta(); }, []);

  /* ── Computed ── */

  const currentWeek = useMemo(() => {
    if (!weeks.length) return null;
    return weeks.reduce((max, w) => w.week_number > max.week_number ? w : max, weeks[0]);
  }, [weeks]);

  const pastWeeks = useMemo(() => {
    if (!currentWeek) return [];
    return weeks.filter(w => w.id !== currentWeek.id).sort((a, b) => b.week_number - a.week_number);
  }, [weeks, currentWeek]);

  const currentRefreshKey = currentWeek ? (refreshKeys[currentWeek.id] || 0) : 0;

  // Eagerly load lessons for the current unit
  useEffect(() => {
    if (!currentWeek) return;
    setCurrentUnitLoading(true);
    fetchLessons(currentWeek.id)
      .then(setCurrentUnitLessons)
      .catch(() => setCurrentUnitLessons([]))
      .finally(() => setCurrentUnitLoading(false));
  }, [currentWeek?.id, currentRefreshKey]);

  /* ── Data fetching ── */

  const loadWeeks = async () => {
    try { setWeeks(await fetchWeeks()); }
    catch (e) { console.error("Failed to load weeks:", e); }
    finally { setLoading(false); }
  };

  const loadQuizCounts = async () => {
    try {
      const quizzes = await fetchQuizzes();
      const perLesson = {}, weekTotal = {};
      quizzes.forEach(q => {
        if (q.lesson_id) {
          perLesson[q.lesson_id] = (perLesson[q.lesson_id] || 0) + 1;
          const weekId = q.lesson?.week_id;
          if (weekId) weekTotal[weekId] = (weekTotal[weekId] || 0) + 1;
        }
        if (q.week_id) weekTotal[q.week_id] = (weekTotal[q.week_id] || 0) + 1;
      });
      setQuizCounts({ perLesson, weekTotal });
    } catch (e) { console.error("Failed to load quiz counts:", e); }
  };

  const loadPdfMeta = async () => {
    try { setPdfCachedMap(await getAllPdfMeta()); }
    catch (e) { console.error("Failed to load pdf meta:", e); }
  };

  const bumpRefreshKey = (weekId) =>
    setRefreshKeys(prev => ({ ...prev, [weekId]: (prev[weekId] || 0) + 1 }));

  const nextWeekNumber = useMemo(() => {
    if (!weeks.length) return 1;
    return Math.max(...weeks.map(w => w.week_number)) + 1;
  }, [weeks]);

  // Placeholder — wire real completion data later
  const completedLessonIds = useMemo(() => new Set(), []);

  /* ── Handlers ── */

  const handleCreateWeek = async (weekNumber, title) => {
    const newWeek = await createWeek(weekNumber, title);
    const updated = [...weeks, { ...newWeek, lesson_count: 0 }].sort((a, b) => a.week_number - b.week_number);
    setWeeks(updated);
    loadWeeks();
  };

  const handleDeleteWeek = (week) =>
    setDeleteConfirm({
      type: "week", item: week,
      title: "Delete unit?",
      message: `Delete Unit ${week.week_number} and all its lessons? This cannot be undone.`,
    });

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "week") {
        await apiDeleteWeek(deleteConfirm.item.id);
        await loadWeeks(); loadQuizCounts();
      } else {
        await apiDeleteLesson(deleteConfirm.item.id);
        if (deleteConfirm.item._weekId) bumpRefreshKey(deleteConfirm.item._weekId);
        await loadWeeks(); loadQuizCounts();
      }
    } catch (e) { console.error("Delete failed:", e); }
    setDeleteConfirm(null);
  };

  const handleDeleteLesson = (lesson, weekId) =>
    setDeleteConfirm({
      type: "lesson",
      item: { ...lesson, _weekId: weekId },
      title: "Delete lesson?",
      message: `Delete "${lesson.title}"? This cannot be undone.`,
    });

  const handleSelectLesson = (lesson) => navigate(`/lesson/${lesson.id}`);

  const handleAddLesson = async (title, markdownContent) => {
    if (!addLessonWeek) return;
    await createLesson(addLessonWeek.id, title, markdownContent);
    setWeeks(prev => prev.map(w =>
      w.id === addLessonWeek.id ? { ...w, lesson_count: (w.lesson_count || 0) + 1 } : w
    ));
    bumpRefreshKey(addLessonWeek.id);
    loadWeeks();
  };

  const handleUploadPdf = (lesson, weekId) => {
    uploadTargetRef.current = { lessonId: lesson.id, weekId };
    uploadRef.current?.click();
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    const target = uploadTargetRef.current;
    if (!file || !target) return;
    setUploadState({ lessonId: target.lessonId, progress: 0, phase: "uploading" });
    try {
      await uploadLessonPdf(
        target.lessonId, file,
        (progress) => setUploadState(prev => prev ? { ...prev, progress } : null),
        (phase) => setUploadState(prev => prev ? { ...prev, phase } : null),
      );
      bumpRefreshKey(target.weekId);
      loadPdfMeta();
    } catch (err) { console.error("Upload failed:", err); }
    finally { setUploadState(null); }
    uploadTargetRef.current = null;
    e.target.value = "";
  };

  const handleQuizAdded = () => loadQuizCounts();

  /* ── Totals ── */

  const totalLessons = weeks.reduce((s, w) => s + (w.lesson_count || 0), 0);
  const totalQuizzes = Object.values(quizCounts.weekTotal).reduce((s, v) => s + v, 0);

  /* ── Render ── */

  return (
    <div className="fade-in min-h-screen bg-background">
      <div className="safe-top desktop-main lessons-page">

        {/* ─── Header ─── */}
        <div className="flex items-start justify-between pt-4 mb-4">
          <div>
            <h1 className="text-[28px] font-black text-foreground leading-tight font-['Nunito',sans-serif]">
              Lessons
            </h1>
            <p className="text-muted-foreground text-sm font-semibold mt-1">
              {weeks.length} unit{weeks.length !== 1 ? "s" : ""} · {totalLessons} lesson{totalLessons !== 1 ? "s" : ""}
              {totalQuizzes > 0 && <> · {totalQuizzes} quiz{totalQuizzes !== 1 ? "zes" : ""}</>}
            </p>
          </div>

          {/* Desktop buttons */}
          <div className="hidden sm:flex items-center gap-2.5">
            <Button variant="outline" size="sm" disabled className="opacity-60">
              <Download className="w-3.5 h-3.5" />
              Batch upload
            </Button>
            <Button size="sm" onClick={() => setShowAddWeek(true)}>
              <Plus className="w-3.5 h-3.5" />
              New unit
            </Button>
          </div>

          {/* Mobile + button */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Plus className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowAddWeek(true)}>
                  New unit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (currentWeek) setAddLessonWeek(currentWeek);
                }}>
                  New lesson
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ─── Search ─── */}
        <div className="flex items-center gap-2 px-3.5 py-2.5 bg-background border rounded-xl mb-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search lessons..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-foreground placeholder:text-muted-foreground font-['Nunito',sans-serif]"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ─── Content ─── */}
        {loading ? (
          <div className="flex flex-col gap-3 mt-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton skeleton-glow h-[72px] rounded-xl" />
            ))}
          </div>
        ) : weeks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-foreground text-lg font-extrabold mb-1">No units yet</p>
            <p className="text-muted-foreground text-sm font-semibold leading-relaxed">
              Create your first unit to start adding lessons!
            </p>
          </div>
        ) : (
          <>
            {/* Current unit hero section */}
            {currentWeek && (
              <CurrentUnitSection
                week={currentWeek}
                lessons={currentUnitLessons}
                loading={currentUnitLoading}
                searchQuery={searchQuery}
                quizCounts={quizCounts}
                pdfCachedMap={pdfCachedMap}
                completedLessonIds={completedLessonIds}
                uploadState={uploadState}
                onSelectLesson={handleSelectLesson}
                onAddLesson={() => {
                  setAddLessonWeek(currentWeek);
                }}
                onDeleteLesson={(l) => handleDeleteLesson(l, currentWeek.id)}
                onUploadPdf={(l) => handleUploadPdf(l, currentWeek.id)}
                onAddQuizLesson={(l) => setAddQuizLesson(l)}
                onGenerateFromPdf={() => setGeneratePdfWeek(currentWeek)}
                onDeleteWeek={() => handleDeleteWeek(currentWeek)}
              />
            )}

            {/* Completed units section */}
            {pastWeeks.length > 0 && (
              <CompletedUnitsSection
                weeks={pastWeeks}
                quizCounts={quizCounts}
                searchQuery={searchQuery}
                pdfCachedMap={pdfCachedMap}
                completedLessonIds={completedLessonIds}
                onSelectLesson={handleSelectLesson}
                onDeleteWeek={handleDeleteWeek}
              />
            )}
          </>
        )}
      </div>

      {/* Hidden PDF upload input */}
      <input ref={uploadRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelected} />

      {/* ─── Modals (unchanged) ─── */}
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
        weekLabel={addLessonWeek ? `Unit ${addLessonWeek.week_number} · ${addLessonWeek.title || `Unit ${addLessonWeek.week_number}`}` : ""}
      />

      {addQuizWeek && (
        <AddQuizModal
          open onClose={() => setAddQuizWeek(null)} onSuccess={handleQuizAdded}
          context={{ type: "week", weekId: addQuizWeek.id, weekTitle: `Unit ${addQuizWeek.week_number}: ${addQuizWeek.title || `Unit ${addQuizWeek.week_number}`}` }}
        />
      )}

      {addQuizLesson && (
        <AddQuizModal
          open onClose={() => setAddQuizLesson(null)} onSuccess={handleQuizAdded}
          context={{ type: "lesson", lessonId: addQuizLesson.id, lessonTitle: addQuizLesson.title }}
        />
      )}

      <ConfirmModal
        open={deleteConfirm !== null}
        title={deleteConfirm?.title || ""} message={deleteConfirm?.message || ""}
        confirmLabel="Delete" cancelLabel="Cancel" destructive
        onConfirm={confirmDelete} onCancel={() => setDeleteConfirm(null)}
      />

      <GenerateFromPDFDialog
        open={generatePdfWeek !== null}
        onClose={() => setGeneratePdfWeek(null)}
        unitId={generatePdfWeek?.id}
        onComplete={() => {
          if (generatePdfWeek) bumpRefreshKey(generatePdfWeek.id);
          loadWeeks();
          loadQuizCounts();
        }}
      />
    </div>
  );
}
