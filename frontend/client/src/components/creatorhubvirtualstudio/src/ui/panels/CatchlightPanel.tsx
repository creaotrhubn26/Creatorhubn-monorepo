/**
 * Catchlight Panel
 * 
 * UI for visualizing and adjusting catchlights in portrait photography.
 * Shows how lights will reflect in subject, 's eyes.
 * 
 * Features:
 * - Live catchlight preview
 * - Eye color selection
 * - Gaze direction control
 * - Light position indicators
 * - Catchlight shape analysis
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Chip,
  Switch,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  RemoveRedEye,
  Visibility,
  VisibilityOff,
  Lightbulb,
  CameraAlt,
  Person,
  Refresh,
  Info,
  Crop169,
  RadioButtonUnchecked,
  CropPortrait,
} from '@mui/icons-material';
import { useNodes, useStudioGuideSettings } from '../../state/selectors';
import { EYE_COLORS, LightSourceData, useLightSourcesFromNodes, getModifierShape, cctToColor } from '../components/EyeSystem';

interface CatchlightPanelProps {
  onSettingsChange?: (settings: CatchlightSettings) => void;
}

export interface CatchlightSettings {
  enabled: boolean;
  showEyes: boolean;
  eyeColor: string;
  gazeMode: 'camera' | 'custom' | 'light';
  customGazeTarget: [number, number, number];
  pupilDilation: number;
  showCatchlightGuides: boolean;
  catchlightShape: 'natural' | 'round' | 'rectangular';
}

const DEFAULT_SETTINGS: CatchlightSettings = {
  enabled: true,
  showEyes: true,
  eyeColor: EYE_COLORS.brown,
  gazeMode: 'camera',
  customGazeTarget: [0, 1.6, 5],
  pupilDilation: 0.5,
  showCatchlightGuides: true,
  catchlightShape: 'natural',
};

// Common eye color presets
const EYE_COLOR_PRESETS = [
  { name: 'Brown', value: EYE_COLORS.brown, common: 'Most common worldwide' },
  { name: 'Blue', value: EYE_COLORS.blue, common: 'Common in Northern Europe' },
  { name: 'Green', value: EYE_COLORS.green, common: 'Rarest natural color' },
  { name: 'Hazel', value: EYE_COLORS.hazel, common: 'Mix of brown and green' },
  { name: 'Gray', value: EYE_COLORS.gray, common: 'Rare, often changes appearance' },
  { name: 'Amber', value: EYE_COLORS.amber, common: 'Golden/copper tones' },
];

// Catchlight shape descriptions
const CATCHLIGHT_SHAPES = {
  natural: {
    label: 'Natural',
    description: 'Shows actual light source shape (softbox, umbrella, etc.)',
  },
  round: {
    label: 'Round',
    description: 'Circular catchlight (beauty dish, bare bulb)',
  },
  rectangular: {
    label: 'Rectangular',
    description: 'Window-like catchlight (softbox, natural light)',
  },
};

export const CatchlightPanel: React.FC<CatchlightPanelProps> = ({ onSettingsChange }) => {
  const [settings, setSettings] = useState<CatchlightSettings>(DEFAULT_SETTINGS);
  const nodes = useNodes();
  const guideSettings = useStudioGuideSettings();

  // Get light sources from scene with full data
  const lightSources = useLightSourcesFromNodes(nodes);

  // Get light nodes from scene (legacy)
  const lightNodes = useMemo(() => {
    return nodes.filter((n) => n.type === 'light' || n.light);
  }, [nodes]);

  // Update settings
  const updateSettings = useCallback(<K extends keyof CatchlightSettings>(
    key: K,
    value: CatchlightSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
  }, [settings, onSettingsChange]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    onSettingsChange?.(DEFAULT_SETTINGS);
  }, [onSettingsChange]);

  return (
    <Paper elevation={3} sx={{ p: 2, bgcolor: '#1a1a1a', color: '#fff' }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <RemoveRedEye color="primary" />
          <Typography variant="h6">Catchlight Preview</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Reset to defaults">
            <IconButton size="small" onClick={handleReset}>
              <Refresh />
            </IconButton>
          </Tooltip>
          <FormControlLabel
            control={
              <Switch
                checked={settings.enabled}
                onChange={(e) => updateSettings('enabled, ', e.target.checked)}
              />
            }
            label={settings.enabled ? 'On' : 'Off'}
            labelPlacement="start"
          />
        </Stack>
      </Stack>

      {!settings.enabled ? (
        <Alert severity="info">
          Enable catchlight preview to see how lights will reflect in your subject's eyes.
          This helps create professional portrait lighting.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {/* Eye Color Selection */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Eye Color
            </Typography>
            <Grid container spacing={1}>
              {EYE_COLOR_PRESETS.map((color) => (
                <Grid item xs={4} key={color.name}>
                  <Tooltip title={color.common}>
                    <Card
                      sx={{
                        bgcolor: settings.eyeColor === color.value ? 'primary.dark' : '#2a2a2a',
                        cursor: 'pointer', '&:hover': { bgcolor: settings.eyeColor === color.value ? 'primary.dark' : '#333' }}}
                      onClick={() => updateSettings('eyeColor,', color.value)}
                    >
                      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              bgcolor: color.value,
                              border: '2px solid #fff'}}
                          />
                          <Typography variant="caption">{color.name}</Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Divider />

          {/* Gaze Direction */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Gaze Direction
            </Typography>
            <ToggleButtonGroup
              value={settings.gazeMode}
              exclusive
              onChange={(_, v) => v && updateSettings('gazeMode', v)}
              size="small"
              fullWidth
            >
              <ToggleButton value="camera">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CameraAlt fontSize="small" />
                  <span>Camera</span>
                </Stack>
              </ToggleButton>
              <ToggleButton value="light">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Lightbulb fontSize="small" />
                  <span>Key Light</span>
                </Stack>
              </ToggleButton>
              <ToggleButton value="custom">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Person fontSize="small" />
                  <span>Custom</span>
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>

            {settings.gazeMode === 'custom' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Custom Gaze Target
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Box>
                    <Typography variant="caption">X (Left/Right): {settings.customGazeTarget[0].toFixed(1)}m</Typography>
                    <Slider
                      value={settings.customGazeTarget[0]}
                      onChange={(_, v) => updateSettings('customGazeTarget', [v as number, settings.customGazeTarget[1], settings.customGazeTarget[2]])}
                      min={-2}
                      max={2}
                      step={0.1}
                      size="small"
                    />
                  </Box>
                  <Box>
                    <Typography variant="caption">Y (Up/Down): {settings.customGazeTarget[1].toFixed(1)}m</Typography>
                    <Slider
                      value={settings.customGazeTarget[1]}
                      onChange={(_, v) => updateSettings('customGazeTarget', [settings.customGazeTarget[0], v as number, settings.customGazeTarget[2]])}
                      min={0.5}
                      max={2.5}
                      step={0.1}
                      size="small"
                    />
                  </Box>
                  <Box>
                    <Typography variant="caption">Z (Distance): {settings.customGazeTarget[2].toFixed(1)}m</Typography>
                    <Slider
                      value={settings.customGazeTarget[2]}
                      onChange={(_, v) => updateSettings('customGazeTarget', [settings.customGazeTarget[0], settings.customGazeTarget[1], v as number])}
                      min={1}
                      max={10}
                      step={0.1}
                      size="small"
                    />
                  </Box>
                </Stack>
              </Box>
            )}
          </Box>

          <Divider />

          {/* Pupil Dilation */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Pupil Dilation
            </Typography>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="caption" sx={{ minWidth: 60 }}>Constricted</Typography>
              <Slider
                value={settings.pupilDilation}
                onChange={(_, v) => updateSettings('pupilDilation', v as number)}
                min={0}
                max={1}
                step={0.1}
                sx={{ flex: 1 }}
              />
              <Typography variant="caption" sx={{ minWidth: 50 }}>Dilated</Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Pupils dilate in low light (larger catchlights visible) and constrict in bright light.
            </Typography>
          </Box>

          <Divider />

          {/* Light Sources with Catchlight Preview */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Light Sources & Catchlight Shapes ({lightSources.length})
            </Typography>
            {lightSources.length === 0 ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Add lights to the scene to see catchlight preview.
              </Alert>
            ) : (
              <Stack spacing={1.5}>
                {lightSources.slice(0, 6).map((light, i) => {
                  const { shape } = getModifierShape(light.modifier);
                  const lightColor = light.cct ? cctToColor(light.cct) : (light.color || '#ffffff');
                  
                  // Icon based on catchlight shape
                  const ShapeIcon = shape === 'rectangular' || shape === 'strip' 
                    ? Crop169 
                    : shape === 'ring' 
                    ? RadioButtonUnchecked 
                    : RadioButtonUnchecked;
                  
                  return (
                    <Card 
                      key={i} 
                      sx={{ 
                        bgcolor: light.enabled === false ? '#1a1a1a' : '#2a2a2a',
                        opacity: light.enabled === false ? 0.5 : 1}}
                    >
                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          {/* Light color indicator */}
                          <Box
                            sx={{
                              width: 8,
                              height: 32,
                              borderRadius: 1,
                              bgcolor: lightColor}}
                          />
                          
                          {/* Light info */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                              {light.name || `Light ${i + 1}`}
                            </Typography>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <Typography variant="caption" color="text.secondary">
                                {light.modifier || 'No modifier'}
                              </Typography>
                              {light.modifierSize && (
                                <Typography variant="caption" color="text.secondary">
                                  ({Math.round(light.modifierSize * 100)}cm)
                                </Typography>
                              )}
                            </Stack>
                          </Box>
                          
                          {/* Catchlight shape preview */}
                          <Tooltip title={`Catchlight: ${shape}`}>
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: '#1a1a1a',
                                borderRadius: 1,
                                border: '1px solid #444'}}
                            >
                              {shape === 'rectangular' && (
                                <Box sx={{ width: 18, height: 14, bgcolor: lightColor, borderRadius: 0.5 }} />
                              )}
                              {shape === 'strip' && (
                                <Box sx={{ width: 6, height: 20, bgcolor: lightColor, borderRadius: 0.5 }} />
                              )}
                              {shape === 'octagon' && (
                                <Box 
                                  sx={{ 
                                    width: 18, 
                                    height: 18, 
                                    bgcolor: lightColor, 
                                    borderRadius: '3px',
                                    transform: 'rotate(22.5deg)'}} 
                                />
                              )}
                              {shape === 'ring' && (
                                <Box 
                                  sx={{ 
                                    width: 18, 
                                    height: 18, 
                                    border: `3px solid ${lightColor}`,
                                    borderRadius: '50%'}} 
                                />
                              )}
                              {shape === 'round' && (
                                <Box 
                                  sx={{ 
                                    width: 16, 
                                    height: 16, 
                                    bgcolor: lightColor, 
                                    borderRadius: '50%'}} 
                                />
                              )}
                            </Box>
                          </Tooltip>
                          
                          {/* Power */}
                          <Chip 
                            label={`${Math.round((light.intensity || 0.5) * 100)}%`} 
                            size="small"
                            color={i === 0 ? 'primary' : 'default'}
                            sx={{ minWidth: 50 }}
                          />
                        </Stack>
                        
                        {/* CCT indicator */}
                        {light.cct && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {light.cct}K ({light.cct > 5500 ? 'Cool/Daylight' : light.cct > 4000 ? 'Neutral' : 'Warm/Tungsten'})
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {lightSources.length > 6 && (
                  <Typography variant="caption" color="text.secondary">
                    +{lightSources.length - 6} more lights
                  </Typography>
                )}
              </Stack>
            )}
          </Box>

          <Divider />

          {/* Additional Options */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showCatchlightGuides}
                  onChange={(e) => updateSettings('showCatchlightGuides', e.target.checked)}
                  size="small"
                />
              }
              label="Show light-to-eye guide lines"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showEyes}
                  onChange={(e) => updateSettings('showEyes', e.target.checked)}
                  size="small"
                />
              }
              label="Show 3D eye preview"
            />
          </Box>

          {/* Tips */}
          <Alert severity="info" icon={<Info />}>
            <Typography variant="body2">
              <strong>Portrait Lighting Tips:</strong>
            </Typography>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li>Position key light at 45 degrees for classic catchlight</li>
              <li>Larger light sources create softer, more flattering catchlights</li>
              <li>Two catchlights (key + fill) add depth to eyes</li>
              <li>Catchlight position reveals light direction to viewers</li>
            </ul>
          </Alert>
        </Stack>
      )}
    </Paper>
  );
};

export default CatchlightPanel;

