import { useState, useEffect } from "react";
import { C } from "../../styles/theme";
import { SPANISH_TENSES } from "../../lib/conjugar/constants";
import { detectVerbType } from "../../lib/conjugar/constants";
import { createVerbs, generatePacks } from "../../lib/conjugar/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "../ui/sheet";

const TENSE_EXAMPLES = {
  presente: "yo hablo",
  preterito_indefinido: "yo hablé",
  preterito_imperfecto: "yo hablaba",
  preterito_perfecto: "yo he hablado",
  preterito_pluscuamperfecto: "yo había hablado",
  futuro_simple: "yo hablaré",
  futuro_perfecto: "yo habré hablado",
  condicional_simple: "yo hablaría",
  condicional_compuesto: "yo habría hablado",
  subjuntivo_presente: "que yo hable",
  subjuntivo_imperfecto: "que yo hablara",
  imperativo: "¡habla tú!",
};

const PROGRESS_STEPS = [
  "Analizando verbos...",
  "Creando tabla clásica...",
  "Generando ejercicios creativos...",
  "Casi listo...",
];

export default function AddVerbModal({ open, onClose, onSuccess }) {
  const [verbInput, setVerbInput] = useState("");
  const [tense, setTense] = useState("presente");
  const [errors, setErrors] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [progressVerbs, setProgressVerbs] = useState([]);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setVerbInput("");
      setTense("presente");
      setErrors([]);
      setGenerating(false);
      setProgressStep(0);
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

    const verbs = parseVerbs();
    setProgressVerbs(verbs);
    setGenerating(true);
    setProgressStep(0);

    // Advance progress steps on a timer
    const interval = setInterval(() => {
      setProgressStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 3000);

    try {
      // Step 1: Create/find verbs
      const { verbs: createdVerbs } = await createVerbs(verbs);
      setProgressStep(1);

      // Step 2: Generate packs
      const verbIds = createdVerbs.map((v) => v.id);
      await generatePacks(verbIds, tense);
      setProgressStep(PROGRESS_STEPS.length - 1);

      clearInterval(interval);
      onSuccess();
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
    <GeneratingState step={progressStep} verbs={progressVerbs} />
  ) : (
    <FormContent
      verbInput={verbInput}
      setVerbInput={setVerbInput}
      tense={tense}
      setTense={setTense}
      errors={errors}
      isValid={isValid}
      disabledReason={disabledReason}
      onGenerate={handleGenerate}
      onClose={onClose}
    />
  );

  // Use isMobile to determine which wrapper
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

// ── Form content ──
function FormContent({ verbInput, setVerbInput, tense, setTense, errors, isValid, disabledReason, onGenerate, onClose }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Verb input */}
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

      {/* Tense selector */}
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

      {/* Info box */}
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

      {/* Errors */}
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

      {/* Buttons */}
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
            {"\u2726"} Generar con IA
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generating state ──
function GeneratingState({ step, verbs }) {
  const progress = ((step + 1) / PROGRESS_STEPS.length) * 100;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "40px 20px", gap: 20, minHeight: 300,
    }}>
      {/* Spinner */}
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

      {/* Progress bar */}
      <div style={{
        width: "100%", maxWidth: 300, height: 6, borderRadius: 3,
        background: "#E5E7EB", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 3, background: C.accent,
          width: `${progress}%`, transition: "width 0.5s ease",
        }} />
      </div>

      {/* Verb pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {verbs.map((v, i) => (
          <span key={i} style={{
            padding: "4px 12px", borderRadius: 16,
            background: i <= step ? "#ECFDF5" : "#F3F4F6",
            color: i <= step ? "#059669" : C.muted,
            fontSize: 13, fontWeight: 700, fontFamily: "'Nunito', sans-serif",
            border: `1px solid ${i <= step ? "#A7F3D0" : "#E5E7EB"}`,
          }}>
            {v}
          </span>
        ))}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
