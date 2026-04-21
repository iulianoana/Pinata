import { supabase, getCachedSession } from "./supabase.js";
import {
  cacheWeeks, getCachedWeeks,
  cacheLessons, getCachedLessons, cacheLesson, getCachedLesson,
  cacheQuizzes, getCachedQuizzes,
  cacheAssignments, getCachedAssignments, cacheAssignmentBrief,
} from "./offline-cache.js";

async function authHeaders() {
  // Read the session from localStorage directly. Calling
  // supabase.auth.getSession() here would block for up to 30s per API call
  // when offline with an expired token (it retries the refresh endpoint).
  // Supabase's auto-refresh ticker keeps the cached session fresh while online.
  const session = getCachedSession();
  return {
    Authorization: `Bearer ${session?.access_token || ""}`,
    "Content-Type": "application/json",
  };
}

export async function fetchWeeks() {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/weeks", { headers });
    if (!res.ok) throw new Error("Failed to fetch weeks");
    const data = await res.json();
    cacheWeeks(data).catch(() => {});
    return data;
  } catch (e) {
    const cached = await getCachedWeeks();
    if (cached.length > 0) return cached;
    throw e;
  }
}

export async function createWeek(week_number, title) {
  const headers = await authHeaders();
  const res = await fetch("/api/weeks", {
    method: "POST",
    headers,
    body: JSON.stringify({ week_number, title }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to create week");
  }
  return res.json();
}

export async function deleteWeek(weekId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/weeks/${weekId}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete week");
  return res.json();
}

export async function fetchLesson(lessonId) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/lessons/${lessonId}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch lesson");
    const data = await res.json();
    cacheLesson(data).catch(() => {});
    return data;
  } catch (e) {
    const cached = await getCachedLesson(lessonId);
    if (cached) return cached;
    throw e;
  }
}

export async function fetchLessons(weekId) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/lessons?week_id=${weekId}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch lessons");
    const data = await res.json();
    cacheLessons(data).catch(() => {});
    return data;
  } catch (e) {
    const cached = await getCachedLessons(weekId);
    if (cached.length > 0) return cached;
    throw e;
  }
}

export async function createLesson(week_id, title, markdown_content) {
  const headers = await authHeaders();
  const res = await fetch("/api/lessons", {
    method: "POST",
    headers,
    body: JSON.stringify({ week_id, title, markdown_content }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to create lesson");
  }
  return res.json();
}

export async function updateLesson(lessonId, fields) {
  const headers = await authHeaders();
  const res = await fetch(`/api/lessons/${lessonId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to update lesson");
  }
  return res.json();
}

export async function deleteLesson(lessonId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete lesson");
  return res.json();
}

export async function reorderLessons(updates) {
  const headers = await authHeaders();
  const res = await fetch("/api/lessons/reorder", {
    method: "PATCH",
    headers,
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error("Failed to reorder lessons");
  return res.json();
}

export async function searchLessons(query) {
  const headers = await authHeaders();
  const res = await fetch(`/api/lessons/search?q=${encodeURIComponent(query)}`, { headers });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

// ── PDF ──

const COMPRESS_SERVICE_URL = process.env.NEXT_PUBLIC_COMPRESS_SERVICE_URL;
const MAX_DIRECT_UPLOAD_SIZE = 10 * 1024 * 1024;

async function compressAndUploadPdf(lessonId, file, onProgress, onPhase) {
  const headers = await authHeaders();

  // 1. Get compression token
  onPhase?.("token");
  const tokenRes = await fetch("/api/compress-token", {
    method: "POST",
    headers,
    body: JSON.stringify({ lessonId }),
  });
  if (!tokenRes.ok) throw new Error("Failed to get compression token");
  const { token } = await tokenRes.json();

  // 2. Upload to compression service
  onPhase?.("uploading");
  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${COMPRESS_SERVICE_URL}/compress`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.upload.onload = () => {
      onPhase?.("compressing");
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(JSON.parse(xhr.responseText)?.error || "Compression failed"));
    };
    xhr.onerror = () => reject(new Error("Compression failed"));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });

  // 3. Update lesson metadata
  onPhase?.("saving");
  const patchRes = await fetch(`/api/lessons/${lessonId}/pdf`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      storagePath: result.storagePath,
      originalName: result.originalName,
      compressedSize: result.compressedSize,
    }),
  });
  if (!patchRes.ok) throw new Error("Failed to save PDF metadata");
  return patchRes.json();
}

export async function uploadLessonPdf(lessonId, file, onProgress, onPhase) {
  if (file.size > MAX_DIRECT_UPLOAD_SIZE && COMPRESS_SERVICE_URL) {
    return compressAndUploadPdf(lessonId, file, onProgress, onPhase);
  }

  onPhase?.("uploading");
  const session = getCachedSession();
  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.open("PUT", `/api/lessons/${lessonId}/pdf`);
    xhr.setRequestHeader("Authorization", `Bearer ${session?.access_token || ""}`);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error(JSON.parse(xhr.responseText)?.error || "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

export async function getLessonPdfUrl(lessonId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/lessons/${lessonId}/pdf`, { headers });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Failed to get PDF URL");
  }
  return res.json();
}

export async function deleteLessonPdf(lessonId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/lessons/${lessonId}/pdf`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete PDF");
  return res.json();
}

/** Returns [{ lessonId, updatedAt }] for all PDFs in storage (single call) */
export async function fetchPdfVersions() {
  const headers = await authHeaders();
  const res = await fetch("/api/pdf-versions", { headers });
  if (!res.ok) throw new Error("Failed to fetch PDF versions");
  return res.json();
}

// ── Quiz data (single quiz with quiz_data) ──

export async function fetchQuizData(quizId) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("id, quiz_data")
    .eq("id", quizId)
    .single();
  if (error || !data) return null;
  return data;
}

// ── Quizzes ──

export async function fetchQuizzes(filters = {}) {
  try {
    const headers = await authHeaders();
    const params = new URLSearchParams();
    if (filters.lesson_id) params.set("lesson_id", filters.lesson_id);
    if (filters.week_id) params.set("week_id", filters.week_id);
    const qs = params.toString();
    const res = await fetch(`/api/quizzes${qs ? `?${qs}` : ""}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch quizzes");
    const data = await res.json();
    if (!filters.lesson_id && !filters.week_id) {
      cacheQuizzes(data).catch(() => {});
    }
    return data;
  } catch (e) {
    const cached = await getCachedQuizzes(filters);
    if (cached.length > 0) return cached;
    throw e;
  }
}

export async function createQuiz({ title, description, lesson_id, week_id, quiz_data }) {
  const headers = await authHeaders();
  const res = await fetch("/api/quizzes", {
    method: "POST",
    headers,
    body: JSON.stringify({ title, description, lesson_id, week_id, quiz_data }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to create quiz");
  }
  return res.json();
}

export async function updateQuiz(quizId, updates) {
  const headers = await authHeaders();
  const res = await fetch(`/api/quizzes/${quizId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to update quiz");
  }
  return res.json();
}

export async function deleteQuiz(quizId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/quizzes/${quizId}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete quiz");
  return res.json();
}

// ── Redacción assignments ──

export async function fetchAssignmentsByLesson(lessonId) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/assignments?lesson_id=${encodeURIComponent(lessonId)}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch assignments");
    const data = await res.json();
    // Tag with lesson_id so the Dexie secondary index works.
    const tagged = data.map((a) => ({ ...a, lesson_id: lessonId }));
    cacheAssignments(lessonId, tagged).catch(() => {});
    return tagged;
  } catch (e) {
    const cached = await getCachedAssignments(lessonId);
    if (cached.length > 0) return cached;
    throw e;
  }
}

export async function fetchAssignment(assignmentId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/assignments/${assignmentId}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch assignment");
  }
  return res.json();
}

export async function createAssignment({ lessonId, scope }) {
  const headers = await authHeaders();
  const res = await fetch("/api/assignments", {
    method: "POST",
    headers,
    body: JSON.stringify({ lesson_id: lessonId, scope }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create assignment");
  }
  return res.json();
}

export async function deleteAssignment(assignmentId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/assignments/${assignmentId}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error("Failed to delete assignment");
  return res.json();
}

export async function regenerateAssignment(assignmentId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/assignments/${assignmentId}/regenerate`, { method: "POST", headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to regenerate assignment");
  }
  const updated = await res.json();
  cacheAssignmentBrief(assignmentId, updated).catch(() => {});
  return updated;
}

// Returns { id, version_number, essay, word_count, submitted_at, correction }
// where `correction` is either the saved correction row or null.
export async function fetchOrCreateDraftAttempt(assignmentId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/assignments/${assignmentId}/draft-attempt`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load attempt");
  }
  return res.json();
}

// Idempotent. Returns { attempt, correction }. Safe to call on reload —
// if a correction already exists, the server short-circuits and returns it
// without calling the LLM again.
export async function correctAttempt(attemptId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/attempts/${attemptId}/correct`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to correct attempt");
  }
  return res.json();
}

// Network-only update. Throws on network/HTTP errors so the autosave hook can
// fall back to the offline sync queue. `keepalive` lets the request survive
// page unload (used by the unmount/visibilitychange save paths).
export async function updateAttemptEssay(attemptId, essay, { keepalive = false } = {}) {
  const headers = await authHeaders();
  const res = await fetch(`/api/attempts/${attemptId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ essay }),
    keepalive,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save attempt");
  }
  return res.json();
}

// ── Carolina Resources (weeks + lessons for pickers) ──

export async function fetchCarolinaResources() {
  const headers = await authHeaders();
  const res = await fetch("/api/carolina/resources", { headers });
  if (!res.ok) throw new Error("Failed to fetch resources");
  return res.json();
}

// ── Lesson Links ──

export async function fetchLessonLinks(lessonId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/lessons/${lessonId}/links`, { headers });
  if (!res.ok) throw new Error("Failed to fetch links");
  return res.json();
}

export async function fetchLinkPreview(url) {
  const headers = await authHeaders();
  const res = await fetch("/api/links/preview", {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error("Failed to fetch preview");
  return res.json();
}

export async function createLessonLink(lessonId, link) {
  const headers = await authHeaders();
  const res = await fetch(`/api/lessons/${lessonId}/links`, {
    method: "POST",
    headers,
    body: JSON.stringify(link),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to create link");
  }
  return res.json();
}

export async function deleteLessonLink(lessonId, linkId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/lessons/${lessonId}/links/${linkId}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error("Failed to delete link");
  return res.json();
}

// ── Prompts ──

export async function getPrompts() {
  const headers = await authHeaders();
  const res = await fetch("/api/prompts", { headers });
  if (!res.ok) throw new Error("Failed to fetch prompts");
  const data = await res.json();
  return data.prompts;
}

export async function updatePrompt(id, content) {
  const headers = await authHeaders();
  const res = await fetch(`/api/prompts/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save prompt");
  }
  return res.json();
}

export async function renamePrompt(id, name) {
  const headers = await authHeaders();
  const res = await fetch(`/api/prompts/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to rename prompt");
  }
  return res.json();
}

export async function undoPrompt(id) {
  const headers = await authHeaders();
  const res = await fetch(`/api/prompts/${id}/undo`, {
    method: "PUT",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to undo");
  }
  return res.json();
}

// ── Generate from PDF ──

export async function processLessonPdf(payload) {
  const headers = await authHeaders();
  const res = await fetch("/api/ai/process-lesson", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "AI processing failed");
  }
  return res.json();
}

// ── Instant quiz generation from images/PDFs ──

export async function generateInstantQuiz({ media, specificRequirements, numberOfQuestions, lessonId, weekId, promptSlug }) {
  const headers = await authHeaders();
  const res = await fetch("/api/ai/generate-quiz", {
    method: "POST",
    headers,
    body: JSON.stringify({
      media,
      specificRequirements,
      numberOfQuestions,
      lessonId,
      weekId,
      promptSlug,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Quiz generation failed");
  }
  return res.json();
}
