/**
 * AnimatedTimeline - Timeline with rich animations for storyboard playback
 * 
 * Features:
 * - Playhead pulse on beat
 * - Frame transition effects (flip, slide, fade)
 * - Scrub preview
 * - Progress indicator with gradient
 * - Waveform visualization (optional)
 * - Keyboard navigation feedback
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Stack,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  FirstPage,
  LastPage,
  Repeat,
  RepeatOne,
  SlowMotionVideo,
  Speed,
  Fullscreen,
  VolumeUp,
  VolumeOff,
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import {
  playheadPulse,
  cardFlip,
  fadeInUp,
  slideInRight,
  animationDurations,
  animationEasings,
} from '../animations/storyboardAnimations';

// =============================================================================
// Types
// =============================================================================

export interface TimelineFrame {
  id: string;
  imageUrl: string;
  duration: number; // Seconds
  startTime: number; // Seconds from start
}

export interface AnimatedTimelineProps {
  frames: TimelineFrame[];
  currentFrameIndex: number;
  isPlaying: boolean;
  currentTime: number; // Current playback time in seconds
  totalDuration: number;
  playbackSpeed: number;
  loopMode: 'none' | 'all' | 'single';
  isMuted?: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onFrameSelect: (index: number) => void;
  onPrevFrame: () => void;
  onNextFrame: () => void;
  onFirstFrame: () => void;
  onLastFrame: () => void;
  onSpeedChange: (speed: number) => void;
  onLoopChange: (mode: 'none' | 'all' | 'single') => void;
  onMuteToggle?: () => void;
  onFullscreen?: () => void;
}

// =============================================================================
// Animations
// =============================================================================

const playheadGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 10px 2px rgba(33, 150, 243, 0.5);
  }
  50% {
    box-shadow: 0 0 20px 4px rgba(33, 150, 243, 0.8);
  }
`;

const frameEnter = keyframes`
  0% {
    transform: translateX(20px);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
`;

const frameExit = keyframes`
  0% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(-20px);
    opacity: 0;
  }
`;

const progressGradient = keyframes`
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
`;

const beatPulse = keyframes`
  0%, 100% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(1.05);
  }
`;

// =============================================================================
// Styled Components
// =============================================================================

const TimelineContainer = styled(Paper)({
  backgroundColor: '#1a1a2e',
  borderRadius: 8,
  padding: 16,
  userSelect: 'none',
});

const FrameStrip = styled(Box)({
  display: 'flex',
  gap: 4,
  padding: '8px 0',
  overflowX: 'auto',
  overflowY: 'hidden',
  scrollBehavior: 'smooth', '&::-webkit-scrollbar': {
    height: 6,
  }, '&::-webkit-scrollbar-track': {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
  }, '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3, '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
  },
});

interface FrameThumbnailProps {
  $isActive?: boolean;
  $isEntering?: boolean;
  $isExiting?: boolean;
}

const FrameThumbnail = styled(Box, {
  shouldForwardProp: (prop) => !prop.toString().startsWith('$,'),
})<FrameThumbnailProps>(({ $isActive, $isEntering, $isExiting }) => ({
  position: 'relative',
  width: 80,
  height: 45,
  flexShrink: 0,
  borderRadius: 4,
  overflow: 'hidden',
  cursor: 'pointer',
  border: $isActive ? '2px solid #2196F3' : '2px solid transparent',
  transition: `all ${animationDurations.fast} ${animationEasings.easeOut}`,
  
  ...($isEntering && {
    animation: `${frameEnter} 0.3s ${animationEasings.spring} forwards`,
  }),
  
  ...($isExiting && {
    animation: `${frameExit} 0.3s ${animationEasings.easeIn} forwards`,
  })'&:hover': {
    transform: 'scale(1.1)',
    zIndex: 1,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  
  ...($isActive && {
    transform: 'scale(1.1)',
    boxShadow: '0 0 15px rgba(33, 150, 243, 0.4)',
  }),
}));

const ProgressBarContainer = styled(Box)({
  position: 'relative',
  height: 8,
  backgroundColor: 'rgba(255,255,255,0.1)',
  borderRadius: 4,
  cursor: 'pointer',
  marginTop: 12,
});

interface ProgressFillProps {
  $isPlaying?: boolean;
}

const ProgressFill = styled(Box, {
  shouldForwardProp: (prop) => !prop.toString().startsWith('$,'),
})<ProgressFillProps>(({ $isPlaying }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  background: 'linear-gradient(90deg, #2196F3, #21CBF3, #2196F3)',
  backgroundSize: '200% 100%',
  borderRadius: 4,
  transition: 'width 0.1s linear',
  
  ...($isPlaying && {
    animation: `${progressGradient} 2s linear infinite`,
  }),
}));

interface PlayheadProps {
  $isPlaying?: boolean;
}

const Playhead = styled(Box, {
  shouldForwardProp: (prop) => !prop.toString().startsWith('$,'),
})<PlayheadProps>(({ $isPlaying }) => ({
  position: 'absolute',
  top: -4,
  width: 16,
  height: 16,
  backgroundColor: '#2196F3',
  borderRadius: '50%',
  transform: 'translateX(-50%)',
  cursor: 'grab',
  transition: 'left 0.1s linear',
  
  ...($isPlaying && {
    animation: `${playheadGlow} 1s ease-in-out infinite`,
  })'&:active': {
    cursor: 'grabbing',
    transform: 'translateX(-50%) scale(1.2)',
  }, '&::after': {
    content: ', ""',
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '8px solid #2196F3',
  },
}));

const FrameMarker = styled(Box)({
  position: 'absolute',
  top: 0,
  width: 2,
  height: '100%',
  backgroundColor: 'rgba(255,255,255,0.2)','&::after': {
    content: ', ""',
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
});

const PlaybackButton = styled(IconButton)({
  transition: `all ${animationDurations.fast} ${animationEasings.easeOut}`, '&:active': {
    transform: 'scale(0.95)',
  },
});

const TimeDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 14,
  color: 'rgba(255,255,255,0.7)',
  minWidth: 100,
  textAlign: 'center',
});

// =============================================================================
// Component
// =============================================================================

export const AnimatedTimeline: React.FC<AnimatedTimelineProps> = ({
  frames,
  currentFrameIndex,
  isPlaying,
  currentTime,
  totalDuration,
  playbackSpeed,
  loopMode,
  isMuted = false,
  onPlay,
  onPause,
  onSeek,
  onFrameSelect,
  onPrevFrame,
  onNextFrame,
  onFirstFrame,
  onLastFrame,
  onSpeedChange,
  onLoopChange,
  onMuteToggle,
  onFullscreen,
}) => {
  const progressRef = useRef<HTMLDivElement>(null);
  const frameStripRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [prevFrameIndex, setPrevFrameIndex] = useState(currentFrameIndex);
  const [transitionDirection, setTransitionDirection] = useState<'enter' | 'exit' | null>(null);

  // Detect frame change direction
  useEffect(() => {
    if (currentFrameIndex !== prevFrameIndex) {
      setTransitionDirection(currentFrameIndex > prevFrameIndex ? 'enter' : 'exit');
      setTimeout(() => setTransitionDirection(null), 300);
      setPrevFrameIndex(currentFrameIndex);
    }
  }, [currentFrameIndex, prevFrameIndex]);

  // Auto-scroll to active frame
  useEffect(() => {
    if (frameStripRef.current) {
      const activeFrame = frameStripRef.current.children[currentFrameIndex] as HTMLElement;
      if (activeFrame) {
        activeFrame.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentFrameIndex]);

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 24); // Assuming 24fps
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2,'0')}:${frames.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click/drag
  const handleProgressClick = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(x * totalDuration);
  }, [totalDuration, onSeek]);

  const handleProgressDrag = useCallback((e: MouseEvent) => {
    if (!progressRef.current || !isDragging) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(x * totalDuration);
  }, [totalDuration, onSeek, isDragging]);

  // Mouse event handlers for dragging
  useEffect(() => {
    const handleMouseUp = () => setIsDragging(false);
    
    if (isDragging) {
      window.addEventListener('mousemove', handleProgressDrag);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleProgressDrag);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleProgressDrag]);

  // Speed options
  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <TimelineContainer elevation={0}>
      {/* Frame Strip */}
      <FrameStrip ref={frameStripRef}>
        {frames.map((frame, index) => (
          <FrameThumbnail
            key={frame.id}
            $isActive={index === currentFrameIndex}
            $isEntering={index === currentFrameIndex && transitionDirection === 'enter'}
            $isExiting={index === prevFrameIndex && transitionDirection === 'exit'}
            onClick={() => onFrameSelect(index)}
          >
            <Box
              component="img"
              src={frame.imageUrl}
              alt={`Frame ${index + 1}`}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'}}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                bgcolor: 'rgba(0,0,0,0.7)',
                borderRadius: 0.5,
                px: 0.5,
                fontSize: 10,
                fontFamily: 'monospace'}}
            >
              {frame.duration.toFixed(1)}s
            </Box>
            {index === currentFrameIndex && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 2,
                  left: 2,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#2196F3',
                  animation: `${beatPulse} 1s ease-in-out infinite`}}
              />
            )}
          </FrameThumbnail>
        ))}
      </FrameStrip>

      {/* Progress Bar */}
      <ProgressBarContainer
        ref={progressRef}
        onClick={handleProgressClick}
        onMouseDown={() => setIsDragging(true)}
      >
        <ProgressFill $isPlaying={isPlaying} sx={{ width: `${progress}%` }} />
        
        {/* Frame Markers */}
        {frames.map((frame, index) => (
          <FrameMarker
            key={frame.id}
            sx={{ left: `${(frame.startTime / totalDuration) * 100}%` }}
          />
        ))}
        
        {/* Playhead */}
        <Playhead $isPlaying={isPlaying} sx={{ left: `${progress}%` }} />
      </ProgressBarContainer>

      {/* Controls */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mt: 2 }}
      >
        {/* Left Controls */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Tooltip title="First Frame">
            <PlaybackButton size="small" onClick={onFirstFrame}>
              <FirstPage />
            </PlaybackButton>
          </Tooltip>
          <Tooltip title="Previous Frame">
            <PlaybackButton size="small" onClick={onPrevFrame}>
              <SkipPrevious />
            </PlaybackButton>
          </Tooltip>
          <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
            <PlaybackButton
              onClick={isPlaying ? onPause : onPlay}
              sx={{
                bgcolor: 'rgba(33, 150, 243, 0.2)', '&:hover': { bgcolor: 'rgba(33, 150, 243, 0.3)' }}}
            >
              {isPlaying ? <Pause /> : <PlayArrow />}
            </PlaybackButton>
          </Tooltip>
          <Tooltip title="Next Frame">
            <PlaybackButton size="small" onClick={onNextFrame}>
              <SkipNext />
            </PlaybackButton>
          </Tooltip>
          <Tooltip title="Last Frame">
            <PlaybackButton size="small" onClick={onLastFrame}>
              <LastPage />
            </PlaybackButton>
          </Tooltip>
        </Stack>

        {/* Time Display */}
        <TimeDisplay>
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </TimeDisplay>

        {/* Right Controls */}
        <Stack direction="row" alignItems="center" spacing={1}>
          {/* Playback Speed */}
          <Tooltip title={`Speed: ${playbackSpeed}x`}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SlowMotionVideo sx={{ fontSize: 18, mr: 0.5 }} />
              <Slider
                value={speedOptions.indexOf(playbackSpeed)}
                min={0}
                max={speedOptions.length - 1}
                step={1}
                onChange={(_, value) => onSpeedChange(speedOptions[value as number])}
                sx={{ width: 60 }}
              />
            </Box>
          </Tooltip>

          {/* Loop Mode */}
          <ToggleButtonGroup
            value={loopMode}
            exclusive
            size="small"
            onChange={(_, value) => value && onLoopChange(value)}
          >
            <ToggleButton value="none" size="small">
              <Tooltip title="No Loop">
                <Speed sx={{ fontSize: 18 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="all" size="small">
              <Tooltip title="Loop All">
                <Repeat sx={{ fontSize: 18 }} />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="single" size="small">
              <Tooltip title="Loop Single">
                <RepeatOne sx={{ fontSize: 18 }} />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Volume */}
          {onMuteToggle && (
            <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
              <IconButton size="small" onClick={onMuteToggle}>
                {isMuted ? <VolumeOff /> : <VolumeUp />}
              </IconButton>
            </Tooltip>
          )}

          {/* Fullscreen */}
          {onFullscreen && (
            <Tooltip title="Fullscreen">
              <IconButton size="small" onClick={onFullscreen}>
                <Fullscreen />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
    </TimelineContainer>
  );
};

export default AnimatedTimeline;

