import { useState, useEffect, useRef } from "react";
import { C } from "../../styles/theme";
import { searchLessons } from "../../lib/api";

export default function LessonSearch({ onSelectResult, onActiveChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef();
  const debounceRef = useRef();

  const isActive = query.length > 0 || focused;

  useEffect(() => {
    onActiveChange?.(query.length > 0);
  }, [query]);

  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchLessons(query.trim());
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleCancel = () => {
    setQuery("");
    setResults(null);
    setFocused(false);
    inputRef.current?.blur();
  };

  return (
    <div>
      {/* Search input row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          background: C.card, border: `1.5px solid ${focused ? C.accent : C.border}`,
          borderRadius: 12, padding: "10px 14px", transition: "border-color 0.15s",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 100)}
            placeholder="Search all lessons..."
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: 14, fontWeight: 600, color: C.text,
              fontFamily: "'Nunito', sans-serif",
            }}
          />
        </div>
        {isActive && (
          <button onClick={handleCancel} style={{
            background: "none", border: "none", color: C.accent, fontWeight: 700,
            fontSize: 14, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
            padding: "8px 0", whiteSpace: "nowrap",
          }}>Cancel</button>
        )}
      </div>

      {/* Search results */}
      {query.trim() && (
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ color: C.muted, fontSize: 13, fontWeight: 600 }}>Searching...</p>
            </div>
          ) : results && results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <p style={{ color: C.muted, fontSize: 14, fontWeight: 600 }}>No results found</p>
            </div>
          ) : results ? (
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 10 }}>
                {results.length} result{results.length !== 1 ? "s" : ""}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {results.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => onSelectResult(r)}
                    className="search-result-card"
                    style={{
                      background: C.card, borderRadius: 12, padding: "14px 16px",
                      cursor: "pointer", border: `1px solid ${C.border}`,
                      transition: "border-color 0.15s, box-shadow 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,60,50,0.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 4 }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 8 }}>
                      Week {r.week_number} · {r.week_title}
                    </div>
                    {r.headline && (
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: C.muted, lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{ __html: r.headline }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
