import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Gamepad2, Heart } from 'lucide-react';

const HEART_COUNT = 22;

export function WelcomeOverlay({ onDismiss }: { onDismiss: () => void }) {
  const hearts = useMemo(
    () =>
      Array.from({ length: HEART_COUNT }, (_, i) => ({
        id: i,
        left: 3 + Math.random() * 94,
        size: 12 + Math.random() * 22,
        duration: 2.8 + Math.random() * 2.8,
        delay: Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 70,
      })),
    [],
  );

  return (
    <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-hearts" aria-hidden="true">
        {hearts.map((heart) => (
          <span
            key={heart.id}
            className="welcome-heart"
            style={
              {
                left: `${heart.left}%`,
                fontSize: `${heart.size}px`,
                animationDuration: `${heart.duration}s`,
                animationDelay: `${heart.delay}s`,
                '--drift': `${heart.drift}px`,
              } as CSSProperties
            }
          >
            ❤
          </span>
        ))}
      </div>
      <div className="welcome-card animate-rise-in">
        <div className="welcome-icon">
          <Heart size={30} fill="currentColor" />
        </div>
        <p className="eyebrow">someone missed you</p>
        <h1 id="welcome-title">Halo, sayang. 💕</h1>
        <p className="welcome-copy">Semua kenangan kita udah nunggu buat dibuka. Siap-siap senyum sendiri ya.</p>
        <button
          type="button"
          className="button button-primary welcome-button"
          onClick={onDismiss}
          data-testid="button-dismiss-welcome"
        >
          <Gamepad2 size={16} /> Buka kenangan kita
        </button>
      </div>
    </div>
  );
}
