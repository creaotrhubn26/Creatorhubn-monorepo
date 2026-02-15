/**
 * ShapeTools - Vector shape overlays for storyboard frames
 * 
 * Features:
 * - Rectangle, ellipse, line, arrow, polygon
 * - Fill and stroke options
 * - Snap to grid
 * - Proportional constraint (shift key)
 * - Shape manipulation after creation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Popover,
  Typography,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from '@mui/material';
import {
  CropSquare,
  RadioButtonUnchecked,
  Remove,
  ArrowRightAlt,
  ChangeHistory,
  StarBorder,
  Hexagon,
  FormatColorFill,
  BorderColor,
  LineWeight,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// =============================================================================
// Types
// =============================================================================

export type ShapeType = 
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'triangle'
  | 'star'
  | 'polygon';

export interface ShapeStyle {
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  cornerRadius?: number;
  sides?: number; // For polygon
  points?: number; // For star
}

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style: ShapeStyle;
  // For line/arrow
  x2?: number;
  y2?: number;
}

export interface ShapeToolsProps {
  selectedShape: ShapeType | null;
  onShapeSelect: (shape: ShapeType | null) => void;
  style: ShapeStyle;
  onStyleChange: (style: Partial<ShapeStyle>) => void;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_SHAPE_STYLE: ShapeStyle = {
  fillColor: '#3b82f6',
  fillOpacity: 0.3,
  strokeColor: '#ffffff',
  strokeWidth: 2,
  strokeOpacity: 1,
  cornerRadius: 0,
  sides: 6,
  points: 5,
};

const SHAPE_ICONS: Record<ShapeType, React.ReactNode> = {
  rectangle: <CropSquare sx={{ fontSize: 20 }} />,
  ellipse: <RadioButtonUnchecked sx={{ fontSize: 20 }} />,
  line: <Remove sx={{ fontSize: 20 }} />,
  arrow: <ArrowRightAlt sx={{ fontSize: 20 }} />,
  triangle: <ChangeHistory sx={{ fontSize: 20 }} />,
  star: <StarBorder sx={{ fontSize: 20 }} />,
  polygon: <Hexagon sx={{ fontSize: 20 }} />,
};

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

const ShapeButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ selected }) => ({
  borderRadius: 6,
  padding: 6,
  backgroundColor: selected ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
  border: selected ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
  '&:hover': {
    backgroundColor: selected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.1)',
  },
}));

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
// Shape Drawing Functions
// =============================================================================

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: Shape,
  selected: boolean = false
) {
  ctx.save();
  
  // Apply transformation
  ctx.translate(shape.x + shape.width / 2, shape.y + shape.height / 2);
  ctx.rotate((shape.rotation * Math.PI) / 180);
  ctx.translate(-shape.width / 2, -shape.height / 2);
  
  const { fillColor, fillOpacity, strokeColor, strokeWidth, strokeOpacity, cornerRadius } = shape.style;
  
  // Set styles
  ctx.fillStyle = fillColor;
  ctx.globalAlpha = fillOpacity;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  
  ctx.beginPath();
  
  switch (shape.type) {
    case 'rectangle':
      if (cornerRadius && cornerRadius > 0) {
        drawRoundedRect(ctx, 0, 0, shape.width, shape.height, cornerRadius);
      } else {
        ctx.rect(0, 0, shape.width, shape.height);
      }
      break;
      
    case 'ellipse':
      ctx.ellipse(
        shape.width / 2,
        shape.height / 2,
        shape.width / 2,
        shape.height / 2,
        0, 0, Math.PI * 2
      );
      break;
      
    case 'line':
    case 'arrow':
      ctx.moveTo(0, shape.height / 2);
      ctx.lineTo(shape.width, shape.height / 2);
      if (shape.type === 'arrow') {
        // Arrow head
        const headSize = Math.min(15, shape.width * 0.2);
        ctx.moveTo(shape.width - headSize, shape.height / 2 - headSize / 2);
        ctx.lineTo(shape.width, shape.height / 2);
        ctx.lineTo(shape.width - headSize, shape.height / 2 + headSize / 2);
      }
      break;
      
    case 'triangle':
      ctx.moveTo(shape.width / 2, 0);
      ctx.lineTo(shape.width, shape.height);
      ctx.lineTo(0, shape.height);
      ctx.closePath();
      break;
      
    case 'star':
      drawStar(ctx, shape.width / 2, shape.height / 2, shape.style.points || 5, shape.width / 2, shape.width / 4);
      break;
      
    case 'polygon':
      drawPolygon(ctx, shape.width / 2, shape.height / 2, shape.style.sides || 6, Math.min(shape.width, shape.height) / 2);
      break;
  }
  
  // Fill
  if (shape.type !== 'line' && shape.type !== 'arrow') {
    ctx.globalAlpha = fillOpacity;
    ctx.fill();
  }
  
  // Stroke
  ctx.globalAlpha = strokeOpacity;
  ctx.stroke();
  
  // Selection indicator
  if (selected) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(-4, -4, shape.width + 8, shape.height + 8);
    
    // Resize handles
    const handleSize = 8;
    ctx.fillStyle = 'white';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    
    const handles = [
      { x: -handleSize/2, y: -handleSize/2 },
      { x: shape.width - handleSize/2, y: -handleSize/2 },
      { x: shape.width - handleSize/2, y: shape.height - handleSize/2 },
      { x: -handleSize/2, y: shape.height - handleSize/2 },
    ];
    
    handles.forEach(h => {
      ctx.fillRect(h.x, h.y, handleSize, handleSize);
      ctx.strokeRect(h.x, h.y, handleSize, handleSize);
    });
  }
  
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  width: number, height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  points: number,
  outerRadius: number,
  innerRadius: number
) {
  const step = Math.PI / points;
  let angle = -Math.PI / 2;
  
  ctx.moveTo(cx + outerRadius * Math.cos(angle), cy + outerRadius * Math.sin(angle));
  
  for (let i = 0; i < points; i++) {
    angle += step;
    ctx.lineTo(cx + innerRadius * Math.cos(angle), cy + innerRadius * Math.sin(angle));
    angle += step;
    ctx.lineTo(cx + outerRadius * Math.cos(angle), cy + outerRadius * Math.sin(angle));
  }
  
  ctx.closePath();
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  sides: number,
  radius: number
) {
  const step = (Math.PI * 2) / sides;
  let angle = -Math.PI / 2;
  
  ctx.moveTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  
  for (let i = 1; i <= sides; i++) {
    angle += step;
    ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
  }
  
  ctx.closePath();
}

// =============================================================================
// Component
// =============================================================================

export const ShapeTools: React.FC<ShapeToolsProps> = ({
  selectedShape,
  onShapeSelect,
  style,
  onStyleChange,
}) => {
  const [fillAnchor, setFillAnchor] = useState<HTMLElement | null>(null);
  const [strokeAnchor, setStrokeAnchor] = useState<HTMLElement | null>(null);

  return (
    <ToolbarContainer>
      {/* Shape buttons */}
      {(['rectangle', 'ellipse', 'line', 'arrow', 'triangle', 'star', 'polygon'] as ShapeType[]).map((shape) => (
        <Tooltip key={shape} title={shape.charAt(0).toUpperCase() + shape.slice(1)} placement="top">
          <ShapeButton
            selected={selectedShape === shape}
            onClick={() => onShapeSelect(selectedShape === shape ? null : shape)}
          >
            {SHAPE_ICONS[shape]}
          </ShapeButton>
        </Tooltip>
      ))}

      <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Fill color */}
      <Tooltip title="Fill Color" placement="top">
        <IconButton size="small" onClick={(e) => setFillAnchor(e.currentTarget)}>
          <FormatColorFill sx={{ fontSize: 18 }} />
          <Box
            sx={{
              position: 'absolute',
              bottom: 2,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 14,
              height: 4,
              bgcolor: style.fillColor,
              borderRadius: 1,
            }}
          />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(fillAnchor)}
        anchorEl={fillAnchor}
        onClose={() => setFillAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)' } } }}
      >
        <Box sx={{ p: 2, width: 200 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Fill Color</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {COLOR_PRESETS.map(color => (
              <ColorSwatch
                key={color}
                sx={{ bgcolor: color }}
                selected={style.fillColor === color}
                onClick={() => onStyleChange({ fillColor: color })}
              />
            ))}
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Opacity: {Math.round(style.fillOpacity * 100)}%
            </Typography>
            <Slider
              size="small"
              value={style.fillOpacity}
              min={0}
              max={1}
              step={0.05}
              onChange={(_, v) => onStyleChange({ fillOpacity: v as number })}
            />
          </Box>
        </Box>
      </Popover>

      {/* Stroke color */}
      <Tooltip title="Stroke Color" placement="top">
        <IconButton size="small" onClick={(e) => setStrokeAnchor(e.currentTarget)}>
          <BorderColor sx={{ fontSize: 18 }} />
          <Box
            sx={{
              position: 'absolute',
              bottom: 2,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 14,
              height: 4,
              bgcolor: style.strokeColor,
              borderRadius: 1,
            }}
          />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(strokeAnchor)}
        anchorEl={strokeAnchor}
        onClose={() => setStrokeAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)' } } }}
      >
        <Box sx={{ p: 2, width: 200 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Stroke Color</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {COLOR_PRESETS.map(color => (
              <ColorSwatch
                key={color}
                sx={{ bgcolor: color }}
                selected={style.strokeColor === color}
                onClick={() => onStyleChange({ strokeColor: color })}
              />
            ))}
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Width: {style.strokeWidth}px
            </Typography>
            <Slider
              size="small"
              value={style.strokeWidth}
              min={0}
              max={20}
              step={1}
              onChange={(_, v) => onStyleChange({ strokeWidth: v as number })}
            />
          </Box>
        </Box>
      </Popover>

      {/* Corner radius (for rectangles) */}
      {selectedShape === 'rectangle' && (
        <Tooltip title="Corner Radius" placement="top">
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, width: 80 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>R:</Typography>
            <Slider
              size="small"
              value={style.cornerRadius || 0}
              min={0}
              max={50}
              onChange={(_, v) => onStyleChange({ cornerRadius: v as number })}
            />
          </Box>
        </Tooltip>
      )}

      {/* Polygon sides */}
      {selectedShape === 'polygon' && (
        <Tooltip title="Sides" placement="top">
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, width: 80 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>Sides:</Typography>
            <Slider
              size="small"
              value={style.sides || 6}
              min={3}
              max={12}
              step={1}
              onChange={(_, v) => onStyleChange({ sides: v as number })}
            />
          </Box>
        </Tooltip>
      )}

      {/* Star points */}
      {selectedShape === 'star' && (
        <Tooltip title="Points" placement="top">
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, width: 80 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1 }}>Pts:</Typography>
            <Slider
              size="small"
              value={style.points || 5}
              min={3}
              max={12}
              step={1}
              onChange={(_, v) => onStyleChange({ points: v as number })}
            />
          </Box>
        </Tooltip>
      )}
    </ToolbarContainer>
  );
};

export default ShapeTools;
