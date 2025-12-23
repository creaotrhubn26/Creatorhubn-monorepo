/**
 * TabletAwarePanels - Higher-order components and hooks for tablet support
 * 
 * Provides:
 * - Touch-friendly slider component
 * - Touch-aware timeline component
 * - Touch-enabled drag-drop component
 * - Touch gesture wrappers for various panels
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Box,
  Slider,
  SliderProps,
  IconButton,
  IconButtonProps,
  Typography,
  Paper,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useTabletSupport } from '../../providers/TabletSupportProvider';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';

// ============================================================================
// TouchSlider - Larger touch targets for tablet
// ============================================================================

interface TouchSliderProps extends Omit<SliderProps, 'onChange, '> {
  label?: string;
  showValue?: boolean;
  valueFormat?: (value: number) => string;
  onChange: (value: number) => void;
  touchSize?: 'small' | 'medium' | 'large';
}

export function TouchSlider({
  label,
  showValue = true,
  valueFormat = (v) => String(v),
  onChange,
  touchSize = 'medium',
  value,
  min = 0,
  max = 100,
  step = 1,
  ...props
}: TouchSliderProps) {
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  // Calculate sizes based on touch mode
  const sizes = {
    small: { thumb: isTouch ? 24 : 16, track: isTouch ? 6 : 4, padding: isTouch ? 16 : 8 },
    medium: { thumb: isTouch ? 32 : 20, track: isTouch ? 8 : 4, padding: isTouch ? 20 : 12 },
    large: { thumb: isTouch ? 44 : 24, track: isTouch ? 10 : 6, padding: isTouch ? 24 : 16 },
  };
  const size = sizes[touchSize];

  const handleChange = (_: Event, newValue: number | number[]) => {
    onChange(Array.isArray(newValue) ? newValue[0] : newValue);
  };

  return (
    <Box sx={{ px: size.padding / 8, py: 1 }}>
      {label && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
          {showValue && (
            <Typography variant="body2" fontWeight="medium">
              {valueFormat(value as number)}
            </Typography>
          )}
        </Box>
      )}
      <Slider
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        sx={{
          '& .MuiSlider-thumb': {
            width: size.thumb,
            height: size.thumb,
            transition: 'all 0.15s', '&:hover': {
              boxShadow: `0 0 0 ${isTouch ? 12 : 8}px rgba(25, 118, 210, 0.16)`,
            }, '&.Mui-active': {
              boxShadow: `0 0 0 ${isTouch ? 16 : 10}px rgba(25, 118, 210, 0.16)`,
            },
          }, '& .MuiSlider-track': {
            height: size.track,
          }, '& .MuiSlider-rail': {
            height: size.track,
          }}}
        {...props}
      />
    </Box>
  );
}

// ============================================================================
// TouchIconButton - Larger touch targets
// ============================================================================

interface TouchIconButtonProps extends IconButtonProps {
  touchSize?: 'small' | 'medium' | 'large';
}

export function TouchIconButton({
  touchSize = 'medium',
  children,
  sx,
  ...props
}: TouchIconButtonProps) {
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  const sizes = {
    small: { button: isTouch ? 40 : 32, icon: isTouch ? 20 : 18 },
    medium: { button: isTouch ? 48 : 40, icon: isTouch ? 24 : 22 },
    large: { button: isTouch ? 56 : 48, icon: isTouch ? 28 : 26 },
  };
  const size = sizes[touchSize];

  return (
    <IconButton
      sx={{
        width: size.button,
        height: size.button'& .MuiSvgIcon-root': {
          fontSize: size.icon,
        },
        ...sx}}
      {...props}
    >
      {children}
    </IconButton>
  );
}

// ============================================================================
// TouchDraggable - Touch-aware draggable wrapper
// ============================================================================

interface TouchDraggableProps {
  children: React.ReactNode;
  onDragStart?: (e: React.TouchEvent | React.MouseEvent) => void;
  onDragMove?: (deltaX: number, deltaY: number) => void;
  onDragEnd?: () => void;
  onLongPress?: () => void;
  longPressDelay?: number;
  disabled?: boolean;
}

export function TouchDraggable({
  children,
  onDragStart,
  onDragMove,
  onDragEnd,
  onLongPress,
  longPressDelay = 500,
  disabled = false,
}: TouchDraggableProps) {
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleStart = useCallback(
    (clientX: number, clientY: number, e: React.TouchEvent | React.MouseEvent) => {
      if (disabled) return;

      startPos.current = { x: clientX, y: clientY };

      if (onLongPress && isTouch) {
        longPressTimer.current = setTimeout(() => {
          onLongPress();
          startPos.current = null;
        }, longPressDelay);
      }

      if (onDragStart) {
        onDragStart(e);
      }
    },
    [disabled, onDragStart, onLongPress, longPressDelay, isTouch]
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!startPos.current || disabled) return;

      const deltaX = clientX - startPos.current.x;
      const deltaY = clientY - startPos.current.y;

      // Cancel long press if moved too much
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        clearLongPressTimer();
        setIsDragging(true);
      }

      if (isDragging && onDragMove) {
        onDragMove(deltaX, deltaY);
      }
    },
    [disabled, isDragging, onDragMove]
  );

  const handleEnd = useCallback(() => {
    clearLongPressTimer();
    startPos.current = null;
    setIsDragging(false);

    if (onDragEnd) {
      onDragEnd();
    }
  }, [onDragEnd]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY, e);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isTouch) return; // Skip mouse events on touch devices
    handleStart(e.clientX, e.clientY, e);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isTouch) return;
    handleMove(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    if (isTouch) return;
    handleEnd();
  };

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, []);

  return (
    <Box
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={isDragging ? handleMouseMove : undefined}
      onMouseUp={handleMouseUp}
      onMouseLeave={isDragging ? handleEnd : undefined}
      sx={{
        cursor: disabled ? 'default' : isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none'}}
    >
      {children}
    </Box>
  );
}

// ============================================================================
// TouchTimelineScrubber - Touch-friendly timeline scrubbing
// ============================================================================

interface TouchTimelineScrubberProps {
  currentTime: number;
  duration: number;
  zoom: number;
  onTimeChange: (time: number) => void;
  onZoomChange?: (zoom: number) => void;
  frameToPixel: (frame: number) => number;
  pixelToFrame: (pixel: number) => number;
  children?: React.ReactNode;
}

export function TouchTimelineScrubber({
  currentTime,
  duration,
  zoom,
  onTimeChange,
  onZoomChange,
  frameToPixel,
  pixelToFrame,
  children,
}: TouchTimelineScrubberProps) {
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const lastTouchDistance = useRef<number | null>(null);
  const initialZoom = useRef<number>(zoom);

  // Handle single touch scrubbing
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!containerRef.current) return;

      const touches = e.touches;

      // Single touch - scrubbing
      if (touches.length === 1) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = touches[0].clientX - rect.left;
        const frame = pixelToFrame(x);
        onTimeChange(Math.max(0, Math.min(duration, frame)));
        setIsScrubbing(true);
      }

      // Two fingers - pinch zoom
      if (touches.length === 2 && onZoomChange) {
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(
          Math.pow(touch2.clientX - touch1.clientX, 2) +
          Math.pow(touch2.clientY - touch1.clientY, 2)
        );

        if (lastTouchDistance.current === null) {
          lastTouchDistance.current = distance;
          initialZoom.current = zoom;
        } else {
          const scale = distance / lastTouchDistance.current;
          const newZoom = Math.max(0.1, Math.min(10, initialZoom.current * scale));
          onZoomChange(newZoom);
        }
      }
    },
    [duration, pixelToFrame, onTimeChange, onZoomChange, zoom]
  );

  const handleTouchEnd = () => {
    setIsScrubbing(false);
    lastTouchDistance.current = null;
  };

  // Mouse scrubbing for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isTouch) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frame = pixelToFrame(x);
    onTimeChange(Math.max(0, Math.min(duration, frame)));
    setIsScrubbing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isScrubbing || isTouch) return;
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frame = pixelToFrame(x);
    onTimeChange(Math.max(0, Math.min(duration, frame)));
  };

  const handleMouseUp = () => {
    setIsScrubbing(false);
  };

  return (
    <Box
      ref={containerRef}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      sx={{
        cursor: 'pointer',
        touchAction: 'none',
        position: 'relative',
        height: '100%'}}
    >
      {children}
    </Box>
  );
}

// ============================================================================
// TouchContextMenu - Long-press context menu
// ============================================================================

interface TouchContextMenuProps {
  children: React.ReactNode;
  menuItems: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    divider?: boolean;
  }>;
  longPressDelay?: number;
}

export function TouchContextMenu({
  children,
  menuItems,
  longPressDelay = 500,
}: TouchContextMenuProps) {
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    longPressTimer.current = setTimeout(() => {
      if (touchStartPos.current) {
        setMenuAnchor(touchStartPos.current);
      }
    }, longPressDelay);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;

    // Cancel if moved too much
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  // Desktop right-click
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isTouch) return;
    e.preventDefault();
    setMenuAnchor({ x: e.clientX, y: e.clientY });
  };

  const handleClose = () => {
    setMenuAnchor(null);
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return (
    <>
      <Box
        onTouchStart={isTouch ? handleTouchStart : undefined}
        onTouchMove={isTouch ? handleTouchMove : undefined}
        onTouchEnd={isTouch ? handleTouchEnd : undefined}
        onContextMenu={handleContextMenu}
      >
        {children}
      </Box>
      <Menu
        open={Boolean(menuAnchor)}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={menuAnchor ? { top: menuAnchor.y, left: menuAnchor.x } : undefined}
        PaperProps={{
          sx: {
            minWidth: isTouch ? 220 : 180'& .MuiMenuItem-root': {
              minHeight: isTouch ? 48 : 40,
            },
          }}}
      >
        {menuItems.map((item, index) => (
          <React.Fragment key={index}>
            {item.divider && index > 0 && <Box sx={{ my: 0.5, borderTop: '1px solid', borderColor: 'divider' }} />}
            <MenuItem
              onClick={() => {
                item.onClick();
                handleClose();
              }}
              disabled={item.disabled}
            >
              {item.icon && (
                <ListItemIcon sx={{ minWidth: isTouch ? 40 : 36 }}>
                  {item.icon}
                </ListItemIcon>
              )}
              <ListItemText primary={item.label} />
            </MenuItem>
          </React.Fragment>
        ))}
      </Menu>
    </>
  );
}

// ============================================================================
// TouchSwipeList - Swipeable list items
// ============================================================================

interface TouchSwipeListItemProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  swipeThreshold?: number;
}

export function TouchSwipeListItem({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  swipeThreshold = 80,
}: TouchSwipeListItemProps) {
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;

    const deltaX = e.touches[0].clientX - startX.current;

    // Limit swipe distance and add resistance
    const maxOffset = 120;
    const resistance = 0.5;
    const clampedDelta = Math.max(-maxOffset, Math.min(maxOffset, deltaX * resistance));

    // Only allow valid swipe directions
    if ((deltaX < 0 && !onSwipeLeft) || (deltaX > 0 && !onSwipeRight)) {
      setOffsetX(0);
      return;
    }

    setOffsetX(clampedDelta);
  };

  const handleTouchEnd = () => {
    if (Math.abs(offsetX) >= swipeThreshold) {
      if (offsetX < 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (offsetX > 0 && onSwipeRight) {
        onSwipeRight();
      }
    }

    // Animate back
    setOffsetX(0);
    startX.current = null;
  };

  if (!isTouch) {
    return <>{children}</>;
  }

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden'}}
    >
      {/* Background actions */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'}}
      >
        <Box
          sx={{
            width: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'success.main',
            height: '100%',
            opacity: offsetX > swipeThreshold / 2 ? 1 : 0.5}}
        >
          {rightAction}
        </Box>
        <Box
          sx={{
            width: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'error.main',
            height: '100%',
            opacity: offsetX < -swipeThreshold / 2 ? 1 : 0.5}}
        >
          {leftAction}
        </Box>
      </Box>

      {/* Swipeable content */}
      <Box
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        sx={{
          transform: `translateX(${offsetX}px)`,
          transition: startX.current === null ? 'transform 0.3s ease' : 'none',
          bgcolor: 'background.paper',
          position: 'relative',
          zIndex: 1}}
      >
        {children}
      </Box>
    </Box>
  );
}

// ============================================================================
// TouchPinchZoom - Pinch-to-zoom wrapper
// ============================================================================

interface TouchPinchZoomProps {
  children: React.ReactNode;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  minZoom?: number;
  maxZoom?: number;
  onDoubleTap?: () => void;
}

export function TouchPinchZoom({
  children,
  zoom,
  onZoomChange,
  minZoom = 0.5,
  maxZoom = 3,
  onDoubleTap,
}: TouchPinchZoomProps) {
  const { shouldUseTouch } = useTabletSupport();
  const isTouch = shouldUseTouch();

  const lastDistance = useRef<number | null>(null);
  const initialZoom = useRef<number>(zoom);
  const lastTapTime = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Double tap detection
    if (e.touches.length === 1 && onDoubleTap) {
      const now = Date.now();
      if (now - lastTapTime.current < 300) {
        onDoubleTap();
      }
      lastTapTime.current = now;
    }

    // Pinch start
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      lastDistance.current = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      initialZoom.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastDistance.current !== null) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const scale = distance / lastDistance.current;
      const newZoom = Math.max(minZoom, Math.min(maxZoom, initialZoom.current * scale));
      onZoomChange(newZoom);
    }
  };

  const handleTouchEnd = () => {
    lastDistance.current = null;
  };

  // Mouse wheel zoom for desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (isTouch) return;
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * delta));
    onZoomChange(newZoom);
  };

  return (
    <Box
      onTouchStart={isTouch ? handleTouchStart : undefined}
      onTouchMove={isTouch ? handleTouchMove : undefined}
      onTouchEnd={isTouch ? handleTouchEnd : undefined}
      onWheel={handleWheel}
      sx={{ touchAction: 'none' }}
    >
      {children}
    </Box>
  );
}

// ============================================================================
// Export all components
// ============================================================================

export default {
  TouchSlider,
  TouchIconButton,
  TouchDraggable,
  TouchTimelineScrubber,
  TouchContextMenu,
  TouchSwipeListItem,
  TouchPinchZoom,
};

