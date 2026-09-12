/**
 * RecordTakeDialog — webcam-opptak av self-tape via MediaRecorder.
 *
 * Flyt:
 *   1. Be om kamera- og mikrofontilgang (getUserMedia)
 *   2. Vis live preview i <video autoplay muted playsInline>
 *   3. Knapp "Start opptak" → MediaRecorder starter
 *   4. Knapp "Stopp" → blob klar → upload til backend (multipart)
 *   5. Backend pusher til Cloudflare Stream + DB
 *
 * Bruker getSupportedMimeType() for å plukke beste codec på enheten.
 */
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  LinearProgress, Stack, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { useCallback, useEffect, useRef, useState } from 'react';

import { palette, radius } from '../../../theme';
import { uploadRecordedTake } from '../../../../services/roleRoomSelfTapesService';

interface Props {
  open: boolean;
  projectId: string | null;
  onClose: () => void;
  onUploaded: () => Promise<void> | void;
}

type Phase = 'idle' | 'permission' | 'preview' | 'recording' | 'review' | 'uploading' | 'error';

function pickMimeType(): string {
  const candidates = [
    'video/mp4;codecs=h264,aac',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm';
}

export default function RecordTakeDialog({
  open, projectId, onClose, onUploaded,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const supportsMediaRecorder = typeof window !== 'undefined'
    && typeof window.MediaRecorder !== 'undefined';
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [uploadPct, setUploadPct] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopTicker = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopTicker();
    stopStream();
    chunksRef.current = [];
    recorderRef.current = null;
    setRecordedBlob(null);
    setElapsedMs(0);
    setUploadPct(0);
    setError(null);
    setPhase('idle');
  }, [stopStream, stopTicker]);

  useEffect(() => {
    if (!open) reset();
    return () => { if (!open) reset(); };
  }, [open, reset]);

  const requestPermission = useCallback(async () => {
    setError(null);
    setPhase('permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase('preview');
    } catch (err) {
      setError(err instanceof Error
        ? `Kameratilgang nektet: ${err.message}`
        : 'Klarte ikke å aktivere kamera');
      setPhase('error');
    }
  }, []);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: 4_500_000,
      audioBitsPerSecond: 128_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setRecordedBlob(blob);
      setPhase('review');
      stopTicker();
    };
    recorder.start(1000);
    recorderRef.current = recorder;
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    setPhase('recording');
    tickRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 250);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const handleRetake = () => {
    setRecordedBlob(null);
    setElapsedMs(0);
    setPhase('preview');
  };

  const handleUpload = async () => {
    if (!recordedBlob || !projectId) return;
    setPhase('uploading');
    setUploadPct(10);
    try {
      const duration = elapsedMs;
      await uploadRecordedTake(projectId, recordedBlob, {
        durationMs: duration,
        onProgress: (pct) => setUploadPct(Math.max(10, Math.min(95, pct))),
      });
      setUploadPct(100);
      await onUploaded();
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload feilet');
      setPhase('error');
    }
  };

  const formattedElapsed = `${Math.floor(elapsedMs / 60_000)
    .toString().padStart(2, '0')}:${Math.floor((elapsedMs / 1000) % 60)
    .toString().padStart(2, '0')}`;

  const reviewVideoUrl = recordedBlob ? URL.createObjectURL(recordedBlob) : null;

  // Cleanup blob URL når reviewVideoUrl bytter
  useEffect(() => {
    return () => {
      if (reviewVideoUrl) URL.revokeObjectURL(reviewVideoUrl);
    };
  }, [reviewVideoUrl]);

  return (
    <Dialog
      open={open}
      onClose={phase === 'uploading' ? undefined : onClose}
      fullWidth
      maxWidth="md"
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          bgcolor: palette.bgShell,
          color: palette.textPrimary,
          border: isMobile ? 'none' : `1px solid ${palette.border}`,
          borderRadius: isMobile ? 0 : radius.lg,
          ...(isMobile && {
            paddingTop: 'env(safe-area-inset-top, 0)',
            paddingBottom: 'env(safe-area-inset-bottom, 0)',
          }),
        },
      }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>Spill inn ny take</Typography>
        <IconButton
          onClick={onClose}
          disabled={phase === 'uploading'}
          sx={{ position: 'absolute', right: 12, top: 12, color: palette.textMuted }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {/* Idle: be om tilgang */}
        {phase === 'idle' ? (
          <Stack alignItems="center" spacing={2.4} sx={{ py: 4 }}>
            <Typography sx={{ color: palette.textSecondary, textAlign: 'center', maxWidth: 420 }}>
              Vi trenger tilgang til kamera og mikrofon for å spille inn taken din. Opptaket
              lagres trygt i Cloudflare Stream og du eier alltid filen.
            </Typography>
            {supportsMediaRecorder ? (
              <Button
                onClick={requestPermission}
                variant="contained"
                sx={{
                  background: palette.accentGradient,
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 3,
                  py: 1.2,
                  minHeight: 44, // Apple HIG touch-target
                  '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                }}
              >
                Aktiver kamera + mikrofon
              </Button>
            ) : (
              <Stack alignItems="center" spacing={1.2}>
                <Typography sx={{ color: '#fbbf24', fontSize: '0.86rem', textAlign: 'center', maxWidth: 360 }}>
                  Nettleseren din støtter ikke in-browser opptak. Bruk i stedet
                  kamera-appen direkte:
                </Typography>
                <Button
                  component="label"
                  variant="contained"
                  sx={{
                    background: palette.accentGradient,
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 3,
                    py: 1.2,
                    minHeight: 44,
                    '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                  }}
                >
                  Åpne kamera
                  <input
                    type="file"
                    accept="video/*"
                    capture="user"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setRecordedBlob(f);
                        setPhase('review');
                      }
                    }}
                  />
                </Button>
              </Stack>
            )}
          </Stack>
        ) : null}

        {/* Permission: be vente */}
        {phase === 'permission' ? (
          <Stack alignItems="center" spacing={1.2} sx={{ py: 6 }}>
            <Typography sx={{ color: palette.textMuted }}>
              Venter på tilgang …
            </Typography>
            <LinearProgress sx={{ width: 220, bgcolor: palette.borderSubtle }} />
          </Stack>
        ) : null}

        {/* Live preview / recording */}
        {(phase === 'preview' || phase === 'recording') ? (
          <Box>
            <Box
              sx={{
                position: 'relative',
                aspectRatio: '16 / 9',
                bgcolor: '#000',
                borderRadius: radius.sm,
                overflow: 'hidden',
                mb: 1.6,
              }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              {phase === 'recording' ? (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.8}
                  sx={{
                    position: 'absolute',
                    top: 12,
                    left: 12,
                    bgcolor: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    px: 1.4,
                    py: 0.6,
                    borderRadius: 999,
                  }}
                >
                  <FiberManualRecordIcon sx={{ fontSize: 12, color: '#ef4444', animation: 'pulse 1.2s infinite' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: '0.86rem' }}>
                    REC {formattedElapsed}
                  </Typography>
                </Stack>
              ) : null}
            </Box>
            <Stack direction="row" justifyContent="center">
              {phase === 'preview' ? (
                <Button
                  onClick={startRecording}
                  startIcon={<FiberManualRecordIcon sx={{ color: '#ef4444' }} />}
                  sx={{
                    background: palette.accentGradient,
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 3,
                    py: 1.2,
                    '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
                  }}
                >
                  Start opptak
                </Button>
              ) : (
                <Button
                  onClick={stopRecording}
                  startIcon={<StopIcon />}
                  sx={{
                    bgcolor: '#ef4444',
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 3,
                    py: 1.2,
                    '&:hover': { bgcolor: '#dc2626' },
                  }}
                >
                  Stopp opptak
                </Button>
              )}
            </Stack>
          </Box>
        ) : null}

        {/* Review */}
        {phase === 'review' && reviewVideoUrl ? (
          <Box>
            <Box
              sx={{
                aspectRatio: '16 / 9',
                bgcolor: '#000',
                borderRadius: radius.sm,
                overflow: 'hidden',
                mb: 1.6,
              }}
            >
              <video
                ref={reviewVideoRef}
                controls
                src={reviewVideoUrl}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </Box>
            <Typography sx={{ color: palette.textMuted, fontSize: '0.86rem', textAlign: 'center', mb: 1.4 }}>
              Lengde: {formattedElapsed} · Sjekk over kvaliteten før du laster opp
            </Typography>
          </Box>
        ) : null}

        {/* Uploading */}
        {phase === 'uploading' ? (
          <Box sx={{ py: 4 }}>
            <Typography sx={{ color: palette.textSecondary, mb: 1.4, textAlign: 'center' }}>
              Laster opp til Cloudflare Stream …
            </Typography>
            <LinearProgress
              variant="determinate"
              value={uploadPct}
              sx={{
                height: 8,
                borderRadius: 999,
                bgcolor: palette.borderSubtle,
                '& .MuiLinearProgress-bar': { background: palette.accentGradient },
              }}
            />
            <Typography sx={{ color: palette.textMuted, fontSize: '0.78rem', textAlign: 'center', mt: 1 }}>
              {Math.round(uploadPct)}%
            </Typography>
          </Box>
        ) : null}

        {/* Error */}
        {phase === 'error' && error ? (
          <Box sx={{ py: 3 }}>
            <Typography sx={{ color: '#f87171', mb: 2 }}>{error}</Typography>
            <Button
              onClick={reset}
              sx={{ color: palette.accentBright, textTransform: 'none' }}
            >
              Prøv igjen
            </Button>
          </Box>
        ) : null}
      </DialogContent>
      {phase === 'review' ? (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleRetake}
            startIcon={<ReplayOutlinedIcon />}
            sx={{ color: palette.textMuted, textTransform: 'none' }}
          >
            Spill inn på nytt
          </Button>
          <Button
            onClick={handleUpload}
            startIcon={<CloudUploadOutlinedIcon />}
            sx={{
              background: palette.accentGradient,
              color: '#fff',
              textTransform: 'none',
              fontWeight: 700,
              px: 2.4,
              '&:hover': { background: 'linear-gradient(135deg, #9333ea 0%, #c026d3 100%)' },
            }}
          >
            Last opp som ny take
          </Button>
        </DialogActions>
      ) : null}
    </Dialog>
  );
}
