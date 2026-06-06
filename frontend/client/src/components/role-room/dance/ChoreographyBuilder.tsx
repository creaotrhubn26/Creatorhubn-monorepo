/**
 * ChoreographyBuilder — hovedkomponent i dans-vertikalen.
 *
 * Tre-kolonne-layout:
 *   ┌────────────┬──────────────────────────────────┬──────────────┐
 *   │  Segment-  │        Multi-layer timeline      │   Inspector  │
 *   │  liste     │        (musikk / koreografi /    │   for valgt  │
 *   │  (drag-    │         formasjon / kamera /     │   segment    │
 *   │   sortert) │         lys / kostyme / notat)   │              │
 *   └────────────┴──────────────────────────────────┴──────────────┘
 *
 * MVP-scope: les-/skriv mot lokal state (demo-data ved oppstart).
 * Persistens og samarbeid kommer i en senere PR. Ingen backend-kall.
 */

import { danceFlowColors } from './danceFlowTheme';
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Save as SaveIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  MusicNote as MusicIcon,
  ChevronRight as ChevronRightIcon,
  Delete as DeleteIcon,
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckIcon,
  Person as PersonIcon,
  Movie as VideoIcon,
} from '@mui/icons-material';
import useBrandingSettings from '../hooks/useBrandingSettings';
import {
  buildDemoChoreography,
  formatTime,
  getApprovalMeta,
  getEnergyMeta,
  getSegmentMeta,
  segmentDuration,
  SEGMENT_KINDS,
  ENERGY_LEVELS,
  APPROVAL_STATUSES,
  TIMELINE_LAYERS,
  type ApprovalStatus,
  type Choreography,
  type CountGrid as CountGridState,
  type EnergyLevel,
  type Segment,
  type SegmentKind,
  type TimelineLayerMeta,
} from './choreographyTypes';
import { CountGrid } from './CountGrid';
import { MusicWaveform } from './MusicWaveform';
import { VideoRefPlayer } from './VideoRefPlayer';

// ─── Sub-helpers ────────────────────────────────────────────────────────

const ROW_HEIGHT_BLOCK = 44;        // litt høyere for å gi plass til drag-handles
const ROW_HEIGHT_TEXT = 30;
const ROW_HEIGHT_WAVEFORM = 28;
const TIMELINE_LEFT_LABEL_WIDTH = 110;
const DRAG_HANDLE_WIDTH = 6;
const SNAP_INTERVAL_SEC = 1;        // snap til nærmeste hele sekund
const MIN_SEGMENT_DURATION_SEC = 1;

function rowHeightFor(layer: TimelineLayerMeta): number {
  switch (layer.variant) {
    case 'block': return ROW_HEIGHT_BLOCK;
    case 'waveform': return ROW_HEIGHT_WAVEFORM;
    case 'meter': return 22;
    default: return ROW_HEIGHT_TEXT;
  }
}

function getSegmentValue(segment: Segment, layer: TimelineLayerMeta): string {
  if (layer.segmentField === 'kind') {
    return segment.label ?? '';
  }
  const v = (segment as unknown as Record<string, unknown>)[layer.segmentField as string];
  return typeof v === 'string' ? v : '';
}

// ─── Props ──────────────────────────────────────────────────────────────

export interface ChoreographyBuilderProps {
  /** Override startverdi — brukes i tester. Default = buildDemoChoreography(). */
  initialChoreography?: Choreography;
  /** Kalles når brukeren trykker "Lagre". MVP gjør ingenting hvis udefinert. */
  onSave?: (choreography: Choreography) => void;
  /** Hvis satt, autosaver hver endring etter 1.5s debounce. */
  onAutosave?: (choreography: Choreography) => Promise<void> | void;
  /**
   * Hvis satt, lastes musikkfila opp via callbacken. Når null/undefined
   * faller komponenten tilbake til lokal blob-URL (demo/test-modus).
   * Returverdien er den oppdaterte koreografien (med signed musicUrl).
   */
  onUploadMusic?: (file: File) => Promise<Choreography>;
  /**
   * Hvis satt, vises en liten "Profil"-knapp ved siden av hver danser i
   * inspector-panelet. Default `undefined` → ingen visuell endring.
   */
  onOpenDancerProfile?: (dancerId: string) => void;
}

// ─── Hovedkomponent ─────────────────────────────────────────────────────

export const ChoreographyBuilder: React.FC<ChoreographyBuilderProps> = ({
  initialChoreography,
  onSave,
  onAutosave,
  onUploadMusic,
  onOpenDancerProfile,
}) => {
  const branding = useBrandingSettings();
  const labels = branding.tokens.labels;

  const [choreography, setChoreography] = useState<Choreography>(
    () => initialChoreography ?? buildDemoChoreography(),
  );
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    () => choreography.segments[0]?.id ?? null,
  );

  // ─── Audio playback state ──────────────────────────
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Mirror the audio element in state so children (e.g. MusicWaveform) can
  // re-render when it mounts.
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const audioRefCallback = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
    setAudioEl(el);
  }, []);
  // Local blob URL — used in demo/test mode (no onUploadMusic provided)
  // and as a fallback while a real upload is in flight.
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSec, setPlayheadSec] = useState(0);
  const [musicUploading, setMusicUploading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);

  // The audio src is either: (1) the active local blob (just-picked file or
  // demo mode), or (2) the persisted server-signed musicUrl. When upload
  // succeeds, we switch from blob → signed URL automatically.
  const audioUrl = localBlobUrl ?? choreography.musicUrl ?? null;

  // ─── Autosave state ────────────────────────────────
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRenderRef = useRef(true);

  const selectedSegment = useMemo(
    () => choreography.segments.find((s) => s.id === selectedSegmentId) ?? null,
    [choreography.segments, selectedSegmentId],
  );

  // Total varighet — brukes for prosent-utregning på timeline.
  const totalDur = Math.max(choreography.totalDurationSec, 1);

  // ─── Audio playback effect ─────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setPlayheadSec(audio.currentTime);
    const onEnd = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) void audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
  }, [isPlaying]);

  // Cleanup local blob URL when unmounting / replacing audio
  useEffect(() => {
    return () => {
      if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
    };
  }, [localBlobUrl]);

  // Esc lukker inspector. Capture-fase på document slik at MUI ikke
  // kan stoppe propageringen før vi får sjekket.
  useEffect(() => {
    const onKeyDownCapture = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const active = document.activeElement as HTMLElement | null;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        active.blur();
      }
      setSelectedSegmentId(null);
    };
    document.addEventListener('keydown', onKeyDownCapture, true);
    return () => document.removeEventListener('keydown', onKeyDownCapture, true);
  }, []);

  const handleAudioFile = useCallback(
    async (file: File) => {
      // 1) Show the file immediately via blob URL so the user gets instant
      //    playback while we upload in the background.
      const localUrl = URL.createObjectURL(file);
      setLocalBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return localUrl;
      });
      setIsPlaying(false);
      setPlayheadSec(0);
      setMusicError(null);
      setChoreography((c) => ({ ...c, musicTitle: c.musicTitle ?? file.name }));

      // 2) If a backend upload handler is provided, push the file to R2.
      //    On success, swap to the signed URL and drop the blob.
      if (onUploadMusic) {
        setMusicUploading(true);
        try {
          const updated = await onUploadMusic(file);
          // Adopt the persisted choreography (musicUrl, storageKey, title).
          setChoreography(updated);
          // Drop the blob now that we have a real signed URL.
          setLocalBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        } catch (err) {
          setMusicError(err instanceof Error ? err.message : 'Opplasting feilet');
          // Keep the blob URL so the user can still preview locally.
        } finally {
          setMusicUploading(false);
        }
      }
    },
    [onUploadMusic],
  );

  const seekTo = useCallback((sec: number) => {
    const audio = audioRef.current;
    const clamped = Math.max(0, Math.min(totalDur, sec));
    setPlayheadSec(clamped);
    if (audio) audio.currentTime = clamped;
  }, [totalDur]);

  // ─── Autosave effect ───────────────────────────────
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!onAutosave) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    setAutosaveStatus('saving');
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        await onAutosave(choreography);
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 1500);
      } catch {
        setAutosaveStatus('error');
      }
    }, 1500);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [choreography, onAutosave]);

  // ─── Mutators ──────────────────────────────────────

  const updateSegment = useCallback((id: string, patch: Partial<Segment>) => {
    setChoreography((prev) => ({
      ...prev,
      segments: prev.segments.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const deleteSegment = useCallback((id: string) => {
    setChoreography((prev) => ({
      ...prev,
      segments: prev.segments.filter((s) => s.id !== id),
      updatedAt: new Date().toISOString(),
    }));
    setSelectedSegmentId((cur) => (cur === id ? null : cur));
  }, []);

  const addSegment = useCallback((kind: SegmentKind) => {
    setChoreography((prev) => {
      const lastEnd = prev.segments.length > 0
        ? Math.max(...prev.segments.map((s) => s.endSec))
        : 0;
      const newEnd = Math.min(lastEnd + 8, prev.totalDurationSec);
      const id = `tmp-${Date.now()}`;
      const newSegment: Segment = {
        id,
        kind,
        startSec: lastEnd,
        endSec: newEnd > lastEnd ? newEnd : lastEnd + 8,
        energy: 'medium',
        dancers: [],
        approval: 'draft',
      };
      const newTotal = Math.max(prev.totalDurationSec, newSegment.endSec);
      setSelectedSegmentId(id);
      return {
        ...prev,
        segments: [...prev.segments, newSegment].sort((a, b) => a.startSec - b.startSec),
        totalDurationSec: newTotal,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const handleSave = useCallback(() => {
    if (typeof window !== 'undefined') {
      const w = window as Window & { dataLayer?: Array<Record<string, unknown>> };
      if (!Array.isArray(w.dataLayer)) w.dataLayer = [];
      w.dataLayer.push({ event: 'dance_piece_saved', piece_id: choreography.id });
    }
    onSave?.(choreography);
  }, [choreography, onSave]);

  // ─── Render ────────────────────────────────────────

  return (
    <Box
      data-testid="choreography-builder"
      sx={{
        bgcolor: danceFlowColors.bgBase,
        color: danceFlowColors.textSecondary,
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── Header ──────────────────────────────────── */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: '1px solid #1e2536',
          bgcolor: danceFlowColors.bgPanel,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography sx={{ fontSize: 10, letterSpacing: 2.5, color: danceFlowColors.lavender, fontWeight: 700 }}>
            {labels.choreographyBuilderTitle.toUpperCase()}
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#fff', mt: 0.25 }}>
            {choreography.title}
          </Typography>
          <Typography sx={{ fontSize: 11, color: danceFlowColors.textMuted, mt: 0.25 }}>
            {choreography.choreographer ? `Koreograf: ${choreography.choreographer} · ` : ''}
            {choreography.musicTitle ?? 'Musikk ikke valgt'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <MetaPill icon={<MusicIcon sx={{ fontSize: 14 }} />}
            label={`${labels.choreographyBuilderBpmLabel}: ${choreography.bpm ?? '–'}`} />
          <MetaPill label={`${labels.choreographyBuilderKeyLabel}: ${choreography.musicalKey ?? '–'}`} />
          <MetaPill label={`${labels.choreographyBuilderTotalDuration}: ${formatTime(choreography.totalDurationSec)}`} accent />
          <AudioFileButton
            onFile={handleAudioFile}
            hasAudio={!!audioUrl}
            uploading={musicUploading}
          />
          {musicError ? (
            <Chip
              size="small"
              label={musicError}
              sx={{
                bgcolor: 'rgba(239,68,68,0.18)',
                color: danceFlowColors.errorSoft,
                fontWeight: 600,
                maxWidth: 240,
              }}
            />
          ) : null}
          <Tooltip title={audioUrl ? labels.choreographyBuilderPlayLabel : 'Last opp musikkfil først'}>
            <span>
              <IconButton
                data-testid="choreo-play-toggle"
                disabled={!audioUrl}
                onClick={() => setIsPlaying((v) => !v)}
                aria-pressed={isPlaying}
                aria-label={isPlaying ? 'Pause' : 'Spill'}
                sx={{
                  bgcolor: isPlaying ? 'rgba(52,211,153,0.15)' : 'rgba(139,92,246,0.12)',
                  color: isPlaying ? danceFlowColors.successPrimary : danceFlowColors.lavenderLight,
                  border: `1px solid ${isPlaying ? 'rgba(52,211,153,0.4)' : 'rgba(139,92,246,0.4)'}`,
                  '&:hover': { bgcolor: isPlaying ? 'rgba(52,211,153,0.22)' : 'rgba(139,92,246,0.2)' },
                  '&.Mui-disabled': { opacity: 0.45 },
                }}
              >
                {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </IconButton>
            </span>
          </Tooltip>
          {playheadSec > 0 && (
            <Typography sx={{ fontSize: 11, color: danceFlowColors.lavender, fontFamily: 'monospace', minWidth: 50 }}>
              {formatTime(playheadSec)}
            </Typography>
          )}
          <AutosaveBadge status={autosaveStatus} />
          <Button
            data-testid="choreo-save"
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={{ textTransform: 'none', bgcolor: danceFlowColors.lavenderDark, '&:hover': { bgcolor: danceFlowColors.lavenderDeep } }}
          >
            {labels.choreographyBuilderSaveLabel}
          </Button>
        </Stack>
      </Box>

      {/* Hidden audio element — playback drives playhead via timeupdate */}
      {audioUrl && (
        <audio ref={audioRefCallback} src={audioUrl} preload="metadata" data-testid="choreo-audio" />
      )}

      {/* Waveform — visuell representasjon av musikken med segment-ticks */}
      {audioUrl ? (
        <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
          <MusicWaveform
            audioUrl={audioUrl}
            mediaElement={audioEl}
            totalDurationSec={choreography.totalDurationSec}
            segments={choreography.segments}
            onSeek={seekTo}
          />
        </Box>
      ) : null}

      {/* ─── Body — 3 kolonner ───────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '220px 1fr 320px' },
          gap: 0,
          minHeight: 0,
        }}
      >
        {/* ─── Venstre: segment-liste ─────────────── */}
        <Box
          data-testid="choreo-segment-list"
          sx={{
            borderRight: { lg: '1px solid #1e2536' },
            bgcolor: danceFlowColors.bgBase,
            overflowY: 'auto',
            p: 1.5,
          }}
        >
          <Typography sx={{ fontSize: 9, letterSpacing: 1.8, color: danceFlowColors.textDisabled, fontWeight: 700, mb: 1 }}>
            SEGMENTER ({choreography.segments.length})
          </Typography>
          <Stack spacing={0.5}>
            {choreography.segments.map((seg) => {
              const meta = getSegmentMeta(seg.kind);
              const energyMeta = getEnergyMeta(seg.energy);
              const isSel = seg.id === selectedSegmentId;
              return (
                <Box
                  key={seg.id}
                  data-testid={`choreo-segment-item-${seg.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedSegmentId(seg.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedSegmentId(seg.id);
                    }
                  }}
                  sx={{
                    p: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    border: `1px solid ${isSel ? meta.color : danceFlowColors.borderStrong}`,
                    bgcolor: isSel ? `${meta.color}1a` : 'transparent',
                    borderLeft: `3px solid ${meta.color}`,
                    transition: 'all 0.15s',
                    '&:hover': { bgcolor: isSel ? `${meta.color}22` : danceFlowColors.bgPanel },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                      {seg.label ?? labels[meta.labelToken]}
                    </Typography>
                    <Typography sx={{ fontSize: 9, color: danceFlowColors.textDisabled, fontFamily: 'monospace' }}>
                      {formatTime(seg.startSec)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                    <EnergyMeter level={seg.energy} compact />
                    <Typography sx={{ fontSize: 9, color: energyMeta.color, fontWeight: 600 }}>
                      {labels[energyMeta.labelToken]}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ fontSize: 9, color: danceFlowColors.textDisabled }}>
                      {segmentDuration(seg)}s
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
          </Stack>

          <AddSegmentMenu onAdd={addSegment} labels={labels} />
        </Box>

        {/* ─── Sentralt: timeline ──────────────────── */}
        <Box
          data-testid="choreo-timeline"
          tabIndex={0}
          onKeyDown={(e) => {
            // Arrow left/right flytter playhead 1 sek; Space toggler play/pause.
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              setPlayheadSec((p) => Math.min(p + 1, choreography.totalDurationSec));
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setPlayheadSec((p) => Math.max(0, p - 1));
            } else if (e.key === ' ') {
              e.preventDefault();
              setIsPlaying((v) => !v);
            }
          }}
          sx={{
            overflow: 'auto',
            bgcolor: danceFlowColors.bgBase,
            p: 2,
            outline: 'none',
            '&:focus-visible': { boxShadow: 'inset 0 0 0 2px rgba(167,139,250,0.4)' },
          }}
        >
          {choreography.segments.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center', color: danceFlowColors.textDisabled }}>
              <Typography sx={{ fontSize: 14 }}>{labels.choreographyBuilderEmpty}</Typography>
            </Box>
          ) : (
            <TimelineCanvas
              choreography={choreography}
              selectedSegmentId={selectedSegmentId}
              onSelectSegment={setSelectedSegmentId}
              onUpdateSegment={updateSegment}
              labels={labels}
              playheadSec={playheadSec}
              onSeek={seekTo}
            />
          )}
        </Box>

        {/* ─── Høyre: inspector ────────────────────── */}
        <Box
          data-testid="choreo-inspector"
          sx={{
            borderLeft: { lg: '1px solid #1e2536' },
            bgcolor: danceFlowColors.bgPanel,
            overflowY: 'auto',
            p: 2,
          }}
        >
          {selectedSegment ? (
            <SegmentInspector
              segment={selectedSegment}
              bpm={choreography.bpm}
              labels={labels}
              onChange={(patch) => updateSegment(selectedSegment.id, patch)}
              onDelete={() => deleteSegment(selectedSegment.id)}
              onOpenDancerProfile={onOpenDancerProfile}
              onSeekToCount={seekTo}
            />
          ) : (
            <Typography sx={{ fontSize: 12, color: danceFlowColors.textDisabled }}>
              Velg et segment for å se detaljer.
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// ═══════════════════════ TIMELINE-CANVAS ═══════════════════════

interface TimelineCanvasProps {
  choreography: Choreography;
  selectedSegmentId: string | null;
  onSelectSegment: (id: string) => void;
  onUpdateSegment: (id: string, patch: Partial<Segment>) => void;
  labels: ReturnType<typeof useBrandingSettings>['tokens']['labels'];
  playheadSec: number;
  onSeek: (sec: number) => void;
}

const TimelineCanvas: React.FC<TimelineCanvasProps> = ({
  choreography,
  selectedSegmentId,
  onSelectSegment,
  onUpdateSegment,
  labels,
  playheadSec,
  onSeek,
}) => {
  const totalDur = Math.max(choreography.totalDurationSec, 1);
  // Tids-markører hvert 10. sekund — gir leselig tids-skala uavhengig av lengde
  const tickInterval = totalDur > 120 ? 30 : totalDur > 60 ? 15 : 10;
  const ticks: number[] = [];
  for (let t = 0; t <= totalDur; t += tickInterval) ticks.push(t);
  if (ticks[ticks.length - 1] !== totalDur) ticks.push(totalDur);

  // Bevar referanse til timeline-tracket for å konvertere klikk-pos → sekunder
  const trackRef = useRef<HTMLDivElement | null>(null);

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      onSeek(Math.max(0, Math.min(totalDur, pct * totalDur)));
    },
    [onSeek, totalDur],
  );

  return (
    <Box sx={{ minWidth: 600, position: 'relative' }}>
      {/* ─── Time-ruler ────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', mb: 1 }}>
        <Box sx={{ width: TIMELINE_LEFT_LABEL_WIDTH }} />
        <Box
          ref={trackRef}
          onClick={handleRulerClick}
          data-testid="choreo-time-ruler"
          sx={{
            flex: 1,
            position: 'relative',
            height: 24,
            borderBottom: '1px solid #2a3142',
            cursor: 'pointer',
          }}
        >
          {ticks.map((t) => {
            const pct = (t / totalDur) * 100;
            return (
              <Box
                key={t}
                sx={{
                  position: 'absolute',
                  left: `${pct}%`,
                  bottom: 0,
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  pb: 0.25,
                }}
              >
                <Typography sx={{ fontSize: 9, color: danceFlowColors.textDisabled, fontFamily: 'monospace' }}>
                  {formatTime(t)}
                </Typography>
                <Box sx={{ width: 1, height: 4, bgcolor: danceFlowColors.grayDark, mx: 'auto' }} />
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ─── Layer-rader ──────────────────────────── */}
      <Stack spacing={0.5}>
        {TIMELINE_LAYERS.map((layer) => (
          <TimelineLayerRow
            key={layer.kind}
            layer={layer}
            choreography={choreography}
            selectedSegmentId={selectedSegmentId}
            onSelectSegment={onSelectSegment}
            onUpdateSegment={onUpdateSegment}
            labels={labels}
            playheadSec={playheadSec}
          />
        ))}
      </Stack>
    </Box>
  );
};

// ─── Én layer-rad ────────────────────────────────────────────────────────

interface TimelineLayerRowProps {
  layer: TimelineLayerMeta;
  choreography: Choreography;
  selectedSegmentId: string | null;
  onSelectSegment: (id: string) => void;
  onUpdateSegment: (id: string, patch: Partial<Segment>) => void;
  labels: ReturnType<typeof useBrandingSettings>['tokens']['labels'];
  playheadSec: number;
}

const TimelineLayerRow: React.FC<TimelineLayerRowProps> = ({
  layer,
  choreography,
  selectedSegmentId,
  onSelectSegment,
  onUpdateSegment,
  labels,
  playheadSec,
}) => {
  const totalDur = Math.max(choreography.totalDurationSec, 1);
  const rowH = rowHeightFor(layer);
  const trackRef = useRef<HTMLDivElement | null>(null);

  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
      {/* ─── Lag-label til venstre ─────────────────── */}
      <Box
        sx={{
          width: TIMELINE_LEFT_LABEL_WIDTH,
          pr: 1,
          py: 0.5,
          borderRight: '1px solid #1e2536',
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
        }}
      >
        <Box sx={{ width: 4, height: '70%', borderRadius: 0.5, bgcolor: layer.color }} />
        <Typography sx={{ fontSize: 10, fontWeight: 600, color: danceFlowColors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' }}>
          {labels[layer.labelToken]}
        </Typography>
      </Box>

      {/* ─── Track ────────────────────────────────── */}
      <Box
        ref={trackRef}
        sx={{
          flex: 1,
          position: 'relative',
          height: rowH,
          bgcolor: danceFlowColors.bgInset,
          borderRadius: 0.75,
          overflow: 'hidden',
          ml: 1,
        }}
      >
        {/* Bakgrunnslinjer hver 10s for visuell guide */}
        {Array.from({ length: Math.floor(totalDur / 10) + 1 }, (_, i) => i * 10).map((t) => (
          <Box
            key={`gridline-${t}`}
            sx={{
              position: 'absolute',
              left: `${(t / totalDur) * 100}%`,
              top: 0,
              bottom: 0,
              width: 1,
              bgcolor: '#1a2230',
              opacity: 0.5,
            }}
          />
        ))}

        {/* Music waveform — generert visuelt fra BPM */}
        {layer.variant === 'waveform' && (
          <WaveformOverlay totalDur={totalDur} bpm={choreography.bpm ?? 120} />
        )}

        {/* Segment-blokker — block-laget får drag-handles */}
        {choreography.segments.map((seg) => {
          const leftPct = (seg.startSec / totalDur) * 100;
          const widthPct = ((seg.endSec - seg.startSec) / totalDur) * 100;
          const isSel = seg.id === selectedSegmentId;
          return (
            <SegmentBlock
              key={seg.id}
              segment={seg}
              layer={layer}
              leftPct={leftPct}
              widthPct={widthPct}
              isSelected={isSel}
              labels={labels}
              onSelect={() => onSelectSegment(seg.id)}
              onResize={(patch) => onUpdateSegment(seg.id, patch)}
              trackRef={trackRef}
              totalDur={totalDur}
              segments={choreography.segments}
            />
          );
        })}

        {/* ─── Playhead — vertikal linje gjennom track ─── */}
        {playheadSec > 0 && (
          <Box
            data-testid={`choreo-playhead-${layer.kind}`}
            sx={{
              position: 'absolute',
              left: `${(playheadSec / totalDur) * 100}%`,
              top: 0,
              bottom: 0,
              width: 2,
              bgcolor: danceFlowColors.gold,
              boxShadow: '0 0 6px rgba(251,191,36,0.6)',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />
        )}
      </Box>
    </Box>
  );
};

// ─── Én segment-blokk på timeline ────────────────────────────────────────

interface SegmentBlockProps {
  segment: Segment;
  layer: TimelineLayerMeta;
  leftPct: number;
  widthPct: number;
  isSelected: boolean;
  labels: ReturnType<typeof useBrandingSettings>['tokens']['labels'];
  onSelect: () => void;
  onResize: (patch: Partial<Segment>) => void;
  trackRef: React.RefObject<HTMLDivElement | null>;
  totalDur: number;
  segments: Segment[];
}

type DragMode = 'move' | 'resize-left' | 'resize-right' | null;

const SegmentBlock: React.FC<SegmentBlockProps> = ({
  segment, layer, leftPct, widthPct, isSelected, labels, onSelect,
  onResize, trackRef, totalDur, segments,
}) => {
  const meta = getSegmentMeta(segment.kind);
  const text = layer.variant === 'block'
    ? (segment.label ?? labels[meta.labelToken])
    : getSegmentValue(segment, layer);

  // Hopp over null-verdier i tekst-lag (gir ikke mening å vise tom blokk)
  if (layer.variant === 'text' && !text) return null;

  const bg = layer.variant === 'block'
    ? `linear-gradient(180deg, ${meta.color} 0%, ${meta.color}cc 100%)`
    : `${layer.color}24`;
  const border = isSelected ? `2px solid ${meta.color}` : `1px solid ${layer.color}55`;

  // ─── Drag-resize (kun på block-lag, dvs. koreografi-laget) ───
  const dragModeRef = useRef<DragMode>(null);
  const dragStartRef = useRef<{ pxX: number; startSec: number; endSec: number; trackWidth: number } | null>(null);

  const isDraggable = layer.variant === 'block';

  const beginDrag = useCallback((mode: DragMode) => (e: React.PointerEvent) => {
    if (!isDraggable) return;
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    dragModeRef.current = mode;
    dragStartRef.current = {
      pxX: e.clientX,
      startSec: segment.startSec,
      endSec: segment.endSec,
      trackWidth: rect.width,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [isDraggable, trackRef, onSelect, segment.startSec, segment.endSec]);

  const handleMove = useCallback((e: React.PointerEvent) => {
    const mode = dragModeRef.current;
    const start = dragStartRef.current;
    if (!mode || !start) return;
    const deltaSec = ((e.clientX - start.pxX) / start.trackWidth) * totalDur;
    const snap = (n: number) => Math.round(n / SNAP_INTERVAL_SEC) * SNAP_INTERVAL_SEC;

    // Find naboer for clamping (no overlap)
    const sorted = [...segments].sort((a, b) => a.startSec - b.startSec);
    const idx = sorted.findIndex((s) => s.id === segment.id);
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;
    const lowerBound = prev ? prev.endSec : 0;
    const upperBound = next ? next.startSec : totalDur;

    if (mode === 'resize-left') {
      const newStart = snap(Math.max(lowerBound, Math.min(start.endSec - MIN_SEGMENT_DURATION_SEC, start.startSec + deltaSec)));
      if (newStart !== segment.startSec) onResize({ startSec: newStart });
    } else if (mode === 'resize-right') {
      const newEnd = snap(Math.max(start.startSec + MIN_SEGMENT_DURATION_SEC, Math.min(upperBound, start.endSec + deltaSec)));
      if (newEnd !== segment.endSec) onResize({ endSec: newEnd });
    } else if (mode === 'move') {
      const dur = start.endSec - start.startSec;
      const newStart = snap(Math.max(lowerBound, Math.min(upperBound - dur, start.startSec + deltaSec)));
      if (newStart !== segment.startSec) {
        onResize({ startSec: newStart, endSec: newStart + dur });
      }
    }
  }, [totalDur, segments, segment.id, segment.startSec, segment.endSec, onResize]);

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (dragModeRef.current) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
    dragModeRef.current = null;
    dragStartRef.current = null;
  }, []);

  return (
    <Box
      onClick={(e) => { if (!dragModeRef.current) onSelect(); e.stopPropagation(); }}
      onPointerDown={isDraggable ? beginDrag('move') : undefined}
      onPointerMove={isDraggable ? handleMove : undefined}
      onPointerUp={isDraggable ? endDrag : undefined}
      onPointerCancel={isDraggable ? endDrag : undefined}
      data-testid={`segment-block-${segment.id}-${layer.kind}`}
      sx={{
        position: 'absolute',
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top: 2,
        bottom: 2,
        background: bg,
        border,
        borderRadius: 0.75,
        cursor: isDraggable ? 'grab' : 'pointer',
        '&:active': isDraggable ? { cursor: 'grabbing' } : undefined,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        px: isDraggable ? 1.5 : 0.75,  // ekstra padding for å unngå overlap med handles
        boxShadow: isSelected ? `0 0 0 1px ${meta.color}88, 0 2px 8px rgba(0,0,0,0.4)` : 'none',
        transition: dragModeRef.current ? 'none' : 'all 0.12s',
        userSelect: 'none',
        touchAction: 'none',
        '&:hover': { filter: 'brightness(1.15)' },
      }}
    >
      <Typography
        noWrap
        sx={{
          fontSize: layer.variant === 'block' ? 11 : 9.5,
          fontWeight: layer.variant === 'block' ? 700 : 500,
          color: layer.variant === 'block' ? '#fff' : danceFlowColors.grayLight,
          letterSpacing: layer.variant === 'block' ? 0.2 : 0,
          textShadow: layer.variant === 'block' ? '0 1px 2px rgba(0,0,0,0.4)' : 'none',
          flex: 1,
        }}
      >
        {text}
      </Typography>

      {/* Drag-handles — venstre og høyre */}
      {isDraggable && (
        <>
          <Box
            data-testid={`segment-resize-left-${segment.id}`}
            onPointerDown={beginDrag('resize-left')}
            onPointerMove={handleMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            sx={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: DRAG_HANDLE_WIDTH,
              cursor: 'ew-resize',
              touchAction: 'none',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
              borderRight: isSelected ? '2px solid rgba(255,255,255,0.4)' : 'none',
            }}
          />
          <Box
            data-testid={`segment-resize-right-${segment.id}`}
            onPointerDown={beginDrag('resize-right')}
            onPointerMove={handleMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            sx={{
              position: 'absolute',
              right: 0, top: 0, bottom: 0,
              width: DRAG_HANDLE_WIDTH,
              cursor: 'ew-resize',
              touchAction: 'none',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' },
              borderLeft: isSelected ? '2px solid rgba(255,255,255,0.4)' : 'none',
            }}
          />
        </>
      )}
    </Box>
  );
};

// ─── Waveform-overlay (visuelt — ikke faktisk audio) ─────────────────────

const WaveformOverlay: React.FC<{ totalDur: number; bpm: number }> = ({ totalDur, bpm }) => {
  // Beats per total dur. Tegn én "tick" per beat med varierende høyde for å
  // antyde en waveform uten ekte audio-data.
  const totalBeats = Math.floor((bpm * totalDur) / 60);
  const beats = Array.from({ length: totalBeats }, (_, i) => i);

  return (
    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', px: 0 }}>
      {beats.map((b) => {
        const pct = (b / totalBeats) * 100;
        // Pseudo-tilfeldig høyde basert på beat-index — deterministisk og stable
        const h = 30 + ((b * 7919) % 60);
        const isAccent = b % 4 === 0; // markér 1-slag i hver 4-takter
        return (
          <Box
            key={b}
            sx={{
              position: 'absolute',
              left: `${pct}%`,
              width: 1.5,
              height: `${h}%`,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: isAccent ? 'rgba(167,139,250,0.7)' : 'rgba(139,92,246,0.35)',
            }}
          />
        );
      })}
    </Box>
  );
};

// ═══════════════════════ INSPECTOR ═══════════════════════

interface SegmentInspectorProps {
  segment: Segment;
  bpm: number | undefined;
  labels: ReturnType<typeof useBrandingSettings>['tokens']['labels'];
  onChange: (patch: Partial<Segment>) => void;
  onDelete: () => void;
  onOpenDancerProfile?: (dancerId: string) => void;
  onSeekToCount?: (sec: number) => void;
}

const SegmentInspector: React.FC<SegmentInspectorProps> = ({
  segment, bpm, labels, onChange, onDelete, onOpenDancerProfile, onSeekToCount,
}) => {
  const meta = getSegmentMeta(segment.kind);
  const energyMeta = getEnergyMeta(segment.energy);
  const approvalMeta = getApprovalMeta(segment.approval);

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 10, height: 10, borderRadius: 2, bgcolor: meta.color }} />
          <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: 0.3 }}>
            {labels.choreographyInspectorTitle.toUpperCase()}
          </Typography>
        </Stack>
        <IconButton
          size="small"
          aria-label="Slett segment"
          onClick={onDelete}
          sx={{ color: danceFlowColors.textMuted, '&:hover': { color: danceFlowColors.errorPrimary } }}
        >
          <DeleteIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      {/* Type-velger */}
      <Box>
        <FieldLabel>Type</FieldLabel>
        <TextField
          select
          fullWidth
          size="small"
          value={segment.kind}
          onChange={(e) => onChange({ kind: e.target.value as SegmentKind })}
          sx={inspectorFieldSx}
        >
          {SEGMENT_KINDS.map((s) => (
            <MenuItem key={s.kind} value={s.kind} sx={{ fontSize: 12 }}>
              <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, mr: 1 }} />
              {labels[s.labelToken]}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Etikett-override */}
      <Box>
        <FieldLabel>Etikett (valgfri)</FieldLabel>
        <TextField
          fullWidth
          size="small"
          placeholder={labels[meta.labelToken]}
          value={segment.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value || undefined })}
          sx={inspectorFieldSx}
        />
      </Box>

      {/* Tidsrom */}
      <Stack direction="row" spacing={1}>
        <Box sx={{ flex: 1 }}>
          <FieldLabel>Start (sek)</FieldLabel>
          <TextField
            fullWidth
            size="small"
            type="number"
            value={segment.startSec}
            onChange={(e) => onChange({ startSec: Math.max(0, Number(e.target.value) || 0) })}
            sx={inspectorFieldSx}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <FieldLabel>Slutt (sek)</FieldLabel>
          <TextField
            fullWidth
            size="small"
            type="number"
            value={segment.endSec}
            onChange={(e) => onChange({ endSec: Math.max(segment.startSec + 1, Number(e.target.value) || 0) })}
            sx={inspectorFieldSx}
          />
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} alignItems="center">
        <Chip
          size="small"
          label={`${formatTime(segment.startSec)} → ${formatTime(segment.endSec)}`}
          sx={{ height: 18, fontSize: 9, bgcolor: danceFlowColors.borderStrong, color: danceFlowColors.grayLight, fontFamily: 'monospace' }}
        />
        <Chip
          size="small"
          label={`${segmentDuration(segment)}s`}
          sx={{ height: 18, fontSize: 9, bgcolor: 'rgba(139,92,246,0.15)', color: danceFlowColors.lavenderLight }}
        />
      </Stack>

      <Divider sx={{ borderColor: danceFlowColors.borderStrong, my: 0.5 }} />

      {/* Lag-spesifikke felter */}
      <InspectorTextField label={`${labels.choreographyLayerMusic} — cue`} value={segment.musicCue} onChange={(v) => onChange({ musicCue: v })} />
      <InspectorTextField label={labels.choreographyInspectorFormationLabel} value={segment.formation} onChange={(v) => onChange({ formation: v })} />
      <InspectorTextField label={labels.choreographyLayerCamera} value={segment.camera} onChange={(v) => onChange({ camera: v })} />
      <InspectorTextField label={labels.choreographyLayerLighting} value={segment.lighting} onChange={(v) => onChange({ lighting: v })} />
      <InspectorTextField label={labels.choreographyLayerCostumes} value={segment.costume} onChange={(v) => onChange({ costume: v })} />
      <InspectorTextField label={labels.choreographyInspectorMovementLabel} value={segment.movementNotes} onChange={(v) => onChange({ movementNotes: v })} multiline />

      {/* Energi-velger */}
      <Box>
        <FieldLabel>{labels.choreographyInspectorEnergyLabel}</FieldLabel>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {ENERGY_LEVELS.map((e) => {
            const isSel = e.level === segment.energy;
            return (
              <Chip
                key={e.level}
                size="small"
                label={labels[e.labelToken]}
                onClick={() => onChange({ energy: e.level as EnergyLevel })}
                sx={{
                  height: 22,
                  fontSize: 10,
                  bgcolor: isSel ? `${e.color}33` : danceFlowColors.borderStrong,
                  color: isSel ? e.color : danceFlowColors.textMuted,
                  border: `1px solid ${isSel ? e.color : danceFlowColors.borderSoft}`,
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                }}
              />
            );
          })}
        </Stack>
        <Box sx={{ mt: 0.5 }}>
          <EnergyMeter level={segment.energy} />
        </Box>
      </Box>

      {/* Dansere */}
      <Box>
        <FieldLabel>{labels.choreographyInspectorDancersLabel}</FieldLabel>
        <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
          {segment.dancers.length === 0 ? (
            <Typography sx={{ fontSize: 11, color: danceFlowColors.textDisabled, fontStyle: 'italic' }}>Ingen dansere tildelt</Typography>
          ) : (
            segment.dancers.map((d) => (
              <Chip
                key={d}
                size="small"
                icon={<PersonIcon sx={{ fontSize: 11 }} />}
                label={d}
                onClick={onOpenDancerProfile ? () => onOpenDancerProfile(d) : undefined}
                clickable={!!onOpenDancerProfile}
                data-testid={`choreo-inspector-dancer-${d}`}
                sx={{
                  height: 20,
                  fontSize: 10,
                  bgcolor: 'rgba(59,130,246,0.18)',
                  color: danceFlowColors.infoSoft,
                  border: '1px solid rgba(59,130,246,0.4)',
                  cursor: onOpenDancerProfile ? 'pointer' : 'default',
                  '&:hover': onOpenDancerProfile
                    ? { bgcolor: 'rgba(59,130,246,0.28)' }
                    : undefined,
                }}
              />
            ))
          )}
        </Stack>
      </Box>

      {/* Video-ref */}
      <Box>
        <FieldLabel>{labels.choreographyInspectorVideoRefLabel}</FieldLabel>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <TextField
            fullWidth
            size="small"
            value={segment.videoRefUrl ?? ''}
            placeholder="https://vimeo.com/..."
            onChange={(e) => onChange({ videoRefUrl: e.target.value || undefined })}
            sx={inspectorFieldSx}
          />
          {segment.videoRefUrl && (
            <IconButton
              size="small"
              component="a"
              href={segment.videoRefUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: danceFlowColors.lavender }}
            >
              <VideoIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Stack>
        {segment.videoRefUrl ? (
          <VideoRefPlayer url={segment.videoRefUrl} />
        ) : null}
      </Box>

      {/* Godkjenning */}
      <Box>
        <FieldLabel>{labels.choreographyInspectorApprovalLabel}</FieldLabel>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {APPROVAL_STATUSES.map((a) => {
            const isSel = a.status === segment.approval;
            return (
              <Chip
                key={a.status}
                size="small"
                icon={isSel ? <CheckIcon sx={{ fontSize: 11 }} /> : undefined}
                label={labels[a.labelToken]}
                onClick={() => onChange({ approval: a.status as ApprovalStatus })}
                sx={{
                  height: 22,
                  fontSize: 10,
                  bgcolor: isSel ? `${a.color}26` : danceFlowColors.borderStrong,
                  color: isSel ? a.color : danceFlowColors.textMuted,
                  border: `1px solid ${isSel ? a.color : danceFlowColors.borderSoft}`,
                  fontWeight: isSel ? 700 : 500,
                  cursor: 'pointer',
                  '& .MuiChip-icon': { color: a.color },
                }}
              />
            );
          })}
        </Stack>
      </Box>

      <Divider sx={{ borderColor: danceFlowColors.borderStrong, my: 0.5 }} />

      {/* 8-count nedbrytning */}
      <Box>
        <FieldLabel>8-counts</FieldLabel>
        <CountGrid
          // Force remount when segment changes — så CountGrids interne state
          // resets til den nye segmentets countGrid.
          key={segment.id}
          segment={segment}
          bpm={bpm}
          initialState={segment.countGrid ?? { includeLeadup: true, entries: [] }}
          onChange={(next: CountGridState) => onChange({ countGrid: next })}
          onSeekToCount={onSeekToCount}
        />
      </Box>

      <Divider sx={{ borderColor: danceFlowColors.borderStrong, my: 0.5 }} />

      {/* AI-handling */}
      <Card sx={{ bgcolor: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', boxShadow: 'none' }}>
        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <AutoAwesomeIcon sx={{ fontSize: 14, color: danceFlowColors.lavender }} />
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: danceFlowColors.lavender, letterSpacing: 1 }}>
              CI — KOREOGRAFI-FORSLAG
            </Typography>
          </Stack>
          <Typography sx={{ fontSize: 10.5, color: danceFlowColors.grayLight, mb: 1, lineHeight: 1.4 }}>
            Få AI-forslag for bevegelse, formasjon eller musikkmatching basert på {energyMeta.labelToken && labels[energyMeta.labelToken]?.toLowerCase()}-energi og segment-type.
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AutoAwesomeIcon sx={{ fontSize: 13 }} />}
            sx={{ textTransform: 'none', fontSize: 11, color: danceFlowColors.lavenderLight, borderColor: 'rgba(139,92,246,0.4)' }}
          >
            Foreslå bevegelser
          </Button>
        </CardContent>
      </Card>
    </Stack>
  );
};

// ═══════════════════════ SMÅ-KOMPONENTER ═══════════════════════

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: 9, letterSpacing: 1, color: danceFlowColors.textDisabled, fontWeight: 700, textTransform: 'uppercase', mb: 0.4 }}>
    {children}
  </Typography>
);

interface InspectorTextFieldProps {
  label: string;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
  multiline?: boolean;
}

const InspectorTextField: React.FC<InspectorTextFieldProps> = ({ label, value, onChange, multiline }) => (
  <Box>
    <FieldLabel>{label}</FieldLabel>
    <TextField
      fullWidth
      size="small"
      multiline={multiline}
      rows={multiline ? 2 : undefined}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      sx={inspectorFieldSx}
    />
  </Box>
);

const inspectorFieldSx = {
  '& .MuiInputBase-input': { color: danceFlowColors.textSecondary, fontSize: 11.5 },
  '& .MuiOutlinedInput-root': {
    bgcolor: danceFlowColors.bgBase,
    '& fieldset': { borderColor: danceFlowColors.borderStrong },
    '&:hover fieldset': { borderColor: danceFlowColors.grayDark },
    '&.Mui-focused fieldset': { borderColor: danceFlowColors.lavenderDark },
  },
} as const;

const MetaPill: React.FC<{ label: string; icon?: React.ReactNode; accent?: boolean }> = ({ label, icon, accent }) => (
  <Box
    sx={{
      px: 1.25,
      py: 0.5,
      borderRadius: 12,
      bgcolor: accent ? 'rgba(139,92,246,0.15)' : danceFlowColors.borderStrong,
      color: accent ? danceFlowColors.lavenderLight : danceFlowColors.grayLight,
      border: `1px solid ${accent ? 'rgba(139,92,246,0.4)' : danceFlowColors.borderSoft}`,
      fontSize: 10,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
    }}
  >
    {icon}
    {label}
  </Box>
);

interface EnergyMeterProps {
  level: EnergyLevel;
  compact?: boolean;
}

const EnergyMeter: React.FC<EnergyMeterProps> = ({ level, compact }) => {
  const meta = getEnergyMeta(level);
  const segments = 6;
  return (
    <Stack direction="row" spacing={0.25} sx={{ height: compact ? 6 : 8 }}>
      {Array.from({ length: segments }, (_, i) => (
        <Box
          key={i}
          sx={{
            width: compact ? 4 : 8,
            height: '100%',
            borderRadius: 0.25,
            bgcolor: i < meta.intensity ? meta.color : danceFlowColors.borderStrong,
            transition: 'background-color 0.12s',
          }}
        />
      ))}
    </Stack>
  );
};

// ═══════════════════════ ADD-MENU ═══════════════════════

const AddSegmentMenu: React.FC<{
  onAdd: (kind: SegmentKind) => void;
  labels: ReturnType<typeof useBrandingSettings>['tokens']['labels'];
}> = ({ onAdd, labels }) => {
  const [open, setOpen] = useState(false);
  return (
    <Box sx={{ mt: 1.5 }}>
      <Button
        fullWidth
        size="small"
        startIcon={<AddIcon sx={{ fontSize: 14 }} />}
        onClick={() => setOpen((v) => !v)}
        data-testid="choreo-add-segment-toggle"
        sx={{
          textTransform: 'none',
          fontSize: 11,
          color: danceFlowColors.lavenderLight,
          borderColor: 'rgba(139,92,246,0.3)',
          justifyContent: 'flex-start',
          py: 0.75,
        }}
        variant="outlined"
      >
        {labels.choreographyBuilderAddSegment}
        <Box sx={{ flex: 1 }} />
        <ChevronRightIcon sx={{ fontSize: 14, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
      </Button>
      {open && (
        <Stack spacing={0.25} sx={{ mt: 0.5, p: 0.5, bgcolor: danceFlowColors.bgPanel, borderRadius: 0.75, border: '1px solid #1e2536' }}>
          {SEGMENT_KINDS.map((s) => (
            <Box
              key={s.kind}
              data-testid={`choreo-add-${s.kind}`}
              onClick={() => { onAdd(s.kind); setOpen(false); }}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 0.75, py: 0.5, borderRadius: 0.5, cursor: 'pointer',
                '&:hover': { bgcolor: danceFlowColors.borderStrong },
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
              <Typography sx={{ fontSize: 11, color: danceFlowColors.textSecondary }}>{labels[s.labelToken]}</Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

// ─── Audio file picker button ────────────────────────────────────────────

const AudioFileButton: React.FC<{
  onFile: (file: File) => void;
  hasAudio: boolean;
  uploading?: boolean;
}> = ({ onFile, hasAudio, uploading }) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const tooltip = uploading
    ? 'Laster opp…'
    : hasAudio
      ? 'Bytt musikkfil'
      : 'Last opp musikkfil';
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        data-testid="choreo-audio-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          if (e.target) e.target.value = '';
        }}
      />
      <Tooltip title={tooltip}>
        <span>
          <IconButton
            data-testid="choreo-audio-file-trigger"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            sx={{
              bgcolor: hasAudio ? 'rgba(167,139,250,0.18)' : danceFlowColors.borderStrong,
              color: hasAudio ? danceFlowColors.lavender : danceFlowColors.textMuted,
              border: `1px solid ${hasAudio ? 'rgba(167,139,250,0.4)' : danceFlowColors.borderSoft}`,
              '&.Mui-disabled': { opacity: 0.6 },
            }}
          >
            <MusicIcon />
          </IconButton>
        </span>
      </Tooltip>
    </>
  );
};

// ─── Autosave-status-badge ───────────────────────────────────────────────

const AutosaveBadge: React.FC<{ status: 'idle' | 'saving' | 'saved' | 'error' }> = ({ status }) => {
  if (status === 'idle') return null;
  const cfg = {
    saving: { label: 'Lagrer…', color: danceFlowColors.lavender, bg: 'rgba(167,139,250,0.12)' },
    saved:  { label: '✓ Lagret', color: danceFlowColors.successPrimary, bg: 'rgba(52,211,153,0.12)' },
    error:  { label: '⚠ Lagring feilet', color: danceFlowColors.errorPrimary, bg: 'rgba(248,113,113,0.12)' },
  }[status];
  return (
    <Chip
      data-testid={`choreo-autosave-${status}`}
      label={cfg.label}
      size="small"
      sx={{
        height: 22,
        fontSize: 10,
        bgcolor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.color}55`,
        fontWeight: 600,
      }}
    />
  );
};

export default ChoreographyBuilder;
