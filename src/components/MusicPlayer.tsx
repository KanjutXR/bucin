import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  Loader2,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Trash2,
  Upload,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { deleteRecord, getAllRecords, putRecord, STORE_MUSIC } from '../lib/media-db';

type Track = { id: string; name: string; mime: string; blob: Blob; addedAt: string };

const VOLUME_KEY = 'kenangan-game-kita-music-volume';
const MUTED_KEY = 'kenangan-game-kita-music-muted';
const TRACK_KEY = 'kenangan-game-kita-music-active-track';

function readNumber(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readBoolean(key: string, fallback: boolean) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === '1';
  } catch {
    return fallback;
  }
}

function readString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function useBlobObjectUrl(blob: Blob | undefined | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}

export function MusicPlayer({ isAdmin, onNotice }: { isAdmin: boolean; onNotice: (message: string) => void }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => readString(TRACK_KEY));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [volume, setVolume] = useState(() => readNumber(VOLUME_KEY, 0.55));
  const [muted, setMuted] = useState(() => readBoolean(MUTED_KEY, false));
  const [loaded, setLoaded] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTrack = useMemo(
    () => tracks.find((track) => track.id === activeId) ?? tracks[0] ?? null,
    [tracks, activeId],
  );
  const activeUrl = useBlobObjectUrl(activeTrack?.blob);

  useEffect(() => {
    let cancelled = false;
    getAllRecords<Track>(STORE_MUSIC)
      .then((records) => {
        if (cancelled) return;
        records.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
        setTracks(records);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (activeId && tracks.some((track) => track.id === activeId)) return;
    setActiveId(tracks[0] ? tracks[0].id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, tracks]);

  useEffect(() => {
    try {
      if (activeId) localStorage.setItem(TRACK_KEY, activeId);
    } catch {
      // ignore
    }
  }, [activeId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
    try {
      localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // ignore
    }
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.muted = muted;
    try {
      localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
  }, [muted]);

  // Reads audioRef.current.src directly (not the activeUrl variable) so this
  // stays correct even when called from a listener set up on an earlier render.
  const tryPlay = () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  };

  // attempt to (re)start playback every time the active track's src changes —
  // covers the very first load as well as next/prev/auto-advance.
  useEffect(() => {
    if (!activeUrl) return;
    tryPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUrl]);

  // most browsers block audio with sound until the visitor interacts with the
  // page at least once — retry playback on the first tap/click/keypress.
  useEffect(() => {
    const unlock = () => tryPlay();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEnded = () => {
    const audio = audioRef.current;
    if (tracks.length <= 1) {
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }
    const currentIndex = tracks.findIndex((track) => track.id === activeTrack?.id);
    const next = tracks[(currentIndex + 1 + tracks.length) % tracks.length];
    setActiveId(next.id);
  };

  const changeTrack = (direction: number) => {
    if (tracks.length < 2 || !activeTrack) return;
    const currentIndex = tracks.findIndex((track) => track.id === activeTrack.id);
    const next = tracks[(currentIndex + direction + tracks.length) % tracks.length];
    setActiveId(next.id);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) tryPlay();
    else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('audio/'));
    event.target.value = '';
    if (!files.length) return;
    setIsUploading(true);
    try {
      const newTracks: Track[] = [];
      for (const file of files) {
        const track: Track = {
          id: `music-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name.replace(/\.[a-z0-9]+$/i, ''),
          mime: file.type || 'audio/mpeg',
          blob: file,
          addedAt: new Date().toISOString(),
        };
        // eslint-disable-next-line no-await-in-loop
        await putRecord(STORE_MUSIC, track);
        newTracks.push(track);
      }
      setTracks((current) => [...current, ...newTracks]);
      if (!activeTrack && newTracks[0]) setActiveId(newTracks[0].id);
      onNotice('Lagu baru sudah masuk playlist.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteRecord(STORE_MUSIC, id);
    setTracks((current) => current.filter((track) => track.id !== id));
    if (activeId === id) setActiveId(null);
    onNotice('Lagu sudah dihapus dari playlist.');
  };

  if (!loaded) return null;

  return (
    <div className={`music-player ${isOpen ? 'open' : ''}`}>
      <audio
        ref={audioRef}
        src={activeUrl ?? undefined}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      {isOpen && (
        <div className="music-panel animate-rise-in">
          <div className="music-panel-head">
            <span className="eyebrow">our soundtrack</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup pemutar musik"
              data-testid="button-close-music-panel"
            >
              <X size={14} />
            </button>
          </div>

          {activeTrack ? (
            <div className="music-now-playing">
              <div className={`music-bars ${isPlaying ? 'playing' : ''}`}>
                <span />
                <span />
                <span />
                <span />
              </div>
              <div>
                <strong>{activeTrack.name}</strong>
                <small>{isPlaying ? 'sedang diputar' : 'dijeda'}</small>
              </div>
            </div>
          ) : (
            <p className="music-empty">
              Belum ada musik. {isAdmin ? 'Upload lagu favorit kalian di bawah.' : 'Minta admin untuk menambahkan lagu ya.'}
            </p>
          )}

          <div className="music-controls">
            <button
              type="button"
              className="icon-button"
              onClick={() => changeTrack(-1)}
              disabled={tracks.length < 2}
              aria-label="Lagu sebelumnya"
              data-testid="button-music-prev"
            >
              <SkipBack size={15} />
            </button>
            <button
              type="button"
              className="icon-button music-play-toggle"
              onClick={togglePlay}
              disabled={!activeTrack}
              aria-label={isPlaying ? 'Jeda musik' : 'Putar musik'}
              data-testid="button-music-toggle"
            >
              {isPlaying ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <button
              type="button"
              className="icon-button"
              onClick={() => changeTrack(1)}
              disabled={tracks.length < 2}
              aria-label="Lagu berikutnya"
              data-testid="button-music-next"
            >
              <SkipForward size={15} />
            </button>
          </div>

          <div className="music-volume">
            <button
              type="button"
              className="icon-button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
              data-testid="button-music-mute"
            >
              {muted || volume === 0 ? <VolumeX size={15} /> : volume < 0.5 ? <Volume1 size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => {
                const value = Number(event.target.value);
                setVolume(value);
                if (value > 0 && muted) setMuted(false);
              }}
              aria-label="Volume musik"
              data-testid="input-music-volume"
            />
          </div>

          {isAdmin && (
            <div className="music-admin">
              <div className="music-admin-head">
                <span className="field-label">kelola playlist</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => inputRef.current?.click()}
                  data-testid="button-music-upload"
                >
                  {isUploading ? <Loader2 size={13} className="spin" /> : <Upload size={13} />} upload
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  hidden
                  onChange={handleUpload}
                  data-testid="input-music-upload"
                />
              </div>
              {tracks.length > 0 && (
                <ul className="music-track-list">
                  {tracks.map((track) => (
                    <li key={track.id} className={track.id === activeTrack?.id ? 'active' : ''}>
                      <button type="button" onClick={() => setActiveId(track.id)} data-testid={`button-music-select-${track.id}`}>
                        {track.name}
                      </button>
                      <button
                        type="button"
                        className="music-track-delete"
                        onClick={() => handleDelete(track.id)}
                        aria-label={`Hapus ${track.name}`}
                        data-testid={`button-music-delete-${track.id}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className={`music-toggle ${isPlaying ? 'playing' : ''}`}
        onClick={() => setIsOpen((value) => !value)}
        aria-label="Buka pemutar musik"
        data-testid="button-toggle-music-player"
      >
        <Music2 size={18} />
      </button>
    </div>
  );
}
