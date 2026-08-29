import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent, MouseEvent, ReactNode, TouchEvent } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Edit3,
  Gamepad2,
  Grid2X2,
  Heart,
  ImagePlus,
  Library,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Minus,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video as VideoIcon,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AmbientHearts, Snowfall } from './components/Ambience';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { MusicPlayer } from './components/MusicPlayer';
import { STORE_MEDIA } from './lib/media-db';
import { useBlobUrl } from './lib/use-blob-url';

type MemoryMedia = {
  id: string;
  kind: 'image' | 'video';
  /** inline base64 data url — used for images */
  dataUrl?: string;
  /** IndexedDB blob id — used for videos (too big for localStorage) */
  blobId?: string;
  mime?: string;
};

type MemoryCategory = 'game' | 'trend';

type Memory = {
  id: string;
  title: string;
  date: string;
  game: string;
  caption: string;
  media: MemoryMedia[];
  art: 'forest' | 'space' | 'cafe' | 'island' | 'cozy';
  savedAt: string;
  /** 'game' = a co-op gaming session, 'trend' = a photo/video trend we
   *  recreated together. Older saved memories won't have this field yet —
   *  always read it through `memoryCategory()` below, never bare. */
  category?: MemoryCategory;
};

/** Safe accessor for `category` — memories saved before this field existed
 *  simply don't have it, and should keep behaving like game memories. */
function memoryCategory(memory: Memory): MemoryCategory {
  return memory.category === 'trend' ? 'trend' : 'game';
}

type MemoryDraft = Omit<Memory, 'id' | 'savedAt'>;

const STORAGE_KEY = 'kenangan-game-kita-memories';
const DOODLE_KEY = 'kenangan-game-kita-doodle-image';
const WELCOME_SEEN_KEY = 'kenangan-game-kita-welcome-seen';

const starterMemories: Memory[] = [
  {
    id: 'stardew-first-snow',
    title: 'The first snow',
    date: '08 Dec 2023',
    game: 'Stardew Valley',
    caption:
      'We spent an hour pretending to fish, then stayed up for the snow. You gave me the purple hat. I still wear it in my head.',
    media: [],
    art: 'forest',
    savedAt: '2023-12-08T23:48:00.000Z',
    category: 'game',
  },
  {
    id: 'it-takes-two-bridge',
    title: 'Absolutely not the bridge',
    date: '21 Jan 2024',
    game: 'It Takes Two',
    caption:
      'The tiny bridge was not tiny. We fell six times, blamed the controls, and somehow made it to the other side together.',
    media: [],
    art: 'space',
    savedAt: '2024-01-21T22:16:00.000Z',
    category: 'game',
  },
  {
    id: 'plate-up-midnight',
    title: 'Midnight service',
    date: '02 Mar 2024',
    game: 'PlateUp!',
    caption:
      'Table twelve wanted soup. Table seven wanted pancakes. We wanted to close the restaurant. Love, apparently, is doing one more shift.',
    media: [],
    art: 'cafe',
    savedAt: '2024-03-02T00:42:00.000Z',
    category: 'game',
  },
  {
    id: 'minecraft-lighthouse',
    title: 'A lighthouse for us',
    date: '14 Apr 2024',
    game: 'Minecraft',
    caption:
      'You built the windows. I built the stairs. Neither of us measured anything. It glows across the water every night.',
    media: [],
    art: 'island',
    savedAt: '2024-04-14T21:05:00.000Z',
    category: 'game',
  },
  {
    id: 'overcooked-kitchen',
    title: 'We are the kitchen',
    date: '29 Jun 2024',
    game: 'Overcooked! 2',
    caption:
      'Three stars, one burnt onion, and a very serious conversation about chopping technique. A perfect little disaster.',
    media: [],
    art: 'cozy',
    savedAt: '2024-06-29T23:11:00.000Z',
    category: 'game',
  },
  {
    id: 'transition-trend-hallway',
    title: 'That transition trend, finally',
    date: '19 Aug 2024',
    game: 'Couple transition trend',
    caption:
      'Filmed it eleven times because someone kept laughing before the beat drop. The blurry one is still the one we posted.',
    media: [],
    art: 'space',
    savedAt: '2024-08-19T20:30:00.000Z',
    category: 'trend',
  },
];

const palette = {
  forest: { bg: '#425f55', sky: '#d7af91', ink: '#f8e8cd' },
  space: { bg: '#252d57', sky: '#e9b7a1', ink: '#fce8d0' },
  cafe: { bg: '#994b51', sky: '#f5c979', ink: '#fff0d3' },
  island: { bg: '#35777c', sky: '#f3c283', ink: '#ffefcf' },
  cozy: { bg: '#704a57', sky: '#e5a983', ink: '#fff0da' },
};

function normalizeMemories(parsed: unknown): Memory[] | null {
  if (!Array.isArray(parsed)) return null;
  // migrate the old `images: string[]` shape into `media: MemoryMedia[]`
  return parsed.map((item: Memory & { images?: string[] }) => {
    if (Array.isArray(item.media)) return { ...item, category: memoryCategory(item) } as Memory;
    const legacyImages = Array.isArray(item.images) ? item.images : [];
    return {
      ...item,
      category: memoryCategory(item),
      media: legacyImages.map((dataUrl, index) => ({
        id: `${item.id}-legacy-${index}`,
        kind: 'image' as const,
        dataUrl,
      })),
    } as Memory;
  });
}

/** Reads any leftover data from this browser's old local-only version, so the
 *  very first cloud sync doesn't wipe out memories someone already saved. */
function readLegacyLocalMemories(): Memory[] | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const normalized = normalizeMemories(JSON.parse(saved));
    return normalized && normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

function readLegacyLocalDoodle(): string | null {
  try {
    return localStorage.getItem(DOODLE_KEY);
  } catch {
    return null;
  }
}

/** Uploads a file straight to Vercel Blob storage (admin-only endpoint) and
 *  resolves with its public URL. */
async function uploadFile(file: File): Promise<string> {
  const response = await fetch('/api/media/upload', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'X-Filename': encodeURIComponent(file.name || 'file'),
    },
    body: file,
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || 'Upload failed');
  return data.url as string;
}

function downloadMemory(memory: Memory) {
  const lines = [
    `KENANGAN / ${memory.title.toUpperCase()}`,
    `${memory.date} · ${memory.game}`,
    '',
    memory.caption,
    '',
    'Saved from Kenangan Game Kita.',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${memory.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatToday() {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());
}

function Doodle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`doodle ${className}`}>{children}</span>;
}

function PageMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 70" className="absolute -right-3 -top-7 h-16 w-24 text-primary/30">
      <path d="M8 42c12-29 27-39 36-23 7 12 7 26 14 26 10 0 7-36 23-37 12-1 14 17 10 29" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M91 14l10-8M98 21l13-3M88 26l3 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const SPARKLE_COUNT = 10;

function SparkleBurst({ trigger }: { trigger: number }) {
  const pieces = useMemo(() => {
    if (!trigger) return [];
    return Array.from({ length: SPARKLE_COUNT }, (_, i) => {
      const angle = ((360 / SPARKLE_COUNT) * i + Math.random() * 20) * (Math.PI / 180);
      const distance = 46 + Math.random() * 40;
      return {
        id: i,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        delay: Math.random() * 0.1,
        size: 10 + Math.random() * 8,
        glyph: Math.random() > 0.5 ? '❤' : '✦',
      };
    });
  }, [trigger]);

  if (!trigger) return null;

  return (
    <div className="sparkle-burst" key={trigger} aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="sparkle-piece"
          style={
            {
              '--dx': `${piece.dx}px`,
              '--dy': `${piece.dy}px`,
              '--delay': `${piece.delay}s`,
              fontSize: `${piece.size}px`,
            } as CSSProperties
          }
        >
          {piece.glyph}
        </span>
      ))}
    </div>
  );
}

const TAP_HEART_GLYPHS = ['❤', '💕', '✨'];

/** Wraps a photo/video so a quick double-tap or double-click pops a big
 *  heart right where the finger/cursor landed — an Instagram-y little treat. */
function TapHeartLayer({ children }: { children: ReactNode }) {
  const lastTapRef = useRef(0);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number; glyph: string }[]>([]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < 380;
    lastTapRef.current = now;
    if (!isDoubleTap) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const heart = {
      id: now + Math.random(),
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      glyph: TAP_HEART_GLYPHS[Math.floor(Math.random() * TAP_HEART_GLYPHS.length)],
    };
    setHearts((current) => [...current, heart]);
    window.setTimeout(() => {
      setHearts((current) => current.filter((item) => item.id !== heart.id));
    }, 900);
  };

  return (
    <div className="tap-heart-layer" onClick={handleClick} data-testid="layer-tap-heart">
      {children}
      {hearts.map((heart) => (
        <span key={heart.id} className="tap-heart-pop" style={{ left: heart.x, top: heart.y } as CSSProperties} aria-hidden="true">
          {heart.glyph}
        </span>
      ))}
    </div>
  );
}

/** Gentle mouse-driven 3D tilt for the active memory photo — desktop only
 *  (touch devices simply never fire mousemove, so nothing extra to guard). */
function useTilt(maxDeg = 6) {
  const ref = useRef<HTMLDivElement>(null);
  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    node.style.setProperty('--tilt-x', `${(-py * maxDeg).toFixed(2)}deg`);
    node.style.setProperty('--tilt-y', `${(px * maxDeg).toFixed(2)}deg`);
  };
  const handleLeave = () => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty('--tilt-x', '0deg');
    node.style.setProperty('--tilt-y', '0deg');
  };
  return { ref, handleMove, handleLeave };
}

const HUG_HEART_COUNT = 26;
const HUG_GLYPHS = ['🤗', '💞', '❤', '✨'];

/** A one-shot shower of hearts across the whole screen, used for the "kirim
 *  pelukan" button and for celebrating memory-count milestones. */
function HugBurst({ trigger }: { trigger: number }) {
  const hearts = useMemo(() => {
    if (!trigger) return [];
    return Array.from({ length: HUG_HEART_COUNT }, (_, i) => ({
      id: i,
      left: 2 + Math.random() * 96,
      size: 14 + Math.random() * 26,
      duration: 2.4 + Math.random() * 2.2,
      delay: Math.random() * 0.6,
      drift: (Math.random() - 0.5) * 90,
      glyph: HUG_GLYPHS[Math.floor(Math.random() * HUG_GLYPHS.length)],
    }));
  }, [trigger]);

  if (!trigger) return null;

  return (
    <div className="hug-burst" key={trigger} aria-hidden="true">
      {hearts.map((heart) => (
        <span
          key={heart.id}
          className="hug-burst-heart"
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
          {heart.glyph}
        </span>
      ))}
    </div>
  );
}

const HUG_MESSAGES = [
  'Pelukan terkirim! Semoga sampai. 🤗',
  'Satu pelukan hangat, meluncur ke kamu. 💞',
  'Peluk jarak jauh, tapi rasanya beneran. 🫂',
  'Dikirim dengan sayang. Sampai-sampai ya. 💌',
  'Pelukan darurat terkirim, semoga harimu membaik. 🤍',
];

const GUEST_CAPTIONS = [
  'private little archive',
  'made of inside jokes',
  'still pressing start together',
  'a museum of us',
];

function MemoryMediaView({ item, compact }: { item: MemoryMedia; compact?: boolean }) {
  // Uploads now live straight on Vercel Blob (item.dataUrl is a real URL) —
  // that used to be true only for photos, so videos were still being looked
  // up in this browser's local IndexedDB copy (item.blobId), which no longer
  // gets written to. That left every uploaded video stuck on a loading
  // spinner forever. We only fall back to IndexedDB for the rare legacy clip
  // saved before the cloud migration that truly has no dataUrl yet.
  const needsBlob = item.kind === 'video' && !compact && !item.dataUrl;
  const blobUrl = useBlobUrl(STORE_MEDIA, needsBlob ? item.blobId : undefined);
  const videoSrc = item.dataUrl ?? blobUrl ?? undefined;
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, videoSrc]);

  if (item.kind === 'video') {
    if (compact) {
      return (
        <div className="memory-video-placeholder">
          <VideoIcon size={18} />
        </div>
      );
    }
    if (!videoSrc) {
      return (
        <div className="memory-photo-loading">
          <Loader2 size={18} className="spin" />
        </div>
      );
    }
    return (
      <div className="memory-video-wrap">
        <video ref={videoRef} src={videoSrc} autoPlay loop muted={muted} playsInline />
        <button
          type="button"
          className="video-mute-toggle"
          onClick={(event) => {
            event.stopPropagation();
            setMuted((value) => !value);
          }}
          aria-label={muted ? 'Nyalakan suara video' : 'Matikan suara video'}
          data-testid="button-toggle-video-sound"
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
    );
  }

  return <img src={item.dataUrl} alt="Photo from this memory" />;
}

function MemoryArtwork({ memory, compact = false }: { memory: Memory; compact?: boolean }) {
  const colors = palette[memory.art];
  const cover = memory.media[0];
  if (cover) {
    return (
      <div className={`memory-photo ${compact ? 'memory-photo-compact' : ''}`}>
        <MemoryMediaView item={cover} compact={compact} />
        {!compact && cover.kind === 'image' && (
          <span className="photo-heart-tag" aria-hidden="true">
            <Heart size={11} fill="currentColor" />
          </span>
        )}
        {memory.media.length > 1 && (
          <div className="memory-photo-count"><Camera size={12} /> {memory.media.length}</div>
        )}
      </div>
    );
  }
  return (
    <div
      className={`memory-art memory-art-${memory.art} ${compact ? 'memory-art-compact' : ''}`}
      style={{ '--art-bg': colors.bg, '--art-sky': colors.sky, '--art-ink': colors.ink } as CSSProperties}
      aria-label={`Illustration for ${memory.title}`}
    >
      <span className="art-sun" />
      <span className="art-moon" />
      <span className="art-cloud cloud-a" />
      <span className="art-cloud cloud-b" />
      <span className="art-hill hill-back" />
      <span className="art-hill hill-front" />
      <span className="art-tree tree-a" />
      <span className="art-tree tree-b" />
      <span className="art-character character-a" />
      <span className="art-character character-b" />
      <span className="art-window" />
      <span className="art-star star-a" />
      <span className="art-star star-b" />
      <span className="art-sticker">{memoryCategory(memory) === 'trend' ? 'TREND' : memory.art === 'space' ? 'CO-OP' : 'PLAY LOG'}</span>
      <span className="art-caption">{memory.game}</span>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state" data-testid="empty-memories">
      <div className="empty-icon"><Library size={27} /></div>
      <p className="eyebrow">the next page is yours</p>
      <h2>No memories here yet.</h2>
      <p>Take a screenshot after the next late-night session and tuck it in.</p>
      <button className="button button-primary" onClick={onAdd} data-testid="button-add-first-memory">
        <Plus size={16} /> Add your first memory
      </button>
    </div>
  );
}

function MediaStripThumb({ item }: { item: MemoryMedia }) {
  const needsBlob = item.kind === 'video' && !item.dataUrl;
  const blobUrl = useBlobUrl(STORE_MEDIA, needsBlob ? item.blobId : undefined);
  if (item.kind === 'video') {
    const videoSrc = item.dataUrl ?? blobUrl;
    return videoSrc ? (
      <video src={videoSrc} muted playsInline />
    ) : (
      <div className="video-thumb-loading"><Loader2 size={14} className="spin" /></div>
    );
  }
  return <img src={item.dataUrl} alt="Upload preview" />;
}

function MemoryModal({
  memory,
  onClose,
  onSave,
}: {
  memory?: Memory;
  onClose: () => void;
  onSave: (draft: MemoryDraft, id?: string) => void;
}) {
  const [title, setTitle] = useState(memory?.title ?? '');
  const [category, setCategory] = useState<MemoryCategory>(memory ? memoryCategory(memory) : 'game');
  const [game, setGame] = useState(memory?.game ?? '');
  const [caption, setCaption] = useState(memory?.caption ?? '');
  const [date, setDate] = useState(memory?.date ?? formatToday());
  const [art, setArt] = useState<Memory['art']>(memory?.art ?? 'cozy');
  const [media, setMedia] = useState<MemoryMedia[]>(memory?.media ?? []);
  const [isReading, setIsReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
    );
    event.target.value = '';
    if (!files.length) return;
    setIsReading(true);
    Promise.all(
      files.map(
        (file): Promise<MemoryMedia> =>
          uploadFile(file).then((url) => ({
            id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            kind: file.type.startsWith('video/') ? ('video' as const) : ('image' as const),
            dataUrl: url,
            mime: file.type,
          })),
      ),
    )
      .then((newMedia) => {
        setMedia((current) => [...current, ...newMedia].slice(0, 8));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Gagal mengunggah salah satu file. Coba lagi ya.';
        window.alert(message);
      })
      .finally(() => setIsReading(false));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !caption.trim()) return;
    onSave(
      {
        title: title.trim(),
        category,
        game: game.trim() || (category === 'trend' ? 'A trend we tried' : 'A game we played'),
        caption: caption.trim(),
        date: date.trim() || formatToday(),
        media,
        art,
      },
      memory?.id,
    );
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-sheet animate-rise-in" role="dialog" aria-modal="true" aria-labelledby="memory-form-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">{memory ? 'turn the page' : 'a fresh page'}</p>
            <h2 id="memory-form-title">{memory ? 'Edit this little moment' : 'Add a memory'}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close form" data-testid="button-close-memory-form"><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div className="category-toggle" role="group" aria-label="Jenis kenangan">
            <button
              type="button"
              className={category === 'game' ? 'active' : ''}
              onClick={() => setCategory('game')}
              data-testid="button-category-game"
            >
              <Gamepad2 size={14} /> Malam main game
            </button>
            <button
              type="button"
              className={category === 'trend' ? 'active' : ''}
              onClick={() => setCategory('trend')}
              data-testid="button-category-trend"
            >
              <Sparkles size={14} /> Trend bareng dia
            </button>
          </div>
          <div className="form-grid">
            <label className="field field-wide">
              <span>What do we call it?</span>
              <input
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={category === 'trend' ? 'That transition trend, finally' : 'The night we found the lighthouse'}
                data-testid="input-memory-title"
              />
            </label>
            <label className="field">
              <span>{category === 'trend' ? 'Nama trend' : 'Game / place'}</span>
              <input
                value={game}
                onChange={(event) => setGame(event.target.value)}
                placeholder={category === 'trend' ? 'Couple transition / outfit check / POV trend' : 'Stardew Valley'}
                data-testid="input-memory-game"
              />
            </label>
            <label className="field">
              <span>Date</span>
              <input value={date} onChange={(event) => setDate(event.target.value)} placeholder="08 Dec 2024" data-testid="input-memory-date" />
            </label>
            <label className="field field-wide">
              <span>The caption</span>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={4}
                placeholder={category === 'trend' ? 'How many takes did it take, and who kept messing up the beat?' : 'Tell the tiny story only we would remember...'}
                data-testid="input-memory-caption"
              />
            </label>
          </div>

          <div className="upload-area">
            <div className="upload-copy">
              <div className="upload-icon"><ImagePlus size={17} /></div>
              <div>
                <strong>Bring the receipts</strong>
                <p>Drop in up to eight photos or short video clips — game screenshots, trend recreations, whatever this page is about.</p>
              </div>
            </div>
            <button type="button" className="button button-ghost" onClick={() => inputRef.current?.click()} data-testid="button-upload-memory-images">
              <Upload size={15} /> {isReading ? 'Reading...' : 'Choose photos/videos'}
            </button>
            <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={handleFiles} data-testid="input-memory-images" />
          </div>
          {media.length > 0 && (
            <div className="image-strip">
              {media.map((item, index) => (
                <div className="image-thumb" key={item.id}>
                  <MediaStripThumb item={item} />
                  <button type="button" aria-label={`Remove media ${index + 1}`} onClick={() => setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index))} data-testid={`button-remove-image-${index}`}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="art-picker">
            <span className="field-label">Choose a page colour</span>
            <div className="art-options">
              {(['cozy', 'forest', 'space', 'cafe', 'island'] as const).map((option) => (
                <button type="button" key={option} className={`art-option art-option-${option} ${art === option ? 'selected' : ''}`} onClick={() => setArt(option)} aria-label={`Choose ${option} artwork`} data-testid={`button-art-${option}`}>
                  {art === option && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="button button-ghost" onClick={onClose} data-testid="button-cancel-memory">Not now</button>
            <button type="submit" className="button button-primary" disabled={!title.trim() || !caption.trim()} data-testid="button-save-memory">
              <Save size={16} /> {memory ? 'Save changes' : 'Tuck it in'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function IntroDoodle({
  image,
  isAdmin,
  onUpload,
  onRemove,
}: {
  image: string | null;
  isAdmin: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="intro-doodle animate-floaty" aria-hidden="true">
      {image ? (
        <img src={image} alt="You and me, co-op forever" className="doodle-photo" />
      ) : (
        <>
          <div className="doodle-speech">
            you + me<br /><strong>co-op forever</strong>
          </div>
          <Gamepad2 size={43} strokeWidth={1.25} />
        </>
      )}
      <span className="doodle-star" />
      <span className="doodle-line" />
      {isAdmin && (
        <div className="doodle-admin-controls">
          <button type="button" className="icon-button" onClick={() => inputRef.current?.click()} aria-label="Ganti gambar" data-testid="button-doodle-upload">
            <ImagePlus size={13} />
          </button>
          {image && (
            <button type="button" className="icon-button" onClick={onRemove} aria-label="Hapus gambar" data-testid="button-doodle-remove">
              <X size={13} />
            </button>
          )}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onUpload} data-testid="input-doodle-image" />
    </div>
  );
}

function AccessGate({
  showAdminForm,
  onToggleAdminForm,
  password,
  onPasswordChange,
  onSubmit,
  error,
  isSubmitting,
  tokenError,
}: {
  showAdminForm: boolean;
  onToggleAdminForm: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  error: string;
  isSubmitting: boolean;
  tokenError?: string;
}) {
  return (
    <main className="app-shell paper-grain gate-shell">
      <section className="gate-card animate-rise-in">
        <div className="gate-icon animate-floaty"><Heart size={26} fill="currentColor" /></div>
        <p className="eyebrow">private little archive</p>
        <h1>Buku ini terkunci.</h1>
        <p className="gate-copy">Scan QR code yang sudah kamu simpan untuk membuka kenangan kita. Halaman ini cuma bisa dibuka lewat QR, bukan lewat link biasa.</p>
        {tokenError && (
          <p className="gate-error" data-testid="text-token-error">{tokenError}</p>
        )}

        {!showAdminForm ? (
          <button type="button" className="button button-ghost gate-admin-toggle" onClick={onToggleAdminForm} data-testid="button-show-admin-login">
            <Lock size={14} /> Masuk sebagai admin
          </button>
        ) : (
          <form className="admin-form" onSubmit={onSubmit}>
            <label className="field field-wide">
              <span>Password admin</span>
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="••••••••"
                data-testid="input-admin-password"
              />
            </label>
            {error && <p className="gate-error" data-testid="text-admin-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="button button-ghost" onClick={onToggleAdminForm} data-testid="button-cancel-admin-login">
                Batal
              </button>
              <button type="submit" className="button button-primary" disabled={isSubmitting || !password} data-testid="button-submit-admin-login">
                {isSubmitting ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />} Masuk
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}

function QrPanel({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [qrImage, setQrImage] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/qr');
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || 'Gagal membuat QR.');
        const dataUrl = await QRCode.toDataURL(data.url, {
          errorCorrectionLevel: 'H',
          margin: 1,
          width: 360,
          color: { dark: '#4a2b3e', light: '#fff7ec' },
        });
        if (cancelled) return;
        setQrImage(dataUrl);
        setUrl(data.url);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Gagal membuat QR.');
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-sheet qr-sheet animate-rise-in" role="dialog" aria-modal="true" aria-labelledby="qr-panel-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">the only way in</p>
            <h2 id="qr-panel-title">Bagikan QR kenangan</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Tutup" data-testid="button-close-qr-panel"><X size={18} /></button>
        </div>
        {status === 'loading' && (
          <div className="qr-loading"><Loader2 size={22} className="spin" /> Menyiapkan QR...</div>
        )}
        {status === 'error' && <p className="gate-error">{error}</p>}
        {status === 'ready' && (
          <div className="qr-frame">
            <div className="qr-image-wrap">
              <img src={qrImage} alt="QR code untuk membuka Kenangan Game Kita" data-testid="image-qr-code" />
              <span className="qr-badge"><Heart size={16} fill="currentColor" /></span>
              <Sparkles className="qr-sparkle qr-sparkle-a" size={16} />
              <Sparkles className="qr-sparkle qr-sparkle-b" size={13} />
            </div>
            <p className="qr-hint">Scan pakai kamera HP untuk membuka langsung. Link ini menyimpan kunci akses, jadi jangan disebar sembarangan ya.</p>
            <a className="button button-primary" href={qrImage} download="kenangan-game-kita-qr.png" data-testid="button-download-qr">
              <Download size={15} /> Unduh QR
            </a>
          </div>
        )}
      </section>
    </div>
  );
}

function App() {
  const [memories, setMemories] = useState<Memory[]>(starterMemories);
  const [memoriesLoaded, setMemoriesLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [notice, setNotice] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<'all' | MemoryCategory>('all');
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');
  const [burstTick, setBurstTick] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const [hugTick, setHugTick] = useState(0);
  const [captionIndex, setCaptionIndex] = useState(0);
  const tilt = useTilt();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);
  const [showQrPanel, setShowQrPanel] = useState(false);
  const [doodleImage, setDoodleImage] = useState<string | null>(null);

  const refreshSession = async () => {
    try {
      const response = await fetch('/api/session');
      const data = await response.json();
      setHasAccess(Boolean(data.hasAccess));
      setIsAdmin(Boolean(data.isAdmin));
    } catch {
      setHasAccess(false);
      setIsAdmin(false);
    } finally {
      setCheckingAccess(false);
    }
  };

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('access');
      if (token) {
        try {
          const response = await fetch(`/api/access?token=${encodeURIComponent(token)}`);
          const data = await response.json().catch(() => null);
          if (!response.ok || !data?.ok) {
            setTokenError(data?.error || 'QR code tidak valid atau sudah kedaluwarsa. Minta admin generate ulang QR-nya.');
          }
        } catch {
          setTokenError('Tidak bisa terhubung ke server. Coba scan ulang.');
        }
        params.delete('access');
        const rest = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
      }
      await refreshSession();
    })();
  }, []);

  // once we know whether this visitor has access, load the shared data that
  // now lives in Vercel Blob storage instead of this browser's localStorage.
  useEffect(() => {
    if (checkingAccess || !hasAccess) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/memories');
        const data = await response.json();
        if (cancelled) return;
        if (Array.isArray(data.memories)) {
          setMemories(data.memories);
        } else if (isAdmin) {
          // nothing saved on the server yet — seed it once, preferring any
          // memories still sitting in this browser's old local storage.
          const seed = readLegacyLocalMemories() ?? starterMemories;
          setMemories(seed);
          fetch('/api/memories', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memories: seed }),
          }).catch(() => {});
        }
      } catch {
        if (!cancelled) setNotice('Gagal memuat kenangan dari server.');
      } finally {
        if (!cancelled) setMemoriesLoaded(true);
      }
    })();
    (async () => {
      try {
        const response = await fetch('/api/doodle');
        const data = await response.json();
        if (cancelled) return;
        if (data.image) {
          setDoodleImage(data.image);
        } else if (isAdmin) {
          const legacy = readLegacyLocalDoodle();
          if (legacy) {
            setDoodleImage(legacy);
            fetch('/api/doodle', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: legacy }),
            }).catch(() => {});
          }
        }
      } catch {
        // the doodle illustration falling back to text is fine, no toast needed
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkingAccess, hasAccess, isAdmin]);

  const submitAdminLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!adminPassword) return;
    setIsAdminSubmitting(true);
    setAdminError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setAdminError(data.error || 'Password admin salah.');
        return;
      }
      setAdminPassword('');
      setShowAdminForm(false);
      await refreshSession();
      setNotice('Selamat datang kembali, admin.');
    } catch {
      setAdminError('Tidak bisa terhubung ke server. Coba lagi.');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  const adminLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // ignore network errors, we still reset local state below
    }
    setIsAdmin(false);
    setShowQrPanel(false);
    await refreshSession();
    setNotice('Sudah keluar dari mode admin.');
  };

  const handleDoodleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setNotice('Mengunggah gambar...');
      const url = await uploadFile(file);
      setDoodleImage(url);
      await fetch('/api/doodle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: url }),
      });
      setNotice('Gambar berhasil diganti untuk kalian berdua.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Gagal mengunggah gambar. Coba lagi ya.');
    }
  };

  const handleDoodleRemove = async () => {
    setDoodleImage(null);
    try {
      await fetch('/api/doodle', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: null }),
      });
    } catch {
      setNotice('Gagal menghapus gambar di server.');
    }
  };

  /** Updates the memory book in state and, if we're admin, syncs it to the
   *  shared server copy so everyone who scans the QR sees the same book. */
  const persistMemories = async (next: Memory[]) => {
    setMemories(next);
    if (!isAdmin) return;
    try {
      const response = await fetch('/api/memories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memories: next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice(data?.error || 'Gagal sinkron ke server. Coba lagi.');
        return;
      }
      if (data?.strippedCount) {
        setNotice(`${data.strippedCount} foto lama (format lokal) tidak ikut tersimpan — upload ulang dari perangkat ini ya.`);
      }
    } catch {
      setNotice('Tersimpan di sini, tapi gagal sinkron ke server. Coba lagi.');
    }
  };

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // rotate the little topbar caption through a few playful lines for guests
  // (admins keep the plain "admin mode" label so it stays a useful status).
  useEffect(() => {
    if (isAdmin) return;
    const timer = window.setInterval(() => {
      setCaptionIndex((current) => (current + 1) % GUEST_CAPTIONS.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [isAdmin]);

  const sendHug = () => {
    setHugTick((tick) => tick + 1);
    setNotice(HUG_MESSAGES[Math.floor(Math.random() * HUG_MESSAGES.length)]);
  };

  // lock page scroll while the mobile nav drawer is open, so the page behind
  // it can't be dragged around and glitch against the fixed drawer.
  useEffect(() => {
    if (!isNavOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isNavOpen]);

  // greet the guest ("pacar") with a "Halo, sayang" overlay the first time
  // this browser session opens the book — admins skip it, they already know.
  useEffect(() => {
    if (checkingAccess || !hasAccess || isAdmin) return;
    try {
      if (sessionStorage.getItem(WELCOME_SEEN_KEY)) return;
      sessionStorage.setItem(WELCOME_SEEN_KEY, '1');
    } catch {
      // ignore — worst case the welcome shows again next reload
    }
    setShowWelcome(true);
  }, [checkingAccess, hasAccess, isAdmin]);

  const activeMemory = memories[activeIndex];
  const sortedMemories = useMemo(() => [...memories].reverse(), [memories]);
  const filteredMemories = useMemo(
    () => sortedMemories.filter((memory) => libraryFilter === 'all' || memoryCategory(memory) === libraryFilter),
    [sortedMemories, libraryFilter],
  );
  const trendCount = useMemo(() => memories.filter((memory) => memoryCategory(memory) === 'trend').length, [memories]);
  const gameCount = memories.length - trendCount;

  const move = (direction: number) => {
    if (!memories.length) return;
    setSlideDirection(direction > 0 ? 'right' : 'left');
    setActiveIndex((current) => (current + direction + memories.length) % memories.length);
    setBurstTick((tick) => tick + 1);
  };

  const saveMemory = (draft: MemoryDraft, id?: string) => {
    if (id) {
      const next = memories.map((item) => (item.id === id ? { ...item, ...draft, savedAt: new Date().toISOString() } : item));
      persistMemories(next);
      setNotice('Your edits are tucked in.');
    } else {
      const newMemory: Memory = { ...draft, id: `memory-${Date.now()}`, savedAt: new Date().toISOString() };
      const next = [...memories, newMemory];
      persistMemories(next);
      setActiveIndex(memories.length);
      if (next.length > 0 && next.length % 5 === 0) {
        // little celebration every 5th memory — same heart shower as "kirim pelukan"
        setHugTick((tick) => tick + 1);
        setNotice(`🎉 ${next.length} kenangan udah kekumpul! Makin banyak, makin sayang.`);
      } else {
        setNotice('A new page has joined the book.');
      }
    }
    setModal(null);
  };

  const removeMemory = () => {
    if (!activeMemory) return;
    if (!window.confirm(`Remove “${activeMemory.title}” from your book?`)) return;
    const next = memories.filter((memory) => memory.id !== activeMemory.id);
    persistMemories(next);
    setActiveIndex((current) => Math.min(current, Math.max(next.length - 1, 0)));
    setNotice('Page removed. The rest of the book is still here.');
  };

  const resetMemories = () => {
    if (!window.confirm('Replace your book with the sample pages?')) return;
    persistMemories(starterMemories);
    setActiveIndex(0);
    setNotice('The sample pages are back.');
  };

  const chooseMemory = (memory: Memory) => {
    const index = memories.findIndex((item) => item.id === memory.id);
    if (index >= 0) {
      setSlideDirection(index >= activeIndex ? 'right' : 'left');
      setActiveIndex(index);
    }
    setBurstTick((tick) => tick + 1);
    setShowAll(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTouchStart = (event: TouchEvent) => setTouchStart(event.changedTouches[0].clientX);
  const handleTouchEnd = (event: TouchEvent) => {
    if (touchStart === null) return;
    const distance = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
    setTouchStart(null);
  };

  let body: ReactNode;

  if (checkingAccess) {
    body = (
      <main className="app-shell paper-grain gate-shell">
        <div className="gate-loading"><Loader2 size={22} className="spin" /></div>
      </main>
    );
  } else if (!hasAccess) {
    body = (
      <AccessGate
        showAdminForm={showAdminForm}
        onToggleAdminForm={() => { setShowAdminForm((open) => !open); setAdminError(''); }}
        password={adminPassword}
        onPasswordChange={setAdminPassword}
        onSubmit={submitAdminLogin}
        error={adminError}
        isSubmitting={isAdminSubmitting}
        tokenError={tokenError}
      />
    );
  } else {
    body = (
    <main className="app-shell paper-grain">
      <header className="topbar">
        <button className="brand" onClick={() => { setShowAll(false); setActiveIndex(0); }} data-testid="button-home">
          <span className="brand-mark"><Gamepad2 size={20} /></span>
          <span><strong>Kenangan</strong><em>Game Kita</em></span>
        </button>
        <div className="topbar-center">
          <span className="status-dot" />{' '}
          <span key={isAdmin ? 'admin' : captionIndex} className="topbar-caption">
            {isAdmin ? 'admin mode' : GUEST_CAPTIONS[captionIndex]}
          </span>
        </div>
        <div className="topbar-actions">
          <span className="saved-label"><Check size={13} /> saved locally</span>
          {isAdmin && (
            <button className="icon-button" onClick={() => setShowQrPanel(true)} aria-label="Bagikan QR" data-testid="button-open-qr-panel"><QrCode size={17} /></button>
          )}
          <button className="icon-button mobile-menu" onClick={() => setIsNavOpen((open) => !open)} aria-label="Open menu" data-testid="button-open-menu"><Menu size={19} /></button>
          {isAdmin && (
            <button className="button button-primary top-add" onClick={() => setModal('add')} data-testid="button-add-memory-top"><Plus size={16} /> Add memory</button>
          )}
        </div>
      </header>

      <div className={`nav-backdrop ${isNavOpen ? 'open' : ''}`} onClick={() => setIsNavOpen(false)} aria-hidden="true" />
      <aside className={`side-rail ${isNavOpen ? 'open' : ''}`}>
        <div className="rail-note">
          <Sparkles size={14} />
          <span>Our tiny<br />co-op universe</span>
        </div>
        <nav className="rail-nav" aria-label="Memory book navigation">
          <button className={!showAll ? 'active' : ''} onClick={() => { setShowAll(false); setIsNavOpen(false); }} data-testid="button-nav-current"><Grid2X2 size={16} /> Current page</button>
          <button className={showAll ? 'active' : ''} onClick={() => { setShowAll(true); setIsNavOpen(false); }} data-testid="button-nav-all-memories"><Library size={16} /> All memories <span>{memories.length}</span></button>
        </nav>
        <div className="rail-bottom">
          <div className="couple-note">
            <div className="mini-avatar avatar-one">A</div>
            <div className="mini-avatar avatar-two">R</div>
            <div><strong>A + R</strong><small>still pressing start</small></div>
          </div>
          {isAdmin ? (
            <>
              <button className="rail-reset" onClick={resetMemories} data-testid="button-reset-samples"><RotateCcw size={13} /> reset sample pages</button>
              <button className="rail-reset" onClick={adminLogout} data-testid="button-admin-logout"><LogOut size={13} /> keluar dari admin</button>
            </>
          ) : (
            <button
              className="rail-reset"
              onClick={() => { setIsNavOpen(false); setShowAdminForm(true); setHasAccess(false); }}
              data-testid="button-switch-admin"
            >
              <Lock size={13} /> masuk sebagai admin
            </button>
          )}
        </div>
      </aside>

      <section className="content">
        <div className="mobile-rail-row">
          <span className="eyebrow">{showAll ? 'the whole book' : 'chapter one / many more to come'}</span>
          <button className="mobile-library" onClick={() => setShowAll((value) => !value)} data-testid="button-toggle-library">{showAll ? 'current page' : 'all memories'} <ChevronDown size={14} /></button>
        </div>

        {showAll ? (
          <section className="library-view animate-rise-in">
            <div className="library-heading">
              <div>
                <p className="eyebrow">all the little wins</p>
                <h1>Our memory shelf <span>({memories.length})</span></h1>
              </div>
              {isAdmin && <button className="button button-primary" onClick={() => setModal('add')} data-testid="button-add-memory-library"><Plus size={16} /> New page</button>}
            </div>
            {memories.length > 0 && (
              <div className="category-tabs" role="tablist" aria-label="Filter kenangan">
                <button type="button" role="tab" aria-selected={libraryFilter === 'all'} className={libraryFilter === 'all' ? 'active' : ''} onClick={() => setLibraryFilter('all')} data-testid="button-filter-all">
                  Semua <span>{memories.length}</span>
                </button>
                <button type="button" role="tab" aria-selected={libraryFilter === 'game'} className={libraryFilter === 'game' ? 'active' : ''} onClick={() => setLibraryFilter('game')} data-testid="button-filter-game">
                  <Gamepad2 size={13} /> Game <span>{gameCount}</span>
                </button>
                <button type="button" role="tab" aria-selected={libraryFilter === 'trend'} className={libraryFilter === 'trend' ? 'active' : ''} onClick={() => setLibraryFilter('trend')} data-testid="button-filter-trend">
                  <Sparkles size={13} /> Trend kita <span>{trendCount}</span>
                </button>
              </div>
            )}
            {memories.length === 0 ? (
              <EmptyState onAdd={() => setModal('add')} />
            ) : filteredMemories.length === 0 ? (
              <div className="empty-state" data-testid="empty-filtered-memories">
                <div className="empty-icon"><Sparkles size={27} /></div>
                <p className="eyebrow">nothing here yet</p>
                <h2>Belum ada trend kita di sini.</h2>
                <p>Punya foto/video trend yang pernah kalian buat bareng? Tuck it in.</p>
                {isAdmin && (
                  <button className="button button-primary" onClick={() => setModal('add')} data-testid="button-add-filtered-memory">
                    <Plus size={16} /> Add a memory
                  </button>
                )}
              </div>
            ) : (
              <div className="memory-shelf">
                {filteredMemories.map((memory, index) => (
                  <button className="shelf-card" key={memory.id} onClick={() => chooseMemory(memory)} data-testid={`card-memory-${memory.id}`}>
                    <div className="shelf-number">{String(filteredMemories.length - index).padStart(2, '0')}</div>
                    <MemoryArtwork memory={memory} compact />
                    <div className="shelf-copy">
                      <p>
                        {memory.date}
                        {memoryCategory(memory) === 'trend' && (
                          <span className="trend-tag"><Sparkles size={9} /> trend</span>
                        )}
                      </p>
                      <h2>{memory.title}</h2>
                      <span>{memory.game}</span>
                    </div>
                    <ArrowRight className="shelf-arrow" size={17} />
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="intro-block animate-rise-in">
              <div className="intro-copy">
                <p className="eyebrow">a scrapbook for the in-between</p>
                <h1>Some nights<br />deserve a <i>save point.</i></h1>
                <p className="intro-subtitle">For the screenshots, the side quests, and the “one more round” that quietly became 2am.</p>
              </div>
              <IntroDoodle image={doodleImage} isAdmin={isAdmin} onUpload={handleDoodleUpload} onRemove={handleDoodleRemove} />
            </section>

            <section className="book-stage" aria-label="Memory viewer">
              <div className="stage-topline">
                <div className="page-count">
                  <span className="page-current" data-testid="text-current-page">{activeMemory ? String(activeIndex + 1).padStart(2, '0') : '00'}</span>
                  <span className="page-divider" />
                  <span>{String(memories.length).padStart(2, '0')}</span>
                  <span className="page-label">pages kept</span>
                </div>
                <div className="stage-controls">
                  <button className="icon-button" onClick={() => move(-1)} disabled={!activeMemory} aria-label="Previous memory" data-testid="button-previous-memory"><ChevronLeft size={19} /></button>
                  <button className="icon-button" onClick={() => move(1)} disabled={!activeMemory} aria-label="Next memory" data-testid="button-next-memory"><ChevronRight size={19} /></button>
                </div>
              </div>

              {activeMemory ? (
                <article className={`memory-card slide-${slideDirection}`} key={activeMemory.id} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} data-testid={`card-active-memory-${activeMemory.id}`}>
                  <PageMark />
                  <div className="card-image-wrap tilt-wrap" ref={tilt.ref} onMouseMove={tilt.handleMove} onMouseLeave={tilt.handleLeave}>
                    <TapHeartLayer>
                      <MemoryArtwork memory={activeMemory} />
                    </TapHeartLayer>
                    <SparkleBurst trigger={burstTick} />
                    <div className="date-stamp animate-stamp"><Clock3 size={13} /> {activeMemory.date}</div>
                    <div className="card-index">NO. {String(activeIndex + 1).padStart(2, '0')}</div>
                  </div>
                  <div className="card-body">
                    <div className="card-meta">
                      <span className={`game-pill ${memoryCategory(activeMemory) === 'trend' ? 'game-pill-trend' : ''}`}>
                        {memoryCategory(activeMemory) === 'trend' ? <Sparkles size={13} /> : <Gamepad2 size={13} />} {activeMemory.game}
                      </span>
                      <span className="tiny-label">{memoryCategory(activeMemory) === 'trend' ? 'a trend we made ours' : 'a moment worth keeping'}</span>
                    </div>
                    <h2 data-testid={`text-memory-title-${activeMemory.id}`}>{activeMemory.title}</h2>
                    <p className="caption" data-testid={`text-memory-caption-${activeMemory.id}`}>{activeMemory.caption}</p>
                    <div className="card-footer">
                      <div className="signed-note"><Heart size={14} fill="currentColor" /> from our tiny universe</div>
                      {isAdmin && (
                        <div className="card-actions">
                          <button className="text-button" onClick={() => setModal('edit')} data-testid="button-edit-memory"><Edit3 size={14} /> edit</button>
                          <button className="text-button danger" onClick={removeMemory} data-testid="button-delete-memory"><Trash2 size={14} /> remove</button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ) : <EmptyState onAdd={() => setModal('add')} />}

              <div className="swipe-hint"><ArrowLeft size={14} /> swipe or use the arrows <ArrowRight size={14} /></div>
              <div className="swipe-hint swipe-hint-secondary"><Heart size={10} /> psst — double-tap the photo for a heart</div>
            </section>

            <section className="afterword">
              <div className="afterword-rule" />
              <div className="afterword-copy">
                <p className="eyebrow">the rule of this book</p>
                <h2>Keep the ordinary.<br /><i>That’s the magic.</i></h2>
                <p>A funny glitch. A lucky drop. The quiet five minutes after we say goodnight.</p>
              </div>
              {isAdmin && <button className="button button-outline" onClick={() => setModal('add')} data-testid="button-add-memory-afterword"><Plus size={16} /> Keep a new one</button>}
            </section>
          </>
        )}
      </section>

      {activeMemory && !showAll && <button className="download-button" onClick={() => { downloadMemory(activeMemory); setNotice('A little copy is on its way down.'); }} data-testid="button-download-memory"><Save size={15} /> save note</button>}
      {notice && <div className="toast-note animate-rise-in" role="status" data-testid="status-notice"><Check size={15} /> {notice}</div>}
      {modal && isAdmin && <MemoryModal memory={modal === 'edit' ? activeMemory : undefined} onClose={() => setModal(null)} onSave={saveMemory} />}
      {showQrPanel && isAdmin && <QrPanel onClose={() => setShowQrPanel(false)} />}
    </main>
    );
  }

  return (
    <>
      <Snowfall />
      <AmbientHearts />
      {body}
      {hasAccess && !checkingAccess && (
        <>
          <MusicPlayer isAdmin={isAdmin} onNotice={setNotice} />
          <button type="button" className="hug-button" onClick={sendHug} aria-label="Kirim pelukan virtual" data-testid="button-send-hug">
            <span className="hug-button-icon" aria-hidden="true">🤗</span>
            <span className="hug-button-label">kirim pelukan</span>
          </button>
          <HugBurst trigger={hugTick} />
          {showWelcome && <WelcomeOverlay onDismiss={() => setShowWelcome(false)} />}
        </>
      )}
    </>
  );
}

export default App;