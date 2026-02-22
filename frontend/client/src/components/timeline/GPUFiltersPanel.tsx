/**
 * GPU FILTERS PANEL
 * PixiJS GPU-accelerated filters
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Stack,
  Slider,
  Card,
  CardActionArea,
  Grid,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { pixiFilterEngine } from '../../services/pixi-filter-engine';

interface GPUFiltersPanelProps {
  open: boolean;
  onClose: () => void;
  onApplyFilter: (filterId: string, config: any) => void;
}

export default function GPUFiltersPanel({
  open,
  onClose,
  onApplyFilter
}: GPUFiltersPanelProps) {
  const [blur, setBlur] = useState(0);
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [noise, setNoise] = useState(0);
  
  const presets = pixiFilterEngine.getFilterPresets();
  
  const handleApplyPreset = (preset: any) => {
    onApplyFilter('preset-' + preset.name, preset.config);
    
    // Update sliders
    if (preset.config.params.strength) setBlur(preset.config.params.strength);
    if (preset.config.params.brightness) setBrightness(preset.config.params.brightness);
    if (preset.config.params.contrast) setContrast(preset.config.params.contrast);
    if (preset.config.params.saturate) setSaturation(preset.config.params.saturate);
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">GPU Filters</Typography>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        {/* Presets */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Presets</Typography>
        <Grid container spacing={1} sx={{ mb: 3 }}>
          {presets.map((preset) => (
            <Grid item xs={6} sm={4} key={preset.name}>
              <Card>
                <CardActionArea onClick={() => handleApplyPreset(preset)}>
                  <Box sx={{ p: 1, textAlign: 'center' }}>
                    <Typography variant="caption">{preset.name}</Typography>
                  </Box>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
        
        {/* Manual Controls */}
        <Typography variant="subtitle2" sx={{ mb: 2 }}>Custom Adjustments</Typography>
        
        {/* Blur */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption">Blur: {blur}</Typography>
          <Slider
            value={blur}
            onChange={(_, v) => {
              setBlur(v as number);
              onApplyFilter('blur', { type: 'blur', params: { strength: v, quality: 4 } });
            }}
            min={0}
            max={32}
            sx={{ color: '#667eea' }}
          />
        </Box>
        
        {/* Brightness */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption">Brightness: {brightness.toFixed(2)}</Typography>
          <Slider
            value={brightness}
            onChange={(_, v) => {
              setBrightness(v as number);
              onApplyFilter('brightness', { type: 'color_matrix', params: { brightness: v } });
            }}
            min={0}
            max={2}
            step={0.1}
            sx={{ color: '#667eea' }}
          />
        </Box>
        
        {/* Contrast */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption">Contrast: {contrast.toFixed(2)}</Typography>
          <Slider
            value={contrast}
            onChange={(_, v) => {
              setContrast(v as number);
              onApplyFilter('contrast', { type: 'color_matrix', params: { contrast: v } });
            }}
            min={0}
            max={2}
            step={0.1}
            sx={{ color: '#667eea' }}
          />
        </Box>
        
        {/* Saturation */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption">Saturation: {saturation.toFixed(2)}</Typography>
          <Slider
            value={saturation}
            onChange={(_, v) => {
              setSaturation(v as number);
              onApplyFilter('saturation', { type: 'color_matrix', params: { saturate: v } });
            }}
            min={0}
            max={2}
            step={0.1}
            sx={{ color: '#667eea' }}
          />
        </Box>
        
        {/* Noise/Grain */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption">Film Grain: {noise.toFixed(2)}</Typography>
          <Slider
            value={noise}
            onChange={(_, v) => {
              setNoise(v as number);
              onApplyFilter('noise', { type: 'noise', params: { noise: v } });
            }}
            min={0}
            max={1}
            step={0.05}
            sx={{ color: '#667eea' }}
          />
        </Box>
        
        <Chip label="Real-time GPU rendering" size="small" sx={{ bgcolor: '#667eea', color: 'white' }} />
      </DialogContent>
    </Dialog>
  );
}


