/**
 * ViewfinderOverlays - Frame Guides, Info HUD, and Overlay Components
 * 
 * Provides professional viewfinder overlays:
 * - Frame guides (thirds, golden ratio, safe areas)
 * - Camera info HUD
 * - Histogram overlay
 * - Exposure warnings
 * - Focus indicator
 */

import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  Stack,
} from '@mui/material';
import {
  FrameGuide,
  CameraInfoDisplay,
  HistogramData,
  ExposureInfo,
  FocusInfo,
  ViewfinderSettings,
} from '../../core/rendering/ViewfinderRenderer';

// ============================================================================
// Frame Guides Overlay
// ============================================================================

interface FrameGuidesProps {
  guides: FrameGuide[];
  width: number;
  height: number;
}

export function FrameGuidesOverlay({ guides, width, height }: FrameGuidesProps) {
  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none'}}
    >
      {guides.map((guide, i) => {
        if (guide.type === 'line') {
          return (
            <line
              key={i}
              x1={guide.x1}
              y1={guide.y1}
              x2={guide.x2}
              y2={guide.y2}
              stroke={guide.color}
              strokeWidth={1}
              opacity={guide.opacity}
            />
          );
        } else if (guide.type === 'rect') {
          return (
            <g key={i}>
              <rect
                x={guide.x1}
                y={guide.y1}
                width={guide.width}
                height={guide.height}
                fill="none"
                stroke={guide.color}
                strokeWidth={1}
                strokeDasharray="4,4"
                opacity={guide.opacity}
              />
              {guide.label && (
                <text
                  x={guide.x1! + 5}
                  y={guide.y1! + 12}
                  fill={guide.color}
                  fontSize={10}
                  opacity={guide.opacity + 0.2}
                >
                  {guide.label}
                </text>
              )}
            </g>
          );
        }
        return null;
      })}
    </svg>
  );
}

// ============================================================================
// Camera Info HUD
// ============================================================================

interface CameraInfoHUDProps {
  info: CameraInfoDisplay;
  exposure: ExposureInfo;
  position?: 'top' | 'bottom';
}

export function CameraInfoHUD({ info, exposure, position = 'bottom' }: CameraInfoHUDProps) {
  const isOverexposed = exposure.isOverexposed;
  const isUnderexposed = exposure.isUnderexposed;
  
  return (
    <Box
      sx={{
        position: 'absolute',
        [position]: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
        p: 1.5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        color: 'white',
        fontFamily: 'monospace',
        pointerEvents: 'none'}}
    >
      {/* Left: Camera Settings */}
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 700, 
            fontSize: '1rem',
            color: isOverexposed ? '#ff4444' : isUnderexposed ? '#4444ff' : 'white'}}
        >
          {info.aperture}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem' }}>
          {info.shutter}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem' }}>
          {info.iso}
        </Typography>
        <Box sx={{ height: 20, width: 1, bgcolor: 'rgba(255,255,255,0.3)' }} />
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {info.focalLength}
        </Typography>
      </Stack>
      
      {/* Center: EV and Exposure Meter */}
      <Stack alignItems="center" spacing={0.5}>
        <Typography 
          variant="caption" 
          sx={{ 
            opacity: 0.7,
            color: isOverexposed ? '#ff4444' : isUnderexposed ? '#4444ff' : 'white'}}
        >
          {info.ev} {exposure.stops !== 0 && `(${exposure.stops > 0 ? '+' : ', '}${exposure.stops})`}
        </Typography>
        
        {/* Exposure Meter Bar */}
        <Box sx={{ width: 120, height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2, position: 'relative' }}>
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              width: 2,
              height: 8,
              bgcolor: 'white',
              top: -2,
              transform: 'translateX(-50%)'}}
          />
          <Box
            sx={{
              position: 'absolute',
              left: `${50 + Math.max(-50, Math.min(50, exposure.stops * 10))}%`,
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: isOverexposed ? '#ff4444' : isUnderexposed ? '#4444ff' : '#44ff44',
              top: -1,
              transform: 'translateX(-50%)',
              transition: 'left 0.2s'}}
          />
        </Box>
      </Stack>
      
      {/* Right: Focus Info */}
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          DOF: {info.dof}
        </Typography>
        <Box sx={{ height: 20, width: 1, bgcolor: 'rgba(255,255,255,0.3)' }} />
        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          ⚬ {info.focusDistance}
        </Typography>
        {info.lens && (
          <>
            <Box sx={{ height: 20, width: 1, bgcolor: 'rgba(255,255,255,0.3)' }} />
            <Typography variant="caption" sx={{ opacity: 0.6, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {info.lens}
            </Typography>
          </>
        )}
      </Stack>
    </Box>
  );
}

// ============================================================================
// Mini Histogram Overlay
// ============================================================================

interface HistogramOverlayProps {
  data: HistogramData;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size?: { width: number; height: number };
}

export function HistogramOverlay({ 
  data, 
  position, 
  size = { width: 160, height: 60 } 
}: HistogramOverlayProps) {
  const positionStyles = useMemo(() => {
    const base = { position: 'absolute' as const, m: 1 };
    switch (position) {
      case 'top-left': return { ...base, top: 0, left: 0 };
      case 'top-right': return { ...base, top: 0, right: 0 };
      case 'bottom-left': return { ...base, bottom: 60, left: 0 };
      case 'bottom-right': return { ...base, bottom: 60, right: 0 };
    }
  }, [position]);
  
  return (
    <Box
      sx={{
        ...positionStyles,
        width: size.width,
        height: size.height,
        bgcolor: 'rgba(0,0,0,0.6)',
        borderRadius: 1,
        overflow: 'hidden',
        pointerEvents: 'none'}}
    >
      <svg width={size.width} height={size.height}>
        {/* Luminance (white, filled) */}
        <path
          d={`M 0 ${size.height} ${data.luminance.map((v, i) => 
            `L ${(i / 255) * size.width} ${size.height - v * size.height}`
          ).join('')} L ${size.width} ${size.height} Z`}
          fill="rgba(255,255,255,0.3)"
        />
        
        {/* Red channel */}
        <path
          d={`M 0 ${size.height} ${data.r.map((v, i) => 
            `L ${(i / 255) * size.width} ${size.height - v * size.height * 0.8}`
          ).join(' , ')}`}
          fill="none"
          stroke="rgba(255,0,0,0.6)"
          strokeWidth={1}
        />
        
        {/* Green channel */}
        <path
          d={`M 0 ${size.height} ${data.g.map((v, i) => 
            `L ${(i / 255) * size.width} ${size.height - v * size.height * 0.8}`
          ).join(' ')}`}
          fill="none"
          stroke="rgba(0,255,0,0.6)"
          strokeWidth={1}
        />
        
        {/* Blue channel */}
        <path
          d={`M 0 ${size.height} ${data.b.map((v, i) => 
            `L ${(i / 255) * size.width} ${size.height - v * size.height * 0.8}`
          ).join(', ')}`}
          fill="none"
          stroke="rgba(0,100,255,0.6)"
          strokeWidth={1}
        />
      </svg>
    </Box>
  );
}

// ============================================================================
// Exposure Warning Overlay
// ============================================================================

interface ExposureWarningProps {
  exposure: ExposureInfo;
}

export function ExposureWarning({ exposure }: ExposureWarningProps) {
  if (!exposure.isOverexposed && !exposure.isUnderexposed) return null;
  
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none'}}
    >
      <Chip
        label={exposure.isOverexposed ? '⚠ OVEREXPOSED' : '⚠ UNDEREXPOSED'}
        size="small"
        sx={{
          bgcolor: exposure.isOverexposed ? 'rgba(255,0,0,0.8)' : 'rgba(0,0,255,0.8)',
          color: 'white',
          fontWeight: 700,
          animation: 'pulse 1s infinite','@keyframes pulse': {
            '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.6 },
          }}}
      />
    </Box>
  );
}

// ============================================================================
// Focus Indicator
// ============================================================================

interface FocusIndicatorProps {
  focus: FocusInfo;
  focusDistance: number;
}

export function FocusIndicator({ focus, focusDistance }: FocusIndicatorProps) {
  const isAtHyperfocal = focusDistance >= focus.hyperfocal * 0.9;
  
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        right: 8,
        bgcolor: 'rgba(0,0,0,0.6)',
        borderRadius: 1,
        p: 1,
        pointerEvents: 'none'}}
    >
      <Stack spacing={0.5}>
        <Typography variant="caption" sx={{ color: 'white', opacity: 0.7 }}>
          FOCUS
        </Typography>
        
        {/* Focus distance bar */}
        <Box sx={{ width: 80, position: 'relative' }}>
          <Box sx={{ height: 4, bgcolor: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
            {/* DOF range indicator */}
            <Box
              sx={{
                position: 'absolute',
                left: `${Math.min(100, (focus.nearLimit / 20) * 100)}%`,
                right: focus.farLimit === Infinity 
                  ? 0 
                  : `${100 - Math.min(100, (focus.farLimit / 20) * 100)}%`,
                height: 4,
                bgcolor: 'rgba(0,255,0,0.5)',
                borderRadius: 2}}
            />
            {/* Focus point */}
            <Box
              sx={{
                position: 'absolute',
                left: `${Math.min(100, (focusDistance / 20) * 100)}%`,
                top: -2,
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#44ff44',
                border: '1px solid white',
                transform: 'translateX(-50%)'}}
            />
          </Box>
          
          {/* Distance labels */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'white', opacity: 0.5, fontSize: 8 }}>
              0m
            </Typography>
            <Typography variant="caption" sx={{ color: 'white', opacity: 0.5, fontSize: 8 }}>
              ∞
            </Typography>
          </Box>
        </Box>
        
        {isAtHyperfocal && (
          <Chip
            label="Hyperfocal"
            size="small"
            sx={{ 
              bgcolor: 'rgba(0,255,0,0.3)', 
              color: '#44ff44', 
              fontSize: 10, 
              height: 16 
            }}
          />
        )}
      </Stack>
    </Box>
  );
}

// ============================================================================
// Letterbox Overlay (for aspect ratio)
// ============================================================================

interface LetterboxOverlayProps {
  containerWidth: number;
  containerHeight: number;
  viewportX: number;
  viewportY: number;
  viewportWidth: number;
  viewportHeight: number;
}

export function LetterboxOverlay({
  containerWidth,
  containerHeight,
  viewportX,
  viewportY,
  viewportWidth,
  viewportHeight,
}: LetterboxOverlayProps) {
  return (
    <>
      {/* Top bar */}
      {viewportY > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: viewportY,
            bgcolor: 'black',
            pointerEvents: 'none'}}
        />
      )}
      
      {/* Bottom bar */}
      {viewportY > 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: viewportY,
            bgcolor: 'black',
            pointerEvents: 'none'}}
        />
      )}
      
      {/* Left bar */}
      {viewportX > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: viewportX,
            bgcolor: 'black',
            pointerEvents: 'none'}}
        />
      )}
      
      {/* Right bar */}
      {viewportX > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: viewportX,
            bgcolor: 'black',
            pointerEvents: 'none'}}
        />
      )}
    </>
  );
}

// ============================================================================
// Recording Indicator
// ============================================================================

interface RecordingIndicatorProps {
  isRecording: boolean;
  duration?: number;
}

export function RecordingIndicator({ isRecording, duration = 0 }: RecordingIndicatorProps) {
  if (!isRecording) return null;
  
  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2,'0')}`;
  };
  
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        left: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        bgcolor: 'rgba(0,0,0,0.6)',
        borderRadius: 1,
        px: 1,
        py: 0.5,
        pointerEvents: 'none'}}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'red',
          animation: 'blink 1s infinite',
          '@keyframes blink': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.3 },
          }
        }}
      />
      <Typography variant="caption" sx={{ color: 'white', fontFamily: 'monospace' }}>
        REC {formatDuration(duration)}
      </Typography>
    </Box>
  );
}

// ============================================================================
// Settings Toggle Buttons
// ============================================================================

interface ViewfinderToggleButtonsProps {
  settings: ViewfinderSettings;
  onSettingsChange: (settings: Partial<ViewfinderSettings>) => void;
}

export function ViewfinderToggleButtons({ settings, onSettingsChange }: ViewfinderToggleButtonsProps) {
  const toggles = [
    { key: 'showGuides', label: 'Guides', icon: '⊞' },
    { key: 'showZebras', label: 'Zebras', icon: '▤' },
    { key: 'showFocusPeaking', label: 'Peaking', icon: '◎' },
    { key: 'showHistogram', label: 'Histo', icon: '📊' },
    { key: 'showInfo', label: 'Info', icon: 'ℹ' },
    { key: 'simulateExposure', label: 'Exp', icon: '☀' },
    { key: 'simulateLensEffects', label: 'Lens', icon: '⬭' },
  ] as const;
  
  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 70,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 0.5,
        bgcolor: 'rgba(0,0,0,0.6)',
        borderRadius: 2,
        p: 0.5}}
    >
      {toggles.map(({ key, label, icon }) => (
        <Box
          key={key}
          onClick={() => onSettingsChange({ [key]: !settings[key] })}
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            cursor: 'pointer',
            bgcolor: settings[key] ? 'rgba(255,255,255,0.2)' : 'transparent',
            color: settings[key] ? 'white' : 'rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            fontSize: 11,
            transition: 'all 0.15s','&:hover': {
              bgcolor: 'rgba(255,255,255,0.15)',
            }}}
        >
          <span>{icon}</span>
          <span>{label}</span>
        </Box>
      ))}
    </Box>
  );
}

// ============================================================================
// Aspect Ratio Selector
// ============================================================================

interface AspectRatioSelectorProps {
  current: ViewfinderSettings['aspectRatio'];
  onChange: (ratio: ViewfinderSettings['aspectRatio']) => void;
}

export function AspectRatioSelector({ current, onChange }: AspectRatioSelectorProps) {
  const ratios: { value: ViewfinderSettings['aspectRatio'];, label: string }[] = [
    { value: '16:9', label: '16:9' },
    { value: '4:3', label: '4:3' },
    { value: '2.39:1', label: '2.39:1' },
    { value: '3:2', label: '3:2' },
    { value: '1:1', label: '1:1' },
  ];
  
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 0.5,
        bgcolor: 'rgba(0,0,0,0.6)',
        borderRadius: 1,
        p: 0.25}}
    >
      {ratios.map(({ value, label }) => (
        <Box
          key={value}
          onClick={() => onChange(value)}
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 0.5,
            cursor: 'pointer',
            bgcolor: current === value ? 'rgba(255,255,255,0.2)' : 'transparent',
            color: current === value ? 'white' : 'rgba(255,255,255,0.5)',
            fontSize: 10,
            fontFamily: 'monospace',
            transition: 'all 0.15s', '&:hover': {
              bgcolor: 'rgba(255,255,255,0.1)',
            }}}
        >
          {label}
        </Box>
      ))}
    </Box>
  );
}

