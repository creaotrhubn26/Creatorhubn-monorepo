/**
 * SceneAnimationPanel - Visual animation control and timeline
 * 
 * Features:
 * - Animation timeline with keyframes
 * - Playback controls
 * - Preset animations
 * - Per-object animation management
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Slider,
  Tooltip,
  Chip,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  Alert,
  Menu,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  Add,
  Delete,
  ExpandMore,
  Animation,
  Timeline,
  FiberManualRecord,
  RadioButtonChecked,
  KeyboardArrowRight,
  Settings,
  Save,
  Refresh,
  Lightbulb,
  CameraAlt,
  Weekend,
  Build,
  AllInclusive,
} from '@mui/icons-material';
import { useSceneAnimation } from '../../hooks/useSceneAnimation';
import { ANIMATION_PRESETS, AnimationClipConfig, AnimationState, EasingType } from '../../core/services/sceneAnimationService';
import { useSelection } from '../../core/services/selectionService';

// ============================================================================
// Preset Info
// ============================================================================

const PRESET_INFO: Record<keyof typeof ANIMATION_PRESETS, { label: string; icon: React.ReactNode; description: string }> = {
  fadeIn: { label: 'Fade In', icon: <FiberManualRecord />, description: 'Gradually appear' },
  fadeOut: { label: 'Fade Out', icon: <FiberManualRecord />, description: 'Gradually disappear' },
  slideInLeft: { label: 'Slide In Left', icon: <KeyboardArrowRight sx={{ transform: 'rotate(180deg)' }} />, description: 'Enter from left' },
  slideInRight: { label: 'Slide In Right', icon: <KeyboardArrowRight />, description: 'Enter from right' },
  scaleIn: { label: 'Scale In', icon: <RadioButtonChecked />, description: 'Grow from zero' },
  bounce: { label: 'Bounce', icon: <Animation />, description: 'Bouncy movement' },
  rotate360: { label: 'Rotate 360°', icon: <Refresh />, description: 'Full rotation' },
  pulse: { label: 'Pulse', icon: <RadioButtonChecked />, description: 'Scale up and down' },
  lightFlicker: { label: 'Light Flicker', icon: <Lightbulb />, description: 'Flickering effect' },
  cameraOrbit: { label: 'Camera Orbit', icon: <CameraAlt />, description: 'Orbit around target' },
  cameraZoomIn: { label: 'Camera Zoom', icon: <CameraAlt />, description: 'Zoom in effect' },
};

// ============================================================================
// Timeline Component
// ============================================================================

interface TimelineRulerProps {
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
}

function TimelineRuler({ duration, currentTime, onSeek }: TimelineRulerProps) {
  const rulerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = (x / rect.width) * duration;
    onSeek(Math.max(0, Math.min(duration, time)));
  }, [duration, onSeek]);

  const markers = [];
  const step = duration > 10 ? 2 : duration > 5 ? 1 : 0.5;
  for (let t = 0; t <= duration; t += step) {
    markers.push(
      <Box
        key={t}
        sx={{
          position: 'absolute',
          left: `${(t / duration) * 100}%`,
          top: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'}}
      >
        <Box sx={{ width: 1, height: 8, backgroundColor: '#555' }} />
        <Typography variant="caption" sx={{ fontSize: 9, color: '#888', mt: 0.25 }}>
          {t.toFixed(1)}s
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={rulerRef}
      onClick={handleClick}
      sx={{
        position: 'relative',
        height: 30,
        backgroundColor: '#1a1a1a',
        borderBottom: '1px solid #333',
        cursor: 'pointer'}}
    >
      {markers}
      {/* Playhead */}
      <Box
        sx={{
          position: 'absolute',
          left: `${(currentTime / duration) * 100}%`,
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: '#f44336',
          transform: 'translateX(-50%)',
          zIndex: 1}}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '8px solid #f44336'}}
        />
      </Box>
    </Box>
  );
}

// ============================================================================
// Animation Track Component
// ============================================================================

interface AnimationTrackRowProps {
  objectId: string;
  objectName: string;
  state: AnimationState | null;
  isSelected: boolean;
  onSelect: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onRemove: () => void;
}

function AnimationTrackRow({
  objectId,
  objectName,
  state,
  isSelected,
  onSelect,
  onPlay,
  onPause,
  onStop,
  onRemove,
}: AnimationTrackRowProps) {
  return (
    <ListItem
      disablePadding
      secondaryAction={
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {state?.isPlaying && !state?.isPaused ? (
            <IconButton size="small" onClick={onPause}>
              <Pause fontSize="small" />
            </IconButton>
          ) : (
            <IconButton size="small" onClick={onPlay}>
              <PlayArrow fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" onClick={onStop}>
            <Stop fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onRemove} color="error">
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      }
    >
      <ListItemButton selected={isSelected} onClick={onSelect}>
        <ListItemIcon sx={{ minWidth: 32 }}>
          <Animation fontSize="small" color={state?.isPlaying ? 'primary' : 'inherit'} />
        </ListItemIcon>
        <ListItemText
          primary={objectName}
          secondary={
            state ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption">
                  {state.currentTime.toFixed(2)}s / {state.duration.toFixed(2)}s
                </Typography>
                {state.loop && <Chip label="Loop" size="small" sx={{ height: 16, fontSize: 9 }} />}
              </Box>
            ) : null
          }
        />
      </ListItemButton>
    </ListItem>
  );
}

// ============================================================================
// Main Panel Component
// ============================================================================

interface SceneAnimationPanelProps {
  sceneNodes?: Array<{ id: string; name: string; type: string }>;
}

export function SceneAnimationPanel({ sceneNodes = [] }: SceneAnimationPanelProps) {
  const animation = useSceneAnimation();
  const selection = useSelection('animation-panel');
  
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [customAnimDialogOpen, setCustomAnimDialogOpen] = useState(false);
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<null | HTMLElement>(null);
  const [globalLoop, setGlobalLoop] = useState(false);

  // Get current state
  const selectedState = selectedObjectId ? animation.states.get(selectedObjectId) ?? null : null;
  const maxDuration = Math.max(1, ...Array.from(animation.states.values()).map((s) => s.duration));

  // Get current time from selected or first playing
  const currentTime = selectedState?.currentTime ?? 0;

  const handleSeek = useCallback((time: number) => {
    if (selectedObjectId) {
      animation.setTime(selectedObjectId, time);
    } else {
      animation.setGlobalTime(time);
    }
  }, [animation, selectedObjectId]);

  const handleApplyPreset = useCallback((preset: keyof typeof ANIMATION_PRESETS) => {
    const targetId = selectedObjectId || selection.selectedIds[0];
    if (!targetId) return;

    const action = animation.applyPreset(targetId, preset);
    if (action) {
      action.play();
    }
    setPresetDialogOpen(false);
  }, [animation, selectedObjectId, selection.selectedIds]);

  const handleSpeedChange = useCallback((speed: number) => {
    animation.setGlobalSpeed(speed);
    setSpeedMenuAnchor(null);
  }, [animation]);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Animation />
            <Typography variant="h6" fontWeight={700}>
              Scene Animation
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Add Preset Animation">
              <IconButton size="small" onClick={() => setPresetDialogOpen(true)}>
                <Add />
              </IconButton>
            </Tooltip>
            <Tooltip title="Playback Speed">
              <IconButton size="small" onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}>
                <Speed />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Global Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
          <IconButton onClick={() => animation.setGlobalTime(0)}>
            <SkipPrevious />
          </IconButton>
          {animation.isAnyPlaying ? (
            <IconButton onClick={() => animation.pauseAll()} color="primary">
              <Pause fontSize="large" />
            </IconButton>
          ) : (
            <IconButton onClick={() => animation.playAll()} color="primary">
              <PlayArrow fontSize="large" />
            </IconButton>
          )}
          <IconButton onClick={() => animation.stopAll()}>
            <Stop />
          </IconButton>
          <IconButton onClick={() => animation.setGlobalTime(maxDuration)}>
            <SkipNext />
          </IconButton>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <ToggleButton
            value="loop"
            selected={globalLoop}
            onChange={() => setGlobalLoop(!globalLoop)}
            size="small"
          >
            {globalLoop ? <RepeatOne fontSize="small" /> : <Repeat fontSize="small" />}
          </ToggleButton>
        </Box>

        {/* Speed Chip */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Chip
            icon={<Speed fontSize="small" />}
            label={`${animation.globalSpeed}x`}
            size="small"
            onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}
          />
        </Box>
      </Box>

      {/* Timeline */}
      <TimelineRuler
        duration={maxDuration}
        currentTime={currentTime}
        onSeek={handleSeek}
      />

      {/* Time Display */}
      <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333' }}>
        <Typography variant="caption" fontFamily="monospace">
          {currentTime.toFixed(2)}s
        </Typography>
        <Typography variant="caption" fontFamily="monospace">
          {maxDuration.toFixed(2)}s
        </Typography>
      </Box>

      {/* Animated Objects List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {animation.states.size === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Animation sx={{ fontSize: 48, color: '#444', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No animations yet
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Select an object and add an animation preset
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Add />}
              onClick={() => setPresetDialogOpen(true)}
              sx={{ mt: 2 }}
            >
              Add Animation
            </Button>
          </Box>
        ) : (
          <List dense>
            {Array.from(animation.states.entries()).map(([id, state]) => {
              const node = sceneNodes.find((n) => n.id === id);
              return (
                <AnimationTrackRow
                  key={id}
                  objectId={id}
                  objectName={node?.name || id}
                  state={state}
                  isSelected={selectedObjectId === id}
                  onSelect={() => setSelectedObjectId(id)}
                  onPlay={() => animation.play(id)}
                  onPause={() => animation.pause(id)}
                  onStop={() => animation.stop(id)}
                  onRemove={() => animation.unregisterObject(id)}
                />
              );
            })}
          </List>
        )}
      </Box>

      {/* Preset Quick Access */}
      <Box sx={{ p: 1, borderTop: '1px solid #333' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          Quick Presets
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {(['fadeIn','pulse','rotate360','bounce'] as const).map((preset) => (
            <Chip
              key={preset}
              label={PRESET_INFO[preset].label}
              size="small"
              onClick={() => handleApplyPreset(preset)}
              disabled={!selectedObjectId && selection.selectedIds.length === 0}
            />
          ))}
        </Box>
      </Box>

      {/* Speed Menu */}
      <Menu
        anchorEl={speedMenuAnchor}
        open={Boolean(speedMenuAnchor)}
        onClose={() => setSpeedMenuAnchor(null)}
      >
        {[0.25, 0.5, 1, 1.5, 2, 3].map((speed) => (
          <MenuItem
            key={speed}
            onClick={() => handleSpeedChange(speed)}
            selected={animation.globalSpeed === speed}
          >
            {speed}x
          </MenuItem>
        ))}
      </Menu>

      {/* Preset Dialog */}
      <Dialog open={presetDialogOpen} onClose={() => setPresetDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Animation Preset</DialogTitle>
        <DialogContent>
          {!selectedObjectId && selection.selectedIds.length === 0 ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Please select an object in the scene first
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose an animation to apply to the selected object
            </Typography>
          )}
          <List>
            {(Object.keys(PRESET_INFO) as Array<keyof typeof ANIMATION_PRESETS>).map((preset) => (
              <ListItem key={preset} disablePadding>
                <ListItemButton
                  onClick={() => handleApplyPreset(preset)}
                  disabled={!selectedObjectId && selection.selectedIds.length === 0}
                >
                  <ListItemIcon>{PRESET_INFO[preset].icon}</ListItemIcon>
                  <ListItemText
                    primary={PRESET_INFO[preset].label}
                    secondary={PRESET_INFO[preset].description}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPresetDialogOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SceneAnimationPanel;

