import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { C } from "../styles/theme";
import { SPANISH_TENSES } from "../lib/conjugar/constants";
import { useVerbs } from "../lib/conjugar/api";
import { VerbTypeBadge, ScoreBadge, timeAgo } from "../components/conjugar/shared";
import MobileNavBar from "../components/MobileNavBar";
import AddVerbModal from "../components/conjugar/AddVerbModal";

const FILTERS = ["Todos", "-ar", "-er", "-ir"];

export default function ConjugarScreen({ session }) {
  const navigate = useNavigate();
  const { data: verbs, isLoading, refresh } = useVerbs();
  const [filter, setFilter] = useState("Todos");
  const [selectedPacks, setSelectedPacks] = useState([]); // [{verbId, tense, packId}]
  const [showAddModal, setShowAddModal] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "Todos") return verbs;
    const type = filter.replace("-", "");
    return verbs.filter((v) => v.verb_type === type);
  }, [verbs, filter]);

  const totalPacks = verbs.reduce((sum, v) => sum + (v.packs?.length || 0), 0);

  const togglePack = (verbId, tense, packId) => {
    setSelectedPacks((prev) => {
      const exists = prev.find((p) => p.packId === packId);
      if (exists) return prev.filter((p) => p.packId !== packId);
      if (prev.length >= 3) return prev;
      return [...prev, { verbId, tense, packId }];
    });
  };

  const isPackSelected = (packId) => selectedPacks.some((p) => p.packId === packId);

  const getTenseLabel = (tenseId) => {
    return SPANISH_TENSES.find((t) => t.id === tenseId)?.label || tenseId;
  };

  const handleStartDrill = () => {
    const packIds = selectedPacks.map((p) => p.packId);
    navigate(`/conjugar/drill?packs=${packIds.join(",")}`);
  };

  // ── Loading skeleton ──
  if (isLoading) {
    return (
      <div className="desktop-main">
        <div className="lessons-page fade-in safe-top" style={{ paddingTop: 16 }}>
          <div style={{ marginBottom: 24 }}>
            <div className="skeleton" style={{ width: 180, height: 32, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 120, height: 18 }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ width: 64, height: 36, borderRadius: 20 }} />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ width: "100%", height: 130, marginBottom: 12, borderRadius: 16 }} />
          ))}
        </div>
        <MobileNavBar active="conjugar" />
      </div>
    );
  }

  return (
    <div className="desktop-main">
      <div className="lessons-page fade-in safe-top" style={{ paddingTop: 16 }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 20,
        }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>Conjugar</h1>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.muted, margin: "2px 0 0" }}>
              {verbs.length} verbo{verbs.length !== 1 ? "s" : ""} {"\u00b7"} {totalPacks} paquete{totalPacks !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Desktop buttons */}
          <div className="add-quiz-btn-desktop" style={{ display: "none", alignItems: "center", gap: 8 }}>
            {selectedPacks.length > 0 && (
              <button
                onClick={handleStartDrill}
                style={{
                  padding: "10px 22px", borderRadius: 12, border: `2px solid ${C.accent}`,
                  background: "transparent", color: C.accent, fontSize: 14, fontWeight: 800,
                  cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.accentLight; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                Empezar drill
              </button>
            )}
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: "10px 22px", borderRadius: 12, border: "none",
                background: C.accent, color: "white", fontSize: 14, fontWeight: 800,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
            >
              + Nuevo verbo
            </button>
          </div>

          {/* Mobile + button */}
          <button
            className="add-quiz-btn-mobile"
            onClick={() => setShowAddModal(true)}
            style={{
              width: 40, height: 40, borderRadius: 12,
              border: `2px solid ${C.border}`, background: C.card,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 16px", borderRadius: 20, border: "none",
                background: filter === f ? C.accent : "#F3F4F6",
                color: filter === f ? "white" : C.text,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
                transition: "all 0.15s",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Content */}
        {verbs.length === 0 ? (
          <EmptyState onAdd={() => setShowAddModal(true)} />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <p style={{ color: C.muted, fontSize: 15, fontWeight: 600 }}>
              No hay verbos de tipo {filter}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((verb) => (
              <VerbCard
                key={verb.id}
                verb={verb}
                selectedPacks={selectedPacks}
                onTogglePack={togglePack}
                isPackSelected={isPackSelected}
                getTenseLabel={getTenseLabel}
                onNavigate={(tense) => navigate(`/conjugar/${verb.id}/${tense}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mobile FAB - start drill */}
      {selectedPacks.length > 0 && (
        <div className="add-quiz-btn-mobile" style={{
          position: "fixed", bottom: 72, left: 16, right: 16,
          zIndex: 40, display: "flex",
        }}>
          <button
            onClick={handleStartDrill}
            style={{
              width: "100%", padding: "14px 20px", borderRadius: 16,
              background: C.accent, color: "white", border: "none",
              fontSize: 15, fontWeight: 800, cursor: "pointer",
              fontFamily: "'Nunito', sans-serif",
              boxShadow: "0 4px 20px rgba(0,180,160,0.35)",
            }}
          >
            Empezar drill {"\u00b7"} {selectedPacks.length} paquete{selectedPacks.length !== 1 ? "s" : ""}
          </button>
        </div>
      )}

      <MobileNavBar active="conjugar" />

      <AddVerbModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => { setShowAddModal(false); refresh(); }}
      />
    </div>
  );
}

// ── Verb Card ──
function VerbCard({ verb, selectedPacks, onTogglePack, isPackSelected, getTenseLabel, onNavigate }) {
  const packs = verb.packs || [];

  return (
    <div style={{
      background: C.card, borderRadius: 16,
      border: `1.5px solid ${C.border}`, padding: "16px 20px",
    }}>
      {/* Verb header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, marginBottom: packs.length > 0 ? 12 : 0,
      }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: C.text, fontFamily: "'Nunito', sans-serif" }}>
          {verb.infinitive}
        </span>
        <VerbTypeBadge type={verb.verb_type} />
        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: C.muted }}>
          {packs.length} tense{packs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tense packs */}
      <div className="conjugar-packs-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 4,
      }}>
        {packs.map((pack) => (
          <TenseRow
            key={pack.id}
            pack={pack}
            label={getTenseLabel(pack.tense)}
            selected={isPackSelected(pack.id)}
            onToggle={() => onTogglePack(verb.id, pack.tense, pack.id)}
            onNavigate={() => onNavigate(pack.tense)}
            canSelect={selectedPacks.length < 3 || isPackSelected(pack.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Tense row ──
function TenseRow({ pack, label, selected, onToggle, onNavigate, canSelect }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
      borderTop: `1px solid ${C.border}00`,
    }}>
      {/* Checkbox */}
      <button
        onClick={canSelect || selected ? onToggle : undefined}
        style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          border: selected ? "none" : `2px solid ${C.border}`,
          background: selected ? C.accent : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: canSelect || selected ? "pointer" : "not-allowed",
          opacity: canSelect || selected ? 1 : 0.4,
        }}
      >
        {selected && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Tense name + date */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.text, fontFamily: "'Nunito', sans-serif" }}>
          {label}
        </span>
        {pack.lastAttemptDate && (
          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginLeft: 8 }}>
            {timeAgo(pack.lastAttemptDate)}
          </span>
        )}
      </div>

      {/* Score badge */}
      <ScoreBadge
        percentage={pack.lastPercentage}
        isNew={pack.attemptCount === 0}
      />

      {/* Navigate arrow */}
      <button
        onClick={onNavigate}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 4,
          display: "flex", color: C.muted,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </div>
  );
}

// ── Empty state ──
function EmptyState({ onAdd }) {
  return (
    <div style={{
      textAlign: "center", padding: "60px 20px",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
    }}>
      <div style={{ fontSize: 48, marginBottom: 4 }}>{"\ud83c\udf31"}</div>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>
        {"\u00a1Empieza a conjugar!"}
      </h3>
      <p style={{ fontSize: 14, fontWeight: 600, color: C.muted, maxWidth: 300, lineHeight: 1.5 }}>
        Añade tu primer verbo y practica conjugaciones con ejercicios generados por IA.
      </p>
      <button
        onClick={onAdd}
        style={{
          padding: "12px 28px", borderRadius: 14, border: "none",
          background: C.accent, color: "white", fontSize: 15, fontWeight: 800,
          cursor: "pointer", fontFamily: "'Nunito', sans-serif",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
      >
        + Añadir verbos
      </button>
    </div>
  );
}
