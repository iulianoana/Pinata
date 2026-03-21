import Dexie from "dexie";

const db = new Dexie("pinata-offline");
db.version(1).stores({
  weeks: "id",
  lessons: "id, week_id",
  quizzes: "id, lesson_id, week_id",
  quizData: "id",           // full quiz_data blobs keyed by quiz id
  apiResponses: "key",      // generic key-value for API responses
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

// ── Prefetch all data for offline use ──

export async function prefetchAll(fetchWeeksFn, fetchLessonsFn, fetchQuizzesFn) {
  try {
    const [weeks, quizzes] = await Promise.all([
      fetchWeeksFn(),
      fetchQuizzesFn(),
    ]);

    await cacheWeeks(weeks);
    await cacheQuizzes(quizzes);

    // Cache quiz_data for each quiz so quizzes can be taken offline
    for (const q of quizzes) {
      if (q.quiz_data) {
        await cacheQuizData(q.id, q.quiz_data);
      }
    }

    // Fetch and cache lessons for every week
    await Promise.all(
      weeks.map(async (week) => {
        try {
          const lessons = await fetchLessonsFn(week.id);
          await cacheLessons(lessons);
        } catch { /* skip failed week */ }
      })
    );
  } catch (e) {
    console.warn("Offline prefetch failed:", e);
  }
}
