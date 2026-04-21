import { useState, useEffect } from "react";
import { Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import { useQuizHistory } from "./useQuizHistory.js";
import { supabase, getCachedSession } from "./lib/supabase.js";
import { flush, usePendingCount } from "./lib/syncQueue.js";
import { prefetchAll } from "./lib/offline-cache.js";
import { fetchWeeks, fetchLessons, fetchQuizzes } from "./lib/api.js";
import { fetchVerbs, fetchPacksByIds } from "./lib/conjugar/api.js";
import { fetchVocabulary } from "./useVocabulary.js";
import { C } from "./styles/theme";
import LoginScreen from "./screens/LoginScreen";
import QuizzesScreen from "./screens/QuizzesScreen";
import HistoryScreen from "./screens/HistoryScreen";
import QuizRoute from "./screens/QuizRoute";
import ResultsRoute from "./screens/ResultsRoute";
import DialogScreen from "./screens/DialogScreen";
import LessonsScreen from "./screens/LessonsScreen";
import LessonRoute from "./screens/LessonRoute";
import RedaccionAssignmentRoute from "./screens/RedaccionAssignmentRoute";
import CarolinaScreen from "./screens/CarolinaScreen";
import StorageScreen from "./screens/StorageScreen";
import SettingsScreen from "./screens/SettingsScreen";
import VocabularyScreen from "./screens/VocabularyScreen";
import PromptsScreen from "./screens/PromptsScreen";
import ConjugarScreen from "./screens/ConjugarScreen";
import PackDetailScreen from "./screens/PackDetailScreen";
import ConjugarResultsScreen from "./screens/ConjugarResultsScreen";
import ConjugarDrillScreen from "./screens/ConjugarDrillScreen";
import DesktopSidebar from "./components/DesktopSidebar";
import MobileNavBar from "./components/MobileNavBar";

export default function App() {
  const [session, setSession] = useState(undefined);
  const history = useQuizHistory(session);
  const pendingCount = usePendingCount();
  const location = useLocation();

  const hideNavBar =
    location.pathname.startsWith("/quiz/") && !location.pathname.endsWith("/results") ||
    location.pathname === "/conjugar/drill" ||
    location.pathname === "/carolina" ||
    location.pathname === "/dialog";



  useEffect(() => {
    let cancelled = false;

    // Seed session synchronously from localStorage so we never get stuck on
    // the Loading screen. When offline with an expired access token, supabase
    // .auth.getSession() retries the refresh endpoint for up to 30s before
    // resolving — that's what left users stranded on "Loading..." in flight mode.
    const cached = getCachedSession();
    setSession(cached);

    // Validate/refresh in the background. When online this will hand back a
    // fresh session (or null if signed out). When offline it eventually fails
    // with AuthRetryableFetchError — in that case we keep the cached session.
    supabase.auth.getSession()
      .then(({ data: { session: s }, error }) => {
        if (cancelled) return;
        if (s) { setSession(s); return; }
        // Network failure (offline / Supabase unreachable): keep cached session.
        if (error && error.name === "AuthRetryableFetchError") return;
        // Authoritative null (no stored session, or server rejected refresh).
        setSession(null);
      })
      .catch(() => { /* keep cached session */ });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (cancelled) return;
      // INITIAL_SESSION fires after getSession() resolves — when offline that's
      // a null emitted ~30s later. Ignore it; we've already seeded from cache.
      if (event === "INITIAL_SESSION" && !s) return;
      setSession(s);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  // Sync queue + background offline prefetch.
  // Fires automatically on: mount, back-online, and tab-visible (throttled).
  // No user interaction required — if anything is stale, we grab it.
  useEffect(() => {
    const MIN_PREFETCH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes between auto-syncs
    let prefetchInFlight = false;
    let lastPrefetchAt = 0;
    let prefetchTimer = null;

    const runPrefetch = () => {
      if (prefetchInFlight) return;
      if (!navigator.onLine) return;
      const now = Date.now();
      if (now - lastPrefetchAt < MIN_PREFETCH_INTERVAL_MS) return;
      prefetchInFlight = true;
      prefetchAll(fetchWeeks, fetchLessons, fetchQuizzes, {
        fetchVerbsFn: fetchVerbs,
        fetchPacksByIdsFn: fetchPacksByIds,
        fetchVocabularyFn: fetchVocabulary,
      })
        .catch(() => {})
        .finally(() => {
          prefetchInFlight = false;
          lastPrefetchAt = Date.now();
        });
    };

    // Initial tick — flush queued writes, then kick off a background cache fill.
    // Short defer so we don't contend with the first paint.
    flush().catch(() => {});
    prefetchTimer = setTimeout(runPrefetch, 800);

    const handleOnline = () => {
      flush().catch(() => {});
      runPrefetch();
    };
    const handleVisible = () => {
      if (document.visibilityState !== "visible") return;
      flush().catch(() => {});
      runPrefetch();
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      clearTimeout(prefetchTimer);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, []);

  if (session === undefined) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <div style={{ textAlign: "center" }}>
          <img src="/icons/logo.png" alt="Piñata" style={{ width: 100, height: 100, marginBottom: 12 }} />
          <p style={{ color: C.muted, fontSize: 16, fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {pendingCount > 0 && (
        <div className="safe-top-fixed" style={{
          position: "fixed", top: 6, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          display: "flex", alignItems: "center", gap: 4,
          background: "#FFFBEB", border: "1px solid #F59E0B",
          borderRadius: 6, padding: "2px 8px", fontSize: 10,
          fontWeight: 700, color: "#92400E", fontFamily: "'Nunito', sans-serif",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#F59E0B", display: "inline-block" }} />
          Unsynced ({pendingCount})
        </div>
      )}
      {session && <DesktopSidebar session={session} />}
      {session && !hideNavBar && <MobileNavBar />}
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginScreen />} />
        <Route path="/" element={session ? <QuizzesScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/history" element={session ? <HistoryScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/quiz/:quizId" element={session ? <QuizRoute saveAttempt={history.saveAttempt} session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/quiz/:quizId/results" element={session ? <ResultsRoute session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/history/view" element={session ? <ResultsRoute session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/lessons" element={session ? <LessonsScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/vocabulary" element={session ? <VocabularyScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/lesson/:lessonId" element={session ? <LessonRoute /> : <Navigate to="/login" replace />} />
        <Route path="/lesson/:lessonId/redaccion/:assignmentId" element={session ? <RedaccionAssignmentRoute /> : <Navigate to="/login" replace />} />
        <Route path="/dialog" element={session ? <DialogScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/carolina" element={session ? <CarolinaScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/storage" element={session ? <StorageScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/settings" element={session ? <SettingsScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/prompts" element={session ? <PromptsScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/conjugar" element={session ? <ConjugarScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/conjugar/drill" element={session ? <ConjugarDrillScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/conjugar/results" element={session ? <ConjugarResultsScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="/conjugar/:verbId/:tense" element={session ? <PackDetailScreen session={session} /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
