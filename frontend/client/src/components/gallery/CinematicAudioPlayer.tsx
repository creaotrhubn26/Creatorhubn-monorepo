// @ts-nocheck
/**
 * CinematicAudioPlayer — Slice 9X.82 (Pic-Time 2.0 for Michael, music producer)
 *
 * Editorial audio-player med waveform-visualisering. Parallell til
 * CinematicVideoPlayer (video) og GallerySlideshow (foto). Gjør at
 * Michaels klienter (artister, A&R, vokalister) kan lytte til track-
 * leveransen i en magazine-følelse + kommentere på spesifikt
 * millisekund (Frame.io-stil, gjenbruker video_timecode_comments).
 *
 * Features:
 *   - Stor cover-art med Cormorant tittel + italic credits over
 *   - WaveSurfer-canvas i cream/sort med peaks
 *   - Section-markører på waveformen ("Intro / Vers / Refreng")
 *   - Kommentar-prikker under waveform (klikk = seek + popover)
 *   - Custom transport-controls (play/pause, ±10s, skip section, volum)
 *   - "Kommenter på dette tidspunktet"-knapp som pauser + åpner modal
 *   - Cormorant tidsdisplay "0:42 · 3:18"
 *   - Keyboard: space (play), ←/→ (10s), ↑/↓ (volume), m (mute),
 *     0-9 (jump), c (next section)
 *   - prefers-reduced-motion-respekt
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import WaveSurfer from 'wavesurfer.js';
import {
  Box,
  IconButton,
  Stack,
  Typography,
  Tooltip,
  Fade,
  TextField,
  Button,
  useMediaQuery,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  VolumeUp as VolumeIcon,
  VolumeOff as VolumeOffIcon,
  Forward10 as Forward10Icon,
  Replay10 as Replay10Icon,
  SkipNext as SectionNextIcon,
  ChatBubbleOutline as CommentIcon,
  Close as CloseIcon,
  Send as SendIcon,
  MusicNote as MusicIcon,
} from '@mui/icons-material';

const SERIF_STACK = '"Cormorant Garamond", "Playfair Display", Georgia, serif';

export interface AudioSectionMarker {
  startSec: number;
  title: string;
  romanNumeral?: string | null;
}

export type CommentCategory = 'color' | 'audio' | 'edit' | 'vfx' | 'structure' | 'text' | 'other';
export type CommentPriority = 'must-fix' | 'nice-to-have' | 'suggestion';

export interface AudioTimecodeComment {
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
}

interface Props {
  src: string;
  /** Cover-art for track */
  coverUrl?: string | null;
  /** Hovedtittel ("Hvitveis EP — Vinternatt") */
  title?: string | null;
  /** Italic credits ("Komponist Michael Larsen · Vokal Stine Berg · Mix Jon Olsen") */
  credits?: string | null;
  /** Section-markører på waveformen */
  sections?: AudioSectionMarker[];
  /** Kommentarer fra klient */
  comments?: AudioTimecodeComment[];
  /** Callback når klient legger til ny kommentar */
  onAddComment?: (input: { timecodeSec: number; comment: string }) => Promise<void> | void;
  /** Klient-navn (forhåndsfyller comment-modalen) */
  clientName?: string | null;
}

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const CinematicAudioPlayer: React.FC<Props> = ({
  src,
  coverUrl,
  title,
  credits,
  sections = [],
  comments = [],
  onAddComment,
  clientName,
}) => {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [isReady, setIsReady] = useState(false);
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [pendingCommentText, setPendingCommentText] = useState('');
  const [pendingCommentTime, setPendingCommentTime] = useState(0);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [sectionToast, setSectionToast] = useState<AudioSectionMarker | null>(null);
  const sectionToastTimer = useRef<NodeJS.Timeout | null>(null);

  const sortedSections = useMemo(
    () => [...(sections || [])].sort((a, b) => a.startSec - b.startSec),
    [sections],
  );
  const sortedComments = useMemo(
    () => [...(comments || [])].sort((a, b) => a.timecodeSec - b.timecodeSec),
    [comments],
  );

  const activeSection = useMemo(() => {
    let result: AudioSectionMarker | null = null;
    for (const s of sortedSections) {
      if (currentTime >= s.startSec) result = s;
      else break;
    }
    return result;
  }, [currentTime, sortedSections]);

  // Section-toast når brukeren krysser en section-grense
  const lastSectionIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSection || !isPlaying) return;
    const id = `${activeSection.startSec}-${activeSection.title}`;
    if (id === lastSectionIdRef.current) return;
    lastSectionIdRef.current = id;
    if (activeSection.startSec === 0) return;
    setSectionToast(activeSection);
    if (sectionToastTimer.current) clearTimeout(sectionToastTimer.current);
    sectionToastTimer.current = setTimeout(() => setSectionToast(null), 3000);
  }, [activeSection, isPlaying]);

  // Initialiser WaveSurfer ved mount
  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(253, 250, 245, 0.45)',
      progressColor: '#d97706',
      cursorColor: '#fdfaf5',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 96,
      normalize: true,
      url: src,
      backend: 'WebAudio',
    });
    wavesurferRef.current = ws;
    ws.on('ready', () => {
      setIsReady(true);
      setDuration(ws.getDuration());
      ws.setVolume(volume);
    });
    ws.on('audioprocess', () => setCurrentTime(ws.getCurrentTime()));
    ws.on('seeking', () => setCurrentTime(ws.getCurrentTime()));
    ws.on('play', () => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => setIsPlaying(false));

    return () => {
      try { ws.destroy(); } catch { /* ignore destroy-during-load */ }
      wavesurferRef.current = null;
    };
    // src endring → re-initialiser
  }, [src]);

  // Synk volume
  useEffect(() => {
    if (wavesurferRef.current) wavesurferRef.current.setVolume(isMuted ? 0 : volume);
  }, [volume, isMuted]);

  const togglePlay = useCallback(() => {
    wavesurferRef.current?.playPause();
  }, []);

  const seekTo = useCallback((sec: number) => {
    const ws = wavesurferRef.current;
    if (!ws || duration === 0) return;
    ws.seekTo(Math.max(0, Math.min(1, sec / duration)));
    setCurrentTime(sec);
  }, [duration]);

  const seekRelative = useCallback((deltaSec: number) => {
    seekTo(currentTime + deltaSec);
  }, [seekTo, currentTime]);

  const toggleMute = useCallback(() => setIsMuted((m) => !m), []);

  const jumpToNextSection = useCallback(() => {
    const next = sortedSections.find((s) => s.startSec > currentTime + 0.5);
    if (next) seekTo(next.startSec);
  }, [sortedSections, currentTime, seekTo]);

  const openCommentForCurrentTime = useCallback(() => {
    wavesurferRef.current?.pause();
    setPendingCommentTime(currentTime);
    setPendingCommentText('');
    setShowCommentModal(true);
  }, [currentTime]);

  const submitComment = useCallback(async () => {
    if (!onAddComment || !pendingCommentText.trim()) return;
    setCommentSubmitting(true);
    try {
      await onAddComment({ timecodeSec: pendingCommentTime, comment: pendingCommentText.trim() });
      setShowCommentModal(false);
      setPendingCommentText('');
    } finally {
      setCommentSubmitting(false);
    }
  }, [onAddComment, pendingCommentText, pendingCommentTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.target && (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(10);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume((v) => Math.min(1, v + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 0.1));
          break;
        case 'm':
          toggleMute();
          break;
        case 'c':
          jumpToNextSection();
          break;
        default:
          if (/^[0-9]$/.test(e.key) && duration > 0) {
            seekTo(duration * (Number(e.key) / 10));
          }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, seekRelative, toggleMute, jumpToNextSection, duration, seekTo]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        bgcolor: '#0a0807',
        color: '#fdfaf5',
        borderRadius: 1,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}
    >
      {/* ── Cover-header ────────────────────────────────────────────── */}
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: 220, sm: 320 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'flex-start',
          p: { xs: 3, sm: 5 },
          background: coverUrl
            ? `linear-gradient(180deg, rgba(10,8,7,0.55), rgba(10,8,7,0.92)), url(${coverUrl}) center/cover`
            : 'radial-gradient(circle at 30% 20%, rgba(217, 119, 6, 0.18), transparent 50%), radial-gradient(circle at 70% 80%, rgba(155, 135, 245, 0.12), transparent 60%), #0a0807',
        }}
      >
        {!coverUrl && (
          <MusicIcon sx={{ position: 'absolute', top: 24, right: 24, fontSize: 32, color: 'rgba(253, 250, 245, 0.32)' }} />
        )}
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.32em',
            color: 'rgba(253, 250, 245, 0.55)',
            textTransform: 'uppercase',
            mb: 1.5,
          }}
        >
          · Lytt og kommenter ·
        </Typography>
        {title && (
          <Typography
            component="h2"
            sx={{
              fontFamily: SERIF_STACK,
              fontWeight: 400,
              fontSize: { xs: '1.8rem', sm: '2.8rem', md: '3.4rem' },
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
        {credits && (
          <Typography
            sx={{
              fontFamily: SERIF_STACK,
              fontStyle: 'italic',
              fontSize: { xs: '0.95rem', sm: '1.1rem' },
              color: 'rgba(253, 250, 245, 0.85)',
              letterSpacing: '0.04em',
              textShadow: '0 1px 12px rgba(0,0,0,0.5)',
              maxWidth: 640,
            }}
          >
            {credits}
          </Typography>
        )}
      </Box>

      {/* ── Section-toast ───────────────────────────────────────────── */}
      <Fade in={!!sectionToast} timeout={prefersReducedMotion ? 0 : 600}>
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 16, sm: 32 },
            left: '50%',
            transform: 'translateX(-50%)',
            px: 3,
            py: 1.5,
            bgcolor: 'rgba(10, 8, 7, 0.9)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(217, 119, 6, 0.42)',
            borderRadius: 0.5,
            pointerEvents: 'none',
            textAlign: 'center',
            minWidth: 200,
          }}
        >
          {sectionToast?.romanNumeral && (
            <Typography sx={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.8rem', color: '#d97706', letterSpacing: '0.28em', mb: 0.3 }}>
              {sectionToast.romanNumeral}
            </Typography>
          )}
          <Typography sx={{ fontFamily: SERIF_STACK, fontWeight: 400, fontSize: { xs: '1.2rem', sm: '1.5rem' }, color: '#fdfaf5', letterSpacing: '-0.015em' }}>
            {sectionToast?.title}
          </Typography>
        </Box>
      </Fade>

      {/* ── Waveform-visualisering ──────────────────────────────────── */}
      <Box sx={{ position: 'relative', bgcolor: 'rgba(0,0,0,0.4)', py: 2, px: { xs: 2, sm: 4 } }}>
        {/* Section-markører (orange vertikale streker over waveform) */}
        {duration > 0 && (
          <Box sx={{ position: 'relative', height: 0 }}>
            {sortedSections.map((s) => {
              const left = (s.startSec / duration) * 100;
              if (left <= 0 || left >= 100) return null;
              return (
                <Tooltip key={`${s.startSec}-${s.title}`} title={s.title} placement="top">
                  <Box
                    onClick={() => seekTo(s.startSec)}
                    sx={{
                      position: 'absolute',
                      left: `${left}%`,
                      top: 0,
                      width: 2,
                      height: 110,
                      bgcolor: '#d97706',
                      zIndex: 2,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': { width: 4 },
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        )}

        {/* WaveSurfer canvas mountes her */}
        <Box ref={containerRef} sx={{ minHeight: 96, '& ::part(cursor)': { display: 'none' } }} />

        {!isReady && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <Typography sx={{ fontFamily: SERIF_STACK, fontStyle: 'italic', color: 'rgba(253,250,245,0.5)' }}>
              Laster lyd…
            </Typography>
          </Box>
        )}

        {/* Comment-prikker under waveform */}
        {duration > 0 && (
          <Box sx={{ position: 'relative', height: 0, mt: 0.5 }}>
            {sortedComments.map((c) => {
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
                    top: 4,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: isResolved ? 'rgba(16, 185, 129, 0.9)' : '#fdfaf5',
                    border: '2px solid #0a0807',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    zIndex: 3,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    transform: isHovered ? 'scale(1.4)' : 'scale(1)',
                  }}
                />
              );
            })}
            {/* Hover-popover */}
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
                    top: 24,
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
          </Box>
        )}
      </Box>

      {/* ── Transport-controls ──────────────────────────────────────── */}
      <Box sx={{ px: { xs: 2, sm: 4 }, py: { xs: 2, sm: 2.5 }, bgcolor: 'rgba(0,0,0,0.6)' }}>
        <Stack direction="row" alignItems="center" spacing={{ xs: 0.5, sm: 1 }}>
          <Tooltip title={isPlaying ? 'Pause (mellomrom)' : 'Spill av (mellomrom)'}>
            <IconButton onClick={togglePlay} disabled={!isReady} aria-label={isPlaying ? 'Pause' : 'Spill av'}
              sx={{
                color: '#0a0807',
                bgcolor: '#fdfaf5',
                width: 48,
                height: 48,
                '&:hover': { bgcolor: '#fff' },
                '&.Mui-disabled': { bgcolor: 'rgba(253,250,245,0.4)' },
              }}>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Tilbake 10 sek (←)">
            <IconButton onClick={() => seekRelative(-10)} aria-label="Spol tilbake" sx={{ color: '#fdfaf5', minWidth: 44, minHeight: 44 }}>
              <Replay10Icon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fram 10 sek (→)">
            <IconButton onClick={() => seekRelative(10)} aria-label="Spol fram" sx={{ color: '#fdfaf5', minWidth: 44, minHeight: 44 }}>
              <Forward10Icon />
            </IconButton>
          </Tooltip>
          {sortedSections.length > 0 && (
            <Tooltip title="Neste seksjon (C)">
              <IconButton onClick={jumpToNextSection} aria-label="Neste seksjon" sx={{ color: '#fdfaf5', minWidth: 44, minHeight: 44 }}>
                <SectionNextIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={isMuted ? 'Slå på lyd (M)' : 'Slå av lyd (M)'}>
            <IconButton onClick={toggleMute} aria-label={isMuted ? 'Slå på lyd' : 'Slå av lyd'} sx={{ color: '#fdfaf5', minWidth: 44, minHeight: 44 }}>
              {isMuted || volume === 0 ? <VolumeOffIcon /> : <VolumeIcon />}
            </IconButton>
          </Tooltip>

          {/* Tidsdisplay */}
          <Typography
            sx={{
              fontFamily: SERIF_STACK,
              fontStyle: 'italic',
              fontSize: '0.9rem',
              color: 'rgba(253, 250, 245, 0.85)',
              letterSpacing: '0.06em',
              ml: 1,
              minWidth: 90,
            }}
          >
            {fmtTime(currentTime)} · {fmtTime(duration)}
          </Typography>

          {/* Aktiv seksjon midten */}
          {activeSection && (
            <Box sx={{ flex: 1, textAlign: 'center', minWidth: 0, px: 1 }}>
              <Typography
                noWrap
                sx={{
                  fontFamily: SERIF_STACK,
                  fontStyle: 'italic',
                  fontSize: { xs: '0.85rem', sm: '0.95rem' },
                  color: 'rgba(253, 250, 245, 0.6)',
                  letterSpacing: '0.08em',
                }}
              >
                {activeSection.title}
              </Typography>
            </Box>
          )}
          {!activeSection && <Box sx={{ flex: 1 }} />}

          {/* Kommentar-knapp */}
          {onAddComment && (
            <Tooltip title={`Kommenter på ${fmtTime(currentTime)}`}>
              <IconButton
                onClick={openCommentForCurrentTime}
                disabled={!isReady}
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
        </Stack>
      </Box>

      {/* ── Comment-modal (Pic-Time editorial) ──────────────────────── */}
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
            p: 2,
          }}
        >
          <Box
            sx={{
              maxWidth: 480,
              width: '100%',
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
              sx={{ position: 'absolute', top: 8, right: 8, color: '#1a1612' }}
            >
              <CloseIcon />
            </IconButton>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.32em', color: '#a8957e', textTransform: 'uppercase', mb: 1 }}>
              · Notat ved {fmtTime(pendingCommentTime)} ·
            </Typography>
            <Typography sx={{ fontFamily: SERIF_STACK, fontWeight: 400, fontSize: { xs: '1.6rem', sm: '2rem' }, lineHeight: 1.0, letterSpacing: '-0.02em', color: '#1a1612', mb: 2 }}>
              Hva hører du?
            </Typography>
            <Typography sx={{ fontFamily: SERIF_STACK, fontStyle: 'italic', fontSize: '0.95rem', color: '#5a4f42', mb: 2.5 }}>
              {clientName ? `${clientName} — ` : ''}fortell hva du tenker om dette øyeblikket i miksen
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              autoFocus
              placeholder="F.eks. 'Vokal er litt for høy her' eller 'Pusht bass +2dB rundt taktene'"
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
            <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
              <Button
                onClick={() => setShowCommentModal(false)}
                disabled={commentSubmitting}
                sx={{ fontFamily: SERIF_STACK, fontStyle: 'italic', color: '#5a4f42', textTransform: 'none', fontSize: '0.95rem' }}
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
                {commentSubmitting ? 'Sender…' : 'Send notat'}
              </Button>
            </Stack>
          </Box>
        </Box>
      </Fade>
    </Box>
  );
};

export default CinematicAudioPlayer;
