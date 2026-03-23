import { useRef, useEffect } from "react";

export default function Translate({ q, value, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) { ref.current.style.height = "auto"; ref.current.style.height = ref.current.scrollHeight + "px"; }
  }, [value?.text]);
  useEffect(() => { if (ref.current) ref.current.focus(); }, [q]);

  return (
    <div>
      {q.direction && (
        <div className="flex items-center gap-2 mb-4 text-muted text-sm font-bold">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
          {q.direction}
        </div>
      )}
      <textarea ref={ref} value={value?.text || ""} onChange={(e) => onChange({ text: e.target.value })}
        placeholder="Type your translation here..." rows={2}
        className="w-full p-3.5 rounded-[14px] border-[2.5px] border-border bg-transparent text-[15px] font-semibold resize-none outline-none overflow-hidden leading-relaxed text-text transition-[border-color] duration-200 min-h-[80px] font-nunito focus:border-accent" />
      {q.hint && <p className="text-muted text-xs font-semibold mt-2.5 leading-normal">💡 {q.hint}</p>}
    </div>
  );
}
