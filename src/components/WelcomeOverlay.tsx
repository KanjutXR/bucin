import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Gamepad2, Heart } from 'lucide-react';

const HEART_COUNT = 22;
const BONUS_HEART_COUNT = 7;

const GREETINGS = [
  { title: 'Halo, sayang. 💕', body: 'Semua kenangan kita udah nunggu buat dibuka. Siap-siap senyum sendiri ya.' },
  { title: 'Eh, kamu datang! 🥹', body: 'Buku ini nungguin kamu dari tadi. Yuk buka pelan-pelan.' },
  { title: 'Selamat datang balik. 🎮', body: 'Save point kita ada di sini terus, kapan pun kamu mau mampir.' },
  { title: 'Kangen deh. 💌', body: 'Satu halaman lagi, satu senyum lagi. Ayo mulai.' },
];

type FloatingHeart = { id: number; left: number; size: number; duration: number; delay: number; drift: number };

function makeHearts(count: number, idOffset = 0): FloatingHeart[] {
  return Array.from({ length: count }, (_, i) => ({
    id: idOffset + i,
    left: 3 + Math.random() * 94,
    size: 12 + Math.random() * 22,
    duration: 2.8 + Math.random() * 2.8,
    delay: Math.random() * 1.6,
    drift: (Math.random() - 0.5) * 70,
  }));
}

export function WelcomeOverlay({ onDismiss }: { onDismiss: () => void }) {
  const greeting = useMemo(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)], []);
  const [hearts, setHearts] = useState<FloatingHeart[]>(() => makeHearts(HEART_COUNT));
  const [taps, setTaps] = useState(0);

  const addBonusHearts = () => {
    setTaps((count) => count + 1);
    setHearts((current) => [...current, ...makeHearts(BONUS_HEART_COUNT, current.length + Math.random())]);
  };

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
        <button
          type="button"
          className="welcome-icon"
          onClick={addBonusHearts}
          aria-label="Tap buat hati bonus"
          data-testid="button-welcome-tap-heart"
        >
          <Heart size={30} fill="currentColor" />
        </button>
        <p className="eyebrow">someone missed you</p>
        <h1 id="welcome-title">{greeting.title}</h1>
        <p className="welcome-copy">{greeting.body}</p>
        {taps > 0 && (
          <p className="welcome-tap-note animate-rise-in" data-testid="text-welcome-tap-count">
            {taps === 1 ? 'satu ketukan sayang, tersimpan. 🤏' : `${taps} ketukan sayang, makin banyak. 🥰`}
          </p>
        )}
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
