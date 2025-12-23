/**
 * AUDIO ENHANCEMENT DIALOG
 * Automatic audio enhancement with before/after comparison
 * Triggered when user adds audio to timeline
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Slider,
  Chip,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Divider
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  VolumeUp,
  GraphicEq,
  AutoFixHigh,
  CompareArrows,
  CheckCircle,
  Close
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';

interface AudioEnhancementDialogProps {
  open: boolean;
  onClose: () => void;
  audioFile: File | null;
  onEnhanced: (enhancedUrl: string, metrics: any) => void;
  onSkip: () => void;
  preset?: 'podcast' | 'youtube' | 'broadcast' | 'audiobook' | 'music' | 'radio' | 'tiktok' | 'twitch' | 'discord' | 'auto';
}

const BRAND_COLORS = {
  orange: '#ff8c00',
  purple: '#9333ea',
  blue: '#3b82f6',
  green: '#16a34a',
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
  const [metrics, setMetrics] = useState<any>(null);
  const [comparing, setComparing] = useState<'original' | 'enhanced'>('original');
  const [playing, setPlaying] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(preset);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-start processing when dialog opens
  useEffect(() => {
    if (open && audioFile && !processing && !enhancedUrl) {
      startEnhancement();
    }
  }, [open, audioFile]);

  // Create object URL for original audio
  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setOriginalUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [audioFile]);

  const startEnhancement = async () => {
    if (!audioFile) return;

    setProcessing(true);
    setProgress(0);
    setStatus('Analyzing audio... ');

    try {
      // Step 1: Upload and analyze
      const formData = new FormData();
      formData.append('file,', audioFile);
      formData.append('preset,', selectedPreset);
      formData.append('autoDetect', 'true');

      setProgress(10);
      setStatus('Measuring loudness (LUFS)...');

      // Step 2: Process with professional audio processor
      const response = await apiRequest('/api/audio-enhancement/auto-enhance', {
        method: 'POST',
        body: formData
      });

      setProgress(50);
      setStatus('Normalizing loudness...');

      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(70);
      setStatus('Applying true peak limiter...');

      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(90);
      setStatus('Reducing noise...');

      await new Promise(resolve => setTimeout(resolve, 500));

      setProgress(100);
      setStatus('Enhancement complete!');

      // Set enhanced URL and metrics
      setEnhancedUrl(response.enhancedUrl);
      setMetrics(response.metrics);
      setProcessing(false);

    } catch (error) {
      console.error('Enhancement error: ', error);
      setStatus('Enhancement failed');
      setProcessing(false);
    }
  };

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
    if (newValue && audioRef.current) {
      setComparing(newValue);
      const currentTime = audioRef.current.currentTime;
      audioRef.current.src = newValue === 'original' ? originalUrl! : enhancedUrl!;
      audioRef.current.currentTime = currentTime;
      if (playing) {
        audioRef.current.play();
      }
    }
  };

  const handleAddToTimeline = () => {
    if (enhancedUrl && metrics) {
      onEnhanced(enhancedUrl, metrics);
      onClose();
    }
  };

  const handleSkip = () => {
    onSkip();
    onClose();
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
          <Typography variant="h6" sx={{ fontWeight: 700}}>
            Forbedre lyd automatisk
          </Typography>
          <IconButton
            onClick={onClose}
            sx={{ ml: 'auto', color: '#9ca3af' }}
          >
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* Processing Status */}
        {processing && (
          <Box sx={{ mb: 3 }}>
            <Stack spacing={2}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  bgcolor: '#333','& .MuiLinearProgress-bar': {
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

        {/* Enhancement Complete */}
        {!processing && enhancedUrl && metrics && (
          <Box>
            {/* Success Alert */}
            <Alert
              severity="success"
              icon={<CheckCircle />}
              sx={{ mb: 3, bgcolor: `${BRAND_COLORS.green}20`, color: '#fff' }}
            >
              Lyden er forbedret! Sammenlign original og forbedret versjon nedenfor.
            </Alert>

            {/* Metrics */}
            <Card sx={{ bgcolor: '#2a2a2a', mb: 3 }}>
              <CardContent>
                <Typography sx={{ color: BRAND_COLORS.orange, fontWeight: 70, mb: 2 }}>
                  📊 Forbedringer
                </Typography>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: '#9ca3af', fontSize: '14px' }}>
                      Lydstyrke (LUFS):
                    </Typography>
                    <Typography sx={{ color: '#fff', fontSize: '14px', fontWeight: 600}}>
                      {metrics.loudness?.original_lufs?.toFixed(1)} → {metrics.loudness?.final_lufs?.toFixed(1)} LUFS
                      <Chip
                        label={`${metrics.loudness?.gain_applied_db > 0 ? '+' : ','}${metrics.loudness?.gain_applied_db?.toFixed(1)} dB`}
                        size="small"
                        sx={{ ml: 1, bgcolor: BRAND_COLORS.green, color: '#fff', fontSize: '11px' }}
                      />
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ color: '#9ca3af', fontSize: '14px' }}>
                      Standard:
                    </Typography>
                    <Typography sx={{ color: '#fff', fontSize: '14px', fontWeight: 600}}>
                      {metrics.loudness?.standard === 'podcast' && 'Podcast (-16 LUFS)'}
                      {metrics.loudness?.standard === 'youtube' && 'YouTube (-14 LUFS)'}
                      {metrics.loudness?.standard === 'broadcast' && 'Broadcast (-23 LUFS)'}
                    </Typography>
                  </Box>
                  {metrics.limiter?.limited && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: '#9ca3af', fontSize: '14px' }}>
                        Peak Limiting:
                      </Typography>
                      <Typography sx={{ color: '#fff', fontSize: '14px', fontWeight: 600}}>
                        {metrics.limiter?.reduction_db?.toFixed(1)} dB reduksjon
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Comparison Player */}
            <Card sx={{ bgcolor: '#2a2a2a' }}>
              <CardContent>
                <Typography sx={{ color: BRAND_COLORS.purple, fontWeight: 70, mb: 2 }}>
                  🎧 Sammenlign lyd
                </Typography>

                {/* Toggle Original/Enhanced */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <ToggleButtonGroup
                    value={comparing}
                    exclusive
                    onChange={(e, val) => handleCompareToggle(val)}
                    sx={{ bgcolor: '#1a1a1a' }}
                  >
                    <ToggleButton
                      value="original"
                      sx={{
                        color: comparing === 'original' ? BRAND_COLORS.orange : '#9ca3af','&.Mui-selected': { bgcolor: `${BRAND_COLORS.orange}20`, color: BRAND_COLORS.orange }
                      }}
                    >
                      Original
                    </ToggleButton>
                    <ToggleButton
                      value="enhanced"
                      sx={{
                        color: comparing === 'enhanced' ? BRAND_COLORS.green : '#9ca3af', '&.Mui-selected': { bgcolor: `${BRAND_COLORS.green}20`, color: BRAND_COLORS.green }
                      }}
                    >
                      Forbedret
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                {/* Playback Controls */}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                  <IconButton
                    onClick={togglePlayback}
                    sx={{
                      bgcolor: BRAND_COLORS.purple,
                      color: '#fff',
                      '&:hover': { bgcolor: BRAND_COLORS.orange }
                    }}
                  >
                    {playing ? <Pause /> : <PlayArrow />}
                  </IconButton>
                </Box>

                {/* Hidden Audio Element */}
                <audio
                  ref={audioRef}
                  src={comparing === 'original' ? originalUrl! : enhancedUrl!}
                  onEnded={() => setPlaying(false)}
                />
              </CardContent>
            </Card>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #333' }}>
        <Button
          onClick={handleSkip}
          sx={{ color: '#9ca3af' }}
        >
          Bruk original
        </Button>
        <Button
          onClick={handleAddToTimeline}
          variant="contained"
          disabled={!enhancedUrl}
          startIcon={<CheckCircle />}
          sx={{
            bgcolor: BRAND_COLORS.green,
            '&:hover': { bgcolor: '#15803d' }
          }}
        >
          Legg til i tidslinje
        </Button>
      </DialogActions>
    </Dialog>
  );
}

