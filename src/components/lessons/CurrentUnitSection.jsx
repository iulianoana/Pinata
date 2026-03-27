import { useMemo } from "react";
import { MoreVertical, Plus, Sparkles, Upload, Star, Trash2, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../../lib/utils";

function stripMarkdown(md) {
  return (md || "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[>\-|]/g, "")
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 80);
}

const PHASE_LABELS = { token: "Preparing...", uploading: "Uploading...", compressing: "Compressing...", saving: "Saving..." };

export default function CurrentUnitSection({
  week, lessons, loading, searchQuery, quizCounts, pdfCachedMap,
  completedLessonIds, uploadState,
  onSelectLesson, onAddLesson, onDeleteLesson,
  onUploadPdf, onAddQuizLesson, onGenerateFromPdf, onDeleteWeek,
}) {
  const filteredLessons = useMemo(() => {
    if (!lessons) return null;
    if (!searchQuery?.trim()) return lessons;
    const q = searchQuery.toLowerCase();
    return lessons.filter(l => l.title.toLowerCase().includes(q));
  }, [lessons, searchQuery]);

  // Hide when searching and no matches
  if (searchQuery?.trim() && filteredLessons && filteredLessons.length === 0) return null;

  const completedCount = lessons
    ? lessons.filter(l => completedLessonIds.has(l.id)).length
    : 0;
  const totalCount = lessons ? lessons.length : (week.lesson_count || 0);

  return (
    <div className="mt-6">
      {/* Unit header */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-base font-bold text-foreground truncate">
            Unit {week.week_number} — {week.title || `Unit ${week.week_number}`}
          </h2>
          {/* Desktop: CURRENT badge */}
          <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 rounded">
            Current
          </span>
          {/* Mobile: NOW badge */}
          <span className="sm:hidden px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 rounded">
            Now
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-medium shrink-0 ml-4">
          <span className="hidden sm:inline">{completedCount} of {totalCount} completed</span>
          <span className="sm:hidden">{completedCount}/{totalCount}</span>
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[50%] text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lesson</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center w-16">PDF</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center w-16">Cache</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center w-16">Quiz</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Loading lessons...
                </TableCell>
              </TableRow>
            ) : filteredLessons && filteredLessons.length > 0 ? (
              filteredLessons.map(lesson => (
                <DesktopLessonRow
                  key={lesson.id}
                  lesson={lesson}
                  isCompleted={completedLessonIds.has(lesson.id)}
                  pdfCached={pdfCachedMap.has(lesson.id)}
                  quizCount={quizCounts?.perLesson?.[lesson.id] || 0}
                  uploadState={uploadState?.lessonId === lesson.id ? uploadState : null}
                  onSelect={() => onSelectLesson(lesson)}
                  onUpload={() => onUploadPdf(lesson)}
                  onAddQuiz={() => onAddQuizLesson(lesson)}
                  onDelete={() => onDeleteLesson(lesson)}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No lessons yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile list */}
      <div className="sm:hidden border rounded-lg overflow-hidden divide-y">
        {loading ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            Loading lessons...
          </div>
        ) : filteredLessons && filteredLessons.length > 0 ? (
          filteredLessons.map(lesson => (
            <MobileLessonRow
              key={lesson.id}
              lesson={lesson}
              isCompleted={completedLessonIds.has(lesson.id)}
              pdfCached={pdfCachedMap.has(lesson.id)}
              quizCount={quizCounts?.perLesson?.[lesson.id] || 0}
              uploadState={uploadState?.lessonId === lesson.id ? uploadState : null}
              onSelect={() => onSelectLesson(lesson)}
              onUpload={() => onUploadPdf(lesson)}
              onAddQuiz={() => onAddQuizLesson(lesson)}
              onDelete={() => onDeleteLesson(lesson)}
            />
          ))
        ) : (
          <div className="text-center text-muted-foreground py-8 text-sm">
            No lessons yet
          </div>
        )}
      </div>

      {/* Footer actions */}
      {!searchQuery?.trim() && (
        <div className="flex items-center gap-4 mt-3">
          <button
            onClick={onAddLesson}
            className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-emerald-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add lesson</span>
            <span className="sm:hidden">Add</span>
          </button>
          <button
            onClick={onGenerateFromPdf}
            className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Generate from PDF</span>
            <span className="sm:hidden">Generate</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Desktop table row ── */
function DesktopLessonRow({ lesson, isCompleted, pdfCached, quizCount, uploadState, onSelect, onUpload, onAddQuiz, onDelete }) {
  const description = stripMarkdown(lesson.markdown_content);
  const isUploading = uploadState?.phase != null;

  return (
    <TableRow className="cursor-pointer" onClick={onSelect}>
      {/* Status + Title + Description */}
      <TableCell>
        <div className="min-w-0">
          <div className={cn(
            "text-sm font-medium truncate",
            isCompleted ? "line-through text-muted-foreground" : "text-foreground"
          )}>
            {lesson.title}
          </div>
          {description && (
            <div className="text-xs text-muted-foreground truncate mt-0.5">
              {description}
            </div>
          )}
        </div>
      </TableCell>

      {/* PDF */}
      <TableCell className="text-center">
        {isUploading ? (
          <span className="text-xs font-semibold text-emerald-600">
            {PHASE_LABELS[uploadState.phase] || "..."}
          </span>
        ) : lesson.pdf_path ? (
          <span className="text-xs font-semibold text-red-500">PDF</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Cache */}
      <TableCell className="text-center">
        {lesson.pdf_path && pdfCached ? (
          <Check className="w-4 h-4 text-emerald-500 mx-auto" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Quiz count */}
      <TableCell className="text-center">
        {quizCount > 0 ? (
          <span className="text-sm font-medium text-foreground">{quizCount}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Actions menu */}
      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onUpload}>
              <Upload className="w-4 h-4" />
              Upload PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddQuiz}>
              <Star className="w-4 h-4" />
              Generate quiz
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/* ── Mobile list row ── */
function MobileLessonRow({ lesson, isCompleted, pdfCached, quizCount, uploadState, onSelect, onUpload, onAddQuiz, onDelete }) {
  const isUploading = uploadState?.phase != null;
  const hasPdf = !!lesson.pdf_path;
  const hasResources = hasPdf || quizCount > 0;

  // Build resource indicators
  const indicators = [];
  if (isUploading) {
    indicators.push(
      <span key="up" className="text-emerald-600 font-semibold">
        {PHASE_LABELS[uploadState.phase] || "..."}
      </span>
    );
  } else {
    if (hasPdf) indicators.push(<span key="pdf" className="text-red-500 font-semibold">PDF</span>);
    if (hasPdf && pdfCached) indicators.push(<span key="cache" className="text-emerald-500 font-semibold">✓ Cached</span>);
    if (quizCount > 0) indicators.push(<span key="quiz" className="text-muted-foreground">{quizCount} quiz{quizCount > 1 ? "zes" : ""}</span>);
  }

  return (
    <div className="flex items-start gap-3 px-3 py-3 cursor-pointer hover:bg-gray-50 transition-colors" onClick={onSelect}>
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          "text-sm font-medium truncate",
          isCompleted ? "line-through text-muted-foreground" : "text-foreground"
        )}>
          {lesson.title}
        </div>
        {/* Resource indicators */}
        <div className="text-xs mt-1">
          {indicators.length > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              {indicators}
            </div>
          ) : (
            <span className="text-muted-foreground/60">No resources</span>
          )}
        </div>
      </div>

      {/* Three-dot menu */}
      <div className="shrink-0" onClick={e => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 text-muted-foreground">
              <MoreVertical className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onUpload}>
              <Upload className="w-4 h-4" />
              Upload PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onAddQuiz}>
              <Star className="w-4 h-4" />
              Generate quiz
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
              <Trash2 className="w-4 h-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
