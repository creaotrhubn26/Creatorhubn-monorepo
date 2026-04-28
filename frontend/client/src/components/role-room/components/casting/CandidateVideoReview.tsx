/**
 * CandidateVideoReview.tsx
 *
 * Video-player med tidskodede kommentarer for casting-utvelgelse.
 * Bruker som ser videoen kan:
 *   • Spille av / pause / spole
 *   • Slow-motion (0.25x / 0.5x / 1x / 1.5x)
 *   • Frame-step ±0.04s (≈25fps)
 *   • Drop kommentar ved nåværende timestamp
 *   • Klikk en kommentar → seek til den timestampen
 *   • Stjerne-rating 1–5 + notater
 *   • Last opp ny video
 */

import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Rating,
  Tooltip,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  CloudUploadOutlined as UploadIcon,
  PlayArrowOutlined as PlayIcon,
  PauseOutlined as PauseIcon,
  AddCommentOutlined as AddCommentIcon,
  DeleteOutlineOutlined as DeleteIcon,
  SkipPreviousOutlined as PrevFrameIcon,
  SkipNextOutlined as NextFrameIcon,
} from '@mui/icons-material';
import * as svc from '../../services/castingVideoService';
import type { CastingVideo, VideoAnnotation } from '../../services/castingVideoService';

interface Props {
  candidateId: string;
  projectId: string;
  candidateName?: string;
}

const PURPLE_BRIGHT = '#8b5cf6';
const PURPLE_LIGHT = '#a78bfa';
const PANEL_BG = 'rgba(15,12,28,0.62)';
const PANEL_BORDER = 'rgba(167,139,250,0.18)';
const TEXT_DIM = 'rgba(229,231,235,0.78)';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const CandidateVideoReview: React.FC<Props> = ({ candidateId, projectId, candidateName }) => {
  const [videos, setVideos] = React.useState<CastingVideo[]>([]);
  const [activeVideo, setActiveVideo] = React.useState<CastingVideo | null>(null);
  const [annotations, setAnnotations] = React.useState<VideoAnnotation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [playbackRate, setPlaybackRate] = React.useState(1);
  const [newComment, setNewComment] = React.useState('');

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await svc.listVideosForCandidate(candidateId);
      setVideos(list);
      if (!activeVideo && list.length > 0) {
        setActiveVideo(list[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [candidateId, activeVideo]);

  React.useEffect(() => { void refresh(); }, [candidateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Last annotations når aktiv video endres
  React.useEffect(() => {
    if (!activeVideo) { setAnnotations([]); return; }
    void svc.listAnnotations(activeVideo.id).then(setAnnotations).catch(() => setAnnotations([]));
  }, [activeVideo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sett playback-rate på videoen
  React.useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate, activeVideo?.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      const newVideo = await svc.uploadVideoFile({
        candidateId, projectId, file,
        onProgress: setUploadProgress,
      });
      await refresh();
      setActiveVideo(newVideo);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = '';
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  const seek = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  };

  const seekTo = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = seconds;
  };

  const submitComment = async () => {
    if (!activeVideo || !newComment.trim()) return;
    try {
      const ann = await svc.createAnnotation(activeVideo.id, {
        timestampSeconds: currentTime,
        comment: newComment.trim(),
      });
      setAnnotations((prev) => [...prev, ann].sort((a, b) => a.timestampSeconds - b.timestampSeconds));
      setNewComment('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const removeAnnotation = async (id: string) => {
    try {
      await svc.deleteAnnotation(id);
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const updateRating = async (rating: number | null) => {
    if (!activeVideo) return;
    try {
      const updated = await svc.updateVideo(activeVideo.id, { rating });
      setActiveVideo(updated);
      setVideos((prev) => prev.map((v) => v.id === updated.id ? updated : v));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: PURPLE_LIGHT }} /></Box>;
  }

  return (
    <Stack spacing={2.5} sx={{ p: { xs: 1, md: 2 } }}>
      {error ? <Alert severity="error" onClose={() => setError(null)}>{error}</Alert> : null}

      {/* Header + upload */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography sx={{ fontSize: 11, letterSpacing: 1.5, color: PURPLE_LIGHT, fontWeight: 700 }}>
            CASTING VIDEO REVIEW
          </Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: 'rgba(237,233,254,0.95)' }}>
            {candidateName ?? 'Kandidat'} · {videos.length} {videos.length === 1 ? 'video' : 'videoer'}
          </Typography>
        </Box>
        <Button
          component="label"
          variant="contained"
          startIcon={uploading ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : <UploadIcon />}
          disabled={uploading}
          sx={{ bgcolor: PURPLE_BRIGHT, '&:hover': { bgcolor: '#4c1d95' }, textTransform: 'none', fontWeight: 600 }}
        >
          {uploading ? `Laster opp ${uploadProgress}%…` : 'Last opp video'}
          <input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska" hidden onChange={handleUpload} />
        </Button>
      </Stack>
      {uploading ? <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 1 }} /> : null}

      {videos.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center', bgcolor: PANEL_BG, border: `1px solid ${PANEL_BORDER}`, borderRadius: 2 }}>
          <Typography sx={{ color: TEXT_DIM, fontSize: 14 }}>
            Ingen videoer for denne kandidaten ennå. Last opp audition-tape eller agent-reel.
          </Typography>
        </Box>
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {/* Video-liste (multi-video case) */}
          {videos.length > 1 ? (
            <Stack spacing={1} sx={{ minWidth: 180, maxWidth: 220 }}>
              {videos.map((v) => (
                <Box
                  key={v.id}
                  onClick={() => setActiveVideo(v)}
                  sx={{
                    p: 1, borderRadius: 1.5, cursor: 'pointer',
                    bgcolor: activeVideo?.id === v.id ? 'rgba(139,92,246,0.18)' : PANEL_BG,
                    border: `1px solid ${activeVideo?.id === v.id ? PURPLE_LIGHT : PANEL_BORDER}`,
                  }}
                >
                  <Typography sx={{ fontSize: 13, color: 'rgba(237,233,254,0.92)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {v.title ?? '(uten tittel)'}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: TEXT_DIM }}>
                    {v.durationSeconds ? formatTime(v.durationSeconds) : '—'}
                    {v.rating ? ` · ${'★'.repeat(v.rating)}${'☆'.repeat(5 - v.rating)}` : ''}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : null}

          {/* Player + kontroller */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {activeVideo ? (
              <>
                <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: '#000', mb: 2 }}>
                  <video
                    ref={videoRef}
                    src={activeVideo.videoUrl}
                    style={{ width: '100%', display: 'block' }}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    controls
                  />
                </Box>

                {/* Custom-kontroller */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                  <Tooltip title="Frame back (≈25fps)">
                    <IconButton size="small" onClick={() => seek(-0.04)} sx={{ color: PURPLE_LIGHT }}>
                      <PrevFrameIcon />
                    </IconButton>
                  </Tooltip>
                  <IconButton size="small" onClick={togglePlay} sx={{ color: PURPLE_LIGHT }}>
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </IconButton>
                  <Tooltip title="Frame forward (≈25fps)">
                    <IconButton size="small" onClick={() => seek(0.04)} sx={{ color: PURPLE_LIGHT }}>
                      <NextFrameIcon />
                    </IconButton>
                  </Tooltip>
                  <Typography sx={{ fontSize: 12, color: TEXT_DIM, fontFamily: 'monospace', minWidth: 80 }}>
                    {formatTime(currentTime)} / {activeVideo.durationSeconds ? formatTime(activeVideo.durationSeconds) : '—'}
                  </Typography>
                  <Box sx={{ flexGrow: 1 }} />
                  <ToggleButtonGroup
                    size="small" exclusive value={playbackRate}
                    onChange={(_, v) => v && setPlaybackRate(v)}
                  >
                    {[0.25, 0.5, 1, 1.5].map((rate) => (
                      <ToggleButton key={rate} value={rate} sx={{ color: TEXT_DIM, fontSize: 11, py: 0.25, px: 1 }}>
                        {rate}x
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Stack>

                {/* Rating */}
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Typography sx={{ fontSize: 12, color: TEXT_DIM }}>Vurdering:</Typography>
                  <Rating
                    value={activeVideo.rating ?? 0}
                    onChange={(_, value) => updateRating(value ?? null)}
                    size="medium"
                  />
                  <Box sx={{ flexGrow: 1 }} />
                  <Chip
                    label={activeVideo.status === 'ready' ? 'Klar' : activeVideo.status === 'pending' ? 'Behandler…' : 'Feil'}
                    size="small"
                    color={activeVideo.status === 'ready' ? 'success' : activeVideo.status === 'pending' ? 'default' : 'error'}
                  />
                </Stack>

                <Divider sx={{ borderColor: PANEL_BORDER, my: 2 }} />

                {/* Add comment ved nåværende time */}
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <Chip label={`@ ${formatTime(currentTime)}`} size="small" sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT, fontFamily: 'monospace' }} />
                  <TextField
                    size="small" fullWidth placeholder="Skriv kommentar ved dette timestampet…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void submitComment(); }}
                    sx={{ '& .MuiOutlinedInput-root': { color: 'rgba(237,233,254,0.9)' } }}
                  />
                  <Button
                    onClick={submitComment}
                    disabled={!newComment.trim()}
                    variant="contained"
                    startIcon={<AddCommentIcon />}
                    sx={{ bgcolor: PURPLE_BRIGHT, '&:hover': { bgcolor: '#4c1d95' }, textTransform: 'none' }}
                  >
                    Lagre
                  </Button>
                </Stack>

                {/* Annotation-liste */}
                <Box sx={{ bgcolor: PANEL_BG, borderRadius: 2, border: `1px solid ${PANEL_BORDER}` }}>
                  {annotations.length === 0 ? (
                    <Typography sx={{ p: 2, fontSize: 12, color: TEXT_DIM }}>
                      Ingen kommentarer ennå. Sett pause på et øyeblikk og skriv en notat over.
                    </Typography>
                  ) : (
                    annotations.map((a) => (
                      <Stack key={a.id} direction="row" spacing={2} alignItems="flex-start" sx={{ p: 1.5, borderBottom: `1px solid ${PANEL_BORDER}`, '&:last-child': { borderBottom: 'none' } }}>
                        <Chip
                          label={formatTime(a.timestampSeconds)}
                          size="small"
                          onClick={() => seekTo(a.timestampSeconds)}
                          sx={{ bgcolor: 'rgba(139,92,246,0.18)', color: PURPLE_LIGHT, fontFamily: 'monospace', cursor: 'pointer', minWidth: 56 }}
                        />
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography sx={{ fontSize: 13, color: 'rgba(237,233,254,0.92)' }}>{a.comment}</Typography>
                          <Typography sx={{ fontSize: 11, color: TEXT_DIM }}>
                            {a.authorName ?? 'Ukjent'} · {new Date(a.createdAt).toLocaleString('nb-NO')}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => removeAnnotation(a.id)} sx={{ color: '#f87171' }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    ))
                  )}
                </Box>
              </>
            ) : null}
          </Box>
        </Stack>
      )}
    </Stack>
  );
};

export default CandidateVideoReview;
