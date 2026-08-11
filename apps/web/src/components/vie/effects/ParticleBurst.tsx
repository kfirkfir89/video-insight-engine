import { memo, useEffect, useRef } from 'react';

interface ParticleBurstProps {
  /** When this key changes, a new burst fires. */
  trigger: number | string | boolean;
  /** Particle count — default 48. Clamp to 120 for mobile perf. */
  count?: number;
  /** OKLCH colors to sample from. Defaults to the VIE hero palette. */
  colors?: string[];
  /** Burst origin (percent). Default 50/50. */
  originX?: number;
  originY?: number;
  /** Spread angle in degrees. Default 160 (fan upward). */
  spread?: number;
  /** Skip rendering entirely (e.g. reduced-motion or disabled). */
  disabled?: boolean;
  className?: string;
}

const DEFAULT_COLORS = [
  'oklch(72% 0.18 292)', // primary violet
  'oklch(75% 0.16 25)',  // coral
  'oklch(82% 0.15 80)',  // honey
  'oklch(78% 0.14 165)', // mint
  'oklch(68% 0.16 350)', // rose
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  size: number;
  color: string;
  shape: 'rect' | 'circle';
  life: number;
}

/**
 * Canvas-based celebration burst — gravity physics, fan spread, life fade.
 * Fires once per change of `trigger`. Respects reduced motion via `disabled`.
 */
export const ParticleBurst = memo(function ParticleBurst({
  trigger,
  count = 48,
  colors = DEFAULT_COLORS,
  originX = 50,
  originY = 50,
  spread = 160,
  disabled,
  className,
}: ParticleBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  // Config is snapshotted via a ref so an inline-array `colors` prop (or any
  // unstable reference from the parent) doesn't refire the burst on every
  // render. Only `trigger` and `disabled` drive the effect — matching the
  // doc's "Fires once per change of trigger" contract. The ref is synced in
  // a post-commit effect (writes during render are disallowed by react-hooks),
  // which runs before the trigger-driven effect on the same render so the
  // burst sees the latest config.
  const cfgRef = useRef({ count, colors, originX, originY, spread });
  useEffect(() => {
    cfgRef.current = { count, colors, originX, originY, spread };
  });

  useEffect(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { count, colors, originX, originY, spread } = cfgRef.current;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = parent.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const cx = (originX / 100) * rect.width;
    const cy = (originY / 100) * rect.height;
    const clampedCount = Math.min(count, 120);
    const spreadRad = (spread * Math.PI) / 180;
    const baseAngle = -Math.PI / 2;

    const particles: Particle[] = Array.from({ length: clampedCount }, () => {
      const angle = baseAngle + (Math.random() - 0.5) * spreadRad;
      const speed = 3 + Math.random() * 5;
      return {
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.3,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
        life: 1,
      };
    });

    const gravity = 0.14;
    const drag = 0.985;
    const decay = 0.012;

    const draw = (): void => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      let alive = 0;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive++;
        p.vy += gravity;
        p.vx *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;
        p.life -= decay;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (alive > 0) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, rect.width, rect.height);
      }
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [trigger, disabled]);

  if (disabled) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className ?? ''}`}
    />
  );
});
