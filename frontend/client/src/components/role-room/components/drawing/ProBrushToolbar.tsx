/**
 * ProBrushToolbar - Professional brush selection toolbar
 * 
 * Matches the style of Apple's Storyboard app with:
 * - Visual brush previews with size dots
 * - Color wheel picker
 * - Quick color palette
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Paper,
  Popover,
  Slider,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
} from '@mui/material';
import {
  Create,
  Brush,
  BorderColor,
  Highlight,
  Edit,
  FormatPaint,
  AutoFixHigh,
  TextFields,
  CameraAlt,
  Undo,
  Redo,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { AdvancedBrushType, BrushConfig, BRUSH_PRESETS } from './AdvancedBrushEngine';
import ColorWheelPicker from '../ColorWheelPicker';

// =============================================================================
// Types
// =============================================================================

export interface ProBrushToolbarProps {
  brushConfig: BrushConfig;
  onBrushChange: (config: Partial<BrushConfig>) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onTextTool?: () => void;
  onImageImport?: () => void;
}

// =============================================================================
// Styled Components
// =============================================================================

const ToolbarContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'rgba(30, 30, 40, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRadius: 16,
  padding: theme.spacing(1.5, 2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
}));

const BrushButton = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected?: boolean }>(({ theme, isSelected }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(0.5),
  borderRadius: 12,
  cursor: 'pointer',
  transition: 'all 0.2s',
  backgroundColor: isSelected ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
  border: isSelected ? '2px solid #8b5cf6' : '2px solid transparent',
  '&:hover': {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
}));

const BrushIcon = styled(Box)({
  width: 32,
  height: 48,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  paddingBottom: 4,
});

const SizeDots = styled(Box)({
  display: 'flex',
  gap: 2,
  marginTop: 4,
});

const SizeDot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'filled',
})<{ filled?: boolean }>(({ filled }) => ({
  width: 4,
  height: 4,
  borderRadius: '50%',
  backgroundColor: filled ? '#fff' : 'rgba(255,255,255,0.3)',
}));

const ColorCircle = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color' && prop !== 'isSelected',
})<{ color: string; isSelected?: boolean }>(({ color, isSelected }) => ({
  width: 48,
  height: 48,
  borderRadius: '50%',
  backgroundColor: color,
  cursor: 'pointer',
  border: isSelected ? '3px solid #fff' : '3px solid transparent',
  boxShadow: isSelected ? '0 0 0 2px #8b5cf6' : 'none',
  transition: 'all 0.2s',
  '&:hover': {
    transform: 'scale(1.1)',
  },
}));

const QuickColorButton = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color' && prop !== 'isSelected',
})<{ color: string; isSelected?: boolean }>(({ color, isSelected }) => ({
  width: 24,
  height: 24,
  borderRadius: '50%',
  backgroundColor: color,
  cursor: 'pointer',
  border: isSelected ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
  transition: 'all 0.15s',
  '&:hover': {
    transform: 'scale(1.15)',
  },
}));

// =============================================================================
// Brush Data
// =============================================================================

interface BrushDefinition {
  type: AdvancedBrushType;
  name: string;
  icon: React.ReactNode;
  tipShape: 'round' | 'chisel' | 'pointed' | 'flat';
}

const BRUSHES: BrushDefinition[] = [
  { type: 'pen', name: 'Pen', icon: <Create />, tipShape: 'round' },
  { type: 'pencil', name: 'Pencil', icon: <Edit />, tipShape: 'pointed' },
  { type: 'marker', name: 'Marker', icon: <BorderColor />, tipShape: 'chisel' },
  { type: 'brush', name: 'Brush', icon: <Brush />, tipShape: 'pointed' },
  { type: 'watercolor', name: 'Watercolor', icon: <FormatPaint />, tipShape: 'round' },
  { type: 'highlighter', name: 'Highlighter', icon: <Highlight />, tipShape: 'flat' },
  { type: 'eraser', name: 'Eraser', icon: <AutoFixHigh />, tipShape: 'round' },
];

// Quick color palette matching reference image
const QUICK_COLORS = [
  '#E85D4C', // Orange-red
  '#F5A623', // Orange
  '#F8E3C5', // Cream
  '#7ED0D8', // Light teal (main)
  '#4ABFCA', // Teal
  '#8BC9A3', // Sage green
];

// =============================================================================
// Brush Tip SVG Component
// =============================================================================

const BrushTipSVG: React.FC<{
  type: AdvancedBrushType;
  color: string;
  size: number;
}> = ({ type, color, size }) => {
  const sizeScale = 0.3 + (size / 50) * 0.7;
  
  const renderTip = () => {
    switch (type) {
      case 'pen':
        return (
          <path
            d="M16 4 L20 44 L16 48 L12 44 Z"
            fill={color}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="1"
          />
        );
      case 'pencil':
        return (
          <>
            <rect x="10" y="8" width="12" height="32" fill="#D4A574" rx="1" />
            <polygon points="16,44 10,40 22,40" fill="#2C2C2C" />
            <rect x="10" y="8" width="12" height="6" fill="#E8C97A" rx="1" />
          </>
        );
      case 'marker':
        return (
          <>
            <rect x="8" y="4" width="16" height="28" fill="#444" rx="2" />
            <rect x="10" y="32" width="12" height="12" fill={color} rx="1" />
          </>
        );
      case 'brush':
        return (
          <>
            <rect x="14" y="4" width="4" height="20" fill="#8B7355" />
            <ellipse cx="16" cy="38" rx="6" ry="12" fill={color} />
            <path
              d="M10 28 Q16 26 22 28 L20 48 Q16 50 12 48 Z"
              fill={color}
              opacity="0.8"
            />
          </>
        );
      case 'watercolor':
        return (
          <>
            <rect x="14" y="4" width="4" height="16" fill="#8B7355" />
            <ellipse cx="16" cy="35" rx="10" ry="14" fill={color} opacity="0.6" />
            <ellipse cx="16" cy="38" rx="8" ry="10" fill={color} opacity="0.4" />
          </>
        );
      case 'highlighter':
        return (
          <>
            <rect x="6" y="4" width="20" height="30" fill="#9C4B9C" rx="3" />
            <rect x="8" y="34" width="16" height="12" fill={color} opacity="0.7" rx="2" />
          </>
        );
      case 'eraser':
        return (
          <>
            <rect x="10" y="4" width="12" height="36" fill="#FFB6C1" rx="2" />
            <rect x="10" y="36" width="12" height="10" fill="#FF69B4" rx="2" />
          </>
        );
      default:
        return <circle cx="16" cy="32" r="8" fill={color} />;
    }
  };

  return (
    <svg
      width="32"
      height="48"
      viewBox="0 0 32 52"
      style={{ transform: `scale(${sizeScale})`, transformOrigin: 'bottom center' }}
    >
      {renderTip()}
    </svg>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ProBrushToolbar: React.FC<ProBrushToolbarProps> = ({
  brushConfig,
  onBrushChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onTextTool,
  onImageImport,
}) => {
  const [colorPickerAnchor, setColorPickerAnchor] = useState<HTMLElement | null>(null);
  const [sizeAnchor, setSizeAnchor] = useState<HTMLElement | null>(null);
  const [selectedBrushForSize, setSelectedBrushForSize] = useState<AdvancedBrushType | null>(null);
  const [mode, setMode] = useState<'brush' | 'size'>('brush');

  // Get size dots (3 dots showing relative size)
  const getSizeDots = useCallback((size: number): boolean[] => {
    if (size < 10) return [true, false, false];
    if (size < 25) return [true, true, false];
    return [true, true, true];
  }, []);

  const handleBrushSelect = useCallback((type: AdvancedBrushType) => {
    const preset = BRUSH_PRESETS[type] || {};
    onBrushChange({ type, ...preset });
  }, [onBrushChange]);

  const handleColorChange = useCallback((color: string) => {
    onBrushChange({ color });
  }, [onBrushChange]);

  const handleSizeChange = useCallback((_: Event, value: number | number[]) => {
    const brushType = selectedBrushForSize ?? brushConfig.type;
    onBrushChange({
      type: brushType,
      ...BRUSH_PRESETS[brushType],
      size: value as number,
    });
  }, [brushConfig.type, onBrushChange, selectedBrushForSize]);

  const handleBrushSizeClick = useCallback((event: React.MouseEvent<HTMLElement>, type: AdvancedBrushType) => {
    event.stopPropagation();
    setSelectedBrushForSize(type);
    setSizeAnchor(event.currentTarget);
  }, []);

  const handleBrushModeChange = useCallback((
    _: React.MouseEvent<HTMLElement>,
    value: 'brush' | 'size' | null
  ) => {
    if (!value) return;
    setMode(value);
  }, []);

  const sizeTargetBrush = selectedBrushForSize ?? brushConfig.type;

  return (
    <ToolbarContainer elevation={8}>
      {/* Navigation Controls */}
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Undo">
          <span>
            <IconButton
              size="small"
              onClick={onUndo}
              disabled={!canUndo}
              sx={{ color: 'rgba(255,255,255,0.87)' }}
            >
              <Undo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Redo">
          <span>
            <IconButton
              size="small"
              onClick={onRedo}
              disabled={!canRedo}
              sx={{ color: 'rgba(255,255,255,0.87)' }}
            >
              <Redo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />

      {/* Brush Selection */}
      <Stack direction="row" spacing={0.5}>
        {BRUSHES.map((brush) => (
          <Tooltip key={brush.type} title={brush.name}>
            <BrushButton
              isSelected={brushConfig.type === brush.type}
              onClick={(e) => {
                if (mode === 'size') {
                  handleBrushSizeClick(e as React.MouseEvent<HTMLElement>, brush.type);
                } else {
                  handleBrushSelect(brush.type);
                }
              }}
              onDoubleClick={(e) => handleBrushSizeClick(e as React.MouseEvent<HTMLElement>, brush.type)}
            >
              <BrushIcon>
                <BrushTipSVG
                  type={brush.type}
                  color={brush.type === 'eraser' ? '#FF69B4' : brushConfig.color}
                  size={brushConfig.size}
                />
              </BrushIcon>
              <SizeDots>
                {getSizeDots(brushConfig.type === brush.type ? brushConfig.size : 15).map((filled, i) => (
                  <SizeDot key={i} filled={filled} />
                ))}
              </SizeDots>
            </BrushButton>
          </Tooltip>
        ))}
      </Stack>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={mode}
        onChange={handleBrushModeChange}
        sx={{
          '& .MuiToggleButton-root': {
            px: 1,
            py: 0.25,
            fontSize: 10,
            color: 'rgba(255,255,255,0.9)',
          },
        }}
      >
        <ToggleButton value="brush">Brush</ToggleButton>
        <ToggleButton value="size">Size</ToggleButton>
      </ToggleButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />

      {/* Text & Image Tools */}
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Add Text">
          <IconButton
            size="small"
            onClick={onTextTool}
            sx={{ color: 'rgba(255,255,255,0.87)' }}
          >
            <TextFields />
          </IconButton>
        </Tooltip>
        <Tooltip title="Import Image">
          <IconButton
            size="small"
            onClick={onImageImport}
            sx={{ color: 'rgba(255,255,255,0.87)' }}
          >
            <CameraAlt />
          </IconButton>
        </Tooltip>
      </Stack>

      <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />

      {/* Color Wheel */}
      <Tooltip title="Color Picker">
        <ColorCircle
          color={brushConfig.color}
          onClick={(e) => setColorPickerAnchor(e.currentTarget as HTMLElement)}
        />
      </Tooltip>

      {/* Quick Colors */}
      <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ maxWidth: 120 }}>
        {QUICK_COLORS.map((color) => (
          <Tooltip key={color} title={color}>
            <QuickColorButton
              color={color}
              isSelected={brushConfig.color === color}
              onClick={() => handleColorChange(color)}
            />
          </Tooltip>
        ))}
      </Stack>

      {/* Color Picker Popover */}
      <Popover
        open={Boolean(colorPickerAnchor)}
        anchorEl={colorPickerAnchor}
        onClose={() => setColorPickerAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(30,30,40,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: 3,
            p: 2,
          },
        }}
      >
        <ColorWheelPicker
          color={brushConfig.color}
          onChange={handleColorChange}
          size={200}
        />
      </Popover>

      {/* Size Slider Popover */}
      <Popover
        open={Boolean(sizeAnchor)}
        anchorEl={sizeAnchor}
        onClose={() => setSizeAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(30,30,40,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: 2,
            p: 2,
            minWidth: 200,
          },
        }}
      >
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 1, display: 'block' }}>
          {BRUSHES.find((brush) => brush.type === sizeTargetBrush)?.name || 'Brush'} Size: {brushConfig.size}px
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1, display: 'block' }}>
          Preset flow: {Math.round((BRUSH_PRESETS[sizeTargetBrush]?.flow ?? brushConfig.flow) * 100)}% •
          Pressure {Math.round((BRUSH_PRESETS[sizeTargetBrush]?.pressureSensitivity ?? brushConfig.pressureSensitivity) * 100)}%
        </Typography>
        <Slider
          value={brushConfig.size}
          onChange={handleSizeChange}
          min={1}
          max={100}
          sx={{
            color: '#8b5cf6',
            '& .MuiSlider-thumb': {
              width: 16,
              height: 16,
            },
          }}
        />
      </Popover>
    </ToolbarContainer>
  );
};

export default ProBrushToolbar;
