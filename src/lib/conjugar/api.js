import { useState, useEffect, useCallback } from "react";
import { getCachedSession } from "../supabase.js";
import { enqueue } from "../syncQueue.js";
import { calculateGrade } from "./constants.js";
import {
  cacheVerbs,
  getCachedVerbs,
  cacheDrillPacks,
  getCachedDrillPacksByIds,
  getCachedDrillPacksByVerb,
  getCachedDrillPacksByVerbs,
} from "../offline-cache.js";

async function authHeaders() {
  // Read the session from localStorage directly. Calling supabase.auth.getSession()
  // here blocks up to 30s per call when offline with an expired access token
  // (it retries the refresh endpoint and serializes behind the auto-refresh lock).
  // Supabase's auto-refresh ticker keeps this cached value fresh while online.
  const session = getCachedSession();
  return {
    Authorization: `Bearer ${session?.access_token || ""}`,
    "Content-Type": "application/json",
  };
}

// ── Fetch all verbs with pack stats (network-first, cache fallback) ──
export async function fetchVerbs() {
  try {
    const headers = await authHeaders();
    const res = await fetch("/api/conjugar/verbs", { headers });
    if (!res.ok) throw new Error("Failed to fetch verbs");
    const json = await res.json();
    const verbs = json.verbs || [];
    cacheVerbs(verbs).catch(() => {});
    return verbs;
  } catch (e) {
    const cached = await getCachedVerbs();
    if (cached.length > 0) return cached;
    throw e;
  }
}

// ── Hook: verbs list ──
export function useVerbs() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    try {
      setIsLoading(true);
      const verbs = await fetchVerbs();
      setData(verbs);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { data, isLoading, error, refresh: fetch_ };
}

// ── Generate packs for existing verbs (add another tense) ──
export async function generatePacks(verbIds, tense) {
  const headers = await authHeaders();
  const res = await fetch("/api/conjugar/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({ verbIds, tense }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to generate packs");
  }
  const json = await res.json();
  if (json.packs) cacheDrillPacks(json.packs).catch(() => {});
  return json;
}

// ── Atomic: create verbs AND generate packs in a single call.
// Returns { created: [{infinitive, verb, pack, skipped?}], failed: [{infinitive, error}] }.
// Verbs only land in the DB when AI generation succeeds — no orphans.
export async function generateVerbsWithPacks(infinitives, tense) {
  const headers = await authHeaders();
  const res = await fetch("/api/conjugar/generate-batch", {
    method: "POST",
    headers,
    body: JSON.stringify({ infinitives, tense }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate exercises");
  }
  const json = await res.json();
  const packs = (json.created || []).map((c) => c.pack).filter(Boolean);
  if (packs.length > 0) cacheDrillPacks(packs).catch(() => {});
  return json;
}

// ── Fetch packs for a verb (network-first, cache fallback) ──
export async function fetchPacks(verbId) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/conjugar/packs?verbId=${verbId}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch packs");
    const json = await res.json();
    if (json.packs) cacheDrillPacks(json.packs).catch(() => {});
    return json;
  } catch (e) {
    const cached = await getCachedDrillPacksByVerb(verbId);
    if (cached.length > 0) return { packs: cached };
    throw e;
  }
}

// ── Fetch packs by multiple verb IDs ──
export async function fetchPacksByIds(verbIds) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/conjugar/packs?verbIds=${verbIds.join(",")}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch packs");
    const json = await res.json();
    if (json.packs) cacheDrillPacks(json.packs).catch(() => {});
    return json;
  } catch (e) {
    const cached = await getCachedDrillPacksByVerbs(verbIds);
    if (cached.length > 0) return { packs: cached };
    throw e;
  }
}

// ── Fetch packs by pack IDs (for drill sessions) ──
export async function fetchDrillPacks(packIds) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`/api/conjugar/packs?packIds=${packIds.join(",")}`, { headers });
    if (!res.ok) throw new Error("Failed to fetch drill packs");
    const json = await res.json();
    if (json.packs) cacheDrillPacks(json.packs).catch(() => {});
    return json;
  } catch (e) {
    const cached = await getCachedDrillPacksByIds(packIds);
    if (cached.length > 0) return { packs: cached };
    throw e;
  }
}

// ── Translate a verb (lazy backfill for pre-existing verbs without translation_en) ──
export async function translateVerb(verbId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/conjugar/verbs/${verbId}/translate`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to translate verb");
  }
  return res.json();
}

// ── Regenerate a pack ──
export async function regeneratePack(packId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/conjugar/packs/${packId}/regenerate`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to regenerate pack");
  }
  const json = await res.json();
  if (json.pack) cacheDrillPacks([json.pack]).catch(() => {});
  else if (json.packs) cacheDrillPacks(json.packs).catch(() => {});
  return json;
}

// ── Save attempt (network-first, queue on offline) ──
export async function saveAttempt(data) {
  let networkFailure = false;
  try {
    const headers = await authHeaders();
    let res;
    try {
      res = await fetch("/api/conjugar/attempts", {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
    } catch (fetchErr) {
      // fetch() only rejects on network failure (offline, DNS, CORS, abort).
      // HTTP status errors come back as a resolved Response with ok=false.
      networkFailure = true;
      throw fetchErr;
    }
    if (!res.ok) {
      // Server responded but rejected the write. Don't queue — a direct Supabase
      // insert will almost certainly fail the same way and ghost in the queue.
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to save attempt (HTTP ${res.status})`);
    }
    return res.json();
  } catch (e) {
    if (!networkFailure) throw e;

    // True network failure — queue a direct Supabase insert for later sync.
    // RLS on drill_attempts requires user_id = auth.uid(); read user_id from cached session.
    const session = getCachedSession();
    const userId = session?.user?.id;
    if (!userId) throw e;

    const percentage = Math.round((data.score / data.total) * 100);
    const grade = calculateGrade(percentage);
    enqueue({
      table: "drill_attempts",
      method: "insert",
      payload: {
        user_id: userId,
        pack_ids: data.packIds,
        score: data.score,
        total: data.total,
        percentage,
        grade,
        details: data.details,
      },
    });
    return { queued: true };
  }
}

// ── Hook for a single pack detail (network-first, cache fallback) ──
export function usePack(verbId, tense) {
  const [pack, setPack] = useState(null);
  const [verb, setVerb] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    if (!verbId || !tense) return;
    try {
      setIsLoading(true);

      // These helpers internally fall back to IndexedDB when offline.
      const [verbs, packsJson] = await Promise.all([
        fetchVerbs(),
        fetchPacks(verbId),
      ]);

      const foundVerb = verbs?.find((v) => v.id === verbId);
      const foundPack = packsJson.packs?.find((p) => p.tense === tense);

      setVerb(foundVerb || null);
      setPack(foundPack || null);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [verbId, tense]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { pack, verb, isLoading, error, refresh: fetch_ };
}
