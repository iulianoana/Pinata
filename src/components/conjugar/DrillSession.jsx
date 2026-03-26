import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { fetchDrillPacks, saveAttempt } from "@/lib/conjugar/api";
import { checkExercise, buildSession } from "@/lib/conjugar/validation";
import { SPANISH_TENSES } from "@/lib/conjugar/constants";
import { C } from "../../styles/theme";
import ClassicTableExercise from "./exercises/ClassicTableExercise";
import GapFillExercise from "./exercises/GapFillExercise";
import SpotErrorExercise from "./exercises/SpotErrorExercise";
import MultipleChoiceExercise from "./exercises/MultipleChoiceExercise";
import ChatBubbleExercise from "./exercises/ChatBubbleExercise";
import OddOneOutExercise from "./exercises/OddOneOutExercise";
import ConjugationChainExercise from "./exercises/ConjugationChainExercise";
import MiniStoryExercise from "./exercises/MiniStoryExercise";

const STORAGE_KEY = "pinata_drill_session";

function saveSessionToStorage(packIds, exercises, currentIndex, answers, feedbacks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      packIds: [...packIds].sort(),
      exercises,
      currentIndex,
      answers,
      feedbacks,
      savedAt: new Date().toISOString(),
    }));
  } catch { /* quota exceeded — ignore */ }
}

function loadSessionFromStorage(packIds) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // Match pack IDs (order-independent)
    if (JSON.stringify([...packIds].sort()) !== JSON.stringify(saved.packIds)) return null;
    if (!saved.exercises?.length) return null;
    return saved;
  } catch { return null; }
}

export function clearDrillSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function getSavedDrillSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved.exercises?.length || !saved.packIds?.length) return null;
    return saved;
  } catch { return null; }
}

export default function DrillSession({ packIds }) {
  const navigate = useNavigate();
  const chainRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [feedbacks, setFeedbacks] = useState({});
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load packs and build session — or restore from localStorage
  useEffect(() => {
    let cancelled = false;

    // Try restoring a saved session first
    const saved = loadSessionFromStorage(packIds);
    if (saved) {
      setExercises(saved.exercises);
      setCurrentIndex(saved.currentIndex || 0);
      setAnswers(saved.answers || {});
      setFeedbacks(saved.feedbacks || {});
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const { packs } = await fetchDrillPacks(packIds);
        if (cancelled) return;
        if (!packs || packs.length === 0) {
          setError("No se encontraron paquetes");
          return;
        }
        const built = buildSession(packs);
        setExercises(built);
        // Save initial state
        saveSessionToStorage(packIds, built, 0, {}, {});
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [packIds]);

  // Persist session state to localStorage on every meaningful change
  useEffect(() => {
    if (exercises.length > 0) {
      saveSessionToStorage(packIds, exercises, currentIndex, answers, feedbacks);
    }
  }, [packIds, exercises, currentIndex, answers, feedbacks]);

  const current = exercises[currentIndex];
  const currentFeedback = current ? feedbacks[current.id] : null;
  const isLast = currentIndex === exercises.length - 1;
  const isChain = current?.type === "conjugation_chain";
  const chainDone = isChain && !!feedbacks[current?.id];

  // ── Answer handler ──
  const handleAnswer = useCallback(
    (val) => {
      if (!current) return;
      setAnswers((prev) => ({ ...prev, [current.id]: val }));
    },
    [current]
  );

  // ── Finish drill ──
  const finishDrill = useCallback(
    async (allFeedbacks) => {
      setSubmitting(true);
      const score = exercises.filter((ex) => allFeedbacks[ex.id]?.correct).length;
      const total = exercises.length;
      const percentage = Math.round((score / total) * 100);

      // Build per-verb-tense breakdown
      const grouped = {};
      for (const ex of exercises) {
        const key = `${ex._verbId}__${ex._tense}`;
        if (!grouped[key]) {
          grouped[key] = { verb_id: ex._verbId, verb: ex._verb, tense: ex._tense, correct: 0, total: 0 };
        }
        grouped[key].total++;
        if (allFeedbacks[ex.id]?.correct) grouped[key].correct++;
      }
      const details = Object.values(grouped);

      try {
        await saveAttempt({ packIds, score, total, details });
      } catch {
        // Continue to results even if save fails
      }
      clearDrillSession();
      navigate("/conjugar/results", {
        state: { score, total, percentage, packIds, details },
      });
    },
    [exercises, packIds, navigate]
  );

  // ── Check handler ──
  const handleCheck = useCallback(() => {
    if (!current || currentFeedback) return;

    // For conjugation chain, delegate to the component
    if (isChain && !chainDone) {
      chainRef.current?.check();
      return;
    }

    const answer = answers[current.id];
    const result = checkExercise(current, answer);
    const newFeedbacks = { ...feedbacks, [current.id]: result };
    setFeedbacks(newFeedbacks);

    setTimeout(() => {
      if (isLast) {
        finishDrill(newFeedbacks);
      } else {
        setCurrentIndex((prev) => prev + 1);
      }
    }, 500);
  }, [current, currentFeedback, isChain, chainDone, answers, feedbacks, isLast, finishDrill]);

  // ── Chain completion handler ──
  const handleChainComplete = useCallback(
    (chainAnswers) => {
      if (!current) return;
      const result = checkExercise(current, chainAnswers);
      const newFeedbacks = { ...feedbacks, [current.id]: result };
      setFeedbacks(newFeedbacks);
      setAnswers((prev) => ({ ...prev, [current.id]: chainAnswers }));

      setTimeout(() => {
        if (isLast) {
          finishDrill(newFeedbacks);
        } else {
          setCurrentIndex((prev) => prev + 1);
        }
      }, 800);
    },
    [current, feedbacks, isLast, finishDrill]
  );

  // ── Skip handler ──
  const handleSkip = useCallback(() => {
    if (!current) return;
    const newFeedbacks = { ...feedbacks, [current.id]: { correct: false, skipped: true } };
    setFeedbacks(newFeedbacks);
    if (isLast) {
      finishDrill(newFeedbacks);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [current, feedbacks, isLast, finishDrill]);

  // ── Keyboard: Enter to check ──
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Enter" && !e.shiftKey && !isChain) {
        e.preventDefault();
        handleCheck();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleCheck, isChain]);

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-center">
          <div className="text-3xl mb-3">📝</div>
          <p className="text-sm font-semibold text-gray-500">Cargando ejercicios...</p>
        </div>
      </div>
    );
  }

  if (error || exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="text-red-500 font-semibold mb-4">{error || "No hay ejercicios"}</p>
        <button
          onClick={() => navigate("/conjugar")}
          className="px-6 py-3 rounded-xl font-bold text-white"
          style={{ background: C.accent }}
        >
          Volver
        </button>
      </div>
    );
  }

  // ── Exercise renderer ──
  const renderExercise = () => {
    const props = {
      exercise: current,
      onAnswer: handleAnswer,
      feedback: currentFeedback,
      answer: answers[current.id],
    };

    switch (current.type) {
      case "classic_table":
        return <ClassicTableExercise {...props} />;
      case "gap_fill":
        return <GapFillExercise {...props} />;
      case "spot_error":
        return <SpotErrorExercise {...props} />;
      case "multiple_choice":
        return <MultipleChoiceExercise {...props} />;
      case "chat_bubble":
        return <ChatBubbleExercise {...props} />;
      case "odd_one_out":
        return <OddOneOutExercise {...props} />;
      case "conjugation_chain":
        return (
          <ConjugationChainExercise
            ref={chainRef}
            exercise={current}
            onAnswer={handleAnswer}
            onComplete={handleChainComplete}
          />
        );
      case "mini_story":
        return <MiniStoryExercise {...props} />;
      default:
        return <p className="text-gray-500">Tipo desconocido: {current.type}</p>;
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-white">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <button
          onClick={() => setShowExitConfirm(true)}
          className="text-sm font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <span>‹</span> Salir del drill
        </button>
        <span className="text-sm font-bold" style={{ color: C.accent }}>
          {currentIndex + 1} de {exercises.length}
        </span>
      </div>

      {/* ── Progress bar ── */}
      <div className="flex gap-1 px-4 pb-4 shrink-0">
        {exercises.map((ex, i) => (
          <div
            key={ex.id}
            className={cn(
              "flex-1 h-1.5 rounded-full transition-colors duration-300",
              feedbacks[ex.id]?.correct
                ? "bg-green-500"
                : feedbacks[ex.id]
                  ? "bg-red-400"
                  : i === currentIndex
                    ? "bg-green-300"
                    : "bg-gray-200"
            )}
          />
        ))}
      </div>

      {/* ── Exercise area ── */}
      <div className="flex-1 overflow-auto px-4 py-6">
        {renderExercise()}
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex items-center justify-center gap-3 px-4 py-4 border-t border-gray-100 shrink-0 safe-bottom">
        {currentIndex > 0 && (
          <button
            onClick={() => setCurrentIndex((prev) => prev - 1)}
            disabled={submitting}
            className="px-5 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            ← Atrás
          </button>
        )}
        {!currentFeedback && (
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="px-5 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Saltar →
          </button>
        )}
        {currentFeedback ? (
          <button
            onClick={() => {
              if (isLast) {
                finishDrill(feedbacks);
              } else {
                setCurrentIndex((prev) => prev + 1);
              }
            }}
            disabled={submitting}
            className="px-7 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-colors"
            style={{ background: C.accent }}
          >
            {submitting ? "Guardando..." : isLast ? "Terminar" : "Siguiente →"}
          </button>
        ) : (
          <button
            onClick={handleCheck}
            disabled={submitting}
            className="px-7 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-colors"
            style={{ background: C.accent }}
          >
            {submitting ? "Guardando..." : isLast ? "Terminar" : "Comprobar"}
          </button>
        )}
      </div>

      {/* ── Exit confirmation ── */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">¿Salir del drill?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Tu progreso se guardará y podrás continuar después.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 text-sm font-bold text-gray-600"
              >
                Continuar
              </button>
              <button
                onClick={() => navigate("/conjugar")}
                className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "#DC2626" }}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
