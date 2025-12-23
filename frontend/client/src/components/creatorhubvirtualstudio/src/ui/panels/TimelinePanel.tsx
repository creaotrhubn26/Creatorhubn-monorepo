import React, { useEffect, useRef, useState, useCallback } from 'react';
import { logger } from '../../core/services/logger';

const log = logger.module('TimelinePanel, ');
import {
  Box,
  Paper,
  IconButton,
  Slider,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Loop,
  FiberManualRecord,
  SkipPrevious,
  SkipNext,
  ZoomIn,
  ZoomOut,
  Delete,
  Add,
  ContentCut,
  ContentCopy,
  ContentPaste,
  SelectAll,
} from '@mui/icons-material';
import { useAnimationStore } from '../../state/animationStore';
import type { AnimationTrack, Keyframe, EasingFunction } from '../../state/animationStore';
import { useTabletSupport } from '../../providers/TabletSupportProvider';
import { TouchIconButton, TouchPinchZoom, TouchContextMenu, TouchDraggable } from '../components/TabletAwarePanels';
import { useAccessibility, VisuallyHidden } from '../../providers/AccessibilityProvider';
import { useAccessibility, useAnnounce } from '../../providers/AccessibilityProvider';
import { AccessibleIconButton, AccessibleSlider, VisuallyHidden } from '../components/AccessibleComponents';

interface TimelineKeyframe extends Keyframe {
  x: number; // Pixel position on timeline
}

const TIMELINE_HEIGHT = 400;
const TRACK_HEIGHT = 48;
const RULER_HEIGHT = 40;
const KEYFRAME_SIZE = 12;

export const TimelinePanel: React.FC = () => {
  const {
    tracks,
    currentTime,
    duration,
    fps,
    isPlaying,
    loop: isLooping,
    isRecording,
    play,
    pause,
    stop,
    setCurrentTime,
    toggleLoop,
    setFPS,
    setDuration,
    addKeyframe,
    removeKeyframe,
    updateKeyframe,
  } = useAnimationStore();

  // Tablet support
  const { shouldUseTouch, gestureConfig } = useTabletSupport();
  const isTouch = shouldUseTouch();

  // Accessibility
  const { announce, settings: a11ySettings } = useAccessibility();

  // Accessibility
  const { announce } = useAnnounce();
  const { settings: a11ySettings, prefersKeyboard } = useAccessibility();

  const [zoom, setZoom] = useState(1); // Pixels per frame
  const [scrollLeft, setScrollLeft] = useState(0);
  const [selectedKeyframe, setSelectedKeyframe] = useState<string | null>(null);
  const [isDraggingKeyframe, setIsDraggingKeyframe] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const [keyframeMenuAnchor, setKeyframeMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const [menuKeyframe, setMenuKeyframe] = useState<Keyframe | null>(null);

  // Touch gesture state
  const lastTouchDistance = useRef<number | null>(null);
  const initialZoom = useRef<number>(zoom);
  const isTouchScrubbing = useRef(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate total timeline width in pixels
  const totalFrames = duration * fps;
  const timelineWidth = totalFrames * zoom;

  // Convert frame to pixel position
  const frameToPixel = (frame: number): number => {
    return frame * zoom;
  };

  // Convert pixel position to frame
  const pixelToFrame = (pixel: number): number => {
    return Math.round(pixel / zoom);
  };

  // Handle playback controls with announcements
  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
      announce('Playback paused, ');
    } else {
      play();
      announce('Playback started, ');
    }
  };

  const handleStop = () => {
    stop();
    setCurrentTime(0);
    announce('Playback stopped, returned to start');
  };

  const handlePreviousFrame = () => {
    const newTime = Math.max(0, currentTime - 1);
    setCurrentTime(newTime);
    announce(`Frame ${newTime}`);
  };

  const handleNextFrame = () => {
    const newTime = Math.min(totalFrames, currentTime + 1);
    setCurrentTime(newTime);
    announce(`Frame ${newTime}`);
  };

  const handleZoomIn = () => {
    setZoom((prev) => {
      const newZoom = Math.min(10, prev * 1.5);
      announce(`Zoom ${Math.round(newZoom * 100)}%`);
      return newZoom;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const newZoom = Math.max(0.1, prev / 1.5);
      announce(`Zoom ${Math.round(newZoom * 100)}%`);
      return newZoom;
    });
  };

  // Handle timeline scrubbing
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollLeft;
    const frame = pixelToFrame(x);
    setCurrentTime(Math.max(0, Math.min(totalFrames, frame)));
  };

  // Handle keyframe dragging (mouse)
  const handleKeyframeMouseDown = (e: React.MouseEvent, keyframeId: string, keyframe: Keyframe) => {
    if (isTouch) return; // Use touch handlers on touch devices
    e.stopPropagation();
    setSelectedKeyframe(keyframeId);
    setIsDraggingKeyframe(true);
    setDragStartX(e.clientX);
    setDragStartTime(keyframe.time);
  };

  // Handle keyframe touch (long press for menu, drag to move)
  const handleKeyframeTouchStart = useCallback((e: React.TouchEvent, keyframeId: string, keyframe: Keyframe) => {
    e.stopPropagation();
    setSelectedKeyframe(keyframeId);
    setDragStartX(e.touches[0].clientX);
    setDragStartTime(keyframe.time);
    setIsDraggingKeyframe(true);
  }, []);

  const handleKeyframeTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingKeyframe || !selectedKeyframe) return;

    const deltaX = e.touches[0].clientX - dragStartX;
    const deltaFrames = pixelToFrame(deltaX);
    const newTime = Math.max(0, Math.min(totalFrames, dragStartTime + deltaFrames));

    for (const track of tracks) {
      const keyframe = track.keyframes.find((kf) => kf.id === selectedKeyframe);
      if (keyframe) {
        updateKeyframe(selectedKeyframe, { ...keyframe, time: newTime });
        break;
      }
    }
  }, [isDraggingKeyframe, selectedKeyframe, dragStartX, dragStartTime, totalFrames, tracks, updateKeyframe]);

  const handleKeyframeTouchEnd = useCallback(() => {
    setIsDraggingKeyframe(false);
  }, []);

  // Handle keyframe long press for context menu
  const handleKeyframeLongPress = useCallback((keyframeId: string, keyframe: Keyframe, x: number, y: number) => {
    setSelectedKeyframe(keyframeId);
    setMenuKeyframe(keyframe);
    setKeyframeMenuAnchor({ x, y });
  }, []);

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingKeyframe || !selectedKeyframe || isTouch) return;

    const deltaX = e.clientX - dragStartX;
    const deltaFrames = pixelToFrame(deltaX);
    const newTime = Math.max(0, Math.min(totalFrames, dragStartTime + deltaFrames));

    // Find and update the keyframe
    for (const track of tracks) {
      const keyframe = track.keyframes.find((kf) => kf.id === selectedKeyframe);
      if (keyframe) {
        updateKeyframe(selectedKeyframe, { ...keyframe, time: newTime });
        break;
      }
    }
  };

  const handleMouseUp = () => {
    setIsDraggingKeyframe(false);
  };

  // Timeline touch handling for scrubbing and pinch zoom
  const handleTimelineTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - start scrubbing
      isTouchScrubbing.current = true;
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left + scrollLeft;
        const frame = pixelToFrame(x);
        setCurrentTime(Math.max(0, Math.min(totalFrames, frame)));
      }
    } else if (e.touches.length === 2) {
      // Two fingers - prepare for pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      lastTouchDistance.current = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      initialZoom.current = zoom;
    }
  }, [scrollLeft, totalFrames, zoom, setCurrentTime]);

  const handleTimelineTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isTouchScrubbing.current) {
      // Scrubbing
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.touches[0].clientX - rect.left + scrollLeft;
        const frame = pixelToFrame(x);
        setCurrentTime(Math.max(0, Math.min(totalFrames, frame)));
      }
    } else if (e.touches.length === 2 && lastTouchDistance.current !== null) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const scale = distance / lastTouchDistance.current;
      const newZoom = Math.max(0.1, Math.min(10, initialZoom.current * scale));
      setZoom(newZoom);
    }
  }, [scrollLeft, totalFrames, setCurrentTime]);

  const handleTimelineTouchEnd = useCallback(() => {
    isTouchScrubbing.current = false;
    lastTouchDistance.current = null;
  }, []);

  useEffect(() => {
    if (isDraggingKeyframe && !isTouch) {
      window.addEventListener('mousemove, ', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingKeyframe, selectedKeyframe, dragStartX, dragStartTime, isTouch]);

  // Draw timeline canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = timelineWidth;
    canvas.height = RULER_HEIGHT;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw ruler
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw frame markers
    ctx.strokeStyle = '#444';
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';

    const frameInterval = Math.max(1, Math.floor(20 / zoom)); // Adaptive interval

    for (let frame = 0; frame <= totalFrames; frame += frameInterval) {
      const x = frameToPixel(frame);

      // Draw tick
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - 10);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();

      // Draw frame number
      if (frame % (frameInterval * 2) === 0) {
        const time = (frame / fps).toFixed(1);
        ctx.fillText(`${frame}f (${time}s)`, x + 2, 12);
      }
    }

    // Draw current time indicator
    const currentX = frameToPixel(currentTime);
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentX, 0);
    ctx.lineTo(currentX, RULER_HEIGHT);
    ctx.stroke();
  }, [zoom, currentTime, totalFrames, fps, timelineWidth]);

  // Keyframe size based on touch mode
  const keyframeSize = isTouch ? KEYFRAME_SIZE * 1.5 : KEYFRAME_SIZE;
  const trackHeight = isTouch ? TRACK_HEIGHT * 1.2 : TRACK_HEIGHT;

  // Render track with keyframes
  const renderTrack = (track: AnimationTrack, index: number) => {
    const keyframesWithPositions: TimelineKeyframe[] = track.keyframes.map((kf) => ({
      ...kf,
      x: frameToPixel(kf.time),
    }));

    return (
      <Box
        key={track.id}
        sx={{
          height: trackHeight,
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: index % 2 === 0 ? '#1a1a1a' : '#222',
          position: 'relative'}}
      >
        {/* Track label */}
        <Box
          sx={{
            width: isTouch ? 160 : 200,
            px: isTouch ? 1 : 2,
            borderRight: '1px solid #333',
            position: 'sticky',
            left: 0,
            backgroundColor: 'inherit',
            zIndex: 2}}
        >
          <Typography variant="body2" noWrap sx={{ fontSize: isTouch ? '0.75rem' : '0.875rem' }}>
            {track.nodeId} • {track.property}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {track.keyframes.length} keyframes
          </Typography>
        </Box>

        {/* Keyframes */}
        <Box
          sx={{
            position: 'relative',
            flex: 1,
            height: '100%'}}
        >
          {keyframesWithPositions.map((kf) => {
            // Long press timer for touch devices
            let longPressTimer: NodeJS.Timeout | null = null;
            let touchStartPos: { x: number; y: number } | null = null;

            const handleTouchStartKeyframe = (e: React.TouchEvent) => {
              e.stopPropagation();
              const touch = e.touches[0];
              touchStartPos = { x: touch.clientX, y: touch.clientY };

              // Start long press timer for context menu
              longPressTimer = setTimeout(() => {
                if (touchStartPos) {
                  handleKeyframeLongPress(kf.id, kf, touchStartPos.x, touchStartPos.y);
                }
              }, 500);

              handleKeyframeTouchStart(e, kf.id, kf);
            };

            const handleTouchMoveKeyframe = (e: React.TouchEvent) => {
              if (touchStartPos) {
                const touch = e.touches[0];
                const dx = Math.abs(touch.clientX - touchStartPos.x);
                const dy = Math.abs(touch.clientY - touchStartPos.y);
                // Cancel long press if moved too much
                if (dx > 10 || dy > 10) {
                  if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                  }
                }
              }
              handleKeyframeTouchMove(e);
            };

            const handleTouchEndKeyframe = () => {
              if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
              }
              touchStartPos = null;
              handleKeyframeTouchEnd();
            };

            return (
              <Tooltip
                key={kf.id}
                title={isTouch ? ', ' : `Frame ${kf.time} - ${kf.easing} - ${JSON.stringify(kf.value)}`}
                enterDelay={isTouch ? 99999 : 300}
              >
                <Box
                  onMouseDown={(e) => handleKeyframeMouseDown(e, kf.id, kf)}
                  onTouchStart={isTouch ? handleTouchStartKeyframe : undefined}
                  onTouchMove={isTouch ? handleTouchMoveKeyframe : undefined}
                  onTouchEnd={isTouch ? handleTouchEndKeyframe : undefined}
                  sx={{
                    position: 'absolute',
                    left: kf.x - keyframeSize / 2,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: keyframeSize,
                    height: keyframeSize,
                    borderRadius: '50%',
                    backgroundColor: selectedKeyframe === kf.id ? '#2196f3' : '#4caf50',
                    border: '2px solid #fff',
                    cursor: 'grab',
                    touchAction: 'none', '&:hover': {
                      backgroundColor: '#2196f3',
                      transform: 'translateY(-50%) scale(1.2)',
                    }, '&:active': {
                      cursor: 'grabbing',
                    },
                    transition: 'all 0.15s'}}
                />
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    );
  };

  return (
    <Paper
      elevation={3}
      role="region"
      aria-label="Animation Timeline"
      sx={{
        width: '100%',
        height: TIMELINE_HEIGHT,
        backgroundColor: '#0a0a0a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'}}
    >
      {/* Screen reader status */}
      <VisuallyHidden>
        <div role="status" aria-live="polite">
          {isPlaying ? 'Playing' : 'Paused'}, Frame {currentTime} of {totalFrames}, {tracks.length} tracks
        </div>
      </VisuallyHidden>
      {/* Playback Controls */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: isTouch ? 0.5 : 1,
          p: isTouch ? 1.5 : 1,
          borderBottom: '1px solid #333',
          backgroundColor: '#1a1a1a',
          flexWrap: isTouch ? 'wrap' : 'nowrap'}}
      >
        {/* Transport controls */}
        <TouchIconButton
          onClick={handleStop}
          touchSize={isTouch ? 'medium' : 'small'}
          disabled={!isPlaying && currentTime === 0}
        >
          <Stop />
        </TouchIconButton>
        <TouchIconButton onClick={handlePreviousFrame} touchSize={isTouch ? 'medium' : 'small'}>
          <SkipPrevious />
        </TouchIconButton>
        <TouchIconButton
          onClick={handlePlayPause}
          touchSize={isTouch ? 'large' : 'medium'}
          color={isPlaying ? 'primary' : 'default'}
          sx={{
            bgcolor: isPlaying ? 'primary.main' : 'action.selected','&:hover': { bgcolor: isPlaying ? 'primary.dark' : 'action.hover' }}}
        >
          {isPlaying ? <Pause /> : <PlayArrow />}
        </TouchIconButton>
        <TouchIconButton onClick={handleNextFrame} touchSize={isTouch ? 'medium' : 'small'}>
          <SkipNext />
        </TouchIconButton>
        <TouchIconButton
          onClick={toggleLoop}
          touchSize={isTouch ? 'medium' : 'small'}
          color={isLooping ? 'primary' : 'default'}
        >
          <Loop />
        </TouchIconButton>

        <Divider orientation="vertical" flexItem sx={{ mx: isTouch ? 0.5 : 1 }} />

        {/* Time display */}
        <Typography
          variant={isTouch ? 'caption' : 'body2'}
          sx={{ minWidth: isTouch ? 90 : 120, fontFamily: 'monospace' }}
        >
          {currentTime}f / {totalFrames}f
        </Typography>

        {!isTouch && <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />}

        {/* FPS selector - hide on tablet for space */}
        {!isTouch && (
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={fps}
              onChange={(e) => setFPS(e.target.value as number)}
              sx={{ color: '#fff' }}
            >
              <MenuItem value={24}>24 FPS</MenuItem>
              <MenuItem value={30}>30 FPS</MenuItem>
              <MenuItem value={60}>60 FPS</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Duration input - hide on tablet */}
        {!isTouch && (
          <FormControl size="small" sx={{ minWidth: 100 }}>
            <Select
              value={duration}
              onChange={(e) => setDuration(e.target.value as number)}
              sx={{ color: '#fff' }}
            >
              <MenuItem value={3}>3s</MenuItem>
              <MenuItem value={5}>5s</MenuItem>
              <MenuItem value={10}>10s</MenuItem>
              <MenuItem value={15}>15s</MenuItem>
              <MenuItem value={30}>30s</MenuItem>
              <MenuItem value={60}>60s</MenuItem>
            </Select>
          </FormControl>
        )}

        {!isTouch && <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />}

        {/* Zoom controls */}
        <TouchIconButton onClick={handleZoomOut} touchSize={isTouch ? 'medium' : 'small'}>
          <ZoomOut />
        </TouchIconButton>
        <Typography variant="caption" sx={{ minWidth: isTouch ? 40 : 50, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </Typography>
        <TouchIconButton onClick={handleZoomIn} touchSize={isTouch ? 'medium' : 'small'}>
          <ZoomIn />
        </TouchIconButton>

        {/* Recording indicator */}
        {isRecording && (
          <Chip
            icon={<FiberManualRecord />}
            label={isTouch ? 'REC' : 'RECORDING'}
            color="error"
            size="small"
            sx={{ ml: 'auto' }}
          />
        )}

        {/* Track count */}
        {!isTouch && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: isRecording ? 1 : 'auto' }}>
            {tracks.length} tracks
          </Typography>
        )}
      </Box>

      {/* Timeline Ruler */}
      <Box
        sx={{
          height: RULER_HEIGHT,
          borderBottom: '1px solid #333',
          overflow: 'hidden',
          position: 'relative'}}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            left: -scrollLeft,
            top: 0}}
        />
      </Box>

      {/* Tracks container */}
      <Box
        ref={timelineRef}
        onClick={isTouch ? undefined : handleTimelineClick}
        onTouchStart={isTouch ? handleTimelineTouchStart : undefined}
        onTouchMove={isTouch ? handleTimelineTouchMove : undefined}
        onTouchEnd={isTouch ? handleTimelineTouchEnd : undefined}
        onScroll={(e) => setScrollLeft((e.target as HTMLDivElement).scrollLeft)}
        sx={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'auto',
          cursor: 'pointer',
          position: 'relative',
          touchAction: isTouch ? 'pan-x' : 'auto',
          WebkitOverflowScrolling: 'touch'}}
      >
        <Box sx={{ width: Math.max(timelineWidth, 800), minHeight: '100%' }}>
          {tracks.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'text.secondary',
                p: 2}}
            >
              <Typography variant={isTouch ? 'body2' : 'body1'} textAlign="center">
                No animation tracks.{isTouch ? '\n' : ', '}Start recording or add keyframes manually.
              </Typography>
            </Box>
          ) : (
            tracks.map((track, index) => renderTrack(track, index))
          )}
        </Box>

        {/* Current time indicator line */}
        <Box
          sx={{
            position: 'absolute',
            left: frameToPixel(currentTime) - scrollLeft,
            top: 0,
            bottom: 0,
            width: isTouch ? 3 : 2,
            backgroundColor: '#2196f3',
            pointerEvents: 'none',
            zIndex: 1,
            boxShadow: isTouch ? '0 0 8px rgba(33,150,243,0.5)' : 'none'}}
        />
      </Box>

      {/* Keyframe context menu */}
      <Menu
        open={Boolean(keyframeMenuAnchor)}
        onClose={() => {
          setKeyframeMenuAnchor(null);
          setMenuKeyframe(null);
        }}
        anchorReference="anchorPosition"
        anchorPosition={keyframeMenuAnchor ? { top: keyframeMenuAnchor.y, left: keyframeMenuAnchor.x } : undefined}
        PaperProps={{
          sx: {
            minWidth: isTouch ? 200 : 160'& .MuiMenuItem-root': {
              minHeight: isTouch ? 48 : 40,
            },
          }}}
      >
        <MenuItem
          onClick={() => {
            if (menuKeyframe && selectedKeyframe) {
              // Copy keyframe to clipboard (stored in state)
              log.debug('Copy keyframe: ', menuKeyframe);
            }
            setKeyframeMenuAnchor(null);
          }}
        >
          <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
          <ListItemText>Copy</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (selectedKeyframe) {
              removeKeyframe(selectedKeyframe);
            }
            setKeyframeMenuAnchor(null);
            setMenuKeyframe(null);
            setSelectedKeyframe(null);
          }}
        >
          <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem disabled>
          <ListItemText
            primary={menuKeyframe ? `Frame ${menuKeyframe.time}` : ''}
            secondary={menuKeyframe ? menuKeyframe.easing :''}
          />
        </MenuItem>
      </Menu>
    </Paper>
  );
};
