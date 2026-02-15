/**
 * ColorWheelPicker - Professional circular color picker for drawing tools
 * 
 * Features:
 * - HSB color wheel
 * - Brightness/saturation control
 * - Recent colors palette
 * - Preset color swatches
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import type { FC } from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  IconButton,
  Slider,
  Popover,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';

// =============================================================================
// Types
// =============================================================================

export interface ColorWheelPickerProps {
  color: string;
  onChange: (color: string) => void;
  recentColors?: string[];
  onRecentColorAdd?: (color: string) => void;
  size?: number;
  showBrightnessSlider?: boolean;
  showPresets?: boolean;
}

interface HSB {
  h: number; // 0-360
  s: number; // 0-100
  b: number; // 0-100
}

// =============================================================================
// Color Utilities
// =============================================================================

function hexToHsb(hex: string): HSB {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : (d / max) * 100;
  const brightness = max * 100;

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }

  return { h, s, b: brightness };
}

function hsbToHex(hsb: HSB): string {
  const h = hsb.h / 360;
  const s = hsb.s / 100;
  const b = hsb.b / 100;

  let r = 0, g = 0, bl = 0;

  if (s === 0) {
    r = g = bl = b;
  } else {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = b * (1 - s);
    const q = b * (1 - f * s);
    const t = b * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0: r = b; g = t; bl = p; break;
      case 1: r = q; g = b; bl = p; break;
      case 2: r = p; g = b; bl = t; break;
      case 3: r = p; g = q; bl = b; break;
      case 4: r = t; g = p; bl = b; break;
      case 5: r = b; g = p; bl = q; break;
    }
  }

  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

// =============================================================================
// Styled Components
// =============================================================================

const WheelCanvas = styled('canvas')({
  cursor: 'crosshair',
  borderRadius: '50%',
});

const TriangleCanvas = styled('canvas')({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  cursor: 'crosshair',
});

const ColorPreview = styled(Box)<{ bgcolor: string }>(({ bgcolor }) => ({
  width: 48,
  height: 48,
  borderRadius: '50%',
  backgroundColor: bgcolor,
  border: '3px solid rgba(255,255,255,0.3)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
}));

const SwatchButton = styled(IconButton)<{ swatchColor: string; isSelected?: boolean }>(
  ({ swatchColor, isSelected }) => ({
    width: 28,
    height: 28,
    padding: 0,
    backgroundColor: swatchColor,
    border: isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
    '&:hover': {
      backgroundColor: swatchColor,
      transform: 'scale(1.1)',
    },
  })
);

// =============================================================================
// Preset Colors
// =============================================================================

const PRESET_COLORS = [
  // Warm colors
  '#ff4444', '#ff8844', '#ffcc44', '#ffee44',
  // Cool colors
  '#44ff44', '#44ffcc', '#44ccff', '#4488ff',
  // Purple/Pink
  '#8844ff', '#cc44ff', '#ff44cc', '#ff4488',
  // Neutrals
  '#ffffff', '#cccccc', '#888888', '#444444', '#000000',
  // Skin tones
  '#ffe0bd', '#e5c298', '#c68642', '#8d5524',
];

// =============================================================================
// Main Component
// =============================================================================

export const ColorWheelPicker: FC<ColorWheelPickerProps> = ({
  color,
  onChange,
  recentColors = [],
  onRecentColorAdd,
  size = 200,
  showBrightnessSlider = true,
  showPresets = true,
}) => {
  const wheelRef = useRef<HTMLCanvasElement>(null);
  const [hsb, setHsb] = useState<HSB>(() => hexToHsb(color));
  const [isDragging, setIsDragging] = useState(false);

  // Draw the color wheel
  useEffect(() => {
    const canvas = wheelRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = size / 2 - 4;
    const innerRadius = outerRadius * 0.65;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Draw color wheel ring
    for (let angle = 0; angle < 360; angle += 0.5) {
      const startAngle = (angle - 0.5) * (Math.PI / 180);
      const endAngle = (angle + 0.5) * (Math.PI / 180);

      ctx.beginPath();
      ctx.moveTo(
        centerX + innerRadius * Math.cos(startAngle),
        centerY + innerRadius * Math.sin(startAngle)
      );
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();

      // Create gradient for saturation
      const gradient = ctx.createRadialGradient(
        centerX, centerY, innerRadius,
        centerX, centerY, outerRadius
      );
      const hue = angle;
      gradient.addColorStop(0, `hsl(${hue}, 30%, ${hsb.b / 2 + 25}%)`);
      gradient.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
      
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }

    // Draw center saturation/brightness area
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, innerRadius - 10
    );
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.5, hsbToHex({ h: hsb.h, s: 50, b: hsb.b }));
    gradient.addColorStop(1, hsbToHex({ h: hsb.h, s: 100, b: hsb.b }));

    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius - 10, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw hue indicator on wheel
    const hueAngle = (hsb.h - 90) * (Math.PI / 180);
    const indicatorRadius = (outerRadius + innerRadius) / 2;
    const indicatorX = centerX + indicatorRadius * Math.cos(hueAngle);
    const indicatorY = centerY + indicatorRadius * Math.sin(hueAngle);

    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = hsbToHex({ h: hsb.h, s: 100, b: 100 });
    ctx.fill();

    // Draw saturation indicator in center
    const satRadius = (hsb.s / 100) * (innerRadius - 15);
    const satX = centerX + satRadius * Math.cos(hueAngle);
    const satY = centerY + satRadius * Math.sin(hueAngle);

    ctx.beginPath();
    ctx.arc(satX, satY, 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = hsbToHex(hsb);
    ctx.fill();

  }, [size, hsb]);

  // Handle wheel interaction
  const handleWheelInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = wheelRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left - size / 2;
    const y = clientY - rect.top - size / 2;
    const distance = Math.sqrt(x * x + y * y);
    const angle = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;

    const outerRadius = size / 2 - 4;
    const innerRadius = outerRadius * 0.65;

    if (distance >= innerRadius && distance <= outerRadius) {
      // Clicked on hue ring
      const newHsb = { ...hsb, h: angle };
      setHsb(newHsb);
      onChange(hsbToHex(newHsb));
    } else if (distance < innerRadius - 10) {
      // Clicked on saturation area
      const sat = Math.min(100, (distance / (innerRadius - 15)) * 100);
      const newHsb = { ...hsb, s: sat };
      setHsb(newHsb);
      onChange(hsbToHex(newHsb));
    }
  }, [hsb, onChange, size]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleWheelInteraction(e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleWheelInteraction(e);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onRecentColorAdd?.(hsbToHex(hsb));
    }
  };

  // Handle brightness change
  const handleBrightnessChange = (_: Event, value: number | number[]) => {
    const newHsb = { ...hsb, b: value as number };
    setHsb(newHsb);
    onChange(hsbToHex(newHsb));
  };

  // Handle preset color selection
  const handlePresetClick = (presetColor: string) => {
    const newHsb = hexToHsb(presetColor);
    setHsb(newHsb);
    onChange(presetColor);
    onRecentColorAdd?.(presetColor);
  };

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: '#1a1a2e',
        borderRadius: 3,
        width: size + 40,
      }}
    >
      <Stack spacing={2} alignItems="center">
        {/* Color Preview */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
          <ColorPreview bgcolor={hsbToHex(hsb)} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              Current Color
            </Typography>
            <Typography variant="body2" sx={{ color: '#fff', fontFamily: 'monospace' }}>
              {hsbToHex(hsb).toUpperCase()}
            </Typography>
          </Box>
        </Stack>

        {/* Color Wheel */}
        <Box sx={{ position: 'relative' }}>
          <WheelCanvas
            ref={wheelRef}
            width={size}
            height={size}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={(e) => { setIsDragging(true); handleWheelInteraction(e); }}
            onTouchMove={handleWheelInteraction}
            onTouchEnd={() => { setIsDragging(false); onRecentColorAdd?.(hsbToHex(hsb)); }}
          />
        </Box>

        {/* Brightness Slider */}
        {showBrightnessSlider && (
          <Box sx={{ width: '100%', px: 1 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
              Brightness
            </Typography>
            <Slider
              value={hsb.b}
              onChange={handleBrightnessChange}
              min={0}
              max={100}
              sx={{
                color: '#8b5cf6',
                '& .MuiSlider-track': {
                  background: `linear-gradient(to right, #000, ${hsbToHex({ ...hsb, b: 100 })})`,
                },
              }}
            />
          </Box>
        )}

        {/* Recent Colors */}
        {recentColors.length > 0 && (
          <Box sx={{ width: '100%' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 0.5, display: 'block' }}>
              Recent
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {recentColors.slice(0, 8).map((recentColor, i) => (
                <SwatchButton
                  key={i}
                  swatchColor={recentColor}
                  isSelected={recentColor === hsbToHex(hsb)}
                  onClick={() => handlePresetClick(recentColor)}
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Preset Colors */}
        {showPresets && (
          <Box sx={{ width: '100%' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)', mb: 0.5, display: 'block' }}>
              Presets
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.5 }}>
              {PRESET_COLORS.map((presetColor) => (
                <SwatchButton
                  key={presetColor}
                  swatchColor={presetColor}
                  isSelected={presetColor === hsbToHex(hsb)}
                  onClick={() => handlePresetClick(presetColor)}
                />
              ))}
            </Box>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

// =============================================================================
// Compact Color Picker (for toolbar)
// =============================================================================

export interface CompactColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  size?: number;
}

export const CompactColorPicker: React.FC<CompactColorPickerProps> = ({
  color,
  onChange,
  size = 32,
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [recentColors, setRecentColors] = useState<string[]>([]);

  const handleRecentColorAdd = (newColor: string) => {
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c !== newColor);
      return [newColor, ...filtered].slice(0, 8);
    });
  };

  return (
    <>
      <Tooltip title="Color">
        <IconButton
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            width: size,
            height: size,
            bgcolor: color,
            border: '2px solid rgba(255,255,255,0.3)',
            '&:hover': { bgcolor: color, transform: 'scale(1.1)' },
          }}
        />
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        PaperProps={{
          sx: { bgcolor: 'transparent', boxShadow: 'none', overflow: 'visible' },
        }}
      >
        <ColorWheelPicker
          color={color}
          onChange={onChange}
          recentColors={recentColors}
          onRecentColorAdd={handleRecentColorAdd}
          size={180}
        />
      </Popover>
    </>
  );
};

export default ColorWheelPicker;
