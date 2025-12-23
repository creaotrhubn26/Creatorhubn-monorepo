/**
 * LensSelector - Professional Lens Selection UI
 *
 * Features: * - Common focal lengths (14mm-200mm)
 * - Field of view calculation
 * - Lens type indicators (Ultra-wide, Wide, Normal, Telephoto)
 * - Visual FOV preview
 */

import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  CameraEnhance as LensIcon,
  Panorama as WideIcon,
  PhotoCamera as NormalIcon,
  ZoomIn as TeleIcon,
} from '@mui/icons-material';

export interface LensSettings {
  focalLength: number; // in mm,
  sensor: [number, number]; // [width, height] in mm
}

interface LensSelectorProps {
  settings: LensSettings;
  onChange: (settings: LensSettings) => void;
}

// Common focal lengths for full frame
const FOCAL_LENGTHS = [
  { value: 14, label: '14mm', type: 'ultra-wide', description: 'Ultra-wide angle' },
  { value: 16, label: '16mm', type: 'ultra-wide', description: 'Ultra-wide angle' },
  { value: 20, label: '20mm', type: 'wide', description: 'Wide angle' },
  { value: 24, label: '24mm', type: 'wide', description: 'Wide angle' },
  { value: 28, label: '28mm', type: 'wide', description: 'Wide angle' },
  { value: 35, label: '35mm', type: 'normal', description: 'Moderate wide' },
  { value: 50, label: '50mm', type: 'normal', description: 'Standard (normal)' },
  { value: 85, label: '85mm', type: 'portrait', description: 'Portrait' },
  { value: 100, label: '100mm', type: 'portrait', description: 'Portrait' },
  { value: 135, label: '135mm', type: 'telephoto', description: 'Telephoto' },
  { value: 200, label: '200mm', type: 'telephoto', description: 'Telephoto' },
];

// Common sensor sizes
const SENSOR_PRESETS = {
  fullFrame: { name: 'Full Frame', size: [36, 24] as [number, number] },
  apsc: { name: 'APS-C', size: [23.5, 15.6] as [number, number] },
  mft: { name: 'Micro 4/3', size: [17.3, 13] as [number, number] },
};

/**
 * Calculate Field of View
 */
function calculateFOV(
  focalLength: number,
  sensorSize: [number, number],
): {
  horizontal: number;
  vertical: number;
  diagonal: number;
} {
  const [width, height] = sensorSize;
  const diagonal = Math.sqrt(width * width + height * height);

  return {
    horizontal: 2 * Math.atan(width / (2 * focalLength)) * (180 / Math.PI),
    vertical: 2 * Math.atan(height / (2 * focalLength)) * (180 / Math.PI),
    diagonal: 2 * Math.atan(diagonal / (2 * focalLength)) * (180 / Math.PI),
  };
}

/**
 * Get lens type info
 */
function getLensTypeInfo(focalLength: number): {
  type: string;
  icon: React.ReactElement;
  color: string;
  description: string;
} {
  if (focalLength < 20) {
    return {
      type: 'Ultra-Wide',
      icon: <WideIcon />,
      color: '#2196f3',
      description: 'Dramatic perspective, architecture, landscapes',
    };
  } else if (focalLength < 35) {
    return {
      type: 'Wide Angle',
      icon: <WideIcon />,
      color: '#03a9f4',
      description: 'Environmental portraits, street photography',
    };
  } else if (focalLength < 70) {
    return {
      type: 'Normal',
      icon: <NormalIcon />,
      color: '#4caf50',
      description: 'Natural perspective, general purpose',
    };
  } else if (focalLength < 135) {
    return {
      type: 'Portrait',
      icon: <NormalIcon />,
      color: '#ff9800',
      description: 'Flattering compression, headshots',
    };
  } else {
    return {
      type: 'Telephoto',
      icon: <TeleIcon />,
      color: '#f44336',
      description: 'Compression, distant subjects',
    };
  }
}

/**
 * FOV visualizer component
 */
function FOVVisualizer({ fov }: { fov: number }) {
  // Map FOV to visual width (0-100%)
  const width = Math.max(10, Math.min(100, (fov / 120) * 100));

  return (
    <Box
      sx={{
        position: 'relative',
        height: 60,
        bgcolor: 'action.hover',
        borderRadius: 1,
        overflow: 'hidden'}}
    >
      {/* Grid background */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(0deg, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
          backgroundSize: '10px 10px'}}
      />

      {/* FOV indicator */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `${width}%`,
          height: '80%',
          border: '2px solid',
          borderColor: 'primary.main',
          borderRadius: 1,
          bgcolor: 'primary.main',
          opacity: 0.2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'}}
      >
        <Typography
          variant="caption"
          sx={{ color: 'primary.main', fontWeight: 'bold', opacity: 5 }}
        >
          {fov.toFixed(1)}°
        </Typography>
      </Box>

      {/* Center marker */}
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'error.main',
          border: '2px solid white'}}
      />
    </Box>
  );
}

export function LensSelector({ settings, onChange }: LensSelectorProps) {
  const fov = calculateFOV(settings.focalLength, settings.sensor);
  const lensInfo = getLensTypeInfo(settings.focalLength);

  const handleFocalLengthChange = (value: number) => {
    onChange({ ...settings, focalLength: value });
  };

  const handleSensorChange = (size: [number, number]) => {
    onChange({ ...settings, sensor: size });
  };

  return (
    <Card sx={{ maxWidth: 420 }}>
      <CardContent>
        <Stack spacing={3}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LensIcon />
            <Typography variant="h6">Lens Settings</Typography>
          </Box>

          {/* Lens Type Badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={lensInfo.icon}
              label={lensInfo.type}
              sx={{
                bgcolor: lensInfo.color,
                color: 'white',
                fontWeight: 'bold'}}
            />
            <Typography variant="caption" color="text.secondary">
              {lensInfo.description}
            </Typography>
          </Box>

          {/* Focal Length Selector */}
          <FormControl fullWidth>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Focal Length
            </Typography>
            <Select
              value={settings.focalLength}
              onChange={(e) => handleFocalLengthChange(e.target.value as number)}
            >
              {FOCAL_LENGTHS.map((lens) => (
                <MenuItem key={lens.value} value={lens.value}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%'}}
                  >
                    <span>{lens.label}</span>
                    <Chip label={lens.type} size="small" variant="outlined" />
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Sensor Size Selector */}
          <FormControl fullWidth>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Sensor Size
            </Typography>
            <Select
              value={JSON.stringify(settings.sensor)}
              onChange={(e) => handleSensorChange(JSON.parse(e.target.value))}
            >
              {Object.entries(SENSOR_PRESETS).map(([key, preset]) => (
                <MenuItem key={key} value={JSON.stringify(preset.size)}>
                  {preset.name} ({preset.size[0]}×{preset.size[1]}mm)
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Field of View Display */}
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Field of View
            </Typography>
            <FOVVisualizer fov={fov.horizontal} />
            <Stack direction="row" spacing={2} justifyContent="space-around" sx={{ mt: 2 }}>
              <Box>
                <Tooltip title="Horizontal FOV">
                  <Typography variant="body2" fontWeight="bold">
                    {fov.horizontal.toFixed(1)}°
                  </Typography>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  Horizontal
                </Typography>
              </Box>
              <Box>
                <Tooltip title="Vertical FOV">
                  <Typography variant="body2" fontWeight="bold">
                    {fov.vertical.toFixed(1)}°
                  </Typography>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  Vertical
                </Typography>
              </Box>
              <Box>
                <Tooltip title="Diagonal FOV">
                  <Typography variant="body2" fontWeight="bold">
                    {fov.diagonal.toFixed(1)}°
                  </Typography>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  Diagonal
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Quick Reference */}
          <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              gutterBottom
              sx={{ display: 'block' }}
            >
              Equivalent Perspective
            </Typography>
            <Typography variant="body2">
              This lens sees approximately{''}
              <strong>
                {fov.horizontal > 70
                  ? 'wider'
                  : fov.horizontal > 40
                    ? 'similar to' : 'narrower than'}
              </strong>{''}
              what your eye sees naturally.
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
