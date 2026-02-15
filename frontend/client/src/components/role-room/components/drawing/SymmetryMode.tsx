/**
 * SymmetryMode - Mirror/symmetry drawing for balanced compositions
 * 
 * Features:
 * - Vertical symmetry (left-right mirror)
 * - Horizontal symmetry (top-bottom mirror)
 * - Radial symmetry (kaleidoscope)
 * - Adjustable symmetry axis position
 * - Real-time preview
 */

import React, { useState, useCallback } from 'react';
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
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  FlipCameraAndroid,
  Flip,
  AutoAwesome,
  RotateRight,
  CenterFocusStrong,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { PencilPoint } from '../../hooks/useApplePencil';

// =============================================================================
// Types
// =============================================================================

export type SymmetryType = 'none' | 'vertical' | 'horizontal' | 'both' | 'radial';

export interface SymmetrySettings {
  type: SymmetryType;
  enabled: boolean;
  axisX: number; // 0-1 normalized position
  axisY: number;
  radialSegments: number; // 2-16 for radial symmetry
  showGuides: boolean;
}

export interface SymmetryModeProps {
  settings: SymmetrySettings;
  onSettingsChange: (settings: Partial<SymmetrySettings>) => void;
  canvasWidth: number;
  canvasHeight: number;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_SYMMETRY_SETTINGS: SymmetrySettings = {
  type: 'none',
  enabled: false,
  axisX: 0.5,
  axisY: 0.5,
  radialSegments: 6,
  showGuides: true,
};

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

const SymmetryButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ active }) => ({
  borderRadius: 6,
  padding: 6,
  backgroundColor: active ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
  border: active ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid transparent',
  '&:hover': {
    backgroundColor: active ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255,255,255,0.1)',
  },
}));

// =============================================================================
// Symmetry Functions
// =============================================================================

/**
 * Get mirrored points based on symmetry settings
 */
export function getMirroredPoints(
  points: PencilPoint[],
  settings: SymmetrySettings,
  canvasWidth: number,
  canvasHeight: number
): PencilPoint[][] {
  if (!settings.enabled || settings.type === 'none') {
    return [points];
  }

  const axisX = settings.axisX * canvasWidth;
  const axisY = settings.axisY * canvasHeight;
  const mirroredSets: PencilPoint[][] = [points];

  switch (settings.type) {
    case 'vertical':
      mirroredSets.push(points.map(p => ({
        ...p,
        x: 2 * axisX - p.x,
      })));
      break;

    case 'horizontal':
      mirroredSets.push(points.map(p => ({
        ...p,
        y: 2 * axisY - p.y,
      })));
      break;

    case 'both':
      // Vertical mirror
      mirroredSets.push(points.map(p => ({
        ...p,
        x: 2 * axisX - p.x,
      })));
      // Horizontal mirror
      mirroredSets.push(points.map(p => ({
        ...p,
        y: 2 * axisY - p.y,
      })));
      // Both mirrors (diagonal)
      mirroredSets.push(points.map(p => ({
        ...p,
        x: 2 * axisX - p.x,
        y: 2 * axisY - p.y,
      })));
      break;

    case 'radial':
      const segments = settings.radialSegments;
      const angleStep = (Math.PI * 2) / segments;
      
      for (let i = 1; i < segments; i++) {
        const angle = angleStep * i;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        mirroredSets.push(points.map(p => {
          const dx = p.x - axisX;
          const dy = p.y - axisY;
          return {
            ...p,
            x: axisX + dx * cos - dy * sin,
            y: axisY + dx * sin + dy * cos,
          };
        }));
      }
      break;
  }

  return mirroredSets;
}

/**
 * Draw symmetry guide lines on canvas
 */
export function drawSymmetryGuides(
  ctx: CanvasRenderingContext2D,
  settings: SymmetrySettings,
  canvasWidth: number,
  canvasHeight: number
) {
  if (!settings.enabled || !settings.showGuides || settings.type === 'none') {
    return;
  }

  const axisX = settings.axisX * canvasWidth;
  const axisY = settings.axisY * canvasHeight;

  ctx.save();
  ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([8, 4]);

  switch (settings.type) {
    case 'vertical':
      ctx.beginPath();
      ctx.moveTo(axisX, 0);
      ctx.lineTo(axisX, canvasHeight);
      ctx.stroke();
      break;
    
    case 'both':
      ctx.beginPath();
      ctx.moveTo(axisX, 0);
      ctx.lineTo(axisX, canvasHeight);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, axisY);
      ctx.lineTo(canvasWidth, axisY);
      ctx.stroke();
      break;
    
    case 'horizontal':
      ctx.beginPath();
      ctx.moveTo(0, axisY);
      ctx.lineTo(canvasWidth, axisY);
      ctx.stroke();
      break;

    case 'radial':
      const segments = settings.radialSegments;
      const angleStep = (Math.PI * 2) / segments;
      const radius = Math.max(canvasWidth, canvasHeight);
      
      for (let i = 0; i < segments; i++) {
        const angle = angleStep * i;
        ctx.beginPath();
        ctx.moveTo(axisX, axisY);
        ctx.lineTo(
          axisX + Math.cos(angle) * radius,
          axisY + Math.sin(angle) * radius
        );
        ctx.stroke();
      }
      
      // Center circle
      ctx.beginPath();
      ctx.arc(axisX, axisY, 8, 0, Math.PI * 2);
      ctx.stroke();
      break;
  }

  ctx.restore();
}

// =============================================================================
// Component
// =============================================================================

export const SymmetryMode: React.FC<SymmetryModeProps> = ({
  settings,
  onSettingsChange,
  canvasWidth,
  canvasHeight,
}) => {
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);

  const handleTypeChange = useCallback((type: SymmetryType) => {
    onSettingsChange({
      type,
      enabled: type !== 'none',
    });
  }, [onSettingsChange]);

  return (
    <ToolbarContainer>
      <Tooltip title="Symmetry Off" placement="top">
        <SymmetryButton
          active={settings.type === 'none'}
          onClick={() => handleTypeChange('none')}
        >
          <Typography sx={{ fontSize: 12, fontWeight: 600 }}>OFF</Typography>
        </SymmetryButton>
      </Tooltip>

      <Tooltip title="Vertical Symmetry" placement="top">
        <SymmetryButton
          active={settings.type === 'vertical'}
          onClick={() => handleTypeChange('vertical')}
        >
          <Flip sx={{ fontSize: 18 }} />
        </SymmetryButton>
      </Tooltip>

      <Tooltip title="Horizontal Symmetry" placement="top">
        <SymmetryButton
          active={settings.type === 'horizontal'}
          onClick={() => handleTypeChange('horizontal')}
        >
          <FlipCameraAndroid sx={{ fontSize: 18, transform: 'rotate(90deg)' }} />
        </SymmetryButton>
      </Tooltip>

      <Tooltip title="Quad Symmetry" placement="top">
        <SymmetryButton
          active={settings.type === 'both'}
          onClick={() => handleTypeChange('both')}
        >
          <CenterFocusStrong sx={{ fontSize: 18 }} />
        </SymmetryButton>
      </Tooltip>

      <Tooltip title="Radial Symmetry" placement="top">
        <SymmetryButton
          active={settings.type === 'radial'}
          onClick={() => handleTypeChange('radial')}
        >
          <AutoAwesome sx={{ fontSize: 18 }} />
        </SymmetryButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, bgcolor: 'rgba(255,255,255,0.1)' }} />

      {/* Settings popover */}
      <Tooltip title="Symmetry Settings" placement="top">
        <IconButton size="small" onClick={(e) => setSettingsAnchor(e.currentTarget)}>
          <RotateRight sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(settingsAnchor)}
        anchorEl={settingsAnchor}
        onClose={() => setSettingsAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)' } } }}
      >
        <Box sx={{ p: 2, width: 220 }}>
          <Typography variant="subtitle2" sx={{ mb: 2 }}>Symmetry Settings</Typography>

          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={settings.showGuides}
                onChange={(e) => onSettingsChange({ showGuides: e.target.checked })}
              />
            }
            label={<Typography variant="caption">Show Guides</Typography>}
          />

          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Axis X: {Math.round(settings.axisX * 100)}%
            </Typography>
            <Slider
              size="small"
              value={settings.axisX}
              min={0}
              max={1}
              step={0.01}
              onChange={(_, v) => onSettingsChange({ axisX: v as number })}
            />
          </Box>

          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Axis Y: {Math.round(settings.axisY * 100)}%
            </Typography>
            <Slider
              size="small"
              value={settings.axisY}
              min={0}
              max={1}
              step={0.01}
              onChange={(_, v) => onSettingsChange({ axisY: v as number })}
            />
          </Box>

          {settings.type === 'radial' && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Segments: {settings.radialSegments}
              </Typography>
              <Slider
                size="small"
                value={settings.radialSegments}
                min={2}
                max={16}
                step={1}
                onChange={(_, v) => onSettingsChange({ radialSegments: v as number })}
              />
            </Box>
          )}

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <IconButton
              size="small"
              onClick={() => onSettingsChange({ axisX: 0.5, axisY: 0.5 })}
            >
              <CenterFocusStrong sx={{ fontSize: 16 }} />
            </IconButton>
            <Typography variant="caption" sx={{ color: 'text.secondary', alignSelf: 'center' }}>
              Center Axis
            </Typography>
          </Stack>
        </Box>
      </Popover>

      {/* Status indicator */}
      {settings.enabled && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            ml: 1,
            px: 1,
            py: 0.25,
            borderRadius: 2,
            bgcolor: 'rgba(139, 92, 246, 0.2)',
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: '#8b5cf6',
            }}
          />
          <Typography variant="caption" sx={{ color: '#a78bfa', fontSize: 10 }}>
            {settings.type === 'radial' 
              ? `${settings.radialSegments}x` 
              : settings.type.charAt(0).toUpperCase() + settings.type.slice(1)}
          </Typography>
        </Box>
      )}
    </ToolbarContainer>
  );
};

export default SymmetryMode;
