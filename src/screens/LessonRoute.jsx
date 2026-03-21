import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C } from "../styles/theme";
import { fetchLesson } from "../lib/api";
import LessonReader from "../components/lessons/LessonReader";

export default function LessonRoute() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [weekContext, setWeekContext] = useState("");
  const [week, setWeek] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchLesson(lessonId);
        if (cancelled) return;
        setLesson(data);
        if (data.weeks) {
          setWeekContext(`Week ${data.weeks.week_number} \u00b7 ${data.weeks.title || `Week ${data.weeks.week_number}`}`);
          setWeek(data.weeks);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [lessonId]);

  if (error) {
    return (
      <div className="desktop-main safe-top" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: C.text, fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Lesson not found</p>
          <button onClick={() => navigate("/lessons")} style={{
            background: C.accent, color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 24px", fontWeight: 700, fontSize: 14, cursor: "pointer",
            fontFamily: "'Nunito', sans-serif",
          }}>Back to lessons</button>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="desktop-main safe-top" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
        <p style={{ color: C.muted, fontSize: 16, fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="desktop-main safe-top lesson-reader-wrapper">
      <LessonReader
        lesson={lesson}
        weekContext={weekContext}
        week={week}
        onBack={() => navigate("/lessons")}
      />
    </div>
  );
}
