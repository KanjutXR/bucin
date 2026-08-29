import { useEffect, useRef } from 'react';

type Flake = {
  x: number;
  y: number;
  r: number;
  speed: number;
  drift: number;
  sway: number;
  opacity: number;
};

/**
 * Full-viewport falling snow. Flakes settle into a drift at the bottom of
 * the screen; once the pile gets tall enough it melts away and the cycle
 * starts again.
 */
export function Snowfall() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let cancelled = false;
    let raf = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const flakeCount = reduceMotion ? 0 : width < 720 ? 42 : 85;

    const flakes: Flake[] = Array.from({ length: flakeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 1.3 + Math.random() * 2.5,
      speed: 0.35 + Math.random() * 0.85,
      drift: Math.random() * Math.PI * 2,
      sway: 0.3 + Math.random() * 0.7,
      opacity: 0.35 + Math.random() * 0.5,
    }));

    const maxLevel = 30;
    let snowLevel = 0;
    let melting = false;

    const scheduleMelt = () => {
      window.setTimeout(() => {
        if (cancelled) return;
        const step = () => {
          if (cancelled) return;
          snowLevel = Math.max(0, snowLevel - 0.35);
          if (snowLevel > 0) {
            window.setTimeout(step, 30);
          } else {
            melting = false;
          }
        };
        step();
      }, 1400);
    };

    const draw = () => {
      if (cancelled) return;
      ctx.clearRect(0, 0, width, height);

      if (snowLevel > 0.15) {
        const baseY = height - snowLevel;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, baseY + 6);
        const bumps = 9;
        for (let i = 0; i <= bumps; i += 1) {
          const bx = (width / bumps) * i;
          const by = baseY + Math.sin(i * 1.3 + Date.now() * 0.0002) * 4;
          ctx.lineTo(bx, by);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 250, 246, 0.88)';
        ctx.shadowColor = 'rgba(255,255,255,0.55)';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.restore();
      }

      flakes.forEach((flake) => {
        flake.y += flake.speed;
        flake.drift += 0.012;
        flake.x += Math.sin(flake.drift) * flake.sway * 0.3;

        const floorY = height - snowLevel;
        if (flake.y >= floorY) {
          flake.y = -4;
          flake.x = Math.random() * width;
          if (!melting) snowLevel = Math.min(maxLevel, snowLevel + 0.055);
        }
        if (flake.x < -6) flake.x = width + 6;
        if (flake.x > width + 6) flake.x = -6;

        ctx.beginPath();
        ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${flake.opacity})`;
        ctx.fill();
      });

      if (!melting && snowLevel >= maxLevel) {
        melting = true;
        scheduleMelt();
      }

      raf = requestAnimationFrame(draw);
    };

    if (flakeCount > 0) raf = requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="snowfall-canvas" aria-hidden="true" />;
}

const HEART_SLOTS = Array.from({ length: 9 }, (_, i) => i);

/** Soft, slow-drifting hearts across the whole page for extra ambiance. */
export function AmbientHearts() {
  return (
    <div className="ambient-hearts" aria-hidden="true">
      {HEART_SLOTS.map((i) => (
        <span key={i} className={`ambient-heart ambient-heart-${i}`}>
          ❤
        </span>
      ))}
    </div>
  );
}
