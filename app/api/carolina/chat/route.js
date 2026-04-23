import { createClient } from "@supabase/supabase-js";
import { getProvider } from "../../../../lib/ai/provider.js";
import { getUserModel } from "../../../../lib/ai/get-user-model.js";
import { loadPrompt } from "../../../../lib/ai/prompts/load-prompt.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

async function buildSystemPrompt(mode, lessonContent, options = {}) {
  const validModes = ["essay", "grammar", "vocab", "conversation"];
  const safeMode = validModes.includes(mode) ? mode : "conversation";
  const identity = await loadPrompt("carolina/carolina-identity", {}, options);
  const modePrompt = await loadPrompt(`carolina/carolina-text/carolina-mode-${safeMode}`, {}, options);
  const lessonCtx =
    lessonContent.length > 0
      ? "\n\n" + await loadPrompt("carolina/carolina-text/carolina-lesson-context", { lessonContent: lessonContent.join("\n\n---\n\n") }, options)
      : "";
  return `${identity}\n\n${modePrompt}${lessonCtx}`;
}

export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, message, mode, resources, openingMessage } = await req.json();
  if (!message || typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  // Get user's model preference
  const { model_id, provider } = await getUserModel(supabase, user.id, "carolina_chat");
  const ai = getProvider(provider);

  let activeSessionId = sessionId;

  // Create a new session if none provided
  if (!activeSessionId) {
    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        type: "chat",
        mode: mode || "conversation",
        resources: resources || null,
        model: model_id,
      })
      .select("id")
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    activeSessionId = session.id;

    // Seed the mode's opening assistant message if the client shown one locally.
    // Keeps conversation context complete and matches what the user saw.
    if (openingMessage && typeof openingMessage === "string" && openingMessage.trim()) {
      await supabase
        .from("chat_messages")
        .insert({ session_id: activeSessionId, role: "assistant", content: openingMessage });
    }
  }

  // Verify session belongs to user
  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id, mode, resources")
    .eq("id", activeSessionId)
    .eq("type", "chat")
    .single();

  if (sessionError || !session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  // Save user message
  const { error: insertError } = await supabase
    .from("chat_messages")
    .insert({ session_id: activeSessionId, role: "user", content: message.trim() });

  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  // Load conversation history
  const { data: messages, error: msgError } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", activeSessionId)
    .order("created_at", { ascending: true });

  if (msgError) return Response.json({ error: msgError.message }, { status: 500 });

  // Load attached resources (lesson content)
  const lessonContent = [];
  const sessionResources = session.resources || resources || [];

  if (Array.isArray(sessionResources)) {
    for (const res of sessionResources) {
      if (res.type === "lesson") {
        const { data: lesson } = await supabase
          .from("lessons")
          .select("title, markdown_content")
          .eq("id", res.id)
          .single();
        if (lesson) {
          lessonContent.push(`## ${lesson.title}\n\n${lesson.markdown_content}`);
        }
      } else if (res.type === "week") {
        const { data: lessons } = await supabase
          .from("lessons")
          .select("title, markdown_content")
          .eq("week_id", res.id)
          .order("sort_order", { ascending: true });
        if (lessons) {
          for (const l of lessons) {
            lessonContent.push(`## ${l.title}\n\n${l.markdown_content}`);
          }
        }
      }
    }
  }

  // Build system prompt and stream response
  const promptOpts = { supabase, userId: user.id };
  const systemPrompt = await buildSystemPrompt(session.mode || mode || "conversation", lessonContent, promptOpts);
  const conversationHistory = messages.map((m) => ({ role: m.role, content: m.content }));

  const encoder = new TextEncoder();
  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "session", sessionId: activeSessionId })}\n\n`)
        );

        const iterator = ai.streamChat({
          model: model_id,
          system: systemPrompt,
          messages: conversationHistory,
          maxTokens: 4096,
        });

        for await (const text of iterator) {
          fullResponse += text;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "delta", text })}\n\n`)
          );
        }

        // Save assistant message
        await supabase
          .from("chat_messages")
          .insert({ session_id: activeSessionId, role: "assistant", content: fullResponse });

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
        controller.close();
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
