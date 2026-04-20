import { useState, useEffect } from "react";
import { C } from "../../styles/theme";
import { SPANISH_TENSES } from "../../lib/conjugar/constants";
import { detectVerbType } from "../../lib/conjugar/constants";
import { generateVerbsWithPacks } from "../../lib/conjugar/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "../ui/sheet";

const PROGRESS_STEPS = [
  "Analizando verbos...",
  "Creando tabla clásica...",
  "Generando ejercicios creativos...",
  "Casi listo...",
];

export default function AddVerbModal({ open, onClose, onSuccess, onVerbsChanged }) {
  const [verbInput, setVerbInput] = useState("");
  const [tense, setTense] = useState("presente");
  const [errors, setErrors] = useState([]);
  const [failedVerbs, setFailedVerbs] = useState([]); // [{infinitive, error}]
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [progressVerbs, setProgressVerbs] = useState([]);
  const [completedVerbs, setCompletedVerbs] = useState({}); // {infinitive: "ok"|"fail"}

  useEffect(() => {
    if (open) {
      setVerbInput("");
      setTense("presente");
      setErrors([]);
      setFailedVerbs([]);
      setGenerating(false);
      setProgressStep(0);
      setCompletedVerbs({});
    }
  }, [open]);

  const parseVerbs = () => {
    return verbInput
      .split(/[,\n]+/)
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  };

  const validate = () => {
    const verbs = parseVerbs();
    const errs = [];
    if (verbs.length === 0) {
      errs.push("Ingresa al menos un verbo.");
    }
    for (const v of verbs) {
      if (!detectVerbType(v)) {
        errs.push(`"${v}" no es un infinitivo válido (debe terminar en -ar, -er o -ir).`);
      }
    }
    return errs;
  };

  const handleGenerate = async () => {
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setFailedVerbs([]);

    const verbs = parseVerbs();
    setProgressVerbs(verbs);
    setCompletedVerbs({});
    setGenerating(true);
    setProgressStep(0);

    const interval = setInterval(() => {
      setProgressStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 3000);

    try {
      const { created = [], failed = [] } = await generateVerbsWithPacks(verbs, tense);
      setProgressStep(PROGRESS_STEPS.length - 1);
      clearInterval(interval);

      const marks = {};
      for (const c of created) marks[c.infinitive] = "ok";
      for (const f of failed) marks[f.infinitive] = "fail";
      setCompletedVerbs(marks);

      if (failed.length === 0) {
        onSuccess();
        return;
      }

      // Stay open — show per-verb failures, keep input so user can edit and retry.
      // Refresh the background verb list so successfully created verbs show up behind the modal.
      if (created.length > 0) onVerbsChanged?.();
      setFailedVerbs(failed);
      // Prune successfully generated verbs from the input so retry only re-tries failures.
      const remaining = failed.map((f) => f.infinitive).join(", ");
      setVerbInput(remaining);
      setGenerating(false);
    } catch (e) {
      clearInterval(interval);
      setGenerating(false);
      setErrors([e.message || "Error al generar ejercicios."]);
    }
  };

  const parsedVerbs = parseVerbs();
  const invalidVerbs = parsedVerbs.filter((v) => !detectVerbType(v));
  const isValid = parsedVerbs.length > 0 && invalidVerbs.length === 0;
  const disabledReason = parsedVerbs.length === 0
    ? "Ingresa al menos un verbo"
    : invalidVerbs.length > 0
      ? `Verbo${invalidVerbs.length > 1 ? "s" : ""} no válido${invalidVerbs.length > 1 ? "s" : ""}: ${invalidVerbs.join(", ")}`
      : null;

  const content = generating ? (
    <GeneratingState step={progressStep} verbs={progressVerbs} completed={completedVerbs} />
  ) : (
    <FormContent
      verbInput={verbInput}
      setVerbInput={setVerbInput}
      tense={tense}
      setTense={setTense}
      errors={errors}
      failedVerbs={failedVerbs}
      isValid={isValid}
      disabledReason={disabledReason}
      onGenerate={handleGenerate}
      onClose={onClose}
    />
  );

  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(v) => { if (!v && !generating) onClose(); }}>
        <SheetContent side="bottom" showClose={false} className="max-h-[90vh] overflow-y-auto">
          {!generating && (
            <SheetHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  onClick={onClose}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 14, fontWeight: 700, color: C.muted, fontFamily: "'Nunito', sans-serif",
                  }}
                >
                  Cancelar
                </button>
                <SheetTitle>Añadir verbos</SheetTitle>
                <div style={{ width: 60 }} />
              </div>
            </SheetHeader>
          )}
          <div className="px-5 pb-5">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !generating) onClose(); }}>
      <DialogContent showClose={!generating} className="max-w-[440px]">
        {!generating && (
          <DialogHeader>
            <DialogTitle>Añadir verbos</DialogTitle>
            <DialogDescription className="sr-only">Añade verbos para generar ejercicios de conjugación</DialogDescription>
          </DialogHeader>
        )}
        {content}
      </DialogContent>
    </Dialog>
  );
}

function FormContent({ verbInput, setVerbInput, tense, setTense, errors, failedVerbs, isValid, disabledReason, onGenerate, onClose }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <label style={{
          display: "block", fontSize: 14, fontWeight: 700, color: C.text,
          marginBottom: 6, fontFamily: "'Nunito', sans-serif",
        }}>
          Verbos (en infinitivo)
        </label>
        <textarea
          value={verbInput}
          onChange={(e) => setVerbInput(e.target.value)}
          placeholder="hablar, comer, vivir"
          rows={3}
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12,
            border: `1.5px solid ${C.border}`, background: C.card,
            fontSize: 15, fontFamily: "'Nunito', sans-serif", fontWeight: 600,
            color: C.text, outline: "none", resize: "none",
          }}
          onFocus={(e) => { e.target.style.borderColor = C.accent; }}
          onBlur={(e) => { e.target.style.borderColor = C.border; }}
        />
        <p style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginTop: 4 }}>
          Separa con comas o saltos de línea.
        </p>
      </div>

      <div>
        <label style={{
          display: "block", fontSize: 14, fontWeight: 700, color: C.text,
          marginBottom: 6, fontFamily: "'Nunito', sans-serif",
        }}>
          Tiempo verbal
        </label>
        <div style={{ position: "relative" }}>
          <select
            value={tense}
            onChange={(e) => setTense(e.target.value)}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: 12,
              border: `1.5px solid ${C.border}`, background: C.card,
              fontSize: 15, fontFamily: "'Nunito', sans-serif", fontWeight: 700,
              color: C.text, outline: "none", appearance: "none",
              cursor: "pointer", paddingRight: 40,
            }}
          >
            {SPANISH_TENSES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <div style={{
        padding: "14px 16px", borderRadius: 12,
        background: "#ECFDF5", border: "1px solid #A7F3D0",
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#059669", marginBottom: 2 }}>
          {"\u2728"} 15 ejercicios por verbo
        </p>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#047857" }}>
          1 tabla clásica + 14 ejercicios variados generados por IA
        </p>
      </div>

      {failedVerbs.length > 0 && (
        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: "#FEF2F2", border: "1px solid #FECACA",
        }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#991B1B", marginBottom: 6 }}>
            {failedVerbs.length} verbo{failedVerbs.length !== 1 ? "s" : ""} no se {failedVerbs.length !== 1 ? "generaron" : "generó"}:
          </p>
          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>
            {failedVerbs.map((f, i) => (
              <li key={i} style={{ fontSize: 13, fontWeight: 600, color: "#DC2626" }}>
                <strong>{f.infinitive}</strong> — {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div style={{
          padding: "10px 14px", borderRadius: 10,
          background: "#FEF2F2", border: "1px solid #FECACA",
        }}>
          {errors.map((err, i) => (
            <p key={i} style={{ fontSize: 13, fontWeight: 600, color: "#DC2626", margin: 0 }}>{err}</p>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          className="add-quiz-btn-desktop"
          style={{
            padding: "10px 22px", borderRadius: 12, border: `2px solid ${C.border}`,
            background: "transparent", color: C.text, fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            display: "none",
          }}
        >
          Cancelar
        </button>
        <div style={{ flex: 1, position: "relative" }}
          {...(!isValid && disabledReason ? { title: disabledReason } : {})}
        >
          <button
            onClick={onGenerate}
            disabled={!isValid}
            style={{
              width: "100%", padding: "10px 22px", borderRadius: 12, border: "none",
              background: isValid ? C.accent : "#E5E7EB",
              color: isValid ? "white" : "#9CA3AF",
              fontSize: 14, fontWeight: 800, cursor: isValid ? "pointer" : "not-allowed",
              fontFamily: "'Nunito', sans-serif",
            }}
          >
            {"\u2726"} {failedVerbs.length > 0 ? "Reintentar" : "Generar con IA"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneratingState({ step, verbs, completed }) {
  const progress = ((step + 1) / PROGRESS_STEPS.length) * 100;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px", gap: 20, minHeight: 300,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        border: `4px solid ${C.border}`, borderTopColor: C.accent,
        animation: "spin 1s linear infinite",
      }} />

      <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0, fontFamily: "'Nunito', sans-serif" }}>
        Generando ejercicios
      </h3>

      <p style={{ fontSize: 14, fontWeight: 600, color: C.muted, margin: 0 }}>
        {PROGRESS_STEPS[step]}
      </p>

      <div style={{
        width: "100%", maxWidth: 300, height: 6, borderRadius: 3,
        background: "#E5E7EB", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 3, background: C.accent,
          width: `${progress}%`, transition: "width 0.5s ease",
        }} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {verbs.map((v, i) => {
          const state = completed?.[v];
          const bg = state === "fail" ? "#FEF2F2" : state === "ok" ? "#ECFDF5" : "#F3F4F6";
          const color = state === "fail" ? "#DC2626" : state === "ok" ? "#059669" : C.muted;
          const border = state === "fail" ? "#FECACA" : state === "ok" ? "#A7F3D0" : "#E5E7EB";
          const suffix = state === "fail" ? " ✗" : state === "ok" ? " ✓" : "";
          return (
            <span key={i} style={{
              padding: "4px 12px", borderRadius: 16,
              background: bg, color,
              fontSize: 13, fontWeight: 700, fontFamily: "'Nunito', sans-serif",
              border: `1px solid ${border}`,
            }}>
              {v}{suffix}
            </span>
          );
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
