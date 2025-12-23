/**
 * Color Bleeding Panel
 * 
 * Visualizes color bleeding from Global Illumination
 * Shows how colored surfaces affect nearby objects
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Slider,
  Paper,
} from '@mui/material';
import { Palette } from '@mui/icons-material';

interface ColorBleedingPanelProps {
  enabled: boolean;
  intensity: number;
  onEnabledChange: (enabled: boolean) => void;
  onIntensityChange: (intensity: number) => void;
}

export const ColorBleedingPanel: React.FC<ColorBleedingPanelProps> = ({
  enabled,
  intensity,
  onEnabledChange,
  onIntensityChange,
}) => {
  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: 'rgba(26, 26, 26, 0.95)',
        color: '#ffffff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Palette sx={{ color: '#ffffff' }} />
        <Typography variant="h6" sx={{ color: '#ffffff' }}>
          Color Bleeding Visualization
        </Typography>
      </Box>
      
      <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 2 }}>
        Visualize how colored surfaces affect nearby objects through Global Illumination
      </Typography>
      
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': {
                color: '#4a9eff',
              },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                backgroundColor: '#4a9eff',
              },
            }}
          />
        }
        label="Enable Color Bleeding"
        sx={{ color: '#ffffff', mb: 2 }}
      />
      
      {enabled && (
        <Box>
          <Typography variant="body2" sx={{ color: '#aaaaaa', mb: 1 }}>
            Intensity: {intensity.toFixed(2)}
          </Typography>
          <Slider
            value={intensity}
            onChange={(_, value) => onIntensityChange(value as number)}
            min={0}
            max={1}
            step={0.01}
            sx={{
              color: '#4a9eff',
              '& .MuiSlider-thumb': {
                '&:hover': {
                  boxShadow: '0 0 0 8px rgba(74, 158, 255, 0.16)',
                },
              },
            }}
          />
        </Box>
      )}
      
      <Box sx={{ mt: 2, p: 1, bgcolor: '#2a2a2a', borderRadius: 1 }}>
        <Typography variant="caption" sx={{ color: '#888888' }}>
          Color bleeding occurs when colored surfaces (walls, backdrops, reflectors) bounce colored light onto nearby objects, creating realistic color interaction.
        </Typography>
      </Box>
    </Paper>
  );
};


