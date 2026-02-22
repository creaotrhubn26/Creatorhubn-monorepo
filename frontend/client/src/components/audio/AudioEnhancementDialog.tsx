import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  Stack,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  AutoFixHigh,
  CompareArrows,
  CheckCircle,
  Close,
} from '@mui/icons-material';

interface AudioEnhancementDialogProps {
  open: boolean;
  onClose: () => void;
  audioFile: File | null;
  onEnhanced: (enhancedUrl: string, metrics: Record<string, unknown>) => void;
  onSkip: () => void;
  preset?:
    | 'podcast'
    | 'youtube'
    | 'broadcast'
    | 'audiobook'
    | 'music'
    | 'radio'
    | 'tiktok'
    | 'twitch'
    | 'discord'
    | 'auto';
}

interface EnhancementMetrics {
  loudness?: {
    original_lufs?: number;
    final_lufs?: number;
  };
  [key: string]: unknown;
}

const BRAND_COLORS = {
  orange: '#ff8c00',
  purple: '#9333ea',
  blue: '#3b82f6',
  green: '#16a34a'
};

export default function AudioEnhancementDialog({
  open,
  onClose,
  audioFile,
  onEnhanced,
  onSkip,
  preset = 'auto'
}: AudioEnhancementDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<EnhancementMetrics | null>(null);
  const [comparing, setComparing] = useState<'original' | 'enhanced'>('original');
  const [playing, setPlaying] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(preset);
  const [autoStarted, setAutoStarted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setOriginalUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    return undefined;
  }, [audioFile]);

  useEffect(() => {
    setSelectedPreset(preset);
  }, [preset]);

  const startEnhancement = useCallback(async () => {
    if (!audioFile) return;

    setProcessing(true);
    setProgress(10);
    setStatus('Analyserer lyd...');

    try {
      const formData = new FormData();
      formData.append('file', audioFile);
      formData.append('preset', selectedPreset);
      formData.append('autoDetect', 'true');

      const response = await fetch('/api/audio-enhancement/auto-enhance', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Enhancement failed');
      }

      setProgress(60);
      setStatus('Optimaliserer...');

      const data = (await response.json()) as {
        enhancedUrl?: string;
        metrics?: EnhancementMetrics;
      };
      if (!data.enhancedUrl) {
        throw new Error('Missing enhanced URL');
      }
      setEnhancedUrl(data.enhancedUrl);
      setMetrics(data.metrics || {});

      setProgress(100);
      setStatus('Ferdig!');
    } catch (error) {
      console.error('Enhancement error:', error);
      setStatus('Forbedring feilet');
    } finally {
      setProcessing(false);
    }
  }, [audioFile, selectedPreset]);

  useEffect(() => {
    if (!open) {
      setAutoStarted(false);
      return;
    }
    if (open && audioFile && !processing && !enhancedUrl && !autoStarted && preset === 'auto') {
      setAutoStarted(true);
      startEnhancement();
    }
  }, [audioFile, autoStarted, enhancedUrl, open, preset, processing, startEnhancement]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleCompareToggle = (newValue: 'original' | 'enhanced') => {
    if (!audioRef.current || !originalUrl || !enhancedUrl) return;
    setComparing(newValue);
    const currentTime = audioRef.current.currentTime;
    audioRef.current.src = newValue === 'original' ? originalUrl : enhancedUrl;
    audioRef.current.currentTime = currentTime;
    if (playing) audioRef.current.play();
  };

  const handleAddToTimeline = () => {
    if (enhancedUrl && metrics) {
      onEnhanced(enhancedUrl, metrics);
      onClose();
    }
  };

  const handleRestartEnhancement = () => {
    if (!audioFile || processing) return;
    audioRef.current?.pause();
    setPlaying(false);
    setComparing('original');
    setEnhancedUrl(null);
    setMetrics(null);
    startEnhancement();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1a1a1a',
          backgroundImage: 'none',
          border: `2px solid ${BRAND_COLORS.purple}40`
        }
      }}
    >
      <DialogTitle sx={{ color: '#fff', borderBottom: '1px solid #333' }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <AutoFixHigh sx={{ color: BRAND_COLORS.orange }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Forbedre lyd automatisk
          </Typography>
          <IconButton onClick={onClose} sx={{ ml: 'auto', color: '#9ca3af' }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {processing && (
          <Box sx={{ mb: 3 }}>
            <Stack spacing={2}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: '#333',
                  '& .MuiLinearProgress-bar': {
                    background: `linear-gradient(90deg, ${BRAND_COLORS.orange}, ${BRAND_COLORS.purple})`
                  }
                }}
              />
              <Typography sx={{ color: '#9ca3af', textAlign: 'center', fontSize: '14px' }}>
                {status}
              </Typography>
            </Stack>
          </Box>
        )}

        {!processing && enhancedUrl && metrics && (
          <Box>
            <Alert
              severity="success"
              icon={<CheckCircle />}
              sx={{ mb: 3, bgcolor: `${BRAND_COLORS.green}20`, color: '#fff' }}
            >
              Lyden er forbedret! Sammenlign original og forbedret versjon nedenfor.
            </Alert>

            <Card sx={{ bgcolor: '#2a2a2a', mb: 3 }}>
              <CardContent>
                <Typography sx={{ color: BRAND_COLORS.orange, fontWeight: 700, mb: 2 }}>
                  Forbedringer
                </Typography>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: '#9ca3af', fontSize: '14px' }}>
                      Preset
                    </Typography>
                    <Chip label={selectedPreset} size="small" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: '#9ca3af', fontSize: '14px' }}>
                      Loudness
                    </Typography>
                    <Typography sx={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
                      {metrics.loudness?.original_lufs ?? '-'} → {metrics.loudness?.final_lufs ?? '-'}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
              <Typography sx={{ color: '#9ca3af', fontSize: '14px' }}>Velg preset</Typography>
              <ToggleButtonGroup
                value={selectedPreset}
                exclusive
                onChange={(_, value) => value && setSelectedPreset(value)}
                size="small"
                disabled={processing}
              >
                <ToggleButton value="auto">Auto</ToggleButton>
                <ToggleButton value="podcast">Podcast</ToggleButton>
                <ToggleButton value="youtube">YouTube</ToggleButton>
                <ToggleButton value="broadcast">Broadcast</ToggleButton>
                <ToggleButton value="music">Music</ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <IconButton onClick={togglePlayback} color="primary">
                {playing ? <Pause /> : <PlayArrow />}
              </IconButton>
              <ToggleButtonGroup
                value={comparing}
                exclusive
                onChange={(_, value) => value && handleCompareToggle(value)}
                size="small"
              >
                <ToggleButton value="original">Original</ToggleButton>
                <ToggleButton value="enhanced">Forbedret</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <audio
              ref={audioRef}
              src={comparing === 'original' ? originalUrl || '' : enhancedUrl}
              controls
              style={{ width: '100%' }}
              onEnded={() => setPlaying(false)}
            />
          </Box>
        )}

        {!processing && !enhancedUrl && (
          <Stack spacing={2}>
            <Alert severity="info">Klar til a behandle lyden.</Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
              <Typography sx={{ color: '#9ca3af', fontSize: '14px' }}>Velg preset</Typography>
              <ToggleButtonGroup
                value={selectedPreset}
                exclusive
                onChange={(_, value) => value && setSelectedPreset(value)}
                size="small"
                disabled={processing}
              >
                <ToggleButton value="auto">Auto</ToggleButton>
                <ToggleButton value="podcast">Podcast</ToggleButton>
                <ToggleButton value="youtube">YouTube</ToggleButton>
                <ToggleButton value="broadcast">Broadcast</ToggleButton>
                <ToggleButton value="music">Music</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button onClick={onSkip} variant="outlined" startIcon={<CompareArrows />}>
          Hopp over
        </Button>
        {!enhancedUrl && (
          <Button onClick={startEnhancement} variant="contained" disabled={!audioFile || processing}>
            Start forbedring
          </Button>
        )}
        {enhancedUrl && (
          <Button onClick={handleRestartEnhancement} variant="outlined" disabled={processing}>
            Forbedre pa nytt
          </Button>
        )}
        <Button
          onClick={handleAddToTimeline}
          variant="contained"
          disabled={!enhancedUrl || !metrics}
        >
          Bruk forbedret lyd
        </Button>
      </DialogActions>
    </Dialog>
  );
}
