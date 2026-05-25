// @ts-nocheck
/**
 * CinematicVideoPlayer — Slice 9X.82 (Pic-Time 2.0 for video, for Bjarne)
 *
 * Editorial video-player som matcher Stine sin Pic-Time-aesthetic men
 * for videograf-flyt. Erstatter standard HTML5-controls med custom
 * cream-on-black UI: Cormorant tittel-overlay, chapter-markører på
 * progress-bar, smooth fade-transisjoner.
 *
 * Brukes for klient-galleri-video (bryllupsfilm, eventfilm, music
 * video). Bjarne kan levere én lang film med chapter-markører som
 * brudepar kan skrubbe direkte til ("Vielsen", "Festen", "Taler").
 *
 * Features:
 *   - Cinematic poster-screen før play (auto-fade når play trykkes)
 *   - Cormorant Garamond serif på tittel + italic intro nederst-venstre
 *   - Custom progress-bar med chapter-markører (små vertikale streker)
 *   - Hover/move-aware control-overlay (auto-hide etter 2s)
 *   - Keyboard: space (play/pause), ←/→ (seek 5s), ↑/↓ (volume),
 *     M (mute), F (fullscreen), 0-9 (jump 0-90%), C (next chapter)
 *   - Chapter-tittel popper opp i 4s når kapittel-grensen krysses
 *   - prefers-reduced-motion: slår av fade-animasjoner
 *   - Touch-friendly (44px-buttons, swipe-friendly fra tap)
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Stack,
  Typography,
  Tooltip,
  Fade,
  useMediaQuery,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as VolumeOffIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Forward5 as Forward5Icon,
  Replay5 as Replay5Icon,
  SkipNext as ChapterNextIcon,
  ChatBubbleOutline as CommentIcon,
  Close as CloseIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { TextField, Button } from '@mui/material';

const SERIF_STACK = '"Cormorant Garamond", "Playfair Display", Georgia, serif';

export interface VideoChapterMarker {
  /** Tid i sekunder hvor kapitlet starter */
  startSec: number;
  title: string;
  intro?: string | null;
  romanNumeral?: string | null;
}

export type CommentCategory = 'color' | 'audio' | 'edit' | 'vfx' | 'structure' | 'text' | 'other';
export type CommentPriority = 'must-fix' | 'nice-to-have' | 'suggestion';

export interface VideoTimecodeComment {
  id: string;
  timecodeSec: number;
  endTimecodeSec?: number | null;
  comment: string;
  category?: CommentCategory;
  priority?: CommentPriority;
  clientName?: string | null;
  clientEmail?: string | null;
  status?: 'open' | 'resolved' | 'archived';
  createdAt?: string | null;
  /** Slice 9X.82 — musikk-forslag på timecode */
  suggestedMediaUrl?: string | null;
  suggestedMediaLabel?: string | null;
  suggestedMediaFromSec?: number | null;
  suggestedMediaToSec?: number | null;
}

interface Props {
  src: string;
  /** Poster-frame for cinematic preview */
  poster?: string | null;
  /** Hovedtittel som vises ved play (f.eks. "Stine & Lars Bryllup") */
  title?: string | null;
  /** Subtittel/italic (f.eks. "23. juni 2026 · Oslo") */
  subtitle?: string | null;
  /** Chapter-markører på progress-bar (sortert etter startSec) */
  chapters?: VideoChapterMarker[];
  /** Aspect-ratio for player. Default 16:9. */
  aspectRatio?: string;
  /** Start muted (anbefalt for autoplay-trailer-mode) */
  startMuted?: boolean;
  /** Autoplay (krever startMuted=true for moderne browsere) */
  autoPlay?: boolean;
  /** Loop video — for trailer/hero-mode */
  loop?: boolean;
  /** Vises i fullskjerm fra start (true når mountet inni Dialog fullScreen) */
  startFullscreen?: boolean;
  /** Slice 9X.82 (Bjarne) — Frame.io-stil timecode-kommentarer */
  comments?: VideoTimecodeComment[];
  /** Callback når klient legger til ny kommentar på timecode */
  onAddComment?: (input: {
    timecodeSec: number;
    endTimecodeSec?: number | null;
    comment: string;
    category?: CommentCategory;
    priority?: CommentPriority;
    suggestedMediaUrl?: string | null;
    suggestedMediaLabel?: string | null;
    suggestedMediaFromSec?: number | null;
    suggestedMediaToSec?: number | null;
  }) => Promise<void> | void;
  /** Klient-navn (forhåndsfyller comment-modalen) */
  clientName?: string | null;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const CinematicVideoPlayer: React.FC<Props> = ({
  src,
  poster,
  title,
  subtitle,
  chapters = [],
  aspectRatio = '16 / 9',
  startMuted = false,
  autoPlay = false,
  loop = false,
  comments = [],
  onAddComment,
  clientName,
}) => {
  // Slice 9X.82 (Bjarne) — comment-state med edit-feedback-felter
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [pendingCommentText, setPendingCommentText] = useState('');
  const [pendingCommentTime, setPendingCommentTime] = useState(0);
  const [pendingEndTime, setPendingEndTime] = useState<number | null>(null);
  const [pendingCategory, setPendingCategory] = useState<CommentCategory>('edit');
  const [pendingPriority, setPendingPriority] = useState<CommentPriority>('nice-to-have');
  // Slice 9X.82 — music-suggestion state
  const [pendingMusicUrl, setPendingMusicUrl] = useState('');
  const [pendingMusicLabel, setPendingMusicLabel] = useState('');
  const [pendingMusicFromSec, setPendingMusicFromSec] = useState<number>(0);
  const [pendingMusicToSec, setPendingMusicToSec] = useState<number | null>(null);
  const [showMusicFields, setShowMusicFields] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);

  const sortedComments = useMemo(
    () => [...(comments || [])].sort((a, b) => a.timecodeSec - b.timecodeSec),
    [comments],
  );

  const openCommentForCurrentTime = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setPendingCommentTime(videoRef.current.currentTime);
    setPendingEndTime(null);
    setPendingCategory('edit');
    setPendingPriority('nice-to-have');
    setPendingCommentText('');
    setPendingMusicUrl('');
    setPendingMusicLabel('');
    setPendingMusicFromSec(0);
    setPendingMusicToSec(null);
    setShowMusicFields(false);
    setShowCommentModal(true);
  }, []);

  const submitComment = useCallback(async () => {
    if (!onAddComment || !pendingCommentText.trim()) return;
    setCommentSubmitting(true);
    try {
      await onAddComment({
        timecodeSec: pendingCommentTime,
        endTimecodeSec: pendingEndTime,
        category: pendingCategory,
        priority: pendingPriority,
        comment: pendingCommentText.trim(),
        suggestedMediaUrl: pendingMusicUrl.trim() || null,
        suggestedMediaLabel: pendingMusicLabel.trim() || null,
        suggestedMediaFromSec: pendingMusicUrl.trim() ? Math.max(0, pendingMusicFromSec) : null,
        suggestedMediaToSec: pendingMusicUrl.trim() && pendingMusicToSec != null && pendingMusicToSec > pendingMusicFromSec
          ? pendingMusicToSec
          : null,
      });
      setShowCommentModal(false);
      setPendingCommentText('');
    } finally {
      setCommentSubmitting(false);
    }
  }, [onAddComment, pendingCommentText, pendingCommentTime, pendingEndTime, pendingCategory, pendingPriority, pendingMusicUrl, pendingMusicLabel, pendingMusicFromSec, pendingMusicToSec]);

  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimer = useRef<NodeJS.Timeout | null>(null);
  const chapterToastTimer = useRef<NodeJS.Timeout | null>(null);

  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(startMuted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hasStarted, setHasStarted] = useState(autoPlay);
  const [chapterToast, setChapterToast] = useState<VideoChapterMarker | null>(null);
  const [showTitleOverlay, setShowTitleOverlay] = useState(true);

  const sortedChapters = useMemo(
    () => [...(chapters || [])].sort((a, b) => a.startSec - b.startSec),
    [chapters],
  );

  // Hvilket kapittel er aktivt
  const activeChapter = useMemo(() => {
    let result: VideoChapterMarker | null = null;
    for (const ch of sortedChapters) {
      if (currentTime >= ch.startSec) result = ch;
      else break;
    }
    return result;
  }, [currentTime, sortedChapters]);

  // Toast når chapter-grensen krysses
  const lastChapterIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeChapter) return;
    const id = `${activeChapter.startSec}-${activeChapter.title}`;
    if (id === lastChapterIdRef.current) return;
    lastChapterIdRef.current = id;
    // Ikke vis toast for chapter 0 (vises som tittel-overlay i stedet)
    if (activeChapter.startSec === 0) return;
    setChapterToast(activeChapter);
    if (chapterToastTimer.current) clearTimeout(chapterToastTimer.current);
    chapterToastTimer.current = setTimeout(() => setChapterToast(null), 4000);
  }, [activeChapter]);

  // Skjul tittel-overlay etter 6s når video har startet
  useEffect(() => {
    if (!hasStarted) return;
    const t = setTimeout(() => setShowTitleOverlay(false), 6000);
    return () => clearTimeout(t);
  }, [hasStarted]);

  // Auto-hide controls etter 2s
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    if (!isPlaying) return;
    controlsTimer.current = setTimeout(() => setShowControls(false), 2000);
  }, [isPlaying]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, [isPlaying, resetControlsTimer]);

  // Video-event-handlers
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () => setDuration(v.duration || 0);
    const onPlay = () => { setIsPlaying(true); setHasStarted(true); };
    const onPause = () => setIsPlaying(false);
    const onVol = () => { setVolume(v.volume); setIsMuted(v.muted); };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('volumechange', onVol);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('volumechange', onVol);
    };
  }, []);

  // Fullscreen-event-handler
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => undefined);
    } else {
      document.exitFullscreen().catch(() => undefined);
    }
  }, []);

  const seekRelative = useCallback((deltaSec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + deltaSec));
  }, []);

  const seekTo = useCallback((sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, sec));
  }, []);

  const jumpToNextChapter = useCallback(() => {
    const next = sortedChapters.find((c) => c.startSec > currentTime + 0.5);
    if (next) seekTo(next.startSec);
  }, [sortedChapters, currentTime, seekTo]);

  // Keyboard-shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (videoRef.current) videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (videoRef.current) videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'c':
          jumpToNextChapter();
          break;
        default:
          if (/^[0-9]$/.test(e.key) && duration > 0) {
            const pct = Number(e.key) / 10;
            seekTo(duration * pct);
          }
      }
      resetControlsTimer();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, seekRelative, toggleMute, toggleFullscreen, jumpToNextChapter, duration, seekTo, resetControlsTimer]);

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <Box
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
      sx={{
        position: 'relative',
        width: '100%',
        bgcolor: '#0a0807',
        color: '#fdfaf5',
        overflow: 'hidden',
        aspectRatio: isFullscreen ? 'unset' : aspectRatio,
        height: isFullscreen ? '100vh' : undefined,
        cursor: showControls ? 'default' : 'none',
        // Letterboxing for ultrawide videoer
        '& video': {
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        },
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        autoPlay={autoPlay}
        loop={loop}
        muted={startMuted}
        playsInline
        preload="metadata"
        onClick={togglePlay}
      />

      {/* ── Hero tittel-overlay (vises før/like etter play) ─────────── */}
      <Fade in={showTitleOverlay && (title != null || subtitle != null)} timeout={prefersReducedMotion ? 0 : 800}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'flex-start',
            p: { xs: 3, sm: 6, md: 8 },
            background: hasStarted
              ? 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.7))'
              : 'linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.75))',
            pointerEvents: 'none',
            transition: 'background 1s',
          }}
        >
          {title && (
            <Typography
              component="h1"
              sx={{
                fontFamily: SERIF_STACK,
                fontWeight: 400,
                fontSize: { xs: '1.8rem', sm: '3rem', md: '4.2rem' },
                lineHeight: 1.0,
                letterSpacing: '-0.025em',
                color: '#fdfaf5',
                textShadow: '0 2px 24px rgba(0,0,0,0.6)',
                mb: 1,
                maxWidth: 720,
              }}
            >
              {title}
            </Typography>
          )}
          {subtitle && (
            <Typography
              sx={{
                fontFamily: SERIF_STACK,
                fontStyle: 'italic',
                fontSize: { xs: '0.95rem', sm: '1.15rem' },
                color: 'rgba(253, 250, 245, 0.85)',
                textShadow: '0 1px 12px rgba(0,0,0,0.5)',
                letterSpacing: '0.06em',
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Fade>

      {/* ── Chapter-toast (når brudeparet krysser kapittel-grense) ──── */}
      <Fade in={!!chapterToast} timeout={prefersReducedMotion ? 0 : 600}>
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 24, sm: 48 },
            left: '50%',
            transform: 'translateX(-50%)',
            px: 4,
            py: 2,
            bgcolor: 'rgba(10, 8, 7, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(217, 119, 6, 0.42)',
            borderRadius: 0.5,
            pointerEvents: 'none',
            textAlign: 'center',
            minWidth: 280,
          }}
        >
          {chapterToast?.romanNumeral && (
            <Typography
              sx={{
                fontFamily: SERIF_STACK,
                fontStyle: 'italic',
                fontSize: '0.85rem',
                color: '#d97706',
                letterSpacing: '0.32em',
                mb: 0.5,
              }}
            >
              {chapterToast.romanNumeral}
            </Typography>
          )}
          <Typography
            sx={{
              fontFamily: SERIF_STACK,
              fontWeight: 400,
              fontSize: { xs: '1.4rem', sm: '1.8rem' },
              color: '#fdfaf5',
              letterSpacing: '-0.015em',
              lineHeight: 1.1,
            }}
          >
            {chapterToast?.title}
          </Typography>
          {chapterToast?.intro && (
            <Typography
              sx={{
                fontFamily: SERIF_STACK,
                fontStyle: 'italic',
                fontSize: '0.9rem',
                color: 'rgba(253, 250, 245, 0.7)',
                mt: 1,
                maxWidth: 360,
              }}
            >
              {chapterToast.intro}
            </Typography>
          )}
        </Box>
      </Fade>

      {/* ── Big play-button (vises kun før første play) ─────────────── */}
      {!hasStarted && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconButton
            onClick={togglePlay}
            aria-label="Spill av video"
            sx={{
              width: { xs: 72, sm: 96 },
              height: { xs: 72, sm: 96 },
              bgcolor: 'rgba(253, 250, 245, 0.92)',
              color: '#0a0807',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.3s',
              '&:hover': {
                bgcolor: '#fdfaf5',
                transform: 'scale(1.05)',
              },
            }}
          >
            <PlayIcon sx={{ fontSize: { xs: 40, sm: 56 }, ml: 0.5 }} />
          </IconButton>
        </Box>
      )}

      {/* ── Bottom controls ─────────────────────────────────────────── */}
      <Fade in={hasStarted && showControls} timeout={prefersReducedMotion ? 0 : 400}>
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            px: { xs: 2, sm: 4 },
            pt: 6,
            pb: { xs: 2, sm: 3 },
            background: 'linear-gradient(0deg, rgba(0,0,0,0.85), transparent)',
          }}
        >
          {/* Progress-bar med chapter-markører + kommentar-markører */}
          <Box sx={{ position: 'relative', mb: 1 }}>
            {/* Chapter-markører (orange vertikale streker over progressbar) */}
            {duration > 0 && sortedChapters.map((ch) => {
              const left = (ch.startSec / duration) * 100;
              if (left <= 0 || left >= 100) return null;
              return (
                <Tooltip key={`${ch.startSec}-${ch.title}`} title={ch.title} placement="top">
                  <Box
                    onClick={() => seekTo(ch.startSec)}
                    sx={{
                      position: 'absolute',
                      left: `${left}%`,
                      top: -2,
                      width: 2,
                      height: 18,
                      bgcolor: '#d97706',
                      zIndex: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        width: 4,
                        height: 22,
                        top: -4,
                      },
                    }}
                  />
                </Tooltip>
              );
            })}

            {/* Slice 9X.82 (Bjarne) — Kommentar-prikker under progressbar */}
            {duration > 0 && sortedComments.map((c) => {
              const left = (c.timecodeSec / duration) * 100;
              if (left < 0 || left > 100) return null;
              const isHovered = hoveredCommentId === c.id;
              const isResolved = c.status === 'resolved';
              return (
                <Box
                  key={c.id}
                  onClick={() => seekTo(c.timecodeSec)}
                  onMouseEnter={() => setHoveredCommentId(c.id)}
                  onMouseLeave={() => setHoveredCommentId(null)}
                  sx={{
                    position: 'absolute',
                    left: `calc(${left}% - 6px)`,
                    bottom: -16,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: isResolved ? 'rgba(16, 185, 129, 0.9)' : '#fdfaf5',
                    border: '2px solid #0a0807',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    zIndex: 3,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                  }}
                />
              );
            })}

            {/* Hover-popover med kommentartekst */}
            {hoveredCommentId && (() => {
              const c = sortedComments.find((x) => x.id === hoveredCommentId);
              if (!c || duration === 0) return null;
              const left = (c.timecodeSec / duration) * 100;
              return (
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${Math.min(85, Math.max(15, left))}%`,
                    transform: 'translateX(-50%)',
                    bottom: 24,
                    bgcolor: 'rgba(10, 8, 7, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(253, 250, 245, 0.18)',
                    borderRadius: 1,
                    p: 1.5,
                    maxWidth: 280,
                    minWidth: 200,
                    zIndex: 4,
                    pointerEvents: 'none',
                  }}
                >
                  <Typography sx={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.78rem', color: '#d97706', mb: 0.5 }}>
                    {fmtTime(c.timecodeSec)} · {c.clientName || c.clientEmail || 'Klient'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: '#fdfaf5', lineHeight: 1.4 }}>
                    {c.comment}
                  </Typography>
                </Box>
              );
            })()}
            <Slider
              value={progressPct}
              onChange={(_, v) => {
                if (duration > 0) seekTo((v as number / 100) * duration);
              }}
              aria-label="Video-fremgang"
              sx={{
                color: '#fdfaf5',
                height: 3,
                py: '14px',
                '& .MuiSlider-thumb': {
                  width: 12,
                  height: 12,
                  '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 8px rgba(253,250,245,0.18)' },
                },
                '& .MuiSlider-rail': { bgcolor: 'rgba(253,250,245,0.32)' },
              }}
            />
          </Box>

          {/* Knapp-rad */}
          <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 1 }}>
            <Tooltip title={isPlaying ? 'Pause (mellomrom)' : 'Spill av (mellomrom)'}>
              <IconButton
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Spill av'}
                sx={{ color: '#fdfaf5', minWidth: 44, minHeight: 44 }}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Tilbake 5 sek (←)">
              <IconButton onClick={() => seekRelative(-5)} aria-label="Spol tilbake" sx={{ color: '#fdfaf5', minWidth: 44, minHeight: 44 }}>
                <Replay5Icon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Fram 5 sek (→)">
              <IconButton onClick={() => seekRelative(5)} aria-label="Spol fram" sx={{ color: '#fdfaf5', minWidth: 44, minHeight: 44 }}>
                <Forward5Icon />
              </IconButton>
            </Tooltip>
            {sortedChapters.length > 0 && (
              <Tooltip title="Neste kapittel (C)">
                <IconButton onClick={jumpToNextChapter} aria-label="Neste kapittel" sx={{ color: '#fdfaf5', minWidth: 44, minHeight: 44 }}>
                  <ChapterNextIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title={isMuted ? 'Slå på lyd (M)' : 'Slå av lyd (M)'}>
              <IconButton onClick={toggleMute} aria-label={isMuted ? 'Slå på lyd' : 'Slå av lyd'} sx={{ color: '#fdfaf5', minWidth: 44, minHeight: 44 }}>
                {isMuted || volume === 0 ? <VolumeOffIcon /> : <VolumeIcon />}
              </IconButton>
            </Tooltip>

            {/* Tids-display */}
            <Typography
              sx={{
                fontFamily: SERIF_STACK,
                fontStyle: 'italic',
                fontSize: '0.85rem',
                color: 'rgba(253, 250, 245, 0.85)',
                letterSpacing: '0.06em',
                ml: 1,
                minWidth: 90,
              }}
            >
              {fmtTime(currentTime)} · {fmtTime(duration)}
            </Typography>

            {/* Aktiv kapittel-tittel (kompakt, midten) */}
            {activeChapter && (
              <Box sx={{ flex: 1, textAlign: 'center', minWidth: 0, px: 1 }}>
                <Typography
                  noWrap
                  sx={{
                    fontFamily: SERIF_STACK,
                    fontStyle: 'italic',
                    fontSize: { xs: '0.8rem', sm: '0.95rem' },
                    color: 'rgba(253, 250, 245, 0.6)',
                    letterSpacing: '0.08em',
                  }}
                >
                  {activeChapter.title}
                </Typography>
              </Box>
            )}
            {!activeChapter && <Box sx={{ flex: 1 }} />}

            {/* Slice 9X.82 (Bjarne) — Frame.io-stil kommentar-knapp */}
            {onAddComment && (
              <Tooltip title={`Kommenter på ${fmtTime(currentTime)}`}>
                <IconButton
                  onClick={openCommentForCurrentTime}
                  aria-label="Kommenter på dette tidspunktet"
                  sx={{
                    color: '#d97706',
                    bgcolor: 'rgba(217, 119, 6, 0.12)',
                    minWidth: 44,
                    minHeight: 44,
                    '&:hover': { bgcolor: 'rgba(217, 119, 6, 0.22)' },
                  }}
                >
                  <CommentIcon />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title={isFullscreen ? 'Avslutt fullskjerm (F)' : 'Fullskjerm (F)'}>
              <IconButton onClick={toggleFullscreen} aria-label={isFullscreen ? 'Avslutt fullskjerm' : 'Fullskjerm'} sx={{ color: '#fdfaf5', minWidth: 44, minHeight: 44 }}>
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Fade>

      {/* Slice 9X.82 (Bjarne) — Kommentar-modal (Pic-Time editorial overlay) */}
      <Fade in={showCommentModal} timeout={prefersReducedMotion ? 0 : 300}>
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            display: showCommentModal ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(10, 8, 7, 0.78)',
            backdropFilter: 'blur(16px)',
          }}
        >
          <Box
            sx={{
              maxWidth: 480,
              width: 'calc(100% - 32px)',
              bgcolor: '#fdfaf5',
              color: '#1a1612',
              borderRadius: 1,
              p: { xs: 3, sm: 4 },
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              position: 'relative',
            }}
          >
            <IconButton
              onClick={() => setShowCommentModal(false)}
              aria-label="Lukk"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                color: '#1a1612',
              }}
            >
              <CloseIcon />
            </IconButton>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '0.32em',
                color: '#a8957e',
                textTransform: 'uppercase',
                mb: 1,
              }}
            >
              · Kommentar ved {fmtTime(pendingCommentTime)}
              {pendingEndTime != null && ` → ${fmtTime(pendingEndTime)}`} ·
            </Typography>
            <Typography
              sx={{
                fontFamily: SERIF_STACK,
                fontWeight: 400,
                fontSize: { xs: '1.6rem', sm: '2rem' },
                lineHeight: 1.0,
                letterSpacing: '-0.02em',
                color: '#1a1612',
                mb: 1.5,
              }}
            >
              Hva ser du?
            </Typography>
            <Typography sx={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.95rem', color: '#5a4f42', mb: 2 }}>
              {clientName ? `${clientName} — ` : ''}gi Bjarne presis edit-tilbakemelding
            </Typography>

            {/* Kategori-velger */}
            <Typography variant="caption" sx={{ color: '#5a4f42', mb: 0.5, display: 'block', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.66rem' }}>
              Kategori
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              {([
                { v: 'color' as const, l: 'Farge' },
                { v: 'audio' as const, l: 'Lyd' },
                { v: 'edit' as const, l: 'Klipping' },
                { v: 'vfx' as const, l: 'VFX' },
                { v: 'structure' as const, l: 'Struktur' },
                { v: 'text' as const, l: 'Tekst' },
                { v: 'other' as const, l: 'Annet' },
              ]).map((opt) => {
                const isSelected = pendingCategory === opt.v;
                return (
                  <Box
                    key={opt.v}
                    onClick={() => setPendingCategory(opt.v)}
                    role="button"
                    tabIndex={0}
                    sx={{
                      cursor: 'pointer',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 0.5,
                      bgcolor: isSelected ? '#1a1612' : 'transparent',
                      color: isSelected ? '#fdfaf5' : '#5a4f42',
                      border: `1px solid ${isSelected ? '#1a1612' : '#d4c4b0'}`,
                      fontFamily: '"Inter", "Segoe UI", sans-serif',
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 700 : 500,
                      letterSpacing: '0.02em',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: '#1a1612' },
                    }}
                  >
                    {opt.l}
                  </Box>
                );
              })}
            </Stack>

            {/* Prioritet */}
            <Typography variant="caption" sx={{ color: '#5a4f42', mb: 0.5, display: 'block', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.66rem' }}>
              Prioritet
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ mb: 1.5 }}>
              {([
                { v: 'must-fix' as const, l: 'Må fikses', color: '#dc2626' },
                { v: 'nice-to-have' as const, l: 'Ønske', color: '#d97706' },
                { v: 'suggestion' as const, l: 'Forslag', color: '#5a4f42' },
              ]).map((opt) => {
                const isSelected = pendingPriority === opt.v;
                return (
                  <Box
                    key={opt.v}
                    onClick={() => setPendingPriority(opt.v)}
                    role="button"
                    tabIndex={0}
                    sx={{
                      cursor: 'pointer',
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 0.5,
                      bgcolor: isSelected ? opt.color : 'transparent',
                      color: isSelected ? '#fdfaf5' : opt.color,
                      border: `1px solid ${opt.color}66`,
                      fontFamily: '"Inter", "Segoe UI", sans-serif',
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 700 : 500,
                      letterSpacing: '0.02em',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: opt.color },
                    }}
                  >
                    {opt.l}
                  </Box>
                );
              })}
            </Stack>

            {/* Range-toggle */}
            <Box
              onClick={() => {
                if (pendingEndTime != null) setPendingEndTime(null);
                else if (videoRef.current) setPendingEndTime(Math.min(videoRef.current.duration || 0, pendingCommentTime + 5));
              }}
              role="button"
              tabIndex={0}
              sx={{
                cursor: 'pointer',
                fontSize: '0.78rem',
                color: pendingEndTime != null ? '#d97706' : '#5a4f42',
                fontFamily: SERIF_STACK,
                fontStyle: 'italic',
                mb: 2,
                display: 'inline-block',
                '&:hover': { color: '#d97706' },
              }}
            >
              {pendingEndTime != null
                ? `← Tilbake til kun punkt-kommentar (${fmtTime(pendingCommentTime)})`
                : `+ Marker en periode (fra ${fmtTime(pendingCommentTime)} til ...)`}
            </Box>
            {pendingEndTime != null && (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(217, 119, 6, 0.08)', border: '1px solid rgba(217, 119, 6, 0.32)', borderRadius: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#5a4f42', display: 'block', mb: 0.5 }}>
                  Slutt-tidspunkt (sekunder fra {fmtTime(pendingCommentTime)}):
                </Typography>
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={Math.max(1, Math.round(pendingEndTime - pendingCommentTime))}
                  onChange={(e) => {
                    const sec = Math.max(1, Math.min(300, Number(e.target.value) || 1));
                    setPendingEndTime(pendingCommentTime + sec);
                  }}
                  style={{
                    width: 80,
                    padding: '6px 10px',
                    border: '1px solid #d4c4b0',
                    borderRadius: 2,
                    fontFamily: 'inherit',
                    fontSize: '0.9rem',
                  }}
                />{' '}sek
              </Box>
            )}

            <TextField
              fullWidth
              multiline
              rows={4}
              autoFocus
              placeholder="F.eks. 'Kan vi få mer av mors tale her?' eller 'Color er for varm — kjør det -300K kaldere'"
              value={pendingCommentText}
              onChange={(e) => setPendingCommentText(e.target.value)}
              inputProps={{ maxLength: 1800 }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontFamily: SERIF_STACK,
                  fontStyle: 'italic',
                  fontSize: '1.05rem',
                  bgcolor: 'rgba(255,255,255,0.6)',
                  '& fieldset': { borderColor: '#d4c4b0' },
                  '&:hover fieldset': { borderColor: '#a8957e' },
                  '&.Mui-focused fieldset': { borderColor: '#d97706' },
                },
              }}
            />
            {/* Slice 9X.82 — Musikk-forslag (toggle-section) */}
            <Box
              onClick={() => setShowMusicFields((s) => !s)}
              role="button"
              tabIndex={0}
              sx={{
                mt: 2,
                cursor: 'pointer',
                fontSize: '0.85rem',
                color: showMusicFields ? '#d97706' : '#5a4f42',
                fontFamily: SERIF_STACK,
                fontStyle: 'italic',
                '&:hover': { color: '#d97706' },
              }}
            >
              {showMusicFields ? '× Fjern musikk-forslag' : '+ Foreslå en sang her (YouTube/Spotify)'}
            </Box>
            {showMusicFields && (
              <Box sx={{ mt: 1.5, p: 2, bgcolor: 'rgba(217, 119, 6, 0.06)', border: '1px solid rgba(217, 119, 6, 0.32)', borderRadius: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#5a4f42', display: 'block', mb: 0.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.66rem' }}>
                  Sang-URL (YouTube, Spotify, SoundCloud, Apple Music)
                </Typography>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={pendingMusicUrl}
                  onChange={(e) => setPendingMusicUrl(e.target.value.trim())}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d4c4b0',
                    borderRadius: 2,
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                    marginBottom: 8,
                  }}
                />
                <Typography variant="caption" sx={{ color: '#5a4f42', display: 'block', mb: 0.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.66rem' }}>
                  Sang-tittel / artist (for Bjarne)
                </Typography>
                <input
                  type="text"
                  placeholder="F.eks. 'A Thousand Years — Christina Perri'"
                  value={pendingMusicLabel}
                  onChange={(e) => setPendingMusicLabel(e.target.value)}
                  maxLength={120}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d4c4b0',
                    borderRadius: 2,
                    fontFamily: 'inherit',
                    fontSize: '0.85rem',
                    marginBottom: 8,
                  }}
                />
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#5a4f42', display: 'block', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.66rem' }}>
                      Fra (sek inn i sangen)
                    </Typography>
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      value={pendingMusicFromSec}
                      onChange={(e) => setPendingMusicFromSec(Math.max(0, Number(e.target.value) || 0))}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        border: '1px solid #d4c4b0',
                        borderRadius: 2,
                        fontFamily: 'inherit',
                        fontSize: '0.85rem',
                      }}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#5a4f42', display: 'block', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.66rem' }}>
                      Til (sek inn i sangen — valgfritt)
                    </Typography>
                    <input
                      type="number"
                      min={1}
                      max={3600}
                      value={pendingMusicToSec ?? ''}
                      placeholder="ikke satt"
                      onChange={(e) => setPendingMusicToSec(e.target.value ? Math.max(1, Number(e.target.value) || 1) : null)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        border: '1px solid #d4c4b0',
                        borderRadius: 2,
                        fontFamily: 'inherit',
                        fontSize: '0.85rem',
                      }}
                    />
                  </Box>
                </Stack>
                <Typography variant="caption" sx={{ color: '#a8957e', fontStyle: 'italic', mt: 1, display: 'block', fontSize: '0.78rem' }}>
                  Bjarne får en klikkbar lenke som åpner sangen ved riktig tidspunkt.
                </Typography>
              </Box>
            )}

            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
              <Button
                onClick={() => setShowCommentModal(false)}
                disabled={commentSubmitting}
                sx={{
                  fontFamily: SERIF_STACK,
                  fontStyle: 'italic',
                  color: '#5a4f42',
                  textTransform: 'none',
                  fontSize: '0.95rem',
                }}
              >
                Avbryt
              </Button>
              <Button
                onClick={submitComment}
                disabled={commentSubmitting || !pendingCommentText.trim()}
                startIcon={<SendIcon />}
                sx={{
                  bgcolor: '#1a1612',
                  color: '#fdfaf5',
                  fontFamily: '"Inter", "Segoe UI", sans-serif',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  fontSize: '0.75rem',
                  px: 3,
                  py: 1.5,
                  borderRadius: 0,
                  '&:hover': { bgcolor: '#2d2620' },
                  '&.Mui-disabled': { bgcolor: '#a8957e', color: '#fdfaf5' },
                }}
              >
                {commentSubmitting ? 'Sender…' : 'Send tilbakemelding'}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Fade>
    </Box>
  );
};

export default CinematicVideoPlayer;
