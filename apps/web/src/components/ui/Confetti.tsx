import { memo, useEffect, useRef, useState } from "react";

interface ConfettiProps {
  /** Increment to fire a new burst. Each new value triggers one animation. */
  trigger: number;
  onComplete?: () => void;
}

const PARTICLE_COUNT = 30;
const COLORS = [
  "var(--vie-coral, #f97066)",
  "var(--vie-plum, #a78bfa)",
  "var(--vie-sky, #38bdf8)",
  "var(--vie-mint, #34d399)",
  "var(--vie-honey, #fbbf24)",
  "var(--vie-rose, #fb7185)",
];

interface Particle {
  id: number;
  x: number;
  delay: number;
  color: string;
  size: number;
  rotation: number;
  shape: "circle" | "square";
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
    shape: Math.random() > 0.5 ? "circle" : "square",
  }));
}

/**
 * CSS-only confetti burst animation.
 * Respects prefers-reduced-motion. Auto-removes after animation.
 * Keyframes defined in index.css (confetti-fall).
 */
export const Confetti = memo(function Confetti({
  trigger,
  onComplete,
}: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (trigger <= 0) return;

    // Respect reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onCompleteRef.current?.();
      return;
    }

    setParticles(generateParticles());
    setVisible(true);

    const timeout = setTimeout(() => {
      setVisible(false);
      setParticles([]);
      onCompleteRef.current?.();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[100] overflow-hidden"
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-[confetti-fall_1.5s_ease-out_forwards]"
          style={{
            left: `${p.x}%`,
            top: "-10px",
            animationDelay: `${p.delay}s`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
});
