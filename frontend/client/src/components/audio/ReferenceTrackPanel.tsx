/**
 * Reference Track Panel
 * Compare your mix to a reference audio track
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
  Slider,
  IconButton,
  Paper,
  Chip,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  CompareArrows,
  PlayArrow,
  Pause,
  VolumeUp,
  Sync
} from '@mui/icons-material';

interface ReferenceTrackPanelProps {
  open: boolean;
  onClose: () => void;
  mixAudioUrl: string;
  onReferenceSelected: (referenceUrl: string) => void;
}

interface ComparisonMetrics {
  lufsMatch: number;
  spectralSimilarity: number;
  dynamicRangeMatch: number;
  recommendations: string[];
}

const ReferenceTrackPanel: React.FC<ReferenceTrackPanelProps> = ({
  open,
  onClose,
  mixAudioUrl,
  onReferenceSelected
}) => {
  const [referenceUrl, setReferenceUrl] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<'mix' | 'reference'>('mix');
  const [mixVolume, setMixVolume] = useState(100);
  const [refVolume, setRefVolume] = useState(100);
  const [levelMatch, setLevelMatch] = useState(true);
  const [metrics, setMetrics] = useState<ComparisonMetrics | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const mixAudioRef = useRef<HTMLAudioElement>(null);
  const refAudioRef = useRef<HTMLAudioElement>(null);

  // Sync playback position
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (currentTrack === 'mix' && mixAudioRef.current) {
        setCurrentTime(mixAudioRef.current.currentTime);
      } else if (currentTrack === 'reference' && refAudioRef.current) {
        setCurrentTime(refAudioRef.current.currentTime);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Upload file
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload/audio', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        setReferenceUrl(data.url);
        onReferenceSelected(data.url);
        
        // Analyze comparison
        analyzeComparison(mixAudioUrl, data.url);
      }
    } catch (error) {
      console.error('Failed to upload reference: ', error);
    }
  };

  const analyzeComparison = async (mixUrl: string, refUrl: string) => {
    try {
      const response = await fetch('/api/audio/compare-reference', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ mixUrl, referenceUrl: refUrl })
      });

      const data = await response.json();

      if (data.success) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Failed to analyze comparison:', error);
    }
  };

  const togglePlayback = () => {
    const audio = currentTrack === 'mix' ? mixAudioRef.current : refAudioRef.current;
    
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }

    setIsPlaying(!isPlaying);
  };

  const switchTrack = () => {
    // Pause current
    if (mixAudioRef.current) mixAudioRef.current.pause();
    if (refAudioRef.current) refAudioRef.current.pause();

    // Switch
    const newTrack = currentTrack === 'mix' ? 'reference' : 'mix';
    setCurrentTrack(newTrack);

    // Sync time and play
    const audio = newTrack === 'mix' ? mixAudioRef.current : refAudioRef.current;
    if (audio) {
      audio.currentTime = currentTime;
      if (isPlaying) {
        audio.play();
      }
    }
  };

  const handleLevelMatch = async () => {
    if (!referenceUrl) return;

    try {
      const response = await fetch('/api/audio/match-levels', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mixUrl: mixAudioUrl,
          referenceUrl
        })
      });

      const data = await response.json();

      if (data.success) {
        // Adjust volumes to match
        setMixVolume(data.mixVolume);
        setRefVolume(data.refVolume);
      }
    } catch (error) {
      console.error('Failed to match levels:', error);
    }
  };

  useEffect(() => {
    if (levelMatch && referenceUrl) {
      handleLevelMatch();
    }
  }, [levelMatch, referenceUrl]);

  useEffect(() => {
    if (mixAudioRef.current) {
      mixAudioRef.current.volume = mixVolume / 100;
    }
    if (refAudioRef.current) {
      refAudioRef.current.volume = refVolume / 100;
    }
  }, [mixVolume, refVolume]);

  const getMetricColor = (value: number) => {
    if (value >= 0.8) return 'success';
    if (value >= 0.6) return 'warning';
    return 'error';
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CompareArrows />
          <Typography variant="h6">Referansespor</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* File Upload */}
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            Last opp et referansespor for å sammenligne med miksen din
          </Typography>
          <Button
            variant="outlined"
            component="label"
            fullWidth
            sx={{ mt: 1 }}
          >
            Velg referansefil
            <input
              type="file"
              hidden
              accept="audio/*"
              onChange={handleFileSelect}
            />
          </Button>
          {referenceUrl && (
            <Chip
              label="Referanse lastet"
              color="success"
              size="small"
              sx={{ mt: 1 }}
            />
          )}
        </Paper>

        {/* Playback Controls */}
        {referenceUrl && (
          <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
              <Chip
                label={currentTrack === 'mix' ? 'Spiller: Din miks' : 'Spiller: Referanse'}
                color="primary"
              />
              <Box display="flex" gap={1}>
                <IconButton onClick={togglePlayback} color="primary">
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
                <IconButton onClick={switchTrack} color="secondary">
                  <CompareArrows />
                </IconButton>
              </Box>
            </Box>

            {/* Volume Controls */}
            <Box mb={2}>
              <Typography variant="caption" gutterBottom>
                Miks-volum: {mixVolume}%
              </Typography>
              <Slider
                value={mixVolume}
                onChange={(_, value) => setMixVolume(value as number)}
                min={0}
                max={100}
                disabled={levelMatch}
              />
            </Box>

            <Box mb={2}>
              <Typography variant="caption" gutterBottom>
                Referanse-volum: {refVolume}%
              </Typography>
              <Slider
                value={refVolume}
                onChange={(_, value) => setRefVolume(value as number)}
                min={0}
                max={100}
                disabled={levelMatch}
              />
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={levelMatch}
                  onChange={(e) => setLevelMatch(e.target.checked)}
                />
              }
              label="Automatisk nivåtilpasning"
            />
          </Paper>
        )}

        {/* Comparison Metrics */}
        {metrics && (
          <Paper elevation={2} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Sammenligningsanalyse
            </Typography>

            <Box display="flex" gap={1} mb={2} flexWrap="wrap">
              <Chip
                icon={<VolumeUp />}
                label={`LUFS-match: ${(metrics.lufsMatch * 100).toFixed(0)}%`}
                color={getMetricColor(metrics.lufsMatch)}
              />
              <Chip
                label={`Spektral likhet: ${(metrics.spectralSimilarity * 100).toFixed(0)}%`}
                color={getMetricColor(metrics.spectralSimilarity)}
              />
              <Chip
                label={`Dynamikk-match: ${(metrics.dynamicRangeMatch * 100).toFixed(0)}%`}
                color={getMetricColor(metrics.dynamicRangeMatch)}
              />
            </Box>

            {metrics.recommendations.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Anbefalinger:
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {metrics.recommendations.map((rec, index) => (
                    <li key={index}>
                      <Typography variant="body2">{rec}</Typography>
                    </li>
                  ))}
                </ul>
              </Box>
            )}
          </Paper>
        )}

        {/* Hidden Audio Elements */}
        <audio
          ref={mixAudioRef}
          src={mixAudioUrl}
          style={{ display: 'none' }}
          onEnded={() => setIsPlaying(false)}
        />
        {referenceUrl && (
          <audio
            ref={refAudioRef}
            src={referenceUrl}
            style={{ display:'none' }}
            onEnded={() => setIsPlaying(false)}
          />
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Lukk</Button>
        {referenceUrl && (
          <Button
            variant="contained"
            startIcon={<Sync />}
            onClick={handleLevelMatch}
          >
            Tilpass nivåer
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ReferenceTrackPanel;

