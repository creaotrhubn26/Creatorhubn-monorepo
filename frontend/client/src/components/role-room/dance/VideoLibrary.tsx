/**
 * VideoLibrary — liste over klipp + upload + velg-å-review-flyt.
 *
 * Layout:
 *   ┌──────────────┬───────────────────────────────────┐
 *   │  Clip-liste  │     VideoReviewRoom for valgt    │
 *   │  + upload    │     clip                          │
 *   └──────────────┴───────────────────────────────────┘
 *
 * Klipp grupperes etter kind (rehearsal/reference/performance) og
 * sorteres nyeste først.
 */

import { danceFlowColors } from './danceFlowTheme';
import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CompareArrows as CompareIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import {
  listClips,
  uploadClip,
  deleteClip,
  type VideoClip,
  type VideoClipKind,
} from './danceVideoService';
import { listChoreographies, getChoreography } from './choreographyService';
import type { Choreography } from './choreographyTypes';
import { VideoReviewRoom } from './VideoReviewRoom';

const PURPLE = danceFlowColors.lavenderDark;
const PURPLE_LIGHT = danceFlowColors.lavender;
const BG = danceFlowColors.bgBase;
const CARD = danceFlowColors.bgCard;
const BORDER = 'rgba(139,92,246,0.25)';

const KIND_LABEL: Record<VideoClipKind, string> = {
  rehearsal: 'Prøve',
  reference: 'Referanse',
  performance: 'Forestilling',
};

const KIND_COLOR: Record<VideoClipKind, string> = {
  rehearsal: '#a78bfa',
  reference: '#fbbf24',
  performance: '#10b981',
};

export interface VideoLibraryProps {
  projectId: string | null;
  /** Aktiv bruker-id — sendes ned til VideoReviewRoom for "Du"-rendering + delete-tilgang. */
  currentUserId: string;
}

interface UploadState {
  uploading: boolean;
  loaded: number;
  total: number;
  error: string | null;
}

export function VideoLibrary({
  projectId,
  currentUserId,
}: VideoLibraryProps): React.ReactElement {
  const [clips, setClips] = React.useState<VideoClip[]>([]);
  const [clipFilter, setClipFilter] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeClipId, setActiveClipId] = React.useState<string | null>(null);
  const [compareClipId, setCompareClipId] = React.useState<string | null>(null);
  const [choreographies, setChoreographies] = React.useState<Array<{ id: string; title: string }>>([]);
  const [activeChoreoSegments, setActiveChoreoSegments] = React.useState<Array<{ id: string; label: string }>>([]);
  const [chooseChoreoId, setChooseChoreoId] = React.useState<string>('');
  const [chooseKind, setChooseKind] = React.useState<VideoClipKind>('rehearsal');
  const [uploadState, setUploadState] = React.useState<UploadState>({
    uploading: false, loaded: 0, total: 0, error: null,
  });
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // ─── Initial load ─────────────────────────────────────────────
  const refresh = React.useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [clipList, choreoHeaders] = await Promise.all([
        listClips({ projectId: projectId ?? undefined }),
        listChoreographies(projectId ?? undefined),
      ]);
      setClips(clipList);
      setChoreographies(choreoHeaders.map((h) => ({ id: h.id, title: h.title })));
      if (!chooseChoreoId && choreoHeaders.length > 0) {
        setChooseChoreoId(choreoHeaders[0].id);
      }
      if (clipList.length > 0 && !activeClipId) {
        setActiveClipId(clipList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke laste klipp');
    } finally {
      setLoading(false);
    }
  }, [projectId, chooseChoreoId, activeClipId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  // Hent segments for valgt choreography (brukes som filter i ReviewRoom).
  React.useEffect(() => {
    const active = clips.find((c) => c.id === activeClipId);
    if (!active?.choreographyId) {
      setActiveChoreoSegments([]);
      return;
    }
    let cancelled = false;
    getChoreography(active.choreographyId).then((c: Choreography) => {
      if (cancelled) return;
      setActiveChoreoSegments(
        c.segments.map((s) => ({
          id: s.id,
          label: `${s.label ?? s.kind} (${Math.round(s.startSec)}s)`,
        })),
      );
    }).catch(() => {
      if (!cancelled) setActiveChoreoSegments([]);
    });
    return () => { cancelled = true; };
  }, [activeClipId, clips]);

  // ─── Upload ───────────────────────────────────────────────────
  const handleFile = async (file: File): Promise<void> => {
    setUploadState({ uploading: true, loaded: 0, total: file.size, error: null });
    try {
      const created = await uploadClip({
        file,
        title: file.name.replace(/\.[^.]+$/, ''),
        kind: chooseKind,
        choreographyId: chooseChoreoId || null,
        projectId: projectId ?? null,
        onProgress: (loaded, total) => {
          setUploadState({ uploading: true, loaded, total, error: null });
        },
      });
      setUploadState({ uploading: false, loaded: 0, total: 0, error: null });
      setClips((prev) => [created, ...prev]);
      setActiveClipId(created.id);
    } catch (err) {
      setUploadState({
        uploading: false,
        loaded: 0,
        total: 0,
        error: err instanceof Error ? err.message : 'Opplasting feilet',
      });
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm('Slette klippet permanent?')) return;
    try {
      await deleteClip(id);
      setClips((prev) => prev.filter((c) => c.id !== id));
      if (activeClipId === id) setActiveClipId(null);
      if (compareClipId === id) setCompareClipId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette');
    }
  };

  const activeClip = clips.find((c) => c.id === activeClipId) ?? null;
  const compareClip = clips.find((c) => c.id === compareClipId) ?? null;

  const uploadPct = uploadState.total > 0
    ? Math.round((uploadState.loaded / uploadState.total) * 100)
    : 0;

  // Group clips by kind for the sidebar — filter på søketekst hvis satt.
  const clipsByKind = React.useMemo(() => {
    const map: Record<VideoClipKind, VideoClip[]> = {
      rehearsal: [], reference: [], performance: [],
    };
    const q = clipFilter.trim().toLowerCase();
    const filtered = q.length > 0
      ? clips.filter((c) => c.title.toLowerCase().includes(q))
      : clips;
    for (const c of filtered) map[c.kind].push(c);
    return map;
  }, [clips, clipFilter]);

  return (
    <Box
      data-testid="video-library"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '280px 1fr' },
        gap: 0,
        bgcolor: BG,
        color: '#e5e7eb',
        minHeight: '100%',
      }}
    >
      {/* ─── Sidebar ─────────────────────────────────── */}
      <Box
        sx={{
          borderRight: { md: `1px solid ${BORDER}` },
          p: 2,
          overflowY: 'auto',
        }}
      >
        <Typography sx={{ fontSize: 10, letterSpacing: 2, color: PURPLE_LIGHT, fontWeight: 700, mb: 1 }}>
          VIDEOBIBLIOTEK
        </Typography>

        {/* Upload-form */}
        <Box sx={{ mb: 2, p: 1.25, bgcolor: CARD, border: `1px solid ${BORDER}`, borderRadius: 1.5 }}>
          <Stack spacing={1}>
            <TextField
              select
              size="small"
              label="Stykke"
              value={chooseChoreoId}
              onChange={(e) => setChooseChoreoId(e.target.value)}
              sx={{
                '& .MuiInputBase-root': { fontSize: 12, bgcolor: BG, color: '#e5e7eb' },
                '& .MuiInputLabel-root': { color: PURPLE_LIGHT, fontSize: 12 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
              }}
              disabled={uploadState.uploading || choreographies.length === 0}
            >
              {choreographies.length === 0 ? (
                <MenuItem value="">Ingen stykker — opprett under "Stykker"</MenuItem>
              ) : null}
              {choreographies.map((c) => (
                <MenuItem key={c.id} value={c.id} sx={{ fontSize: 12 }}>{c.title}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Type"
              value={chooseKind}
              onChange={(e) => setChooseKind(e.target.value as VideoClipKind)}
              sx={{
                '& .MuiInputBase-root': { fontSize: 12, bgcolor: BG, color: '#e5e7eb' },
                '& .MuiInputLabel-root': { color: PURPLE_LIGHT, fontSize: 12 },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: BORDER },
              }}
              disabled={uploadState.uploading}
            >
              {(['rehearsal', 'reference', 'performance'] as VideoClipKind[]).map((k) => (
                <MenuItem key={k} value={k} sx={{ fontSize: 12 }}>{KIND_LABEL[k]}</MenuItem>
              ))}
            </TextField>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                if (e.target) e.target.value = '';
              }}
            />
            <Button
              variant="contained"
              size="small"
              startIcon={<UploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadState.uploading}
              sx={{
                bgcolor: PURPLE,
                '&:hover': { bgcolor: '#7c3aed' },
                textTransform: 'none', fontWeight: 600, fontSize: 12,
              }}
              data-testid="video-library-upload"
            >
              {uploadState.uploading ? `Laster opp ${uploadPct}%` : 'Last opp video'}
            </Button>
            {uploadState.uploading ? (
              <LinearProgress
                variant="determinate"
                value={uploadPct}
                sx={{
                  height: 4, borderRadius: 1,
                  bgcolor: 'rgba(139,92,246,0.18)',
                  '& .MuiLinearProgress-bar': { bgcolor: PURPLE },
                }}
              />
            ) : null}
            {uploadState.error ? (
              <Alert severity="error" sx={{ fontSize: 11 }}>{uploadState.error}</Alert>
            ) : null}
          </Stack>
        </Box>

        {error ? <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert> : null}

        {/* Søk i klippene — DanceAnnotate-paritet */}
        <Box sx={{ mb: 1 }}>
          <input
            type="search"
            placeholder="Søk klipp…"
            value={clipFilter}
            onChange={(e) => setClipFilter(e.target.value)}
            data-testid="video-library-search"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '6px 8px',
              borderRadius: 4,
              border: '1px solid rgba(139,92,246,0.25)',
              background: '#0a0a0a',
              color: '#e5e7eb',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </Box>

        {loading && clips.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <CircularProgress size={20} sx={{ color: PURPLE }} />
          </Stack>
        ) : null}

        {(['rehearsal', 'reference', 'performance'] as VideoClipKind[]).map((kind) => {
          const list = clipsByKind[kind];
          if (list.length === 0) return null;
          return (
            <Box key={kind} sx={{ mb: 1.5 }}>
              <Typography sx={{ fontSize: 9, letterSpacing: 1.5, color: KIND_COLOR[kind], fontWeight: 700, mb: 0.5 }}>
                {KIND_LABEL[kind].toUpperCase()} ({list.length})
              </Typography>
              <Stack spacing={0.5}>
                {list.map((c) => {
                  const isActive = c.id === activeClipId;
                  const isCompare = c.id === compareClipId;
                  return (
                    <Box
                      key={c.id}
                      data-testid={`video-library-item-${c.id}`}
                      sx={{
                        p: 0.75,
                        borderRadius: 1,
                        border: `1px solid ${isActive ? PURPLE : BORDER}`,
                        bgcolor: isActive ? 'rgba(139,92,246,0.12)' : CARD,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(139,92,246,0.08)' },
                      }}
                      onClick={() => setActiveClipId(c.id)}
                    >
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <PlayIcon sx={{ fontSize: 14, color: KIND_COLOR[c.kind] }} />
                        <Typography noWrap sx={{ fontSize: 12, fontWeight: 600, color: '#fff', flex: 1 }}>
                          {c.title}
                        </Typography>
                        <Tooltip title={isCompare ? 'Sammenlikning aktiv' : 'Sammenlikne med aktivt klipp'}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCompareClipId(isCompare ? null : c.id);
                            }}
                            disabled={isActive}
                            sx={{ p: 0.25, color: isCompare ? '#fbbf24' : 'rgba(229,231,235,0.4)' }}
                          >
                            <CompareIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      {c.durationSec ? (
                        <Typography sx={{ fontSize: 10, color: 'rgba(229,231,235,0.4)', ml: 2.5 }}>
                          {Math.round(c.durationSec)}s
                          {c.capturedAt ? ` · ${new Date(c.capturedAt).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' })}` : ''}
                        </Typography>
                      ) : null}
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
        {clips.length === 0 && !loading ? (
          <Typography sx={{ fontSize: 11, color: 'rgba(229,231,235,0.5)', fontStyle: 'italic' }}>
            Ingen klipp ennå. Last opp ditt første prøveopptak ovenfor.
          </Typography>
        ) : null}
      </Box>

      {/* ─── Active review room ─────────────────────── */}
      <Box sx={{ minWidth: 0 }}>
        {activeClip ? (
          <VideoReviewRoom
            key={activeClip.id}
            clip={activeClip}
            currentUserId={currentUserId}
            segmentOptions={activeChoreoSegments}
            compareWithClip={compareClip && compareClip.id !== activeClip.id ? compareClip : null}
            onClipUpdated={(updated) => {
              setClips((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            }}
            onDeleteClip={() => void handleDelete(activeClip.id)}
          />
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ minHeight: 320, color: 'rgba(229,231,235,0.5)', p: 4 }}
          >
            <Chip label="Velg eller last opp et klipp" sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT }} />
          </Stack>
        )}
      </Box>
    </Box>
  );
}

export default VideoLibrary;
