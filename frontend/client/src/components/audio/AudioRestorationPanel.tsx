/**
 * Audio Restoration Panel
 * UI for removing clicks, pops, hum, and noise from audio files
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControlLabel,
  Switch,
  Slider,
  Typography,
  Box,
  LinearProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip
} from '@mui/material';
import {
  AutoFixHigh,
  GraphicEq,
  CleaningServices,
  VolumeOff
} from '@mui/icons-material';

interface AudioRestorationPanelProps {
  open: boolean;
  onClose: () => void;
  audioUrl: string;
  onRestoreComplete: (restoredUrl: string, metrics: any) => void;
}

interface RestorationOptions {
  removeClicks: boolean;
  removeHum: boolean;
  humFreq: number;
  removeNoise: boolean;
  noiseGate: boolean;
  gateThreshold: number;
}

const AudioRestorationPanel: React.FC<AudioRestorationPanelProps> = ({
  open,
  onClose,
  audioUrl,
  onRestoreComplete
}) => {
  const [options, setOptions] = useState<RestorationOptions>({
    removeClicks: true,
    removeHum: true,
    humFreq: 50,
    removeNoise: true,
    noiseGate: true,
    gateThreshold: -40
  });

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const handleRestore = async () => {
    setProcessing(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const response = await fetch('/api/audio-restoration/restore', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          audioUrl,
          options
        })
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Restoration failed');
      }

      setResult(data);
      onRestoreComplete(data.restoredAudioUrl, data);

    } catch (err: any) {
      setError(err.message || 'Restoration failed');
    } finally {
      setProcessing(false);
    }
  };

  const handlePresetChange = (presetId: string) => {
    const presets: Record<string, RestorationOptions> = {
      gentle: {
        removeClicks: true,
        removeHum: true,
        humFreq: 50,
        removeNoise: true,
        noiseGate: false,
        gateThreshold: -50
      },
      moderate: {
        removeClicks: true,
        removeHum: true,
        humFreq: 50,
        removeNoise: true,
        noiseGate: true,
        gateThreshold: -40
      },
      aggressive: {
        removeClicks: true,
        removeHum: true,
        humFreq: 50,
        removeNoise: true,
        noiseGate: true,
        gateThreshold: -30
      }
    };

    if (presets[presetId]) {
      setOptions(presets[presetId]);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <AutoFixHigh />
          <Typography variant="h6">Lydrestaurering</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Preset Selection */}
        <FormControl fullWidth sx={{ mb: 3 }}>
          <InputLabel>Forhåndsinnstilling</InputLabel>
          <Select
            value=""
            onChange={(e) => handlePresetChange(e.target.value)}
            label="Forhåndsinnstilling"
          >
            <MenuItem value="gentle">Forsiktig - Bevarer lydkvalitet</MenuItem>
            <MenuItem value="moderate">Moderat - Balansert</MenuItem>
            <MenuItem value="aggressive">Aggressiv - Maksimal støyreduksjon</MenuItem>
          </Select>
        </FormControl>

        {/* Click/Pop Removal */}
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={options.removeClicks}
                onChange={(e) => setOptions({ ...options, removeClicks: e.target.checked })}
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <CleaningServices fontSize="small" />
                <Typography>Fjern klikk og popp</Typography>
              </Box>
            }
          />
        </Box>

        {/* Hum Removal */}
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={options.removeHum}
                onChange={(e) => setOptions({ ...options, removeHum: e.target.checked })}
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <GraphicEq fontSize="small" />
                <Typography>Fjern elektrisk summing</Typography>
              </Box>
            }
          />
          {options.removeHum && (
            <Box sx={{ ml: 4, mt: 1 }}>
              <FormControl size="small">
                <InputLabel>Frekvens</InputLabel>
                <Select
                  value={options.humFreq}
                  onChange={(e) => setOptions({ ...options, humFreq: Number(e.target.value) })}
                  label="Frekvens"
                >
                  <MenuItem value={50}>50 Hz (Europa)</MenuItem>
                  <MenuItem value={60}>60 Hz (USA)</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}
        </Box>

        {/* Noise Reduction */}
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={options.removeNoise}
                onChange={(e) => setOptions({ ...options, removeNoise: e.target.checked })}
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                <VolumeOff fontSize="small" />
                <Typography>Støyreduksjon</Typography>
              </Box>
            }
          />
        </Box>

        {/* Noise Gate */}
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={options.noiseGate}
                onChange={(e) => setOptions({ ...options, noiseGate: e.target.checked })}
              />
            }
            label={<Typography>Støyport (Noise Gate)</Typography>}
          />
          {options.noiseGate && (
            <Box sx={{ ml: 4, mt: 1 }}>
              <Typography variant="caption" gutterBottom>
                Terskel: {options.gateThreshold} dB
              </Typography>
              <Slider
                value={options.gateThreshold}
                onChange={(_, value) => setOptions({ ...options, gateThreshold: value as number })}
                min={-60}
                max={-20}
                step={1}
                marks={[
                  { value: -60, label: '-60 dB' },
                  { value: -40, label: '-40 dB' },
                  { value: -20, label: '-20 dB' }
                ]}
              />
            </Box>
          )}
        </Box>

        {/* Progress */}
        {processing && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" gutterBottom>
              Behandler lyd...
            </Typography>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {/* Result */}
        {result && (
          <Alert severity="success" sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              <strong>Restaurering fullført!</strong>
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" sx={{ mt: 1 }}>
              <Chip
                label={`Støyreduksjon: ${result.noise_reduction_db?.toFixed(1)} dB`}
                size="small"
                color="primary"
              />
              <Chip
                label={`Varighet: ${result.duration_seconds?.toFixed(1)}s`}
                size="small"
              />
              <Chip
                label={`${result.channels} kanal(er)`}
                size="small"
              />
            </Box>
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          Avbryt
        </Button>
        <Button
          onClick={handleRestore}
          variant="contained"
          disabled={processing}
          startIcon={<AutoFixHigh />}
        >
          {processing ? 'Behandler...' : 'Restaurer lyd'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AudioRestorationPanel;

