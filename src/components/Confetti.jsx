import { useMemo } from "react";

export default function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 2,
      dur: 2 + Math.random() * 2,
      color: ["#00B4A0", "#00C48C", "#FF6584", "#7ED8C9", "#4A90D9", "#F5A623"][i % 6],
      size: 6 + Math.random() * 6,
      circle: Math.random() > 0.5,
    })), []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {pieces.map((p, i) => (
        <div key={i} style={{
          position: "absolute", left: `${p.left}%`, top: -20,
          width: p.size, height: p.circle ? p.size : p.size * 1.5,
          background: p.color, borderRadius: p.circle ? "50%" : 2,
          animation: `confettiDrop ${p.dur}s ${p.delay}s ease-in forwards`, opacity: 0,
        }} />
      ))}
    </div>
  );
}
