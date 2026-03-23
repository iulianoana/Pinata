import { supabase } from "./supabase.js";
import {
  cacheWeeks, getCachedWeeks,
  cacheLessons, getCachedLessons, cacheLesson, getCachedLesson,
  cacheQuizzes, getCachedQuizzes,
} from "./offline-cache.js";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
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
  const { data: { session } } = await supabase.auth.getSession();
  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.open("PUT", `/api/lessons/${lessonId}/pdf`);
    xhr.setRequestHeader("Authorization", `Bearer ${session?.access_token}`);
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
