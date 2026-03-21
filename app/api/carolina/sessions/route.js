import { createClient } from "@supabase/supabase-js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// List chat sessions
export async function GET(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const starred = url.searchParams.get("starred");

  let query = supabase
    .from("chat_sessions")
    .select("id, title, mode, starred, resources, model, started_at, updated_at")
    .eq("type", "chat")
    .order("updated_at", { ascending: false });

  if (starred === "true") {
    query = query.eq("starred", true);
  }

  const { data: sessions, error } = await query;
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Fetch last message preview for each session
  const sessionIds = sessions.map((s) => s.id);
  let previews = {};

  if (sessionIds.length > 0) {
    // Get the latest message for each session using a single query
    const { data: lastMessages } = await supabase
      .from("chat_messages")
      .select("session_id, content, role, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: false });

    if (lastMessages) {
      for (const msg of lastMessages) {
        if (!previews[msg.session_id]) {
          previews[msg.session_id] = {
            content: msg.content.substring(0, 100),
            role: msg.role,
          };
        }
      }
    }
  }

  const result = sessions.map((s) => ({
    ...s,
    last_message: previews[s.id] || null,
  }));

  return Response.json(result);
}

// Create a new chat session
export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { mode, resources } = await req.json();

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: user.id,
      type: "chat",
      mode: mode || "conversation",
      resources: resources || null,
      model: "claude-sonnet-4-6",
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data, { status: 201 });
}

// Update a session (star/unstar, rename)
export async function PATCH(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, starred, title } = await req.json();
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const updates = {};
  if (starred !== undefined) updates.starred = starred;
  if (title !== undefined) updates.title = title;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("chat_sessions")
    .update(updates)
    .eq("id", id)
    .eq("type", "chat")
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") return Response.json({ error: "Session not found" }, { status: 404 });
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json(data);
}

// Delete a session
export async function DELETE(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", id)
    .eq("type", "chat");

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
