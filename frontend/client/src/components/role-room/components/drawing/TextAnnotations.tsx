/**
 * TextAnnotations - Text overlay system for storyboard frames
 * 
 * Features:
 * - Add text labels anywhere on canvas
 * - Font family, size, weight, style options
 * - Text alignment and color
 * - Background box option
 * - Draggable positioning
 * - Edit on double-click
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Popover,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  TextFields,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  FormatColorText,
  BorderColor,
  Delete,
  ContentCopy,
  Edit,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// =============================================================================
// Types
// =============================================================================

export interface TextAnnotation {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style: TextStyle;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline';
  textAlign: 'left' | 'center' | 'right';
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  showBackground: boolean;
  padding: number;
  lineHeight: number;
}

export interface TextAnnotationsProps {
  annotations: TextAnnotation[];
  selectedId: string | null;
  onAnnotationsChange: (annotations: TextAnnotation[]) => void;
  onSelectedChange: (id: string | null) => void;
  onAddText: () => void;
  style: TextStyle;
  onStyleChange: (style: Partial<TextStyle>) => void;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 16,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  color: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.7,
  showBackground: false,
  padding: 8,
  lineHeight: 1.4,
};

const FONT_FAMILIES = [
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Courier New, monospace', label: 'Courier' },
  { value: 'Comic Sans MS, cursive', label: 'Comic Sans' },
  { value: 'Impact, fantasy', label: 'Impact' },
];

const COLOR_PRESETS = [
  '#ffffff', '#000000', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

// =============================================================================
// Styled Components
// =============================================================================

const ToolbarContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  backgroundColor: 'rgba(30, 30, 40, 0.95)',
  backdropFilter: 'blur(8px)',
  borderRadius: 8,
});

const ColorSwatch = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ selected }) => ({
  width: 20,
  height: 20,
  borderRadius: 4,
  cursor: 'pointer',
  border: selected ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
  transition: 'transform 0.15s',
  '&:hover': {
    transform: 'scale(1.15)',
  },
}));

// =============================================================================
// Text Rendering
// =============================================================================

export function drawTextAnnotation(
  ctx: CanvasRenderingContext2D,
  annotation: TextAnnotation,
  selected: boolean = false
) {
  ctx.save();
  
  const { text, x, y, width, rotation, style } = annotation;
  
  // Apply transformation
  ctx.translate(x + width / 2, y);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-width / 2, 0);
  
  // Set font
  const fontStyle = style.fontStyle === 'italic' ? 'italic ' : '';
  const fontWeight = style.fontWeight === 'bold' ? 'bold ' : '';
  ctx.font = `${fontStyle}${fontWeight}${style.fontSize}px ${style.fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = style.textAlign;
  
  // Calculate text dimensions
  const lines = text.split('\n');
  const lineHeight = style.fontSize * style.lineHeight;
  const textHeight = lines.length * lineHeight;
  
  // Draw background
  if (style.showBackground) {
    ctx.fillStyle = style.backgroundColor;
    ctx.globalAlpha = style.backgroundOpacity;
    ctx.fillRect(
      -style.padding,
      -style.padding,
      width + style.padding * 2,
      textHeight + style.padding * 2
    );
    ctx.globalAlpha = 1;
  }
  
  // Draw text
  ctx.fillStyle = style.color;
  let textX = 0;
  if (style.textAlign === 'center') textX = width / 2;
  else if (style.textAlign === 'right') textX = width;
  
  lines.forEach((line, i) => {
    ctx.fillText(line, textX, i * lineHeight);
    
    // Underline
    if (style.textDecoration === 'underline') {
      const metrics = ctx.measureText(line);
      let underlineX = textX;
      if (style.textAlign === 'center') underlineX = textX - metrics.width / 2;
      else if (style.textAlign === 'right') underlineX = textX - metrics.width;
      
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(underlineX, (i + 1) * lineHeight - 2);
      ctx.lineTo(underlineX + metrics.width, (i + 1) * lineHeight - 2);
      ctx.stroke();
    }
  });
  
  // Selection indicator
  if (selected) {
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      -style.padding - 4,
      -style.padding - 4,
      width + style.padding * 2 + 8,
      textHeight + style.padding * 2 + 8
    );
    
    // Resize handles
    const handleSize = 8;
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    
    const corners = [
      { x: -style.padding - 4, y: -style.padding - 4 },
      { x: width + style.padding - 4, y: -style.padding - 4 },
      { x: width + style.padding - 4, y: textHeight + style.padding - 4 },
      { x: -style.padding - 4, y: textHeight + style.padding - 4 },
    ];
    
    corners.forEach(c => {
      ctx.fillRect(c.x, c.y, handleSize, handleSize);
      ctx.strokeRect(c.x, c.y, handleSize, handleSize);
    });
  }
  
  ctx.restore();
}

export function createTextAnnotation(
  text: string = 'Text',
  x: number = 50,
  y: number = 50,
  style: TextStyle = DEFAULT_TEXT_STYLE
): TextAnnotation {
  return {
    id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text,
    x,
    y,
    width: 200,
    height: 30,
    rotation: 0,
    style: { ...style },
  };
}

// =============================================================================
// Component
// =============================================================================

export const TextAnnotationsToolbar: React.FC<TextAnnotationsProps> = ({
  annotations,
  selectedId,
  onAnnotationsChange,
  onSelectedChange,
  onAddText,
  style,
  onStyleChange,
}) => {
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [bgAnchor, setBgAnchor] = useState<HTMLElement | null>(null);

  const selectedAnnotation = annotations.find(a => a.id === selectedId);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return;
    onAnnotationsChange(annotations.filter(a => a.id !== selectedId));
    onSelectedChange(null);
  }, [selectedId, annotations, onAnnotationsChange, onSelectedChange]);

  const handleDuplicateSelected = useCallback(() => {
    if (!selectedAnnotation) return;
    const duplicate: TextAnnotation = {
      ...selectedAnnotation,
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      x: selectedAnnotation.x + 20,
      y: selectedAnnotation.y + 20,
    };
    onAnnotationsChange([...annotations, duplicate]);
    onSelectedChange(duplicate.id);
  }, [selectedAnnotation, annotations, onAnnotationsChange, onSelectedChange]);

  return (
    <ToolbarContainer>
      {/* Add text */}
      <Tooltip title="Add Text" placement="top">
        <IconButton size="small" onClick={onAddText}>
          <TextFields sx={{ fontSize: 20 }} />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Font family */}
      <FormControl size="small" sx={{ minWidth: 100 }}>
        <Select
          value={style.fontFamily}
          onChange={(e) => onStyleChange({ fontFamily: e.target.value })}
          sx={{ fontSize: 11, '& .MuiSelect-select': { py: 0.5 } }}
        >
          {FONT_FAMILIES.map(f => (
            <MenuItem key={f.value} value={f.value} sx={{ fontSize: 12 }}>
              {f.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Font size */}
      <TextField
        type="number"
        size="small"
        value={style.fontSize}
        onChange={(e) => onStyleChange({ fontSize: parseInt(e.target.value) || 16 })}
        sx={{ 
          width: 50, 
          '& input': { fontSize: 11, py: 0.5, textAlign: 'center' } 
        }}
        inputProps={{ min: 8, max: 120 }}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Bold */}
      <Tooltip title="Bold" placement="top">
        <IconButton
          size="small"
          onClick={() => onStyleChange({ fontWeight: style.fontWeight === 'bold' ? 'normal' : 'bold' })}
          sx={{ 
            bgcolor: style.fontWeight === 'bold' ? 'rgba(59,130,246,0.3)' : 'transparent',
          }}
        >
          <FormatBold sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      {/* Italic */}
      <Tooltip title="Italic" placement="top">
        <IconButton
          size="small"
          onClick={() => onStyleChange({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}
          sx={{ 
            bgcolor: style.fontStyle === 'italic' ? 'rgba(59,130,246,0.3)' : 'transparent',
          }}
        >
          <FormatItalic sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      {/* Underline */}
      <Tooltip title="Underline" placement="top">
        <IconButton
          size="small"
          onClick={() => onStyleChange({ textDecoration: style.textDecoration === 'underline' ? 'none' : 'underline' })}
          sx={{ 
            bgcolor: style.textDecoration === 'underline' ? 'rgba(59,130,246,0.3)' : 'transparent',
          }}
        >
          <FormatUnderlined sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Alignment */}
      <ToggleButtonGroup
        size="small"
        value={style.textAlign}
        exclusive
        onChange={(_, v) => v && onStyleChange({ textAlign: v })}
      >
        <ToggleButton value="left" sx={{ py: 0.5, px: 0.75 }}>
          <FormatAlignLeft sx={{ fontSize: 16 }} />
        </ToggleButton>
        <ToggleButton value="center" sx={{ py: 0.5, px: 0.75 }}>
          <FormatAlignCenter sx={{ fontSize: 16 }} />
        </ToggleButton>
        <ToggleButton value="right" sx={{ py: 0.5, px: 0.75 }}>
          <FormatAlignRight sx={{ fontSize: 16 }} />
        </ToggleButton>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Text color */}
      <Tooltip title="Text Color" placement="top">
        <IconButton size="small" onClick={(e) => setColorAnchor(e.currentTarget)}>
          <FormatColorText sx={{ fontSize: 18 }} />
          <Box
            sx={{
              position: 'absolute',
              bottom: 2,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 14,
              height: 3,
              bgcolor: style.color,
              borderRadius: 1,
            }}
          />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(colorAnchor)}
        anchorEl={colorAnchor}
        onClose={() => setColorAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)' } } }}
      >
        <Box sx={{ p: 2, width: 180 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Text Color</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {COLOR_PRESETS.map(color => (
              <ColorSwatch
                key={color}
                sx={{ bgcolor: color }}
                selected={style.color === color}
                onClick={() => { onStyleChange({ color }); setColorAnchor(null); }}
              />
            ))}
          </Box>
        </Box>
      </Popover>

      {/* Background */}
      <Tooltip title="Background" placement="top">
        <IconButton size="small" onClick={(e) => setBgAnchor(e.currentTarget)}>
          <BorderColor sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(bgAnchor)}
        anchorEl={bgAnchor}
        onClose={() => setBgAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)' } } }}
      >
        <Box sx={{ p: 2, width: 200 }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={style.showBackground}
                onChange={(e) => onStyleChange({ showBackground: e.target.checked })}
              />
            }
            label={<Typography variant="caption">Show Background</Typography>}
          />
          
          {style.showBackground && (
            <>
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Background Color</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {COLOR_PRESETS.map(color => (
                    <ColorSwatch
                      key={color}
                      sx={{ bgcolor: color }}
                      selected={style.backgroundColor === color}
                      onClick={() => onStyleChange({ backgroundColor: color })}
                    />
                  ))}
                </Box>
              </Box>
              
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Opacity: {Math.round(style.backgroundOpacity * 100)}%
                </Typography>
                <Slider
                  size="small"
                  value={style.backgroundOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(_, v) => onStyleChange({ backgroundOpacity: v as number })}
                />
              </Box>
            </>
          )}
        </Box>
      </Popover>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Actions for selected */}
      {selectedId && (
        <>
          <Tooltip title="Duplicate" placement="top">
            <IconButton size="small" onClick={handleDuplicateSelected}>
              <ContentCopy sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" placement="top">
            <IconButton size="small" onClick={handleDeleteSelected} sx={{ color: 'error.main' }}>
              <Delete sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </>
      )}
    </ToolbarContainer>
  );
};

export default TextAnnotationsToolbar;
