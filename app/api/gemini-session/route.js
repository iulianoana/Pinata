import { createClient } from "@supabase/supabase-js";
import { buildSystemInstruction } from "./prompt.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

export async function POST(req) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Gemini not configured" }, { status: 500 });
  }

  try {
    const supabase = getSupabase(req);
    let promptOpts = {};

    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        promptOpts = { supabase, userId: user.id };
      }
    }

    const { unitContext } = await req.json();
    const systemInstruction = await buildSystemInstruction(unitContext || null, promptOpts);

    return Response.json({
      apiKey,
      // The 12-2025 native-audio preview has a documented regression that closes
      // the WebSocket with 1008 "Operation is not implemented, or supported, or
      // enabled" mid-session. Pinned to the 09-2025 build until Google ships a fix.
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      systemInstruction,
    });
  } catch (e) {
    return Response.json({ error: "Failed to create session" }, { status: 500 });
  }
}
