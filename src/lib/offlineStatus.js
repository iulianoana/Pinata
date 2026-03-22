import Dexie from "dexie";

// Re-open existing databases read-only (same schemas as offline-cache.js and pdf-cache.js)
const offlineDb = new Dexie("pinata-offline");
offlineDb.version(1).stores({
  weeks: "id",
  lessons: "id, week_id",
  quizzes: "id, lesson_id, week_id",
  quizData: "id",
  apiResponses: "key",
});

const pdfDb = new Dexie("pinata-pdfs");
pdfDb.version(1).stores({ pdfs: "lessonId" });

// Last sync timestamp
export function getLastSyncTime() {
  const ts = localStorage.getItem("pinata_last_sync");
  return ts ? Number(ts) : null;
}

export function setLastSyncTime(ts = Date.now()) {
  localStorage.setItem("pinata_last_sync", String(ts));
}

// Format bytes to human-readable
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Main status function
export async function getOfflineStatus() {
  try {
    const weeks = await offlineDb.weeks.toArray();
    weeks.sort((a, b) => (a.week_number || 0) - (b.week_number || 0));

    const weekResults = await Promise.all(
      weeks.map(async (week) => {
        const lessons = await offlineDb.lessons
          .where("week_id")
          .equals(week.id)
          .toArray();
        lessons.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const lessonResults = await Promise.all(
          lessons.map(async (lesson) => {
            const quizzes = await offlineDb.quizzes
              .where("lesson_id")
              .equals(lesson.id)
              .toArray();

            const quizResults = await Promise.all(
              quizzes.map(async (quiz) => ({
                id: quiz.id,
                title: quiz.title,
                question_count: quiz.question_count || 0,
                dataCached: (await offlineDb.quizData.get(quiz.id)) != null,
              }))
            );

            const pdfEntry = await pdfDb.pdfs.get(lesson.id);

            return {
              id: lesson.id,
              title: lesson.title,
              sort_order: lesson.sort_order,
              pdf_name: lesson.pdf_name,
              pdfCached: pdfEntry != null,
              pdfSize: lesson.pdf_size || null,
              quizzes: quizResults,
            };
          })
        );

        return {
          id: week.id,
          week_number: week.week_number,
          title: week.title,
          lessons: lessonResults,
        };
      })
    );

    // Storage estimate
    let storageEstimate = null;
    try {
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        storageEstimate = {
          used: formatBytes(est.usage || 0),
          quota: formatBytes(est.quota || 0),
        };
      }
    } catch {}

    // Pending sync count
    let pendingSyncCount = 0;
    try {
      pendingSyncCount = JSON.parse(
        localStorage.getItem("pending_sync") || "[]"
      ).length;
    } catch {}

    return {
      weeks: weekResults,
      chatSessionCount: 0,
      pendingSyncCount,
      lastSyncTime: getLastSyncTime(),
      storageEstimate,
    };
  } catch (e) {
    console.warn("Failed to get offline status:", e);
    return {
      weeks: [],
      chatSessionCount: 0,
      pendingSyncCount: 0,
      lastSyncTime: getLastSyncTime(),
      storageEstimate: null,
    };
  }
}

// Aggregate status per week
export function getWeekCacheStatus(week) {
  if (!week.lessons || week.lessons.length === 0) return "none";

  let totalItems = 0;
  let cachedItems = 0;

  for (const lesson of week.lessons) {
    // Count PDF only if lesson has one
    if (lesson.pdf_name) {
      totalItems++;
      if (lesson.pdfCached) cachedItems++;
    }

    // Count quizzes
    for (const quiz of lesson.quizzes) {
      totalItems++;
      if (quiz.dataCached) cachedItems++;
    }
  }

  if (totalItems === 0) return "none";
  if (cachedItems === totalItems) return "cached";
  if (cachedItems > 0) return "partial";
  return "none";
}
