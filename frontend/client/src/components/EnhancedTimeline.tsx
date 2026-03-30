import { useTheming } from '../utils/theming-helper';
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Tooltip,
  IconButton,
  Button,
  Slider,
  Switch,
  FormControlLabel,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  PlayArrow as PlayArrowArrow,
  Pause,
  Stop,
  SkipPrevious,
  SkipNext,
  ZoomIn,
  ZoomOut,
  GridOn as GridOnOn,
  GridOff,
  ContentCut,
  ContentCopy as ContentContentCopy,
  ContentPaste,
  Delete,
  Undo,
  Redo,
  Settings,
  Timeline,
  VolumeUp as VolumeUpUp,
  VolumeOff,
  Speed as Speed,
  Loop,
} from '@mui/icons-material';
import type { BeatClip, Track } from '../services/storyArcDataIntegration';

interface EnhancedTimelineProps {
  clips: BeatClip[];
  tracks: Track[];
  audioTracks?: AudioTrack[];
  zoom: number;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  selectedClips: Set<string>;
  onClipSelect: (clipId: string, multiSelect?: boolean) => void;
  onClipMove: (clipId: string, newStart: number, newTrackId: string) => void;
  onClipResize: (clipId: string, newStart: number, newDuration: number) => void;
  onClipSplit: (clipId: string, splitTime: number) => void;
  onClipDelete: (clipId: string) => void;
  onAudioClipMove?: (clipId: string, newStart: number, newTrackId: string) => void;
  onAudioClipResize?: (clipId: string, newStart: number, newDuration: number) => void;
  onAudioClipSplit?: (clipId: string, splitTime: number) => void;
  onAudioClipDelete?: (clipId: string) => void;
  onTimelineClick: (time: number) => void;
  onCurrentTimeChange: (time: number) => void;
  onZoomChange: (zoom: number) => void;
  snapToGrid?: boolean;
  rippleMode?: boolean;
  onSnapToGridToggle?: (enabled: boolean) => void;
  onRippleModeToggle?: (enabled: boolean) => void
}

interface AudioTrack {
  id: string;
  name: string;
  type: 'music' | 'voice' | 'effects' | 'ambient';
  color: string;
  volume: number;
  muted: boolean
}

interface AudioClip {
  id: string;
  name: string;
  trackId: string;
  start: number;
  duration: number;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
  url: string;
  type: 'music' | 'voice' | 'effects' | 'ambient';
  enhanced?: boolean;
  enhancementType?: 'denoise' | 'speech_enhance' | 'source_separate' | 'normalize'
}

interface DragState {
  clipId: string;
  startX: number;
  startTime: number;
  originalTrackId: string;
  dragType: 'move' | 'resize-left' | 'resize-right'
}

const TRACK_HEADER_WIDTH = 150;
const TIMELINE_HEIGHT = 80;
const RULER_HEIGHT = 40;
const SNAP_THRESHOLD = 8;
const GRID_INTERVAL = 30;
const MIN_CLIP_DURATION = 0.1;
const MAX_ZOOM = 10;
const MIN_ZOOM = 0.1;

export default function EnhancedTimeline({
  clips,
  tracks,
  audioTracks = [],
  zoom,
  currentTime,
  totalDuration,
  isPlaying,
  selectedClips,
  onClipSelect,
  onClipMove,
  onClipResize,
  onClipSplit,
  onClipDelete,
  onAudioClipMove,
  onAudioClipResize,
  onAudioClipSplit,
  onAudioClipDelete,
  onTimelineClick,
  onCurrentTimeChange,
  onZoomChange,
  snapToGrid = true,
  rippleMode = false,
  onSnapToGridToggle,
  onRippleModeToggle,
}: EnhancedTimelineProps) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    clipId: string | null;
} | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Theming system
  const theming = useTheming('photographer');
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);

  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  // Calculate time to pixel conversion
  const timeToPixels = useCallback((time: number) => {
    return (time / totalDuration) * (timelineRef.current?.clientWidth || 1000) * zoom;
}, [totalDuration, zoom]);

  const pixelsToTime = useCallback((pixels: number) => {
    return (pixels / ((timelineRef.current?.clientWidth || 1000) * zoom)) * totalDuration;
}, [totalDuration, zoom]);

  // Snap to grid function
  const snapToGridTime = useCallback((time: number) => {
    if (!snapToGrid) return time;
    const gridTime = Math.round(time / GRID_INTERVAL) * GRID_INTERVAL;
    return Math.max, (Math.min(totalDuration, gridTime));
}, [snapToGrid, totalDuration]);

  // Handle clip dragging
  const handleClipMouseDown = useCallback((
    e: React.MouseEvent,
    clipId: string,
    dragType: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;

    setDragState({
      clipd,
      startX: e.clientX,
      startTime: clip.start,
      originalTrackId: clip.trackd,
      dragType,
  });
}, [clips]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragState.startX;
    const deltaTime = pixelsToTime(deltaX);
    const newTime = snapToGridTime(dragState.startTime + deltaTime);

    if (dragState.dragType === 'move') {
      // Find the track under the mouse
      const trackY = e.clientY - rect.top;
      const trackIndex = Math.floor(trackY / TIMELINE_HEIGHT);
      const newTrackId = tracks[trackIndex]?.id || dragState.originalTrackId;

      onClipMove(dragState.clipd, newTime, newTrackId);
  } else if (dragState.dragType === 'resize-left') {
      const clip = clips.find(c => c.id === dragState.clipId);
      if (clip) {
        const newDuration = clip.duration + (clip.start - newTime);
        if (newDuration >= MIN_CLIP_DURATION) {
          onClipResize(dragState.clipId, newTime, newDuration);
      }
    }
  } else if (dragState.dragType === 'resize-right') {
      const clip = clips.find(c => c.id === dragState.clipId);
      if (clip) {
        const newDuration = newTime - clip.start;
        if (newDuration >= MIN_CLIP_DURATION) {
          onClipResize(dragState.clipId, clip.start, newDuration);
      }
    }
  }
}, [dragState, clips, tracks, pixelsToTime, snapToGridTime, onClipMove, onClipResize]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDragState(null);
}, []);

  // Handle context menu
  const handleContextMenu = useCallback((e: React.MouseEvent, clipId?: string) => {
    e.preventDefault();
    setContextMenu({
      mouseX: e.clientX,
      mouseY: e.clientY,
      clipId: clipId || null,
  });
}, []);

  // Handle clip operations
  const handleSplitClip = useCallback(() => {
    if (contextMenu?.clipId) {
      onClipSplit(contextMenu.clipId, currentTime);
      setContextMenu(null);
  }
}, [contextMenu, currentTime, onClipSplit]);

  const handleDeleteClip = useCallback(() => {
    if (contextMenu?.clipId) {
      onClipDelete(contextMenu.clipId);
      setContextMenu(null);
  }
}, [contextMenu, onClipDelete]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          selectedClips.forEach(clipId => onClipDelete(clipId));
          break;
        case 'c':
          if (e.ctrlKey || e.metaKey) {
            // Copy selected clips
            console.log('Copy clips:', Array.from(selectedClips));
        }
          break;
        case 'v':
          if (e.ctrlKey || e.metaKey) {
            // Paste clips
            console.log('Paste clips at time: ', currentTime);
        }
          break;
        case 'x':
          if (e.ctrlKey || e.metaKey) {
            // Cut selected clips
            console.log('Cut clips: ', Array.from(selectedClips));
        }
          break;
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            // Undo
            console.log('Undo,');
        }
          break;
        case 'y':
          if (e.ctrlKey || e.metaKey) {
            // Redo
            console.log('Redo');
        }
          break;
    }
  };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
}, [selectedClips, currentTime, onClipDelete]);

  // Mouse event listeners
  useEffect(() => {
    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
  }
}, [dragState, handleMouseMove, handleMouseUp]);

  // Render grid lines
  const renderGridLines = () => {
    if (!snapToGrid) return null;
    
    const gridLines = [];
    const timelineWidth = timelineRef.current?.clientWidth || 1000;
    const visibleDuration = totalDuration / zoom;
    const gridStep = GRID_INTERVAL;
    
    for (let time = 0; time <= visibleDuration; time += gridStep) {
      const x = timeToPixels(time);
      gridLines.push(
        <Box
          key={time}
          sx={{
            position: 'absolute',
            left: x,
            top:  0,
            bottom:  0,
            width:  1,
            bgcolor: 'rgba(255,255,255,0.16)',
            pointerEvents: 'none'}}
        />
      );
  }
    
    return gridLines;
};

  // Render clips
  const renderClips = () => {
    return clips.map((clip) => {
      const isSelected = selectedClips.has(clip.id);
      const trackIndex = tracks.findIndex(t => t.id === clip.trackId);
      const y = trackIndex * TIMELINE_HEIGHT;
      const x = timeToPixels(clip.start);
      const width = timeToPixels(clip.duration);

      return (
        <Box
          key={clip.id}
          sx={{
            position: 'absolute',
            left: x,
            top: y + 4,
            width: Math.max(width, 20),
            height: TIMELINE_HEIGHT - 8,
            bgcolor: isSelected ? clip.color : `${clip.color}80`,
            border: isSelected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.3)',
            borderRadius: 1,
            cursor: 'move',
            display: 'flex',
            alignItems: 'center',
            px:  1,
            overflow: 'hidden',
            '&:hover': {
              bgcolor: clip.color,
            },
          }}
          onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'move')}
          onContextMenu={(e) => handleContextMenu(e, clip.id)}
          onClick={(e) => {
            e.stopPropagation();
            onClipSelect(clip.id, e.ctrlKey || e.metaKey);
        }}
        >
          {/* Resize handles */}
          <Box
            sx={{
              position: 'absolute',
              left:  0,
              top:  0,
              bottom:  0,
              width:  4,
              cursor: 'ew-resize',
              bgcolor: 'rgba(255,255,255,0.34)', '&:hover': { bgcolor: '#fff'}}}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleClipMouseDown(e, clip.id, 'resize-left');
          }}
          />
          <Box
            sx={{
              position: 'absolute',
              right:  0,
              top:  0,
              bottom:  0,
              width:  4,
              cursor: 'ew-resize',
              bgcolor: 'rgba(255,255,255,0.34)', '&:hover': { bgcolor: '#fff'}}}
            onMouseDown={(e) => {
              e.stopPropagation();
              handleClipMouseDown(e, clip.id, 'resize-right');
          }}
          />
          
          {/* Clip content */}
          <Typography
            variant="caption"
            sx={{
              color: 'white',
              fontWeight: 600,
              fontSize: '0.7rem',
              textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'}}
          >
            {clip.name}
          </Typography>
        </Box>
      );
  });
};

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column'}}>
      {/* Timeline Controls */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper'}}>
        <Stack direction="row" spacing={1} alignItems="center">
          {/* Playback Controls */}
          <ButtonGroup size="small">
            <IconButton size="small">
              <SkipPrevious fontSize="small" />
            </IconButton>
            <IconButton size="small">
              {isPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
            </IconButton>
            <IconButton size="small">
              <Stop fontSize="small" />
            </IconButton>
            <IconButton size="small">
              <SkipNext fontSize="small" />
            </IconButton>
          </ButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Zoom Controls */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 200}}>
            <IconButton size="small" onClick={() => onZoomChange(Math.max(MIN_ZOOM, zoom - 0.1))}>
              <ZoomOut fontSize="small" />
            </IconButton>
            <Slider
              value={zoom}
              onChange={(_, value) => onZoomChange(value as number)}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.1}
              size="small"
              sx={{ mx: 1, width: 100}}
            />
            <IconButton size="small" onClick={() => onZoomChange(Math.min(MAX_ZOOM, zoom + 0.1))}>
              <ZoomIn fontSize="small" />
            </IconButton>
            <Typography variant="caption" sx={{ minWidth:  40, textAlign: 'center'}}>
              {Math.round(zoom * 100)}%
            </Typography>
          </Stack>

          <Divider orientation="vertical" flexItem />

          {/* Timeline Options */}
          <FormControlLabel
            control={
              <Switch
                checked={snapToGrid}
                onChange={(e) => onSnapToGridToggle?.(e.target.checked)}
                size="small"
              />
          }
            label="Snap to Grid"
            sx={{ fontSize: '0.75rem'}}
          />
          <FormControlLabel
            control={
              <Switch
                checked={rippleMode}
                onChange={(e) => onRippleModeToggle?.(e.target.checked)}
                size="small"
              />
          }
            label="Ripple Edit"
            sx={{ fontSize: '0.75rem'}}
          />

          <Box sx={{ flexGrow:  1 }} />

          {/* Additional Controls */}
          <IconButton size="small" onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
          </IconButton>
          <IconButton size="small" onClick={() => setIsLooping(!isLooping)}>
            <Loop fontSize="small" color={isLooping ? 'primary' : 'inherit'} />
          </IconButton>
          <IconButton size="small" onClick={() => setShowSettings(true)}>
            <Settings fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      {/* Timeline Area */}
      <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden'}}>
        {/* Ruler */}
        <Box
          sx={{
            height: RULER_HEIGT,
            bgcolor: 'background.paper',
            borderBottom:  1,
            borderColor: 'divider',
            position: 'relative',
            overflow: 'hidden'}}
        >
          {/* Time markers */}
          {Array.from({ length: Math.ceil(totalDuration / GRID_INTERVAL) + 1 }, (_, i) => {
            const time = i * GRID_INTERVAL;
            const x = timeToPixels(time);
            return (
              <Box
                key={time}
                sx={{
                  position: 'absolute',
                  left: x,
                  top:  0,
                  bottom:  0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  px: 0.5}}
              >
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary'}}>
                  {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
                </Typography>
              </Box>
            );
        })}
          
          {/* Playhead */}
          <Box
            ref={playheadRef}
            sx={{
              position: 'absolute',
              left: timeToPixels(currentTime),
              top:  0,
              bottom:  0,
              width:  2,
              bgcolor: '#e74c30',
              zIndex: 10,
              pointerEvents: 'none'}}
          />
        </Box>

        {/* Tracks */}
        <Box
          ref={timelineRef}
          sx={{
            position: 'relative',
            height: tracks.length * TIMELINE_HEIGT,
            bgcolor: 'background.default',
            overflow: 'auto',
            cursor: 'crosshair'}}
          onClick={(e) => {
            const rect = timelineRef.current?.getBoundingClientRect();
            if (rect) {
              const x = e.clientX - rect.left;
              const time = pixelsToTime(x);
              onTimelineClick(time);
          }
        }}
        >
          {/* Grid lines */}
          {renderGridLines()}
          
          {/* Tracks */}
          {tracks.map((track, index) => (
            <Box
              key={track.id}
              sx={{
                position: 'absolute',
                left:  0,
                top: index * TIMELINE_HEIGHT,
                right:  0,
                height: TIMELINE_HEIGHT,
                borderBottom:  1,
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                px:  2,
                bgcolor: index % 2 === 0 ? 'background.paper' : 'background.default'}}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, minWidth: TRACK_HEADER_WIDTH - 16 }}>
                {track.name}
              </Typography>
            </Box>
          ))}
          
          {/* Clips */}
          {renderClips()}
        </Box>
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
      }
      >
        <MenuItem onClick={handleSplitClip}>
          <ContentCut fontSize="small" sx={{ mr:  1 }} />
          Split at Playhead
        </MenuItem>
        <MenuItem onClick={() => console.log('Copy')}>
          <ContentCopy fontSize="small" sx={{ mr:  1 }} />
          Copy
        </MenuItem>
        <MenuItem onClick={() => console.log('Paste')}>
          <ContentPaste fontSize="small" sx={{ mr:  1 }} />
          Paste
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteClip} sx={{ color: 'error.main'}}>
          <Delete fontSize="small" sx={{ mr:  1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onClose={() => setShowSettings(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Timeline Settings</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt:  1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={snapToGrid}
                  onChange={(e) => onSnapToGridToggle?.(e.target.checked)}
                />
            }
              label="Snap to Grid"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={rippleMode}
                  onChange={(e) => onRippleModeToggle?.(e.target.checked)}
                />
            }
              label="Ripple Edit Mode"
            />
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Playback Speed: {playbackSpeed}x
              </Typography>
              <Slider
                value={playbackSpeed}
                onChange={(_, value) => setPlaybackSpeed(value as number)}
                min={0.25}
                max={4}
                step={0.25}
                marks={[
                  { value: 0.25, label: '0.25x' },
                  { value: 0.5, label: '0.5x' },
                  { value: 1, label: '1x' },
                  { value: 2, label: '2x' },
                  { value: 4, label: '4x' },
                ]}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
