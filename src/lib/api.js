import { supabase } from "./supabase.js";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchWeeks() {
  const headers = await authHeaders();
  const res = await fetch("/api/weeks", { headers });
  if (!res.ok) throw new Error("Failed to fetch weeks");
  return res.json();
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

export async function fetchLessons(weekId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/lessons?week_id=${weekId}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch lessons");
  return res.json();
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
