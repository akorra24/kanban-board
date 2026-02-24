import { useEffect, useState } from "react";

const PARTICLES = 12;
const COLORS = ["#22c55e", "#eab308", "#3b82f6", "#a855f7", "#ef4444", "#06b6d4"];

// Precomputed end positions for a subtle burst (px from center)
const BURST_OFFSETS = [
  [0, -55], [30, -45], [45, -25], [45, 10], [30, 40], [0, 55],
  [-30, 45], [-45, 25], [-45, -10], [-30, -45], [20, -35], [-20, -35],
];

export function ConfettiBurst({
  onComplete,
  duration = 600,
}: {
  onComplete?: () => void;
  duration?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion || !visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[70]"
      aria-hidden="true"
    >
      {BURST_OFFSETS.slice(0, PARTICLES).map(([x, y], i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full opacity-90"
          style={{
            backgroundColor: COLORS[i % COLORS.length],
            transform: "translate(-50%, -50%)",
            animation: `confetti-burst ${duration}ms ease-out forwards`,
            ["--tx" as string]: `${x}px`,
            ["--ty" as string]: `${y}px`,
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-burst {
          to {
            transform: translate(calc(-50% + var(--tx, 0)), calc(-50% + var(--ty, 0)));
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
