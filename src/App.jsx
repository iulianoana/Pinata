import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuizHistory } from "./useQuizHistory.js";

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════
const injectStyles = () => {
  if (document.getElementById("sq-styles")) return;
  const s = document.createElement("style");
  s.id = "sq-styles";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #FAF7F2; font-family: 'Figtree', system-ui, sans-serif; color: #2C2420; -webkit-font-smoothing: antialiased; }
    h1, h2, h3, h4 { font-family: 'DM Serif Display', Georgia, serif; font-weight: 400; }
    .fade-in { animation: fadeIn 0.4s ease-out both; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes scoreReveal { from { stroke-dashoffset: 339.292; } }
    @keyframes countUp { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
    .score-anim { animation: countUp 0.6s 0.5s ease-out both; }
    input[type="text"], textarea { font-family: 'Figtree', system-ui, sans-serif; }
    ::placeholder { color: #B5ADA6; }
  `;
  document.head.appendChild(s);
};

const C = {
  bg: "#FAF7F2", card: "#FFFFFF", accent: "#B8622D", accentLight: "#F5EDE6",
  accentHover: "#9E5324", text: "#2C2420", muted: "#8C7E76", success: "#2A7D5F",
  successLight: "#EBF5EE", error: "#B84040", errorLight: "#FDEDEE",
  border: "#E8E2DC", inputBg: "#FDFCFA",
};

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿¡.,!?;:'"]/g, "").replace(/\s+/g, " ").trim();

const grade = (q, a) => {
  if (!a) return { correct: false };
  switch (q.type) {
    case "fill_blank": {
      const res = (q.accept || []).map((acc, i) => (acc || []).some((x) => norm(x) === norm(a.blanks?.[i])));
      return { correct: res.every(Boolean), blanksCorrect: res };
    }
    case "multiple_choice":
      return { correct: a.selected === q.answer };
    case "translate":
      return { correct: (q.accept || []).some((x) => norm(x) === norm(a.text)) };
    case "classify": {
      const map = {};
      Object.entries(q.categories).forEach(([cat, items]) => items.forEach((item) => (map[norm(item)] = cat)));
      const total = Object.values(q.categories).flat().length;
      const placed = Object.entries(a.placements || {}).flatMap(([cat, items]) => items.map((it) => ({ it, cat })));
      return { correct: placed.length === total && placed.every(({ it, cat }) => map[norm(it)] === cat) };
    }
    default:
      return { correct: false };
  }
};

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

const typeLabels = { fill_blank: "Fill in the Blanks", multiple_choice: "Multiple Choice", translate: "Translate", classify: "Classify" };
const typeShortLabels = { fill_blank: "Fill", multiple_choice: "MC", translate: "Trans", classify: "Classify" };

const formatDate = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = today - day;
  if (diff === 0) return "Today";
  if (diff === 86400000) return "Yesterday";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(d);
};

// ═══════════════════════════════════════════════════════════════
// HISTORY SECTION
// ═══════════════════════════════════════════════════════════════
function MiniScoreCircle({ pct, size = 40 }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const color = pct >= 70 ? C.success : pct >= 50 ? C.accent : C.error;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.border} strokeWidth="3" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        fill={color} fontSize="10" fontWeight="700" fontFamily="'Figtree', sans-serif">
        {pct}%
      </text>
    </svg>
  );
}

function HistorySection({ attempts, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? attempts : attempts.slice(0, 5);

  return (
    <div style={{ marginTop: 48 }}>
      <h2 style={{ fontSize: 22, color: C.text, marginBottom: 16 }}>Previous Attempts</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((a) => {
          const pct = a.score.percentage;
          const color = pct >= 70 ? C.success : pct >= 50 ? C.accent : C.error;
          return (
            <div key={a.id} className="fade-in" style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
              padding: "16px 20px", position: "relative",
            }}
            onMouseEnter={(e) => { const b = e.currentTarget.querySelector("[data-del]"); if (b) b.style.opacity = "1"; }}
            onMouseLeave={(e) => { const b = e.currentTarget.querySelector("[data-del]"); if (b) b.style.opacity = "0"; }}
            >
              {/* Top row: score circle + title + date */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                <MiniScoreCircle pct={pct} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.meta?.title || "Quiz"}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {a.meta?.unit != null && a.meta?.lesson != null
                      ? `Unit ${a.meta.unit} · Lesson ${a.meta.lesson}`
                      : ""}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap" }}>{formatDate(a.timestamp)}</div>
              </div>

              {/* Progress bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: color, borderRadius: 3, width: `${pct}%` }} />
                </div>
                <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {a.score.correct}/{a.score.total} correct
                </span>
              </div>

              {/* Type breakdown pills */}
              {a.breakdown?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {a.breakdown.map((b) => (
                    <span key={b.type} style={{
                      display: "inline-block", padding: "3px 10px", borderRadius: 999,
                      fontSize: 11, fontWeight: 600, background: C.accentLight, color: C.accent,
                    }}>
                      {typeShortLabels[b.type] || b.label} {b.correct}/{b.total}
                    </span>
                  ))}
                </div>
              )}

              {/* Delete button */}
              <button data-del onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}
                style={{
                  position: "absolute", top: 10, right: 10, background: "none", border: "none",
                  color: C.muted, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4,
                  opacity: 0, transition: "opacity 0.2s",
                }}>
                ×
              </button>
            </div>
          );
        })}
      </div>
      {attempts.length > 5 && (
        <button onClick={() => setExpanded(!expanded)} style={{
          display: "block", margin: "16px auto 0", background: "none", border: "none",
          color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer",
          fontFamily: "'Figtree', sans-serif",
        }}>
          {expanded ? "Show less" : `Show all ${attempts.length} attempts`}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD SCREEN
// ═══════════════════════════════════════════════════════════════
function UploadScreen({ onLoad, attempts, loading, onDeleteAttempt }) {
  const [err, setErr] = useState("");
  const [dragging, setDragging] = useState(false);
  const ref = useRef();

  const handle = (file) => {
    setErr("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const d = JSON.parse(e.target.result);
        if (!d.questions?.length) throw new Error("No questions found");
        onLoad(d);
      } catch { setErr("Invalid file. Please upload a valid quiz JSON file."); }
    };
    reader.readAsText(file);
  };

  const hasHistory = !loading && attempts.length > 0;

  return (
    <div className="fade-in" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: hasHistory ? "flex-start" : "center", padding: "48px 24px" }}>
      <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>📖</div>
        <h1 style={{ fontSize: 36, color: C.text, marginBottom: 8, letterSpacing: "-0.5px" }}>Práctica</h1>
        <p style={{ color: C.muted, fontSize: 16, marginBottom: 36, lineHeight: 1.5 }}>
          Upload a quiz file to start your Spanish practice session
        </p>
        <div
          onClick={() => ref.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); e.dataTransfer.files[0] && handle(e.dataTransfer.files[0]); }}
          style={{
            border: `2px dashed ${dragging ? C.accent : C.border}`,
            borderRadius: 16, padding: "48px 24px", cursor: "pointer",
            background: dragging ? C.accentLight : "transparent",
            transition: "all 0.25s ease",
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.7 }}>📄</div>
          <p style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>Drop your quiz file here</p>
          <p style={{ color: C.muted, fontSize: 13 }}>or click to browse · JSON format</p>
          <input ref={ref} type="file" accept=".json" style={{ display: "none" }} onChange={(e) => e.target.files[0] && handle(e.target.files[0])} />
        </div>
        {err && <p style={{ color: C.error, fontSize: 13, marginTop: 16 }}>{err}</p>}
        {!hasHistory && (
          <p style={{ color: C.muted, fontSize: 12, marginTop: 32, lineHeight: 1.6 }}>
            Quiz files contain questions generated from your lesson PDFs.
          </p>
        )}
      </div>
      {hasHistory && (
        <div style={{ maxWidth: 520, width: "100%", textAlign: "left" }}>
          <HistorySection attempts={attempts} onDelete={onDeleteAttempt} />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// QUESTION COMPONENTS
// ═══════════════════════════════════════════════════════════════
function FillBlank({ q, value, onChange }) {
  const blanks = value?.blanks || [];
  const parts = q.prompt.split(/(___+)/);
  let idx = 0;

  const update = (i, v) => {
    const nb = [...blanks];
    nb[i] = v;
    onChange({ blanks: nb });
  };

  return (
    <div>
      <div style={{ fontSize: 18, lineHeight: 2.2, marginBottom: 8 }}>
        {parts.map((p, pi) => {
          if (/^___+$/.test(p)) {
            const ci = idx++;
            return (
              <input
                key={pi} type="text" value={blanks[ci] || ""} onChange={(e) => update(ci, e.target.value)}
                placeholder="..." autoComplete="off"
                style={{
                  display: "inline-block", border: "none", borderBottom: `2px solid ${C.accent}`,
                  background: "transparent", padding: "2px 6px", margin: "0 3px", textAlign: "center",
                  color: C.accent, fontWeight: 600, outline: "none", minWidth: 90, fontSize: "inherit",
                  lineHeight: "inherit", fontFamily: "'Figtree', sans-serif",
                }}
                onFocus={(e) => (e.target.style.borderColor = C.accentHover)}
                onBlur={(e) => (e.target.style.borderColor = C.accent)}
              />
            );
          }
          return <span key={pi}>{p}</span>;
        })}
      </div>
      {q.hint && <p style={{ color: C.muted, fontSize: 13, fontStyle: "italic", marginTop: 12 }}>💡 {q.hint}</p>}
    </div>
  );
}

function MultiChoice({ q, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {q.options.map((opt, i) => (
        <div
          key={i} onClick={() => onChange({ selected: i })}
          style={{
            padding: "14px 20px", borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
            border: `1.5px solid ${value?.selected === i ? C.accent : C.border}`,
            background: value?.selected === i ? C.accentLight : C.card,
            color: value?.selected === i ? C.accent : C.text,
            fontWeight: value?.selected === i ? 600 : 400, fontSize: 15,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: "50%", border: `1.5px solid ${value?.selected === i ? C.accent : C.border}`, marginRight: 12, fontSize: 12, fontWeight: 700, background: value?.selected === i ? C.accent : "transparent", color: value?.selected === i ? "white" : C.muted }}>
            {String.fromCharCode(65 + i)}
          </span>
          {opt}
        </div>
      ))}
    </div>
  );
}

function Translate({ q, value, onChange }) {
  return (
    <div>
      {q.direction && <p style={{ color: C.muted, fontSize: 13, marginBottom: 12, fontWeight: 500 }}>{q.direction}</p>}
      <textarea
        value={value?.text || ""} onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Type your translation here..."
        rows={3}
        style={{
          width: "100%", padding: 16, borderRadius: 12, border: `1.5px solid ${C.border}`,
          background: C.inputBg, fontSize: 16, resize: "vertical", outline: "none",
          lineHeight: 1.6, color: C.text, transition: "border-color 0.2s",
        }}
        onFocus={(e) => (e.target.style.borderColor = C.accent)}
        onBlur={(e) => (e.target.style.borderColor = C.border)}
      />
      {q.hint && <p style={{ color: C.muted, fontSize: 13, fontStyle: "italic", marginTop: 10 }}>💡 {q.hint}</p>}
    </div>
  );
}

function Classify({ q, value, onChange }) {
  const allItems = useMemo(() => shuffle(Object.values(q.categories).flat()), [q]);
  const placements = value?.placements || {};
  const selected = value?._selected || null;
  const placed = Object.values(placements).flat();
  const unplaced = allItems.filter((it) => !placed.includes(it));
  const [dragOverCat, setDragOverCat] = useState(null);
  const [dragging, setDragging] = useState(null);

  const selectItem = (item) => {
    onChange({ ...value, placements, _selected: selected === item ? null : item });
  };

  const placeItem = (item, cat) => {
    const np = { ...placements };
    Object.keys(np).forEach((k) => (np[k] = (np[k] || []).filter((x) => x !== item)));
    np[cat] = [...(np[cat] || []), item];
    onChange({ placements: np, _selected: null });
  };

  const placeInCategory = (cat) => {
    if (!selected) return;
    placeItem(selected, cat);
  };

  const removeFromCategory = (item, cat) => {
    const np = { ...placements };
    np[cat] = (np[cat] || []).filter((x) => x !== item);
    onChange({ ...value, placements: np, _selected: null });
  };

  const onDragStart = (e, item) => {
    setDragging(item);
    e.dataTransfer.setData("text/plain", item);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragEnd = () => {
    setDragging(null);
    setDragOverCat(null);
  };

  const onDragOver = (e, cat) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCat(cat);
  };

  const onDragLeave = (e, cat) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCat(null);
  };

  const onDrop = (e, cat) => {
    e.preventDefault();
    const item = e.dataTransfer.getData("text/plain");
    if (item) placeItem(item, cat);
    setDragOverCat(null);
    setDragging(null);
  };

  // Touch drag-and-drop support
  const touchState = useRef({ item: null, el: null, ghost: null, startX: 0, startY: 0 });

  const onTouchStart = (e, item) => {
    const touch = e.touches[0];
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.style.position = "fixed";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    ghost.style.width = rect.width + "px";
    ghost.style.zIndex = 9999;
    ghost.style.opacity = "0.85";
    ghost.style.pointerEvents = "none";
    ghost.style.boxShadow = "0 4px 16px rgba(0,0,0,0.18)";
    ghost.style.transform = "scale(1.08)";
    document.body.appendChild(ghost);
    touchState.current = { item, el, ghost, startX: touch.clientX - rect.left, startY: touch.clientY - rect.top };
    setDragging(item);
  };

  const onTouchMove = useCallback((e) => {
    const ts = touchState.current;
    if (!ts.ghost) return;
    e.preventDefault();
    const touch = e.touches[0];
    ts.ghost.style.left = (touch.clientX - ts.startX) + "px";
    ts.ghost.style.top = (touch.clientY - ts.startY) + "px";
    // Hit-test category drop zones
    ts.ghost.style.display = "none";
    const elBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    ts.ghost.style.display = "";
    const dropZone = elBelow?.closest("[data-drop-cat]");
    setDragOverCat(dropZone ? dropZone.dataset.dropCat : null);
  }, []);

  const onTouchEnd = useCallback(() => {
    const ts = touchState.current;
    if (ts.ghost) {
      ts.ghost.remove();
      if (dragOverCat && ts.item) placeItem(ts.item, dragOverCat);
    }
    touchState.current = { item: null, el: null, ghost: null, startX: 0, startY: 0 };
    setDragging(null);
    setDragOverCat(null);
  }, [dragOverCat, placements]);

  useEffect(() => {
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [onTouchMove, onTouchEnd]);

  const chipStyle = (isSelected) => ({
    display: "inline-flex", alignItems: "center", padding: "7px 16px", borderRadius: 999,
    fontSize: 14, fontWeight: 500, cursor: "grab", transition: "all 0.2s", userSelect: "none",
    border: `1.5px solid ${isSelected ? C.accent : C.border}`,
    background: isSelected ? C.accentLight : C.card,
    color: isSelected ? C.accent : C.text,
    touchAction: "none",
  });

  return (
    <div>
      {unplaced.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {unplaced.map((item) => (
            <span key={item} draggable
              onDragStart={(e) => onDragStart(e, item)} onDragEnd={onDragEnd}
              onTouchStart={(e) => onTouchStart(e, item)}
              onClick={() => selectItem(item)}
              style={{ ...chipStyle(selected === item), opacity: dragging === item ? 0.4 : 1 }}>
              {item}
            </span>
          ))}
        </div>
      )}
      {selected && !dragging && <p style={{ color: C.accent, fontSize: 13, marginBottom: 12, fontWeight: 500 }}>👆 Now click a category below to place "{selected}"</p>}
      {dragging && <p style={{ color: C.accent, fontSize: 13, marginBottom: 12, fontWeight: 500 }}>Drop into a category below</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.keys(q.categories).map((cat) => {
          const isOver = dragOverCat === cat;
          return (
            <div key={cat}>
              <div
                data-drop-cat={cat}
                onClick={() => placeInCategory(cat)}
                onDragOver={(e) => onDragOver(e, cat)}
                onDragLeave={(e) => onDragLeave(e, cat)}
                onDrop={(e) => onDrop(e, cat)}
                style={{
                  border: `2px ${(placements[cat]?.length) ? "solid" : "dashed"} ${isOver ? C.accent : selected ? C.accent : C.border}`,
                  borderRadius: 12, padding: 14, minHeight: 56, cursor: selected ? "pointer" : "default",
                  transition: "all 0.2s",
                  background: isOver ? C.accentLight + "66" : selected ? C.accentLight + "44" : "transparent",
                  transform: isOver ? "scale(1.02)" : "none",
                }}
              >
                <p style={{ fontSize: 13, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: (placements[cat]?.length) ? 10 : 0 }}>{cat}</p>
                {(placements[cat]?.length > 0) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {placements[cat].map((item) => (
                      <span key={item} draggable
                        onDragStart={(e) => onDragStart(e, item)} onDragEnd={onDragEnd}
                        onTouchStart={(e) => onTouchStart(e, item)}
                        onClick={(e) => { e.stopPropagation(); removeFromCategory(item, cat); }}
                        style={{ ...chipStyle(false), background: C.accentLight, borderColor: C.accent, color: C.accent, fontSize: 13, opacity: dragging === item ? 0.4 : 1 }}>
                        {item} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// QUIZ SCREEN
// ═══════════════════════════════════════════════════════════════
function QuizScreen({ data, onFinish }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [key, setKey] = useState(0);
  const q = data.questions[idx];
  const total = data.questions.length;
  const ans = answers[idx];

  const setAnswer = (a) => setAnswers((p) => ({ ...p, [idx]: a }));

  const canProceed = () => {
    if (!ans) return false;
    switch (q.type) {
      case "fill_blank": return (ans.blanks || []).some((b) => b?.trim());
      case "multiple_choice": return ans.selected !== undefined;
      case "translate": return !!ans.text?.trim();
      case "classify": return Object.values(ans.placements || {}).flat().length > 0;
      default: return false;
    }
  };

  const next = () => {
    if (idx < total - 1) { setIdx(idx + 1); setKey((k) => k + 1); }
    else onFinish(answers);
  };

  const skip = () => {
    setAnswers((p) => ({ ...p, [idx]: { skipped: true } }));
    if (idx < total - 1) { setIdx(idx + 1); setKey((k) => k + 1); }
    else onFinish({ ...answers, [idx]: { skipped: true } });
  };

  const QComponent = { fill_blank: FillBlank, multiple_choice: MultiChoice, translate: Translate, classify: Classify }[q.type];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 20px" }}>
      <div style={{ maxWidth: 580, width: "100%" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{idx + 1} / {total}</span>
            <span style={{ fontSize: 12, color: C.accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {typeLabels[q.type] || q.type}
            </span>
          </div>
          <div style={{ height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", background: C.accent, borderRadius: 2, transition: "width 0.4s ease", width: `${((idx + 1) / total) * 100}%` }} />
          </div>
        </div>

        {/* Question Card */}
        <div key={key} className="fade-in" style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
          padding: "36px 32px", boxShadow: "0 1px 3px rgba(44,36,32,0.04), 0 6px 16px rgba(44,36,32,0.03)",
        }}>
          <h2 style={{ fontSize: 22, lineHeight: 1.4, marginBottom: 28, color: C.text }}>{q.prompt.includes("___") && q.type === "fill_blank" ? "" : q.prompt}</h2>
          {QComponent && <QComponent q={q} value={ans} onChange={setAnswer} />}
        </div>

        {/* Navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
          <button onClick={skip} style={{
            background: "transparent", border: "none", color: C.muted, fontSize: 14,
            fontWeight: 500, cursor: "pointer", padding: "8px 0", fontFamily: "'Figtree', sans-serif",
          }}>
            Skip →
          </button>
          <button
            onClick={next} disabled={!canProceed()}
            style={{
              background: canProceed() ? C.accent : C.border, color: "white", border: "none",
              padding: "13px 36px", borderRadius: 12, fontWeight: 600, fontSize: 15,
              cursor: canProceed() ? "pointer" : "not-allowed", transition: "all 0.2s",
              fontFamily: "'Figtree', sans-serif", opacity: canProceed() ? 1 : 0.5,
            }}
            onMouseEnter={(e) => canProceed() && (e.target.style.background = C.accentHover)}
            onMouseLeave={(e) => canProceed() && (e.target.style.background = C.accent)}
          >
            {idx === total - 1 ? "Finish" : "Next"}
          </button>
        </div>

        {/* Meta */}
        {data.meta?.title && (
          <p style={{ textAlign: "center", color: C.muted, fontSize: 12, marginTop: 32, opacity: 0.6 }}>
            {data.meta.title}
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SCORE SCREEN
// ═══════════════════════════════════════════════════════════════
function ScoreScreen({ data, answers, results, onReview, onRestart, onHome }) {
  const correct = results.filter((r) => r.correct).length;
  const total = data.questions.length;
  const pct = Math.round((correct / total) * 100);
  const circ = 2 * Math.PI * 54;

  const msg = pct >= 90 ? ["¡Excelente!", "🎉"] : pct >= 70 ? ["¡Muy bien!", "👏"] : pct >= 50 ? ["¡Buen esfuerzo!", "💪"] : ["¡Sigue practicando!", "📚"];

  return (
    <div className="fade-in" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        {/* Score Circle */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 24 }}>
          <svg width="140" height="140" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke={C.border} strokeWidth="6" />
            <circle
              cx="60" cy="60" r="54" fill="none" stroke={pct >= 70 ? C.success : pct >= 50 ? C.accent : C.error}
              strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
              transform="rotate(-90 60 60)"
              style={{ animation: "scoreReveal 1s ease-out forwards" }}
            />
          </svg>
          <div className="score-anim" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: C.text, fontFamily: "'DM Serif Display', serif" }}>{pct}%</div>
          </div>
        </div>

        <div style={{ fontSize: 48, marginBottom: 8 }}>{msg[1]}</div>
        <h1 style={{ fontSize: 32, marginBottom: 8, color: C.text }}>{msg[0]}</h1>
        <p style={{ color: C.muted, fontSize: 16, marginBottom: 32 }}>
          {correct} of {total} correct
        </p>

        {/* Type breakdown */}
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 36, flexWrap: "wrap" }}>
          {Object.entries(
            data.questions.reduce((acc, q, i) => {
              const t = typeLabels[q.type] || q.type;
              if (!acc[t]) acc[t] = { correct: 0, total: 0 };
              acc[t].total++;
              if (results[i].correct) acc[t].correct++;
              return acc;
            }, {})
          ).map(([type, stats]) => (
            <div key={type} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 16px", fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: C.text }}>{stats.correct}/{stats.total}</div>
              <div style={{ color: C.muted, fontSize: 11 }}>{type}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={() => onReview(results)} style={{
            background: C.accent, color: "white", border: "none", padding: "14px 32px",
            borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: "pointer",
            fontFamily: "'Figtree', sans-serif", transition: "background 0.2s",
          }}>
            Review Answers
          </button>
          <button onClick={onRestart} style={{
            background: "transparent", color: C.text, border: `1.5px solid ${C.border}`,
            padding: "13px 32px", borderRadius: 12, fontWeight: 600, fontSize: 15,
            cursor: "pointer", fontFamily: "'Figtree', sans-serif",
          }}>
            Try Again
          </button>
          <button onClick={onHome} style={{
            background: "transparent", color: C.muted, border: "none",
            padding: "10px 32px", fontSize: 14, fontWeight: 500,
            cursor: "pointer", fontFamily: "'Figtree', sans-serif",
          }}>
            New Quiz
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// REVIEW SCREEN
// ═══════════════════════════════════════════════════════════════
function ReviewScreen({ data, answers, results, onBack }) {
  const correct = results.filter((r) => r.correct).length;

  const renderUserAnswer = (q, a) => {
    if (!a || a.skipped) return <em style={{ color: C.muted }}>Skipped</em>;
    switch (q.type) {
      case "fill_blank":
        return (a.blanks || []).map((b, i) => (
          <span key={i} style={{
            display: "inline-block", padding: "3px 10px", borderRadius: 6, marginRight: 6, marginBottom: 4, fontSize: 14,
            background: results[data.questions.indexOf(q)]?.blanksCorrect?.[i] ? C.successLight : C.errorLight,
            color: results[data.questions.indexOf(q)]?.blanksCorrect?.[i] ? C.success : C.error,
            fontWeight: 600,
          }}>
            {b || "(empty)"}
          </span>
        ));
      case "multiple_choice":
        return <span style={{ fontWeight: 500 }}>{q.options[a.selected] || "(none)"}</span>;
      case "translate":
        return <span style={{ fontWeight: 500 }}>{a.text || "(empty)"}</span>;
      case "classify":
        return Object.entries(a.placements || {}).map(([cat, items]) => (
          items.length > 0 && <div key={cat} style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{cat}: </span>
            <span style={{ fontSize: 14 }}>{items.join(", ")}</span>
          </div>
        ));
      default: return null;
    }
  };

  const renderCorrectAnswer = (q) => {
    switch (q.type) {
      case "fill_blank":
        return (q.blanks || []).map((b, i) => (
          <span key={i} style={{ display: "inline-block", padding: "3px 10px", borderRadius: 6, marginRight: 6, background: C.successLight, color: C.success, fontWeight: 600, fontSize: 14 }}>{b}</span>
        ));
      case "multiple_choice":
        return <span style={{ fontWeight: 500 }}>{q.options[q.answer]}</span>;
      case "translate":
        return <span style={{ fontWeight: 500 }}>{(q.accept || []).join(" / ")}</span>;
      case "classify":
        return Object.entries(q.categories).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{cat}: </span>
            <span style={{ fontSize: 14 }}>{items.join(", ")}</span>
          </div>
        ));
      default: return null;
    }
  };

  return (
    <div className="fade-in" style={{ minHeight: "100vh", padding: "32px 20px" }}>
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, color: C.text }}>Review</h1>
            <p style={{ color: C.muted, fontSize: 14 }}>{correct}/{data.questions.length} correct</p>
          </div>
          <button onClick={onBack} style={{
            background: C.accent, color: "white", border: "none", padding: "10px 24px",
            borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer",
            fontFamily: "'Figtree', sans-serif",
          }}>
            ← Back
          </button>
        </div>

        {/* Questions */}
        {data.questions.map((q, i) => {
          const r = results[i];
          return (
            <div key={i} style={{
              background: C.card, borderRadius: 14, padding: "22px 24px", marginBottom: 14,
              border: `1px solid ${C.border}`, borderLeft: `4px solid ${r.correct ? C.success : C.error}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>Q{i + 1} · {typeLabels[q.type]}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.correct ? C.success : C.error }}>
                  {r.correct ? "✓ Correct" : "✗ Incorrect"}
                </span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.5, marginBottom: 14, color: C.text }}>
                {q.prompt.replace(/___+/g, "______")}
              </p>

              {!r.correct && (
                <div style={{ marginBottom: 10, padding: "10px 14px", borderRadius: 10, background: C.errorLight }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.error, marginBottom: 4 }}>Your answer:</p>
                  <div style={{ color: C.error }}>{renderUserAnswer(q, answers[i])}</div>
                </div>
              )}

              <div style={{ padding: "10px 14px", borderRadius: 10, background: C.successLight }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: C.success, marginBottom: 4 }}>Correct answer:</p>
                <div style={{ color: C.success }}>{renderCorrectAnswer(q)}</div>
              </div>

              {q.explanation && (
                <p style={{ fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 1.5, fontStyle: "italic" }}>
                  💡 {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("upload");
  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState(null);
  const [results, setResults] = useState(null);
  const { attempts, loading, saveAttempt, deleteAttempt, refresh } = useQuizHistory();

  useEffect(() => { injectStyles(); }, []);

  const handleLoad = (d) => { setData(d); setScreen("quiz"); };

  const handleFinish = (ans) => {
    setAnswers(ans);
    const res = data.questions.map((q, i) => grade(q, ans[i]));
    setResults(res);
    setScreen("score");

    const correct = res.filter((r) => r.correct).length;
    const total = data.questions.length;
    const breakdown = Object.entries(
      data.questions.reduce((acc, q, i) => {
        if (!acc[q.type]) acc[q.type] = { type: q.type, label: typeLabels[q.type] || q.type, correct: 0, total: 0 };
        acc[q.type].total++;
        if (res[i].correct) acc[q.type].correct++;
        return acc;
      }, {})
    ).map(([, v]) => v);

    const quizKey = data.meta?.unit != null && data.meta?.lesson != null
      ? `u${data.meta.unit}-l${data.meta.lesson}` : "unknown";

    saveAttempt({
      timestamp: Date.now(),
      quizKey,
      meta: { title: data.meta?.title, description: data.meta?.description, unit: data.meta?.unit, lesson: data.meta?.lesson },
      score: { correct, total, percentage: Math.round((correct / total) * 100) },
      breakdown,
      answers: ans,
      results: res,
      questions: data.questions,
    });
  };

  const handleReview = () => { setScreen("review"); };
  const handleRestart = () => { setAnswers(null); setResults(null); setScreen("quiz"); };
  const handleNewQuiz = () => { setData(null); setAnswers(null); setResults(null); setScreen("upload"); };

  switch (screen) {
    case "upload": return <UploadScreen onLoad={handleLoad} attempts={attempts} loading={loading} onDeleteAttempt={deleteAttempt} />;
    case "quiz": return <QuizScreen data={data} onFinish={handleFinish} />;
    case "score": return <ScoreScreen data={data} answers={answers} results={results} onReview={handleReview} onRestart={handleRestart} onHome={handleNewQuiz} />;
    case "review": return <ReviewScreen data={data} answers={answers} results={results} onBack={() => setScreen("score")} />;
    default: return null;
  }
}
