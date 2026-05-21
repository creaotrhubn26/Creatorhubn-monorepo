// @ts-nocheck
/**
 * GallerySlideshow — Slice 9X.82
 *
 * Pic-Time 2.0 fullskjerm-slideshow for klient-galleri. Brudepar pleier
 * å vise galleriet til familie på storskjerm — dette gjør det
 * kinematografisk.
 *
 * Features:
 *   - Fullscreen via MUI Dialog (a11y: focus-trap + ESC + scroll-lock)
 *   - Auto-advance med konfigurerbar interval (3/5/8 sek)
 *   - Ken Burns: subtil 1→1.06 zoom over hele intervallet
 *   - Smooth crossfade mellom bilder (800ms)
 *   - Play/pause + prev/next + keyboard-nav (arrows + space)
 *   - Valgfri bakgrunnsmusikk (URL input — kan utvides til royalty-free library)
 *   - Respekterer prefers-reduced-motion (slår av Ken Burns + crossfade-transition)
 *   - Cinematic letterboxing (cream/black bg)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Dialog,
  Box,
  IconButton,
  Slider,
  Stack,
  Typography,
  TextField,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import {
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  SkipPrevious as PrevIcon,
  SkipNext as NextIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as VolumeOffIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

export interface SlideshowImage {
  id: string;
  url: string;
  alt?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  images: SlideshowImage[];
  /** Hvilket bilde å starte fra. Default 0. */
  startIndex?: number;
}

const SERIF_STACK = '"Cormorant Garamond", "Playfair Display", Georgia, serif';

const GallerySlideshow: React.FC<Props> = ({ open, onClose, images, startIndex = 0 }) => {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [intervalSec, setIntervalSec] = useState(5);
  const [musicUrl, setMusicUrl] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const controlsHideTimer = useRef<NodeJS.Timeout | null>(null);
  const advanceTimer = useRef<NodeJS.Timeout | null>(null);

  const safeImages = useMemo(() => images.filter((i) => i.url), [images]);
  const currentImage = safeImages[currentIndex];
  const nextImage = safeImages[(currentIndex + 1) % safeImages.length];

  // Reset til startIndex når dialogen åpnes
  useEffect(() => {
    if (open) {
      setCurrentIndex(Math.min(startIndex, safeImages.length - 1));
      setIsPlaying(true);
    }
  }, [open, startIndex, safeImages.length]);

  // Auto-advance loop
  useEffect(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (!open || !isPlaying || safeImages.length <= 1) return;
    advanceTimer.current = setTimeout(() => {
      setCurrentIndex((i) => (i + 1) % safeImages.length);
    }, intervalSec * 1000);
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [currentIndex, isPlaying, intervalSec, open, safeImages.length]);

  // Auto-hide controls etter 3s når man ikke beveger musen
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsHideTimer.current) clearTimeout(controlsHideTimer.current);
    controlsHideTimer.current = setTimeout(() => {
      setShowControls(false);
      setShowSettings(false);
    }, 3000);
  }, []);

  useEffect(() => {
    if (!open) return;
    resetControlsTimer();
    return () => {
      if (controlsHideTimer.current) clearTimeout(controlsHideTimer.current);
    };
  }, [open, resetControlsTimer]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setCurrentIndex((i) => (i + 1) % safeImages.length);
      else if (e.key === 'ArrowLeft') setCurrentIndex((i) => (i - 1 + safeImages.length) % safeImages.length);
      else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
      resetControlsTimer();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, safeImages.length, resetControlsTimer]);

  // Music
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = isMuted;
    if (open && musicUrl && !isMuted && isPlaying) {
      audioRef.current.play().catch(() => undefined);
    } else {
      audioRef.current.pause();
    }
  }, [open, musicUrl, isMuted, isPlaying]);

  const goPrev = () => setCurrentIndex((i) => (i - 1 + safeImages.length) % safeImages.length);
  const goNext = () => setCurrentIndex((i) => (i + 1) % safeImages.length);

  if (!currentImage) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      aria-labelledby="slideshow-title"
      PaperProps={{
        sx: {
          bgcolor: '#0a0807',
          color: '#fdfaf5',
          overflow: 'hidden',
        },
      }}
    >
      <span id="slideshow-title" style={{ position: 'absolute', left: -9999 }}>
        Slideshow av galleriet
      </span>

      {/* Bakgrunnsmusikk (skjult audio-element) */}
      {musicUrl && (
        <audio
          ref={audioRef}
          src={musicUrl}
          autoPlay
          loop
          muted={isMuted}
          style={{ display: 'none' }}
        />
      )}

      {/* Slideshow-canvas */}
      <Box
        onMouseMove={resetControlsTimer}
        onTouchStart={resetControlsTimer}
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: showControls ? 'default' : 'none',
        }}
      >
        {/* Crossfade: forrige + nåværende stacket */}
        {safeImages.map((img, idx) => {
          const isActive = idx === currentIndex;
          return (
            <Box
              key={img.id}
              sx={{
                position: 'absolute',
                inset: 0,
                opacity: isActive ? 1 : 0,
                transition: prefersReducedMotion ? 'none' : `opacity 800ms ease-in-out`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                component="img"
                src={img.url}
                alt={img.alt || ''}
                loading={idx === currentIndex || idx === (currentIndex + 1) % safeImages.length ? 'eager' : 'lazy'}
                sx={{
                  maxWidth: '94vw',
                  maxHeight: '94vh',
                  objectFit: 'contain',
                  // Pic-Time Ken Burns: subtil zoom over intervallet
                  ...(isActive && !prefersReducedMotion ? {
                    animation: `slideshow-zoom ${intervalSec * 1.2}s ease-in-out forwards`,
                    '@keyframes slideshow-zoom': {
                      '0%': { transform: 'scale(1.0)' },
                      '100%': { transform: 'scale(1.06)' },
                    },
                  } : {}),
                  boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                }}
              />
            </Box>
          );
        })}

        {/* Counter (subtilt, magazine-stil) */}
        <Typography
          sx={{
            position: 'absolute',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: SERIF_STACK,
            fontStyle: 'italic',
            fontSize: '0.95rem',
            color: 'rgba(253, 250, 245, 0.7)',
            letterSpacing: '0.08em',
            opacity: showControls ? 1 : 0.3,
            transition: 'opacity 0.4s',
            pointerEvents: 'none',
          }}
        >
          {String(currentIndex + 1).padStart(2, '0')} · {String(safeImages.length).padStart(2, '0')}
        </Typography>
      </Box>

      {/* Top-bar controls (close + settings) */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.4s',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6), transparent)',
          zIndex: 2,
        }}
      >
        <IconButton
          onClick={() => setShowSettings((s) => !s)}
          aria-label="Innstillinger"
          sx={{
            color: '#fdfaf5',
            bgcolor: 'rgba(0,0,0,0.32)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
          }}
        >
          <SettingsIcon />
        </IconButton>
        <IconButton
          onClick={onClose}
          aria-label="Lukk slideshow"
          sx={{
            color: '#fdfaf5',
            bgcolor: 'rgba(0,0,0,0.32)',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Bottom-bar controls (prev / play / next / mute) */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          py: 3,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.4s',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.6), transparent)',
          zIndex: 2,
        }}
      >
        <Tooltip title="Forrige (←)">
          <IconButton
            onClick={goPrev}
            aria-label="Forrige bilde"
            sx={{
              color: '#fdfaf5',
              bgcolor: 'rgba(0,0,0,0.32)',
              width: 48,
              height: 48,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
            }}
          >
            <PrevIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title={isPlaying ? 'Pause (mellomrom)' : 'Spill av (mellomrom)'}>
          <IconButton
            onClick={() => setIsPlaying((p) => !p)}
            aria-label={isPlaying ? 'Pause' : 'Spill av'}
            sx={{
              color: '#0a0807',
              bgcolor: '#fdfaf5',
              width: 64,
              height: 64,
              '&:hover': { bgcolor: '#fff' },
            }}
          >
            {isPlaying ? <PauseIcon sx={{ fontSize: 32 }} /> : <PlayIcon sx={{ fontSize: 32 }} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Neste (→)">
          <IconButton
            onClick={goNext}
            aria-label="Neste bilde"
            sx={{
              color: '#fdfaf5',
              bgcolor: 'rgba(0,0,0,0.32)',
              width: 48,
              height: 48,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
            }}
          >
            <NextIcon />
          </IconButton>
        </Tooltip>
        {musicUrl && (
          <Tooltip title={isMuted ? 'Slå på lyd' : 'Slå av lyd'}>
            <IconButton
              onClick={() => setIsMuted((m) => !m)}
              aria-label={isMuted ? 'Slå på lyd' : 'Slå av lyd'}
              sx={{
                color: '#fdfaf5',
                bgcolor: 'rgba(0,0,0,0.32)',
                ml: 2,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
              }}
            >
              {isMuted ? <VolumeOffIcon /> : <VolumeIcon />}
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Settings-panel (foldes ut fra top-bar) */}
      {showSettings && (
        <Box
          sx={{
            position: 'absolute',
            top: 80,
            left: 16,
            zIndex: 3,
            bgcolor: 'rgba(10, 8, 7, 0.95)',
            border: '1px solid rgba(253, 250, 245, 0.18)',
            borderRadius: 2,
            p: 3,
            maxWidth: 320,
            backdropFilter: 'blur(12px)',
          }}
        >
          <Typography
            sx={{
              fontFamily: SERIF_STACK,
              fontSize: '1.1rem',
              mb: 2,
              color: '#fdfaf5',
            }}
          >
            Innstillinger
          </Typography>

          <Stack spacing={2.5}>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(253,250,245,0.7)', mb: 1, display: 'block' }}>
                Bytt bilde hvert {intervalSec} sek
              </Typography>
              <Slider
                value={intervalSec}
                onChange={(_, v) => setIntervalSec(v as number)}
                min={3}
                max={12}
                step={1}
                marks={[{ value: 3, label: '3s' }, { value: 5, label: '5s' }, { value: 8, label: '8s' }, { value: 12, label: '12s' }]}
                sx={{
                  color: '#d97706',
                  '& .MuiSlider-markLabel': { color: 'rgba(253,250,245,0.5)', fontSize: '0.7rem' },
                }}
              />
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(253,250,245,0.7)', mb: 1, display: 'block' }}>
                Bakgrunnsmusikk-URL (valgfritt)
              </Typography>
              <TextField
                value={musicUrl}
                onChange={(e) => setMusicUrl(e.target.value.trim())}
                placeholder="https://… (mp3/wav)"
                fullWidth
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fdfaf5',
                    bgcolor: 'rgba(253,250,245,0.06)',
                    fontSize: '0.85rem',
                    '& fieldset': { borderColor: 'rgba(253,250,245,0.18)' },
                    '&:hover fieldset': { borderColor: 'rgba(253,250,245,0.32)' },
                  },
                }}
              />
              <Typography variant="caption" sx={{ color: 'rgba(253,250,245,0.4)', display: 'block', mt: 0.5 }}>
                Tips: bruk royalty-free musikk fra Epidemic Sound, Artlist eller YouTube Audio Library.
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}
    </Dialog>
  );
};

export default GallerySlideshow;
