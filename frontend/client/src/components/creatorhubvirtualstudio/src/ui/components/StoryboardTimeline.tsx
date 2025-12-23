/**
 * StoryboardTimeline - Horizontal timeline view for storyboard frames
 * 
 * Features:
 * - Horizontal scrolling timeline
 * - Frame duration visualization
 * - Drag and drop reordering
 * - Playhead for animatic preview
 * - Timecode ruler
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Slider,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  Stop,
  ZoomIn,
  ZoomOut,
} from '@mui/icons-material';
import {
  useStoryboardStore,
  useCurrentStoryboard,
  useSelectedFrame,
  StoryboardFrame,
  getShotTypeColor,
  formatDuration,
} from '../../state/storyboardStore';

// =============================================================================
// Types
// =============================================================================

interface TimelineProps {
  onFrameClick?: (frame: StoryboardFrame) => void;
  onFrameDoubleClick?: (frame: StoryboardFrame) => void;
}

// =============================================================================
// Timecode Functions
// =============================================================================

const formatTimecode = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 24); // Assuming 24fps
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2,'0')}:${frames.toString().padStart(2,'0')}`;
};

const getTimecodeTicks = (totalDuration: number, zoom: number): { time: number; major: boolean }[] => {
  const ticks: { time: number; major: boolean }[] = [];
  const interval = zoom > 1.5 ? 1 : zoom > 0.75 ? 2 : 5;
  for (let t = 0; t <= totalDuration; t += interval) {
    ticks.push({ time: t, major: t % (interval * 5) === 0 });
  }
  return ticks;
};

// =============================================================================
// Timeline Frame Component
// =============================================================================

interface TimelineFrameProps {
  frame: StoryboardFrame;
  isSelected: boolean;
  pixelsPerSecond: number;
  startTime: number;
  onClick: () => void;
  onDoubleClick: () => void;
}

const TimelineFrame: React.FC<TimelineFrameProps> = ({
  frame,
  isSelected,
  pixelsPerSecond,
  startTime,
  onClick,
  onDoubleClick,
}) => {
  const width = frame.duration * pixelsPerSecond;
  const left = startTime * pixelsPerSecond;

  return (
    <Box
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      sx={{
        position: 'absolute',
        left,
        width,
        height: 80,
        minWidth: 60,
        borderRadius: 1,
        overflow: 'hidden',
        cursor: 'pointer',
        border: isSelected ? '2px solid' : '1px solid',
        borderColor: isSelected ? 'primary.main' : 'divider',
        bgcolor: '#1e1e2e',
        transition: 'all 0.15s','&:hover': {
          borderColor: 'primary.light',
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}}
    >
      {/* Thumbnail */}
      <Box
        component="img"
        src={frame.thumbnailUrl || frame.imageUrl}
        sx={{
          width: '100%',
          height: 50,
          objectFit: 'cover',
          bgcolor: '#0a0a12'}}
      />

      {/* Info Bar */}
      <Box
        sx={{
          height: 30,
          px: 0.5,
          py: 0.25,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          bgcolor: getShotTypeColor(frame.shotType)}}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#fff', fontSize: 10 }} noWrap>
          {frame.index + 1}. {frame.shotType}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 9 }}>
          {frame.duration}s
        </Typography>
      </Box>
    </Box>
  );
};

// =============================================================================
// Playhead Component
// =============================================================================

interface PlayheadProps {
  position: number;
  pixelsPerSecond: number;
}

const Playhead: React.FC<PlayheadProps> = ({ position, pixelsPerSecond }) => {
  const left = position * pixelsPerSecond;

  return (
    <Box
      sx={{
        position: 'absolute',
        left,
        top: 0,
        bottom: 0,
        width: 2,
        bgcolor: '#ff4444',
        zIndex: 1,
        pointerEvents: 'none','&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: -6,
          width: 0,
          height: 0,
          borderLeft: '7px solid transparent',
          borderRight: '7px solid transparent',
          borderTop: '10px solid #ff4444',
        }}}
    />
  );
};

// =============================================================================
// Main Timeline Component
// =============================================================================

export const StoryboardTimeline: React.FC<TimelineProps> = ({
  onFrameClick,
  onFrameDoubleClick,
}) => {
  const storyboard = useCurrentStoryboard();
  const selectedFrame = useSelectedFrame();
  const { selectFrame, reorderFrames } = useStoryboardStore();

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPosition, setPlayheadPosition] = useState(0);
  const [zoom, setZoom] = useState(1); // pixels per second multiplier
  const timelineRef = useRef<HTMLDivElement>(null);
  const playbackRef = useRef<number | null>(null);

  // Calculate pixel scale (60 pixels = 1 second at zoom 1)
  const pixelsPerSecond = 60 * zoom;

  // Calculate total duration
  const totalDuration = storyboard?.frames.reduce((sum, f) => sum + f.duration, 0) || 0;

  // Calculate frame start times
  const frameStartTimes: Map<string, number> = new Map();
  let accTime = 0;
  storyboard?.frames.forEach((frame) => {
    frameStartTimes.set(frame.id, accTime);
    accTime += frame.duration;
  });

  // Playback logic
  useEffect(() => {
    if (isPlaying) {
      const startTime = performance.now();
      const startPosition = playheadPosition;

      const animate = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const newPosition = startPosition + elapsed;

        if (newPosition >= totalDuration) {
          setPlayheadPosition(0);
          setIsPlaying(false);
        } else {
          setPlayheadPosition(newPosition);
          playbackRef.current = requestAnimationFrame(animate);
        }
      };

      playbackRef.current = requestAnimationFrame(animate);

      return () => {
        if (playbackRef.current) {
          cancelAnimationFrame(playbackRef.current);
        }
      };
    }
  }, [isPlaying, playheadPosition, totalDuration]);

  // Handlers
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleStop = () => {
    setIsPlaying(false);
    setPlayheadPosition(0);
  };
  const handlePrevious = () => {
    if (!storyboard || !selectedFrame) return;
    const idx = storyboard.frames.findIndex((f) => f.id === selectedFrame.id);
    if (idx > 0) {
      selectFrame(storyboard.frames[idx - 1].id);
      setPlayheadPosition(frameStartTimes.get(storyboard.frames[idx - 1].id) || 0);
    }
  };
  const handleNext = () => {
    if (!storyboard || !selectedFrame) return;
    const idx = storyboard.frames.findIndex((f) => f.id === selectedFrame.id);
    if (idx < storyboard.frames.length - 1) {
      selectFrame(storyboard.frames[idx + 1].id);
      setPlayheadPosition(frameStartTimes.get(storyboard.frames[idx + 1].id) || 0);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const scrollLeft = timelineRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const newTime = Math.max(0, Math.min(totalDuration, clickX / pixelsPerSecond));
    setPlayheadPosition(newTime);
  };

  if (!storyboard) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="text.secondary">No storyboard selected</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#12121a' }}>
      {/* Transport Controls */}
      <Paper
        elevation={0}
        sx={{
          p: 1,
          bgcolor: '#1a1a2e',
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1}}
      >
        <Tooltip title="Previous Frame">
          <IconButton size="small" onClick={handlePrevious}>
            <SkipPrevious />
          </IconButton>
        </Tooltip>
        <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
          <IconButton size="small" onClick={isPlaying ? handlePause : handlePlay}>
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Stop">
          <IconButton size="small" onClick={handleStop}>
            <Stop />
          </IconButton>
        </Tooltip>
        <Tooltip title="Next Frame">
          <IconButton size="small" onClick={handleNext}>
            <SkipNext />
          </IconButton>
        </Tooltip>

        <Typography variant="body2" sx={{ fontFamily: 'monospace', ml: 2 }}>
          {formatTimecode(playheadPosition)} / {formatTimecode(totalDuration)}
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        {/* Zoom Controls */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ width: 200 }}>
          <Tooltip title="Zoom Out">
            <IconButton size="small" onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}>
              <ZoomOut fontSize="small" />
            </IconButton>
          </Tooltip>
          <Slider
            value={zoom}
            min={0.25}
            max={3}
            step={0.25}
            onChange={(_, v) => setZoom(v as number)}
            size="small"
          />
          <Tooltip title="Zoom In">
            <IconButton size="small" onClick={() => setZoom(Math.min(3, zoom + 0.25))}>
              <ZoomIn fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>

      {/* Timecode Ruler */}
      <Box
        sx={{
          height: 24,
          bgcolor: '#16162a',
          borderBottom: 1,
          borderColor: 'divider',
          overflow: 'hidden',
          position: 'relative'}}
        ref={timelineRef}
      >
        <Box
          sx={{
            width: Math.max(totalDuration * pixelsPerSecond + 100, '100%'),
            height: '100%',
            position: 'relative'}}
        >
          {getTimecodeTicks(totalDuration, zoom).map((tick) => (
            <Box
              key={tick.time}
              sx={{
                position: 'absolute',
                left: tick.time * pixelsPerSecond,
                height: tick.major ? 24 : 12,
                bottom: 0,
                width: 1,
                bgcolor: tick.major ? 'text.secondary' : 'text.disabled'}}
            >
              {tick.major && (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    bottom: 14,
                    left: 4,
                    fontSize: 9,
                    color: 'text.secondary',
                    whiteSpace: 'nowrap'}}
                >
                  {Math.floor(tick.time / 60)}:{(tick.time % 60).toString().padStart(2, '0')}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Timeline Track */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          bgcolor: '#0a0a12'}}
        onClick={handleTimelineClick}
      >
        <Box
          sx={{
            width: Math.max(totalDuration * pixelsPerSecond + 100'100%'),
            height: 100,
            position: 'relative',
            py: 1,
            px: 1}}
        >
          {/* Frames */}
          {storyboard.frames.map((frame) => (
            <TimelineFrame
              key={frame.id}
              frame={frame}
              isSelected={selectedFrame?.id === frame.id}
              pixelsPerSecond={pixelsPerSecond}
              startTime={frameStartTimes.get(frame.id) || 0}
              onClick={() => {
                selectFrame(frame.id);
                onFrameClick?.(frame);
              }}
              onDoubleClick={() => onFrameDoubleClick?.(frame)}
            />
          ))}

          {/* Playhead */}
          <Playhead position={playheadPosition} pixelsPerSecond={pixelsPerSecond} />
        </Box>
      </Box>
    </Box>
  );
};

export default StoryboardTimeline;

