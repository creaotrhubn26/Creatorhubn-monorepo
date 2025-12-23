/**
 * Global Illumination Control Panel
 * 
 * UI for controlling GI settings including:
 * - Enable/disable GI
 * - GI intensity
 * - Bounce count
 * - SSAO settings
 */

import React from 'react';
import {
  Box,
  Typography,
  Switch,
  Slider,
  FormControlLabel,
  Paper,
  Divider,
  Tooltip,
  IconButton,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import LightModeIcon from '@mui/icons-material/LightMode';

interface GlobalIlluminationPanelProps {
  enableGI: boolean;
  giIntensity: number;
  giBounces: number;
  enableSSAO: boolean;
  ssaoIntensity: number;
  ssaoRadius: number;
  onEnableGIChange: (enabled: boolean) => void;
  onGIIntensityChange: (intensity: number) => void;
  onGIBouncesChange: (bounces: number) => void;
  onEnableSSAOChange: (enabled: boolean) => void;
  onSSAOIntensityChange: (intensity: number) => void;
  onSSAORadiusChange: (radius: number) => void;
}

export const GlobalIlluminationPanel: React.FC<GlobalIlluminationPanelProps> = ({
  enableGI,
  giIntensity,
  giBounces,
  enableSSAO,
  ssaoIntensity,
  ssaoRadius,
  onEnableGIChange,
  onGIIntensityChange,
  onGIBouncesChange,
  onEnableSSAOChange,
  onSSAOIntensityChange,
  onSSAORadiusChange,
}) => {
  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Box display="flex" alignItems="center" mb={2}>
        <LightModeIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6">Global Illumination</Typography>
        <Tooltip title="Physically accurate indirect lighting and ambient occlusion">
          <IconButton size="small" sx={{ ml: 'auto' }}>
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Global Illumination Settings */}
      <Box mb={3}>
        <FormControlLabel
          control={
            <Switch
              checked={enableGI}
              onChange={(e) => onEnableGIChange(e.target.checked)}
              color="primary"
            />
          }
          label="Enable Global Illumination"
        />

        {enableGI && (
          <>
            <Box mt={2}>
              <Typography variant="body2" gutterBottom>
                GI Intensity: {giIntensity.toFixed(2)}
              </Typography>
              <Slider
                value={giIntensity}
                onChange={(_, value) => onGIIntensityChange(value as number)}
                min={0}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 0.5, label: '0.5' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>

            <Box mt={2}>
              <Typography variant="body2" gutterBottom>
                Bounce Count: {giBounces}
              </Typography>
              <Slider
                value={giBounces}
                onChange={(_, value) => onGIBouncesChange(value as number)}
                min={1}
                max={5}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                  { value: 3, label: '3' },
                  { value: 5, label: '5' },
                ]}
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Higher values = more realistic but slower
              </Typography>
            </Box>
          </>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* SSAO Settings */}
      <Box>
        <FormControlLabel
          control={
            <Switch
              checked={enableSSAO}
              onChange={(e) => onEnableSSAOChange(e.target.checked)}
              color="primary"
            />
          }
          label="Enable Ambient Occlusion (SSAO)"
        />

        {enableSSAO && (
          <>
            <Box mt={2}>
              <Typography variant="body2" gutterBottom>
                AO Intensity: {ssaoIntensity.toFixed(2)}
              </Typography>
              <Slider
                value={ssaoIntensity}
                onChange={(_, value) => onSSAOIntensityChange(value as number)}
                min={0}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
                valueLabelDisplay="auto"
              />
            </Box>

            <Box mt={2}>
              <Typography variant="body2" gutterBottom>
                AO Radius: {ssaoRadius.toFixed(2)}m
              </Typography>
              <Slider
                value={ssaoRadius}
                onChange={(_, value) => onSSAORadiusChange(value as number)}
                min={0.1}
                max={2}
                step={0.1}
                marks={[
                  { value: 0.1, label: '0.1' },
                  { value: 0.5, label: '0.5' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
                valueLabelDisplay="auto"
              />
              <Typography variant="caption" color="text.secondary">
                Larger radius = softer occlusion
              </Typography>
            </Box>
          </>
        )}
      </Box>
    </Paper>
  );
};

