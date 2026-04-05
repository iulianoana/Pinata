import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase.js";
import {
  cacheVerbs,
  getCachedVerbs,
  cacheDrillPacks,
  getCachedDrillPacksByIds,
  getCachedDrillPacksByVerb,
  getCachedDrillPacksByVerbs,
} from "../offline-cache.js";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
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

// ── Create verbs ──
export async function createVerbs(infinitives) {
  const headers = await authHeaders();
  const res = await fetch("/api/conjugar/verbs", {
    method: "POST",
    headers,
    body: JSON.stringify({ infinitives }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to create verbs");
  }
  return res.json();
}

// ── Generate packs ──
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
  // Cache freshly generated packs so they're immediately available offline.
  if (json.packs) cacheDrillPacks(json.packs).catch(() => {});
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

// ── Save attempt ──
export async function saveAttempt(data) {
  const headers = await authHeaders();
  const res = await fetch("/api/conjugar/attempts", {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to save attempt");
  }
  return res.json();
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
