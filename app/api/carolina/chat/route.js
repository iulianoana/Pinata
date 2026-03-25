import { createClient } from "@supabase/supabase-js";
import { getProvider } from "../../../../lib/ai/provider.js";
import { getUserModel } from "../../../../lib/ai/get-user-model.js";

function getSupabase(req) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

function buildSystemPrompt(mode, lessonContent) {
  const identity = `You are Carolina, a friendly and patient Spanish tutor. You are helping a beginner (A1-A2 level) student named Iulian who is taking an online Spanish course called "From Zero to Spanish Hero 2.0".

Your personality:
- Warm, encouraging, and patient
- You speak primarily in Spanish but switch to English for complex grammar explanations
- You correct mistakes inline: show the error with strikethrough and the correction, then briefly explain why
- Keep corrections concise — just fix it and give a one-line explanation, no lengthy grammar lectures
- Use the student's lesson materials to stay relevant to what they've learned so far
- Celebrate progress genuinely but don't be over-the-top`;

  const modeInstructions = {
    essay: `MODE: ESSAY PRACTICE
- Give the student a short writing prompt related to their lesson materials (2-4 sentences expected)
- After they write, correct any errors inline and give brief feedback
- Suggest one improved version of their text
- Then give a new prompt that builds on the same topic or grammar point
- Keep prompts achievable for A1-A2 level`,

    grammar: `MODE: GRAMMAR Q&A
- Answer the student's grammar questions clearly and concisely
- Use examples from their lesson materials when possible
- If they ask something not covered in their lessons, still answer but note it's beyond their current material
- Use simple tables or lists for conjugation patterns
- Always include 2-3 example sentences`,

    vocab: `MODE: VOCABULARY DRILL
- Present vocabulary words from the student's lesson materials
- For each word: give the Spanish word, ask them to use it in a sentence
- Correct their usage and provide a model sentence
- Group words thematically
- After 5-6 words, do a quick review round`,

    conversation: `MODE: FREE CONVERSATION
- Have a natural conversation in Spanish
- Adjust your level to match the student — use vocabulary and grammar from their lessons
- If they make errors, correct them inline but keep the conversation flowing
- Occasionally introduce new vocabulary naturally and explain it
- Ask follow-up questions to keep the conversation going`,
  };

  const lessonContext =
    lessonContent.length > 0
      ? `\n\nLESSON MATERIALS (reference these when relevant):\n\n${lessonContent.join("\n\n---\n\n")}`
      : "";

  return `${identity}\n\n${modeInstructions[mode] || modeInstructions.conversation}${lessonContext}`;
}

export async function POST(req) {
  const supabase = getSupabase(req);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId, message, mode, resources } = await req.json();
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
  const systemPrompt = buildSystemPrompt(session.mode || mode || "conversation", lessonContent);
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
