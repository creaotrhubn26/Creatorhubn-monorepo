/**
 * Studio Guides Panel
 * 
 * Control panel to toggle and configure visual guides:
 * - Distance indicators
 * - Angle guides
 * - Position markers
 * - Grid overlay
 * - Preset configurations for different shoot types
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Stack,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Straighten,
  GridOn,
  Visibility,
  VisibilityOff,
  Face,
  Groups,
  CameraAlt,
  Lightbulb,
  ExpandMore,
  Refresh,
  Info,
  School,
  Portrait,
  Fullscreen,
} from '@mui/icons-material';

export interface GuideSettings {
  showDistanceGuides: boolean;
  showAngleGuides: boolean;
  showPositionMarkers: boolean;
  showGridOverlay: boolean;
  subjectPosition: [number, number, number];
  backgroundDistance: number;
  keyLightDistance: number;
  keyLightAngle: number;
  keyLightHeight: number;
  fillDistance: number;
  cameraDistance: number;
  shootType: 'headshot' | 'full_body' | 'small_group' | 'class_photo' | 'custom';
}

interface StudioGuidesPanelProps {
  settings: GuideSettings;
  onSettingsChange: (settings: GuideSettings) => void;
}

// Preset configurations based on shoot type
const SHOOT_PRESETS: Record<string, Partial<GuideSettings>> = {
  headshot: {
    backgroundDistance: 2.5,
    keyLightDistance: 1.5,
    keyLightAngle: 45,
    keyLightHeight: 2.0,
    fillDistance: 1.0,
    cameraDistance: 3,
  },
  full_body: {
    backgroundDistance: 3.5,
    keyLightDistance: 2.5,
    keyLightAngle: 45,
    keyLightHeight: 2.5,
    fillDistance: 2.0,
    cameraDistance: 4,
  },
  small_group: {
    backgroundDistance: 4,
    keyLightDistance: 3.5,
    keyLightAngle: 45,
    keyLightHeight: 2.5,
    fillDistance: 3,
    cameraDistance: 5,
  },
  class_photo: {
    backgroundDistance: 5,
    keyLightDistance: 5,
    keyLightAngle: 45,
    keyLightHeight: 3,
    fillDistance: 5,
    cameraDistance: 8,
  },
};

// Recommended ranges for each setting
const RECOMMENDED_RANGES = {
  backgroundDistance: { min: 1.5, max: 6, recommended: [2, 4] },
  keyLightDistance: { min: 1, max: 6, recommended: [1.5, 2.5] },
  keyLightAngle: { min: 0, max: 90, recommended: [30, 45] },
  keyLightHeight: { min: 1, max: 3.5, recommended: [1.8, 2.5] },
  fillDistance: { min: 0.5, max: 4, recommended: [0.8, 2] },
  cameraDistance: { min: 2, max: 10, recommended: [3, 5] },
};

export const StudioGuidesPanel: React.FC<StudioGuidesPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  const [allGuidesVisible, setAllGuidesVisible] = useState(true);

  const updateSetting = useCallback(<K extends keyof GuideSettings>(
    key: K,
    value: GuideSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  }, [settings, onSettingsChange]);

  const applyPreset = useCallback((presetName: string) => {
    const preset = SHOOT_PRESETS[presetName];
    if (preset) {
      onSettingsChange({
        ...settings,
        ...preset,
        shootType: presetName as GuideSettings['shootType'],
      });
    }
  }, [settings, onSettingsChange]);

  const toggleAllGuides = useCallback(() => {
    const newValue = !allGuidesVisible;
    setAllGuidesVisible(newValue);
    onSettingsChange({
      ...settings,
      showDistanceGuides: newValue,
      showAngleGuides: newValue,
      showPositionMarkers: newValue,
      showGridOverlay: newValue,
    });
  }, [allGuidesVisible, settings, onSettingsChange]);

  const isInRecommendedRange = (value: number, key: keyof typeof RECOMMENDED_RANGES) => {
    const range = RECOMMENDED_RANGES[key];
    if (!range || !range.recommended || !Array.isArray(range.recommended)) {
      return false;
    }
    return value >= range.recommended[0] && value <= range.recommended[1];
  };

  // Dispatch settings to 3D scene
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('vs-guide-settings-changed', {
      detail: settings,
    }));
  }, [settings]);

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Straighten /> Studio Guides
        </Typography>
        <Tooltip title={allGuidesVisible ? 'Hide All Guides' : 'Show All Guides'}>
          <IconButton onClick={toggleAllGuides} color={allGuidesVisible ? 'primary' : 'default'}>
            {allGuidesVisible ? <Visibility /> : <VisibilityOff />}
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Shoot Type Presets */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Quick Setup Presets
          </Typography>
          <Grid container spacing={1}>
            {[
              { id: 'headshot', label: 'Headshot', icon: <Face /> },
              { id: 'full_body', label: 'Full Body', icon: <Portrait /> },
              { id: 'small_group', label: 'Small Group', icon: <Groups /> },
              { id: 'class_photo', label: 'Class Photo', icon: <School /> },
            ].map((preset) => (
              <Grid item xs={6} key={preset.id}>
                <Button
                  variant={settings.shootType === preset.id ? 'contained' : 'outlined'}
                  fullWidth
                  size="small"
                  startIcon={preset.icon}
                  onClick={() => applyPreset(preset.id)}
                  sx={{ justifyContent: 'flex-start' }}
                >
                  {preset.label}
                </Button>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* Toggle Controls */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">
            <GridOn sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
            Guide Visibility
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showGridOverlay}
                  onChange={(e) => updateSetting('showGridOverlay,', e.target.checked)}
                  size="small"
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">Floor Grid</Typography>
                  <Chip label="Measurements" size="small" variant="outlined" />
                </Stack>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showDistanceGuides}
                  onChange={(e) => updateSetting('showDistanceGuides', e.target.checked)}
                  size="small"
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">Distance Indicators</Typography>
                  <Chip label="Meters" size="small" variant="outlined" />
                </Stack>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showAngleGuides}
                  onChange={(e) => updateSetting('showAngleGuides', e.target.checked)}
                  size="small"
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">Angle Guides</Typography>
                  <Chip label="Degrees" size="small" variant="outlined" />
                </Stack>
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showPositionMarkers}
                  onChange={(e) => updateSetting('showPositionMarkers', e.target.checked)}
                  size="small"
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">Position Markers</Typography>
                  <Chip label="Labels" size="small" variant="outlined" />
                </Stack>
              }
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Distance Settings */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">
            <Straighten sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
            Distances
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {/* Subject to Background */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Subject to Background</Typography>
                <Chip
                  label={`${settings.backgroundDistance.toFixed(1)}m`}
                  size="small"
                  color={isInRecommendedRange(settings.backgroundDistance, 'backgroundDistance') ? 'success' : 'default'}
                />
              </Stack>
              <Slider
                value={settings.backgroundDistance}
                onChange={(_, v) => updateSetting('backgroundDistance', v as number)}
                min={1}
                max={8}
                step={0.1}
                marks={[
                  { value: 2, label: '2m' },
                  { value: 4, label: '4m' },
                  { value: 6, label: '6m' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}m`}
              />
              <Typography variant="caption" color="text.secondary">
                Recommended: 2-4m for blur, min 1.5m to avoid shadows
              </Typography>
            </Box>

            {/* Key Light Distance */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Key Light to Subject</Typography>
                <Chip
                  label={`${settings.keyLightDistance.toFixed(1)}m`}
                  size="small"
                  color={isInRecommendedRange(settings.keyLightDistance, 'keyLightDistance') ? 'success' : 'default'}
                />
              </Stack>
              <Slider
                value={settings.keyLightDistance}
                onChange={(_, v) => updateSetting('keyLightDistance', v as number)}
                min={0.5}
                max={6}
                step={0.1}
                marks={[
                  { value: 1.5, label: '1.5m' },
                  { value: 2.5, label: '2.5m' },
                  { value: 4, label: '4m' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}m`}
              />
              <Typography variant="caption" color="text.secondary">
                Closer = softer light, farther = harder light
              </Typography>
            </Box>

            {/* Fill Distance */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Fill/Reflector Distance</Typography>
                <Chip
                  label={`${settings.fillDistance.toFixed(1)}m`}
                  size="small"
                  color={isInRecommendedRange(settings.fillDistance, 'fillDistance') ? 'success' : 'default'}
                />
              </Stack>
              <Slider
                value={settings.fillDistance}
                onChange={(_, v) => updateSetting('fillDistance', v as number)}
                min={0.3}
                max={4}
                step={0.1}
                marks={[
                  { value: 0.5, label: '0.5m' },
                  { value: 1.5, label: '1.5m' },
                  { value: 3, label: '3m' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}m`}
              />
              <Typography variant="caption" color="text.secondary">
                Reflector: 0.5-1m, Second light: 1.5-3m
              </Typography>
            </Box>

            {/* Camera Distance */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Camera to Subject</Typography>
                <Chip
                  label={`${settings.cameraDistance.toFixed(1)}m`}
                  size="small"
                  color={isInRecommendedRange(settings.cameraDistance, 'cameraDistance') ? 'success' : 'default'}
                />
              </Stack>
              <Slider
                value={settings.cameraDistance}
                onChange={(_, v) => updateSetting('cameraDistance', v as number)}
                min={1}
                max={12}
                step={0.1}
                marks={[
                  { value: 3, label: '3m' },
                  { value: 5, label: '5m' },
                  { value: 8, label: '8m' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}m`}
              />
              <Typography variant="caption" color="text.secondary">
                Headshot: 2-4m (85mm), Group: 6-10m (35mm)
              </Typography>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Light Angle Settings */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="subtitle2">
            <Lightbulb sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
            Light Angles
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            {/* Key Light Angle */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Key Light Angle (Horizontal)</Typography>
                <Chip
                  label={`${settings.keyLightAngle}`}
                  size="small"
                  color={isInRecommendedRange(settings.keyLightAngle, 'keyLightAngle') ? 'success' : 'default'}
                />
              </Stack>
              <Slider
                value={settings.keyLightAngle}
                onChange={(_, v) => updateSetting('keyLightAngle', v as number)}
                min={0}
                max={90}
                step={5}
                marks={[
                  { value: 0, label: 'Front' },
                  { value: 30, label: 'Loop' },
                  { value: 45, label: 'Remb.' },
                  { value: 90, label: 'Split' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}`}
              />
            </Box>

            {/* Key Light Height */}
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">Key Light Height</Typography>
                <Chip
                  label={`${settings.keyLightHeight.toFixed(1)}m`}
                  size="small"
                  color={isInRecommendedRange(settings.keyLightHeight, 'keyLightHeight') ? 'success' : 'default'}
                />
              </Stack>
              <Slider
                value={settings.keyLightHeight}
                onChange={(_, v) => updateSetting('keyLightHeight', v as number)}
                min={1}
                max={3.5}
                step={0.1}
                marks={[
                  { value: 1.6, label: 'Eye' },
                  { value: 2, label: '2m' },
                  { value: 2.5, label: '2.5m' },
                  { value: 3, label: '3m' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}m`}
              />
              <Typography variant="caption" color="text.secondary">
                Sweet spot: 15-45 above eye level
              </Typography>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Current Setup Summary */}
      <Card sx={{ mt: 2, bgcolor: 'action.hover' }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            <Info sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            Current Setup Summary
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Subject to BG</Typography>
              <Typography variant="body2" fontWeight={600}>{settings.backgroundDistance.toFixed(1)}m</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Key Light</Typography>
              <Typography variant="body2" fontWeight={600}>{settings.keyLightDistance.toFixed(1)}m @ {settings.keyLightAngle}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Fill/Reflector</Typography>
              <Typography variant="body2" fontWeight={600}>{settings.fillDistance.toFixed(1)}m</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption" color="text.secondary">Camera</Typography>
              <Typography variant="body2" fontWeight={600}>{settings.cameraDistance.toFixed(1)}m</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tips */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          <strong>Green indicators</strong> = Recommended range.
          Use presets as starting points, then fine-tune for your specific needs.
        </Typography>
      </Alert>
    </Box>
  );
};

export default StudioGuidesPanel;

