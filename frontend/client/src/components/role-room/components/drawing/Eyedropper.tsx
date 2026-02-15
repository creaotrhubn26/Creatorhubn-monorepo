/**
 * Eyedropper - Sample colors from the canvas
 * 
 * Features:
 * - Pick color from any point on canvas
 * - Magnified preview under cursor
 * - Recent colors history
 * - Copy hex code to clipboard
 * - Works with Apple Pencil and touch
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  Colorize,
  ContentCopy,
  History,
  Check,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// =============================================================================
// Types
// =============================================================================

export interface SampledColor {
  hex: string;
  r: number;
  g: number;
  b: number;
  a: number;
  timestamp: number;
}

export interface EyedropperProps {
  canvas: HTMLCanvasElement | null;
  onColorPick: (color: string) => void;
  isActive: boolean;
  onActiveChange: (active: boolean) => void;
  recentColors?: SampledColor[];
  onRecentColorsChange?: (colors: SampledColor[]) => void;
}

export interface EyedropperCursorProps {
  x: number;
  y: number;
  color: string;
  zoom: number;
  canvas: HTMLCanvasElement;
}

// =============================================================================
// Constants
// =============================================================================

const MAX_RECENT_COLORS = 12;
const MAGNIFIER_SIZE = 120;
const MAGNIFIER_ZOOM = 8;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get pixel color at specific coordinates
 */
export function getPixelColor(
  canvas: HTMLCanvasElement,
  x: number,
  y: number
): SampledColor | null {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Get single pixel
    const imageData = ctx.getImageData(x, y, 1, 1);
    const [r, g, b, a] = imageData.data;
    
    // Convert to hex
    const hex = rgbToHex(r, g, b);
    
    return {
      hex,
      r,
      g,
      b,
      a: a / 255,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Get average color in a small area (for more stable sampling)
 */
export function getAverageColor(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number = 2
): SampledColor | null {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    const size = radius * 2 + 1;
    const startX = Math.max(0, Math.floor(x) - radius);
    const startY = Math.max(0, Math.floor(y) - radius);
    
    const imageData = ctx.getImageData(startX, startY, size, size);
    
    let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
    const pixelCount = size * size;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      totalR += imageData.data[i];
      totalG += imageData.data[i + 1];
      totalB += imageData.data[i + 2];
      totalA += imageData.data[i + 3];
    }
    
    const r = Math.round(totalR / pixelCount);
    const g = Math.round(totalG / pixelCount);
    const b = Math.round(totalB / pixelCount);
    const a = (totalA / pixelCount) / 255;
    
    return {
      hex: rgbToHex(r, g, b),
      r, g, b, a,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Get luminance of a color (for contrast calculation)
 */
function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// =============================================================================
// Styled Components
// =============================================================================

const EyedropperContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  backdropFilter: 'blur(12px)',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
  minWidth: 200,
}));

const ColorSwatch = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ color: string; selected?: boolean }>(({ color, selected }) => ({
  width: 28,
  height: 28,
  borderRadius: 6,
  backgroundColor: color,
  cursor: 'pointer',
  border: selected 
    ? '3px solid #3b82f6' 
    : '2px solid rgba(255,255,255,0.2)',
  transition: 'transform 0.15s, border-color 0.15s',
  '&:hover': {
    transform: 'scale(1.1)',
    borderColor: 'rgba(255,255,255,0.5)',
  },
}));

const MagnifierOverlay = styled(Box)({
  position: 'fixed',
  pointerEvents: 'none',
  zIndex: 9999,
  borderRadius: '50%',
  border: '3px solid white',
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  overflow: 'hidden',
});

const CrosshairOverlay = styled(Box)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: 12,
  height: 12,
  transform: 'translate(-50%, -50%)',
  border: '2px solid white',
  borderRadius: '50%',
  boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
});

// =============================================================================
// Magnifier Component
// =============================================================================

const EyedropperMagnifier: React.FC<EyedropperCursorProps> = ({
  x, y, color, zoom, canvas,
}) => {
  const magnifierRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!magnifierRef.current) return;
    
    const ctx = magnifierRef.current.getContext('2d');
    if (!ctx) return;
    
    const size = MAGNIFIER_SIZE;
    const sourceSize = size / zoom;
    
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);
    
    // Draw zoomed portion of canvas
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      canvas,
      x - sourceSize / 2,
      y - sourceSize / 2,
      sourceSize,
      sourceSize,
      0,
      0,
      size,
      size
    );
    
    // Draw grid
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    const cellSize = size / sourceSize;
    
    for (let i = 0; i <= sourceSize; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, size);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(size, i * cellSize);
      ctx.stroke();
    }
  }, [x, y, zoom, canvas]);

  const luminance = useMemo(() => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return getLuminance(r, g, b);
  }, [color]);

  return (
    <MagnifierOverlay
      style={{
        left: x + 30,
        top: y - MAGNIFIER_SIZE / 2,
        width: MAGNIFIER_SIZE,
        height: MAGNIFIER_SIZE,
      }}
    >
      <canvas 
        ref={magnifierRef} 
        width={MAGNIFIER_SIZE} 
        height={MAGNIFIER_SIZE}
        style={{ borderRadius: '50%' }}
      />
      <CrosshairOverlay sx={{ 
        borderColor: luminance > 0.5 ? 'black' : 'white',
      }} />
      {/* Color preview bar */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 24,
          bgcolor: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography 
          variant="caption" 
          sx={{ 
            fontFamily: 'monospace', 
            fontWeight: 600,
            color: luminance > 0.5 ? 'black' : 'white',
            textShadow: luminance > 0.5 
              ? '0 1px 1px rgba(255,255,255,0.5)' 
              : '0 1px 1px rgba(0,0,0,0.5)',
          }}
        >
          {color.toUpperCase()}
        </Typography>
      </Box>
    </MagnifierOverlay>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const Eyedropper: React.FC<EyedropperProps> = ({
  canvas,
  onColorPick,
  isActive,
  onActiveChange,
  recentColors = [],
  onRecentColorsChange,
}) => {
  const [currentColor, setCurrentColor] = useState<SampledColor | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  // Handle pointer move over canvas
  useEffect(() => {
    if (!canvas || !isActive) return;
    
    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
      const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
      
      setCursorPosition({ x: e.clientX, y: e.clientY });
      setShowMagnifier(true);
      
      const color = getPixelColor(canvas, x, y);
      if (color) {
        setCurrentColor(color);
      }
    };
    
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // Only left click
      
      const rect = canvas.getBoundingClientRect();
      const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
      const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
      
      const color = getPixelColor(canvas, x, y);
      if (color) {
        onColorPick(color.hex);
        
        // Add to recent colors
        if (onRecentColorsChange) {
          const newRecent = [color, ...recentColors.filter(c => c.hex !== color.hex)]
            .slice(0, MAX_RECENT_COLORS);
          onRecentColorsChange(newRecent);
        }
        
        // Deactivate eyedropper after picking
        onActiveChange(false);
      }
    };
    
    const handlePointerLeave = () => {
      setShowMagnifier(false);
    };
    
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerleave', handlePointerLeave);
    
    // Change cursor
    canvas.style.cursor = 'crosshair';
    
    return () => {
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
      canvas.style.cursor = '';
    };
  }, [canvas, isActive, onColorPick, onActiveChange, recentColors, onRecentColorsChange]);

  const handleCopyHex = useCallback((hex: string) => {
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedHex(hex);
      setTimeout(() => setCopiedHex(null), 1500);
    });
  }, []);

  const handleRecentColorClick = useCallback((color: SampledColor) => {
    onColorPick(color.hex);
  }, [onColorPick]);

  return (
    <>
      {/* Magnifier overlay (when active) */}
      {isActive && showMagnifier && canvas && currentColor && (
        <EyedropperMagnifier
          x={cursorPosition.x}
          y={cursorPosition.y}
          color={currentColor.hex}
          zoom={MAGNIFIER_ZOOM}
          canvas={canvas}
        />
      )}

      {/* Panel */}
      <EyedropperContainer>
        {/* Header */}
        <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" gap={1}>
              <Colorize sx={{ fontSize: 18, color: isActive ? 'primary.main' : 'text.secondary' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Eyedropper
              </Typography>
            </Stack>
            <IconButton
              size="small"
              onClick={() => onActiveChange(!isActive)}
              sx={{
                bgcolor: isActive ? 'primary.main' : 'transparent',
                '&:hover': { bgcolor: isActive ? 'primary.dark' : 'rgba(255,255,255,0.1)' },
              }}
            >
              <Colorize sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
        </Box>

        {/* Current color preview */}
        {currentColor && (
          <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: currentColor.hex,
                  border: '2px solid rgba(255,255,255,0.3)',
                  boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.2)',
                }}
              />
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Typography 
                    variant="body2" 
                    sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                  >
                    {currentColor.hex.toUpperCase()}
                  </Typography>
                  <Tooltip title={copiedHex === currentColor.hex ? 'Copied!' : 'Copy'}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleCopyHex(currentColor.hex)}
                    >
                      {copiedHex === currentColor.hex ? (
                        <Check sx={{ fontSize: 14, color: 'success.main' }} />
                      ) : (
                        <ContentCopy sx={{ fontSize: 14 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  R:{currentColor.r} G:{currentColor.g} B:{currentColor.b}
                </Typography>
              </Box>
            </Stack>
          </Box>
        )}

        {/* Instructions */}
        {isActive && (
          <Box sx={{ p: 1.5, bgcolor: 'rgba(59,130,246,0.1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Click on the canvas to pick a color
            </Typography>
          </Box>
        )}

        {/* Recent colors */}
        {recentColors.length > 0 && (
          <Box sx={{ p: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
              <History sx={{ fontSize: 14, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Recent Colors
              </Typography>
            </Stack>
            <Box sx={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(6, 1fr)', 
              gap: 0.5 
            }}>
              {recentColors.map((color, index) => (
                <Tooltip key={index} title={color.hex.toUpperCase()}>
                  <ColorSwatch
                    color={color.hex}
                    onClick={() => handleRecentColorClick(color)}
                    selected={currentColor?.hex === color.hex}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        )}

        {/* Empty state */}
        {recentColors.length === 0 && !currentColor && (
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Colorize sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Click the eyedropper button to start sampling colors
            </Typography>
          </Box>
        )}
      </EyedropperContainer>
    </>
  );
};

export default Eyedropper;
