import { useRef, useEffect } from "react";

export default function FillBlank({ q, value, onChange, onSubmit }) {
  const blanks = value?.blanks || [];
  const parts = q.prompt.split(/(___+)/);
  const inputRefs = useRef([]);
  let idx = 0;

  useEffect(() => {
    if (inputRefs.current[0]) inputRefs.current[0].focus();
  }, [q]);

  const update = (i, v) => {
    const nb = [...blanks]; nb[i] = v; onChange({ blanks: nb });
  };

  const blankCount = parts.filter((p) => /^___+$/.test(p)).length;

  const handleKeyDown = (i, e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputRefs.current[i + 1]) inputRefs.current[i + 1].focus();
      else if (i === blankCount - 1 && onSubmit) onSubmit();
    }
  };

  return (
    <div>
      <div className="text-lg font-semibold leading-[2.4] mb-2">
        {parts.map((p, pi) => {
          if (/^___+$/.test(p)) {
            const ci = idx++;
            return (
              <input key={pi} ref={(el) => (inputRefs.current[ci] = el)}
                type="text" value={blanks[ci] || ""} onChange={(e) => update(ci, e.target.value)}
                onKeyDown={(e) => handleKeyDown(ci, e)}
                placeholder="" autoComplete="off"
                className="inline-block border-[2.5px] border-border rounded-[10px] bg-input-bg px-3 py-1.5 mx-1 text-center text-accent font-bold outline-none min-w-[100px] min-h-[44px] text-[inherit] leading-[inherit] font-nunito transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(0,180,160,0.125)]"
              />
            );
          }
          return <span key={pi}>{p}</span>;
        })}
      </div>
      {q.hint && <p className="text-muted text-xs font-semibold mt-3 leading-normal">💡 {q.hint}</p>}
    </div>
  );
}
