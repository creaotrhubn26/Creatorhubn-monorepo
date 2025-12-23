/**
 * KeyframeTimeline - Professional keyframe editor and timeline
 * 
 * Features:
 * - Multi-track timeline
 * - Keyframe editing (add, move, delete)
 * - Curve editor
 * - Playback controls
 * - Zoom and scroll
 * - Track management
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Menu,
  Divider,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  SkipPrevious,
  SkipNext,
  Repeat,
  RepeatOne,
  Speed,
  ZoomIn,
  ZoomOut,
  FitScreen,
  Add,
  Delete,
  Edit,
  ContentCopy,
  ContentCut,
  ContentPaste,
  KeyboardArrowLeft,
  KeyboardArrowRight,
  ExpandMore,
  ExpandLess,
  Lightbulb,
  CameraAlt,
  Animation,
  Timeline as TimelineIcon,
  Circle,
  RadioButtonChecked,
  FiberManualRecord,
  MoreVert,
  Lock,
  LockOpen,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  sceneGraphAnimationEngine,
  AnimationClip,
  AnimationTrack,
  Keyframe,
  SceneGraphNode,
  EasingName,
  EASING_FUNCTIONS,
} from '../../core/animation/SceneGraphAnimationEngine';

// ============================================================================
// Types
// ============================================================================

interface TimelineState {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isPaused: boolean;
  zoom: number;        // pixels per second
  scrollX: number;
  selectedTrackId: string | null;
  selectedKeyframes: Array<{ trackId: string; time: number }>;
  clipboard: Keyframe[] | null;
}

// ============================================================================
// Constants
// ============================================================================

const TRACK_HEIGHT = 32;
const TIMELINE_HEADER_HEIGHT = 40;
const TRACK_HEADER_WIDTH = 200;
const MIN_ZOOM = 20;  // pixels per second
const MAX_ZOOM = 200;
const DEFAULT_ZOOM = 60;

const TRACK_TYPE_ICONS: Record<string, React.ReactNode> = {
  position: <Animation fontSize="small" />,
  rotation: <Animation fontSize="small" />,
  scale: <Animation fontSize="small" />,
  lightPower: <Lightbulb fontSize="small" />,
  lightColor: <Lightbulb fontSize="small" />,
  colorTemperature: <Lightbulb fontSize="small" />,
  focalLength: <CameraAlt fontSize="small" />,
  aperture: <CameraAlt fontSize="small" />,
  focusDistance: <CameraAlt fontSize="small" />,
  default: <Circle fontSize="small" />,
};

const EASING_OPTIONS: EasingName[] = [
  'linear', 'easeIn','easeOut','easeInOut','easeInQuad','easeOutQuad','easeInOutQuad','easeInCubic','easeOutCubic','easeInOutCubic','easeInElastic','easeOutElastic','easeOutBounce',
];

// ============================================================================
// Keyframe Diamond Component
// ============================================================================

interface KeyframeDiamondProps {
  time: number;
  zoom: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (newTime: number) => void;
  onDoubleClick: () => void;
}

function KeyframeDiamond({
  time,
  zoom,
  selected,
  onSelect,
  onMove,
  onDoubleClick,
}: KeyframeDiamondProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startTime = useRef(time);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    startX.current = e.clientX;
    startTime.current = time;
    onSelect();
  }, [time, onSelect]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX.current;
      const deltaTime = deltaX / zoom;
      const newTime = Math.max(0, startTime.current + deltaTime);
      onMove(newTime);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove,', handleMouseMove);
    window.addEventListener('mouseup,', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove, ', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, zoom, onMove]);

  return (
    <Box
      onMouseDown={handleMouseDown}
      onDoubleClick={onDoubleClick}
      sx={{
        position: 'absolute',
        left: time * zoom - 6,
        top: '50%',
        transform: 'translateY(-50%) rotate(45deg)',
        width: 10,
        height: 10,
        backgroundColor: selected ? '#f44336' : '#2196f3',
        border: `2px solid ${selected ? '#fff' : '#1565c0'}`,
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: , selected ? 10 : 1,
        transition: isDragging ? 'none' : 'all 0.1s','&:hover': {
          transform: 'translateY(-50%) rotate(45deg) scale(1.2)',
          boxShadow: '0 0 8px rgba(33, 150, 243, 0.5)',
        }}}
    />
  );
}

// ============================================================================
// Track Header Component
// ============================================================================

interface TrackHeaderProps {
  track: AnimationTrack;
  node: SceneGraphNode | undefined;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
}

function TrackHeader({
  track,
  node,
  selected,
  expanded,
  onSelect,
  onToggleExpand,
  onToggleEnabled,
  onDelete,
}: TrackHeaderProps) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const icon = TRACK_TYPE_ICONS[track.type] || TRACK_TYPE_ICONS.default;

  return (
    <Box
      onClick={onSelect}
      sx={{
        width: TRACK_HEADER_WIDTH,
        height: TRACK_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        px: 1,
        backgroundColor: selected ? '#2a3a4a' : '#1a1a2a',
        borderBottom: '1px solid #333',
        borderRight: '1px solid #333',
        cursor: 'pointer', '&:hover': {
          backgroundColor: '#252535',
        }}}
    >
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}>
        {expanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
      </IconButton>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); onToggleEnabled(); }}
        sx={{ color: track.enabled ? '#4caf50' : '#666' }}
      >
        {track.enabled ? <Visibility fontSize="small" /> : <VisibilityOff fontSize="small" />}
      </IconButton>
      <Box sx={{ ml: 0.5, color: track.enabled ? '#2196f3' : '#666' }}>
        {icon}
      </Box>
      <Box sx={{ flex: 1, ml: 1, overflow: 'hidden' }}>
        <Typography variant="caption" noWrap fontWeight={selected ? 600 : 400}>
          {node?.name || track.nodeId}
        </Typography>
        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: 9 }}>
          {track.type}
        </Typography>
      </Box>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}>
        <MoreVert fontSize="small" />
      </IconButton>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { onDelete(); setMenuAnchor(null); }}>
          <ListItemIcon><Delete fontSize="small" /></ListItemIcon>
          Delete Track
        </MenuItem>
      </Menu>
    </Box>
  );
}

// ============================================================================
// Track Lane Component
// ============================================================================

interface TrackLaneProps {
  track: AnimationTrack;
  state: TimelineState;
  onKeyframeSelect: (trackId: string, time: number) => void;
  onKeyframeMove: (trackId: string, oldTime: number, newTime: number) => void;
  onKeyframeEdit: (trackId: string, time: number) => void;
  onAddKeyframe: (trackId: string, time: number) => void;
}

function TrackLane({
  track,
  state,
  onKeyframeSelect,
  onKeyframeMove,
  onKeyframeEdit,
  onAddKeyframe,
}: TrackLaneProps) {
  const laneRef = useRef<HTMLDivElement>(null);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!laneRef.current) return;
    const rect = laneRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + state.scrollX;
    const time = x / state.zoom;
    onAddKeyframe(track.id, time);
  }, [track.id, state.zoom, state.scrollX, onAddKeyframe]);

  return (
    <Box
      ref={laneRef}
      onDoubleClick={handleDoubleClick}
      sx={{
        height: TRACK_HEIGHT,
        backgroundColor: track.enabled ? '#1a1a1a' : '#151515',
        borderBottom: '1px solid #333',
        position: 'relative',
        overflow: 'hidden'}}
    >
      {/* Keyframes */}
      {track.keyframes.map((kf, index) => {
        const isSelected = state.selectedKeyframes.some(
          (s) => s.trackId === track.id && s.time === kf.time
        );

        return (
          <KeyframeDiamond
            key={`${kf.time}-${index}`}
            time={kf.time}
            zoom={state.zoom}
            selected={isSelected}
            onSelect={() => onKeyframeSelect(track.id, kf.time)}
            onMove={(newTime) => onKeyframeMove(track.id, kf.time, newTime)}
            onDoubleClick={() => onKeyframeEdit(track.id, kf.time)}
          />
        );
      })}

      {/* Connection lines between keyframes */}
      {track.keyframes.length > 1 && (
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'}}
        >
          {track.keyframes.slice(0, -1).map((kf, index) => {
            const nextKf = track.keyframes[index + 1];
            const x1 = kf.time * state.zoom;
            const x2 = nextKf.time * state.zoom;
            const y = TRACK_HEIGHT / 2;

            return (
              <line
                key={index}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={track.enabled ? '#2196f344' : '#33333344'}
                strokeWidth={2}
              />
            );
          })}
        </svg>
      )}
    </Box>
  );
}

// ============================================================================
// Timeline Ruler Component
// ============================================================================

interface TimelineRulerProps {
  duration: number;
  currentTime: number;
  zoom: number;
  scrollX: number;
  onSeek: (time: number) => void;
}

function TimelineRuler({ duration, currentTime, zoom, scrollX, onSeek }: TimelineRulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const time = Math.max(0, Math.min(duration, x / zoom));
    onSeek(time);
  }, [zoom, scrollX, duration, onSeek]);

  // Generate time markers
  const markers = useMemo(() => {
    const result = [];
    const step = zoom > 100 ? 0.5 : zoom > 50 ? 1 : 2;
    
    for (let t = 0; t <= duration + step; t += step) {
      const x = t * zoom;
      const isMajor = t % (step * 2) === 0;
      
      result.push(
        <Box
          key={t}
          sx={{
            position: 'absolute',
            left: x,
            top: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'}}
        >
          <Box
            sx={{
              width: 1,
              height: isMajor ? 12 : 6,
              backgroundColor: '#555'}}
          />
          {isMajor && (
            <Typography
              variant="caption"
              sx={{
                fontSize: 9,
                color: '#888',
                position: 'absolute',
                top: 14,
                transform: 'translateX(-50%)'}}
            >
              {t.toFixed(1)}s
            </Typography>
          )}
        </Box>
      );
    }

    return result;
  }, [duration, zoom]);

  return (
    <Box
      ref={rulerRef}
      onClick={handleClick}
      sx={{
        height: TIMELINE_HEADER_HEIGHT,
        backgroundColor: '#0a0a0a',
        borderBottom: '1px solid #333',
        position: 'relative',
        cursor: 'pointer',
        overflow: 'hidden'}}
    >
      <Box
        sx={{
          position: 'absolute',
          left: -scrollX,
          top: 0,
          height: '100%',
          width: (duration + 5) * zoom}}
      >
        {markers}
      </Box>

      {/* Playhead */}
      <Box
        sx={{
          position: 'absolute',
          left: currentTime * zoom - scrollX,
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: '#f44336',
          zIndex: 10,
          pointerEvents: 'none'}}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '10px solid #f44336'}}
        />
      </Box>
    </Box>
  );
}

// ============================================================================
// Main KeyframeTimeline Component
// ============================================================================

interface KeyframeTimelineProps {
  clipId?: string;
  height?: number;
}

export function KeyframeTimeline({ clipId, height = 300 }: KeyframeTimelineProps) {
  const [state, setState] = useState<TimelineState>({
    currentTime: 0,
    duration: 10,
    isPlaying: false,
    isPaused: false,
    zoom: DEFAULT_ZOOM,
    scrollX: 0,
    selectedTrackId: null,
    selectedKeyframes: [],
    clipboard: null,
  });

  const [clip, setClip] = useState<AnimationClip | null>(null);
  const [nodes, setNodes] = useState<Map<string, SceneGraphNode>>(new Map());
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [keyframeEditDialog, setKeyframeEditDialog] = useState<{
    trackId: string;
    time: number;
    keyframe: Keyframe;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);

  // Load clip and nodes
  useEffect(() => {
    if (clipId) {
      const loadedClip = sceneGraphAnimationEngine.getClip(clipId);
      if (loadedClip) {
        setClip(loadedClip);
        setState((s) => ({ ...s, duration: loadedClip.duration }));
      }
    }

    setNodes(new Map(sceneGraphAnimationEngine.getAllNodes().map((n) => [n.id, n])));
  }, [clipId]);

  // Animation frame update
  useEffect(() => {
    if (!state.isPlaying || state.isPaused) return;

    let frameId: number;
    let lastTime = performance.now();

    const update = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      setState((s) => {
        let newTime = s.currentTime + delta;
        
        if (newTime >= s.duration) {
          // Check loop
          newTime = 0; // or stop
        }

        return { ...s, currentTime: newTime };
      });

      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(frameId);
  }, [state.isPlaying, state.isPaused]);

  // Playback controls
  const handlePlay = useCallback(() => {
    setState((s) => ({ ...s, isPlaying: true, isPaused: false }));
    if (clipId) sceneGraphAnimationEngine.play(clipId);
  }, [clipId]);

  const handlePause = useCallback(() => {
    setState((s) => ({ ...s, isPaused: true }));
    if (clipId) sceneGraphAnimationEngine.pause(clipId);
  }, [clipId]);

  const handleStop = useCallback(() => {
    setState((s) => ({ ...s, isPlaying: false, isPaused: false, currentTime: 0 }));
    if (clipId) sceneGraphAnimationEngine.stop(clipId);
  }, [clipId]);

  const handleSeek = useCallback((time: number) => {
    setState((s) => ({ ...s, currentTime: time }));
    if (clipId) sceneGraphAnimationEngine.setTime(time, clipId);
  }, [clipId]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setState((s) => ({ ...s, zoom: Math.min(MAX_ZOOM, s.zoom * 1.2) }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setState((s) => ({ ...s, zoom: Math.max(MIN_ZOOM, s.zoom / 1.2) }));
  }, []);

  const handleFitToView = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - TRACK_HEADER_WIDTH;
    const zoom = containerWidth / state.duration;
    setState((s) => ({ ...s, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)), scrollX: 0 }));
  }, [state.duration]);

  // Scroll handling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setState((s) => ({ ...s, scrollX: e.currentTarget.scrollLeft }));
  }, []);

  // Track management
  const handleToggleTrackExpand = useCallback((trackId: string) => {
    setExpandedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }, []);

  const handleToggleTrackEnabled = useCallback((trackId: string) => {
    if (!clip) return;
    const track = clip.tracks.find((t) => t.id === trackId);
    if (track) {
      track.enabled = !track.enabled;
      setClip({ ...clip });
    }
  }, [clip]);

  const handleDeleteTrack = useCallback((trackId: string) => {
    if (!clip || !clipId) return;
    sceneGraphAnimationEngine.removeTrack(clipId, trackId);
    setClip({
      ...clip,
      tracks: clip.tracks.filter((t) => t.id !== trackId),
    });
  }, [clip, clipId]);

  // Keyframe management
  const handleKeyframeSelect = useCallback((trackId: string, time: number) => {
    setState((s) => ({
      ...s,
      selectedTrackId: trackId,
      selectedKeyframes: [{ trackId, time }],
    }));
  }, []);

  const handleKeyframeMove = useCallback((trackId: string, oldTime: number, newTime: number) => {
    if (!clip || !clipId) return;
    sceneGraphAnimationEngine.moveKeyframe(clipId, trackId, oldTime, newTime);
    
    // Update local state
    const track = clip.tracks.find((t) => t.id === trackId);
    if (track) {
      const kf = track.keyframes.find((k) => k.time === oldTime);
      if (kf) {
        kf.time = newTime;
        track.keyframes.sort((a, b) => a.time - b.time);
        setClip({ ...clip });
      }
    }

    // Update selection
    setState((s) => ({
      ...s,
      selectedKeyframes: s.selectedKeyframes.map((sk) =>
        sk.trackId === trackId && sk.time === oldTime
          ? { trackId, time: newTime }
          : sk
      ),
    }));
  }, [clip, clipId]);

  const handleKeyframeEdit = useCallback((trackId: string, time: number) => {
    if (!clip) return;
    const track = clip.tracks.find((t) => t.id === trackId);
    const keyframe = track?.keyframes.find((kf) => kf.time === time);
    if (keyframe) {
      setKeyframeEditDialog({ trackId, time, keyframe: { ...keyframe } });
    }
  }, [clip]);

  const handleAddKeyframe = useCallback((trackId: string, time: number) => {
    if (!clip || !clipId) return;

    const track = clip.tracks.find((t) => t.id === trackId);
    if (!track) return;

    // Get interpolated value at this time (or default)
    const defaultValue = track.keyframes.length > 0
      ? track.keyframes[track.keyframes.length - 1].value
      : 0;

    const newKeyframe: Keyframe = {
      time,
      value: defaultValue,
      easing: 'easeInOut',
    };

    sceneGraphAnimationEngine.addKeyframe(clipId, trackId, newKeyframe);

    // Update local state
    track.keyframes.push(newKeyframe);
    track.keyframes.sort((a, b) => a.time - b.time);
    setClip({ ...clip });
  }, [clip, clipId]);

  const handleSaveKeyframe = useCallback(() => {
    if (!keyframeEditDialog || !clip || !clipId) return;

    const { trackId, time, keyframe } = keyframeEditDialog;
    const track = clip.tracks.find((t) => t.id === trackId);
    if (!track) return;

    const kfIndex = track.keyframes.findIndex((kf) => kf.time === time);
    if (kfIndex !== -1) {
      track.keyframes[kfIndex] = keyframe;
      setClip({ ...clip });
    }

    setKeyframeEditDialog(null);
  }, [keyframeEditDialog, clip, clipId]);

  const handleDeleteSelectedKeyframes = useCallback(() => {
    if (!clip || !clipId || state.selectedKeyframes.length === 0) return;

    for (const { trackId, time } of state.selectedKeyframes) {
      sceneGraphAnimationEngine.removeKeyframe(clipId, trackId, time);

      const track = clip.tracks.find((t) => t.id === trackId);
      if (track) {
        track.keyframes = track.keyframes.filter((kf) => kf.time !== time);
      }
    }

    setClip({ ...clip });
    setState((s) => ({ ...s, selectedKeyframes: [] }));
  }, [clip, clipId, state.selectedKeyframes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ', ') {
        e.preventDefault();
        if (state.isPlaying && !state.isPaused) {
          handlePause();
        } else {
          handlePlay();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelectedKeyframes();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.isPlaying, state.isPaused, handlePlay, handlePause, handleDeleteSelectedKeyframes]);

  if (!clip) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#121212'}}
      >
        <Typography color="text.secondary">No animation clip selected</Typography>
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{ height, display: 'flex', flexDirection: 'column', backgroundColor: '#121212' }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1,
          py: 0.5,
          borderBottom: '1px solid #333',
          backgroundColor: '#1a1a1a'}}
      >
        {/* Playback controls */}
        <IconButton size="small" onClick={() => handleSeek(0)}>
          <SkipPrevious />
        </IconButton>
        {state.isPlaying && !state.isPaused ? (
          <IconButton size="small" onClick={handlePause} color="primary">
            <Pause />
          </IconButton>
        ) : (
          <IconButton size="small" onClick={handlePlay} color="primary">
            <PlayArrow />
          </IconButton>
        )}
        <IconButton size="small" onClick={handleStop}>
          <Stop />
        </IconButton>
        <IconButton size="small" onClick={() => handleSeek(state.duration)}>
          <SkipNext />
        </IconButton>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Time display */}
        <Typography variant="caption" fontFamily="monospace" sx={{ minWidth: 80 }}>
          {state.currentTime.toFixed(2)}s / {state.duration.toFixed(2)}s
        </Typography>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        {/* Zoom controls */}
        <IconButton size="small" onClick={handleZoomOut}>
          <ZoomOut />
        </IconButton>
        <Slider
          value={state.zoom}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          onChange={(_, v) => setState((s) => ({ ...s, zoom: v as number }))}
          sx={{ width: 80 }}
          size="small"
        />
        <IconButton size="small" onClick={handleZoomIn}>
          <ZoomIn />
        </IconButton>
        <IconButton size="small" onClick={handleFitToView}>
          <FitScreen />
        </IconButton>

        <Box sx={{ flex: 1 }} />

        {/* Selection info */}
        {state.selectedKeyframes.length > 0 && (
          <Chip
            label={`${state.selectedKeyframes.length} keyframe(s)`}
            size="small"
            onDelete={() => setState((s) => ({ ...s, selectedKeyframes: [] }))}
          />
        )}

        <IconButton
          size="small"
          onClick={handleDeleteSelectedKeyframes}
          disabled={state.selectedKeyframes.length === 0}
          color="error"
        >
          <Delete />
        </IconButton>
      </Box>

      {/* Main timeline area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Track headers */}
        <Box
          sx={{
            width: TRACK_HEADER_WIDTH,
            flexShrink: 0,
            overflowY: 'auto',
            borderRight: '1px solid #333'}}
        >
          {/* Header spacer */}
          <Box sx={{ height: TIMELINE_HEADER_HEIGHT, borderBottom: '1px solid #333', backgroundColor: '#0a0a0a' }} />
          
          {/* Track headers */}
          {clip.tracks.map((track) => (
            <TrackHeader
              key={track.id}
              track={track}
              node={nodes.get(track.nodeId)}
              selected={state.selectedTrackId === track.id}
              expanded={expandedTracks.has(track.id)}
              onSelect={() => setState((s) => ({ ...s, selectedTrackId: track.id }))}
              onToggleExpand={() => handleToggleTrackExpand(track.id)}
              onToggleEnabled={() => handleToggleTrackEnabled(track.id)}
              onDelete={() => handleDeleteTrack(track.id)}
            />
          ))}
        </Box>

        {/* Timeline content */}
        <Box
          ref={tracksRef}
          onScroll={handleScroll}
          sx={{
            flex: 1,
            overflow: 'auto'}}
        >
          {/* Timeline ruler */}
          <TimelineRuler
            duration={state.duration}
            currentTime={state.currentTime}
            zoom={state.zoom}
            scrollX={state.scrollX}
            onSeek={handleSeek}
          />

          {/* Track lanes */}
          <Box sx={{ position: 'relative', width: (state.duration + 5) * state.zoom }}>
            {clip.tracks.map((track) => (
              <TrackLane
                key={track.id}
                track={track}
                state={state}
                onKeyframeSelect={handleKeyframeSelect}
                onKeyframeMove={handleKeyframeMove}
                onKeyframeEdit={handleKeyframeEdit}
                onAddKeyframe={handleAddKeyframe}
              />
            ))}

            {/* Global playhead line */}
            <Box
              sx={{
                position: 'absolute',
                left: state.currentTime * state.zoom,
                top: 0,
                bottom: 0,
                width: 1,
                backgroundColor: '#f44336',
                zIndex: 5,
                pointerEvents: 'none'}}
            />
          </Box>
        </Box>
      </Box>

      {/* Keyframe Edit Dialog */}
      <Dialog open={!!keyframeEditDialog} onClose={() => setKeyframeEditDialog(null)}>
        <DialogTitle>Edit Keyframe</DialogTitle>
        <DialogContent>
          {keyframeEditDialog && (
            <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Time (seconds)"
                type="number"
                value={keyframeEditDialog.keyframe.time}
                onChange={(e) =>
                  setKeyframeEditDialog({
                    ...keyframeEditDialog,
                    keyframe: {
                      ...keyframeEditDialog.keyframe,
                      time: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                inputProps={{ step: 0.1 }}
              />
              <TextField
                label="Value"
                type="number"
                value={keyframeEditDialog.keyframe.value}
                onChange={(e) =>
                  setKeyframeEditDialog({
                    ...keyframeEditDialog,
                    keyframe: {
                      ...keyframeEditDialog.keyframe,
                      value: parseFloat(e.target.value) || 0,
                    },
                  })
                }
              />
              <FormControl fullWidth>
                <InputLabel>Easing</InputLabel>
                <Select
                  value={keyframeEditDialog.keyframe.easing}
                  label="Easing"
                  onChange={(e) =>
                    setKeyframeEditDialog({
                      ...keyframeEditDialog,
                      keyframe: {
                        ...keyframeEditDialog.keyframe,
                        easing: e.target.value as EasingName,
                      },
                    })
                  }
                >
                  {EASING_OPTIONS.map((easing) => (
                    <MenuItem key={easing} value={easing}>
                      {easing}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKeyframeEditDialog(null)}>Cancel</Button>
          <Button onClick={handleSaveKeyframe} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default KeyframeTimeline;

