import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../../styles/theme";
import { supabase } from "../../lib/supabase.js";
import { createLesson, uploadLessonPdf, processLessonPdf, fetchLesson } from "../../lib/api";
import GenerateFromPDFUpload from "./GenerateFromPDFUpload";
import GenerateFromPDFOptions from "./GenerateFromPDFOptions";
import GenerateFromPDFProcess from "./GenerateFromPDFProcess";
import GenerateFromPDFDone from "./GenerateFromPDFDone";
import GenerateFromPDFFailed from "./GenerateFromPDFFailed";

// Dialog styles are now in app/globals.css

export default function GenerateFromPDFDialog({ open, onClose, unitId, onComplete }) {
  const navigate = useNavigate();
  const [state, setState] = useState("upload");
  const [fileInfo, setFileInfo] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState(null);
  const [genSummary, setGenSummary] = useState(true);
  const [genQuiz, setGenQuiz] = useState(true);
  const [lessonId, setLessonId] = useState(null);
  const [steps, setSteps] = useState([]);
  const [results, setResults] = useState(null);
  const [summaryPreview, setSummaryPreview] = useState(null);
  const [modelName, setModelName] = useState(null);
  const processingRef = useRef(false);

  // Fetch the user's pdf_processing model display name
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/settings/models", {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
        });
        if (res.ok) {
          const models = await res.json();
          if (models.pdf_processing?.display_name) {
            setModelName(models.pdf_processing.display_name);
          }
        }
      } catch {}
    })();
  }, [open]);

  const resetState = () => {
    setState("upload");
    setFileInfo(null);
    setUploadProgress(0);
    setUploadPhase(null);
    setGenSummary(true);
    setGenQuiz(true);
    setLessonId(null);
    setSteps([]);
    setResults(null);
    setSummaryPreview(null);
    processingRef.current = false;
  };

  const handleClose = () => {
    if (state === "processing") return;
    resetState();
    onClose();
  };

  const handleFileSelect = async (file) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name?.toLowerCase().endsWith(".pdf");
    if (!isPdf) return;

    setFileInfo({ fileName: file.name, fileSize: file.size, storagePath: null });
    setState("uploading");
    setUploadProgress(0);
    setUploadPhase(null);

    try {
      // 1. Create lesson first (title from filename)
      const title = file.name
        .replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled Lesson";
      const lesson = await createLesson(unitId, title, "");
      setLessonId(lesson.id);

      // 2. Upload PDF via existing pipeline (handles compression for large files)
      const updated = await uploadLessonPdf(
        lesson.id, file,
        (p) => setUploadProgress(p),
        (phase) => setUploadPhase(phase),
      );

      setFileInfo({
        fileName: updated.pdf_name || file.name,
        fileSize: updated.pdf_size || file.size,
        storagePath: updated.pdf_path,
      });
      setState("options");
    } catch (err) {
      console.error("Upload failed:", err);
      setState("upload");
      setFileInfo(null);
      setLessonId(null);
    }
  };

  const updateStep = (key, status, error) => {
    setSteps(prev => prev.map(s => s.key === key ? { ...s, status, error } : s));
  };

  const handleGenerate = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setState("processing");

    // Build steps
    const initialSteps = [{ key: "pdf", label: "PDF uploaded", status: "done" }];
    if (genSummary) initialSteps.push({ key: "summary", label: "Generating summary", status: "pending" });
    if (genQuiz) initialSteps.push({ key: "quiz", label: "Generating quiz (15 questions)", status: "pending" });
    setSteps(initialSteps);

    const tasks = [];
    if (genSummary) tasks.push("summary");
    if (genQuiz) tasks.push("quiz");

    let currentLessonId = null;
    const allResults = {};

    // No AI tasks — lesson already exists with PDF, go straight to done
    if (tasks.length === 0) {
      setResults({});
      setState("done");
      processingRef.current = false;
      return;
    }

    // First API call — lesson already exists, run first AI task
    const firstTask = tasks[0];
    updateStep(firstTask, "active");

    try {
      const result = await processLessonPdf({
        lessonId,
        pdfStoragePath: fileInfo.storagePath,
        pdfFileName: fileInfo.fileName,
        pdfFileSize: fileInfo.fileSize,
        generate: { summary: firstTask === "summary", quiz: firstTask === "quiz" },
      });

      currentLessonId = result.lessonId || lessonId;

      const taskResult = result.results[firstTask];
      allResults[firstTask] = taskResult;

      if (taskResult?.status === "success") {
        updateStep(firstTask, "done");
      } else {
        updateStep(firstTask, "failed", taskResult?.error || "Failed");
      }
    } catch (err) {
      updateStep(firstTask, "failed", err.message);
      allResults[firstTask] = { status: "error", error: err.message };
    }

    // Second API call (if both tasks selected)
    if (tasks.length > 1 && currentLessonId) {
      const secondTask = tasks[1];
      updateStep(secondTask, "active");

      try {
        const result = await processLessonPdf({
          lessonId,
          pdfStoragePath: fileInfo.storagePath,
          pdfFileName: fileInfo.fileName,
          pdfFileSize: fileInfo.fileSize,
          generate: { summary: secondTask === "summary", quiz: secondTask === "quiz" },
        });

        const taskResult = result.results[secondTask];
        allResults[secondTask] = taskResult;

        if (taskResult?.status === "success") {
          updateStep(secondTask, "done");
        } else {
          updateStep(secondTask, "failed", taskResult?.error || "Failed");
        }
      } catch (err) {
        updateStep(secondTask, "failed", err.message);
        allResults[secondTask] = { status: "error", error: err.message };
      }
    } else if (tasks.length > 1 && !currentLessonId) {
      allResults[tasks[1]] = { status: "error", error: "Skipped due to previous error" };
      updateStep(tasks[1], "failed", "Skipped due to previous error");
    }

    setResults(allResults);

    // Determine final state
    const anyFailed = Object.values(allResults).some(r => r?.status !== "success");

    if (anyFailed) {
      setState("partial-fail");
    } else {
      // Fetch summary preview
      if (genSummary && currentLessonId) {
        try {
          const lesson = await fetchLesson(currentLessonId);
          if (lesson.summary) {
            const lines = lesson.summary.split("\n").filter(l => l.trim());
            setSummaryPreview(lines[0]?.substring(0, 150) || "");
          }
        } catch {}
      }
      setState("done");
    }

    processingRef.current = false;
  };

  const handleRetry = async (taskKey) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setState("processing");

    updateStep(taskKey, "active");

    try {
      const result = await processLessonPdf({
        lessonId,
        pdfStoragePath: fileInfo.storagePath,
        pdfFileName: fileInfo.fileName,
        pdfFileSize: fileInfo.fileSize,
        generate: { summary: taskKey === "summary", quiz: taskKey === "quiz" },
      });

      const taskResult = result.results[taskKey];
      const updatedResults = { ...results, [taskKey]: taskResult };
      setResults(updatedResults);

      if (taskResult?.status === "success") {
        updateStep(taskKey, "done");

        const anyStillFailed = Object.values(updatedResults).some(r => r?.status !== "success");
        if (anyStillFailed) {
          setState("partial-fail");
        } else {
          if (genSummary) {
            try {
              const lesson = await fetchLesson(lessonId);
              if (lesson.summary) {
                const lines = lesson.summary.split("\n").filter(l => l.trim());
                setSummaryPreview(lines[0]?.substring(0, 150) || "");
              }
            } catch {}
          }
          setState("done");
        }
      } else {
        updateStep(taskKey, "failed", taskResult?.error || "Failed");
        setState("partial-fail");
      }
    } catch (err) {
      updateStep(taskKey, "failed", err.message);
      setState("partial-fail");
    }

    processingRef.current = false;
  };

  const handleViewLesson = () => {
    const id = lessonId;
    onComplete?.();
    resetState();
    onClose();
    if (id) navigate(`/lesson/${id}`);
  };

  const handleContinue = () => {
    const id = lessonId;
    onComplete?.();
    resetState();
    onClose();
    if (id) navigate(`/lesson/${id}`);
  };

  if (!open) return null;

  return (
    <div
      className="gpdf-overlay"
      onClick={state !== "processing" ? handleClose : undefined}
    >
      <div className="gpdf-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div
          className="gpdf-header"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#8b5cf6", fontSize: 18, lineHeight: 1 }}>&#10022;</span>
            <h3 style={{
              fontSize: 16, fontWeight: 800, color: C.text,
              fontFamily: "'Nunito', sans-serif", margin: 0,
            }}>
              Generate from PDF
            </h3>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: "none",
              background: "transparent", cursor: state === "processing" ? "default" : "pointer",
              color: C.muted,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: state === "processing" ? 0.4 : 1,
            }}
            disabled={state === "processing"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="gpdf-body">
          <div key={state} className="gpdf-fade">
            {(state === "upload" || state === "uploading") && (
              <GenerateFromPDFUpload
                uploading={state === "uploading"}
                fileName={fileInfo?.fileName}
                progress={uploadProgress}
                phase={uploadPhase}
                onFileSelect={handleFileSelect}
              />
            )}
            {state === "options" && (
              <GenerateFromPDFOptions
                fileInfo={fileInfo}
                genSummary={genSummary}
                genQuiz={genQuiz}
                modelName={modelName}
                onToggleSummary={() => setGenSummary(v => !v)}
                onToggleQuiz={() => setGenQuiz(v => !v)}
                onGenerate={handleGenerate}
                onCancel={handleClose}
              />
            )}
            {state === "processing" && (
              <GenerateFromPDFProcess steps={steps} />
            )}
            {state === "done" && (
              <GenerateFromPDFDone
                fileInfo={fileInfo}
                genSummary={genSummary}
                genQuiz={genQuiz}
                summaryPreview={summaryPreview}
                onViewLesson={handleViewLesson}
              />
            )}
            {state === "partial-fail" && (
              <GenerateFromPDFFailed
                steps={steps}
                results={results}
                onRetry={handleRetry}
                onContinue={handleContinue}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
