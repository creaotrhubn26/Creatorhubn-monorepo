/**
 * Mobile Gestures Component
 * Touch-optimized gestures and interactions
 * Swipe, pinch-to-zoom, long-press, and more
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Fab,
  Snackbar,
  Alert,
  Chip,
  IconButton,
  SwipeableDrawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  TouchApp,
  SwipeUp,
  SwipeDown,
  SwipeLeft,
  SwipeRight,
  PinchOutlined,
  ZoomIn,
  ZoomOut,
  Gesture,
  Close,
  Info,
  Check
} from '@mui/icons-material';

interface TouchGesture {
  type: 'swipe-left' | 'swipe-right' | 'swipe-up' | 'swipe-down' | 'pinch-in' | 'pinch-out' | 'long-press' | 'double-tap';
  action: string;
  icon: React.ReactNode;
}

interface MobileGesturesProps {
  enabled: boolean;
  accentColor: string;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onPinchIn?: (scale: number) => void;
  onPinchOut?: (scale: number) => void;
  onLongPress?: (x: number, y: number) => void;
  onDoubleTap?: (x: number, y: number) => void;
  children?: React.ReactNode;
}

export const MobileGestures: React.FC<MobileGesturesProps> = ({
  enabled,
  accentColor,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onPinchIn,
  onPinchOut,
  onLongPress,
  onDoubleTap,
  children
}) => {
  // Touch state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null);
  const [isPinching, setIsPinching] = useState(false);
  const [initialPinchDistance, setInitialPinchDistance] = useState<number>(0);
  const [currentScale, setCurrentScale] = useState(1);
  const [lastTap, setLastTap] = useState<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Feedback state
  const [gestureDetected, setGestureDetected] = useState<string | null>(null);
  const [showGestureGuide, setShowGestureGuide] = useState(false);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  // Gesture configuration
  const minSwipeDistance = 50; // pixels
  const longPressDuration = 500; // ms
  const doubleTapDelay = 300; // ms

  // Available gestures
  const gestures: TouchGesture[] = [
    { type: 'swipe-left', action: 'Next item', icon: <SwipeLeft /> },
    { type: 'swipe-right', action: 'Previous item', icon: <SwipeRight /> },
    { type: 'swipe-up', action: 'Show info', icon: <SwipeUp /> },
    { type: 'swipe-down', action: 'Close/Back', icon: <SwipeDown /> },
    { type: 'pinch-in', action: 'Zoom out', icon: <ZoomOut /> },
    { type: 'pinch-out', action: 'Zoom in', icon: <ZoomIn /> },
    { type: 'long-press', action: 'Show menu', icon: <TouchApp /> },
    { type: 'double-tap', action: 'Quick action', icon: <Gesture /> }
  ];

  // Haptic feedback
  const triggerHaptic = useCallback((intensity: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!hapticFeedback || !navigator.vibrate) return;
    
    const patterns = {
      light: 10,
      medium: 20,
      heavy: 50
    };
    
    navigator.vibrate(patterns[intensity]);
  }, [hapticFeedback]);

  // Calculate distance between two points
  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Show feedback
  const showFeedback = useCallback((gesture: string) => {
    setGestureDetected(gesture);
    setTimeout(() => setGestureDetected(null), 1500);
  }, []);

  // Touch Start Handler
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    const touch = e.touches[0];
    const now = Date.now();

    // Check for double tap
    if (now - lastTap < doubleTapDelay) {
      handleDoubleTap(touch.clientX, touch.clientY);
      setLastTap(0);
      return;
    }
    setLastTap(now);

    // Single touch - potential swipe or long press
    if (e.touches.length === 1) {
      setTouchStart({
        x: touch.clientX,
        y: touch.clientY,
        time: now
      });

      // Start long press timer
      longPressTimerRef.current = setTimeout(() => {
        handleLongPress(touch.clientX, touch.clientY);
      }, longPressDuration);
    }

    // Two touches - pinch
    if (e.touches.length === 2) {
      // Cancel long press
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }

      const distance = getDistance(e.touches[0], e.touches[1]);
      setInitialPinchDistance(distance);
      setIsPinching(true);
    }
  }, [enabled, lastTap, doubleTapDelay, longPressDuration]);

  // Touch Move Handler
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    // Cancel long press on move
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Handle pinch
    if (e.touches.length === 2 && isPinching) {
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / initialPinchDistance;
      setCurrentScale(scale);

      if (scale > 1.1) {
        // Pinch out (zoom in)
        onPinchOut?.(scale);
      } else if (scale < 0.9) {
        // Pinch in (zoom out)
        onPinchIn?.(scale);
      }
    }

    // Track touch position for swipe
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setTouchEnd({
        x: touch.clientX,
        y: touch.clientY
      });
    }
  }, [enabled, isPinching, initialPinchDistance, onPinchIn, onPinchOut]);

  // Touch End Handler
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!enabled) return;

    // Cancel long press
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Reset pinch
    if (isPinching) {
      setIsPinching(false);
      setInitialPinchDistance(0);
      setCurrentScale(1);
      return;
    }

    // Detect swipe
    if (touchStart && touchEnd) {
      const deltaX = touchEnd.x - touchStart.x;
      const deltaY = touchEnd.y - touchStart.y;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Horizontal swipe
      if (absDeltaX > absDeltaY && absDeltaX > minSwipeDistance) {
        if (deltaX > 0) {
          // Swipe right
          triggerHaptic('light');
          showFeedback('Swipe Right');
          onSwipeRight?.();
        } else {
          // Swipe left
          triggerHaptic('light');
          showFeedback('Swipe Left');
          onSwipeLeft?.();
        }
      }
      // Vertical swipe
      else if (absDeltaY > absDeltaX && absDeltaY > minSwipeDistance) {
        if (deltaY > 0) {
          // Swipe down
          triggerHaptic('light');
          showFeedback('Swipe Down');
          onSwipeDown?.();
        } else {
          // Swipe up
          triggerHaptic('light');
          showFeedback('Swipe Up');
          onSwipeUp?.();
        }
      }
    }

    // Reset
    setTouchStart(null);
    setTouchEnd(null);
  }, [enabled, touchStart, touchEnd, isPinching, minSwipeDistance, 
      onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, 
      triggerHaptic, showFeedback]);

  // Long Press Handler
  const handleLongPress = useCallback((x: number, y: number) => {
    if (!enabled) return;
    triggerHaptic('heavy');
    showFeedback('Long Press');
    onLongPress?.(x, y);
  }, [enabled, onLongPress, triggerHaptic, showFeedback]);

  // Double Tap Handler
  const handleDoubleTap = useCallback((x: number, y: number) => {
    if (!enabled) return;
    triggerHaptic('medium');
    showFeedback('Double Tap');
    onDoubleTap?.(x, y);
  }, [enabled, onDoubleTap, triggerHaptic, showFeedback]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Box
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        touchAction: 'none', // Prevent default touch behaviors
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      {children}

      {/* Gesture Feedback */}
      <Snackbar
        open={gestureDetected !== null}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: { xs: 70, sm: 24 } }}
      >
        <Alert
          severity="info"
          icon={<Gesture />}
          sx={{
            bgcolor: `${accentColor}20`,
            color: 'white',
            border: `1px solid ${accentColor}`,
            backdropFilter: 'blur(10px)'
          }}
        >
          {gestureDetected}
        </Alert>
      </Snackbar>

      {/* Gesture Guide FAB */}
      <Fab
        size="small"
        onClick={() => setShowGestureGuide(true)}
        sx={{
          position: 'fixed',
          bottom: 16,
          right: 16,
          bgcolor: `${accentColor}30`,
          color: accentColor,
          '&:hover': {
            bgcolor: `${accentColor}50`,
          },
          zIndex: 130,
        }}
      >
        <TouchApp />
      </Fab>

      {/* Gesture Guide Drawer */}
      <SwipeableDrawer
        anchor="bottom"
        open={showGestureGuide}
        onClose={() => setShowGestureGuide(false)}
        onOpen={() => setShowGestureGuide(true)}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a1a',
            color: 'white',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '70vh'
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TouchApp sx={{ color: accentColor }} />
              <Typography variant="h6" fontWeight="600">
                Touch Gestures
              </Typography>
            </Box>
            <IconButton onClick={() => setShowGestureGuide(false)} sx={{ color: 'white' }}>
              <Close />
            </IconButton>
          </Box>

          {/* Haptic Toggle */}
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            p: 2,
            bgcolor: 'rgba(255,255,255,0.05)',
            borderRadius: 2,
            mb: 2
          }}>
            <Typography variant="body2">Haptic Feedback</Typography>
            <Chip
              label={hapticFeedback ? 'ON' : 'OFF'}
              onClick={() => setHapticFeedback(!hapticFeedback)}
              size="small"
              sx={{
                bgcolor: hapticFeedback ? `${accentColor}30` : 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer'
              }}
            />
          </Box>

          {/* Gestures List */}
          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1 }}>
            Available Gestures
          </Typography>
          <List>
            {gestures.map((gesture, idx) => (
              <React.Fragment key={gesture.type}>
                <ListItem sx={{ px: 0 }}>
                  <ListItemIcon sx={{ color: accentColor }}>
                    {gesture.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={gesture.type.split('-').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(', ')}
                    secondary={gesture.action}
                    primaryTypographyProps={{ fontWeight: 600}}
                    secondaryTypographyProps={{ color: 'rgba(255,255,255,0.6)' }}
                  />
                </ListItem>
                {idx < gestures.length - 1 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />}
              </React.Fragment>
            ))}
          </List>

          {/* Tips */}
          <Box sx={{ 
            mt: 3,
            p: 2,
            bgcolor: 'rgba(33, 150, 243, 0.1)',
            borderRadius: 2,
            border: '1px solid rgba(33, 150, 243, 0.3)'
          }}>
            <Typography variant="subtitle2" sx={{ color: '#2196F3', mb: 1, fontWeight: 600}}>
              💡 Pro Tips
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', display: 'block', mb: 0.5 }}>
              • Use two fingers to pinch zoom on images and videos
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', display: 'block', mb: 0.5 }}>
              • Long press on items to see quick actions
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', display: 'block', mb: 0.5 }}>
              • Double tap to favorite/like items instantly
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', display: 'block' }}>
              • Swipe left/right to quickly navigate between items
            </Typography>
          </Box>
        </Box>
      </SwipeableDrawer>

      {/* Visual Feedback for Pinch */}
      {isPinching && (
        <Box
          sx={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: `${accentColor}40`,
            color: 'white',
            px: 3,
            py: 1.5,
            borderRadius: 2,
            backdropFilter: 'blur(10px)',
            border: `1px solid ${accentColor}`,
            zIndex: 999,
            pointerEvents: 'none'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {currentScale > 1 ? <ZoomIn /> : <ZoomOut />}
            <Typography variant="body2" fontWeight="600">
              {Math.round(currentScale * 100)}%
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default MobileGestures;


