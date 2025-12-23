/**
 * LUT Panel Component (Phase 9)
 * UI for loading and applying 3D LUTs (.cube format)
 */

import React, { useState, useRef } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('LUTPanel, ');
import {
  Box,
  Paper,
  Typography,
  Button,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  Alert,
  Stack,
  Chip,
} from '@mui/material';
import { Upload, Download, Clear, Palette } from '@mui/icons-material';
import { lutService } from '../../core/services/lutService';

export interface LUTPanelProps {
  enabled: boolean;
  intensity: number;
  onEnabledChange: (enabled: boolean) => void;
  onIntensityChange: (intensity: number) => void;
  onLUTLoaded?: (lut: any) => void;
}

export const LUTPanel: React.FC<LUTPanelProps> = ({
  enabled,
  intensity,
  onEnabledChange,
  onIntensityChange,
  onLUTLoaded,
}) => {
  const [currentLUT, setCurrentLUT] = useState<any>(null);
  const [lutName, setLutName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError('');
      const text = await file.text();
      const lut = lutService.parseCubeFile(text);
      
      setCurrentLUT(lut);
      setLutName(file.name);
      onLUTLoaded?.(lut);

      log.info(`LUT loaded: ${file.name}`, { size: lut.size, entries: lut.data.length });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load LUT';
      setError(errorMsg);
      log.error('LUT loading error: ', err);
    }
  };

  const handleExport = () => {
    if (!currentLUT) return;

    try {
      const cubeData = lutService.exportToCube(currentLUT, {
        title: lutName || 'Exported LUT',
        domain: [0, 1],
      });

      // Create download
      const blob = new Blob([cubeData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = lutName || 'exported.cube';
      a.click();
      URL.revokeObjectURL(url);

      log.info('LUT exported successfully');
    } catch (err) {
      log.error('LUT export error:', err);
    }
  };

  const handleClear = () => {
    setCurrentLUT(null);
    setLutName(', ');
    setError(', ');
    if (fileInputRef.current) {
      fileInputRef.current.value = ', ';
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 2, bgcolor: '#1e1e1e', border: '1px solid #333' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Palette sx={{ color: '#90caf9' }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600}}>
          3D LUT (.cube)
        </Typography>
        <Chip label="Phase 9" size="small" sx={{ ml: 'auto', bgcolor: '#2a2a2a' }} />
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Load and apply 3D LUTs for professional color grading
      </Typography>

      <Divider sx={{ my: 2, borderColor: '#333' }} />

      {/* Enable/Disable */}
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            disabled={!currentLUT}
          />
        }
        label="Enable LUT"
        sx={{ mb: 2 }}
      />

      {/* Current LUT Info */}
      {currentLUT && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="caption">
            <strong>Active LUT:</strong> {lutName}
            <br />
            <strong>Size:</strong> {currentLUT.size}³ grid ({currentLUT.data.length} entries)
          </Typography>
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Intensity Slider */}
      {currentLUT && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Intensity: {(intensity * 100).toFixed(0)}%
          </Typography>
          <Slider
            value={intensity}
            onChange={(_, value) => onIntensityChange(value as number)}
            min={0}
            max={1}
            step={0.01}
            disabled={!enabled}
            sx={{ color: '#90caf9' }}
          />
        </Box>
      )}

      {/* Actions */}
      <Stack direction="row" spacing={1}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".cube"
          style={{ display:'none' }}
          onChange={handleFileUpload}
        />
        <Button
          variant="contained"
          startIcon={<Upload />}
          onClick={() => fileInputRef.current?.click()}
          size="small"
        >
          Load .cube
        </Button>
        {currentLUT && (
          <>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExport}
              size="small"
            >
              Export
            </Button>
            <Button
              variant="outlined"
              startIcon={<Clear />}
              onClick={handleClear}
              size="small"
              color="error"
            >
              Clear
            </Button>
          </>
        )}
      </Stack>
    </Paper>
  );
};

