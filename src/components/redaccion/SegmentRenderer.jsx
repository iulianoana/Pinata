// Inline renderer for correction.segments[]. Every note is visible at all
// times — no hover, no tooltips, no accordions. The review page is meant to
// be screenshot-ready.

export default function SegmentRenderer({ segments }) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  return (
    <div className="font-nunito text-[17px] leading-[1.9] text-[#0F1720] whitespace-pre-wrap">
      {segments.map((seg, i) => {
        if (seg.type === "ok") {
          return <span key={i}>{seg.text}</span>;
        }
        if (seg.type === "major") {
          return (
            <span key={i}>
              <span
                className="px-1 py-[1px] rounded mr-1"
                style={{
                  color: "#991B1B",
                  background: "#FEF2F2",
                  textDecoration: "line-through",
                  textDecorationColor: "#EF4444",
                  textDecorationThickness: "2px",
                }}
              >
                {seg.original}
              </span>
              <span
                className="px-[5px] py-[1px] rounded font-bold"
                style={{ color: "#065F46", background: "#D1FAE5" }}
              >
                {seg.correction}
              </span>
              <span className="italic text-[0.8125rem] text-[#6B7280] ml-1">
                ({seg.note})
              </span>
            </span>
          );
        }
        if (seg.type === "minor") {
          return (
            <span key={i}>
              <span
                className="px-1 py-[1px] rounded"
                style={{
                  color: "#92400E",
                  background: "#FFFBEB",
                  borderBottom: "2px dotted #F59E0B",
                }}
              >
                {seg.original}
              </span>
              <span className="italic text-[0.8125rem] text-[#6B7280] ml-1">
                [→{" "}
                <span
                  className="not-italic px-[5px] py-[1px] rounded font-semibold"
                  style={{ color: "#B45309", background: "#FEF3C7" }}
                >
                  {seg.suggestion}
                </span>
                ] ({seg.note})
              </span>
            </span>
          );
        }
        return null;
      })}
    </div>
  );
}
