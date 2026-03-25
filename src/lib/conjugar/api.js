import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase.js";

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${session?.access_token}`,
    "Content-Type": "application/json",
  };
}

// ── Fetch all verbs with pack stats ──
export function useVerbs() {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    try {
      setIsLoading(true);
      const headers = await authHeaders();
      const res = await fetch("/api/conjugar/verbs", { headers });
      if (!res.ok) throw new Error("Failed to fetch verbs");
      const json = await res.json();
      setData(json.verbs || []);
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
  return res.json();
}

// ── Fetch packs for a verb ──
export async function fetchPacks(verbId) {
  const headers = await authHeaders();
  const res = await fetch(`/api/conjugar/packs?verbId=${verbId}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch packs");
  return res.json();
}

// ── Fetch packs by multiple verb IDs ──
export async function fetchPacksByIds(verbIds) {
  const headers = await authHeaders();
  const res = await fetch(`/api/conjugar/packs?verbIds=${verbIds.join(",")}`, { headers });
  if (!res.ok) throw new Error("Failed to fetch packs");
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
  return res.json();
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

// ── Hook for a single pack detail ──
export function usePack(verbId, tense) {
  const [pack, setPack] = useState(null);
  const [verb, setVerb] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    if (!verbId || !tense) return;
    try {
      setIsLoading(true);
      const headers = await authHeaders();

      // Fetch verb info and packs in parallel
      const [verbsRes, packsRes] = await Promise.all([
        fetch("/api/conjugar/verbs", { headers }),
        fetch(`/api/conjugar/packs?verbId=${verbId}`, { headers }),
      ]);

      if (!verbsRes.ok || !packsRes.ok) throw new Error("Failed to fetch data");

      const verbsJson = await verbsRes.json();
      const packsJson = await packsRes.json();

      const foundVerb = verbsJson.verbs?.find((v) => v.id === verbId);
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
