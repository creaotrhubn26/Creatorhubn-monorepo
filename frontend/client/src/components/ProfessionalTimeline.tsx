import React, { useState, useCallback, useRef, useMemo, useEffect, useSyncExternalStore } from 'react';
import {
  Box,
  Menu,
  MenuItem,
  Divider,
  Typography,
  Chip,
  Tooltip,
  TextField,
  Select,
  IconButton,
  Stack,
  ButtonGroup,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import ZoomIn from '@mui/icons-material/ZoomIn';
import ZoomOut from '@mui/icons-material/ZoomOut';
import SkipPrevious from '@mui/icons-material/SkipPrevious';
import SkipNext from '@mui/icons-material/SkipNext';
import FilterCenterFocus from '@mui/icons-material/FilterCenterFocus';
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';
import ClearAll from '@mui/icons-material/ClearAll';
import CropFree from '@mui/icons-material/CropFree';
import EditIcon from '@mui/icons-material/Edit';
import PaletteIcon from '@mui/icons-material/Palette';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import PublishIcon from '@mui/icons-material/Publish';
import MouseIcon from '@mui/icons-material/Mouse';
import TuneIcon from '@mui/icons-material/Tune';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { BeatClip, Track } from '../services/storyArcDataIntegration';

export interface TimelineMarker {
  id: string;
  time: number;
  color?: string;
  label?: string;
}

export interface TrackState {
  locked?: boolean;
  mute?: boolean;
  solo?: boolean;
  visible?: boolean;
  recordArmed?: boolean;
  inputMonitoring?: boolean;
  automationMode?: TrackAutomationMode;
  color?: string;
  type?: 'video' | 'audio' | 'adjustment' | 'subtitle' | 'graphics';
  audioRole?: AudioTrackRole;
}

export type AudioTrackRole =
  | 'dialogue'
  | 'music'
  | 'effects'
  | 'ambience'
  | 'voiceover'
  | 'narration';

export type TrackAutomationMode = 'off' | 'read' | 'touch' | 'latch' | 'write';

export const AUDIO_TRACK_ROLE_OPTIONS: Array<{ value: AudioTrackRole; label: string }> = [
  { value: 'dialogue', label: 'Dialogue' },
  { value: 'music', label: 'Music' },
  { value: 'effects', label: 'Effects' },
  { value: 'ambience', label: 'Ambience' },
  { value: 'voiceover', label: 'Voiceover' },
  { value: 'narration', label: 'Narration' },
];

const TRACK_AUTOMATION_MODE_OPTIONS: Array<{ value: TrackAutomationMode; label: string; short: string }> = [
  { value: 'off', label: 'Automation Off', short: 'Off' },
  { value: 'read', label: 'Automation Read', short: 'Read' },
  { value: 'touch', label: 'Automation Touch', short: 'Touch' },
  { value: 'latch', label: 'Automation Latch', short: 'Latch' },
  { value: 'write', label: 'Automation Write', short: 'Write' },
];

const TRACK_COLOR_PRESETS = ['#90caf9', '#80cbc4', '#f48fb1', '#ffcc80', '#c5e1a5', '#ce93d8', '#81d4fa'];

export interface TimelineTransition {
  id: string;
  time: number;
  trackId: string;
  type: string;
  duration?: number;
}

interface ProfessionalTimelineProps {
  clips: BeatClip[];
  tracks: Track[];
  zoom: number;
  trackHeightScale?: number;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  selectedClips: Set<string>;
  onClipSelect: (clipId: string, multiSelect?: boolean) => void;
  onClipMove: (clipId: string, newStart: number, newTrackId: string) => void;
  onClipResize?: (
    clipId: string,
    newStart: number,
    newDuration: number,
    mode?: 'resize-left' | 'resize-right'
  ) => void;
  onTimelineClick: (time: number) => void;
  onCurrentTimeChange?: (time: number) => void;
  onZoomChange?: (zoom: number) => void;
  markers?: TimelineMarker[];
  trackStates?: Record<string, TrackState>;
  onTrackToggle?: (trackId: string, changes: Partial<TrackState>) => void;
  onTrackRename?: (trackId: string, name: string) => void;
  onTrackTypeChange?: (trackId: string, type: TrackState['type']) => void;
  onTrackAudioRoleChange?: (trackId: string, role: AudioTrackRole) => void;
  transitions?: TimelineTransition[];
  // Metadata & filtering
  clipMetadata?: Record<string, ClipMetadata>;
  filterTags?: string[];
  searchQuery?: string;
  // Context menu actions
  onContextMenuAction?: (action: string, payload: ContextMenuPayload) => void;
  // Collaboration
  reviewerMode?: boolean;
  collabLocks?: Record<string, { user?: string }>;
  // Compare overlay
  compareClips?: BeatClip[];
  onMediaDrop?: (payload: {
    media: {
      id?: string;
      name?: string;
      url?: string;
      type?: string;
      mimeType?: string;
      duration?: number;
      camera?: string;
      syncGroup?: string;
      tags?: string[];
    };
    trackId: string;
    startTime: number;
  }) => void;
}

export interface ProfessionalTimelineTestHook {
  getSelectedClipIds: () => string[];
  getInOut: () => { inPoint: number | null; outPoint: number | null };
  getMarkers: () => Array<{ id: string; time: number; label?: string }>;
  getPlayhead: () => number;
  addMarkerAtPlayhead: () => void;
  clearMarkers: () => void;
  setPlayhead: (seconds: number) => void;
  setInPointAtPlayhead: () => void;
  setOutPointAtPlayhead: () => void;
  clearInOutPoints: () => void;
  jumpToPreviousMarker: () => void;
  jumpToNextMarker: () => void;
  nudgeSelectedByFrames: (frames: number) => boolean;
  selectClipsByTimeRange: (startTime: number, endTime: number, trackIds?: string[]) => string[];
  getSnappedTime: (timeSeconds: number, ignoreClipId?: string) => number;
  dropMedia: (
    media: {
      id?: string;
      name?: string;
      url?: string;
      type?: string;
      mimeType?: string;
      duration?: number;
      camera?: string;
      syncGroup?: string;
      tags?: string[];
    },
    trackId: string,
    startTime: number
  ) => boolean;
}

declare global {
  interface Window {
    __professionalTimelineTestHook?: ProfessionalTimelineTestHook;
  }
}

type DragMode = 'move' | 'resize-left' | 'resize-right';

interface DragState {
  clipId: string;
  startX: number;
  startTime: number;
  originalTrackId: string;
  originalDuration: number;
  mode: DragMode;
}

interface DragPreviewState {
  clipId: string;
  trackId: string;
  start: number;
  duration: number;
  mode: DragMode;
}

interface TrackLayout {
  id: string;
  top: number;
  bottom: number;
  height: number;
}

interface ClipMetadata {
  camera?: string;
  shotName?: string;
  scene?: string;
  take?: string;
  tags?: string[];
}

interface ClipVisualMetadata {
  isEnhanced: boolean;
  originalName?: string;
  syncConfidence?: number;
}

interface EphemeralMarker extends TimelineMarker {
  ephemeral?: boolean;
}

interface MarqueeSelectionState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface PanState {
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
  isSpaceHand: boolean;
}

interface HoverState {
  guideX: number | null;
  time: number | null;
}

interface ExternalStore<T> {
  getSnapshot: () => T;
  subscribe: (listener: () => void) => () => void;
  setSnapshot: (nextValue: T) => void;
}

interface ContextMenuPayload {
  clipId: string;
  color?: string;
}

interface ClipRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const RULER_HEIGHT = 24;
const SNAP_PX = 6;
const RESIZE_EDGE_THRESHOLD_PX = 10;
const RESIZE_HANDLE_WIDTH_PX = 14;
const MIN_CLIP_DURATION_SECONDS = 0.1;
const TIMELINE_SCROLL_STEP_SECONDS = 1;
const TIMELINE_FINE_SCROLL_STEP_SECONDS = 0.04;
const AUTO_SCROLL_EDGE_PX = 40;
const AUTO_SCROLL_MAX_PX_PER_TICK = 28;
const AUTO_SCROLL_VERTICAL_EDGE_PX = 36;
const AUTO_SCROLL_MAX_VERTICAL_PX_PER_TICK = 22;
const PAN_INERTIA_FRICTION = 0.92;
const PAN_INERTIA_MIN_VELOCITY = 0.02;
const HEADER_WIDTH = 160;
const MIN_TIMELINE_ZOOM = 0.1;
const MAX_TIMELINE_ZOOM = 5;
const TIMELINE_DEFAULT_ZOOM = 1;
const SNAP_GUIDE_VISIBLE_THRESHOLD_PX = 0.5;
const DRAG_COMMIT_EPSILON_SECONDS = 0.0005;
const OBJECT_URL_REVOKE_DELAY_MS = 120000;
const TIMELINE_TOOLBAR_PREFS_KEY = 'storyarc.timeline.toolbar.v2';
const CLIP_METADATA_VISIBILITY_MIN_WIDTH_PX = 96;
const CLIP_TAGS_VISIBILITY_MIN_WIDTH_PX = 140;
const EMPTY_CLIP_METADATA: ClipMetadata = {};
const EMPTY_TAG_CHIPS: string[] = [];
const DEFAULT_CLIP_VISUAL_METADATA: ClipVisualMetadata = { isEnhanced: false };
const EMPTY_TRACK_STATE: TrackState = {};
const ENABLE_TIMELINE_DEBUG_DATA_ATTRS = import.meta.env.DEV;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type WorkspaceMode = 'cut' | 'edit' | 'color' | 'fairlight' | 'deliver';
type TimelineToolMode = 'select' | 'trim' | 'roll' | 'slip' | 'slide' | 'razor';
type TimeDisplayMode = 'timecode' | 'seconds' | 'frames';

interface TimelineToolbarPreferences {
  workspaceMode: WorkspaceMode;
  toolMode: TimelineToolMode;
  safeTrimEnabled: boolean;
  magneticEnabled: boolean;
  snappingEnabled: boolean;
  rippleEnabled: boolean;
  timeDisplayMode: TimeDisplayMode;
  timelineFps: number;
}

function isWorkspaceMode(value: unknown): value is WorkspaceMode {
  return value === 'cut' || value === 'edit' || value === 'color' || value === 'fairlight' || value === 'deliver';
}

function isTimelineToolMode(value: unknown): value is TimelineToolMode {
  return value === 'select' || value === 'trim' || value === 'roll' || value === 'slip' || value === 'slide' || value === 'razor';
}

function isTimeDisplayMode(value: unknown): value is TimeDisplayMode {
  return value === 'timecode' || value === 'seconds' || value === 'frames';
}

function loadTimelineToolbarPreferences(): Partial<TimelineToolbarPreferences> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(TIMELINE_TOOLBAR_PREFS_KEY);
    if (!raw) {
      return {};
    }
    const parsedUnknown: unknown = JSON.parse(raw);
    if (!parsedUnknown || typeof parsedUnknown !== 'object') {
      return {};
    }
    const parsed = parsedUnknown as Record<string, unknown>;
    const prefs: Partial<TimelineToolbarPreferences> = {};
    if (isWorkspaceMode(parsed.workspaceMode)) {
      prefs.workspaceMode = parsed.workspaceMode;
    }
    if (isTimelineToolMode(parsed.toolMode)) {
      prefs.toolMode = parsed.toolMode;
    }
    if (typeof parsed.safeTrimEnabled === 'boolean') {
      prefs.safeTrimEnabled = parsed.safeTrimEnabled;
    }
    if (typeof parsed.magneticEnabled === 'boolean') {
      prefs.magneticEnabled = parsed.magneticEnabled;
    }
    if (typeof parsed.snappingEnabled === 'boolean') {
      prefs.snappingEnabled = parsed.snappingEnabled;
    }
    if (typeof parsed.rippleEnabled === 'boolean') {
      prefs.rippleEnabled = parsed.rippleEnabled;
    }
    if (isTimeDisplayMode(parsed.timeDisplayMode)) {
      prefs.timeDisplayMode = parsed.timeDisplayMode;
    }
    if (typeof parsed.timelineFps === 'number' && Number.isFinite(parsed.timelineFps)) {
      prefs.timelineFps = clampNumber(parsed.timelineFps, 1, 120);
    }
    return prefs;
  } catch {
    return {};
  }
}

function formatTimelineTime(seconds: number, fps: number = 25): string {
  const clamped = Math.max(0, seconds);
  const normalizedFps = Math.max(1, Math.round(fps));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const frames = Math.floor((clamped - Math.floor(clamped)) * normalizedFps);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

function formatTimelineDisplay(seconds: number, mode: TimeDisplayMode, fps: number): string {
  if (mode === 'seconds') {
    return `${Math.max(0, seconds).toFixed(2)}s`;
  }
  if (mode === 'frames') {
    const totalFrames = Math.round(Math.max(0, seconds) * Math.max(1, Math.round(fps)));
    return `${totalFrames}fr`;
  }
  return formatTimelineTime(seconds, fps);
}

function findLowerBound(sortedValues: number[], value: number): number {
  let left = 0;
  let right = sortedValues.length;
  while (left < right) {
    const mid = (left + right) >> 1;
    if (sortedValues[mid] < value) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }
  return left;
}

function createExternalStore<T>(initialValue: T): ExternalStore<T> {
  let currentValue = initialValue;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => currentValue,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSnapshot: (nextValue) => {
      if (Object.is(currentValue, nextValue)) {
        return;
      }
      currentValue = nextValue;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

function useExternalStoreSnapshot<T>(store: ExternalStore<T>): T {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

function toClipVisualMetadata(clip: BeatClip): ClipVisualMetadata {
  const metadata = clip.metadata;
  const unknownClip = clip as unknown as Record<string, unknown>;
  const isEnhanced = Boolean(unknownClip.enhanced);

  const originalNameRaw = metadata?.originalName;
  const originalName = typeof originalNameRaw === 'string' && originalNameRaw.trim().length > 0
    ? originalNameRaw.trim()
    : undefined;

  const confidenceRaw = metadata?.syncConfidence;
  const syncConfidence =
    typeof confidenceRaw === 'number' && Number.isFinite(confidenceRaw)
      ? clampNumber(confidenceRaw, 0, 1)
      : undefined;

  return {
    isEnhanced,
    originalName,
    syncConfidence,
  };
}

interface TimelineGridLine {
  time: number;
  position: number;
  isMain: boolean;
}

type SnapKind = 'grid' | 'marker' | 'playhead' | 'clip-edge';

interface SnapResult {
  value: number;
  snapped: boolean;
  kind: SnapKind | null;
  label: string | null;
}

interface BaseSnapTarget {
  value: number;
  kind: Exclude<SnapKind, 'clip-edge'>;
  label: string;
}

interface TimelineToolbarProps {
  zoom: number;
  inPoint: number | null;
  outPoint: number | null;
  timelineFps: number;
  workspaceMode: WorkspaceMode;
  toolMode: TimelineToolMode;
  safeTrimEnabled: boolean;
  magneticEnabled: boolean;
  snappingEnabled: boolean;
  rippleEnabled: boolean;
  timeDisplayMode: TimeDisplayMode;
  selectedClipCount: number;
  allMarkerCount: number;
  ephemeralMarkerCount: number;
  onWorkspaceModeChange: (nextMode: WorkspaceMode) => void;
  onToolModeChange: (nextMode: TimelineToolMode) => void;
  onTimelineFpsChange: (nextFps: number) => void;
  onTimeDisplayModeChange: (nextMode: TimeDisplayMode) => void;
  onToggleSafeTrim: () => void;
  onToggleMagnetic: () => void;
  onToggleSnapping: () => void;
  onToggleRipple: () => void;
  onZoomToProject: () => void;
  onZoomToSelection: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onInsertAtPlayhead: () => void;
  onOverwriteAtPlayhead: () => void;
  onLiftSelection: () => void;
  onExtractSelection: () => void;
  onSplitAtPlayhead: () => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
  onJumpPreviousMarker: () => void;
  onJumpNextMarker: () => void;
  onAddMarkerAtPlayhead: () => void;
  onClearLocalMarkers: () => void;
  onSetInPoint: () => void;
  onSetOutPoint: () => void;
  onJumpToInPoint: () => void;
  onJumpToOutPoint: () => void;
  onClearInOutPoints: () => void;
  onSelectClipAtPlayhead: () => void;
  onNudgeSelectionLeft: () => void;
  onNudgeSelectionRight: () => void;
}

const TimelineToolbar = React.memo(function TimelineToolbar({
  zoom,
  inPoint,
  outPoint,
  timelineFps,
  workspaceMode,
  toolMode,
  safeTrimEnabled,
  magneticEnabled,
  snappingEnabled,
  rippleEnabled,
  timeDisplayMode,
  selectedClipCount,
  allMarkerCount,
  ephemeralMarkerCount,
  onWorkspaceModeChange,
  onToolModeChange,
  onTimelineFpsChange,
  onTimeDisplayModeChange,
  onToggleSafeTrim,
  onToggleMagnetic,
  onToggleSnapping,
  onToggleRipple,
  onZoomToProject,
  onZoomToSelection,
  onZoomOut,
  onZoomIn,
  onInsertAtPlayhead,
  onOverwriteAtPlayhead,
  onLiftSelection,
  onExtractSelection,
  onSplitAtPlayhead,
  onDuplicateSelection,
  onDeleteSelection,
  onJumpPreviousMarker,
  onJumpNextMarker,
  onAddMarkerAtPlayhead,
  onClearLocalMarkers,
  onSetInPoint,
  onSetOutPoint,
  onJumpToInPoint,
  onJumpToOutPoint,
  onClearInOutPoints,
  onSelectClipAtPlayhead,
  onNudgeSelectionLeft,
  onNudgeSelectionRight,
}: TimelineToolbarProps) {
  const workspaceOptions: Array<{ value: WorkspaceMode; label: string; icon: React.ReactNode }> = [
    { value: 'cut', label: 'Cut', icon: <ContentCutIcon fontSize="small" /> },
    { value: 'edit', label: 'Edit', icon: <EditIcon fontSize="small" /> },
    { value: 'color', label: 'Color', icon: <PaletteIcon fontSize="small" /> },
    { value: 'fairlight', label: 'Fairlight', icon: <GraphicEqIcon fontSize="small" /> },
    { value: 'deliver', label: 'Deliver', icon: <PublishIcon fontSize="small" /> },
  ];
  const toolOptions: Array<{ value: TimelineToolMode; label: string; shortcut: string; icon: React.ReactNode }> = [
    { value: 'select', label: 'Select', shortcut: 'A', icon: <MouseIcon fontSize="small" /> },
    { value: 'trim', label: 'Trim', shortcut: 'T', icon: <TuneIcon fontSize="small" /> },
    { value: 'roll', label: 'Roll', shortcut: 'R', icon: <SyncAltIcon fontSize="small" /> },
    { value: 'slip', label: 'Slip', shortcut: 'Y', icon: <SwapHorizIcon fontSize="small" /> },
    { value: 'slide', label: 'Slide', shortcut: 'U', icon: <SwapHorizIcon fontSize="small" sx={{ transform: 'scaleX(-1)' }} /> },
    { value: 'razor', label: 'Razor', shortcut: 'C', icon: <ContentCutIcon fontSize="small" /> },
  ];
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        px: 1,
        py: 0.75,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        minHeight: 46,
        overflowX: 'auto',
        flexWrap: 'wrap',
        rowGap: 0.75,
        alignContent: 'center',
        '&::-webkit-scrollbar': {
          height: 6,
        },
      }}
    >
      <ToggleButtonGroup
        size="small"
        exclusive
        value={workspaceMode}
        onChange={(_event, nextValue: WorkspaceMode | null) => {
          if (nextValue) {
            onWorkspaceModeChange(nextValue);
          }
        }}
        aria-label="Timeline workspace mode"
      >
        {workspaceOptions.map((option) => (
          <ToggleButton key={option.value} value={option.value} aria-label={`Switch to ${option.label} workspace`}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              {option.icon}
              <Typography variant="caption" sx={{ fontWeight: option.value === workspaceMode ? 700 : 500 }}>
                {option.label}
              </Typography>
            </Stack>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={toolMode}
        onChange={(_event, nextValue: TimelineToolMode | null) => {
          if (nextValue) {
            onToolModeChange(nextValue);
          }
        }}
        aria-label="Timeline tool mode"
      >
        {toolOptions.map((option) => (
          <ToggleButton key={option.value} value={option.value} aria-label={`${option.label} tool (${option.shortcut})`}>
            <Tooltip title={`${option.label} (${option.shortcut})`} arrow>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {option.icon}
                <Typography variant="caption" sx={{ fontWeight: option.value === toolMode ? 700 : 500 }}>
                  {option.label}
                </Typography>
              </Stack>
            </Tooltip>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Insert at playhead">
          <span>
            <Button
              startIcon={<KeyboardArrowRight fontSize="small" />}
              aria-label="Insert selected clip at playhead"
              onClick={onInsertAtPlayhead}
              disabled={selectedClipCount === 0}
            >
              Insert
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Overwrite at playhead">
          <span>
            <Button
              startIcon={<KeyboardArrowLeft fontSize="small" />}
              aria-label="Overwrite selected clip at playhead"
              onClick={onOverwriteAtPlayhead}
              disabled={selectedClipCount === 0}
            >
              Overwrite
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Lift selection">
          <span>
            <Button
              startIcon={<SkipPrevious fontSize="small" />}
              aria-label="Lift selected clips"
              onClick={onLiftSelection}
              disabled={selectedClipCount === 0}
            >
              Lift
            </Button>
          </span>
        </Tooltip>
        <Tooltip title="Extract selection">
          <span>
            <Button
              startIcon={<SkipNext fontSize="small" />}
              aria-label="Extract selected clips"
              onClick={onExtractSelection}
              disabled={selectedClipCount === 0}
            >
              Extract
            </Button>
          </span>
        </Tooltip>
      </ButtonGroup>

      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Split selected clip at playhead (S)">
          <span>
            <IconButton
              size="small"
              aria-label="Split selected clip at playhead"
              onClick={onSplitAtPlayhead}
              disabled={selectedClipCount === 0}
            >
              <CallSplitIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Duplicate selected clip (Ctrl/Cmd + D)">
          <span>
            <IconButton
              size="small"
              aria-label="Duplicate selected clips"
              onClick={onDuplicateSelection}
              disabled={selectedClipCount === 0}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Delete selected clips">
          <span>
            <IconButton
              size="small"
              aria-label="Delete selected clips"
              onClick={onDeleteSelection}
              disabled={selectedClipCount === 0}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </ButtonGroup>

      <ButtonGroup size="small" variant="outlined" aria-label="Timeline editing modes">
        <Button
          variant={safeTrimEnabled ? 'contained' : 'outlined'}
          color={safeTrimEnabled ? 'primary' : 'inherit'}
          onClick={onToggleSafeTrim}
          aria-label="Toggle safe trim mode"
        >
          Safe Trim
        </Button>
        <Button
          variant={magneticEnabled ? 'contained' : 'outlined'}
          color={magneticEnabled ? 'primary' : 'inherit'}
          onClick={onToggleMagnetic}
          aria-label="Toggle magnetic clip-edge snapping"
        >
          Magnetic
        </Button>
        <Button
          variant={snappingEnabled ? 'contained' : 'outlined'}
          color={snappingEnabled ? 'primary' : 'inherit'}
          onClick={onToggleSnapping}
          aria-label="Toggle timeline grid and marker snapping"
        >
          Snap
        </Button>
        <Button
          variant={rippleEnabled ? 'contained' : 'outlined'}
          color={rippleEnabled ? 'primary' : 'inherit'}
          onClick={onToggleRipple}
          aria-label="Toggle ripple editing mode"
        >
          Ripple
        </Button>
      </ButtonGroup>

      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Zoom to full project">
          <IconButton size="small" aria-label="Zoom to project" onClick={onZoomToProject}>
            <CropFree fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom to selected clips">
          <IconButton
            size="small"
            aria-label="Zoom to selection"
            onClick={onZoomToSelection}
            disabled={selectedClipCount === 0}
          >
            <FilterCenterFocus fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom out">
          <IconButton size="small" aria-label="Zoom out" onClick={onZoomOut}>
            <ZoomOut fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom in">
          <IconButton size="small" aria-label="Zoom in" onClick={onZoomIn}>
            <ZoomIn fontSize="small" />
          </IconButton>
        </Tooltip>
      </ButtonGroup>

      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Previous marker">
          <IconButton size="small" aria-label="Previous marker" onClick={onJumpPreviousMarker} disabled={allMarkerCount === 0}>
            <SkipPrevious fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Next marker">
          <IconButton size="small" aria-label="Next marker" onClick={onJumpNextMarker} disabled={allMarkerCount === 0}>
            <SkipNext fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add marker at playhead (M)">
          <IconButton size="small" aria-label="Add marker at playhead" onClick={onAddMarkerAtPlayhead}>
            <FiberManualRecord fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear local markers">
          <span>
            <IconButton size="small" aria-label="Clear local markers" onClick={onClearLocalMarkers} disabled={ephemeralMarkerCount === 0}>
              <ClearAll fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </ButtonGroup>

      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Set in point (I)">
          <IconButton size="small" aria-label="Set in point" onClick={onSetInPoint}>
            <KeyboardArrowLeft fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Set out point (O)">
          <IconButton size="small" aria-label="Set out point" onClick={onSetOutPoint}>
            <KeyboardArrowRight fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Jump to in point">
          <span>
            <IconButton size="small" aria-label="Jump to in point" onClick={onJumpToInPoint} disabled={inPoint === null}>
              <KeyboardArrowLeft fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Jump to out point">
          <span>
            <IconButton size="small" aria-label="Jump to out point" onClick={onJumpToOutPoint} disabled={outPoint === null}>
              <KeyboardArrowRight fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Clear in/out points">
          <span>
            <IconButton size="small" aria-label="Clear in and out points" onClick={onClearInOutPoints} disabled={inPoint === null && outPoint === null}>
              <FilterCenterFocus fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </ButtonGroup>

      <ButtonGroup size="small" variant="outlined">
        <Tooltip title="Select clip at playhead (V)">
          <IconButton size="small" aria-label="Select clip at playhead" onClick={onSelectClipAtPlayhead}>
            <FilterCenterFocus fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Nudge selected clips left one frame (,)" arrow>
          <span>
            <IconButton
              size="small"
              aria-label="Nudge selected clips left"
              onClick={onNudgeSelectionLeft}
              disabled={selectedClipCount === 0}
            >
              <KeyboardArrowLeft fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Nudge selected clips right one frame (.)" arrow>
          <span>
            <IconButton
              size="small"
              aria-label="Nudge selected clips right"
              onClick={onNudgeSelectionRight}
              disabled={selectedClipCount === 0}
            >
              <KeyboardArrowRight fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </ButtonGroup>

      <ToggleButtonGroup
        size="small"
        exclusive
        value={timeDisplayMode}
        onChange={(_event, nextValue: TimeDisplayMode | null) => {
          if (nextValue) {
            onTimeDisplayModeChange(nextValue);
          }
        }}
        aria-label="Timeline time display mode"
      >
        <ToggleButton value="timecode" aria-label="Display as timecode">TC</ToggleButton>
        <ToggleButton value="seconds" aria-label="Display as seconds">Sec</ToggleButton>
        <ToggleButton value="frames" aria-label="Display as frames">Fr</ToggleButton>
      </ToggleButtonGroup>

      <TextField
        select
        size="small"
        value={String(timelineFps)}
        aria-label="Timeline frame rate"
        onChange={(event) => {
          const nextFps = Number(event.target.value);
          if (Number.isFinite(nextFps)) {
            onTimelineFpsChange(nextFps);
          }
        }}
        sx={{ minWidth: 90, '& .MuiInputBase-input': { py: 0.5 } }}
      >
        {[23.976, 24, 25, 29.97, 30, 50, 60].map((fps) => (
          <MenuItem key={fps} value={fps}>
            {fps} fps
          </MenuItem>
        ))}
      </TextField>

      <Chip size="small" label={`Zoom ${Math.round(zoom * 100)}%`} variant="outlined" />
      <Chip size="small" label={`${selectedClipCount} selected`} color={selectedClipCount > 0 ? 'primary' : 'default'} variant="outlined" />
    </Stack>
  );
});

interface TimelineToolbarLiveStatusProps {
  currentTime: number;
  inPoint: number | null;
  outPoint: number | null;
  timelineFps: number;
  frameStepSeconds: number;
  timeDisplayMode: TimeDisplayMode;
}

const TimelineToolbarLiveStatus = React.memo(function TimelineToolbarLiveStatus({
  currentTime,
  inPoint,
  outPoint,
  timelineFps,
  frameStepSeconds,
  timeDisplayMode,
}: TimelineToolbarLiveStatusProps) {
  const displayLabel = formatTimelineDisplay(currentTime, timeDisplayMode, timelineFps);
  const rangeLabel =
    inPoint !== null || outPoint !== null
      ? `Range ${inPoint !== null ? formatTimelineDisplay(inPoint, timeDisplayMode, timelineFps) : '--'} → ${outPoint !== null ? formatTimelineDisplay(outPoint, timeDisplayMode, timelineFps) : '--'}`
      : 'Range --';
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        px: 1,
        py: 0.4,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        minHeight: 30,
      }}
    >
      <Chip size="small" label={`Playhead ${displayLabel}`} variant="outlined" />
      <Chip size="small" label={rangeLabel} variant="outlined" />
      <Chip size="small" label={`Step ${formatTimelineDisplay(frameStepSeconds, timeDisplayMode, timelineFps)}`} variant="outlined" />
    </Stack>
  );
});

interface TimelineRulerProps {
  rulerRef: React.RefObject<HTMLDivElement>;
  totalDuration: number;
  currentTime: number;
  isPlaying: boolean;
  timelineFps: number;
  timeDisplayMode: TimeDisplayMode;
  gridLines: TimelineGridLine[];
  allMarkers: EphemeralMarker[];
  inPoint: number | null;
  outPoint: number | null;
  viewportStartPx: number;
  viewportEndPx: number;
  hoverStore: ExternalStore<HoverState>;
  snapGuideVisible: boolean;
  snapGuideX: number | null;
  snapGuideLabel: string | null;
  timeToPixels: (timeSeconds: number) => number;
  onRulerScrubToClientX: (clientX: number) => void;
  onRulerDoubleClick: () => void;
  onRulerKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onRulerHoverClientX: (clientX: number) => void;
  onRulerMouseLeave: () => void;
  onJumpToMarker: (timeSeconds: number) => void;
  onClientXToTime: (clientX: number) => number;
  onSetInPointAtTime: (timeSeconds: number) => void;
  onSetOutPointAtTime: (timeSeconds: number) => void;
}

interface MarkerCluster {
  id: string;
  lane: number;
  position: number;
  markers: EphemeralMarker[];
}

interface TimelineRulerStaticLayerProps {
  visibleGridLines: TimelineGridLine[];
  visibleTickLabels: TimelineGridLine[];
  markerClusters: MarkerCluster[];
  inPoint: number | null;
  outPoint: number | null;
  timeDisplayMode: TimeDisplayMode;
  timelineFps: number;
  timeToPixels: (timeSeconds: number) => number;
  onJumpToMarker: (timeSeconds: number) => void;
  onBeginPointerDrag: (event: React.PointerEvent<HTMLElement>, mode: 'scrub' | 'in' | 'out') => void;
}

const TimelineRulerStaticLayer = React.memo(function TimelineRulerStaticLayer({
  visibleGridLines,
  visibleTickLabels,
  markerClusters,
  inPoint,
  outPoint,
  timeDisplayMode,
  timelineFps,
  timeToPixels,
  onJumpToMarker,
  onBeginPointerDrag,
}: TimelineRulerStaticLayerProps) {
  return (
    <>
      {visibleGridLines.map((line) => (
        <Box key={line.time} sx={{ position: 'absolute', left: HEADER_WIDTH + line.position, top: 0, bottom: 0, width: 1, bgcolor: line.isMain ? 'divider' : 'rgba(0,0,0,0.06)' }} />
      ))}
      {visibleTickLabels.map((line) => (
        <Typography
          key={`tick-${line.time}`}
          variant="caption"
          sx={{
            position: 'absolute',
            left: HEADER_WIDTH + line.position + 2,
            top: 1,
            fontSize: 9,
            color: 'text.secondary',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {formatTimelineDisplay(line.time, timeDisplayMode, timelineFps)}
        </Typography>
      ))}
      {markerClusters.map((cluster) => {
        const laneTop = 2 + cluster.lane * 7;
        const firstMarker = cluster.markers[0];
        const isFaceMarker = firstMarker.label?.includes('Face') || firstMarker.color === '#10b981';
        const clusterColor = cluster.markers.length > 1
          ? 'rgba(144, 202, 249, 0.95)'
          : (firstMarker.color || 'warning.main');
        const tooltipLabel = cluster.markers.length > 1
          ? `${cluster.markers.length} markers: ${cluster.markers.slice(0, 4).map((marker) => marker.label || formatTimelineDisplay(marker.time, timeDisplayMode, timelineFps)).join(', ')}`
          : (firstMarker.label || `Marker @ ${formatTimelineDisplay(firstMarker.time, timeDisplayMode, timelineFps)}`);
        return (
          <Tooltip key={cluster.id} title={tooltipLabel} arrow>
            <Box
              role="button"
              tabIndex={0}
              aria-label={
                cluster.markers.length > 1
                  ? `Jump to marker cluster at ${formatTimelineDisplay(firstMarker.time, timeDisplayMode, timelineFps)}`
                  : (firstMarker.label || `Jump to marker at ${formatTimelineDisplay(firstMarker.time, timeDisplayMode, timelineFps)}`)
              }
              onClick={(e) => {
                e.stopPropagation();
                onJumpToMarker(firstMarker.time);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onJumpToMarker(firstMarker.time);
                }
              }}
              sx={{
                position: 'absolute',
                left: HEADER_WIDTH + cluster.position - (cluster.markers.length > 1 ? 8 : (isFaceMarker ? 4 : 1)),
                top: laneTop,
                width: cluster.markers.length > 1 ? 16 : (isFaceMarker ? 8 : 2),
                height: cluster.markers.length > 1 ? 6 : 7,
                borderRadius: cluster.markers.length > 1 ? 1 : 0,
                bgcolor: clusterColor,
                cursor: 'pointer',
                '&:hover': {
                  opacity: 0.9,
                  zIndex: 1,
                },
                ...(cluster.markers.length === 1 && isFaceMarker && {
                  borderRadius: '2px',
                  boxShadow: '0 0 4px rgba(16, 185, 129, 0.5)',
                }),
                ...(cluster.markers.length === 1 && firstMarker.ephemeral && {
                  bgcolor: '#ffb300',
                  opacity: 0.9,
                }),
                '&:focus-visible': {
                  outline: '2px solid rgba(59, 130, 246, 0.95)',
                  outlineOffset: 1,
                },
              }}
            >
              {cluster.markers.length > 1 ? (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    fontSize: 9,
                    lineHeight: '6px',
                    textAlign: 'center',
                    color: '#001',
                    fontWeight: 700,
                    userSelect: 'none',
                  }}
                >
                  {cluster.markers.length}
                </Typography>
              ) : isFaceMarker ? (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#10b981',
                    border: '1px solid white',
                    boxShadow: '0 0 2px rgba(0,0,0,0.3)',
                  }}
                />
              ) : null}
            </Box>
          </Tooltip>
        );
      })}
      {inPoint !== null && (
        <>
          <Box
            sx={{
              position: 'absolute',
              left: HEADER_WIDTH + timeToPixels(inPoint),
              top: 0,
              bottom: 0,
              width: 2,
              bgcolor: 'success.main',
              pointerEvents: 'none',
            }}
          />
          <Box
            role="button"
            tabIndex={0}
            aria-label="Drag in point handle"
            onPointerDown={(event) => {
              event.stopPropagation();
              onBeginPointerDrag(event, 'in');
            }}
            sx={{
              position: 'absolute',
              left: HEADER_WIDTH + timeToPixels(inPoint) - 6,
              top: 0,
              width: 12,
              height: 12,
              borderRadius: '0 0 8px 8px',
              bgcolor: 'success.main',
              cursor: 'ew-resize',
              zIndex: 3,
            }}
          />
        </>
      )}
      {outPoint !== null && (
        <>
          <Box
            sx={{
              position: 'absolute',
              left: HEADER_WIDTH + timeToPixels(outPoint),
              top: 0,
              bottom: 0,
              width: 2,
              bgcolor: 'warning.main',
              pointerEvents: 'none',
            }}
          />
          <Box
            role="button"
            tabIndex={0}
            aria-label="Drag out point handle"
            onPointerDown={(event) => {
              event.stopPropagation();
              onBeginPointerDrag(event, 'out');
            }}
            sx={{
              position: 'absolute',
              left: HEADER_WIDTH + timeToPixels(outPoint) - 6,
              top: 0,
              width: 12,
              height: 12,
              borderRadius: '0 0 8px 8px',
              bgcolor: 'warning.main',
              cursor: 'ew-resize',
              zIndex: 3,
            }}
          />
        </>
      )}
    </>
  );
});

interface TimelineRulerLiveLayerProps {
  currentTime: number;
  isPlaying: boolean;
  hoverGuideX: number | null;
  hoverTime: number | null;
  snapGuideVisible: boolean;
  snapGuideX: number | null;
  snapGuideLabel: string | null;
  timeDisplayMode: TimeDisplayMode;
  timelineFps: number;
  timeToPixels: (timeSeconds: number) => number;
}

const TimelineRulerLiveLayer = React.memo(function TimelineRulerLiveLayer({
  currentTime,
  isPlaying,
  hoverGuideX,
  hoverTime,
  snapGuideVisible,
  snapGuideX,
  snapGuideLabel,
  timeDisplayMode,
  timelineFps,
  timeToPixels,
}: TimelineRulerLiveLayerProps) {
  return (
    <>
      {hoverGuideX !== null && (
        <Box
          sx={{
            position: 'absolute',
            left: HEADER_WIDTH + hoverGuideX,
            top: 0,
            bottom: 0,
            width: 1,
            bgcolor: 'rgba(255,255,255,0.35)',
            pointerEvents: 'none',
          }}
        />
      )}
      {hoverTime !== null && (
        <Chip
          size="small"
          label={formatTimelineDisplay(hoverTime, timeDisplayMode, timelineFps)}
          sx={{
            position: 'absolute',
            left: HEADER_WIDTH + (hoverGuideX ?? 0) + 6,
            top: 2,
            height: 18,
            fontSize: 10,
            pointerEvents: 'none',
            zIndex: 3,
          }}
        />
      )}
      {snapGuideVisible && snapGuideX !== null && (
        <>
          <Box
            sx={{
              position: 'absolute',
              left: HEADER_WIDTH + snapGuideX,
              top: 0,
              bottom: 0,
              width: 1,
              bgcolor: 'info.main',
              pointerEvents: 'none',
              opacity: 0.95,
            }}
          />
          <Chip
            size="small"
            label={snapGuideLabel ? `Snap: ${snapGuideLabel}` : 'Snap'}
            sx={{
              position: 'absolute',
              left: HEADER_WIDTH + snapGuideX + 6,
              top: RULER_HEIGHT - 18,
              height: 16,
              fontSize: 9,
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
        </>
      )}
      <Box
        sx={{
          position: 'absolute',
          left: HEADER_WIDTH + timeToPixels(currentTime),
          top: 0,
          bottom: 0,
          width: 2,
          bgcolor: 'error.main',
          pointerEvents: 'none',
          opacity: isPlaying ? 1 : 0.9,
          boxShadow: isPlaying ? '0 0 10px rgba(244, 67, 54, 0.75)' : 'none',
          transition: 'box-shadow 120ms ease, opacity 120ms ease',
        }}
      />
    </>
  );
});

interface TimelineHoverGuideOverlayProps {
  hoverStore: ExternalStore<HoverState>;
}

const TimelineHoverGuideOverlay = React.memo(function TimelineHoverGuideOverlay({
  hoverStore,
}: TimelineHoverGuideOverlayProps) {
  const hoverState = useExternalStoreSnapshot(hoverStore);
  if (hoverState.guideX === null) {
    return null;
  }
  return (
    <Box
      sx={{
        position: 'absolute',
        left: HEADER_WIDTH + hoverState.guideX,
        top: 0,
        bottom: 0,
        width: 1,
        bgcolor: 'rgba(255,255,255,0.2)',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
});

const TimelineRuler = React.memo(function TimelineRuler({
  rulerRef,
  totalDuration,
  currentTime,
  isPlaying,
  timelineFps,
  timeDisplayMode,
  gridLines,
  allMarkers,
  inPoint,
  outPoint,
  viewportStartPx,
  viewportEndPx,
  hoverStore,
  snapGuideVisible,
  snapGuideX,
  snapGuideLabel,
  timeToPixels,
  onRulerScrubToClientX,
  onRulerDoubleClick,
  onRulerKeyDown,
  onRulerHoverClientX,
  onRulerMouseLeave,
  onJumpToMarker,
  onClientXToTime,
  onSetInPointAtTime,
  onSetOutPointAtTime,
}: TimelineRulerProps) {
  const hoverState = useExternalStoreSnapshot(hoverStore);
  const hoverGuideX = hoverState.guideX;
  const hoverTime = hoverState.time;
  const pointerIdRef = useRef<number | null>(null);
  const dragModeRef = useRef<'scrub' | 'in' | 'out' | null>(null);

  const visibleGridLines = useMemo(() => {
    const margin = 80;
    return gridLines.filter((line) => line.position >= viewportStartPx - margin && line.position <= viewportEndPx + margin);
  }, [gridLines, viewportEndPx, viewportStartPx]);

  const visibleTickLabels = useMemo(() => {
    const labels: TimelineGridLine[] = [];
    let lastPosition = Number.NEGATIVE_INFINITY;
    for (const line of visibleGridLines) {
      if (!line.isMain) {
        continue;
      }
      if (line.position - lastPosition < 72) {
        continue;
      }
      labels.push(line);
      lastPosition = line.position;
    }
    return labels;
  }, [visibleGridLines]);

  const getMarkerLane = useCallback((marker: EphemeralMarker): number => {
    if (marker.label?.includes('Face') || marker.color === '#10b981') {
      return 0;
    }
    if (marker.ephemeral) {
      return 2;
    }
    return 1;
  }, []);

  const markerClusters = useMemo(() => {
    const clusterThresholdPx = 12;
    const laneBuckets: Record<number, Array<{ marker: EphemeralMarker; position: number }>> = {
      0: [],
      1: [],
      2: [],
    };
    const margin = 36;
    for (const marker of allMarkers) {
      const position = timeToPixels(marker.time);
      if (position < viewportStartPx - margin || position > viewportEndPx + margin) {
        continue;
      }
      const lane = getMarkerLane(marker);
      laneBuckets[lane].push({ marker, position });
    }

    const clusters: MarkerCluster[] = [];

    for (const lane of [0, 1, 2]) {
      const sorted = laneBuckets[lane].sort((left, right) => left.position - right.position);
      let active: Array<{ marker: EphemeralMarker; position: number }> = [];
      for (const entry of sorted) {
        const previous = active[active.length - 1];
        if (!previous || entry.position - previous.position <= clusterThresholdPx) {
          active.push(entry);
        } else {
          const avgPosition = active.reduce((sum, item) => sum + item.position, 0) / active.length;
          clusters.push({
            id: `cluster-${lane}-${active[0].marker.id}`,
            lane,
            position: avgPosition,
            markers: active.map((item) => item.marker),
          });
          active = [entry];
        }
      }
      if (active.length > 0) {
        const avgPosition = active.reduce((sum, item) => sum + item.position, 0) / active.length;
        clusters.push({
          id: `cluster-${lane}-${active[0].marker.id}`,
          lane,
          position: avgPosition,
          markers: active.map((item) => item.marker),
        });
      }
    }
    return clusters;
  }, [allMarkers, getMarkerLane, timeToPixels, viewportEndPx, viewportStartPx]);

  const beginPointerDrag = useCallback((event: React.PointerEvent<HTMLElement>, mode: 'scrub' | 'in' | 'out') => {
    if (event.button !== 0) {
      return;
    }
    pointerIdRef.current = event.pointerId;
    dragModeRef.current = mode;
    const captureTarget = rulerRef.current;
    if (captureTarget) {
      captureTarget.setPointerCapture(event.pointerId);
    }
    if (mode === 'scrub') {
      onRulerScrubToClientX(event.clientX);
      return;
    }
    const nextTime = onClientXToTime(event.clientX);
    if (mode === 'in') {
      onSetInPointAtTime(nextTime);
    } else {
      onSetOutPointAtTime(nextTime);
    }
  }, [onClientXToTime, onRulerScrubToClientX, onSetInPointAtTime, onSetOutPointAtTime, rulerRef]);

  const endPointerDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }
    const captureTarget = rulerRef.current;
    if (captureTarget?.hasPointerCapture(event.pointerId)) {
      captureTarget.releasePointerCapture(event.pointerId);
    }
    pointerIdRef.current = null;
    dragModeRef.current = null;
  }, [rulerRef]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const activePointerId = pointerIdRef.current;
    const activeMode = dragModeRef.current;
    if (activePointerId === event.pointerId && activeMode) {
      if (activeMode === 'scrub') {
        onRulerScrubToClientX(event.clientX);
        return;
      }
      const nextTime = onClientXToTime(event.clientX);
      if (activeMode === 'in') {
        onSetInPointAtTime(nextTime);
      } else {
        onSetOutPointAtTime(nextTime);
      }
      return;
    }
    onRulerHoverClientX(event.clientX);
  }, [onClientXToTime, onRulerHoverClientX, onRulerScrubToClientX, onSetInPointAtTime, onSetOutPointAtTime]);

  const ariaValueText = `${formatTimelineDisplay(currentTime, timeDisplayMode, timelineFps)}. ${isPlaying ? 'Playing' : 'Paused'}. ${allMarkers.length} markers.`;

  return (
    <Box
      ref={rulerRef}
      role="slider"
      tabIndex={0}
      aria-label="Timeline ruler"
      aria-valuemin={0}
      aria-valuemax={totalDuration}
      aria-valuenow={currentTime}
      aria-valuetext={ariaValueText}
      sx={{ height: RULER_HEIGHT, borderBottom: 1, borderColor: 'divider', position: 'relative', cursor: 'ew-resize' }}
      onPointerDown={(event) => beginPointerDrag(event, 'scrub')}
      onDoubleClick={onRulerDoubleClick}
      onKeyDown={onRulerKeyDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      onMouseLeave={onRulerMouseLeave}
    >
      <Box sx={{ position: 'absolute', inset: 0 }}>
        <TimelineRulerStaticLayer
          visibleGridLines={visibleGridLines}
          visibleTickLabels={visibleTickLabels}
          markerClusters={markerClusters}
          inPoint={inPoint}
          outPoint={outPoint}
          timeDisplayMode={timeDisplayMode}
          timelineFps={timelineFps}
          timeToPixels={timeToPixels}
          onJumpToMarker={onJumpToMarker}
          onBeginPointerDrag={beginPointerDrag}
        />
        <TimelineRulerLiveLayer
          currentTime={currentTime}
          isPlaying={isPlaying}
          hoverGuideX={hoverGuideX}
          hoverTime={hoverTime}
          snapGuideVisible={snapGuideVisible}
          snapGuideX={snapGuideX}
          snapGuideLabel={snapGuideLabel}
          timeDisplayMode={timeDisplayMode}
          timelineFps={timelineFps}
          timeToPixels={timeToPixels}
        />
      </Box>
    </Box>
  );
});

interface TrackHeadersProps {
  tracks: Track[];
  trackHeightScale: number;
  trackOffsetMap: Record<string, { top: number; height: number }>;
  visibleTrackIdSet: Set<string>;
  scrollTop: number;
  totalTrackHeight: number;
  trackStates: Record<string, TrackState>;
  selectedTrackId: string | null;
  trackNameDrafts: Record<string, string>;
  reviewerMode: boolean;
  onTrackRename?: (trackId: string, name: string) => void;
  onTrackTypeChange?: (trackId: string, type: TrackState['type']) => void;
  onTrackAudioRoleChange?: (trackId: string, role: AudioTrackRole) => void;
  onTrackToggle?: (trackId: string, changes: Partial<TrackState>) => void;
  onSelectTrack: (trackId: string) => void;
  onTrackNameFocus: (trackId: string) => void;
  onTrackNameChange: (trackId: string, value: string) => void;
  onTrackNameCommit: (trackId: string, revertToOriginal?: boolean) => void;
}

interface TrackHeaderRowProps {
  track: Track;
  height: number;
  state: TrackState;
  isTrackSelected: boolean;
  trackNameValue: string;
  reviewerMode: boolean;
  canRename: boolean;
  canTypeChange: boolean;
  canAudioRoleChange: boolean;
  canToggle: boolean;
  onSelectTrack: (trackId: string) => void;
  onNavigateTrack: (trackId: string, offset: -1 | 1) => void;
  onTrackNameFocus: (trackId: string) => void;
  onTrackNameChange: (trackId: string, value: string) => void;
  onTrackNameCommit: (trackId: string, revertToOriginal?: boolean) => void;
  onTrackTypeChange?: (trackId: string, type: TrackState['type']) => void;
  onTrackAudioRoleChange?: (trackId: string, role: AudioTrackRole) => void;
  onToggleTrackState?: (trackId: string, changes: Partial<TrackState>) => void;
  onCycleTrackColor: (trackId: string, currentColor?: string) => void;
  onCycleAutomationMode: (trackId: string, currentMode?: TrackAutomationMode) => void;
  onOpenTrackMenu: (event: React.MouseEvent<HTMLElement>, trackId: string) => void;
  registerRowRef: (trackId: string, node: HTMLDivElement | null) => void;
}

const TrackHeaderRow = React.memo(function TrackHeaderRow({
  track,
  height,
  state,
  isTrackSelected,
  trackNameValue,
  reviewerMode,
  canRename,
  canTypeChange,
  canAudioRoleChange,
  canToggle,
  onSelectTrack,
  onNavigateTrack,
  onTrackNameFocus,
  onTrackNameChange,
  onTrackNameCommit,
  onTrackTypeChange,
  onTrackAudioRoleChange,
  onToggleTrackState,
  onCycleTrackColor,
  onCycleAutomationMode,
  onOpenTrackMenu,
  registerRowRef,
}: TrackHeaderRowProps) {
  const headerType: NonNullable<TrackState['type']> =
    state.type ?? (track.type === 'audio' ? 'audio' : 'video');
  const audioRole: AudioTrackRole = state.audioRole ?? 'dialogue';
  const automationMode: TrackAutomationMode = state.automationMode ?? 'read';
  const trackColor = state.color || '#90caf9';
  const trackLocked = Boolean(state.locked);
  const isCompact = height < 54;
  const stopBubble = useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation();
  }, []);

  return (
    <Box
      ref={(node) => registerRowRef(track.id, node as HTMLDivElement | null)}
      tabIndex={0}
      role="row"
      aria-label={`Track ${track.name}`}
      data-testid={`timeline-track-header-${track.id}`}
      onClick={() => onSelectTrack(track.id)}
      onContextMenu={(event) => onOpenTrackMenu(event, track.id)}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) {
          return;
        }
        const key = event.key.toLowerCase();
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelectTrack(track.id);
          return;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onNavigateTrack(track.id, -1);
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          onNavigateTrack(track.id, 1);
          return;
        }
        if (!canToggle || reviewerMode) {
          return;
        }
        if (key === 'l') {
          event.preventDefault();
          onToggleTrackState?.(track.id, { locked: !state.locked });
          return;
        }
        if (key === 'm') {
          event.preventDefault();
          onToggleTrackState?.(track.id, { mute: !state.mute });
          return;
        }
        if (key === 's') {
          event.preventDefault();
          onToggleTrackState?.(track.id, { solo: !state.solo });
          return;
        }
        if (key === 'v') {
          event.preventDefault();
          onToggleTrackState?.(track.id, { visible: !(state.visible !== false) });
          return;
        }
        if (key === 'r' && !trackLocked) {
          event.preventDefault();
          onToggleTrackState?.(track.id, { recordArmed: !state.recordArmed });
          return;
        }
        if (key === 'i' && !trackLocked) {
          event.preventDefault();
          onToggleTrackState?.(track.id, { inputMonitoring: !state.inputMonitoring });
          return;
        }
        if (key === 'a' && !trackLocked) {
          event.preventDefault();
          onCycleAutomationMode(track.id, automationMode);
          return;
        }
        if (key === 'c' && !trackLocked) {
          event.preventDefault();
          onCycleTrackColor(track.id, trackColor);
          return;
        }
      }}
      sx={{
        height,
        display: 'grid',
        gridTemplateColumns: isCompact ? 'minmax(72px, 1fr) auto' : 'minmax(92px, 1fr) 80px minmax(84px, 98px) auto',
        alignItems: 'center',
        px: 0.75,
        gap: 0.5,
        borderBottom: 1,
        borderColor: 'divider',
        borderLeft: '3px solid',
        borderLeftColor: trackColor,
        bgcolor: isTrackSelected ? 'rgba(25,118,210,0.12)' : 'transparent',
        '&:focus-visible': {
          outline: '2px solid rgba(59,130,246,0.95)',
          outlineOffset: -1,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 0.5 }}>
        <Tooltip title="Cycle track color">
          <IconButton
            size="small"
            aria-label={`Change color for ${track.name}`}
            onClick={(event) => {
              stopBubble(event);
              if (!trackLocked && !reviewerMode) {
                onCycleTrackColor(track.id, trackColor);
              }
            }}
            onMouseDown={stopBubble}
            disabled={reviewerMode || !canToggle || trackLocked}
            sx={{ p: 0.25 }}
          >
            <Box
              sx={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.35)',
                bgcolor: trackColor,
              }}
            />
          </IconButton>
        </Tooltip>
        <TextField
          variant="standard"
          size="small"
          value={trackNameValue}
          disabled={!canRename || reviewerMode || trackLocked}
          onFocus={() => onTrackNameFocus(track.id)}
          onClick={stopBubble}
          onMouseDown={stopBubble}
          onChange={(event) => {
            onTrackNameChange(track.id, event.target.value);
          }}
          onBlur={() => onTrackNameCommit(track.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onTrackNameCommit(track.id);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onTrackNameCommit(track.id, true);
            }
          }}
          inputProps={{
            style: { fontSize: 12, padding: 0 },
            'aria-label': `Track name for ${track.name}`,
          }}
          sx={{ flex: 1, minWidth: 0 }}
        />
      </Box>

      {!isCompact && (
        <Select
          variant="standard"
          size="small"
          value={headerType}
          disabled={!canTypeChange || reviewerMode || trackLocked}
          onClick={stopBubble}
          onMouseDown={stopBubble}
          onChange={(event) => onTrackTypeChange?.(track.id, event.target.value as TrackState['type'])}
          displayEmpty
          inputProps={{ 'aria-label': `Track type for ${track.name}` }}
          sx={{ fontSize: 12, minWidth: 70 }}
        >
          <MenuItem value="video">Video</MenuItem>
          <MenuItem value="audio">Audio</MenuItem>
          <MenuItem value="adjustment">Adj</MenuItem>
          <MenuItem value="subtitle">Sub</MenuItem>
          <MenuItem value="graphics">GFX</MenuItem>
        </Select>
      )}

      {!isCompact && (
        headerType === 'audio' ? (
          <Select
            variant="standard"
            size="small"
            value={audioRole}
            disabled={!canAudioRoleChange || reviewerMode || trackLocked}
            onClick={stopBubble}
            onMouseDown={stopBubble}
            onChange={(event) => onTrackAudioRoleChange?.(track.id, event.target.value as AudioTrackRole)}
            displayEmpty
            data-testid={`timeline-track-role-${track.id}`}
            inputProps={{ 'aria-label': `Audio role for ${track.name}` }}
            sx={{ fontSize: 11, minWidth: 84 }}
          >
            {AUDIO_TRACK_ROLE_OPTIONS.map((role) => (
              <MenuItem key={`${track.id}-role-${role.value}`} value={role.value}>
                {role.label}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <Box sx={{ minWidth: 84 }} />
        )
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
        <Tooltip title={trackLocked ? 'Unlock track (L)' : 'Lock track (L)'}>
          <span>
            <IconButton
              size="small"
              aria-label={`${trackLocked ? 'Unlock' : 'Lock'} track ${track.name}`}
              aria-pressed={trackLocked}
              onClick={(event) => {
                stopBubble(event);
                onToggleTrackState?.(track.id, { locked: !trackLocked });
              }}
              onMouseDown={stopBubble}
            disabled={!canToggle || reviewerMode}
              sx={{ color: trackLocked ? 'warning.main' : 'text.secondary' }}
            >
              {trackLocked ? <LockIcon fontSize="inherit" /> : <LockOpenIcon fontSize="inherit" />}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={state.mute ? 'Unmute track (M)' : 'Mute track (M)'}>
          <span>
            <IconButton
              size="small"
              aria-label={`${state.mute ? 'Unmute' : 'Mute'} track ${track.name}`}
              aria-pressed={Boolean(state.mute)}
              onClick={(event) => {
                stopBubble(event);
                onToggleTrackState?.(track.id, { mute: !state.mute });
              }}
              onMouseDown={stopBubble}
              disabled={!canToggle || reviewerMode}
              sx={{ color: state.mute ? 'warning.main' : 'text.secondary' }}
            >
              {state.mute ? <VolumeOffIcon fontSize="inherit" /> : <VolumeUpIcon fontSize="inherit" />}
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={state.solo ? 'Disable solo (S)' : 'Solo track (S)'}>
          <span>
            <IconButton
              size="small"
              aria-label={`${state.solo ? 'Disable solo on' : 'Solo'} track ${track.name}`}
              aria-pressed={Boolean(state.solo)}
              onClick={(event) => {
                stopBubble(event);
                onToggleTrackState?.(track.id, { solo: !state.solo });
              }}
              onMouseDown={stopBubble}
              disabled={!canToggle || reviewerMode}
              sx={{ color: state.solo ? 'warning.main' : 'text.secondary' }}
            >
              <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 700 }}>
                S
              </Typography>
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={state.visible === false ? 'Show track (V)' : 'Hide track (V)'}>
          <span>
            <IconButton
              size="small"
              aria-label={`${state.visible === false ? 'Show' : 'Hide'} track ${track.name}`}
              aria-pressed={state.visible !== false}
              onClick={(event) => {
                stopBubble(event);
                onToggleTrackState?.(track.id, { visible: !(state.visible !== false) });
              }}
              onMouseDown={stopBubble}
              disabled={!canToggle || reviewerMode}
              sx={{ color: state.visible === false ? 'text.disabled' : 'text.secondary' }}
            >
              {state.visible === false ? <VisibilityOffIcon fontSize="inherit" /> : <VisibilityIcon fontSize="inherit" />}
            </IconButton>
          </span>
        </Tooltip>

        {!isCompact && (
          <Tooltip title={state.recordArmed ? 'Disarm track (R)' : 'Record arm track (R)'}>
            <span>
              <IconButton
                size="small"
                aria-label={`${state.recordArmed ? 'Disarm' : 'Arm'} record on track ${track.name}`}
                aria-pressed={Boolean(state.recordArmed)}
                onClick={(event) => {
                  stopBubble(event);
                  if (!trackLocked) {
                    onToggleTrackState?.(track.id, { recordArmed: !state.recordArmed });
                  }
                }}
                onMouseDown={stopBubble}
                disabled={!canToggle || reviewerMode || trackLocked}
                sx={{ color: state.recordArmed ? 'error.main' : 'text.secondary' }}
              >
                <FiberManualRecord fontSize="inherit" />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {!isCompact && (
          <Tooltip title={state.inputMonitoring ? 'Disable input monitor (I)' : 'Enable input monitor (I)'}>
            <span>
              <IconButton
                size="small"
                aria-label={`${state.inputMonitoring ? 'Disable' : 'Enable'} input monitor for ${track.name}`}
                aria-pressed={Boolean(state.inputMonitoring)}
                onClick={(event) => {
                  stopBubble(event);
                  if (!trackLocked) {
                    onToggleTrackState?.(track.id, { inputMonitoring: !state.inputMonitoring });
                  }
                }}
                onMouseDown={stopBubble}
                disabled={!canToggle || reviewerMode || trackLocked}
                sx={{ color: state.inputMonitoring ? 'success.main' : 'text.secondary' }}
              >
                <GraphicEqIcon fontSize="inherit" />
              </IconButton>
            </span>
          </Tooltip>
        )}

        {!isCompact && (
          <Tooltip title={`${TRACK_AUTOMATION_MODE_OPTIONS.find((option) => option.value === automationMode)?.label || 'Automation'} (A)`}>
            <span>
              <Button
                size="small"
                aria-label={`Cycle automation mode for ${track.name}`}
                onClick={(event) => {
                  stopBubble(event);
                  if (!trackLocked) {
                    onCycleAutomationMode(track.id, automationMode);
                  }
                }}
                onMouseDown={stopBubble}
                disabled={!canToggle || reviewerMode || trackLocked}
                variant="outlined"
                sx={{ minWidth: 44, height: 22, px: 0.75, fontSize: 10, textTransform: 'none' }}
              >
                {TRACK_AUTOMATION_MODE_OPTIONS.find((option) => option.value === automationMode)?.short || 'Read'}
              </Button>
            </span>
          </Tooltip>
        )}

        <Tooltip title="Track options">
          <IconButton
            size="small"
            aria-label={`Track options for ${track.name}`}
            onClick={(event) => onOpenTrackMenu(event, track.id)}
            onMouseDown={stopBubble}
          >
            <MoreHorizIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
});

const TrackHeaders = React.memo(function TrackHeaders({
  tracks,
  trackHeightScale,
  trackOffsetMap,
  visibleTrackIdSet,
  scrollTop,
  totalTrackHeight,
  trackStates,
  selectedTrackId,
  trackNameDrafts,
  reviewerMode,
  onTrackRename,
  onTrackTypeChange,
  onTrackAudioRoleChange,
  onTrackToggle,
  onSelectTrack,
  onTrackNameFocus,
  onTrackNameChange,
  onTrackNameCommit,
}: TrackHeadersProps) {
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [trackMenuState, setTrackMenuState] = useState<{ anchorEl: HTMLElement | null; trackId: string | null }>({
    anchorEl: null,
    trackId: null,
  });

  const setRowRef = useCallback((trackId: string, node: HTMLDivElement | null) => {
    rowRefs.current[trackId] = node;
  }, []);

  const focusTrackRow = useCallback((trackId: string) => {
    rowRefs.current[trackId]?.focus();
  }, []);

  const onNavigateTrack = useCallback((trackId: string, offset: -1 | 1) => {
    const currentIndex = tracks.findIndex((track) => track.id === trackId);
    if (currentIndex < 0) {
      return;
    }
    const nextIndex = clampNumber(currentIndex + offset, 0, Math.max(0, tracks.length - 1));
    const nextTrack = tracks[nextIndex];
    if (!nextTrack) {
      return;
    }
    onSelectTrack(nextTrack.id);
    focusTrackRow(nextTrack.id);
  }, [focusTrackRow, onSelectTrack, tracks]);

  const onCycleTrackColor = useCallback((trackId: string, currentColor?: string) => {
    if (!onTrackToggle) {
      return;
    }
    const currentIndex = TRACK_COLOR_PRESETS.findIndex((color) => color === currentColor);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % TRACK_COLOR_PRESETS.length;
    onTrackToggle(trackId, { color: TRACK_COLOR_PRESETS[nextIndex] });
  }, [onTrackToggle]);

  const onCycleAutomationMode = useCallback((trackId: string, currentMode?: TrackAutomationMode) => {
    if (!onTrackToggle) {
      return;
    }
    const currentIndex = TRACK_AUTOMATION_MODE_OPTIONS.findIndex((option) => option.value === currentMode);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % TRACK_AUTOMATION_MODE_OPTIONS.length;
    onTrackToggle(trackId, { automationMode: TRACK_AUTOMATION_MODE_OPTIONS[nextIndex].value });
  }, [onTrackToggle]);

  const openTrackMenu = useCallback((event: React.MouseEvent<HTMLElement>, trackId: string) => {
    event.preventDefault();
    event.stopPropagation();
    setTrackMenuState({
      anchorEl: event.currentTarget,
      trackId,
    });
    onSelectTrack(trackId);
  }, [onSelectTrack]);

  const closeTrackMenu = useCallback(() => {
    setTrackMenuState({
      anchorEl: null,
      trackId: null,
    });
  }, []);

  const menuTrack = useMemo(
    () => tracks.find((track) => track.id === trackMenuState.trackId) || null,
    [trackMenuState.trackId, tracks]
  );
  const menuState = menuTrack ? (trackStates[menuTrack.id] ?? EMPTY_TRACK_STATE) : null;
  const menuHeaderType: NonNullable<TrackState['type']> = menuTrack
    ? (menuState?.type ?? (menuTrack.type === 'audio' ? 'audio' : 'video'))
    : 'video';
  const menuAudioRole: AudioTrackRole = menuState?.audioRole ?? 'dialogue';
  const menuAutomationMode: TrackAutomationMode = menuState?.automationMode ?? 'read';

  const handleTrackMenuToggle = useCallback((changes: Partial<TrackState>) => {
    if (!menuTrack || !onTrackToggle) {
      return;
    }
    onTrackToggle(menuTrack.id, changes);
  }, [menuTrack, onTrackToggle]);

  const visibleTracks = useMemo(
    () => tracks.filter((track) => visibleTrackIdSet.has(track.id)),
    [tracks, visibleTrackIdSet]
  );

  return (
    <Box sx={{ width: HEADER_WIDTH, borderRight: 1, borderColor: 'divider', overflow: 'hidden', position: 'relative' }}>
      <Box sx={{ position: 'relative', height: totalTrackHeight, transform: `translateY(-${scrollTop}px)` }}>
        {visibleTracks.map((track) => {
          const off = trackOffsetMap[track.id];
          const height = off?.height ?? Math.max(24, Math.round(track.height * trackHeightScale));
          const top = off?.top ?? 0;
          const state = trackStates[track.id] ?? EMPTY_TRACK_STATE;
          return (
            <Box key={track.id} sx={{ position: 'absolute', left: 0, right: 0, top, height }}>
              <TrackHeaderRow
                track={track}
                height={height}
                state={state}
                isTrackSelected={selectedTrackId === track.id}
                trackNameValue={trackNameDrafts[track.id] ?? track.name}
                reviewerMode={reviewerMode}
                canRename={Boolean(onTrackRename)}
                canTypeChange={Boolean(onTrackTypeChange)}
                canAudioRoleChange={Boolean(onTrackAudioRoleChange)}
                canToggle={Boolean(onTrackToggle)}
                onSelectTrack={onSelectTrack}
                onNavigateTrack={onNavigateTrack}
                onTrackNameFocus={onTrackNameFocus}
                onTrackNameChange={onTrackNameChange}
                onTrackNameCommit={onTrackNameCommit}
                onTrackTypeChange={onTrackTypeChange}
                onTrackAudioRoleChange={onTrackAudioRoleChange}
                onToggleTrackState={onTrackToggle}
                onCycleTrackColor={onCycleTrackColor}
                onCycleAutomationMode={onCycleAutomationMode}
                onOpenTrackMenu={openTrackMenu}
                registerRowRef={setRowRef}
              />
            </Box>
          );
        })}
      </Box>

      <Menu
        open={Boolean(trackMenuState.anchorEl && menuTrack)}
        anchorEl={trackMenuState.anchorEl}
        onClose={closeTrackMenu}
      >
        {menuTrack && (
          <>
            <MenuItem
              onClick={() => {
                onSelectTrack(menuTrack.id);
                focusTrackRow(menuTrack.id);
                closeTrackMenu();
              }}
            >
              Select Track
            </MenuItem>
            <MenuItem
              disabled={!onTrackRename || reviewerMode || Boolean(menuState?.locked)}
              onClick={() => {
                onTrackNameFocus(menuTrack.id);
                focusTrackRow(menuTrack.id);
                closeTrackMenu();
              }}
            >
              Rename Track
            </MenuItem>
            <Divider />
            <MenuItem
              disabled={!onTrackToggle || reviewerMode}
              onClick={() => {
                handleTrackMenuToggle({ locked: !menuState?.locked });
                closeTrackMenu();
              }}
            >
              {menuState?.locked ? 'Unlock Track' : 'Lock Track'}
            </MenuItem>
            <MenuItem
              disabled={!onTrackToggle || reviewerMode}
              onClick={() => {
                handleTrackMenuToggle({ mute: !menuState?.mute });
                closeTrackMenu();
              }}
            >
              {menuState?.mute ? 'Unmute Track' : 'Mute Track'}
            </MenuItem>
            <MenuItem
              disabled={!onTrackToggle || reviewerMode}
              onClick={() => {
                handleTrackMenuToggle({ solo: !menuState?.solo });
                closeTrackMenu();
              }}
            >
              {menuState?.solo ? 'Disable Solo' : 'Solo Track'}
            </MenuItem>
            <MenuItem
              disabled={!onTrackToggle || reviewerMode}
              onClick={() => {
                handleTrackMenuToggle({ visible: !(menuState?.visible !== false) });
                closeTrackMenu();
              }}
            >
              {menuState?.visible === false ? 'Show Track' : 'Hide Track'}
            </MenuItem>
            <Divider />
            <MenuItem
              disabled={!onTrackToggle || reviewerMode || Boolean(menuState?.locked)}
              onClick={() => {
                handleTrackMenuToggle({ recordArmed: !menuState?.recordArmed });
                closeTrackMenu();
              }}
            >
              {menuState?.recordArmed ? 'Disarm Record' : 'Arm Record'}
            </MenuItem>
            <MenuItem
              disabled={!onTrackToggle || reviewerMode || Boolean(menuState?.locked)}
              onClick={() => {
                handleTrackMenuToggle({ inputMonitoring: !menuState?.inputMonitoring });
                closeTrackMenu();
              }}
            >
              {menuState?.inputMonitoring ? 'Disable Input Monitor' : 'Enable Input Monitor'}
            </MenuItem>
            <MenuItem
              disabled={!onTrackToggle || reviewerMode || Boolean(menuState?.locked)}
              onClick={() => {
                onCycleAutomationMode(menuTrack.id, menuAutomationMode);
                closeTrackMenu();
              }}
            >
              Cycle Automation ({TRACK_AUTOMATION_MODE_OPTIONS.find((option) => option.value === menuAutomationMode)?.short || 'Read'})
            </MenuItem>
            <MenuItem
              disabled={!onTrackToggle || reviewerMode || Boolean(menuState?.locked)}
              onClick={() => {
                onCycleTrackColor(menuTrack.id, menuState?.color);
                closeTrackMenu();
              }}
            >
              Cycle Track Color
            </MenuItem>
            <Divider />
            <MenuItem disabled={!onTrackTypeChange || reviewerMode || Boolean(menuState?.locked)} onClick={() => {
              onTrackTypeChange?.(menuTrack.id, 'video');
              closeTrackMenu();
            }}>
              Set Type: Video
            </MenuItem>
            <MenuItem disabled={!onTrackTypeChange || reviewerMode || Boolean(menuState?.locked)} onClick={() => {
              onTrackTypeChange?.(menuTrack.id, 'audio');
              closeTrackMenu();
            }}>
              Set Type: Audio
            </MenuItem>
            <MenuItem disabled={!onTrackTypeChange || reviewerMode || Boolean(menuState?.locked)} onClick={() => {
              onTrackTypeChange?.(menuTrack.id, 'adjustment');
              closeTrackMenu();
            }}>
              Set Type: Adjustment
            </MenuItem>
            <MenuItem disabled={!onTrackTypeChange || reviewerMode || Boolean(menuState?.locked)} onClick={() => {
              onTrackTypeChange?.(menuTrack.id, 'subtitle');
              closeTrackMenu();
            }}>
              Set Type: Subtitle
            </MenuItem>
            <MenuItem disabled={!onTrackTypeChange || reviewerMode || Boolean(menuState?.locked)} onClick={() => {
              onTrackTypeChange?.(menuTrack.id, 'graphics');
              closeTrackMenu();
            }}>
              Set Type: Graphics
            </MenuItem>
            {menuHeaderType === 'audio' && (
              <>
                <Divider />
                {AUDIO_TRACK_ROLE_OPTIONS.map((role) => (
                  <MenuItem
                    key={`menu-role-${menuTrack.id}-${role.value}`}
                    disabled={!onTrackAudioRoleChange || reviewerMode || Boolean(menuState?.locked)}
                    selected={menuAudioRole === role.value}
                    onClick={() => {
                      onTrackAudioRoleChange?.(menuTrack.id, role.value);
                      closeTrackMenu();
                    }}
                  >
                    Role: {role.label}
                  </MenuItem>
                ))}
              </>
            )}
          </>
        )}
      </Menu>
    </Box>
  );
});

interface TimelineCanvasProps {
  timelineRef: React.RefObject<HTMLDivElement>;
  panState: PanState | null;
  marqueeState: MarqueeSelectionState | null;
  isSpaceHandActive: boolean;
  onWheel: (e: React.WheelEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClick: (e: React.MouseEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: (event: React.DragEvent) => void;
  children: React.ReactNode;
}

const TimelineCanvas = React.memo(function TimelineCanvas({
  timelineRef,
  panState,
  marqueeState,
  isSpaceHandActive,
  onWheel,
  onKeyDown,
  onMouseDown,
  onMouseMove,
  onMouseLeave,
  onPointerDown,
  onPointerMove,
  onPointerLeave,
  onClick,
  onDragLeave,
  onDragOver,
  onDrop,
  children,
}: TimelineCanvasProps) {
  return (
    <Box
      data-testid="professional-timeline-scroll-area"
      sx={{
        flex: 1,
        position: 'relative',
        overflow: 'auto',
        outline: 'none',
        cursor: panState ? 'grabbing' : isSpaceHandActive ? 'grab' : marqueeState ? 'crosshair' : 'default',
        '&:focus-visible': {
          boxShadow: 'inset 0 0 0 2px rgba(59, 130, 246, 0.9)',
        },
      }}
      ref={timelineRef}
      role="region"
      tabIndex={0}
      aria-label="Professional timeline editor"
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
    </Box>
  );
});

interface ClipItemProps {
  clip: BeatClip;
  renderTrackId: string;
  renderStart: number;
  renderDuration: number;
  leftPx: number;
  widthPx: number;
  off: { top: number; height: number };
  selected: boolean;
  trackHidden: boolean;
  collabLock?: { user?: string };
  clipVisual: ClipVisualMetadata;
  clipMeta: ClipMetadata;
  tagChips: string[];
  clipIsReadOnly: boolean;
  clipInActiveRange: boolean;
  showResizeHandles: boolean;
  beginDrag: (e: React.MouseEvent, clipId: string, mode?: DragMode) => void;
  onClipSelect: (clipId: string, multiSelect?: boolean) => void;
  onSetSelectedTrackId: (trackId: string) => void;
  onSetPlayheadTime: (timeSeconds: number) => void;
  openContextMenu: (e: React.MouseEvent<HTMLElement>, clipId: string) => void;
}

function areClipItemPropsEqual(previous: ClipItemProps, next: ClipItemProps): boolean {
  return previous.clip === next.clip &&
    previous.renderTrackId === next.renderTrackId &&
    previous.renderStart === next.renderStart &&
    previous.renderDuration === next.renderDuration &&
    previous.leftPx === next.leftPx &&
    previous.widthPx === next.widthPx &&
    previous.off === next.off &&
    previous.selected === next.selected &&
    previous.trackHidden === next.trackHidden &&
    previous.collabLock === next.collabLock &&
    previous.clipVisual === next.clipVisual &&
    previous.clipMeta === next.clipMeta &&
    previous.tagChips === next.tagChips &&
    previous.clipIsReadOnly === next.clipIsReadOnly &&
    previous.clipInActiveRange === next.clipInActiveRange &&
    previous.showResizeHandles === next.showResizeHandles &&
    previous.beginDrag === next.beginDrag &&
    previous.onClipSelect === next.onClipSelect &&
    previous.onSetSelectedTrackId === next.onSetSelectedTrackId &&
    previous.onSetPlayheadTime === next.onSetPlayheadTime &&
    previous.openContextMenu === next.openContextMenu;
}

const ClipItem = React.memo(function ClipItem({
  clip,
  renderTrackId,
  renderStart,
  renderDuration,
  leftPx,
  widthPx,
  off,
  selected,
  trackHidden,
  collabLock,
  clipVisual,
  clipMeta,
  tagChips,
  clipIsReadOnly,
  clipInActiveRange,
  showResizeHandles,
  beginDrag,
  onClipSelect,
  onSetSelectedTrackId,
  onSetPlayheadTime,
  openContextMenu,
}: ClipItemProps) {
  const showMetadataChips = selected || widthPx >= CLIP_METADATA_VISIBILITY_MIN_WIDTH_PX;
  const showTagChips = selected || widthPx >= CLIP_TAGS_VISIBILITY_MIN_WIDTH_PX;
  const clipAriaLabel = `${clip.name}. Start ${renderStart.toFixed(2)} seconds. Duration ${renderDuration.toFixed(2)} seconds.`;
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={clipAriaLabel}
      data-testid={`timeline-clip-${clip.id}`}
      data-clip-id={clip.id}
      data-track-id={renderTrackId}
      data-start={ENABLE_TIMELINE_DEBUG_DATA_ATTRS ? renderStart : undefined}
      data-duration={ENABLE_TIMELINE_DEBUG_DATA_ATTRS ? renderDuration : undefined}
      data-in-point={ENABLE_TIMELINE_DEBUG_DATA_ATTRS ? clip.metadata?.inPoint : undefined}
      data-out-point={ENABLE_TIMELINE_DEBUG_DATA_ATTRS ? clip.metadata?.outPoint : undefined}
      onMouseDown={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const xWithin = e.clientX - rect.left;
        if (clipIsReadOnly) return;
        if (showResizeHandles && xWithin < RESIZE_EDGE_THRESHOLD_PX) return beginDrag(e, clip.id, 'resize-left');
        if (showResizeHandles && xWithin > rect.width - RESIZE_EDGE_THRESHOLD_PX) return beginDrag(e, clip.id, 'resize-right');
        beginDrag(e, clip.id, 'move');
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClipSelect(clip.id, e.shiftKey || e.ctrlKey || e.metaKey);
          onSetSelectedTrackId(renderTrackId);
          onSetPlayheadTime(renderStart);
        }
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onClipSelect(clip.id);
        onSetSelectedTrackId(renderTrackId);
        onSetPlayheadTime(renderStart);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClipSelect(clip.id, e.metaKey || e.ctrlKey || e.shiftKey);
        onSetSelectedTrackId(renderTrackId);
      }}
      onContextMenu={(e) => openContextMenu(e, clip.id)}
      sx={{
        position: 'absolute',
        left: leftPx,
        top: off.top + 2,
        width: widthPx,
        minWidth: 4,
        height: Math.max(20, off.height - 4),
        bgcolor: selected ? 'primary.main' : clip.color || 'grey.500',
        opacity: trackHidden ? 0.3 : clipInActiveRange ? 1 : 0.45,
        color: 'white',
        borderRadius: 0.5,
        boxShadow: selected ? 2 : 0,
        cursor: clipIsReadOnly ? 'not-allowed' : 'grab',
        transition: 'box-shadow 120ms ease, opacity 120ms ease, transform 120ms ease',
        border: selected ? '1px solid rgba(255,255,255,0.65)' : '1px solid rgba(255,255,255,0.25)',
        '&:focus-visible': {
          outline: '2px solid rgba(59, 130, 246, 0.95)',
          outlineOffset: 1,
        },
        '&:hover': {
          transform: clipIsReadOnly ? 'none' : 'translateY(-1px)',
          boxShadow: clipIsReadOnly ? 0 : 2,
        },
      }}
    >
      {showResizeHandles && (
        <Box
          data-testid={`timeline-clip-left-handle-${clip.id}`}
          aria-label={`Resize start of ${clip.name}`}
          onMouseDown={(e) => beginDrag(e, clip.id, 'resize-left')}
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: RESIZE_HANDLE_WIDTH_PX,
            height: '100%',
            cursor: 'ew-resize',
            zIndex: 2,
          }}
        />
      )}
      {showResizeHandles && (
        <Box
          data-testid={`timeline-clip-right-handle-${clip.id}`}
          aria-label={`Resize end of ${clip.name}`}
          onMouseDown={(e) => beginDrag(e, clip.id, 'resize-right')}
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: RESIZE_HANDLE_WIDTH_PX,
            height: '100%',
            cursor: 'ew-resize',
            zIndex: 2,
          }}
        />
      )}
      <Box sx={{ px: 0.5, py: 0.25, display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: '100%', overflow: 'hidden' }}>
        <Typography
          variant="caption"
          sx={{ fontWeight: 600, textShadow: '0 1px 1px rgba(0,0,0,0.4)', maxWidth: widthPx < 80 ? 36 : 120 }}
          noWrap
        >
          {clip.name}
        </Typography>
        {showMetadataChips && clipVisual.isEnhanced && clipVisual.originalName && (
          <Tooltip title={`Enhanced from: ${clipVisual.originalName}`}>
            <Chip
              size="small"
              label="ENH"
              sx={{
                height: 16,
                fontSize: 10,
                bgcolor: 'rgba(22, 163, 74, 0.8)',
                color: '#fff',
                fontWeight: 600,
              }}
            />
          </Tooltip>
        )}
        {showMetadataChips && clipMeta.camera && (
          <Chip
            size="small"
            label={clipMeta.camera}
            sx={{
              height: 16,
              fontSize: 10,
              bgcolor: 'rgba(59, 130, 246, 0.8)',
              color: '#fff',
              fontWeight: 600,
            }}
          />
        )}
        {showMetadataChips && !!clipMeta.shotName && (
          <Chip size="small" label={clipMeta.shotName} sx={{ height: 16, fontSize: 10, bgcolor: 'rgba(0,0,0,0.25)', color: '#fff' }} />
        )}
        {showMetadataChips && typeof clipVisual.syncConfidence === 'number' && (
          <Tooltip title={`Sync confidence: ${(clipVisual.syncConfidence * 100).toFixed(0)}%`}>
            <Chip
              size="small"
              label={`Sync ${(clipVisual.syncConfidence * 100).toFixed(0)}%`}
              sx={{
                height: 16,
                fontSize: 10,
                bgcolor: clipVisual.syncConfidence > 0.8
                  ? 'rgba(76, 175, 80, 0.8)'
                  : clipVisual.syncConfidence > 0.6
                    ? 'rgba(255, 152, 0, 0.8)'
                    : 'rgba(244, 67, 54, 0.8)',
                color: '#fff',
                fontWeight: 600,
              }}
            />
          </Tooltip>
        )}
        {(showTagChips ? tagChips : EMPTY_TAG_CHIPS).map((tag) => (
          <Chip key={tag} size="small" label={tag} sx={{ height: 16, fontSize: 10, bgcolor: 'rgba(0,0,0,0.2)', color: '#fff' }} />
        ))}
        {collabLock && (
          <Tooltip title={`Locked by ${collabLock.user || 'someone'}`}>
            <Chip size="small" label="LOCK" color="warning" sx={{ height: 16, fontSize: 10 }} />
          </Tooltip>
        )}
      </Box>
      {showResizeHandles && (
        <>
          <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, bgcolor: 'rgba(255,255,255,0.35)' }} />
          <Box sx={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, bgcolor: 'rgba(255,255,255,0.35)' }} />
        </>
      )}
    </Box>
  );
}, areClipItemPropsEqual);

interface TimelineClipLayerProps {
  visibleClips: BeatClip[];
  selectedClips: Set<string>;
  dragPreviewStore: ExternalStore<DragPreviewState | null>;
  viewportBufferedStartTime: number;
  viewportBufferedEndTime: number;
  visibleTrackIdSet: Set<string>;
  trackOffsetMap: Record<string, { top: number; height: number }>;
  trackStates: Record<string, TrackState>;
  collabLocks: Record<string, { user?: string }>;
  clipPresentationById: Map<string, {
    clipVisual: ClipVisualMetadata;
    clipMeta: ClipMetadata;
    tagChips: string[];
  }>;
  reviewerMode: boolean;
  hasInOutRange: boolean;
  activeRangeStart: number | null;
  activeRangeEnd: number | null;
  timeToPixels: (timeSeconds: number) => number;
  beginDrag: (e: React.MouseEvent, clipId: string, mode?: DragMode) => void;
  onClipSelect: (clipId: string, multiSelect?: boolean) => void;
  onSetSelectedTrackId: (trackId: string) => void;
  onSetPlayheadTime: (timeSeconds: number) => void;
  openContextMenu: (e: React.MouseEvent<HTMLElement>, clipId: string) => void;
}

const TimelineClipLayer = React.memo(function TimelineClipLayer({
  visibleClips,
  selectedClips,
  dragPreviewStore,
  viewportBufferedStartTime,
  viewportBufferedEndTime,
  visibleTrackIdSet,
  trackOffsetMap,
  trackStates,
  collabLocks,
  clipPresentationById,
  reviewerMode,
  hasInOutRange,
  activeRangeStart,
  activeRangeEnd,
  timeToPixels,
  beginDrag,
  onClipSelect,
  onSetSelectedTrackId,
  onSetPlayheadTime,
  openContextMenu,
}: TimelineClipLayerProps) {
  const dragPreview = useExternalStoreSnapshot(dragPreviewStore);
  const visibleClipsInViewport = useMemo(() => {
    const selectedIds = selectedClips;
    const dragClipId = dragPreview?.clipId ?? null;
    return visibleClips.filter((clip) => {
      if (!visibleTrackIdSet.has(clip.trackId) && clip.id !== dragClipId) {
        return false;
      }
      if (selectedIds.has(clip.id) || clip.id === dragClipId) {
        return true;
      }
      const clipStart = clip.start;
      const clipEnd = clip.start + clip.duration;
      return clipEnd >= viewportBufferedStartTime && clipStart <= viewportBufferedEndTime;
    });
  }, [dragPreview?.clipId, selectedClips, viewportBufferedEndTime, viewportBufferedStartTime, visibleClips, visibleTrackIdSet]);

  return (
    <>
      {visibleClipsInViewport.map((clip) => {
        const preview = dragPreview?.clipId === clip.id ? dragPreview : null;
        const renderTrackId = preview?.trackId ?? clip.trackId;
        if (!visibleTrackIdSet.has(renderTrackId)) {
          return null;
        }
        const renderStart = preview?.start ?? clip.start;
        const renderDuration = preview?.duration ?? clip.duration;
        const off = trackOffsetMap[renderTrackId];
        if (!off) return null;
        const selected = selectedClips.has(clip.id);
        const trackState = trackStates[renderTrackId];
        const trackLocked = Boolean(trackState?.locked);
        const trackHidden = trackState?.visible === false;
        const collabLocked = Boolean(collabLocks[clip.id]);
        const clipPresentation = clipPresentationById.get(clip.id);
        const clipVisual = clipPresentation?.clipVisual ?? DEFAULT_CLIP_VISUAL_METADATA;
        const clipMeta = clipPresentation?.clipMeta ?? EMPTY_CLIP_METADATA;
        const tagChips = clipPresentation?.tagChips ?? EMPTY_TAG_CHIPS;
        const clipIsReadOnly = reviewerMode || trackLocked || collabLocked || trackHidden;
        const clipStart = renderStart;
        const clipEnd = renderStart + renderDuration;
        const clipInActiveRange = !hasInOutRange || (activeRangeStart !== null && activeRangeEnd !== null && clipEnd >= activeRangeStart && clipStart <= activeRangeEnd);
        const leftPx = HEADER_WIDTH + timeToPixels(renderStart);
        const widthPx = Math.max(4, timeToPixels(renderDuration));
        const showResizeHandles = !clipIsReadOnly && widthPx >= RESIZE_HANDLE_WIDTH_PX * 1.8;
        return (
          <ClipItem
            key={clip.id}
            clip={clip}
            renderTrackId={renderTrackId}
            renderStart={renderStart}
            renderDuration={renderDuration}
            leftPx={leftPx}
            widthPx={widthPx}
            off={off}
            selected={selected}
            trackHidden={trackHidden}
            collabLock={collabLocks[clip.id]}
            clipVisual={clipVisual}
            clipMeta={clipMeta}
            tagChips={tagChips}
            clipIsReadOnly={clipIsReadOnly}
            clipInActiveRange={clipInActiveRange}
            showResizeHandles={showResizeHandles}
            beginDrag={beginDrag}
            onClipSelect={onClipSelect}
            onSetSelectedTrackId={onSetSelectedTrackId}
            onSetPlayheadTime={onSetPlayheadTime}
            openContextMenu={openContextMenu}
          />
        );
      })}
    </>
  );
});

export default function ProfessionalTimeline({
  clips,
  tracks,
  zoom,
  trackHeightScale = 1,
  currentTime,
  totalDuration,
  isPlaying,
  selectedClips,
  onClipSelect,
  onClipMove,
  onClipResize,
  onTimelineClick,
  onCurrentTimeChange,
  onZoomChange,
  markers = [],
  trackStates = {},
  onTrackToggle,
  onTrackRename,
  onTrackTypeChange,
  onTrackAudioRoleChange,
  transitions = [],
  clipMetadata = {},
  filterTags = [],
  searchQuery = '',
  onContextMenuAction,
  reviewerMode = false,
  collabLocks = {},
  compareClips = [],
  onMediaDrop,
}: ProfessionalTimelineProps) {
  const initialToolbarPreferencesRef = useRef<Partial<TimelineToolbarPreferences>>(loadTimelineToolbarPreferences());
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTrackId, setDropTrackId] = useState<string | null>(null);
  const [snapGuideX, setSnapGuideX] = useState<number | null>(null);
  const [snapGuideLabel, setSnapGuideLabel] = useState<string | null>(null);
  const [snapGuideVisible, setSnapGuideVisible] = useState(false);
  const [marqueeState, setMarqueeState] = useState<MarqueeSelectionState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [isSpaceHandActive, setIsSpaceHandActive] = useState(false);
  const [insertOverwriteMode, setInsertOverwriteMode] = useState<'insert' | 'overwrite'>('overwrite');
  const [dropPreview, setDropPreview] = useState<{ trackId: string; time: number; mode: 'insert' | 'overwrite' } | null>(null);
  const [inPoint, setInPoint] = useState<number | null>(null);
  const [outPoint, setOutPoint] = useState<number | null>(null);
  const [timelineViewportPx, setTimelineViewportPx] = useState<{ start: number; end: number }>({
    start: 0,
    end: 1200,
  });
  const [timelineViewportY, setTimelineViewportY] = useState<{ start: number; end: number }>({
    start: 0,
    end: 900,
  });
  const [ephemeralMarkers, setEphemeralMarkers] = useState<EphemeralMarker[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedClipIdForMenu, setSelectedClipIdForMenu] = useState<string | null>(null);
  const [trackNameDrafts, setTrackNameDrafts] = useState<Record<string, string>>({});
  const [trackNameEditingId, setTrackNameEditingId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(
    () => initialToolbarPreferencesRef.current.workspaceMode ?? 'edit'
  );
  const [toolMode, setToolMode] = useState<TimelineToolMode>(
    () => initialToolbarPreferencesRef.current.toolMode ?? 'select'
  );
  const [safeTrimEnabled, setSafeTrimEnabled] = useState<boolean>(
    () => initialToolbarPreferencesRef.current.safeTrimEnabled ?? true
  );
  const [magneticEnabled, setMagneticEnabled] = useState<boolean>(
    () => initialToolbarPreferencesRef.current.magneticEnabled ?? true
  );
  const [snappingEnabled, setSnappingEnabled] = useState<boolean>(
    () => initialToolbarPreferencesRef.current.snappingEnabled ?? true
  );
  const [rippleEnabled, setRippleEnabled] = useState<boolean>(
    () => initialToolbarPreferencesRef.current.rippleEnabled ?? false
  );
  const [timeDisplayMode, setTimeDisplayMode] = useState<TimeDisplayMode>(
    () => initialToolbarPreferencesRef.current.timeDisplayMode ?? 'timecode'
  );
  const [timelineFps, setTimelineFps] = useState<number>(
    () => initialToolbarPreferencesRef.current.timelineFps ?? 25
  );
  const timelineRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const markerCounterRef = useRef(0);
  const createdObjectUrlsRef = useRef<string[]>([]);
  const objectUrlCleanupTimersRef = useRef<number[]>([]);
  const dragStateRef = useRef<DragState | null>(null);
  const dragPreviewRef = useRef<DragPreviewState | null>(null);
  const dragPreviewStoreRef = useRef<ExternalStore<DragPreviewState | null>>(createExternalStore<DragPreviewState | null>(null));
  const hoverStoreRef = useRef<ExternalStore<HoverState>>(createExternalStore<HoverState>({
    guideX: null,
    time: null,
  }));
  const hoverRafRef = useRef<number | null>(null);
  const hoverPendingClientXRef = useRef<number | null>(null);
  const panInertiaRafRef = useRef<number | null>(null);
  const panVelocityRef = useRef<{
    lastTimestamp: number;
    lastScrollLeft: number;
    lastScrollTop: number;
    vx: number;
    vy: number;
  } | null>(null);
  const dragListenersRef = useRef<{
    move?: (event: MouseEvent) => void;
    up?: (event: MouseEvent) => void;
  }>({});

  // Context menu state
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuClipId, setMenuClipId] = useState<string | null>(null);

  const pixelsPerSecond = useMemo(() => Math.max(5, zoom * 10), [zoom]);
  const frameStepSeconds = useMemo(
    () => 1 / Math.max(1, Math.round(timelineFps)),
    [timelineFps]
  );
  const timeToPixels = useCallback(
    (timeSeconds: number) => timeSeconds * pixelsPerSecond,
    [pixelsPerSecond]
  );
  const pixelsToTime = useCallback(
    (pixels: number) => pixels / pixelsPerSecond,
    [pixelsPerSecond]
  );
  const timelineWidth = useMemo(
    () => Math.max(800, timeToPixels(totalDuration)),
    [timeToPixels, totalDuration]
  );
  useEffect(() => {
    const updateViewport = () => {
      const element = timelineRef.current;
      if (!element) {
        return;
      }
      const nextStart = clampNumber(element.scrollLeft - HEADER_WIDTH, 0, timelineWidth);
      const nextEnd = nextStart + Math.max(0, element.clientWidth);
      const nextTop = clampNumber(element.scrollTop, 0, Math.max(0, element.scrollHeight - element.clientHeight));
      const nextBottom = nextTop + Math.max(0, element.clientHeight);
      setTimelineViewportPx((previous) => {
        if (
          Math.abs(previous.start - nextStart) < 0.5 &&
          Math.abs(previous.end - nextEnd) < 0.5
        ) {
          return previous;
        }
        return { start: nextStart, end: nextEnd };
      });
      setTimelineViewportY((previous) => {
        if (
          Math.abs(previous.start - nextTop) < 0.5 &&
          Math.abs(previous.end - nextBottom) < 0.5
        ) {
          return previous;
        }
        return { start: nextTop, end: nextBottom };
      });
    };

    const element = timelineRef.current;
    if (!element) {
      return;
    }
    let rafId: number | null = null;
    const scheduleViewportUpdate = () => {
      if (rafId !== null) {
        return;
      }
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateViewport();
      });
    };

    updateViewport();
    element.addEventListener('scroll', scheduleViewportUpdate, { passive: true });
    window.addEventListener('resize', scheduleViewportUpdate);
    return () => {
      element.removeEventListener('scroll', scheduleViewportUpdate);
      window.removeEventListener('resize', scheduleViewportUpdate);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [timelineWidth]);
  const normalizedFilterTags = useMemo(
    () => filterTags.map((tag) => tag.toLowerCase().trim()).filter(Boolean),
    [filterTags]
  );
  const normalizedSearchQuery = useMemo(
    () => searchQuery.toLowerCase().trim(),
    [searchQuery]
  );
  const trackLayouts = useMemo<TrackLayout[]>(() => {
    const layouts: TrackLayout[] = [];
    let y = 0;
    for (const track of tracks) {
      const height = Math.max(24, Math.round(track.height * trackHeightScale));
      layouts.push({
        id: track.id,
        top: y,
        bottom: y + height,
        height,
      });
      y += height;
    }
    return layouts;
  }, [tracks, trackHeightScale]);
  const trackOffsetMap = useMemo(() => {
    const offsets: Record<string, { top: number; height: number }> = {};
    for (const layout of trackLayouts) {
      offsets[layout.id] = { top: layout.top, height: layout.height };
    }
    return offsets;
  }, [trackLayouts]);
  const totalTrackHeight = useMemo(
    () => trackLayouts.reduce((sum, layout) => sum + layout.height, 0),
    [trackLayouts]
  );
  const trackIdSet = useMemo(() => new Set(tracks.map((track) => track.id)), [tracks]);
  const clipTrackEndById = useMemo(() => {
    const map = new Map<string, number>();
    for (const clip of clips) {
      map.set(clip.id, clip.start + clip.duration);
    }
    return map;
  }, [clips]);
  const clipMapById = useMemo(() => {
    const map = new Map<string, BeatClip>();
    for (const clip of clips) {
      map.set(clip.id, clip);
    }
    return map;
  }, [clips]);
  const selectedClipList = useMemo(() => {
    return Array.from(selectedClips)
      .map((clipId) => clipMapById.get(clipId))
      .filter((clip): clip is BeatClip => Boolean(clip))
      .sort((left, right) => left.start - right.start);
  }, [clipMapById, selectedClips]);
  const visibleClips = useMemo(() => {
    const visible = clips.filter((clip) => {
      if (!trackIdSet.has(clip.trackId)) {
        return false;
      }
      const meta = clipMetadata[clip.id] || {};
      const clipTags = Array.from(
        new Set([...(clip.tags || []), ...(meta.tags || [])].map((tag) => tag.toLowerCase().trim()).filter(Boolean))
      );
      const hasTag =
        normalizedFilterTags.length === 0 ||
        normalizedFilterTags.some((tag) => clipTags.includes(tag));

      if (!hasTag) {
        return false;
      }

      if (!normalizedSearchQuery) {
        return true;
      }

      const haystack = [
        clip.name,
        meta.shotName,
        meta.scene,
        meta.take,
        ...clipTags,
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());

      return haystack.some((entry) => entry.includes(normalizedSearchQuery));
    });

    return [...visible].sort((left, right) => left.start - right.start);
  }, [clipMetadata, clips, normalizedFilterTags, normalizedSearchQuery, trackIdSet]);
  const viewportStartTime = useMemo(
    () => clampNumber(pixelsToTime(Math.max(0, timelineViewportPx.start)), 0, totalDuration),
    [pixelsToTime, timelineViewportPx.start, totalDuration]
  );
  const viewportEndTime = useMemo(
    () => clampNumber(pixelsToTime(Math.max(0, timelineViewportPx.end)), 0, totalDuration),
    [pixelsToTime, timelineViewportPx.end, totalDuration]
  );
  const viewportBufferedStartTime = useMemo(
    () => Math.max(0, viewportStartTime - Math.max(1.5, totalDuration * 0.02)),
    [totalDuration, viewportStartTime]
  );
  const viewportBufferedEndTime = useMemo(
    () => Math.min(totalDuration, viewportEndTime + Math.max(1.5, totalDuration * 0.02)),
    [totalDuration, viewportEndTime]
  );
  const viewportBufferedTop = useMemo(
    () => Math.max(0, timelineViewportY.start - 120),
    [timelineViewportY.start]
  );
  const viewportBufferedBottom = useMemo(
    () => Math.min(totalTrackHeight, timelineViewportY.end + 120),
    [timelineViewportY.end, totalTrackHeight]
  );
  const visibleTrackIdSet = useMemo(() => {
    const ids = new Set<string>();
    for (const layout of trackLayouts) {
      if (layout.bottom >= viewportBufferedTop && layout.top <= viewportBufferedBottom) {
        ids.add(layout.id);
      }
    }
    return ids;
  }, [trackLayouts, viewportBufferedBottom, viewportBufferedTop]);
  const visibleTracksInViewport = useMemo(
    () => tracks.filter((track) => visibleTrackIdSet.has(track.id)),
    [tracks, visibleTrackIdSet]
  );
  const allMarkers = useMemo<EphemeralMarker[]>(() => {
    const persistedMarkers: EphemeralMarker[] = markers.map((marker) => ({
      ...marker,
      ephemeral: false,
    }));
    return [...persistedMarkers, ...ephemeralMarkers].sort((left, right) => left.time - right.time);
  }, [markers, ephemeralMarkers]);
  const clipsSortedByStart = useMemo(() => {
    return [...clips].sort((left, right) => {
      if (left.start !== right.start) {
        return left.start - right.start;
      }
      return right.duration - left.duration;
    });
  }, [clips]);

  useEffect(() => {
    if (tracks.length === 0) {
      setSelectedTrackId(null);
      return;
    }
    if (selectedTrackId && tracks.some((track) => track.id === selectedTrackId)) {
      return;
    }
    setSelectedTrackId(tracks[0].id);
  }, [selectedTrackId, tracks]);

  useEffect(() => {
    setTrackNameDrafts((previous) => {
      const next: Record<string, string> = {};
      let changed = false;
      for (const track of tracks) {
        const existing = previous[track.id];
        if (trackNameEditingId === track.id && typeof existing === 'string') {
          next[track.id] = existing;
        } else {
          next[track.id] = track.name;
        }
        if (next[track.id] !== existing) {
          changed = true;
        }
      }
      if (Object.keys(previous).length !== Object.keys(next).length) {
        changed = true;
      }
      return changed ? next : previous;
    });
  }, [trackNameEditingId, tracks]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const preferences: TimelineToolbarPreferences = {
      workspaceMode,
      toolMode,
      safeTrimEnabled,
      magneticEnabled,
      snappingEnabled,
      rippleEnabled,
      timeDisplayMode,
      timelineFps,
    };
    try {
      window.localStorage.setItem(TIMELINE_TOOLBAR_PREFS_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore persistence errors so editing is never blocked by storage limits.
    }
  }, [
    magneticEnabled,
    rippleEnabled,
    safeTrimEnabled,
    snappingEnabled,
    timeDisplayMode,
    timelineFps,
    toolMode,
    workspaceMode,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase() || '';
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) {
        return;
      }
      setIsSpaceHandActive(true);
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.key !== ' ') {
        return;
      }
      setIsSpaceHandActive(false);
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const normalizeTimelineTime = useCallback(
    (timeSeconds: number) => clampNumber(timeSeconds, 0, totalDuration),
    [totalDuration]
  );
  const normalizeTimelineX = useCallback(
    (xPixels: number) => clampNumber(xPixels, 0, timeToPixels(totalDuration)),
    [timeToPixels, totalDuration]
  );
  const getTimelineXFromClientX = useCallback(
    (clientX: number): number => {
      if (!timelineRef.current) {
        return 0;
      }
      const rect = timelineRef.current.getBoundingClientRect();
      const x = clientX - rect.left + timelineRef.current.scrollLeft - HEADER_WIDTH;
      return normalizeTimelineX(x);
    },
    [normalizeTimelineX]
  );
  const getTimelineTimeFromClientX = useCallback(
    (clientX: number): number => normalizeTimelineTime(pixelsToTime(getTimelineXFromClientX(clientX))),
    [getTimelineXFromClientX, normalizeTimelineTime, pixelsToTime]
  );
  const getContentPointFromClient = useCallback((clientX: number, clientY: number) => {
    if (!timelineRef.current) {
      return { x: 0, y: 0 };
    }
    const rect = timelineRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left + timelineRef.current.scrollLeft,
      y: clientY - rect.top + timelineRef.current.scrollTop,
    };
  }, []);
  const getTrackIdFromClientY = useCallback(
    (clientY: number, fallbackTrackId: string): string => {
      if (!timelineRef.current) {
        return fallbackTrackId;
      }
      const rect = timelineRef.current.getBoundingClientRect();
      const y = clientY - rect.top + timelineRef.current.scrollTop;
      const hitLayout = trackLayouts.find((layout) => y >= layout.top && y < layout.bottom);
      if (!hitLayout) {
        return fallbackTrackId;
      }
      const targetTrackState = trackStates[hitLayout.id];
      if (targetTrackState?.locked) {
        return fallbackTrackId;
      }
      return hitLayout.id;
    },
    [trackLayouts, trackStates]
  );

  const gridLines = useMemo<TimelineGridLine[]>(() => {
    const lines: TimelineGridLine[] = [];
    const base = Math.max(1, Math.round(30 / Math.max(zoom, 0.1)));
    const step = base <= 1 ? 1 : base <= 5 ? 5 : base <= 10 ? 10 : 30;
    for (let t = 0; t <= totalDuration; t += step) {
      lines.push({ time: t, position: timeToPixels(t), isMain: t % (step * 4) === 0 });
    }
    if (lines.length === 0 || lines[lines.length - 1].time !== totalDuration) {
      lines.push({
        time: totalDuration,
        position: timeToPixels(totalDuration),
        isMain: true,
      });
    }
    return lines;
  }, [zoom, totalDuration, timeToPixels]);
  const visibleGridLinesInViewport = useMemo(() => {
    const start = Math.max(0, timelineViewportPx.start - 200);
    const end = timelineViewportPx.end + 200;
    return gridLines.filter((line) => line.position >= start && line.position <= end);
  }, [gridLines, timelineViewportPx.end, timelineViewportPx.start]);
  const visibleTransitionsInViewport = useMemo(() => {
    return transitions.filter((transition) => (
      transition.time >= viewportBufferedStartTime &&
      transition.time <= viewportBufferedEndTime
    ));
  }, [transitions, viewportBufferedEndTime, viewportBufferedStartTime]);
  const visibleCompareClipsInViewport = useMemo(() => {
    return compareClips.filter((clip) => (
      clip.start + clip.duration >= viewportBufferedStartTime &&
      clip.start <= viewportBufferedEndTime
    ));
  }, [compareClips, viewportBufferedEndTime, viewportBufferedStartTime]);

  const baseSnapTargets = useMemo<BaseSnapTarget[]>(() => {
    const targets: BaseSnapTarget[] = [];
    for (const line of gridLines) {
      targets.push({
        value: line.position,
        kind: 'grid',
        label: `Grid ${formatTimelineDisplay(line.time, timeDisplayMode, timelineFps)}`,
      });
    }
    for (const marker of allMarkers) {
      targets.push({
        value: timeToPixels(marker.time),
        kind: 'marker',
        label: marker.label || `Marker ${formatTimelineDisplay(marker.time, timeDisplayMode, timelineFps)}`,
      });
    }
    targets.push({
      value: timeToPixels(currentTime),
      kind: 'playhead',
      label: `Playhead ${formatTimelineDisplay(currentTime, timeDisplayMode, timelineFps)}`,
    });
    return targets
      .map((target) => ({
        ...target,
        value: Math.round(target.value * 1000) / 1000,
      }))
      .sort((left, right) => left.value - right.value);
  }, [allMarkers, currentTime, gridLines, timeDisplayMode, timeToPixels, timelineFps]);

  const clipEdgeSnapTargetsPx = useMemo(() => {
    const targets: Array<{ clipId: string; value: number; label: string }> = [];
    for (const clip of clips) {
      targets.push({ clipId: clip.id, value: timeToPixels(clip.start), label: `${clip.name} start` });
      targets.push({
        clipId: clip.id,
        value: timeToPixels(clip.start + clip.duration),
        label: `${clip.name} end`,
      });
    }
    targets.sort((left, right) => left.value - right.value);
    return targets;
  }, [clips, timeToPixels]);
  const clipEdgeSnapTargetValues = useMemo(
    () => clipEdgeSnapTargetsPx.map((entry) => entry.value),
    [clipEdgeSnapTargetsPx]
  );
  const baseSnapTargetValues = useMemo(
    () => baseSnapTargets.map((target) => target.value),
    [baseSnapTargets]
  );

  const findNearestBaseSnapTarget = useCallback((px: number): { target: BaseSnapTarget; delta: number } | null => {
    if (baseSnapTargets.length === 0) {
      return null;
    }
    const index = findLowerBound(baseSnapTargetValues, px);
    let bestTarget = baseSnapTargets[Math.min(index, baseSnapTargets.length - 1)];
    let bestDelta = Math.abs(px - bestTarget.value);
    if (index > 0) {
      const previous = baseSnapTargets[index - 1];
      const previousDelta = Math.abs(px - previous.value);
      if (previousDelta < bestDelta) {
        bestTarget = previous;
        bestDelta = previousDelta;
      }
    }
    return { target: bestTarget, delta: bestDelta };
  }, [baseSnapTargetValues, baseSnapTargets]);

  const findNearestClipEdgeSnapTarget = useCallback((px: number, ignoreClipId?: string): { value: number; delta: number; label: string } | null => {
    if (clipEdgeSnapTargetsPx.length === 0) {
      return null;
    }
    const insertionIndex = findLowerBound(clipEdgeSnapTargetValues, px);
    let left = insertionIndex - 1;
    let right = insertionIndex;
    while (left >= 0 || right < clipEdgeSnapTargetsPx.length) {
      const leftDelta = left >= 0 ? Math.abs(px - clipEdgeSnapTargetsPx[left].value) : Number.POSITIVE_INFINITY;
      const rightDelta = right < clipEdgeSnapTargetsPx.length ? Math.abs(px - clipEdgeSnapTargetsPx[right].value) : Number.POSITIVE_INFINITY;
      if (leftDelta <= rightDelta) {
        const candidate = clipEdgeSnapTargetsPx[left];
        left -= 1;
        if (!ignoreClipId || candidate.clipId !== ignoreClipId) {
          return { value: candidate.value, delta: leftDelta, label: candidate.label };
        }
      } else {
        const candidate = clipEdgeSnapTargetsPx[right];
        right += 1;
        if (!ignoreClipId || candidate.clipId !== ignoreClipId) {
          return { value: candidate.value, delta: rightDelta, label: candidate.label };
        }
      }
    }
    return null;
  }, [clipEdgeSnapTargetValues, clipEdgeSnapTargetsPx]);

  const snapPx = useCallback((px: number, ignoreClipId?: string): SnapResult => {
    const baseTarget = snappingEnabled ? findNearestBaseSnapTarget(px) : null;
    const clipTarget = magneticEnabled ? findNearestClipEdgeSnapTarget(px, ignoreClipId) : null;
    let best = px;
    let bestDelta = Number.POSITIVE_INFINITY;
    let bestKind: SnapKind | null = null;
    let bestLabel: string | null = null;
    if (baseTarget && baseTarget.delta < bestDelta) {
      best = baseTarget.target.value;
      bestDelta = baseTarget.delta;
      bestKind = baseTarget.target.kind;
      bestLabel = baseTarget.target.label;
    }
    if (clipTarget && clipTarget.delta < bestDelta) {
      best = clipTarget.value;
      bestDelta = clipTarget.delta;
      bestKind = 'clip-edge';
      bestLabel = clipTarget.label;
    }
    if (!Number.isFinite(bestDelta)) {
      return {
        value: px,
        snapped: false,
        kind: null,
        label: null,
      };
    }
    const threshold = Math.max(SNAP_PX, Math.round((8 / Math.max(zoom, 0.1))));
    if (bestDelta <= threshold) {
      return {
        value: best,
        snapped: true,
        kind: bestKind,
        label: bestLabel,
      };
    }
    return {
      value: px,
      snapped: false,
      kind: null,
      label: null,
    };
  }, [findNearestBaseSnapTarget, findNearestClipEdgeSnapTarget, magneticEnabled, snappingEnabled, zoom]);

  const maybeAutoScrollDuringInteraction = useCallback((clientX: number) => {
    if (!timelineRef.current) {
      return;
    }
    const rect = timelineRef.current.getBoundingClientRect();
    const distanceToLeft = clientX - rect.left;
    const distanceToRight = rect.right - clientX;
    let delta = 0;
    if (distanceToLeft < AUTO_SCROLL_EDGE_PX) {
      const intensity = clampNumber((AUTO_SCROLL_EDGE_PX - distanceToLeft) / AUTO_SCROLL_EDGE_PX, 0, 1);
      delta = -Math.round(AUTO_SCROLL_MAX_PX_PER_TICK * intensity);
    } else if (distanceToRight < AUTO_SCROLL_EDGE_PX) {
      const intensity = clampNumber((AUTO_SCROLL_EDGE_PX - distanceToRight) / AUTO_SCROLL_EDGE_PX, 0, 1);
      delta = Math.round(AUTO_SCROLL_MAX_PX_PER_TICK * intensity);
    }
    if (delta === 0) {
      return;
    }
    timelineRef.current.scrollLeft += delta;
  }, []);

  const findClipAtTime = useCallback((timeSeconds: number): BeatClip | null => {
    if (clipsSortedByStart.length === 0) {
      return null;
    }
    let left = 0;
    let right = clipsSortedByStart.length - 1;
    let candidateIndex = -1;
    while (left <= right) {
      const mid = (left + right) >> 1;
      const clip = clipsSortedByStart[mid];
      if (clip.start <= timeSeconds) {
        candidateIndex = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    if (candidateIndex < 0) {
      return null;
    }
    for (let index = candidateIndex; index >= 0; index -= 1) {
      const clip = clipsSortedByStart[index];
      if (clip.start + clip.duration < timeSeconds) {
        break;
      }
      if (timeSeconds >= clip.start && timeSeconds <= clip.start + clip.duration) {
        return clip;
      }
    }
    for (let index = candidateIndex + 1; index < clipsSortedByStart.length; index += 1) {
      const clip = clipsSortedByStart[index];
      if (clip.start > timeSeconds) {
        break;
      }
      if (timeSeconds >= clip.start && timeSeconds <= clip.start + clip.duration) {
        return clip;
      }
    }
    return null;
  }, [clipsSortedByStart]);

  const selectSingleClip = useCallback((clipId: string) => {
    onClipSelect(clipId, false);
  }, [onClipSelect]);

  const selectMultipleClipsDeterministic = useCallback((clipIds: string[]) => {
    if (clipIds.length === 0) {
      return;
    }
    const uniqueClipIds = Array.from(new Set(clipIds));
    selectSingleClip(uniqueClipIds[0]);
    const queue = uniqueClipIds.slice(1);
    const pump = () => {
      const nextClipId = queue.shift();
      if (!nextClipId) {
        return;
      }
      onClipSelect(nextClipId, true);
      window.requestAnimationFrame(pump);
    };
    window.requestAnimationFrame(pump);
  }, [onClipSelect, selectSingleClip]);

  const nudgeSelectedClips = useCallback((deltaSeconds: number) => {
    if (selectedClipList.length === 0) {
      return;
    }
    const clippedDelta = Number.isFinite(deltaSeconds) ? deltaSeconds : 0;
    for (const clip of selectedClipList) {
      const targetTrackId = clip.trackId;
      const maxStart = Math.max(0, totalDuration - clip.duration);
      const nextStart = clampNumber(clip.start + clippedDelta, 0, maxStart);
      onClipMove(clip.id, nextStart, targetTrackId);
    }
  }, [onClipMove, selectedClipList, totalDuration]);

  const trimSelectedClipEdges = useCallback((deltaSeconds: number, edge: 'left' | 'right') => {
    if (!onClipResize || selectedClipList.length === 0) {
      return;
    }
    const safeRangeStart =
      safeTrimEnabled && inPoint !== null && outPoint !== null
        ? Math.min(inPoint, outPoint)
        : null;
    const safeRangeEnd =
      safeTrimEnabled && inPoint !== null && outPoint !== null
        ? Math.max(inPoint, outPoint)
        : null;
    for (const clip of selectedClipList) {
      const trackMaxEnd = safeRangeEnd !== null
        ? Math.min(totalDuration, safeRangeEnd)
        : totalDuration;
      if (edge === 'right') {
        const nextDuration = clampNumber(
          clip.duration + deltaSeconds,
          MIN_CLIP_DURATION_SECONDS,
          Math.max(MIN_CLIP_DURATION_SECONDS, trackMaxEnd - clip.start)
        );
        onClipResize(clip.id, clip.start, nextDuration, 'resize-right');
      } else {
        const minStart = safeRangeStart !== null ? Math.max(0, safeRangeStart) : 0;
        const maxStart = clip.start + clip.duration - MIN_CLIP_DURATION_SECONDS;
        const rawNextStart = clip.start + deltaSeconds;
        const nextStart = clampNumber(rawNextStart, minStart, maxStart);
        const nextDuration = Math.max(MIN_CLIP_DURATION_SECONDS, clip.duration - (nextStart - clip.start));
        onClipResize(clip.id, nextStart, nextDuration, 'resize-left');
      }
    }
  }, [inPoint, onClipResize, outPoint, safeTrimEnabled, selectedClipList, totalDuration]);

  const moveSelectedClipsToAdjacentTrack = useCallback((direction: -1 | 1) => {
    if (selectedClipList.length === 0) {
      return;
    }
    const trackIndexById = new Map<string, number>();
    tracks.forEach((track, index) => trackIndexById.set(track.id, index));
    for (const clip of selectedClipList) {
      const currentIndex = trackIndexById.get(clip.trackId);
      if (typeof currentIndex !== 'number') {
        continue;
      }
      const nextIndex = clampNumber(currentIndex + direction, 0, tracks.length - 1);
      const nextTrack = tracks[nextIndex];
      if (!nextTrack || trackStates[nextTrack.id]?.locked) {
        continue;
      }
      onClipMove(clip.id, clip.start, nextTrack.id);
    }
  }, [onClipMove, selectedClipList, trackStates, tracks]);

  const zoomToRange = useCallback((startTime: number, endTime: number) => {
    if (!timelineRef.current || !onZoomChange) {
      return;
    }
    const range = Math.max(0.25, Math.abs(endTime - startTime));
    const availableWidth = Math.max(320, timelineRef.current.clientWidth - HEADER_WIDTH - 32);
    const targetPps = availableWidth / range;
    const targetZoom = clampNumber(targetPps / 10, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM);
    onZoomChange(targetZoom);
    const rangeMidpoint = (startTime + endTime) / 2;
    const targetScrollLeft = timeToPixels(rangeMidpoint) - (timelineRef.current.clientWidth - HEADER_WIDTH) / 2 + HEADER_WIDTH;
    timelineRef.current.scrollLeft = Math.max(0, targetScrollLeft);
  }, [onZoomChange, timeToPixels]);

  const zoomToProject = useCallback(() => {
    zoomToRange(0, totalDuration);
  }, [totalDuration, zoomToRange]);

  const zoomToSelection = useCallback(() => {
    if (selectedClipList.length === 0) {
      return;
    }
    const start = selectedClipList[0].start;
    const end = selectedClipList.reduce((maxEnd, clip) => Math.max(maxEnd, clip.start + clip.duration), start + selectedClipList[0].duration);
    zoomToRange(start, end);
  }, [selectedClipList, zoomToRange]);

  const addEphemeralMarker = useCallback((timeSeconds: number, labelPrefix: string) => {
    markerCounterRef.current += 1;
    const markerId = `ephemeral-marker-${markerCounterRef.current}`;
    const bounded = normalizeTimelineTime(timeSeconds);
    setEphemeralMarkers((previous) => [
      ...previous,
      {
        id: markerId,
        time: bounded,
        label: `${labelPrefix} ${formatTimelineTime(bounded)}`,
        color: '#ff9800',
        ephemeral: true,
      },
    ]);
  }, [normalizeTimelineTime]);

  const updateDragPreview = useCallback((nextPreview: DragPreviewState) => {
    const previousPreview = dragPreviewRef.current;
    if (
      previousPreview &&
      previousPreview.clipId === nextPreview.clipId &&
      previousPreview.trackId === nextPreview.trackId &&
      previousPreview.mode === nextPreview.mode &&
      Math.abs(previousPreview.start - nextPreview.start) < DRAG_COMMIT_EPSILON_SECONDS &&
      Math.abs(previousPreview.duration - nextPreview.duration) < DRAG_COMMIT_EPSILON_SECONDS
    ) {
      return;
    }
    dragPreviewRef.current = nextPreview;
    dragPreviewStoreRef.current.setSnapshot(nextPreview);
  }, []);

  const commitDragPreview = useCallback((activeDrag: DragState | null, preview: DragPreviewState | null) => {
    if (!activeDrag || !preview) {
      return;
    }
    const currentClip = clipMapById.get(activeDrag.clipId);
    if (!currentClip) {
      return;
    }
    if (activeDrag.mode === 'move') {
      const didMoveTrack = preview.trackId !== currentClip.trackId;
      const didMoveTime = Math.abs(preview.start - currentClip.start) >= DRAG_COMMIT_EPSILON_SECONDS;
      if (didMoveTrack || didMoveTime) {
        onClipMove(activeDrag.clipId, preview.start, preview.trackId);
      }
      return;
    }
    if (!onClipResize) {
      return;
    }
    const didChangeStart = Math.abs(preview.start - currentClip.start) >= DRAG_COMMIT_EPSILON_SECONDS;
    const didChangeDuration = Math.abs(preview.duration - currentClip.duration) >= DRAG_COMMIT_EPSILON_SECONDS;
    if (!didChangeStart && !didChangeDuration) {
      return;
    }
    onClipResize(activeDrag.clipId, preview.start, preview.duration, activeDrag.mode);
  }, [clipMapById, onClipMove, onClipResize]);

  const scheduleObjectUrlRevoke = useCallback((objectUrl: string, delayMs: number = OBJECT_URL_REVOKE_DELAY_MS) => {
    const timeoutId = window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      createdObjectUrlsRef.current = createdObjectUrlsRef.current.filter((url) => url !== objectUrl);
      objectUrlCleanupTimersRef.current = objectUrlCleanupTimersRef.current.filter((id) => id !== timeoutId);
    }, delayMs);
    objectUrlCleanupTimersRef.current.push(timeoutId);
  }, []);

  const detachDragListeners = useCallback(() => {
    if (dragListenersRef.current.move) {
      window.removeEventListener('mousemove', dragListenersRef.current.move);
    }
    if (dragListenersRef.current.up) {
      window.removeEventListener('mouseup', dragListenersRef.current.up);
    }
    dragListenersRef.current = {};
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const activeDrag = dragStateRef.current;
    if (!activeDrag || !timelineRef.current) return;
    maybeAutoScrollDuringInteraction(e.clientX);
    const newTrackId = getTrackIdFromClientY(e.clientY, activeDrag.originalTrackId);
    const currentX = getTimelineXFromClientX(e.clientX);
    const deltaX = currentX - activeDrag.startX;
    const movingClipEnd = clipTrackEndById.get(activeDrag.clipId) ?? (activeDrag.startTime + activeDrag.originalDuration);
    const maxStart = Math.max(0, totalDuration - activeDrag.originalDuration);
    const shouldSnap = (snappingEnabled || magneticEnabled) && !e.altKey;

    if (activeDrag.mode === 'move') {
      const candidateStart = clampNumber(activeDrag.startTime + pixelsToTime(deltaX), 0, maxStart);
      const candidateStartPx = timeToPixels(candidateStart);
      const snapResult = shouldSnap
        ? snapPx(candidateStartPx, activeDrag.clipId)
        : { value: candidateStartPx, snapped: false, kind: null, label: null };
      const snapped = snapResult.snapped && Math.abs(snapResult.value - candidateStartPx) >= SNAP_GUIDE_VISIBLE_THRESHOLD_PX;
      setSnapGuideVisible(snapped);
      setSnapGuideX(snapped ? snapResult.value : null);
      setSnapGuideLabel(snapped ? snapResult.label : null);
      const newStart = clampNumber(
        pixelsToTime(snapResult.value),
        0,
        Math.max(0, totalDuration - activeDrag.originalDuration)
      );
      updateDragPreview({
        clipId: activeDrag.clipId,
        trackId: newTrackId,
        start: newStart,
        duration: activeDrag.originalDuration,
        mode: activeDrag.mode,
      });
      return;
    }

    if (!onClipResize) return;
    const originalEnd = clampNumber(movingClipEnd, activeDrag.startTime, totalDuration);

    if (activeDrag.mode === 'resize-left') {
      const minStart = 0;
      const maxAllowedStart = Math.max(minStart, originalEnd - MIN_CLIP_DURATION_SECONDS);
      const candidateStart = clampNumber(
        activeDrag.startTime + pixelsToTime(deltaX),
        minStart,
        maxAllowedStart
      );
      const candidateStartPx = timeToPixels(candidateStart);
      const snapResult = shouldSnap
        ? snapPx(candidateStartPx, activeDrag.clipId)
        : { value: candidateStartPx, snapped: false, kind: null, label: null };
      const snapped = snapResult.snapped && Math.abs(snapResult.value - candidateStartPx) >= SNAP_GUIDE_VISIBLE_THRESHOLD_PX;
      setSnapGuideVisible(snapped);
      setSnapGuideX(snapped ? snapResult.value : null);
      setSnapGuideLabel(snapped ? snapResult.label : null);
      const newStart = clampNumber(
        pixelsToTime(snapResult.value),
        minStart,
        maxAllowedStart
      );
      const newDuration = Math.max(MIN_CLIP_DURATION_SECONDS, originalEnd - newStart);
      updateDragPreview({
        clipId: activeDrag.clipId,
        trackId: activeDrag.originalTrackId,
        start: newStart,
        duration: newDuration,
        mode: activeDrag.mode,
      });
      return;
    }

    if (activeDrag.mode === 'resize-right') {
      const minEnd = activeDrag.startTime + MIN_CLIP_DURATION_SECONDS;
      const candidateEnd = clampNumber(
        originalEnd + pixelsToTime(deltaX),
        minEnd,
        totalDuration
      );
      const candidateEndPx = timeToPixels(candidateEnd);
      const snapResult = shouldSnap
        ? snapPx(candidateEndPx, activeDrag.clipId)
        : { value: candidateEndPx, snapped: false, kind: null, label: null };
      const snapped = snapResult.snapped && Math.abs(snapResult.value - candidateEndPx) >= SNAP_GUIDE_VISIBLE_THRESHOLD_PX;
      setSnapGuideVisible(snapped);
      setSnapGuideX(snapped ? snapResult.value : null);
      setSnapGuideLabel(snapped ? snapResult.label : null);
      const newEnd = clampNumber(
        pixelsToTime(snapResult.value),
        minEnd,
        totalDuration
      );
      const newDuration = Math.max(MIN_CLIP_DURATION_SECONDS, newEnd - activeDrag.startTime);
      updateDragPreview({
        clipId: activeDrag.clipId,
        trackId: activeDrag.originalTrackId,
        start: activeDrag.startTime,
        duration: newDuration,
        mode: activeDrag.mode,
      });
      return;
    }
  }, [
    clipTrackEndById,
    getTimelineXFromClientX,
    getTrackIdFromClientY,
    maybeAutoScrollDuringInteraction,
    magneticEnabled,
    snappingEnabled,
    onClipResize,
    pixelsToTime,
    snapPx,
    timeToPixels,
    totalDuration,
    updateDragPreview,
  ]);

  const handleMouseUp = useCallback(() => {
    const activeDrag = dragStateRef.current;
    const preview = dragPreviewRef.current;
    commitDragPreview(activeDrag, preview);
    dragStateRef.current = null;
    dragPreviewRef.current = null;
    setDragState(null);
    dragPreviewStoreRef.current.setSnapshot(null);
    setSnapGuideVisible(false);
    setSnapGuideX(null);
    setSnapGuideLabel(null);
    detachDragListeners();
  }, [
    commitDragPreview,
    detachDragListeners,
  ]);

  useEffect(() => {
    return () => {
      detachDragListeners();
      dragStateRef.current = null;
      dragPreviewRef.current = null;
      dragPreviewStoreRef.current.setSnapshot(null);
      if (hoverRafRef.current !== null) {
        window.cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
      if (panInertiaRafRef.current !== null) {
        window.cancelAnimationFrame(panInertiaRafRef.current);
        panInertiaRafRef.current = null;
      }
      for (const timeoutId of objectUrlCleanupTimersRef.current) {
        window.clearTimeout(timeoutId);
      }
      objectUrlCleanupTimersRef.current = [];
      for (const url of createdObjectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      createdObjectUrlsRef.current = [];
    };
  }, [detachDragListeners]);

  const beginDrag = useCallback((e: React.MouseEvent, clipId: string, mode: DragMode = 'move') => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (reviewerMode) return;
    if (!timelineRef.current) return;
    const clip = clipMapById.get(clipId);
    if (!clip) return;
    if (collabLocks[clip.id]) return;
    if (trackStates[clip.trackId]?.locked) return;
    timelineRef.current.focus();
    detachDragListeners();
    const nextDragState: DragState = {
      clipId,
      startX: getTimelineXFromClientX(e.clientX),
      startTime: clip.start,
      originalTrackId: clip.trackId,
      originalDuration: clip.duration,
      mode,
    };
    dragStateRef.current = nextDragState;
    const nextPreview: DragPreviewState = {
      clipId: clip.id,
      trackId: clip.trackId,
      start: clip.start,
      duration: clip.duration,
      mode,
    };
    dragPreviewRef.current = nextPreview;
    dragPreviewStoreRef.current.setSnapshot(nextPreview);
    setDragState(nextDragState);
    setSnapGuideVisible(false);
    setSnapGuideX(null);
    setSnapGuideLabel(null);
    const onMove = (event: MouseEvent) => {
      handleMouseMove(event);
    };
    const onUp = (_event: MouseEvent) => {
      handleMouseUp();
    };
    dragListenersRef.current = { move: onMove, up: onUp };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [clipMapById, collabLocks, detachDragListeners, getTimelineXFromClientX, handleMouseMove, handleMouseUp, reviewerMode, trackStates]);

  const stopPanInertia = useCallback(() => {
    if (panInertiaRafRef.current !== null) {
      window.cancelAnimationFrame(panInertiaRafRef.current);
      panInertiaRafRef.current = null;
    }
  }, []);

  const startPanInertia = useCallback(() => {
    const element = timelineRef.current;
    const velocity = panVelocityRef.current;
    if (!element || !velocity) {
      return;
    }
    let vx = velocity.vx;
    let vy = velocity.vy;
    if (Math.abs(vx) < PAN_INERTIA_MIN_VELOCITY && Math.abs(vy) < PAN_INERTIA_MIN_VELOCITY) {
      return;
    }
    const animate = () => {
      const target = timelineRef.current;
      if (!target) {
        panInertiaRafRef.current = null;
        return;
      }
      vx *= PAN_INERTIA_FRICTION;
      vy *= PAN_INERTIA_FRICTION;
      if (Math.abs(vx) < PAN_INERTIA_MIN_VELOCITY && Math.abs(vy) < PAN_INERTIA_MIN_VELOCITY) {
        panInertiaRafRef.current = null;
        return;
      }
      target.scrollLeft += vx * 16;
      target.scrollTop += vy * 16;
      panInertiaRafRef.current = window.requestAnimationFrame(animate);
    };
    stopPanInertia();
    panInertiaRafRef.current = window.requestAnimationFrame(animate);
  }, [stopPanInertia]);

  const beginPan = useCallback((clientX: number, clientY: number, isSpaceHand: boolean) => {
    if (!timelineRef.current) {
      return;
    }
    stopPanInertia();
    const now = performance.now();
    panVelocityRef.current = {
      lastTimestamp: now,
      lastScrollLeft: timelineRef.current.scrollLeft,
      lastScrollTop: timelineRef.current.scrollTop,
      vx: 0,
      vy: 0,
    };
    setPanState({
      startClientX: clientX,
      startClientY: clientY,
      startScrollLeft: timelineRef.current.scrollLeft,
      startScrollTop: timelineRef.current.scrollTop,
      isSpaceHand,
    });
  }, [stopPanInertia]);

  const beginMarqueeSelection = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !timelineRef.current) {
      return false;
    }
    const target = e.target as HTMLElement;
    const clipElement = target.closest('[data-clip-id]');
    if (clipElement) {
      return false;
    }
    if (!e.shiftKey) {
      return false;
    }
    const point = getContentPointFromClient(e.clientX, e.clientY);
    setMarqueeState({
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
    });
    return true;
  }, [getContentPointFromClient]);

  const updateMarqueeSelection = useCallback((clientX: number, clientY: number) => {
    if (!marqueeState) {
      return;
    }
    const point = getContentPointFromClient(clientX, clientY);
    setMarqueeState((previous) => (previous ? {
      ...previous,
      currentX: point.x,
      currentY: point.y,
    } : previous));
  }, [getContentPointFromClient, marqueeState]);

  const finalizeMarqueeSelection = useCallback(() => {
    if (!marqueeState) {
      return;
    }
    const rectLeft = Math.min(marqueeState.startX, marqueeState.currentX);
    const rectRight = Math.max(marqueeState.startX, marqueeState.currentX);
    const rectTop = Math.min(marqueeState.startY, marqueeState.currentY);
    const rectBottom = Math.max(marqueeState.startY, marqueeState.currentY);
    const selectionRect: ClipRect = {
      left: rectLeft,
      right: rectRight,
      top: rectTop,
      bottom: rectBottom,
    };
    const hitClipIds: string[] = [];
    for (const clip of visibleClips) {
      const off = trackOffsetMap[clip.trackId];
      if (!off) {
        continue;
      }
      const clipRect: ClipRect = {
        left: HEADER_WIDTH + timeToPixels(clip.start),
        right: HEADER_WIDTH + timeToPixels(clip.start + clip.duration),
        top: off.top + 2,
        bottom: off.top + Math.max(20, off.height - 2),
      };
      const intersects =
        selectionRect.left <= clipRect.right &&
        selectionRect.right >= clipRect.left &&
        selectionRect.top <= clipRect.bottom &&
        selectionRect.bottom >= clipRect.top;
      if (intersects) {
        hitClipIds.push(clip.id);
      }
    }
    if (hitClipIds.length > 0) {
      selectMultipleClipsDeterministic(hitClipIds);
    }
    setMarqueeState(null);
  }, [marqueeState, selectMultipleClipsDeterministic, timeToPixels, trackOffsetMap, visibleClips]);

  useEffect(() => {
    if (!panState && !marqueeState) {
      return;
    }
    const onMove = (event: MouseEvent | PointerEvent) => {
      if (panState && timelineRef.current) {
        const deltaX = event.clientX - panState.startClientX;
        const deltaY = event.clientY - panState.startClientY;
        const nextScrollLeft = panState.startScrollLeft - deltaX;
        const nextScrollTop = panState.startScrollTop - deltaY;
        timelineRef.current.scrollLeft = nextScrollLeft;
        timelineRef.current.scrollTop = nextScrollTop;
        const now = performance.now();
        if (!panVelocityRef.current) {
          panVelocityRef.current = {
            lastTimestamp: now,
            lastScrollLeft: nextScrollLeft,
            lastScrollTop: nextScrollTop,
            vx: 0,
            vy: 0,
          };
        } else {
          const dt = Math.max(1, now - panVelocityRef.current.lastTimestamp);
          panVelocityRef.current.vx = (nextScrollLeft - panVelocityRef.current.lastScrollLeft) / dt;
          panVelocityRef.current.vy = (nextScrollTop - panVelocityRef.current.lastScrollTop) / dt;
          panVelocityRef.current.lastScrollLeft = nextScrollLeft;
          panVelocityRef.current.lastScrollTop = nextScrollTop;
          panVelocityRef.current.lastTimestamp = now;
        }
      }
      if (marqueeState) {
        maybeAutoScrollDuringInteraction(event.clientX);
        if (timelineRef.current) {
          const rect = timelineRef.current.getBoundingClientRect();
          const distanceTop = event.clientY - rect.top;
          const distanceBottom = rect.bottom - event.clientY;
          let verticalDelta = 0;
          if (distanceTop < AUTO_SCROLL_VERTICAL_EDGE_PX) {
            const intensity = clampNumber((AUTO_SCROLL_VERTICAL_EDGE_PX - distanceTop) / AUTO_SCROLL_VERTICAL_EDGE_PX, 0, 1);
            verticalDelta = -Math.round(AUTO_SCROLL_MAX_VERTICAL_PX_PER_TICK * intensity);
          } else if (distanceBottom < AUTO_SCROLL_VERTICAL_EDGE_PX) {
            const intensity = clampNumber((AUTO_SCROLL_VERTICAL_EDGE_PX - distanceBottom) / AUTO_SCROLL_VERTICAL_EDGE_PX, 0, 1);
            verticalDelta = Math.round(AUTO_SCROLL_MAX_VERTICAL_PX_PER_TICK * intensity);
          }
          if (verticalDelta !== 0) {
            timelineRef.current.scrollTop += verticalDelta;
          }
        }
        updateMarqueeSelection(event.clientX, event.clientY);
      }
    };
    const onUp = () => {
      if (marqueeState) {
        finalizeMarqueeSelection();
      }
      if (panState) {
        startPanInertia();
      }
      setPanState(null);
      setMarqueeState(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [finalizeMarqueeSelection, marqueeState, maybeAutoScrollDuringInteraction, panState, startPanInertia, updateMarqueeSelection]);

  const setPlayheadTime = useCallback((timeSeconds: number) => {
    const boundedTime = normalizeTimelineTime(timeSeconds);
    onTimelineClick(boundedTime);
    onCurrentTimeChange?.(boundedTime);
  }, [normalizeTimelineTime, onCurrentTimeChange, onTimelineClick]);

  const clearHoverState = useCallback(() => {
    const previous = hoverStoreRef.current.getSnapshot();
    if (previous.guideX === null && previous.time === null) {
      return;
    }
    hoverStoreRef.current.setSnapshot({
      guideX: null,
      time: null,
    });
  }, []);

  const setHoverState = useCallback((guideX: number, time: number) => {
    const previous = hoverStoreRef.current.getSnapshot();
    if (
      previous.guideX !== null &&
      Math.abs(previous.guideX - guideX) < 0.5 &&
      previous.time !== null &&
      Math.abs(previous.time - time) < DRAG_COMMIT_EPSILON_SECONDS
    ) {
      return;
    }
    hoverStoreRef.current.setSnapshot({
      guideX,
      time,
    });
  }, []);

  const scheduleHoverFromClientX = useCallback((clientX: number) => {
    if (!timelineRef.current) {
      return;
    }
    hoverPendingClientXRef.current = clientX;
    if (hoverRafRef.current !== null) {
      return;
    }
    hoverRafRef.current = window.requestAnimationFrame(() => {
      hoverRafRef.current = null;
      const pendingClientX = hoverPendingClientXRef.current;
      if (pendingClientX === null || !timelineRef.current) {
        return;
      }
      const timelineX = getTimelineXFromClientX(pendingClientX);
      setHoverState(timelineX, pixelsToTime(timelineX));
    });
  }, [getTimelineXFromClientX, pixelsToTime, setHoverState]);

  const handleTimelineClickLocal = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (!timelineRef.current || dragState) return;
    if (isSpaceHandActive) {
      return;
    }
    if (e.shiftKey || marqueeState) {
      return;
    }
    timelineRef.current.focus();
    setPlayheadTime(getTimelineTimeFromClientX(e.clientX));
  }, [dragState, getTimelineTimeFromClientX, isSpaceHandActive, marqueeState, setPlayheadTime]);

  const handleTimelineMouseDownLocal = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && isSpaceHandActive)) {
      e.preventDefault();
      beginPan(e.clientX, e.clientY, isSpaceHandActive);
      return;
    }
    if (e.button !== 0 || !timelineRef.current) {
      return;
    }
    if (dragState) {
      return;
    }
    beginMarqueeSelection(e);
  }, [beginMarqueeSelection, beginPan, dragState, isSpaceHandActive]);

  const handleTimelineMouseMoveLocal = useCallback((e: React.MouseEvent) => {
    scheduleHoverFromClientX(e.clientX);
  }, [scheduleHoverFromClientX]);

  const handleTimelinePointerDownLocal = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') {
      return;
    }
    if (!timelineRef.current) {
      return;
    }
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      event.preventDefault();
      beginPan(event.clientX, event.clientY, true);
    }
  }, [beginPan]);

  const handleTimelinePointerMoveLocal = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    scheduleHoverFromClientX(event.clientX);
  }, [scheduleHoverFromClientX]);

  const handleTimelinePointerLeaveLocal = useCallback(() => {
    hoverPendingClientXRef.current = null;
    if (hoverRafRef.current !== null) {
      window.cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    clearHoverState();
  }, [clearHoverState]);

  const handleRulerScrubToClientX = useCallback((clientX: number) => {
    timelineRef.current?.focus();
    setPlayheadTime(getTimelineTimeFromClientX(clientX));
  }, [getTimelineTimeFromClientX, setPlayheadTime]);

  const handleRulerHoverClientX = useCallback((clientX: number) => {
    scheduleHoverFromClientX(clientX);
  }, [scheduleHoverFromClientX]);

  const setInPointAtTime = useCallback((timeSeconds: number) => {
    const boundedTime = normalizeTimelineTime(timeSeconds);
    setInPoint(boundedTime);
    if (outPoint !== null && outPoint < boundedTime) {
      setOutPoint(boundedTime);
    }
  }, [normalizeTimelineTime, outPoint]);

  const setOutPointAtTime = useCallback((timeSeconds: number) => {
    const boundedTime = normalizeTimelineTime(timeSeconds);
    setOutPoint(boundedTime);
    if (inPoint !== null && inPoint > boundedTime) {
      setInPoint(boundedTime);
    }
  }, [inPoint, normalizeTimelineTime]);

  const onRulerDoubleClick = useCallback(() => {
    zoomToProject();
    timelineRef.current?.focus();
  }, [zoomToProject]);

  const handleRulerMouseLeave = useCallback(() => {
    hoverPendingClientXRef.current = null;
    if (hoverRafRef.current !== null) {
      window.cancelAnimationFrame(hoverRafRef.current);
      hoverRafRef.current = null;
    }
    clearHoverState();
  }, [clearHoverState]);

  const handleRulerKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const seekStep = e.shiftKey ? TIMELINE_SCROLL_STEP_SECONDS : frameStepSeconds;
    const shuttleStep = e.shiftKey ? TIMELINE_SCROLL_STEP_SECONDS * 10 : TIMELINE_SCROLL_STEP_SECONDS * 5;
    const key = e.key.toLowerCase();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setPlayheadTime(currentTime - seekStep);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setPlayheadTime(currentTime + seekStep);
      return;
    }
    if (e.key === 'PageUp') {
      e.preventDefault();
      setPlayheadTime(currentTime - TIMELINE_SCROLL_STEP_SECONDS * 5);
      return;
    }
    if (e.key === 'PageDown') {
      e.preventDefault();
      setPlayheadTime(currentTime + TIMELINE_SCROLL_STEP_SECONDS * 5);
      return;
    }
    if (key === 'j') {
      e.preventDefault();
      setPlayheadTime(currentTime - shuttleStep);
      return;
    }
    if (key === 'k') {
      e.preventDefault();
      setPlayheadTime(currentTime);
      return;
    }
    if (key === 'l') {
      e.preventDefault();
      setPlayheadTime(currentTime + shuttleStep);
      return;
    }
    if (key === 'i' || key === '[') {
      e.preventDefault();
      setInPointAtTime(currentTime);
      return;
    }
    if (key === 'o' || key === ']') {
      e.preventDefault();
      setOutPointAtTime(currentTime);
      return;
    }
    if (key === 'm') {
      e.preventDefault();
      addEphemeralMarker(currentTime, 'Marker');
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setPlayheadTime(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setPlayheadTime(totalDuration);
    }
  }, [
    addEphemeralMarker,
    currentTime,
    frameStepSeconds,
    setInPointAtTime,
    setOutPointAtTime,
    setPlayheadTime,
    totalDuration,
  ]);

  // Wheel zoom supports both Ctrl/Cmd+wheel and direct mouse wheel over timeline.
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!timelineRef.current) return;
    stopPanInertia();
    const isModifierZoom = e.ctrlKey || e.metaKey;
    const isWheelWithVerticalIntent = Math.abs(e.deltaY) >= Math.abs(e.deltaX);
    const shouldZoom = Boolean(onZoomChange) && (isModifierZoom || (isWheelWithVerticalIntent && !e.shiftKey));
    const deltaY = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;
    const deltaX = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaMode === 2 ? e.deltaX * 100 : e.deltaX;
    if (!shouldZoom) {
      if (e.shiftKey && deltaY !== 0) {
        timelineRef.current.scrollLeft += deltaY;
      } else if (deltaX !== 0) {
        timelineRef.current.scrollLeft += deltaX;
      }
      return;
    }
    const zoomSensitivity = e.altKey ? 0.0014 : 0.0025;
    const factor = Math.exp(-deltaY * zoomSensitivity);
    if (!Number.isFinite(factor) || Math.abs(factor - 1) < 0.0001) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const localX = clampNumber(e.clientX - rect.left, 0, rect.width);
    const cursorTimelineX = getTimelineXFromClientX(e.clientX);
    const anchorTime = clampNumber(pixelsToTime(cursorTimelineX), 0, totalDuration);
    const nextZoom = clampNumber(zoom * factor, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM);
    const nextPps = Math.max(5, nextZoom * 10);
    const nextTimelineWidth = Math.max(800, totalDuration * nextPps);
    const nextTimelineX = anchorTime * nextPps;
    const desiredScrollLeft = nextTimelineX - localX + HEADER_WIDTH;
    const maxScroll = Math.max(0, nextTimelineWidth + HEADER_WIDTH - timelineRef.current.clientWidth);
    timelineRef.current.scrollLeft = clampNumber(desiredScrollLeft, 0, maxScroll);
    onZoomChange?.(nextZoom);
  }, [getTimelineXFromClientX, onZoomChange, pixelsToTime, stopPanInertia, totalDuration, zoom]);

  const cycleTimeDisplayMode = useCallback(() => {
    setTimeDisplayMode((previous) => {
      if (previous === 'timecode') return 'seconds';
      if (previous === 'seconds') return 'frames';
      return 'timecode';
    });
  }, []);

  const cycleTimelineFps = useCallback(() => {
    setTimelineFps((previous) => {
      const presets = [23.976, 24, 25, 29.97, 30, 50, 60];
      const currentIndex = presets.findIndex((fps) => Math.abs(fps - previous) < 0.001);
      return presets[(currentIndex + 1) % presets.length];
    });
  }, []);

  const selectAllVisibleClips = useCallback(() => {
    const clipIds = visibleClips.map((clip) => clip.id);
    if (clipIds.length > 0) {
      selectMultipleClipsDeterministic(clipIds);
    }
  }, [selectMultipleClipsDeterministic, visibleClips]);

  const selectClipsOnSelectedTrack = useCallback(() => {
    if (!selectedTrackId) {
      return;
    }
    const clipIds = visibleClips
      .filter((clip) => clip.trackId === selectedTrackId)
      .map((clip) => clip.id);
    if (clipIds.length > 0) {
      selectMultipleClipsDeterministic(clipIds);
    }
  }, [selectMultipleClipsDeterministic, selectedTrackId, visibleClips]);

  const selectClipsInCurrentInOut = useCallback(() => {
    if (inPoint === null || outPoint === null) {
      return;
    }
    const rangeStart = Math.min(inPoint, outPoint);
    const rangeEnd = Math.max(inPoint, outPoint);
    const clipIds = visibleClips
      .filter((clip) => clip.start + clip.duration >= rangeStart && clip.start <= rangeEnd)
      .map((clip) => clip.id);
    if (clipIds.length > 0) {
      selectMultipleClipsDeterministic(clipIds);
    }
  }, [inPoint, outPoint, selectMultipleClipsDeterministic, visibleClips]);

  const jumpToAdjacentEditPoint = useCallback((direction: -1 | 1) => {
    const editPoints = new Set<number>();
    editPoints.add(0);
    editPoints.add(totalDuration);
    for (const clip of clips) {
      editPoints.add(clampNumber(clip.start, 0, totalDuration));
      editPoints.add(clampNumber(clip.start + clip.duration, 0, totalDuration));
    }
    for (const marker of allMarkers) {
      editPoints.add(clampNumber(marker.time, 0, totalDuration));
    }
    if (inPoint !== null) {
      editPoints.add(clampNumber(inPoint, 0, totalDuration));
    }
    if (outPoint !== null) {
      editPoints.add(clampNumber(outPoint, 0, totalDuration));
    }
    const ordered = Array.from(editPoints).sort((left, right) => left - right);
    if (ordered.length === 0) {
      return;
    }
    if (direction < 0) {
      for (let index = ordered.length - 1; index >= 0; index -= 1) {
        if (ordered[index] < currentTime - 0.0001) {
          setPlayheadTime(ordered[index]);
          return;
        }
      }
      setPlayheadTime(ordered[0]);
      return;
    }
    for (let index = 0; index < ordered.length; index += 1) {
      if (ordered[index] > currentTime + 0.0001) {
        setPlayheadTime(ordered[index]);
        return;
      }
    }
    setPlayheadTime(ordered[ordered.length - 1]);
  }, [allMarkers, clips, currentTime, inPoint, outPoint, setPlayheadTime, totalDuration]);

  const jumpToSelectionBoundary = useCallback((edge: 'start' | 'end') => {
    if (selectedClipList.length === 0) {
      return;
    }
    if (edge === 'start') {
      setPlayheadTime(selectedClipList[0].start);
      return;
    }
    const end = selectedClipList.reduce(
      (max, clip) => Math.max(max, clip.start + clip.duration),
      selectedClipList[0].start + selectedClipList[0].duration
    );
    setPlayheadTime(end);
  }, [selectedClipList, setPlayheadTime]);

  const setInOutFromSelection = useCallback(() => {
    if (selectedClipList.length === 0) {
      return;
    }
    const selectionStart = selectedClipList[0].start;
    const selectionEnd = selectedClipList.reduce(
      (max, clip) => Math.max(max, clip.start + clip.duration),
      selectionStart + selectedClipList[0].duration
    );
    setInPoint(selectionStart);
    setOutPoint(selectionEnd);
  }, [selectedClipList]);

  const alignSelectionToPlayhead = useCallback((anchor: 'start' | 'end' | 'center') => {
    if (selectedClipList.length === 0) {
      return;
    }
    const referenceClip = selectedClipList[0];
    const referencePoint = anchor === 'start'
      ? referenceClip.start
      : anchor === 'end'
        ? referenceClip.start + referenceClip.duration
        : referenceClip.start + referenceClip.duration / 2;
    const delta = currentTime - referencePoint;
    for (const clip of selectedClipList) {
      const maxStart = Math.max(0, totalDuration - clip.duration);
      const nextStart = clampNumber(clip.start + delta, 0, maxStart);
      if (Math.abs(nextStart - clip.start) < DRAG_COMMIT_EPSILON_SECONDS) {
        continue;
      }
      onClipMove(clip.id, nextStart, clip.trackId);
    }
  }, [currentTime, onClipMove, selectedClipList, totalDuration]);

  const shiftTrackClipsAtOrAfter = useCallback((
    trackId: string,
    startTimeInclusive: number,
    deltaSeconds: number,
    excludedClipIds?: Set<string>
  ) => {
    if (Math.abs(deltaSeconds) < DRAG_COMMIT_EPSILON_SECONDS) {
      return;
    }
    for (const clip of visibleClips) {
      if (clip.trackId !== trackId) {
        continue;
      }
      if (excludedClipIds?.has(clip.id)) {
        continue;
      }
      if (clip.start + DRAG_COMMIT_EPSILON_SECONDS < startTimeInclusive) {
        continue;
      }
      const maxStart = Math.max(0, totalDuration - clip.duration);
      const nextStart = clampNumber(clip.start + deltaSeconds, 0, maxStart);
      if (Math.abs(nextStart - clip.start) < DRAG_COMMIT_EPSILON_SECONDS) {
        continue;
      }
      onClipMove(clip.id, nextStart, trackId);
    }
  }, [onClipMove, totalDuration, visibleClips]);

  const trimSelectionToPlayhead = useCallback((edge: 'left' | 'right', ripple: boolean) => {
    if (!onClipResize || selectedClipList.length === 0) {
      return;
    }
    for (const clip of selectedClipList) {
      const clipEnd = clip.start + clip.duration;
      if (edge === 'left') {
        if (currentTime >= clipEnd - MIN_CLIP_DURATION_SECONDS || currentTime <= clip.start) {
          continue;
        }
        const previousStart = clip.start;
        const newStart = clampNumber(currentTime, 0, clipEnd - MIN_CLIP_DURATION_SECONDS);
        const newDuration = Math.max(MIN_CLIP_DURATION_SECONDS, clipEnd - newStart);
        onClipResize(clip.id, newStart, newDuration, 'resize-left');
        if (ripple) {
          const delta = newStart - previousStart;
          if (delta > DRAG_COMMIT_EPSILON_SECONDS) {
            shiftTrackClipsAtOrAfter(clip.trackId, clipEnd, -delta, new Set([clip.id]));
          }
        }
        continue;
      }
      if (currentTime <= clip.start + MIN_CLIP_DURATION_SECONDS || currentTime >= clipEnd) {
        continue;
      }
      const previousDuration = clip.duration;
      const newDuration = Math.max(MIN_CLIP_DURATION_SECONDS, currentTime - clip.start);
      onClipResize(clip.id, clip.start, newDuration, 'resize-right');
      if (ripple) {
        const delta = previousDuration - newDuration;
        if (delta > DRAG_COMMIT_EPSILON_SECONDS) {
          shiftTrackClipsAtOrAfter(clip.trackId, clipEnd, -delta, new Set([clip.id]));
        }
      }
    }
  }, [currentTime, onClipResize, selectedClipList, shiftTrackClipsAtOrAfter]);

  const closeGapOnTrackAtTime = useCallback((trackId: string, timeSeconds: number) => {
    const trackClips = visibleClips
      .filter((clip) => clip.trackId === trackId)
      .sort((left, right) => left.start - right.start);
    if (trackClips.length === 0) {
      return;
    }
    const nextClip = trackClips.find((clip) => clip.start >= timeSeconds + DRAG_COMMIT_EPSILON_SECONDS);
    if (!nextClip) {
      return;
    }
    const previousClip = [...trackClips]
      .reverse()
      .find((clip) => clip.start + clip.duration <= nextClip.start + DRAG_COMMIT_EPSILON_SECONDS);
    const previousEnd = previousClip ? previousClip.start + previousClip.duration : 0;
    const gapDuration = nextClip.start - Math.max(previousEnd, timeSeconds);
    if (gapDuration <= DRAG_COMMIT_EPSILON_SECONDS) {
      return;
    }
    shiftTrackClipsAtOrAfter(trackId, nextClip.start, -gapDuration);
  }, [shiftTrackClipsAtOrAfter, visibleClips]);

  const closeGapsAllTracksAtTime = useCallback((timeSeconds: number) => {
    for (const track of tracks) {
      if (trackStates[track.id]?.locked) {
        continue;
      }
      closeGapOnTrackAtTime(track.id, timeSeconds);
    }
  }, [closeGapOnTrackAtTime, trackStates, tracks]);

  const duplicateSelectionWithOffset = useCallback((_offsetSeconds: number) => {
    if (!onContextMenuAction || selectedClipList.length === 0) {
      return;
    }
    for (const clip of selectedClipList) {
      onContextMenuAction('duplicate', { clipId: clip.id });
    }
  }, [onContextMenuAction, selectedClipList]);

  const moveSelectionToTrackBoundary = useCallback((boundary: 'top' | 'bottom') => {
    if (selectedClipList.length === 0 || tracks.length === 0) {
      return;
    }
    const fallbackTrack = boundary === 'top' ? tracks[0] : tracks[tracks.length - 1];
    if (!fallbackTrack || trackStates[fallbackTrack.id]?.locked) {
      return;
    }
    for (const clip of selectedClipList) {
      onClipMove(clip.id, clip.start, fallbackTrack.id);
    }
    setSelectedTrackId(fallbackTrack.id);
  }, [onClipMove, selectedClipList, trackStates, tracks]);

  const extractSelectedWithRipple = useCallback(() => {
    if (!onContextMenuAction || selectedClipList.length === 0) {
      return;
    }
    for (const clip of selectedClipList) {
      onContextMenuAction('delete', { clipId: clip.id });
    }
    if (!rippleEnabled) {
      return;
    }
    const selectedIds = new Set(selectedClipList.map((clip) => clip.id));
    const selectedByTrack = new Map<string, BeatClip[]>();
    for (const clip of selectedClipList) {
      const existing = selectedByTrack.get(clip.trackId);
      if (existing) {
        existing.push(clip);
      } else {
        selectedByTrack.set(clip.trackId, [clip]);
      }
    }
    for (const [trackId, removedClips] of selectedByTrack.entries()) {
      const orderedRemoved = [...removedClips].sort((left, right) => left.start - right.start);
      for (const clip of visibleClips) {
        if (clip.trackId !== trackId || selectedIds.has(clip.id)) {
          continue;
        }
        const shiftAmount = orderedRemoved.reduce((accumulator, removedClip) => {
          const removedEnd = removedClip.start + removedClip.duration;
          if (clip.start + DRAG_COMMIT_EPSILON_SECONDS >= removedEnd) {
            return accumulator + removedClip.duration;
          }
          return accumulator;
        }, 0);
        if (shiftAmount <= DRAG_COMMIT_EPSILON_SECONDS) {
          continue;
        }
        const maxStart = Math.max(0, totalDuration - clip.duration);
        const nextStart = clampNumber(clip.start - shiftAmount, 0, maxStart);
        if (Math.abs(nextStart - clip.start) < DRAG_COMMIT_EPSILON_SECONDS) {
          continue;
        }
        onClipMove(clip.id, nextStart, trackId);
      }
    }
  }, [onClipMove, onContextMenuAction, rippleEnabled, selectedClipList, totalDuration, visibleClips]);

  const cycleSelectedTrackType = useCallback(() => {
    if (!selectedTrackId || !onTrackTypeChange || trackStates[selectedTrackId]?.locked) {
      return;
    }
    const options: Array<NonNullable<TrackState['type']>> = ['video', 'audio', 'adjustment', 'subtitle', 'graphics'];
    const currentType = trackStates[selectedTrackId]?.type ?? tracks.find((track) => track.id === selectedTrackId)?.type ?? 'video';
    const currentIndex = options.findIndex((option) => option === currentType);
    const nextType = options[(Math.max(0, currentIndex) + 1) % options.length];
    onTrackTypeChange(selectedTrackId, nextType);
  }, [onTrackTypeChange, selectedTrackId, trackStates, tracks]);

  const cycleSelectedTrackAudioRole = useCallback(() => {
    if (!selectedTrackId || !onTrackAudioRoleChange || trackStates[selectedTrackId]?.locked) {
      return;
    }
    const currentRole = trackStates[selectedTrackId]?.audioRole ?? 'dialogue';
    const currentIndex = AUDIO_TRACK_ROLE_OPTIONS.findIndex((option) => option.value === currentRole);
    const nextRole = AUDIO_TRACK_ROLE_OPTIONS[(Math.max(0, currentIndex) + 1) % AUDIO_TRACK_ROLE_OPTIONS.length].value;
    onTrackAudioRoleChange(selectedTrackId, nextRole);
  }, [onTrackAudioRoleChange, selectedTrackId, trackStates]);

  const cycleSelectedTrackAutomation = useCallback(() => {
    if (!selectedTrackId || !onTrackToggle || trackStates[selectedTrackId]?.locked) {
      return;
    }
    const currentMode = trackStates[selectedTrackId]?.automationMode ?? 'read';
    const currentIndex = TRACK_AUTOMATION_MODE_OPTIONS.findIndex((option) => option.value === currentMode);
    const nextMode = TRACK_AUTOMATION_MODE_OPTIONS[(Math.max(0, currentIndex) + 1) % TRACK_AUTOMATION_MODE_OPTIONS.length].value;
    onTrackToggle(selectedTrackId, { automationMode: nextMode });
  }, [onTrackToggle, selectedTrackId, trackStates]);

  const cycleSelectedTrackColor = useCallback(() => {
    if (!selectedTrackId || !onTrackToggle || trackStates[selectedTrackId]?.locked) {
      return;
    }
    const currentColor = trackStates[selectedTrackId]?.color;
    const currentIndex = TRACK_COLOR_PRESETS.findIndex((preset) => preset === currentColor);
    const nextColor = TRACK_COLOR_PRESETS[(Math.max(-1, currentIndex) + 1) % TRACK_COLOR_PRESETS.length];
    onTrackToggle(selectedTrackId, { color: nextColor });
  }, [onTrackToggle, selectedTrackId, trackStates]);

  const toggleSelectedTrackRecordArm = useCallback(() => {
    if (!selectedTrackId || !onTrackToggle || trackStates[selectedTrackId]?.locked) {
      return;
    }
    const current = Boolean(trackStates[selectedTrackId]?.recordArmed);
    onTrackToggle(selectedTrackId, { recordArmed: !current });
  }, [onTrackToggle, selectedTrackId, trackStates]);

  const toggleSelectedTrackInputMonitoring = useCallback(() => {
    if (!selectedTrackId || !onTrackToggle || trackStates[selectedTrackId]?.locked) {
      return;
    }
    const current = Boolean(trackStates[selectedTrackId]?.inputMonitoring);
    onTrackToggle(selectedTrackId, { inputMonitoring: !current });
  }, [onTrackToggle, selectedTrackId, trackStates]);

  const handleTimelineKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const tagName = target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return;
    }
    if (target.isContentEditable) {
      return;
    }
    const key = e.key.toLowerCase();

    if (key === ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && key === 'a' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      selectAllVisibleClips();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'a' && e.shiftKey && !e.altKey) {
      e.preventDefault();
      selectClipsOnSelectedTrack();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'a' && e.altKey) {
      e.preventDefault();
      selectClipsInCurrentInOut();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === '1' && onZoomChange) {
      e.preventDefault();
      onZoomChange(0.25);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === '2' && onZoomChange) {
      e.preventDefault();
      onZoomChange(0.5);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === '3' && onZoomChange) {
      e.preventDefault();
      onZoomChange(1);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === '4' && onZoomChange) {
      e.preventDefault();
      onZoomChange(2);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === '5' && onZoomChange) {
      e.preventDefault();
      onZoomChange(4);
      return;
    }
    if (key === '\\' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      zoomToProject();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === '\\') {
      e.preventDefault();
      zoomToSelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === ';') {
      e.preventDefault();
      jumpToAdjacentEditPoint(-1);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (key === "'" || key === 'quote')) {
      e.preventDefault();
      jumpToAdjacentEditPoint(1);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'g' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      setInOutFromSelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'i' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      jumpToSelectionBoundary('start');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'o' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      jumpToSelectionBoundary('end');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === '[' && !e.altKey) {
      e.preventDefault();
      trimSelectionToPlayhead('left', false);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === ']' && !e.altKey) {
      e.preventDefault();
      trimSelectionToPlayhead('right', false);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '[') {
      e.preventDefault();
      trimSelectionToPlayhead('left', true);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === ']') {
      e.preventDefault();
      trimSelectionToPlayhead('right', true);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === 'left') {
      e.preventDefault();
      if (selectedTrackId) {
        closeGapOnTrackAtTime(selectedTrackId, currentTime);
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === 'right') {
      e.preventDefault();
      closeGapsAllTracksAtTime(currentTime);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === 's') {
      e.preventDefault();
      alignSelectionToPlayhead('start');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === 'e') {
      e.preventDefault();
      alignSelectionToPlayhead('end');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === 'c') {
      e.preventDefault();
      alignSelectionToPlayhead('center');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'arrowup') {
      e.preventDefault();
      moveSelectionToTrackBoundary('top');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'arrowdown') {
      e.preventDefault();
      moveSelectionToTrackBoundary('bottom');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === 't') {
      e.preventDefault();
      cycleSelectedTrackType();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === 'r') {
      e.preventDefault();
      cycleSelectedTrackAudioRole();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === 'm') {
      e.preventDefault();
      cycleSelectedTrackAutomation();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === 'k') {
      e.preventDefault();
      cycleSelectedTrackColor();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '9') {
      e.preventDefault();
      toggleSelectedTrackRecordArm();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '0') {
      e.preventDefault();
      toggleSelectedTrackInputMonitoring();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'd') {
      e.preventDefault();
      duplicateSelectionWithOffset(frameStepSeconds * 8);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'f') {
      e.preventDefault();
      cycleTimelineFps();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 't') {
      e.preventDefault();
      cycleTimeDisplayMode();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'j') {
      e.preventDefault();
      setPlayheadTime(currentTime - TIMELINE_SCROLL_STEP_SECONDS * 10);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'k') {
      e.preventDefault();
      setPlayheadTime(currentTime);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'l') {
      e.preventDefault();
      setPlayheadTime(currentTime + TIMELINE_SCROLL_STEP_SECONDS * 10);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'm') {
      e.preventDefault();
      if (selectedClipList.length > 0) {
        addEphemeralMarker(selectedClipList[0].start, 'Clip In');
        const endTime = selectedClipList.reduce(
          (max, clip) => Math.max(max, clip.start + clip.duration),
          selectedClipList[0].start + selectedClipList[0].duration
        );
        addEphemeralMarker(endTime, 'Clip Out');
      } else {
        addEphemeralMarker(currentTime, 'Marker');
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === ';') {
      e.preventDefault();
      jumpToPreviousMarker();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (key === "'" || key === 'quote')) {
      e.preventDefault();
      jumpToNextMarker();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'i') {
      e.preventDefault();
      if (selectedClipList.length > 0) {
        setInPointAtTime(selectedClipList[0].start);
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && key === 'o') {
      e.preventDefault();
      if (selectedClipList.length > 0) {
        const selectionEnd = selectedClipList.reduce(
          (max, clip) => Math.max(max, clip.start + clip.duration),
          selectedClipList[0].start + selectedClipList[0].duration
        );
        setOutPointAtTime(selectionEnd);
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '1') {
      e.preventDefault();
      setWorkspaceMode('cut');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '2') {
      e.preventDefault();
      setWorkspaceMode('edit');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '3') {
      e.preventDefault();
      setWorkspaceMode('color');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '4') {
      e.preventDefault();
      setWorkspaceMode('fairlight');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '5') {
      e.preventDefault();
      setWorkspaceMode('deliver');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '6') {
      e.preventDefault();
      setSafeTrimEnabled((previous) => !previous);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '7') {
      e.preventDefault();
      setSnappingEnabled((previous) => !previous);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '8') {
      e.preventDefault();
      setMagneticEnabled((previous) => !previous);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.altKey && key === '9') {
      e.preventDefault();
      setRippleEnabled((previous) => !previous);
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.key === '1') {
        e.preventDefault();
        setWorkspaceMode('cut');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        setWorkspaceMode('edit');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        setWorkspaceMode('color');
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        setWorkspaceMode('fairlight');
        return;
      }
      if (e.key === '5') {
        e.preventDefault();
        setWorkspaceMode('deliver');
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        jumpToAdjacentEditPoint(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        jumpToAdjacentEditPoint(1);
        return;
      }
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (key === 'b') {
        e.preventDefault();
        setInsertOverwriteMode('insert');
        return;
      }
      if (key === 'n') {
        e.preventDefault();
        setInsertOverwriteMode('overwrite');
        return;
      }
      if (key === 'p') {
        e.preventDefault();
        setInsertOverwriteMode((previous) => previous === 'insert' ? 'overwrite' : 'insert');
        return;
      }
      if (key === 'f') {
        e.preventDefault();
        zoomToSelection();
        return;
      }
      if (key === 'j') {
        e.preventDefault();
        setPlayheadTime(currentTime - TIMELINE_SCROLL_STEP_SECONDS * 3);
        return;
      }
      if (key === 'k') {
        e.preventDefault();
        setPlayheadTime(currentTime);
        return;
      }
      if (key === 'l') {
        e.preventDefault();
        setPlayheadTime(currentTime + TIMELINE_SCROLL_STEP_SECONDS * 3);
        return;
      }
      if (key === 'e') {
        e.preventDefault();
        extractSelectedWithRipple();
        return;
      }
      if (key === 'z') {
        e.preventDefault();
        setSnappingEnabled((previous) => !previous);
        return;
      }
      if (key === '9') {
        e.preventDefault();
        setRippleEnabled((previous) => !previous);
        return;
      }
      if (key === '8') {
        e.preventDefault();
        setMagneticEnabled((previous) => !previous);
        return;
      }
      if (key === '6') {
        e.preventDefault();
        setSafeTrimEnabled((previous) => !previous);
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setToolMode('select');
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        setToolMode('trim');
        return;
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setToolMode('roll');
        return;
      }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        setToolMode('slip');
        return;
      }
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        setToolMode('slide');
        return;
      }
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setToolMode('razor');
        return;
      }
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        if (selectedClipList.length === 0) {
          return;
        }
        const primaryClip = selectedClipList[0];
        const targetTrackId = selectedTrackId ?? primaryClip.trackId;
        if (trackStates[targetTrackId]?.locked) {
          return;
        }
        const targetStart = normalizeTimelineTime(currentTime);
        if (rippleEnabled) {
          const excludedClipIds = new Set(selectedClipList.map((clip) => clip.id));
          for (const clip of visibleClips) {
            if (clip.trackId !== targetTrackId || excludedClipIds.has(clip.id)) {
              continue;
            }
            if (clip.start + DRAG_COMMIT_EPSILON_SECONDS < targetStart) {
              continue;
            }
            const maxStart = Math.max(0, totalDuration - clip.duration);
            const nextStart = clampNumber(clip.start + primaryClip.duration, 0, maxStart);
            onClipMove(clip.id, nextStart, targetTrackId);
          }
        }
        const maxStart = Math.max(0, totalDuration - primaryClip.duration);
        onClipMove(primaryClip.id, clampNumber(targetStart, 0, maxStart), targetTrackId);
        setSelectedTrackId(targetTrackId);
        return;
      }
      if (e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        if (selectedClipList.length === 0) {
          return;
        }
        const primaryClip = selectedClipList[0];
        const targetTrackId = selectedTrackId ?? primaryClip.trackId;
        if (trackStates[targetTrackId]?.locked) {
          return;
        }
        const targetStart = normalizeTimelineTime(currentTime);
        const maxStart = Math.max(0, totalDuration - primaryClip.duration);
        onClipMove(primaryClip.id, clampNumber(targetStart, 0, maxStart), targetTrackId);
        setSelectedTrackId(targetTrackId);
        return;
      }
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        if (onContextMenuAction) {
          for (const clip of selectedClipList) {
            onContextMenuAction('delete', { clipId: clip.id });
          }
        }
        return;
      }
      if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        if (selectedClipList.length === 0 || !onContextMenuAction) {
          return;
        }
        const selectedIds = new Set(selectedClipList.map((clip) => clip.id));
        for (const clip of selectedClipList) {
          onContextMenuAction('delete', { clipId: clip.id });
        }
        if (rippleEnabled) {
          const selectedByTrack = new Map<string, BeatClip[]>();
          for (const clip of selectedClipList) {
            const existing = selectedByTrack.get(clip.trackId);
            if (existing) {
              existing.push(clip);
            } else {
              selectedByTrack.set(clip.trackId, [clip]);
            }
          }
          for (const [trackId, removedClips] of selectedByTrack.entries()) {
            const orderedRemoved = [...removedClips].sort((left, right) => left.start - right.start);
            for (const clip of visibleClips) {
              if (clip.trackId !== trackId || selectedIds.has(clip.id)) {
                continue;
              }
              const shiftAmount = orderedRemoved.reduce((accumulator, removedClip) => {
                const removedEnd = removedClip.start + removedClip.duration;
                if (clip.start + DRAG_COMMIT_EPSILON_SECONDS >= removedEnd) {
                  return accumulator + removedClip.duration;
                }
                return accumulator;
              }, 0);
              if (shiftAmount <= DRAG_COMMIT_EPSILON_SECONDS) {
                continue;
              }
              const maxStart = Math.max(0, totalDuration - clip.duration);
              const nextStart = clampNumber(clip.start - shiftAmount, 0, maxStart);
              onClipMove(clip.id, nextStart, trackId);
            }
          }
        }
        return;
      }
    }

    const seekStep = e.altKey
      ? TIMELINE_FINE_SCROLL_STEP_SECONDS
      : e.shiftKey
        ? TIMELINE_SCROLL_STEP_SECONDS * 5
        : TIMELINE_SCROLL_STEP_SECONDS;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPlayheadTime(currentTime - seekStep);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPlayheadTime(currentTime + seekStep);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      setPlayheadTime(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      setPlayheadTime(totalDuration);
      return;
    }
    if (e.key === '0') {
      if (!onZoomChange) return;
      e.preventDefault();
      onZoomChange(TIMELINE_DEFAULT_ZOOM);
      return;
    }
    if (e.key === '+' || e.key === '=') {
      if (!onZoomChange) return;
      e.preventDefault();
      onZoomChange(clampNumber(zoom * 1.12, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM));
      return;
    }
    if (e.key === '-' || e.key === '_') {
      if (!onZoomChange) return;
      e.preventDefault();
      onZoomChange(clampNumber(zoom / 1.12, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM));
      return;
    }
    if (e.key === 'PageDown' && timelineRef.current) {
      e.preventDefault();
      timelineRef.current.scrollLeft += Math.round(timelineRef.current.clientWidth * 0.85);
      return;
    }
    if (e.key === 'PageUp' && timelineRef.current) {
      e.preventDefault();
      timelineRef.current.scrollLeft -= Math.round(timelineRef.current.clientWidth * 0.85);
      return;
    }
    if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      addEphemeralMarker(currentTime, 'Marker');
      return;
    }
    if (e.key === 'i' || e.key === 'I' || e.key === '[') {
      e.preventDefault();
      setInPoint(currentTime);
      if (outPoint !== null && outPoint < currentTime) {
        setOutPoint(currentTime);
      }
      return;
    }
    if (e.key === 'o' || e.key === 'O' || e.key === ']') {
      e.preventDefault();
      setOutPoint(currentTime);
      if (inPoint !== null && inPoint > currentTime) {
        setInPoint(currentTime);
      }
      return;
    }
    if (e.key === ';' && inPoint !== null) {
      e.preventDefault();
      setPlayheadTime(inPoint);
      return;
    }
    if ((e.key === "'" || e.key === 'Quote') && outPoint !== null) {
      e.preventDefault();
      setPlayheadTime(outPoint);
      return;
    }
    if ((e.key === ',' || e.key === '<') && selectedClipList.length > 0) {
      e.preventDefault();
      if (e.altKey) {
        trimSelectedClipEdges(-frameStepSeconds, e.shiftKey ? 'left' : 'right');
      } else {
        nudgeSelectedClips(-frameStepSeconds);
      }
      return;
    }
    if ((e.key === '.' || e.key === '>') && selectedClipList.length > 0) {
      e.preventDefault();
      if (e.altKey) {
        trimSelectedClipEdges(frameStepSeconds, e.shiftKey ? 'left' : 'right');
      } else {
        nudgeSelectedClips(frameStepSeconds);
      }
      return;
    }
    if (e.key === 'ArrowUp' && e.altKey && selectedClipList.length > 0) {
      e.preventDefault();
      moveSelectedClipsToAdjacentTrack(-1);
      return;
    }
    if (e.key === 'ArrowDown' && e.altKey && selectedClipList.length > 0) {
      e.preventDefault();
      moveSelectedClipsToAdjacentTrack(1);
      return;
    }
    if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey) && selectedClipList.length > 0) {
      e.preventDefault();
      if (onContextMenuAction) {
        for (const clip of selectedClipList) {
          onContextMenuAction('duplicate', { clipId: clip.id });
        }
      }
      return;
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && selectedClipList.length > 0) {
      e.preventDefault();
      if (onContextMenuAction) {
        for (const clip of selectedClipList) {
          onContextMenuAction('delete', { clipId: clip.id });
        }
      }
      return;
    }
    if ((e.key === 's' || e.key === 'S') && selectedClipList.length > 0 && !e.altKey) {
      e.preventDefault();
      if (onContextMenuAction) {
        const candidateFromSelection = selectedClipList.find((clip) => (
          currentTime > clip.start + frameStepSeconds &&
          currentTime < clip.start + clip.duration - frameStepSeconds
        ));
        const targetClip = candidateFromSelection ?? findClipAtTime(currentTime);
        if (targetClip) {
          onContextMenuAction('split', { clipId: targetClip.id });
        }
      }
      return;
    }
    if (e.key === 'v' || e.key === 'V') {
      const clipAtPlayhead = findClipAtTime(currentTime);
      if (clipAtPlayhead) {
        e.preventDefault();
        selectSingleClip(clipAtPlayhead.id);
        setSelectedTrackId(clipAtPlayhead.trackId);
      }
      return;
    }
    if ((e.key === 'l' || e.key === 'L') && selectedTrackId && onTrackToggle) {
      e.preventDefault();
      const state = trackStates[selectedTrackId] ?? EMPTY_TRACK_STATE;
      onTrackToggle(selectedTrackId, { locked: !state.locked });
      return;
    }
    if ((e.key === 'm' || e.key === 'M') && selectedTrackId && onTrackToggle && e.altKey) {
      e.preventDefault();
      const state = trackStates[selectedTrackId] ?? EMPTY_TRACK_STATE;
      onTrackToggle(selectedTrackId, { mute: !state.mute });
      return;
    }
    if ((e.key === 's' || e.key === 'S') && selectedTrackId && onTrackToggle && e.altKey) {
      e.preventDefault();
      const state = trackStates[selectedTrackId] ?? EMPTY_TRACK_STATE;
      onTrackToggle(selectedTrackId, { solo: !state.solo });
      return;
    }
    if ((e.key === 'h' || e.key === 'H') && selectedTrackId && onTrackToggle) {
      e.preventDefault();
      const state = trackStates[selectedTrackId] ?? EMPTY_TRACK_STATE;
      onTrackToggle(selectedTrackId, { visible: !(state.visible !== false) });
      return;
    }
  }, [
    alignSelectionToPlayhead,
    addEphemeralMarker,
    closeGapOnTrackAtTime,
    closeGapsAllTracksAtTime,
    currentTime,
    cycleSelectedTrackAudioRole,
    cycleSelectedTrackAutomation,
    cycleSelectedTrackColor,
    cycleSelectedTrackType,
    cycleTimeDisplayMode,
    cycleTimelineFps,
    duplicateSelectionWithOffset,
    extractSelectedWithRipple,
    findClipAtTime,
    frameStepSeconds,
    inPoint,
    jumpToAdjacentEditPoint,
    jumpToSelectionBoundary,
    moveSelectionToTrackBoundary,
    moveSelectedClipsToAdjacentTrack,
    nudgeSelectedClips,
    onContextMenuAction,
    onTrackToggle,
    onZoomChange,
    outPoint,
    selectSingleClip,
    selectedTrackId,
    selectedClipList,
    selectAllVisibleClips,
    selectClipsInCurrentInOut,
    selectClipsOnSelectedTrack,
    setInOutFromSelection,
    setInsertOverwriteMode,
    setMagneticEnabled,
    setPlayheadTime,
    setRippleEnabled,
    setSafeTrimEnabled,
    setSnappingEnabled,
    trackStates,
    trimSelectionToPlayhead,
    toggleSelectedTrackInputMonitoring,
    toggleSelectedTrackRecordArm,
    totalDuration,
    trimSelectedClipEdges,
    zoomToProject,
    zoomToSelection,
    zoom,
  ]);

  const openContextMenu = useCallback((e: React.MouseEvent<HTMLElement>, clipId: string) => {
    if (!onContextMenuAction) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    selectSingleClip(clipId);
    setSelectedClipIdForMenu(clipId);
    setMenuClipId(clipId);
    setMenuAnchor(e.currentTarget);
  }, [onContextMenuAction, selectSingleClip]);
  const closeContextMenu = () => {
    setSelectedClipIdForMenu(null);
    setMenuClipId(null);
    setMenuAnchor(null);
  };

  const handleMenu = (action: string, extra?: Record<string, unknown>) => {
    if (!menuClipId || !onContextMenuAction) {
      closeContextMenu();
      return;
    }
    onContextMenuAction(action, { clipId: menuClipId, ...extra });
    closeContextMenu();
  };

  const parseDroppedMedia = useCallback((event: React.DragEvent): {
    id?: string;
    name?: string;
    url?: string;
    type?: string;
    mimeType?: string;
    duration?: number;
    camera?: string;
    syncGroup?: string;
    tags?: string[];
  } | null => {
    const parseStructuredPayload = (): {
      id?: string;
      name?: string;
      url?: string;
      type?: string;
      mimeType?: string;
      duration?: number;
      camera?: string;
      syncGroup?: string;
      tags?: string[];
    } | null => {
      const rawPayload = event.dataTransfer.getData('application/x-storyarc-media');
      if (!rawPayload) {
        return null;
      }
      try {
        const parsedUnknown: unknown = JSON.parse(rawPayload);
        if (!parsedUnknown || typeof parsedUnknown !== 'object') {
          return null;
        }
        const parsed = parsedUnknown as Record<string, unknown>;
        const url = typeof parsed.url === 'string' ? parsed.url.trim() : '';
        if (!url) {
          return null;
        }
        return {
          id: typeof parsed.id === 'string' ? parsed.id : undefined,
          name: typeof parsed.name === 'string' ? parsed.name : undefined,
          url,
          type: typeof parsed.type === 'string' ? parsed.type : undefined,
          mimeType: typeof parsed.mimeType === 'string' ? parsed.mimeType : undefined,
          duration: Number.isFinite(Number(parsed.duration)) ? Number(parsed.duration) : undefined,
          camera: typeof parsed.camera === 'string' ? parsed.camera : undefined,
          syncGroup: typeof parsed.syncGroup === 'string' ? parsed.syncGroup : undefined,
          tags: Array.isArray(parsed.tags)
            ? parsed.tags.filter((tag): tag is string => typeof tag === 'string')
            : undefined,
        };
      } catch {
        return null;
      }
    };

    const structuredPayload = parseStructuredPayload();
    if (structuredPayload) {
      return structuredPayload;
    }

    const uriList = event.dataTransfer.getData('text/uri-list').trim();
    if (uriList) {
      const urlCandidate = uriList.split('\n').find((line) => line.trim() && !line.startsWith('#'));
      if (urlCandidate) {
        return {
          url: urlCandidate.trim(),
          name: urlCandidate.split('/').pop() || 'Dropped media',
          type: 'video',
        };
      }
    }

    const plainText = event.dataTransfer.getData('text/plain').trim();
    if (plainText && /^https?:\/\//i.test(plainText)) {
      return {
        url: plainText,
        name: plainText.split('/').pop() || 'Dropped media',
        type: 'video',
      };
    }

    if (event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      const objectUrl = URL.createObjectURL(file);
      createdObjectUrlsRef.current.push(objectUrl);
      return {
        id: file.name,
        name: file.name,
        url: objectUrl,
        type: file.type.startsWith('audio/') ? 'audio' : 'video',
        mimeType: file.type || undefined,
      };
    }

    return null;
  }, []);

  const isTrackCompatibleWithMedia = useCallback((trackId: string, mediaMimeType?: string, mediaType?: string): boolean => {
    const trackType = trackStates[trackId]?.type ?? tracks.find((track) => track.id === trackId)?.type ?? 'video';
    const mime = (mediaMimeType || '').toLowerCase();
    const type = (mediaType || '').toLowerCase();

    const looksAudio = mime.startsWith('audio/') || type === 'audio';
    const looksVideo = mime.startsWith('video/') || mime.startsWith('image/') || type === 'video';
    if (trackType === 'audio') {
      return looksAudio || looksVideo || !mime;
    }
    if (trackType === 'video' || trackType === 'graphics' || trackType === 'subtitle' || trackType === 'adjustment') {
      return looksVideo || !mime;
    }
    return true;
  }, [trackStates, tracks]);

  const updateDropPreviewForTrack = useCallback((trackId: string, clientX: number) => {
    const rawTime = getTimelineTimeFromClientX(clientX);
    const snappedTime = normalizeTimelineTime(
      pixelsToTime(snapPx(timeToPixels(rawTime)).value)
    );
    setDropPreview((previous) => {
      if (
        previous &&
        previous.trackId === trackId &&
        previous.mode === insertOverwriteMode &&
        Math.abs(previous.time - snappedTime) < DRAG_COMMIT_EPSILON_SECONDS
      ) {
        return previous;
      }
      return {
        trackId,
        time: snappedTime,
        mode: insertOverwriteMode,
      };
    });
  }, [getTimelineTimeFromClientX, insertOverwriteMode, normalizeTimelineTime, pixelsToTime, snapPx, timeToPixels]);

  const clearDropPreview = useCallback(() => {
    setDropPreview(null);
  }, []);

  const applyMediaDropToTrack = useCallback((trackId: string, event: React.DragEvent) => {
    if (!onMediaDrop) {
      clearDropPreview();
      setDropTrackId(null);
      return;
    }
    event.preventDefault();
    const media = parseDroppedMedia(event);
    setDropTrackId(null);
    clearDropPreview();
    if (!media || !timelineRef.current) {
      if (media?.url?.startsWith('blob:')) {
        scheduleObjectUrlRevoke(media.url, 1000);
      }
      return;
    }
    if (!isTrackCompatibleWithMedia(trackId, media.mimeType, media.type)) {
      if (media.url?.startsWith('blob:')) {
        scheduleObjectUrlRevoke(media.url, 1000);
      }
      return;
    }
    const baseTime = dropPreview?.trackId === trackId
      ? dropPreview.time
      : getTimelineTimeFromClientX(event.clientX);
    const startTime = normalizeTimelineTime(baseTime);
    if (insertOverwriteMode === 'insert' && rippleEnabled) {
      const mediaDuration = Number.isFinite(media.duration) ? Number(media.duration) : 0;
      if (mediaDuration > DRAG_COMMIT_EPSILON_SECONDS) {
        for (const clip of visibleClips) {
          if (clip.trackId !== trackId) {
            continue;
          }
          if (clip.start + DRAG_COMMIT_EPSILON_SECONDS < startTime) {
            continue;
          }
          const maxStart = Math.max(0, totalDuration - clip.duration);
          const nextStart = clampNumber(clip.start + mediaDuration, 0, maxStart);
          if (Math.abs(nextStart - clip.start) < DRAG_COMMIT_EPSILON_SECONDS) {
            continue;
          }
          onClipMove(clip.id, nextStart, trackId);
        }
      }
    }
    onMediaDrop({
      media,
      trackId,
      startTime,
    });
    if (media.url?.startsWith('blob:')) {
      scheduleObjectUrlRevoke(media.url);
    }
  }, [
    clearDropPreview,
    dropPreview,
    getTimelineTimeFromClientX,
    insertOverwriteMode,
    isTrackCompatibleWithMedia,
    normalizeTimelineTime,
    onClipMove,
    onMediaDrop,
    parseDroppedMedia,
    rippleEnabled,
    scheduleObjectUrlRevoke,
    totalDuration,
    visibleClips,
  ]);

  const clipPresentationById = useMemo(() => {
    const presentation = new Map<string, {
      clipVisual: ClipVisualMetadata;
      clipMeta: ClipMetadata;
      tagChips: string[];
    }>();
    for (const clip of visibleClips) {
      const clipMeta = clipMetadata[clip.id] ?? EMPTY_CLIP_METADATA;
      const metaTags = clipMeta.tags ?? EMPTY_TAG_CHIPS;
      const sourceTags = clip.tags ?? EMPTY_TAG_CHIPS;
      const tagChips = Array.from(new Set([...metaTags, ...sourceTags])).slice(0, 3);
      presentation.set(clip.id, {
        clipVisual: toClipVisualMetadata(clip),
        clipMeta,
        tagChips: tagChips.length > 0 ? tagChips : EMPTY_TAG_CHIPS,
      });
    }
    return presentation;
  }, [clipMetadata, visibleClips]);

  const jumpToPreviousMarker = useCallback(() => {
    if (allMarkers.length === 0) {
      return;
    }
    const previousMarker = [...allMarkers]
      .reverse()
      .find((marker) => marker.time < currentTime - 0.0001);
    setPlayheadTime(previousMarker ? previousMarker.time : allMarkers[0].time);
  }, [allMarkers, currentTime, setPlayheadTime]);

  const jumpToNextMarker = useCallback(() => {
    if (allMarkers.length === 0) {
      return;
    }
    const nextMarker = allMarkers.find((marker) => marker.time > currentTime + 0.0001);
    setPlayheadTime(nextMarker ? nextMarker.time : allMarkers[allMarkers.length - 1].time);
  }, [allMarkers, currentTime, setPlayheadTime]);

  const clearEphemeralMarkerSet = useCallback(() => {
    setEphemeralMarkers([]);
  }, []);

  const clearInOutPoints = useCallback(() => {
    setInPoint(null);
    setOutPoint(null);
  }, []);

  const jumpToInPoint = useCallback(() => {
    if (inPoint === null) {
      return;
    }
    setPlayheadTime(inPoint);
  }, [inPoint, setPlayheadTime]);

  const jumpToOutPoint = useCallback(() => {
    if (outPoint === null) {
      return;
    }
    setPlayheadTime(outPoint);
  }, [outPoint, setPlayheadTime]);

  const selectClipUnderPlayhead = useCallback(() => {
    const clipAtPlayhead = findClipAtTime(currentTime);
    if (!clipAtPlayhead) {
      return;
    }
    selectSingleClip(clipAtPlayhead.id);
    setSelectedTrackId(clipAtPlayhead.trackId);
  }, [currentTime, findClipAtTime, selectSingleClip]);

  const selectTrackById = useCallback((trackId: string) => {
    setSelectedTrackId(trackId);
  }, []);

  const commitTrackRename = useCallback((trackId: string, revertToOriginal: boolean = false) => {
    const track = tracks.find((candidate) => candidate.id === trackId);
    if (!track) {
      return;
    }
    const draftValue = trackNameDrafts[trackId] ?? track.name;
    const normalizedName = revertToOriginal ? track.name : (draftValue.trim() || track.name);
    setTrackNameDrafts((previous) => ({
      ...previous,
      [trackId]: normalizedName,
    }));
    setTrackNameEditingId((current) => (current === trackId ? null : current));
    if (!revertToOriginal && onTrackRename && normalizedName !== track.name) {
      onTrackRename(trackId, normalizedName);
    }
  }, [onTrackRename, trackNameDrafts, tracks]);

  const handleTrackNameFocus = useCallback((trackId: string) => {
    setTrackNameEditingId(trackId);
  }, []);

  const handleTrackNameChange = useCallback((trackId: string, value: string) => {
    setTrackNameDrafts((previous) => ({
      ...previous,
      [trackId]: value,
    }));
  }, []);

  const dispatchContextActionForSelection = useCallback((action: string): boolean => {
    if (!onContextMenuAction || selectedClipList.length === 0) {
      return false;
    }
    for (const clip of selectedClipList) {
      onContextMenuAction(action, { clipId: clip.id });
    }
    return true;
  }, [onContextMenuAction, selectedClipList]);

  const insertSelectionAtPlayhead = useCallback(() => {
    if (selectedClipList.length === 0) {
      return;
    }
    const primaryClip = selectedClipList[0];
    const targetTrackId = selectedTrackId ?? primaryClip.trackId;
    if (trackStates[targetTrackId]?.locked) {
      return;
    }
    const targetStart = normalizeTimelineTime(currentTime);
    if (rippleEnabled) {
      const excludedClipIds = new Set(selectedClipList.map((clip) => clip.id));
      shiftTrackClipsAtOrAfter(targetTrackId, targetStart, primaryClip.duration, excludedClipIds);
    }
    const maxStart = Math.max(0, totalDuration - primaryClip.duration);
    onClipMove(primaryClip.id, clampNumber(targetStart, 0, maxStart), targetTrackId);
    setSelectedTrackId(targetTrackId);
  }, [
    currentTime,
    normalizeTimelineTime,
    onClipMove,
    rippleEnabled,
    selectedClipList,
    selectedTrackId,
    shiftTrackClipsAtOrAfter,
    totalDuration,
    trackStates,
  ]);

  const overwriteSelectionAtPlayhead = useCallback(() => {
    if (selectedClipList.length === 0) {
      return;
    }
    const primaryClip = selectedClipList[0];
    const targetTrackId = selectedTrackId ?? primaryClip.trackId;
    if (trackStates[targetTrackId]?.locked) {
      return;
    }
    const targetStart = normalizeTimelineTime(currentTime);
    const maxStart = Math.max(0, totalDuration - primaryClip.duration);
    onClipMove(primaryClip.id, clampNumber(targetStart, 0, maxStart), targetTrackId);
    setSelectedTrackId(targetTrackId);
  }, [currentTime, normalizeTimelineTime, onClipMove, selectedClipList, selectedTrackId, totalDuration, trackStates]);

  const splitSelectionAtPlayhead = useCallback(() => {
    if (!onContextMenuAction) {
      return;
    }
    const candidateFromSelection = selectedClipList.find((clip) => (
      currentTime > clip.start + frameStepSeconds &&
      currentTime < clip.start + clip.duration - frameStepSeconds
    ));
    const targetClip = candidateFromSelection ?? findClipAtTime(currentTime);
    if (!targetClip) {
      return;
    }
    onContextMenuAction('split', { clipId: targetClip.id });
  }, [currentTime, findClipAtTime, frameStepSeconds, onContextMenuAction, selectedClipList]);

  const duplicateSelection = useCallback(() => {
    dispatchContextActionForSelection('duplicate');
  }, [dispatchContextActionForSelection]);

  const deleteSelection = useCallback(() => {
    dispatchContextActionForSelection('delete');
  }, [dispatchContextActionForSelection]);

  const liftSelection = useCallback(() => {
    dispatchContextActionForSelection('delete');
  }, [dispatchContextActionForSelection]);

  const extractSelection = useCallback(() => {
    if (selectedClipList.length === 0) {
      return;
    }
    if (!dispatchContextActionForSelection('delete')) {
      return;
    }
    if (!rippleEnabled) {
      return;
    }
    const selectedIds = new Set(selectedClipList.map((clip) => clip.id));
    const selectedByTrack = new Map<string, BeatClip[]>();
    for (const clip of selectedClipList) {
      const existing = selectedByTrack.get(clip.trackId);
      if (existing) {
        existing.push(clip);
      } else {
        selectedByTrack.set(clip.trackId, [clip]);
      }
    }
    for (const [trackId, removedClips] of selectedByTrack.entries()) {
      const orderedRemoved = [...removedClips].sort((left, right) => left.start - right.start);
      for (const clip of visibleClips) {
        if (clip.trackId !== trackId || selectedIds.has(clip.id)) {
          continue;
        }
        const shiftAmount = orderedRemoved.reduce((accumulator, removedClip) => {
          const removedEnd = removedClip.start + removedClip.duration;
          if (clip.start + DRAG_COMMIT_EPSILON_SECONDS >= removedEnd) {
            return accumulator + removedClip.duration;
          }
          return accumulator;
        }, 0);
        if (shiftAmount <= DRAG_COMMIT_EPSILON_SECONDS) {
          continue;
        }
        const maxStart = Math.max(0, totalDuration - clip.duration);
        const nextStart = clampNumber(clip.start - shiftAmount, 0, maxStart);
        if (Math.abs(nextStart - clip.start) < DRAG_COMMIT_EPSILON_SECONDS) {
          continue;
        }
        onClipMove(clip.id, nextStart, trackId);
      }
    }
  }, [dispatchContextActionForSelection, onClipMove, rippleEnabled, selectedClipList, totalDuration, visibleClips]);

  useEffect(() => {
    const hook: ProfessionalTimelineTestHook = {
      getSelectedClipIds: () => Array.from(selectedClips),
      getInOut: () => ({ inPoint, outPoint }),
      getMarkers: () =>
        allMarkers.map((marker) => ({
          id: marker.id,
          time: marker.time,
          label: marker.label,
        })),
      getPlayhead: () => currentTime,
      addMarkerAtPlayhead: () => {
        addEphemeralMarker(currentTime, 'Marker');
      },
      clearMarkers: () => {
        clearEphemeralMarkerSet();
      },
      setPlayhead: (seconds) => {
        setPlayheadTime(seconds);
      },
      setInPointAtPlayhead: () => {
        setInPoint(currentTime);
      },
      setOutPointAtPlayhead: () => {
        setOutPoint(currentTime);
      },
      clearInOutPoints: () => {
        clearInOutPoints();
      },
      jumpToPreviousMarker: () => {
        jumpToPreviousMarker();
      },
      jumpToNextMarker: () => {
        jumpToNextMarker();
      },
      nudgeSelectedByFrames: (frames) => {
        if (selectedClipList.length === 0) {
          return false;
        }
        nudgeSelectedClips(frames * frameStepSeconds);
        return true;
      },
      selectClipsByTimeRange: (startTime, endTime, trackIds) => {
        const rangeStart = Math.min(startTime, endTime);
        const rangeEnd = Math.max(startTime, endTime);
        const allowedTracks = Array.isArray(trackIds) && trackIds.length > 0 ? new Set(trackIds) : null;
        const hits = visibleClips
          .filter((clip) => {
            if (allowedTracks && !allowedTracks.has(clip.trackId)) {
              return false;
            }
            const clipStart = clip.start;
            const clipEnd = clip.start + clip.duration;
            return clipEnd >= rangeStart && clipStart <= rangeEnd;
          })
          .map((clip) => clip.id);
        if (hits.length > 0) {
          selectMultipleClipsDeterministic(hits);
        }
        return hits;
      },
      getSnappedTime: (timeSeconds, ignoreClipId) => {
        const normalized = normalizeTimelineTime(timeSeconds);
        const snapResult = snapPx(timeToPixels(normalized), ignoreClipId);
        return normalizeTimelineTime(pixelsToTime(snapResult.value));
      },
      dropMedia: (media, trackId, startTime) => {
        if (!onMediaDrop) {
          return false;
        }
        if (!trackIdSet.has(trackId)) {
          return false;
        }
        if (!isTrackCompatibleWithMedia(trackId, media.mimeType, media.type)) {
          return false;
        }
        onMediaDrop({
          media,
          trackId,
          startTime: normalizeTimelineTime(startTime),
        });
        setDropTrackId(trackId);
        return true;
      },
    };

    window.__professionalTimelineTestHook = hook;
    return () => {
      if (window.__professionalTimelineTestHook === hook) {
        delete window.__professionalTimelineTestHook;
      }
    };
  }, [
    addEphemeralMarker,
    allMarkers,
    clearEphemeralMarkerSet,
    currentTime,
    frameStepSeconds,
    inPoint,
    isTrackCompatibleWithMedia,
    jumpToNextMarker,
    jumpToPreviousMarker,
    normalizeTimelineTime,
    nudgeSelectedClips,
    onMediaDrop,
    outPoint,
    pixelsToTime,
    selectMultipleClipsDeterministic,
    selectedClipList.length,
    selectedClips,
    setPlayheadTime,
    snapPx,
    timeToPixels,
    trackIdSet,
    visibleClips,
  ]);

  const hasInOutRange = inPoint !== null && outPoint !== null;
  const activeRangeStart = hasInOutRange ? Math.min(inPoint, outPoint) : null;
  const activeRangeEnd = hasInOutRange ? Math.max(inPoint, outPoint) : null;
  const currentTimeRef = useRef(currentTime);
  const zoomRef = useRef(zoom);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const handleToolbarFpsChange = useCallback((nextFps: number) => {
    setTimelineFps(clampNumber(nextFps, 1, 120));
  }, []);

  const handleToolbarToggleSafeTrim = useCallback(() => {
    setSafeTrimEnabled((previous) => !previous);
  }, []);

  const handleToolbarToggleMagnetic = useCallback(() => {
    setMagneticEnabled((previous) => !previous);
  }, []);

  const handleToolbarToggleSnapping = useCallback(() => {
    setSnappingEnabled((previous) => !previous);
  }, []);

  const handleToolbarToggleRipple = useCallback(() => {
    setRippleEnabled((previous) => !previous);
  }, []);

  const handleToolbarZoomOut = useCallback(() => {
    if (!onZoomChange) {
      return;
    }
    onZoomChange(clampNumber(zoomRef.current / 1.1, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM));
  }, [onZoomChange]);

  const handleToolbarZoomIn = useCallback(() => {
    if (!onZoomChange) {
      return;
    }
    onZoomChange(clampNumber(zoomRef.current * 1.1, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM));
  }, [onZoomChange]);

  const handleToolbarAddMarkerAtPlayhead = useCallback(() => {
    addEphemeralMarker(currentTimeRef.current, 'Marker');
  }, [addEphemeralMarker]);

  const handleToolbarSetInPointAtPlayhead = useCallback(() => {
    setInPointAtTime(currentTimeRef.current);
  }, [setInPointAtTime]);

  const handleToolbarSetOutPointAtPlayhead = useCallback(() => {
    setOutPointAtTime(currentTimeRef.current);
  }, [setOutPointAtTime]);

  const handleToolbarNudgeSelectionLeft = useCallback(() => {
    nudgeSelectedClips(-frameStepSeconds);
  }, [frameStepSeconds, nudgeSelectedClips]);

  const handleToolbarNudgeSelectionRight = useCallback(() => {
    nudgeSelectedClips(frameStepSeconds);
  }, [frameStepSeconds, nudgeSelectedClips]);

  const handleCanvasDragLeave = useCallback((event: React.DragEvent) => {
    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      setDropTrackId(null);
      clearDropPreview();
    }
  }, [clearDropPreview]);

  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    if (!onMediaDrop) {
      return;
    }
    const selectedTrack = selectedTrackId ?? tracks[0]?.id;
    if (!selectedTrack) {
      return;
    }
    event.preventDefault();
    setDropTrackId(selectedTrack);
    updateDropPreviewForTrack(selectedTrack, event.clientX);
    event.dataTransfer.dropEffect = insertOverwriteMode === 'insert' ? 'move' : 'copy';
  }, [insertOverwriteMode, onMediaDrop, selectedTrackId, tracks, updateDropPreviewForTrack]);

  const handleCanvasDrop = useCallback((event: React.DragEvent) => {
    const selectedTrack = selectedTrackId ?? tracks[0]?.id;
    if (!selectedTrack) {
      return;
    }
    applyMediaDropToTrack(selectedTrack, event);
  }, [applyMediaDropToTrack, selectedTrackId, tracks]);

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TimelineToolbar
        zoom={zoom}
        inPoint={inPoint}
        outPoint={outPoint}
        timelineFps={timelineFps}
        workspaceMode={workspaceMode}
        toolMode={toolMode}
        safeTrimEnabled={safeTrimEnabled}
        magneticEnabled={magneticEnabled}
        snappingEnabled={snappingEnabled}
        rippleEnabled={rippleEnabled}
        timeDisplayMode={timeDisplayMode}
        selectedClipCount={selectedClipList.length}
        allMarkerCount={allMarkers.length}
        ephemeralMarkerCount={ephemeralMarkers.length}
        onWorkspaceModeChange={setWorkspaceMode}
        onToolModeChange={setToolMode}
        onTimelineFpsChange={handleToolbarFpsChange}
        onTimeDisplayModeChange={setTimeDisplayMode}
        onToggleSafeTrim={handleToolbarToggleSafeTrim}
        onToggleMagnetic={handleToolbarToggleMagnetic}
        onToggleSnapping={handleToolbarToggleSnapping}
        onToggleRipple={handleToolbarToggleRipple}
        onZoomToProject={zoomToProject}
        onZoomToSelection={zoomToSelection}
        onZoomOut={handleToolbarZoomOut}
        onZoomIn={handleToolbarZoomIn}
        onInsertAtPlayhead={insertSelectionAtPlayhead}
        onOverwriteAtPlayhead={overwriteSelectionAtPlayhead}
        onLiftSelection={liftSelection}
        onExtractSelection={extractSelection}
        onSplitAtPlayhead={splitSelectionAtPlayhead}
        onDuplicateSelection={duplicateSelection}
        onDeleteSelection={deleteSelection}
        onJumpPreviousMarker={jumpToPreviousMarker}
        onJumpNextMarker={jumpToNextMarker}
        onAddMarkerAtPlayhead={handleToolbarAddMarkerAtPlayhead}
        onClearLocalMarkers={clearEphemeralMarkerSet}
        onSetInPoint={handleToolbarSetInPointAtPlayhead}
        onSetOutPoint={handleToolbarSetOutPointAtPlayhead}
        onJumpToInPoint={jumpToInPoint}
        onJumpToOutPoint={jumpToOutPoint}
        onClearInOutPoints={clearInOutPoints}
        onSelectClipAtPlayhead={selectClipUnderPlayhead}
        onNudgeSelectionLeft={handleToolbarNudgeSelectionLeft}
        onNudgeSelectionRight={handleToolbarNudgeSelectionRight}
      />
      <TimelineToolbarLiveStatus
        currentTime={currentTime}
        inPoint={inPoint}
        outPoint={outPoint}
        timelineFps={timelineFps}
        frameStepSeconds={frameStepSeconds}
        timeDisplayMode={timeDisplayMode}
      />

      {/* Ruler */}
      <TimelineRuler
        rulerRef={rulerRef}
        totalDuration={totalDuration}
        currentTime={currentTime}
        isPlaying={isPlaying}
        timelineFps={timelineFps}
        timeDisplayMode={timeDisplayMode}
        gridLines={gridLines}
        allMarkers={allMarkers}
        inPoint={inPoint}
        outPoint={outPoint}
        viewportStartPx={timelineViewportPx.start}
        viewportEndPx={timelineViewportPx.end}
        hoverStore={hoverStoreRef.current}
        snapGuideVisible={snapGuideVisible}
        snapGuideX={snapGuideX}
        snapGuideLabel={snapGuideLabel}
        timeToPixels={timeToPixels}
        onRulerScrubToClientX={handleRulerScrubToClientX}
        onRulerDoubleClick={onRulerDoubleClick}
        onRulerKeyDown={handleRulerKeyDown}
        onRulerHoverClientX={handleRulerHoverClientX}
        onRulerMouseLeave={handleRulerMouseLeave}
        onJumpToMarker={setPlayheadTime}
        onClientXToTime={getTimelineTimeFromClientX}
        onSetInPointAtTime={setInPointAtTime}
        onSetOutPointAtTime={setOutPointAtTime}
      />

      {/* Timeline area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Track headers */}
        <TrackHeaders
          tracks={tracks}
          trackHeightScale={trackHeightScale}
          trackOffsetMap={trackOffsetMap}
          visibleTrackIdSet={visibleTrackIdSet}
          scrollTop={timelineViewportY.start}
          totalTrackHeight={totalTrackHeight}
          trackStates={trackStates}
          selectedTrackId={selectedTrackId}
          trackNameDrafts={trackNameDrafts}
          reviewerMode={reviewerMode}
          onTrackRename={onTrackRename}
          onTrackTypeChange={onTrackTypeChange}
          onTrackAudioRoleChange={onTrackAudioRoleChange}
          onTrackToggle={onTrackToggle}
          onSelectTrack={selectTrackById}
          onTrackNameFocus={handleTrackNameFocus}
          onTrackNameChange={handleTrackNameChange}
          onTrackNameCommit={commitTrackRename}
        />

        {/* Tracks content */}
        <TimelineCanvas
          timelineRef={timelineRef}
          panState={panState}
          marqueeState={marqueeState}
          isSpaceHandActive={isSpaceHandActive}
          onWheel={onWheel}
          onKeyDown={handleTimelineKeyDown}
          onMouseDown={handleTimelineMouseDownLocal}
          onMouseMove={handleTimelineMouseMoveLocal}
          onMouseLeave={handleRulerMouseLeave}
          onPointerDown={handleTimelinePointerDownLocal}
          onPointerMove={handleTimelinePointerMoveLocal}
          onPointerLeave={handleTimelinePointerLeaveLocal}
          onClick={handleTimelineClickLocal}
          onDragLeave={handleCanvasDragLeave}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
        >
          <Box sx={{ position: 'relative', width: timelineWidth + HEADER_WIDTH, height: totalTrackHeight }}>
            {/* Grid vertical lines duplicated in content for alignment */}
            {visibleGridLinesInViewport.map((line) => (
              <Box key={`g-${line.time}`} sx={{ position: 'absolute', left: HEADER_WIDTH + line.position, top: 0, bottom: 0, width: 1, bgcolor: line.isMain ? 'divider' : 'rgba(0,0,0,0.04)' }} />
            ))}

            {inPoint !== null && outPoint !== null && (
              <Box
                sx={{
                  position: 'absolute',
                  left: HEADER_WIDTH + timeToPixels(Math.min(inPoint, outPoint)),
                  top: 0,
                  width: Math.max(1, timeToPixels(Math.abs(outPoint - inPoint))),
                  height: totalTrackHeight,
                  bgcolor: 'rgba(25, 118, 210, 0.08)',
                  borderLeft: '1px solid rgba(76, 175, 80, 0.5)',
                  borderRight: '1px solid rgba(255, 193, 7, 0.5)',
                  pointerEvents: 'none',
                }}
              />
            )}

            <TimelineHoverGuideOverlay hoverStore={hoverStoreRef.current} />

            {snapGuideVisible && snapGuideX !== null && (
              <Box
                sx={{
                  position: 'absolute',
                  left: HEADER_WIDTH + snapGuideX,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  bgcolor: 'info.main',
                  pointerEvents: 'none',
                  zIndex: 2,
                  opacity: 0.9,
                }}
              />
            )}

            {dropPreview && (
              <>
                <Box
                  sx={{
                    position: 'absolute',
                    left: HEADER_WIDTH + timeToPixels(dropPreview.time),
                    top: 0,
                    bottom: 0,
                    width: 2,
                    bgcolor: dropPreview.mode === 'insert' ? 'success.main' : 'primary.main',
                    pointerEvents: 'none',
                    zIndex: 3,
                    opacity: 0.9,
                  }}
                />
                <Chip
                  size="small"
                  label={`${dropPreview.mode === 'insert' ? 'Insert' : 'Overwrite'} @ ${formatTimelineDisplay(dropPreview.time, timeDisplayMode, timelineFps)}`}
                  sx={{
                    position: 'absolute',
                    left: HEADER_WIDTH + timeToPixels(dropPreview.time) + 6,
                    top: 6,
                    height: 18,
                    fontSize: 10,
                    pointerEvents: 'none',
                    zIndex: 4,
                  }}
                />
              </>
            )}

            {/* Compare overlay */}
            {visibleCompareClipsInViewport.map(c => {
              if (!visibleTrackIdSet.has(c.trackId)) {
                return null;
              }
              const off = trackOffsetMap[c.trackId];
              if (!off) return null;
              return (
                <Box key={`ghost-${c.id}`} sx={{ position: 'absolute', left: HEADER_WIDTH + timeToPixels(c.start), top: off.top, width: timeToPixels(c.duration), height: off.height - 4, bgcolor: 'rgba(0,0,0,0.08)', border: '1px dashed rgba(0,0,0,0.2)', pointerEvents: 'none' }} />
              );
            })}

            {/* Tracks rows backgrounds */}
            {visibleTracksInViewport.map((t) => {
              const off = trackOffsetMap[t.id];
              if (!off) return null;
              const isDropTarget = dropTrackId === t.id;
              const isActiveTrack = selectedTrackId === t.id;
              return (
                <Box
                  key={`row-${t.id}`}
                  data-testid={`timeline-track-row-${t.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedTrackId(t.id);
                  }}
                  onDragOver={(event) => {
                    if (!onMediaDrop) return;
                    const hasPayload =
                      Array.from(event.dataTransfer.types).includes('application/x-storyarc-media') ||
                      Array.from(event.dataTransfer.types).includes('text/uri-list') ||
                      event.dataTransfer.files.length > 0;
                    if (!hasPayload) return;
                    let mimeTypeHint = '';
                    let mediaTypeHint = '';
                    const rawPayload = event.dataTransfer.getData('application/x-storyarc-media');
                    if (rawPayload) {
                      try {
                        const parsedUnknown: unknown = JSON.parse(rawPayload);
                        if (parsedUnknown && typeof parsedUnknown === 'object') {
                          const parsed = parsedUnknown as Record<string, unknown>;
                          if (typeof parsed.mimeType === 'string') {
                            mimeTypeHint = parsed.mimeType;
                          }
                          if (typeof parsed.type === 'string') {
                            mediaTypeHint = parsed.type;
                          }
                        }
                      } catch {
                        // ignore payload parse issues during drag preview
                      }
                    } else if (event.dataTransfer.files.length > 0) {
                      mimeTypeHint = event.dataTransfer.files[0].type;
                    }
                    if (!isTrackCompatibleWithMedia(t.id, mimeTypeHint, mediaTypeHint)) {
                      event.dataTransfer.dropEffect = 'none';
                      setDropTrackId(null);
                      clearDropPreview();
                      return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = insertOverwriteMode === 'insert' ? 'move' : 'copy';
                    if (dropTrackId !== t.id) {
                      setDropTrackId(t.id);
                    }
                    updateDropPreviewForTrack(t.id, event.clientX);
                  }}
                  onDragLeave={(event) => {
                    if (!onMediaDrop) return;
                    if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
                      setDropTrackId((previous) => (previous === t.id ? null : previous));
                      setDropPreview((previous) => (previous?.trackId === t.id ? null : previous));
                    }
                  }}
                  onDrop={(event) => {
                    applyMediaDropToTrack(t.id, event);
                  }}
                  sx={{
                    position: 'absolute',
                    left: HEADER_WIDTH,
                    top: off.top,
                    right: 0,
                    height: off.height,
                    bgcolor: isDropTarget
                      ? (insertOverwriteMode === 'insert' ? 'rgba(76, 175, 80, 0.18)' : 'rgba(25, 118, 210, 0.18)')
                      : isActiveTrack
                        ? 'rgba(59, 130, 246, 0.08)'
                      : t.type === 'audio'
                        ? 'rgba(0,0,0,0.03)'
                        : 'transparent',
                    borderBottom: '1px solid',
                    borderColor: isDropTarget ? (insertOverwriteMode === 'insert' ? 'success.main' : 'primary.main') : 'divider',
                    transition: 'background-color 120ms ease, border-color 120ms ease',
                  }}
                />
              );
            })}

            {/* Transitions */}
            {visibleTransitionsInViewport.map(tr => {
              if (!visibleTrackIdSet.has(tr.trackId)) {
                return null;
              }
              const off = trackOffsetMap[tr.trackId];
              if (!off) return null;
              return (
                <Tooltip key={tr.id} title={`${tr.type} @ ${tr.time.toFixed(2)}s`}>
                  <Box
                    role="presentation"
                    aria-label={`${tr.type} transition at ${tr.time.toFixed(2)} seconds`}
                    sx={{ position: 'absolute', left: HEADER_WIDTH + timeToPixels(tr.time), top: off.top, height: off.height, width: 2, bgcolor: 'info.main' }}
                  />
                </Tooltip>
              );
            })}

            {/* Clips */}
            <TimelineClipLayer
              visibleClips={visibleClips}
              selectedClips={selectedClips}
              dragPreviewStore={dragPreviewStoreRef.current}
              viewportBufferedStartTime={viewportBufferedStartTime}
              viewportBufferedEndTime={viewportBufferedEndTime}
              visibleTrackIdSet={visibleTrackIdSet}
              trackOffsetMap={trackOffsetMap}
              trackStates={trackStates}
              collabLocks={collabLocks}
              clipPresentationById={clipPresentationById}
              reviewerMode={reviewerMode}
              hasInOutRange={hasInOutRange}
              activeRangeStart={activeRangeStart}
              activeRangeEnd={activeRangeEnd}
              timeToPixels={timeToPixels}
              beginDrag={beginDrag}
              onClipSelect={onClipSelect}
              onSetSelectedTrackId={setSelectedTrackId}
              onSetPlayheadTime={setPlayheadTime}
              openContextMenu={openContextMenu}
            />

            {marqueeState && (
              <Box
                sx={{
                  position: 'absolute',
                  left: Math.min(marqueeState.startX, marqueeState.currentX),
                  top: Math.min(marqueeState.startY, marqueeState.currentY),
                  width: Math.abs(marqueeState.currentX - marqueeState.startX),
                  height: Math.abs(marqueeState.currentY - marqueeState.startY),
                  border: '1px solid rgba(59,130,246,0.9)',
                  bgcolor: 'rgba(59,130,246,0.14)',
                  pointerEvents: 'none',
                  zIndex: 4,
                }}
              />
            )}
          </Box>
        </TimelineCanvas>
      </Box>

      {/* Context menu */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeContextMenu} anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}>
        <MenuItem onClick={() => handleMenu('edit-metadata')}>
          Edit metadata{selectedClipIdForMenu ? ` (${selectedClipIdForMenu})` : ''}…
        </MenuItem>
        {!reviewerMode && (
          <>
            <MenuItem onClick={() => handleMenu('split')}>Split at playhead</MenuItem>
            <MenuItem onClick={() => handleMenu('duplicate')}>Duplicate</MenuItem>
            <MenuItem onClick={() => handleMenu('delete')}>Delete</MenuItem>
            <MenuItem
              onClick={() => {
                if (!menuClipId) return;
                const clip = clipMapById.get(menuClipId);
                if (!clip) return;
                onClipMove(clip.id, clampNumber(clip.start - frameStepSeconds, 0, Math.max(0, totalDuration - clip.duration)), clip.trackId);
                closeContextMenu();
              }}
            >
              Nudge Left (1 frame)
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (!menuClipId) return;
                const clip = clipMapById.get(menuClipId);
                if (!clip) return;
                onClipMove(clip.id, clampNumber(clip.start + frameStepSeconds, 0, Math.max(0, totalDuration - clip.duration)), clip.trackId);
                closeContextMenu();
              }}
            >
              Nudge Right (1 frame)
            </MenuItem>
            {onClipResize && (
              <MenuItem
                onClick={() => {
                  if (!menuClipId) return;
                  const clip = clipMapById.get(menuClipId);
                  if (!clip) return;
                  const nextDuration = clampNumber(clip.duration + frameStepSeconds, MIN_CLIP_DURATION_SECONDS, totalDuration - clip.start);
                  onClipResize(clip.id, clip.start, nextDuration, 'resize-right');
                  closeContextMenu();
                }}
              >
                Extend Right (1 frame)
              </MenuItem>
            )}
            <Divider />
            <MenuItem onClick={() => handleMenu('color', { color: '#9c27b0' })}>Label: Purple</MenuItem>
            <MenuItem onClick={() => handleMenu('color', { color: '#03a9f4' })}>Label: Blue</MenuItem>
            <MenuItem onClick={() => handleMenu('color', { color: '#16a34a' })}>Label: Green</MenuItem>
            <MenuItem onClick={() => handleMenu('color', { color: '#ef4444' })}>Label: Red</MenuItem>
          </>
        )}
        <Divider />
        <MenuItem onClick={() => handleMenu('add-comment')}>Add comment…</MenuItem>
        <MenuItem
          onClick={async () => {
            const clipId = menuClipId;
            const clip = clipId ? clipMapById.get(clipId) : null;
            const timecode = clip ? formatTimelineTime(clip.start) : formatTimelineTime(currentTime);
            try {
              await navigator.clipboard.writeText(timecode);
            } catch {
              // Clipboard unavailable in some contexts.
            }
            closeContextMenu();
          }}
        >
          Copy timecode
        </MenuItem>
        {reviewerMode && (
          <>
            <Divider />
            <MenuItem onClick={() => handleMenu('review-approve')}>Approve</MenuItem>
            <MenuItem onClick={() => handleMenu('review-request-changes')}>Request changes</MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
}
