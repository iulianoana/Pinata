import { useState, useEffect, useCallback } from "react";
import { saveAttempt as dbSave, getAttempts, deleteAttempt as dbDelete } from "./db.js";
import { supabase } from "./lib/supabase.js";
import { cacheQuizData, getCachedQuizData } from "./lib/offline-cache.js";

export function useQuizHistory(session) {
  const [attempts, setAttempts] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;

  const refresh = useCallback(() => {
    setLoading(true);

    const attemptsP = getAttempts(50);

    const quizzesP = userId
      ? supabase
          .from("quizzes")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .then(({ data, error }) => {
            if (error) {
              console.warn("Failed to fetch quizzes:", error);
              return [];
            }
            return (data || []).map((row) => ({
              id: row.id,
              data: row.quiz_data,
              savedAt: new Date(row.created_at).getTime(),
            }));
          })
      : Promise.resolve([]);

    Promise.all([attemptsP, quizzesP]).then(([a, q]) => {
      setAttempts(a);
      setQuizzes(q);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const saveAttempt = useCallback(async (record) => {
    const id = await dbSave(record);
    if (id != null) {
      setAttempts((prev) => [{ ...record, id }, ...prev]);
    }
  }, []);

  const deleteAttempt = useCallback(async (id) => {
    await dbDelete(id);
    setAttempts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const saveQuiz = useCallback(async (data) => {
    const title = data.meta?.title || "Untitled Quiz";
    const unit = data.meta?.unit ?? null;
    const questionCount = data.questions?.length ?? 0;

    if (!userId) return null;

    // Resolve week_id from unit_number
    let weekId = null;
    if (unit != null) {
      const { data: weekData } = await supabase
        .from("weeks")
        .select("id")
        .eq("user_id", userId)
        .eq("week_number", unit)
        .single();
      if (weekData) weekId = weekData.id;
    }

    // Fallback to first week
    if (!weekId) {
      const { data: firstWeek } = await supabase
        .from("weeks")
        .select("id")
        .eq("user_id", userId)
        .order("week_number", { ascending: true })
        .limit(1)
        .single();
      if (firstWeek) weekId = firstWeek.id;
    }

    if (!weekId) {
      console.warn("No weeks found for user");
      return null;
    }

    const row = {
      user_id: userId,
      title,
      week_id: weekId,
      question_count: questionCount,
      quiz_data: data,
      source: "upload",
    };

    const { data: inserted, error } = await supabase
      .from("quizzes")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.warn("Failed to save quiz:", error);
      return null;
    }

    const id = inserted.id;
    setQuizzes((prev) => {
      const filtered = prev.filter((q) => q.id !== id);
      return [{ id, data, savedAt: Date.now() }, ...filtered];
    });
    return id;
  }, [userId]);

  const deleteQuiz = useCallback(async (id) => {
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) console.warn("Failed to delete quiz:", error);
    setQuizzes((prev) => prev.filter((q) => q.id !== id));
  }, []);

  return { attempts, quizzes, loading, saveAttempt, deleteAttempt, saveQuiz, deleteQuiz, refresh };
}

/** Fetch a single quiz by UUID. */
export async function getQuizBySupabaseId(id) {
  try {
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      const cached = await getCachedQuizData(id);
      return cached;
    }

    cacheQuizData(id, data.quiz_data).catch(() => {});
    return { id: data.id, data: data.quiz_data };
  } catch {
    return getCachedQuizData(id);
  }
}
