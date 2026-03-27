import { useState, useEffect, useRef } from "react";
import { ChevronRight, Check } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { cn } from "../../lib/utils";
import { fetchLessons } from "../../lib/api";

export default function CompletedUnitsSection({
  weeks, quizCounts, searchQuery, pdfCachedMap, completedLessonIds,
  onSelectLesson, onDeleteWeek,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [lessonsByWeek, setLessonsByWeek] = useState({});
  const [loadingWeeks, setLoadingWeeks] = useState(new Set());
  const preSearchRef = useRef(null);

  // Auto-expand all when searching, restore on clear
  useEffect(() => {
    if (searchQuery?.trim()) {
      if (!preSearchRef.current) preSearchRef.current = new Set(expandedIds);
      setExpandedIds(new Set(weeks.map(w => w.id)));
    } else if (preSearchRef.current) {
      setExpandedIds(preSearchRef.current);
      preSearchRef.current = null;
    }
  }, [searchQuery]);

  // Load lessons when a week is expanded
  useEffect(() => {
    expandedIds.forEach(weekId => {
      if (lessonsByWeek[weekId] || loadingWeeks.has(weekId)) return;
      setLoadingWeeks(prev => new Set([...prev, weekId]));
      fetchLessons(weekId)
        .then(lessons => {
          setLessonsByWeek(prev => ({ ...prev, [weekId]: lessons }));
        })
        .catch(() => {
          setLessonsByWeek(prev => ({ ...prev, [weekId]: [] }));
        })
        .finally(() => {
          setLoadingWeeks(prev => {
            const next = new Set(prev);
            next.delete(weekId);
            return next;
          });
        });
    });
  }, [expandedIds]);

  const toggleWeek = (weekId) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(weekId) ? next.delete(weekId) : next.add(weekId);
      return next;
    });
  };

  // Filter weeks that have matching lessons when searching
  const visibleWeeks = (() => {
    if (!searchQuery?.trim()) return weeks;
    const q = searchQuery.toLowerCase();
    return weeks.filter(w => {
      const lessons = lessonsByWeek[w.id];
      if (!lessons) return true; // still loading, show it
      return lessons.some(l => l.title.toLowerCase().includes(q));
    });
  })();

  if (visibleWeeks.length === 0) return null;

  return (
    <div className="mt-8">
      {/* Section divider */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Completed
          <span className="sm:hidden"> · {weeks.length} unit{weeks.length !== 1 ? "s" : ""}</span>
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead className="w-10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">#</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Unit</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center w-20">Lessons</TableHead>
              <TableHead className="hidden sm:table-cell text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center w-20">Quizzes</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center w-20">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleWeeks.map(week => {
              const isExpanded = expandedIds.has(week.id);
              const isLoading = loadingWeeks.has(week.id);
              const lessons = lessonsByWeek[week.id];
              const quizTotal = quizCounts?.weekTotal?.[week.id] || 0;

              // Compute completion for this unit
              const completedCount = lessons
                ? lessons.filter(l => completedLessonIds.has(l.id)).length
                : 0;
              const totalCount = week.lesson_count || 0;
              const allComplete = totalCount > 0 && completedCount === totalCount;

              // Filter lessons during search
              const filteredLessons = (() => {
                if (!lessons) return null;
                if (!searchQuery?.trim()) return lessons;
                const q = searchQuery.toLowerCase();
                return lessons.filter(l => l.title.toLowerCase().includes(q));
              })();

              return (
                <UnitRows
                  key={week.id}
                  week={week}
                  isExpanded={isExpanded}
                  isLoading={isLoading}
                  filteredLessons={filteredLessons}
                  quizTotal={quizTotal}
                  completedCount={completedCount}
                  totalCount={totalCount}
                  allComplete={allComplete}
                  completedLessonIds={completedLessonIds}
                  pdfCachedMap={pdfCachedMap}
                  searchQuery={searchQuery}
                  onToggle={() => toggleWeek(week.id)}
                  onSelectLesson={onSelectLesson}
                  onDeleteWeek={() => onDeleteWeek(week)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function UnitRows({
  week, isExpanded, isLoading, filteredLessons,
  quizTotal, completedCount, totalCount, allComplete,
  completedLessonIds, pdfCachedMap, searchQuery,
  onToggle, onSelectLesson, onDeleteWeek,
}) {
  // Right-click to delete
  const handleContextMenu = (e) => {
    e.preventDefault();
    onDeleteWeek();
  };

  return (
    <>
      {/* Unit row */}
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
        onContextMenu={handleContextMenu}
      >
        {/* Chevron */}
        <TableCell className="pr-0">
          <ChevronRight className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-90"
          )} />
        </TableCell>

        {/* Number */}
        <TableCell className="text-center text-sm font-semibold text-muted-foreground">
          {week.week_number}
        </TableCell>

        {/* Title */}
        <TableCell>
          <span className="text-sm font-semibold text-foreground">
            {week.title || `Unit ${week.week_number}`}
          </span>
        </TableCell>

        {/* Lesson count */}
        <TableCell className="text-center text-sm text-muted-foreground">
          {week.lesson_count || 0}
        </TableCell>

        {/* Quiz count — hidden on mobile */}
        <TableCell className="hidden sm:table-cell text-center text-sm text-muted-foreground">
          {quizTotal}
        </TableCell>

        {/* Progress */}
        <TableCell className="text-center">
          <span className={cn(
            "text-sm font-bold",
            allComplete ? "text-emerald-500" : "text-muted-foreground"
          )}>
            {completedCount}/{totalCount}
          </span>
        </TableCell>
      </TableRow>

      {/* Expanded lesson sub-rows */}
      {isExpanded && (
        isLoading ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={6} className="text-center text-muted-foreground py-4 text-xs">
              Loading...
            </TableCell>
          </TableRow>
        ) : filteredLessons && filteredLessons.length > 0 ? (
          filteredLessons.map(lesson => {
            const isCompleted = completedLessonIds.has(lesson.id);
            const pdfCached = pdfCachedMap.has(lesson.id);
            return (
              <TableRow
                key={lesson.id}
                className="cursor-pointer hover:bg-gray-50 border-0"
                onClick={() => onSelectLesson(lesson)}
              >
                {/* Spacer for chevron */}
                <TableCell className="pr-0" />

                {/* Spacer for # */}
                <TableCell />

                {/* Lesson title with icon */}
                <TableCell>
                  <div className="pl-2">
                    <span className={cn(
                      "text-sm font-medium truncate",
                      isCompleted ? "line-through text-muted-foreground" : "text-foreground"
                    )}>
                      {lesson.title}
                    </span>
                  </div>
                </TableCell>

                {/* PDF indicator */}
                <TableCell className="text-center">
                  {lesson.pdf_path ? (
                    <span className="text-xs font-semibold text-red-500">PDF</span>
                  ) : null}
                </TableCell>

                {/* Quizzes — hidden on mobile, empty for sub-rows */}
                <TableCell className="hidden sm:table-cell" />

                {/* Cache indicator */}
                <TableCell className="text-center">
                  {pdfCached ? (
                    <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })
        ) : null
      )}
    </>
  );
}
