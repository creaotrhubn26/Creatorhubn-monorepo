/**
 * AI AUDIO ASSISTANT DIALOG
 * Automatic audio mixing for timeline tracks
 * Inspired by DaVinci Resolve's Audio Assistant
 */

import React, { useState, useRef, useEffect } from 'react';
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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  AutoFixHigh,
  Close,
  GraphicEq,
  VolumeUp,
  MusicNote,
  RecordVoiceOver,
  Hearing,
  CheckCircle,
  Error,
  Info,
  Tune,
  List as ListIcon
} from '@mui/icons-material';
import { apiRequest } from '@/lib/queryClient';
import AudioMixerPanel from './AudioMixerPanel';

interface AIAudioAssistantDialogProps {
  open: boolean;
  onClose: () => void;
  audioTracks: Array<{
    id: string;
    name: string;
    sourceFile: string;
    type?: 'dialogue' | 'music' | 'sfx';
  }>;
  onMixComplete: (mixedAudioUrl: string, metrics: any) => void;
  selectedTrackId?: string | null;
  openMixerDirectly?: boolean;
}

const BRAND_COLORS = {
  orange: '#ff8c00',
  purple: '#9333ea',
  green: '#16a34a',
  blue: '#3b82f6',
  dark: '#1a1a1a',
};

const DUCKING_PRESETS = [
  { name: 'Podcast', description: 'Standard podcast ducking', settings: { amount: -6, attack: 0.1, release: 0.5, threshold: -40 } },
  { name: 'Radio', description: 'Radio-style ducking', settings: { amount: -9, attack: 0.05, release: 0.3, threshold: -35 } },
  { name: 'Film/TV', description: 'Cinematic ducking', settings: { amount: -4, attack: 0.2, release: 1.0, threshold: -40 } },
  { name: 'YouTube', description: 'YouTube-style ducking', settings: { amount: -6, attack: 0.1, release: 0.5, threshold: -38 } },
  { name: 'Audiobook', description: 'Audiobook ducking', settings: { amount: -8, attack: 0.15, release: 0.8, threshold: -42 } },
  { name: 'Live Stream', description: 'Live streaming', settings: { amount: -7, attack: 0.05, release: 0.4, threshold: -36 } },
];

export default function AIAudioAssistantDialog({
  open,
  onClose,
  audioTracks,
  onMixComplete,
  selectedTrackId = null,
  openMixerDirectly = false
}: AIAudioAssistantDialogProps) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const [mixedUrl, setMixedUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'simple' | 'mixer'>(openMixerDirectly ? 'mixer' : 'simple');

  // Options
  const [autoClassify, setAutoClassify] = useState(true);
  const [applyDucking, setApplyDucking] = useState(true);
  const [applyMastering, setApplyMastering] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<string>('Podcast');

  // Mixer state
  const [mixerTracks, setMixerTracks] = useState<any[]>([]);
  const [duckingSettings, setDuckingSettings] = useState({
    enabled: true,
    amount: -6.0,
    attack: 0.1,
    release: 0.5,
    threshold: -40
  });

  // Audio preview
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // Filter tracks if a specific track is selected
  const filteredAudioTracks = selectedTrackId
    ? audioTracks.filter(track => track.id === selectedTrackId)
    : audioTracks;

  // Initialize mixer tracks when dialog opens
  useEffect(() => {
    if (open && filteredAudioTracks.length > 0) {
      // Initialize tracks with default values
      const initialTracks = filteredAudioTracks.map(track => ({
        ...track,
        volume: 100,
        muted: false,
        solo: false,
        targetLUFS: track.type === 'dialogue' ? -16 : track.type === 'music' ? -20 : -18,
        eq: {
          enabled: false,
          lowGain: 0,
          midGain: 0,
          highGain: 0
        },
        waveformData: []  // Will be loaded from backend
      }));

      setMixerTracks(initialTracks);

      // Fetch real waveform data for each track
      filteredAudioTracks.forEach(async (track, index) => {
        try {
          const response = await fetch('/api/audio/waveform/analyze', {
            method: 'POST',
            headers: { 'Content-Type' : 'application/json' },
            body: JSON.stringify({
              audioUrl: track.sourceFile,
              samples: 100
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.waveformData) {
              // Calculate peak level and check if peaking
              const peakLevel = Math.max(...data.waveformData);
              const isPeaking = peakLevel > 0.95;

              setMixerTracks(prev => prev.map((t, i) =>
                i === index ? {
                  ...t,
                  waveformData: data.waveformData,
                  peakLevel,
                  isPeaking
                } : t
              ));
            }
          }
        } catch (error) {
          console.error('Failed to load waveform for track: ', track.name, error);
        }
      });
    }
  }, [open, filteredAudioTracks]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handlePreview = async () => {
    if (!mixedUrl) return;

    try {
      // Initialize audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Stop current playback if any
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
      }

      // Load and play mixed audio
      const response = await fetch(mixedUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      audioBufferRef.current = audioBuffer;

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        setIsPlaying(false);
        sourceNodeRef.current = null;
      };
      source.start(0);

      sourceNodeRef.current = source;
      setIsPlaying(true);
    } catch (err) {
      console.error('Preview error: ', err);
      setError('Failed to preview audio');
    }
  };

  const handlePlayPause = () => {
    if (isPlaying && sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
      setIsPlaying(false);
    } else {
      handlePreview();
    }
  };

  const handleStop = () => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  };

  const startMixing = async () => {
    setProcessing(true);
    setProgress(0);
    setStatus('Analyzing audio tracks...');
    setError(null);

    try {
      // Prepare tracks data with mixer settings
      const tracks = mixerTracks.map(track => ({
        path: track.sourceFile,
        name: track.name,
        type: track.type,
        volume: track.volume / 100,  // Convert to 0-1 range
        targetLUFS: track.targetLUFS
      }));

      setProgress(20);
      setStatus('Classifying track types...');

      // Call AI mixer endpoint with ducking settings
      const response = await apiRequest('/api/audio-enhancement/ai-mix', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({
          tracks,
          autoClassify,
          applyDucking: duckingSettings.enabled,
          applyMastering,
          duckingSettings: duckingSettings.enabled ? {
            amount: duckingSettings.amount,
            attack: duckingSettings.attack,
            release: duckingSettings.release,
            threshold: duckingSettings.threshold
          } : undefined
        })
      });

      setProgress(100);
      setStatus('Mix complete!');
      setMixedUrl(response.mixedUrl);
      setMetrics(response.metrics);
      setProcessing(false);

    } catch (err: any) {
      console.error('AI mixing error:', err);
      setError(err.message || 'Failed to mix audio');
      setProcessing(false);
    }
  };

  const getTrackIcon = (type?: string) => {
    switch (type) {
      case 'dialogue': return <RecordVoiceOver color="primary" />;
      case 'music': return <MusicNote color="secondary" />;
      case 'sfx': return <Hearing color="action" />;
      default: return <GraphicEq />;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth={viewMode === 'mixer' ? 'xl' : 'md'} fullWidth>
      <DialogTitle sx={{
        background: `linear-gradient(135deg, ${BRAND_COLORS.orange} 0%, ${BRAND_COLORS.purple} 100%)`,
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AutoFixHigh />
          <Typography variant="h6">AI Audio Assistant</Typography>

          {/* View Mode Toggle */}
          {!processing && !mixedUrl && (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant={viewMode === 'simple' ? 'contained' : 'outlined'}
                startIcon={<ListIcon />}
                onClick={() => setViewMode('simple')}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.5)',
                  bgcolor: viewMode === 'simple' ? 'rgba(255,255,255,0.2)' : 'transparent'
                }}
              >
                Simple
              </Button>
              <Button
                size="small"
                variant={viewMode === 'mixer' ? 'contained' : 'outlined'}
                startIcon={<Tune />}
                onClick={() => setViewMode('mixer')}
                sx={{
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.5)',
                  bgcolor: viewMode === 'mixer' ? 'rgba(255,255,255,0.2)' : 'transparent'
                }}
              >
                Mixer
              </Button>
            </Stack>
          )}
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2, p: viewMode === 'mixer' ? 0 : 3, height: viewMode === 'mixer' ? 600 : 'auto' }}>
        {/* Mixer View */}
        {viewMode === 'mixer' && !processing && !mixedUrl && (
          <AudioMixerPanel
            tracks={mixerTracks}
            onTracksChange={setMixerTracks}
            duckingSettings={duckingSettings}
            onDuckingChange={setDuckingSettings}
            onPreview={handlePreview}
            onMix={startMixing}
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onStop={handleStop}
          />
        )}

        {/* Simple View */}
        {viewMode === 'simple' && (
          <Stack spacing={3}>
            {/* Info Alert */}
            {!processing && !mixedUrl && (
            <Alert severity="info" icon={<Info />}>
              <Typography variant="body2">
                <strong>AI Audio Assistant</strong> will automatically:
              </Typography>
              <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                <li>Organize and classify tracks (dialogue, music, SFX)</li>
                <li>Even out dialogue levels</li>
                <li>Duck music during dialogue</li>
                <li>Balance sound effects</li>
                <li>Create a mastered final mix</li>
              </ul>
            </Alert>
          )}

          {/* Track List */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <VolumeUp fontSize="small" />
                Audio Tracks ({audioTracks.length})
              </Typography>
              <List dense>
                {audioTracks.map((track, index) => (
                  <React.Fragment key={track.id}>
                    <ListItem>
                      <ListItemIcon>
                        {getTrackIcon(track.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={track.name}
                        secondary={track.type || 'Auto-detect'}
                      />
                    </ListItem>
                    {index < audioTracks.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>

          {/* Options */}
          {!processing && !mixedUrl && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Mixing Options
                </Typography>
                <Stack spacing={1}>
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={autoClassify} 
                        onChange={(e) => setAutoClassify(e.target.checked)}
                      />
                    }
                    label="Auto-classify track types"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={applyDucking}
                        onChange={(e) => setApplyDucking(e.target.checked)}
                      />
                    }
                    label="Apply music ducking during dialogue"
                  />

                  {/* Ducking Preset Selector */}
                  {applyDucking && (
                    <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                      <InputLabel>Ducking Preset</InputLabel>
                      <Select
                        value={selectedPreset}
                        onChange={(e) => {
                          const presetName = e.target.value;
                          setSelectedPreset(presetName);
                          const preset = DUCKING_PRESETS.find(p => p.name === presetName);
                          if (preset) {
                            setDuckingSettings({
                              enabled: true,
                              ...preset.settings
                            });
                          }
                        }}
                        label="Ducking Preset"
                      >
                        {DUCKING_PRESETS.map((preset) => (
                          <MenuItem key={preset.name} value={preset.name}>
                            <Box>
                              <Typography variant="body2">{preset.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {preset.description}
                              </Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  <FormControlLabel
                    control={
                      <Switch
                        checked={applyMastering}
                        onChange={(e) => setApplyMastering(e.target.checked)}
                      />
                    }
                    label="Apply final mastering"
                  />
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Processing Progress */}
          {processing && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">{status}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {Math.round(progress)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: 'rgba(147, 51, 234, 0.1)','& .MuiLinearProgress-bar': {
                    background: `linear-gradient(90deg, ${BRAND_COLORS.orange} 0%, ${BRAND_COLORS.purple} 100%)`,
                    borderRadius: 4,
                  }
                }}
              />
            </Box>
          )}

          {/* Results */}
          {!processing && mixedUrl && metrics && (
            <Card variant="outlined" sx={{ bgcolor: 'rgba(22, 163, 74, 0.1)' }}>
              <CardContent>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle color="success" />
                    <Typography variant="subtitle2">Mix Complete!</Typography>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Tracks Processed
                    </Typography>
                    <Typography variant="body1">
                      {metrics.tracks_processed} tracks
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Track Breakdown
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                      {metrics.track_breakdown?.dialogue > 0 && (
                        <Chip
                          icon={<RecordVoiceOver />}
                          label={`${metrics.track_breakdown.dialogue} Dialogue`}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      )}
                      {metrics.track_breakdown?.music > 0 && (
                        <Chip
                          icon={<MusicNote />}
                          label={`${metrics.track_breakdown.music} Music`}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      )}
                      {metrics.track_breakdown?.sfx > 0 && (
                        <Chip
                          icon={<Hearing />}
                          label={`${metrics.track_breakdown.sfx} SFX`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Final Loudness
                    </Typography>
                    <Typography variant="body1">
                      {metrics.final_lufs?.toFixed(1)} LUFS
                    </Typography>
                  </Box>

                  {metrics.ducking_applied && (
                    <Box>
                      <Chip
                        icon={<CheckCircle />}
                        label="Music ducking applied"
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                    </Box>
                  )}

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Processing Time
                    </Typography>
                    <Typography variant="body1">
                      {metrics.processing_time_seconds}s
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}

          {/* Error */}
          {error && (
            <Alert severity="error" icon={<Error />}>
              <Typography variant="body2">
                <strong>Error:</strong> {error}
              </Typography>
            </Alert>
          )}
          </Stack>
        )}
      </DialogContent>

      {/* Dialog Actions - Only show in simple view */}
      {viewMode === 'simple' && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={processing}>
            {mixedUrl ? 'Avbryt' : 'Lukk'}
          </Button>

          {/* Preview Button */}
          {mixedUrl && (
            <Button
              variant="outlined"
              onClick={handlePreview}
              disabled={isPlaying}
              startIcon={<VolumeUp />}
              sx={{
                borderColor: BRAND_COLORS.purple,
                color: BRAND_COLORS.purple,
                '&:hover': {
                  borderColor: BRAND_COLORS.purple,
                  bgcolor: 'rgba(147, 51, 234, 0.1)'
                }
              }}
            >
              {isPlaying ? 'Playing...' : 'Preview Mix'}
            </Button>
          )}

          {!processing && !mixedUrl && (
            <Button
              variant="contained"
              onClick={startMixing}
              disabled={audioTracks.length === 0}
              sx={{
                background: `linear-gradient(135deg, ${BRAND_COLORS.orange} 0%, ${BRAND_COLORS.purple} 100%)`, '&:hover': {
                  background: `linear-gradient(135deg, ${BRAND_COLORS.orange} 20%, ${BRAND_COLORS.purple} 120%)`,
                }
              }}
            >
              Start AI Mix
            </Button>
          )}

          {mixedUrl && (
            <Button
              variant="contained"
              onClick={() => {
                onMixComplete(mixedUrl, metrics);
                onClose();
              }}
              sx={{
                background: `linear-gradient(135deg, ${BRAND_COLORS.orange} 0%, ${BRAND_COLORS.purple} 100%)`, '&:hover': {
                  background: `linear-gradient(135deg, ${BRAND_COLORS.orange} 20%, ${BRAND_COLORS.purple} 120%)`,
                }
              }}
            >
              Add to Timeline
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}

