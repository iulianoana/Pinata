import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Reads the auth session directly from localStorage, bypassing Supabase's
// refresh-token logic. Use this when we need the session quickly — e.g. offline,
// where supabase.auth.getSession() blocks for up to 30s retrying the refresh
// endpoint (AUTO_REFRESH_TICK_DURATION_MS) when the access token is within its
// 90s expiry margin. Supabase writes the session to this key on sign-in and
// after every auto-refresh, so the cached value stays current while online.
export function getCachedSession() {
  try {
    if (typeof localStorage === "undefined") return null;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    const projectRef = new URL(url).hostname.split(".")[0];
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.access_token && parsed.refresh_token ? parsed : null;
  } catch {
    return null;
  }
}
