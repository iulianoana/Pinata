import { useState, useMemo } from "react";
import { C } from "../styles/theme";
import { useVocabulary, useExplainWord, useUpdateVocabulary, useDeleteVocabulary, useAddVocabulary } from "../useVocabulary";

import VocabularyEmptyState from "../components/vocabulary/VocabularyEmptyState";
import VocabularyList from "../components/vocabulary/VocabularyList";
import AddVocabularyModal from "../components/vocabulary/AddVocabularyModal";
import ConfirmModal from "../components/ConfirmModal";

export default function VocabularyScreen({ session }) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: vocabulary, isLoading, refresh } = useVocabulary();
  const { explain } = useExplainWord();
  const { updateWord } = useUpdateVocabulary();
  const { deleteWord } = useDeleteVocabulary();
  const { addWords } = useAddVocabulary();

  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [editingWord, setEditingWord] = useState(null);

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return vocabulary;
    const q = searchQuery.toLowerCase();
    return vocabulary.filter((w) =>
      w.word.toLowerCase().includes(q) ||
      w.explanation_es?.toLowerCase().includes(q) ||
      w.explanation_en?.toLowerCase().includes(q)
    );
  }, [vocabulary, searchQuery]);

  // ── Handlers ──

  const handleEdit = (word) => {
    setEditingWord(word);
    setShowAddModal(true);
  };

  const handleRerunAI = async (word) => {
    try {
      const result = await explain(word.word);
      await updateWord(word.id, {
        word: result.corrected_word || word.word,
        explanation_es: result.explanation_es,
        explanation_en: result.explanation_en,
      });
      refresh();
    } catch (e) {
      console.error("Failed to re-run AI:", e);
    }
  };

  const handleDelete = (word) => {
    setDeleteConfirm(word);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteWord(deleteConfirm.id);
      refresh();
    } catch (e) {
      console.error("Failed to delete:", e);
    }
    setDeleteConfirm(null);
  };

  // ── Loading skeleton ──

  if (isLoading) {
    return (
      <div className="fade-in" style={{ minHeight: "100vh", background: C.bg }}>
        <div className="desktop-main lessons-page safe-top" style={{ paddingTop: 16 }}>
          <div style={{ marginBottom: 24 }}>
            <div className="skeleton" style={{ width: 180, height: 32, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 80, height: 18 }} />
          </div>
          <div className="skeleton" style={{ width: "100%", height: 48, marginBottom: 16 }} />
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ width: "100%", height: 120, marginBottom: 12, borderRadius: 12 }} />
          ))}
        </div>

      </div>
    );
  }

  return (
    <div className="fade-in" style={{ minHeight: "100vh", background: C.bg }}>
      <div className="desktop-main lessons-page safe-top" style={{ paddingTop: 16 }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          marginBottom: 20,
        }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>Vocabulary</h1>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.muted, margin: "2px 0 0" }}>
              {vocabulary.length} word{vocabulary.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Desktop add button */}
          <button
            className="add-quiz-btn-desktop"
            onClick={() => setShowAddModal(true)}
            style={{
              padding: "10px 22px", borderRadius: 12, border: "none",
              background: C.accent, color: "white", fontSize: 14, fontWeight: 800,
              cursor: "pointer", fontFamily: "'Nunito', sans-serif",
              display: "none", alignItems: "center", gap: 6,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
          >
            + Add words
          </button>
        </div>

        {/* Search bar */}
        {vocabulary.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 14px", borderRadius: 12,
              border: `1.5px solid ${C.border}`, background: C.card,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vocabulary..."
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: 15, fontFamily: "'Nunito', sans-serif", fontWeight: 600,
                  color: C.text, minWidth: 0,
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    padding: 0, display: "flex", color: C.muted,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        {vocabulary.length === 0 ? (
          <VocabularyEmptyState onAdd={() => setShowAddModal(true)} />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <p style={{ color: C.muted, fontSize: 15, fontWeight: 600 }}>
              No words match &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        ) : (
          <VocabularyList
            words={filtered}
            onEdit={handleEdit}
            onRerunAI={handleRerunAI}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Mobile FAB */}
      {vocabulary.length > 0 && (
        <button
          className="add-quiz-btn-mobile"
          onClick={() => setShowAddModal(true)}
          style={{
            position: "fixed", bottom: 80, right: 20,
            width: 56, height: 56, borderRadius: "50%",
            background: C.accent, color: "white", border: "none",
            cursor: "pointer", boxShadow: "0 4px 16px rgba(0,180,160,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 40,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.accentHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}



      {/* Add/Edit Modal */}
      <AddVocabularyModal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingWord(null); }}
        onSuccess={refresh}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteConfirm}
        title="Delete word"
        message={`Remove "${deleteConfirm?.word}" from your vocabulary?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        destructive
      />
    </div>
  );
}
