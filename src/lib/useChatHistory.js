import { useRef } from "react";
import { supabase } from "./supabase";

export function useChatHistory() {
  const sessionIdRef = useRef(null);

  const startChatSession = async (userId, unitName) => {
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: userId,
        unit_name: unitName || "Free conversation",
        transcript: [],
        turn_count: 0,
        duration_seconds: 0,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[ChatHistory] Failed to create session:", error);
      return null;
    }
    sessionIdRef.current = data.id;
    return data.id;
  };

  const saveTranscript = async (transcript, turnCount) => {
    if (!sessionIdRef.current) return;
    const { error } = await supabase
      .from("chat_sessions")
      .update({ transcript, turn_count: turnCount })
      .eq("id", sessionIdRef.current);

    if (error) console.error("[ChatHistory] Failed to save transcript:", error);
  };

  const endChatSession = async (durationSeconds, transcript, turnCount) => {
    if (!sessionIdRef.current) return;
    const { error } = await supabase
      .from("chat_sessions")
      .update({ duration_seconds: durationSeconds, transcript, turn_count: turnCount })
      .eq("id", sessionIdRef.current);

    if (error) console.error("[ChatHistory] Failed to end session:", error);
    sessionIdRef.current = null;
  };

  const getHistory = async (userId, limit = 50) => {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("id, unit_name, started_at, duration_seconds, turn_count")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[ChatHistory] Failed to fetch history:", error);
      return [];
    }
    return data;
  };

  const getSession = async (sessionId) => {
    const { data, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (error) {
      console.error("[ChatHistory] Failed to fetch session:", error);
      return null;
    }
    return data;
  };

  return { startChatSession, saveTranscript, endChatSession, getHistory, getSession };
}
