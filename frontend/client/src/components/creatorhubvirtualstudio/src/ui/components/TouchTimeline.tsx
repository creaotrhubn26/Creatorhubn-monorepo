/**
 * TouchTimeline - iPad/tablet optimized timeline with gesture support
 * 
 * Features:
 * - Two-finger pan/scroll (iPad/tablet only)
 * - Pinch-to-zoom (time scale) (iPad/tablet only)
 * - Swipe between frames (iPad/tablet only)
 * - Long-press on frame for quick actions (iPad/tablet only)
 * - Double-tap/click to select/edit
 * - Mouse wheel zoom + drag scroll (desktop)
 * - Right-click context menu (desktop)
 * - Touch-friendly scrubbing
 * - Haptic feedback simulation (visual)
 * 
 * Automatically detects device type and uses appropriate interactions.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Stack,
  Paper,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Fade,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  FirstPage,
  LastPage,
  Edit,
  Delete,
  ContentCopy,
  Timer,
  Add,
  ZoomIn,
  ZoomOut,
  FitScreen,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import type { Point } from '../../hooks/useTouchGestures';
import { useTouchGestures } from '../../hooks/useTouchGestures';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';

// =============================================================================
// Types
// =============================================================================

export interface TimelineFrame {
  id: string;
  imageUrl: string;
  title: string;
  duration: number; // seconds
  startTime: number; // seconds from start
}

export interface TouchTimelineProps {
  frames: TimelineFrame[];
  currentFrameIndex: number;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onFrameSelect: (index: number) => void;
  onSeek: (time: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onFrameEdit?: (index: number) => void;
  onFrameDelete?: (index: number) => void;
  onFrameDuplicate?: (index: number) => void;
  onFrameAdd?: (afterIndex: number) => void;
  onFrameReorder?: (fromIndex: number, toIndex: number) => void;
}

// =============================================================================
// Animations
// =============================================================================

const scrubPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(33, 150, 243, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(33, 150, 243, 0);
  }
`;

const frameHighlight = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0);
  }
  50% {
    transform: scale(1.02);
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.5);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 2px rgba(33, 150, 243, 0);
  }
`;

const hapticBump = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.98);
  }
  100% {
    transform: scale(1);
  }
`;

// =============================================================================
// Styled Components
// =============================================================================

const TimelineContainer = styled(Paper)({
  backgroundColor: '#1a1a2e',
  borderRadius: 8,
  overflow: 'hidden',
  touchAction: 'none',
  userSelect: 'none',
});

const TimelineHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
});

const FrameStrip = styled(Box)({
  display: 'flex',
  gap: 4,
  padding: 12,
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollBehavior: 'smooth',
  scrollSnapType: 'x mandatory',
  WebkitOverflowScrolling: 'touch', '&::-webkit-scrollbar': {
    height: 4,
  }, '&::-webkit-scrollbar-track': {
    backgroundColor: 'rgba(255,255,255,0.05)',
  }, '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
  },
});

interface FrameThumbnailProps {
  $isActive?: boolean;
  $isDragging?: boolean;
}

const FrameThumbnail = styled(Box, {
  shouldForwardProp: (prop) => !prop.toString().startsWith('$'),
})<FrameThumbnailProps>(({ $isActive, $isDragging }) => ({
  position: 'relative',
  flexShrink: 0,
  width: 100,
  height: 56,
  borderRadius: 4,
  overflow: 'hidden',
  cursor: 'pointer',
  scrollSnapAlign: 'center',
  transition: 'all 0.2s ease',
  border: $isActive ? '2px solid #2196F3' : '2px solid transparent',
  
  ...($isActive && {
    animation: `${frameHighlight} 2s ease-in-out infinite`,
  }),
  
  ...($isDragging && {
    opacity: 0.5,
    transform: 'scale(1.1) rotate(2deg)',
  }),
  
  // Touch target padding (minimum 44px)
  '&::before': {
    content: ', ""',
    position: 'absolute',
    top: -8,
    left: -4,
    right: -4,
    bottom: -8,
  }, '&:active': {
    animation: `${hapticBump} 0.15s ease-out`,
  },
}));

const ScrubBar = styled(Box)({
  position: 'relative',
  height: 48,
  margin: '0 16px 12px',
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 4,
  overflow: 'hidden',
});

const ScrubProgress = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  backgroundColor: 'rgba(33, 150, 243, 0.3)',
  transition: 'width 0.1s linear',
});

const ScrubHandle = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isScrubbing',
})<{ isScrubbing?: boolean }>(({ isScrubbing }) => ({
  position: 'absolute',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  width: isScrubbing ? 48 : 24,
  height: isScrubbing ? 48 : 24,
  borderRadius: '50%',
  backgroundColor: '#2196F3',
  cursor: 'grab',
  transition: 'width 0.2s, height 0.2s',
  zIndex: 1,
  
  ...(isScrubbing && {
    animation: `${scrubPulse} 1s ease-in-out infinite`,
    cursor: 'grabbing',
  }),
  
  // Larger touch target
  '&::before': {
    content: ', ""',
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
  },
}));

const FrameMarkers = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
});

const FrameMarker = styled(Box)({
  position: 'absolute',
  top: 0,
  width: 2,
  height: '100%',
  backgroundColor: 'rgba(255,255,255,0.2)',
});

const TimeDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 14,
  color: 'white',
});

const ZoomControls = styled(Stack)({
  position: 'absolute',
  right: 16,
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 5,
});

const TouchHint = styled(Box)({
  position: 'absolute',
  bottom: 8,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '4px 12px',
  borderRadius: 12,
  backgroundColor: 'rgba(0,0,0,0.6)',
  color: 'rgba(255,255,255,0.5)',
  fontSize: 11,
});

// =============================================================================
// Component
// =============================================================================

export const TouchTimeline: React.FC<TouchTimelineProps> = ({
  frames,
  currentFrameIndex,
  currentTime,
  totalDuration,
  isPlaying,
  onFrameSelect,
  onSeek,
  onPlay,
  onPause,
  onFrameEdit,
  onFrameDelete,
  onFrameDuplicate,
  onFrameAdd,
  onFrameReorder,
}) => {
  // Device detection
  const device = useDeviceDetection();
  const isTouchDevice = device.prefersTouch;
  
  // State
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [timeScale, setTimeScale] = useState(1); // 1 = normal, 2 = zoomed in
  const [scrollOffset, setScrollOffset] = useState(0);
  const [contextMenuAnchor, setContextMenuAnchor] = useState<{ x: number; y: number; frameIndex: number } | null>(null);
  const [draggedFrame, setDraggedFrame] = useState<number | null>(null);
  const [showTouchHint, setShowTouchHint] = useState(isTouchDevice);
  
  const scrubBarRef = useRef<HTMLDivElement>(null);
  const frameStripRef = useRef<HTMLDivElement>(null);
  
  // Hide touch hint after first interaction
  useEffect(() => {
    const timer = setTimeout(() => setShowTouchHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);
  
  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 24);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2,'0')}:${frames.toString().padStart(2, '0')}`;
  };
  
  // Handle scrub bar touch
  const handleScrubStart = useCallback((point: Point) => {
    if (!scrubBarRef.current) return;
    
    setIsScrubbing(true);
    setShowTouchHint(false);
    
    const rect = scrubBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (point.x - rect.left) / rect.width));
    onSeek(x * totalDuration);
  }, [totalDuration, onSeek]);
  
  const handleScrubMove = useCallback((point: Point) => {
    if (!isScrubbing || !scrubBarRef.current) return;
    
    const rect = scrubBarRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (point.x - rect.left) / rect.width));
    onSeek(x * totalDuration);
  }, [isScrubbing, totalDuration, onSeek]);
  
  const handleScrubEnd = useCallback(() => {
    setIsScrubbing(false);
  }, []);
  
  // Scrub bar gestures (touch devices only)
  const { ref: scrubGestureRef } = useTouchGestures(
    isTouchDevice ? {
      onTap: handleScrubStart,
      onLongPress: handleScrubStart,
      onPan: (_, point) => handleScrubMove(point),
      onPanEnd: handleScrubEnd,
    } : {},
    {
      enablePinch: false,
      enableSwipe: false,
      enableDoubleTap: false,
      enableLongPress: isTouchDevice,
      enablePan: isTouchDevice,
    }
  );
  
  // Frame strip gestures (touch devices only)
  const { ref: frameStripGestureRef, gestureState } = useTouchGestures(
    isTouchDevice ? {
      onPinch: (scale) => {
        setTimeScale(Math.min(3, Math.max(0.5, scale)));
      },
      onPan: (delta) => {
        if (frameStripRef.current) {
          frameStripRef.current.scrollLeft -= delta.x;
        }
      },
      onSwipeLeft: () => {
        if (currentFrameIndex < frames.length - 1) {
          onFrameSelect(currentFrameIndex + 1);
        }
      },
      onSwipeRight: () => {
        if (currentFrameIndex > 0) {
          onFrameSelect(currentFrameIndex - 1);
        }
      },
    } : {},
    {
      enablePinch: isTouchDevice,
      enablePan: isTouchDevice,
      enableSwipe: isTouchDevice,
      enableLongPress: false,
      enableDoubleTap: false,
    }
  );
  
  // Desktop mouse wheel zoom on frame strip
  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    if (isTouchDevice) return;
    
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setTimeScale(prev => Math.min(3, Math.max(0.5, prev + delta)));
    }
  }, [isTouchDevice]);
  
  // Desktop right-click on frame
  const handleFrameContextMenu = useCallback((e: React.MouseEvent, index: number) => {
    if (isTouchDevice) return;
    
    e.preventDefault();
    setContextMenuAnchor({ x: e.clientX, y: e.clientY, frameIndex: index });
  }, [isTouchDevice]);
  
  // Desktop double-click on frame
  const handleFrameDoubleClick = useCallback((index: number) => {
    if (isTouchDevice) return;
    onFrameEdit?.(index);
  }, [isTouchDevice, onFrameEdit]);
  
  // Keyboard navigation for desktop
  useEffect(() => {
    if (isTouchDevice) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          if (currentFrameIndex > 0) onFrameSelect(currentFrameIndex - 1);
          break;
        case 'ArrowRight':
          if (currentFrameIndex < frames.length - 1) onFrameSelect(currentFrameIndex + 1);
          break;
        case 'Home':
          onFrameSelect(0);
          break;
        case 'End':
          onFrameSelect(frames.length - 1);
          break;
        case '':
          e.preventDefault();
          isPlaying ? onPause() : onPlay();
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTouchDevice, currentFrameIndex, frames.length, isPlaying, onFrameSelect, onPlay, onPause]);
  
  // Frame thumbnail handlers
  const handleFrameTap = useCallback((index: number) => {
    onFrameSelect(index);
    setShowTouchHint(false);
  }, [onFrameSelect]);
  
  const handleFrameDoubleTap = useCallback((index: number) => {
    onFrameEdit?.(index);
  }, [onFrameEdit]);
  
  const handleFrameLongPress = useCallback((point: Point, index: number) => {
    setContextMenuAnchor({ x: point.x, y: point.y, frameIndex: index });
  }, []);
  
  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenuAnchor(null);
  }, []);
  
  // Zoom controls
  const zoomIn = useCallback(() => {
    setTimeScale(prev => Math.min(3, prev + 0.5));
  }, []);
  
  const zoomOut = useCallback(() => {
    setTimeScale(prev => Math.max(0.5, prev - 0.5));
  }, []);
  
  const fitToView = useCallback(() => {
    setTimeScale(1);
  }, []);
  
  // Auto-scroll to current frame
  useEffect(() => {
    if (frameStripRef.current && !gestureState.isGesturing) {
      const frameElement = frameStripRef.current.children[currentFrameIndex] as HTMLElement;
      if (frameElement) {
        frameElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentFrameIndex, gestureState.isGesturing]);
  
  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;
  
  return (
    <TimelineContainer elevation={0}>
      {/* Header with Controls */}
      <TimelineHeader>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton size="small" onClick={() => onFrameSelect(0)}>
            <FirstPage />
          </IconButton>
          <IconButton size="small" onClick={() => currentFrameIndex > 0 && onFrameSelect(currentFrameIndex - 1)}>
            <SkipPrevious />
          </IconButton>
          <IconButton
            onClick={isPlaying ? onPause : onPlay}
            sx={{
              bgcolor: 'rgba(33, 150, 243, 0.2)',
              width: 48,
              height: 48}}
          >
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
          <IconButton size="small" onClick={() => currentFrameIndex < frames.length - 1 && onFrameSelect(currentFrameIndex + 1)}>
            <SkipNext />
          </IconButton>
          <IconButton size="small" onClick={() => onFrameSelect(frames.length - 1)}>
            <LastPage />
          </IconButton>
        </Stack>
        
        <TimeDisplay>
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </TimeDisplay>
        
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={zoomOut}>
              <ZoomOut fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'center' }}>
            {Math.round(timeScale * 100)}%
          </Typography>
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={zoomIn}>
              <ZoomIn fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Fit">
            <IconButton size="small" onClick={fitToView}>
              <FitScreen fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </TimelineHeader>
      
      {/* Scrub Bar */}
      <ScrubBar
        ref={(el) => {
          (scrubBarRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (scrubGestureRef as React.MutableRefObject<HTMLElement | null>).current = el;
        }}
      >
        <ScrubProgress sx={{ width: `${progress}%` }} />
        
        {/* Frame Markers */}
        <FrameMarkers>
          {frames.map((frame, index) => (
            <FrameMarker
              key={frame.id}
              sx={{
                left: `${(frame.startTime / totalDuration) * 100}%`,
                backgroundColor: index === currentFrameIndex ? '#2196F3' : undefined}}
            />
          ))}
        </FrameMarkers>
        
        {/* Scrub Handle */}
        <ScrubHandle isScrubbing={isScrubbing} sx={{ left: `${progress}%` }} />
      </ScrubBar>
      
      {/* Frame Strip */}
      <Box sx={{ position: 'relative' }}>
        <FrameStrip
          ref={(el) => {
            (frameStripRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            if (isTouchDevice) {
              (frameStripGestureRef as React.MutableRefObject<HTMLElement | null>).current = el;
            }
          }}
          onWheel={handleWheelZoom}
          sx={{
            transform: `scaleX(${timeScale})`,
            transformOrigin: 'left center',
            // Only disable touch-action on touch devices
            touchAction: isTouchDevice ? 'none' : 'auto'}}
        >
          {frames.map((frame, index) => {
            // Individual frame gesture handling (touch only)
            const FrameWithGestures: React.FC = () => {
              const { ref: frameRef } = useTouchGestures(
                isTouchDevice ? {
                  onTap: () => handleFrameTap(index),
                  onDoubleTap: () => handleFrameDoubleTap(index),
                  onLongPress: (point) => handleFrameLongPress(point, index),
                } : {},
                {
                  enablePinch: false,
                  enablePan: false,
                  enableSwipe: false,
                  enableLongPress: isTouchDevice,
                  enableDoubleTap: isTouchDevice,
                }
              );
              
              return (
                <FrameThumbnail
                  ref={isTouchDevice ? frameRef as React.RefObject<HTMLDivElement> : undefined}
                  $isActive={index === currentFrameIndex}
                  $isDragging={draggedFrame === index}
                  // Desktop handlers
                  onClick={!isTouchDevice ? () => handleFrameTap(index) : undefined}
                  onDoubleClick={!isTouchDevice ? () => handleFrameDoubleClick(index) : undefined}
                  onContextMenu={!isTouchDevice ? (e) => handleFrameContextMenu(e, index) : undefined}
                >
                  <Box
                    component="img"
                    src={frame.imageUrl}
                    alt={frame.title}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'}}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      padding: '2px 4px',
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'}}
                  >
                    <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 600}}>
                      {index + 1}
                    </Typography>
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      <Timer sx={{ fontSize: 10 }} />
                      <Typography variant="caption" sx={{ fontSize: 9 }}>
                        {frame.duration.toFixed(1)}s
                      </Typography>
                    </Stack>
                  </Box>
                </FrameThumbnail>
              );
            };
            
            return <FrameWithGestures key={frame.id} />;
          })}
          
          {/* Add Frame Button */}
          {onFrameAdd && (
            <FrameThumbnail
              onClick={() => onFrameAdd(frames.length - 1)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.05)',
                border: '2px dashed rgba(255,255,255,0.2)', '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderColor: 'primary.main',
                }}}
            >
              <Add sx={{ fontSize: 32, color: 'text.secondary' }} />
            </FrameThumbnail>
          )}
        </FrameStrip>
        
        {/* Touch/Desktop Hint */}
        <Fade in={showTouchHint}>
          <TouchHint>
            {isTouchDevice
              ? 'Swipe frames | Pinch to zoom | Long-press for options' : 'Ctrl+Scroll to zoom | Double-click to edit | Right-click for options | Space to play'}
          </TouchHint>
        </Fade>
      </Box>
      
      {/* Context Menu */}
      <Menu
        open={Boolean(contextMenuAnchor)}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenuAnchor ? { top: contextMenuAnchor.y, left: contextMenuAnchor.x } : undefined}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            minWidth: 180,
          }}}
      >
        <MenuItem onClick={() => { onFrameEdit?.(contextMenuAnchor!.frameIndex); handleCloseContextMenu(); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          <ListItemText>Edit Frame</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onFrameDuplicate?.(contextMenuAnchor!.frameIndex); handleCloseContextMenu(); }}>
          <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { onFrameAdd?.(contextMenuAnchor!.frameIndex); handleCloseContextMenu(); }}>
          <ListItemIcon><Add fontSize="small" /></ListItemIcon>
          <ListItemText>Insert After</ListItemText>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem
          onClick={() => { onFrameDelete?.(contextMenuAnchor!.frameIndex); handleCloseContextMenu(); }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><Delete fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </TimelineContainer>
  );
};

export default TouchTimeline;

