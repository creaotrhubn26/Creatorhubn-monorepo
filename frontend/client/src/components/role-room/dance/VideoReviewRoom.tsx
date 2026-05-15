/**
 * VideoReviewRoom — Frame.io-style review for ett klipp.
 *
 * Layout:
 *   ┌────────────────────────────────────────┬──────────────────┐
 *   │              <video>                    │  Tråd/kommentar  │
 *   │  (drawing overlay i V2,                 │  (sortert per    │
 *   │   sync-recorder i V3)                   │   timestamp,     │
 *   │                                         │   pin-på-toppen) │
 *   ├────────────────────────────────────────┤                  │
 *   │   Tids-skinne med kommentar-pegs       │  Ny kommentar    │
 *   └────────────────────────────────────────┴──────────────────┘
 *
 * V1 leverer: upload + threaded comments + @-mentions + status-toggle.
 * V2/V3/V4/V5 layered på toppen via subkomponenter (DrawingOverlay,
 * VoiceRecorder, EventSource-subscription).
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  Chip,
  CircularProgress,
  Alert,
  Avatar,
  Button,
  Divider,
  ToggleButton,
  Menu,
  MenuItem,
  Checkbox,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Send as SendIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  Check as CheckIcon,
  CheckCircle as CheckCircleIcon,
  Reply as ReplyIcon,
  Delete as DeleteIcon,
  AlternateEmail as MentionIcon,
  Mic as MicIcon,
  Stop as StopIcon,
  Brush as DrawIcon,
} from '@mui/icons-material';
import {
  listAnnotations,
  createAnnotation,
  patchAnnotation,
  deleteAnnotation,
  subscribeToClipEvents,
  uploadVoiceNote,
  type VideoAnnotation,
  type VideoClip,
  type AnnotationStatus,
} from './danceVideoService';
import {
  listDancerProfiles,
  type DancerProfile,
} from './dancerProfileService';
import { DrawingOverlay, type DrawingPath } from './DrawingOverlay';
import { SideBySidePlayer } from './SideBySidePlayer';
import { useDancePlanGate } from './useDancePlanGate';
import { DANCE_MOVEMENT_CATEGORIES, categoryById, categoryByShortcut, commonLabelsFor, type MovementCategory } from './danceMovementCategories';
import { AnnotationTimeline } from './AnnotationTimeline';
import { AnnotationDetailsPanel } from './AnnotationDetailsPanel';

const PURPLE = '#8b5cf6';
const PURPLE_LIGHT = '#a78bfa';
const BG = '#0a0a0a';
const CARD = '#111114';
const BORDER = 'rgba(139,92,246,0.25)';

export interface VideoReviewRoomProps {
  clip: VideoClip;
  currentUserId: string;
  /** Optional: list of segments from the active choreography for "tag segment" */
  segmentOptions?: Array<{ id: string; label: string }>;
  /** Optional: side-by-side compare against another clip (V5) */
  compareWithClip?: VideoClip | null;
  onClipUpdated?: (clip: VideoClip) => void;
  onDeleteClip?: () => void;
}

interface AuthorInfo {
  id: string;
  name: string;
  initials: string;
  color: string;
}

const AUTHOR_PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

function authorInfoFor(
  userId: string,
  profilesByDancerId: Map<string, DancerProfile>,
  currentUserId: string,
): AuthorInfo {
  // Profiles are keyed by dancerId, which is not always the userId — for
  // V1 we treat them as best-effort name lookup.
  const profile = profilesByDancerId.get(userId);
  const name = profile?.displayName ?? (userId === currentUserId ? 'Du' : userId);
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('') || '?';
  // Stable color per id.
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) hash = (hash << 5) - hash + userId.charCodeAt(i);
  const color = AUTHOR_PALETTE[Math.abs(hash) % AUTHOR_PALETTE.length];
  return { id: userId, name, initials, color };
}

function formatClipTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const PLAYBACK_RATES = [0.25, 0.5, 1, 1.5, 2] as const;

export function VideoReviewRoom({
  clip,
  currentUserId,
  segmentOptions = [],
  compareWithClip = null,
  onClipUpdated,
  onDeleteClip,
}: VideoReviewRoomProps): React.ReactElement {
  const [annotations, setAnnotations] = React.useState<VideoAnnotation[]>([]);
  const [profiles, setProfiles] = React.useState<DancerProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [composer, setComposer] = React.useState<string>('');
  const [replyTo, setReplyTo] = React.useState<VideoAnnotation | null>(null);
  const [composerError, setComposerError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [pinFlag, setPinFlag] = React.useState(false);
  const [mentionAnchor, setMentionAnchor] = React.useState<HTMLButtonElement | null>(null);
  const [mentionedDancerIds, setMentionedDancerIds] = React.useState<Set<string>>(new Set());
  const [segmentTagId, setSegmentTagId] = React.useState<string | null>(null);
  const [drawingForComposer, setDrawingForComposer] = React.useState<DrawingPath[]>([]);
  const [drawingMode, setDrawingMode] = React.useState(false);
  const [upgradeDrawingOpen, setUpgradeDrawingOpen] = React.useState(false);
  const [composerCategory, setComposerCategory] = React.useState<string | null>(null);
  const [customLabelsByCat, setCustomLabelsByCat] = React.useState<Record<string, string[]>>({});
  const [labelFilter, setLabelFilter] = React.useState<string>('');
  const [selectedAnnotationId, setSelectedAnnotationId] = React.useState<string | null>(null);
  const [rightPanelMode, setRightPanelMode] = React.useState<'annotate' | 'review'>('annotate');
  const composerInputRef = React.useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const selectedAnnotation = React.useMemo(
    () => annotations.find((a) => a.id === selectedAnnotationId) ?? null,
    [annotations, selectedAnnotationId],
  );

  const planGate = useDancePlanGate();
  // Tegne-overlay er video_review_pro-feature: gratis-planer åpner upgrade-
  // dialogen ved klikk i stedet for å aktivere tegne-modus.
  const drawingAllowed = planGate.loading || planGate.has('video_review_pro');
  const [playbackRate, setPlaybackRate] = React.useState<number>(1);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const sideBySideVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const [playheadSec, setPlayheadSec] = React.useState(0);
  const [duration, setDuration] = React.useState<number>(clip.durationSec ?? 0);
  const [isRecording, setIsRecording] = React.useState(false);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const recordingKeyframesRef = React.useRef<Array<{ tSec: number; paths: DrawingPath[] }>>([]);
  const recordingStartRef = React.useRef<number>(0);

  const profilesByDancerId = React.useMemo(
    () => new Map(profiles.map((p) => [p.dancerId, p])),
    [profiles],
  );

  // ─── Initial load ─────────────────────────────────────────────
  const refresh = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [annData, profData] = await Promise.all([
        listAnnotations(clip.id),
        listDancerProfiles(clip.projectId ?? undefined),
      ]);
      setAnnotations(annData);
      setProfiles(profData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste kommentarer');
    } finally {
      setLoading(false);
    }
  }, [clip.id, clip.projectId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  // Keyboard-shortcuts à la DanceAnnotate: 1-5 velger kategori, A fokuserer
  // composer, D sletter valgt annotation, S splitter den ved playhead.
  // Hopper over hvis bruker skriver i et tekstfelt.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const cat = categoryByShortcut(e.key);
      if (cat) {
        e.preventDefault();
        setComposerCategory((cur) => (cur === cat.id ? null : cat.id));
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'a') {
        e.preventDefault();
        composerInputRef.current?.focus();
        return;
      }
      if (k === 'd') {
        if (!selectedAnnotationId) return;
        e.preventDefault();
        const id = selectedAnnotationId;
        setSelectedAnnotationId(null);
        void (async () => {
          await deleteAnnotation(id).catch(() => undefined);
          void refresh();
        })();
        return;
      }
      if (k === 's') {
        if (!selectedAnnotation) return;
        e.preventDefault();
        const orig = selectedAnnotation;
        const playhead = videoRef.current?.currentTime ?? 0;
        const origEnd = orig.endSec ?? orig.timestampSec + 2;
        if (playhead <= orig.timestampSec || playhead >= origEnd) return;
        void (async () => {
          await patchAnnotation(orig.id, { endSec: playhead }).catch(() => undefined);
          await createAnnotation(orig.clipId, {
            body: orig.body,
            timestampSec: playhead,
            endSec: origEnd,
            category: orig.category,
            targetDancerIds: orig.targetDancerIds,
            segmentId: orig.segmentId,
          }).catch(() => undefined);
          void refresh();
        })();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedAnnotationId, selectedAnnotation, refresh]);

  // ─── V4: SSE subscription ─────────────────────────────────────
  React.useEffect(() => {
    const unsub = subscribeToClipEvents(clip.id, () => {
      // Cheap re-fetch on any event. Keeps logic simple and consistent.
      void refresh();
    });
    return unsub;
  }, [clip.id, refresh]);

  // ─── V5: playback rate ───────────────────────────────────────
  React.useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
    if (sideBySideVideoRef.current) sideBySideVideoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // ─── Video event handlers ─────────────────────────────────────
  const handleTimeUpdate = (): void => {
    const v = videoRef.current;
    if (v) setPlayheadSec(v.currentTime);
  };
  const handleLoadedMeta = (): void => {
    const v = videoRef.current;
    if (v && Number.isFinite(v.duration) && v.duration > 0) {
      setDuration(v.duration);
      // Persist duration server-side if missing.
      if (!clip.durationSec || Math.abs((clip.durationSec ?? 0) - v.duration) > 1) {
        // Best-effort patch — don't await.
        import('./danceVideoService').then(({ patchClip }) =>
          patchClip(clip.id, { durationSec: Math.round(v.duration * 100) / 100 })
            .then((updated) => onClipUpdated?.(updated))
            .catch(() => { /* silent */ }),
        );
      }
    }
  };
  const seekTo = React.useCallback((sec: number): void => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = Math.max(0, Math.min(duration || 0, sec));
      setPlayheadSec(v.currentTime);
    }
  }, [duration]);

  const stepFrame = (deltaSec: number): void => {
    seekTo(playheadSec + deltaSec);
  };

  // ─── Composer ─────────────────────────────────────────────────
  const submitComposer = async (): Promise<void> => {
    if (composer.trim().length === 0) {
      setComposerError('Skriv en kommentar først.');
      return;
    }
    setSending(true);
    setComposerError(null);
    try {
      await createAnnotation(clip.id, {
        parentId: replyTo?.id ?? null,
        body: composer.trim(),
        timestampSec: Math.round(playheadSec * 100) / 100,
        targetDancerIds: Array.from(mentionedDancerIds),
        isDirectorPin: pinFlag,
        segmentId: segmentTagId,
        drawing: drawingForComposer.length > 0 ? drawingForComposer : undefined,
        category: composerCategory,
      });
      setComposer('');
      setReplyTo(null);
      setMentionedDancerIds(new Set());
      setSegmentTagId(null);
      setPinFlag(false);
      setDrawingForComposer([]);
      setDrawingMode(false);
      setComposerCategory(null);
      // No need to refresh — SSE event will trigger it. But also do a local
      // optimistic refresh in case SSE is slow.
      await refresh();
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : 'Kunne ikke lagre');
    } finally {
      setSending(false);
    }
  };

  const togglePin = async (annotation: VideoAnnotation): Promise<void> => {
    try {
      await patchAnnotation(annotation.id, { isDirectorPin: !annotation.isDirectorPin });
      // SSE will refresh.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke pin-toggle');
    }
  };

  const toggleStatus = async (annotation: VideoAnnotation): Promise<void> => {
    try {
      const next: AnnotationStatus = annotation.status === 'open' ? 'resolved' : 'open';
      await patchAnnotation(annotation.id, { status: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke endre status');
    }
  };

  const removeAnnotation = async (annotation: VideoAnnotation): Promise<void> => {
    if (!window.confirm('Slett kommentar?')) return;
    try {
      await deleteAnnotation(annotation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette');
    }
  };

  // ─── V3: voice + drawing-keyframes recording ──────────────────
  const startVoiceRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      recordingKeyframesRef.current = [];
      recordingStartRef.current = Date.now();
      // Capture an initial keyframe with current drawing state.
      recordingKeyframesRef.current.push({
        tSec: 0,
        paths: drawingForComposer.map((p) => ({ ...p, points: [...p.points] })),
      });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const upload = await uploadVoiceNote(clip.id, blob, 'voice.webm');
          // Create the annotation with voice + keyframes.
          await createAnnotation(clip.id, {
            parentId: replyTo?.id ?? null,
            body: composer.trim() || '🎙 Sync-instruksjon',
            timestampSec: Math.round(playheadSec * 100) / 100,
            targetDancerIds: Array.from(mentionedDancerIds),
            isDirectorPin: pinFlag,
            segmentId: segmentTagId,
            drawing: drawingForComposer.length > 0 ? drawingForComposer : undefined,
            drawingKeyframes: {
              voiceStorageKey: upload.storageKey,
              voiceSignedUrl: upload.signedUrl,
              startedAtSec: Math.round(playheadSec * 100) / 100,
              keyframes: recordingKeyframesRef.current,
              audioDurationSec: (Date.now() - recordingStartRef.current) / 1000,
            },
          });
          // Voice note URL is also attached on the annotation via service.
          // Reset composer.
          setComposer('');
          setReplyTo(null);
          setMentionedDancerIds(new Set());
          setSegmentTagId(null);
          setPinFlag(false);
          setDrawingForComposer([]);
          setDrawingMode(false);
          await refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Kunne ikke laste opp voice note');
        } finally {
          stream.getTracks().forEach((t) => t.stop());
          recorderRef.current = null;
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      // Start playback so the recorder captures synced audio.
      await videoRef.current?.play().catch(() => { /* ignore */ });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mikrofon-tilgang nektet');
    }
  };

  const stopVoiceRecording = (): void => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') recorder.stop();
    setIsRecording(false);
    videoRef.current?.pause();
  };

  // Capture drawing-keyframe whenever the composer-draw changes during recording.
  React.useEffect(() => {
    if (!isRecording) return;
    const tSec = (Date.now() - recordingStartRef.current) / 1000;
    recordingKeyframesRef.current.push({
      tSec,
      paths: drawingForComposer.map((p) => ({ ...p, points: [...p.points] })),
    });
  }, [drawingForComposer, isRecording]);

  // ─── Annotation tree ─────────────────────────────────────────
  const { topLevel, repliesByParent } = React.useMemo(() => {
    const top: VideoAnnotation[] = [];
    const replies = new Map<string, VideoAnnotation[]>();
    for (const a of annotations) {
      if (a.parentId) {
        if (!replies.has(a.parentId)) replies.set(a.parentId, []);
        replies.get(a.parentId)!.push(a);
      } else {
        top.push(a);
      }
    }
    // Director pins first, then by timestamp.
    top.sort((a, b) => {
      if (a.isDirectorPin !== b.isDirectorPin) return a.isDirectorPin ? -1 : 1;
      return a.timestampSec - b.timestampSec;
    });
    for (const list of replies.values()) {
      list.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    }
    return { topLevel: top, repliesByParent: replies };
  }, [annotations]);

  // ─── Render ──────────────────────────────────────────────────
  const audioForActiveCutAnn = React.useMemo(() => {
    // Find the most recent director-cut-style annotation with voiceNoteSignedUrl.
    return annotations.find((a) => a.voiceNoteSignedUrl) ?? null;
  }, [annotations]);

  return (
    <Box
      data-testid="video-review-room"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' },
        gap: 0,
        bgcolor: BG,
        minHeight: '100%',
        color: '#e5e7eb',
      }}
    >
      {/* ─── Left: video + timeline ───────────────────────── */}
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff', flex: 1 }} noWrap>
            {clip.title}
          </Typography>
          <Chip label={clip.kind} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT, fontWeight: 600 }} />
          {onDeleteClip ? (
            <Tooltip title="Slett klippet">
              <IconButton size="small" onClick={onDeleteClip} sx={{ color: 'rgba(229,231,235,0.5)' }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>

        {compareWithClip ? (
          <SideBySidePlayer
            primaryClip={clip}
            secondaryClip={compareWithClip}
            primaryRef={videoRef}
            secondaryRef={sideBySideVideoRef}
            playbackRate={playbackRate}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMeta={handleLoadedMeta}
          />
        ) : (
          <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', bgcolor: '#000', aspectRatio: 16 / 9 }}>
            {clip.signedUrl ? (
              <video
                ref={videoRef}
                src={clip.signedUrl}
                controls
                preload="metadata"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMeta}
                style={{ width: '100%', height: '100%', display: 'block' }}
                data-testid="review-video"
              />
            ) : (
              <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                <Typography sx={{ color: PURPLE_LIGHT }}>Ingen signert URL — last opp på nytt</Typography>
              </Stack>
            )}
            <DrawingOverlay
              paths={drawingForComposer}
              onPathsChange={setDrawingForComposer}
              enabled={drawingMode}
            />
            {/* Director-cut replay: when an annotation with voice exists and
                we're sitting at its timestamp, render its drawings on top */}
            <DirectorCutOverlay
              annotation={audioForActiveCutAnn}
              currentTime={playheadSec}
              isRecording={isRecording}
            />
          </Box>
        )}

        {/* Tids-skinne med kommentar-pegs */}
        <Box
          sx={{
            position: 'relative',
            height: 28,
            bgcolor: CARD,
            borderRadius: 1,
            border: `1px solid ${BORDER}`,
            cursor: 'pointer',
          }}
          onClick={(e) => {
            if (duration <= 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seekTo(pct * duration);
          }}
          data-testid="review-timeline"
        >
          {duration > 0 ? (
            <Box
              sx={{
                position: 'absolute',
                top: 0, bottom: 0,
                left: `${(playheadSec / duration) * 100}%`,
                width: 2,
                bgcolor: '#34d399',
                pointerEvents: 'none',
              }}
            />
          ) : null}
          {duration > 0 && annotations.map((a) => {
            const pct = (a.timestampSec / duration) * 100;
            return (
              <Tooltip key={a.id} title={a.body.slice(0, 80)}>
                <Box
                  onClick={(e) => { e.stopPropagation(); seekTo(a.timestampSec); }}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    bottom: 4,
                    left: `${pct}%`,
                    width: 8,
                    transform: 'translateX(-50%)',
                    borderRadius: 1,
                    bgcolor: a.isDirectorPin ? '#fbbf24' : a.status === 'resolved' ? 'rgba(16,185,129,0.6)' : PURPLE,
                    cursor: 'pointer',
                    '&:hover': { transform: 'translateX(-50%) scale(1.3)' },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>

        {/* Player-kontroller */}
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography variant="caption" sx={{ color: PURPLE_LIGHT, fontWeight: 700, letterSpacing: 1 }}>
            {formatClipTime(playheadSec)} / {formatClipTime(duration || 0)}
          </Typography>
          <Tooltip title="Hopp tilbake 1/30s">
            <IconButton size="small" onClick={() => stepFrame(-1 / 30)} sx={{ color: PURPLE_LIGHT }}>
              <Box sx={{ fontSize: 12, fontWeight: 700 }}>«</Box>
            </IconButton>
          </Tooltip>
          <Tooltip title="Hopp fram 1/30s">
            <IconButton size="small" onClick={() => stepFrame(1 / 30)} sx={{ color: PURPLE_LIGHT }}>
              <Box sx={{ fontSize: 12, fontWeight: 700 }}>»</Box>
            </IconButton>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={0.5}>
            {PLAYBACK_RATES.map((r) => (
              <Button
                key={r}
                size="small"
                onClick={() => setPlaybackRate(r)}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  fontSize: 11,
                  textTransform: 'none',
                  color: playbackRate === r ? '#fff' : 'rgba(229,231,235,0.6)',
                  bgcolor: playbackRate === r ? 'rgba(139,92,246,0.25)' : 'transparent',
                }}
                data-testid={`review-rate-${r}`}
              >
                {r}x
              </Button>
            ))}
          </Stack>
        </Stack>
        {/* DanceAnnotate-paritet: kategori-spor under hovedtimelinen */}
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <AnnotationTimeline
            annotations={annotations}
            durationSec={duration}
            playheadSec={playheadSec}
            onSeek={seekTo}
            onSelectAnnotation={(a) => setSelectedAnnotationId(a.id)}
            onResize={(a, newStart, newEnd) => {
              void patchAnnotation(a.id, {
                timestampSec: Math.round(newStart * 100) / 100,
                endSec: Math.round(newEnd * 100) / 100,
              }).catch(() => undefined).then(() => refresh());
            }}
          />
        </Box>
        {/* Shortcuts-cheatsheet — DanceAnnotate-paritet */}
        <Box
          data-testid="review-shortcuts-panel"
          sx={{ px: 1.5, pb: 1.5 }}
        >
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              bgcolor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(139,92,246,0.12)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: 0.5,
              fontSize: 10.5,
              color: 'rgba(229,231,235,0.7)',
            }}
          >
            <Typography sx={{ fontSize: 10, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700, gridColumn: '1 / -1', mb: 0.25 }}>
              SHORTCUTS
            </Typography>
            <Box><Box component="kbd" sx={{ bgcolor: 'rgba(255,255,255,0.08)', px: 0.5, borderRadius: 0.5, mr: 0.5 }}>Space</Box>Play / Pause</Box>
            <Box><Box component="kbd" sx={{ bgcolor: 'rgba(255,255,255,0.08)', px: 0.5, borderRadius: 0.5, mr: 0.5 }}>← →</Box>Seek</Box>
            <Box><Box component="kbd" sx={{ bgcolor: 'rgba(255,255,255,0.08)', px: 0.5, borderRadius: 0.5, mr: 0.5 }}>A</Box>Add</Box>
            <Box><Box component="kbd" sx={{ bgcolor: 'rgba(255,255,255,0.08)', px: 0.5, borderRadius: 0.5, mr: 0.5 }}>D</Box>Delete</Box>
            <Box><Box component="kbd" sx={{ bgcolor: 'rgba(255,255,255,0.08)', px: 0.5, borderRadius: 0.5, mr: 0.5 }}>S</Box>Split</Box>
            <Box><Box component="kbd" sx={{ bgcolor: 'rgba(255,255,255,0.08)', px: 0.5, borderRadius: 0.5, mr: 0.5 }}>1-5</Box>Category</Box>
          </Box>
        </Box>
        {selectedAnnotation ? (
          <AnnotationDetailsPanel
            annotation={selectedAnnotation}
            dancerOptions={profiles.map((p) => ({ id: p.dancerId, label: p.displayName ?? p.dancerId }))}
            onClose={() => setSelectedAnnotationId(null)}
            onDelete={async () => {
              const id = selectedAnnotation.id;
              setSelectedAnnotationId(null);
              await deleteAnnotation(id).catch(() => undefined);
              void refresh();
            }}
            onPatch={async (patch) => {
              await patchAnnotation(selectedAnnotation.id, patch).catch(() => undefined);
              void refresh();
            }}
          />
        ) : null}
      </Box>

      {/* ─── Right: thread ───────────────────────────────── */}
      <Box
        sx={{
          borderLeft: { lg: `1px solid ${BORDER}` },
          bgcolor: '#0c0c10',
          display: 'flex',
          flexDirection: 'column',
          minHeight: { lg: 0 },
          maxHeight: { lg: '100%' },
        }}
      >
        <Box sx={{ p: 1.5, borderBottom: `1px solid ${BORDER}` }}>
          {/* Annotate/Review tab-toggle — DanceAnnotate-paritet */}
          <Stack direction="row" spacing={0.5} sx={{ mb: 1 }} data-testid="review-mode-toggle">
            {(['annotate', 'review'] as const).map((m) => (
              <Box
                key={m}
                role="tab"
                tabIndex={0}
                aria-selected={rightPanelMode === m}
                onClick={() => setRightPanelMode(m)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRightPanelMode(m); } }}
                data-testid={`review-mode-${m}`}
                sx={{
                  flex: 1,
                  textAlign: 'center',
                  cursor: 'pointer',
                  py: 0.75,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1,
                  color: rightPanelMode === m ? PURPLE_LIGHT : 'rgba(229,231,235,0.45)',
                  borderBottom: `2px solid ${rightPanelMode === m ? PURPLE_LIGHT : 'transparent'}`,
                  textTransform: 'uppercase',
                }}
              >
                {m === 'annotate' ? 'Annotate' : 'Review'}
              </Box>
            ))}
          </Stack>
          <Typography sx={{ fontSize: 10, letterSpacing: 2, color: PURPLE_LIGHT, fontWeight: 700 }}>
            {rightPanelMode === 'annotate' ? 'TAGGE BEVEGELSER' : `${annotations.length} ${annotations.length === 1 ? 'kommentar' : 'kommentarer'}`}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
          {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}
          {loading && annotations.length === 0 ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={20} sx={{ color: PURPLE }} />
            </Stack>
          ) : null}
          {topLevel.map((a) => (
            <CommentNode
              key={a.id}
              annotation={a}
              replies={repliesByParent.get(a.id) ?? []}
              author={authorInfoFor(a.authorUserId, profilesByDancerId, currentUserId)}
              onSeek={() => seekTo(a.timestampSec)}
              onPinToggle={() => void togglePin(a)}
              onStatusToggle={() => void toggleStatus(a)}
              onReply={() => setReplyTo(a)}
              onDelete={() => void removeAnnotation(a)}
              authorInfoFor={(uid) => authorInfoFor(uid, profilesByDancerId, currentUserId)}
              currentUserId={currentUserId}
              dancersByDancerId={profilesByDancerId}
            />
          ))}
        </Box>

        {/* Composer */}
        <Box sx={{ borderTop: `1px solid ${BORDER}`, p: 1.5, bgcolor: CARD }}>
          {replyTo ? (
            <Chip
              size="small"
              icon={<ReplyIcon sx={{ fontSize: 14 }} />}
              label={`Svar til "${replyTo.body.slice(0, 40)}"`}
              onDelete={() => setReplyTo(null)}
              sx={{ mb: 1, bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT }}
            />
          ) : (
            <Typography sx={{ fontSize: 10, color: 'rgba(229,231,235,0.55)', mb: 0.5 }}>
              Ny kommentar @ {formatClipTime(playheadSec)}
            </Typography>
          )}
          <TextField
            multiline
            minRows={2}
            maxRows={6}
            fullWidth
            size="small"
            placeholder="Skriv en kommentar — peker på sekund i klippet"
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            inputRef={composerInputRef}
            sx={{
              '& .MuiInputBase-root': { bgcolor: BG, color: '#e5e7eb', fontSize: 13 },
              '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
            }}
            data-testid="review-composer"
            inputProps={{ 'data-testid': 'review-composer-input' }}
          />
          {/* @-mention chips */}
          {mentionedDancerIds.size > 0 ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
              {Array.from(mentionedDancerIds).map((id) => {
                const p = profilesByDancerId.get(id);
                return (
                  <Chip
                    key={id}
                    size="small"
                    label={`@${p?.displayName ?? id}`}
                    onDelete={() => {
                      const next = new Set(mentionedDancerIds);
                      next.delete(id);
                      setMentionedDancerIds(next);
                    }}
                    sx={{ bgcolor: 'rgba(167,139,250,0.18)', color: PURPLE_LIGHT, height: 22 }}
                  />
                );
              })}
            </Stack>
          ) : null}
          {/* Movement-kategori — DanceAnnotate-paritet */}
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 1 }}
            data-testid="review-category-picker"
          >
            <Typography sx={{ fontSize: 10, color: 'rgba(229,231,235,0.55)', letterSpacing: 1, mr: 0.5 }}>
              KATEGORI
            </Typography>
            {/* Add Category-knapp — DanceAnnotate-paritet (UI-affordance, ny kategori er per-økt) */}
            {DANCE_MOVEMENT_CATEGORIES.map((cat: MovementCategory) => {
              const selected = composerCategory === cat.id;
              return (
                <Chip
                  key={cat.id}
                  size="small"
                  label={`${cat.label} · ${cat.shortcut}`}
                  onClick={() => setComposerCategory(selected ? null : cat.id)}
                  data-testid={`review-category-${cat.id}`}
                  aria-pressed={selected}
                  sx={{
                    height: 22,
                    fontSize: 10.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    bgcolor: selected ? `${cat.color}33` : 'transparent',
                    color: selected ? cat.color : 'rgba(229,231,235,0.6)',
                    border: `1px solid ${selected ? cat.color : 'rgba(229,231,235,0.18)'}`,
                    '&:hover': { bgcolor: `${cat.color}22`, color: cat.color },
                  }}
                />
              );
            })}
            <Chip
              size="small"
              label="+ Add Category"
              onClick={() => {
                const name = prompt('Egendefinert kategori er ikke persistert ennå — kontakt admin for å legge til ny i DANCE_MOVEMENT_CATEGORIES.');
                if (name) void name; // No-op for nå
              }}
              data-testid="review-add-category"
              sx={{
                height: 22,
                fontSize: 10.5,
                cursor: 'pointer',
                bgcolor: 'transparent',
                color: PURPLE_LIGHT,
                border: '1px dashed rgba(167,139,250,0.45)',
              }}
            />
          </Stack>
          {composerCategory ? (
            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 0.75 }}
              data-testid="review-common-labels"
            >
              <Typography sx={{ fontSize: 10, color: 'rgba(229,231,235,0.55)', letterSpacing: 1, mr: 0.5, alignSelf: 'center' }}>
                LABELS
              </Typography>
              <input
                type="search"
                placeholder="Søk labels…"
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
                data-testid="review-label-search"
                style={{
                  flexBasis: 100, minWidth: 80,
                  padding: '2px 6px', fontSize: 10, borderRadius: 3,
                  border: '1px solid rgba(167,139,250,0.25)',
                  background: 'transparent', color: '#e5e7eb', outline: 'none',
                }}
              />
              {[...commonLabelsFor(composerCategory), ...(customLabelsByCat[composerCategory] ?? [])]
                .filter((l) => labelFilter.trim().length === 0 || l.toLowerCase().includes(labelFilter.trim().toLowerCase()))
                .map((label) => (
                <Chip
                  key={label}
                  size="small"
                  label={label}
                  onClick={() => setComposer((cur) => cur.trim().length > 0 ? cur : label)}
                  data-testid={`review-label-${label.toLowerCase().replace(/\s+/g, '-')}`}
                  sx={{
                    height: 20,
                    fontSize: 10,
                    cursor: 'pointer',
                    bgcolor: 'rgba(167,139,250,0.08)',
                    color: '#c4b5fd',
                    border: '1px solid rgba(167,139,250,0.25)',
                    '&:hover': { bgcolor: 'rgba(167,139,250,0.18)' },
                  }}
                />
              ))}
              <Chip
                size="small"
                label="+ Add Label"
                onClick={() => {
                  const txt = prompt('Ny label for kategori ' + composerCategory + ':');
                  if (!txt || !txt.trim()) return;
                  const t = txt.trim();
                  setCustomLabelsByCat((prev) => ({
                    ...prev,
                    [composerCategory]: [...(prev[composerCategory] ?? []), t],
                  }));
                }}
                data-testid="review-add-label"
                sx={{
                  height: 20,
                  fontSize: 10,
                  cursor: 'pointer',
                  bgcolor: 'transparent',
                  color: PURPLE_LIGHT,
                  border: '1px dashed rgba(167,139,250,0.45)',
                  '&:hover': { bgcolor: 'rgba(167,139,250,0.08)' },
                }}
              />
            </Stack>
          ) : null}
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
            <Tooltip title="@-mention danser">
              <IconButton
                size="small"
                onClick={(e) => setMentionAnchor(e.currentTarget)}
                sx={{ color: PURPLE_LIGHT }}
              >
                <MentionIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title={pinFlag ? 'Avpin (lederinstruksjon)' : 'Pin som lederinstruksjon'}>
              <IconButton
                size="small"
                onClick={() => setPinFlag((v) => !v)}
                sx={{ color: pinFlag ? '#fbbf24' : 'rgba(229,231,235,0.5)' }}
              >
                {pinFlag ? <PinIcon fontSize="small" /> : <PinOutlinedIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            {segmentOptions.length > 0 ? (
              <TextField
                select
                size="small"
                value={segmentTagId ?? ''}
                onChange={(e) => setSegmentTagId(e.target.value || null)}
                sx={{
                  minWidth: 140,
                  '& .MuiInputBase-root': { bgcolor: BG, color: '#e5e7eb', fontSize: 11 },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
                }}
              >
                <MenuItem value="">— ingen segment —</MenuItem>
                {segmentOptions.map((s) => (
                  <MenuItem key={s.id} value={s.id} sx={{ fontSize: 12 }}>{s.label}</MenuItem>
                ))}
              </TextField>
            ) : null}
            <Tooltip
              title={drawingAllowed
                ? (drawingMode ? 'Slå av tegning' : 'Tegn på videoen')
                : 'Tegne-overlay krever Studio- eller Creator-plan — klikk for å oppgradere'
              }
            >
              <ToggleButton
                size="small"
                value="draw"
                selected={drawingMode && drawingAllowed}
                onChange={() => {
                  if (!drawingAllowed) {
                    setUpgradeDrawingOpen(true);
                    return;
                  }
                  setDrawingMode((v) => !v);
                }}
                sx={{
                  color: drawingMode && drawingAllowed ? '#fff' : PURPLE_LIGHT,
                  borderColor: BORDER,
                  bgcolor: drawingMode && drawingAllowed ? 'rgba(167,139,250,0.18)' : 'transparent',
                  fontSize: 11,
                  px: 1, py: 0.25,
                  opacity: drawingAllowed ? 1 : 0.55,
                }}
                data-testid="review-drawing-toggle"
                data-locked={drawingAllowed ? undefined : 'plan'}
              >
                <DrawIcon sx={{ fontSize: 14, mr: 0.5 }} /> Tegn
              </ToggleButton>
            </Tooltip>
            <Tooltip title={isRecording ? 'Stopp opptak' : 'Voice + sync-recorder'}>
              <IconButton
                size="small"
                onClick={() => isRecording ? stopVoiceRecording() : void startVoiceRecording()}
                sx={{ color: isRecording ? '#ef4444' : PURPLE_LIGHT }}
                data-testid="review-voice-toggle"
              >
                {isRecording ? <StopIcon fontSize="small" /> : <MicIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Box sx={{ flex: 1 }} />
            {composerError ? (
              <Typography sx={{ fontSize: 11, color: '#fca5a5' }}>{composerError}</Typography>
            ) : null}
            <Button
              size="small"
              variant="contained"
              startIcon={<SendIcon sx={{ fontSize: 14 }} />}
              disabled={sending || isRecording}
              onClick={() => void submitComposer()}
              sx={{
                bgcolor: PURPLE,
                '&:hover': { bgcolor: '#7c3aed' },
                textTransform: 'none',
                fontWeight: 600,
                fontSize: 12,
              }}
              data-testid="review-send"
            >
              {sending ? 'Lagrer…' : 'Send'}
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* @-mention picker */}
      <Menu
        anchorEl={mentionAnchor}
        open={!!mentionAnchor}
        onClose={() => setMentionAnchor(null)}
      >
        {profiles.length === 0 ? (
          <MenuItem disabled>Ingen dansere i prosjektet</MenuItem>
        ) : (
          profiles.map((p) => {
            const checked = mentionedDancerIds.has(p.dancerId);
            return (
              <MenuItem
                key={p.dancerId}
                onClick={() => {
                  const next = new Set(mentionedDancerIds);
                  if (next.has(p.dancerId)) next.delete(p.dancerId);
                  else next.add(p.dancerId);
                  setMentionedDancerIds(next);
                }}
              >
                <Checkbox checked={checked} size="small" sx={{ p: 0.5, mr: 1 }} />
                <ListItemText primary={p.displayName ?? p.dancerId} />
              </MenuItem>
            );
          })
        )}
      </Menu>
      <Dialog
        open={upgradeDrawingOpen}
        onClose={() => setUpgradeDrawingOpen(false)}
        PaperProps={{ sx: { bgcolor: '#0f0a1c', border: `1px solid ${BORDER}`, color: '#e5e7eb' } }}
        data-testid="drawing-upgrade-dialog"
      >
        <DialogTitle sx={{ color: PURPLE_LIGHT, fontWeight: 700 }}>Oppgrader for å tegne</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: 'rgba(229,231,235,0.85)' }}>
            Tegne-overlay er en del av Creator- og Studio-planene. Oppgrader for å markere
            korrigeringer rett på videoen og dele dem med teamet ditt.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpgradeDrawingOpen(false)} sx={{ color: PURPLE_LIGHT }}>
            Ikke nå
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setUpgradeDrawingOpen(false);
              if (typeof window !== 'undefined') {
                const url = new URL(window.location.href);
                url.searchParams.set('tab', 'pricing');
                window.history.pushState({}, '', url.toString());
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            sx={{ bgcolor: PURPLE, '&:hover': { bgcolor: '#7c3aed' }, textTransform: 'none', fontWeight: 700 }}
            data-testid="drawing-upgrade-cta"
          >
            Se planer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

interface CommentNodeProps {
  annotation: VideoAnnotation;
  replies: VideoAnnotation[];
  author: AuthorInfo;
  onSeek: () => void;
  onPinToggle: () => void;
  onStatusToggle: () => void;
  onReply: () => void;
  onDelete: () => void;
  authorInfoFor: (userId: string) => AuthorInfo;
  currentUserId: string;
  dancersByDancerId: Map<string, DancerProfile>;
}

const CommentNode: React.FC<CommentNodeProps> = ({
  annotation,
  replies,
  author,
  onSeek,
  onPinToggle,
  onStatusToggle,
  onReply,
  onDelete,
  authorInfoFor,
  currentUserId,
  dancersByDancerId,
}) => {
  const isOwner = annotation.authorUserId === currentUserId;
  return (
    <Box
      sx={{
        mb: 1.25,
        p: 1.25,
        borderRadius: 1.5,
        bgcolor: annotation.isDirectorPin ? 'rgba(251,191,36,0.06)' : CARD,
        border: `1px solid ${annotation.isDirectorPin ? 'rgba(251,191,36,0.4)' : BORDER}`,
        opacity: annotation.status === 'resolved' ? 0.6 : 1,
      }}
      data-testid={`review-comment-${annotation.id}`}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: author.color }}>
          {author.initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>
              {author.name}
            </Typography>
            {annotation.isDirectorPin ? (
              <Chip size="small" label="Lederinstruksjon" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(251,191,36,0.22)', color: '#fbbf24', fontWeight: 700 }} />
            ) : null}
            {annotation.status === 'resolved' ? (
              <Chip size="small" label="Løst" sx={{ height: 16, fontSize: 9, bgcolor: 'rgba(16,185,129,0.18)', color: '#10b981', fontWeight: 700 }} />
            ) : null}
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              onClick={onSeek}
              sx={{ minWidth: 0, p: 0.25, fontSize: 11, color: PURPLE_LIGHT, textTransform: 'none' }}
            >
              {formatClipTime(annotation.timestampSec)}
            </Button>
          </Stack>
          <Typography sx={{ fontSize: 13, color: 'rgba(229,231,235,0.92)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {annotation.body}
          </Typography>
          {(() => {
            const cat = categoryById(annotation.category);
            return cat ? (
              <Chip
                size="small"
                label={cat.label}
                data-testid={`review-comment-category-${annotation.id}`}
                sx={{
                  mt: 0.5,
                  height: 18,
                  fontSize: 10,
                  fontWeight: 700,
                  bgcolor: `${cat.color}22`,
                  color: cat.color,
                  border: `1px solid ${cat.color}55`,
                }}
              />
            ) : null;
          })()}
          {annotation.targetDancerIds.length > 0 ? (
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {annotation.targetDancerIds.map((id) => {
                const p = dancersByDancerId.get(id);
                return (
                  <Chip key={id} size="small" label={`@${p?.displayName ?? id}`} sx={{ height: 18, fontSize: 10, bgcolor: 'rgba(167,139,250,0.12)', color: PURPLE_LIGHT }} />
                );
              })}
            </Stack>
          ) : null}
          {annotation.voiceNoteSignedUrl ? (
            <Box sx={{ mt: 0.75 }}>
              <audio controls preload="none" src={annotation.voiceNoteSignedUrl} style={{ width: '100%', height: 32 }} />
            </Box>
          ) : null}
          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
            <Tooltip title={annotation.status === 'open' ? 'Marker som løst' : 'Marker som åpen'}>
              <IconButton size="small" onClick={onStatusToggle} sx={{ color: annotation.status === 'resolved' ? '#10b981' : 'rgba(229,231,235,0.4)', p: 0.5 }}>
                {annotation.status === 'resolved' ? <CheckCircleIcon sx={{ fontSize: 14 }} /> : <CheckIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title={annotation.isDirectorPin ? 'Avpin' : 'Pin som lederinstruksjon'}>
              <IconButton size="small" onClick={onPinToggle} sx={{ color: annotation.isDirectorPin ? '#fbbf24' : 'rgba(229,231,235,0.4)', p: 0.5 }}>
                {annotation.isDirectorPin ? <PinIcon sx={{ fontSize: 14 }} /> : <PinOutlinedIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Svar">
              <IconButton size="small" onClick={onReply} sx={{ color: 'rgba(229,231,235,0.4)', p: 0.5 }}>
                <ReplyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            {isOwner ? (
              <Tooltip title="Slett">
                <IconButton size="small" onClick={onDelete} sx={{ color: 'rgba(229,231,235,0.4)', p: 0.5 }}>
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        </Box>
      </Stack>
      {replies.length > 0 ? (
        <Box sx={{ mt: 1, ml: 4, borderLeft: `1px solid ${BORDER}`, pl: 1 }}>
          {replies.map((r) => (
            <Box
              key={r.id}
              sx={{ mb: 0.75 }}
              data-testid={`review-reply-${r.id}`}
            >
              <Stack direction="row" spacing={0.75} alignItems="flex-start">
                <Avatar sx={{ width: 22, height: 22, fontSize: 10, bgcolor: authorInfoFor(r.authorUserId).color }}>
                  {authorInfoFor(r.authorUserId).initials}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                      {authorInfoFor(r.authorUserId).name}
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Typography sx={{ fontSize: 10, color: 'rgba(229,231,235,0.4)' }}>
                      {new Date(r.createdAt).toLocaleString('nb-NO', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 12, color: 'rgba(229,231,235,0.85)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {r.body}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

// V3: replays a director-cut annotation's drawing keyframes when the video
// reaches that timestamp. Voice playback is via the <audio> in the comment.
interface DirectorCutOverlayProps {
  annotation: VideoAnnotation | null;
  currentTime: number;
  isRecording: boolean;
}

const DirectorCutOverlay: React.FC<DirectorCutOverlayProps> = ({ annotation, currentTime, isRecording }) => {
  const keyframes = annotation?.drawingKeyframes as { keyframes?: Array<{ tSec: number; paths: DrawingPath[] }>; startedAtSec?: number } | null;
  if (!keyframes?.keyframes || keyframes.keyframes.length === 0 || isRecording) return null;
  const startedAt = keyframes.startedAtSec ?? annotation!.timestampSec;
  const elapsed = currentTime - startedAt;
  if (elapsed < 0 || elapsed > (keyframes.keyframes[keyframes.keyframes.length - 1]?.tSec ?? 0) + 2) {
    return null;
  }
  // Find the last keyframe with tSec <= elapsed.
  let active = keyframes.keyframes[0];
  for (const kf of keyframes.keyframes) {
    if (kf.tSec <= elapsed) active = kf;
    else break;
  }
  return (
    <DrawingOverlay
      paths={active.paths}
      onPathsChange={() => { /* read-only replay */ }}
      enabled={false}
      readOnly
    />
  );
};

export default VideoReviewRoom;
