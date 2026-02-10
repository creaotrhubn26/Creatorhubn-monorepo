/**
 * TRANSFORM PANEL
 * Lightroom-style transform tools: Crop, Straighten, Lens Corrections
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Slider,
  Stack,
  Button,
  ButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Grid,
} from '@mui/material';
import {
  Crop,
  Straighten,
  Lens,
  RotateLeft,
  RotateRight,
  Flip,
  AspectRatio,
  Refresh,
  AutoFixHigh,
  CropFree,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export interface TransformSettings {
  // Crop
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
    aspectRatio?: string;
  };
  // Rotation
  rotation?: number; // -180 to 180 degrees
  // Straighten
  straighten?: number; // -45 to 45 degrees
  // Flip
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  // Lens Corrections
  lensCorrections?: {
    distortion?: number; // -100 to 100
    vertical?: number; // -100 to 100
    horizontal?: number; // -100 to 100
    rotate?: number; // -10 to 10 degrees
    scale?: number; // 50 to 150
    aspect?: number; // -100 to 100
  };
  // Perspective
  perspective?: {
    vertical?: number; // -100 to 100
    horizontal?: number; // -100 to 100
  };
}

interface TransformPanelProps {
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  onTransformChange?: (settings: TransformSettings) => void;
  initialSettings?: TransformSettings;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
}

const ASPECT_RATIOS = [
  { label: 'Original', value: 'original' },
  { label: '1:1', value: '1:1' },
  { label: '4:3', value: '4:3' },
  { label: '3:2', value: '3:2' },
  { label: '16:9', value: '16:9' },
  { label: '21:9', value: '21:9' },
  { label: '2:3', value: '2:3' },
  { label: '3:4', value: '3:4' },
  { label: '9:16', value: '9:16' },
  { label: 'Free', value: 'free' },
];

export default function TransformPanel({
  imageUrl,
  imageWidth = 800,
  imageHeight = 600,
  onTransformChange,
  initialSettings = {},
  profession = 'photographer',
}: TransformPanelProps) {
  const theming = useTheming(profession);
  const [settings, setSettings] = useState<TransformSettings>(initialSettings);
  const [activeTool, setActiveTool] = useState<'crop' | 'straighten' | 'lens' | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>('original');

  // Auto-straighten mutation
  const autoStraightenMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest<{ success: boolean; angle: number; confidence: number }>(
        '/api/enhanced-ai/auto-straighten',
        {
          method: 'POST',
          body: formData,
        }
      );
    },
    onSuccess: (data) => {
      if (data.success) {
        handleSettingChange('straighten', data.angle);
      }
    },
  });

  // Auto-crop mutation
  const autoCropMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiRequest<{ success: boolean; crop: { x: number; y: number; width: number; height: number }; score: number; reason: string }>(
        '/api/enhanced-ai/auto-crop',
        {
          method: 'POST',
          body: formData,
        }
      );
    },
    onSuccess: (data) => {
      if (data.success && data.crop) {
        handleSettingChange('crop,', { ...data.crop, aspectRatio: aspectRatio === 'original' ? undefined : aspectRatio });
      }
    },
  });

  const handleAutoStraighten = useCallback(async () => {
    if (!imageUrl) return;

    const formData = new FormData();
    formData.append('imageUrl,', imageUrl);
    autoStraightenMutation.mutate(formData);
  }, [imageUrl, autoStraightenMutation]);

  const handleAutoCrop = useCallback(async () => {
    if (!imageUrl) return;

    const formData = new FormData();
    formData.append('imageUrl', imageUrl);
    formData.append('aspectRatio', aspectRatio === 'original' ? 'free' : aspectRatio);
    formData.append('composition','rule-of-thirds');
    formData.append('preserveFaces', 'true');
    autoCropMutation.mutate(formData);
  }, [imageUrl, aspectRatio, autoCropMutation]);

  const handleSettingChange = useCallback(
    (key: keyof TransformSettings, value: any) => {
      setSettings((prev) => {
        const updated = { ...prev, [key]: value };
        onTransformChange?.(updated);
        return updated;
      });
    },
    [onTransformChange]
  );

  const handleNestedSettingChange = useCallback(
    (parentKey: keyof TransformSettings, childKey: string, value: any) => {
      setSettings((prev) => {
        const updated = {
          ...prev,
          [parentKey]: {
            ...(prev[parentKey] as any),
            [childKey]: value,
          },
        };
        onTransformChange?.(updated);
        return updated;
      });
    },
    [onTransformChange]
  );

  const handleReset = useCallback(() => {
    const reset: TransformSettings = {};
    setSettings(reset);
    setAspectRatio('original');
    onTransformChange?.(reset);
  }, [onTransformChange]);

  return (
    <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Transform
          </Typography>
          <Tooltip title="Reset All">
            <IconButton size="small" onClick={handleReset}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Tool Selection */}
        <ButtonGroup fullWidth variant="outlined" size="small">
          <Tooltip title="Crop">
            <Button
              startIcon={<Crop />}
              onClick={() => setActiveTool(activeTool === 'crop' ? null : 'crop')}
              variant={activeTool === 'crop' ? 'contained' : 'outlined'}
            >
              Crop
            </Button>
          </Tooltip>
          <Tooltip title="Straighten">
            <Button
              startIcon={<Straighten />}
              onClick={() => setActiveTool(activeTool === 'straighten' ? null : 'straighten')}
              variant={activeTool === 'straighten' ? 'contained' : 'outlined'}
            >
              Straighten
            </Button>
          </Tooltip>
          <Tooltip title="Lens Corrections">
            <Button
              startIcon={<Lens />}
              onClick={() => setActiveTool(activeTool === 'lens' ? null : 'lens')}
              variant={activeTool === 'lens' ? 'contained' : 'outlined'}
            >
              Lens
            </Button>
          </Tooltip>
        </ButtonGroup>

        {/* Auto Tools */}
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<AutoFixHigh />}
            onClick={handleAutoStraighten}
            disabled={!imageUrl}
            fullWidth
          >
            Auto Straighten
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CropFree />}
            onClick={handleAutoCrop}
            disabled={!imageUrl}
            fullWidth
          >
            Auto Crop
          </Button>
        </Stack>

        {/* Crop Settings */}
        {(activeTool === 'crop' || settings.crop) && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Crop
            </Typography>
            <Stack spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Aspect Ratio</InputLabel>
                <Select
                  value={aspectRatio}
                  label="Aspect Ratio"
                  onChange={(e) => {
                    setAspectRatio(e.target.value);
                    handleSettingChange('crop', {
                      ...settings.crop,
                      aspectRatio: e.target.value === 'original' ? undefined : e.target.value,
                    });
                  }}
                >
                  {ASPECT_RATIOS.map((ratio) => (
                    <MenuItem key={ratio.value} value={ratio.value}>
                      {ratio.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="body2" gutterBottom>
                    X: {settings.crop?.x?.toFixed(0) || 0}
                  </Typography>
                  <Slider
                    value={settings.crop?.x || 0}
                    onChange={(_, v) =>
                      handleSettingChange('crop', {
                        ...settings.crop,
                        x: v as number,
                      })
                    }
                    min={0}
                    max={imageWidth}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" gutterBottom>
                    Y: {settings.crop?.y?.toFixed(0) || 0}
                  </Typography>
                  <Slider
                    value={settings.crop?.y || 0}
                    onChange={(_, v) =>
                      handleSettingChange('crop', {
                        ...settings.crop,
                        y: v as number,
                      })
                    }
                    min={0}
                    max={imageHeight}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" gutterBottom>
                    Width: {settings.crop?.width?.toFixed(0) || imageWidth}
                  </Typography>
                  <Slider
                    value={settings.crop?.width || imageWidth}
                    onChange={(_, v) =>
                      handleSettingChange('crop', {
                        ...settings.crop,
                        width: v as number,
                      })
                    }
                    min={0}
                    max={imageWidth}
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2" gutterBottom>
                    Height: {settings.crop?.height?.toFixed(0) || imageHeight}
                  </Typography>
                  <Slider
                    value={settings.crop?.height || imageHeight}
                    onChange={(_, v) =>
                      handleSettingChange('crop', {
                        ...settings.crop,
                        height: v as number,
                      })
                    }
                    min={0}
                    max={imageHeight}
                    size="small"
                  />
                </Grid>
              </Grid>
            </Stack>
          </Box>
        )}

        {/* Rotation & Straighten */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Rotation & Straighten
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Rotation</Typography>
                <Typography variant="body2" color="text.secondary">
                  {settings.rotation?.toFixed(1) || 0}°
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Tooltip title="Rotate Left">
                  <IconButton
                    size="small"
                    onClick={() =>
                      handleSettingChange('rotation', (settings.rotation || 0) - 90)
                    }
                  >
                    <RotateLeft />
                  </IconButton>
                </Tooltip>
                <Slider
                  value={settings.rotation || 0}
                  onChange={(_, v) => handleSettingChange('rotation', v as number)}
                  min={-180}
                  max={180}
                  sx={{ flex: 1 }}
                />
                <Tooltip title="Rotate Right">
                  <IconButton
                    size="small"
                    onClick={() =>
                      handleSettingChange('rotation', (settings.rotation || 0) + 90)
                    }
                  >
                    <RotateRight />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Straighten</Typography>
                <Typography variant="body2" color="text.secondary">
                  {settings.straighten?.toFixed(1) || 0}°
                </Typography>
              </Box>
              <Slider
                value={settings.straighten || 0}
                onChange={(_, v) => handleSettingChange('straighten', v as number)}
                min={-45}
                max={45}
              />
            </Box>
          </Stack>
        </Box>

        {/* Flip */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Flip
          </Typography>
          <Stack direction="row" spacing={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.flipHorizontal || false}
                  onChange={(e) => handleSettingChange('flipHorizontal', e.target.checked)}
                />
              }
              label="Horizontal"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.flipVertical || false}
                  onChange={(e) => handleSettingChange('flipVertical', e.target.checked)}
                />
              }
              label="Vertical"
            />
          </Stack>
        </Box>

        {/* Lens Corrections */}
        {(activeTool === 'lens' || settings.lensCorrections) && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Lens Corrections
            </Typography>
            <Stack spacing={2}>
              {[
                { key: 'distortion', label: 'Distortion', min: -100, max: 100 },
                { key: 'vertical', label: 'Vertical', min: -100, max: 100 },
                { key: 'horizontal', label: 'Horizontal', min: -100, max: 100 },
                { key: 'rotate', label: 'Rotate', min: -10, max: 10 },
                { key: 'scale', label: 'Scale', min: 50, max: 150 },
                { key: 'aspect', label: 'Aspect', min: -100, max: 100 },
              ].map((adj) => {
                const value =
                  (settings.lensCorrections?.[adj.key as keyof typeof settings.lensCorrections] as number) || 0;
                return (
                  <Box key={adj.key}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{adj.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {value > 0 ? '+' : ','}{value.toFixed(1)}
                        {adj.key === 'rotate' ? '°' : adj.key === 'scale' ? '%' : ','}
                      </Typography>
                    </Box>
                    <Slider
                      value={value}
                      onChange={(_, v) =>
                        handleNestedSettingChange('lensCorrections', adj.key, v)
                      }
                      min={adj.min}
                      max={adj.max}
                      size="small"
                    />
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* Perspective */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Perspective
          </Typography>
          <Stack spacing={2}>
            {[
              { key: 'vertical', label: 'Vertical', min: -100, max: 100 },
              { key: 'horizontal', label: 'Horizontal', min: -100, max: 100 },
            ].map((adj) => {
              const value = (settings.perspective?.[adj.key as keyof typeof settings.perspective] as number) || 0;
              return (
                <Box key={adj.key}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{adj.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {value > 0 ? '+' : ', '}{value.toFixed(1)}
                    </Typography>
                  </Box>
                  <Slider
                    value={value}
                    onChange={(_, v) => handleNestedSettingChange('perspective', adj.key, v)}
                    min={adj.min}
                    max={adj.max}
                    size="small"
                  />
                </Box>
              );
            })}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

