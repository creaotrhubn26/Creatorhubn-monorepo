/**
 * OnionSkinning - Show previous/next storyboard frames as ghost layers
 * 
 * Features:
 * - Configurable number of frames before/after
 * - Adjustable opacity per frame
 * - Color tinting (red for previous, green for next)
 * - Toggle on/off
 * - Frame range control
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Tooltip,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  Remove,
  Add,
  Opacity,
  ColorLens,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// =============================================================================
// Types
// =============================================================================

export interface OnionSkinSettings {
  enabled: boolean;
  framesBefore: number;      // Number of previous frames to show
  framesAfter: number;       // Number of next frames to show
  opacityBefore: number;     // Base opacity for previous frames (0-1)
  opacityAfter: number;      // Base opacity for next frames (0-1)
  opacityFalloff: number;    // How quickly opacity decreases (0-1)
  colorBefore: string;       // Tint color for previous frames
  colorAfter: string;        // Tint color for next frames
  showOutlineOnly: boolean;  // Show only outlines instead of filled
  blendMode: string;         // Blend mode for onion skin layers
}

export interface OnionFrame {
  index: number;
  offset: number;     // -3, -2, -1, 1, 2, 3 etc.
  opacity: number;
  color: string;
  imageData?: ImageData | HTMLCanvasElement;
}

export interface OnionSkinningProps {
  settings: OnionSkinSettings;
  onSettingsChange: (settings: OnionSkinSettings) => void;
  currentFrameIndex: number;
  totalFrames: number;
  getFrameImage: (index: number) => HTMLCanvasElement | null;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_ONION_SKIN_SETTINGS: OnionSkinSettings = {
  enabled: false,
  framesBefore: 2,
  framesAfter: 1,
  opacityBefore: 0.3,
  opacityAfter: 0.2,
  opacityFalloff: 0.5,
  colorBefore: '#ef4444',   // Red
  colorAfter: '#22c55e',    // Green
  showOutlineOnly: false,
  blendMode: 'multiply',
};

// =============================================================================
// Styled Components
// =============================================================================

const OnionContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  backdropFilter: 'blur(12px)',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
  minWidth: 260,
}));

const FrameIndicator = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'type' && prop !== 'active',
})<{ type: 'before' | 'current' | 'after'; active?: boolean }>(({ type, active }) => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 600,
  backgroundColor: 
    type === 'current' ? 'rgba(59, 130, 246, 0.4)' :
    type === 'before' ? (active ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.1)') :
    (active ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255,255,255,0.1)'),
  border: `2px solid ${
    type === 'current' ? '#3b82f6' :
    type === 'before' ? (active ? '#ef4444' : 'transparent') :
    (active ? '#22c55e' : 'transparent')
  }`,
  color: active || type === 'current' ? '#fff' : 'rgba(255,255,255,0.4)',
  transition: 'all 0.15s',
}));

const ColorSwatch = styled(Box)<{ color: string }>(({ color }) => ({
  width: 20,
  height: 20,
  borderRadius: 4,
  backgroundColor: color,
  border: '2px solid rgba(255,255,255,0.3)',
  cursor: 'pointer',
}));

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate opacity for a specific frame offset
 */
export function calculateOnionOpacity(
  offset: number,
  settings: OnionSkinSettings
): number {
  const absOffset = Math.abs(offset);
  const baseOpacity = offset < 0 ? settings.opacityBefore : settings.opacityAfter;
  
  // Apply falloff: farther frames are more transparent
  const falloff = Math.pow(1 - settings.opacityFalloff, absOffset - 1);
  
  return baseOpacity * falloff;
}

/**
 * Get all onion frames to render
 */
export function getOnionFrames(
  currentIndex: number,
  totalFrames: number,
  settings: OnionSkinSettings
): OnionFrame[] {
  if (!settings.enabled) return [];
  
  const frames: OnionFrame[] = [];
  
  // Previous frames
  for (let i = settings.framesBefore; i >= 1; i--) {
    const index = currentIndex - i;
    if (index >= 0) {
      frames.push({
        index,
        offset: -i,
        opacity: calculateOnionOpacity(-i, settings),
        color: settings.colorBefore,
      });
    }
  }
  
  // Next frames
  for (let i = 1; i <= settings.framesAfter; i++) {
    const index = currentIndex + i;
    if (index < totalFrames) {
      frames.push({
        index,
        offset: i,
        opacity: calculateOnionOpacity(i, settings),
        color: settings.colorAfter,
      });
    }
  }
  
  return frames;
}

/**
 * Render onion skin overlays on a canvas
 */
export function renderOnionSkins(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frames: OnionFrame[],
  getFrameImage: (index: number) => HTMLCanvasElement | null,
  settings: OnionSkinSettings
): void {
  // Sort by absolute offset (render farther frames first)
  const sortedFrames = [...frames].sort(
    (a, b) => Math.abs(b.offset) - Math.abs(a.offset)
  );
  
  for (const frame of sortedFrames) {
    const image = getFrameImage(frame.index);
    if (!image) continue;
    
    ctx.save();
    ctx.globalAlpha = frame.opacity;
    ctx.globalCompositeOperation = settings.blendMode as GlobalCompositeOperation;
    
    // Draw the frame
    ctx.drawImage(image, 0, 0, width, height);
    
    // Apply color tint
    if (frame.color && !settings.showOutlineOnly) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = frame.color + '40'; // 25% alpha
      ctx.fillRect(0, 0, width, height);
    }
    
    ctx.restore();
  }
}

// =============================================================================
// Component
// =============================================================================

export const OnionSkinning: React.FC<OnionSkinningProps> = ({
  settings,
  onSettingsChange,
  currentFrameIndex,
  totalFrames,
  getFrameImage,
}) => {
  const [colorPickerOpen, setColorPickerOpen] = useState<'before' | 'after' | null>(null);

  const updateSettings = useCallback((updates: Partial<OnionSkinSettings>) => {
    onSettingsChange({ ...settings, ...updates });
  }, [settings, onSettingsChange]);

  // Generate frame indicators
  const frameIndicators = useMemo(() => {
    const indicators: Array<{ type: 'before' | 'current' | 'after'; offset: number; active: boolean }> = [];
    
    // Previous frames
    for (let i = 3; i >= 1; i--) {
      const frameIndex = currentFrameIndex - i;
      indicators.push({
        type: 'before',
        offset: -i,
        active: settings.enabled && i <= settings.framesBefore && frameIndex >= 0,
      });
    }
    
    // Current
    indicators.push({ type: 'current', offset: 0, active: true });
    
    // Next frames
    for (let i = 1; i <= 3; i++) {
      const frameIndex = currentFrameIndex + i;
      indicators.push({
        type: 'after',
        offset: i,
        active: settings.enabled && i <= settings.framesAfter && frameIndex < totalFrames,
      });
    }
    
    return indicators;
  }, [currentFrameIndex, totalFrames, settings]);

  // Preview frames for visualization
  const onionFrames = useMemo(() => 
    getOnionFrames(currentFrameIndex, totalFrames, settings),
    [currentFrameIndex, totalFrames, settings]
  );

  return (
    <OnionContainer>
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Layers sx={{ fontSize: 18, color: settings.enabled ? 'primary.main' : 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Onion Skinning
            </Typography>
          </Stack>
          <Switch
            size="small"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
          />
        </Stack>
      </Box>

      {/* Frame timeline visualization */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" justifyContent="center" spacing={0.5}>
          {frameIndicators.map((indicator, index) => (
            <FrameIndicator
              key={index}
              type={indicator.type}
              active={indicator.active}
            >
              {indicator.offset === 0 ? '●' : (
                indicator.offset > 0 ? `+${indicator.offset}` : indicator.offset
              )}
            </FrameIndicator>
          ))}
        </Stack>
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1, color: 'text.secondary' }}>
          Frame {currentFrameIndex + 1} of {totalFrames}
        </Typography>
      </Box>

      {/* Settings */}
      <Box sx={{ p: 1.5, opacity: settings.enabled ? 1 : 0.5 }}>
        {/* Frames before */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <ChevronLeft sx={{ fontSize: 16, color: '#ef4444' }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>
              Previous Frames
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <IconButton 
              size="small" 
              onClick={() => updateSettings({ framesBefore: Math.max(0, settings.framesBefore - 1) })}
              disabled={!settings.enabled}
            >
              <Remove sx={{ fontSize: 14 }} />
            </IconButton>
            <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center' }}>
              {settings.framesBefore}
            </Typography>
            <IconButton 
              size="small" 
              onClick={() => updateSettings({ framesBefore: Math.min(5, settings.framesBefore + 1) })}
              disabled={!settings.enabled}
            >
              <Add sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
        </Stack>

        {/* Frames after */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <ChevronRight sx={{ fontSize: 16, color: '#22c55e' }} />
            <Typography variant="body2" sx={{ fontSize: 12 }}>
              Next Frames
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <IconButton 
              size="small" 
              onClick={() => updateSettings({ framesAfter: Math.max(0, settings.framesAfter - 1) })}
              disabled={!settings.enabled}
            >
              <Remove sx={{ fontSize: 14 }} />
            </IconButton>
            <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center' }}>
              {settings.framesAfter}
            </Typography>
            <IconButton 
              size="small" 
              onClick={() => updateSettings({ framesAfter: Math.min(5, settings.framesAfter + 1) })}
              disabled={!settings.enabled}
            >
              <Add sx={{ fontSize: 14 }} />
            </IconButton>
          </Stack>
        </Stack>

        <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Opacity before */}
        <Box sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="caption" sx={{ color: '#ef4444' }}>
              Previous Opacity
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {Math.round(settings.opacityBefore * 100)}%
            </Typography>
          </Stack>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.05}
            value={settings.opacityBefore}
            onChange={(_, v) => updateSettings({ opacityBefore: v as number })}
            disabled={!settings.enabled}
            sx={{ 
              '& .MuiSlider-thumb': { bgcolor: '#ef4444' },
              '& .MuiSlider-track': { bgcolor: '#ef4444' },
            }}
          />
        </Box>

        {/* Opacity after */}
        <Box sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="caption" sx={{ color: '#22c55e' }}>
              Next Opacity
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {Math.round(settings.opacityAfter * 100)}%
            </Typography>
          </Stack>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.05}
            value={settings.opacityAfter}
            onChange={(_, v) => updateSettings({ opacityAfter: v as number })}
            disabled={!settings.enabled}
            sx={{ 
              '& .MuiSlider-thumb': { bgcolor: '#22c55e' },
              '& .MuiSlider-track': { bgcolor: '#22c55e' },
            }}
          />
        </Box>

        {/* Falloff */}
        <Box sx={{ mb: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="caption">
              Opacity Falloff
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {Math.round(settings.opacityFalloff * 100)}%
            </Typography>
          </Stack>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.05}
            value={settings.opacityFalloff}
            onChange={(_, v) => updateSettings({ opacityFalloff: v as number })}
            disabled={!settings.enabled}
          />
        </Box>

        <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Colors */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="caption">Tint Colors</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Previous frame color">
              <ColorSwatch 
                color={settings.colorBefore} 
                onClick={() => setColorPickerOpen('before')}
              />
            </Tooltip>
            <Tooltip title="Next frame color">
              <ColorSwatch 
                color={settings.colorAfter}
                onClick={() => setColorPickerOpen('after')}
              />
            </Tooltip>
          </Stack>
        </Stack>

        {/* Outline only toggle */}
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={settings.showOutlineOnly}
              onChange={(e) => updateSettings({ showOutlineOnly: e.target.checked })}
              disabled={!settings.enabled}
            />
          }
          label={<Typography variant="caption">Show outlines only</Typography>}
          sx={{ mt: 1 }}
        />
      </Box>

      {/* Preview of active onion frames */}
      {settings.enabled && onionFrames.length > 0 && (
        <Box sx={{ p: 1.5, pt: 0 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
            Active Onion Frames:
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap">
            {onionFrames.map(frame => (
              <Box
                key={frame.offset}
                sx={{
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: frame.color + '30',
                  border: `1px solid ${frame.color}`,
                  fontSize: 10,
                }}
              >
                {frame.offset > 0 ? '+' : ''}{frame.offset} ({Math.round(frame.opacity * 100)}%)
              </Box>
            ))}
          </Stack>
        </Box>
      )}
    </OnionContainer>
  );
};

export default OnionSkinning;
