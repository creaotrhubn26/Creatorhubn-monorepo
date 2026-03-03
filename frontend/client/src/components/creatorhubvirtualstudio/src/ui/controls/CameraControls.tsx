/**
 * CameraControls - Professional Camera System UI
 *
 * Features: * - Exposure Triangle (Aperture, ISO, Shutter Speed)
 * - Focus Distance control
 * - Real-time EV calculation
 * - Visual feedback for exposure
 * - Presets for common scenarios
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  IconButton,
  Tooltip,
  Divider,
  Button,
  ButtonGroup,
} from '@mui/material';
import {
  CameraAlt as CameraIcon,
  Brightness6 as ExposureIcon,
  FilterCenterFocus as FocusIcon,
  Restore as ResetIcon,
  Bookmark as PresetIcon,
} from '@mui/icons-material';
import { useTabletSupport } from '../../providers/TabletSupportProvider';
import { TouchSlider, TouchIconButton } from '../components/TabletAwarePanels';
import { useAccessibility, useAnnounce } from '../../providers/AccessibilityProvider';
import { AccessibleSlider, AccessibleButton, AccessibleIconButton } from '../components/AccessibleComponents';
import { useVirtualStudio } from '../../../VirtualStudioContext';

export interface CameraSettings {
  aperture: number; // f-stop (f/1.4 f/2.8 etc.)
  iso: number; // ISO value (100-25600),
  shutter: number; // Shutter speed in seconds (1/8000 to 30),
  focusDistance: number; // Focus distance in meters
  focalLength: number; // Focal length in mm
}

interface CameraControlsProps {
  settings: CameraSettings;
  onChange: (settings: CameraSettings) => void;
  onReset?: () => void;
}

// Common aperture values (f-stops)
const APERTURE_STOPS = [1.4, 2.0, 2.8, 4.0, 5.6, 8.0, 11, 16, 22];

// Common ISO values
const ISO_VALUES = [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600];

// Shutter speed presets (in seconds)
const SHUTTER_SPEEDS = [
  { label: '1/8000', value: 1 / 8000 },
  { label: '1/4000', value: 1 / 4000 },
  { label: '1/2000', value: 1 / 2000 },
  { label: '1/1000', value: 1 / 1000 },
  { label: '1/500', value: 1 / 500 },
  { label: '1/250', value: 1 / 250 },
  { label: '1/125', value: 1 / 125 },
  { label: '1/60', value: 1 / 60 },
  { label: '1/30', value: 1 / 30 },
  { label: '1/15', value: 1 / 15 },
  { label: '1/8', value: 1 / 8 },
  { label: '1/4', value: 1 / 4 },
  { label: '1/2', value: 1 / 2 },
  { label: '1"', value: 1 },
  { label: '2"', value: 2 },
  { label: '4"', value: 4 },
  { label: '8"', value: 8 },
  { label: '15"', value: 15 },
  { label: '30"', value: 30 },
];

// Camera presets
const CAMERA_PRESETS = {
  portrait: {
    name: 'Portrait',
    aperture: 2.8,
    iso: 100,
    shutter: 1 / 125,
    description: 'Shallow depth of field',
  },
  landscape: {
    name: 'Landscape',
    aperture: 11,
    iso: 100,
    shutter: 1 / 60,
    description: 'Deep depth of field',
  },
  lowLight: {
    name: 'Low Light',
    aperture: 1.4,
    iso: 3200,
    shutter: 1 / 60,
    description: 'High ISO, wide aperture',
  },
  action: {
    name: 'Action/Motion',
    aperture: 5.6,
    iso: 800,
    shutter: 1 / 500,
    description: 'Fast shutter speed',
  },
  studio: {
    name: 'Studio Flash',
    aperture: 8.0,
    iso: 100,
    shutter: 1 / 125,
    description: 'Balanced for flash',
  },
};

/**
 * Calculate Exposure Value (EV)
 */
function calculateEV(aperture: number, shutter: number, iso: number): number {
  // EV = log2(N² / t) at ISO 100
  const ev100 = Math.log2((aperture * aperture) / shutter);
  // Adjust for ISO
  const evAdjusted = ev100 - Math.log2(iso / 100);
  return Math.round(evAdjusted * 10) / 10;
}

/**
 * Get EV description
 */
function getEVDescription(ev: number): { label: string; color: string } {
  if (ev < -2) return { label: 'Very Dark', color: '#1a1a2e' };
  if (ev < 0) return { label: 'Dark', color: '#16213e' };
  if (ev < 2) return { label: 'Dim', color: '#0f3460' };
  if (ev < 5) return { label: 'Indoor', color: '#533483' };
  if (ev < 8) return { label: 'Overcast', color: '#94b8b8' };
  if (ev < 11) return { label: 'Cloudy', color: '#b8d4d4' };
  if (ev < 14) return { label: 'Sunny', color: '#ffd700' };
  return { label: 'Very Bright', color: '#ffeb3b' };
}

/**
 * Calculate depth of field
 */
function calculateDoF(
  aperture: number,
  focusDistance: number,
  focalLength: number,
): { near: number; far: number; total: number } {
  const CoC = 0.03; // Circle of confusion for full frame (mm)
  const H = (focalLength * focalLength) / (aperture * CoC); // Hyperfocal distance (mm)

  const near = (H * focusDistance) / (H + (focusDistance * 1000 - focalLength));
  const far = (H * focusDistance) / (H - (focusDistance * 1000 - focalLength));

  return {
    near: Math.max(0, near / 1000),
    far: far > 0 ? far / 1000 : Infinity,
    total: far > 0 ? (far - near) / 1000 : Infinity,
  };
}

export function CameraControls({ settings, onChange, onReset }: CameraControlsProps) {
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  // Toast notifications
  const { addToast } = useVirtualStudio();

  // Accessibility
  const { announce } = useAnnounce();
  const { prefersKeyboard } = useAccessibility();

  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (key: keyof CameraSettings, value: number) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onChange(newSettings);
    
    // Announce change for screen readers
    const labels: Record<keyof CameraSettings, string> = {
      aperture: `Aperture: f/${value}`,
      iso: `ISO: ${value}`,
      shutter: `Shutter: ${value < 1 ? `1/${Math.round(1/value)}` : `${value} "`}`,
      focusDistance: `Focus, distance: ${value.toFixed(1)} meters`,
      focalLength: `Focal, length: ${value}mm`,
    };
    announce(labels[key]);
  };

  const applyPreset = (presetKey: keyof typeof CAMERA_PRESETS) => {
    const preset = CAMERA_PRESETS[presetKey];
    const newSettings = {
      ...localSettings,
      aperture: preset.aperture,
      iso: preset.iso,
      shutter: preset.shutter,
    };
    setLocalSettings(newSettings);
    onChange(newSettings);
    announce(`Applied ${preset.name} preset: ${preset.description}`);
    addToast({
      message: `Applied "${preset.name}, " preset`,
      type: 'success',
      duration: 2000,
    });
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
      announce('Camera settings reset to defaults');
      addToast({
        message: 'Camera settings reset',
        type: 'info',
        duration: 2000,
      });
    }
  };

  const ev = calculateEV(localSettings.aperture, localSettings.shutter, localSettings.iso);
  const evInfo = getEVDescription(ev);
  const dof = calculateDoF(
    localSettings.aperture,
    localSettings.focusDistance,
    localSettings.focalLength,
  );

  // Find closest shutter speed for display
  const closestShutter = SHUTTER_SPEEDS.reduce((prev, curr) =>
    Math.abs(curr.value - localSettings.shutter) < Math.abs(prev.value - localSettings.shutter)
      ? curr
      : prev,
  );

  return (
    <Card sx={{ maxWidth: 420 }}>
      <CardContent>
        <Stack spacing={3}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CameraIcon />
              <Typography variant={isTouch ? 'subtitle1' : 'h6'}>Camera Settings</Typography>
            </Box>
            <Tooltip title={isTouch ? '' : 'Reset to defaults'} enterDelay={isTouch ? 99999 : 300}>
              <TouchIconButton touchSize={isTouch ? 'medium' : 'small'} onClick={handleReset} disabled={!onReset}>
                <ResetIcon />
              </TouchIconButton>
            </Tooltip>
          </Box>

          {/* Exposure Value Display */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              bgcolor: evInfo.color,
              color: ev > 5 ? '#000' : '#fff',
              textAlign: 'center'}}
          >
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              EV {ev > 0 ? '+' : ','}
              {ev}
            </Typography>
            <Typography variant="body2">{evInfo.label}</Typography>
          </Box>

          {/* Presets */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              gutterBottom
              sx={{ display: 'block' }}
            >
              Quick Presets
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
              {Object.entries(CAMERA_PRESETS).map(([key, preset]) => (
                <Tooltip key={key} title={isTouch ? '' : preset.description} enterDelay={isTouch ? 99999 : 300}>
                  <Chip
                    icon={<PresetIcon />}
                    label={preset.name}
                    onClick={() => applyPreset(key as keyof typeof CAMERA_PRESETS)}
                    size={isTouch ? 'medium' : 'small'}
                    clickable
                    sx={{
                      minHeight: isTouch ? 40 : 32,
                      '& .MuiChip-label': {
                        fontSize: isTouch ? '0.875rem' : '0.8125rem',
                      }}}
                  />
                </Tooltip>
              ))}
            </Stack>
          </Box>

          <Divider />

          {/* Aperture Control */}
          <Box>
            {isTouch ? (
              <TouchSlider
                label="Aperture"
                value={APERTURE_STOPS.indexOf(localSettings.aperture)}
                onChange={(value) => handleChange('aperture', APERTURE_STOPS[value])}
                min={0}
                max={APERTURE_STOPS.length - 1}
                step={1}
                valueFormat={() => `f/${localSettings.aperture}`}
                touchSize="large"
                marks={APERTURE_STOPS.map((stop, idx) => ({
                  value: idx,
                  label: idx % 2 === 0 ? `f/${stop}` : '',
                }))}
              />
            ) : (
              <>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Aperture
                  </Typography>
                  <Chip label={`f/${localSettings.aperture}`} size="small" color="primary" />
                </Box>
                <Slider
                  value={APERTURE_STOPS.indexOf(localSettings.aperture)}
                  onChange={(_, value) => handleChange('aperture', APERTURE_STOPS[value as number])}
                  min={0}
                  max={APERTURE_STOPS.length - 1}
                  step={1}
                  marks={APERTURE_STOPS.map((stop, idx) => ({
                    value: idx,
                    label: idx % 2 === 0 ? `f/${stop}` : ', ',
                  }))}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `f/${APERTURE_STOPS[value]}`}
                />
              </>
            )}
            <Typography variant="caption" color="text.secondary">
              Smaller number = Shallower depth of field (blurry background)
            </Typography>
          </Box>

          {/* ISO Control */}
          <Box>
            {isTouch ? (
              <TouchSlider
                label="ISO"
                value={Math.log2(localSettings.iso / 100)}
                onChange={(value) => handleChange('iso', 100 * Math.pow(2, value))}
                min={0}
                max={8}
                step={1}
                valueFormat={() => String(localSettings.iso)}
                touchSize="large"
                marks={[
                  { value: 0, label: '100' },
                  { value: 2, label: '400' },
                  { value: 4, label: '1600' },
                  { value: 6, label: '6400' },
                  { value: 8, label: '25600' },
                ]}
              />
            ) : (
              <>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    ISO
                  </Typography>
                  <Chip label={localSettings.iso} size="small" color="secondary" />
                </Box>
                <Slider
                  value={Math.log2(localSettings.iso / 100)}
                  onChange={(_, value) => handleChange('iso', 100 * Math.pow(2, value as number))}
                  min={0}
                  max={8}
                  step={1}
                  marks={[
                    { value: 0, label: '100' },
                    { value: 2, label: '400' },
                    { value: 4, label: '1600' },
                    { value: 6, label: '6400' },
                    { value: 8, label: '25600' },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => Math.round(100 * Math.pow(2, value))}
                />
              </>
            )}
            <Typography variant="caption" color="text.secondary">
              Higher = More sensitive to light (but more noise)
            </Typography>
          </Box>

          {/* Shutter Speed Control */}
          <Box>
            <Box
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="body2" color="text.secondary">
                Shutter Speed
              </Typography>
              <Chip label={closestShutter.label} size="small" color="info" />
            </Box>
            <FormControl fullWidth size="small">
              <Select
                value={closestShutter.value}
                onChange={(e) => handleChange('shutter', e.target.value as number)}
              >
                {SHUTTER_SPEEDS.map((speed) => (
                  <MenuItem key={speed.value} value={speed.value}>
                    {speed.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary">
              Faster = Freezes motion / Slower = Motion blur
            </Typography>
          </Box>

          <Divider />

          {/* Focus Distance Control */}
          <Box>
            {isTouch ? (
              <TouchSlider
                label="Focus Distance"
                value={localSettings.focusDistance}
                onChange={(value) => handleChange('focusDistance', value)}
                min={0.5}
                max={20}
                step={0.1}
                valueFormat={(v) => `${v.toFixed(1)}m`}
                touchSize="large"
                marks={[
                  { value: 0.5, label: '0.5m' },
                  { value: 5, label: '5m' },
                  { value: 10, label: '10m' },
                  { value: 20, label: '20m' },
                ]}
              />
            ) : (
              <>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    <FocusIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    Focus Distance
                  </Typography>
                  <Chip label={`${localSettings.focusDistance.toFixed(1)}m`} size="small" />
                </Box>
                <Slider
                  value={localSettings.focusDistance}
                  onChange={(_, value) => handleChange('focusDistance', value as number)}
                  min={0.5}
                  max={20}
                  step={0.1}
                  marks={[
                    { value: 0.5, label: '0.5m' },
                    { value: 2, label: '2m' },
                    { value: 5, label: '5m' },
                    { value: 10, label: '10m' },
                    { value: 20, label: '20m' },
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value.toFixed(1)}m`}
                />
              </>
            )}
          </Box>

          {/* Depth of Field Info */}
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              gutterBottom
              sx={{ display: 'block' }}
            >
              Depth of Field
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="space-around">
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  {dof.near.toFixed(2)}m
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Near
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  {dof.far === Infinity ? '∞' : `${dof.far.toFixed(2)}m`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Far
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" fontWeight="bold">
                  {dof.total === Infinity ?'∞' : `${dof.total.toFixed(2)}m`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
