import Dexie from "dexie";
import { cachePdf, removeCachedPdf, getAllPdfMeta } from "./pdf-cache.js";
import { getLessonPdfUrl, fetchQuizData, fetchPdfVersions } from "./api.js";

const db = new Dexie("pinata-offline");
db.version(1).stores({
  weeks: "id",
  lessons: "id, week_id",
  quizzes: "id, lesson_id, week_id",
  quizData: "id",           // full quiz_data blobs keyed by quiz id
  apiResponses: "key",      // generic key-value for API responses
});
db.version(2).stores({
  weeks: "id",
  lessons: "id, week_id",
  quizzes: "id, lesson_id, week_id",
  quizData: "id",
  apiResponses: "key",
  verbs: "id",                      // conjugation verbs (with pack metadata)
  drillPacks: "id, verb_id, tense", // full exercise blobs for drills
});

// ── Weeks ──

export async function cacheWeeks(weeks) {
  await db.weeks.bulkPut(weeks);
}

export async function getCachedWeeks() {
  return db.weeks.toArray();
}

// ── Lessons ──

export async function cacheLessons(lessons) {
  await db.lessons.bulkPut(lessons);
}

export async function getCachedLessons(weekId) {
  return db.lessons.where("week_id").equals(weekId).toArray();
}

export async function cacheLesson(lesson) {
  await db.lessons.put(lesson);
}

export async function getCachedLesson(lessonId) {
  return db.lessons.get(lessonId) ?? null;
}

// ── Quizzes (list with metadata) ──

export async function cacheQuizzes(quizzes) {
  await db.quizzes.bulkPut(quizzes);
}

export async function getCachedQuizzes(filters = {}) {
  let col = db.quizzes.toCollection();
  if (filters.lesson_id) col = db.quizzes.where("lesson_id").equals(filters.lesson_id);
  else if (filters.week_id) col = db.quizzes.where("week_id").equals(filters.week_id);
  return col.toArray();
}

// ── Quiz data (full question data for taking a quiz) ──

export async function cacheQuizData(id, data) {
  await db.quizData.put({ id, data, cachedAt: Date.now() });
}

export async function getCachedQuizData(id) {
  const entry = await db.quizData.get(id);
  return entry ? { id: entry.id, data: entry.data } : null;
}

// ── Conjugation: Verbs ──

export async function cacheVerbs(verbs) {
  await db.verbs.bulkPut(verbs);
}

export async function getCachedVerbs() {
  return db.verbs.toArray();
}

// ── Conjugation: Drill Packs (full exercise blobs) ──

export async function cacheDrillPacks(packs) {
  if (!packs || packs.length === 0) return;
  await db.drillPacks.bulkPut(packs);
}

export async function getCachedDrillPacksByIds(packIds) {
  if (!packIds || packIds.length === 0) return [];
  return db.drillPacks.where("id").anyOf(packIds).toArray();
}

export async function getCachedDrillPacksByVerb(verbId) {
  return db.drillPacks.where("verb_id").equals(verbId).toArray();
}

export async function getCachedDrillPacksByVerbs(verbIds) {
  if (!verbIds || verbIds.length === 0) return [];
  return db.drillPacks.where("verb_id").anyOf(verbIds).toArray();
}

// ── Prefetch all data for offline use ──

export async function prefetchAll(fetchWeeksFn, fetchLessonsFn, fetchQuizzesFn, options = {}) {
  const { onProgress, fetchVerbsFn, fetchPacksByIdsFn } = options;

  try {
    // Phase 1: metadata
    onProgress?.("metadata", 0, 1);
    const [weeks, quizzes] = await Promise.all([
      fetchWeeksFn(),
      fetchQuizzesFn(),
    ]);

    await cacheWeeks(weeks);
    await cacheQuizzes(quizzes);

    // Phase 2: quiz data blobs (fetched individually — list API doesn't include quiz_data)
    for (let i = 0; i < quizzes.length; i++) {
      try {
        const cached = await getCachedQuizData(quizzes[i].id);
        if (!cached) {
          const qd = await fetchQuizData(quizzes[i].id);
          if (qd?.quiz_data) {
            await cacheQuizData(qd.id, qd.quiz_data);
          }
        }
      } catch { /* skip */ }
      onProgress?.("quizzes", i + 1, quizzes.length);
    }

    // Phase 3: lessons per week (inject week_id — API doesn't return it)
    let lessonsDone = 0;
    const allLessons = [];
    for (const week of weeks) {
      try {
        const lessons = await fetchLessonsFn(week.id);
        const lessonsWithWeekId = lessons.map((l) => ({ ...l, week_id: week.id }));
        await cacheLessons(lessonsWithWeekId);
        allLessons.push(...lessonsWithWeekId);
        lessonsDone++;
        onProgress?.("lessons", lessonsDone, weeks.length);
      } catch { /* skip failed week */ }
    }

    // Phase 4: PDFs — download new + stale PDFs
    const lessonsWithPdf = allLessons.filter((l) => l.pdf_name);
    let pdfsDone = 0;

    // Get cloud PDF timestamps (single API call) and local cache timestamps
    let cloudMap = new Map();
    try {
      const cloudVersions = await fetchPdfVersions();
      cloudMap = new Map(
        cloudVersions.map((v) => [v.lessonId, new Date(v.updatedAt).getTime()])
      );
    } catch { /* if offline / fails, only download uncached */ }

    const localMeta = await getAllPdfMeta();

    for (const lesson of lessonsWithPdf) {
      try {
        const localCachedAt = localMeta.get(lesson.id);
        const cloudUpdatedAt = cloudMap.get(lesson.id);

        const needsDownload =
          !localCachedAt ||                                  // not cached
          (cloudUpdatedAt && cloudUpdatedAt > localCachedAt); // cloud is newer

        if (needsDownload) {
          const urlData = await getLessonPdfUrl(lesson.id);
          if (urlData?.url) {
            const res = await fetch(urlData.url);
            if (res.ok) {
              const blob = await res.blob();
              await cachePdf(lesson.id, blob);
            }
          }
        }
      } catch { /* skip failed PDF */ }
      pdfsDone++;
      onProgress?.("pdfs", pdfsDone, lessonsWithPdf.length);
    }

    // Clean up cached PDFs for lessons where the cloud PDF was deleted
    const lessonsWithoutPdf = new Set(
      allLessons.filter((l) => !l.pdf_name).map((l) => l.id)
    );
    for (const [lessonId] of localMeta) {
      if (lessonsWithoutPdf.has(lessonId)) {
        await removeCachedPdf(lessonId);
      }
    }

    // Phase 5: Conjugation — verbs + full drill packs (exercises)
    if (fetchVerbsFn && fetchPacksByIdsFn) {
      try {
        onProgress?.("verbs", 0, 1);
        const verbs = await fetchVerbsFn();
        await cacheVerbs(verbs);
        onProgress?.("verbs", 1, 1);

        const verbIds = verbs.map((v) => v.id);
        if (verbIds.length > 0) {
          onProgress?.("drillPacks", 0, 1);
          const { packs } = await fetchPacksByIdsFn(verbIds);
          await cacheDrillPacks(packs || []);
          onProgress?.("drillPacks", 1, 1);
        }
      } catch { /* skip on failure — verbs stay uncached this sync */ }
    }

    // Save timestamp
    localStorage.setItem("pinata_last_sync", String(Date.now()));
  } catch (e) {
    console.warn("Offline prefetch failed:", e);
  }
}
