/**
 * TEXT OVERLAY PANEL
 * Create and edit text/titles with GSAP animations
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Chip,
  Grid,
  Card,
  CardActionArea,
  IconButton
} from '@mui/material';
import { Close, Add, PlayArrow } from '@mui/icons-material';
import { TextAnimationEngine } from '../../services/text-animation-engine';
import { textOverlayEngine } from '../../services/text-overlay-engine';

interface TextOverlayPanelProps {
  open: boolean;
  onClose: () => void;
  onAddOverlay: (overlay: any) => void;
}

export default function TextOverlayPanel({
  open,
  onClose,
  onAddOverlay
}: TextOverlayPanelProps) {
  const [text, setText] = useState('Wedding Title ');
  const [fontSize, setFontSize] = useState(72);
  const [fontFamily, setFontFamily] = useState('Playfair Display');
  const [fill, setFill] = useState('#ffffff');
  const [stroke, setStroke] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [x, setX] = useState(100);
  const [y, setY] = useState(100);
  const [animation, setAnimation] = useState('fade_in');
  const [duration, setDuration] = useState(1.0);
  
  const presets = textOverlayEngine.getTextPresets();
  const animations = TextAnimationEngine.getAnimationPresets();
  
  const handleApplyPreset = (preset: any) => {
    if (preset.style.fontSize) setFontSize(preset.style.fontSize);
    if (preset.style.fontFamily) setFontFamily(preset.style.fontFamily);
    if (preset.style.fill) setFill(preset.style.fill);
    if (preset.style.stroke) setStroke(preset.style.stroke || '#000000');
    if (preset.style.strokeWidth !== undefined) setStrokeWidth(preset.style.strokeWidth);
  };
  
  const handleCreate = () => {
    const overlay = {
      id: `text-${Date.now()}`,
      text,
      x,
      y,
      fontSize,
      fontFamily,
      fill,
      stroke,
      strokeWidth,
      animation: {
        type: animation,
        duration,
        delay: 0
      },
      startTime: 0,
      endTime: 10
    };
    
    onAddOverlay(overlay);
    onClose();
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Text Overlay</Typography>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        {/* Presets */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Style Presets</Typography>
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
        
        {/* Text Input */}
        <TextField
          fullWidth
          label="Text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          sx={{ mb: 2 }}
        />
        
        {/* Font Settings */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            select
            label="Font"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            sx={{ flex: 1 }}
          >
            <MenuItem value="Playfair Display">Playfair Display</MenuItem>
            <MenuItem value="Helvetica Neue">Helvetica Neue</MenuItem>
            <MenuItem value="Arial">Arial</MenuItem>
            <MenuItem value="Georgia">Georgia</MenuItem>
            <MenuItem value="Impact">Impact</MenuItem>
          </TextField>
          
          <TextField
            label="Size"
            type="number"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            sx={{ width: 100 }}
          />
        </Stack>
        
        {/* Colors */}
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            label="Fill Color"
            type="color"
            value={fill}
            onChange={(e) => setFill(e.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Stroke Color"
            type="color"
            value={stroke}
            onChange={(e) => setStroke(e.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Stroke Width"
            type="number"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            sx={{ width: 100 }}
          />
        </Stack>
        
        {/* Animation */}
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Animation</InputLabel>
          <Select value={animation} onChange={(e) => setAnimation(e.target.value)} label="Animation">
            {animations.map((anim) => (
              <MenuItem key={anim.name} value={anim.animation.type}>
                {anim.name} ({anim.category})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate} startIcon={<Add />}>
          Add Text
        </Button>
      </DialogActions>
    </Dialog>
  );
}


