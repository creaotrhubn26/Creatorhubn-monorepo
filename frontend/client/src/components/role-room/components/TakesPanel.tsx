/**
 * TakesPanel.tsx
 *
 * Review-UI for casting_takes per scene. Lister opptak med status, lar
 * brukeren markere circled / endre take-nummer / slette, og laste opp
 * nye opptak.
 *
 * Speiler livesetmode.md §16.2 (Takes-listen) men i forenklet form for
 * MVP — full PRO-layout (multi-cam preview, etc.) kommer senere.
 *
 * Status-mapping fra backend:
 *   pending     — opplastet, venter på processing
 *   queued      — i job-queue
 *   processing  — analysepipeline kjører
 *   analyzed    — alle stages ferdig (kan vise score)
 *   failed      — minst én stage feilet
 */

import React, { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import StarIcon from '@mui/icons-material/Star';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayCircleIcon from '@mui/icons-material/PlayCircleFilled';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import { useTakes } from '../hooks/useTakes';
import { getTake, type CastingTake, type ProcessingStatus } from '../services/takesClient';

// ─────────────────────────────────────────────────────────────────────
// Status-presentasjon
// ─────────────────────────────────────────────────────────────────────

const STATUS_META: Record<
  ProcessingStatus,
  { label: string; color: 'default' | 'primary' | 'warning' | 'success' | 'error' }
> = {
  pending: { label: 'Venter', color: 'default' },
  queued: { label: 'I kø', color: 'default' },
  processing: { label: 'Analyserer…', color: 'warning' },
  analyzed: { label: 'Analysert', color: 'success' },
  failed: { label: 'Feilet', color: 'error' },
};

function StatusChip({ status }: { status: ProcessingStatus }) {
  const meta = STATUS_META[status];
  const Icon =
    status === 'processing' ? HourglassEmptyIcon :
    status === 'analyzed' ? CheckCircleIcon :
    status === 'failed' ? ErrorOutlineIcon : null;
  return (
    <Chip
      label={meta.label}
      size="small"
      color={meta.color}
      variant={status === 'analyzed' ? 'filled' : 'outlined'}
      icon={Icon ? <Icon fontSize="small" /> : undefined}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// Single take card
// ─────────────────────────────────────────────────────────────────────

interface TakeCardProps {
  take: CastingTake;
  onToggleCircled: () => void;
  onDelete: () => void;
  onPlay: () => void;
}

function formatDuration(sec: number | null): string {
  if (sec == null) return '—';
  const total = Math.round(sec);
  const mm = Math.floor(total / 60);
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

const TakeCard: React.FC<TakeCardProps> = ({ take, onToggleCircled, onDelete, onPlay }) => {
  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: take.markedCircled ? '4px solid' : undefined,
        borderLeftColor: take.markedCircled ? 'warning.main' : undefined,
      }}
    >
      <CardContent sx={{ '&:last-child': { pb: 1.5 } }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="subtitle2">
                Take {take.takeNumber}
              </Typography>
              <StatusChip status={take.processingStatus} />
              {take.markedCircled && (
                <Chip label="Circled" size="small" color="warning" variant="outlined" />
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" display="block">
              {formatDuration(take.durationSec)} · {formatSize(take.sizeBytes)} · {take.mediaType}
            </Typography>
            {take.notes && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                {take.notes}
              </Typography>
            )}
            {take.shotIndex != null && (
              <Typography variant="caption" color="text.secondary" display="block">
                Shot #{take.shotIndex + 1}
              </Typography>
            )}
          </Box>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title={take.markedCircled ? 'Fjern circled' : 'Marker som circled'}>
              <IconButton size="small" onClick={onToggleCircled} color={take.markedCircled ? 'warning' : 'default'}>
                {take.markedCircled ? <StarIcon /> : <StarOutlineIcon />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Spill av">
              <IconButton size="small" onClick={onPlay} disabled={take.processingStatus === 'pending'}>
                <PlayCircleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Slett">
              <IconButton size="small" onClick={onDelete}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ─────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────

export interface TakesPanelProps {
  projectId: string;
  sceneId: string;
  /** Hvis satt, filtrer til kun takes for et spesifikt shot */
  shotListId?: string;
  shotIndex?: number;
  /** Default-shotListId/index for nye uploads (manuell tagging) */
  defaultShotListId?: string;
  defaultShotIndex?: number;
}

export const TakesPanel: React.FC<TakesPanelProps> = ({
  projectId,
  sceneId,
  shotListId,
  shotIndex,
  defaultShotListId,
  defaultShotIndex,
}) => {
  const { takes, loading, error, upload, update, remove, refetch } = useTakes(projectId, sceneId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<Error | null>(null);

  // Filtrer hvis shotListId+shotIndex er satt
  const visibleTakes = (shotListId !== undefined && shotIndex !== undefined)
    ? takes.filter((t) => t.shotListId === shotListId && t.shotIndex === shotIndex)
    : takes;

  // Auto-beregn neste take-number
  const nextTakeNumber = visibleTakes.length > 0
    ? Math.max(...visibleTakes.map((t) => t.takeNumber)) + 1
    : 1;

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset så samme fil kan velges igjen
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);
    try {
      await upload({
        file,
        takeNumber: nextTakeNumber,
        shotListId: defaultShotListId,
        shotIndex: defaultShotIndex,
        onProgress: (loaded, total) => {
          setUploadProgress(total > 0 ? (loaded / total) * 100 : 0);
        },
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handlePlay = async (takeId: string) => {
    try {
      const fresh = await getTake(takeId);
      if (fresh.playbackUrl) {
        window.open(fresh.playbackUrl, '_blank', 'noopener');
      }
    } catch (err) {
      console.warn('[TakesPanel] playback URL fetch failed:', err);
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1">
          Takes
          {visibleTakes.length > 0 && (
            <Chip label={visibleTakes.length} size="small" sx={{ ml: 1 }} />
          )}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={uploading ? <CircularProgress size={14} /> : <UploadIcon />}
          onClick={handleFilePick}
          disabled={uploading}
        >
          Last opp take
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*"
          style={{ display: 'none' }}
          onChange={handleFileSelected}
        />
      </Stack>

      {uploading && uploadProgress > 0 && (
        <Box sx={{ mb: 1 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <Typography variant="caption" color="text.secondary">
            {Math.round(uploadProgress)}%
          </Typography>
        </Box>
      )}

      {uploadError && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setUploadError(null)}>
          Upload feilet: {uploadError.message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error.message}
        </Alert>
      )}

      {loading && visibleTakes.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {!loading && visibleTakes.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          Ingen takes ennå. Last opp første for å starte.
        </Typography>
      )}

      <Stack spacing={1}>
        {visibleTakes.map((take) => (
          <TakeCard
            key={take.id}
            take={take}
            onToggleCircled={() => void update(take.id, { markedCircled: !take.markedCircled })}
            onDelete={() => void remove(take.id)}
            onPlay={() => void handlePlay(take.id)}
          />
        ))}
      </Stack>

      {/* Refresh-knapp i bunnen for status-poll-uavhengig sjekk */}
      {visibleTakes.length > 0 && (
        <Box sx={{ textAlign: 'center', mt: 1 }}>
          <Button size="small" onClick={() => void refetch()} variant="text">
            Oppdater status
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default TakesPanel;
