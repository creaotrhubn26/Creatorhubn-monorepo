/**
 * GestureShortcuts - iPadOS-style gesture shortcuts for drawing
 * 
 * Features:
 * - Two-finger tap to undo
 * - Three-finger tap to redo
 * - Two-finger pinch to zoom
 * - Two-finger rotate for canvas rotation
 * - Two-finger pan for canvas pan
 * - Three-finger swipe for copy/paste/cut
 * - Long press for context menu
 * - Double tap to zoom to fit
 */

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Switch,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
} from '@mui/material';
import {
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Rotate90DegreesCw,
  PanTool,
  ContentCopy,
  ContentPaste,
  ContentCut,
  TouchApp,
  Gesture,
  FitScreen,
  Settings,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// =============================================================================
// Types
// =============================================================================

export type GestureType = 
  | 'two-finger-tap'
  | 'three-finger-tap'
  | 'two-finger-double-tap'
  | 'pinch'
  | 'rotate'
  | 'two-finger-pan'
  | 'three-finger-swipe-left'
  | 'three-finger-swipe-right'
  | 'three-finger-swipe-up'
  | 'three-finger-swipe-down'
  | 'long-press'
  | 'double-tap';

export type GestureAction = 
  | 'undo'
  | 'redo'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-fit'
  | 'rotate-canvas'
  | 'pan-canvas'
  | 'copy'
  | 'paste'
  | 'cut'
  | 'context-menu'
  | 'none';

export interface GestureBinding {
  gesture: GestureType;
  action: GestureAction;
  enabled: boolean;
  description: string;
  icon: React.ReactNode;
  fingerCount: number;
}

export interface GestureSettings {
  enabled: boolean;
  bindings: GestureBinding[];
  longPressDelay: number;     // ms
  doubleTapDelay: number;     // ms
  swipeThreshold: number;     // px
  pinchSensitivity: number;   // 0-1
  rotateSensitivity: number;  // 0-1
}

export interface GestureShortcutsProps {
  settings: GestureSettings;
  onSettingsChange: (settings: GestureSettings) => void;
  onGestureAction: (action: GestureAction, data?: any) => void;
}

export interface GestureHandlerProps {
  element: HTMLElement | null;
  settings: GestureSettings;
  onAction: (action: GestureAction, data?: any) => void;
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_GESTURE_BINDINGS: GestureBinding[] = [
  {
    gesture: 'two-finger-tap',
    action: 'undo',
    enabled: true,
    description: 'Two-finger tap to undo',
    icon: <Undo />,
    fingerCount: 2,
  },
  {
    gesture: 'three-finger-tap',
    action: 'redo',
    enabled: true,
    description: 'Three-finger tap to redo',
    icon: <Redo />,
    fingerCount: 3,
  },
  {
    gesture: 'double-tap',
    action: 'zoom-fit',
    enabled: true,
    description: 'Double-tap to zoom fit',
    icon: <FitScreen />,
    fingerCount: 1,
  },
  {
    gesture: 'pinch',
    action: 'zoom-in',
    enabled: true,
    description: 'Pinch to zoom',
    icon: <ZoomIn />,
    fingerCount: 2,
  },
  {
    gesture: 'rotate',
    action: 'rotate-canvas',
    enabled: true,
    description: 'Two-finger rotate',
    icon: <Rotate90DegreesCw />,
    fingerCount: 2,
  },
  {
    gesture: 'two-finger-pan',
    action: 'pan-canvas',
    enabled: true,
    description: 'Two-finger drag to pan',
    icon: <PanTool />,
    fingerCount: 2,
  },
  {
    gesture: 'three-finger-swipe-left',
    action: 'undo',
    enabled: true,
    description: 'Three-finger swipe left to undo',
    icon: <Undo />,
    fingerCount: 3,
  },
  {
    gesture: 'three-finger-swipe-right',
    action: 'redo',
    enabled: true,
    description: 'Three-finger swipe right to redo',
    icon: <Redo />,
    fingerCount: 3,
  },
  {
    gesture: 'three-finger-swipe-up',
    action: 'copy',
    enabled: true,
    description: 'Three-finger swipe up to copy',
    icon: <ContentCopy />,
    fingerCount: 3,
  },
  {
    gesture: 'three-finger-swipe-down',
    action: 'paste',
    enabled: true,
    description: 'Three-finger swipe down to paste',
    icon: <ContentPaste />,
    fingerCount: 3,
  },
  {
    gesture: 'long-press',
    action: 'context-menu',
    enabled: true,
    description: 'Long press for context menu',
    icon: <TouchApp />,
    fingerCount: 1,
  },
];

export const DEFAULT_GESTURE_SETTINGS: GestureSettings = {
  enabled: true,
  bindings: DEFAULT_GESTURE_BINDINGS,
  longPressDelay: 500,
  doubleTapDelay: 300,
  swipeThreshold: 50,
  pinchSensitivity: 0.5,
  rotateSensitivity: 0.5,
};

// =============================================================================
// Styled Components
// =============================================================================

const GestureContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  backdropFilter: 'blur(12px)',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
  minWidth: 280,
}));

const GestureIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'fingers',
})<{ fingers: number }>(({ fingers }) => ({
  position: 'relative',
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&::after': {
    content: `"${fingers}"`,
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: 9,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

// =============================================================================
// Gesture Hook
// =============================================================================

export function useGestureHandler({
  element,
  settings,
  onAction,
}: GestureHandlerProps) {
  const touchesRef = useRef<Touch[]>([]);
  const initialDistanceRef = useRef<number>(0);
  const initialAngleRef = useRef<number>(0);
  const initialCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapCountRef = useRef<number>(0);
  
  const getBinding = useCallback((gesture: GestureType): GestureBinding | undefined => {
    return settings.bindings.find(b => b.gesture === gesture && b.enabled);
  }, [settings.bindings]);

  const getDistance = useCallback((t1: Touch, t2: Touch): number => {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getAngle = useCallback((t1: Touch, t2: Touch): number => {
    return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * 180 / Math.PI;
  }, []);

  const getCenter = useCallback((touches: Touch[]): { x: number; y: number } => {
    const sum = touches.reduce(
      (acc, t) => ({ x: acc.x + t.clientX, y: acc.y + t.clientY }),
      { x: 0, y: 0 }
    );
    return { x: sum.x / touches.length, y: sum.y / touches.length };
  }, []);

  useEffect(() => {
    if (!element || !settings.enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchesRef.current = Array.from(e.touches);
      const touchCount = e.touches.length;

      // Clear any pending long press
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // Initialize pinch/rotate reference values
      if (touchCount === 2) {
        initialDistanceRef.current = getDistance(e.touches[0], e.touches[1]);
        initialAngleRef.current = getAngle(e.touches[0], e.touches[1]);
        initialCenterRef.current = getCenter(Array.from(e.touches));
      }

      // Long press detection (single finger)
      if (touchCount === 1) {
        longPressTimerRef.current = setTimeout(() => {
          const binding = getBinding('long-press');
          if (binding) {
            onAction(binding.action, { x: e.touches[0].clientX, y: e.touches[0].clientY });
          }
        }, settings.longPressDelay);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      // Cancel long press on move
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const touchCount = e.touches.length;

      // Two-finger gestures
      if (touchCount === 2) {
        const currentDistance = getDistance(e.touches[0], e.touches[1]);
        const currentAngle = getAngle(e.touches[0], e.touches[1]);
        const currentCenter = getCenter(Array.from(e.touches));

        // Pinch zoom
        const distanceChange = currentDistance - initialDistanceRef.current;
        if (Math.abs(distanceChange) > 10) {
          const pinchBinding = getBinding('pinch');
          if (pinchBinding) {
            const scale = currentDistance / initialDistanceRef.current;
            onAction(pinchBinding.action, { scale, center: currentCenter });
            e.preventDefault();
          }
        }

        // Rotation
        const angleChange = currentAngle - initialAngleRef.current;
        if (Math.abs(angleChange) > 5) {
          const rotateBinding = getBinding('rotate');
          if (rotateBinding) {
            onAction(rotateBinding.action, { angle: angleChange, center: currentCenter });
            e.preventDefault();
          }
        }

        // Pan
        const dx = currentCenter.x - initialCenterRef.current.x;
        const dy = currentCenter.y - initialCenterRef.current.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          const panBinding = getBinding('two-finger-pan');
          if (panBinding) {
            onAction(panBinding.action, { dx, dy });
            initialCenterRef.current = currentCenter;
          }
        }
      }

      // Three-finger swipes
      if (touchCount === 3 && touchesRef.current.length === 3) {
        const center = getCenter(Array.from(e.touches));
        const initialCenter = getCenter(touchesRef.current);
        const dx = center.x - initialCenter.x;
        const dy = center.y - initialCenter.y;

        if (Math.abs(dx) > settings.swipeThreshold) {
          const gesture: GestureType = dx > 0 ? 'three-finger-swipe-right' : 'three-finger-swipe-left';
          const binding = getBinding(gesture);
          if (binding) {
            onAction(binding.action);
            touchesRef.current = Array.from(e.touches); // Reset for next swipe
          }
        }

        if (Math.abs(dy) > settings.swipeThreshold) {
          const gesture: GestureType = dy > 0 ? 'three-finger-swipe-down' : 'three-finger-swipe-up';
          const binding = getBinding(gesture);
          if (binding) {
            onAction(binding.action);
            touchesRef.current = Array.from(e.touches);
          }
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Cancel long press
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const wasMultiTouch = touchesRef.current.length > 1;
      const remainingTouches = e.touches.length;

      // Multi-finger tap detection
      if (remainingTouches === 0 && wasMultiTouch) {
        const fingerCount = touchesRef.current.length;
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTimeRef.current;

        // Check if it was a quick tap (not a drag)
        const endTouch = e.changedTouches[0];
        const startTouch = touchesRef.current[0];
        if (startTouch) {
          const moveDistance = Math.sqrt(
            Math.pow(endTouch.clientX - startTouch.clientX, 2) +
            Math.pow(endTouch.clientY - startTouch.clientY, 2)
          );

          if (moveDistance < 20) { // Was a tap, not a drag
            if (fingerCount === 2) {
              const binding = getBinding('two-finger-tap');
              if (binding) onAction(binding.action);
            } else if (fingerCount === 3) {
              const binding = getBinding('three-finger-tap');
              if (binding) onAction(binding.action);
            }
          }
        }
      }

      // Single finger double-tap
      if (remainingTouches === 0 && touchesRef.current.length === 1) {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTimeRef.current;

        if (timeSinceLastTap < settings.doubleTapDelay) {
          const binding = getBinding('double-tap');
          if (binding) onAction(binding.action);
          lastTapTimeRef.current = 0;
        } else {
          lastTapTimeRef.current = now;
        }
      }

      touchesRef.current = Array.from(e.touches);
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);
    element.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
      
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [element, settings, onAction, getBinding, getDistance, getAngle, getCenter]);
}

// =============================================================================
// Component
// =============================================================================

export const GestureShortcuts: React.FC<GestureShortcutsProps> = ({
  settings,
  onSettingsChange,
  onGestureAction,
}) => {
  const updateSettings = useCallback((updates: Partial<GestureSettings>) => {
    onSettingsChange({ ...settings, ...updates });
  }, [settings, onSettingsChange]);

  const toggleBinding = useCallback((gesture: GestureType) => {
    const newBindings = settings.bindings.map(b =>
      b.gesture === gesture ? { ...b, enabled: !b.enabled } : b
    );
    updateSettings({ bindings: newBindings });
  }, [settings.bindings, updateSettings]);

  // Group bindings by finger count
  const groupedBindings = useMemo(() => {
    const groups: Record<number, GestureBinding[]> = {};
    settings.bindings.forEach(binding => {
      if (!groups[binding.fingerCount]) {
        groups[binding.fingerCount] = [];
      }
      groups[binding.fingerCount].push(binding);
    });
    return groups;
  }, [settings.bindings]);

  return (
    <GestureContainer>
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Gesture sx={{ fontSize: 18, color: settings.enabled ? 'primary.main' : 'text.secondary' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Gesture Shortcuts
            </Typography>
          </Stack>
          <Switch
            size="small"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
          />
        </Stack>
      </Box>

      {/* Gesture bindings */}
      <Box sx={{ maxHeight: 400, overflowY: 'auto', opacity: settings.enabled ? 1 : 0.5 }}>
        {Object.entries(groupedBindings).map(([fingerCount, bindings]) => (
          <Box key={fingerCount}>
            <Box sx={{ px: 1.5, py: 0.75, bgcolor: 'rgba(255,255,255,0.03)' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {fingerCount} Finger{parseInt(fingerCount) > 1 ? 's' : ''}
              </Typography>
            </Box>
            <List dense disablePadding>
              {bindings.map((binding) => (
                <ListItem
                  key={binding.gesture}
                  sx={{
                    py: 0.75,
                    opacity: binding.enabled ? 1 : 0.5,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Box sx={{ 
                      color: binding.enabled ? 'primary.main' : 'text.disabled',
                      '& svg': { fontSize: 18 },
                    }}>
                      {binding.icon}
                    </Box>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontSize: 12 }}>
                        {binding.description}
                      </Typography>
                    }
                    secondary={
                      <Chip
                        size="small"
                        label={binding.action}
                        sx={{
                          height: 16,
                          fontSize: 9,
                          mt: 0.25,
                          bgcolor: 'rgba(59,130,246,0.2)',
                          color: 'primary.light',
                        }}
                      />
                    }
                  />
                  <ListItemSecondaryAction>
                    <Switch
                      size="small"
                      checked={binding.enabled}
                      onChange={() => toggleBinding(binding.gesture)}
                      disabled={!settings.enabled}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        ))}
      </Box>

      {/* Quick reference */}
      <Box sx={{ p: 1.5, borderTop: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(0,0,0,0.2)' }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
          Quick Reference:
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" label="2👆 = Undo" sx={{ height: 20, fontSize: 10 }} />
          <Chip size="small" label="3👆 = Redo" sx={{ height: 20, fontSize: 10 }} />
          <Chip size="small" label="👆👆 = Fit" sx={{ height: 20, fontSize: 10 }} />
        </Stack>
      </Box>
    </GestureContainer>
  );
};

export default GestureShortcuts;
