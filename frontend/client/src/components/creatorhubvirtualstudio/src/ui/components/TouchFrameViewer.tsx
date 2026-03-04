/**
 * TouchFrameViewer - iPad/tablet optimized frame viewer with gesture support
 * 
 * Features:
 * - Pinch-to-zoom on frame (iPad/tablet only)
 * - Two-finger pan when zoomed (iPad/tablet only)
 * - Swipe between frames (iPad/tablet only)
 * - Long-press for context menu (iPad/tablet only)
 * - Double-tap to toggle zoom/fit (iPad/tablet only)
 * - Mouse wheel zoom + drag pan (desktop)
 * - Right-click context menu (desktop)
 * - Touch-friendly annotation placement
 * 
 * Automatically detects device type and uses appropriate interactions.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Stack,
  Chip,
  Zoom,
  Fade,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  ZoomIn,
  ZoomOut,
  FitScreen,
  NavigateBefore,
  NavigateNext,
  Edit,
  ContentCopy,
  Delete,
  PlayArrow,
  Comment,
  Info,
  Share,
  Download,
  Videocam,
  Lightbulb,
  Person,
  TrendingFlat,
  CropFree,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import type { Point } from '../../hooks/useTouchGestures';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';
import type { FrameAnnotation, AnnotationType } from './FrameAnnotationOverlay';
import { FrameAnnotationOverlay } from './FrameAnnotationOverlay';

// =============================================================================
// Types
// =============================================================================

export interface TouchFrameViewerProps {
  frames: Array<{
    id: string;
    imageUrl: string;
    title: string;
    annotations?: FrameAnnotation[];
  }>;
  currentIndex: number;
  onIndexChange: (index: number) => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
  onDuplicate?: (index: number) => void;
  onPlay?: (index: number) => void;
  onAddAnnotation?: (frameId: string, annotation: Omit<FrameAnnotation, 'id' | 'createdAt'>) => void;
  onUpdateAnnotation?: (frameId: string, annotationId: string, updates: Partial<FrameAnnotation>) => void;
  onDeleteAnnotation?: (frameId: string, annotationId: string) => void;
  onShare?: (index: number) => void;
  onDownload?: (index: number) => void;
  showControls?: boolean;
  enableAnnotations?: boolean;
}

// =============================================================================
// Animations
// =============================================================================

const swipeHint = keyframes`
  0%, 100% {
    opacity: 0;
    transform: translateX(0);
  }
  50% {
    opacity: 0.5;
    transform: translateX(-10px);
  }
`;

const zoomBounce = keyframes`
  0% {
    transform: scale(var(--scale));
  }
  50% {
    transform: scale(calc(var(--scale) * 1.05));
  }
  100% {
    transform: scale(var(--scale));
  }
`;

const tapFeedback = keyframes`
  0% {
    transform: scale(0);
    opacity: 0.5;
  }
  100% {
    transform: scale(1.5);
    opacity: 0;
  }
`;

// =============================================================================
// Styled Components
// =============================================================================

const ViewerContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isTouchDevice',
})<{ isTouchDevice?: boolean }>(({ isTouchDevice }) => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  backgroundColor: '#0a0a14',
  overflow: 'hidden',
  userSelect: 'none',
  // Only disable touch-action on touch devices
  touchAction: isTouchDevice ? 'none' : 'auto',
  // Cursor changes for desktop
  cursor: isTouchDevice ? 'default' : 'grab','&:active': {
    cursor: isTouchDevice ? 'default' : 'grabbing',
  },
}));

const FrameWrapper = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transformOrigin: 'center center',
  transition: 'transform 0.1s ease-out',
});

const FrameImage = styled('img')({
  maxWidth: '100%',
  maxHeight: '100%',
  objectFit: 'contain',
  pointerEvents: 'none',
});

const SwipeIndicator = styled(Box)({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 48,
  height: 48,
  borderRadius: '50%',
  backgroundColor: 'rgba(255,255,255,0.1)',
  color: 'white',
  animation: `${swipeHint} 2s ease-in-out infinite`,
});

const ControlsOverlay = styled(Box)({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: 16,
  background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const ZoomIndicator = styled(Box)({
  position: 'absolute',
  top: 16,
  right: 16,
  padding: '4px 12px',
  borderRadius: 16,
  backgroundColor: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(4px)',
  color: 'white',
  fontSize: 12,
  fontFamily: 'monospace',
});

const TapFeedbackCircle = styled(Box)({
  position: 'absolute',
  width: 60,
  height: 60,
  borderRadius: '50%',
  backgroundColor: 'rgba(33, 150, 243, 0.3)',
  pointerEvents: 'none',
  animation: `${tapFeedback} 0.4s ease-out forwards`,
});

const AnnotationToolbar = styled(Box)({
  position: 'absolute',
  bottom: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  gap: 8,
  padding: 8,
  borderRadius: 24,
  backgroundColor: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(8px)',
});

const TouchHint = styled(Typography)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  padding: '16px 24px',
  borderRadius: 8,
  backgroundColor: 'rgba(0,0,0,0.8)',
  color: 'rgba(255,255,255,0.7)',
  textAlign: 'center',
  pointerEvents: 'none',
});

// =============================================================================
// Component
// =============================================================================

export const TouchFrameViewer: React.FC<TouchFrameViewerProps> = ({
  frames,
  currentIndex,
  onIndexChange,
  onEdit,
  onDelete,
  onDuplicate,
  onPlay,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onShare,
  onDownload,
  showControls = true,
  enableAnnotations = true,
}) => {
  // Device detection
  const device = useDeviceDetection();
  const isTouchDevice = device.prefersTouch;
  
  // State
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [tapFeedbacks, setTapFeedbacks] = useState<Array<{ id: string; x: number; y: number }>>([]);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [annotationMode, setAnnotationMode] = useState<AnnotationType | null>(null);
  const [showTouchHint, setShowTouchHint] = useState(isTouchDevice);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const hideHintTimer = useRef<NodeJS.Timeout | null>(null);
  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);
  
  const currentFrame = frames[currentIndex];
  const hasNext = currentIndex < frames.length - 1;
  const hasPrev = currentIndex > 0;
  
  // Hide touch hint after interaction
  useEffect(() => {
    hideHintTimer.current = setTimeout(() => {
      setShowTouchHint(false);
    }, 3000);
    return () => {
      if (hideHintTimer.current) clearTimeout(hideHintTimer.current);
    };
  }, []);
  
  // Auto-hide controls
  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, []);
  
  // Add tap feedback effect
  const addTapFeedback = useCallback((point: Point) => {
    const id = crypto.randomUUID();
    setTapFeedbacks(prev => [...prev, { id, x: point.x, y: point.y }]);
    setTimeout(() => {
      setTapFeedbacks(prev => prev.filter(t => t.id !== id));
    }, 400);
  }, []);
  
  // Clamp translation to bounds
  const clampTranslation = useCallback((tx: number, ty: number, currentScale: number) => {
    if (!containerRef.current) return { x: tx, y: ty };
    
    const rect = containerRef.current.getBoundingClientRect();
    const maxX = (rect.width * (currentScale - 1)) / 2;
    const maxY = (rect.height * (currentScale - 1)) / 2;
    
    return {
      x: Math.min(maxX, Math.max(-maxX, tx)),
      y: Math.min(maxY, Math.max(-maxY, ty)),
    };
  }, []);
  
  // Touch gesture callbacks (only active on touch devices)
  const { ref: gestureRef, gestureState, isGesturing } = useTouchGestures(
    isTouchDevice ? {
      // Pinch to zoom
      onPinchStart: () => {
        setShowZoomIndicator(true);
        setShowTouchHint(false);
      },
      onPinch: (newScale) => {
        const clampedScale = Math.min(4, Math.max(0.5, newScale));
        setScale(clampedScale);
        showControlsTemporarily();
      },
      onPinchEnd: () => {
        setTimeout(() => setShowZoomIndicator(false), 1000);
        // Snap to 1 if close
        if (Math.abs(scale - 1) < 0.1) {
          setScale(1);
          setTranslate({ x: 0, y: 0 });
        }
      },
      
      // Two-finger pan
      onPan: (delta) => {
        if (scale > 1) {
          setTranslate(prev => clampTranslation(prev.x + delta.x, prev.y + delta.y, scale));
        }
      },
      
      // Swipe to navigate
      onSwipeLeft: () => {
        if (scale === 1 && hasNext) {
          onIndexChange(currentIndex + 1);
          showControlsTemporarily();
        }
      },
      onSwipeRight: () => {
        if (scale === 1 && hasPrev) {
          onIndexChange(currentIndex - 1);
          showControlsTemporarily();
        }
      },
      
      // Double-tap to toggle zoom
      onDoubleTap: (point) => {
        addTapFeedback(point);
        if (scale > 1) {
          // Reset zoom
          setScale(1);
          setTranslate({ x: 0, y: 0 });
        } else {
          // Zoom to 2x at tap point
          setScale(2);
          // Center on tap point
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const offsetX = (centerX - point.x) * 0.5;
            const offsetY = (centerY - point.y) * 0.5;
            setTranslate(clampTranslation(offsetX, offsetY, 2));
          }
        }
        setShowZoomIndicator(true);
        setTimeout(() => setShowZoomIndicator(false), 1000);
      },
      
      // Long-press for context menu
      onLongPress: (point) => {
        if (annotationMode) {
          // Add annotation at press point
          if (containerRef.current && currentFrame) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = ((point.x - rect.left) / rect.width) * 100;
            const y = ((point.y - rect.top) / rect.height) * 100;
            
            onAddAnnotation?.(currentFrame.id, {
              type: annotationMode,
              x,
              y,
              isNew: true,
            });
            setAnnotationMode(null);
          }
        } else {
          // Show context menu
          setContextMenuAnchor({ x: point.x, y: point.y });
        }
      },
      
      // Single tap
      onTap: (point) => {
        showControlsTemporarily();
        
        if (annotationMode && containerRef.current && currentFrame) {
          // Place annotation
          const rect = containerRef.current.getBoundingClientRect();
          const x = ((point.x - rect.left) / rect.width) * 100;
          const y = ((point.y - rect.top) / rect.height) * 100;
          
          onAddAnnotation?.(currentFrame.id, {
            type: annotationMode,
            x,
            y,
            isNew: true,
          });
          setAnnotationMode(null);
        }
      },
    } : {}, // Empty callbacks for desktop
    {
      swipeThreshold: 80,
      longPressDuration: 600,
      // Disable all gestures on desktop
      enablePinch: isTouchDevice,
      enablePan: isTouchDevice,
      enableSwipe: isTouchDevice,
      enableLongPress: isTouchDevice,
      enableDoubleTap: isTouchDevice,
    }
  );
  
  // Desktop mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isTouchDevice) return;
    
    if (e.button === 0) { // Left click
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isTouchDevice]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isTouchDevice || !isDragging || !dragStart) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    if (scale > 1) {
      setTranslate(prev => clampTranslation(prev.x + deltaX, prev.y + deltaY, scale));
    }
    
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isTouchDevice, isDragging, dragStart, scale, clampTranslation]);
  
  const handleMouseUp = useCallback(() => {
    if (isTouchDevice) return;
    setIsDragging(false);
    setDragStart(null);
  }, [isTouchDevice]);
  
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (isTouchDevice) return;
    
    e.preventDefault();
    showControlsTemporarily();
    setShowZoomIndicator(true);
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.min(4, Math.max(0.5, scale + delta));
    setScale(newScale);
    
    if (newScale <= 1) {
      setTranslate({ x: 0, y: 0 });
    }
    
    setTimeout(() => setShowZoomIndicator(false), 1000);
  }, [isTouchDevice, scale, showControlsTemporarily]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isTouchDevice) return;
    
    e.preventDefault();
    setContextMenuAnchor({ x: e.clientX, y: e.clientY });
  }, [isTouchDevice]);
  
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (isTouchDevice) return;
    
    if (scale > 1) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    } else {
      setScale(2);
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const offsetX = (centerX - e.clientX + rect.left) * 0.5;
        const offsetY = (centerY - e.clientY + rect.top) * 0.5;
        setTranslate(clampTranslation(offsetX, offsetY, 2));
      }
    }
    setShowZoomIndicator(true);
    setTimeout(() => setShowZoomIndicator(false), 1000);
  }, [isTouchDevice, scale, clampTranslation]);
  
  // Keyboard navigation for desktop
  useEffect(() => {
    if (isTouchDevice) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          if (hasPrev) onIndexChange(currentIndex - 1);
          break;
        case 'ArrowRight':
          if (hasNext) onIndexChange(currentIndex + 1);
          break;
        case '+':
        case '=':
          setScale(prev => Math.min(4, prev + 0.5));
          break;
        case '-':
          setScale(prev => Math.max(0.5, prev - 0.5));
          break;
        case '0':
          setScale(1);
          setTranslate({ x: 0, y: 0 });
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTouchDevice, hasPrev, hasNext, currentIndex, onIndexChange]);
  
  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuAnchor(null);
  }, []);
  
  // Navigation handlers
  const goToPrev = useCallback(() => {
    if (hasPrev) {
      onIndexChange(currentIndex - 1);
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [hasPrev, currentIndex, onIndexChange]);
  
  const goToNext = useCallback(() => {
    if (hasNext) {
      onIndexChange(currentIndex + 1);
      setScale(1);
      setTranslate({ x: 0, y: 0 });
    }
  }, [hasNext, currentIndex, onIndexChange]);
  
  // Zoom handlers
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(4, prev + 0.5));
    setShowZoomIndicator(true);
    setTimeout(() => setShowZoomIndicator(false), 1000);
  }, []);
  
  const zoomOut = useCallback(() => {
    const newScale = Math.max(0.5, scale - 0.5);
    setScale(newScale);
    if (newScale <= 1) {
      setTranslate({ x: 0, y: 0 });
    }
    setShowZoomIndicator(true);
    setTimeout(() => setShowZoomIndicator(false), 1000);
  }, [scale]);
  
  const fitToScreen = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);
  
  if (!currentFrame) return null;
  
  return (
    <ViewerContainer
      isTouchDevice={isTouchDevice}
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        if (isTouchDevice && gestureRef.current !== el) {
          (gestureRef as React.MutableRefObject<HTMLElement | null>).current = el;
        }
      }}
      // Desktop mouse handlers
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
    >
      {/* Frame Image with Transform */}
      <FrameWrapper
        sx={{
          transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
          '--scale': scale,
        } as React.CSSProperties}
      >
        <FrameImage src={currentFrame.imageUrl} alt={currentFrame.title} />
        
        {/* Annotations Overlay */}
        {enableAnnotations && currentFrame.annotations && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: annotationMode ? 'auto' : 'none'}}
          >
            <FrameAnnotationOverlay
              frameId={currentFrame.id}
              imageUrl={currentFrame.imageUrl}
              annotations={currentFrame.annotations}
              onAddAnnotation={(annotation) => onAddAnnotation?.(currentFrame.id, annotation)}
              onUpdateAnnotation={(id, updates) => onUpdateAnnotation?.(currentFrame.id, id, updates)}
              onDeleteAnnotation={(id) => onDeleteAnnotation?.(currentFrame.id, id)}
              placementMode={annotationMode}
              onPlacementComplete={() => setAnnotationMode(null)}
            />
          </Box>
        )}
      </FrameWrapper>
      
      {/* Tap Feedback Effects */}
      {tapFeedbacks.map(tap => (
        <TapFeedbackCircle
          key={tap.id}
          sx={{
            left: tap.x - 30,
            top: tap.y - 30}}
        />
      ))}
      
      {/* Swipe Indicators (touch devices only) */}
      {isTouchDevice && scale === 1 && (
        <>
          {hasPrev && (
            <SwipeIndicator sx={{ left: 8 }}>
              <NavigateBefore />
            </SwipeIndicator>
          )}
          {hasNext && (
            <SwipeIndicator sx={{ right: 8, animationDirection: 'reverse' }}>
              <NavigateNext />
            </SwipeIndicator>
          )}
        </>
      )}
      
      {/* Zoom Indicator */}
      <Fade in={showZoomIndicator}>
        <ZoomIndicator>
          {Math.round(scale * 100)}%
        </ZoomIndicator>
      </Fade>
      
      {/* Touch/Desktop Hint */}
      <Fade in={showTouchHint && !isGesturing}>
        <TouchHint variant="body2">
          {isTouchDevice
            ? 'Pinch to zoom | Swipe to navigate | Double-tap to fit'
            : 'Scroll to zoom | Drag to pan | Double-click to fit | Arrow keys to navigate'}
        </TouchHint>
      </Fade>
      
      {/* Annotation Mode Indicator */}
      {annotationMode && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'white'}}
        >
          <Typography variant="body2">
            Tap to place {annotationMode}
          </Typography>
        </Box>
      )}
      
      {/* Annotation Toolbar */}
      {enableAnnotations && (
        <Zoom in={controlsVisible && !isGesturing}>
          <AnnotationToolbar>
            <IconButton
              size="small"
              onClick={() => setAnnotationMode(annotationMode === 'arrow' ? null : 'arrow')}
              sx={{
                color: annotationMode === 'arrow' ? 'primary.main' : 'white',
                bgcolor: annotationMode === 'arrow' ? 'rgba(33,150,243,0.2)' : 'transparent'}}
            >
              <TrendingFlat />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setAnnotationMode(annotationMode === 'actor' ? null : 'actor')}
              sx={{
                color: annotationMode === 'actor' ? 'success.main' : 'white',
                bgcolor: annotationMode === 'actor' ? 'rgba(76,175,80,0.2)' : 'transparent'}}
            >
              <Person />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setAnnotationMode(annotationMode === 'camera' ? null : 'camera')}
              sx={{
                color: annotationMode === 'camera' ? 'info.main' : 'white',
                bgcolor: annotationMode === 'camera' ? 'rgba(33,150,243,0.2)' : 'transparent'}}
            >
              <Videocam />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setAnnotationMode(annotationMode === 'light' ? null : 'light')}
              sx={{
                color: annotationMode === 'light' ? 'warning.main' : 'white',
                bgcolor: annotationMode === 'light' ? 'rgba(255,193,7,0.2)' : 'transparent'}}
            >
              <Lightbulb />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setAnnotationMode(annotationMode === 'focus' ? null : 'focus')}
              sx={{
                color: annotationMode === 'focus' ? 'secondary.main' : 'white',
                bgcolor: annotationMode === 'focus' ? 'rgba(233,30,99,0.2)' : 'transparent'}}
            >
              <CropFree />
            </IconButton>
          </AnnotationToolbar>
        </Zoom>
      )}
      
      {/* Controls Overlay */}
      <Fade in={controlsVisible && showControls && !isGesturing}>
        <ControlsOverlay>
          {/* Frame Info */}
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" color="white" fontWeight={600}>
              {currentFrame.title}
            </Typography>
            <Chip
              label={`${currentIndex + 1} / ${frames.length}`}
              size="small"
              sx={{ alignSelf: 'flex-start' }}
            />
          </Stack>
          
          {/* Zoom Controls */}
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={zoomOut} sx={{ color: 'white' }}>
              <ZoomOut />
            </IconButton>
            <IconButton size="small" onClick={fitToScreen} sx={{ color: 'white' }}>
              <FitScreen />
            </IconButton>
            <IconButton size="small" onClick={zoomIn} sx={{ color: 'white' }}>
              <ZoomIn />
            </IconButton>
          </Stack>
          
          {/* Navigation */}
          <Stack direction="row" spacing={1}>
            <IconButton
              size="small"
              onClick={goToPrev}
              disabled={!hasPrev}
              sx={{ color: 'white' }}
            >
              <NavigateBefore />
            </IconButton>
            <IconButton
              size="small"
              onClick={goToNext}
              disabled={!hasNext}
              sx={{ color: 'white' }}
            >
              <NavigateNext />
            </IconButton>
          </Stack>
        </ControlsOverlay>
      </Fade>
      
      {/* Context Menu */}
      <Menu
        open={Boolean(contextMenuAnchor)}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenuAnchor ? { top: contextMenuAnchor.y, left: contextMenuAnchor.x } : undefined}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            minWidth: 200,
          }}}
      >
        <MenuItem onClick={() => { onPlay?.(currentIndex); handleCloseContextMenu(); }}>
          <ListItemIcon><PlayArrow fontSize="small" /></ListItemIcon>
          <ListItemText>Play from here</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onEdit?.(currentIndex); handleCloseContextMenu(); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          <ListItemText>Edit Frame</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onDuplicate?.(currentIndex); handleCloseContextMenu(); }}>
          <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => { setAnnotationMode('arrow'); handleCloseContextMenu(); }}>
          <ListItemIcon><TrendingFlat fontSize="small" /></ListItemIcon>
          <ListItemText>Add Arrow</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setAnnotationMode('actor'); handleCloseContextMenu(); }}>
          <ListItemIcon><Person fontSize="small" /></ListItemIcon>
          <ListItemText>Add Actor</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setAnnotationMode('light'); handleCloseContextMenu(); }}>
          <ListItemIcon><Lightbulb fontSize="small" /></ListItemIcon>
          <ListItemText>Add Light</ListItemText>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => { onShare?.(currentIndex); handleCloseContextMenu(); }}>
          <ListItemIcon><Share fontSize="small" /></ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onDownload?.(currentIndex); handleCloseContextMenu(); }}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => { onDelete?.(currentIndex); handleCloseContextMenu(); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </ViewerContainer>
  );
};

export default TouchFrameViewer;
