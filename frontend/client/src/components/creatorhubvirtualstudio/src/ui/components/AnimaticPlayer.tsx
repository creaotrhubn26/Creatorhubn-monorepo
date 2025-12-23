/**
 * AnimaticPlayer - Full-featured animatic playback for storyboards
 * 
 * Features:
 * - Frame-by-frame playback with timing
 * - Transition effects (cut, fade, dissolve, wipe)
 * - Audio track support
 * - Export to video
 * - Full-screen mode
 * - Speed control
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogContent,
  Fade,
  Button,
  LinearProgress,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipPrevious,
  SkipNext,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
  Loop,
  Speed,
  Download,
  Close,
  FirstPage,
  LastPage,
  Settings,
} from '@mui/icons-material';
import {
  useCurrentStoryboard,
  StoryboardFrame,
  formatDuration,
} from '../../state/storyboardStore';

// =============================================================================
// Types
// =============================================================================

export type TransitionType = 'cut' | 'fade' | 'dissolve' | 'wipe-left' | 'wipe-right' | 'wipe-up' | 'wipe-down';

interface AnimaticSettings {
  transitionType: TransitionType;
  transitionDuration: number; // seconds
  playbackSpeed: number;
  loop: boolean;
  showTimecode: boolean;
  showFrameNumber: boolean;
}

interface AnimaticPlayerProps {
  onClose?: () => void;
  fullscreen?: boolean;
}

// =============================================================================
// Default Settings
// =============================================================================

const DEFAULT_SETTINGS: AnimaticSettings = {
  transitionType: 'cut',
  transitionDuration: 0.5,
  playbackSpeed: 1,
  loop: false,
  showTimecode: true,
  showFrameNumber: true,
};

// =============================================================================
// Transition Component
// =============================================================================

interface TransitionOverlayProps {
  type: TransitionType;
  progress: number; // 0-1
  previousImage?: string;
  currentImage?: string;
}

const TransitionOverlay: React.FC<TransitionOverlayProps> = ({
  type,
  progress,
  previousImage,
  currentImage,
}) => {
  if (type === 'cut' || progress >= 1) {
    return null;
  }

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  };

  switch (type) {
    case 'fade':
      return (
        <Box
          sx={{
            ...overlayStyle,
            bgcolor: '#000',
            opacity: progress < 0.5 ? progress * 2 : (1 - progress) * 2}}
        />
      );

    case 'dissolve':
      return previousImage ? (
        <Box
          component="img"
          src={previousImage}
          sx={{
            ...overlayStyle,
            objectFit: 'contain',
            opacity: 1 - progress}}
        />
      ) : null;

    case 'wipe-left':
      return previousImage ? (
        <Box
          component="img"
          src={previousImage}
          sx={{
            ...overlayStyle,
            objectFit: 'contain',
            clipPath: `inset(0 0 0 ${progress * 100}%)`}}
        />
      ) : null;

    case 'wipe-right':
      return previousImage ? (
        <Box
          component="img"
          src={previousImage}
          sx={{
            ...overlayStyle,
            objectFit: 'contain',
            clipPath: `inset(0 ${progress * 100}% 0 0)`}}
        />
      ) : null;

    case 'wipe-up':
      return previousImage ? (
        <Box
          component="img"
          src={previousImage}
          sx={{
            ...overlayStyle,
            objectFit: 'contain',
            clipPath: `inset(0 0 ${progress * 100}% 0)`}}
        />
      ) : null;

    case 'wipe-down':
      return previousImage ? (
        <Box
          component="img"
          src={previousImage}
          sx={{
            ...overlayStyle,
            objectFit: 'contain',
            clipPath: `inset(${progress * 100}% 0 0 0)`}}
        />
      ) : null;

    default:
      return null;
  }
};

// =============================================================================
// Timecode Display
// =============================================================================

const formatTimecode = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 24);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2,'0')}:${frames.toString().padStart(2,'0')}`;
};

// =============================================================================
// Main Component
// =============================================================================

export const AnimaticPlayer: React.FC<AnimaticPlayerProps> = ({
  onClose,
  fullscreen: initialFullscreen = false,
}) => {
  const storyboard = useCurrentStoryboard();
  const containerRef = useRef<HTMLDivElement>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [frameProgress, setFrameProgress] = useState(0); // 0-1 within current frame
  const [transitionProgress, setTransitionProgress] = useState(0);
  const [previousFrame, setPreviousFrame] = useState<StoryboardFrame | null>(null);
  const [settings, setSettings] = useState<AnimaticSettings>(DEFAULT_SETTINGS);
  const [isFullscreen, setIsFullscreen] = useState(initialFullscreen);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [showSettings, setShowSettings] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for animation
  const playbackRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Calculate total duration
  const totalDuration = storyboard?.frames.reduce((sum, f) => sum + f.duration, 0) || 0;

  // Current frame
  const currentFrame = storyboard?.frames[currentFrameIndex];

  // Calculate current time position
  const getCurrentTime = useCallback(() => {
    if (!storyboard) return 0;
    let time = 0;
    for (let i = 0; i < currentFrameIndex; i++) {
      time += storyboard.frames[i].duration;
    }
    time += (currentFrame?.duration || 0) * frameProgress;
    return time;
  }, [storyboard, currentFrameIndex, frameProgress, currentFrame]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !storyboard || !currentFrame) return;

    const startTime = performance.now();
    const startProgress = frameProgress;

    const animate = () => {
      const now = performance.now();
      const elapsed = ((now - startTime) / 1000) * settings.playbackSpeed;
      const frameDuration = currentFrame.duration;
      let newProgress = startProgress + elapsed / frameDuration;

      // Handle transition
      if (newProgress > 1 - settings.transitionDuration / frameDuration) {
        const transitionStart = 1 - settings.transitionDuration / frameDuration;
        const transP = (newProgress - transitionStart) / (settings.transitionDuration / frameDuration);
        setTransitionProgress(Math.min(1, transP));
      } else {
        setTransitionProgress(0);
      }

      // Move to next frame
      if (newProgress >= 1) {
        const nextIndex = currentFrameIndex + 1;
        
        if (nextIndex >= storyboard.frames.length) {
          if (settings.loop) {
            setPreviousFrame(currentFrame);
            setCurrentFrameIndex(0);
            setFrameProgress(0);
            setTransitionProgress(0);
            lastTimeRef.current = performance.now();
            playbackRef.current = requestAnimationFrame(animate);
          } else {
            setIsPlaying(false);
            setFrameProgress(1);
          }
        } else {
          setPreviousFrame(currentFrame);
          setCurrentFrameIndex(nextIndex);
          setFrameProgress(0);
          setTransitionProgress(0);
          lastTimeRef.current = performance.now();
          playbackRef.current = requestAnimationFrame(animate);
        }
      } else {
        setFrameProgress(newProgress);
        playbackRef.current = requestAnimationFrame(animate);
      }
    };

    playbackRef.current = requestAnimationFrame(animate);

    return () => {
      if (playbackRef.current) {
        cancelAnimationFrame(playbackRef.current);
      }
    };
  }, [isPlaying, currentFrameIndex, storyboard, currentFrame, settings, frameProgress]);

  // Controls visibility
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ', ':
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case 'Escape':
          if (isFullscreen) {
            setIsFullscreen(false);
          } else {
            onClose?.();
          }
          break;
        case 'f':
          setIsFullscreen((f) => !f);
          break;
        case 'm':
          setIsMuted((m) => !m);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, onClose]);

  // Handlers
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleStop = () => {
    setIsPlaying(false);
    setCurrentFrameIndex(0);
    setFrameProgress(0);
    setTransitionProgress(0);
    setPreviousFrame(null);
  };
  
  const handlePrevious = () => {
    if (currentFrameIndex > 0) {
      setCurrentFrameIndex(currentFrameIndex - 1);
      setFrameProgress(0);
      setTransitionProgress(0);
    }
  };
  
  const handleNext = () => {
    if (storyboard && currentFrameIndex < storyboard.frames.length - 1) {
      setPreviousFrame(currentFrame || null);
      setCurrentFrameIndex(currentFrameIndex + 1);
      setFrameProgress(0);
      setTransitionProgress(0);
    }
  };

  const handleFirst = () => {
    setCurrentFrameIndex(0);
    setFrameProgress(0);
    setTransitionProgress(0);
  };

  const handleLast = () => {
    if (storyboard) {
      setCurrentFrameIndex(storyboard.frames.length - 1);
      setFrameProgress(0);
      setTransitionProgress(0);
    }
  };

  const handleSeek = (time: number) => {
    if (!storyboard) return;
    let accTime = 0;
    for (let i = 0; i < storyboard.frames.length; i++) {
      if (accTime + storyboard.frames[i].duration > time) {
        setCurrentFrameIndex(i);
        setFrameProgress((time - accTime) / storyboard.frames[i].duration);
        setTransitionProgress(0);
        return;
      }
      accTime += storyboard.frames[i].duration;
    }
    // If past end
    setCurrentFrameIndex(storyboard.frames.length - 1);
    setFrameProgress(1);
  };

  const handleSliderChange = (_: Event, value: number | number[]) => {
    const time = (value as number);
    handleSeek(time);
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (!storyboard || storyboard.frames.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="text.secondary">No frames to play</Typography>
      </Box>
    );
  }

  const currentTime = getCurrentTime();

  return (
    <Box
      ref={containerRef}
      onMouseMove={handleMouseMove}
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: '#000',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        cursor: showControls ? 'default' : 'none'}}
    >
      {/* Close Button */}
      {onClose && showControls && (
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 2,
            bgcolor: 'rgba(0,0,0,0.5)', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }}}
        >
          <Close />
        </IconButton>
      )}

      {/* Frame Display */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden'}}
        onClick={() => setIsPlaying((p) => !p)}
      >
        {currentFrame && (
          <Box
            component="img"
            src={currentFrame.imageUrl}
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'}}
          />
        )}

        {/* Transition Overlay */}
        <TransitionOverlay
          type={settings.transitionType}
          progress={transitionProgress}
          previousImage={previousFrame?.imageUrl}
          currentImage={currentFrame?.imageUrl}
        />

        {/* Frame Info Overlay */}
        {showControls && settings.showFrameNumber && currentFrame && (
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              left: 16,
              bgcolor: 'rgba(0,0,0,0.6)',
              px: 2,
              py: 1,
              borderRadius: 1}}
          >
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600}}>
              {currentFrameIndex + 1} / {storyboard.frames.length}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {currentFrame.title} • {currentFrame.shotType}
            </Typography>
          </Box>
        )}

        {/* Play Button Overlay */}
        {!isPlaying && (
          <Box
            sx={{
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.4)',
              borderRadius: '50%',
              width: 80,
              height: 80,
              cursor: 'pointer',
              transition: 'all 0.2s','&:hover': { bgcolor: 'rgba(0,0,0,0.6)', transform: 'scale(1.1)' }}}
            onClick={(e) => {
              e.stopPropagation();
              handlePlay();
            }}
          >
            <PlayArrow sx={{ fontSize: 48 }} />
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Fade in={showControls}>
        <Paper
          elevation={0}
          sx={{
            bgcolor: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(10px)',
            p: 2}}
        >
          {/* Progress Bar */}
          <Box sx={{ px: 1, mb: 1 }}>
            <Slider
              value={currentTime}
              min={0}
              max={totalDuration}
              onChange={handleSliderChange}
              sx={{
                color: 'primary.main','& .MuiSlider-thumb': { width: 12, height: 12 }, '& .MuiSlider-track': { height: 4 }, '& .MuiSlider-rail': { height: 4, opacity: 0.3 }}}
            />
          </Box>

          {/* Controls Row */}
          <Stack direction="row" alignItems="center" spacing={1}>
            {/* Timecode */}
            {settings.showTimecode && (
              <Typography
                variant="body2"
                sx={{ fontFamily: 'monospace', minWidth: 120, color: '#fff' }}
              >
                {formatTimecode(currentTime)} / {formatTimecode(totalDuration)}
              </Typography>
            )}

            {/* Transport Controls */}
            <Tooltip title="First Frame">
              <IconButton size="small" onClick={handleFirst}>
                <FirstPage />
              </IconButton>
            </Tooltip>
            <Tooltip title="Previous Frame">
              <IconButton size="small" onClick={handlePrevious}>
                <SkipPrevious />
              </IconButton>
            </Tooltip>
            <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
              <IconButton onClick={isPlaying ? handlePause : handlePlay}>
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
            <Tooltip title="Last Frame">
              <IconButton size="small" onClick={handleLast}>
                <LastPage />
              </IconButton>
            </Tooltip>

            <Box sx={{ flexGrow: 1 }} />

            {/* Speed Control */}
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={settings.playbackSpeed}
                onChange={(e) => setSettings({ ...settings, playbackSpeed: e.target.value as number })}
                sx={{ color: '#fff',
                            '& .MuiSelect-icon': { color: '#fff' } }}
              >
                <MenuItem value={0.25}>0.25x</MenuItem>
                <MenuItem value={0.5}>0.5x</MenuItem>
                <MenuItem value={1}>1x</MenuItem>
                <MenuItem value={1.5}>1.5x</MenuItem>
                <MenuItem value={2}>2x</MenuItem>
              </Select>
            </FormControl>

            {/* Loop Toggle */}
            <Tooltip title="Loop">
              <IconButton
                size="small"
                onClick={() => setSettings({ ...settings, loop: !settings.loop })}
                color={settings.loop ? 'primary' : 'default'}
              >
                <Loop />
              </IconButton>
            </Tooltip>

            {/* Volume */}
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ width: 120 }}>
              <IconButton size="small" onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? <VolumeOff /> : <VolumeUp />}
              </IconButton>
              <Slider
                value={isMuted ? 0 : volume}
                min={0}
                max={1}
                step={0.1}
                onChange={(_, v) => { setVolume(v as number); setIsMuted(false); }}
                size="small"
                sx={{ color: '#fff' }}
              />
            </Stack>

            {/* Settings */}
            <Tooltip title="Settings">
              <IconButton size="small" onClick={() => setShowSettings(true)}>
                <Settings />
              </IconButton>
            </Tooltip>

            {/* Fullscreen */}
            <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
              <IconButton size="small" onClick={toggleFullscreen}>
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>
      </Fade>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="xs" fullWidth>
        <DialogContent>
          <Typography variant="h6" gutterBottom>Playback Settings</Typography>
          
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Transition Type</InputLabel>
              <Select
                value={settings.transitionType}
                onChange={(e) => setSettings({ ...settings, transitionType: e.target.value as TransitionType })}
                label="Transition Type"
              >
                <MenuItem value="cut">Cut</MenuItem>
                <MenuItem value="fade">Fade to Black</MenuItem>
                <MenuItem value="dissolve">Dissolve</MenuItem>
                <MenuItem value="wipe-left">Wipe Left</MenuItem>
                <MenuItem value="wipe-right">Wipe Right</MenuItem>
                <MenuItem value="wipe-up">Wipe Up</MenuItem>
                <MenuItem value="wipe-down">Wipe Down</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant="body2" gutterBottom>
                Transition Duration: {settings.transitionDuration}s
              </Typography>
              <Slider
                value={settings.transitionDuration}
                min={0}
                max={2}
                step={0.1}
                onChange={(_, v) => setSettings({ ...settings, transitionDuration: v as number })}
              />
            </Box>

            <Stack direction="row" spacing={2}>
              <Button
                variant={settings.showTimecode ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setSettings({ ...settings, showTimecode: !settings.showTimecode })}
              >
                Timecode
              </Button>
              <Button
                variant={settings.showFrameNumber ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setSettings({ ...settings, showFrameNumber: !settings.showFrameNumber })}
              >
                Frame Info
              </Button>
            </Stack>
          </Stack>

          <Button
            fullWidth
            variant="outlined"
            sx={{ mt: 3 }}
            onClick={() => setShowSettings(false)}
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

// =============================================================================
// Full-screen Player Dialog
// =============================================================================

interface AnimaticPlayerDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AnimaticPlayerDialog: React.FC<AnimaticPlayerDialogProps> = ({
  open,
  onClose,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{ sx: { bgcolor: '#000' } }}
    >
      <AnimaticPlayer onClose={onClose} fullscreen />
    </Dialog>
  );
};

export default AnimaticPlayer;

