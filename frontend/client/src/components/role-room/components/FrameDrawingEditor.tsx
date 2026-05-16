// @ts-nocheck
/**
 * FrameDrawingEditor - Storyboard frame drawing interface
 * 
 * Wraps PencilCanvas for storyboard frame sketching on iPad
 * Integrates with StoryboardStore for persistence
 */

import { useState, useCallback, useMemo, useRef, useEffect, type ChangeEvent, type FC, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Stack,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip,
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Fade,
  Alert,
  Slider,
  LinearProgress,
  Switch,
} from '@mui/material';
import {
  Save,
  Close,
  Undo,
  Redo,
  Delete,
  Fullscreen,
  FullscreenExit,
  AspectRatio,
  Brush,
  Create,
  Highlight,
  AutoAwesome,
  TouchApp,
  Image as ImageIcon,
  Share,
  MoreHoriz,
  CheckCircle,
  GridOn,
  CameraAlt,
  LightMode,
  TextFields,
  Layers,
  Tune,
  Add,
  ContentCopy,
  PlayArrow,
  Pause,
  SkipNext,
  SkipPrevious,
  FastForward,
  FastRewind,
  ChevronLeft,
  ChevronRight,
  ExpandMore,
  FiberManualRecord,
  FlashOn,
  ViewSidebar,
  Link,
  Flag,
  Shuffle,
  ArrowBack,
  ArrowDownward,
  ArrowForward,
  Reply,
  Visibility,
  LockOutlined,
  SlowMotionVideo,
  HighQuality,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';

import {
  PencilCanvas,
  type BrushSettings,
  type BrushType,
  type PencilCanvasHandle,
} from './PencilCanvas';
import {
  PencilCanvasPro,
  type ReferenceImage,
  type PencilCanvasProHandle,
} from './PencilCanvasPro';
import { type ProBrushType } from './drawing/AdvancedBrushEngine';
import {
  analyzeShapeIntent,
  buildShapeIntentGuideStrokes,
  buildShapeIntentGuideStrokesFromScaffold,
  buildShapeIntentOverlayDataUrl,
  buildShapeIntentReferenceDataUrl,
  createShapeIntentAnalysisFromScaffold,
  getShapeIntentDefaultSelections,
  getShapeIntentSuggestionDefinitionById,
  getShapeIntentSuggestionById,
  getShapeIntentSuggestionContextSignals,
  summarizeShapeIntentSelections,
  type ShapeIntentApplyMode,
  type ShapeIntentAnalysis,
  type ShapeIntentContextSignal,
  type ShapeIntentScaffoldDefinition,
  type ShapeIntentSelections,
  type ShapeIntentSuggestion,
} from './drawing/shapeIntentAssist';
import type { PencilStroke } from '../hooks/useApplePencil';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import { roleRoomAnalytics } from '../services/roleRoomAnalytics';
import {
  addStoryboardDrawingDocumentMarker,
  addStoryboardDrawingDocumentBookmark,
  addStoryboardDrawingDocumentCanvas,
  addStoryboardDrawingDocumentLayer,
  addStoryboardDrawingDocumentReference,
  addStoryboardDrawingDocumentShapeScaffold,
  addStoryboardDrawingDocumentShapeScaffoldAssembly,
  addStoryboardDrawingDocumentShapeScaffoldLibraryEntry,
  addStoryboardDrawingDocumentSheet,
  addStoryboardDrawingDocumentTransformationLayer,
  applyStoryboardDrawingDocumentBookmarkView,
  applyStoryboardDrawingDocumentProjection,
  attachStoryboardDrawingDocumentSheetToCanvas,
  createStoryboardDrawingDocument,
  duplicateStoryboardDrawingDocumentSheet,
  duplicateStoryboardDrawingDocumentLayer,
  getPrimaryStoryboardDocumentCanvas,
  getPrimaryStoryboardDocumentReferenceImage,
  getStoryboardDocumentActiveLayerId,
  getStoryboardDocumentBookmarkCanvasId,
  getStoryboardDocumentCanvasBookmarks,
  getStoryboardDocumentDrawingLayerStrokes,
  getStoryboardDocumentReferenceById,
  getStoryboardDocumentShapeScaffoldById,
  getStoryboardDocumentShapeScaffoldAssemblyById,
  getStoryboardDocumentShapeScaffoldLibraryEntryById,
  getStoryboardDocumentSheetRenderableLayers,
  getStoryboardDocumentSheetById,
  getStoryboardDocumentSheetLayerStack,
  getStoryboardDocumentSheetStrokes,
  getStoryboardDocumentSheetLayers,
  getStoryboardDocumentTimelineFrames,
  getStoryboardDocumentTransformationLayerPreview,
  groupStoryboardDrawingDocumentLayers,
  mergeStoryboardDrawingDocumentLayerDown,
  removeStoryboardDrawingDocumentLayer,
  removeStoryboardDrawingDocumentBookmark,
  removeStoryboardDrawingDocumentReference,
  reorderStoryboardDrawingDocumentLayer,
  reorderStoryboardDrawingDocumentCanvasBookmarks,
  restoreStoryboardDrawingDocumentFromLegacy,
  setStoryboardDrawingDocumentActiveLayer,
  setStoryboardDrawingDocumentPrimaryCanvas,
  setStoryboardDrawingDocumentScrubFrame,
  ungroupStoryboardDrawingDocumentLayer,
  updateStoryboardDrawingDocumentBookmark,
  updateStoryboardDrawingDocumentSheetContent,
  updateStoryboardDrawingDocumentLayer,
  updateStoryboardDrawingDocumentMediaState,
  updateStoryboardDrawingDocumentBoardPolish,
  updateStoryboardDrawingDocumentProjection,
  updateStoryboardDrawingDocumentReferenceStudy,
  updateStoryboardDrawingDocumentShapeScaffold,
  updateStoryboardDrawingDocumentShapeScaffoldLibraryEntry,
  updateStoryboardDrawingDocumentTimelineState,
  updateStoryboardDrawingDocumentSheetExposure,
  updateStoryboardDrawingDocumentCanvas,
  updateStoryboardDrawingDocumentCanvasTransform,
  updateStoryboardDrawingDocumentReference,
  upsertStoryboardDrawingDocumentTransformationKeyframe,
  removeStoryboardDrawingDocumentShapeScaffold,
  removeStoryboardDrawingDocumentShapeScaffoldAssembly,
  removeStoryboardDrawingDocumentShapeScaffoldLibraryEntry,
  type StoryboardDocumentAppliedTransform,
  type StoryboardDocumentAspectRatio,
  type StoryboardDocumentBoardPolishFinish,
  type StoryboardDocumentBoardPolishEffectLayerId,
  type StoryboardDocumentBoardPolishEffectRegion,
  type StoryboardDocumentBoardPolishMode,
  type StoryboardDocumentBoardPolishState,
  type StoryboardDocumentBoardPolishTone,
  type StoryboardDocumentBoardPolishWeather,
  type StoryboardDocumentBookmarkView,
  type StoryboardDocumentBlendMode,
  type StoryboardDocumentBrushSettings,
  type StoryboardDocumentCornerWarp,
  type StoryboardDocumentCornerWarpCorner,
  type StoryboardDocumentProjectionMode,
  type StoryboardDocumentReferenceImage,
  type StoryboardDocumentReferenceStudyAttemptMetrics,
  type StoryboardDocumentReferenceStudyAttemptRecord,
  type StoryboardDocumentReferenceStudyDrillId,
  type StoryboardDocumentReferenceStudyFocusMode,
  type StoryboardDocumentReferenceStudyState,
  type StoryboardDocumentShapeScaffold,
  type StoryboardDocumentShapeScaffoldApplyMode,
  type StoryboardDocumentShapeScaffoldFrame,
  type StoryboardDocumentShapeScaffoldLibraryEntry,
  type StoryboardDocumentShapeScaffoldPrimitive,
  type StoryboardDocumentSpatialCanvas,
  type StoryboardDocumentTransition,
  type StoryboardDrawingDocument,
  type StoryboardDocumentRenderableLayer,
  type StoryboardDocumentTimelineFrame,
  type StoryboardDocumentWorkflowLevel,
} from '../state/storyboardDrawingDocument';
import {
  useStoryboardStore,
  type FrameDrawingData,
  type FrameImageSource,
  type StoryboardFrame,
} from '../state/storyboardStore';
import type { DrawingLayer } from './drawing/LayersPanel';
import {
  BOARD_POLISH_EFFECT_REGION_PRESETS,
  createBoardPolishEffectLayerStates,
  createBoardPolishEffectRegions,
  createBoardPolishDraftState,
  getBoardPolishCanvasFilter,
  getBoardPolishEffectLayers,
  getBoardPolishEffectRegionMap,
  getBoardPolishStyleSummary,
  STUDIO_BOARD_POLISH_DEFAULTS,
  STUDIO_BOARD_POLISH_FINISH_CONFIG,
  STUDIO_BOARD_POLISH_FINISHES,
  STUDIO_BOARD_POLISH_TONE_CONFIG,
  STUDIO_BOARD_POLISH_TONES,
  STUDIO_BOARD_POLISH_WEATHER_CONFIG,
  STUDIO_BOARD_POLISH_WEATHER_OPTIONS,
  type BoardPolishDraftState,
} from '../utils/storyboardBoardPolish';

// =============================================================================
// Types
// =============================================================================

export interface FrameDrawingEditorProps {
  frameId?: string;
  storyboardId?: string;
  aspectRatio?: '16:9' | '4:3' | '2.39:1' | '2.35:1' | '1.85:1' | '2.76:1' | '1:1' | '9:16';
  initialImage?: string;
  initialStrokes?: PencilStroke[];
  initialDrawingData?: FrameDrawingData;
  workflowLevel?: 'idea' | 'blocking' | 'shot' | 'presentation';
  onSave?: (drawingData: FrameDrawingData, imageDataUrl: string) => void;
  onCancel?: () => void;
  mode?: 'dialog' | 'inline' | 'fullscreen';
  sceneId?: string; // Link to manuscript scene
  manuscriptId?: string;
  /** Enable pro mode with watercolor, reference images, advanced brushes */
  proMode?: boolean;
  /** Reference image for tracing (pro mode only) */
  referenceImage?: ReferenceImage;
}

interface CanvasDimensions {
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

const MOTION_RIG_WARP_CORNERS: StoryboardDocumentCornerWarpCorner[] = ['nw', 'ne', 'se', 'sw'];
const SPATIAL_MAP_NUDGE_X = 24;
const SPATIAL_MAP_NUDGE_Y = 18;
const SPATIAL_MAP_DEPTH_STEP = 12;
const SPATIAL_MAP_SCALE_STEP = 0.12;
const SPATIAL_MAP_X_OFFSET_PERCENT = 8;
const SPATIAL_MAP_Y_OFFSET_PERCENT = 10;
const SPATIAL_MAP_X_SPAN_PERCENT = 72;
const SPATIAL_MAP_Y_SPAN_PERCENT = 62;

const createIdentityMotionRigCornerWarp = (): StoryboardDocumentCornerWarp => ({
  nw: { x: 0, y: 0 },
  ne: { x: 0, y: 0 },
  se: { x: 0, y: 0 },
  sw: { x: 0, y: 0 },
});

type ReferenceStudyAttemptRecord = StoryboardDocumentReferenceStudyAttemptRecord;
type ReferenceStudyAttemptMetrics = StoryboardDocumentReferenceStudyAttemptMetrics;
type ReferenceStudyFocusMode = StoryboardDocumentReferenceStudyFocusMode;
type ReferenceStudyDrillId = StoryboardDocumentReferenceStudyDrillId;
type ReferenceStudyPersistedState = StoryboardDocumentReferenceStudyState;
type BoardPolishPersistedState = StoryboardDocumentBoardPolishState;

// =============================================================================
// Styled Components
// =============================================================================

const EditorContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: '#1a1a2e',
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  maxWidth: '100vw',
  maxHeight: '100dvh',
}));

const ToolbarContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  backgroundColor: 'rgba(8, 11, 24, 0.96)',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  position: 'relative',
  zIndex: 5,
  isolation: 'isolate',
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(1, 1.25),
  },
}));

const CanvasWrapper = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#0f0f1a',
  position: 'relative',
  padding: theme.spacing(0.5),
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(0.25),
  },
}));

const StatusBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: theme.spacing(1),
  padding: theme.spacing(0.7, 1.5),
  background: 'linear-gradient(180deg, rgba(5,7,12,0.94), rgba(3,5,10,0.98))',
  borderTop: '1px solid rgba(255,255,255,0.1)',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(0.75, 1.25),
  },
}));

// =============================================================================
// Aspect Ratio Helpers
// =============================================================================

// Cinema-bransjestandard + sosiale formater. Storyboard-artister som jobber
// mot film/commercial trenger 2.39:1 (moderne anamorphic), 1.85:1 (Academy
// Flat) og 2.76:1 (Ultra Panavision 70) — ikke bare TV/social-aspekter.
const ASPECT_RATIOS: Record<string, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '2.39:1': 2.39,    // Moderne anamorphic widescreen
  '2.35:1': 2.35,    // Klassisk anamorphic
  '1.85:1': 1.85,    // Academy Flat (standard theatrical)
  '2.76:1': 2.76,    // Ultra Panavision 70
  '1:1': 1,
  '9:16': 9 / 16,
};

const STANDARD_BRUSH_OPTIONS: BrushType[] = ['pen', 'marker', 'highlighter'];
const PRO_BRUSH_OPTIONS: ProBrushType[] = ['pen', 'marker', 'highlighter'];
const STUDIO_DECK_TABS = ['ROUGH', 'INK', 'SHADOW', 'LIGHT', 'FX', 'TEXT'] as const;
const STUDIO_ANIMATION_OUTPUTS = ['Storyboards', 'GIFs', 'Animatics', 'Simple Anim'] as const;
const STUDIO_GUIDE_MODES = ['Perspective', 'Isometric', '2D', 'Symmetry'] as const;
const STUDIO_PROJECTION_MODES: StoryboardDocumentProjectionMode[] = ['planar', 'projection', 'rearrange'];
const STUDIO_FONT_PRESETS = ['Grotesk', 'Mono', 'Display'] as const;
const STUDIO_CROP_PRESETS = ['Center', 'Thirds', 'Safe Margin'] as const;
const STUDIO_CANVAS_RESOLUTION_PRESETS = ['HD', '2K', '4K'] as const;
const STUDIO_TEXT_ALIGNMENTS = ['Left', 'Center', 'Right'] as const;
const REFERENCE_STUDY_FOCUS_MODES = ['composition', 'placement', 'economy'] as const;
const TIMELINE_PREVIEW_FRAME_COUNT = 8;
const STUDIO_VISUALLY_HIDDEN_SX = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;
const STUDIO_BRUSH_PACKS = [
  {
    id: 'noir',
    title: 'NOIR LIGHTING PACK',
    accent: '#f6b24d',
    swatches: ['#f8f5ef', '#d9d5cc', '#969087', '#4e4a44'],
    preview: 'strokes',
  },
  {
    id: 'high-key',
    title: 'COMMERCIAL HIGH-KEY',
    accent: '#7dd3fc',
    swatches: ['#fef3c7', '#fde68a', '#fbbf24', '#fb7185'],
    preview: 'frames',
  },
  {
    id: 'crosshatch',
    title: 'ACTION CROSSHATCH',
    accent: '#f87171',
    swatches: ['#f8fafc', '#cbd5e1', '#64748b', '#111827'],
    preview: 'frames',
  },
  {
    id: 'wash',
    title: 'SOFT DRAMA WASH',
    accent: '#f59e0b',
    swatches: ['#fef7ed', '#fed7aa', '#fb923c', '#7c2d12'],
    preview: 'frames',
  },
] as const;
const STUDIO_LIBRARY_GROUPS = [
  ['Construction', 'Hard Shadow'],
  ['Inks', 'Soft Gradient'],
  ['Shadows', 'Crosshatch'],
  ['Texture', 'Ink Line'],
  ['FX', 'Smudge'],
  ['Custom', 'Light Wrap'],
] as const;
const STUDIO_TOOL_RAIL = [
  { id: 'packs', label: 'Packs', shortLabel: 'PK', hotkey: '1', icon: ViewSidebar },
  { id: 'brush', label: 'Brush', shortLabel: 'BR', hotkey: '2', icon: Brush },
  { id: 'tone', label: 'Tone', shortLabel: 'TN', hotkey: '3', icon: Highlight },
  { id: 'text', label: 'Text', shortLabel: 'TX', hotkey: '4', icon: TextFields },
  { id: 'camera', label: 'Camera', shortLabel: 'CM', hotkey: '5', icon: CameraAlt },
  { id: 'light', label: 'Light', shortLabel: 'LT', hotkey: '6', icon: LightMode },
] as const;
const STUDIO_LAYER_TINTS = ['#cbd5e1', '#f8fafc', '#f6b24d', '#fde68a', '#94a3b8', '#93c5fd'] as const;
const STUDIO_FLYTHROUGH_TRANSITIONS: StoryboardDocumentTransition[] = ['cut', 'linear', 'ease'];
const STUDIO_LAYER_NOTE_PRESETS = {
  sketch: { note: 'Blocking hold with safe-area crop', tag: 'FRAME' },
  'line art': { note: 'Hero silhouette reads clean in center', tag: 'READ' },
  shadows: { note: 'Push contrast on forearm and gun plane', tag: 'VALUE' },
  lighting: { note: 'Street practical from screen right', tag: 'LIGHT' },
  'px / grain': { note: 'Add subtle dust and rain pass', tag: 'TEXTURE' },
} as const;
const STUDIO_SHOT_META = [
  ['Screen Dir', 'R -> L'],
  ['Focus', 'Hero forearm'],
  ['Eyeline', 'Dead center'],
  ['Rhythm', 'Push in'],
] as const;

function isBrushType(value: string): value is BrushType {
  return (STANDARD_BRUSH_OPTIONS as string[]).includes(value);
}

function isProBrushType(value: string): value is ProBrushType {
  return (PRO_BRUSH_OPTIONS as string[]).includes(value);
}

function getCanvasDimensions(
  aspectRatio: string,
  containerWidth: number,
  containerHeight: number
): CanvasDimensions {
  const ratio = ASPECT_RATIOS[aspectRatio] || 16 / 9;
  const edgePadding = containerWidth < 900 ? 14 : 24;
  const maxWidth = Math.max(240, containerWidth - edgePadding);
  const maxHeight = Math.max(160, containerHeight - edgePadding);

  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return { width: Math.floor(width), height: Math.floor(height) };
}

function getInitialViewport(): ViewportSize {
  if (typeof window === 'undefined') {
    return { width: 1280, height: 800 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function toTestIdFragment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getStudioLayerIcon(layerType: StoryboardDocumentRenderableLayer['type']) {
  if (layerType === 'effect') {
    return FlashOn;
  }
  if (layerType === 'group') {
    return ViewSidebar;
  }
  if (layerType === 'transformation') {
    return SlowMotionVideo;
  }
  if (layerType === 'video') {
    return PlayArrow;
  }
  if (layerType === 'audio') {
    return FiberManualRecord;
  }
  return Layers;
}

function formatDurationCompact(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${totalSeconds}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
}

function formatClockDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatProjectionModeLabel(mode: StoryboardDocumentProjectionMode): string {
  if (mode === 'projection') return 'Projection';
  if (mode === 'rearrange') return 'Rearrange';
  return 'Planar';
}

function formatReferenceStudyFocusModeLabel(mode: ReferenceStudyFocusMode): string {
  if (mode === 'placement') return 'Placement';
  if (mode === 'economy') return 'Economy';
  return 'Composition';
}

function formatCanvasTransformSummary(canvas: StoryboardDocumentSpatialCanvas): string {
  return `x ${Math.round(canvas.transform.x)} · y ${Math.round(canvas.transform.y)} · z ${Math.round(canvas.transform.z)}`;
}

function formatCanvasTransformReadout(canvas: StoryboardDocumentSpatialCanvas): string {
  return `Scale ${canvas.transform.scale.toFixed(2)} · Depth ${Math.round(canvas.transform.z)} · Rot ${Math.round(canvas.transform.rotationZ)}°`;
}

function formatBookmarkCameraSummary(bookmark: StoryboardDocumentBookmarkView): string {
  return `x ${Math.round(bookmark.camera.x)} · y ${Math.round(bookmark.camera.y)} · z ${Math.round(bookmark.camera.z)} · zoom ${bookmark.camera.zoom.toFixed(2)}`;
}

function isBookmarkCameraSynced(
  bookmark: StoryboardDocumentBookmarkView | undefined,
  canvas: StoryboardDocumentSpatialCanvas | undefined,
): boolean {
  if (!bookmark || !canvas) {
    return false;
  }

  return (
    Math.abs(bookmark.camera.x - canvas.transform.x) < 0.5
    && Math.abs(bookmark.camera.y - canvas.transform.y) < 0.5
    && Math.abs(bookmark.camera.z - canvas.transform.z) < 0.5
    && Math.abs(bookmark.camera.zoom - canvas.transform.scale) < 0.01
    && Math.abs(bookmark.camera.rotationX - canvas.transform.rotationX) < 0.5
    && Math.abs(bookmark.camera.rotationY - canvas.transform.rotationY) < 0.5
    && Math.abs(bookmark.camera.rotationZ - canvas.transform.rotationZ) < 0.5
  );
}

function buildSpatialMapLayout(canvases: StoryboardDocumentSpatialCanvas[]) {
  if (canvases.length === 0) {
    return {
      nodes: [],
      xRange: 1,
      yRange: 1,
    };
  }

  const xs = canvases.map((canvas) => canvas.transform.x);
  const ys = canvases.map((canvas) => canvas.transform.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xRange = Math.max(1, maxX - minX);
  const yRange = Math.max(1, maxY - minY);

  return {
    nodes: canvases.map((canvas) => {
      const left = SPATIAL_MAP_X_OFFSET_PERCENT + (((canvas.transform.x - minX) / xRange) * SPATIAL_MAP_X_SPAN_PERCENT);
      const top = SPATIAL_MAP_Y_OFFSET_PERCENT + (((canvas.transform.y - minY) / yRange) * SPATIAL_MAP_Y_SPAN_PERCENT);
      const width = Math.max(12, Math.min(28, 12 + (canvas.transform.scale * 8)));
      const height = Math.max(8, Math.min(18, width * 0.56));
      return {
        canvas,
        left,
        top,
        width,
        height,
      };
    }),
    xRange,
    yRange,
  };
}

function getCanvasResolutionForPreset(
  preset: (typeof STUDIO_CANVAS_RESOLUTION_PRESETS)[number],
  aspectRatioLabel: StoryboardDocumentAspectRatio | undefined,
): { width: number; height: number } {
  const ratio = ASPECT_RATIOS[aspectRatioLabel || '16:9'] || (16 / 9);
  const widthBase = preset === '4K' ? 3840 : preset === '2K' ? 2048 : 1920;
  const height = Math.max(1, Math.round(widthBase / ratio));
  return { width: widthBase, height };
}

function formatTimelineTimecode(frameIndex: number, fps: number, isDirty: boolean): string {
  const safeFps = Math.max(1, Math.round(fps));
  const clampedFrame = Math.max(0, Math.round(frameIndex));
  const totalSeconds = Math.floor(clampedFrame / safeFps);
  const frames = clampedFrame % safeFps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames
    .toString()
    .padStart(2, '0')}${isDirty ? '*' : ''}`;
}

function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function buildStrokeSignature(strokes: PencilStroke[]): string {
  return JSON.stringify(
    strokes.map((stroke) => ({
      color: stroke.color,
      width: stroke.width,
      opacity: stroke.opacity,
      points: stroke.points.map((point) => [
        Math.round(point.x * 10) / 10,
        Math.round(point.y * 10) / 10,
        Math.round(point.pressure * 100) / 100,
      ]),
    }))
  );
}

function buildLayerSignature(layers: StoryboardDocumentRenderableLayer[], activeLayerId?: string): string {
  return JSON.stringify({
    activeLayerId,
    layers: layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: Math.round(layer.opacity * 1000) / 1000,
      blendMode: layer.blendMode,
    })),
  });
}

function formatBlendModeLabel(mode: StoryboardDocumentBlendMode): string {
  return mode
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function drawStrokePreview(
  context: CanvasRenderingContext2D,
  stroke: PencilStroke,
  scaleX: number,
  scaleY: number
): void {
  const points = stroke.points;
  if (!points.length) return;

  context.save();
  context.strokeStyle = stroke.color || '#ffffff';
  context.globalAlpha = typeof stroke.opacity === 'number' ? stroke.opacity : 1;
  context.lineWidth = Math.max(0.8, stroke.width * ((scaleX + scaleY) / 2));
  context.lineCap = stroke.brush?.type === 'marker' ? 'square' : 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.moveTo(points[0].x * scaleX, points[0].y * scaleY);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x * scaleX, points[index].y * scaleY);
  }
  if (points.length === 1) {
    context.lineTo(points[0].x * scaleX + 0.01, points[0].y * scaleY + 0.01);
  }
  context.stroke();
  context.restore();
}

function createTimelinePreviewCanvas(
  width: number,
  height: number,
  strokes: PencilStroke[]
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.clearRect(0, 0, width, height);
  context.fillStyle = 'rgba(6,8,14,0.96)';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = 'rgba(255,255,255,0.08)';
  context.strokeRect(0.5, 0.5, width - 1, height - 1);

  const scaleX = width / 1920;
  const scaleY = height / 1080;
  strokes.forEach((stroke) => drawStrokePreview(context, stroke, scaleX, scaleY));
  return canvas;
}

function createReferenceStudyAttemptPreviewDataUrl(
  width: number,
  height: number,
  strokes: PencilStroke[]
): string | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.clearRect(0, 0, width, height);
  const scaleX = width / 1920;
  const scaleY = height / 1080;
  strokes.forEach((stroke) => drawStrokePreview(context, stroke, scaleX, scaleY));
  return canvas.toDataURL('image/png');
}

function clonePencilStroke(stroke: PencilStroke): PencilStroke {
  return {
    ...stroke,
    brush: stroke.brush ? { ...stroke.brush } : undefined,
    points: stroke.points.map((point) => ({ ...point })),
  };
}

function deriveReferenceStudyAttemptMetrics(
  strokes: PencilStroke[],
  width: number,
  height: number,
): ReferenceStudyAttemptMetrics {
  const pointCount = strokes.reduce((total, stroke) => total + stroke.points.length, 0);
  const strokeCount = strokes.length;
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let totalPathLength = 0;
  let totalStrokeWidth = 0;
  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  let leftWeight = 0;
  let rightWeight = 0;
  let topWeight = 0;
  let bottomWeight = 0;

  strokes.forEach((stroke) => {
    totalStrokeWidth += stroke.width;
    stroke.points.forEach((point, index) => {
      const weight = Math.max(0.35, point.pressure || 0.35) * Math.max(1, stroke.width);
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
      totalWeight += weight;
      weightedX += point.x * weight;
      weightedY += point.y * weight;
      if ((point.x / safeWidth) < 0.5) {
        leftWeight += weight;
      } else {
        rightWeight += weight;
      }
      if ((point.y / safeHeight) < 0.5) {
        topWeight += weight;
      } else {
        bottomWeight += weight;
      }
      if (index > 0) {
        const previous = stroke.points[index - 1];
        totalPathLength += Math.hypot(point.x - previous.x, point.y - previous.y);
      }
    });
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return {
      strokeCount,
      pointCount,
      widthRatio: 0,
      heightRatio: 0,
      centerXRatio: 0,
      centerYRatio: 0,
      averageStrokeWidth: strokeCount > 0 ? totalStrokeWidth / strokeCount : 0,
      totalPathLength,
      focusXRatio: 0,
      focusYRatio: 0,
      horizontalBalance: 0,
      verticalBalance: 0,
      silhouetteDensity: 0,
    };
  }

  const boundsWidth = Math.max(0, maxX - minX);
  const boundsHeight = Math.max(0, maxY - minY);
  const boundsArea = Math.max(1, boundsWidth * boundsHeight);
  const safeWeight = Math.max(1, totalWeight);
  return {
    strokeCount,
    pointCount,
    widthRatio: boundsWidth / safeWidth,
    heightRatio: boundsHeight / safeHeight,
    centerXRatio: ((minX + maxX) / 2) / safeWidth,
    centerYRatio: ((minY + maxY) / 2) / safeHeight,
    averageStrokeWidth: strokeCount > 0 ? totalStrokeWidth / strokeCount : 0,
    totalPathLength,
    focusXRatio: (weightedX / safeWeight) / safeWidth,
    focusYRatio: (weightedY / safeWeight) / safeHeight,
    horizontalBalance: (rightWeight - leftWeight) / safeWeight,
    verticalBalance: (bottomWeight - topWeight) / safeWeight,
    silhouetteDensity: totalPathLength / boundsArea,
  };
}

function describeReferenceStudyFocusRead(metrics: ReferenceStudyAttemptMetrics): string {
  if (metrics.pointCount === 0) {
    return 'No focus read yet';
  }
  const horizontal = metrics.focusXRatio <= 0.47 ? 'left' : metrics.focusXRatio >= 0.53 ? 'right' : 'center';
  const vertical = metrics.focusYRatio <= 0.45 ? 'high' : metrics.focusYRatio >= 0.55 ? 'low' : 'mid';
  if (horizontal === 'center' && vertical === 'mid') {
    return 'centered';
  }
  if (horizontal === 'center') {
    return vertical;
  }
  if (vertical === 'mid') {
    return horizontal;
  }
  return `${vertical}-${horizontal}`;
}

function describeReferenceStudyBalanceRead(metrics: ReferenceStudyAttemptMetrics): string {
  if (metrics.pointCount === 0) {
    return 'balanced';
  }
  if (metrics.horizontalBalance >= 0.12) {
    return 'right-heavy';
  }
  if (metrics.horizontalBalance <= -0.12) {
    return 'left-heavy';
  }
  return 'balanced';
}

function describeReferenceStudySilhouetteRead(metrics: ReferenceStudyAttemptMetrics): string {
  if (metrics.pointCount === 0) {
    return 'empty';
  }
  if (metrics.widthRatio < 0.1 || metrics.heightRatio < 0.06) {
    return 'thin';
  }
  if (metrics.silhouetteDensity > 0.04) {
    return 'dense';
  }
  return 'open';
}

function deriveReferenceStudyReadLabels(metrics: ReferenceStudyAttemptMetrics) {
  return {
    focusRead: describeReferenceStudyFocusRead(metrics),
    balanceRead: describeReferenceStudyBalanceRead(metrics),
    silhouetteRead: describeReferenceStudySilhouetteRead(metrics),
  };
}

function getReferenceStudyDrillLabel(drillId: ReferenceStudyDrillId): string {
  switch (drillId) {
    case 'focus-up':
      return 'Focus Up';
    case 'focus-right':
      return 'Push Right';
    case 'widen':
      return 'Widen';
    case 'reduce-passes':
      return 'Reduce Passes';
    case 'balance-center':
      return 'Center Weight';
    default:
      return 'Next Drill';
  }
}

function getRecommendedReferenceStudyDrill(
  current: ReferenceStudyAttemptMetrics,
  baseline: ReferenceStudyAttemptMetrics | undefined,
): ReferenceStudyDrillId {
  if (!baseline) {
    return 'widen';
  }
  if (current.pointCount === 0) {
    return 'focus-up';
  }
  if (current.focusYRatio >= baseline.focusYRatio + 0.035) {
    return 'focus-up';
  }
  if (current.horizontalBalance >= 0.12) {
    return 'balance-center';
  }
  if (current.widthRatio <= baseline.widthRatio + 0.02) {
    return 'widen';
  }
  if (current.strokeCount >= baseline.strokeCount) {
    return 'reduce-passes';
  }
  return 'focus-right';
}

function buildReferenceStudyDrillSummary(
  drillId: ReferenceStudyDrillId,
  current: ReferenceStudyAttemptMetrics,
  baseline: ReferenceStudyAttemptMetrics,
  baselineName: string,
): string {
  if (current.pointCount === 0) {
    switch (drillId) {
      case 'focus-up':
        return `Target armed: push the focus higher than ${baselineName} in the next round.`;
      case 'focus-right':
        return `Target armed: push the focus further right than ${baselineName} in the next round.`;
      case 'widen':
        return `Target armed: widen the silhouette beyond ${baselineName} in the next round.`;
      case 'reduce-passes':
        return `Target armed: solve the beat in fewer passes than ${baselineName} in the next round.`;
      case 'balance-center':
        return `Target armed: pull the visual weight closer to center than ${baselineName} in the next round.`;
      default:
        return 'Target armed for the next round.';
    }
  }

  switch (drillId) {
    case 'focus-up':
      return current.focusYRatio <= baseline.focusYRatio - 0.04
        ? `Target met: focus now sits higher than ${baselineName}.`
        : `Need more height shift to beat ${baselineName}.`;
    case 'focus-right':
      return current.focusXRatio >= baseline.focusXRatio + 0.04
        ? `Target met: focus now pushes further right than ${baselineName}.`
        : `Push the beat further right to beat ${baselineName}.`;
    case 'widen':
      return current.widthRatio >= baseline.widthRatio + 0.03
        ? `Target met: silhouette now reads wider than ${baselineName}.`
        : `Open the silhouette wider to beat ${baselineName}.`;
    case 'reduce-passes':
      return current.strokeCount <= baseline.strokeCount - 1
        ? `Target met: this pass uses fewer strokes than ${baselineName}.`
        : `Strip the idea down to fewer passes than ${baselineName}.`;
    case 'balance-center':
      return Math.abs(current.horizontalBalance) <= Math.abs(baseline.horizontalBalance) - 0.06
        ? `Target met: weight sits closer to center than ${baselineName}.`
        : `Pull the weight closer to center to beat ${baselineName}.`;
    default:
      return 'No drill armed.';
  }
}

function isReferenceStudyDrillMet(
  drillId: ReferenceStudyDrillId,
  current: ReferenceStudyAttemptMetrics,
  baseline: ReferenceStudyAttemptMetrics,
): boolean {
  switch (drillId) {
    case 'focus-up':
      return current.focusYRatio <= baseline.focusYRatio - 0.04;
    case 'focus-right':
      return current.focusXRatio >= baseline.focusXRatio + 0.04;
    case 'widen':
      return current.widthRatio >= baseline.widthRatio + 0.03;
    case 'reduce-passes':
      return current.strokeCount <= baseline.strokeCount - 1;
    case 'balance-center':
      return Math.abs(current.horizontalBalance) <= Math.abs(baseline.horizontalBalance) - 0.06;
    default:
      return false;
  }
}

function deriveReferenceStudyAttemptDrillResult(
  drillId: ReferenceStudyDrillId | undefined,
  current: ReferenceStudyAttemptMetrics,
  baseline: ReferenceStudyAttemptMetrics | undefined,
  baselineName: string | undefined,
) {
  if (!drillId || !baseline || !baselineName || current.pointCount === 0) {
    return {};
  }

  return {
    drillId,
    drillStatus: isReferenceStudyDrillMet(drillId, current, baseline) ? 'met' as const : 'retry' as const,
    drillBaselineName: baselineName,
  };
}

function clampReferenceStudyDrillProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function getReferenceStudyDrillProgressValue(
  drillId: ReferenceStudyDrillId,
  current: ReferenceStudyAttemptMetrics,
  baseline: ReferenceStudyAttemptMetrics,
): number {
  switch (drillId) {
    case 'focus-up':
      return clampReferenceStudyDrillProgress((baseline.focusYRatio - current.focusYRatio) / 0.04);
    case 'focus-right':
      return clampReferenceStudyDrillProgress((current.focusXRatio - baseline.focusXRatio) / 0.04);
    case 'widen':
      return clampReferenceStudyDrillProgress((current.widthRatio - baseline.widthRatio) / 0.03);
    case 'reduce-passes':
      return clampReferenceStudyDrillProgress((baseline.strokeCount - current.strokeCount) / 1);
    case 'balance-center':
      return clampReferenceStudyDrillProgress((Math.abs(baseline.horizontalBalance) - Math.abs(current.horizontalBalance)) / 0.06);
    default:
      return 0;
  }
}

function getReferenceStudyDrillDirectionLabel(
  drillId: ReferenceStudyDrillId,
  current: ReferenceStudyAttemptMetrics,
  baseline: ReferenceStudyAttemptMetrics,
): string {
  switch (drillId) {
    case 'focus-up':
      return current.focusYRatio < baseline.focusYRatio ? 'Moving higher' : 'Needs lift';
    case 'focus-right':
      return current.focusXRatio > baseline.focusXRatio ? 'Moving right' : 'Needs push';
    case 'widen':
      return current.widthRatio > baseline.widthRatio ? 'Opening up' : 'Needs width';
    case 'reduce-passes':
      return current.strokeCount < baseline.strokeCount ? 'Simplifying' : 'Too many passes';
    case 'balance-center':
      return Math.abs(current.horizontalBalance) < Math.abs(baseline.horizontalBalance) ? 'Centering' : 'Still weighted';
    default:
      return 'In motion';
  }
}

function buildReferenceStudyDrillTrajectorySummary(
  drillId: ReferenceStudyDrillId,
  current: ReferenceStudyAttemptMetrics,
  baseline: ReferenceStudyAttemptMetrics,
  baselineName: string,
): string {
  if (current.pointCount === 0) {
    return `Start a new round to track live progress toward ${getReferenceStudyDrillLabel(drillId)} against ${baselineName}.`;
  }

  const progressPercent = Math.round(getReferenceStudyDrillProgressValue(drillId, current, baseline) * 100);
  if (isReferenceStudyDrillMet(drillId, current, baseline)) {
    return `${getReferenceStudyDrillLabel(drillId)} is on target. Current round is ${progressPercent}% of the way past ${baselineName}.`;
  }

  return `${getReferenceStudyDrillLabel(drillId)} is ${progressPercent}% locked against ${baselineName}. Keep pushing the live round before you save it.`;
}

function buildReferenceStudyDrillCheckpoints(
  drillId: ReferenceStudyDrillId,
  current: ReferenceStudyAttemptMetrics,
  baseline: ReferenceStudyAttemptMetrics,
) {
  switch (drillId) {
    case 'focus-up': {
      const currentLift = Math.max(0, Math.round((baseline.focusYRatio - current.focusYRatio) * 100));
      const goalLift = 4;
      return {
        current: `Current lift ${currentLift}%`,
        goal: `Goal lift ${goalLift}%`,
        remaining: `Remain ${Math.max(0, goalLift - currentLift)}%`,
      };
    }
    case 'focus-right': {
      const currentPush = Math.max(0, Math.round((current.focusXRatio - baseline.focusXRatio) * 100));
      const goalPush = 4;
      return {
        current: `Current push ${currentPush}%`,
        goal: `Goal push ${goalPush}%`,
        remaining: `Remain ${Math.max(0, goalPush - currentPush)}%`,
      };
    }
    case 'widen': {
      const currentWidth = Math.max(0, Math.round((current.widthRatio - baseline.widthRatio) * 100));
      const goalWidth = 3;
      return {
        current: `Current width ${currentWidth}%`,
        goal: `Goal width ${goalWidth}%`,
        remaining: `Remain ${Math.max(0, goalWidth - currentWidth)}%`,
      };
    }
    case 'reduce-passes': {
      const currentPassSave = Math.max(0, baseline.strokeCount - current.strokeCount);
      const goalPassSave = 1;
      return {
        current: `Current save ${currentPassSave}`,
        goal: `Goal save ${goalPassSave}`,
        remaining: `Remain ${Math.max(0, goalPassSave - currentPassSave)}`,
      };
    }
    case 'balance-center': {
      const currentCentering = Math.max(0, Math.round((Math.abs(baseline.horizontalBalance) - Math.abs(current.horizontalBalance)) * 100));
      const goalCentering = 6;
      return {
        current: `Current center ${currentCentering}%`,
        goal: `Goal center ${goalCentering}%`,
        remaining: `Remain ${Math.max(0, goalCentering - currentCentering)}%`,
      };
    }
    default:
      return {
        current: 'Current 0%',
        goal: 'Goal 0%',
        remaining: 'Remain 0%',
      };
  }
}

function buildReferenceStudyDrillPlaybook(
  drillId: ReferenceStudyDrillId,
  focusMode: ReferenceStudyFocusMode,
  focusRead: string,
  balanceRead: string,
  silhouetteRead: string,
  hasLiveRound: boolean,
) {
  const modeNudge = focusMode === 'economy'
    ? 'Keep the pass economical.'
    : focusMode === 'placement'
      ? 'Let placement lead the fix.'
      : 'Protect the composition while you adjust it.';

  switch (drillId) {
    case 'focus-up':
      return {
        headline: hasLiveRound ? 'Lift the read before you save this round.' : 'Start the next round by lifting the read.',
        primary: focusRead.includes('low') ? 'Pull the heaviest stroke cluster above center.' : 'Keep the mass climbing higher in frame.',
        secondary: silhouetteRead === 'dense' ? 'Open the silhouette as you lift it.' : 'Hold the silhouette open while the focus rises.',
        watch: balanceRead === 'right-heavy' ? `Trim right-side weight as you lift. ${modeNudge}` : `Lift first, then check the side-weight drift. ${modeNudge}`,
      };
    case 'focus-right':
      return {
        headline: hasLiveRound ? 'Push the read further right before you commit the pass.' : 'Start the next round by pushing the read right.',
        primary: focusRead.includes('left') || focusRead === 'centered' ? 'Shift the key shape further screen-right.' : 'Keep extending the read toward screen-right.',
        secondary: silhouetteRead === 'thin' ? 'Give the pushed read enough width to stay legible.' : 'Protect negative space while the read moves right.',
        watch: balanceRead === 'left-heavy' ? `Do not leave leftover weight on the left side. ${modeNudge}` : `Push right without collapsing the center read. ${modeNudge}`,
      };
    case 'widen':
      return {
        headline: hasLiveRound ? 'Open the silhouette before you save this pass.' : 'Start the next round by widening the silhouette.',
        primary: 'Push the outer contour farther apart.',
        secondary: silhouetteRead === 'dense' ? 'Break tangents so the read opens up.' : 'Protect the central negative space as you widen it.',
        watch: `Do not add width with noisy correction lines. ${modeNudge}`,
      };
    case 'reduce-passes':
      return {
        headline: hasLiveRound ? 'Solve the beat in fewer passes before saving.' : 'Start the next round by simplifying the pass count.',
        primary: 'Commit to one decisive contour first.',
        secondary: 'Skip duplicate corrective lines unless they change the read.',
        watch: `If the read is clear, stop early. ${modeNudge}`,
      };
    case 'balance-center':
      return {
        headline: hasLiveRound ? 'Pull the weight toward center before you save.' : 'Start the next round by centering the weight.',
        primary: balanceRead === 'right-heavy' ? 'Lighten the right-side accents first.' : 'Lighten the left-side accents first.',
        secondary: 'Rebuild the focus near the center of gravity.',
        watch: `Center the weight without flattening the staging. ${modeNudge}`,
      };
    default:
      return {
        headline: 'Use the next pass to improve the read.',
        primary: 'Push the clearest shape first.',
        secondary: 'Keep the silhouette readable.',
        watch: modeNudge,
      };
  }
}

function formatReferenceStudyMetricDelta(delta: number, unit = '%'): string {
  const signed = Math.round(delta * 100);
  return `${signed >= 0 ? '+' : ''}${signed}${unit}`;
}

function buildReferenceStudyCoachSummary(
  current: ReferenceStudyAttemptMetrics,
  baseline: ReferenceStudyAttemptMetrics,
  baselineName: string,
  focusMode: ReferenceStudyFocusMode,
): string {
  const widthDelta = current.widthRatio - baseline.widthRatio;
  const heightDelta = current.heightRatio - baseline.heightRatio;
  const xDelta = current.centerXRatio - baseline.centerXRatio;
  const yDelta = current.centerYRatio - baseline.centerYRatio;
  const strokeDelta = current.strokeCount - baseline.strokeCount;
  const pathDelta = current.totalPathLength - baseline.totalPathLength;
  const lineWeightDelta = current.averageStrokeWidth - baseline.averageStrokeWidth;

  if (focusMode === 'composition') {
    const notes: string[] = [];
    if (Math.abs(widthDelta) >= 0.03) {
      notes.push(widthDelta > 0 ? `Wider silhouette than ${baselineName}` : `Narrower silhouette than ${baselineName}`);
    }
    if (Math.abs(heightDelta) >= 0.03) {
      notes.push(heightDelta > 0 ? `Taller span than ${baselineName}` : `Shorter span than ${baselineName}`);
    }
    if (Math.abs(xDelta) >= 0.03) {
      notes.push(xDelta > 0 ? `Shifted right of ${baselineName}` : `Shifted left of ${baselineName}`);
    }
    if (notes.length === 0) {
      return `Composition tracks ${baselineName} closely. Push negative space or silhouette width for a stronger variation.`;
    }
    return `${notes.slice(0, 2).join('. ')}.`;
  }

  if (focusMode === 'placement') {
    const notes: string[] = [];
    if (Math.abs(yDelta) >= 0.035) {
      notes.push(yDelta > 0 ? `Sits lower than ${baselineName}` : `Sits higher than ${baselineName}`);
    }
    if (Math.abs(xDelta) >= 0.03) {
      notes.push(xDelta > 0 ? `Shifted right of ${baselineName}` : `Shifted left of ${baselineName}`);
    }
    if (Math.abs(heightDelta) >= 0.03) {
      notes.push(heightDelta > 0 ? `Pushes taller staging than ${baselineName}` : `Compresses staging more than ${baselineName}`);
    }
    if (notes.length === 0) {
      return `Placement tracks ${baselineName} closely. Move the beat higher, lower, or off-center to test a stronger staging choice.`;
    }
    return `${notes.slice(0, 2).join('. ')}.`;
  }

  const notes: string[] = [];
  if (Math.abs(strokeDelta) >= 1) {
    notes.push(strokeDelta > 0 ? 'More fragmented pass count' : 'Cleaner pass count');
  }
  if (Math.abs(pathDelta) >= 18) {
    notes.push(pathDelta > 0 ? `Longer line mileage than ${baselineName}` : `Shorter line mileage than ${baselineName}`);
  }
  if (Math.abs(lineWeightDelta) >= 0.2) {
    notes.push(lineWeightDelta > 0 ? `Heavier average line weight than ${baselineName}` : `Lighter average line weight than ${baselineName}`);
  }
  if (notes.length === 0) {
    return `Economy tracks ${baselineName} closely. Try solving the shape with fewer passes or a cleaner single-stroke statement.`;
  }
  return `${notes.slice(0, 2).join('. ')}.`;
}

function buildReferenceStudyAttemptDeltaSummary(
  current: ReferenceStudyAttemptMetrics,
  baseline: ReferenceStudyAttemptMetrics,
  baselineName: string,
): string {
  const notes: string[] = [];
  const widthDelta = current.widthRatio - baseline.widthRatio;
  const yDelta = current.centerYRatio - baseline.centerYRatio;
  const strokeDelta = current.strokeCount - baseline.strokeCount;

  if (Math.abs(widthDelta) >= 0.03) {
    notes.push(widthDelta > 0 ? 'Wider silhouette' : 'Narrower silhouette');
  }
  if (Math.abs(yDelta) >= 0.035) {
    notes.push(yDelta > 0 ? 'Lower placement' : 'Higher placement');
  }
  if (strokeDelta !== 0) {
    notes.push(`Passes ${strokeDelta >= 0 ? '+' : ''}${strokeDelta}`);
  }

  if (notes.length === 0) {
    return `Tracks ${baselineName} closely`;
  }

  return `${notes.join(' · ')} vs ${baselineName}`;
}

function getReferenceStudyAttemptFocusScore(
  metrics: ReferenceStudyAttemptMetrics,
  focusMode: ReferenceStudyFocusMode,
): number {
  if (focusMode === 'composition') {
    return (metrics.widthRatio * 1000) + (metrics.heightRatio * 600) - (metrics.silhouetteDensity * 120);
  }

  if (focusMode === 'placement') {
    return (Math.abs(metrics.centerYRatio - 0.5) * 1000) + (Math.abs(metrics.centerXRatio - 0.5) * 350) + (metrics.heightRatio * 250);
  }

  return (metrics.strokeCount * -1000) + (metrics.totalPathLength * -1) + (metrics.averageStrokeWidth * -20);
}

function buildReferenceStudyPickReason(
  metrics: ReferenceStudyAttemptMetrics,
  focusMode: ReferenceStudyFocusMode,
): string {
  if (focusMode === 'composition') {
    if (metrics.widthRatio >= 0.12) {
      return 'Wide read';
    }
    if (metrics.heightRatio >= 0.08) {
      return 'Tall staging';
    }
    return metrics.silhouetteDensity > 0.04 ? 'Dense silhouette' : 'Open silhouette';
  }

  if (focusMode === 'placement') {
    if (metrics.centerYRatio >= 0.55) {
      return 'Lower staging';
    }
    if (metrics.centerYRatio <= 0.45) {
      return 'Higher staging';
    }
    if (Math.abs(metrics.centerXRatio - 0.5) >= 0.05) {
      return 'Off-center read';
    }
    return 'Centered placement';
  }

  if (metrics.strokeCount <= 1) {
    return '1-pass statement';
  }
  if (metrics.strokeCount === 2) {
    return '2-pass solve';
  }
  return 'Layered pass';
}

function buildReferenceStudyPickSummary(
  attempt: ReferenceStudyAttemptRecord,
  focusMode: ReferenceStudyFocusMode,
  bestModes: ReferenceStudyFocusMode[],
): string {
  const primaryLabel = formatReferenceStudyFocusModeLabel(focusMode);
  const primaryReason = buildReferenceStudyPickReason(attempt.metrics, focusMode);
  const secondaryModes = bestModes.filter((mode) => mode !== focusMode);

  if (secondaryModes.length === 0) {
    return `${attempt.name} is the strongest ${primaryLabel.toLowerCase()} baseline right now. ${primaryReason}.`;
  }

  const secondarySummary = secondaryModes
    .map((mode) => `${formatReferenceStudyFocusModeLabel(mode)} ${buildReferenceStudyPickReason(attempt.metrics, mode).toLowerCase()}`)
    .join(' · ');

  return `${attempt.name} is the strongest ${primaryLabel.toLowerCase()} baseline right now. ${primaryReason}. Also leads ${secondarySummary}.`;
}

function buildReferenceStudySessionSummary(
  attempt: ReferenceStudyAttemptRecord,
  leadModes: ReferenceStudyFocusMode[],
  trailingModes: ReferenceStudyFocusMode[],
): string {
  const leadLabel = leadModes.map(formatReferenceStudyFocusModeLabel).join(' + ');
  if (trailingModes.length === 0) {
    return `${attempt.name} leads every study lane right now.`;
  }

  const trailingLabel = trailingModes.map(formatReferenceStudyFocusModeLabel).join(' + ');
  return `${attempt.name} leads ${leadLabel}. ${trailingLabel} still belongs to another attempt.`;
}

function buildReferenceStudyLaneSummary(
  focusMode: ReferenceStudyFocusMode,
  attempts: ReferenceStudyAttemptRecord[],
): string {
  const [leader, runnerUp] = attempts;
  if (!leader) {
    return 'No attempts saved yet.';
  }

  if (!runnerUp) {
    return `${leader.name} sets the first ${formatReferenceStudyFocusModeLabel(focusMode).toLowerCase()} ladder.`;
  }

  if (focusMode === 'composition') {
    const widthDelta = leader.metrics.widthRatio - runnerUp.metrics.widthRatio;
    const heightDelta = leader.metrics.heightRatio - runnerUp.metrics.heightRatio;

    if (Math.abs(widthDelta) >= 0.03) {
      return `${leader.name} reads ${widthDelta > 0 ? 'wider' : 'narrower'} than ${runnerUp.name}.`;
    }
    if (Math.abs(heightDelta) >= 0.03) {
      return `${leader.name} stages ${heightDelta > 0 ? 'taller' : 'shorter'} than ${runnerUp.name}.`;
    }
    return `${leader.name} holds a clearer silhouette than ${runnerUp.name}.`;
  }

  if (focusMode === 'placement') {
    const yDelta = leader.metrics.centerYRatio - runnerUp.metrics.centerYRatio;
    const xDelta = Math.abs(leader.metrics.centerXRatio - 0.5) - Math.abs(runnerUp.metrics.centerXRatio - 0.5);

    if (Math.abs(yDelta) >= 0.03) {
      return `${leader.name} stages ${yDelta > 0 ? 'lower' : 'higher'} than ${runnerUp.name}.`;
    }
    if (Math.abs(xDelta) >= 0.03) {
      return `${leader.name} pushes ${xDelta > 0 ? 'further off-center' : 'closer to center'} than ${runnerUp.name}.`;
    }
    return `${leader.name} anchors the placement more decisively than ${runnerUp.name}.`;
  }

  const strokeDelta = runnerUp.metrics.strokeCount - leader.metrics.strokeCount;
  const pathDelta = runnerUp.metrics.totalPathLength - leader.metrics.totalPathLength;
  const lineWeightDelta = runnerUp.metrics.averageStrokeWidth - leader.metrics.averageStrokeWidth;

  if (strokeDelta > 0) {
    return `${leader.name} solves in fewer passes than ${runnerUp.name}.`;
  }
  if (pathDelta >= 10) {
    return `${leader.name} uses shorter line mileage than ${runnerUp.name}.`;
  }
  if (lineWeightDelta >= 0.15) {
    return `${leader.name} keeps a lighter line than ${runnerUp.name}.`;
  }
  return `${leader.name} keeps a cleaner solve than ${runnerUp.name}.`;
}

function buildReferenceStudyLaneGapLabel(
  focusMode: ReferenceStudyFocusMode,
  attempts: ReferenceStudyAttemptRecord[],
): string {
  const [leader, runnerUp] = attempts;
  if (!leader || !runnerUp) {
    return 'Lead gap · Seed';
  }

  if (focusMode === 'composition') {
    const widthGap = Math.round((leader.metrics.widthRatio - runnerUp.metrics.widthRatio) * 100);
    const heightGap = Math.round((leader.metrics.heightRatio - runnerUp.metrics.heightRatio) * 100);
    if (Math.abs(widthGap) >= Math.abs(heightGap) && widthGap !== 0) {
      return `Lead gap · Width ${widthGap >= 0 ? '+' : ''}${widthGap}%`;
    }
    if (heightGap !== 0) {
      return `Lead gap · Height ${heightGap >= 0 ? '+' : ''}${heightGap}%`;
    }
    return 'Lead gap · Silhouette';
  }

  if (focusMode === 'placement') {
    const yGap = Math.round((leader.metrics.centerYRatio - runnerUp.metrics.centerYRatio) * 100);
    const xGap = Math.round(
      (
        Math.abs(leader.metrics.centerXRatio - 0.5)
        - Math.abs(runnerUp.metrics.centerXRatio - 0.5)
      ) * 100
    );
    if (Math.abs(yGap) >= Math.abs(xGap) && yGap !== 0) {
      return `Lead gap · Y ${yGap >= 0 ? '+' : ''}${yGap}%`;
    }
    if (xGap !== 0) {
      return `Lead gap · X ${xGap >= 0 ? '+' : ''}${xGap}%`;
    }
    return 'Lead gap · Placement';
  }

  const passGap = leader.metrics.strokeCount - runnerUp.metrics.strokeCount;
  if (passGap !== 0) {
    return `Lead gap · Passes ${passGap >= 0 ? '+' : ''}${passGap}`;
  }
  const mileageGap = Math.round(
    ((leader.metrics.totalPathLength - runnerUp.metrics.totalPathLength) / Math.max(runnerUp.metrics.totalPathLength, 1)) * 100
  );
  if (mileageGap !== 0) {
    return `Lead gap · Mileage ${mileageGap >= 0 ? '+' : ''}${mileageGap}%`;
  }
  const lineGap = Math.round(
    ((leader.metrics.averageStrokeWidth - runnerUp.metrics.averageStrokeWidth) / Math.max(runnerUp.metrics.averageStrokeWidth, 0.01)) * 100
  );
  if (lineGap !== 0) {
    return `Lead gap · Line ${lineGap >= 0 ? '+' : ''}${lineGap}%`;
  }
  return 'Lead gap · Clean solve';
}

function getReferenceStudyLaneSignal(
  focusMode: ReferenceStudyFocusMode,
  attempts: ReferenceStudyAttemptRecord[],
): number {
  const [leader, runnerUp] = attempts;
  if (!leader || !runnerUp) {
    return 0;
  }

  if (focusMode === 'composition') {
    return Math.max(
      Math.abs((leader.metrics.widthRatio - runnerUp.metrics.widthRatio) * 100),
      Math.abs((leader.metrics.heightRatio - runnerUp.metrics.heightRatio) * 100),
      Math.abs((leader.metrics.silhouetteDensity - runnerUp.metrics.silhouetteDensity) * 100),
    );
  }

  if (focusMode === 'placement') {
    return Math.max(
      Math.abs((leader.metrics.centerYRatio - runnerUp.metrics.centerYRatio) * 100),
      Math.abs((Math.abs(leader.metrics.centerXRatio - 0.5) - Math.abs(runnerUp.metrics.centerXRatio - 0.5)) * 100),
    );
  }

  return Math.max(
    Math.abs(leader.metrics.strokeCount - runnerUp.metrics.strokeCount) * 20,
    Math.abs(((leader.metrics.totalPathLength - runnerUp.metrics.totalPathLength) / Math.max(runnerUp.metrics.totalPathLength, 1)) * 100),
    Math.abs(((leader.metrics.averageStrokeWidth - runnerUp.metrics.averageStrokeWidth) / Math.max(runnerUp.metrics.averageStrokeWidth, 0.01)) * 100),
  );
}

function buildReferenceStudyLaneConfidenceLabel(
  focusMode: ReferenceStudyFocusMode,
  attempts: ReferenceStudyAttemptRecord[],
): string {
  const [leader, runnerUp] = attempts;
  if (!leader || !runnerUp) {
    return 'Lead confidence · Seed';
  }

  const signal = getReferenceStudyLaneSignal(focusMode, attempts);

  if (signal >= 12) {
    return 'Lead confidence · Clear lead';
  }
  if (signal >= 5) {
    return 'Lead confidence · Stable lead';
  }
  return 'Lead confidence · Tight race';
}

function buildReferenceStudyLaneNextMoveLabel(
  focusMode: ReferenceStudyFocusMode,
  attempts: ReferenceStudyAttemptRecord[],
): string {
  const [leader, runnerUp] = attempts;
  if (!leader || !runnerUp) {
    return 'Next move · Save a challenger';
  }

  const signal = getReferenceStudyLaneSignal(focusMode, attempts);

  if (focusMode === 'composition') {
    if (signal >= 12) {
      return 'Next move · Protect width and keep the silhouette open';
    }
    if (signal >= 5) {
      return 'Next move · Push one wider pass to separate the read';
    }
    return 'Next move · Open the silhouette one move farther';
  }

  if (focusMode === 'placement') {
    if (signal >= 12) {
      return 'Next move · Protect the staging height and keep the frame anchored';
    }
    if (signal >= 5) {
      return 'Next move · Push the staging one beat farther';
    }
    return 'Next move · Commit the Y move before adding detail';
  }

  if (signal >= 12) {
    return 'Next move · Keep the lean pass count and resist extra cleanup';
  }
  if (signal >= 5) {
    return 'Next move · Trim one pass before detailing';
  }
  return 'Next move · Cut mileage before you polish';
}

function stripReferenceStudyPersistenceState(
  value: ReferenceStudyPersistedState | Omit<ReferenceStudyPersistedState, 'updatedAt'> | null | undefined,
) {
  if (!value) {
    return null;
  }

  const { updatedAt: _updatedAt, ...rest } = value as ReferenceStudyPersistedState;
  return rest;
}

function stripBoardPolishPersistenceState(
  value: BoardPolishPersistedState | Omit<BoardPolishPersistedState, 'updatedAt'> | null | undefined,
) {
  if (!value) {
    return null;
  }

  const { updatedAt: _updatedAt, ...rest } = value as BoardPolishPersistedState;
  return rest;
}

function deriveTimeLapseStats(strokes: PencilStroke[]) {
  const pointTimestamps = strokes.flatMap((stroke) =>
    stroke.points
      .map((point) => point.timestamp)
      .filter((timestamp) => Number.isFinite(timestamp))
  );
  const pointCount = strokes.reduce((total, stroke) => total + stroke.points.length, 0);
  const firstTimestamp = pointTimestamps.length > 0 ? Math.min(...pointTimestamps) : null;
  const lastTimestamp = pointTimestamps.length > 0 ? Math.max(...pointTimestamps) : null;
  const captureDurationMs = firstTimestamp !== null && lastTimestamp !== null
    ? Math.max(lastTimestamp - firstTimestamp, Math.max(pointCount - 1, 0) * 120)
    : 0;
  const replayDurationMs = captureDurationMs > 0
    ? Math.min(45000, Math.max(8000, Math.round(captureDurationMs / 14)))
    : 0;

  return {
    available: pointCount > 1 && captureDurationMs > 0,
    strokeCount: strokes.length,
    pointCount,
    captureDurationMs,
    replayDurationMs,
    socialCutSeconds: 30,
    masterExportLabel: '4K Master',
  };
}

const toDocumentReferenceSeed = (
  referenceImage: ReferenceImage | null | undefined
): {
  src: string;
  opacity: number;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  fitMode?: 'free' | 'contain' | 'cover';
} | null => (
  referenceImage
    ? {
        src: referenceImage.src,
        opacity: referenceImage.opacity,
        visible: referenceImage.visible,
        x: referenceImage.x,
        y: referenceImage.y,
        width: referenceImage.width,
        height: referenceImage.height,
        rotation: referenceImage.rotation,
        fitMode: referenceImage.fitMode,
      }
    : null
);

const toCanvasReferenceImage = (
  reference: StoryboardDocumentReferenceImage | undefined
): ReferenceImage | null => {
  if (!reference) return null;
  return {
    src: reference.src,
    opacity: reference.opacity,
    visible: reference.visible,
    x: reference.x,
    y: reference.y,
    width: reference.width,
    height: reference.height,
    rotation: reference.rotation,
    fitMode: reference.fitMode,
  };
};

type ShapeIntentScaffoldRecord = StoryboardDocumentShapeScaffold;
const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

const stylizeShapeIntentGuideStroke = (
  stroke: PencilStroke,
  strokeIndex: number,
  mode: ShapeIntentApplyMode,
  role: 'primary' | 'secondary' = 'primary',
): PencilStroke => {
  const color = mode === 'rough'
    ? '#f59e0b'
    : mode === 'construction'
      ? (role === 'secondary' ? '#7dd3fc' : '#38bdf8')
      : stroke.color;
  const width = mode === 'rough'
    ? Math.max(1.6, stroke.width * 0.76)
    : mode === 'construction'
      ? Math.max(1.8, stroke.width * (role === 'secondary' ? 0.72 : 0.82))
      : Math.max(1.8, stroke.width);
  const opacity = mode === 'rough'
    ? clampUnit(Math.min(0.72, stroke.opacity * 0.72))
    : mode === 'construction'
      ? clampUnit(role === 'secondary' ? Math.min(0.34, stroke.opacity * 0.42) : Math.min(0.62, stroke.opacity * 0.66))
      : clampUnit(Math.max(0.74, stroke.opacity));
  const points = mode !== 'rough'
    ? stroke.points
    : stroke.points.map((point, pointIndex) => {
        const angleSeed = (strokeIndex + 1) * (pointIndex + 1);
        const jitter = Math.max(0.45, stroke.width * 0.18);
        return {
          ...point,
          x: point.x + (Math.sin(angleSeed * 0.63) * jitter),
          y: point.y + (Math.cos(angleSeed * 0.51) * jitter),
          pressure: clampUnit(point.pressure * 0.88),
        };
      });

  return {
    ...stroke,
    color,
    width,
    opacity,
    points,
    brush: stroke.brush
      ? {
          ...stroke.brush,
          color,
          size: width,
          opacity,
          flow: mode === 'rough' ? 0.56 : stroke.brush.flow,
          grain: mode === 'rough' ? 0.18 : stroke.brush.grain,
        }
      : stroke.brush,
  };
};

const buildShapeIntentModeGuideStrokes = (
  analysis: ShapeIntentAnalysis,
  generatedStrokes: PencilStroke[],
  mode: ShapeIntentApplyMode,
): PencilStroke[] => {
  if (mode === 'construction') {
    return [
      ...analysis.normalizedGuideStrokes.map((stroke, index) => stylizeShapeIntentGuideStroke(stroke, index, mode, 'secondary')),
      ...generatedStrokes.map((stroke, index) => stylizeShapeIntentGuideStroke(stroke, index, mode, 'primary')),
    ];
  }
  return generatedStrokes.map((stroke, index) => stylizeShapeIntentGuideStroke(stroke, index, mode, 'primary'));
};

const createShapeIntentScaffoldFrameFromBounds = (
  analysis: ShapeIntentAnalysis,
  canvasWidth: number,
  canvasHeight: number,
): StoryboardDocumentShapeScaffoldFrame => {
  const safeWidth = Math.max(1, canvasWidth);
  const safeHeight = Math.max(1, canvasHeight);
  const widthRatio = Math.max(0.02, Math.min(1, analysis.bounds.width / safeWidth));
  const heightRatio = Math.max(0.02, Math.min(1, analysis.bounds.height / safeHeight));
  return {
    xRatio: Math.max(0, Math.min(1 - widthRatio, analysis.bounds.minX / safeWidth)),
    yRatio: Math.max(0, Math.min(1 - heightRatio, analysis.bounds.minY / safeHeight)),
    widthRatio,
    heightRatio,
    baseWidthRatio: widthRatio,
    baseHeightRatio: heightRatio,
  };
};

const createShapeIntentScaffoldDefinition = (
  scaffold: Pick<StoryboardDocumentShapeScaffold, 'primitive' | 'suggestionId' | 'selections' | 'frame'>,
): ShapeIntentScaffoldDefinition => ({
  primitive: scaffold.primitive,
  suggestionId: scaffold.suggestionId,
  selections: scaffold.selections,
  frame: scaffold.frame,
});

const createEditorDocumentId = (prefix: string): string => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const getShapeScaffoldDisplayNameForSuggestion = (
  currentName: string,
  previousTitle: string | undefined,
  nextTitle: string,
) => {
  if (!previousTitle) {
    return currentName;
  }
  if (currentName === previousTitle) {
    return nextTitle;
  }
  if (currentName.startsWith(`${previousTitle} Scaffold`)) {
    return `${nextTitle}${currentName.slice(previousTitle.length)}`;
  }
  return currentName;
};

const getShapeScaffoldLibraryEntryName = (
  scaffoldName: string,
  suggestionTitle: string,
) => (
  scaffoldName.startsWith(`${suggestionTitle} Scaffold`)
    ? suggestionTitle
    : scaffoldName
);

const createShapeScaffoldInstanceName = (
  libraryEntry: Pick<StoryboardDocumentShapeScaffoldLibraryEntry, 'name'>,
  nextIndex: number,
) => `${libraryEntry.name} Scaffold ${nextIndex}`;

const compareShapeScaffoldLibraryEntries = (
  left: Pick<StoryboardDocumentShapeScaffoldLibraryEntry, 'pinned' | 'defaultForPrimitive' | 'usageCount' | 'updatedAt'>,
  right: Pick<StoryboardDocumentShapeScaffoldLibraryEntry, 'pinned' | 'defaultForPrimitive' | 'usageCount' | 'updatedAt'>,
) => (
  Number(right.pinned) - Number(left.pinned)
  || Number(right.defaultForPrimitive) - Number(left.defaultForPrimitive)
  || right.usageCount - left.usageCount
  || right.updatedAt.localeCompare(left.updatedAt)
);

const createShapeScaffoldAssemblyName = (nextIndex: number) => `Assembly ${nextIndex}`;

const createShapeScaffoldSuggestionInstanceName = (
  suggestionTitle: string,
  nextIndex: number,
) => `${suggestionTitle} Scaffold ${nextIndex}`;

const createDerivedShapeScaffoldFrame = (
  frame: StoryboardDocumentShapeScaffoldFrame,
  options: {
    centerOffsetX?: number;
    centerOffsetY?: number;
    widthScale?: number;
    heightScale?: number;
  } = {},
): StoryboardDocumentShapeScaffoldFrame => {
  const widthRatio = Math.max(0.02, Math.min(0.96, frame.widthRatio * (options.widthScale ?? 1)));
  const heightRatio = Math.max(0.02, Math.min(0.96, frame.heightRatio * (options.heightScale ?? 1)));
  const centerX = frame.xRatio + (frame.widthRatio / 2) + (options.centerOffsetX ?? 0);
  const centerY = frame.yRatio + (frame.heightRatio / 2) + (options.centerOffsetY ?? 0);
  const xRatio = Math.max(0, Math.min(1 - widthRatio, centerX - (widthRatio / 2)));
  const yRatio = Math.max(0, Math.min(1 - heightRatio, centerY - (heightRatio / 2)));
  return {
    xRatio,
    yRatio,
    widthRatio,
    heightRatio,
    baseWidthRatio: Math.max(0.02, Math.min(0.96, frame.baseWidthRatio * (options.widthScale ?? 1))),
    baseHeightRatio: Math.max(0.02, Math.min(0.96, frame.baseHeightRatio * (options.heightScale ?? 1))),
  };
};

const createSceneShapeScaffoldFrame = (
  xRatio: number,
  yRatio: number,
  widthRatio: number,
  heightRatio: number,
): StoryboardDocumentShapeScaffoldFrame => ({
  xRatio,
  yRatio,
  widthRatio,
  heightRatio,
  baseWidthRatio: widthRatio,
  baseHeightRatio: heightRatio,
});

type ShapeScaffoldAssemblyTemplateId =
  | 'pizza-plate'
  | 'table-chairs'
  | 'wheel-chassis'
  | 'head-shoulders';

type CinematicSceneKitId =
  | 'warehouse-standoff'
  | 'clerestory-standoff'
  | 'forest-titan-reveal'
  | 'titan-overwatch'
  | 'warehouse-push-in'
  | 'rooftop-vigil'
  | 'alley-pursuit'
  | 'interrogation-threshold'
  | 'last-train-pursuit';

interface ShapeScaffoldAssemblyTemplateSeed {
  suggestionId: string;
  primitive: StoryboardDocumentShapeScaffoldPrimitive;
  name: string;
  selections: ShapeIntentSelections;
  applyMode: StoryboardDocumentShapeScaffoldApplyMode;
  frame: StoryboardDocumentShapeScaffoldFrame;
  visible: boolean;
  opacity: number;
}

interface ShapeScaffoldAssemblyTemplateDefinition {
  id: ShapeScaffoldAssemblyTemplateId;
  title: string;
  description: string;
  compatibleSuggestionIds: string[];
  build: (
    scaffold: StoryboardDocumentShapeScaffold,
  ) => {
    assemblyName: string;
    seeds: ShapeScaffoldAssemblyTemplateSeed[];
  };
}

interface CinematicSceneKitDefinition {
  id: CinematicSceneKitId;
  title: string;
  description: string;
  tags: string[];
  heroRead: string;
  boardPolish: Partial<BoardPolishDraftState> & Pick<BoardPolishDraftState, 'mode' | 'tone' | 'lineBoost' | 'vignette'>;
  brushPackId: (typeof STUDIO_BRUSH_PACKS)[number]['id'];
  deckTab: (typeof STUDIO_DECK_TABS)[number];
  guideMode: (typeof STUDIO_GUIDE_MODES)[number];
  seeds: ShapeScaffoldAssemblyTemplateSeed[];
}

const shapeScaffoldAssemblyTemplates: ShapeScaffoldAssemblyTemplateDefinition[] = [
  {
    id: 'pizza-plate',
    title: 'Pizza + Plate',
    description: 'Build a plated food block with the pizza nested into a larger rim read.',
    compatibleSuggestionIds: ['pizza', 'plate'],
    build: (scaffold) => ({
      assemblyName: 'Pizza + Plate',
      seeds: scaffold.suggestionId === 'pizza'
        ? [{
            suggestionId: 'plate',
            primitive: 'ellipse',
            name: 'Plate',
            selections: { rim: ['wide'], content: ['empty'], angle: ['dining'] },
            applyMode: scaffold.applyMode,
            frame: createDerivedShapeScaffoldFrame(scaffold.frame, { widthScale: 1.18, heightScale: 1.18 }),
            visible: true,
            opacity: 0.58,
          }]
        : [{
            suggestionId: 'pizza',
            primitive: 'ellipse',
            name: 'Pizza',
            selections: { crust: ['classic'], toppings: ['pepperoni', 'cheese'], cuts: ['six'] },
            applyMode: scaffold.applyMode,
            frame: createDerivedShapeScaffoldFrame(scaffold.frame, { widthScale: 0.84, heightScale: 0.84 }),
            visible: true,
            opacity: 0.82,
          }],
    }),
  },
  {
    id: 'table-chairs',
    title: 'Table + Chairs',
    description: 'Turn a tabletop or seat into a fast meeting-space blocking set.',
    compatibleSuggestionIds: ['round-table', 'chair'],
    build: (scaffold) => ({
      assemblyName: 'Table + Chairs',
      seeds: scaffold.suggestionId === 'round-table'
        ? [
            {
              suggestionId: 'chair',
              primitive: 'rectangle',
              name: 'Chair',
              selections: { 'chair-style': ['dining'], back: ['open'], legs: ['straight'] },
              applyMode: 'construction',
              frame: createDerivedShapeScaffoldFrame(scaffold.frame, { centerOffsetX: -0.26, centerOffsetY: 0.02, widthScale: 0.36, heightScale: 0.42 }),
              visible: true,
              opacity: 0.72,
            },
            {
              suggestionId: 'chair',
              primitive: 'rectangle',
              name: 'Chair',
              selections: { 'chair-style': ['dining'], back: ['open'], legs: ['straight'] },
              applyMode: 'construction',
              frame: createDerivedShapeScaffoldFrame(scaffold.frame, { centerOffsetX: 0.26, centerOffsetY: 0.02, widthScale: 0.36, heightScale: 0.42 }),
              visible: true,
              opacity: 0.72,
            },
            {
              suggestionId: 'chair',
              primitive: 'rectangle',
              name: 'Chair',
              selections: { 'chair-style': ['dining'], back: ['open'], legs: ['straight'] },
              applyMode: 'construction',
              frame: createDerivedShapeScaffoldFrame(scaffold.frame, { centerOffsetX: 0, centerOffsetY: 0.28, widthScale: 0.38, heightScale: 0.44 }),
              visible: true,
              opacity: 0.72,
            },
          ]
        : [
            {
              suggestionId: 'round-table',
              primitive: 'ellipse',
              name: 'Round Table',
              selections: { tabletop: ['standard'], base: ['pedestal'], staging: ['three-quarter'] },
              applyMode: scaffold.applyMode,
              frame: createDerivedShapeScaffoldFrame(scaffold.frame, { centerOffsetX: 0, centerOffsetY: -0.18, widthScale: 1.7, heightScale: 1.1 }),
              visible: true,
              opacity: 0.78,
            },
            {
              suggestionId: 'chair',
              primitive: 'rectangle',
              name: 'Chair',
              selections: { 'chair-style': ['dining'], back: ['open'], legs: ['straight'] },
              applyMode: 'construction',
              frame: createDerivedShapeScaffoldFrame(scaffold.frame, { centerOffsetX: 0.28, centerOffsetY: 0.16, widthScale: 1, heightScale: 1 }),
              visible: true,
              opacity: 0.72,
            },
            {
              suggestionId: 'chair',
              primitive: 'rectangle',
              name: 'Chair',
              selections: { 'chair-style': ['dining'], back: ['open'], legs: ['straight'] },
              applyMode: 'construction',
              frame: createDerivedShapeScaffoldFrame(scaffold.frame, { centerOffsetX: -0.28, centerOffsetY: 0.16, widthScale: 1, heightScale: 1 }),
              visible: true,
              opacity: 0.72,
            },
          ],
    }),
  },
  {
    id: 'wheel-chassis',
    title: 'Wheel + Chassis',
    description: 'Pair a wheel study with a simple vehicle body block for fast vehicle staging.',
    compatibleSuggestionIds: ['motorcycle-wheel', 'chassis-block'],
    build: (scaffold) => ({
      assemblyName: 'Wheel + Chassis',
      seeds: scaffold.suggestionId === 'motorcycle-wheel'
        ? [{
            suggestionId: 'chassis-block',
            primitive: 'rectangle',
            name: 'Chassis Block',
            selections: { 'vehicle-body': ['motorcycle'], seat: ['single'], tail: ['kick-up'] },
            applyMode: 'construction',
            frame: createDerivedShapeScaffoldFrame(scaffold.frame, { centerOffsetX: 0.3, centerOffsetY: -0.08, widthScale: 1.9, heightScale: 0.58 }),
            visible: true,
            opacity: 0.72,
          }]
        : [{
            suggestionId: 'motorcycle-wheel',
            primitive: 'ellipse',
            name: 'Motorcycle Wheel',
            selections: { vehicle: ['motorcycle'], spokes: ['8'], tire: ['road'] },
            applyMode: scaffold.applyMode,
            frame: createDerivedShapeScaffoldFrame(scaffold.frame, { centerOffsetX: -0.34, centerOffsetY: 0.2, widthScale: 0.42, heightScale: 0.78 }),
            visible: true,
            opacity: 0.84,
          }],
    }),
  },
  {
    id: 'head-shoulders',
    title: 'Head + Shoulders',
    description: 'Build a simple character block with a readable head mass and shoulder silhouette.',
    compatibleSuggestionIds: ['head-mass', 'shoulders'],
    build: (scaffold) => ({
      assemblyName: 'Head + Shoulders',
      seeds: scaffold.suggestionId === 'head-mass'
        ? [{
            suggestionId: 'shoulders',
            primitive: 'blob',
            name: 'Shoulders',
            selections: { width: ['standard'], angle: ['level'], neck: ['visible'] },
            applyMode: 'construction',
            frame: createDerivedShapeScaffoldFrame(scaffold.frame, { centerOffsetX: 0, centerOffsetY: 0.26, widthScale: 1.7, heightScale: 0.72 }),
            visible: true,
            opacity: 0.68,
          }]
        : [{
            suggestionId: 'head-mass',
            primitive: 'ellipse',
            name: 'Head Mass',
            selections: { 'head-shape': ['neutral'], tilt: ['front'], eyeline: ['level'] },
            applyMode: scaffold.applyMode,
            frame: createDerivedShapeScaffoldFrame(scaffold.frame, { centerOffsetX: 0, centerOffsetY: -0.24, widthScale: 0.56, heightScale: 0.8 }),
            visible: true,
            opacity: 0.86,
          }],
    }),
  },
];

const cinematicSceneKits: CinematicSceneKitDefinition[] = [
  {
    id: 'warehouse-standoff',
    title: 'Warehouse Standoff',
    description: 'Stages a blown industrial window, god rays, haze, wet floor, crates, and a three-figure standoff silhouette.',
    tags: ['Industrial', 'God Rays', 'Wet Floor'],
    heroRead: 'Three figures hold against a blown top-light with foreground weight and reflective floor value.',
    boardPolish: createBoardPolishDraftState({
      mode: 'present',
      tone: 'noir',
      finish: 'hatch',
      weather: 'mist',
      atmosphere: 0.62,
      lineBoost: 0.74,
      vignette: 0.78,
    }),
    brushPackId: 'noir',
    deckTab: 'SHADOW',
    guideMode: 'Perspective',
    seeds: [
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['watch'], coat: ['long'], hat: ['fedora'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.19, 0.24, 0.22, 0.62),
        visible: true,
        opacity: 0.9,
      },
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['standoff'], coat: ['short'], hat: ['none'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.53, 0.43, 0.08, 0.25),
        visible: true,
        opacity: 0.72,
      },
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['standoff'], coat: ['short'], hat: ['none'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.64, 0.43, 0.08, 0.25),
        visible: true,
        opacity: 0.72,
      },
      {
        suggestionId: 'warehouse-window-bank',
        primitive: 'rectangle',
        name: 'Warehouse Window Bank',
        selections: { panes: ['factory'], glow: ['blown'], damage: ['broken'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.29, 0.05, 0.45, 0.16),
        visible: true,
        opacity: 0.82,
      },
      {
        suggestionId: 'light-beam',
        primitive: 'line',
        name: 'Light Beam',
        selections: { spread: ['wide'], intensity: ['blown'], angle: ['cross'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.43, 0.08, 0.26, 0.5),
        visible: true,
        opacity: 0.52,
      },
      {
        suggestionId: 'fog-bank',
        primitive: 'blob',
        name: 'Fog Bank',
        selections: { spread: ['wide'], density: ['mid'], edge: ['soft'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.37, 0.45, 0.38, 0.14),
        visible: true,
        opacity: 0.5,
      },
      {
        suggestionId: 'crate-stack',
        primitive: 'rectangle',
        name: 'Crate Stack',
        selections: { stack: ['double'], damage: ['wet'], perspective: ['hero'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.02, 0.59, 0.18, 0.19),
        visible: true,
        opacity: 0.72,
      },
      {
        suggestionId: 'crate-stack',
        primitive: 'rectangle',
        name: 'Crate Stack',
        selections: { stack: ['pile'], damage: ['wet'], perspective: ['three-quarter'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.79, 0.56, 0.17, 0.21),
        visible: true,
        opacity: 0.72,
      },
      {
        suggestionId: 'puddle-reflection',
        primitive: 'blob',
        name: 'Puddle Reflection',
        selections: { size: ['pool'], reflection: ['mirror'], debris: ['scatter'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.23, 0.74, 0.54, 0.14),
        visible: true,
        opacity: 0.66,
      },
    ],
  },
  {
    id: 'clerestory-standoff',
    title: 'Clerestory Standoff',
    description: 'Stages a broad blown warehouse nave with high clerestory windows, hard descending god rays, floor haze, side crates, and a reflective debris-streaked floor.',
    tags: ['Clerestory', 'God Rays', 'Reflective Floor', 'Standoff'],
    heroRead: 'A foreground detective silhouette anchors the frame while two distant figures lock under descending clerestory beams and wet-floor reflections.',
    boardPolish: createBoardPolishDraftState({
      mode: 'present',
      tone: 'noir',
      finish: 'hatch',
      weather: 'mist',
      atmosphere: 0.68,
      lineBoost: 0.86,
      vignette: 0.9,
    }),
    brushPackId: 'noir',
    deckTab: 'SHADOW',
    guideMode: 'Perspective',
    seeds: [
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['watch'], coat: ['long'], hat: ['fedora'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.19, 0.22, 0.24, 0.66),
        visible: true,
        opacity: 0.94,
      },
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['standoff'], coat: ['short'], hat: ['none'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.52, 0.44, 0.08, 0.24),
        visible: true,
        opacity: 0.74,
      },
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['standoff'], coat: ['short'], hat: ['none'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.63, 0.44, 0.08, 0.24),
        visible: true,
        opacity: 0.74,
      },
      {
        suggestionId: 'warehouse-window-bank',
        primitive: 'rectangle',
        name: 'Warehouse Window Bank',
        selections: { panes: ['factory'], glow: ['blown'], damage: ['broken'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.05, 0.05, 0.2, 0.12),
        visible: true,
        opacity: 0.8,
      },
      {
        suggestionId: 'warehouse-window-bank',
        primitive: 'rectangle',
        name: 'Warehouse Window Bank',
        selections: { panes: ['dense'], glow: ['blown'], damage: ['barred'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.38, 0.04, 0.28, 0.12),
        visible: true,
        opacity: 0.84,
      },
      {
        suggestionId: 'warehouse-window-bank',
        primitive: 'rectangle',
        name: 'Warehouse Window Bank',
        selections: { panes: ['factory'], glow: ['blown'], damage: ['broken'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.72, 0.05, 0.2, 0.12),
        visible: true,
        opacity: 0.8,
      },
      {
        suggestionId: 'light-beam',
        primitive: 'line',
        name: 'Light Beam',
        selections: { spread: ['wide'], intensity: ['blown'], angle: ['vertical'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.44, 0.09, 0.16, 0.5),
        visible: true,
        opacity: 0.58,
      },
      {
        suggestionId: 'light-beam',
        primitive: 'line',
        name: 'Light Beam',
        selections: { spread: ['medium'], intensity: ['hot'], angle: ['diagonal'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.68, 0.08, 0.2, 0.46),
        visible: true,
        opacity: 0.46,
      },
      {
        suggestionId: 'fog-bank',
        primitive: 'blob',
        name: 'Fog Bank',
        selections: { spread: ['wall'], density: ['mid'], edge: ['rolling'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.34, 0.45, 0.42, 0.14),
        visible: true,
        opacity: 0.52,
      },
      {
        suggestionId: 'crate-stack',
        primitive: 'rectangle',
        name: 'Crate Stack',
        selections: { stack: ['pile'], damage: ['wet'], perspective: ['hero'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.0, 0.58, 0.18, 0.22),
        visible: true,
        opacity: 0.74,
      },
      {
        suggestionId: 'crate-stack',
        primitive: 'rectangle',
        name: 'Crate Stack',
        selections: { stack: ['double'], damage: ['wet'], perspective: ['front'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.84, 0.54, 0.14, 0.2),
        visible: true,
        opacity: 0.7,
      },
      {
        suggestionId: 'crate-stack',
        primitive: 'rectangle',
        name: 'Crate Stack',
        selections: { stack: ['single'], damage: ['broken'], perspective: ['hero'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.8, 0.72, 0.1, 0.12),
        visible: true,
        opacity: 0.62,
      },
      {
        suggestionId: 'rain-sheet',
        primitive: 'line',
        name: 'Rain Sheet',
        selections: { density: ['light'], angle: ['vertical'], depth: ['background'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.12, 0.03, 0.76, 0.68),
        visible: true,
        opacity: 0.28,
      },
      {
        suggestionId: 'puddle-reflection',
        primitive: 'blob',
        name: 'Puddle Reflection',
        selections: { size: ['pool'], reflection: ['mirror'], debris: ['heavy'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.16, 0.76, 0.58, 0.16),
        visible: true,
        opacity: 0.74,
      },
    ],
  },
  {
    id: 'forest-titan-reveal',
    title: 'Forest Titan Reveal',
    description: 'Stages a giant forest colossus rising in a blasted valley with tiny troops, armor, and enclosing conifer walls.',
    tags: ['Titan', 'Forest', 'Armor', 'Scale'],
    heroRead: 'A roaring titan dominates the valley while armor and troops stay deliberately tiny to sell overwhelming scale.',
    boardPolish: createBoardPolishDraftState({
      mode: 'present',
      tone: 'noir',
      finish: 'hatch',
      weather: 'mist',
      atmosphere: 0.58,
      lineBoost: 0.88,
      vignette: 0.82,
    }),
    brushPackId: 'noir',
    deckTab: 'READ',
    guideMode: 'Perspective',
    seeds: [
      {
        suggestionId: 'titan-colossus',
        primitive: 'blob',
        name: 'Titan Colossus',
        selections: { pose: ['reach'], roar: ['bellow'], surface: ['rockhide'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.42, 0.12, 0.32, 0.5),
        visible: true,
        opacity: 0.92,
      },
      {
        suggestionId: 'conifer-wall',
        primitive: 'rectangle',
        name: 'Conifer Wall',
        selections: { density: ['crush'], slope: ['rise'], breaks: ['scarred'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.0, 0.02, 0.28, 0.92),
        visible: true,
        opacity: 0.68,
      },
      {
        suggestionId: 'conifer-wall',
        primitive: 'rectangle',
        name: 'Conifer Wall',
        selections: { density: ['crush'], slope: ['drop'], breaks: ['scarred'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.72, 0.02, 0.28, 0.92),
        visible: true,
        opacity: 0.68,
      },
      {
        suggestionId: 'armored-vehicle',
        primitive: 'rectangle',
        name: 'Armored Vehicle',
        selections: { body: ['tank'], turret: ['forward'], view: ['three-quarter'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.16, 0.66, 0.13, 0.12),
        visible: true,
        opacity: 0.76,
      },
      {
        suggestionId: 'armored-vehicle',
        primitive: 'rectangle',
        name: 'Armored Vehicle',
        selections: { body: ['carrier'], turret: ['none'], view: ['three-quarter'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.69, 0.66, 0.14, 0.13),
        visible: true,
        opacity: 0.76,
      },
      {
        suggestionId: 'runner-figure',
        primitive: 'blob',
        name: 'Runner Figure',
        selections: { action: ['lunge'], facing: ['away'], blur: ['clean'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.39, 0.63, 0.05, 0.16),
        visible: true,
        opacity: 0.58,
      },
      {
        suggestionId: 'runner-figure',
        primitive: 'blob',
        name: 'Runner Figure',
        selections: { action: ['lunge'], facing: ['away'], blur: ['clean'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.47, 0.68, 0.05, 0.16),
        visible: true,
        opacity: 0.58,
      },
      {
        suggestionId: 'runner-figure',
        primitive: 'blob',
        name: 'Runner Figure',
        selections: { action: ['lunge'], facing: ['away'], blur: ['clean'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.55, 0.64, 0.05, 0.16),
        visible: true,
        opacity: 0.58,
      },
      {
        suggestionId: 'fog-bank',
        primitive: 'blob',
        name: 'Fog Bank',
        selections: { spread: ['wall'], density: ['mid'], edge: ['rolling'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.28, 0.46, 0.44, 0.18),
        visible: true,
        opacity: 0.44,
      },
    ],
  },
  {
    id: 'titan-overwatch',
    title: 'Titan Overwatch',
    description: 'Builds a multi-plane creature board with foreground watchers, valley armor, helicopter support, and the titan looming in the distance.',
    tags: ['Overwatch', 'Witness', 'Helicopter', 'Titan'],
    heroRead: 'Foreground witnesses frame the shot while a distant titan and tiny armor beats clarify the scale stack at a glance.',
    boardPolish: createBoardPolishDraftState({
      mode: 'present',
      tone: 'noir',
      finish: 'clean',
      weather: 'mist',
      atmosphere: 0.48,
      lineBoost: 0.86,
      vignette: 0.8,
    }),
    brushPackId: 'noir',
    deckTab: 'FRAME',
    guideMode: 'Perspective',
    seeds: [
      {
        suggestionId: 'observer-pair',
        primitive: 'blob',
        name: 'Observer Pair',
        selections: { pose: ['crouch'], facing: ['right'], spacing: ['staggered'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.06, 0.62, 0.28, 0.3),
        visible: true,
        opacity: 0.9,
      },
      {
        suggestionId: 'titan-colossus',
        primitive: 'blob',
        name: 'Titan Colossus',
        selections: { pose: ['tower'], roar: ['open'], surface: ['spined'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.46, 0.12, 0.28, 0.46),
        visible: true,
        opacity: 0.88,
      },
      {
        suggestionId: 'conifer-wall',
        primitive: 'rectangle',
        name: 'Conifer Wall',
        selections: { density: ['dense'], slope: ['rise'], breaks: ['scarred'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.02, 0.22, 0.22, 0.56),
        visible: true,
        opacity: 0.64,
      },
      {
        suggestionId: 'conifer-wall',
        primitive: 'rectangle',
        name: 'Conifer Wall',
        selections: { density: ['dense'], slope: ['drop'], breaks: ['clean'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.78, 0.18, 0.2, 0.6),
        visible: true,
        opacity: 0.64,
      },
      {
        suggestionId: 'armored-vehicle',
        primitive: 'rectangle',
        name: 'Armored Vehicle',
        selections: { body: ['tank'], turret: ['forward'], view: ['profile'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.26, 0.68, 0.12, 0.11),
        visible: true,
        opacity: 0.74,
      },
      {
        suggestionId: 'armored-vehicle',
        primitive: 'rectangle',
        name: 'Armored Vehicle',
        selections: { body: ['tank'], turret: ['elevated'], view: ['three-quarter'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.61, 0.68, 0.13, 0.11),
        visible: true,
        opacity: 0.74,
      },
      {
        suggestionId: 'helicopter-silhouette',
        primitive: 'line',
        name: 'Helicopter Silhouette',
        selections: { body: ['scout'], bank: ['rise'], blur: ['spin'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.12, 0.18, 0.14, 0.12),
        visible: true,
        opacity: 0.66,
      },
      {
        suggestionId: 'fog-bank',
        primitive: 'blob',
        name: 'Fog Bank',
        selections: { spread: ['wide'], density: ['light'], edge: ['soft'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.3, 0.46, 0.42, 0.14),
        visible: true,
        opacity: 0.34,
      },
    ],
  },
  {
    id: 'warehouse-push-in',
    title: 'Warehouse Push-In',
    description: 'Builds a tighter hero-facing push-in with stronger beam geometry, fog separation, and wet foreground reflections.',
    tags: ['Push-In', 'Backlight', 'Fog Wall'],
    heroRead: 'A tighter advancing silhouette pushes through beam geometry, fog separation, and a hot wet floor.',
    boardPolish: createBoardPolishDraftState({
      mode: 'present',
      tone: 'noir',
      finish: 'marker',
      weather: 'mist',
      atmosphere: 0.6,
      lineBoost: 0.78,
      vignette: 0.82,
    }),
    brushPackId: 'noir',
    deckTab: 'LIGHT',
    guideMode: 'Perspective',
    seeds: [
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['advance'], coat: ['long'], hat: ['fedora'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.3, 0.22, 0.18, 0.56),
        visible: true,
        opacity: 0.92,
      },
      {
        suggestionId: 'warehouse-window-bank',
        primitive: 'rectangle',
        name: 'Warehouse Window Bank',
        selections: { panes: ['dense'], glow: ['blown'], damage: ['barred'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.46, 0.04, 0.34, 0.14),
        visible: true,
        opacity: 0.8,
      },
      {
        suggestionId: 'light-beam',
        primitive: 'line',
        name: 'Light Beam',
        selections: { spread: ['wide'], intensity: ['blown'], angle: ['diagonal'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.49, 0.08, 0.22, 0.52),
        visible: true,
        opacity: 0.58,
      },
      {
        suggestionId: 'fog-bank',
        primitive: 'blob',
        name: 'Fog Bank',
        selections: { spread: ['wall'], density: ['heavy'], edge: ['rolling'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.35, 0.49, 0.4, 0.16),
        visible: true,
        opacity: 0.56,
      },
      {
        suggestionId: 'puddle-reflection',
        primitive: 'blob',
        name: 'Puddle Reflection',
        selections: { size: ['pool'], reflection: ['mirror'], debris: ['heavy'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.16, 0.77, 0.62, 0.13),
        visible: true,
        opacity: 0.7,
      },
      {
        suggestionId: 'crate-stack',
        primitive: 'rectangle',
        name: 'Crate Stack',
        selections: { stack: ['pile'], damage: ['broken'], perspective: ['hero'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.78, 0.58, 0.18, 0.2),
        visible: true,
        opacity: 0.72,
      },
    ],
  },
  {
    id: 'rooftop-vigil',
    title: 'Rooftop Vigil',
    description: 'Builds a lone rooftop silhouette against a storm skyline with lightning, rain, city mist, and a wet parapet edge.',
    tags: ['Rooftop', 'Skyline', 'Lightning', 'Rain'],
    heroRead: 'A solitary detective silhouette reads against a blown skyline while lightning and rain carry the focal beat.',
    boardPolish: createBoardPolishDraftState({
      mode: 'present',
      tone: 'noir',
      finish: 'clean',
      weather: 'rain',
      atmosphere: 0.72,
      lineBoost: 0.82,
      vignette: 0.86,
    }),
    brushPackId: 'noir',
    deckTab: 'LIGHT',
    guideMode: 'Perspective',
    seeds: [
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['watch'], coat: ['long'], hat: ['fedora'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.16, 0.22, 0.24, 0.66),
        visible: true,
        opacity: 0.94,
      },
      {
        suggestionId: 'rooftop-parapet',
        primitive: 'rectangle',
        name: 'Rooftop Parapet',
        selections: { edge: ['heavy'], angle: ['hero'], surface: ['mirror'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.02, 0.71, 0.52, 0.22),
        visible: true,
        opacity: 0.78,
      },
      {
        suggestionId: 'skyline-cluster',
        primitive: 'rectangle',
        name: 'Skyline Cluster',
        selections: { density: ['dense'], glow: ['blown'], silhouette: ['spires'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.42, 0.18, 0.48, 0.48),
        visible: true,
        opacity: 0.78,
      },
      {
        suggestionId: 'water-tower',
        primitive: 'rectangle',
        name: 'Water Tower',
        selections: { tank: ['riveted'], legs: ['braced'], catwalk: ['ring'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.01, 0.1, 0.12, 0.28),
        visible: true,
        opacity: 0.72,
      },
      {
        suggestionId: 'lightning-fork',
        primitive: 'line',
        name: 'Lightning Fork',
        selections: { spread: ['forked'], intensity: ['blown'], direction: ['down'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.49, 0.04, 0.18, 0.28),
        visible: true,
        opacity: 0.84,
      },
      {
        suggestionId: 'rain-sheet',
        primitive: 'line',
        name: 'Rain Sheet',
        selections: { density: ['storm'], angle: ['slant'], depth: ['foreground'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.04, 0.06, 0.9, 0.84),
        visible: true,
        opacity: 0.44,
      },
      {
        suggestionId: 'city-mist',
        primitive: 'blob',
        name: 'City Mist',
        selections: { spread: ['wall'], lift: ['mid'], glow: ['blown'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.42, 0.52, 0.5, 0.16),
        visible: true,
        opacity: 0.5,
      },
      {
        suggestionId: 'puddle-reflection',
        primitive: 'blob',
        name: 'Puddle Reflection',
        selections: { size: ['wide'], reflection: ['mirror'], debris: ['none'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.06, 0.82, 0.34, 0.08),
        visible: true,
        opacity: 0.58,
      },
    ],
  },
  {
    id: 'alley-pursuit',
    title: 'Rain Alley Pursuit',
    description: 'Builds a compressed rain alley with looming facades, fire escapes, dumpsters, headlight glare, steam, and a lone detective silhouette.',
    tags: ['Alley', 'Rain', 'Headlights', 'Steam'],
    heroRead: 'A backlit detective silhouette cuts through rain, wet pavement, steam, and headlight glare in a compressed alley frame.',
    boardPolish: createBoardPolishDraftState({
      mode: 'present',
      tone: 'noir',
      finish: 'clean',
      weather: 'rain',
      atmosphere: 0.76,
      lineBoost: 0.84,
      vignette: 0.9,
    }),
    brushPackId: 'noir',
    deckTab: 'LIGHT',
    guideMode: 'Perspective',
    seeds: [
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['advance'], coat: ['long'], hat: ['fedora'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.39, 0.36, 0.18, 0.58),
        visible: true,
        opacity: 0.94,
      },
      {
        suggestionId: 'alley-wall',
        primitive: 'rectangle',
        name: 'Alley Wall',
        selections: { side: ['left'], windows: ['sparse'], depth: ['hero'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.0, 0.02, 0.26, 0.8),
        visible: true,
        opacity: 0.74,
      },
      {
        suggestionId: 'alley-wall',
        primitive: 'rectangle',
        name: 'Alley Wall',
        selections: { side: ['right'], windows: ['dark'], depth: ['deep'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.74, 0.03, 0.24, 0.78),
        visible: true,
        opacity: 0.72,
      },
      {
        suggestionId: 'fire-escape',
        primitive: 'rectangle',
        name: 'Fire Escape',
        selections: { flights: ['tall'], stairs: ['dense'], landing: ['cage'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.06, 0.04, 0.16, 0.44),
        visible: true,
        opacity: 0.72,
      },
      {
        suggestionId: 'dumpster-bank',
        primitive: 'rectangle',
        name: 'Dumpster Bank',
        selections: { count: ['double'], lid: ['mixed'], wear: ['wet'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.01, 0.67, 0.18, 0.13),
        visible: true,
        opacity: 0.72,
      },
      {
        suggestionId: 'dumpster-bank',
        primitive: 'rectangle',
        name: 'Dumpster Bank',
        selections: { count: ['row'], lid: ['shut'], wear: ['wet'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.8, 0.65, 0.17, 0.15),
        visible: true,
        opacity: 0.72,
      },
      {
        suggestionId: 'headlight-glare',
        primitive: 'ellipse',
        name: 'Headlight Glare',
        selections: { pair: ['pair'], bloom: ['blown'], spread: ['road'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.47, 0.72, 0.18, 0.1),
        visible: true,
        opacity: 0.84,
      },
      {
        suggestionId: 'city-mist',
        primitive: 'blob',
        name: 'City Mist',
        selections: { spread: ['tight'], lift: ['mid'], glow: ['hot'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.5, 0.39, 0.22, 0.24),
        visible: true,
        opacity: 0.5,
      },
      {
        suggestionId: 'rain-sheet',
        primitive: 'line',
        name: 'Rain Sheet',
        selections: { density: ['storm'], angle: ['slant'], depth: ['foreground'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.03, 0.02, 0.92, 0.92),
        visible: true,
        opacity: 0.44,
      },
      {
        suggestionId: 'puddle-reflection',
        primitive: 'blob',
        name: 'Puddle Reflection',
        selections: { size: ['pool'], reflection: ['mirror'], debris: ['heavy'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.18, 0.82, 0.54, 0.16),
        visible: true,
        opacity: 0.68,
      },
    ],
  },
  {
    id: 'interrogation-threshold',
    title: 'Interrogation Threshold',
    description: 'Builds a hard-lit interrogation room with seated suspect, pendant lamp, smoke, and a detective silhouette in the doorway.',
    tags: ['Interrogation', 'Doorway', 'Smoke', 'Top Light'],
    heroRead: 'A seated suspect holds under a hard pendant pool while the detective silhouette owns the doorway threshold and smoke carries the air.',
    boardPolish: createBoardPolishDraftState({
      mode: 'present',
      tone: 'noir',
      finish: 'marker',
      weather: 'mist',
      atmosphere: 0.5,
      lineBoost: 0.85,
      vignette: 0.92,
    }),
    brushPackId: 'noir',
    deckTab: 'LIGHT',
    guideMode: 'Perspective',
    seeds: [
      {
        suggestionId: 'seated-figure',
        primitive: 'blob',
        name: 'Seated Figure',
        selections: { pose: ['lean'], facing: ['left'], hands: ['smoke'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.06, 0.37, 0.28, 0.42),
        visible: true,
        opacity: 0.92,
      },
      {
        suggestionId: 'interrogation-table',
        primitive: 'rectangle',
        name: 'Interrogation Table',
        selections: { top: ['heavy'], view: ['hero'], props: ['ashtray'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.16, 0.57, 0.4, 0.18),
        visible: true,
        opacity: 0.82,
      },
      {
        suggestionId: 'pendant-lamp',
        primitive: 'ellipse',
        name: 'Pendant Lamp',
        selections: { shade: ['dome'], glow: ['blown'], cord: ['long'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.12, 0.03, 0.2, 0.18),
        visible: true,
        opacity: 0.84,
      },
      {
        suggestionId: 'smoke',
        primitive: 'blob',
        name: 'Smoke Plume',
        selections: { direction: ['up'], density: ['mid'], origin: ['ground'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.33, 0.22, 0.16, 0.3),
        visible: true,
        opacity: 0.5,
      },
      {
        suggestionId: 'doorway-frame',
        primitive: 'rectangle',
        name: 'Doorway Frame',
        selections: { opening: ['open'], light: ['fogged'], frame: ['thick'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.67, 0.13, 0.22, 0.5),
        visible: true,
        opacity: 0.76,
      },
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['watch'], coat: ['long'], hat: ['fedora'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.73, 0.2, 0.17, 0.56),
        visible: true,
        opacity: 0.9,
      },
      {
        suggestionId: 'chair',
        primitive: 'rectangle',
        name: 'Chair',
        selections: { 'chair-style': ['dining'], back: ['open'], legs: ['straight'] },
        applyMode: 'construction',
        frame: createSceneShapeScaffoldFrame(0.77, 0.68, 0.12, 0.16),
        visible: true,
        opacity: 0.66,
      },
    ],
  },
  {
    id: 'last-train-pursuit',
    title: 'Last Train Pursuit',
    description: 'Stages a rain-slick platform chase with receding practicals, carriage glare, a boarding fugitive, and a sprinting detective silhouette.',
    tags: ['Train', 'Platform', 'Rain', 'Sprint'],
    heroRead: 'A sprinting detective silhouette tears across a wet platform while a boarding fugitive catches a blown carriage doorway.',
    boardPolish: createBoardPolishDraftState({
      mode: 'present',
      tone: 'noir',
      finish: 'clean',
      weather: 'rain',
      atmosphere: 0.78,
      lineBoost: 0.88,
      vignette: 0.94,
    }),
    brushPackId: 'noir',
    deckTab: 'LIGHT',
    guideMode: 'Perspective',
    seeds: [
      {
        suggestionId: 'trench-figure',
        primitive: 'blob',
        name: 'Noir Figure',
        selections: { stance: ['sprint'], coat: ['long'], hat: ['fedora'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.28, 0.34, 0.24, 0.56),
        visible: true,
        opacity: 0.94,
      },
      {
        suggestionId: 'train-car-side',
        primitive: 'rectangle',
        name: 'Train Car Side',
        selections: { side: ['door-side'], windows: ['lit'], stripe: ['double'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.6, 0.08, 0.38, 0.7),
        visible: true,
        opacity: 0.8,
      },
      {
        suggestionId: 'carriage-door',
        primitive: 'rectangle',
        name: 'Carriage Door',
        selections: { opening: ['open'], light: ['blown'], handle: ['rail'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.83, 0.16, 0.13, 0.44),
        visible: true,
        opacity: 0.86,
      },
      {
        suggestionId: 'runner-figure',
        primitive: 'blob',
        name: 'Runner Figure',
        selections: { action: ['board'], facing: ['right'], blur: ['motion'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.85, 0.32, 0.12, 0.42),
        visible: true,
        opacity: 0.84,
      },
      {
        suggestionId: 'platform-light-run',
        primitive: 'line',
        name: 'Platform Light Run',
        selections: { spacing: ['hero'], bloom: ['blown'], perspective: ['vanish'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.09, 0.03, 0.34, 0.52),
        visible: true,
        opacity: 0.72,
      },
      {
        suggestionId: 'city-mist',
        primitive: 'blob',
        name: 'City Mist',
        selections: { spread: ['tight'], lift: ['mid'], glow: ['hot'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.38, 0.34, 0.28, 0.22),
        visible: true,
        opacity: 0.48,
      },
      {
        suggestionId: 'rain-sheet',
        primitive: 'line',
        name: 'Rain Sheet',
        selections: { density: ['storm'], angle: ['slant'], depth: ['foreground'] },
        applyMode: 'rough',
        frame: createSceneShapeScaffoldFrame(0.02, 0.02, 0.94, 0.92),
        visible: true,
        opacity: 0.46,
      },
      {
        suggestionId: 'puddle-reflection',
        primitive: 'blob',
        name: 'Puddle Reflection',
        selections: { size: ['pool'], reflection: ['mirror'], debris: ['heavy'] },
        applyMode: 'clean',
        frame: createSceneShapeScaffoldFrame(0.12, 0.82, 0.56, 0.16),
        visible: true,
        opacity: 0.7,
      },
    ],
  },
];

const buildShapeScaffoldLibraryTags = (
  primitive: StoryboardDocumentShapeScaffoldPrimitive,
  suggestion: Pick<ShapeIntentSuggestion, 'title' | 'category'>,
  name: string,
) => Array.from(new Set([
  primitive,
  suggestion.category.toLowerCase(),
  suggestion.title.toLowerCase(),
  name.toLowerCase(),
]));

const cloneShapeIntentSelections = (selections: ShapeIntentSelections): ShapeIntentSelections => (
  Object.entries(selections).reduce<ShapeIntentSelections>((result, [key, values]) => {
    result[key] = [...values];
    return result;
  }, {})
);

const areShapeIntentSelectionsEqual = (
  left: ShapeIntentSelections,
  right: ShapeIntentSelections,
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  return leftKeys.every((key) => {
    const leftValues = left[key] || [];
    const rightValues = right[key] || [];
    if (leftValues.length !== rightValues.length) {
      return false;
    }
    return leftValues.every((value, index) => value === rightValues[index]);
  });
};

const areStringArraysEqual = (
  left: string[],
  right: string[],
): boolean => (
  left.length === right.length
  && left.every((value, index) => value === right[index])
);

const stopShapeScaffoldOverlayInteraction = (event: ReactPointerEvent<HTMLElement>) => {
  event.stopPropagation();
};

type ShapeScaffoldInteractionMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-se' | 'resize-sw';

interface ShapeScaffoldInteractionState {
  scaffoldId: string;
  pointerId: number;
  mode: ShapeScaffoldInteractionMode;
  originClientX: number;
  originClientY: number;
  containerWidth: number;
  containerHeight: number;
  originFrame: StoryboardDocumentShapeScaffoldFrame;
}

const clampShapeScaffoldFrame = (
  frame: StoryboardDocumentShapeScaffoldFrame,
): StoryboardDocumentShapeScaffoldFrame => {
  const minWidth = 0.02;
  const minHeight = 0.02;
  const widthRatio = Math.max(minWidth, Math.min(0.96, frame.widthRatio));
  const heightRatio = Math.max(minHeight, Math.min(0.96, frame.heightRatio));
  return {
    ...frame,
    widthRatio,
    heightRatio,
    xRatio: Math.max(0, Math.min(1 - widthRatio, frame.xRatio)),
    yRatio: Math.max(0, Math.min(1 - heightRatio, frame.yRatio)),
  };
};

const getNextShapeScaffoldFrameFromInteraction = (
  originFrame: StoryboardDocumentShapeScaffoldFrame,
  mode: ShapeScaffoldInteractionMode,
  deltaXRatio: number,
  deltaYRatio: number,
): StoryboardDocumentShapeScaffoldFrame => {
  if (mode === 'move') {
    return clampShapeScaffoldFrame({
      ...originFrame,
      xRatio: originFrame.xRatio + deltaXRatio,
      yRatio: originFrame.yRatio + deltaYRatio,
    });
  }

  const minWidth = 0.02;
  const minHeight = 0.02;
  let left = originFrame.xRatio;
  let top = originFrame.yRatio;
  let right = originFrame.xRatio + originFrame.widthRatio;
  let bottom = originFrame.yRatio + originFrame.heightRatio;

  if (mode === 'resize-nw' || mode === 'resize-sw') {
    left = Math.max(0, Math.min(right - minWidth, left + deltaXRatio));
  }
  if (mode === 'resize-ne' || mode === 'resize-se') {
    right = Math.min(1, Math.max(left + minWidth, right + deltaXRatio));
  }
  if (mode === 'resize-nw' || mode === 'resize-ne') {
    top = Math.max(0, Math.min(bottom - minHeight, top + deltaYRatio));
  }
  if (mode === 'resize-sw' || mode === 'resize-se') {
    bottom = Math.min(1, Math.max(top + minHeight, bottom + deltaYRatio));
  }

  return clampShapeScaffoldFrame({
    ...originFrame,
    xRatio: left,
    yRatio: top,
    widthRatio: right - left,
    heightRatio: bottom - top,
  });
};

type BoardPolishEffectRegionInteractionMode = 'move' | 'resize-nw' | 'resize-ne' | 'resize-se' | 'resize-sw';

interface BoardPolishEffectRegionInteractionState {
  effectId: StoryboardDocumentBoardPolishEffectLayerId;
  pointerId: number;
  mode: BoardPolishEffectRegionInteractionMode;
  originClientX: number;
  originClientY: number;
  containerWidth: number;
  containerHeight: number;
  originRegion: StoryboardDocumentBoardPolishEffectRegion;
}

const clampBoardPolishEffectRegion = (
  region: StoryboardDocumentBoardPolishEffectRegion,
): StoryboardDocumentBoardPolishEffectRegion => {
  const minWidth = 0.08;
  const minHeight = 0.08;
  const widthRatio = Math.max(minWidth, Math.min(1, region.widthRatio));
  const heightRatio = Math.max(minHeight, Math.min(1, region.heightRatio));
  return {
    ...region,
    widthRatio,
    heightRatio,
    xRatio: Math.max(0, Math.min(1 - widthRatio, region.xRatio)),
    yRatio: Math.max(0, Math.min(1 - heightRatio, region.yRatio)),
    feather: Math.max(0, Math.min(0.48, region.feather)),
  };
};

const getNextBoardPolishEffectRegionFromInteraction = (
  originRegion: StoryboardDocumentBoardPolishEffectRegion,
  mode: BoardPolishEffectRegionInteractionMode,
  deltaXRatio: number,
  deltaYRatio: number,
): StoryboardDocumentBoardPolishEffectRegion => {
  if (mode === 'move') {
    return clampBoardPolishEffectRegion({
      ...originRegion,
      xRatio: originRegion.xRatio + deltaXRatio,
      yRatio: originRegion.yRatio + deltaYRatio,
    });
  }

  const minWidth = 0.08;
  const minHeight = 0.08;
  let left = originRegion.xRatio;
  let top = originRegion.yRatio;
  let right = originRegion.xRatio + originRegion.widthRatio;
  let bottom = originRegion.yRatio + originRegion.heightRatio;

  if (mode === 'resize-nw' || mode === 'resize-sw') {
    left = Math.max(0, Math.min(right - minWidth, left + deltaXRatio));
  }
  if (mode === 'resize-ne' || mode === 'resize-se') {
    right = Math.min(1, Math.max(left + minWidth, right + deltaXRatio));
  }
  if (mode === 'resize-nw' || mode === 'resize-ne') {
    top = Math.max(0, Math.min(bottom - minHeight, top + deltaYRatio));
  }
  if (mode === 'resize-sw' || mode === 'resize-se') {
    bottom = Math.min(1, Math.max(top + minHeight, bottom + deltaYRatio));
  }

  return clampBoardPolishEffectRegion({
    ...originRegion,
    xRatio: left,
    yRatio: top,
    widthRatio: right - left,
    heightRatio: bottom - top,
  });
};

// =============================================================================
// Main Component
// =============================================================================

export const FrameDrawingEditor: FC<FrameDrawingEditorProps> = ({
  frameId,
  storyboardId,
  aspectRatio = '16:9',
  initialImage,
  initialStrokes,
  initialDrawingData,
  workflowLevel = 'shot',
  onSave,
  onCancel,
  mode = 'dialog',
  sceneId,
  manuscriptId,
  proMode = true, // Default to pro mode with advanced brushes
  referenceImage: initialReferenceImage,
}) => {
  const device = useDeviceDetection();
  const containerRef = useRef<HTMLDivElement>(null);
  const standardCanvasRef = useRef<PencilCanvasHandle | null>(null);
  const proCanvasRef = useRef<PencilCanvasProHandle | null>(null);
  const referenceUploadInputRef = useRef<HTMLInputElement | null>(null);
  const baseImageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const timeLapseProgressRef = useRef(0);
  
  // Store actions
  const { updateFrame } = useStoryboardStore();
  const initialDocument = useMemo(() => {
    const brushSettings =
      initialDrawingData?.brushSettings
      && typeof initialDrawingData.brushSettings.type === 'string'
      && typeof initialDrawingData.brushSettings.size === 'number'
      && typeof initialDrawingData.brushSettings.color === 'string'
      && typeof initialDrawingData.brushSettings.opacity === 'number'
        ? initialDrawingData.brushSettings as StoryboardDocumentBrushSettings
        : undefined;

    return restoreStoryboardDrawingDocumentFromLegacy({
      document: initialDrawingData?.document,
      strokes: initialDrawingData?.strokes,
      baseImageUrl: initialDrawingData?.baseImageUrl || initialImage,
      originalBaseImageUrl: initialDrawingData?.originalBaseImageUrl || initialImage,
      dataUrl: initialDrawingData?.dataUrl || initialImage,
      brushSettings,
      referenceImage: toDocumentReferenceSeed(initialReferenceImage),
    }, {
      frameId,
      storyboardId,
      aspectRatio: aspectRatio as StoryboardDocumentAspectRatio,
      workflowLevel: workflowLevel as StoryboardDocumentWorkflowLevel,
      createdAt: initialDrawingData?.createdAt,
      updatedAt: initialDrawingData?.updatedAt,
    });
  }, [
    aspectRatio,
    frameId,
    initialDrawingData,
    initialImage,
    initialReferenceImage,
    storyboardId,
    workflowLevel,
  ]);
  const initialActiveSheetId = initialDocument.timeline.selectedSheetIds[0] || initialDocument.primarySheetId;
  const drawingDocumentRef = useRef<StoryboardDrawingDocument>(initialDocument);
  const pendingReferenceStudyReferenceIdRef = useRef<string>();
  const activeSheetIdRef = useRef(initialActiveSheetId);
  const initialLoadSignature = useMemo(() => [
    frameId || '',
    storyboardId || '',
    aspectRatio,
    workflowLevel,
    initialImage || '',
    initialDrawingData?.createdAt || '',
    initialDrawingData?.updatedAt || '',
    initialDrawingData?.dataUrl || '',
    initialDrawingData?.strokes || '',
    initialDrawingData?.baseImageUrl || '',
    initialDrawingData?.originalBaseImageUrl || '',
    initialDrawingData?.document?.id || '',
    initialDrawingData?.document?.updatedAt || '',
    initialDrawingData?.brushSettings?.type || '',
    typeof initialDrawingData?.brushSettings?.size === 'number' ? String(initialDrawingData.brushSettings.size) : '',
    initialDrawingData?.brushSettings?.color || '',
    typeof initialDrawingData?.brushSettings?.opacity === 'number' ? String(initialDrawingData.brushSettings.opacity) : '',
    initialReferenceImage?.src || '',
    typeof initialReferenceImage?.opacity === 'number' ? String(initialReferenceImage.opacity) : '',
    String(initialReferenceImage?.visible ?? ''),
    typeof initialReferenceImage?.x === 'number' ? String(initialReferenceImage.x) : '',
    typeof initialReferenceImage?.y === 'number' ? String(initialReferenceImage.y) : '',
    typeof initialReferenceImage?.width === 'number' ? String(initialReferenceImage.width) : '',
    typeof initialReferenceImage?.height === 'number' ? String(initialReferenceImage.height) : '',
  ].join('::'), [
    aspectRatio,
    frameId,
    initialDrawingData?.baseImageUrl,
    initialDrawingData?.brushSettings?.color,
    initialDrawingData?.brushSettings?.opacity,
    initialDrawingData?.brushSettings?.size,
    initialDrawingData?.brushSettings?.type,
    initialDrawingData?.createdAt,
    initialDrawingData?.dataUrl,
    initialDrawingData?.document?.id,
    initialDrawingData?.document?.updatedAt,
    initialDrawingData?.originalBaseImageUrl,
    initialDrawingData?.strokes,
    initialDrawingData?.updatedAt,
    initialImage,
    initialReferenceImage?.height,
    initialReferenceImage?.opacity,
    initialReferenceImage?.src,
    initialReferenceImage?.visible,
    initialReferenceImage?.width,
    initialReferenceImage?.x,
    initialReferenceImage?.y,
    storyboardId,
    workflowLevel,
  ]);
  const hydratedInitialLoadSignatureRef = useRef(initialLoadSignature);
  const initialReferenceStudyState = initialDocument.metadata.referenceStudy;
  const initialBoardPolishState = initialDocument.metadata.boardPolish;
  const initialSelectedReferenceId = initialReferenceStudyState?.referenceId
    || getPrimaryStoryboardDocumentReferenceImage(initialDocument)?.id;
  const initialSelectedShapeScaffoldId = initialDocument.metadata.shapeScaffolds?.[0]?.id;
  const initialSelectedShapeScaffoldAssemblyId = initialDocument.metadata.shapeScaffoldAssemblies?.[0]?.id;
  const resolvedInitialStrokes = useMemo(
    () => (
      initialDrawingData?.document
        ? (
          getStoryboardDocumentDrawingLayerStrokes(
            initialDocument,
            getStoryboardDocumentActiveLayerId(initialDocument, initialActiveSheetId) || initialDocument.sheets[0]?.layerIds[0] || ''
          )
        )
        : (initialStrokes || getStoryboardDocumentSheetStrokes(initialDocument, initialActiveSheetId))
    ),
    [initialActiveSheetId, initialDocument, initialDrawingData?.document, initialStrokes]
  );
  const initialBrushSettingsForEditor = useMemo(() => {
    const brush = initialDrawingData?.brushSettings || initialDocument.metadata.brushSettings;
    if (!brush) {
      return {
        type: 'pen' as BrushType,
        size: 3,
        color: '#ffffff',
        opacity: 1,
      };
    }

    return {
      type: (brush.type as BrushType) || 'pen',
      size: typeof brush.size === 'number' ? brush.size : 3,
      color: typeof brush.color === 'string' ? brush.color : '#ffffff',
      opacity: typeof brush.opacity === 'number' ? brush.opacity : 1,
    };
  }, [initialDocument.metadata.brushSettings, initialDrawingData?.brushSettings]);

  // State
  const [drawingDocument, setDrawingDocument] = useState<StoryboardDrawingDocument>(initialDocument);
  const [strokes, setStrokes] = useState<PencilStroke[]>(resolvedInitialStrokes);
  const lastResolvedStrokeSignatureRef = useRef(buildStrokeSignature(resolvedInitialStrokes));
  const pendingStrokeSyncSourceRef = useRef<'local' | 'document' | null>('document');
  const [brushSettings, setBrushSettings] = useState<BrushSettings>(initialBrushSettingsForEditor);
  const [brushType, setBrushType] = useState<BrushType>(initialBrushSettingsForEditor.type);
  const [proBrushType, setProBrushType] = useState<ProBrushType>(initialBrushSettingsForEditor.type as ProBrushType);
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(mode === 'fullscreen');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [lastSavedImage, setLastSavedImage] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportSize>(getInitialViewport);
  const [editorContainerSize, setEditorContainerSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [selectedDeckTab, setSelectedDeckTab] = useState<(typeof STUDIO_DECK_TABS)[number]>(
    workflowLevel === 'blocking' ? 'ROUGH' : workflowLevel === 'presentation' ? 'LIGHT' : 'SHADOW'
  );
  const [selectedBrushPackId, setSelectedBrushPackId] = useState<(typeof STUDIO_BRUSH_PACKS)[number]['id']>('noir');
  const [selectedLibraryPreset, setSelectedLibraryPreset] = useState('Hard Shadow');
  const [inspectorMode, setInspectorMode] = useState<'lighting' | 'layers' | 'shot'>('lighting');
  const [gridEnabled, setGridEnabled] = useState(workflowLevel === 'blocking' || workflowLevel === 'shot');
  const [boardPolishMode, setBoardPolishMode] = useState<StoryboardDocumentBoardPolishMode>(
    initialBoardPolishState?.mode ?? STUDIO_BOARD_POLISH_DEFAULTS.mode
  );
  const [boardPolishTone, setBoardPolishTone] = useState<StoryboardDocumentBoardPolishTone>(
    initialBoardPolishState?.tone ?? STUDIO_BOARD_POLISH_DEFAULTS.tone
  );
  const [boardPolishFinish, setBoardPolishFinish] = useState<StoryboardDocumentBoardPolishFinish>(
    initialBoardPolishState?.finish ?? STUDIO_BOARD_POLISH_DEFAULTS.finish
  );
  const [boardPolishWeather, setBoardPolishWeather] = useState<StoryboardDocumentBoardPolishWeather>(
    initialBoardPolishState?.weather ?? STUDIO_BOARD_POLISH_DEFAULTS.weather
  );
  const [boardPolishAtmosphere, setBoardPolishAtmosphere] = useState(
    initialBoardPolishState?.atmosphere ?? STUDIO_BOARD_POLISH_DEFAULTS.atmosphere
  );
  const [boardPolishLineBoost, setBoardPolishLineBoost] = useState(
    initialBoardPolishState?.lineBoost ?? STUDIO_BOARD_POLISH_DEFAULTS.lineBoost
  );
  const [boardPolishVignette, setBoardPolishVignette] = useState(
    initialBoardPolishState?.vignette ?? STUDIO_BOARD_POLISH_DEFAULTS.vignette
  );
  const [boardPolishEffectLayerStates, setBoardPolishEffectLayerStates] = useState(
    createBoardPolishEffectLayerStates(initialBoardPolishState?.effectLayers ?? STUDIO_BOARD_POLISH_DEFAULTS.effectLayers)
  );
  const [boardPolishEffectRegions, setBoardPolishEffectRegions] = useState(
    createBoardPolishEffectRegions(initialBoardPolishState?.effectRegions ?? STUDIO_BOARD_POLISH_DEFAULTS.effectRegions)
  );
  const [selectedCinematicSceneKitId, setSelectedCinematicSceneKitId] = useState<CinematicSceneKitId | undefined>(undefined);
  const [transportPlaying, setTransportPlaying] = useState(false);
  const [timeLapsePlaying, setTimeLapsePlaying] = useState(false);
  const [timeLapseProgressMs, setTimeLapseProgressMs] = useState(0);
  const [selectedAnimationOutput, setSelectedAnimationOutput] = useState<(typeof STUDIO_ANIMATION_OUTPUTS)[number]>('Animatics');
  const [selectedGuideMode, setSelectedGuideMode] = useState<(typeof STUDIO_GUIDE_MODES)[number]>('Perspective');
  const [selectedFontPreset, setSelectedFontPreset] = useState<(typeof STUDIO_FONT_PRESETS)[number]>('Grotesk');
  const [selectedCropPreset, setSelectedCropPreset] = useState<(typeof STUDIO_CROP_PRESETS)[number]>('Safe Margin');
  const [selectedTextAlignment, setSelectedTextAlignment] = useState<(typeof STUDIO_TEXT_ALIGNMENTS)[number]>('Center');
  const [selectedMotionRigWarpCorner, setSelectedMotionRigWarpCorner] = useState<StoryboardDocumentCornerWarpCorner>('ne');
  const [selectedStudioLayerId, setSelectedStudioLayerId] = useState<string | undefined>(undefined);
  const [selectedSpatialBookmarkId, setSelectedSpatialBookmarkId] = useState<string | undefined>(undefined);
  const [flythroughPlaying, setFlythroughPlaying] = useState(false);
  const [flythroughLoopEnabled, setFlythroughLoopEnabled] = useState(true);
  const [flythroughElapsedMs, setFlythroughElapsedMs] = useState(0);
  const [flythroughSeeking, setFlythroughSeeking] = useState(false);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | undefined>(initialSelectedReferenceId);
  const [selectedShapeScaffoldId, setSelectedShapeScaffoldId] = useState<string | undefined>(initialSelectedShapeScaffoldId);
  const [selectedShapeScaffoldAssemblyId, setSelectedShapeScaffoldAssemblyId] = useState<string | undefined>(initialSelectedShapeScaffoldAssemblyId);
  const [shapeScaffoldBatchIds, setShapeScaffoldBatchIds] = useState<string[]>(initialSelectedShapeScaffoldId ? [initialSelectedShapeScaffoldId] : []);
  const [shapeScaffoldLibrarySearch, setShapeScaffoldLibrarySearch] = useState('');
  const [shapeScaffoldLibraryFilter, setShapeScaffoldLibraryFilter] = useState<'all' | 'pinned' | 'defaults' | 'Food' | 'Vehicle' | 'Furniture' | 'Prop' | 'Environment'>('all');
  const [shapeScaffoldAssemblyDraftName, setShapeScaffoldAssemblyDraftName] = useState('');
  const [shapeScaffoldLibraryRenameEntryId, setShapeScaffoldLibraryRenameEntryId] = useState<string | undefined>(undefined);
  const [shapeScaffoldLibraryRenameValue, setShapeScaffoldLibraryRenameValue] = useState('');
  const [referenceStudyActive, setReferenceStudyActive] = useState(initialReferenceStudyState?.active ?? false);
  const [referenceStudyReveal, setReferenceStudyReveal] = useState(initialReferenceStudyState?.reveal ?? false);
  const [referenceStudyReferenceId, setReferenceStudyReferenceId] = useState<string | undefined>(initialReferenceStudyState?.referenceId);
  const [referenceStudyBaselineStrokeCount, setReferenceStudyBaselineStrokeCount] = useState<number | null>(
    initialReferenceStudyState?.baselineStrokeCount ?? null
  );
  const [referenceStudyCompareOpacity, setReferenceStudyCompareOpacity] = useState(initialReferenceStudyState?.compareOpacity ?? 0.58);
  const [referenceStudyFocusMode, setReferenceStudyFocusMode] = useState<ReferenceStudyFocusMode>(initialReferenceStudyState?.focusMode ?? 'composition');
  const [referenceStudyArmedDrillId, setReferenceStudyArmedDrillId] = useState<ReferenceStudyDrillId | undefined>(
    initialReferenceStudyState?.armedDrillId
  );
  const [referenceStudyAttempts, setReferenceStudyAttempts] = useState<ReferenceStudyAttemptRecord[]>(initialReferenceStudyState?.attempts ?? []);
  const [selectedReferenceStudyAttemptId, setSelectedReferenceStudyAttemptId] = useState<string | undefined>(
    initialReferenceStudyState?.selectedAttemptId
  );
  const [referenceStudyGhostEnabled, setReferenceStudyGhostEnabled] = useState(initialReferenceStudyState?.ghostEnabled ?? false);
  const [referenceStudyGhostOpacity, setReferenceStudyGhostOpacity] = useState(initialReferenceStudyState?.ghostOpacity ?? 0.3);
  const normalizedSelectedReferenceStudyAttemptId = useMemo(
    () => (
      selectedReferenceStudyAttemptId && referenceStudyAttempts.some((attempt) => attempt.id === selectedReferenceStudyAttemptId)
        ? selectedReferenceStudyAttemptId
        : referenceStudyAttempts[0]?.id
    ),
    [referenceStudyAttempts, selectedReferenceStudyAttemptId]
  );
  const boardPolishDocumentSnapshot = useMemo<Omit<BoardPolishPersistedState, 'updatedAt'> | null>(() => {
    const normalizedState = {
      mode: boardPolishMode,
      tone: boardPolishTone,
      finish: boardPolishFinish,
      weather: boardPolishWeather,
      atmosphere: Number(boardPolishAtmosphere.toFixed(3)),
      lineBoost: Number(boardPolishLineBoost.toFixed(3)),
      vignette: Number(boardPolishVignette.toFixed(3)),
      effectLayers: createBoardPolishEffectLayerStates(boardPolishEffectLayerStates),
      effectRegions: createBoardPolishEffectRegions(boardPolishEffectRegions),
    } satisfies Omit<BoardPolishPersistedState, 'updatedAt'>;
    const hasPersistedBoardPolishState = (
      normalizedState.mode !== STUDIO_BOARD_POLISH_DEFAULTS.mode
      || normalizedState.tone !== STUDIO_BOARD_POLISH_DEFAULTS.tone
      || normalizedState.finish !== STUDIO_BOARD_POLISH_DEFAULTS.finish
      || normalizedState.weather !== STUDIO_BOARD_POLISH_DEFAULTS.weather
      || Math.abs(normalizedState.atmosphere - STUDIO_BOARD_POLISH_DEFAULTS.atmosphere) >= 0.001
      || Math.abs(normalizedState.lineBoost - STUDIO_BOARD_POLISH_DEFAULTS.lineBoost) >= 0.001
      || Math.abs(normalizedState.vignette - STUDIO_BOARD_POLISH_DEFAULTS.vignette) >= 0.001
      || JSON.stringify(normalizedState.effectLayers) !== JSON.stringify(STUDIO_BOARD_POLISH_DEFAULTS.effectLayers)
      || JSON.stringify(normalizedState.effectRegions) !== JSON.stringify(STUDIO_BOARD_POLISH_DEFAULTS.effectRegions)
    );

    return hasPersistedBoardPolishState ? normalizedState : null;
  }, [
    boardPolishAtmosphere,
    boardPolishFinish,
    boardPolishEffectLayerStates,
    boardPolishEffectRegions,
    boardPolishLineBoost,
    boardPolishMode,
    boardPolishTone,
    boardPolishVignette,
    boardPolishWeather,
  ]);
  const boardPolishDocumentSnapshotSignature = useMemo(
    () => JSON.stringify(boardPolishDocumentSnapshot),
    [boardPolishDocumentSnapshot]
  );
  const referenceStudyDocumentSnapshot = useMemo<Omit<ReferenceStudyPersistedState, 'updatedAt'> | null>(() => {
    const hasPersistedReferenceStudyState = (
      referenceStudyActive
      || Boolean(referenceStudyReferenceId)
      || referenceStudyBaselineStrokeCount !== null
      || referenceStudyAttempts.length > 0
      || referenceStudyReveal
      || referenceStudyGhostEnabled
      || Boolean(referenceStudyArmedDrillId)
    );

    if (!hasPersistedReferenceStudyState) {
      return null;
    }

    return {
      active: referenceStudyActive,
      reveal: referenceStudyReveal,
      referenceId: referenceStudyReferenceId,
      baselineStrokeCount: referenceStudyBaselineStrokeCount,
      compareOpacity: referenceStudyCompareOpacity,
      focusMode: referenceStudyFocusMode,
      armedDrillId: referenceStudyArmedDrillId,
      attempts: referenceStudyAttempts,
      selectedAttemptId: normalizedSelectedReferenceStudyAttemptId,
      ghostEnabled: referenceStudyGhostEnabled,
      ghostOpacity: referenceStudyGhostOpacity,
    };
  }, [
    normalizedSelectedReferenceStudyAttemptId,
    referenceStudyActive,
    referenceStudyArmedDrillId,
    referenceStudyAttempts,
    referenceStudyBaselineStrokeCount,
    referenceStudyCompareOpacity,
    referenceStudyFocusMode,
    referenceStudyGhostEnabled,
    referenceStudyGhostOpacity,
    referenceStudyReferenceId,
    referenceStudyReveal,
  ]);
  const referenceStudyDocumentSnapshotSignature = useMemo(
    () => JSON.stringify(referenceStudyDocumentSnapshot),
    [referenceStudyDocumentSnapshot]
  );
  const [shapeIntentSelectedSuggestionId, setShapeIntentSelectedSuggestionId] = useState<string>();
  const [shapeIntentSelections, setShapeIntentSelections] = useState<ShapeIntentSelections>({});
  const [shapeIntentApplyMode, setShapeIntentApplyMode] = useState<ShapeIntentApplyMode>('clean');
  const [shapeIntentPendingSelections, setShapeIntentPendingSelections] = useState<{
    suggestionId: string;
    selections: ShapeIntentSelections;
  } | null>(null);
  const [shapeIntentShuffleOffset, setShapeIntentShuffleOffset] = useState(0);
  const [shapeIntentSuppressedStrokeCount, setShapeIntentSuppressedStrokeCount] = useState<number | null>(null);
  const [shapeIntentParkedPrimitive, setShapeIntentParkedPrimitive] = useState<string | null>(null);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [collapsedInspectorLayerIds, setCollapsedInspectorLayerIds] = useState<string[]>([]);
  const [guideSnapEnabled, setGuideSnapEnabled] = useState(true);
  const [mirrorGuideEnabled, setMirrorGuideEnabled] = useState(false);
  const [flowValue, setFlowValue] = useState(autoEnhance ? 82 : 65);
  const [stabilizeValue, setStabilizeValue] = useState(workflowLevel === 'idea' ? 18 : 58);
  const [pressureValue, setPressureValue] = useState(device.hasPencilSupport ? 84 : 64);
  const flythroughProgressRef = useRef<HTMLDivElement | null>(null);
  const flythroughSeekStateRef = useRef<{ active: boolean; pointerId: number | null }>({ active: false, pointerId: null });
  const boardPolishEffectOverlayRef = useRef<HTMLDivElement | null>(null);
  const boardPolishEffectDraftRegionRef = useRef<StoryboardDocumentBoardPolishEffectRegion | null>(null);
  const shapeScaffoldOverlayRef = useRef<HTMLDivElement | null>(null);
  const shapeScaffoldOverlayBoxRef = useRef<HTMLDivElement | null>(null);
  const shapeScaffoldDraftFrameRef = useRef<StoryboardDocumentShapeScaffoldFrame | null>(null);
  const [boardPolishEffectInteractionState, setBoardPolishEffectInteractionState] = useState<BoardPolishEffectRegionInteractionState | null>(null);
  const [boardPolishEffectDraftRegion, setBoardPolishEffectDraftRegion] = useState<StoryboardDocumentBoardPolishEffectRegion | null>(null);
  const [shapeScaffoldInteractionState, setShapeScaffoldInteractionState] = useState<ShapeScaffoldInteractionState | null>(null);
  const [shapeScaffoldDraftFrame, setShapeScaffoldDraftFrame] = useState<StoryboardDocumentShapeScaffoldFrame | null>(null);
  const shapeScaffoldLibraryImportRef = useRef<HTMLInputElement | null>(null);

  const setEditorStrokesFromLocal = useCallback((nextStrokes: React.SetStateAction<PencilStroke[]>) => {
    pendingStrokeSyncSourceRef.current = 'local';
    setStrokes(nextStrokes);
  }, []);

  const setEditorStrokesFromDocument = useCallback((nextStrokes: React.SetStateAction<PencilStroke[]>) => {
    pendingStrokeSyncSourceRef.current = 'document';
    setStrokes(nextStrokes);
  }, []);

  useEffect(() => {
    if (hydratedInitialLoadSignatureRef.current === initialLoadSignature) {
      return;
    }
    hydratedInitialLoadSignatureRef.current = initialLoadSignature;
    drawingDocumentRef.current = initialDocument;
    activeSheetIdRef.current = initialActiveSheetId;
    setDrawingDocument(initialDocument);
    setEditorStrokesFromDocument(resolvedInitialStrokes);
    setBrushSettings(initialBrushSettingsForEditor);
    setBrushType(initialBrushSettingsForEditor.type);
    setProBrushType(initialBrushSettingsForEditor.type as ProBrushType);
    setBoardPolishMode(initialBoardPolishState?.mode ?? STUDIO_BOARD_POLISH_DEFAULTS.mode);
    setBoardPolishTone(initialBoardPolishState?.tone ?? STUDIO_BOARD_POLISH_DEFAULTS.tone);
    setBoardPolishFinish(initialBoardPolishState?.finish ?? STUDIO_BOARD_POLISH_DEFAULTS.finish);
    setBoardPolishWeather(initialBoardPolishState?.weather ?? STUDIO_BOARD_POLISH_DEFAULTS.weather);
    setBoardPolishAtmosphere(initialBoardPolishState?.atmosphere ?? STUDIO_BOARD_POLISH_DEFAULTS.atmosphere);
    setBoardPolishLineBoost(initialBoardPolishState?.lineBoost ?? STUDIO_BOARD_POLISH_DEFAULTS.lineBoost);
    setBoardPolishVignette(initialBoardPolishState?.vignette ?? STUDIO_BOARD_POLISH_DEFAULTS.vignette);
    setBoardPolishEffectLayerStates(createBoardPolishEffectLayerStates(initialBoardPolishState?.effectLayers ?? STUDIO_BOARD_POLISH_DEFAULTS.effectLayers));
    setBoardPolishEffectRegions(createBoardPolishEffectRegions(initialBoardPolishState?.effectRegions ?? STUDIO_BOARD_POLISH_DEFAULTS.effectRegions));
    setSelectedCinematicSceneKitId(undefined);
    setTransportPlaying(false);
    setTimeLapsePlaying(false);
    setTimeLapseProgressMs(0);
    setSelectedMotionRigWarpCorner('ne');
    setSelectedStudioLayerId(undefined);
    setSelectedSpatialBookmarkId(undefined);
    setSelectedReferenceId(initialSelectedReferenceId);
    setSelectedShapeScaffoldId(initialSelectedShapeScaffoldId);
    setSelectedShapeScaffoldAssemblyId(initialSelectedShapeScaffoldAssemblyId);
    setShapeScaffoldBatchIds(initialSelectedShapeScaffoldId ? [initialSelectedShapeScaffoldId] : []);
    setShapeScaffoldLibrarySearch('');
    setShapeScaffoldLibraryFilter('all');
    setShapeScaffoldAssemblyDraftName('');
    setShapeScaffoldLibraryRenameEntryId(undefined);
    setShapeScaffoldLibraryRenameValue('');
    setReferenceStudyActive(initialReferenceStudyState?.active ?? false);
    setReferenceStudyReveal(initialReferenceStudyState?.reveal ?? false);
    setReferenceStudyReferenceId(initialReferenceStudyState?.referenceId);
    setReferenceStudyBaselineStrokeCount(initialReferenceStudyState?.baselineStrokeCount ?? null);
    setReferenceStudyCompareOpacity(initialReferenceStudyState?.compareOpacity ?? 0.58);
    setReferenceStudyFocusMode(initialReferenceStudyState?.focusMode ?? 'composition');
    setReferenceStudyArmedDrillId(initialReferenceStudyState?.armedDrillId);
    setReferenceStudyAttempts(initialReferenceStudyState?.attempts ?? []);
    setSelectedReferenceStudyAttemptId(initialReferenceStudyState?.selectedAttemptId);
    setReferenceStudyGhostEnabled(initialReferenceStudyState?.ghostEnabled ?? false);
    setReferenceStudyGhostOpacity(initialReferenceStudyState?.ghostOpacity ?? 0.3);
    setShapeIntentSelectedSuggestionId(undefined);
    setShapeIntentPendingSelections(null);
    setShapeIntentSelections({});
    setShapeIntentShuffleOffset(0);
    setShapeIntentSuppressedStrokeCount(null);
    setShapeIntentParkedPrimitive(null);
    setSelectedLayerIds([]);
    setCollapsedInspectorLayerIds([]);
  }, [
    initialActiveSheetId,
    initialBoardPolishState?.lineBoost,
    initialBoardPolishState?.mode,
    initialBoardPolishState?.finish,
    initialBoardPolishState?.weather,
    initialBoardPolishState?.atmosphere,
    initialBoardPolishState?.effectLayers,
    initialBoardPolishState?.effectRegions,
    initialBoardPolishState?.tone,
    initialBoardPolishState?.vignette,
    initialBrushSettingsForEditor,
    initialDocument,
    initialReferenceStudyState,
    initialSelectedReferenceId,
    initialSelectedShapeScaffoldAssemblyId,
    initialSelectedShapeScaffoldId,
    initialLoadSignature,
    resolvedInitialStrokes,
  ]);

  useEffect(() => {
    let rafId: number | null = null;
    const handleResize = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(() => {
        const next = getInitialViewport();
        setViewport((prev) => (
          Math.abs(prev.width - next.width) >= 2 || Math.abs(prev.height - next.height) >= 2
            ? next
            : prev
        ));
        rafId = null;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (!entry) return;
      const nextWidth = Math.floor(entry.contentRect.width);
      const nextHeight = Math.floor(entry.contentRect.height);
      setEditorContainerSize((prev) => (
        Math.abs(prev.width - nextWidth) >= 2 || Math.abs(prev.height - nextHeight) >= 2
          ? { width: nextWidth, height: nextHeight }
          : prev
      ));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const isCompactUi = viewport.width < 1200 || device.isIPad;
  const isDesktopCanvasPriority = !device.isIPad && viewport.width >= 1366;
  const isThumbnailWorkflow = workflowLevel === 'idea';
  const defaultGridEnabled = workflowLevel === 'blocking' || workflowLevel === 'shot';
  const showReferenceImageControls = workflowLevel !== 'idea';
  const showDrawingToolsPanel = workflowLevel !== 'idea';
  const isTabletWorkspace = proMode && !isThumbnailWorkflow && device.isIPad;
  const enableStudioChrome = proMode && !isThumbnailWorkflow && !device.isIPad && viewport.width >= 1280;
  const showWorkspaceChrome = enableStudioChrome || isTabletWorkspace;
  const boardPolishPresentationActive = boardPolishMode === 'present';
  const boardPolishResolvedEffectRegions = useMemo(
    () => createBoardPolishEffectRegions(
      boardPolishEffectDraftRegion
        ? boardPolishEffectRegions.map((region) => (region.id === boardPolishEffectDraftRegion.id ? boardPolishEffectDraftRegion : region))
        : boardPolishEffectRegions,
    ),
    [boardPolishEffectDraftRegion, boardPolishEffectRegions],
  );
  const boardPolishDraftState = useMemo<BoardPolishDraftState>(() => createBoardPolishDraftState({
    mode: boardPolishMode,
    tone: boardPolishTone,
    finish: boardPolishFinish,
    weather: boardPolishWeather,
    atmosphere: boardPolishAtmosphere,
    lineBoost: boardPolishLineBoost,
    vignette: boardPolishVignette,
    effectLayers: boardPolishEffectLayerStates,
    effectRegions: boardPolishResolvedEffectRegions,
  }), [
    boardPolishAtmosphere,
    boardPolishEffectLayerStates,
    boardPolishResolvedEffectRegions,
    boardPolishFinish,
    boardPolishLineBoost,
    boardPolishMode,
    boardPolishTone,
    boardPolishVignette,
    boardPolishWeather,
  ]);
  const boardPolishToneConfig = STUDIO_BOARD_POLISH_TONE_CONFIG[boardPolishTone];
  const boardPolishFinishConfig = STUDIO_BOARD_POLISH_FINISH_CONFIG[boardPolishFinish];
  const boardPolishWeatherConfig = STUDIO_BOARD_POLISH_WEATHER_CONFIG[boardPolishWeather];
  const selectedCinematicSceneKit = selectedCinematicSceneKitId
    ? cinematicSceneKits.find((entry) => entry.id === selectedCinematicSceneKitId)
    : undefined;
  const effectiveGridEnabled = boardPolishPresentationActive ? false : gridEnabled;
  const boardPolishFinishLabel = boardPolishFinishConfig.label.toLowerCase();
  const boardPolishWeatherLabel = boardPolishWeatherConfig.label.toLowerCase();
  const activeBoardPolishStatusLabel = boardPolishPresentationActive
    ? `present · ${boardPolishToneConfig.label.toLowerCase()} · ${boardPolishFinishLabel}${boardPolishWeather === 'none' ? '' : ` · ${boardPolishWeatherLabel}`}`
    : boardPolishDocumentSnapshot
      ? `armed · ${boardPolishToneConfig.label.toLowerCase()} · ${boardPolishFinishLabel}${boardPolishWeather === 'none' ? '' : ` · ${boardPolishWeatherLabel}`}`
      : 'edit · clean';
  const boardPolishStyleSummary = getBoardPolishStyleSummary(boardPolishDraftState);
  const boardPolishCanvasFilter = getBoardPolishCanvasFilter(boardPolishDraftState, boardPolishPresentationActive);
  const boardPolishEffectLayerStateMap = useMemo(
    () => boardPolishEffectLayerStates.reduce<Record<StoryboardDocumentBoardPolishEffectLayerId, { enabled: boolean; opacity: number }>>(
      (result, layer) => {
        result[layer.id] = {
          enabled: layer.enabled,
          opacity: layer.opacity,
        };
        return result;
      },
      {
        atmosphere: { enabled: true, opacity: 1 },
        weather: { enabled: true, opacity: 1 },
        finish: { enabled: true, opacity: 1 },
        vignette: { enabled: true, opacity: 1 },
      },
    ),
    [boardPolishEffectLayerStates],
  );
  const boardPolishEffectRegionMap = useMemo(
    () => getBoardPolishEffectRegionMap(boardPolishDraftState),
    [boardPolishDraftState],
  );
  const boardPolishArmedEffectLayers = useMemo(
    () => getBoardPolishEffectLayers(boardPolishDraftState, true, { includeDisabled: true }),
    [boardPolishDraftState],
  );
  const boardPolishActiveEffectLayers = useMemo(
    () => getBoardPolishEffectLayers(boardPolishDraftState, boardPolishPresentationActive),
    [boardPolishDraftState, boardPolishPresentationActive],
  );
  const tabletTouchButtonHeight = isTabletWorkspace ? 34 : 26;
  const tabletTouchSecondaryButtonHeight = isTabletWorkspace ? 32 : 24;
  const tabletTouchChipHeight = isTabletWorkspace ? 28 : 18;
  const editorTitle =
    workflowLevel === 'idea'
      ? 'Thumbnail Sketch'
      : workflowLevel === 'blocking'
        ? 'Blocking Pass'
        : workflowLevel === 'presentation'
          ? 'Presentation Board'
          : 'Shot Drawing';
  const horizontalPadding = isFullscreen
    ? 0
    : showWorkspaceChrome
      ? (viewport.width < 900 ? 8 : 10)
      : (viewport.width < 900 ? 10 : 20);
  const verticalPadding = isFullscreen ? 0 : (viewport.height < 900 ? 8 : 14);
  const editorMaxWidth = viewport.width >= 5120
    ? 4600
    : viewport.width >= 3840
      ? 3300
      : viewport.width >= 2560
        ? 2500
        : viewport.width >= 1920
          ? 1950
          : viewport.width >= 1366
            ? 1600
            : 1180;
  const editorWidth = isFullscreen
    ? viewport.width
    : Math.max(320, Math.min(viewport.width - horizontalPadding * 2, editorMaxWidth));
  const editorHeight = isFullscreen
    ? viewport.height
    : Math.max(540, viewport.height - verticalPadding * 2);
  const showEmbeddedCanvasToolbar = !isThumbnailWorkflow && !showWorkspaceChrome;
  const drawingToolsPanelWidth = viewport.width >= 3840
    ? 360
    : viewport.width >= 2560
      ? 320
      : viewport.width >= 1920
        ? 288
        : 264;
  const initialToolsPanelCollapsed = isThumbnailWorkflow ? true : isDesktopCanvasPriority;
  const currentBrushPack = STUDIO_BRUSH_PACKS.find((pack) => pack.id === selectedBrushPackId) || STUDIO_BRUSH_PACKS[0];
  const displaySceneLabel = sceneId ? `Scene ${sceneId}` : 'Scene 15';
  const displayShotLabel = frameId
    ? frameId.replace(/^frame[-_]?/i, '').replace(/[-_]/g, ' ').trim().toUpperCase() || 'Shot 5B'
    : 'Shot 5B';
  const versionLabel = lastSavedImage ? 'Version 2' : 'Version 1';
  const timelineFrames = useMemo(
    () => getStoryboardDocumentTimelineFrames(drawingDocument),
    [drawingDocument]
  );
  const activeTimelineFrameIndex = timelineFrames.length > 0
    ? Math.max(0, Math.min(timelineFrames.length - 1, drawingDocument.timeline.scrubFrame))
    : 0;
  const activeTimelineFrame = timelineFrames[activeTimelineFrameIndex];
  const activeSheetId = activeTimelineFrame?.sheetId
    || drawingDocument.timeline.selectedSheetIds[0]
    || drawingDocument.primarySheetId;
  const activeSheet = useMemo(
    () => getStoryboardDocumentSheetById(drawingDocument, activeSheetId) || drawingDocument.sheets[0],
    [activeSheetId, drawingDocument]
  );
  const activeSheetExposure = activeSheet?.exposure || drawingDocument.timeline.defaultExposure;
  const activeLayerId = useMemo(
    () => getStoryboardDocumentActiveLayerId(drawingDocument, activeSheetId) || activeSheet?.layerIds[0],
    [activeSheet?.layerIds, activeSheetId, drawingDocument]
  );
  const activeSheetRenderableLayers = useMemo(
    () => getStoryboardDocumentSheetRenderableLayers(drawingDocument, activeSheetId),
    [activeSheetId, drawingDocument]
  );
  const activeSheetLayerStack = useMemo(
    () => getStoryboardDocumentSheetLayerStack(drawingDocument, activeSheetId),
    [activeSheetId, drawingDocument]
  );
  const activeLayerStrokes = useMemo(
    () => (activeLayerId ? getStoryboardDocumentDrawingLayerStrokes(drawingDocument, activeLayerId) : []),
    [activeLayerId, drawingDocument]
  );
  const activeRenderableLayer = useMemo(
    () => activeSheetRenderableLayers.find((layer) => layer.id === activeLayerId),
    [activeLayerId, activeSheetRenderableLayers]
  );
  const visibleLayerOverlays = useMemo(
    () => activeSheetRenderableLayers.filter((layer) => layer.effectiveVisible && layer.id !== activeLayerId),
    [activeLayerId, activeSheetRenderableLayers]
  );
  const editorLayers = useMemo<DrawingLayer[]>(
    () => activeSheetRenderableLayers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      strokes: layer.strokes,
    })),
    [activeSheetRenderableLayers]
  );
  const studioLayerCards = useMemo(() => {
    const layerMap = new Map(activeSheetLayerStack.map((layer) => [layer.id, layer]));
    const childIdsByParent = new Map<string, string[]>();
    activeSheetLayerStack.forEach((layer) => {
      if (!layer.parentLayerId) return;
      const existing = childIdsByParent.get(layer.parentLayerId);
      if (existing) {
        existing.push(layer.id);
      } else {
        childIdsByParent.set(layer.parentLayerId, [layer.id]);
      }
    });
    const descendantStrokeCountCache = new Map<string, number>();
    const countDescendantStrokes = (layerId: string): number => {
      const cached = descendantStrokeCountCache.get(layerId);
      if (typeof cached === 'number') {
        return cached;
      }
      const layer = layerMap.get(layerId);
      if (!layer) {
        return 0;
      }
      if (layer.type === 'drawing') {
        descendantStrokeCountCache.set(layerId, layer.strokes.length);
        return layer.strokes.length;
      }
      const total = (childIdsByParent.get(layerId) || []).reduce((sum, childId) => sum + countDescendantStrokes(childId), 0);
      descendantStrokeCountCache.set(layerId, total);
      return total;
    };
    const activeAncestorIds = new Set<string>();
    let activeCursor = activeLayerId ? layerMap.get(activeLayerId) : undefined;
    while (activeCursor?.parentLayerId) {
      activeAncestorIds.add(activeCursor.parentLayerId);
      activeCursor = layerMap.get(activeCursor.parentLayerId);
    }

    return activeSheetLayerStack.map((layer, index) => ({
      id: layer.id,
      label: layer.name,
      opacity: `${Math.round(layer.opacity * 100)}%`,
      opacityValue: layer.opacity,
      mode: layer.type === 'effect' ? 'Board FX' : formatBlendModeLabel(layer.blendMode),
      tint: STUDIO_LAYER_TINTS[index % STUDIO_LAYER_TINTS.length],
      type: layer.type,
      effectId: layer.effectId,
      depth: layer.depth,
      parentLayerId: layer.parentLayerId,
      locked: layer.locked,
      visible: layer.visible,
      active: layer.id === activeLayerId,
      containsActiveDescendant: activeAncestorIds.has(layer.id),
      strokeCount: layer.type === 'effect' ? 0 : countDescendantStrokes(layer.id),
      childCount: layer.type === 'effect' ? 0 : (childIdsByParent.get(layer.id)?.length || 0),
      isContainer: layer.type === 'group' || layer.type === 'transformation',
      detail: layer.type === 'drawing'
        ? formatBlendModeLabel(layer.blendMode)
        : layer.type === 'effect'
          ? `${layer.visible ? 'Enabled' : 'Muted'} · ${Math.round(layer.opacity * 100)}% effect · ${Math.round((boardPolishEffectRegionMap[layer.effectId || 'atmosphere']?.widthRatio || 1) * 100)}w`
          : `${childIdsByParent.get(layer.id)?.length || 0} children · ${countDescendantStrokes(layer.id)} strokes`,
    }));
  }, [activeLayerId, activeSheetLayerStack, boardPolishEffectRegionMap]);
  const studioLayerCardMap = useMemo(
    () => new Map(studioLayerCards.map((layer) => [layer.id, layer])),
    [studioLayerCards]
  );
  const isStudioLayerDescendantOf = useCallback((layerId: string, ancestorId: string) => {
    let current = studioLayerCardMap.get(layerId);
    while (current?.parentLayerId) {
      if (current.parentLayerId === ancestorId) {
        return true;
      }
      current = studioLayerCardMap.get(current.parentLayerId);
    }
    return false;
  }, [studioLayerCardMap]);
  const visibleStudioLayerCards = useMemo(() => {
    const collapsedSet = new Set(collapsedInspectorLayerIds);
    return studioLayerCards.filter((layer) => {
      let parentId = layer.parentLayerId;
      while (parentId) {
        if (collapsedSet.has(parentId)) {
          return false;
        }
        parentId = studioLayerCardMap.get(parentId)?.parentLayerId;
      }
      return true;
    });
  }, [collapsedInspectorLayerIds, studioLayerCardMap, studioLayerCards]);
  const studioShotNotes = useMemo(
    () => studioLayerCards.map((layer) => {
      const preset = STUDIO_LAYER_NOTE_PRESETS[layer.label.toLowerCase() as keyof typeof STUDIO_LAYER_NOTE_PRESETS];
      return {
        label: layer.label,
        note: preset?.note || `${layer.strokeCount} strokes layered for the current shot pass`,
        tag: preset?.tag || 'LAYER',
        accent: layer.tint,
      };
    }),
    [studioLayerCards]
  );
  useEffect(() => {
    setSelectedLayerIds((prev) => prev.filter((layerId) => studioLayerCardMap.has(layerId)));
    setCollapsedInspectorLayerIds((prev) => prev.filter((layerId) => studioLayerCardMap.get(layerId)?.isContainer));
    setSelectedStudioLayerId((prev) => {
      if (prev && studioLayerCardMap.has(prev)) {
        return prev;
      }
      return activeLayerId || studioLayerCards[0]?.id;
    });
  }, [activeLayerId, studioLayerCardMap, studioLayerCards]);
  const selectedStudioLayer = studioLayerCardMap.get(selectedStudioLayerId || '')
    || studioLayerCardMap.get(activeLayerId || '')
    || studioLayerCards[0];
  const selectedBoardPolishEffectLayerId = selectedStudioLayer?.type === 'effect'
    ? selectedStudioLayer.effectId
    : undefined;
  const selectedBoardPolishEffectRegion = selectedBoardPolishEffectLayerId
    ? (
        boardPolishEffectDraftRegion?.id === selectedBoardPolishEffectLayerId
          ? boardPolishEffectDraftRegion
          : boardPolishEffectRegionMap[selectedBoardPolishEffectLayerId]
      )
    : undefined;
  const selectedLayerCards = useMemo(
    () => studioLayerCards.filter((layer) => selectedLayerIds.includes(layer.id)),
    [selectedLayerIds, studioLayerCards]
  );
  const canGroupSelectedLayers = useMemo(() => {
    if (selectedLayerCards.length < 2) {
      return false;
    }
    if (selectedLayerCards.some((layer) => layer.type === 'effect')) {
      return false;
    }
    return new Set(selectedLayerCards.map((layer) => layer.parentLayerId || '__sheet__')).size === 1;
  }, [selectedLayerCards]);
  const canUngroupSelectedLayer = selectedStudioLayer?.type === 'group';
  const canDuplicateSelectedLayer = selectedStudioLayer?.type === 'drawing';
  const canMergeSelectedLayer = selectedStudioLayer?.type === 'drawing';
  const canDeleteSelectedLayer = selectedStudioLayer?.type === 'drawing';
  const canAddMotionRigToSelectedLayer = selectedStudioLayer?.type !== 'effect';
  const activeMotionRig = useMemo(() => {
    const selectedTransformLayerId = selectedStudioLayer?.type === 'transformation'
      ? selectedStudioLayer.id
      : activeRenderableLayer?.appliedTransforms[activeRenderableLayer.appliedTransforms.length - 1]?.layerId;
    if (!selectedTransformLayerId) return undefined;
    return getStoryboardDocumentTransformationLayerPreview(
      drawingDocument,
      selectedTransformLayerId,
      activeTimelineFrameIndex,
    );
  }, [activeRenderableLayer, activeTimelineFrameIndex, drawingDocument, selectedStudioLayer]);
  const activeMotionRigCornerWarp = activeMotionRig?.currentTransform.cornerWarp ?? createIdentityMotionRigCornerWarp();
  const spatialCanvases = drawingDocument.canvases;
  const activeSpatialCanvas = useMemo(
    () => getPrimaryStoryboardDocumentCanvas(drawingDocument),
    [drawingDocument]
  );
  const activeSpatialBookmarks = useMemo(
    () => activeSpatialCanvas ? getStoryboardDocumentCanvasBookmarks(drawingDocument, activeSpatialCanvas.id) : [],
    [activeSpatialCanvas, drawingDocument]
  );
  useEffect(() => {
    setSelectedSpatialBookmarkId((prev) => (
      prev && activeSpatialBookmarks.some((bookmark) => bookmark.id === prev)
        ? prev
        : activeSpatialBookmarks[0]?.id
    ));
  }, [activeSpatialBookmarks]);
  const selectedSpatialBookmark = useMemo(
    () => activeSpatialBookmarks.find((bookmark) => bookmark.id === selectedSpatialBookmarkId) || activeSpatialBookmarks[0],
    [activeSpatialBookmarks, selectedSpatialBookmarkId]
  );
  const spatialMapLayout = useMemo(
    () => buildSpatialMapLayout(spatialCanvases),
    [spatialCanvases]
  );
  const spatialMapNodes = spatialMapLayout.nodes;
  const selectedSpatialBookmarkCanvasId = useMemo(
    () => (
      selectedSpatialBookmark
        ? getStoryboardDocumentBookmarkCanvasId(drawingDocument, selectedSpatialBookmark.id)
        : undefined
    ),
    [drawingDocument, selectedSpatialBookmark]
  );
  const flythroughSequence = useMemo(() => {
    let startMs = 0;
    return activeSpatialBookmarks.map((bookmark, index) => {
      const durationMs = Math.max(400, bookmark.timingMs);
      const entry = {
        bookmark,
        index,
        startMs,
        endMs: startMs + durationMs,
      };
      startMs += durationMs;
      return entry;
    });
  }, [activeSpatialBookmarks]);
  const activeFlythroughDurationMs = flythroughSequence[flythroughSequence.length - 1]?.endMs || 0;
  const selectedFlythroughEntry = useMemo(
    () => flythroughSequence.find((entry) => entry.bookmark.id === selectedSpatialBookmark?.id) || flythroughSequence[0],
    [flythroughSequence, selectedSpatialBookmark?.id]
  );
  const activeFlythroughEntry = useMemo(() => {
    if (flythroughSequence.length === 0) {
      return undefined;
    }
    const clampedElapsed = Math.min(Math.max(0, flythroughElapsedMs), Math.max(0, activeFlythroughDurationMs - 1));
    return flythroughSequence.find((entry) => clampedElapsed >= entry.startMs && clampedElapsed < entry.endMs)
      || flythroughSequence[flythroughSequence.length - 1];
  }, [activeFlythroughDurationMs, flythroughElapsedMs, flythroughSequence]);
  const flythroughProgressPercent = activeFlythroughDurationMs > 0
    ? Math.min(100, (Math.max(0, flythroughElapsedMs) / activeFlythroughDurationMs) * 100)
    : 0;
  const selectedSpatialVisibleCanvasNames = useMemo(
    () => (
      selectedSpatialBookmark?.visibleCanvasIds
        .map((canvasId) => spatialCanvases.find((canvas) => canvas.id === canvasId)?.name)
        .filter((value): value is string => Boolean(value))
        || []
    ),
    [selectedSpatialBookmark?.visibleCanvasIds, spatialCanvases]
  );
  const selectedBookmarkCameraSynced = useMemo(
    () => isBookmarkCameraSynced(selectedSpatialBookmark, activeSpatialCanvas),
    [activeSpatialCanvas, selectedSpatialBookmark]
  );
  useEffect(() => {
    if (flythroughSequence.length === 0) {
      setFlythroughPlaying(false);
      setFlythroughElapsedMs(0);
      return;
    }

    if (!flythroughPlaying && selectedFlythroughEntry) {
      setFlythroughElapsedMs(selectedFlythroughEntry.startMs);
    }
  }, [flythroughPlaying, flythroughSequence.length, selectedFlythroughEntry]);
  useEffect(() => {
    if (!flythroughPlaying || flythroughSequence.length === 0 || activeFlythroughDurationMs <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setFlythroughElapsedMs((prev) => {
        const next = prev + 120;
        if (next >= activeFlythroughDurationMs) {
          return flythroughLoopEnabled ? next % activeFlythroughDurationMs : activeFlythroughDurationMs;
        }
        return next;
      });
    }, 120);

    return () => window.clearInterval(timerId);
  }, [activeFlythroughDurationMs, flythroughLoopEnabled, flythroughPlaying, flythroughSequence.length]);
  useEffect(() => {
    if (flythroughPlaying && !flythroughLoopEnabled && activeFlythroughDurationMs > 0 && flythroughElapsedMs >= activeFlythroughDurationMs) {
      setFlythroughPlaying(false);
    }
  }, [activeFlythroughDurationMs, flythroughElapsedMs, flythroughLoopEnabled, flythroughPlaying]);
  const projectionSourceCanvas = useMemo(
    () => spatialCanvases.find((canvas) => canvas.id === drawingDocument.projection.sourceCanvasId) || activeSpatialCanvas,
    [activeSpatialCanvas, drawingDocument.projection.sourceCanvasId, spatialCanvases]
  );
  const projectionTargetCanvas = useMemo(
    () => spatialCanvases.find((canvas) => canvas.id === drawingDocument.projection.targetCanvasId) || activeSpatialCanvas,
    [activeSpatialCanvas, drawingDocument.projection.targetCanvasId, spatialCanvases]
  );
  const lastProjectedBookmark = useMemo(
    () => drawingDocument.bookmarks.find((bookmark) => bookmark.id === drawingDocument.projection.lastProjectedBookmarkId),
    [drawingDocument.bookmarks, drawingDocument.projection.lastProjectedBookmarkId]
  );
  useEffect(() => {
    setSelectedReferenceId((prev) => {
      if (prev && getStoryboardDocumentReferenceById(drawingDocument, prev)) {
        return prev;
      }
      return getPrimaryStoryboardDocumentReferenceImage(drawingDocument)?.id;
    });
  }, [drawingDocument]);
  const activeReferenceRecord = useMemo(
    () => (selectedReferenceId ? getStoryboardDocumentReferenceById(drawingDocument, selectedReferenceId) : undefined)
      || getPrimaryStoryboardDocumentReferenceImage(drawingDocument),
    [drawingDocument, selectedReferenceId]
  );
  const shapeScaffolds = drawingDocument.metadata.shapeScaffolds || [];
  const shapeScaffoldAssemblies = drawingDocument.metadata.shapeScaffoldAssemblies || [];
  const shapeScaffoldLibraryEntries = useMemo(
    () => [...(drawingDocument.metadata.shapeScaffoldLibrary || [])].sort(compareShapeScaffoldLibraryEntries),
    [drawingDocument.metadata.shapeScaffoldLibrary]
  );
  useEffect(() => {
    setSelectedShapeScaffoldId((prev) => {
      if (prev && getStoryboardDocumentShapeScaffoldById(drawingDocument, prev)) {
        return prev;
      }
      return shapeScaffolds[0]?.id;
    });
  }, [drawingDocument, shapeScaffolds]);
  useEffect(() => {
    setSelectedShapeScaffoldAssemblyId((prev) => {
      if (prev && getStoryboardDocumentShapeScaffoldAssemblyById(drawingDocument, prev)) {
        return prev;
      }
      return shapeScaffoldAssemblies[0]?.id;
    });
  }, [drawingDocument, shapeScaffoldAssemblies]);
  useEffect(() => {
    setShapeScaffoldBatchIds((prev) => {
      const nextBatchIds = prev.filter((entryId) => Boolean(getStoryboardDocumentShapeScaffoldById(drawingDocument, entryId)));
      return areStringArraysEqual(prev, nextBatchIds) ? prev : nextBatchIds;
    });
  }, [drawingDocument]);
  const selectedShapeScaffold = useMemo(
    () => (
      selectedShapeScaffoldId
        ? getStoryboardDocumentShapeScaffoldById(drawingDocument, selectedShapeScaffoldId)
        : undefined
    ),
    [drawingDocument, selectedShapeScaffoldId]
  );
  const selectedShapeScaffoldBatch = useMemo(
    () => shapeScaffolds.filter((entry) => shapeScaffoldBatchIds.includes(entry.id)),
    [shapeScaffoldBatchIds, shapeScaffolds]
  );
  const selectedShapeScaffoldAssembly = useMemo(
    () => (
      selectedShapeScaffoldAssemblyId
        ? getStoryboardDocumentShapeScaffoldAssemblyById(drawingDocument, selectedShapeScaffoldAssemblyId)
        : undefined
    ),
    [drawingDocument, selectedShapeScaffoldAssemblyId]
  );
  const selectedShapeScaffoldAssemblyMembers = useMemo(
    () => (
      selectedShapeScaffoldAssembly
        ? selectedShapeScaffoldAssembly.scaffoldIds
          .map((entryId) => getStoryboardDocumentShapeScaffoldById(drawingDocument, entryId))
          .filter((entry): entry is StoryboardDocumentShapeScaffold => Boolean(entry))
        : []
    ),
    [drawingDocument, selectedShapeScaffoldAssembly]
  );
  const activeShapeScaffoldPromotionBatch = useMemo(
    () => (
      selectedShapeScaffoldAssemblyMembers.length > 0
        ? selectedShapeScaffoldAssemblyMembers
        : selectedShapeScaffoldBatch
    ),
    [selectedShapeScaffoldAssemblyMembers, selectedShapeScaffoldBatch]
  );
  const activeShapeScaffoldPromotionBatchName = selectedShapeScaffoldAssembly?.name || 'Scaffold Batch';
  const availableShapeScaffoldAssemblyTemplates = useMemo(
    () => (
      selectedShapeScaffold
        ? shapeScaffoldAssemblyTemplates.filter((template) => template.compatibleSuggestionIds.includes(selectedShapeScaffold.suggestionId))
        : []
    ),
    [selectedShapeScaffold]
  );
  const filteredShapeScaffoldLibraryEntries = useMemo(
    () => {
      const query = shapeScaffoldLibrarySearch.trim().toLowerCase();
      return shapeScaffoldLibraryEntries.filter((entry) => {
        const suggestion = getShapeIntentSuggestionDefinitionById(entry.suggestionId);
        if (!suggestion) {
          return false;
        }
        if (shapeScaffoldLibraryFilter === 'pinned' && !entry.pinned) {
          return false;
        }
        if (shapeScaffoldLibraryFilter === 'defaults' && !entry.defaultForPrimitive) {
          return false;
        }
        if (
          shapeScaffoldLibraryFilter !== 'all'
          && shapeScaffoldLibraryFilter !== 'pinned'
          && shapeScaffoldLibraryFilter !== 'defaults'
          && suggestion.category !== shapeScaffoldLibraryFilter
        ) {
          return false;
        }
        if (!query) {
          return true;
        }
        const haystack = [
          entry.name,
          suggestion.title,
          suggestion.category,
          suggestion.description,
          summarizeShapeIntentSelections(suggestion, entry.selections),
          ...entry.tags,
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    },
    [shapeScaffoldLibraryEntries, shapeScaffoldLibraryFilter, shapeScaffoldLibrarySearch]
  );
  const selectedShapeScaffoldDisplayFrame = useMemo(
    () => shapeScaffoldDraftFrame || selectedShapeScaffold?.frame || null,
    [selectedShapeScaffold?.frame, shapeScaffoldDraftFrame]
  );
  const selectedShapeScaffoldRenderRecord = useMemo(
    () => (
      selectedShapeScaffold && selectedShapeScaffoldDisplayFrame
        ? {
            ...selectedShapeScaffold,
            frame: selectedShapeScaffoldDisplayFrame,
          }
        : undefined
    ),
    [selectedShapeScaffold, selectedShapeScaffoldDisplayFrame]
  );
  useEffect(() => {
    shapeScaffoldDraftFrameRef.current = null;
    setShapeScaffoldDraftFrame(null);
    setShapeScaffoldInteractionState(null);
  }, [selectedShapeScaffoldId]);
  useEffect(() => {
    boardPolishEffectDraftRegionRef.current = null;
    setBoardPolishEffectDraftRegion(null);
    setBoardPolishEffectInteractionState(null);
  }, [selectedBoardPolishEffectLayerId]);
  useEffect(() => {
    if (!referenceStudyReferenceId) {
      pendingReferenceStudyReferenceIdRef.current = undefined;
      return;
    }
    if (getStoryboardDocumentReferenceById(drawingDocument, referenceStudyReferenceId)) {
      if (pendingReferenceStudyReferenceIdRef.current === referenceStudyReferenceId) {
        pendingReferenceStudyReferenceIdRef.current = undefined;
      }
      return;
    }
    if (pendingReferenceStudyReferenceIdRef.current === referenceStudyReferenceId) {
      return;
    }
    setReferenceStudyActive(false);
    setReferenceStudyReveal(false);
    setReferenceStudyReferenceId(undefined);
    setReferenceStudyBaselineStrokeCount(null);
    setReferenceStudyArmedDrillId(undefined);
    setReferenceStudyAttempts([]);
    setSelectedReferenceStudyAttemptId(undefined);
    setReferenceStudyGhostEnabled(false);
  }, [drawingDocument, referenceStudyReferenceId]);
  const referenceStudyReferenceRecord = useMemo(
    () => (
      referenceStudyReferenceId
        ? getStoryboardDocumentReferenceById(drawingDocument, referenceStudyReferenceId)
        : undefined
    ),
    [drawingDocument, referenceStudyReferenceId]
  );
  const referenceStudyAttemptStrokes = useMemo(
    () => (
      referenceStudyBaselineStrokeCount === null
        ? []
        : strokes.slice(referenceStudyBaselineStrokeCount)
    ),
    [referenceStudyBaselineStrokeCount, strokes]
  );
  const referenceStudyAttemptSignature = useMemo(
    () => buildStrokeSignature(referenceStudyAttemptStrokes),
    [referenceStudyAttemptStrokes]
  );
  const referenceStudyAttemptPointCount = useMemo(
    () => referenceStudyAttemptStrokes.reduce((total, stroke) => total + stroke.points.length, 0),
    [referenceStudyAttemptStrokes]
  );
  const selectedReferenceStudyAttempt = useMemo(
    () => (
      selectedReferenceStudyAttemptId
        ? referenceStudyAttempts.find((attempt) => attempt.id === selectedReferenceStudyAttemptId)
        : referenceStudyAttempts[0]
    ),
    [referenceStudyAttempts, selectedReferenceStudyAttemptId]
  );
  const suggestedReferenceStudyAttempt = useMemo(() => {
    if (referenceStudyAttempts.length === 0) {
      return undefined;
    }

    return referenceStudyAttempts.reduce((bestAttempt, attempt) => {
      if (!bestAttempt) {
        return attempt;
      }
      const bestScore = getReferenceStudyAttemptFocusScore(bestAttempt.metrics, referenceStudyFocusMode);
      const attemptScore = getReferenceStudyAttemptFocusScore(attempt.metrics, referenceStudyFocusMode);
      return attemptScore > bestScore ? attempt : bestAttempt;
    }, referenceStudyAttempts[0]);
  }, [referenceStudyAttempts, referenceStudyFocusMode]);
  const referenceStudyBestAttemptsByFocus = useMemo(
    () => REFERENCE_STUDY_FOCUS_MODES.map((mode) => {
      if (referenceStudyAttempts.length === 0) {
        return { mode, attempt: undefined as ReferenceStudyAttemptRecord | undefined };
      }

      const attempt = referenceStudyAttempts.reduce((bestAttempt, candidate) => {
        if (!bestAttempt) {
          return candidate;
        }
        const bestScore = getReferenceStudyAttemptFocusScore(bestAttempt.metrics, mode);
        const candidateScore = getReferenceStudyAttemptFocusScore(candidate.metrics, mode);
        return candidateScore > bestScore ? candidate : bestAttempt;
      }, referenceStudyAttempts[0]);

      return { mode, attempt };
    }),
    [referenceStudyAttempts]
  );
  const referenceStudyBestModesByAttemptId = useMemo(() => {
    const bestModes = new Map<string, ReferenceStudyFocusMode[]>();
    referenceStudyBestAttemptsByFocus.forEach(({ mode, attempt }) => {
      if (!attempt) {
        return;
      }
      const existingModes = bestModes.get(attempt.id) ?? [];
      existingModes.push(mode);
      bestModes.set(attempt.id, existingModes);
    });
    return bestModes;
  }, [referenceStudyBestAttemptsByFocus]);
  const referenceStudyFocusRanksByAttemptId = useMemo(() => {
    const ranks = new Map<string, Record<ReferenceStudyFocusMode, number>>();

    REFERENCE_STUDY_FOCUS_MODES.forEach((mode) => {
      const rankedAttempts = [...referenceStudyAttempts].sort((left, right) => {
        const rightScore = getReferenceStudyAttemptFocusScore(right.metrics, mode);
        const leftScore = getReferenceStudyAttemptFocusScore(left.metrics, mode);
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        return left.createdAt.localeCompare(right.createdAt);
      });

      rankedAttempts.forEach((attempt, index) => {
        const currentRanks = ranks.get(attempt.id) ?? {
          composition: 0,
          placement: 0,
          economy: 0,
        };
        currentRanks[mode] = index + 1;
        ranks.set(attempt.id, currentRanks);
      });
    });

    return ranks;
  }, [referenceStudyAttempts]);
  const referenceStudyRankedAttemptsByFocus = useMemo(
    () => REFERENCE_STUDY_FOCUS_MODES.map((mode) => ({
      mode,
      attempts: [...referenceStudyAttempts].sort((left, right) => {
        const rightScore = getReferenceStudyAttemptFocusScore(right.metrics, mode);
        const leftScore = getReferenceStudyAttemptFocusScore(left.metrics, mode);
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        return left.createdAt.localeCompare(right.createdAt);
      }),
    })),
    [referenceStudyAttempts]
  );
  const referenceStudySuggestedPickSummary = useMemo(() => {
    if (!suggestedReferenceStudyAttempt) {
      return null;
    }
    return buildReferenceStudyPickSummary(
      suggestedReferenceStudyAttempt,
      referenceStudyFocusMode,
      referenceStudyBestModesByAttemptId.get(suggestedReferenceStudyAttempt.id) ?? [referenceStudyFocusMode],
    );
  }, [referenceStudyBestModesByAttemptId, referenceStudyFocusMode, suggestedReferenceStudyAttempt]);
  const referenceStudySessionLead = useMemo(() => {
    if (referenceStudyAttempts.length === 0) {
      return null;
    }

    const leadAttempt = referenceStudyAttempts.reduce((bestAttempt, attempt) => {
      if (!bestAttempt) {
        return attempt;
      }
      const bestWins = referenceStudyBestModesByAttemptId.get(bestAttempt.id)?.length ?? 0;
      const attemptWins = referenceStudyBestModesByAttemptId.get(attempt.id)?.length ?? 0;
      if (attemptWins !== bestWins) {
        return attemptWins > bestWins ? attempt : bestAttempt;
      }
      const bestScore = getReferenceStudyAttemptFocusScore(bestAttempt.metrics, referenceStudyFocusMode);
      const attemptScore = getReferenceStudyAttemptFocusScore(attempt.metrics, referenceStudyFocusMode);
      return attemptScore > bestScore ? attempt : bestAttempt;
    }, referenceStudyAttempts[0]);

    const leadModes = referenceStudyBestModesByAttemptId.get(leadAttempt.id) ?? [];
    const trailingModes = REFERENCE_STUDY_FOCUS_MODES.filter((mode) => !leadModes.includes(mode));

    return {
      attempt: leadAttempt,
      leadModes,
      trailingModes,
      winCount: leadModes.length,
      totalModes: REFERENCE_STUDY_FOCUS_MODES.length,
      summary: buildReferenceStudySessionSummary(leadAttempt, leadModes, trailingModes),
    };
  }, [referenceStudyAttempts, referenceStudyBestModesByAttemptId, referenceStudyFocusMode]);
  const referenceStudyPreviewWidth = referenceStudyReferenceRecord?.width
    || activeReferenceRecord?.width
    || 1920;
  const referenceStudyPreviewHeight = referenceStudyReferenceRecord?.height
    || activeReferenceRecord?.height
    || 1080;
  const referenceStudyGhostRecord = useMemo<StoryboardDocumentReferenceImage | undefined>(() => {
    if (!referenceStudyActive || referenceStudyReveal || !referenceStudyGhostEnabled || !selectedReferenceStudyAttempt) {
      return undefined;
    }
    return {
      id: `ghost-${selectedReferenceStudyAttempt.id}`,
      name: selectedReferenceStudyAttempt.name,
      src: selectedReferenceStudyAttempt.previewDataUrl,
      opacity: referenceStudyGhostOpacity,
      visible: true,
      x: 0,
      y: 0,
      width: referenceStudyPreviewWidth,
      height: referenceStudyPreviewHeight,
      rotation: 0,
      fitMode: 'free',
      createdAt: selectedReferenceStudyAttempt.createdAt,
      updatedAt: selectedReferenceStudyAttempt.createdAt,
    };
  }, [
    referenceStudyPreviewHeight,
    referenceStudyPreviewWidth,
    referenceStudyActive,
    referenceStudyGhostEnabled,
    referenceStudyGhostOpacity,
    referenceStudyReveal,
    selectedReferenceStudyAttempt,
  ]);
  const referenceStudyStrokeDelta = referenceStudyActive && referenceStudyBaselineStrokeCount !== null
    ? Math.max(0, strokes.length - referenceStudyBaselineStrokeCount)
    : 0;
  const activeBaseImage = drawingDocument.metadata.baseImageUrl || initialImage || '';
  const originalBaseImage = drawingDocument.metadata.originalBaseImageUrl
    || initialDrawingData?.originalBaseImageUrl
    || initialImage
    || '';
  const hasBaseImageOverride = Boolean(activeBaseImage !== originalBaseImage);
  const onionSkinFrames = Math.max(
    drawingDocument.timeline.onionSkinFramesBefore,
    drawingDocument.timeline.onionSkinFramesAfter
  );
  const selectedMarkerIds = drawingDocument.timeline.selectedMarkerIds;
  const activeMarkers = useMemo(
    () => drawingDocument.markers.filter((marker) => marker.frame === activeTimelineFrameIndex),
    [activeTimelineFrameIndex, drawingDocument.markers]
  );
  const markerStrip = useMemo(
    () => drawingDocument.markers.slice(0, 6),
    [drawingDocument.markers]
  );
  const transportLabel = transportPlaying ? 'Pause' : 'Play';
  const timecode = formatTimelineTimecode(activeTimelineFrameIndex, drawingDocument.timeline.fps, hasUnsavedChanges);
  const aspectChromeLabel = aspectRatio === '2.35:1' ? '2.39:1' : aspectRatio;
  const timeLapseStats = useMemo(() => deriveTimeLapseStats(strokes), [strokes]);
  const timeLapseProgressRatio = timeLapseStats.replayDurationMs > 0
    ? Math.min(1, timeLapseProgressMs / timeLapseStats.replayDurationMs)
    : 0;
  const timeLapseReplayLabel = timeLapseStats.available
    ? `${formatClockDuration(timeLapseProgressMs)} / ${formatClockDuration(timeLapseStats.replayDurationMs)}`
    : 'Arm replay on first stroke';
  const timeLapseSummaryText = timeLapseStats.available
    ? `${timeLapseStats.strokeCount} strokes · ${timeLapseStats.pointCount} points · captured ${formatDurationCompact(timeLapseStats.captureDurationMs)}`
    : 'Capture starts on first stroke. Replay, 4K export, and the 30-second social cut unlock automatically.';
  const animaticSequence = useMemo(() => flythroughSequence.map((entry, index) => {
    const visibleCanvases = entry.bookmark.visibleCanvasIds
      .map((canvasId) => spatialCanvases.find((canvas) => canvas.id === canvasId))
      .filter((canvas): canvas is StoryboardDocumentSpatialCanvas => Boolean(canvas));

    return {
      id: entry.bookmark.id,
      cueNumber: index + 1,
      name: entry.bookmark.name,
      startMs: entry.startMs,
      endMs: entry.endMs,
      durationMs: entry.endMs - entry.startMs,
      transition: entry.bookmark.transition,
      visibleCanvases: visibleCanvases.map((canvas) => ({
        id: canvas.id,
        name: canvas.name,
        width: canvas.width,
        height: canvas.height,
      })),
      camera: entry.bookmark.camera,
    };
  }), [flythroughSequence, spatialCanvases]);
  const animaticVisibleCanvasCount = useMemo(
    () => new Set(animaticSequence.flatMap((cue) => cue.visibleCanvases.map((canvas) => canvas.id))).size,
    [animaticSequence]
  );
  const animaticTransitionMix = useMemo(
    () => Array.from(new Set(animaticSequence.map((cue) => cue.transition.toUpperCase()))).join(' · ') || 'CUT',
    [animaticSequence]
  );
  const selectedAnimationUsesAnimatic = selectedAnimationOutput === 'Animatics';
  const animationAssistHeadline = selectedAnimationUsesAnimatic && animaticSequence.length > 0
    ? `Flythrough-driven animatic with ${animaticSequence.length} cues, ${formatClockDuration(activeFlythroughDurationMs)} runtime, and ${animaticVisibleCanvasCount} staged canvases.`
    : 'Frame-by-frame passes with onion skinning and full-res export.';
  const animationTimingChips = selectedAnimationUsesAnimatic && animaticSequence.length > 0
    ? [
        `${drawingDocument.timeline.fps} fps`,
        `Run ${formatClockDuration(activeFlythroughDurationMs)}`,
        `${animaticSequence.length} cues`,
        animaticTransitionMix,
      ]
    : [
        `${drawingDocument.timeline.fps} fps`,
        `Hold ${String(activeSheetExposure).padStart(2, '0')}fr`,
        activeSheet?.linkedSourceSheetId ? 'Linked Sheet' : transportPlaying ? 'Loop Live' : 'Loop Armed',
      ];
  const exposureStripFrames = useMemo(() => {
    const paddedFrames = timelineFrames.length >= TIMELINE_PREVIEW_FRAME_COUNT
      ? timelineFrames
      : [
          ...timelineFrames,
          ...Array.from({ length: TIMELINE_PREVIEW_FRAME_COUNT - timelineFrames.length }, (_, index) => ({
            timelineIndex: timelineFrames.length + index,
            frameNumber: timelineFrames.length + index,
            sheetId: `placeholder-${index}`,
            sheetName: 'Hold',
            exposureIndex: 0,
            exposureLength: 1,
            markerIds: [],
          } satisfies StoryboardDocumentTimelineFrame)),
        ];
    return paddedFrames.slice(0, Math.max(TIMELINE_PREVIEW_FRAME_COUNT, timelineFrames.length));
  }, [timelineFrames]);
  const filmstripWindow = useMemo(() => {
    if (!timelineFrames.length) return [] as StoryboardDocumentTimelineFrame[];
    const windowSize = Math.min(4, timelineFrames.length);
    const start = Math.max(0, Math.min(
      timelineFrames.length - windowSize,
      activeTimelineFrameIndex - Math.floor(windowSize / 2)
    ));
    return timelineFrames.slice(start, start + windowSize);
  }, [activeTimelineFrameIndex, timelineFrames]);

  // Calculate canvas dimensions based on container and aspect ratio
  const canvasDimensions = useMemo(() => {
    const measuredWidth = editorContainerSize.width || editorWidth;
    const measuredHeight = editorContainerSize.height || editorHeight;
    const chromeHeight = (isCompactUi ? 210 : 144)
      + (isCompactUi ? 68 : 0)
      + (device.isIPad && device.hasPencilSupport ? 42 : 0);
    const availableWidth = Math.max(320, measuredWidth - (isCompactUi ? 12 : 20));
    const availableHeight = Math.max(220, measuredHeight - chromeHeight);
    return getCanvasDimensions(aspectRatio, availableWidth, availableHeight);
  }, [
    aspectRatio,
    editorContainerSize.width,
    editorContainerSize.height,
    editorWidth,
    editorHeight,
    isCompactUi,
    showEmbeddedCanvasToolbar,
    device.isIPad,
    device.hasPencilSupport,
  ]);
  const exportCanvasWidth = activeSpatialCanvas?.width || canvasDimensions.width;
  const exportCanvasHeight = activeSpatialCanvas?.height || canvasDimensions.height;
  const currentReferenceStudyAttemptMetrics = useMemo(
    () => deriveReferenceStudyAttemptMetrics(referenceStudyAttemptStrokes, canvasDimensions.width, canvasDimensions.height),
    [canvasDimensions.height, canvasDimensions.width, referenceStudyAttemptStrokes]
  );
  const referenceStudyScorecardSummary = useMemo(() => {
    if (!referenceStudyActive || !selectedReferenceStudyAttempt) {
      return referenceStudyActive
        ? 'Save a round to compare composition decisions across attempts.'
        : 'Start a study session to unlock round-by-round compare metrics.';
    }
    if (currentReferenceStudyAttemptMetrics.pointCount === 0) {
      return `Draw a new round to compare against ${selectedReferenceStudyAttempt.name}.`;
    }
    return buildReferenceStudyCoachSummary(
      currentReferenceStudyAttemptMetrics,
      selectedReferenceStudyAttempt.metrics,
      selectedReferenceStudyAttempt.name,
      referenceStudyFocusMode,
    );
  }, [
    currentReferenceStudyAttemptMetrics,
    referenceStudyFocusMode,
    referenceStudyActive,
    selectedReferenceStudyAttempt,
  ]);
  const currentReferenceStudyReadLabels = useMemo(
    () => deriveReferenceStudyReadLabels(currentReferenceStudyAttemptMetrics),
    [currentReferenceStudyAttemptMetrics]
  );
  const referenceStudyFocusRead = useMemo(
    () => currentReferenceStudyReadLabels.focusRead,
    [currentReferenceStudyReadLabels]
  );
  const referenceStudyBalanceRead = useMemo(
    () => currentReferenceStudyReadLabels.balanceRead,
    [currentReferenceStudyReadLabels]
  );
  const referenceStudySilhouetteRead = useMemo(
    () => currentReferenceStudyReadLabels.silhouetteRead,
    [currentReferenceStudyReadLabels]
  );
  const referenceStudyReadCheckSummary = useMemo(() => {
    if (!referenceStudyActive || currentReferenceStudyAttemptMetrics.pointCount === 0) {
      return 'Draw a round to inspect silhouette readability and focus placement.';
    }
    const focusLabel = referenceStudyFocusRead === 'centered' ? 'Focus stays centered' : `Focus drifts ${referenceStudyFocusRead}`;
    const silhouetteLabel = referenceStudySilhouetteRead === 'open'
      ? 'Silhouette reads open'
      : referenceStudySilhouetteRead === 'dense'
        ? 'Silhouette reads dense'
        : 'Silhouette reads thin';
    const balanceLabel = referenceStudyBalanceRead === 'balanced'
      ? 'weight stays balanced'
      : `weight is ${referenceStudyBalanceRead}`;
    return `${silhouetteLabel}. ${focusLabel}. ${balanceLabel}.`;
  }, [
    currentReferenceStudyAttemptMetrics.pointCount,
    referenceStudyActive,
    referenceStudyBalanceRead,
    referenceStudyFocusRead,
    referenceStudySilhouetteRead,
  ]);
  const referenceStudyRecommendedDrillId = useMemo(
    () => getRecommendedReferenceStudyDrill(currentReferenceStudyAttemptMetrics, selectedReferenceStudyAttempt?.metrics),
    [currentReferenceStudyAttemptMetrics, selectedReferenceStudyAttempt?.metrics]
  );
  const referenceStudyActiveDrillId = referenceStudyArmedDrillId || referenceStudyRecommendedDrillId;
  const referenceStudyDrillSummary = useMemo(() => {
    if (!referenceStudyActive || !selectedReferenceStudyAttempt) {
      return referenceStudyActive
        ? 'Save a baseline round to arm a specific next-drill target.'
        : 'Start a study session to unlock drill targets.';
    }
    return buildReferenceStudyDrillSummary(
      referenceStudyActiveDrillId,
      currentReferenceStudyAttemptMetrics,
      selectedReferenceStudyAttempt.metrics,
      selectedReferenceStudyAttempt.name,
    );
  }, [
    currentReferenceStudyAttemptMetrics,
    referenceStudyActive,
    referenceStudyActiveDrillId,
    selectedReferenceStudyAttempt,
  ]);
  const referenceStudyDrillProgressValue = useMemo(() => {
    if (!referenceStudyActive || !selectedReferenceStudyAttempt || currentReferenceStudyAttemptMetrics.pointCount === 0) {
      return 0;
    }
    return getReferenceStudyDrillProgressValue(
      referenceStudyActiveDrillId,
      currentReferenceStudyAttemptMetrics,
      selectedReferenceStudyAttempt.metrics,
    );
  }, [
    currentReferenceStudyAttemptMetrics,
    referenceStudyActive,
    referenceStudyActiveDrillId,
    selectedReferenceStudyAttempt,
  ]);
  const referenceStudyDrillDirectionLabel = useMemo(() => {
    if (!referenceStudyActive || !selectedReferenceStudyAttempt || currentReferenceStudyAttemptMetrics.pointCount === 0) {
      return selectedReferenceStudyAttempt?.drillId && selectedReferenceStudyAttempt.drillStatus && selectedReferenceStudyAttempt.drillBaselineName
        ? `${selectedReferenceStudyAttempt.drillStatus === 'met' ? 'Closed cleanly' : 'Needs another pass'} vs ${selectedReferenceStudyAttempt.drillBaselineName}`
        : 'Awaiting live round';
    }
    return getReferenceStudyDrillDirectionLabel(
      referenceStudyActiveDrillId,
      currentReferenceStudyAttemptMetrics,
      selectedReferenceStudyAttempt.metrics,
    );
  }, [
    currentReferenceStudyAttemptMetrics,
    referenceStudyActive,
    referenceStudyActiveDrillId,
    selectedReferenceStudyAttempt,
  ]);
  const referenceStudyDrillTrajectorySummary = useMemo(() => {
    if (!referenceStudyActive || !selectedReferenceStudyAttempt) {
      return referenceStudyActive
        ? 'Save a baseline round to unlock live drill trajectory.'
        : 'Start a study session to track live drill progress.';
    }
    if (currentReferenceStudyAttemptMetrics.pointCount === 0) {
      if (selectedReferenceStudyAttempt.drillId && selectedReferenceStudyAttempt.drillStatus && selectedReferenceStudyAttempt.drillBaselineName) {
        return `${selectedReferenceStudyAttempt.name} closed as ${getReferenceStudyDrillLabel(selectedReferenceStudyAttempt.drillId)} · ${selectedReferenceStudyAttempt.drillStatus === 'met' ? 'Met' : 'Retry'} against ${selectedReferenceStudyAttempt.drillBaselineName}. Start a new round to beat it.`;
      }
      return `Start a new round to track live progress toward ${getReferenceStudyDrillLabel(referenceStudyActiveDrillId)} against ${selectedReferenceStudyAttempt.name}.`;
    }
    return buildReferenceStudyDrillTrajectorySummary(
      referenceStudyActiveDrillId,
      currentReferenceStudyAttemptMetrics,
      selectedReferenceStudyAttempt.metrics,
      selectedReferenceStudyAttempt.name,
    );
  }, [
    currentReferenceStudyAttemptMetrics,
    referenceStudyActive,
    referenceStudyActiveDrillId,
    selectedReferenceStudyAttempt,
  ]);
  const referenceStudyDrillCheckpoints = useMemo(() => {
    if (!referenceStudyActive || !selectedReferenceStudyAttempt) {
      return {
        current: 'Current 0%',
        goal: 'Goal 0%',
        remaining: 'Remain 0%',
      };
    }

    const metricsForCheckpoints = currentReferenceStudyAttemptMetrics.pointCount > 0
      ? currentReferenceStudyAttemptMetrics
      : selectedReferenceStudyAttempt.metrics;

    return buildReferenceStudyDrillCheckpoints(
      referenceStudyActiveDrillId,
      metricsForCheckpoints,
      selectedReferenceStudyAttempt.metrics,
    );
  }, [
    currentReferenceStudyAttemptMetrics,
    referenceStudyActive,
    referenceStudyActiveDrillId,
    selectedReferenceStudyAttempt,
  ]);
  const referenceStudyDrillPlaybook = useMemo(() => buildReferenceStudyDrillPlaybook(
    referenceStudyActiveDrillId,
    referenceStudyFocusMode,
    currentReferenceStudyAttemptMetrics.pointCount > 0
      ? referenceStudyFocusRead
      : selectedReferenceStudyAttempt?.focusRead || referenceStudyFocusRead,
    currentReferenceStudyAttemptMetrics.pointCount > 0
      ? referenceStudyBalanceRead
      : selectedReferenceStudyAttempt?.balanceRead || referenceStudyBalanceRead,
    currentReferenceStudyAttemptMetrics.pointCount > 0
      ? referenceStudySilhouetteRead
      : selectedReferenceStudyAttempt?.silhouetteRead || referenceStudySilhouetteRead,
    currentReferenceStudyAttemptMetrics.pointCount > 0,
  ), [
    currentReferenceStudyAttemptMetrics.pointCount,
    referenceStudyActiveDrillId,
    referenceStudyBalanceRead,
    referenceStudyFocusMode,
    referenceStudyFocusRead,
    referenceStudySilhouetteRead,
    selectedReferenceStudyAttempt,
  ]);
  const animationExportSummary = selectedAnimationUsesAnimatic && animaticSequence.length > 0
    ? `${exportCanvasWidth} × ${exportCanvasHeight}px animatic master`
    : `${exportCanvasWidth} × ${exportCanvasHeight}px full-res`;
  const animationExportButtonLabel = selectedAnimationUsesAnimatic ? 'Export Animatic JSON' : 'Export Full-Res';
  const animationExportEnabled = selectedAnimationUsesAnimatic && animaticSequence.length > 0;
  const precisionCanvasSummary = `${exportCanvasWidth} × ${exportCanvasHeight}px`;
  const selectedShapeScaffoldSuggestion = useMemo(
    () => getShapeIntentSuggestionDefinitionById(selectedShapeScaffoldRenderRecord?.suggestionId),
    [selectedShapeScaffoldRenderRecord?.suggestionId]
  );
  const selectedShapeScaffoldAnalysis = useMemo(
    () => (
      selectedShapeScaffoldRenderRecord
        ? createShapeIntentAnalysisFromScaffold(
            createShapeIntentScaffoldDefinition(selectedShapeScaffoldRenderRecord),
            { width: exportCanvasWidth, height: exportCanvasHeight },
          )
        : null
    ),
    [exportCanvasHeight, exportCanvasWidth, selectedShapeScaffoldRenderRecord]
  );
  const selectedShapeScaffoldGuideStrokes = useMemo(
    () => (
      selectedShapeScaffoldRenderRecord && selectedShapeScaffoldAnalysis
        ? buildShapeIntentModeGuideStrokes(
            selectedShapeScaffoldAnalysis,
            buildShapeIntentGuideStrokesFromScaffold(
              createShapeIntentScaffoldDefinition(selectedShapeScaffoldRenderRecord),
              { width: exportCanvasWidth, height: exportCanvasHeight },
            ),
            selectedShapeScaffoldRenderRecord.applyMode as ShapeIntentApplyMode,
          )
        : []
    ),
    [exportCanvasHeight, exportCanvasWidth, selectedShapeScaffoldAnalysis, selectedShapeScaffoldRenderRecord]
  );
  const selectedShapeScaffoldPreviewDataUrl = useMemo(
    () => (
      selectedShapeScaffoldRenderRecord
      && selectedShapeScaffoldAnalysis
      && selectedShapeScaffoldSuggestion
        ? buildShapeIntentReferenceDataUrl(
            selectedShapeScaffoldAnalysis,
            selectedShapeScaffoldSuggestion,
            selectedShapeScaffoldRenderRecord.selections,
            { width: exportCanvasWidth, height: exportCanvasHeight },
            selectedShapeScaffoldGuideStrokes,
            `${summarizeShapeIntentSelections(selectedShapeScaffoldSuggestion, selectedShapeScaffoldRenderRecord.selections)} · Mode: ${selectedShapeScaffoldRenderRecord.applyMode.toUpperCase()}`,
          )
        : ''
    ),
    [
      exportCanvasHeight,
      exportCanvasWidth,
      selectedShapeScaffoldAnalysis,
      selectedShapeScaffoldGuideStrokes,
      selectedShapeScaffoldRenderRecord,
      selectedShapeScaffoldSuggestion,
    ]
  );
  const selectedShapeScaffoldQuickSwapSuggestions = useMemo(
    () => (
      (selectedShapeScaffoldAnalysis?.suggestions || [])
        .filter((suggestion) => suggestion.id !== selectedShapeScaffoldRenderRecord?.suggestionId)
    ),
    [selectedShapeScaffoldAnalysis?.suggestions, selectedShapeScaffoldRenderRecord?.suggestionId]
  );
  const selectedShapeScaffoldSuggestionCycle = useMemo(
    () => selectedShapeScaffoldAnalysis?.suggestions || [],
    [selectedShapeScaffoldAnalysis?.suggestions]
  );
  const selectedShapeScaffoldLibraryPresetEntries = useMemo(
    () => {
      if (!selectedShapeScaffold) {
        return [];
      }
      const compatibleSuggestionIds = new Set(selectedShapeScaffoldSuggestionCycle.map((suggestion) => suggestion.id));
      return [...shapeScaffoldLibraryEntries]
        .filter((entry) => (
          compatibleSuggestionIds.size > 0
            ? compatibleSuggestionIds.has(entry.suggestionId)
            : entry.primitive === selectedShapeScaffold.primitive
        ))
        .sort(compareShapeScaffoldLibraryEntries)
        .slice(0, 4);
    },
    [
      selectedShapeScaffold,
      selectedShapeScaffoldSuggestionCycle,
      shapeScaffoldLibraryEntries,
    ]
  );
  const selectedShapeScaffoldCompatibleLibraryPresetEntryIds = useMemo(
    () => new Set(selectedShapeScaffoldLibraryPresetEntries.map((entry) => entry.id)),
    [selectedShapeScaffoldLibraryPresetEntries]
  );
  const selectedShapeScaffoldSingleParameters = useMemo(
    () => selectedShapeScaffoldSuggestion?.parameters.filter((parameter) => parameter.selection === 'single').slice(0, 2) || [],
    [selectedShapeScaffoldSuggestion]
  );
  const shapeScaffoldLibraryPreviewMap = useMemo(
    () => shapeScaffoldLibraryEntries.reduce<Record<string, string>>((result, entry) => {
      const analysis = createShapeIntentAnalysisFromScaffold(
        createShapeIntentScaffoldDefinition(entry),
        { width: exportCanvasWidth, height: exportCanvasHeight },
      );
      const suggestion = getShapeIntentSuggestionDefinitionById(entry.suggestionId);
      if (!analysis || !suggestion) {
        return result;
      }
      const guideStrokes = buildShapeIntentModeGuideStrokes(
        analysis,
        buildShapeIntentGuideStrokesFromScaffold(
          createShapeIntentScaffoldDefinition(entry),
          { width: exportCanvasWidth, height: exportCanvasHeight },
        ),
        entry.applyMode as ShapeIntentApplyMode,
      );
      result[entry.id] = buildShapeIntentReferenceDataUrl(
        analysis,
        suggestion,
        entry.selections,
        { width: exportCanvasWidth, height: exportCanvasHeight },
        guideStrokes,
        `${summarizeShapeIntentSelections(suggestion, entry.selections)} · Mode: ${entry.applyMode.toUpperCase()}`,
      );
      return result;
    }, {}),
    [exportCanvasHeight, exportCanvasWidth, shapeScaffoldLibraryEntries]
  );
  const selectedShapeScaffoldOverlayRecord = useMemo<StoryboardDocumentReferenceImage | undefined>(() => {
    if (!selectedShapeScaffoldRenderRecord || !selectedShapeScaffoldRenderRecord.visible || !selectedShapeScaffoldAnalysis) {
      return undefined;
    }

    const overlayDataUrl = buildShapeIntentOverlayDataUrl(
      selectedShapeScaffoldGuideStrokes,
      { width: exportCanvasWidth, height: exportCanvasHeight },
    );

    return {
      id: `shape-scaffold-overlay-${selectedShapeScaffoldRenderRecord.id}`,
      name: selectedShapeScaffoldRenderRecord.name,
      src: overlayDataUrl,
      opacity: selectedShapeScaffoldRenderRecord.opacity,
      visible: true,
      x: 0,
      y: 0,
      width: canvasDimensions.width,
      height: canvasDimensions.height,
      rotation: 0,
      fitMode: 'free',
      createdAt: selectedShapeScaffoldRenderRecord.createdAt,
      updatedAt: selectedShapeScaffoldRenderRecord.updatedAt,
    };
  }, [
    canvasDimensions.height,
    canvasDimensions.width,
    exportCanvasHeight,
    exportCanvasWidth,
    selectedShapeScaffoldAnalysis,
    selectedShapeScaffoldGuideStrokes,
    selectedShapeScaffoldRenderRecord,
  ]);
  const canvasReferenceRecord = useMemo(
    () => (
      referenceStudyActive
        ? (
          referenceStudyReveal && referenceStudyReferenceRecord
            ? {
                ...referenceStudyReferenceRecord,
                opacity: referenceStudyCompareOpacity,
              }
            : referenceStudyGhostRecord
        )
        : activeReferenceRecord
    ),
    [
      activeReferenceRecord,
      referenceStudyActive,
      referenceStudyCompareOpacity,
      referenceStudyGhostRecord,
      referenceStudyReferenceRecord,
      referenceStudyReveal,
    ]
  );
  const activeReferenceImage = useMemo(
    () => toCanvasReferenceImage(canvasReferenceRecord),
    [canvasReferenceRecord]
  );
  const selectedShapeScaffoldScalePercent = selectedShapeScaffoldRenderRecord
    ? Math.round((selectedShapeScaffoldRenderRecord.frame.widthRatio / Math.max(selectedShapeScaffoldRenderRecord.frame.baseWidthRatio, 0.02)) * 100)
    : 100;
  const selectedShapeScaffoldFrameLabel = selectedShapeScaffoldRenderRecord
    ? `X ${Math.round(selectedShapeScaffoldRenderRecord.frame.xRatio * 100)} · Y ${Math.round(selectedShapeScaffoldRenderRecord.frame.yRatio * 100)} · W ${Math.round(selectedShapeScaffoldRenderRecord.frame.widthRatio * 100)} · H ${Math.round(selectedShapeScaffoldRenderRecord.frame.heightRatio * 100)}`
    : '';
  const applyShapeScaffoldOverlayPreviewFrame = useCallback((frame: StoryboardDocumentShapeScaffoldFrame) => {
    const overlayElement = shapeScaffoldOverlayBoxRef.current;
    if (!overlayElement) {
      return;
    }
    overlayElement.dataset.xRatio = frame.xRatio.toFixed(4);
    overlayElement.dataset.yRatio = frame.yRatio.toFixed(4);
    overlayElement.dataset.widthRatio = frame.widthRatio.toFixed(4);
    overlayElement.dataset.heightRatio = frame.heightRatio.toFixed(4);
    overlayElement.style.left = `${frame.xRatio * 100}%`;
    overlayElement.style.top = `${frame.yRatio * 100}%`;
    overlayElement.style.width = `${frame.widthRatio * 100}%`;
    overlayElement.style.height = `${frame.heightRatio * 100}%`;
  }, []);
  const guideProfileLabel = selectedGuideMode === 'Perspective'
    ? '2-point'
    : selectedGuideMode === 'Isometric'
      ? '30° iso'
      : selectedGuideMode === 'Symmetry'
        ? 'Mirror axis'
        : '2D draft';
  const shapeIntentRankingContext = useMemo(() => ({
    workflowLevel,
    pinnedSuggestionIds: Array.from(new Set(
      [...shapeScaffoldLibraryEntries]
        .filter((entry) => entry.pinned)
        .sort(compareShapeScaffoldLibraryEntries)
        .map((entry) => entry.suggestionId),
    )),
    preferredSuggestionIds: Array.from(new Set(
      [...shapeScaffoldLibraryEntries]
        .sort(compareShapeScaffoldLibraryEntries)
        .map((entry) => entry.suggestionId),
    )),
    recentSuggestionIds: Array.from(new Set(
      [...shapeScaffolds]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((entry) => entry.suggestionId),
    )),
  }), [shapeScaffoldLibraryEntries, shapeScaffolds, workflowLevel]);
  const shapeIntentAnalysis = useMemo(
    () => analyzeShapeIntent(strokes, {
      width: exportCanvasWidth,
      height: exportCanvasHeight,
    }, shapeIntentRankingContext),
    [exportCanvasHeight, exportCanvasWidth, shapeIntentRankingContext, strokes]
  );
  const shapeIntentVisible = Boolean(shapeIntentAnalysis && strokes.length !== shapeIntentSuppressedStrokeCount);
  const rotatedShapeIntentSuggestions = useMemo<ShapeIntentSuggestion[]>(() => {
    if (!shapeIntentAnalysis || shapeIntentAnalysis.suggestions.length === 0) {
      return [];
    }
    const offset = ((shapeIntentShuffleOffset % shapeIntentAnalysis.suggestions.length) + shapeIntentAnalysis.suggestions.length)
      % shapeIntentAnalysis.suggestions.length;
    return [
      ...shapeIntentAnalysis.suggestions.slice(offset),
      ...shapeIntentAnalysis.suggestions.slice(0, offset),
    ];
  }, [shapeIntentAnalysis, shapeIntentShuffleOffset]);
  const visibleShapeIntentSuggestions = useMemo(
    () => rotatedShapeIntentSuggestions.slice(0, Math.min(5, rotatedShapeIntentSuggestions.length)),
    [rotatedShapeIntentSuggestions]
  );
  const selectedShapeIntentSuggestion = useMemo(
    () => getShapeIntentSuggestionById(shapeIntentAnalysis, shapeIntentSelectedSuggestionId)
      || visibleShapeIntentSuggestions[0]
      || null,
    [shapeIntentAnalysis, shapeIntentSelectedSuggestionId, visibleShapeIntentSuggestions]
  );
  const activeShapeIntentSelections = useMemo(
    () => (
      shapeIntentPendingSelections && selectedShapeIntentSuggestion?.id === shapeIntentPendingSelections.suggestionId
        ? shapeIntentPendingSelections.selections
        : shapeIntentSelections
    ),
    [selectedShapeIntentSuggestion?.id, shapeIntentPendingSelections, shapeIntentSelections]
  );
  const shapeIntentParameterSummary = useMemo(
    () => (selectedShapeIntentSuggestion ? summarizeShapeIntentSelections(selectedShapeIntentSuggestion, activeShapeIntentSelections) : ''),
    [activeShapeIntentSelections, selectedShapeIntentSuggestion]
  );
  const shapeIntentContextSignals = useMemo<ShapeIntentContextSignal[]>(
    () => getShapeIntentSuggestionContextSignals(selectedShapeIntentSuggestion, shapeIntentRankingContext),
    [selectedShapeIntentSuggestion, shapeIntentRankingContext]
  );
  const shapeIntentLibraryPresetEntries = useMemo(
    () => {
      if (!shapeIntentAnalysis) {
        return [];
      }
      const suggestionIds = new Set(shapeIntentAnalysis.suggestions.map((suggestion) => suggestion.id));
      return [...shapeScaffoldLibraryEntries]
        .filter((entry) => suggestionIds.has(entry.suggestionId))
        .sort(compareShapeScaffoldLibraryEntries)
        .slice(0, 4);
    },
    [shapeIntentAnalysis, shapeScaffoldLibraryEntries]
  );
  const shapeIntentPreviewStrokes = useMemo(
    () => (
      shapeIntentAnalysis && selectedShapeIntentSuggestion
        ? buildShapeIntentModeGuideStrokes(
            shapeIntentAnalysis,
            buildShapeIntentGuideStrokes(
              shapeIntentAnalysis,
              selectedShapeIntentSuggestion,
              activeShapeIntentSelections,
            ),
            shapeIntentApplyMode,
          )
        : []
    ),
    [
      selectedShapeIntentSuggestion,
      shapeIntentAnalysis,
      shapeIntentApplyMode,
      activeShapeIntentSelections,
    ]
  );
  const shapeIntentPreviewDataUrl = useMemo(
    () => (
      shapeIntentAnalysis && selectedShapeIntentSuggestion
        ? buildShapeIntentReferenceDataUrl(
            shapeIntentAnalysis,
            selectedShapeIntentSuggestion,
            activeShapeIntentSelections,
            { width: exportCanvasWidth, height: exportCanvasHeight },
            shapeIntentPreviewStrokes,
            `${shapeIntentParameterSummary} · Mode: ${shapeIntentApplyMode.toUpperCase()}`,
          )
        : ''
    ),
    [
      exportCanvasHeight,
      exportCanvasWidth,
      shapeIntentApplyMode,
      shapeIntentParameterSummary,
      selectedShapeIntentSuggestion,
      shapeIntentAnalysis,
      shapeIntentPreviewStrokes,
      activeShapeIntentSelections,
    ]
  );
  const shapeIntentVariantCards = useMemo(() => {
    if (!shapeIntentAnalysis) {
      return [];
    }
    return visibleShapeIntentSuggestions.slice(0, 3).map((suggestion) => {
      const selections = suggestion.id === selectedShapeIntentSuggestion?.id
        ? activeShapeIntentSelections
        : getShapeIntentDefaultSelections(suggestion);
      const previewStrokes = buildShapeIntentModeGuideStrokes(
        shapeIntentAnalysis,
        buildShapeIntentGuideStrokes(shapeIntentAnalysis, suggestion, selections),
        shapeIntentApplyMode,
      );
      return {
        suggestion,
        selections,
        guideStrokes: previewStrokes,
        summary: summarizeShapeIntentSelections(suggestion, selections),
        previewDataUrl: buildShapeIntentReferenceDataUrl(
          shapeIntentAnalysis,
          suggestion,
          selections,
          { width: exportCanvasWidth, height: exportCanvasHeight },
          previewStrokes,
          `${summarizeShapeIntentSelections(suggestion, selections)} · Mode: ${shapeIntentApplyMode.toUpperCase()}`,
        ),
      };
    });
  }, [
    exportCanvasHeight,
    exportCanvasWidth,
    shapeIntentApplyMode,
    selectedShapeIntentSuggestion?.id,
    shapeIntentAnalysis,
    activeShapeIntentSelections,
    visibleShapeIntentSuggestions,
  ]);
  useEffect(() => {
    if (!shapeIntentAnalysis || shapeIntentAnalysis.suggestions.length === 0) {
      if (shapeIntentPendingSelections !== null) {
        setShapeIntentPendingSelections(null);
      }
      if (shapeIntentSelectedSuggestionId !== undefined) {
        setShapeIntentSelectedSuggestionId(undefined);
      }
      if (Object.keys(shapeIntentSelections).length > 0) {
        setShapeIntentSelections({});
      }
      return;
    }

    const nextSuggestion = shapeIntentAnalysis.suggestions.find((suggestion) => suggestion.id === shapeIntentSelectedSuggestionId)
      || shapeIntentAnalysis.suggestions[0];
    if (shapeIntentPendingSelections?.suggestionId === nextSuggestion.id) {
      if (nextSuggestion.id !== shapeIntentSelectedSuggestionId) {
        setShapeIntentSelectedSuggestionId(nextSuggestion.id);
      }
      if (!areShapeIntentSelectionsEqual(shapeIntentSelections, shapeIntentPendingSelections.selections)) {
        setShapeIntentSelections(cloneShapeIntentSelections(shapeIntentPendingSelections.selections));
      }
      return;
    }

    const nextDefaultSelections = getShapeIntentDefaultSelections(nextSuggestion);
    if (nextSuggestion.id !== shapeIntentSelectedSuggestionId) {
      setShapeIntentSelectedSuggestionId(nextSuggestion.id);
      if (!areShapeIntentSelectionsEqual(shapeIntentSelections, nextDefaultSelections)) {
        setShapeIntentSelections(nextDefaultSelections);
      }
      return;
    }

    if (
      Object.keys(shapeIntentSelections).length === 0
      && !areShapeIntentSelectionsEqual(shapeIntentSelections, nextDefaultSelections)
    ) {
      setShapeIntentSelections(nextDefaultSelections);
    }
  }, [shapeIntentAnalysis, shapeIntentPendingSelections, shapeIntentSelectedSuggestionId, shapeIntentSelections]);
  useEffect(() => {
    if (shapeIntentVisible && shapeIntentAnalysis) {
      setShapeIntentParkedPrimitive(null);
    }
  }, [shapeIntentAnalysis, shapeIntentVisible]);
  const typeTrackingLabel = selectedFontPreset === 'Mono'
    ? '+18'
    : selectedFontPreset === 'Display'
      ? '+24'
      : '+12';
  const timelinePreviewCanvases = useMemo(() => {
    const ratio = ASPECT_RATIOS[aspectRatio] || ASPECT_RATIOS['16:9'];
    const previewWidth = 176;
    const previewHeight = Math.max(72, Math.round(previewWidth / ratio));
    const canvasCache = new Map<string, HTMLCanvasElement | null>();

    return timelineFrames.map((frame) => {
      if (frame.sheetId.startsWith('placeholder-')) return null;
      if (!canvasCache.has(frame.sheetId)) {
        canvasCache.set(
          frame.sheetId,
          createTimelinePreviewCanvas(
            previewWidth,
            previewHeight,
            getStoryboardDocumentSheetStrokes(drawingDocument, frame.sheetId, frame.timelineIndex)
          )
        );
      }
      return canvasCache.get(frame.sheetId) || null;
    });
  }, [aspectRatio, drawingDocument, timelineFrames]);
  const getTimelineFrameImage = useCallback(
    (index: number) => timelinePreviewCanvases[index] || null,
    [timelinePreviewCanvases]
  );
  const timelinePreviewDataUrls = useMemo(
    () => timelinePreviewCanvases.map((canvas) => canvas?.toDataURL('image/png') || undefined),
    [timelinePreviewCanvases]
  );

  useEffect(() => {
    setGridEnabled(defaultGridEnabled);
  }, [defaultGridEnabled]);

  useEffect(() => {
    timeLapseProgressRef.current = timeLapseProgressMs;
  }, [timeLapseProgressMs]);

  useEffect(() => {
    if (timeLapseStats.available) {
      return;
    }
    setTimeLapsePlaying(false);
    setTimeLapseProgressMs(0);
  }, [timeLapseStats.available]);

  useEffect(() => {
    if (!timeLapsePlaying || !timeLapseStats.available || timeLapseStats.replayDurationMs <= 0) {
      return;
    }

    let rafId = 0;
    const startedAt = performance.now() - timeLapseProgressRef.current;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed >= timeLapseStats.replayDurationMs) {
        setTimeLapseProgressMs(timeLapseStats.replayDurationMs);
        setTimeLapsePlaying(false);
        return;
      }
      setTimeLapseProgressMs(elapsed);
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [timeLapsePlaying, timeLapseStats.available, timeLapseStats.replayDurationMs]);

  useEffect(() => {
    setSelectedDeckTab(
      workflowLevel === 'blocking' ? 'ROUGH' : workflowLevel === 'presentation' ? 'LIGHT' : 'SHADOW'
    );
    setInspectorMode(workflowLevel === 'presentation' ? 'layers' : 'lighting');
  }, [workflowLevel]);

  useEffect(() => {
    if (activeSheetIdRef.current === activeSheetId) {
      return;
    }
    activeSheetIdRef.current = activeSheetId;
    setEditorStrokesFromDocument(activeLayerStrokes);
    setTimeLapsePlaying(false);
    setTimeLapseProgressMs(0);
  }, [activeLayerStrokes, activeSheetId]);

  useEffect(() => {
    const localSignature = buildStrokeSignature(strokes);
    const documentSignature = buildStrokeSignature(activeLayerStrokes);
    const lastResolvedSignature = lastResolvedStrokeSignatureRef.current;
    const pendingStrokeSyncSource = pendingStrokeSyncSourceRef.current;

    if (localSignature === documentSignature) {
      lastResolvedStrokeSignatureRef.current = localSignature;
      pendingStrokeSyncSourceRef.current = null;
      return;
    }

    if (pendingStrokeSyncSource === 'local') {
      setDrawingDocument((prev) => {
        const previousSignature = buildStrokeSignature(
          activeLayerId ? getStoryboardDocumentDrawingLayerStrokes(prev, activeLayerId) : []
        );
        if (previousSignature === localSignature) {
          drawingDocumentRef.current = prev;
          lastResolvedStrokeSignatureRef.current = localSignature;
          pendingStrokeSyncSourceRef.current = null;
          return prev;
        }
        const next = updateStoryboardDrawingDocumentSheetContent(prev, activeSheetId, {
          strokes,
          layerId: activeLayerId,
          workflowLevel: workflowLevel as StoryboardDocumentWorkflowLevel,
        });
        drawingDocumentRef.current = next;
        lastResolvedStrokeSignatureRef.current = localSignature;
        return next;
      });
      return;
    }

    if (pendingStrokeSyncSource === 'document') {
      lastResolvedStrokeSignatureRef.current = documentSignature;
      setEditorStrokesFromDocument(activeLayerStrokes);
      return;
    }

    // If the document still matches the last resolved state, the local canvas changed and should win.
    if (documentSignature === lastResolvedSignature) {
      setDrawingDocument((prev) => {
        const previousSignature = buildStrokeSignature(
          activeLayerId ? getStoryboardDocumentDrawingLayerStrokes(prev, activeLayerId) : []
        );
        if (previousSignature === localSignature) {
          drawingDocumentRef.current = prev;
          lastResolvedStrokeSignatureRef.current = localSignature;
          return prev;
        }
        const next = updateStoryboardDrawingDocumentSheetContent(prev, activeSheetId, {
          strokes,
          layerId: activeLayerId,
          workflowLevel: workflowLevel as StoryboardDocumentWorkflowLevel,
        });
        drawingDocumentRef.current = next;
        lastResolvedStrokeSignatureRef.current = localSignature;
        return next;
      });
      return;
    }

    // If the local canvas still matches the last resolved state, the document changed and should win.
    if (localSignature === lastResolvedSignature) {
      lastResolvedStrokeSignatureRef.current = documentSignature;
      setEditorStrokesFromDocument(activeLayerStrokes);
      return;
    }

    // When both changed before a sync completed, prefer local canvas state to avoid losing in-progress edits.
    setDrawingDocument((prev) => {
      const previousSignature = buildStrokeSignature(
        activeLayerId ? getStoryboardDocumentDrawingLayerStrokes(prev, activeLayerId) : []
      );
      if (previousSignature === localSignature) {
        drawingDocumentRef.current = prev;
        lastResolvedStrokeSignatureRef.current = localSignature;
        return prev;
      }
      const next = updateStoryboardDrawingDocumentSheetContent(prev, activeSheetId, {
        strokes,
        layerId: activeLayerId,
        workflowLevel: workflowLevel as StoryboardDocumentWorkflowLevel,
      });
      drawingDocumentRef.current = next;
      lastResolvedStrokeSignatureRef.current = localSignature;
      return next;
    });
  }, [activeLayerId, activeLayerStrokes, activeSheetId, strokes, workflowLevel]);

  useEffect(() => {
    if (!transportPlaying || timelineFrames.length <= 1) {
      return;
    }
    const intervalMs = Math.max(80, Math.round(1000 / Math.max(1, drawingDocument.timeline.fps)));
    const timerId = window.setInterval(() => {
      setDrawingDocument((prev) => {
        const frames = getStoryboardDocumentTimelineFrames(prev);
        if (frames.length <= 1) return prev;
        const next = setStoryboardDrawingDocumentScrubFrame(
          prev,
          (prev.timeline.scrubFrame + 1) % frames.length
        );
        drawingDocumentRef.current = next;
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(timerId);
  }, [drawingDocument.timeline.fps, timelineFrames.length, transportPlaying]);

  const getCanvasApi = useCallback(() => (
    proMode ? proCanvasRef.current : standardCanvasRef.current
  ), [proMode]);
  const spatialMapViewportRef = useRef<HTMLDivElement | null>(null);
  const spatialMapDragStateRef = useRef<{
    canvasId: string;
    pointerId: number | null;
    originClientX: number;
    originClientY: number;
    originX: number;
    originY: number;
    xRange: number;
    yRange: number;
  } | null>(null);
  const [spatialMapDraggingCanvasId, setSpatialMapDraggingCanvasId] = useState<string>();
  const commitDocumentUpdate = useCallback(
    (updater: (document: StoryboardDrawingDocument) => StoryboardDrawingDocument) => {
      setDrawingDocument((prev) => {
        const next = updater(prev);
        drawingDocumentRef.current = next;
        return next;
      });
      setHasUnsavedChanges(true);
    },
    []
  );

  useEffect(() => {
    const persistedBoardPolishSignature = JSON.stringify(
      stripBoardPolishPersistenceState(drawingDocument.metadata.boardPolish)
    );
    if (persistedBoardPolishSignature === boardPolishDocumentSnapshotSignature) {
      return;
    }

    const updatedAt = new Date().toISOString();
    setDrawingDocument((prev) => {
      const previousBoardPolishSignature = JSON.stringify(
        stripBoardPolishPersistenceState(prev.metadata.boardPolish)
      );
      if (previousBoardPolishSignature === boardPolishDocumentSnapshotSignature) {
        drawingDocumentRef.current = prev;
        return prev;
      }
      const next = updateStoryboardDrawingDocumentBoardPolish(prev, boardPolishDocumentSnapshot, updatedAt);
      drawingDocumentRef.current = next;
      return next;
    });
    setHasUnsavedChanges(true);
  }, [
    boardPolishDocumentSnapshot,
    boardPolishDocumentSnapshotSignature,
    drawingDocument.metadata.boardPolish,
  ]);

  useEffect(() => {
    const persistedReferenceStudySignature = JSON.stringify(
      stripReferenceStudyPersistenceState(drawingDocument.metadata.referenceStudy)
    );
    if (persistedReferenceStudySignature === referenceStudyDocumentSnapshotSignature) {
      return;
    }

    const updatedAt = new Date().toISOString();
    setDrawingDocument((prev) => {
      const previousReferenceStudySignature = JSON.stringify(
        stripReferenceStudyPersistenceState(prev.metadata.referenceStudy)
      );
      if (previousReferenceStudySignature === referenceStudyDocumentSnapshotSignature) {
        drawingDocumentRef.current = prev;
        return prev;
      }
      const next = updateStoryboardDrawingDocumentReferenceStudy(prev, referenceStudyDocumentSnapshot, updatedAt);
      drawingDocumentRef.current = next;
      return next;
    });
    setHasUnsavedChanges(true);
  }, [
    drawingDocument.metadata.referenceStudy,
    referenceStudyDocumentSnapshot,
    referenceStudyDocumentSnapshotSignature,
  ]);

  useEffect(() => {
    if (!flythroughPlaying || !activeFlythroughEntry) {
      return;
    }

    if (activeFlythroughEntry.bookmark.id !== selectedSpatialBookmarkId) {
      setSelectedSpatialBookmarkId(activeFlythroughEntry.bookmark.id);
      commitDocumentUpdate((prev) => applyStoryboardDrawingDocumentBookmarkView(prev, activeFlythroughEntry.bookmark.id));
    }
  }, [activeFlythroughEntry, commitDocumentUpdate, flythroughPlaying, selectedSpatialBookmarkId]);

  const handleTimelineFrameSelect = useCallback((frameIndex: number) => {
    setTransportPlaying(false);
    commitDocumentUpdate((prev) => setStoryboardDrawingDocumentScrubFrame(prev, frameIndex));
  }, [commitDocumentUpdate]);

  const handleAddTimelineSheet = useCallback(() => {
    setTransportPlaying(false);
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentSheet(prev, {
      afterSheetId: activeSheetId,
      exposure: activeSheetExposure,
    }));
  }, [activeSheetExposure, activeSheetId, commitDocumentUpdate]);

  const handleDuplicateTimelineSheet = useCallback(() => {
    setTransportPlaying(false);
    commitDocumentUpdate((prev) => duplicateStoryboardDrawingDocumentSheet(prev, activeSheetId));
  }, [activeSheetId, commitDocumentUpdate]);

  const handleLinkTimelineSheet = useCallback(() => {
    setTransportPlaying(false);
    commitDocumentUpdate((prev) => duplicateStoryboardDrawingDocumentSheet(prev, activeSheetId, { linked: true }));
  }, [activeSheetId, commitDocumentUpdate]);

  const handleAddTimelineMarker = useCallback(() => {
    setTransportPlaying(false);
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentMarker(prev, {
      frame: activeTimelineFrameIndex,
      label: `Beat ${String(activeTimelineFrameIndex + 1).padStart(2, '0')}`,
    }));
  }, [activeTimelineFrameIndex, commitDocumentUpdate]);

  const handleSelectMarker = useCallback((markerId: string) => {
    commitDocumentUpdate((prev) => {
      const marker = prev.markers.find((entry) => entry.id === markerId);
      if (!marker) return prev;
      return updateStoryboardDrawingDocumentTimelineState(
        setStoryboardDrawingDocumentScrubFrame(prev, marker.frame),
        { selectedMarkerIds: [markerId] }
      );
    });
  }, [commitDocumentUpdate]);

  const handleOnionSkinFramesChange = useCallback((value: number) => {
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentTimelineState(prev, {
      onionSkinEnabled: value > 0,
      onionSkinFramesBefore: value,
      onionSkinFramesAfter: value,
    }));
  }, [commitDocumentUpdate]);

  const handleAddSpatialCanvas = useCallback(() => {
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentCanvas(prev, {
      aspectRatio: (aspectRatio as StoryboardDocumentAspectRatio) || prev.aspectRatio,
      sheetIds: [activeSheetId],
    }));
  }, [activeSheetId, aspectRatio, commitDocumentUpdate]);

  const handleSelectSpatialCanvas = useCallback((canvasId: string) => {
    setFlythroughPlaying(false);
    setFlythroughElapsedMs(0);
    commitDocumentUpdate((prev) => setStoryboardDrawingDocumentPrimaryCanvas(prev, canvasId));
  }, [commitDocumentUpdate]);

  const handleUpdateSpatialCanvasTransform = useCallback((
    canvasId: string,
    updater: (canvas: StoryboardDocumentSpatialCanvas) => Partial<StoryboardDocumentSpatialCanvas['transform']>,
  ) => {
    setFlythroughPlaying(false);
    commitDocumentUpdate((prev) => {
      const currentCanvas = prev.canvases.find((canvas) => canvas.id === canvasId);
      if (!currentCanvas) {
        return prev;
      }
      return updateStoryboardDrawingDocumentCanvasTransform(prev, currentCanvas.id, updater(currentCanvas));
    });
  }, [commitDocumentUpdate]);

  const handleUpdateActiveSpatialCanvasTransform = useCallback((
    updater: (canvas: StoryboardDocumentSpatialCanvas) => Partial<StoryboardDocumentSpatialCanvas['transform']>,
  ) => {
    if (!activeSpatialCanvas) return;
    handleUpdateSpatialCanvasTransform(activeSpatialCanvas.id, updater);
  }, [activeSpatialCanvas, handleUpdateSpatialCanvasTransform]);

  const handleStartSpatialCanvasDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>, canvasId: string) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) {
      return;
    }
    const viewport = spatialMapViewportRef.current;
    const canvas = spatialCanvases.find((entry) => entry.id === canvasId);
    if (!viewport || !canvas) {
      return;
    }
    handleSelectSpatialCanvas(canvasId);
    spatialMapDragStateRef.current = {
      canvasId,
      pointerId: event.pointerId,
      originClientX: event.clientX,
      originClientY: event.clientY,
      originX: canvas.transform.x,
      originY: canvas.transform.y,
      xRange: spatialMapLayout.xRange,
      yRange: spatialMapLayout.yRange,
    };
    setSpatialMapDraggingCanvasId(canvasId);
    event.preventDefault();
  }, [handleSelectSpatialCanvas, spatialCanvases, spatialMapLayout.xRange, spatialMapLayout.yRange]);

  useEffect(() => {
    if (!spatialMapDraggingCanvasId) {
      return undefined;
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      const dragState = spatialMapDragStateRef.current;
      const viewport = spatialMapViewportRef.current;
      if (!dragState || !viewport || (dragState.pointerId !== null && dragState.pointerId !== event.pointerId)) {
        return;
      }
      const viewportRect = viewport.getBoundingClientRect();
      const deltaClientX = event.clientX - dragState.originClientX;
      const deltaClientY = event.clientY - dragState.originClientY;
      const nextX = Math.round(
        dragState.originX + ((deltaClientX / Math.max(1, viewportRect.width)) * (dragState.xRange / (SPATIAL_MAP_X_SPAN_PERCENT / 100)))
      );
      const nextY = Math.round(
        dragState.originY + ((deltaClientY / Math.max(1, viewportRect.height)) * (dragState.yRange / (SPATIAL_MAP_Y_SPAN_PERCENT / 100)))
      );
      handleUpdateSpatialCanvasTransform(dragState.canvasId, () => ({
        x: nextX,
        y: nextY,
      }));
    };

    const clearSpatialMapDrag = (pointerId: number | null) => {
      const dragState = spatialMapDragStateRef.current;
      if (dragState && pointerId !== null && dragState.pointerId !== null && dragState.pointerId !== pointerId) {
        return;
      }
      spatialMapDragStateRef.current = null;
      setSpatialMapDraggingCanvasId(undefined);
    };

    const handleWindowPointerUp = (event: PointerEvent) => {
      clearSpatialMapDrag(event.pointerId);
    };

    const handleWindowPointerCancel = (event: PointerEvent) => {
      clearSpatialMapDrag(event.pointerId);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
    };
  }, [handleUpdateSpatialCanvasTransform, spatialMapDraggingCanvasId]);

  const handleNudgeActiveSpatialCanvas = useCallback((dx: number, dy: number) => {
    handleUpdateActiveSpatialCanvasTransform((canvas) => ({
      x: canvas.transform.x + dx,
      y: canvas.transform.y + dy,
    }));
  }, [handleUpdateActiveSpatialCanvasTransform]);

  const handleAdjustActiveSpatialCanvasDepth = useCallback((delta: number) => {
    handleUpdateActiveSpatialCanvasTransform((canvas) => ({
      z: canvas.transform.z + delta,
    }));
  }, [handleUpdateActiveSpatialCanvasTransform]);

  const handleAdjustActiveSpatialCanvasScale = useCallback((delta: number) => {
    handleUpdateActiveSpatialCanvasTransform((canvas) => ({
      scale: Math.max(0.35, Math.min(2.4, Number((canvas.transform.scale + delta).toFixed(2)))),
    }));
  }, [handleUpdateActiveSpatialCanvasTransform]);

  const handleSelectSpatialBookmark = useCallback((bookmarkId: string) => {
    setFlythroughPlaying(false);
    setSelectedSpatialBookmarkId(bookmarkId);
    const entry = flythroughSequence.find((item) => item.bookmark.id === bookmarkId);
    if (entry) {
      setFlythroughElapsedMs(entry.startMs);
    }
    commitDocumentUpdate((prev) => applyStoryboardDrawingDocumentBookmarkView(prev, bookmarkId));
  }, [commitDocumentUpdate, flythroughSequence]);

  const handleJumpToSpatialBookmarkView = useCallback((bookmarkId: string) => {
    setFlythroughPlaying(false);
    setSelectedSpatialBookmarkId(bookmarkId);
    const entry = flythroughSequence.find((item) => item.bookmark.id === bookmarkId);
    if (entry) {
      setFlythroughElapsedMs(entry.startMs);
    }
    commitDocumentUpdate((prev) => applyStoryboardDrawingDocumentBookmarkView(prev, bookmarkId));
  }, [commitDocumentUpdate, flythroughSequence]);

  const handleAttachActiveSheetToCanvas = useCallback((canvasId: string) => {
    commitDocumentUpdate((prev) => attachStoryboardDrawingDocumentSheetToCanvas(prev, canvasId, activeSheetId));
  }, [activeSheetId, commitDocumentUpdate]);

  const handleAddSpatialBookmark = useCallback(() => {
    if (!activeSpatialCanvas) return;
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentBookmark(prev, {
      canvasId: activeSpatialCanvas.id,
      name: `View ${prev.bookmarks.length + 1}`,
      timingMs: 1200 + (activeTimelineFrameIndex * 120),
      transition: prev.projection.mode === 'rearrange' ? 'linear' : 'ease',
      camera: {
        x: activeSpatialCanvas.transform.x,
        y: activeSpatialCanvas.transform.y,
        z: activeSpatialCanvas.transform.z,
        zoom: 1 + (activeTimelineFrameIndex * 0.02),
        rotationX: activeSpatialCanvas.transform.rotationX,
        rotationY: activeSpatialCanvas.transform.rotationY,
        rotationZ: activeSpatialCanvas.transform.rotationZ,
      },
    }));
  }, [activeSpatialCanvas, activeTimelineFrameIndex, commitDocumentUpdate]);

  const handleDuplicateSpatialBookmark = useCallback((bookmark: StoryboardDocumentBookmarkView | undefined) => {
    if (!bookmark || !activeSpatialCanvas) return;
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentBookmark(prev, {
      canvasId: activeSpatialCanvas.id,
      name: `${bookmark.name} Copy`,
      timingMs: bookmark.timingMs,
      transition: bookmark.transition,
      visibleCanvasIds: bookmark.visibleCanvasIds,
      camera: bookmark.camera,
    }));
  }, [activeSpatialCanvas, commitDocumentUpdate]);

  const handleFlythroughTogglePlay = useCallback(() => {
    if (flythroughSequence.length === 0) return;
    if (!flythroughPlaying) {
      const entry = selectedFlythroughEntry || flythroughSequence[0];
      if (entry) {
        setSelectedSpatialBookmarkId(entry.bookmark.id);
        setFlythroughElapsedMs(entry.startMs);
        commitDocumentUpdate((prev) => applyStoryboardDrawingDocumentBookmarkView(prev, entry.bookmark.id));
      }
      setFlythroughPlaying(true);
      return;
    }
    setFlythroughPlaying(false);
  }, [commitDocumentUpdate, flythroughPlaying, flythroughSequence, selectedFlythroughEntry]);

  const handleFlythroughStep = useCallback((direction: -1 | 1) => {
    if (flythroughSequence.length === 0) return;
    setFlythroughPlaying(false);
    const currentIndex = selectedFlythroughEntry?.index ?? 0;
    const nextIndex = Math.max(0, Math.min(flythroughSequence.length - 1, currentIndex + direction));
    const nextEntry = flythroughSequence[nextIndex];
    if (!nextEntry) return;
    setSelectedSpatialBookmarkId(nextEntry.bookmark.id);
    setFlythroughElapsedMs(nextEntry.startMs);
    commitDocumentUpdate((prev) => applyStoryboardDrawingDocumentBookmarkView(prev, nextEntry.bookmark.id));
  }, [commitDocumentUpdate, flythroughSequence, selectedFlythroughEntry]);

  const handleFlythroughLoopToggle = useCallback(() => {
    setFlythroughLoopEnabled((prev) => !prev);
  }, []);

  const seekFlythroughToElapsedMs = useCallback((elapsedMs: number) => {
    if (flythroughSequence.length === 0 || activeFlythroughDurationMs <= 0) {
      return;
    }
    const clampedElapsedMs = Math.min(Math.max(0, elapsedMs), Math.max(0, activeFlythroughDurationMs - 1));
    const targetEntry = flythroughSequence.find((entry) => clampedElapsedMs >= entry.startMs && clampedElapsedMs < entry.endMs)
      || flythroughSequence[flythroughSequence.length - 1];

    if (!targetEntry) {
      return;
    }

    setFlythroughPlaying(false);
    setSelectedSpatialBookmarkId(targetEntry.bookmark.id);
    setFlythroughElapsedMs(clampedElapsedMs);
    if (selectedSpatialBookmarkId !== targetEntry.bookmark.id) {
      commitDocumentUpdate((prev) => applyStoryboardDrawingDocumentBookmarkView(prev, targetEntry.bookmark.id));
    }
  }, [activeFlythroughDurationMs, commitDocumentUpdate, flythroughSequence, selectedSpatialBookmarkId]);

  const seekFlythroughToClientX = useCallback((clientX: number) => {
    const progressElement = flythroughProgressRef.current;
    if (!progressElement || flythroughSequence.length === 0 || activeFlythroughDurationMs <= 0) {
      return;
    }
    const rect = progressElement.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / Math.max(1, rect.width)));
    seekFlythroughToElapsedMs(ratio * activeFlythroughDurationMs);
  }, [activeFlythroughDurationMs, flythroughSequence.length, seekFlythroughToElapsedMs]);

  const handleFlythroughSeekStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0) || flythroughSequence.length === 0) {
      return;
    }
    flythroughSeekStateRef.current.active = true;
    flythroughSeekStateRef.current.pointerId = event.pointerId;
    setFlythroughSeeking(true);
    seekFlythroughToClientX(event.clientX);
    event.preventDefault();
  }, [flythroughSequence.length, seekFlythroughToClientX]);

  useEffect(() => {
    if (!flythroughSeeking) {
      return undefined;
    }

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (!flythroughSeekStateRef.current.active || (
        flythroughSeekStateRef.current.pointerId !== null
        && flythroughSeekStateRef.current.pointerId !== event.pointerId
      )) {
        return;
      }
      seekFlythroughToClientX(event.clientX);
    };

    const clearFlythroughSeek = (pointerId: number | null) => {
      if (
        flythroughSeekStateRef.current.pointerId !== null
        && pointerId !== null
        && flythroughSeekStateRef.current.pointerId !== pointerId
      ) {
        return;
      }
      flythroughSeekStateRef.current.active = false;
      flythroughSeekStateRef.current.pointerId = null;
      setFlythroughSeeking(false);
    };

    const handleWindowPointerUp = (event: PointerEvent) => {
      clearFlythroughSeek(event.pointerId);
    };

    const handleWindowPointerCancel = (event: PointerEvent) => {
      clearFlythroughSeek(event.pointerId);
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);
    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
    };
  }, [flythroughSeeking, seekFlythroughToClientX]);

  const handleFlythroughSeek = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (flythroughSequence.length === 0 || activeFlythroughDurationMs <= 0) {
      return;
    }
    seekFlythroughToClientX(event.clientX);
  }, [activeFlythroughDurationMs, flythroughSequence.length, seekFlythroughToClientX]);

  const handleFlythroughTimingDelta = useCallback((deltaMs: number) => {
    if (!selectedSpatialBookmark) return;
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentBookmark(prev, selectedSpatialBookmark.id, {
      timingMs: selectedSpatialBookmark.timingMs + deltaMs,
    }));
  }, [commitDocumentUpdate, selectedSpatialBookmark]);

  const handleFlythroughTransitionCycle = useCallback(() => {
    if (!selectedSpatialBookmark) return;
    const currentIndex = STUDIO_FLYTHROUGH_TRANSITIONS.indexOf(selectedSpatialBookmark.transition);
    const nextTransition = STUDIO_FLYTHROUGH_TRANSITIONS[(currentIndex + 1) % STUDIO_FLYTHROUGH_TRANSITIONS.length];
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentBookmark(prev, selectedSpatialBookmark.id, {
      transition: nextTransition,
    }));
  }, [commitDocumentUpdate, selectedSpatialBookmark]);

  const handleFlythroughVisibilityToggle = useCallback((canvasId: string) => {
    if (!selectedSpatialBookmark) return;
    commitDocumentUpdate((prev) => {
      const bookmark = prev.bookmarks.find((entry) => entry.id === selectedSpatialBookmark.id);
      if (!bookmark) return prev;
      const nextVisibleCanvasIds = bookmark.visibleCanvasIds.includes(canvasId)
        ? bookmark.visibleCanvasIds.filter((entryId) => entryId !== canvasId)
        : [...bookmark.visibleCanvasIds, canvasId];
      return updateStoryboardDrawingDocumentBookmark(prev, bookmark.id, {
        visibleCanvasIds: nextVisibleCanvasIds,
      });
    });
  }, [commitDocumentUpdate, selectedSpatialBookmark]);

  const handleFlythroughCaptureSelectedView = useCallback(() => {
    if (!selectedSpatialBookmark || !activeSpatialCanvas) return;
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentBookmark(prev, selectedSpatialBookmark.id, {
      camera: {
        x: activeSpatialCanvas.transform.x,
        y: activeSpatialCanvas.transform.y,
        z: activeSpatialCanvas.transform.z,
        zoom: activeSpatialCanvas.transform.scale,
        rotationX: activeSpatialCanvas.transform.rotationX,
        rotationY: activeSpatialCanvas.transform.rotationY,
        rotationZ: activeSpatialCanvas.transform.rotationZ,
      },
    }));
  }, [activeSpatialCanvas, commitDocumentUpdate, selectedSpatialBookmark]);

  const handleFlythroughResetSelectedView = useCallback(() => {
    if (!selectedSpatialBookmark) return;
    setFlythroughPlaying(false);
    commitDocumentUpdate((prev) => applyStoryboardDrawingDocumentBookmarkView(prev, selectedSpatialBookmark.id));
  }, [commitDocumentUpdate, selectedSpatialBookmark]);

  const handleFlythroughMoveSelected = useCallback((direction: -1 | 1) => {
    if (!selectedSpatialBookmark || !activeSpatialCanvas) return;
    commitDocumentUpdate((prev) => reorderStoryboardDrawingDocumentCanvasBookmarks(
      prev,
      activeSpatialCanvas.id,
      selectedSpatialBookmark.id,
      direction,
    ));
  }, [activeSpatialCanvas, commitDocumentUpdate, selectedSpatialBookmark]);

  const handleFlythroughRemoveSelected = useCallback(() => {
    if (!selectedSpatialBookmark) return;
    setFlythroughPlaying(false);
    commitDocumentUpdate((prev) => removeStoryboardDrawingDocumentBookmark(prev, selectedSpatialBookmark.id));
  }, [commitDocumentUpdate, selectedSpatialBookmark]);

  const handleAnimationExport = useCallback(() => {
    if (!selectedAnimationUsesAnimatic || animaticSequence.length === 0) {
      return;
    }

    const exportDate = new Date().toISOString();
    const payload = {
      type: 'storyboard-animatic-plan',
      version: 1,
      exportedAt: exportDate,
      documentId: drawingDocument.id,
      frameId: drawingDocument.frameId,
      storyboardId: drawingDocument.storyboardId,
      aspectRatio: drawingDocument.aspectRatio,
      resolution: {
        width: exportCanvasWidth,
        height: exportCanvasHeight,
      },
      runtimeMs: activeFlythroughDurationMs,
      fps: drawingDocument.timeline.fps,
      output: selectedAnimationOutput,
      projection: drawingDocument.projection,
      cues: animaticSequence,
    };

    const filenameBase = (drawingDocument.frameId || drawingDocument.storyboardId || 'storyboard')
      .toString()
      .replace(/[^a-z0-9_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      || 'storyboard';
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlobFile(blob, `${filenameBase}-animatic-plan-${exportDate.slice(0, 10)}.json`);
  }, [
    activeFlythroughDurationMs,
    animaticSequence,
    drawingDocument,
    exportCanvasHeight,
    exportCanvasWidth,
    selectedAnimationOutput,
    selectedAnimationUsesAnimatic,
  ]);

  const handleProjectionModeChange = useCallback((mode: StoryboardDocumentProjectionMode) => {
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentProjection(prev, { mode }));
  }, [commitDocumentUpdate]);

  const handleProjectionSourceChange = useCallback((canvasId: string) => {
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentProjection(prev, { sourceCanvasId: canvasId }));
  }, [commitDocumentUpdate]);

  const handleProjectionTargetChange = useCallback((canvasId: string) => {
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentProjection(prev, { targetCanvasId: canvasId }));
  }, [commitDocumentUpdate]);

  const handleProjectionToggle = useCallback((key: 'reinterpretExistingStrokes' | 'arrangeAfterDrawing') => {
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentProjection(prev, {
      [key]: !prev.projection[key],
    }));
  }, [commitDocumentUpdate]);

  const handleApplyProjection = useCallback(() => {
    setFlythroughPlaying(false);
    commitDocumentUpdate((prev) => applyStoryboardDrawingDocumentProjection(prev, {
      sheetId: activeSheetId,
    }));
  }, [activeSheetId, commitDocumentUpdate]);

  const handleAddReference = useCallback(() => {
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentReference(prev, {
      name: `Board Ref ${String.fromCharCode(65 + prev.references.length)}`,
      src: prev.metadata.baseImageUrl || prev.metadata.lastCompositeImageUrl || initialImage || '',
      opacity: 0.58,
      visible: true,
      x: 80 + (prev.references.length * 28),
      y: 72 + (prev.references.length * 22),
      width: Math.round(canvasDimensions.width * 0.42),
      height: Math.round(canvasDimensions.height * 0.42),
      fitMode: 'contain',
    }));
  }, [canvasDimensions.height, canvasDimensions.width, commitDocumentUpdate, initialImage]);

  const readImageFileAsDataUrl = useCallback((file: File): Promise<string> => (
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Kunne ikke lese bildet'));
      };
      reader.onerror = () => reject(reader.error || new Error('Kunne ikke lese bildet'));
      reader.readAsDataURL(file);
    })
  ), []);

  const handleReferenceFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imageUrl = await readImageFileAsDataUrl(file);
      commitDocumentUpdate((prev) => addStoryboardDrawingDocumentReference(prev, {
        name: file.name,
        src: imageUrl,
        opacity: 0.58,
        visible: true,
        x: 80 + (prev.references.length * 28),
        y: 72 + (prev.references.length * 22),
        width: Math.round(canvasDimensions.width * 0.42),
        height: Math.round(canvasDimensions.height * 0.42),
        fitMode: 'contain',
      }));
    } finally {
      event.target.value = '';
    }
  }, [canvasDimensions.height, canvasDimensions.width, commitDocumentUpdate, readImageFileAsDataUrl]);

  const handleBaseImageFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imageUrl = await readImageFileAsDataUrl(file);
      commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentMediaState(prev, {
        baseImageUrl: imageUrl,
        imageDataUrl: prev.metadata.lastCompositeImageUrl || imageUrl,
      }));
    } finally {
      event.target.value = '';
    }
  }, [commitDocumentUpdate, readImageFileAsDataUrl]);

  const handleResetBaseImage = useCallback(() => {
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentMediaState(prev, {
      baseImageUrl: prev.metadata.originalBaseImageUrl ?? initialDrawingData?.originalBaseImageUrl ?? initialImage ?? '',
    }));
  }, [commitDocumentUpdate, initialDrawingData?.originalBaseImageUrl, initialImage]);

  const handleBeginReferenceStudySession = useCallback((
    referenceId: string,
    baselineStrokeCount: number = strokes.length,
    options?: {
      allowPendingReference?: boolean;
    },
  ) => {
    pendingReferenceStudyReferenceIdRef.current = options?.allowPendingReference ? referenceId : undefined;
    setSelectedReferenceId(referenceId);
    setReferenceStudyReferenceId(referenceId);
    setReferenceStudyActive(true);
    setReferenceStudyReveal(false);
    setReferenceStudyBaselineStrokeCount(baselineStrokeCount);
    setReferenceStudyFocusMode('composition');
    setReferenceStudyArmedDrillId(undefined);
    setReferenceStudyAttempts([]);
    setSelectedReferenceStudyAttemptId(undefined);
    setReferenceStudyGhostEnabled(false);
    setReferenceStudyGhostOpacity(0.3);
  }, [strokes.length]);

  const shapeIntentSourceStrokeIndexSet = useMemo(
    () => new Set(shapeIntentAnalysis?.sourceStrokeIndexes || []),
    [shapeIntentAnalysis?.sourceStrokeIndexes]
  );

  const getShapeIntentStudyBaseline = useCallback(() => {
    if (!shapeIntentAnalysis) {
      return {
        nextStrokes: strokes,
        baselineStrokeCount: strokes.length,
      };
    }

    const nextStrokes = strokes.filter((_, index) => !shapeIntentSourceStrokeIndexSet.has(index));
    return {
      nextStrokes,
      baselineStrokeCount: nextStrokes.length,
    };
  }, [shapeIntentAnalysis, shapeIntentSourceStrokeIndexSet, strokes]);

  const addShapeIntentReferenceAsset = useCallback((
    name: string,
    src: string,
    opacity: number = 0.78,
  ): string | undefined => {
    const nextReferenceId = createEditorDocumentId('reference');
    commitDocumentUpdate((prev) => {
      return addStoryboardDrawingDocumentReference(prev, {
        id: nextReferenceId,
        name,
        src,
        opacity,
        visible: true,
        x: 0,
        y: 0,
        width: canvasDimensions.width,
        height: canvasDimensions.height,
        fitMode: 'free',
      });
    });
    return nextReferenceId;
  }, [canvasDimensions.height, canvasDimensions.width, commitDocumentUpdate]);

  const handleSelectShapeIntentSuggestion = useCallback((suggestion: ShapeIntentSuggestion) => {
    setShapeIntentPendingSelections(null);
    setShapeIntentSelectedSuggestionId(suggestion.id);
    setShapeIntentSelections(getShapeIntentDefaultSelections(suggestion));
  }, []);

  const handleRecordShapeScaffoldLibraryEntryUsage = useCallback((entryId: string) => {
    const usedAt = new Date().toISOString();
    commitDocumentUpdate((prev) => {
      const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(prev, entryId);
      if (!libraryEntry) {
        return prev;
      }
      return updateStoryboardDrawingDocumentShapeScaffoldLibraryEntry(prev, entryId, {
        usageCount: libraryEntry.usageCount + 1,
        lastUsedAt: usedAt,
      });
    });
  }, [commitDocumentUpdate]);

  const handleApplyShapeIntentLibraryPreset = useCallback((entryId: string) => {
    const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(drawingDocument, entryId);
    const suggestion = getShapeIntentSuggestionDefinitionById(libraryEntry?.suggestionId);
    if (!libraryEntry || !suggestion) {
      return;
    }

    setShapeIntentPendingSelections({
      suggestionId: suggestion.id,
      selections: cloneShapeIntentSelections(libraryEntry.selections),
    });
    setShapeIntentSelectedSuggestionId(suggestion.id);
    setShapeIntentSelections(cloneShapeIntentSelections(libraryEntry.selections));
    setShapeIntentApplyMode(libraryEntry.applyMode as ShapeIntentApplyMode);
  }, [drawingDocument]);

  const handleApplyShapeIntentLibraryPresetPointer = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    entryId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    handleApplyShapeIntentLibraryPreset(entryId);
  }, [handleApplyShapeIntentLibraryPreset]);

  const handleApplyShapeIntentLibraryPresetClick = useCallback((
    event: ReactMouseEvent<HTMLButtonElement>,
    entryId: string,
  ) => {
    // Keyboard activation fires click without a preceding pointer event.
    if (event.detail !== 0) {
      return;
    }
    handleApplyShapeIntentLibraryPreset(entryId);
  }, [handleApplyShapeIntentLibraryPreset]);

  const handleToggleShapeScaffoldLibraryEntryPinned = useCallback((entryId: string) => {
    commitDocumentUpdate((prev) => {
      const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(prev, entryId);
      if (!libraryEntry) {
        return prev;
      }
      return updateStoryboardDrawingDocumentShapeScaffoldLibraryEntry(prev, entryId, {
        pinned: !libraryEntry.pinned,
      });
    });
  }, [commitDocumentUpdate]);

  const handleStartShapeScaffoldLibraryEntryStudy = useCallback((entryId: string) => {
    const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(drawingDocument, entryId);
    const suggestion = getShapeIntentSuggestionDefinitionById(libraryEntry?.suggestionId);
    if (!libraryEntry || !suggestion) {
      return;
    }

    const analysis = createShapeIntentAnalysisFromScaffold(
      createShapeIntentScaffoldDefinition(libraryEntry),
      { width: canvasDimensions.width, height: canvasDimensions.height },
    );
    if (!analysis) {
      return;
    }

    const guideStrokes = buildShapeIntentModeGuideStrokes(
      analysis,
      buildShapeIntentGuideStrokesFromScaffold(
        createShapeIntentScaffoldDefinition(libraryEntry),
        { width: canvasDimensions.width, height: canvasDimensions.height },
      ),
      libraryEntry.applyMode as ShapeIntentApplyMode,
    );
    const referenceSvg = buildShapeIntentReferenceDataUrl(
      analysis,
      suggestion,
      libraryEntry.selections,
      { width: canvasDimensions.width, height: canvasDimensions.height },
      guideStrokes,
      `${summarizeShapeIntentSelections(suggestion, libraryEntry.selections)} · Study Mode`,
    );
    const nextReferenceId = addShapeIntentReferenceAsset(
      `${suggestion.title} Study`,
      referenceSvg,
      0.86,
    );
    if (!nextReferenceId) {
      return;
    }

    const baseline = shapeIntentAnalysis
      ? getShapeIntentStudyBaseline()
      : {
          nextStrokes: strokes,
          baselineStrokeCount: strokes.length,
        };

    setShapeIntentPendingSelections({
      suggestionId: suggestion.id,
      selections: cloneShapeIntentSelections(libraryEntry.selections),
    });
    setShapeIntentSelectedSuggestionId(suggestion.id);
    setShapeIntentSelections(cloneShapeIntentSelections(libraryEntry.selections));
    setShapeIntentApplyMode(libraryEntry.applyMode as ShapeIntentApplyMode);
    if (shapeIntentAnalysis) {
      setEditorStrokesFromLocal(baseline.nextStrokes);
      setHasUnsavedChanges(true);
      setShapeIntentParkedPrimitive(shapeIntentAnalysis.displayLabel);
      setShapeIntentSuppressedStrokeCount(baseline.nextStrokes.length);
    }
    handleBeginReferenceStudySession(nextReferenceId, baseline.baselineStrokeCount, { allowPendingReference: true });
    handleRecordShapeScaffoldLibraryEntryUsage(entryId);
  }, [
    addShapeIntentReferenceAsset,
    canvasDimensions.height,
    canvasDimensions.width,
    drawingDocument,
    getShapeIntentStudyBaseline,
    handleBeginReferenceStudySession,
    handleRecordShapeScaffoldLibraryEntryUsage,
    shapeIntentAnalysis,
    strokes,
  ]);

  const handleShapeIntentShuffle = useCallback(() => {
    if (!shapeIntentAnalysis || shapeIntentAnalysis.suggestions.length <= 1) {
      return;
    }
    const nextOffset = (shapeIntentShuffleOffset + 1) % shapeIntentAnalysis.suggestions.length;
    setShapeIntentShuffleOffset(nextOffset);
    const nextSuggestion = shapeIntentAnalysis.suggestions[nextOffset];
    if (nextSuggestion) {
      handleSelectShapeIntentSuggestion(nextSuggestion);
    }
  }, [handleSelectShapeIntentSuggestion, shapeIntentAnalysis, shapeIntentShuffleOffset]);

  const handleShapeIntentParameterToggle = useCallback((
    parameter: ShapeIntentSuggestion['parameters'][number],
    optionId: string,
  ) => {
    setShapeIntentPendingSelections(null);
    setShapeIntentSelections((prev) => {
      if (parameter.selection === 'single') {
        return {
          ...prev,
          [parameter.id]: [optionId],
        };
      }

      const current = new Set(prev[parameter.id]?.length ? prev[parameter.id] : parameter.defaultValue);
      if (current.has(optionId) && current.size > 1) {
        current.delete(optionId);
      } else {
        current.add(optionId);
      }
      return {
        ...prev,
        [parameter.id]: Array.from(current),
      };
    });
  }, []);

  const applyGeneratedGuideStrokes = useCallback((generatedStrokes: PencilStroke[]) => {
    if (generatedStrokes.length === 0) {
      return;
    }
    const nextStrokes = [...strokes, ...generatedStrokes];
    setEditorStrokesFromLocal(nextStrokes);
    setHasUnsavedChanges(true);
    setShapeIntentSuppressedStrokeCount(nextStrokes.length);
  }, [strokes]);

  const handleApplyShapeIntentNormalizedGuide = useCallback(() => {
    if (!shapeIntentAnalysis) {
      return;
    }
    setShapeIntentParkedPrimitive(shapeIntentAnalysis.displayLabel);
    applyGeneratedGuideStrokes(
      buildShapeIntentModeGuideStrokes(
        shapeIntentAnalysis,
        shapeIntentAnalysis.normalizedGuideStrokes,
        shapeIntentApplyMode,
      )
    );
  }, [applyGeneratedGuideStrokes, shapeIntentAnalysis, shapeIntentApplyMode]);

  const handleApplyShapeIntentGuide = useCallback(() => {
    if (!shapeIntentAnalysis || !selectedShapeIntentSuggestion) {
      return;
    }
    applyGeneratedGuideStrokes(
      buildShapeIntentModeGuideStrokes(
        shapeIntentAnalysis,
        buildShapeIntentGuideStrokes(
          shapeIntentAnalysis,
          selectedShapeIntentSuggestion,
          activeShapeIntentSelections,
        ),
        shapeIntentApplyMode,
      )
    );
    setShapeIntentParkedPrimitive(shapeIntentAnalysis.displayLabel);
  }, [
    applyGeneratedGuideStrokes,
    shapeIntentApplyMode,
    selectedShapeIntentSuggestion,
    shapeIntentAnalysis,
    activeShapeIntentSelections,
  ]);

  const handleApplyShapeIntentReference = useCallback(() => {
    if (!shapeIntentAnalysis || !selectedShapeIntentSuggestion) {
      return;
    }

    const referenceSvg = buildShapeIntentReferenceDataUrl(
      shapeIntentAnalysis,
      selectedShapeIntentSuggestion,
      activeShapeIntentSelections,
      { width: canvasDimensions.width, height: canvasDimensions.height },
      shapeIntentPreviewStrokes,
      `${shapeIntentParameterSummary} · Mode: ${shapeIntentApplyMode.toUpperCase()}`,
    );
    const nextReferenceId = addShapeIntentReferenceAsset(
      `${selectedShapeIntentSuggestion.title} ${shapeIntentApplyMode === 'clean' ? 'Assist' : `${shapeIntentApplyMode[0].toUpperCase()}${shapeIntentApplyMode.slice(1)} Assist`}`,
      referenceSvg,
      0.78,
    );
    if (nextReferenceId) {
      setSelectedReferenceId(nextReferenceId);
    }
    setShapeIntentParkedPrimitive(shapeIntentAnalysis.displayLabel);
    setShapeIntentSuppressedStrokeCount(strokes.length);
  }, [
    addShapeIntentReferenceAsset,
    canvasDimensions.height,
    canvasDimensions.width,
    shapeIntentApplyMode,
    shapeIntentParameterSummary,
    shapeIntentPreviewStrokes,
    selectedShapeIntentSuggestion,
    shapeIntentAnalysis,
    activeShapeIntentSelections,
    strokes.length,
  ]);

  const handleApplyShapeIntentVariantPack = useCallback(() => {
    if (!shapeIntentAnalysis || shapeIntentVariantCards.length === 0) {
      return;
    }

    let firstReferenceId: string | undefined;
    commitDocumentUpdate((prev) => {
      let nextDocument = prev;
      shapeIntentVariantCards.forEach((variantCard, index) => {
        nextDocument = addStoryboardDrawingDocumentReference(nextDocument, {
          name: `${variantCard.suggestion.title} ${shapeIntentApplyMode === 'clean' ? 'Variant' : `${shapeIntentApplyMode[0].toUpperCase()}${shapeIntentApplyMode.slice(1)} Variant`}`,
          src: variantCard.previewDataUrl,
          opacity: index === 0 ? 0.8 : 0.72,
          visible: true,
          x: 0,
          y: 0,
          width: canvasDimensions.width,
          height: canvasDimensions.height,
          fitMode: 'free',
        });
        const addedReference = nextDocument.references[nextDocument.references.length - 1];
        if (!firstReferenceId && addedReference) {
          firstReferenceId = addedReference.id;
        }
      });
      return nextDocument;
    });
    if (firstReferenceId) {
      setSelectedReferenceId(firstReferenceId);
    }
    setShapeIntentParkedPrimitive(shapeIntentAnalysis.displayLabel);
    setShapeIntentSuppressedStrokeCount(strokes.length);
  }, [
    canvasDimensions.height,
    canvasDimensions.width,
    commitDocumentUpdate,
    shapeIntentApplyMode,
    shapeIntentAnalysis,
    shapeIntentVariantCards,
    strokes.length,
  ]);

  const handleAddShapeIntentScaffold = useCallback(() => {
    if (!shapeIntentAnalysis || !selectedShapeIntentSuggestion) {
      return;
    }

    const nextScaffoldId = createEditorDocumentId('shape-scaffold');
    const nextFrame = createShapeIntentScaffoldFrameFromBounds(
      shapeIntentAnalysis,
      exportCanvasWidth,
      exportCanvasHeight,
    );
    const nextSelections = Object.entries(activeShapeIntentSelections).reduce<ShapeIntentSelections>((result, [key, values]) => {
      result[key] = [...values];
      return result;
    }, {});
    const nextStrokes = strokes.filter((_, index) => !shapeIntentSourceStrokeIndexSet.has(index));
    commitDocumentUpdate((prev) => {
      return addStoryboardDrawingDocumentShapeScaffold(prev, {
        id: nextScaffoldId,
        name: `${selectedShapeIntentSuggestion.title} Scaffold ${(prev.metadata.shapeScaffolds?.length || 0) + 1}`,
        primitive: shapeIntentAnalysis.primitive as StoryboardDocumentShapeScaffoldPrimitive,
        suggestionId: selectedShapeIntentSuggestion.id,
        selections: nextSelections,
        applyMode: shapeIntentApplyMode as StoryboardDocumentShapeScaffoldApplyMode,
        frame: nextFrame,
        visible: true,
        opacity: 0.82,
      });
    });

    setEditorStrokesFromLocal(nextStrokes);
    setHasUnsavedChanges(true);
    setSelectedShapeScaffoldId(nextScaffoldId);
    setSelectedReferenceId(undefined);
    setShapeIntentParkedPrimitive(shapeIntentAnalysis.displayLabel);
    setShapeIntentSuppressedStrokeCount(nextStrokes.length);
  }, [
    commitDocumentUpdate,
    exportCanvasHeight,
    exportCanvasWidth,
    selectedShapeIntentSuggestion,
    shapeIntentAnalysis,
    shapeIntentApplyMode,
    shapeIntentSourceStrokeIndexSet,
    activeShapeIntentSelections,
    strokes,
  ]);

  const handleSelectShapeScaffold = useCallback((scaffoldId: string) => {
    setSelectedShapeScaffoldId(scaffoldId);
    setSelectedReferenceId(undefined);
  }, []);

  const handleUpdateSelectedShapeScaffold = useCallback((
    updates: Partial<Omit<ShapeIntentScaffoldRecord, 'id' | 'createdAt' | 'updatedAt'>>,
  ) => {
    if (!selectedShapeScaffold) {
      return;
    }
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentShapeScaffold(prev, selectedShapeScaffold.id, updates));
  }, [commitDocumentUpdate, selectedShapeScaffold]);

  const handleShapeScaffoldModeChange = useCallback((mode: ShapeIntentApplyMode) => {
    handleUpdateSelectedShapeScaffold({
      applyMode: mode as StoryboardDocumentShapeScaffoldApplyMode,
    });
  }, [handleUpdateSelectedShapeScaffold]);

  const handleShapeScaffoldParameterToggle = useCallback((
    parameter: ShapeIntentSuggestion['parameters'][number],
    optionId: string,
  ) => {
    if (!selectedShapeScaffold) {
      return;
    }

    const nextSelections = { ...selectedShapeScaffold.selections };
    if (parameter.selection === 'single') {
      nextSelections[parameter.id] = [optionId];
    } else {
      const current = new Set(nextSelections[parameter.id]?.length ? nextSelections[parameter.id] : parameter.defaultValue);
      if (current.has(optionId) && current.size > 1) {
        current.delete(optionId);
      } else {
        current.add(optionId);
      }
      nextSelections[parameter.id] = Array.from(current);
    }

    handleUpdateSelectedShapeScaffold({ selections: nextSelections });
  }, [handleUpdateSelectedShapeScaffold, selectedShapeScaffold]);

  const handleShapeScaffoldOpacityChange = useCallback((nextOpacity: number) => {
    handleUpdateSelectedShapeScaffold({
      opacity: Math.max(0.15, Math.min(1, nextOpacity)),
    });
  }, [handleUpdateSelectedShapeScaffold]);

  const handleShapeScaffoldScaleChange = useCallback((nextScalePercent: number) => {
    if (!selectedShapeScaffold) {
      return;
    }

    const scale = Math.max(0.6, Math.min(1.8, nextScalePercent / 100));
    const nextWidthRatio = Math.max(0.02, Math.min(0.92, selectedShapeScaffold.frame.baseWidthRatio * scale));
    const nextHeightRatio = Math.max(0.02, Math.min(0.92, selectedShapeScaffold.frame.baseHeightRatio * scale));
    const centerX = selectedShapeScaffold.frame.xRatio + (selectedShapeScaffold.frame.widthRatio / 2);
    const centerY = selectedShapeScaffold.frame.yRatio + (selectedShapeScaffold.frame.heightRatio / 2);
    handleUpdateSelectedShapeScaffold({
      frame: {
        ...selectedShapeScaffold.frame,
        widthRatio: nextWidthRatio,
        heightRatio: nextHeightRatio,
        xRatio: Math.max(0, Math.min(1 - nextWidthRatio, centerX - (nextWidthRatio / 2))),
        yRatio: Math.max(0, Math.min(1 - nextHeightRatio, centerY - (nextHeightRatio / 2))),
      },
    });
  }, [handleUpdateSelectedShapeScaffold, selectedShapeScaffold]);

  const handleNudgeShapeScaffold = useCallback((deltaX: number, deltaY: number) => {
    if (!selectedShapeScaffold) {
      return;
    }

    const nextX = Math.max(0, Math.min(1 - selectedShapeScaffold.frame.widthRatio, selectedShapeScaffold.frame.xRatio + deltaX));
    const nextY = Math.max(0, Math.min(1 - selectedShapeScaffold.frame.heightRatio, selectedShapeScaffold.frame.yRatio + deltaY));
    handleUpdateSelectedShapeScaffold({
      frame: {
        ...selectedShapeScaffold.frame,
        xRatio: nextX,
        yRatio: nextY,
      },
    });
  }, [handleUpdateSelectedShapeScaffold, selectedShapeScaffold]);

  const handleShapeScaffoldPointerStart = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    mode: ShapeScaffoldInteractionMode,
  ) => {
    if (!selectedShapeScaffold || !shapeScaffoldOverlayRef.current) {
      return;
    }
    const rect = shapeScaffoldOverlayRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setSelectedReferenceId(undefined);
    shapeScaffoldDraftFrameRef.current = selectedShapeScaffold.frame;
    applyShapeScaffoldOverlayPreviewFrame(selectedShapeScaffold.frame);
    setShapeScaffoldInteractionState({
      scaffoldId: selectedShapeScaffold.id,
      pointerId: event.pointerId,
      mode,
      originClientX: event.clientX,
      originClientY: event.clientY,
      containerWidth: rect.width,
      containerHeight: rect.height,
      originFrame: selectedShapeScaffold.frame,
    });
  }, [selectedShapeScaffold]);

  useEffect(() => {
    if (!shapeScaffoldInteractionState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== shapeScaffoldInteractionState.pointerId) {
        return;
      }
      event.preventDefault();
      const deltaXRatio = (event.clientX - shapeScaffoldInteractionState.originClientX) / Math.max(shapeScaffoldInteractionState.containerWidth, 1);
      const deltaYRatio = (event.clientY - shapeScaffoldInteractionState.originClientY) / Math.max(shapeScaffoldInteractionState.containerHeight, 1);
      const nextFrame = getNextShapeScaffoldFrameFromInteraction(
        shapeScaffoldInteractionState.originFrame,
        shapeScaffoldInteractionState.mode,
        deltaXRatio,
        deltaYRatio,
      );
      shapeScaffoldDraftFrameRef.current = nextFrame;
      applyShapeScaffoldOverlayPreviewFrame(nextFrame);
    };

    const finishInteraction = (event: PointerEvent) => {
      if (event.pointerId !== shapeScaffoldInteractionState.pointerId) {
        return;
      }
      const committedFrame = shapeScaffoldDraftFrameRef.current;
      if (committedFrame) {
        commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentShapeScaffold(
          prev,
          shapeScaffoldInteractionState.scaffoldId,
          { frame: committedFrame },
        ));
      }
      shapeScaffoldDraftFrameRef.current = null;
      setShapeScaffoldInteractionState(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishInteraction);
    window.addEventListener('pointercancel', finishInteraction);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishInteraction);
      window.removeEventListener('pointercancel', finishInteraction);
    };
  }, [applyShapeScaffoldOverlayPreviewFrame, commitDocumentUpdate, shapeScaffoldInteractionState]);

  const handleBoardPolishEffectRegionPointerStart = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    mode: BoardPolishEffectRegionInteractionMode,
  ) => {
    if (!selectedBoardPolishEffectLayerId || !selectedBoardPolishEffectRegion || !boardPolishEffectOverlayRef.current) {
      return;
    }
    const rect = boardPolishEffectOverlayRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    boardPolishEffectDraftRegionRef.current = selectedBoardPolishEffectRegion;
    setBoardPolishEffectDraftRegion(selectedBoardPolishEffectRegion);
    setBoardPolishEffectInteractionState({
      effectId: selectedBoardPolishEffectLayerId,
      pointerId: event.pointerId,
      mode,
      originClientX: event.clientX,
      originClientY: event.clientY,
      containerWidth: rect.width,
      containerHeight: rect.height,
      originRegion: selectedBoardPolishEffectRegion,
    });
  }, [selectedBoardPolishEffectLayerId, selectedBoardPolishEffectRegion]);

  useEffect(() => {
    if (!boardPolishEffectInteractionState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== boardPolishEffectInteractionState.pointerId) {
        return;
      }
      event.preventDefault();
      const deltaXRatio = (event.clientX - boardPolishEffectInteractionState.originClientX) / Math.max(boardPolishEffectInteractionState.containerWidth, 1);
      const deltaYRatio = (event.clientY - boardPolishEffectInteractionState.originClientY) / Math.max(boardPolishEffectInteractionState.containerHeight, 1);
      const nextRegion = getNextBoardPolishEffectRegionFromInteraction(
        boardPolishEffectInteractionState.originRegion,
        boardPolishEffectInteractionState.mode,
        deltaXRatio,
        deltaYRatio,
      );
      boardPolishEffectDraftRegionRef.current = nextRegion;
      setBoardPolishEffectDraftRegion(nextRegion);
    };

    const finishInteraction = (event: PointerEvent) => {
      if (event.pointerId !== boardPolishEffectInteractionState.pointerId) {
        return;
      }
      const committedRegion = boardPolishEffectDraftRegionRef.current;
      if (committedRegion) {
        const normalizedRegions = createBoardPolishEffectRegions(boardPolishEffectRegions.map((region) => (
          region.id === boardPolishEffectInteractionState.effectId
            ? committedRegion
            : region
        )));
        setBoardPolishEffectRegions(normalizedRegions);
        commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentBoardPolish(prev, {
          mode: boardPolishMode,
          tone: boardPolishTone,
          finish: boardPolishFinish,
          weather: boardPolishWeather,
          atmosphere: Number(boardPolishAtmosphere.toFixed(3)),
          lineBoost: Number(boardPolishLineBoost.toFixed(3)),
          vignette: Number(boardPolishVignette.toFixed(3)),
          effectLayers: createBoardPolishEffectLayerStates(boardPolishEffectLayerStates),
          effectRegions: normalizedRegions,
        }));
      }
      boardPolishEffectDraftRegionRef.current = null;
      setBoardPolishEffectDraftRegion(null);
      setBoardPolishEffectInteractionState(null);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', finishInteraction);
    window.addEventListener('pointercancel', finishInteraction);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishInteraction);
      window.removeEventListener('pointercancel', finishInteraction);
    };
  }, [
    boardPolishAtmosphere,
    boardPolishEffectInteractionState,
    boardPolishEffectLayerStates,
    boardPolishEffectRegions,
    boardPolishFinish,
    boardPolishLineBoost,
    boardPolishMode,
    boardPolishTone,
    boardPolishVignette,
    boardPolishWeather,
    commitDocumentUpdate,
  ]);

  const handleToggleSelectedShapeScaffoldVisibility = useCallback(() => {
    if (!selectedShapeScaffold) {
      return;
    }
    handleUpdateSelectedShapeScaffold({
      visible: !selectedShapeScaffold.visible,
    });
  }, [handleUpdateSelectedShapeScaffold, selectedShapeScaffold]);

  const handleRemoveSelectedShapeScaffold = useCallback(() => {
    if (!selectedShapeScaffold) {
      return;
    }

    const removedId = selectedShapeScaffold.id;
    commitDocumentUpdate((prev) => removeStoryboardDrawingDocumentShapeScaffold(prev, removedId));
    setSelectedShapeScaffoldId((prev) => (prev === removedId ? undefined : prev));
  }, [commitDocumentUpdate, selectedShapeScaffold]);

  const handleStartSelectedShapeScaffoldStudy = useCallback(() => {
    if (!selectedShapeScaffold || !selectedShapeScaffoldPreviewDataUrl) {
      return;
    }

    const nextReferenceId = addShapeIntentReferenceAsset(
      `${selectedShapeScaffold.name} Study`,
      selectedShapeScaffoldPreviewDataUrl,
      0.86,
    );
    if (!nextReferenceId) {
      return;
    }

    handleBeginReferenceStudySession(nextReferenceId, strokes.length, { allowPendingReference: true });
  }, [
    addShapeIntentReferenceAsset,
    handleBeginReferenceStudySession,
    selectedShapeScaffold,
    selectedShapeScaffoldPreviewDataUrl,
    strokes.length,
  ]);

  const buildGeneratedShapeScaffoldStrokes = useCallback((
    scaffold: Pick<StoryboardDocumentShapeScaffold, 'primitive' | 'suggestionId' | 'selections' | 'frame' | 'applyMode'>,
  ): PencilStroke[] => {
    const analysis = createShapeIntentAnalysisFromScaffold(
      createShapeIntentScaffoldDefinition(scaffold),
      { width: exportCanvasWidth, height: exportCanvasHeight },
    );
    if (!analysis) {
      return [];
    }
    return buildShapeIntentModeGuideStrokes(
      analysis,
      buildShapeIntentGuideStrokesFromScaffold(
        createShapeIntentScaffoldDefinition(scaffold),
        { width: exportCanvasWidth, height: exportCanvasHeight },
      ),
      scaffold.applyMode as ShapeIntentApplyMode,
    ).map(clonePencilStroke);
  }, [exportCanvasHeight, exportCanvasWidth]);

  const promoteShapeScaffoldsToLayerStackOnDocument = useCallback((
    document: StoryboardDrawingDocument,
    sheetId: string,
    scaffolds: Array<Pick<StoryboardDocumentShapeScaffold, 'id' | 'name' | 'primitive' | 'suggestionId' | 'selections' | 'frame' | 'applyMode'>>,
    options: {
      groupName?: string;
      hideScaffoldIds?: string[];
    } = {},
  ) => {
    let next = document;
    let insertAfterLayerId = getStoryboardDocumentActiveLayerId(document, sheetId);
    const promotedLayerIds: string[] = [];
    let lastGeneratedStrokes: PencilStroke[] = [];

    scaffolds.forEach((scaffold) => {
      const generatedStrokes = buildGeneratedShapeScaffoldStrokes(scaffold).map(clonePencilStroke);
      if (generatedStrokes.length === 0) {
        return;
      }

      next = addStoryboardDrawingDocumentLayer(next, sheetId, {
        name: `${scaffold.name} Trace`,
        insertAfterLayerId,
      });

      const promotedLayerId = getStoryboardDocumentActiveLayerId(next, sheetId);
      if (!promotedLayerId) {
        return;
      }

      promotedLayerIds.push(promotedLayerId);
      insertAfterLayerId = promotedLayerId;
      lastGeneratedStrokes = generatedStrokes;
      next = updateStoryboardDrawingDocumentSheetContent(next, sheetId, {
        strokes: generatedStrokes,
        layerId: promotedLayerId,
      });
    });

    let groupedLayerId: string | undefined;
    if (promotedLayerIds.length > 1) {
      const layerIdsBeforeGrouping = new Set(next.layers.map((layer) => layer.id));
      const groupName = options.groupName || 'Scaffold Assembly Group';
      next = groupStoryboardDrawingDocumentLayers(next, sheetId, promotedLayerIds, { name: groupName });
      groupedLayerId = next.layers.find((layer) => (
        layer.type === 'group'
        && !layerIdsBeforeGrouping.has(layer.id)
        && layer.name === groupName
      ))?.id;
    }

    (options.hideScaffoldIds || []).forEach((scaffoldId) => {
      next = updateStoryboardDrawingDocumentShapeScaffold(next, scaffoldId, { visible: false });
    });

    const activePromotedLayerId = getStoryboardDocumentActiveLayerId(next, sheetId) || promotedLayerIds[promotedLayerIds.length - 1];
    return {
      document: next,
      promotedLayerIds,
      groupedLayerId,
      activePromotedLayerId,
      activePromotedLayerStrokes: activePromotedLayerId
        ? getStoryboardDocumentDrawingLayerStrokes(next, activePromotedLayerId).map(clonePencilStroke)
        : lastGeneratedStrokes.map(clonePencilStroke),
    };
  }, [buildGeneratedShapeScaffoldStrokes]);

  const appendShapeScaffoldStrokesToEditableLayerOnDocument = useCallback((
    document: StoryboardDrawingDocument,
    sheetId: string,
    scaffolds: Array<Pick<StoryboardDocumentShapeScaffold, 'id' | 'name' | 'primitive' | 'suggestionId' | 'selections' | 'frame' | 'applyMode'>>,
    options: {
      hideScaffoldIds?: string[];
    } = {},
  ) => {
    const targetLayerId = getStoryboardDocumentActiveLayerId(document, sheetId);
    if (!targetLayerId) {
      return {
        document,
        targetLayerId: undefined,
        nextStrokes: [] as PencilStroke[],
      };
    }

    const existingStrokes = getStoryboardDocumentDrawingLayerStrokes(document, targetLayerId).map(clonePencilStroke);
    const generatedStrokes = scaffolds.flatMap((scaffold) => buildGeneratedShapeScaffoldStrokes(scaffold).map(clonePencilStroke));
    if (generatedStrokes.length === 0) {
      return {
        document,
        targetLayerId,
        nextStrokes: existingStrokes,
      };
    }

    let next = updateStoryboardDrawingDocumentSheetContent(document, sheetId, {
      layerId: targetLayerId,
      strokes: [...existingStrokes, ...generatedStrokes],
    });
    (options.hideScaffoldIds || []).forEach((scaffoldId) => {
      next = updateStoryboardDrawingDocumentShapeScaffold(next, scaffoldId, { visible: false });
    });

    return {
      document: next,
      targetLayerId,
      nextStrokes: getStoryboardDocumentDrawingLayerStrokes(next, targetLayerId).map(clonePencilStroke),
    };
  }, [buildGeneratedShapeScaffoldStrokes]);

  const handleToggleShapeScaffoldBatchMembership = useCallback(() => {
    if (!selectedShapeScaffold) {
      return;
    }
    setSelectedShapeScaffoldAssemblyId(undefined);
    setShapeScaffoldBatchIds((prev) => (
      prev.includes(selectedShapeScaffold.id)
        ? prev.filter((entry) => entry !== selectedShapeScaffold.id)
        : [...prev, selectedShapeScaffold.id]
    ));
  }, [selectedShapeScaffold]);

  const handleCreateShapeScaffoldAssembly = useCallback(() => {
    if (selectedShapeScaffoldBatch.length < 2) {
      return;
    }
    const nextAssemblyId = createEditorDocumentId('shape-scaffold-assembly');
    const nextName = shapeScaffoldAssemblyDraftName.trim() || createShapeScaffoldAssemblyName(shapeScaffoldAssemblies.length + 1);
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentShapeScaffoldAssembly(prev, {
      id: nextAssemblyId,
      name: nextName,
      scaffoldIds: selectedShapeScaffoldBatch.map((entry) => entry.id),
    }));
    setSelectedShapeScaffoldAssemblyId(nextAssemblyId);
    setShapeScaffoldAssemblyDraftName('');
  }, [commitDocumentUpdate, selectedShapeScaffoldBatch, shapeScaffoldAssemblies.length, shapeScaffoldAssemblyDraftName]);

  const handleCreateShapeScaffoldAssemblyFromTemplate = useCallback((templateId: ShapeScaffoldAssemblyTemplateId) => {
    if (!selectedShapeScaffold) {
      return;
    }

    const template = shapeScaffoldAssemblyTemplates.find((entry) => entry.id === templateId);
    if (!template || !template.compatibleSuggestionIds.includes(selectedShapeScaffold.suggestionId)) {
      return;
    }

    const templatePlan = template.build(selectedShapeScaffold);
    if (templatePlan.seeds.length === 0) {
      return;
    }

    const nextAssemblyId = createEditorDocumentId('shape-scaffold-assembly');
    const nextBatchIds = [selectedShapeScaffold.id];
    commitDocumentUpdate((prev) => {
      let next = prev;
      const suggestionCounts = new Map<string, number>();

      templatePlan.seeds.forEach((seed) => {
        const priorCount = suggestionCounts.get(seed.suggestionId)
          ?? (prev.metadata.shapeScaffolds || []).filter((entry) => entry.suggestionId === seed.suggestionId).length;
        const nextIndex = priorCount + 1;
        suggestionCounts.set(seed.suggestionId, nextIndex);

        const nextScaffoldId = createEditorDocumentId('shape-scaffold');
        nextBatchIds.push(nextScaffoldId);
        next = addStoryboardDrawingDocumentShapeScaffold(next, {
          id: nextScaffoldId,
          name: createShapeScaffoldSuggestionInstanceName(seed.name, nextIndex),
          primitive: seed.primitive,
          suggestionId: seed.suggestionId,
          selections: cloneShapeIntentSelections(seed.selections),
          applyMode: seed.applyMode,
          frame: seed.frame,
          visible: seed.visible,
          opacity: seed.opacity,
        });
      });

      return addStoryboardDrawingDocumentShapeScaffoldAssembly(next, {
        id: nextAssemblyId,
        name: templatePlan.assemblyName,
        scaffoldIds: nextBatchIds,
      });
    });

    setSelectedShapeScaffoldAssemblyId(nextAssemblyId);
    setShapeScaffoldBatchIds(nextBatchIds);
    setSelectedShapeScaffoldId(selectedShapeScaffold.id);
    setSelectedReferenceId(undefined);
    setShapeScaffoldAssemblyDraftName('');
  }, [commitDocumentUpdate, selectedShapeScaffold]);

  const handleSelectShapeScaffoldAssembly = useCallback((assemblyId: string) => {
    const assembly = getStoryboardDocumentShapeScaffoldAssemblyById(drawingDocument, assemblyId);
    if (!assembly) {
      return;
    }
    setSelectedShapeScaffoldAssemblyId(assembly.id);
    setShapeScaffoldBatchIds(assembly.scaffoldIds);
    setSelectedShapeScaffoldId(assembly.scaffoldIds[0]);
    setSelectedReferenceId(undefined);
  }, [drawingDocument]);

  const handleRemoveSelectedShapeScaffoldAssembly = useCallback(() => {
    if (!selectedShapeScaffoldAssembly) {
      return;
    }
    const removedAssemblyId = selectedShapeScaffoldAssembly.id;
    commitDocumentUpdate((prev) => removeStoryboardDrawingDocumentShapeScaffoldAssembly(prev, removedAssemblyId));
    setSelectedShapeScaffoldAssemblyId((prev) => (prev === removedAssemblyId ? undefined : prev));
  }, [commitDocumentUpdate, selectedShapeScaffoldAssembly]);

  const handlePromoteSelectedShapeScaffoldToLayer = useCallback(() => {
    if (!selectedShapeScaffold) {
      return;
    }
    let promotionResult:
      | ReturnType<typeof promoteShapeScaffoldsToLayerStackOnDocument>
      | undefined;
    commitDocumentUpdate((prev) => {
      promotionResult = promoteShapeScaffoldsToLayerStackOnDocument(prev, activeSheetId, [selectedShapeScaffold], {
        hideScaffoldIds: [selectedShapeScaffold.id],
      });
      return promotionResult.document;
    });
    if (!promotionResult || promotionResult.promotedLayerIds.length === 0) {
      return;
    }

    setSelectedStudioLayerId(promotionResult.groupedLayerId || promotionResult.activePromotedLayerId);
    setSelectedLayerIds(promotionResult.promotedLayerIds);
    setInspectorMode('layers');
    setEditorStrokesFromLocal(promotionResult.activePromotedLayerStrokes);
  }, [
    activeSheetId,
    commitDocumentUpdate,
    promoteShapeScaffoldsToLayerStackOnDocument,
    selectedShapeScaffold,
  ]);

  const handleConvertSelectedShapeScaffoldToEditableStrokes = useCallback(() => {
    if (!selectedShapeScaffold) {
      return;
    }

    let conversionResult:
      | ReturnType<typeof appendShapeScaffoldStrokesToEditableLayerOnDocument>
      | undefined;
    commitDocumentUpdate((prev) => {
      conversionResult = appendShapeScaffoldStrokesToEditableLayerOnDocument(prev, activeSheetId, [selectedShapeScaffold], {
        hideScaffoldIds: [selectedShapeScaffold.id],
      });
      return conversionResult.document;
    });
    if (!conversionResult?.targetLayerId || conversionResult.nextStrokes.length === 0) {
      return;
    }

    setSelectedStudioLayerId(conversionResult.targetLayerId);
    setSelectedLayerIds([conversionResult.targetLayerId]);
    setEditorStrokesFromLocal(conversionResult.nextStrokes);
  }, [
    activeSheetId,
    appendShapeScaffoldStrokesToEditableLayerOnDocument,
    commitDocumentUpdate,
    selectedShapeScaffold,
  ]);

  const handlePromoteSelectedShapeScaffoldBatchToLayerGroup = useCallback(() => {
    if (activeShapeScaffoldPromotionBatch.length < 2) {
      return;
    }

    let promotionResult:
      | ReturnType<typeof promoteShapeScaffoldsToLayerStackOnDocument>
      | undefined;
    commitDocumentUpdate((prev) => {
      promotionResult = promoteShapeScaffoldsToLayerStackOnDocument(prev, activeSheetId, activeShapeScaffoldPromotionBatch, {
        groupName: `${activeShapeScaffoldPromotionBatchName} Group`,
        hideScaffoldIds: activeShapeScaffoldPromotionBatch.map((entry) => entry.id),
      });
      return promotionResult.document;
    });

    if (!promotionResult || promotionResult.promotedLayerIds.length === 0) {
      return;
    }

    setInspectorMode('layers');
    setSelectedLayerIds(promotionResult.promotedLayerIds);
    setSelectedStudioLayerId(promotionResult.groupedLayerId || promotionResult.activePromotedLayerId);
    setEditorStrokesFromLocal(promotionResult.activePromotedLayerStrokes);
  }, [
    activeSheetId,
    activeShapeScaffoldPromotionBatch,
    activeShapeScaffoldPromotionBatchName,
    promoteShapeScaffoldsToLayerStackOnDocument,
    commitDocumentUpdate,
  ]);

  const handleConvertSelectedShapeScaffoldBatchToEditableStrokes = useCallback(() => {
    if (activeShapeScaffoldPromotionBatch.length === 0) {
      return;
    }

    let conversionResult:
      | ReturnType<typeof appendShapeScaffoldStrokesToEditableLayerOnDocument>
      | undefined;
    commitDocumentUpdate((prev) => {
      conversionResult = appendShapeScaffoldStrokesToEditableLayerOnDocument(prev, activeSheetId, activeShapeScaffoldPromotionBatch, {
        hideScaffoldIds: activeShapeScaffoldPromotionBatch.map((entry) => entry.id),
      });
      return conversionResult.document;
    });
    if (!conversionResult?.targetLayerId || conversionResult.nextStrokes.length === 0) {
      return;
    }

    setSelectedStudioLayerId(conversionResult.targetLayerId);
    setSelectedLayerIds([conversionResult.targetLayerId]);
    setEditorStrokesFromLocal(conversionResult.nextStrokes);
  }, [
    activeSheetId,
    activeShapeScaffoldPromotionBatch,
    appendShapeScaffoldStrokesToEditableLayerOnDocument,
    commitDocumentUpdate,
  ]);

  const handleDuplicateSelectedShapeScaffoldToVariant = useCallback(() => {
    if (!selectedShapeScaffold) {
      return;
    }

    let promotedLayerIds: string[] = [];
    let activePromotedLayerId: string | undefined;
    commitDocumentUpdate((prev) => {
      const updatedAt = new Date().toISOString();
      const duplicatedDocument = duplicateStoryboardDrawingDocumentSheet(prev, activeSheetId, {
        name: `${activeSheet?.name || 'Sheet'} · ${selectedShapeScaffold.name} Variant`,
      }, updatedAt);
      const variantSheetId = duplicatedDocument.primarySheetId;
      const promotionResult = promoteShapeScaffoldsToLayerStackOnDocument(duplicatedDocument, variantSheetId, [selectedShapeScaffold]);
      promotedLayerIds = promotionResult.promotedLayerIds;
      activePromotedLayerId = promotionResult.groupedLayerId || promotionResult.activePromotedLayerId;
      return promotionResult.document;
    });
    setInspectorMode('layers');
    if (promotedLayerIds.length > 0) {
      setSelectedLayerIds(promotedLayerIds);
    }
    setSelectedStudioLayerId(activePromotedLayerId);
  }, [
    activeSheet?.name,
    activeSheetId,
    commitDocumentUpdate,
    promoteShapeScaffoldsToLayerStackOnDocument,
    selectedShapeScaffold,
  ]);

  const handleDuplicateSelectedShapeScaffoldBatchToVariant = useCallback(() => {
    if (activeShapeScaffoldPromotionBatch.length < 2) {
      return;
    }

    let promotedLayerIds: string[] = [];
    let activePromotedLayerId: string | undefined;
    commitDocumentUpdate((prev) => {
      const updatedAt = new Date().toISOString();
      const duplicatedDocument = duplicateStoryboardDrawingDocumentSheet(prev, activeSheetId, {
        name: `${activeSheet?.name || 'Sheet'} · ${activeShapeScaffoldPromotionBatchName} Variant`,
      }, updatedAt);
      const variantSheetId = duplicatedDocument.primarySheetId;
      const promotionResult = promoteShapeScaffoldsToLayerStackOnDocument(duplicatedDocument, variantSheetId, activeShapeScaffoldPromotionBatch, {
        groupName: `${activeShapeScaffoldPromotionBatchName} Group`,
      });
      promotedLayerIds = promotionResult.promotedLayerIds;
      activePromotedLayerId = promotionResult.groupedLayerId || promotionResult.activePromotedLayerId;
      return promotionResult.document;
    });
    setInspectorMode('layers');
    if (promotedLayerIds.length > 0) {
      setSelectedLayerIds(promotedLayerIds);
    }
    setSelectedStudioLayerId(activePromotedLayerId);
  }, [
    activeSheet?.name,
    activeSheetId,
    activeShapeScaffoldPromotionBatch,
    activeShapeScaffoldPromotionBatchName,
    commitDocumentUpdate,
    promoteShapeScaffoldsToLayerStackOnDocument,
  ]);

  const handleQuickSwapSelectedShapeScaffold = useCallback((nextSuggestionId: string) => {
    if (!selectedShapeScaffold) {
      return;
    }
    const nextSuggestion = getShapeIntentSuggestionDefinitionById(nextSuggestionId);
    if (!nextSuggestion || nextSuggestion.id === selectedShapeScaffold.suggestionId) {
      return;
    }

    const previousSuggestion = getShapeIntentSuggestionDefinitionById(selectedShapeScaffold.suggestionId);
    handleUpdateSelectedShapeScaffold({
      suggestionId: nextSuggestion.id,
      selections: getShapeIntentDefaultSelections(nextSuggestion),
      name: getShapeScaffoldDisplayNameForSuggestion(
        selectedShapeScaffold.name,
        previousSuggestion?.title,
        nextSuggestion.title,
      ),
    });
  }, [handleUpdateSelectedShapeScaffold, selectedShapeScaffold]);

  const handleApplySelectedShapeScaffoldLibraryPreset = useCallback((entryId: string) => {
    if (!selectedShapeScaffold) {
      return;
    }

    const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(drawingDocument, entryId);
    const nextSuggestion = getShapeIntentSuggestionDefinitionById(libraryEntry?.suggestionId);
    if (!libraryEntry || !nextSuggestion) {
      return;
    }

    const previousSuggestion = getShapeIntentSuggestionDefinitionById(selectedShapeScaffold.suggestionId);
    handleUpdateSelectedShapeScaffold({
      suggestionId: libraryEntry.suggestionId,
      selections: cloneShapeIntentSelections(libraryEntry.selections),
      applyMode: libraryEntry.applyMode,
      name: getShapeScaffoldDisplayNameForSuggestion(
        selectedShapeScaffold.name,
        previousSuggestion?.title,
        nextSuggestion.title,
      ),
    });
    handleRecordShapeScaffoldLibraryEntryUsage(entryId);
  }, [
    drawingDocument,
    handleRecordShapeScaffoldLibraryEntryUsage,
    handleUpdateSelectedShapeScaffold,
    selectedShapeScaffold,
  ]);

  const handleApplySelectedShapeScaffoldLibraryPresetPointer = useCallback((
    event: ReactPointerEvent<HTMLButtonElement>,
    entryId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    handleApplySelectedShapeScaffoldLibraryPreset(entryId);
  }, [handleApplySelectedShapeScaffoldLibraryPreset]);

  const handleApplySelectedShapeScaffoldLibraryPresetClick = useCallback((
    event: ReactMouseEvent<HTMLButtonElement>,
    entryId: string,
  ) => {
    if (event.detail !== 0) {
      return;
    }
    handleApplySelectedShapeScaffoldLibraryPreset(entryId);
  }, [handleApplySelectedShapeScaffoldLibraryPreset]);

  const handleUpdateShapeScaffoldLibraryEntryFromSelected = useCallback((entryId: string) => {
    if (!selectedShapeScaffold || !selectedShapeScaffoldSuggestion) {
      return;
    }
    if (!selectedShapeScaffoldCompatibleLibraryPresetEntryIds.has(entryId)) {
      return;
    }

    commitDocumentUpdate((prev) => {
      const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(prev, entryId);
      if (!libraryEntry) {
        return prev;
      }
      return updateStoryboardDrawingDocumentShapeScaffoldLibraryEntry(prev, entryId, {
        name: getShapeScaffoldLibraryEntryName(
          selectedShapeScaffold.name,
          selectedShapeScaffoldSuggestion.title,
        ),
        primitive: selectedShapeScaffold.primitive,
        suggestionId: selectedShapeScaffold.suggestionId,
        selections: cloneShapeIntentSelections(selectedShapeScaffold.selections),
        applyMode: selectedShapeScaffold.applyMode,
        frame: { ...selectedShapeScaffold.frame },
        opacity: selectedShapeScaffold.opacity,
        tags: buildShapeScaffoldLibraryTags(
          selectedShapeScaffold.primitive,
          selectedShapeScaffoldSuggestion,
          getShapeScaffoldLibraryEntryName(
            selectedShapeScaffold.name,
            selectedShapeScaffoldSuggestion.title,
          ),
        ),
      });
    });
  }, [
    commitDocumentUpdate,
    selectedShapeScaffold,
    selectedShapeScaffoldCompatibleLibraryPresetEntryIds,
    selectedShapeScaffoldSuggestion,
  ]);

  const handleCycleSelectedShapeScaffoldSuggestion = useCallback((direction: 1 | -1) => {
    if (!selectedShapeScaffold || selectedShapeScaffoldSuggestionCycle.length <= 1) {
      return;
    }

    const currentIndex = selectedShapeScaffoldSuggestionCycle.findIndex(
      (suggestion) => suggestion.id === selectedShapeScaffold.suggestionId,
    );
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + selectedShapeScaffoldSuggestionCycle.length)
      % selectedShapeScaffoldSuggestionCycle.length;
    handleQuickSwapSelectedShapeScaffold(selectedShapeScaffoldSuggestionCycle[nextIndex].id);
  }, [handleQuickSwapSelectedShapeScaffold, selectedShapeScaffold, selectedShapeScaffoldSuggestionCycle]);

  const handleCycleSelectedShapeScaffoldSingleParameter = useCallback((
    parameterId: string,
    direction: 1 | -1 = 1,
  ) => {
    if (!selectedShapeScaffold || !selectedShapeScaffoldSuggestion) {
      return;
    }

    const parameter = selectedShapeScaffoldSuggestion.parameters.find((candidate) => candidate.id === parameterId);
    if (!parameter || parameter.selection !== 'single' || parameter.options.length === 0) {
      return;
    }

    const currentValue = selectedShapeScaffold.selections[parameter.id]?.[0] || parameter.defaultValue[0] || parameter.options[0].id;
    const currentIndex = Math.max(0, parameter.options.findIndex((option) => option.id === currentValue));
    const nextIndex = (currentIndex + direction + parameter.options.length) % parameter.options.length;

    handleUpdateSelectedShapeScaffold({
      selections: {
        ...selectedShapeScaffold.selections,
        [parameter.id]: [parameter.options[nextIndex].id],
      },
    });
  }, [handleUpdateSelectedShapeScaffold, selectedShapeScaffold, selectedShapeScaffoldSuggestion]);

  const handleSaveSelectedShapeScaffoldToLibrary = useCallback(() => {
    if (!selectedShapeScaffold || !selectedShapeScaffoldSuggestion) {
      return;
    }

    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentShapeScaffoldLibraryEntry(prev, {
      name: getShapeScaffoldLibraryEntryName(
        selectedShapeScaffold.name,
        selectedShapeScaffoldSuggestion.title,
      ),
      primitive: selectedShapeScaffold.primitive,
      suggestionId: selectedShapeScaffold.suggestionId,
      selections: Object.entries(selectedShapeScaffold.selections).reduce<ShapeIntentSelections>((result, [key, values]) => {
        result[key] = [...values];
        return result;
      }, {}),
      applyMode: selectedShapeScaffold.applyMode,
      frame: { ...selectedShapeScaffold.frame },
      opacity: selectedShapeScaffold.opacity,
      pinned: false,
      defaultForPrimitive: false,
      tags: buildShapeScaffoldLibraryTags(
        selectedShapeScaffold.primitive,
        selectedShapeScaffoldSuggestion,
        getShapeScaffoldLibraryEntryName(
          selectedShapeScaffold.name,
          selectedShapeScaffoldSuggestion.title,
        ),
      ),
      usageCount: 0,
    }));
  }, [commitDocumentUpdate, selectedShapeScaffold, selectedShapeScaffoldSuggestion]);

  const handleApplyShapeScaffoldLibraryEntry = useCallback((entryId: string) => {
    const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(drawingDocument, entryId);
    if (!libraryEntry) {
      return;
    }

    const nextScaffoldId = createEditorDocumentId('shape-scaffold');
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentShapeScaffold(prev, {
      id: nextScaffoldId,
      name: createShapeScaffoldInstanceName(
        libraryEntry,
        (prev.metadata.shapeScaffolds?.length || 0) + 1,
      ),
      primitive: libraryEntry.primitive,
      suggestionId: libraryEntry.suggestionId,
      selections: Object.entries(libraryEntry.selections).reduce<ShapeIntentSelections>((result, [key, values]) => {
        result[key] = [...values];
        return result;
      }, {}),
      applyMode: libraryEntry.applyMode,
      frame: { ...libraryEntry.frame },
      visible: true,
      opacity: libraryEntry.opacity,
    }));

    setSelectedShapeScaffoldId(nextScaffoldId);
    setSelectedReferenceId(undefined);
    handleRecordShapeScaffoldLibraryEntryUsage(entryId);
  }, [commitDocumentUpdate, drawingDocument, handleRecordShapeScaffoldLibraryEntryUsage]);

  const handleRemoveShapeScaffoldLibraryEntry = useCallback((entryId: string) => {
    commitDocumentUpdate((prev) => removeStoryboardDrawingDocumentShapeScaffoldLibraryEntry(prev, entryId));
  }, [commitDocumentUpdate]);

  const handleDuplicateShapeScaffoldLibraryEntry = useCallback((entryId: string) => {
    const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(drawingDocument, entryId);
    const suggestion = getShapeIntentSuggestionDefinitionById(libraryEntry?.suggestionId);
    if (!libraryEntry || !suggestion) {
      return;
    }
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentShapeScaffoldLibraryEntry(prev, {
      name: `${libraryEntry.name} Copy`,
      primitive: libraryEntry.primitive,
      suggestionId: libraryEntry.suggestionId,
      selections: cloneShapeIntentSelections(libraryEntry.selections),
      applyMode: libraryEntry.applyMode,
      frame: { ...libraryEntry.frame },
      opacity: libraryEntry.opacity,
      pinned: false,
      defaultForPrimitive: false,
      tags: buildShapeScaffoldLibraryTags(libraryEntry.primitive, suggestion, `${libraryEntry.name} Copy`),
      usageCount: 0,
    }));
  }, [commitDocumentUpdate, drawingDocument]);

  const handleSetShapeScaffoldLibraryEntryDefault = useCallback((entryId: string) => {
    commitDocumentUpdate((prev) => {
      const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(prev, entryId);
      if (!libraryEntry) {
        return prev;
      }
      let next = prev;
      (prev.metadata.shapeScaffoldLibrary || []).forEach((entry) => {
        if (entry.primitive === libraryEntry.primitive && entry.defaultForPrimitive) {
          next = updateStoryboardDrawingDocumentShapeScaffoldLibraryEntry(next, entry.id, {
            defaultForPrimitive: false,
          });
        }
      });
      return updateStoryboardDrawingDocumentShapeScaffoldLibraryEntry(next, entryId, {
        defaultForPrimitive: true,
      });
    });
  }, [commitDocumentUpdate]);

  const handleOpenShapeScaffoldLibraryRename = useCallback((entryId: string) => {
    const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(drawingDocument, entryId);
    if (!libraryEntry) {
      return;
    }
    setShapeScaffoldLibraryRenameEntryId(entryId);
    setShapeScaffoldLibraryRenameValue(libraryEntry.name);
  }, [drawingDocument]);

  const handleCloseShapeScaffoldLibraryRename = useCallback(() => {
    setShapeScaffoldLibraryRenameEntryId(undefined);
    setShapeScaffoldLibraryRenameValue('');
  }, []);

  const handleSaveShapeScaffoldLibraryRename = useCallback(() => {
    if (!shapeScaffoldLibraryRenameEntryId) {
      return;
    }
    const nextName = shapeScaffoldLibraryRenameValue.trim();
    if (!nextName) {
      return;
    }
    commitDocumentUpdate((prev) => {
      const libraryEntry = getStoryboardDocumentShapeScaffoldLibraryEntryById(prev, shapeScaffoldLibraryRenameEntryId);
      const suggestion = getShapeIntentSuggestionDefinitionById(libraryEntry?.suggestionId);
      if (!libraryEntry || !suggestion) {
        return prev;
      }
      return updateStoryboardDrawingDocumentShapeScaffoldLibraryEntry(prev, shapeScaffoldLibraryRenameEntryId, {
        name: nextName,
        tags: buildShapeScaffoldLibraryTags(libraryEntry.primitive, suggestion, nextName),
      });
    });
    handleCloseShapeScaffoldLibraryRename();
  }, [
    commitDocumentUpdate,
    handleCloseShapeScaffoldLibraryRename,
    shapeScaffoldLibraryRenameEntryId,
    shapeScaffoldLibraryRenameValue,
  ]);

  const handleExportShapeScaffoldLibrary = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: shapeScaffoldLibraryEntries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlobFile(blob, `shape-scaffold-library-${new Date().toISOString().slice(0, 10)}.json`);
  }, [shapeScaffoldLibraryEntries]);

  const handleImportShapeScaffoldLibrary = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as { entries?: StoryboardDocumentShapeScaffoldLibraryEntry[] } | StoryboardDocumentShapeScaffoldLibraryEntry[];
      const importedEntries = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.entries)
          ? parsed.entries
          : [];
      commitDocumentUpdate((prev) => importedEntries.reduce((nextDocument, entry) => addStoryboardDrawingDocumentShapeScaffoldLibraryEntry(nextDocument, {
        name: entry.name,
        primitive: entry.primitive,
        suggestionId: entry.suggestionId,
        selections: cloneShapeIntentSelections(entry.selections),
        applyMode: entry.applyMode,
        frame: { ...entry.frame },
        opacity: entry.opacity,
        pinned: entry.pinned,
        defaultForPrimitive: entry.defaultForPrimitive,
        tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
        usageCount: entry.usageCount,
        lastUsedAt: entry.lastUsedAt,
      }), prev));
    } catch (error) {
      console.error('Failed to import shape scaffold library', error);
    } finally {
      event.target.value = '';
    }
  }, [commitDocumentUpdate]);

  const handleStartShapeIntentReferenceStudy = useCallback(() => {
    if (!shapeIntentAnalysis || !selectedShapeIntentSuggestion) {
      return;
    }

    const referenceSvg = buildShapeIntentReferenceDataUrl(
      shapeIntentAnalysis,
      selectedShapeIntentSuggestion,
      activeShapeIntentSelections,
      { width: canvasDimensions.width, height: canvasDimensions.height },
      shapeIntentPreviewStrokes,
      `${shapeIntentParameterSummary} · Study Mode`,
    );
    const nextReferenceId = addShapeIntentReferenceAsset(
      `${selectedShapeIntentSuggestion.title} Study`,
      referenceSvg,
      0.86,
    );
    if (!nextReferenceId) {
      return;
    }

    const { nextStrokes, baselineStrokeCount } = getShapeIntentStudyBaseline();
    setEditorStrokesFromLocal(nextStrokes);
    setHasUnsavedChanges(true);
    setShapeIntentParkedPrimitive(shapeIntentAnalysis.displayLabel);
    setShapeIntentSuppressedStrokeCount(nextStrokes.length);
    handleBeginReferenceStudySession(nextReferenceId, baselineStrokeCount, { allowPendingReference: true });
  }, [
    addShapeIntentReferenceAsset,
    canvasDimensions.height,
    canvasDimensions.width,
    getShapeIntentStudyBaseline,
    handleBeginReferenceStudySession,
    selectedShapeIntentSuggestion,
    shapeIntentAnalysis,
    shapeIntentParameterSummary,
    shapeIntentPreviewStrokes,
    activeShapeIntentSelections,
  ]);

  const handleStartShapeIntentVariantStudy = useCallback(() => {
    if (!shapeIntentAnalysis || shapeIntentVariantCards.length === 0) {
      return;
    }

    const variantReferencePlans = shapeIntentVariantCards.map((variantCard, index) => ({
      id: createEditorDocumentId('reference'),
      variantCard,
      opacity: variantCard.suggestion.id === selectedShapeIntentSuggestion?.id ? 0.86 : index === 0 ? 0.8 : 0.72,
    }));
    const selectedStudyReferenceId = (
      variantReferencePlans.find((entry) => entry.variantCard.suggestion.id === selectedShapeIntentSuggestion?.id)
      || variantReferencePlans[0]
    )?.id;
    commitDocumentUpdate((prev) => {
      let nextDocument = prev;
      variantReferencePlans.forEach(({ id, opacity, variantCard }) => {
        nextDocument = addStoryboardDrawingDocumentReference(nextDocument, {
          id,
          name: `${variantCard.suggestion.title} Study`,
          src: variantCard.previewDataUrl,
          opacity,
          visible: true,
          x: 0,
          y: 0,
          width: canvasDimensions.width,
          height: canvasDimensions.height,
          fitMode: 'free',
        });
      });
      return nextDocument;
    });

    if (!selectedStudyReferenceId) {
      return;
    }

    const { nextStrokes, baselineStrokeCount } = getShapeIntentStudyBaseline();
    setEditorStrokesFromLocal(nextStrokes);
    setHasUnsavedChanges(true);
    setShapeIntentParkedPrimitive(shapeIntentAnalysis.displayLabel);
    setShapeIntentSuppressedStrokeCount(nextStrokes.length);
    handleBeginReferenceStudySession(selectedStudyReferenceId, baselineStrokeCount, { allowPendingReference: true });
  }, [
    canvasDimensions.height,
    canvasDimensions.width,
    commitDocumentUpdate,
    getShapeIntentStudyBaseline,
    handleBeginReferenceStudySession,
    selectedShapeIntentSuggestion?.id,
    shapeIntentAnalysis,
    shapeIntentVariantCards,
  ]);

  const handleDismissShapeIntent = useCallback(() => {
    setShapeIntentParkedPrimitive(shapeIntentAnalysis?.displayLabel || null);
    setShapeIntentSuppressedStrokeCount(strokes.length);
  }, [shapeIntentAnalysis?.displayLabel, strokes.length]);

  const handleStartReferenceStudy = useCallback(() => {
    if (!activeReferenceRecord) {
      return;
    }
    handleBeginReferenceStudySession(activeReferenceRecord.id, strokes.length);
  }, [activeReferenceRecord, handleBeginReferenceStudySession, strokes.length]);

  const handleSaveReferenceStudyAttempt = useCallback(() => {
    if (!referenceStudyActive || referenceStudyBaselineStrokeCount === null || referenceStudyAttemptStrokes.length === 0) {
      return;
    }

    const existingAttempt = referenceStudyAttempts.find((attempt) => attempt.strokeSignature === referenceStudyAttemptSignature);
    if (existingAttempt) {
      setSelectedReferenceStudyAttemptId(existingAttempt.id);
      setReferenceStudyGhostEnabled(true);
      setReferenceStudyReveal(false);
      return;
    }

    const previewDataUrl = createReferenceStudyAttemptPreviewDataUrl(
      exportCanvasWidth,
      exportCanvasHeight,
      referenceStudyAttemptStrokes
    );
    if (!previewDataUrl) {
      return;
    }

    const createdAt = new Date().toISOString();
    const nextAttempt: ReferenceStudyAttemptRecord = {
      id: `reference-study-attempt-${createdAt}`,
      name: `Attempt ${referenceStudyAttempts.length + 1}`,
      createdAt,
      strokeCount: referenceStudyAttemptStrokes.length,
      pointCount: referenceStudyAttemptPointCount,
      strokeSignature: referenceStudyAttemptSignature,
      strokes: referenceStudyAttemptStrokes.map(clonePencilStroke),
      previewDataUrl,
      metrics: currentReferenceStudyAttemptMetrics,
      ...deriveReferenceStudyReadLabels(currentReferenceStudyAttemptMetrics),
      ...deriveReferenceStudyAttemptDrillResult(
        selectedReferenceStudyAttempt ? referenceStudyActiveDrillId : undefined,
        currentReferenceStudyAttemptMetrics,
        selectedReferenceStudyAttempt?.metrics,
        selectedReferenceStudyAttempt?.name,
      ),
    };

    setReferenceStudyAttempts((prev) => [nextAttempt, ...prev].slice(0, 8));
    setSelectedReferenceStudyAttemptId(nextAttempt.id);
    setReferenceStudyGhostEnabled(true);
    setReferenceStudyReveal(false);
  }, [
    exportCanvasHeight,
    exportCanvasWidth,
    referenceStudyActive,
    referenceStudyAttemptPointCount,
    referenceStudyAttemptSignature,
    referenceStudyAttemptStrokes,
    referenceStudyAttempts,
    referenceStudyBaselineStrokeCount,
    currentReferenceStudyAttemptMetrics,
    referenceStudyActiveDrillId,
    selectedReferenceStudyAttempt,
  ]);

  const handleStartNextReferenceStudyRound = useCallback(() => {
    if (!referenceStudyActive || referenceStudyBaselineStrokeCount === null) {
      return;
    }

    if (referenceStudyAttemptStrokes.length > 0) {
      const existingAttempt = referenceStudyAttempts.find((attempt) => attempt.strokeSignature === referenceStudyAttemptSignature);
      if (!existingAttempt) {
        const previewDataUrl = createReferenceStudyAttemptPreviewDataUrl(
          exportCanvasWidth,
          exportCanvasHeight,
          referenceStudyAttemptStrokes
        );
        if (previewDataUrl) {
          const createdAt = new Date().toISOString();
          const nextAttempt: ReferenceStudyAttemptRecord = {
            id: `reference-study-attempt-${createdAt}`,
            name: `Attempt ${referenceStudyAttempts.length + 1}`,
            createdAt,
            strokeCount: referenceStudyAttemptStrokes.length,
            pointCount: referenceStudyAttemptPointCount,
            strokeSignature: referenceStudyAttemptSignature,
            strokes: referenceStudyAttemptStrokes.map(clonePencilStroke),
            previewDataUrl,
            metrics: currentReferenceStudyAttemptMetrics,
            ...deriveReferenceStudyReadLabels(currentReferenceStudyAttemptMetrics),
            ...deriveReferenceStudyAttemptDrillResult(
              selectedReferenceStudyAttempt ? referenceStudyActiveDrillId : undefined,
              currentReferenceStudyAttemptMetrics,
              selectedReferenceStudyAttempt?.metrics,
              selectedReferenceStudyAttempt?.name,
            ),
          };
          setReferenceStudyAttempts((prev) => [nextAttempt, ...prev].slice(0, 8));
          setSelectedReferenceStudyAttemptId(nextAttempt.id);
        } else if (referenceStudyAttempts[0]) {
          setSelectedReferenceStudyAttemptId(referenceStudyAttempts[0].id);
        }
      } else {
        setSelectedReferenceStudyAttemptId(existingAttempt.id);
      }
    }

    setReferenceStudyGhostEnabled((referenceStudyAttempts.length > 0 || referenceStudyAttemptStrokes.length > 0));
    setReferenceStudyReveal(false);
    setEditorStrokesFromLocal((prev) => prev.slice(0, referenceStudyBaselineStrokeCount));
    setReferenceStudyBaselineStrokeCount(referenceStudyBaselineStrokeCount);
  }, [
    exportCanvasHeight,
    exportCanvasWidth,
    referenceStudyActive,
    referenceStudyAttemptPointCount,
    referenceStudyAttemptSignature,
    referenceStudyAttemptStrokes,
    referenceStudyAttempts,
    referenceStudyBaselineStrokeCount,
    currentReferenceStudyAttemptMetrics,
    referenceStudyActiveDrillId,
    selectedReferenceStudyAttempt,
  ]);

  const handleRevealReferenceStudy = useCallback(() => {
    if (!referenceStudyActive) {
      return;
    }
    setReferenceStudyReveal((prev) => !prev);
  }, [referenceStudyActive]);

  const handleResetReferenceStudy = useCallback(() => {
    setReferenceStudyActive(false);
    setReferenceStudyReveal(false);
    setReferenceStudyReferenceId(undefined);
    setReferenceStudyBaselineStrokeCount(null);
    setReferenceStudyArmedDrillId(undefined);
    setReferenceStudyAttempts([]);
    setSelectedReferenceStudyAttemptId(undefined);
    setReferenceStudyGhostEnabled(false);
  }, []);

  const handleSelectReferenceStudyAttempt = useCallback((attemptId: string) => {
    setSelectedReferenceStudyAttemptId(attemptId);
    setReferenceStudyGhostEnabled(true);
    setReferenceStudyReveal(false);
  }, []);

  const handlePromoteReferenceStudyAttemptToVariant = useCallback((attemptId: string) => {
    if (referenceStudyBaselineStrokeCount === null) {
      return;
    }

    const attempt = referenceStudyAttempts.find((entry) => entry.id === attemptId);
    if (!attempt) {
      return;
    }

    const updatedAt = new Date().toISOString();
    commitDocumentUpdate((prev) => {
      const duplicatedDocument = duplicateStoryboardDrawingDocumentSheet(
        prev,
        activeSheetId,
        {
          name: `${activeSheet?.name || 'Sheet'} · ${attempt.name}`,
        },
        updatedAt,
      );
      const variantSheetId = duplicatedDocument.primarySheetId;
      const variantLayerId = getStoryboardDocumentActiveLayerId(duplicatedDocument, variantSheetId)
        || getStoryboardDocumentSheetById(duplicatedDocument, variantSheetId)?.layerIds[0];
      if (!variantLayerId) {
        return duplicatedDocument;
      }

      const baselineLayerStrokes = getStoryboardDocumentDrawingLayerStrokes(
        prev,
        getStoryboardDocumentActiveLayerId(prev, activeSheetId) || activeLayerId || variantLayerId,
      ).slice(0, referenceStudyBaselineStrokeCount).map(clonePencilStroke);

      return updateStoryboardDrawingDocumentSheetContent(duplicatedDocument, variantSheetId, {
        layerId: variantLayerId,
        strokes: [...baselineLayerStrokes, ...attempt.strokes.map(clonePencilStroke)],
        updatedAt,
      });
    });

    setReferenceStudyActive(false);
    setReferenceStudyReveal(false);
    setReferenceStudyBaselineStrokeCount(null);
    setReferenceStudyArmedDrillId(undefined);
    setReferenceStudyGhostEnabled(false);
  }, [
    activeLayerId,
    activeSheet?.name,
    activeSheetId,
    commitDocumentUpdate,
    referenceStudyAttempts,
    referenceStudyBaselineStrokeCount,
  ]);

  const handleSelectReference = useCallback((referenceId: string) => {
    setSelectedReferenceId(referenceId);
    setSelectedShapeScaffoldId(undefined);
  }, []);

  const handleToggleReferenceVisibility = useCallback((referenceId: string) => {
    commitDocumentUpdate((prev) => {
      const reference = getStoryboardDocumentReferenceById(prev, referenceId);
      if (!reference) return prev;
      return updateStoryboardDrawingDocumentReference(prev, referenceId, { visible: !reference.visible });
    });
  }, [commitDocumentUpdate]);

  const handleRemoveReference = useCallback((referenceId: string) => {
    commitDocumentUpdate((prev) => removeStoryboardDrawingDocumentReference(prev, referenceId));
    setSelectedReferenceId((prev) => (prev === referenceId ? undefined : prev));
  }, [commitDocumentUpdate]);

  const handleRotateReference = useCallback((reference: StoryboardDocumentReferenceImage | undefined) => {
    if (!reference) return;
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentReference(prev, reference.id, {
      rotation: (reference.rotation || 0) + 15,
    }));
  }, [commitDocumentUpdate]);

  const handleCycleReferenceFitMode = useCallback((reference: StoryboardDocumentReferenceImage | undefined) => {
    if (!reference) return;
    const nextFitMode = reference.fitMode === 'contain' ? 'cover' : reference.fitMode === 'cover' ? 'free' : 'contain';
    const nextWidth = nextFitMode === 'cover'
      ? Math.round(canvasDimensions.width * 0.88)
      : nextFitMode === 'contain'
        ? Math.round(canvasDimensions.width * 0.48)
        : reference.width;
    const nextHeight = nextFitMode === 'cover'
      ? Math.round(canvasDimensions.height * 0.88)
      : nextFitMode === 'contain'
        ? Math.round(canvasDimensions.height * 0.48)
        : reference.height;
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentReference(prev, reference.id, {
      fitMode: nextFitMode,
      width: nextWidth,
      height: nextHeight,
    }));
  }, [canvasDimensions.height, canvasDimensions.width, commitDocumentUpdate]);

  const handleCanvasResolutionPreset = useCallback((preset: (typeof STUDIO_CANVAS_RESOLUTION_PRESETS)[number]) => {
    if (!activeSpatialCanvas) return;
    const nextResolution = getCanvasResolutionForPreset(preset, activeSpatialCanvas.aspectRatio || (aspectRatio as StoryboardDocumentAspectRatio));
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentCanvas(prev, activeSpatialCanvas.id, {
      width: nextResolution.width,
      height: nextResolution.height,
      aspectRatio: activeSpatialCanvas.aspectRatio || (aspectRatio as StoryboardDocumentAspectRatio),
    }));
  }, [activeSpatialCanvas, aspectRatio, commitDocumentUpdate]);

  const handleExposureChange = useCallback((nextExposure: number) => {
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentSheetExposure(prev, activeSheetId, nextExposure));
  }, [activeSheetId, commitDocumentUpdate]);

  const handleLayerStateChange = useCallback((nextLayerState: { layers: DrawingLayer[]; activeLayerId: string }) => {
    commitDocumentUpdate((prev) => {
      let next = prev;
      const currentLayers = getStoryboardDocumentSheetRenderableLayers(prev, activeSheetId);
      const currentSignature = buildLayerSignature(currentLayers, getStoryboardDocumentActiveLayerId(prev, activeSheetId));
      const nextSignature = JSON.stringify({
        activeLayerId: nextLayerState.activeLayerId,
        layers: nextLayerState.layers.map((layer) => ({
          id: layer.id,
          name: layer.name,
          visible: layer.visible,
          locked: layer.locked,
          opacity: Math.round(layer.opacity * 1000) / 1000,
          blendMode: layer.blendMode,
        })),
      });
      if (currentSignature === nextSignature) {
        return prev;
      }

      nextLayerState.layers.forEach((layer, index) => {
        const currentLayer = getStoryboardDocumentSheetRenderableLayers(next, activeSheetId).find((entry) => entry.id === layer.id);
        if (!currentLayer) {
          return;
        }
        const currentIndex = getStoryboardDocumentSheetLayers(next, activeSheetId).findIndex((entry) => entry.id === layer.id);
        if (currentIndex !== index) {
          next = reorderStoryboardDrawingDocumentLayer(next, activeSheetId, layer.id, index);
        }
        if (currentLayer.name !== layer.name
          || currentLayer.visible !== layer.visible
          || currentLayer.locked !== layer.locked
          || Math.abs(currentLayer.opacity - layer.opacity) > 0.001
          || currentLayer.blendMode !== layer.blendMode) {
          next = updateStoryboardDrawingDocumentLayer(next, layer.id, {
            name: layer.name,
            visible: layer.visible,
            locked: layer.locked,
            opacity: layer.opacity,
            blendMode: layer.blendMode as StoryboardDocumentBlendMode,
          });
        }
      });

      const nextActiveLayerId = nextLayerState.activeLayerId || nextLayerState.layers[0]?.id;
      if (nextActiveLayerId && getStoryboardDocumentActiveLayerId(next, activeSheetId) !== nextActiveLayerId) {
        next = setStoryboardDrawingDocumentActiveLayer(next, activeSheetId, nextActiveLayerId);
      }

      drawingDocumentRef.current = next;
      return next;
    });
  }, [activeSheetId, commitDocumentUpdate]);

  const handleSelectLayer = useCallback((layerId: string) => {
    setSelectedStudioLayerId(layerId);
    commitDocumentUpdate((prev) => setStoryboardDrawingDocumentActiveLayer(prev, activeSheetId, layerId));
  }, [activeSheetId, commitDocumentUpdate]);

  const handleToggleLayerSelection = useCallback((layerId: string) => {
    setSelectedStudioLayerId(layerId);
    setSelectedLayerIds((prev) => (
      prev.includes(layerId)
        ? prev.filter((entry) => entry !== layerId)
        : [...prev, layerId]
    ));
  }, []);

  const handleToggleLayerCollapsed = useCallback((layerId: string) => {
    setCollapsedInspectorLayerIds((prev) => {
      const next = prev.includes(layerId)
        ? prev.filter((entry) => entry !== layerId)
        : [...prev, layerId];
      return next;
    });
    setSelectedLayerIds((prev) => prev.filter((entry) => entry === layerId || !isStudioLayerDescendantOf(entry, layerId)));
    setSelectedStudioLayerId((prev) => (prev && isStudioLayerDescendantOf(prev, layerId) ? layerId : prev));
  }, [isStudioLayerDescendantOf]);

  const handleAddLayer = useCallback(() => {
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentLayer(prev, activeSheetId));
  }, [activeSheetId, commitDocumentUpdate]);

  const commitBoardPolishEffectLayerStates = useCallback((
    nextEffectLayers: BoardPolishDraftState['effectLayers'],
  ) => {
    const normalizedEffectLayers = createBoardPolishEffectLayerStates(nextEffectLayers);
    setBoardPolishEffectLayerStates(normalizedEffectLayers);
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentBoardPolish(prev, {
      mode: boardPolishMode,
      tone: boardPolishTone,
      finish: boardPolishFinish,
      weather: boardPolishWeather,
      atmosphere: Number(boardPolishAtmosphere.toFixed(3)),
      lineBoost: Number(boardPolishLineBoost.toFixed(3)),
      vignette: Number(boardPolishVignette.toFixed(3)),
      effectLayers: normalizedEffectLayers,
      effectRegions: createBoardPolishEffectRegions(boardPolishEffectRegions),
    }));
  }, [
    boardPolishAtmosphere,
    boardPolishEffectRegions,
    boardPolishFinish,
    boardPolishLineBoost,
    boardPolishMode,
    boardPolishTone,
    boardPolishVignette,
    boardPolishWeather,
    commitDocumentUpdate,
  ]);

  const commitBoardPolishEffectRegions = useCallback((
    nextEffectRegions: BoardPolishDraftState['effectRegions'],
  ) => {
    const normalizedEffectRegions = createBoardPolishEffectRegions(nextEffectRegions);
    setBoardPolishEffectRegions(normalizedEffectRegions);
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentBoardPolish(prev, {
      mode: boardPolishMode,
      tone: boardPolishTone,
      finish: boardPolishFinish,
      weather: boardPolishWeather,
      atmosphere: Number(boardPolishAtmosphere.toFixed(3)),
      lineBoost: Number(boardPolishLineBoost.toFixed(3)),
      vignette: Number(boardPolishVignette.toFixed(3)),
      effectLayers: createBoardPolishEffectLayerStates(boardPolishEffectLayerStates),
      effectRegions: normalizedEffectRegions,
    }));
  }, [
    boardPolishAtmosphere,
    boardPolishEffectLayerStates,
    boardPolishFinish,
    boardPolishLineBoost,
    boardPolishMode,
    boardPolishTone,
    boardPolishVignette,
    boardPolishWeather,
    commitDocumentUpdate,
  ]);

  const handleToggleBoardPolishEffectLayer = useCallback((layerId: StoryboardDocumentBoardPolishEffectLayerId) => {
    commitBoardPolishEffectLayerStates(boardPolishEffectLayerStates.map((layer) => (
      layer.id === layerId
        ? {
            ...layer,
            enabled: !layer.enabled,
          }
        : layer
    )));
  }, [boardPolishEffectLayerStates, commitBoardPolishEffectLayerStates]);

  const handleSetBoardPolishEffectLayerOpacity = useCallback((
    layerId: StoryboardDocumentBoardPolishEffectLayerId,
    value: number,
  ) => {
    commitBoardPolishEffectLayerStates(boardPolishEffectLayerStates.map((layer) => (
      layer.id === layerId
        ? {
            ...layer,
            opacity: Math.max(0, Math.min(1, value)),
          }
        : layer
    )));
  }, [boardPolishEffectLayerStates, commitBoardPolishEffectLayerStates]);

  const handleSetBoardPolishEffectRegion = useCallback((
    effectId: StoryboardDocumentBoardPolishEffectLayerId,
    region: StoryboardDocumentBoardPolishEffectRegion,
  ) => {
    commitBoardPolishEffectRegions(boardPolishEffectRegions.map((entry) => (
      entry.id === effectId
        ? clampBoardPolishEffectRegion(region)
        : entry
    )));
  }, [boardPolishEffectRegions, commitBoardPolishEffectRegions]);

  const handleApplyBoardPolishEffectRegionPreset = useCallback((
    effectId: StoryboardDocumentBoardPolishEffectLayerId,
    presetId: (typeof BOARD_POLISH_EFFECT_REGION_PRESETS)[number]['id'],
  ) => {
    const preset = BOARD_POLISH_EFFECT_REGION_PRESETS.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }
    handleSetBoardPolishEffectRegion(effectId, {
      id: effectId,
      ...preset.region,
    });
  }, [handleSetBoardPolishEffectRegion]);

  const handleSetBoardPolishEffectRegionFeather = useCallback((
    effectId: StoryboardDocumentBoardPolishEffectLayerId,
    feather: number,
  ) => {
    const region = boardPolishEffectRegions.find((entry) => entry.id === effectId);
    if (!region) {
      return;
    }
    handleSetBoardPolishEffectRegion(effectId, {
      ...region,
      feather: Math.max(0, Math.min(0.48, feather)),
    });
  }, [boardPolishEffectRegions, handleSetBoardPolishEffectRegion]);

  const handleDeleteLayer = useCallback((layerId: string) => {
    commitDocumentUpdate((prev) => removeStoryboardDrawingDocumentLayer(prev, activeSheetId, layerId));
  }, [activeSheetId, commitDocumentUpdate]);

  const handleToggleLayerVisibility = useCallback((layerId: string) => {
    const layer = activeSheetLayerStack.find((entry) => entry.id === layerId);
    if (!layer) return;
    if (layer.type === 'effect' && layer.effectId) {
      handleToggleBoardPolishEffectLayer(layer.effectId);
      return;
    }
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentLayer(prev, layerId, { visible: !layer.visible }));
  }, [activeSheetLayerStack, commitDocumentUpdate, handleToggleBoardPolishEffectLayer]);

  const handleChangeLayerOpacity = useCallback((layerId: string, opacity: number) => {
    const layer = activeSheetLayerStack.find((entry) => entry.id === layerId);
    if (layer?.type === 'effect' && layer.effectId) {
      handleSetBoardPolishEffectLayerOpacity(layer.effectId, opacity);
      return;
    }
    commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentLayer(prev, layerId, { opacity }));
  }, [activeSheetLayerStack, commitDocumentUpdate, handleSetBoardPolishEffectLayerOpacity]);

  const handleGroupSelectedLayers = useCallback(() => {
    if (!canGroupSelectedLayers) return;
    commitDocumentUpdate((prev) => groupStoryboardDrawingDocumentLayers(prev, activeSheetId, selectedLayerCards.map((layer) => layer.id)));
    setSelectedLayerIds([]);
  }, [activeSheetId, canGroupSelectedLayers, commitDocumentUpdate, selectedLayerCards]);

  const handleUngroupSelectedLayer = useCallback(() => {
    if (!selectedStudioLayer || selectedStudioLayer.type !== 'group') return;
    commitDocumentUpdate((prev) => ungroupStoryboardDrawingDocumentLayer(prev, activeSheetId, selectedStudioLayer.id));
    setSelectedLayerIds((prev) => prev.filter((entry) => entry !== selectedStudioLayer.id));
    setSelectedStudioLayerId(undefined);
  }, [activeSheetId, commitDocumentUpdate, selectedStudioLayer]);

  const handleAddMotionRig = useCallback(() => {
    const targetLayerId = selectedStudioLayer?.type === 'effect'
      ? activeLayerId
      : (selectedStudioLayer?.id || activeLayerId);
    if (!targetLayerId) return;
    commitDocumentUpdate((prev) => addStoryboardDrawingDocumentTransformationLayer(prev, activeSheetId, [targetLayerId], {
      name: `${selectedStudioLayer?.label || 'Layer'} Motion`,
      frame: activeTimelineFrameIndex,
      pivotMode: 'per-layer',
    }));
  }, [activeLayerId, activeSheetId, activeTimelineFrameIndex, commitDocumentUpdate, selectedStudioLayer]);

  const handleMotionRigChange = useCallback((
    updates: Partial<Pick<StoryboardDocumentAppliedTransform, 'translateX' | 'translateY' | 'scaleX' | 'scaleY' | 'rotation' | 'perspectiveX' | 'perspectiveY'>> & {
      cornerWarp?: StoryboardDocumentCornerWarp;
    }
  ) => {
    if (!activeMotionRig) return;
    commitDocumentUpdate((prev) => upsertStoryboardDrawingDocumentTransformationKeyframe(
      prev,
      activeMotionRig.layer.id,
      activeTimelineFrameIndex,
      {
        translateX: updates.translateX ?? activeMotionRig.currentTransform.translateX,
        translateY: updates.translateY ?? activeMotionRig.currentTransform.translateY,
        scaleX: updates.scaleX ?? activeMotionRig.currentTransform.scaleX,
        scaleY: updates.scaleY ?? activeMotionRig.currentTransform.scaleY,
        rotation: updates.rotation ?? activeMotionRig.currentTransform.rotation,
        perspectiveX: updates.perspectiveX ?? activeMotionRig.currentTransform.perspectiveX,
        perspectiveY: updates.perspectiveY ?? activeMotionRig.currentTransform.perspectiveY,
        cornerWarp: updates.cornerWarp ?? activeMotionRig.currentTransform.cornerWarp ?? createIdentityMotionRigCornerWarp(),
        easing: activeMotionRig.activeKeyframe?.easing || 'linear',
      },
    ));
  }, [activeMotionRig, activeTimelineFrameIndex, commitDocumentUpdate]);
  const handleMotionRigCornerWarpChange = useCallback((
    corner: StoryboardDocumentCornerWarpCorner,
    axis: 'x' | 'y',
    value: number,
  ) => {
    if (!activeMotionRig) return;
    const nextCornerWarp: StoryboardDocumentCornerWarp = {
      ...(activeMotionRig.currentTransform.cornerWarp ?? createIdentityMotionRigCornerWarp()),
      [corner]: {
        ...((activeMotionRig.currentTransform.cornerWarp ?? createIdentityMotionRigCornerWarp())[corner]),
        [axis]: value,
      },
    };
    handleMotionRigChange({ cornerWarp: nextCornerWarp });
  }, [activeMotionRig, handleMotionRigChange]);

  const handleReorderLayer = useCallback((fromIndex: number, toIndex: number) => {
    const layerId = editorLayers[fromIndex]?.id;
    if (!layerId) return;
    commitDocumentUpdate((prev) => reorderStoryboardDrawingDocumentLayer(prev, activeSheetId, layerId, toIndex));
  }, [activeSheetId, commitDocumentUpdate, editorLayers]);

  const handleMergeLayer = useCallback((layerId: string) => {
    commitDocumentUpdate((prev) => mergeStoryboardDrawingDocumentLayerDown(prev, activeSheetId, layerId));
  }, [activeSheetId, commitDocumentUpdate]);

  const handleDuplicateLayer = useCallback((layerId: string) => {
    commitDocumentUpdate((prev) => duplicateStoryboardDrawingDocumentLayer(prev, activeSheetId, layerId));
  }, [activeSheetId, commitDocumentUpdate]);

  useEffect(() => {
    setBrushSettings((prev) => {
      const nextType: BrushType = highlightMode ? 'highlighter' : brushType;
      const nextOpacity = highlightMode ? 0.35 : prev.opacity;
      const nextSize = autoEnhance ? Math.max(prev.size, 4) : prev.size;
      if (prev.type === nextType && prev.opacity === nextOpacity && prev.size === nextSize) {
        return prev;
      }
      return {
        ...prev,
        type: nextType,
        opacity: nextOpacity,
        size: nextSize,
      };
    });
  }, [brushType, highlightMode, autoEnhance]);

  useEffect(() => {
    if (!isThumbnailWorkflow) return;
    setBrushType('pen');
    setProBrushType('pen');
    setHighlightMode(false);
    setAutoEnhance(false);
    setFlowValue(48);
    setStabilizeValue(20);
    setBrushSettings((prev) => {
      if (prev.type === 'pen' && prev.size === 3 && prev.color === '#ffffff' && prev.opacity === 1) {
        return prev;
      }
      return {
        ...prev,
        type: 'pen',
        size: 3,
        color: '#ffffff',
        opacity: 1,
      };
    });
  }, [isThumbnailWorkflow]);

  const handleUndo = useCallback(() => {
    getCanvasApi()?.undo();
  }, [getCanvasApi]);

  const handleRedo = useCallback(() => {
    getCanvasApi()?.redo();
  }, [getCanvasApi]);

  const handleClear = useCallback(() => {
    getCanvasApi()?.clear();
    setHasUnsavedChanges(true);
  }, [getCanvasApi]);

  useEffect(() => {
    if (proMode) {
      proCanvasRef.current?.setBrush({
        type: proBrushType,
        size: brushSettings.size,
        color: brushSettings.color,
        opacity: brushSettings.opacity,
      });
      return;
    }
    standardCanvasRef.current?.setBrush(brushSettings);
  }, [proMode, proBrushType, brushSettings]);

  const handleSaveFromToolbar = useCallback(() => {
    getCanvasApi()?.save();
  }, [getCanvasApi]);

  const handleTimeLapseToggle = useCallback(() => {
    if (!timeLapseStats.available || timeLapseStats.replayDurationMs <= 0) {
      return;
    }
    setTimeLapsePlaying((prev) => {
      if (prev) {
        return false;
      }
      setTimeLapseProgressMs((current) => (
        current >= timeLapseStats.replayDurationMs - 32 ? 0 : current
      ));
      return true;
    });
  }, [timeLapseStats.available, timeLapseStats.replayDurationMs]);

  // Handle stroke changes
  const handleStrokesChange = useCallback((newStrokes: PencilStroke[]) => {
    setEditorStrokesFromLocal(newStrokes);
    setHasUnsavedChanges(true);
  }, []);

  // Handle save
  const handleSave = useCallback((imageData: string) => {
    const normalizedBrushSettings: NonNullable<FrameDrawingData['brushSettings']> = {
      type: proMode ? proBrushType : brushSettings.type,
      size: brushSettings.size,
      color: brushSettings.color,
      opacity: brushSettings.opacity,
    };
    const updatedAt = new Date().toISOString();
    const resolvedBaseImageUrl = activeBaseImage || undefined;
    const baseDocument = drawingDocumentRef.current || createStoryboardDrawingDocument({
      frameId,
      storyboardId,
      aspectRatio: aspectRatio as StoryboardDocumentAspectRatio,
      workflowLevel: workflowLevel as StoryboardDocumentWorkflowLevel,
      strokes,
      baseImageUrl: resolvedBaseImageUrl,
      imageDataUrl: imageData,
      brushSettings: normalizedBrushSettings,
      referenceImage: toDocumentReferenceSeed(activeReferenceImage),
      updatedAt,
    });
    const sheetContentDocument = updateStoryboardDrawingDocumentSheetContent(baseDocument, activeSheetId, {
      strokes,
      layerId: activeLayerId,
      brushSettings: normalizedBrushSettings,
      baseImageUrl: resolvedBaseImageUrl,
      imageDataUrl: imageData,
      workflowLevel: workflowLevel as StoryboardDocumentWorkflowLevel,
      updatedAt,
    });
    const referenceStudyDocument = updateStoryboardDrawingDocumentReferenceStudy(
      sheetContentDocument,
      referenceStudyDocumentSnapshot,
      updatedAt,
    );
    const nextDrawingDocument = updateStoryboardDrawingDocumentBoardPolish(
      referenceStudyDocument,
      boardPolishDocumentSnapshot,
      updatedAt,
    );
    drawingDocumentRef.current = nextDrawingDocument;
    setDrawingDocument(nextDrawingDocument);
    const drawingData: FrameDrawingData = {
      dataUrl: imageData,
      strokes: JSON.stringify(getStoryboardDocumentSheetStrokes(nextDrawingDocument, activeSheetId)),
      document: nextDrawingDocument,
      baseImageUrl: resolvedBaseImageUrl,
      originalBaseImageUrl: nextDrawingDocument.metadata.originalBaseImageUrl,
      brushSettings: normalizedBrushSettings,
      deviceType: device.hasPencilSupport ? 'pencil' : device.hasTouchScreen ? 'touch' : 'mouse',
      createdAt: initialDrawingData?.createdAt || updatedAt,
      updatedAt,
    };

    // Update frame in store if we have a frame ID
    if (frameId && storyboardId) {
      const imageSource: FrameImageSource = strokes.length > 0 ? 'drawn' : resolvedBaseImageUrl ? 'uploaded' : 'drawn';
      const framePatch: Partial<StoryboardFrame> = {
        imageUrl: imageData,
        drawingData,
        imageSource,
        updatedAt,
      };
      updateFrame(frameId, framePatch);
      roleRoomAnalytics.storyboardFrameCreated({
        project_id: storyboardId,
        frame_id: frameId,
      });
    }

    // Call external save handler
    onSave?.(drawingData, imageData);

    setLastSavedImage(imageData);
    setHasUnsavedChanges(false);
  }, [
    aspectRatio,
    brushSettings,
    device,
    frameId,
    initialDrawingData?.createdAt,
    initialImage,
    onSave,
    activeSheetId,
    activeLayerId,
    proMode,
    proBrushType,
    activeReferenceImage,
    activeBaseImage,
    boardPolishDocumentSnapshot,
    referenceStudyDocumentSnapshot,
    storyboardId,
    strokes,
    updateFrame,
    workflowLevel,
  ]);

  // Handle cancel with unsaved changes check
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
    } else {
      onCancel?.();
    }
  }, [hasUnsavedChanges, onCancel]);

  // Discard changes and close
  const handleDiscardChanges = useCallback(() => {
    setShowDiscardDialog(false);
    setHasUnsavedChanges(false);
    onCancel?.();
  }, [onCancel]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleToggleBoardPolishMode = useCallback(() => {
    setBoardPolishMode((prev) => (prev === 'present' ? 'edit' : 'present'));
  }, []);

  const handleSetBoardPolishTone = useCallback((tone: StoryboardDocumentBoardPolishTone) => {
    setBoardPolishTone(tone);
  }, []);

  const handleSetBoardPolishFinish = useCallback((finish: StoryboardDocumentBoardPolishFinish) => {
    setBoardPolishFinish(finish);
  }, []);

  const handleSetBoardPolishWeather = useCallback((weather: StoryboardDocumentBoardPolishWeather) => {
    setBoardPolishWeather(weather);
  }, []);

  const handleSetBoardPolishAtmosphere = useCallback((value: number) => {
    setBoardPolishAtmosphere(Math.max(0, Math.min(1, value)));
  }, []);

  const handleSetBoardPolishLineBoost = useCallback((value: number) => {
    setBoardPolishLineBoost(Math.max(0, Math.min(1, value)));
  }, []);

  const handleSetBoardPolishVignette = useCallback((value: number) => {
    setBoardPolishVignette(Math.max(0, Math.min(1, value)));
  }, []);

  const handleApplyCinematicSceneKit = useCallback((kitId: CinematicSceneKitId) => {
    const kit = cinematicSceneKits.find((entry) => entry.id === kitId);
    if (!kit) {
      return;
    }
    const resolvedBoardPolish = createBoardPolishDraftState(kit.boardPolish);

    const nextAssemblyId = createEditorDocumentId('shape-scaffold-assembly');
    const nextBatchIds: string[] = [];
    let primaryScaffoldId: string | undefined;
    commitDocumentUpdate((prev) => {
      let next = prev;
      const suggestionCounts = new Map<string, number>();

      kit.seeds.forEach((seed, index) => {
        const priorCount = suggestionCounts.get(seed.suggestionId)
          ?? (prev.metadata.shapeScaffolds || []).filter((entry) => entry.suggestionId === seed.suggestionId).length;
        const nextIndex = priorCount + 1;
        suggestionCounts.set(seed.suggestionId, nextIndex);

        const scaffoldId = createEditorDocumentId('shape-scaffold');
        if (index === 0) {
          primaryScaffoldId = scaffoldId;
        }
        nextBatchIds.push(scaffoldId);
        next = addStoryboardDrawingDocumentShapeScaffold(next, {
          id: scaffoldId,
          name: createShapeScaffoldSuggestionInstanceName(seed.name, nextIndex),
          primitive: seed.primitive,
          suggestionId: seed.suggestionId,
          selections: cloneShapeIntentSelections(seed.selections),
          applyMode: seed.applyMode,
          frame: seed.frame,
          visible: seed.visible,
          opacity: seed.opacity,
        });
      });

      next = addStoryboardDrawingDocumentShapeScaffoldAssembly(next, {
        id: nextAssemblyId,
        name: kit.title,
        scaffoldIds: nextBatchIds,
      });

      return updateStoryboardDrawingDocumentBoardPolish(next, resolvedBoardPolish);
    });

    setBoardPolishMode(resolvedBoardPolish.mode);
    setBoardPolishTone(resolvedBoardPolish.tone);
    setBoardPolishFinish(resolvedBoardPolish.finish);
    setBoardPolishWeather(resolvedBoardPolish.weather);
    setBoardPolishAtmosphere(resolvedBoardPolish.atmosphere);
    setBoardPolishLineBoost(resolvedBoardPolish.lineBoost);
    setBoardPolishVignette(resolvedBoardPolish.vignette);
    setBoardPolishEffectLayerStates(createBoardPolishEffectLayerStates(resolvedBoardPolish.effectLayers));
    setBoardPolishEffectRegions(createBoardPolishEffectRegions(resolvedBoardPolish.effectRegions));
    setSelectedCinematicSceneKitId(kit.id);
    setSelectedBrushPackId(kit.brushPackId);
    setSelectedDeckTab(kit.deckTab);
    setSelectedGuideMode(kit.guideMode);
    setSelectedShapeScaffoldAssemblyId(nextAssemblyId);
    setShapeScaffoldBatchIds(nextBatchIds);
    setSelectedShapeScaffoldId(primaryScaffoldId);
    setSelectedReferenceId(undefined);
    setInspectorMode('shot');
  }, [commitDocumentUpdate]);

  const canvasElement = proMode ? (
    <PencilCanvasPro
      ref={proCanvasRef}
      width={canvasDimensions.width}
      height={canvasDimensions.height}
      backgroundImage={activeBaseImage}
      referenceImage={boardPolishPresentationActive ? undefined : activeReferenceImage || undefined}
      initialStrokes={strokes}
      underlayLayers={visibleLayerOverlays}
      activeStrokeTransforms={activeRenderableLayer?.appliedTransforms || []}
      boardPolishState={boardPolishDraftState}
      boardPolishPresentationActive={boardPolishPresentationActive}
      boardPolishPreviewEffectId={boardPolishPresentationActive ? undefined : selectedBoardPolishEffectLayerId}
      layerState={{ layers: editorLayers, activeLayerId: activeLayerId || editorLayers[0]?.id || '' }}
      brushSettings={{
        type: proBrushType,
        size: brushSettings.size,
        color: brushSettings.color,
        opacity: brushSettings.opacity,
      }}
      showToolbar={showEmbeddedCanvasToolbar}
      showPressureIndicator={device.hasPencilSupport}
      showReferenceImageControls={boardPolishPresentationActive ? false : showWorkspaceChrome ? false : showReferenceImageControls}
      showGridOverlay={showWorkspaceChrome ? effectiveGridEnabled : boardPolishPresentationActive ? false : defaultGridEnabled}
      showDrawingToolsPanel={showWorkspaceChrome ? false : showDrawingToolsPanel}
      initialToolsPanelCollapsed={initialToolsPanelCollapsed}
      drawingToolsPanelWidth={drawingToolsPanelWidth}
      drawingToolsPanelCollapsedWidth={64}
      palmRejection="smart"
      currentFrameIndex={activeTimelineFrameIndex}
      totalFrames={Math.max(1, timelineFrames.length)}
      getFrameImage={getTimelineFrameImage}
      onionSkinSettings={{
        enabled: drawingDocument.timeline.onionSkinEnabled,
        framesBefore: drawingDocument.timeline.onionSkinFramesBefore,
        framesAfter: drawingDocument.timeline.onionSkinFramesAfter,
      }}
      onStrokesChange={handleStrokesChange}
      onSave={handleSave}
      onReferenceImageChange={(nextReference) => {
        if (activeReferenceRecord) {
          if (!nextReference) {
            commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentReference(prev, activeReferenceRecord.id, { visible: false }));
            return;
          }
          commitDocumentUpdate((prev) => updateStoryboardDrawingDocumentReference(prev, activeReferenceRecord.id, {
            src: nextReference.src,
            opacity: nextReference.opacity,
            visible: nextReference.visible,
            x: nextReference.x,
            y: nextReference.y,
            width: nextReference.width,
            height: nextReference.height,
            rotation: nextReference.rotation || 0,
            fitMode: nextReference.fitMode || 'free',
          }));
          return;
        }
        if (nextReference) {
          commitDocumentUpdate((prev) => addStoryboardDrawingDocumentReference(prev, {
            src: nextReference.src,
            opacity: nextReference.opacity,
            visible: nextReference.visible,
            x: nextReference.x,
            y: nextReference.y,
            width: nextReference.width,
            height: nextReference.height,
            rotation: nextReference.rotation || 0,
            fitMode: nextReference.fitMode || 'free',
          }));
        }
      }}
      onLayerStateChange={handleLayerStateChange}
      onLayerAdd={handleAddLayer}
      onLayerDelete={handleDeleteLayer}
      onLayerVisibilityToggle={handleToggleLayerVisibility}
      onLayerOpacityChange={handleChangeLayerOpacity}
      onLayerReorder={handleReorderLayer}
      onLayerMerge={handleMergeLayer}
      onLayerDuplicate={handleDuplicateLayer}
    />
  ) : (
    <PencilCanvas
      ref={standardCanvasRef}
      width={canvasDimensions.width}
      height={canvasDimensions.height}
      backgroundImage={activeBaseImage}
      initialStrokes={strokes}
      brushSettings={brushSettings}
      showToolbar={showEmbeddedCanvasToolbar}
      showPressureIndicator={device.hasPencilSupport}
      palmRejection="smart"
      onStrokesChange={handleStrokesChange}
      onSave={handleSave}
    />
  );

  // Render the editor content
  const editorContent = (
    <EditorContainer
      ref={containerRef}
      data-testid="frame-editor-shell"
      data-layout-mode={isTabletWorkspace ? 'tablet' : enableStudioChrome ? 'studio' : 'compact'}
      sx={{
        width: isFullscreen ? '100vw' : `${editorWidth}px`,
        height: isFullscreen ? '100dvh' : `${editorHeight}px`,
        borderRadius: isFullscreen ? 0 : showWorkspaceChrome ? 4.5 : 3,
        mx: isFullscreen ? 0 : 'auto',
        background: showWorkspaceChrome
          ? boardPolishPresentationActive
            ? 'linear-gradient(180deg, rgba(6,8,14,0.995), rgba(2,4,9,1))'
            : 'linear-gradient(180deg, rgba(10,12,18,0.98), rgba(4,6,12,0.98))'
          : undefined,
        border: showWorkspaceChrome ? '1px solid rgba(255,255,255,0.08)' : undefined,
        boxShadow: showWorkspaceChrome
          ? boardPolishPresentationActive
            ? '0 52px 180px rgba(0,0,0,0.72)'
            : '0 40px 140px rgba(0,0,0,0.6)'
          : undefined,
      }}
    >
      <ToolbarContainer data-testid="frame-editor-header">
        {enableStudioChrome ? (
          <Stack spacing={1.15} sx={{ width: '100%' }}>
            <Stack
              direction={{ xs: 'column', xl: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', xl: 'center' }}
              justifyContent="space-between"
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                data-testid="frame-editor-brand"
                sx={{
                  px: 1.15,
                  py: 0.75,
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.1}>
                  <Box
                    sx={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f7c96b, #f59e0b)',
                      boxShadow: '0 0 24px rgba(245,158,11,0.35)',
                    }}
                  />
                  <Typography
                    variant="subtitle2"
                    sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.78rem', lineHeight: 1, letterSpacing: 1.6 }}
                  >
                    CREATORHUB
                  </Typography>
                </Stack>
                <Chip
                  size="small"
                  label="STORYBOARD PRO"
                  sx={{
                    height: 28,
                    borderRadius: 999,
                    color: '#f8d57e',
                    borderColor: 'rgba(246,178,77,0.5)',
                    bgcolor: 'rgba(246,178,77,0.08)',
                    '& .MuiChip-label': { fontWeight: 700, fontSize: '0.69rem', lineHeight: 1, letterSpacing: 1.05, px: 1.2 },
                  }}
                  variant="outlined"
                />
                <Divider flexItem orientation="vertical" sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 600, fontSize: '1.3rem', lineHeight: 1.02, letterSpacing: '-0.01em' }}>
                  {displaySceneLabel}
                </Typography>
                <ChevronRight sx={{ color: 'rgba(255,255,255,0.4)' }} />
                <Typography variant="h6" sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.34rem', lineHeight: 1.02, letterSpacing: '-0.015em' }}>
                  {displayShotLabel}
                </Typography>
                <Chip
                  size="small"
                  label={versionLabel}
                  sx={{
                    height: 30,
                    bgcolor: 'rgba(148,163,184,0.14)',
                    color: 'rgba(226,232,240,0.88)',
                    borderRadius: 999,
                    '& .MuiChip-label': { px: 1.15, fontSize: '0.72rem', fontWeight: 600, letterSpacing: 0.35 },
                  }}
                />
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent={{ xs: 'flex-start', xl: 'flex-end' }}
                flexWrap="wrap"
                useFlexGap
                data-testid="frame-editor-quick-actions"
                sx={{
                  px: 0.9,
                  py: 0.55,
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              >
                <Chip
                  icon={<CheckCircle sx={{ color: '#4ade80 !important', fontSize: 15 }} />}
                  label="Approved"
                  size="small"
                  sx={{
                    height: 28,
                    borderRadius: 999,
                    bgcolor: 'rgba(20,83,45,0.35)',
                    color: '#86efac',
                    border: '1px solid rgba(34,197,94,0.28)',
                  }}
                />
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Share sx={{ fontSize: 16 }} />}
                  sx={{
                    minHeight: 32,
                    px: 1.2,
                    borderRadius: 999,
                    color: 'rgba(255,255,255,0.82)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                    fontWeight: 600,
                    letterSpacing: 0.15,
                  }}
                >
                  Share
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Save sx={{ fontSize: 16 }} />}
                  onClick={handleSaveFromToolbar}
                  sx={{
                    minHeight: 32,
                    px: 1.2,
                    borderRadius: 999,
                    color: '#dbeafe',
                    borderColor: 'rgba(96,165,250,0.25)',
                    bgcolor: 'rgba(30,41,59,0.8)',
                    fontWeight: 600,
                    letterSpacing: 0.15,
                  }}
                >
                  Export
                </Button>
                <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  <MoreHoriz />
                </IconButton>
              </Stack>
            </Stack>

            <Stack
              direction={{ xs: 'column', xl: 'row' }}
              spacing={1}
              alignItems={{ xs: 'stretch', xl: 'center' }}
              justifyContent="space-between"
            >
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                data-testid="frame-editor-header-brush-strip"
                sx={{
                  px: 0.95,
                  py: 0.55,
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012))',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ color: 'rgba(248,250,252,0.62)', fontSize: '0.69rem', lineHeight: 1, letterSpacing: 2.05, fontWeight: 700 }}
                >
                  CINEMATOGRAPHY BRUSH PACKS
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AutoAwesome sx={{ fontSize: 16 }} />}
                  sx={{
                    minHeight: 34,
                    px: 1.2,
                    borderRadius: 999,
                    color: 'rgba(255,255,255,0.82)',
                    borderColor: 'rgba(255,255,255,0.12)',
                    bgcolor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  New Pack
                </Button>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={proMode ? proBrushType : brushType}
                  onChange={(_, value: string | null) => {
                    if (!value) return;
                    if (proMode && isProBrushType(value)) {
                      setProBrushType(value);
                      return;
                    }
                    if (isBrushType(value)) {
                      setBrushType(value);
                    }
                  }}
                  sx={{
                    borderRadius: 999,
                    '& .MuiToggleButton-root': {
                      minHeight: 38,
                      color: 'rgba(255,255,255,0.76)',
                      borderColor: 'rgba(255,255,255,0.08)',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      px: 1.4,
                      borderRadius: 999,
                    },
                    '& .Mui-selected': {
                      color: '#111827',
                      bgcolor: '#f8fafc !important',
                    },
                  }}
                >
                  <ToggleButton value="pen">Pen</ToggleButton>
                  <ToggleButton value="marker">Marker</ToggleButton>
                  <ToggleButton value="highlighter">Highlight</ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                data-testid="frame-editor-header-utility-strip"
                sx={{
                  px: 0.95,
                  py: 0.55,
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.012))',
                  border: '1px solid rgba(255,255,255,0.07)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              >
                <Chip
                  icon={<AspectRatio sx={{ fontSize: 14 }} />}
                  label={aspectChromeLabel}
                  size="small"
                  sx={{ height: 30, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                />
                <Button
                  size="small"
                  data-testid="frame-editor-board-polish-mode-toggle"
                  variant={boardPolishPresentationActive ? 'contained' : 'outlined'}
                  startIcon={<Visibility sx={{ fontSize: 16 }} />}
                  onClick={handleToggleBoardPolishMode}
                  sx={
                    boardPolishPresentationActive
                      ? {
                          minHeight: 34,
                          px: 1.25,
                          borderRadius: 999,
                          bgcolor: '#f8fafc',
                          color: '#111827',
                          '&:hover': { bgcolor: '#e5e7eb' },
                        }
                      : {
                          minHeight: 34,
                          px: 1.25,
                          borderRadius: 999,
                          color: '#f8fafc',
                          borderColor: 'rgba(255,255,255,0.12)',
                          bgcolor: 'rgba(255,255,255,0.03)',
                        }
                  }
                >
                  {boardPolishPresentationActive ? 'Editing' : 'Present'}
                </Button>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={boardPolishTone}
                  data-testid="frame-editor-board-polish-tones"
                  onChange={(_, value: StoryboardDocumentBoardPolishTone | null) => {
                    if (!value) {
                      return;
                    }
                    handleSetBoardPolishTone(value);
                  }}
                  sx={{
                    borderRadius: 999,
                    '& .MuiToggleButton-root': {
                      minHeight: 34,
                      px: 1.05,
                      color: 'rgba(255,255,255,0.78)',
                      borderColor: 'rgba(255,255,255,0.08)',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      borderRadius: 999,
                      textTransform: 'none',
                      fontWeight: 600,
                    },
                    '& .Mui-selected': {
                      bgcolor: 'rgba(246,178,77,0.16) !important',
                      color: '#fde68a',
                    },
                  }}
                >
                  {STUDIO_BOARD_POLISH_TONES.map((tone) => (
                    <ToggleButton
                      key={tone}
                      value={tone}
                      data-testid={`frame-editor-board-polish-tone-${tone}`}
                    >
                      {STUDIO_BOARD_POLISH_TONE_CONFIG[tone].label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
                <Button
                  size="small"
                  variant={gridEnabled ? 'contained' : 'outlined'}
                  startIcon={<GridOn sx={{ fontSize: 16 }} />}
                  onClick={() => setGridEnabled((prev) => !prev)}
                  disabled={boardPolishPresentationActive}
                  sx={
                    gridEnabled
                      ? {
                          minHeight: 34,
                          px: 1.25,
                          borderRadius: 999,
                          bgcolor: '#f6b24d',
                          color: '#111827',
                          '&:hover': { bgcolor: '#f4a11f' },
                        }
                      : {
                          minHeight: 34,
                          px: 1.25,
                          borderRadius: 999,
                          color: 'rgba(255,255,255,0.82)',
                          borderColor: 'rgba(255,255,255,0.12)',
                          bgcolor: 'rgba(255,255,255,0.03)',
                        }
                  }
                >
                  {boardPolishPresentationActive ? 'Grid Locked' : 'Grid'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<CameraAlt sx={{ fontSize: 16 }} />}
                  sx={{ minHeight: 34, px: 1.25, borderRadius: 999, color: 'rgba(255,255,255,0.82)', borderColor: 'rgba(255,255,255,0.12)' }}
                >
                  Camera
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<LightMode sx={{ fontSize: 16 }} />}
                  sx={{ minHeight: 34, px: 1.25, borderRadius: 999, color: '#fde68a', borderColor: 'rgba(245,158,11,0.28)' }}
                  onClick={() => setInspectorMode('lighting')}
                >
                  Light
                </Button>
                <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                  <IconButton onClick={toggleFullscreen} sx={{ color: 'rgba(255,255,255,0.76)' }}>
                    {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Cancel">
                  <IconButton onClick={handleCancel} sx={{ color: 'rgba(255,255,255,0.76)' }}>
                    <Close />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Stack>
        ) : (
          <>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                flex: '1 1 520px',
                minWidth: 0,
                flexWrap: 'wrap',
                columnGap: 1,
                rowGap: 1,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Brush sx={{ color: '#8b5cf6' }} />
                <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 600 }}>
                  {editorTitle}
                </Typography>
              </Box>

              <Chip
                label={workflowLevel === 'idea' ? 'Thumbnail flow' : workflowLevel}
                size="small"
                sx={{ bgcolor: 'rgba(56,189,248,0.16)', color: '#7dd3fc' }}
              />

              {frameId && (
                <Chip
                  label={`Frame: ${frameId.slice(-6)}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(139,92,246,0.2)', color: '#8b5cf6' }}
                />
              )}

              {sceneId && (
                <Chip
                  label={`Scene: ${sceneId}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(6,182,212,0.2)', color: '#06b6d4' }}
                />
              )}

              {manuscriptId && (
                <Chip
                  icon={<ImageIcon sx={{ fontSize: 14 }} />}
                  label={`Manus: ${manuscriptId.slice(-6)}`}
                  size="small"
                  sx={{ bgcolor: 'rgba(217,119,6,0.2)', color: '#fbbf24' }}
                />
              )}

              {lastSavedImage && (
                <Chip
                  icon={<Save sx={{ fontSize: 14 }} />}
                  label="Saved"
                  size="small"
                  sx={{ bgcolor: 'rgba(34,197,94,0.2)', color: '#4ade80' }}
                />
              )}

              <Chip
                data-testid="frame-editor-device-chip"
                icon={device.hasPencilSupport ? <Create sx={{ fontSize: 14 }} /> : <TouchApp sx={{ fontSize: 14 }} />}
                label={device.hasPencilSupport ? 'Apple Pencil' : device.hasTouchScreen ? 'Touch' : 'Mouse'}
                size="small"
                sx={{
                  height: isTabletWorkspace ? 32 : undefined,
                  bgcolor: device.hasPencilSupport ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
                  color: device.hasPencilSupport ? '#22c55e' : 'rgba(255,255,255,0.6)',
                }}
              />

              {isTabletWorkspace && (
                <Chip
                  data-testid="frame-editor-tablet-badge"
                  label="Tablet Workspace"
                  size="small"
                  sx={{
                    height: 32,
                    bgcolor: 'rgba(59,130,246,0.18)',
                    color: '#bfdbfe',
                    '& .MuiChip-label': { px: 1.05, fontSize: '0.7rem', fontWeight: 700, letterSpacing: 0.3 },
                  }}
                />
              )}
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                flex: '1 1 520px',
                minWidth: 0,
                justifyContent: { xs: 'flex-start', md: 'flex-end' },
                flexWrap: 'wrap',
                columnGap: 1,
                rowGap: 1,
              }}
            >
              <ToggleButtonGroup
                size="small"
                exclusive
                value={proMode ? proBrushType : brushType}
                onChange={(_, value: string | null) => {
                  if (!value) return;
                  if (proMode && isProBrushType(value)) {
                    setProBrushType(value);
                    return;
                  }
                  if (isBrushType(value)) {
                    setBrushType(value);
                  }
                }}
                sx={{
                  maxWidth: '100%',
                  '& .MuiToggleButton-root': {
                    color: 'rgba(255,255,255,0.7)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    px: { xs: isTabletWorkspace ? 1.35 : 1, md: isTabletWorkspace ? 1.7 : 1.5 },
                    minHeight: isTabletWorkspace ? 38 : undefined,
                    fontSize: { xs: isTabletWorkspace ? '0.82rem' : '0.75rem', md: isTabletWorkspace ? '0.9rem' : '0.875rem' },
                  },
                }}
              >
                <ToggleButton value="pen">Pen</ToggleButton>
                <ToggleButton value="marker">Marker</ToggleButton>
                <ToggleButton value="highlighter">Highlight</ToggleButton>
              </ToggleButtonGroup>

              <ToggleButtonGroup
                size="small"
                value={[highlightMode ? 'highlight' : null, autoEnhance ? 'enhance' : null].filter(Boolean)}
                onChange={(_, values: string[]) => {
                  setHighlightMode(values.includes('highlight'));
                  setAutoEnhance(values.includes('enhance'));
                }}
                sx={{
                  '& .MuiToggleButton-root': {
                    color: 'rgba(255,255,255,0.7)',
                    borderColor: 'rgba(255,255,255,0.2)',
                    minHeight: isTabletWorkspace ? 38 : undefined,
                  },
                }}
              >
                <ToggleButton value="highlight">
                  <Tooltip title="Highlight Mode"><Highlight sx={{ fontSize: 16 }} /></Tooltip>
                </ToggleButton>
                <ToggleButton value="enhance">
                  <Tooltip title="Auto Enhance"><AutoAwesome sx={{ fontSize: 16 }} /></Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>

              <Tooltip title="Undo">
                <span>
                  <IconButton onClick={handleUndo} sx={{ color: 'rgba(255,255,255,0.87)' }} disabled={!strokes.length}>
                    <Undo />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Redo">
                <span>
                  <IconButton onClick={handleRedo} sx={{ color: 'rgba(255,255,255,0.87)' }} disabled={!strokes.length}>
                    <Redo />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Clear">
                <IconButton onClick={handleClear} sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  <Delete />
                </IconButton>
              </Tooltip>

              <Tooltip title="Aspect Ratio">
                <Chip
                  icon={<AspectRatio sx={{ fontSize: 14 }} />}
                  label={aspectRatio}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.1)', color: '#fff' }}
                />
              </Tooltip>

              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

              <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                <IconButton onClick={toggleFullscreen} sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                </IconButton>
              </Tooltip>

              <Tooltip title="Cancel">
                <IconButton onClick={handleCancel} sx={{ color: 'rgba(255,255,255,0.87)' }}>
                  <Close />
                </IconButton>
              </Tooltip>
            </Stack>
          </>
        )}
      </ToolbarContainer>

      {/* iPad drawing tip */}
      {device.isIPad && device.hasPencilSupport && (
        <Fade in>
          <Alert 
            severity="info" 
            sx={{ 
              borderRadius: 0, 
              bgcolor: 'rgba(59,130,246,0.1)', 
              color: '#60a5fa',
              '& .MuiAlert-icon': { color: '#60a5fa' },
            }}
          >
            Apple Pencil detected! Use pressure for line width and tilt for brush effects.
          </Alert>
        </Fade>
      )}

      {showWorkspaceChrome ? (
        <Box
          data-testid="frame-editor-body"
          sx={{
            flex: 1,
            minHeight: 0,
            p: isTabletWorkspace ? 0.85 : 1,
            background:
              'radial-gradient(circle at top, rgba(245,158,11,0.18), transparent 30%), linear-gradient(180deg, rgba(7,10,17,0.98), rgba(2,4,10,1))',
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: isTabletWorkspace
                ? '56px minmax(0, 1fr) minmax(280px, 336px)'
                : '50px minmax(228px, 280px) minmax(0, 1fr) minmax(236px, 286px)',
              gridTemplateRows: isTabletWorkspace ? 'minmax(250px, 0.92fr) minmax(340px, 1.08fr)' : 'minmax(0, 1fr)',
              gridTemplateAreas: isTabletWorkspace
                ? '"stage stage stage" "rail brush inspector"'
                : '"rail brush stage inspector"',
              gap: isTabletWorkspace ? 0.85 : 1,
              height: '100%',
              minHeight: 0,
            }}
          >
            <Paper
              data-testid="frame-editor-left-rail"
              sx={{
                gridArea: 'rail',
                p: 0.75,
                borderRadius: 3,
                background: 'linear-gradient(180deg, rgba(12,14,22,0.98), rgba(5,7,12,0.98))',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.65,
              }}
            >
              <Stack data-testid="frame-editor-left-rail-header" spacing={0.7} alignItems="center" sx={{ pt: 0.15, pb: 0.35 }}>
                <Paper
                  elevation={0}
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 1.6,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  }}
                >
                  <ChevronLeft sx={{ color: 'rgba(248,250,252,0.74)', fontSize: 18 }} />
                </Paper>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'rgba(248,250,252,0.44)',
                    fontSize: '0.54rem',
                    lineHeight: 1,
                    letterSpacing: 2.2,
                    fontWeight: 700,
                  }}
                >
                  TOOLS
                </Typography>
              </Stack>
              {STUDIO_TOOL_RAIL.map((tool, index) => {
                const Icon = tool.icon;
                const active =
                  (tool.id === 'brush' && inspectorMode !== 'shot') ||
                  (tool.id === 'light' && inspectorMode === 'lighting') ||
                  (tool.id === 'camera' && inspectorMode === 'shot');
                return (
                  <Tooltip key={tool.id} title={tool.label} placement="right">
                    <Paper
                      data-testid={`frame-editor-left-rail-tool-${tool.id}`}
                      elevation={0}
                      sx={{
                        width: isTabletWorkspace ? 46 : 40,
                        minHeight: isTabletWorkspace ? 56 : 48,
                        borderRadius: 1.8,
                        background: active
                          ? 'linear-gradient(180deg, rgba(23,37,84,0.92), rgba(10,12,18,0.98))'
                          : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
                        border: `1px solid ${active ? 'rgba(96,165,250,0.36)' : 'rgba(255,255,255,0.05)'}`,
                        boxShadow: active
                          ? '0 10px 24px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.06)'
                          : 'inset 0 1px 0 rgba(255,255,255,0.03)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <IconButton
                        size="small"
                        sx={{
                          width: '100%',
                          minHeight: isTabletWorkspace ? 56 : 48,
                          borderRadius: 1.8,
                          color: active ? '#f8fafc' : 'rgba(255,255,255,0.58)',
                          position: 'relative',
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            position: 'absolute',
                            top: 4,
                            left: 5,
                            color: active ? '#fde68a' : 'rgba(248,250,252,0.34)',
                            fontSize: '0.5rem',
                            lineHeight: 1,
                            fontWeight: 700,
                            letterSpacing: 0.35,
                          }}
                        >
                          {tool.hotkey}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            position: 'absolute',
                            right: 5,
                            bottom: 4,
                            color: active ? 'rgba(248,250,252,0.8)' : 'rgba(248,250,252,0.38)',
                            fontSize: '0.46rem',
                            lineHeight: 1,
                            fontWeight: 700,
                            letterSpacing: 0.65,
                          }}
                        >
                          {tool.shortLabel}
                        </Typography>
                        <Icon sx={{ fontSize: index === 0 ? 19 : 18 }} />
                        {active ? (
                          <Box
                            sx={{
                              position: 'absolute',
                              left: 0,
                              top: 7,
                              bottom: 7,
                              width: 2.5,
                              borderRadius: '0 999px 999px 0',
                              bgcolor: '#f6b24d',
                              boxShadow: '0 0 10px rgba(246,178,77,0.45)',
                            }}
                          />
                        ) : null}
                      </IconButton>
                    </Paper>
                  </Tooltip>
                );
              })}
              <Box sx={{ flex: 1 }} />
              <Stack data-testid="frame-editor-left-rail-footer" spacing={0.7} alignItems="center" sx={{ pb: 0.15 }}>
                <Stack direction="row" spacing={0.45}>
                  {['SNAP', 'ISO'].map((label) => (
                    <Box
                      key={label}
                      sx={{
                        px: 0.45,
                        py: 0.2,
                        borderRadius: 999,
                        bgcolor: label === 'ISO' ? 'rgba(246,178,77,0.18)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${label === 'ISO' ? 'rgba(246,178,77,0.24)' : 'rgba(255,255,255,0.06)'}`,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: label === 'ISO' ? '#fde68a' : 'rgba(248,250,252,0.46)',
                          fontSize: '0.42rem',
                          lineHeight: 1,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                        }}
                      >
                        {label}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
                <Stack spacing={0.55} alignItems="center">
                  {[0, 1, 2].map((dot) => (
                    <Box
                      key={dot}
                      sx={{
                        width: 3,
                        height: dot === 1 ? 18 : 10,
                        borderRadius: 999,
                        bgcolor: dot === 1 ? '#f6b24d' : 'rgba(255,255,255,0.18)',
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </Paper>

            <Paper
              data-testid="frame-editor-brush-panel"
              sx={{
                gridArea: 'brush',
                p: 1.15,
                borderRadius: 3,
                background: 'linear-gradient(180deg, rgba(14,17,26,0.98), rgba(6,8,14,0.98))',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.62)', letterSpacing: 1.6, fontWeight: 700 }}>
                  BRUSH PACKS
                </Typography>
                <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.56)' }}>
                  <MoreHoriz fontSize="small" />
                </IconButton>
              </Stack>

              <Stack spacing={1} sx={{ overflowY: 'auto', pr: 0.4 }}>
                {STUDIO_BRUSH_PACKS.map((pack) => (
                  <Paper
                    key={pack.id}
                    data-testid={`frame-editor-brush-pack-${pack.id}`}
                    onClick={() => setSelectedBrushPackId(pack.id)}
                    sx={{
                      p: isTabletWorkspace ? 1.25 : 1.1,
                      borderRadius: 2,
                      cursor: 'pointer',
                      border: `1px solid ${pack.id === selectedBrushPackId ? alpha(pack.accent, 0.85) : 'rgba(255,255,255,0.06)'}`,
                      background: pack.id === selectedBrushPackId
                        ? `linear-gradient(180deg, ${alpha(pack.accent, 0.12)}, rgba(255,255,255,0.02))`
                        : 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle2" sx={{ color: '#f8fafc', letterSpacing: 0.8 }}>
                        {pack.title}
                      </Typography>
                      <MoreHoriz sx={{ color: 'rgba(255,255,255,0.45)', fontSize: 18 }} />
                    </Stack>
                    <Stack direction="row" spacing={0.75} sx={{ mt: 1 }}>
                      {pack.swatches.map((swatch, index) => (
                        <Box
                          key={`${pack.id}-${swatch}`}
                          sx={{
                            flex: 1,
                            height: isTabletWorkspace ? 40 : 34,
                            borderRadius: 1,
                            background:
                              pack.preview === 'strokes'
                                ? `linear-gradient(145deg, rgba(255,255,255,0.08), ${alpha(swatch, 0.88)} 45%, rgba(15,23,42,0.92))`
                                : pack.id === 'crosshatch'
                                  ? `linear-gradient(145deg, ${alpha(swatch, 0.96)}, rgba(15,23,42,0.96)), repeating-linear-gradient(135deg, rgba(255,255,255,0.22) 0 2px, transparent 2px 6px)`
                                  : `linear-gradient(135deg, ${alpha(swatch, 0.98)}, rgba(15,23,42,0.96))`,
                            border: '1px solid rgba(255,255,255,0.08)',
                            position: 'relative',
                            overflow: 'hidden',
                            '&::before': pack.preview === 'strokes'
                              ? {
                                  content: '""',
                                  position: 'absolute',
                                  left: index === 0 ? 2 : 6,
                                  right: index === 3 ? 2 : 8,
                                  top: index % 2 === 0 ? 10 : 7,
                                  height: index === 2 ? 8 : 6,
                                  borderRadius: 999,
                                  background: `linear-gradient(90deg, rgba(255,255,255,0.96), ${alpha(pack.accent, 0.18)})`,
                                  transform: `rotate(${index === 1 ? -18 : index === 2 ? 14 : -10}deg)`,
                                  boxShadow: `0 0 16px ${alpha(pack.accent, 0.26)}`,
                                }
                              : {
                                  content: '""',
                                  position: 'absolute',
                                  inset: 0,
                                  background:
                                    pack.id === 'wash'
                                      ? 'radial-gradient(circle at 32% 42%, rgba(255,255,255,0.42), transparent 36%), linear-gradient(135deg, rgba(255,255,255,0.18), transparent 55%)'
                                      : 'linear-gradient(120deg, rgba(255,255,255,0.22), transparent 38%, rgba(255,255,255,0.08) 70%)',
                                },
                            '&::after': {
                              content: pack.preview === 'strokes' ? '""' : '" "',
                              position: 'absolute',
                              inset: pack.preview === 'strokes' ? 'auto 0 0 0' : 4,
                              height: pack.preview === 'strokes' ? (index === 0 && pack.id === selectedBrushPackId ? 3 : 0) : 'auto',
                              borderRadius: pack.preview === 'strokes' ? 0 : 0.8,
                              bgcolor: pack.preview === 'strokes' ? pack.accent : undefined,
                              border: pack.preview === 'strokes' ? undefined : '1px solid rgba(255,255,255,0.08)',
                              background: pack.preview === 'strokes'
                                ? undefined
                                : index % 2 === 0
                                  ? 'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(15,23,42,0.15), rgba(255,255,255,0.04))'
                                  : 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(15,23,42,0.06), rgba(255,255,255,0.02))',
                              clipPath: pack.preview === 'strokes'
                                ? undefined
                                : index === 0
                                  ? 'polygon(0 70%, 28% 24%, 52% 16%, 100% 34%, 100% 100%, 0 100%)'
                                  : index === 1
                                    ? 'polygon(0 80%, 22% 38%, 42% 26%, 100% 18%, 100% 100%, 0 100%)'
                                    : index === 2
                                      ? 'polygon(0 100%, 0 58%, 28% 34%, 52% 14%, 100% 0, 100% 100%)'
                                      : 'polygon(0 100%, 0 74%, 36% 42%, 68% 24%, 100% 10%, 100% 100%)',
                            },
                          }}
                        />
                      ))}
                    </Stack>
                  </Paper>
                ))}

                <Box
                  data-testid="frame-editor-brush-library"
                  sx={{
                    pt: 0.5,
                    px: 0.9,
                    py: 0.95,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.62)', letterSpacing: 1.6, fontWeight: 700 }}>
                    BRUSH LIBRARY
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 1 }}>
                    {STUDIO_LIBRARY_GROUPS.map(([group, preset]) => {
                      const selected = preset === selectedLibraryPreset;
                      return (
                        <Stack key={group} direction="row" spacing={1}>
                          <Box sx={{ minWidth: 88 }}>
                            <Typography variant="body2" sx={{ color: 'rgba(226,232,240,0.78)' }}>
                              {group}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            fullWidth
                            onClick={() => setSelectedLibraryPreset(preset)}
                            startIcon={<Brush sx={{ fontSize: 14 }} />}
                            sx={{
                              minHeight: isTabletWorkspace ? 38 : 32,
                              borderRadius: 999,
                              justifyContent: 'flex-start',
                              color: selected ? '#f8fafc' : 'rgba(226,232,240,0.72)',
                              bgcolor: selected ? 'rgba(37,99,235,0.32)' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${selected ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
                            }}
                          >
                            {preset}
                          </Button>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Box>

                <Stack
                  data-testid="frame-editor-brush-controls"
                  spacing={0.85}
                  sx={{
                    pt: 0.75,
                    px: 0.9,
                    py: 0.95,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  }}
                >
                  {[
                    { label: 'Size', value: brushSettings.size, min: 1, max: 64, step: 1, onChange: (value: number) => setBrushSettings((prev) => ({ ...prev, size: value })) },
                    { label: 'Opacity', value: Math.round(brushSettings.opacity * 100), min: 10, max: 100, step: 1, onChange: (value: number) => setBrushSettings((prev) => ({ ...prev, opacity: value / 100 })) },
                    {
                      label: 'Flow',
                      value: flowValue,
                      min: 0,
                      max: 100,
                      step: 1,
                      onChange: (value: number) => {
                        setFlowValue(value);
                        setAutoEnhance(value >= 75);
                      },
                    },
                    { label: 'Stabilize', value: stabilizeValue, min: 0, max: 100, step: 1, onChange: (value: number) => setStabilizeValue(value) },
                    { label: 'Pressure', value: pressureValue, min: 0, max: 100, step: 1, onChange: (value: number) => setPressureValue(value) },
                  ].map((slider) => (
                    <Box
                      key={slider.label}
                      data-testid={`frame-editor-brush-control-${toTestIdFragment(slider.label)}`}
                      sx={{
                        px: 0.7,
                        py: 0.7,
                        borderRadius: 1.6,
                        bgcolor: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.2 }}>
                        <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                          {slider.label}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                          {Math.round(slider.value)}{slider.label === 'Size' ? 'px' : '%'}
                        </Typography>
                      </Stack>
                      <Slider
                        size="small"
                        value={slider.value}
                        min={slider.min}
                        max={slider.max}
                        step={slider.step}
                        onChange={(_, nextValue) => {
                          if (Array.isArray(nextValue)) return;
                          slider.onChange(nextValue);
                        }}
                        sx={{
                          color: currentBrushPack.accent,
                          '& .MuiSlider-thumb': {
                            width: isTabletWorkspace ? 18 : 14,
                            height: isTabletWorkspace ? 18 : 14,
                            boxShadow: `0 0 0 4px ${alpha(currentBrushPack.accent, 0.18)}`,
                          },
                        }}
                      />
                    </Box>
                  ))}
                </Stack>

                <Box
                  data-testid="frame-editor-precision-tools-card"
                  sx={{
                    px: 0.9,
                    py: 0.95,
                    borderRadius: 2,
                    bgcolor: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  }}
                >
                  <Stack spacing={0.8}>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip
                        icon={<Tune sx={{ fontSize: 15 }} />}
                        label="Precision Design Tools"
                        size="small"
                        sx={{
                          height: 26,
                          borderRadius: 999,
                          bgcolor: 'rgba(59,130,246,0.14)',
                          color: '#bfdbfe',
                          '& .MuiChip-label': { px: 0.95, fontSize: '0.64rem', fontWeight: 700, letterSpacing: 0.35 },
                        }}
                      />
                      <Chip
                        label={`Guide: ${selectedGuideMode}`}
                        size="small"
                        sx={{
                          height: 22,
                          borderRadius: 999,
                          bgcolor: 'rgba(246,178,77,0.16)',
                          color: '#fde68a',
                          '& .MuiChip-label': { px: 0.8, fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.4 },
                        }}
                      />
                    </Stack>

                    <Stack
                      data-testid="frame-editor-precision-text-tools"
                      direction="row"
                      spacing={0.7}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<TextFields sx={{ fontSize: 15 }} />}
                        sx={{
                          minHeight: isTabletWorkspace ? 36 : 30,
                          borderRadius: 999,
                          color: '#f8fafc',
                          borderColor: 'rgba(255,255,255,0.08)',
                          bgcolor: 'rgba(255,255,255,0.03)',
                        }}
                      >
                        Vector Text
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<TextFields sx={{ fontSize: 15 }} />}
                        sx={{
                          minHeight: isTabletWorkspace ? 36 : 30,
                          borderRadius: 999,
                          color: 'rgba(248,250,252,0.82)',
                          borderColor: 'rgba(255,255,255,0.08)',
                          bgcolor: 'rgba(255,255,255,0.03)',
                        }}
                      >
                        Import Fonts
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AspectRatio sx={{ fontSize: 15 }} />}
                        sx={{
                          minHeight: isTabletWorkspace ? 36 : 30,
                          borderRadius: 999,
                          color: 'rgba(248,250,252,0.82)',
                          borderColor: 'rgba(255,255,255,0.08)',
                          bgcolor: 'rgba(255,255,255,0.03)',
                        }}
                        >
                          Crop & Resize
                        </Button>
                    </Stack>

                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                        gap: 0.7,
                      }}
                    >
                      <Box
                        data-testid="frame-editor-precision-text-preview"
                        sx={{
                          px: 0.75,
                          py: 0.7,
                          borderRadius: 1.7,
                          bgcolor: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <Stack spacing={0.55}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Typography
                              variant="caption"
                              sx={{ color: 'rgba(248,250,252,0.5)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.1 }}
                            >
                              TYPE RIG
                            </Typography>
                            <Chip
                              label={selectedFontPreset}
                              size="small"
                              sx={{
                                height: 20,
                                borderRadius: 999,
                                bgcolor: 'rgba(96,165,250,0.14)',
                                color: '#bfdbfe',
                                '& .MuiChip-label': { px: 0.7, fontSize: '0.55rem', fontWeight: 700, letterSpacing: 0.3 },
                              }}
                            />
                          </Stack>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              color: '#f8fafc',
                              fontSize: '1rem',
                              lineHeight: 1,
                              letterSpacing: 1.2,
                              textAlign: selectedTextAlignment === 'Left'
                                ? 'left'
                                : selectedTextAlignment === 'Right'
                                  ? 'right'
                                  : 'center',
                              fontFamily: selectedFontPreset === 'Mono'
                                ? '"SFMono-Regular", "SF Mono", "Roboto Mono", monospace'
                                : selectedFontPreset === 'Display'
                                  ? '"Baskerville", "Georgia", serif'
                                  : '"Avenir Next", "Helvetica Neue", sans-serif',
                            }}
                          >
                            SHOT 5B
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'rgba(226,232,240,0.62)',
                              lineHeight: 1.35,
                              textAlign: selectedTextAlignment === 'Left'
                                ? 'left'
                                : selectedTextAlignment === 'Right'
                                  ? 'right'
                                  : 'center',
                            }}
                          >
                            Vector text locked to the illustration plane for captions, inserts, and title cards.
                          </Typography>
                          <Stack direction="row" spacing={0.45} flexWrap="wrap" useFlexGap>
                            {STUDIO_FONT_PRESETS.map((preset) => (
                              <Button
                                key={preset}
                                size="small"
                                onClick={() => setSelectedFontPreset(preset)}
                                sx={{
                                  minHeight: isTabletWorkspace ? 30 : 24,
                                  px: 0.8,
                                  borderRadius: 999,
                                  color: selectedFontPreset === preset ? '#111827' : 'rgba(248,250,252,0.74)',
                                  bgcolor: selectedFontPreset === preset ? '#bfdbfe' : 'rgba(255,255,255,0.03)',
                                  border: `1px solid ${selectedFontPreset === preset ? 'rgba(191,219,254,0.26)' : 'rgba(255,255,255,0.06)'}`,
                                  fontSize: '0.56rem',
                                  fontWeight: 700,
                                  letterSpacing: 0.25,
                                }}
                              >
                                {preset}
                              </Button>
                            ))}
                          </Stack>
                          <Stack
                            data-testid="frame-editor-precision-type-metrics"
                            spacing={0.45}
                            sx={{
                              px: 0.65,
                              py: 0.55,
                              borderRadius: 1.4,
                              bgcolor: 'rgba(255,255,255,0.025)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                              <Typography
                                variant="caption"
                                sx={{ color: 'rgba(248,250,252,0.5)', fontSize: '0.58rem', fontWeight: 700, letterSpacing: 1 }}
                              >
                                TYPE METRICS
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 600, letterSpacing: 0.25 }}>
                                Align
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                              {STUDIO_TEXT_ALIGNMENTS.map((alignment) => (
                                <Button
                                  key={alignment}
                                  size="small"
                                  onClick={() => setSelectedTextAlignment(alignment)}
                                  sx={{
                                    minHeight: isTabletWorkspace ? 28 : 22,
                                    px: 0.75,
                                    borderRadius: 999,
                                    color: selectedTextAlignment === alignment ? '#111827' : 'rgba(248,250,252,0.74)',
                                    bgcolor: selectedTextAlignment === alignment ? '#bfdbfe' : 'rgba(255,255,255,0.03)',
                                    border: `1px solid ${selectedTextAlignment === alignment ? 'rgba(191,219,254,0.26)' : 'rgba(255,255,255,0.06)'}`,
                                    fontSize: '0.54rem',
                                    fontWeight: 700,
                                    letterSpacing: 0.26,
                                  }}
                                >
                                  {alignment}
                                </Button>
                              ))}
                            </Stack>
                            <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                              {[
                                `Track ${typeTrackingLabel}`,
                                'Baseline Lock',
                              ].map((item, index) => (
                                <Chip
                                  key={item}
                                  label={item}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    borderRadius: 999,
                                    bgcolor: index === 0 ? 'rgba(96,165,250,0.14)' : 'rgba(255,255,255,0.05)',
                                    color: index === 0 ? '#bfdbfe' : 'rgba(248,250,252,0.74)',
                                    '& .MuiChip-label': { px: 0.68, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.26 },
                                  }}
                                />
                              ))}
                            </Stack>
                          </Stack>
                        </Stack>
                      </Box>

                      <Box
                        data-testid="frame-editor-precision-canvas-tools"
                        sx={{
                          px: 0.75,
                          py: 0.7,
                          borderRadius: 1.7,
                          bgcolor: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <Stack spacing={0.55}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Typography
                              variant="caption"
                              sx={{ color: 'rgba(248,250,252,0.5)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.1 }}
                            >
                              CANVAS FIT
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 600, letterSpacing: 0.25 }}>
                              {precisionCanvasSummary}
                            </Typography>
                          </Stack>
                          <Box
                            sx={{
                              position: 'relative',
                              height: 40,
                              borderRadius: 1.2,
                              bgcolor: 'rgba(2,6,23,0.66)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              overflow: 'hidden',
                            }}
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                inset: 6,
                                border: '1px solid rgba(248,250,252,0.42)',
                              }}
                            />
                            <Box
                              sx={{
                                position: 'absolute',
                                inset: '11px 18px',
                                border: '1px dashed rgba(246,178,77,0.52)',
                              }}
                            />
                          <Box
                            sx={{
                              position: 'absolute',
                              left: '50%',
                              top: 0,
                              bottom: 0,
                              width: 1,
                              bgcolor: 'rgba(248,250,252,0.18)',
                            }}
                          />
                          {selectedCropPreset === 'Thirds' ? (
                            <>
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  left: '33.333%',
                                  width: 1,
                                  bgcolor: 'rgba(248,250,252,0.18)',
                                }}
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  left: '66.666%',
                                  width: 1,
                                  bgcolor: 'rgba(248,250,252,0.18)',
                                }}
                              />
                            </>
                          ) : null}
                        </Box>
                        <Stack
                          data-testid="frame-editor-precision-crop-strip"
                          direction="row"
                          spacing={0.4}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          {STUDIO_CROP_PRESETS.map((preset) => (
                            <Button
                              key={preset}
                              size="small"
                              onClick={() => setSelectedCropPreset(preset)}
                              sx={{
                                minHeight: isTabletWorkspace ? 28 : 22,
                                px: 0.75,
                                borderRadius: 999,
                                color: selectedCropPreset === preset ? '#111827' : 'rgba(248,250,252,0.74)',
                                bgcolor: selectedCropPreset === preset ? '#fde68a' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${selectedCropPreset === preset ? 'rgba(246,178,77,0.26)' : 'rgba(255,255,255,0.06)'}`,
                                fontSize: '0.54rem',
                                fontWeight: 700,
                                letterSpacing: 0.26,
                              }}
                            >
                              {preset}
                            </Button>
                          ))}
                        </Stack>
                        <Stack
                          data-testid="frame-editor-precision-resolution-strip"
                          direction="row"
                          spacing={0.4}
                          flexWrap="wrap"
                          useFlexGap
                        >
                          {STUDIO_CANVAS_RESOLUTION_PRESETS.map((preset) => (
                            <Button
                              key={preset}
                              size="small"
                              onClick={() => handleCanvasResolutionPreset(preset)}
                              sx={{
                                minHeight: isTabletWorkspace ? 28 : 22,
                                px: 0.75,
                                borderRadius: 999,
                                color: exportCanvasWidth === getCanvasResolutionForPreset(preset, activeSpatialCanvas?.aspectRatio || (aspectRatio as StoryboardDocumentAspectRatio)).width
                                  ? '#111827'
                                  : 'rgba(248,250,252,0.74)',
                                bgcolor: exportCanvasWidth === getCanvasResolutionForPreset(preset, activeSpatialCanvas?.aspectRatio || (aspectRatio as StoryboardDocumentAspectRatio)).width
                                  ? '#bfdbfe'
                                  : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${exportCanvasWidth === getCanvasResolutionForPreset(preset, activeSpatialCanvas?.aspectRatio || (aspectRatio as StoryboardDocumentAspectRatio)).width
                                  ? 'rgba(191,219,254,0.26)'
                                  : 'rgba(255,255,255,0.06)'}`,
                                fontSize: '0.54rem',
                                fontWeight: 700,
                                letterSpacing: 0.26,
                              }}
                            >
                              {preset}
                            </Button>
                          ))}
                        </Stack>
                        <Stack direction="row" spacing={0.45} flexWrap="wrap" useFlexGap>
                          {['Safe Crop', activeSpatialCanvas?.name || 'Canvas', aspectChromeLabel, guideProfileLabel].map((item) => (
                            <Chip
                                key={item}
                                label={item}
                                size="small"
                                sx={{
                                  height: 20,
                                  borderRadius: 999,
                                  bgcolor: item === 'Safe Crop' ? 'rgba(246,178,77,0.16)' : 'rgba(255,255,255,0.04)',
                                  color: item === 'Safe Crop' ? '#fde68a' : 'rgba(248,250,252,0.74)',
                                  '& .MuiChip-label': { px: 0.72, fontSize: '0.55rem', fontWeight: 700, letterSpacing: 0.28 },
                                }}
                              />
                            ))}
                          </Stack>
                        </Stack>
                      </Box>
                    </Box>

                    <Stack
                      data-testid="frame-editor-precision-guides"
                      spacing={0.55}
                      sx={{
                        p: 0.55,
                        borderRadius: 1.6,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'rgba(248,250,252,0.5)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.1 }}
                        >
                          GUIDE ENGINE
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 600, letterSpacing: 0.28 }}>
                          {guideProfileLabel}
                        </Typography>
                      </Stack>
                      <Box
                        data-testid="frame-editor-precision-guide-preview"
                        sx={{
                          position: 'relative',
                          height: 56,
                          borderRadius: 1.5,
                          bgcolor: 'rgba(2,6,23,0.68)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          overflow: 'hidden',
                        }}
                      >
                        {selectedGuideMode === 'Perspective' ? (
                          <>
                            {['15%', '50%', '85%'].map((top) => (
                              <Box
                                key={`perspective-left-${top}`}
                                sx={{
                                  position: 'absolute',
                                  left: 0,
                                  right: '50%',
                                  top,
                                  height: 1,
                                  bgcolor: 'rgba(248,250,252,0.32)',
                                  transform: 'rotate(-14deg)',
                                  transformOrigin: '100% 50%',
                                }}
                              />
                            ))}
                            {['15%', '50%', '85%'].map((top) => (
                              <Box
                                key={`perspective-right-${top}`}
                                sx={{
                                  position: 'absolute',
                                  left: '50%',
                                  right: 0,
                                  top,
                                  height: 1,
                                  bgcolor: 'rgba(248,250,252,0.32)',
                                  transform: 'rotate(14deg)',
                                  transformOrigin: '0% 50%',
                                }}
                              />
                            ))}
                          </>
                        ) : null}
                        {selectedGuideMode === 'Isometric' ? (
                          <>
                            {Array.from({ length: 6 }).map((_, index) => (
                              <Box
                                key={`iso-a-${index}`}
                                sx={{
                                  position: 'absolute',
                                  left: -14,
                                  right: -14,
                                  top: 6 + index * 10,
                                  height: 1,
                                  bgcolor: 'rgba(248,250,252,0.22)',
                                  transform: 'rotate(28deg)',
                                }}
                              />
                            ))}
                            {Array.from({ length: 6 }).map((_, index) => (
                              <Box
                                key={`iso-b-${index}`}
                                sx={{
                                  position: 'absolute',
                                  left: -14,
                                  right: -14,
                                  top: 6 + index * 10,
                                  height: 1,
                                  bgcolor: 'rgba(246,178,77,0.2)',
                                  transform: 'rotate(-28deg)',
                                }}
                              />
                            ))}
                          </>
                        ) : null}
                        {selectedGuideMode === '2D' ? (
                          <>
                            {Array.from({ length: 5 }).map((_, index) => (
                              <Box
                                key={`flat-row-${index}`}
                                sx={{
                                  position: 'absolute',
                                  left: 8,
                                  right: 8,
                                  top: 8 + index * 10,
                                  height: 1,
                                  bgcolor: 'rgba(248,250,252,0.22)',
                                }}
                              />
                            ))}
                            {Array.from({ length: 7 }).map((_, index) => (
                              <Box
                                key={`flat-col-${index}`}
                                sx={{
                                  position: 'absolute',
                                  top: 8,
                                  bottom: 8,
                                  left: 10 + index * 24,
                                  width: 1,
                                  bgcolor: 'rgba(248,250,252,0.18)',
                                }}
                              />
                            ))}
                          </>
                        ) : null}
                        {selectedGuideMode === 'Symmetry' ? (
                          <>
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 6,
                                bottom: 6,
                                left: '50%',
                                width: 2,
                                bgcolor: 'rgba(246,178,77,0.72)',
                                boxShadow: '0 0 10px rgba(246,178,77,0.25)',
                              }}
                            />
                            {[12, 22, 32].map((top, index) => (
                              <Box
                                key={`sym-left-${top}`}
                                sx={{
                                  position: 'absolute',
                                  left: 18,
                                  top,
                                  width: 26 + index * 6,
                                  height: 10,
                                  borderRadius: 999,
                                  border: '1px solid rgba(248,250,252,0.22)',
                                }}
                              />
                            ))}
                            {[12, 22, 32].map((top, index) => (
                              <Box
                                key={`sym-right-${top}`}
                                sx={{
                                  position: 'absolute',
                                  right: 18,
                                  top,
                                  width: 26 + index * 6,
                                  height: 10,
                                  borderRadius: 999,
                                  border: '1px solid rgba(248,250,252,0.22)',
                                }}
                              />
                            ))}
                          </>
                        ) : null}
                      </Box>
                      <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                        {STUDIO_GUIDE_MODES.map((mode) => (
                          <Button
                            key={mode}
                            size="small"
                            onClick={() => {
                              setSelectedGuideMode(mode);
                              if (mode === 'Symmetry') {
                                setMirrorGuideEnabled(true);
                              }
                            }}
                            sx={{
                              minHeight: isTabletWorkspace ? 34 : 28,
                              px: 1,
                              borderRadius: 999,
                              color: selectedGuideMode === mode ? '#111827' : 'rgba(248,250,252,0.72)',
                              bgcolor: selectedGuideMode === mode ? '#f6b24d' : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${selectedGuideMode === mode ? 'rgba(246,178,77,0.28)' : 'rgba(255,255,255,0.06)'}`,
                              fontSize: '0.64rem',
                              fontWeight: 700,
                              letterSpacing: 0.3,
                            }}
                          >
                            {mode}
                          </Button>
                        ))}
                      </Stack>
                      <Stack
                        data-testid="frame-editor-precision-guide-toggles"
                        direction="row"
                        spacing={0.45}
                        flexWrap="wrap"
                        useFlexGap
                      >
                        <Button
                          size="small"
                          onClick={() => setGuideSnapEnabled((prev) => !prev)}
                          sx={{
                            minHeight: isTabletWorkspace ? 30 : 24,
                            px: 0.85,
                            borderRadius: 999,
                            color: guideSnapEnabled ? '#111827' : 'rgba(248,250,252,0.72)',
                            bgcolor: guideSnapEnabled ? '#bfdbfe' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${guideSnapEnabled ? 'rgba(191,219,254,0.26)' : 'rgba(255,255,255,0.06)'}`,
                            fontSize: '0.56rem',
                            fontWeight: 700,
                            letterSpacing: 0.28,
                          }}
                        >
                          Snap
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setMirrorGuideEnabled((prev) => !prev)}
                          sx={{
                            minHeight: isTabletWorkspace ? 30 : 24,
                            px: 0.85,
                            borderRadius: 999,
                            color: mirrorGuideEnabled ? '#111827' : 'rgba(248,250,252,0.72)',
                            bgcolor: mirrorGuideEnabled ? '#fde68a' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${mirrorGuideEnabled ? 'rgba(246,178,77,0.26)' : 'rgba(255,255,255,0.06)'}`,
                            fontSize: '0.56rem',
                            fontWeight: 700,
                            letterSpacing: 0.28,
                          }}
                        >
                          Mirror
                        </Button>
                      </Stack>
                    </Stack>

                    <Stack
                      data-testid="frame-editor-precision-assists"
                      spacing={0.55}
                    >
                      <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                        <Chip
                          icon={<AutoAwesome sx={{ fontSize: 14 }} />}
                          label={autoEnhance ? 'Drawing Assist On' : 'Drawing Assist Ready'}
                          onClick={() => setAutoEnhance((prev) => !prev)}
                          size="small"
                          sx={{
                            height: 24,
                            borderRadius: 999,
                            bgcolor: autoEnhance ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.05)',
                            color: autoEnhance ? '#86efac' : 'rgba(248,250,252,0.72)',
                            '& .MuiChip-label': { px: 0.85, fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.3 },
                          }}
                        />
                        <Chip
                          icon={<Tune sx={{ fontSize: 14 }} />}
                          label={`StreamLine ${stabilizeValue}%`}
                          size="small"
                          sx={{
                            height: 24,
                            borderRadius: 999,
                            bgcolor: 'rgba(168,85,247,0.14)',
                            color: '#e9d5ff',
                            '& .MuiChip-label': { px: 0.85, fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.3 },
                          }}
                        />
                      </Stack>
                      <Stack
                        data-testid="frame-editor-precision-assist-meters"
                        spacing={0.45}
                        sx={{
                          px: 0.7,
                          py: 0.6,
                          borderRadius: 1.5,
                          bgcolor: 'rgba(255,255,255,0.025)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        {[
                          { label: 'Drawing Assist', value: autoEnhance ? 82 : 46, accent: '#86efac' },
                          { label: 'StreamLine', value: stabilizeValue, accent: '#c4b5fd' },
                        ].map((meter) => (
                          <Stack key={meter.label} spacing={0.2}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 600 }}>
                                {meter.label}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                {meter.value}%
                              </Typography>
                            </Stack>
                            <Box
                              sx={{
                                height: 6,
                                borderRadius: 999,
                                bgcolor: 'rgba(255,255,255,0.06)',
                                overflow: 'hidden',
                              }}
                            >
                              <Box
                                sx={{
                                  width: `${meter.value}%`,
                                  height: '100%',
                                  borderRadius: 999,
                                  bgcolor: meter.accent,
                                  boxShadow: `0 0 12px ${alpha(meter.accent, 0.28)}`,
                                }}
                              />
                            </Box>
                          </Stack>
                        ))}
                      </Stack>
                    </Stack>
                  </Stack>
                </Box>
              </Stack>
            </Paper>

            <Paper
              data-testid="frame-editor-stage"
              sx={{
                gridArea: 'stage',
                p: 1.05,
                borderRadius: 3,
                background: 'linear-gradient(180deg, rgba(12,14,22,0.98), rgba(4,6,12,0.98))',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <Stack
                data-testid="frame-editor-stage-topbar"
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                useFlexGap
                sx={{
                  px: 1,
                  py: isTabletWorkspace ? 0.85 : 0.7,
                  borderRadius: 2.25,
                  background: 'linear-gradient(180deg, rgba(15,18,28,0.84), rgba(6,8,14,0.96))',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                  mb: 1,
                  overflowX: isTabletWorkspace ? 'auto' : 'visible',
                  overflowY: 'hidden',
                  scrollbarWidth: 'thin',
                  '&::-webkit-scrollbar': {
                    height: isTabletWorkspace ? 6 : 0,
                  },
                  '&::-webkit-scrollbar-thumb': {
                    backgroundColor: isTabletWorkspace ? 'rgba(148,163,184,0.28)' : 'transparent',
                    borderRadius: 999,
                  },
                }}
              >
                <Stack
                  data-testid="frame-editor-stage-optics-strip"
                  direction="row"
                  alignItems="center"
                  spacing={0.75}
                  sx={{
                    px: 0.95,
                    py: isTabletWorkspace ? 0.7 : 0.45,
                    borderRadius: 999,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    flexShrink: 0,
                  }}
                >
                  <FiberManualRecord sx={{ fontSize: 15, color: '#fb7185' }} />
                  <Typography
                    variant="caption"
                    sx={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.8rem', lineHeight: 1, letterSpacing: 0.2 }}
                  >
                    50mm
                  </Typography>
                  <Box sx={{ width: 1, height: 16, bgcolor: 'rgba(255,255,255,0.08)' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.62)', fontWeight: 600, letterSpacing: 0.35 }}>
                    f/1.8
                  </Typography>
                  <Box sx={{ width: 1, height: 16, bgcolor: 'rgba(255,255,255,0.08)' }} />
                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.62)', fontWeight: 600, letterSpacing: 0.35 }}>
                    180°
                  </Typography>
                </Stack>
                <Stack
                  data-testid="frame-editor-stage-camera-strip"
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    minWidth: 248,
                    ml: isTabletWorkspace ? 0 : 'auto',
                    px: 1,
                    py: isTabletWorkspace ? 0.7 : 0.45,
                    borderRadius: 999,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.68)', fontWeight: 600, letterSpacing: 0.28 }}>
                    Camera Height
                  </Typography>
                  <Slider
                    size="small"
                    value={62}
                    min={0}
                    max={100}
                    sx={{
                      flex: 1,
                      color: '#f6b24d',
                      '& .MuiSlider-thumb': {
                        width: 14,
                        height: 14,
                        boxShadow: '0 0 0 4px rgba(245,158,11,0.18)',
                      },
                    }}
                  />
                </Stack>
                <Box
                  data-testid="frame-editor-stage-light-dial"
                  sx={{
                    width: isTabletWorkspace ? 54 : 46,
                    height: isTabletWorkspace ? 54 : 46,
                    borderRadius: '50%',
                    border: '1px solid rgba(246,178,77,0.35)',
                    background:
                      'radial-gradient(circle at 36% 34%, rgba(255,223,128,0.95), rgba(245,158,11,0.18) 28%, rgba(15,23,42,0.18) 52%, rgba(15,23,42,0.92) 74%)',
                    boxShadow: 'inset 0 0 26px rgba(245,158,11,0.18), 0 0 18px rgba(245,158,11,0.18)',
                    position: 'relative',
                    flexShrink: 0,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 5,
                      borderRadius: '50%',
                      border: '1px dashed rgba(255,255,255,0.22)',
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      left: '50%',
                      top: 6,
                      width: 2,
                      height: 14,
                      borderRadius: 999,
                      bgcolor: '#fde68a',
                      transform: 'translateX(-50%) rotate(34deg)',
                      transformOrigin: '50% 100%',
                    },
                  }}
                />
              </Stack>

              <Box sx={{ position: 'relative', flex: 1, minHeight: 0 }}>
                <CanvasWrapper
                  data-testid="frame-editor-canvas-shell"
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    border: boardPolishPresentationActive
                      ? '1px solid rgba(255,255,255,0.08)'
                      : '1px solid rgba(255,255,255,0.05)',
                    background: boardPolishPresentationActive
                      ? boardPolishToneConfig.shellBackground
                      : 'radial-gradient(circle at top, rgba(255,255,255,0.04), transparent 42%), linear-gradient(180deg, rgba(3,7,18,0.98), rgba(2,4,9,0.98))',
                    p: 1.6,
                    boxShadow: boardPolishPresentationActive
                      ? 'inset 0 1px 0 rgba(255,255,255,0.05), 0 32px 90px rgba(0,0,0,0.42)'
                      : undefined,
                  }}
                >
                  <Box sx={{ position: 'relative' }}>
                    <Box
                      data-testid="frame-editor-board-polish-canvas"
                      sx={{
                        position: 'relative',
                        filter: boardPolishCanvasFilter,
                        transition: 'filter 180ms ease',
                        pointerEvents: shapeScaffoldInteractionState ? 'none' : 'auto',
                      }}
                    >
                      {canvasElement}
                    </Box>
                    {!boardPolishPresentationActive && (
                      <Box data-testid="frame-editor-canvas-overlays" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 18,
                            border: '2px solid rgba(255,255,255,0.55)',
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.08) inset',
                          }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 42,
                            border: '1px dashed rgba(255,255,255,0.28)',
                          }}
                        />
                        <Box sx={{ position: 'absolute', inset: 18 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              position: 'absolute',
                              top: -24,
                              right: 0,
                              fontSize: 11,
                              letterSpacing: 2,
                              color: 'rgba(248,250,252,0.54)',
                            }}
                          >
                            SAFE AREAS
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              position: 'absolute',
                              bottom: -30,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              fontSize: 16,
                              letterSpacing: 2.2,
                              fontWeight: 700,
                              color: 'rgba(248,250,252,0.92)',
                            }}
                          >
                            PUSH IN
                          </Typography>
                        </Box>
                        <Stack
                          data-testid="frame-editor-canvas-rail-left"
                          spacing={0.75}
                          sx={{
                            position: 'absolute',
                            left: 10,
                            top: '28%',
                            transform: 'translateY(-50%)',
                            alignItems: 'center',
                          }}
                        >
                          {Array.from({ length: 6 }).map((_, index) => (
                            <Box
                              key={`left-rail-${index}`}
                              sx={{
                                width: index === 2 ? 14 : 8,
                                height: 2,
                                borderRadius: 999,
                                bgcolor: index === 2 ? '#f6b24d' : 'rgba(248,250,252,0.24)',
                                boxShadow: index === 2 ? '0 0 10px rgba(246,178,77,0.3)' : 'none',
                              }}
                            />
                          ))}
                        </Stack>
                        <Stack
                          data-testid="frame-editor-canvas-rail-right"
                          spacing={0.75}
                          sx={{
                            position: 'absolute',
                            right: 10,
                            top: '34%',
                            transform: 'translateY(-50%)',
                            alignItems: 'center',
                          }}
                        >
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Box
                              key={`right-rail-${index}`}
                              sx={{
                                width: index === 1 ? 14 : 8,
                                height: 2,
                                borderRadius: 999,
                                bgcolor: index === 1 ? '#f6b24d' : 'rgba(248,250,252,0.24)',
                                boxShadow: index === 1 ? '0 0 10px rgba(246,178,77,0.3)' : 'none',
                              }}
                            />
                          ))}
                        </Stack>
                        {[
                          { top: 18, left: 18 },
                          { top: 18, right: 18 },
                          { bottom: 18, left: 18 },
                          { bottom: 18, right: 18 },
                        ].map((position, index) => (
                          <Box
                            key={`corner-${index}`}
                            sx={{
                              position: 'absolute',
                              width: 18,
                              height: 18,
                              borderTop: '2px solid rgba(248,250,252,0.7)',
                              borderLeft: '2px solid rgba(248,250,252,0.7)',
                              transform:
                                index === 0
                                  ? 'none'
                                  : index === 1
                                    ? 'rotate(90deg)'
                                    : index === 2
                                      ? 'rotate(-90deg)'
                                      : 'rotate(180deg)',
                              ...position,
                            }}
                          />
                        ))}
                        <ArrowBack
                          sx={{
                            position: 'absolute',
                            left: 16,
                            top: '46%',
                            fontSize: 62,
                            color: 'rgba(248,250,252,0.92)',
                            filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.16))',
                          }}
                        />
                        <ArrowForward
                          sx={{
                            position: 'absolute',
                            right: 16,
                            top: '43%',
                            fontSize: 62,
                            color: 'rgba(248,250,252,0.92)',
                            filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.16))',
                          }}
                        />
                        <Reply
                          sx={{
                            position: 'absolute',
                            left: '56%',
                            bottom: 14,
                            fontSize: 52,
                            color: 'rgba(248,250,252,0.92)',
                            transform: 'rotate(-52deg)',
                          }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 18,
                            background:
                              'radial-gradient(circle at center, transparent 54%, rgba(0,0,0,0.22) 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 24px), repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0 1px, transparent 1px 22px)',
                            mixBlendMode: 'screen',
                            opacity: 0.38,
                          }}
                        />
                      </Box>
                    )}
                    {boardPolishPresentationActive && (
                      <Box
                        data-testid="frame-editor-board-polish-overlay"
                        data-tone={boardPolishTone}
                        data-finish={boardPolishFinish}
                        data-weather={boardPolishWeather}
                        data-atmosphere={boardPolishAtmosphere.toFixed(3)}
                        data-line-boost={boardPolishLineBoost.toFixed(3)}
                        data-effect-count={String(boardPolishActiveEffectLayers.length)}
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          pointerEvents: 'none',
                          borderRadius: 2.5,
                        }}
                      >
                        {boardPolishActiveEffectLayers.map((layer) => (
                          <Box
                            key={layer.id}
                            data-testid={`frame-editor-board-polish-effect-${layer.id}`}
                            data-blend-mode={layer.mixBlendMode}
                            data-opacity={layer.opacity.toFixed(3)}
                            data-x-ratio={layer.region.xRatio.toFixed(4)}
                            data-y-ratio={layer.region.yRatio.toFixed(4)}
                            data-width-ratio={layer.region.widthRatio.toFixed(4)}
                            data-height-ratio={layer.region.heightRatio.toFixed(4)}
                            data-feather={layer.region.feather.toFixed(4)}
                            sx={{
                              position: 'absolute',
                              left: `${layer.region.xRatio * 100}%`,
                              top: `${layer.region.yRatio * 100}%`,
                              width: `${layer.region.widthRatio * 100}%`,
                              height: `${layer.region.heightRatio * 100}%`,
                              borderRadius: 2.5,
                              background: 'transparent',
                              mixBlendMode: layer.mixBlendMode,
                              opacity: 1,
                            }}
                          />
                        ))}
                      </Box>
                    )}
                    {!boardPolishPresentationActive && selectedBoardPolishEffectLayerId && selectedBoardPolishEffectRegion && (
                      <Box
                        ref={boardPolishEffectOverlayRef}
                        data-testid="frame-editor-board-polish-effect-region-overlay-layer"
                        sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 7 }}
                      >
                        <Box
                          data-testid="frame-editor-board-polish-effect-region-overlay"
                          data-effect-id={selectedBoardPolishEffectLayerId}
                          data-x-ratio={selectedBoardPolishEffectRegion.xRatio.toFixed(4)}
                          data-y-ratio={selectedBoardPolishEffectRegion.yRatio.toFixed(4)}
                          data-width-ratio={selectedBoardPolishEffectRegion.widthRatio.toFixed(4)}
                          data-height-ratio={selectedBoardPolishEffectRegion.heightRatio.toFixed(4)}
                          data-feather={selectedBoardPolishEffectRegion.feather.toFixed(4)}
                          sx={{
                            position: 'absolute',
                            left: `${selectedBoardPolishEffectRegion.xRatio * 100}%`,
                            top: `${selectedBoardPolishEffectRegion.yRatio * 100}%`,
                            width: `${selectedBoardPolishEffectRegion.widthRatio * 100}%`,
                            height: `${selectedBoardPolishEffectRegion.heightRatio * 100}%`,
                            pointerEvents: 'none',
                            borderRadius: `${Math.max(10, selectedBoardPolishEffectRegion.feather * 56)}px`,
                            border: '1.5px solid rgba(125,211,252,0.9)',
                            background: 'linear-gradient(180deg, rgba(125,211,252,0.08), rgba(15,23,42,0.02))',
                            boxShadow: '0 0 0 1px rgba(125,211,252,0.18) inset, 0 18px 30px rgba(2,6,23,0.28)',
                            outline: boardPolishEffectInteractionState ? '2px solid rgba(125,211,252,0.28)' : 'none',
                            outlineOffset: 2,
                          }}
                        >
                          <Box
                            data-testid="frame-editor-board-polish-effect-region-move-handle"
                            onPointerDown={(event) => handleBoardPolishEffectRegionPointerStart(event, 'move')}
                            sx={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: 0,
                              px: 0.75,
                              py: 0.45,
                              pointerEvents: 'auto',
                              cursor: 'grab',
                              borderTopLeftRadius: 'inherit',
                              borderTopRightRadius: 'inherit',
                              background: 'linear-gradient(180deg, rgba(14,165,233,0.22), rgba(2,6,23,0.04))',
                              borderBottom: '1px solid rgba(125,211,252,0.18)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Typography variant="caption" sx={{ color: '#e0f2fe', fontWeight: 700, letterSpacing: 0.45 }}>
                              {selectedStudioLayer?.label || 'FX Region'}
                            </Typography>
                            <Chip
                              size="small"
                              label={`${Math.round(selectedBoardPolishEffectRegion.feather * 100)} feather`}
                              sx={{
                                height: 18,
                                borderRadius: 999,
                                bgcolor: 'rgba(255,255,255,0.08)',
                                color: '#e0f2fe',
                                '& .MuiChip-label': { px: 0.6, fontSize: '0.52rem', fontWeight: 700, letterSpacing: 0.35 },
                              }}
                            />
                          </Box>
                          {(['nw', 'ne', 'se', 'sw'] as const).map((corner) => (
                            <Box
                              key={corner}
                              data-testid={`frame-editor-board-polish-effect-region-handle-${corner}`}
                              onPointerDown={(event) => handleBoardPolishEffectRegionPointerStart(event, `resize-${corner}`)}
                              sx={{
                                position: 'absolute',
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                border: '2px solid rgba(186,230,253,0.94)',
                                bgcolor: '#0f172a',
                                boxShadow: '0 0 0 1px rgba(14,165,233,0.24)',
                                pointerEvents: 'auto',
                                cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                                ...(corner === 'nw' ? { left: -7, top: -7 } : {}),
                                ...(corner === 'ne' ? { right: -7, top: -7 } : {}),
                                ...(corner === 'se' ? { right: -7, bottom: -7 } : {}),
                                ...(corner === 'sw' ? { left: -7, bottom: -7 } : {}),
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                    {!boardPolishPresentationActive && selectedShapeScaffold && selectedShapeScaffoldDisplayFrame && (
                      <Box
                        ref={shapeScaffoldOverlayRef}
                        data-testid="frame-editor-shape-scaffold-overlay-layer"
                        sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}
                      >
                        <Box
                          ref={shapeScaffoldOverlayBoxRef}
                          data-testid="frame-editor-shape-scaffold-overlay"
                          data-x-ratio={selectedShapeScaffoldDisplayFrame.xRatio.toFixed(4)}
                          data-y-ratio={selectedShapeScaffoldDisplayFrame.yRatio.toFixed(4)}
                          data-width-ratio={selectedShapeScaffoldDisplayFrame.widthRatio.toFixed(4)}
                          data-height-ratio={selectedShapeScaffoldDisplayFrame.heightRatio.toFixed(4)}
                          sx={{
                            position: 'absolute',
                            left: `${selectedShapeScaffoldDisplayFrame.xRatio * 100}%`,
                            top: `${selectedShapeScaffoldDisplayFrame.yRatio * 100}%`,
                            width: `${selectedShapeScaffoldDisplayFrame.widthRatio * 100}%`,
                            height: `${selectedShapeScaffoldDisplayFrame.heightRatio * 100}%`,
                            pointerEvents: 'none',
                            borderRadius: 1.2,
                            border: `1.5px solid ${alpha(selectedShapeScaffoldSuggestion?.accentColor || '#34d399', selectedShapeScaffold.visible ? 0.88 : 0.52)}`,
                            background: selectedShapeScaffold.visible
                              ? `linear-gradient(180deg, ${alpha(selectedShapeScaffoldSuggestion?.accentColor || '#34d399', 0.1)}, rgba(15,23,42,0.02))`
                              : 'rgba(15,23,42,0.08)',
                            boxShadow: selectedShapeScaffold.visible
                              ? `0 0 0 1px ${alpha(selectedShapeScaffoldSuggestion?.accentColor || '#34d399', 0.18)} inset, 0 14px 28px rgba(2,6,23,0.24)`
                              : '0 0 0 1px rgba(255,255,255,0.06) inset',
                            outline: shapeScaffoldInteractionState ? `2px solid ${alpha(selectedShapeScaffoldSuggestion?.accentColor || '#34d399', 0.32)}` : 'none',
                            outlineOffset: 2,
                          }}
                        >
                          {selectedShapeScaffold.visible && selectedShapeScaffoldOverlayRecord?.src && (
                            <Box
                              component="img"
                              alt={`${selectedShapeScaffold.name} canvas scaffold`}
                              src={selectedShapeScaffoldOverlayRecord.src}
                              sx={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'fill',
                                opacity: selectedShapeScaffold.opacity,
                                pointerEvents: 'none',
                                userSelect: 'none',
                                WebkitUserDrag: 'none',
                              }}
                            />
                          )}
                          <Box
                            data-testid="frame-editor-shape-scaffold-move-handle"
                            onPointerDown={(event) => handleShapeScaffoldPointerStart(event, 'move')}
                            sx={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: 0,
                              px: 0.75,
                              py: 0.5,
                              borderRadius: '10px 10px 0 0',
                              bgcolor: 'rgba(2,6,23,0.68)',
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                              pointerEvents: 'auto',
                              cursor: shapeScaffoldInteractionState ? 'grabbing' : 'grab',
                            }}
                          >
                            <Stack
                              direction="row"
                              alignItems="center"
                              justifyContent="space-between"
                              spacing={0.75}
                              sx={{ pointerEvents: 'none' }}
                            >
                              <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700, letterSpacing: 0.45 }}>
                                {selectedShapeScaffold.name}
                              </Typography>
                              <Chip
                                size="small"
                                label={selectedShapeScaffold.visible ? 'MOVE' : 'HIDDEN'}
                                sx={{
                                  height: 18,
                                  borderRadius: 999,
                                  bgcolor: selectedShapeScaffold.visible ? alpha(selectedShapeScaffoldSuggestion?.accentColor || '#34d399', 0.16) : 'rgba(255,255,255,0.08)',
                                  color: selectedShapeScaffold.visible ? '#d1fae5' : 'rgba(248,250,252,0.72)',
                                  '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.35 },
                                }}
                              />
                            </Stack>
                          </Box>
                          <Stack
                            data-testid="frame-editor-shape-scaffold-overlay-toolbar"
                            direction="row"
                            spacing={0.45}
                            alignItems="center"
                            sx={{
                              position: 'absolute',
                              left: 8,
                              right: 8,
                              bottom: 34,
                              flexWrap: 'wrap',
                              pointerEvents: 'auto',
                            }}
                            onPointerDown={stopShapeScaffoldOverlayInteraction}
                          >
                            <Button
                              size="small"
                              data-testid="frame-editor-shape-scaffold-overlay-prev"
                              onPointerDown={(event) => {
                                stopShapeScaffoldOverlayInteraction(event);
                                handleCycleSelectedShapeScaffoldSuggestion(-1);
                              }}
                              sx={{
                                minHeight: 24,
                                minWidth: 24,
                                px: 0.85,
                                borderRadius: 999,
                                bgcolor: 'rgba(2,6,23,0.74)',
                                color: '#f8fafc',
                                border: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              Prev
                            </Button>
                            <Button
                              size="small"
                              data-testid="frame-editor-shape-scaffold-overlay-next"
                              onPointerDown={(event) => {
                                stopShapeScaffoldOverlayInteraction(event);
                                handleCycleSelectedShapeScaffoldSuggestion(1);
                              }}
                              sx={{
                                minHeight: 24,
                                minWidth: 24,
                                px: 0.85,
                                borderRadius: 999,
                                bgcolor: 'rgba(2,6,23,0.74)',
                                color: '#f8fafc',
                                border: '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              Next
                            </Button>
                            {selectedShapeScaffoldSingleParameters.map((parameter) => {
                              const selectedValue = selectedShapeScaffold.selections[parameter.id]?.[0]
                                || parameter.defaultValue[0]
                                || parameter.options[0]?.id;
                              const selectedOption = parameter.options.find((option) => option.id === selectedValue)
                                || parameter.options[0];
                              if (!selectedOption) {
                                return null;
                              }
                              return (
                                <Button
                                  key={parameter.id}
                                  size="small"
                                  data-testid={`frame-editor-shape-scaffold-overlay-parameter-${parameter.id}`}
                                  onPointerDown={(event) => {
                                    stopShapeScaffoldOverlayInteraction(event);
                                    handleCycleSelectedShapeScaffoldSingleParameter(parameter.id, 1);
                                  }}
                                  sx={{
                                    minHeight: 24,
                                    px: 0.85,
                                    borderRadius: 999,
                                    bgcolor: alpha(selectedShapeScaffoldSuggestion?.accentColor || '#34d399', 0.18),
                                    color: '#f8fafc',
                                    border: `1px solid ${alpha(selectedShapeScaffoldSuggestion?.accentColor || '#34d399', 0.28)}`,
                                  }}
                                >
                                  {`${parameter.label}: ${selectedOption.label}`}
                                </Button>
                              );
                            })}
                          </Stack>
                          <Typography
                            data-testid="frame-editor-shape-scaffold-frame-readout"
                            variant="caption"
                            sx={{
                              position: 'absolute',
                              right: 8,
                              bottom: 8,
                              px: 0.6,
                              py: 0.28,
                              borderRadius: 999,
                              bgcolor: 'rgba(2,6,23,0.7)',
                              color: 'rgba(226,232,240,0.82)',
                              fontWeight: 700,
                              letterSpacing: 0.32,
                              pointerEvents: 'none',
                            }}
                          >
                            {selectedShapeScaffoldFrameLabel}
                          </Typography>
                          {([
                            { corner: 'nw', cursor: 'nwse-resize', left: -7, top: -7 },
                            { corner: 'ne', cursor: 'nesw-resize', right: -7, top: -7 },
                            { corner: 'se', cursor: 'nwse-resize', right: -7, bottom: -7 },
                            { corner: 'sw', cursor: 'nesw-resize', left: -7, bottom: -7 },
                          ] as const).map((handle) => (
                            <Box
                              key={handle.corner}
                              data-testid={`frame-editor-shape-scaffold-handle-${handle.corner}`}
                              onPointerDown={(event) => handleShapeScaffoldPointerStart(event, `resize-${handle.corner}`)}
                              sx={{
                                position: 'absolute',
                                width: 14,
                                height: 14,
                                borderRadius: '50%',
                                bgcolor: selectedShapeScaffoldSuggestion?.accentColor || '#34d399',
                                border: '2px solid rgba(2,6,23,0.9)',
                                boxShadow: `0 0 0 1px ${alpha(selectedShapeScaffoldSuggestion?.accentColor || '#34d399', 0.3)}, 0 6px 14px rgba(2,6,23,0.34)`,
                                cursor: handle.cursor,
                                pointerEvents: 'auto',
                                ...handle,
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Box>
                </CanvasWrapper>
              </Box>

              <Stack
                data-testid="frame-editor-timeline"
                spacing={0.8}
                sx={{
                  mt: 0.9,
                  px: 0.7,
                  py: 0.7,
                  borderRadius: 2.35,
                  background: 'linear-gradient(180deg, rgba(12,15,24,0.92), rgba(6,8,14,0.98))',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                }}
              >
                <Stack
                  data-testid="frame-editor-transport-row"
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                  useFlexGap
                  sx={{
                    overflowX: isTabletWorkspace ? 'auto' : 'visible',
                    overflowY: 'hidden',
                    scrollbarWidth: 'thin',
                    '&::-webkit-scrollbar': { height: isTabletWorkspace ? 6 : 0 },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: isTabletWorkspace ? 'rgba(148,163,184,0.28)' : 'transparent',
                      borderRadius: 999,
                    },
                  }}
                >
                  <Stack
                    data-testid="frame-editor-transport-meta"
                    direction="row"
                    alignItems="center"
                    spacing={0.75}
                    sx={{
                      border: '1px solid rgba(255,255,255,0.08)',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      borderRadius: 999,
                      px: 0.45,
                      py: isTabletWorkspace ? 0.55 : 0.35,
                      flexShrink: 0,
                    }}
                  >
                    <Chip
                      data-testid="frame-editor-timecode-chip"
                      label={timecode}
                      size="small"
                      sx={{
                        bgcolor: 'rgba(2,6,23,0.94)',
                        color: '#f8fafc',
                        borderRadius: 1.25,
                        border: '1px solid rgba(255,255,255,0.08)',
                        '& .MuiChip-label': {
                          px: 1.2,
                          fontFamily: '"SFMono-Regular", "SF Mono", "Roboto Mono", monospace',
                          fontWeight: 600,
                          letterSpacing: 0.75,
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.42)', fontWeight: 700, letterSpacing: 1.5 }}>
                      PLAYBACK
                    </Typography>
                  </Stack>
                  <Stack
                    data-testid="frame-editor-transport-controls"
                    direction="row"
                    alignItems="center"
                    spacing={0.55}
                    sx={{
                      px: 0.55,
                      py: isTabletWorkspace ? 0.5 : 0.35,
                      borderRadius: 999,
                      background: 'linear-gradient(180deg, rgba(24,28,39,0.92), rgba(10,12,18,0.98))',
                      border: '1px solid rgba(255,255,255,0.07)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                      flexShrink: 0,
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={() => handleTimelineFrameSelect(0)}
                      sx={{ color: 'rgba(255,255,255,0.65)', width: isTabletWorkspace ? 34 : undefined, height: isTabletWorkspace ? 34 : undefined }}
                    >
                      <FastRewind fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleTimelineFrameSelect(Math.max(0, activeTimelineFrameIndex - 1))}
                      sx={{ color: 'rgba(255,255,255,0.65)', width: isTabletWorkspace ? 34 : undefined, height: isTabletWorkspace ? 34 : undefined }}
                    >
                      <SkipPrevious fontSize="small" />
                    </IconButton>
                    <IconButton
                      data-testid="frame-editor-play-button"
                      size="small"
                      onClick={() => {
                        if (timelineFrames.length <= 1) return;
                        setTransportPlaying((prev) => !prev);
                      }}
                      sx={{
                        width: isTabletWorkspace ? 40 : undefined,
                        height: isTabletWorkspace ? 40 : undefined,
                        color: '#111827',
                        background: 'linear-gradient(180deg, #ffffff, #dbe2ef)',
                        boxShadow: transportPlaying ? '0 0 0 4px rgba(246,178,77,0.18)' : '0 8px 18px rgba(255,255,255,0.16)',
                        '&:hover': { background: 'linear-gradient(180deg, #ffffff, #eef2f8)' },
                      }}
                    >
                      {transportPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleTimelineFrameSelect(Math.min(timelineFrames.length - 1, activeTimelineFrameIndex + 1))}
                      sx={{ color: 'rgba(255,255,255,0.65)', width: isTabletWorkspace ? 34 : undefined, height: isTabletWorkspace ? 34 : undefined }}
                    >
                      <SkipNext fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleTimelineFrameSelect(Math.max(0, timelineFrames.length - 1))}
                      sx={{ color: 'rgba(255,255,255,0.65)', width: isTabletWorkspace ? 34 : undefined, height: isTabletWorkspace ? 34 : undefined }}
                    >
                      <FastForward fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography
                    data-testid="frame-editor-transport-label"
                    variant="caption"
                    sx={{ color: 'rgba(248,250,252,0.58)', ml: isTabletWorkspace ? 0 : 'auto', fontWeight: 600, letterSpacing: 0.45, flexShrink: 0 }}
                  >
                    {transportLabel} · {activeSheet?.name || 'Sheet'}
                  </Typography>
                  <Stack
                    data-testid="frame-editor-timeline-quick-tools"
                    direction="row"
                    spacing={0.45}
                    alignItems="center"
                    flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                    useFlexGap
                    sx={{ flexShrink: 0 }}
                  >
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Add sx={{ fontSize: 14 }} />}
                      onClick={handleAddTimelineSheet}
                      sx={{
                        minHeight: isTabletWorkspace ? 34 : 26,
                        borderRadius: 999,
                        px: 0.95,
                        color: 'rgba(226,232,240,0.82)',
                        borderColor: 'rgba(255,255,255,0.08)',
                        bgcolor: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      Sheet
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ContentCopy sx={{ fontSize: 14 }} />}
                      onClick={handleDuplicateTimelineSheet}
                      sx={{
                        minHeight: isTabletWorkspace ? 34 : 26,
                        borderRadius: 999,
                        px: 0.95,
                        color: 'rgba(226,232,240,0.82)',
                        borderColor: 'rgba(255,255,255,0.08)',
                        bgcolor: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      Duplicate
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Link sx={{ fontSize: 14 }} />}
                      onClick={handleLinkTimelineSheet}
                      sx={{
                        minHeight: isTabletWorkspace ? 34 : 26,
                        borderRadius: 999,
                        px: 0.95,
                        color: 'rgba(226,232,240,0.82)',
                        borderColor: 'rgba(255,255,255,0.08)',
                        bgcolor: 'rgba(255,255,255,0.03)',
                      }}
                    >
                      Link
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Flag sx={{ fontSize: 14 }} />}
                      onClick={handleAddTimelineMarker}
                      sx={{
                        minHeight: isTabletWorkspace ? 34 : 26,
                        borderRadius: 999,
                        px: 0.95,
                        color: 'rgba(253,230,138,0.92)',
                        borderColor: 'rgba(246,178,77,0.18)',
                        bgcolor: 'rgba(246,178,77,0.08)',
                      }}
                    >
                      Marker
                    </Button>
                  </Stack>
                </Stack>

                <Stack
                  data-testid="frame-editor-marker-strip"
                  direction="row"
                  spacing={0.55}
                  alignItems="center"
                  flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                  useFlexGap
                  sx={{
                    px: 0.55,
                    py: 0.45,
                    borderRadius: 1.5,
                    bgcolor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    overflowX: isTabletWorkspace ? 'auto' : 'visible',
                    overflowY: 'hidden',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(248,250,252,0.48)', fontSize: '0.58rem', fontWeight: 700, letterSpacing: 1.05 }}
                  >
                    MARKERS
                  </Typography>
                  {markerStrip.length > 0 ? markerStrip.map((marker) => (
                    <Chip
                      key={marker.id}
                      label={`${marker.label} · F${String(marker.frame + 1).padStart(2, '0')}`}
                      size="small"
                      onClick={() => handleSelectMarker(marker.id)}
                      sx={{
                        height: 20,
                        borderRadius: 999,
                        bgcolor: selectedMarkerIds.includes(marker.id) ? alpha(marker.color, 0.26) : alpha(marker.color, 0.14),
                        color: selectedMarkerIds.includes(marker.id) ? '#fef3c7' : 'rgba(248,250,252,0.78)',
                        border: `1px solid ${alpha(marker.color, selectedMarkerIds.includes(marker.id) ? 0.46 : 0.22)}`,
                        '& .MuiChip-label': { px: 0.8, fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.28 },
                      }}
                    />
                  )) : (
                    <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.62)' }}>
                      No markers yet
                    </Typography>
                  )}
                  {activeMarkers.length > 0 && (
                    <Chip
                      icon={<FiberManualRecord sx={{ fontSize: 12 }} />}
                      label={`${activeMarkers.length} on this frame`}
                      size="small"
                      sx={{
                        height: 20,
                        borderRadius: 999,
                        bgcolor: 'rgba(59,130,246,0.14)',
                        color: '#bfdbfe',
                        '& .MuiChip-label': { px: 0.8, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.3 },
                      }}
                    />
                  )}
                </Stack>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(0, 1fr)' },
                    gap: 0.8,
                  }}
                >
                  <Stack
                    data-testid="frame-editor-timelapse-card"
                    spacing={0.65}
                    sx={{
                      px: 0.85,
                      py: 0.7,
                      borderRadius: 2.15,
                      background: 'linear-gradient(180deg, rgba(14,18,27,0.95), rgba(8,10,16,0.98))',
                      border: '1px solid rgba(255,255,255,0.06)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                      position: 'relative',
                    }}
                  >
                    <Stack
                      data-testid="frame-editor-timelapse-summary"
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <Chip
                        icon={<SlowMotionVideo sx={{ fontSize: 15 }} />}
                        label="Time-lapse Replay"
                        size="small"
                        sx={{
                          height: 22,
                          borderRadius: 999,
                          bgcolor: 'rgba(59,130,246,0.14)',
                          color: '#bfdbfe',
                          '& .MuiChip-label': { px: 0.85, fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.35 },
                        }}
                      />
                      <Chip
                        label={timeLapseStats.available ? 'READY' : 'ARMED'}
                        size="small"
                        sx={{
                          height: 18,
                          borderRadius: 999,
                          bgcolor: timeLapseStats.available ? 'rgba(34,197,94,0.16)' : 'rgba(245,158,11,0.16)',
                          color: timeLapseStats.available ? '#86efac' : '#fde68a',
                          '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.4 },
                        }}
                      />
                      <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.82)', fontWeight: 600, letterSpacing: 0.2 }}>
                        {timeLapseSummaryText}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
                      <Chip
                        label="4K master export"
                        size="small"
                        sx={{
                          height: 20,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.05)',
                          color: 'rgba(248,250,252,0.78)',
                          '& .MuiChip-label': { px: 0.8, fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.3 },
                        }}
                      />
                      <Chip
                        label="30s social cut"
                        size="small"
                        sx={{
                          height: 20,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.05)',
                          color: 'rgba(248,250,252,0.78)',
                          '& .MuiChip-label': { px: 0.8, fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.3 },
                        }}
                      />
                    </Stack>
                    <Box component="span" sx={STUDIO_VISUALLY_HIDDEN_SX}>
                      Export your Time-lapse recording in 4K for high-end video production
                      Share a short, 30-second version of your Time-lapse on your socials
                    </Box>

                    <Stack spacing={0.55}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'rgba(248,250,252,0.48)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.1 }}
                        >
                          REPLAY TRACK
                        </Typography>
                        <Typography
                          data-testid="frame-editor-timelapse-replay-label"
                          variant="caption"
                          sx={{ color: '#f8fafc', fontWeight: 600, letterSpacing: 0.35 }}
                        >
                          {timeLapseReplayLabel}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        data-testid="frame-editor-timelapse-progress"
                        variant="determinate"
                        value={timeLapseStats.available ? timeLapseProgressRatio * 100 : 3}
                        sx={{
                          height: 7,
                          borderRadius: 999,
                          bgcolor: 'rgba(255,255,255,0.08)',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, #60a5fa, #f6b24d)',
                          },
                        }}
                      />
                    </Stack>

                    <Stack data-testid="frame-editor-timelapse-actions" direction="row" spacing={0.65} flexWrap="wrap" useFlexGap>
                      <Button
                        data-testid="frame-editor-timelapse-replay"
                        size="small"
                        variant={timeLapsePlaying ? 'contained' : 'outlined'}
                        disabled={!timeLapseStats.available}
                        onClick={handleTimeLapseToggle}
                        startIcon={timeLapsePlaying ? <Pause sx={{ fontSize: 15 }} /> : <SlowMotionVideo sx={{ fontSize: 15 }} />}
                        sx={{
                          minHeight: 28,
                          borderRadius: 999,
                          px: 1,
                          color: timeLapsePlaying ? '#111827' : '#dbeafe',
                          bgcolor: timeLapsePlaying ? '#bfdbfe' : 'rgba(37,99,235,0.12)',
                          borderColor: 'rgba(96,165,250,0.25)',
                          '&.Mui-disabled': {
                            color: 'rgba(226,232,240,0.32)',
                            borderColor: 'rgba(255,255,255,0.08)',
                            bgcolor: 'rgba(255,255,255,0.02)',
                          },
                        }}
                      >
                        {timeLapsePlaying ? 'Pause' : 'Replay'}
                      </Button>
                      <Button
                        data-testid="frame-editor-timelapse-export-4k"
                        size="small"
                        variant="outlined"
                        disabled
                        startIcon={<HighQuality sx={{ fontSize: 15 }} />}
                        sx={{
                          minHeight: 28,
                          borderRadius: 999,
                          px: 1,
                          color: 'rgba(226,232,240,0.44)',
                          borderColor: 'rgba(255,255,255,0.08)',
                          bgcolor: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        4K
                      </Button>
                      <Button
                        data-testid="frame-editor-timelapse-social"
                        size="small"
                        variant="outlined"
                        disabled
                        startIcon={<Share sx={{ fontSize: 15 }} />}
                        sx={{
                          minHeight: 28,
                          borderRadius: 999,
                          px: 1,
                          color: 'rgba(226,232,240,0.44)',
                          borderColor: 'rgba(255,255,255,0.08)',
                          bgcolor: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        30s
                      </Button>
                    </Stack>
                    <Box component="span" sx={STUDIO_VISUALLY_HIDDEN_SX}>
                      4K Master 30s Social
                    </Box>
                  </Stack>

                  <Stack
                    data-testid="frame-editor-animation-assist-card"
                    spacing={0.65}
                    sx={{
                      px: 0.85,
                      py: 0.7,
                      borderRadius: 2.15,
                      background: 'linear-gradient(180deg, rgba(18,22,30,0.95), rgba(8,10,16,0.98))',
                      border: '1px solid rgba(255,255,255,0.06)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                      position: 'relative',
                    }}
                  >
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip
                        icon={<SlowMotionVideo sx={{ fontSize: 15 }} />}
                        label="Animation Assist"
                        size="small"
                        sx={{
                          height: 22,
                          borderRadius: 999,
                          bgcolor: 'rgba(168,85,247,0.14)',
                          color: '#e9d5ff',
                          '& .MuiChip-label': { px: 0.85, fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.35 },
                        }}
                      />
                      <Chip
                        label={`${onionSkinFrames}-frame onion skin`}
                        size="small"
                        sx={{
                          height: 18,
                          borderRadius: 999,
                          bgcolor: 'rgba(59,130,246,0.14)',
                          color: '#bfdbfe',
                          '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.4 },
                        }}
                      />
                      <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.82)', fontWeight: 600, letterSpacing: 0.2 }}>
                        {animationAssistHeadline}
                      </Typography>
                    </Stack>
                    <Box component="span" sx={STUDIO_VISUALLY_HIDDEN_SX}>
                      Easy frame-by-frame animation with customizable onion skinning
                      Create storyboards, GIFs, animatics, and simple animations
                      Export your animations in the full resolution of your canvas
                      Flythrough bookmarks now drive animatic timing, transitions, and visible canvas staging
                      Storyboards GIFs Animatics Simple Anim
                    </Box>
                    <Stack
                      data-testid="frame-editor-animation-output-strip"
                      direction="row"
                      spacing={0.5}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {STUDIO_ANIMATION_OUTPUTS.map((output) => {
                        const compactLabel = output === 'Storyboards'
                          ? 'Boards'
                          : output === 'GIFs'
                            ? 'GIF'
                            : output === 'Animatics'
                              ? 'Animatic'
                              : 'Simple';
                        return (
                          <Chip
                            key={output}
                            label={compactLabel}
                            onClick={() => setSelectedAnimationOutput(output)}
                            size="small"
                            sx={{
                              height: 20,
                              borderRadius: 999,
                              bgcolor: selectedAnimationOutput === output ? 'rgba(246,178,77,0.16)' : 'rgba(255,255,255,0.05)',
                              color: selectedAnimationOutput === output ? '#fde68a' : 'rgba(248,250,252,0.78)',
                              border: `1px solid ${selectedAnimationOutput === output ? 'rgba(246,178,77,0.22)' : 'rgba(255,255,255,0.06)'}`,
                              '& .MuiChip-label': { px: 0.8, fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.3 },
                            }}
                          />
                        );
                      })}
                    </Stack>
                    <Stack
                      data-testid="frame-editor-animation-animatic-plan"
                      direction="row"
                      spacing={0.45}
                      flexWrap="wrap"
                      useFlexGap
                      sx={{
                        px: 0.6,
                        py: 0.45,
                        borderRadius: 1.4,
                        bgcolor: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(248,250,252,0.5)', fontSize: '0.58rem', fontWeight: 700, letterSpacing: 1 }}
                      >
                        ANIMATIC
                      </Typography>
                      {animaticSequence.length > 0 ? (
                        <>
                          <Chip
                            label={`${animaticSequence.length} cues`}
                            size="small"
                            sx={{
                              height: 18,
                              borderRadius: 999,
                              bgcolor: 'rgba(246,178,77,0.16)',
                              color: '#fde68a',
                              '& .MuiChip-label': { px: 0.68, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.28 },
                            }}
                          />
                          <Chip
                            label={formatClockDuration(activeFlythroughDurationMs)}
                            size="small"
                            sx={{
                              height: 18,
                              borderRadius: 999,
                              bgcolor: 'rgba(59,130,246,0.14)',
                              color: '#bfdbfe',
                              '& .MuiChip-label': { px: 0.68, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.28 },
                            }}
                          />
                          <Chip
                            label={`${animaticVisibleCanvasCount} canvases`}
                            size="small"
                            sx={{
                              height: 18,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.05)',
                              color: 'rgba(248,250,252,0.78)',
                              '& .MuiChip-label': { px: 0.68, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.28 },
                            }}
                          />
                          {animaticSequence.slice(0, 3).map((cue) => (
                            <Chip
                              key={cue.id}
                              label={`${String(cue.cueNumber).padStart(2, '0')} ${cue.name}`}
                              size="small"
                              sx={{
                                height: 18,
                                borderRadius: 999,
                                bgcolor: 'rgba(168,85,247,0.14)',
                                color: '#e9d5ff',
                                '& .MuiChip-label': { px: 0.68, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.28 },
                              }}
                            />
                          ))}
                        </>
                      ) : (
                        <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.62)' }}>
                          Save bookmarks in Spatial Workspace to build an animatic.
                        </Typography>
                      )}
                    </Stack>
                    <Stack
                      data-testid="frame-editor-animation-timing-strip"
                      direction="row"
                      spacing={0.45}
                      flexWrap="wrap"
                      useFlexGap
                      sx={{
                        px: 0.6,
                        py: 0.45,
                        borderRadius: 1.4,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      {animationTimingChips.map((item, index) => (
                        <Chip
                          key={item}
                          label={item}
                          size="small"
                          sx={{
                            height: 18,
                            borderRadius: 999,
                            bgcolor: index === 2 ? 'rgba(96,165,250,0.14)' : 'rgba(255,255,255,0.04)',
                            color: index === 2 ? '#bfdbfe' : 'rgba(248,250,252,0.74)',
                            '& .MuiChip-label': { px: 0.68, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.28 },
                          }}
                        />
                      ))}
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleExposureChange(Math.max(1, activeSheetExposure - 1))}
                        sx={{
                          minHeight: 18,
                          minWidth: 24,
                          px: 0.5,
                          borderRadius: 999,
                          color: 'rgba(248,250,252,0.74)',
                          borderColor: 'rgba(255,255,255,0.06)',
                        }}
                      >
                        -
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => handleExposureChange(activeSheetExposure + 1)}
                        sx={{
                          minHeight: 18,
                          minWidth: 24,
                          px: 0.5,
                          borderRadius: 999,
                          color: 'rgba(248,250,252,0.74)',
                          borderColor: 'rgba(255,255,255,0.06)',
                        }}
                      >
                        +
                      </Button>
                    </Stack>
                    <Stack
                      data-testid="frame-editor-animation-exposure-strip"
                      direction="row"
                      spacing={0.45}
                      alignItems="center"
                      sx={{
                        px: 0.6,
                        py: 0.45,
                        borderRadius: 1.4,
                        bgcolor: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(248,250,252,0.5)', fontSize: '0.58rem', fontWeight: 700, letterSpacing: 1 }}
                      >
                        X-SHEET
                      </Typography>
                      <Stack direction="row" spacing={0.45} alignItems="center" sx={{ flex: 1 }}>
                        {exposureStripFrames.map((frame, index) => {
                          const isPlaceholder = frame.sheetId.startsWith('placeholder-');
                          const isActive = frame.timelineIndex === activeTimelineFrameIndex && !isPlaceholder;
                          return (
                          <Box
                            key={`${frame.sheetId}-${frame.timelineIndex}`}
                            data-testid={`frame-editor-animation-exposure-frame-${index + 1}`}
                            onClick={() => {
                              if (!isPlaceholder) {
                                handleTimelineFrameSelect(frame.timelineIndex);
                              }
                            }}
                            sx={{
                              flex: 1,
                              height: isActive ? 14 : 10,
                              borderRadius: 1,
                              border: `1px solid ${isActive ? 'rgba(246,178,77,0.3)' : 'rgba(255,255,255,0.05)'}`,
                              bgcolor: isActive ? 'rgba(246,178,77,0.18)' : 'rgba(255,255,255,0.035)',
                              boxShadow: isActive ? '0 0 14px rgba(246,178,77,0.14)' : 'none',
                              position: 'relative',
                              overflow: 'hidden',
                              cursor: isPlaceholder ? 'default' : 'pointer',
                              '&::after': {
                                content: '""',
                                position: 'absolute',
                                inset: 0,
                                background: frame.exposureIndex % 2 === 0
                                  ? 'linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0.02))'
                                  : 'linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.12))',
                              },
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                position: 'absolute',
                                right: 2,
                                bottom: 0,
                                color: isActive ? '#fde68a' : 'rgba(248,250,252,0.56)',
                                fontSize: '0.42rem',
                                lineHeight: 1,
                                fontWeight: 700,
                                letterSpacing: 0.18,
                              }}
                            >
                              {String(frame.timelineIndex + 1).padStart(2, '0')}
                            </Typography>
                          </Box>
                          );
                        })}
                      </Stack>
                      <Chip
                        label={`F${String(activeTimelineFrameIndex + 1).padStart(2, '0')}`}
                        size="small"
                        sx={{
                          height: 18,
                          borderRadius: 999,
                          bgcolor: 'rgba(246,178,77,0.18)',
                          color: '#fde68a',
                          '& .MuiChip-label': { px: 0.68, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.28 },
                        }}
                      />
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.7} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Stack
                        data-testid="frame-editor-animation-onion-strip"
                        spacing={0.35}
                        sx={{
                          flex: 1,
                          px: 0.7,
                          py: 0.55,
                          borderRadius: 1.8,
                          bgcolor: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Typography
                            variant="caption"
                            sx={{ color: 'rgba(248,250,252,0.52)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1.1 }}
                          >
                            ONION
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 600 }}>
                            {drawingDocument.timeline.onionSkinEnabled ? `${onionSkinFrames} prev / ${onionSkinFrames} next` : 'Off'}
                          </Typography>
                        </Stack>
                        <Slider
                          size="small"
                          value={onionSkinFrames}
                          min={0}
                          max={4}
                          step={1}
                          onChange={(_, value) => {
                            if (Array.isArray(value)) return;
                            handleOnionSkinFramesChange(value);
                          }}
                          sx={{
                            color: '#a855f7',
                            '& .MuiSlider-thumb': {
                              width: 12,
                              height: 12,
                              boxShadow: '0 0 0 4px rgba(168,85,247,0.18)',
                            },
                          }}
                        />
                      </Stack>
                      <Stack direction="row" spacing={0.65} flexWrap="wrap" useFlexGap alignItems="center">
                        <Chip
                          icon={<HighQuality sx={{ fontSize: 14 }} />}
                          label={animationExportSummary}
                          size="small"
                          sx={{
                            height: 22,
                            borderRadius: 999,
                            bgcolor: 'rgba(255,255,255,0.05)',
                            color: '#f8fafc',
                            '& .MuiChip-label': { px: 0.85, fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.25 },
                          }}
                        />
                        <Button
                          data-testid="frame-editor-animation-export"
                          size="small"
                          variant="outlined"
                          disabled={!animationExportEnabled}
                          onClick={handleAnimationExport}
                          startIcon={<Save sx={{ fontSize: 15 }} />}
                          sx={{
                            minHeight: 26,
                            borderRadius: 999,
                            px: 1,
                            color: animationExportEnabled ? '#fde68a' : 'rgba(226,232,240,0.44)',
                            borderColor: animationExportEnabled ? 'rgba(246,178,77,0.24)' : 'rgba(255,255,255,0.08)',
                            bgcolor: animationExportEnabled ? 'rgba(246,178,77,0.12)' : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          {animationExportButtonLabel}
                        </Button>
                      </Stack>
                    </Stack>
                  </Stack>
                </Box>

                <Stack
                  data-testid="frame-editor-deck-tabs"
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                  useFlexGap
                  sx={{
                    overflowX: isTabletWorkspace ? 'auto' : 'visible',
                    overflowY: 'hidden',
                  }}
                >
                  <Stack
                    data-testid="frame-editor-deck-tab-strip"
                    direction="row"
                    spacing={0.2}
                    alignItems="center"
                    sx={{
                      px: 0.55,
                      py: isTabletWorkspace ? 0.5 : 0.35,
                      borderRadius: 999,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      flexShrink: 0,
                    }}
                  >
                    {STUDIO_DECK_TABS.map((tab) => (
                      <Button
                        key={tab}
                        size="small"
                        onClick={() => setSelectedDeckTab(tab)}
                        sx={{
                          minHeight: isTabletWorkspace ? 34 : 28,
                          color: selectedDeckTab === tab ? '#f8fafc' : 'rgba(226,232,240,0.58)',
                          bgcolor: selectedDeckTab === tab ? 'rgba(246,178,77,0.16)' : 'transparent',
                          borderBottom: `2px solid ${selectedDeckTab === tab ? '#f6b24d' : 'transparent'}`,
                          borderRadius: 0,
                          px: 1.1,
                        }}
                      >
                        {tab}
                      </Button>
                    ))}
                  </Stack>
                  <Box sx={{ flex: 1, minWidth: isTabletWorkspace ? 20 : undefined }} />
                  <Stack
                    data-testid="frame-editor-deck-status-strip"
                    direction="row"
                    spacing={0.7}
                    alignItems="center"
                    flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                    useFlexGap
                    sx={{
                      borderRadius: 999,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      px: 0.6,
                      py: isTabletWorkspace ? 0.5 : 0.35,
                      flexShrink: 0,
                    }}
                  >
                    <Chip
                      icon={<GridOn sx={{ fontSize: 14 }} />}
                      label={gridEnabled ? 'Perspective Grid' : 'Grid Off'}
                      size="small"
                      sx={{
                        height: 26,
                        borderRadius: 999,
                        bgcolor: gridEnabled ? 'rgba(246,178,77,0.16)' : 'rgba(255,255,255,0.05)',
                        color: gridEnabled ? '#fde68a' : 'rgba(226,232,240,0.68)',
                      }}
                    />
                    <Chip
                      icon={<FlashOn sx={{ fontSize: 14 }} />}
                      label="Light Aware Brush"
                      size="small"
                      sx={{ height: 26, borderRadius: 999, bgcolor: 'rgba(250,204,21,0.16)', color: '#fde68a' }}
                    />
                    <Chip
                      label={`Deck: ${selectedDeckTab}`}
                      size="small"
                      sx={{ height: 26, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(248,250,252,0.84)' }}
                    />
                    <Chip
                      label={`${activeSheet?.name || 'Sheet'} · ${activeSheetExposure}fr`}
                      size="small"
                      sx={{ height: 26, borderRadius: 999, bgcolor: 'rgba(59,130,246,0.12)', color: '#bfdbfe' }}
                    />
                    {activeSheet?.linkedSourceSheetId && (
                      <Chip
                        label="Linked"
                        size="small"
                        sx={{ height: 26, borderRadius: 999, bgcolor: 'rgba(168,85,247,0.14)', color: '#e9d5ff' }}
                      />
                    )}
                  </Stack>
                </Stack>

                <Stack
                  data-testid="frame-editor-filmstrip"
                  direction="row"
                  spacing={0.9}
                  alignItems="center"
                  sx={{
                    overflowX: isTabletWorkspace ? 'auto' : 'visible',
                    overflowY: 'hidden',
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={() => handleTimelineFrameSelect(Math.max(0, activeTimelineFrameIndex - 1))}
                    sx={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0, width: isTabletWorkspace ? 34 : undefined, height: isTabletWorkspace ? 34 : undefined }}
                  >
                    <ChevronLeft fontSize="small" />
                  </IconButton>
                  <Stack
                    data-testid="frame-editor-filmstrip-core"
                    direction="row"
                    spacing={0.9}
                    alignItems="center"
                    sx={{
                      flex: 1,
                      minWidth: isTabletWorkspace ? 540 : 0,
                      px: 0.55,
                      py: isTabletWorkspace ? 0.5 : 0.35,
                      borderRadius: 2,
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    }}
                  >
                    {filmstripWindow.map((frame, index) => {
                      const isActive = frame.timelineIndex === activeTimelineFrameIndex;
                      const previewUrl = timelinePreviewDataUrls[frame.timelineIndex];
                      return (
                      <Box
                        key={`${frame.sheetId}-${frame.timelineIndex}`}
                        data-testid={`frame-editor-filmstrip-frame-${index + 1}`}
                        onClick={() => handleTimelineFrameSelect(frame.timelineIndex)}
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          height: 50,
                          borderRadius: 1.6,
                          border: `1px solid ${isActive ? 'rgba(96,165,250,0.35)' : 'rgba(255,255,255,0.08)'}`,
                          background:
                            isActive
                              ? 'linear-gradient(135deg, rgba(59,130,246,0.22), rgba(15,23,42,0.96))'
                              : 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(15,23,42,0.96))',
                          boxShadow: isActive ? '0 12px 28px rgba(0,0,0,0.28)' : 'none',
                          overflow: 'hidden',
                          position: 'relative',
                          cursor: 'pointer',
                        }}
                      >
                        <Box
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: previewUrl
                              ? `linear-gradient(120deg, rgba(4,6,12,0.28), rgba(4,6,12,0.58)), url("${previewUrl}")`
                              : index % 2 === 0
                                ? 'linear-gradient(120deg, rgba(255,255,255,0.16), rgba(15,23,42,0.15), rgba(255,255,255,0.06))'
                                : 'linear-gradient(120deg, rgba(248,250,252,0.06), rgba(255,255,255,0.2), rgba(15,23,42,0.1))',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                        <Typography
                          variant="caption"
                          sx={{
                            position: 'absolute',
                            left: 8,
                            bottom: 6,
                            color: '#f8fafc',
                            fontSize: '0.65rem',
                            fontWeight: isActive ? 700 : 500,
                            letterSpacing: 0.8,
                          }}
                        >
                          {`Beat ${String(frame.timelineIndex + 1).padStart(2, '0')}`}
                        </Typography>
                        {isActive && (
                          <Chip
                            label={displayShotLabel.split(' ').pop() || '5B'}
                            size="small"
                            sx={{
                              position: 'absolute',
                              right: 6,
                              bottom: 6,
                              height: 18,
                              borderRadius: 999,
                              bgcolor: 'rgba(37,99,235,0.92)',
                              color: '#eff6ff',
                              '& .MuiChip-label': { px: 0.85, fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.35 },
                            }}
                          />
                        )}
                        <Box
                          sx={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: 3,
                            bgcolor: isActive ? '#f6b24d' : 'transparent',
                          }}
                        />
                      </Box>
                      );
                    })}
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={() => handleTimelineFrameSelect(Math.min(timelineFrames.length - 1, activeTimelineFrameIndex + 1))}
                    sx={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0, width: isTabletWorkspace ? 34 : undefined, height: isTabletWorkspace ? 34 : undefined }}
                  >
                    <ChevronRight fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Paper>

            <Paper
              data-testid="frame-editor-inspector"
              sx={{
                gridArea: 'inspector',
                p: 1.1,
                borderRadius: 3,
                background: 'linear-gradient(180deg, rgba(15,12,8,0.98), rgba(8,8,12,0.98))',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                position: 'relative',
                overflow: 'visible',
              }}
            >
              <Stack
                data-testid="frame-editor-inspector-side-rack"
                spacing={1}
                sx={{
                  display: isTabletWorkspace ? 'none' : 'flex',
                  position: 'absolute',
                  top: 30,
                  right: -18,
                  zIndex: 2,
                }}
              >
                {[
                  { icon: LightMode, label: 'Soft', accent: true },
                  { icon: CameraAlt, label: 'Safe' },
                  { icon: Brush, label: 'Euler' },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Tooltip key={item.label} title={item.label} placement="right">
                      <Stack
                        data-testid={`frame-editor-side-rack-item-${item.label.toLowerCase()}`}
                        direction="row"
                        spacing={0.4}
                        alignItems="center"
                      >
                        <Paper
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 1.75,
                            border: item.accent ? '1px solid rgba(246,178,77,0.3)' : '1px solid rgba(255,255,255,0.08)',
                            background: item.accent
                              ? 'linear-gradient(180deg, rgba(32,20,8,0.94), rgba(10,12,18,0.98))'
                              : 'rgba(10,12,18,0.98)',
                            color: item.accent ? '#fde68a' : 'rgba(248,250,252,0.78)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: item.accent ? '0 10px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(246,178,77,0.12)' : '0 10px 24px rgba(0,0,0,0.35)',
                          }}
                        >
                          <Icon sx={{ fontSize: 18 }} />
                        </Paper>
                        <Typography
                          variant="caption"
                          sx={{
                            width: 24,
                            color: item.accent ? '#fde68a' : 'rgba(248,250,252,0.52)',
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            letterSpacing: 0.75,
                            transform: 'rotate(-90deg)',
                            transformOrigin: 'left center',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.label.toUpperCase()}
                        </Typography>
                      </Stack>
                    </Tooltip>
                  );
                })}
              </Stack>

              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography
                  variant="caption"
                  sx={{ color: '#f8fafc', fontSize: '0.68rem', lineHeight: 1, letterSpacing: 2.1, fontWeight: 700 }}
                >
                  INSPECTOR
                </Typography>
                <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.56)' }}>
                  <Tune fontSize="small" />
                </IconButton>
              </Stack>

              <Stack data-testid="frame-editor-inspector-mode-tabs" direction="row" spacing={isTabletWorkspace ? 0.85 : 0.7} sx={{ mb: 1.2 }}>
                {[
                  { key: 'lighting', label: 'LIGHTING' },
                  { key: 'layers', label: 'LAYERS' },
                  { key: 'shot', label: 'SHOT' },
                ].map((option) => (
                    <Button
                      key={option.key}
                      size="small"
                      onClick={() => setInspectorMode(option.key as 'lighting' | 'layers' | 'shot')}
                      sx={{
                        flex: 1,
                        minHeight: isTabletWorkspace ? 40 : 32,
                        borderRadius: 999,
                        color: inspectorMode === option.key ? '#111827' : 'rgba(248,250,252,0.68)',
                        bgcolor: inspectorMode === option.key ? '#f6b24d' : 'rgba(255,255,255,0.04)',
                        fontSize: isTabletWorkspace ? '0.74rem' : '0.68rem',
                        fontWeight: 700,
                        letterSpacing: 1.1,
                      }}
                    >
                      {option.label}
                  </Button>
                ))}
              </Stack>

              <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.35 }}>
                {inspectorMode === 'lighting' && (
                  <Stack spacing={1.2}>
                    <Paper
                      data-testid="frame-editor-lighting-card"
                      sx={{
                        p: 1.1,
                        borderRadius: 2,
                        background: 'linear-gradient(180deg, rgba(28,19,10,0.72), rgba(255,255,255,0.04))',
                        border: '1px solid rgba(255,255,255,0.05)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ color: '#f8fafc', fontWeight: 700, letterSpacing: 0.15 }}>
                          Key Light
                        </Typography>
                        <Chip
                          label="SOFT"
                          size="small"
                          sx={{
                            height: 22,
                            borderRadius: 999,
                            bgcolor: 'rgba(245,158,11,0.14)',
                            color: '#fde68a',
                            '& .MuiChip-label': { px: 0.9, fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.5 },
                          }}
                        />
                      </Stack>
                      <Box
                        data-testid="frame-editor-lighting-wheel"
                        sx={{
                          width: '100%',
                          aspectRatio: '1 / 1',
                          borderRadius: '50%',
                          background:
                            'radial-gradient(circle at 36% 34%, rgba(255,223,128,0.92), rgba(245,158,11,0.26) 26%, rgba(15,23,42,0.15) 50%, rgba(15,23,42,0.9) 76%)',
                          border: '1px solid rgba(246,178,77,0.28)',
                          boxShadow: 'inset 0 0 80px rgba(245,158,11,0.16)',
                          mb: 1,
                          position: 'relative',
                          overflow: 'hidden',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            inset: 18,
                            borderRadius: '50%',
                            border: '1px dashed rgba(255,255,255,0.18)',
                          },
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            left: '50%',
                            top: 22,
                            width: 2,
                            height: '36%',
                            borderRadius: 999,
                            bgcolor: '#fde68a',
                            boxShadow: '0 0 12px rgba(253,230,138,0.3)',
                            transform: 'translateX(-50%) rotate(38deg)',
                            transformOrigin: '50% 100%',
                          },
                        }}
                      />
                      <Typography variant="body2" sx={{ color: 'rgba(248,250,252,0.8)' }}>
                        Time
                      </Typography>
                      <Typography variant="h6" sx={{ color: '#f8fafc', mb: 0.5 }}>
                        10:30 PM
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(248,250,252,0.8)' }}>
                        Intensity
                      </Typography>
                      <Slider
                        size="small"
                        value={78}
                        sx={{ color: '#f6b24d', mb: 0.7, '& .MuiSlider-thumb': { width: 14, height: 14 } }}
                      />
                      <Typography variant="body2" sx={{ color: '#f8fafc', mb: 0.4 }}>
                        3.200K
                      </Typography>
                      <Slider
                        size="small"
                        value={32}
                        sx={{ color: '#fcd34d', '& .MuiSlider-thumb': { width: 14, height: 14 } }}
                      />
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.35 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.48)' }}>
                          Warm
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.48)' }}>
                          Cool
                        </Typography>
                      </Stack>
                      <Stack
                        data-testid="frame-editor-lighting-toggles"
                        direction="row"
                        spacing={0.75}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{
                          mt: 1,
                          p: 0.6,
                          borderRadius: 1.6,
                          bgcolor: 'rgba(255,255,255,0.025)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <Chip label="Casts Shadows" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.16)', color: '#fde68a' }} />
                        <Chip label="Ambient Occlusion" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.16)', color: '#fde68a' }} />
                      </Stack>
                      <Stack
                        data-testid="frame-editor-lighting-materials"
                        direction="row"
                        spacing={0.75}
                        sx={{
                          mt: 1.15,
                          p: 0.6,
                          borderRadius: 1.6,
                          bgcolor: 'rgba(255,255,255,0.025)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        {['#f59e0b', '#d1d5db', '#4b5563'].map((value) => (
                          <Box
                            key={value}
                            sx={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.72), ${value})`,
                              border: '1px solid rgba(255,255,255,0.1)',
                              boxShadow: '0 8px 18px rgba(0,0,0,0.22)',
                            }}
                          />
                        ))}
                      </Stack>
                    </Paper>
                    <Paper
                      data-testid="frame-editor-shot-settings-card"
                      sx={{
                        p: 1.05,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(248,250,252,0.6)', fontSize: '0.68rem', lineHeight: 1, letterSpacing: 1.55, fontWeight: 700 }}
                      >
                        SHOT SETTINGS
                      </Typography>
                      <Stack spacing={0.55} sx={{ mt: 0.85 }}>
                        {studioLayerCards.map((layer) => (
                          <Stack key={layer.id} direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2" sx={{ color: layer.active ? '#f8fafc' : 'rgba(226,232,240,0.72)' }}>
                              {layer.label}
                            </Typography>
                            <Typography variant="caption" sx={{ color: layer.active ? '#fde68a' : 'rgba(248,250,252,0.48)' }}>
                              {layer.opacity}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Paper>
                  </Stack>
                )}

                {inspectorMode === 'layers' && (
                  <Stack spacing={0.95}>
                    <Stack data-testid="frame-editor-layers-stack" spacing={0.8}>
                      {visibleStudioLayerCards.map((layer) => {
                        const selected = selectedStudioLayer?.id === layer.id;
                        const selectedForGrouping = selectedLayerIds.includes(layer.id);
                        const collapsed = collapsedInspectorLayerIds.includes(layer.id);
                        const layerId = toTestIdFragment(layer.label);
                        const LayerIcon = getStudioLayerIcon(layer.type);
                        return (
                          <Paper
                            key={layer.id}
                            data-testid={`frame-editor-layer-card-${layerId}`}
                            onClick={() => handleSelectLayer(layer.id)}
                            sx={{
                              px: 1,
                              py: 0.95,
                              borderRadius: 1.8,
                              bgcolor: selected
                                ? 'rgba(37,99,235,0.22)'
                                : selectedForGrouping
                                  ? 'rgba(246,178,77,0.12)'
                                  : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${selected
                                ? 'rgba(96,165,250,0.28)'
                                : selectedForGrouping
                                  ? 'rgba(246,178,77,0.24)'
                                  : 'rgba(255,255,255,0.05)'}`,
                              boxShadow: selected || selectedForGrouping ? '0 12px 24px rgba(0,0,0,0.2)' : 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                              <Stack
                                direction="row"
                                spacing={0.55}
                                alignItems="center"
                                sx={{ minWidth: 0, pl: `${Math.min(layer.depth, 3) * 1.05}rem` }}
                              >
                                {layer.isContainer ? (
                                  <IconButton
                                    size="small"
                                    data-testid={`frame-editor-layer-expand-${layerId}`}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleToggleLayerCollapsed(layer.id);
                                    }}
                                    sx={{ p: 0.2, color: 'rgba(248,250,252,0.54)' }}
                                  >
                                    {collapsed ? <ChevronRight sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
                                  </IconButton>
                                ) : (
                                  <Box sx={{ width: 22, flexShrink: 0 }} />
                                )}
                                <IconButton
                                  size="small"
                                  data-testid={`frame-editor-layer-select-${layerId}`}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleToggleLayerSelection(layer.id);
                                  }}
                                  sx={{
                                    p: 0.2,
                                    color: selectedForGrouping ? '#fde68a' : 'rgba(248,250,252,0.38)',
                                  }}
                                >
                                  {selectedForGrouping ? <CheckCircle sx={{ fontSize: 16 }} /> : <FiberManualRecord sx={{ fontSize: 10 }} />}
                                </IconButton>
                                <Paper
                                  elevation={0}
                                  sx={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 1.2,
                                    bgcolor: alpha(layer.tint, selected ? 0.2 : 0.1),
                                    border: `1px solid ${alpha(layer.tint, selected ? 0.35 : 0.18)}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  <LayerIcon sx={{ color: layer.tint, fontSize: layer.type === 'group' ? 18 : 17 }} />
                                </Paper>
                                <Stack spacing={0.15} sx={{ minWidth: 0 }}>
                                  <Stack direction="row" spacing={0.6} alignItems="center">
                                    <IconButton
                                      size="small"
                                      data-testid={`frame-editor-layer-visibility-${layerId}`}
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        handleToggleLayerVisibility(layer.id);
                                      }}
                                      sx={{
                                        p: 0.2,
                                        color: layer.visible
                                          ? (selected ? '#f8fafc' : 'rgba(255,255,255,0.72)')
                                          : 'rgba(255,255,255,0.28)',
                                        }}
                                    >
                                      <Visibility sx={{ fontSize: 15 }} />
                                    </IconButton>
                                    <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                                      {layer.label}
                                    </Typography>
                                    {layer.type !== 'drawing' && (
                                      <Chip
                                        label={layer.type.toUpperCase()}
                                        size="small"
                                        sx={{
                                          height: 18,
                                          borderRadius: 999,
                                          bgcolor: 'rgba(255,255,255,0.06)',
                                          color: 'rgba(226,232,240,0.75)',
                                          '& .MuiChip-label': { px: 0.55, fontSize: '0.52rem', fontWeight: 700, letterSpacing: 0.35 },
                                        }}
                                      />
                                    )}
                                    {layer.childCount > 0 && (
                                      <Chip
                                        label={`${layer.childCount} child${layer.childCount === 1 ? '' : 'ren'}`}
                                        size="small"
                                        sx={{
                                          height: 18,
                                          borderRadius: 999,
                                          bgcolor: 'rgba(246,178,77,0.14)',
                                          color: '#fde68a',
                                          '& .MuiChip-label': { px: 0.55, fontSize: '0.52rem', fontWeight: 700, letterSpacing: 0.35 },
                                        }}
                                      />
                                    )}
                                  </Stack>
                                  <Typography
                                    variant="caption"
                                    sx={{
                                      color: selected ? '#93c5fd' : 'rgba(226,232,240,0.5)',
                                      letterSpacing: 0.35,
                                    }}
                                  >
                                    {layer.detail}
                                  </Typography>
                                </Stack>
                              </Stack>
                              <Stack direction="row" spacing={0.7} alignItems="center" sx={{ flexShrink: 0 }}>
                                {layer.containsActiveDescendant && !layer.active && (
                                  <Chip
                                    label="LIVE"
                                    size="small"
                                    sx={{
                                      height: 18,
                                      borderRadius: 999,
                                      bgcolor: 'rgba(59,130,246,0.18)',
                                      color: '#93c5fd',
                                      '& .MuiChip-label': { px: 0.6, fontSize: '0.52rem', fontWeight: 700, letterSpacing: 0.35 },
                                    }}
                                  />
                                )}
                                <Chip
                                  label={layer.opacity}
                                  size="small"
                                  sx={{
                                    height: 22,
                                    borderRadius: 999,
                                    bgcolor: selected ? 'rgba(246,178,77,0.16)' : 'rgba(255,255,255,0.05)',
                                    color: selected ? '#fde68a' : 'rgba(248,250,252,0.68)',
                                    '& .MuiChip-label': { px: 0.8, fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.35 },
                                  }}
                                />
                                <LockOutlined sx={{ color: layer.locked ? 'rgba(248,250,252,0.62)' : 'rgba(248,250,252,0.28)', fontSize: 15 }} />
                              </Stack>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                    <Paper
                      data-testid="frame-editor-layer-controls-card"
                      sx={{
                        p: 1.1,
                        borderRadius: 1.8,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Stack
                        data-testid="frame-editor-layer-actions-card"
                        direction="row"
                        spacing={0.7}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ mb: 1 }}
                      >
                        <Button
                          size="small"
                          data-testid="frame-editor-layer-action-add"
                          onClick={handleAddLayer}
                          startIcon={<Add fontSize="small" />}
                          sx={{ minHeight: 28, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                        >
                          Layer
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-layer-action-group"
                          onClick={handleGroupSelectedLayers}
                          disabled={!canGroupSelectedLayers}
                          startIcon={<ViewSidebar fontSize="small" />}
                          sx={{ minHeight: 28, borderRadius: 999, bgcolor: 'rgba(246,178,77,0.14)', color: '#fde68a' }}
                        >
                          Group
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-layer-action-ungroup"
                          onClick={handleUngroupSelectedLayer}
                          disabled={!canUngroupSelectedLayer}
                          startIcon={<Reply fontSize="small" />}
                          sx={{ minHeight: 28, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                        >
                          Ungroup
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-layer-action-duplicate"
                          onClick={() => selectedStudioLayer && handleDuplicateLayer(selectedStudioLayer.id)}
                          disabled={!canDuplicateSelectedLayer || !selectedStudioLayer}
                          startIcon={<ContentCopy fontSize="small" />}
                          sx={{ minHeight: 28, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                        >
                          Duplicate
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-layer-action-merge"
                          onClick={() => selectedStudioLayer && handleMergeLayer(selectedStudioLayer.id)}
                          disabled={!canMergeSelectedLayer || !selectedStudioLayer}
                          startIcon={<ArrowDownward fontSize="small" />}
                          sx={{ minHeight: 28, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                        >
                          Merge
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-layer-action-delete"
                          onClick={() => selectedStudioLayer && handleDeleteLayer(selectedStudioLayer.id)}
                          disabled={!canDeleteSelectedLayer || !selectedStudioLayer}
                          startIcon={<Delete fontSize="small" />}
                          sx={{ minHeight: 28, borderRadius: 999, bgcolor: 'rgba(120,18,18,0.32)', color: '#fecaca' }}
                        >
                          Delete
                        </Button>
                      </Stack>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.9 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.58)', fontSize: '0.68rem', letterSpacing: 1.35 }}>
                          Blend Mode
                        </Typography>
                        <Chip
                          label={
                            selectedStudioLayer?.label === 'Shadows'
                              ? 'Shadow stack'
                              : selectedStudioLayer?.strokeCount
                                ? `${selectedStudioLayer.strokeCount} strokes`
                                : selectedLayerCards.length > 1
                                  ? `${selectedLayerCards.length} selected`
                                : 'Layer stack'
                          }
                          size="small"
                          sx={{
                            height: 20,
                            borderRadius: 999,
                            bgcolor: 'rgba(246,178,77,0.16)',
                            color: '#fde68a',
                            '& .MuiChip-label': { px: 0.75, fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.35 },
                          }}
                        />
                      </Stack>
                      <Button
                        fullWidth
                        size="small"
                        sx={{ mt: 0.25, justifyContent: 'space-between', color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                      >
                        {selectedStudioLayer?.mode || 'Normal'}
                        <MoreHoriz fontSize="small" />
                      </Button>
                      <Typography
                        variant="caption"
                        sx={{ color: 'rgba(248,250,252,0.58)', fontSize: '0.68rem', letterSpacing: 1.35, display: 'block', mt: 1 }}
                      >
                        Layer Opacity
                      </Typography>
                      <Slider
                        data-testid="frame-editor-layer-opacity-slider"
                        size="small"
                        value={Math.round((selectedStudioLayer?.opacityValue || 0.74) * 100)}
                        onChangeCommitted={(_, value) => {
                          const nextValue = Array.isArray(value) ? value[0] || 0 : value;
                          if (selectedStudioLayer) {
                            handleChangeLayerOpacity(selectedStudioLayer.id, Math.max(0, Math.min(1, nextValue / 100)));
                          }
                        }}
                        sx={{ color: '#f6b24d', mt: 0.6 }}
                      />
                      <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.55 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.46)' }}>
                          Master mix
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#fde68a', fontWeight: 700 }}>
                          {Math.round((selectedStudioLayer?.opacityValue || 0.74) * 100)}%
                        </Typography>
                      </Stack>
                      {selectedBoardPolishEffectLayerId && selectedBoardPolishEffectRegion && (
                        <Paper
                          data-testid="frame-editor-layer-effect-region-card"
                          sx={{
                            mt: 1,
                            p: 0.9,
                            borderRadius: 1.5,
                            bgcolor: 'rgba(125,211,252,0.06)',
                            border: '1px solid rgba(125,211,252,0.14)',
                          }}
                        >
                          <Stack spacing={0.75}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                              <Typography variant="caption" sx={{ color: '#e0f2fe', fontWeight: 700, letterSpacing: 0.45 }}>
                                FX REGION
                              </Typography>
                              <Chip
                                size="small"
                                label={`${Math.round(selectedBoardPolishEffectRegion.widthRatio * 100)} × ${Math.round(selectedBoardPolishEffectRegion.heightRatio * 100)}`}
                                sx={{
                                  height: 18,
                                  borderRadius: 999,
                                  bgcolor: 'rgba(255,255,255,0.07)',
                                  color: '#e0f2fe',
                                  '& .MuiChip-label': { px: 0.6, fontSize: '0.52rem', fontWeight: 700, letterSpacing: 0.3 },
                                }}
                              />
                            </Stack>
                            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.6)' }}>
                              Drag masken direkte på canvas eller bruk raske presets for fokus, lower band og wide beams.
                            </Typography>
                            <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                              {BOARD_POLISH_EFFECT_REGION_PRESETS.map((preset) => (
                                <Button
                                  key={preset.id}
                                  size="small"
                                  data-testid={`frame-editor-layer-effect-region-preset-${preset.id}`}
                                  onClick={() => handleApplyBoardPolishEffectRegionPreset(selectedBoardPolishEffectLayerId, preset.id)}
                                  sx={{
                                    minHeight: 24,
                                    borderRadius: 999,
                                    px: 0.9,
                                    bgcolor: 'rgba(255,255,255,0.06)',
                                    color: '#e0f2fe',
                                    textTransform: 'none',
                                  }}
                                >
                                  {preset.label}
                                </Button>
                              ))}
                            </Stack>
                            <Stack spacing={0.35}>
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.66)', fontWeight: 600 }}>
                                  Feather
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#e0f2fe', fontWeight: 700 }}>
                                  {Math.round(selectedBoardPolishEffectRegion.feather * 100)}%
                                </Typography>
                              </Stack>
                              <Slider
                                data-testid="frame-editor-layer-effect-region-feather"
                                size="small"
                                min={0}
                                max={0.48}
                                step={0.01}
                                value={selectedBoardPolishEffectRegion.feather}
                                onChange={(_, value) => handleSetBoardPolishEffectRegionFeather(
                                  selectedBoardPolishEffectLayerId,
                                  Array.isArray(value) ? value[0] : value,
                                )}
                                sx={{ color: '#7dd3fc' }}
                              />
                            </Stack>
                            <Stack direction="row" justifyContent="space-between" spacing={0.8}>
                              <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.55)' }}>
                                X {Math.round(selectedBoardPolishEffectRegion.xRatio * 100)} · Y {Math.round(selectedBoardPolishEffectRegion.yRatio * 100)}
                              </Typography>
                              <Button
                                size="small"
                                data-testid="frame-editor-layer-effect-region-reset"
                                onClick={() => handleApplyBoardPolishEffectRegionPreset(selectedBoardPolishEffectLayerId, 'full')}
                                sx={{
                                  minHeight: 22,
                                  borderRadius: 999,
                                  px: 0.8,
                                  bgcolor: 'rgba(255,255,255,0.05)',
                                  color: '#e0f2fe',
                                  textTransform: 'none',
                                }}
                              >
                                Reset
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      )}
                    </Paper>
                    <Paper
                      data-testid="frame-editor-motion-rig-card"
                      sx={{
                        p: 1.1,
                        borderRadius: 1.8,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.9 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.58)', fontSize: '0.68rem', letterSpacing: 1.35 }}>
                          Motion Rig
                        </Typography>
                        <Chip
                          label={activeMotionRig ? `${activeMotionRig.keyframeCount} keys` : 'Unrigged'}
                          size="small"
                          sx={{
                            height: 20,
                            borderRadius: 999,
                            bgcolor: activeMotionRig ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.06)',
                            color: activeMotionRig ? '#93c5fd' : 'rgba(248,250,252,0.74)',
                            '& .MuiChip-label': { px: 0.75, fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.35 },
                          }}
                        />
                      </Stack>

                      {activeMotionRig ? (
                        <Stack spacing={0.9}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                              {activeMotionRig.layer.name}
                            </Typography>
                            <Chip
                              label={`Frame ${activeTimelineFrameIndex + 1}`}
                              size="small"
                              sx={{
                                height: 20,
                                borderRadius: 999,
                                bgcolor: 'rgba(246,178,77,0.16)',
                                color: '#fde68a',
                                '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.35 },
                              }}
                            />
                          </Stack>
                          <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.5)' }}>
                            Keyframed motion is resolved from the current scrub frame and applied as a real transformation container.
                          </Typography>

                          {[
                            {
                              label: 'Translate X',
                              value: activeMotionRig.currentTransform.translateX,
                              min: -180,
                              max: 180,
                              valueLabel: `${Math.round(activeMotionRig.currentTransform.translateX)} px`,
                              onCommit: (value: number) => handleMotionRigChange({ translateX: value }),
                            },
                            {
                              label: 'Translate Y',
                              value: activeMotionRig.currentTransform.translateY,
                              min: -180,
                              max: 180,
                              valueLabel: `${Math.round(activeMotionRig.currentTransform.translateY)} px`,
                              onCommit: (value: number) => handleMotionRigChange({ translateY: value }),
                            },
                            {
                              label: 'Scale',
                              value: (activeMotionRig.currentTransform.scaleX + activeMotionRig.currentTransform.scaleY) / 2,
                              min: 0.6,
                              max: 1.4,
                              step: 0.01,
                              valueLabel: `${(((activeMotionRig.currentTransform.scaleX + activeMotionRig.currentTransform.scaleY) / 2) * 100).toFixed(0)}%`,
                              onCommit: (value: number) => handleMotionRigChange({ scaleX: value, scaleY: value }),
                            },
                            {
                              label: 'Rotation',
                              value: activeMotionRig.currentTransform.rotation,
                              min: -30,
                              max: 30,
                              valueLabel: `${Math.round(activeMotionRig.currentTransform.rotation)}°`,
                              onCommit: (value: number) => handleMotionRigChange({ rotation: value }),
                            },
                            {
                              label: 'Perspective X',
                              value: activeMotionRig.currentTransform.perspectiveX,
                              min: -0.6,
                              max: 0.6,
                              step: 0.01,
                              valueLabel: `${(activeMotionRig.currentTransform.perspectiveX * 100).toFixed(0)}%`,
                              onCommit: (value: number) => handleMotionRigChange({ perspectiveX: value }),
                            },
                            {
                              label: 'Perspective Y',
                              value: activeMotionRig.currentTransform.perspectiveY,
                              min: -0.6,
                              max: 0.6,
                              step: 0.01,
                              valueLabel: `${(activeMotionRig.currentTransform.perspectiveY * 100).toFixed(0)}%`,
                              onCommit: (value: number) => handleMotionRigChange({ perspectiveY: value }),
                            },
                          ].map((control) => (
                            <Box key={control.label}>
                              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.2 }}>
                                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.52)' }}>
                                  {control.label}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                  {control.valueLabel}
                                </Typography>
                              </Stack>
                              <Slider
                                size="small"
                                min={control.min}
                                max={control.max}
                                step={control.step}
                                value={control.value}
                                onChangeCommitted={(_, value) => {
                                  const nextValue = Array.isArray(value) ? value[0] || 0 : value;
                                  control.onCommit(nextValue);
                                }}
                                sx={{ color: '#60a5fa' }}
                              />
                            </Box>
                          ))}
                          <Box>
                            <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.6)', display: 'block', mb: 0.6 }}>
                              Corner Warp
                            </Typography>
                            <ToggleButtonGroup
                              exclusive
                              size="small"
                              value={selectedMotionRigWarpCorner}
                              data-testid="frame-editor-motion-rig-corner-tabs"
                              onChange={(_, value: StoryboardDocumentCornerWarpCorner | null) => {
                                if (value) {
                                  setSelectedMotionRigWarpCorner(value);
                                }
                              }}
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                gap: 0.55,
                                mb: 0.85,
                                '& .MuiToggleButton-root': {
                                  minWidth: 0,
                                  py: 0.3,
                                  border: '1px solid rgba(148,163,184,0.18)',
                                  color: 'rgba(226,232,240,0.72)',
                                  fontSize: '0.58rem',
                                  letterSpacing: 0.7,
                                  textTransform: 'uppercase',
                                },
                                '& .Mui-selected': {
                                  color: '#f8fafc',
                                  backgroundColor: 'rgba(96,165,250,0.18)',
                                },
                              }}
                            >
                              {MOTION_RIG_WARP_CORNERS.map((corner) => (
                                <ToggleButton
                                  key={corner}
                                  value={corner}
                                  data-testid={`frame-editor-motion-rig-corner-${corner}`}
                                >
                                  {corner}
                                </ToggleButton>
                              ))}
                            </ToggleButtonGroup>

                            <Box data-testid="frame-editor-motion-rig-warp-x" sx={{ mb: 0.75 }}>
                              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.2 }}>
                                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.52)' }}>
                                  Warp X
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                  {Math.round(activeMotionRigCornerWarp[selectedMotionRigWarpCorner].x)} px
                                </Typography>
                              </Stack>
                              <Slider
                                size="small"
                                min={-96}
                                max={96}
                                step={1}
                                value={activeMotionRigCornerWarp[selectedMotionRigWarpCorner].x}
                                onChangeCommitted={(_, value) => {
                                  const nextValue = Array.isArray(value) ? value[0] || 0 : value;
                                  handleMotionRigCornerWarpChange(selectedMotionRigWarpCorner, 'x', nextValue);
                                }}
                                sx={{ color: '#60a5fa' }}
                              />
                            </Box>

                            <Box data-testid="frame-editor-motion-rig-warp-y">
                              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.2 }}>
                                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.52)' }}>
                                  Warp Y
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                  {Math.round(activeMotionRigCornerWarp[selectedMotionRigWarpCorner].y)} px
                                </Typography>
                              </Stack>
                              <Slider
                                size="small"
                                min={-96}
                                max={96}
                                step={1}
                                value={activeMotionRigCornerWarp[selectedMotionRigWarpCorner].y}
                                onChangeCommitted={(_, value) => {
                                  const nextValue = Array.isArray(value) ? value[0] || 0 : value;
                                  handleMotionRigCornerWarpChange(selectedMotionRigWarpCorner, 'y', nextValue);
                                }}
                                sx={{ color: '#60a5fa' }}
                              />
                            </Box>
                          </Box>
                        </Stack>
                      ) : (
                        <Stack spacing={0.8}>
                          <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.5)' }}>
                            Wrap the active layer in a transform rig so it can be translated, scaled, and rotated over time.
                          </Typography>
                          <Button
                            size="small"
                            onClick={handleAddMotionRig}
                            disabled={!canAddMotionRigToSelectedLayer}
                            sx={{
                              justifyContent: 'space-between',
                              color: '#f8fafc',
                              bgcolor: 'rgba(37,99,235,0.16)',
                              border: '1px solid rgba(96,165,250,0.2)',
                            }}
                          >
                            Add Motion Rig
                            <Tune fontSize="small" />
                          </Button>
                        </Stack>
                      )}
                    </Paper>
                  </Stack>
                )}

                {inspectorMode === 'shot' && (
                  <Stack spacing={0.95}>
                    <Paper
                      data-testid="frame-editor-shot-summary-card"
                      sx={{
                        p: 1.1,
                        borderRadius: 1.9,
                        background: 'linear-gradient(180deg, rgba(15,18,28,0.9), rgba(255,255,255,0.03))',
                        border: '1px solid rgba(255,255,255,0.05)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                      }}
                    >
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                        {['Safe Crop', 'Push In', 'Hero Read'].map((label, index) => (
                          <Chip
                            key={label}
                            label={label}
                            size="small"
                            sx={{
                              height: 22,
                              borderRadius: 999,
                              bgcolor: index === 1 ? 'rgba(246,178,77,0.16)' : 'rgba(255,255,255,0.05)',
                              color: index === 1 ? '#fde68a' : 'rgba(248,250,252,0.78)',
                              '& .MuiChip-label': { px: 0.85, fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.35 },
                            }}
                          />
                        ))}
                      </Stack>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 0.8 }}>
                        {STUDIO_SHOT_META.map(([label, value]) => (
                          <Stack key={label} spacing={0.1}>
                            <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.46)', fontSize: '0.62rem', letterSpacing: 1 }}>
                              {label}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                              {value}
                            </Typography>
                          </Stack>
                        ))}
                      </Box>
                    </Paper>
                    <Paper
                      data-testid="frame-editor-spatial-workspace-card"
                      sx={{
                        p: 1.05,
                        borderRadius: 1.9,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.9 }}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'rgba(248,250,252,0.6)', fontSize: '0.68rem', lineHeight: 1, letterSpacing: 1.55, fontWeight: 700 }}
                        >
                          SPATIAL WORKSPACE
                        </Typography>
                        <Chip
                          label={`${spatialCanvases.length} canvases · ${drawingDocument.bookmarks.length} bookmarks`}
                          size="small"
                          sx={{
                            height: 20,
                            borderRadius: 999,
                            bgcolor: 'rgba(37,99,235,0.18)',
                            color: '#bfdbfe',
                            '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.35 },
                          }}
                        />
                      </Stack>

                      <Stack
                        direction="row"
                        spacing={0.7}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ mb: 1 }}
                      >
                        <Button
                          size="small"
                          data-testid="frame-editor-spatial-add-canvas"
                          onClick={handleAddSpatialCanvas}
                          startIcon={<Add fontSize="small" />}
                          sx={{ minHeight: 28, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                        >
                          New Canvas
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-spatial-save-bookmark"
                          onClick={handleAddSpatialBookmark}
                          startIcon={<Flag fontSize="small" />}
                          sx={{ minHeight: 28, borderRadius: 999, bgcolor: 'rgba(246,178,77,0.14)', color: '#fde68a' }}
                        >
                          Save Bookmark
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-spatial-duplicate-bookmark"
                          onClick={() => handleDuplicateSpatialBookmark(selectedSpatialBookmark)}
                          disabled={!selectedSpatialBookmark}
                          startIcon={<ContentCopy fontSize="small" />}
                          sx={{ minHeight: 28, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                        >
                          Duplicate View
                        </Button>
                      </Stack>

                      <Paper
                        data-testid="frame-editor-spatial-map-card"
                        sx={{
                          p: 0.9,
                          mb: 1,
                          borderRadius: 1.6,
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.65 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.54)', letterSpacing: 1.1 }}>
                            SPATIAL MAP
                          </Typography>
                          <Chip
                            label={activeSpatialCanvas?.name || 'No canvas'}
                            size="small"
                            sx={{
                              height: 18,
                              borderRadius: 999,
                              bgcolor: 'rgba(96,165,250,0.18)',
                              color: '#bfdbfe',
                              '& .MuiChip-label': { px: 0.55, fontSize: '0.52rem', fontWeight: 700, letterSpacing: 0.35 },
                            }}
                          />
                        </Stack>

                        <Box
                          data-testid="frame-editor-spatial-map-viewport"
                          ref={spatialMapViewportRef}
                          sx={{
                            position: 'relative',
                            height: 158,
                            mb: 0.75,
                            borderRadius: 1.6,
                            overflow: 'hidden',
                            background:
                              'radial-gradient(circle at top, rgba(96,165,250,0.16), transparent 28%), linear-gradient(180deg, rgba(10,14,24,0.94), rgba(3,5,10,0.98))',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              background:
                                'repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 28px), repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 24px)',
                              opacity: 0.6,
                            }}
                          />
                          {spatialMapNodes.map((node) => {
                            const canvasId = toTestIdFragment(node.canvas.name);
                            const isActiveCanvas = activeSpatialCanvas?.id === node.canvas.id;
                            const isDraggingCanvas = spatialMapDraggingCanvasId === node.canvas.id;
                            return (
                              <Button
                                key={node.canvas.id}
                                data-testid={`frame-editor-spatial-map-canvas-${canvasId}`}
                                size="small"
                                onClick={() => handleSelectSpatialCanvas(node.canvas.id)}
                                onPointerDown={(event) => handleStartSpatialCanvasDrag(event, node.canvas.id)}
                                sx={{
                                  position: 'absolute',
                                  left: `${node.left}%`,
                                  top: `${node.top}%`,
                                  minWidth: isTabletWorkspace ? 40 : 0,
                                  minHeight: isTabletWorkspace ? 30 : 0,
                                  width: `${node.width}%`,
                                  height: `${node.height}%`,
                                  px: 0.35,
                                  py: 0.2,
                                  borderRadius: 1.2,
                                  transform: 'translate(-50%, -50%)',
                                  justifyContent: 'center',
                                  bgcolor: isActiveCanvas ? 'rgba(96,165,250,0.22)' : 'rgba(255,255,255,0.08)',
                                  color: isActiveCanvas ? '#dbeafe' : 'rgba(248,250,252,0.76)',
                                  border: `1px solid ${isActiveCanvas ? 'rgba(147,197,253,0.34)' : 'rgba(255,255,255,0.08)'}`,
                                  boxShadow: isActiveCanvas ? '0 0 22px rgba(96,165,250,0.18)' : 'none',
                                  fontSize: isTabletWorkspace ? '0.58rem' : '0.5rem',
                                  lineHeight: 1,
                                  cursor: isDraggingCanvas ? 'grabbing' : 'grab',
                                  touchAction: 'none',
                                }}
                              >
                                {node.canvas.name.replace('Canvas ', 'C')}
                              </Button>
                            );
                          })}
                        </Box>

                        <Stack spacing={0.7} sx={{ mb: 0.8 }}>
                        <Stack
                          data-testid="frame-editor-spatial-map-transform-strip"
                          direction="row"
                          spacing={0.45}
                          flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                          useFlexGap={!isTabletWorkspace}
                          sx={{
                            overflowX: isTabletWorkspace ? 'auto' : 'visible',
                            flexWrap: isTabletWorkspace ? 'nowrap' : 'wrap',
                            whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                            pb: isTabletWorkspace ? 0.2 : 0,
                          }}
                        >
                            {[
                              {
                                id: 'frame-editor-spatial-map-nudge-left',
                                label: '<',
                                onClick: () => handleNudgeActiveSpatialCanvas(-SPATIAL_MAP_NUDGE_X, 0),
                              },
                              {
                                id: 'frame-editor-spatial-map-nudge-up',
                                label: '^',
                                onClick: () => handleNudgeActiveSpatialCanvas(0, -SPATIAL_MAP_NUDGE_Y),
                              },
                              {
                                id: 'frame-editor-spatial-map-nudge-right',
                                label: '>',
                                onClick: () => handleNudgeActiveSpatialCanvas(SPATIAL_MAP_NUDGE_X, 0),
                              },
                              {
                                id: 'frame-editor-spatial-map-nudge-down',
                                label: 'v',
                                onClick: () => handleNudgeActiveSpatialCanvas(0, SPATIAL_MAP_NUDGE_Y),
                              },
                              {
                                id: 'frame-editor-spatial-map-depth-down',
                                label: 'Z-',
                                onClick: () => handleAdjustActiveSpatialCanvasDepth(-SPATIAL_MAP_DEPTH_STEP),
                              },
                              {
                                id: 'frame-editor-spatial-map-depth-up',
                                label: 'Z+',
                                onClick: () => handleAdjustActiveSpatialCanvasDepth(SPATIAL_MAP_DEPTH_STEP),
                              },
                              {
                                id: 'frame-editor-spatial-map-scale-down',
                                label: 'S−',
                                onClick: () => handleAdjustActiveSpatialCanvasScale(-SPATIAL_MAP_SCALE_STEP),
                              },
                              {
                                id: 'frame-editor-spatial-map-scale-up',
                                label: 'S+',
                                onClick: () => handleAdjustActiveSpatialCanvasScale(SPATIAL_MAP_SCALE_STEP),
                              },
                            ].map((control) => (
                              <Button
                                key={control.id}
                                size="small"
                                data-testid={control.id}
                                onClick={control.onClick}
                                disabled={!activeSpatialCanvas}
                                sx={{
                                  minWidth: 0,
                                  px: isTabletWorkspace ? 1.05 : 0.7,
                                  minHeight: isTabletWorkspace ? 36 : 24,
                                  borderRadius: 999,
                                  bgcolor: 'rgba(255,255,255,0.05)',
                                  color: '#f8fafc',
                                  border: '1px solid rgba(255,255,255,0.06)',
                                  fontSize: isTabletWorkspace ? '0.7rem' : '0.6rem',
                                  lineHeight: 1,
                                }}
                              >
                                {control.label}
                              </Button>
                            ))}
                          </Stack>

                          <Typography
                            data-testid="frame-editor-spatial-map-transform-readout"
                            variant="caption"
                            sx={{ color: 'rgba(226,232,240,0.58)' }}
                          >
                            {activeSpatialCanvas
                              ? `${activeSpatialCanvas.name} · ${formatCanvasTransformReadout(activeSpatialCanvas)}`
                              : 'Select a canvas to nudge position, depth, and scale from the map.'}
                          </Typography>
                        </Stack>

                        <Stack
                          data-testid="frame-editor-spatial-map-bookmark-strip"
                          direction="row"
                          spacing={0.55}
                          flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                          useFlexGap={!isTabletWorkspace}
                          sx={{
                            overflowX: isTabletWorkspace ? 'auto' : 'visible',
                            flexWrap: isTabletWorkspace ? 'nowrap' : 'wrap',
                            whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                            pb: isTabletWorkspace ? 0.2 : 0,
                          }}
                        >
                          {drawingDocument.bookmarks.map((bookmark) => {
                            const bookmarkId = toTestIdFragment(bookmark.name);
                            const isSelected = selectedSpatialBookmark?.id === bookmark.id;
                            const ownerCanvasName = spatialCanvases.find((canvas) => canvas.id === getStoryboardDocumentBookmarkCanvasId(drawingDocument, bookmark.id))?.name;
                            return (
                              <Chip
                                key={bookmark.id}
                                data-testid={`frame-editor-spatial-map-bookmark-${bookmarkId}`}
                                clickable
                                onClick={() => handleJumpToSpatialBookmarkView(bookmark.id)}
                                label={`${bookmark.name}${ownerCanvasName ? ` · ${ownerCanvasName}` : ''}`}
                                sx={{
                                  height: isTabletWorkspace ? 30 : undefined,
                                  bgcolor: isSelected ? 'rgba(246,178,77,0.16)' : 'rgba(255,255,255,0.05)',
                                  color: isSelected ? '#fde68a' : 'rgba(248,250,252,0.76)',
                                  border: `1px solid ${isSelected ? 'rgba(246,178,77,0.26)' : 'rgba(255,255,255,0.06)'}`,
                                  '& .MuiChip-label': {
                                    px: isTabletWorkspace ? 0.8 : 0.6,
                                    fontSize: isTabletWorkspace ? '0.62rem' : '0.56rem',
                                    fontWeight: 700,
                                  },
                                }}
                              />
                            );
                          })}
                        </Stack>

                        <Typography
                          data-testid="frame-editor-spatial-map-summary"
                          variant="caption"
                          sx={{ display: 'block', mt: 0.7, color: 'rgba(226,232,240,0.58)' }}
                        >
                          {selectedSpatialBookmark
                            ? `${selectedSpatialBookmark.name} · ${selectedSpatialBookmarkCanvasId ? spatialCanvases.find((canvas) => canvas.id === selectedSpatialBookmarkCanvasId)?.name || activeSpatialCanvas?.name || 'Canvas' : activeSpatialCanvas?.name || 'Canvas'} · ${formatCanvasTransformSummary(activeSpatialCanvas || spatialCanvases[0])}`
                            : `${activeSpatialCanvas?.name || 'Canvas'} · ${formatCanvasTransformSummary(activeSpatialCanvas || spatialCanvases[0])} · Focus a bookmark to jump to a saved view.`}
                        </Typography>
                      </Paper>

                      <Stack data-testid="frame-editor-spatial-canvas-list" spacing={0.7} sx={{ mb: 1 }}>
                        {spatialCanvases.map((canvas) => {
                          const canvasId = toTestIdFragment(canvas.name);
                          const isActiveCanvas = activeSpatialCanvas?.id === canvas.id;
                          return (
                            <Paper
                              key={canvas.id}
                              data-testid={`frame-editor-spatial-canvas-${canvasId}`}
                              sx={{
                                p: 0.85,
                                borderRadius: 1.5,
                                bgcolor: isActiveCanvas ? 'rgba(37,99,235,0.18)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isActiveCanvas ? 'rgba(96,165,250,0.26)' : 'rgba(255,255,255,0.05)'}`,
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" spacing={0.8}>
                                <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                                  <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                                      {canvas.name}
                                    </Typography>
                                    {isActiveCanvas && (
                                      <Chip
                                        label="Active"
                                        size="small"
                                        sx={{
                                          height: tabletTouchChipHeight,
                                          borderRadius: 999,
                                          bgcolor: 'rgba(96,165,250,0.18)',
                                          color: '#bfdbfe',
                                          '& .MuiChip-label': {
                                            px: isTabletWorkspace ? 0.75 : 0.55,
                                            fontSize: isTabletWorkspace ? '0.62rem' : '0.52rem',
                                            fontWeight: 700,
                                            letterSpacing: 0.35,
                                          },
                                        }}
                                      />
                                    )}
                                  </Stack>
                                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                                    {formatCanvasTransformSummary(canvas)}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                                    {canvas.sheetIds.length} sheets · {canvas.bookmarkIds.length} bookmarks
                                  </Typography>
                                </Stack>
                                <Stack spacing={0.5} sx={{ flexShrink: 0 }}>
                                  <Button
                                    size="small"
                                    onClick={() => handleSelectSpatialCanvas(canvas.id)}
                                    sx={{ minHeight: tabletTouchButtonHeight, borderRadius: 999, color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                                  >
                                    Focus
                                  </Button>
                                  <Button
                                    size="small"
                                    onClick={() => handleAttachActiveSheetToCanvas(canvas.id)}
                                    sx={{ minHeight: tabletTouchButtonHeight, borderRadius: 999, color: '#fde68a', bgcolor: 'rgba(246,178,77,0.12)' }}
                                  >
                                    Place Sheet
                                  </Button>
                                </Stack>
                              </Stack>
                            </Paper>
                          );
                        })}
                      </Stack>

                      <Stack data-testid="frame-editor-spatial-bookmark-list" spacing={0.7} sx={{ mb: 1 }}>
                        {activeSpatialBookmarks.map((bookmark) => {
                          const bookmarkId = toTestIdFragment(bookmark.name);
                          const isSelectedBookmark = selectedSpatialBookmark?.id === bookmark.id;
                          return (
                            <Paper
                              key={bookmark.id}
                              data-testid={`frame-editor-spatial-bookmark-${bookmarkId}`}
                              onClick={() => handleSelectSpatialBookmark(bookmark.id)}
                              sx={{
                                p: isTabletWorkspace ? 1 : 0.8,
                                borderRadius: 1.5,
                                cursor: 'pointer',
                                bgcolor: isSelectedBookmark ? 'rgba(246,178,77,0.12)' : 'rgba(255,255,255,0.025)',
                                border: `1px solid ${isSelectedBookmark ? 'rgba(246,178,77,0.24)' : 'rgba(255,255,255,0.05)'}`,
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" spacing={0.8}>
                                <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                                    {bookmark.name}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                                    {formatClockDuration(bookmark.timingMs)} · {bookmark.transition.toUpperCase()}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                                    Zoom {bookmark.camera.zoom.toFixed(2)} · {bookmark.visibleCanvasIds.length} visible
                                  </Typography>
                                </Stack>
                                <Chip
                                  label={isSelectedBookmark ? 'Cue' : 'View'}
                                  size="small"
                                  sx={{
                                    height: tabletTouchChipHeight,
                                    borderRadius: 999,
                                    bgcolor: isSelectedBookmark ? 'rgba(246,178,77,0.16)' : 'rgba(255,255,255,0.06)',
                                    color: isSelectedBookmark ? '#fde68a' : 'rgba(248,250,252,0.72)',
                                    '& .MuiChip-label': { px: isTabletWorkspace ? 0.8 : 0.55, fontSize: isTabletWorkspace ? '0.62rem' : '0.52rem', fontWeight: 700, letterSpacing: 0.35 },
                                  }}
                                />
                              </Stack>
                            </Paper>
                          );
                        })}
                      </Stack>

                      <Paper
                        data-testid="frame-editor-flythrough-card"
                        sx={{
                          p: 0.9,
                          mb: 1,
                          borderRadius: 1.6,
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.7 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.54)', letterSpacing: 1.1 }}>
                            FLYTHROUGH
                          </Typography>
                          <Chip
                            data-testid="frame-editor-flythrough-state"
                            label={
                              flythroughPlaying
                                ? 'Playing'
                                : flythroughLoopEnabled
                                  ? 'Loop Ready'
                                  : 'Ready'
                            }
                            size="small"
                            sx={{
                              height: tabletTouchChipHeight,
                              borderRadius: 999,
                              bgcolor: flythroughPlaying ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.06)',
                              color: flythroughPlaying ? '#bfdbfe' : 'rgba(248,250,252,0.78)',
                              '& .MuiChip-label': { px: isTabletWorkspace ? 0.85 : 0.55, fontSize: isTabletWorkspace ? '0.62rem' : '0.52rem', fontWeight: 700, letterSpacing: 0.35 },
                            }}
                          />
                        </Stack>

                        <Stack
                          data-testid="frame-editor-flythrough-meta-strip"
                          direction="row"
                          spacing={0.7}
                          flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                          useFlexGap={!isTabletWorkspace}
                          sx={{
                            mb: 0.8,
                            overflowX: isTabletWorkspace ? 'auto' : 'visible',
                            flexWrap: isTabletWorkspace ? 'nowrap' : 'wrap',
                            whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                            pb: isTabletWorkspace ? 0.2 : 0,
                          }}
                        >
                          <Chip
                            data-testid="frame-editor-flythrough-duration"
                            label={formatClockDuration(activeFlythroughDurationMs)}
                            size="small"
                            sx={{ height: isTabletWorkspace ? 30 : undefined, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                          />
                          <Chip
                            label={`${flythroughSequence.length} views`}
                            size="small"
                            sx={{ height: isTabletWorkspace ? 30 : undefined, bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(248,250,252,0.78)' }}
                          />
                          <Chip
                            data-testid="frame-editor-flythrough-visible-canvases"
                            label={
                              selectedSpatialVisibleCanvasNames.length > 0
                                ? selectedSpatialVisibleCanvasNames.join(' · ')
                                : 'No canvases'
                            }
                            size="small"
                            sx={{ height: isTabletWorkspace ? 30 : undefined, bgcolor: 'rgba(246,178,77,0.12)', color: '#fde68a' }}
                          />
                        </Stack>

                        <Stack
                          data-testid="frame-editor-flythrough-controls"
                          direction="row"
                          spacing={0.6}
                          sx={{
                            mb: 0.75,
                            overflowX: isTabletWorkspace ? 'auto' : 'visible',
                            flexWrap: isTabletWorkspace ? 'nowrap' : 'wrap',
                            whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                            pb: isTabletWorkspace ? 0.2 : 0,
                          }}
                        >
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-prev"
                            disabled={flythroughSequence.length === 0}
                            onClick={() => handleFlythroughStep(-1)}
                            startIcon={<SkipPrevious fontSize="small" />}
                            sx={{ minHeight: tabletTouchButtonHeight, borderRadius: 999, color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                          >
                            Prev
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-play"
                            disabled={flythroughSequence.length === 0}
                            onClick={handleFlythroughTogglePlay}
                            startIcon={flythroughPlaying ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
                            sx={{
                              minHeight: tabletTouchButtonHeight,
                              borderRadius: 999,
                              color: '#0f172a',
                              bgcolor: '#f8fafc',
                              '&:hover': { bgcolor: '#ffffff' },
                            }}
                          >
                            {flythroughPlaying ? 'Pause' : 'Play'}
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-next"
                            disabled={flythroughSequence.length === 0}
                            onClick={() => handleFlythroughStep(1)}
                            endIcon={<SkipNext fontSize="small" />}
                            sx={{ minHeight: tabletTouchButtonHeight, borderRadius: 999, color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                          >
                            Next
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-loop"
                            onClick={handleFlythroughLoopToggle}
                            sx={{
                              minHeight: tabletTouchButtonHeight,
                              borderRadius: 999,
                              color: flythroughLoopEnabled ? '#fde68a' : 'rgba(248,250,252,0.72)',
                              bgcolor: flythroughLoopEnabled ? 'rgba(246,178,77,0.12)' : 'rgba(255,255,255,0.05)',
                            }}
                          >
                            {flythroughLoopEnabled ? 'Loop On' : 'Loop Off'}
                          </Button>
                        </Stack>

                        <Box
                          data-testid="frame-editor-flythrough-progress"
                          ref={flythroughProgressRef}
                          onPointerDown={handleFlythroughSeekStart}
                          onClick={handleFlythroughSeek}
                          sx={{
                            position: 'relative',
                            cursor: flythroughSequence.length > 0 ? (flythroughSeeking ? 'grabbing' : 'pointer') : 'default',
                            mb: 0.85,
                            touchAction: 'none',
                          }}
                        >
                          <LinearProgress
                            variant="determinate"
                            value={flythroughProgressPercent}
                            sx={{
                              height: isTabletWorkspace ? 10 : 6,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.06)',
                              '& .MuiLinearProgress-bar': {
                                borderRadius: 999,
                                background: 'linear-gradient(90deg, #60a5fa, #f6b24d)',
                              },
                            }}
                          />
                          {flythroughSequence.map((entry) => {
                            const leftPercent = activeFlythroughDurationMs > 0
                              ? Math.min(100, Math.max(0, (entry.startMs / activeFlythroughDurationMs) * 100))
                              : 0;
                            const isSelectedCue = selectedSpatialBookmark?.id === entry.bookmark.id;
                            return (
                              <Box
                                key={entry.bookmark.id}
                                data-testid={`frame-editor-flythrough-marker-${toTestIdFragment(entry.bookmark.name)}`}
                                sx={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: `${leftPercent}%`,
                                  width: isSelectedCue ? 8 : 6,
                                  height: isSelectedCue ? 8 : 6,
                                  borderRadius: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  bgcolor: isSelectedCue ? '#fde68a' : 'rgba(248,250,252,0.7)',
                                  border: `1px solid ${isSelectedCue ? 'rgba(246,178,77,0.55)' : 'rgba(15,23,42,0.55)'}`,
                                  boxShadow: isSelectedCue ? '0 0 12px rgba(246,178,77,0.26)' : 'none',
                                  pointerEvents: 'none',
                                }}
                              />
                            );
                          })}
                        </Box>

                        <Paper
                          data-testid="frame-editor-flythrough-current"
                          sx={{
                            p: 0.8,
                            mb: 0.8,
                            borderRadius: 1.5,
                            bgcolor: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <Stack direction="row" justifyContent="space-between" spacing={0.8}>
                            <Stack spacing={0.2} sx={{ minWidth: 0 }}>
                              <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                                {selectedSpatialBookmark?.name || 'No bookmark selected'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                                {selectedFlythroughEntry
                                  ? `View ${selectedFlythroughEntry.index + 1} · ${formatClockDuration(selectedSpatialBookmark?.timingMs || 0)} · ${selectedSpatialBookmark?.transition.toUpperCase()}`
                                  : 'Select a bookmark to tune the flythrough'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                                {activeFlythroughEntry
                                  ? `${formatClockDuration(flythroughElapsedMs)} / ${formatClockDuration(activeFlythroughDurationMs)} · cue ${activeFlythroughEntry.index + 1}`
                                  : 'No active cue'}
                              </Typography>
                            </Stack>
                            <Chip
                              data-testid="frame-editor-flythrough-camera-sync"
                              label={selectedSpatialBookmark
                                ? `${selectedBookmarkCameraSynced ? 'Camera Synced' : 'Camera Live'} · ${selectedSpatialBookmark.visibleCanvasIds.length} visible`
                                : 'Idle'}
                              size="small"
                              sx={{
                                height: tabletTouchChipHeight,
                                borderRadius: 999,
                                bgcolor: selectedBookmarkCameraSynced ? 'rgba(96,165,250,0.16)' : 'rgba(246,178,77,0.14)',
                                color: selectedBookmarkCameraSynced ? '#bfdbfe' : '#fde68a',
                                '& .MuiChip-label': {
                                  px: isTabletWorkspace ? 0.8 : 0.55,
                                  fontSize: isTabletWorkspace ? '0.62rem' : '0.52rem',
                                  fontWeight: 700,
                                  letterSpacing: 0.35,
                                },
                              }}
                            />
                          </Stack>
                          <Typography
                            data-testid="frame-editor-flythrough-saved-camera"
                            variant="caption"
                            sx={{ display: 'block', mt: 0.55, color: 'rgba(226,232,240,0.56)' }}
                          >
                            {selectedSpatialBookmark
                              ? `Saved ${formatBookmarkCameraSummary(selectedSpatialBookmark)}`
                              : 'Saved view unavailable'}
                          </Typography>
                          <Typography
                            data-testid="frame-editor-flythrough-live-camera"
                            variant="caption"
                            sx={{ display: 'block', mt: 0.2, color: 'rgba(226,232,240,0.56)' }}
                          >
                            {activeSpatialCanvas
                              ? `Live ${formatCanvasTransformSummary(activeSpatialCanvas)} · zoom ${activeSpatialCanvas.transform.scale.toFixed(2)}`
                              : 'Live camera unavailable'}
                          </Typography>
                        </Paper>

                        <Stack
                          data-testid="frame-editor-flythrough-actions"
                          direction="row"
                          spacing={0.6}
                          flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                          useFlexGap={!isTabletWorkspace}
                          sx={{
                            mb: 0.75,
                            overflowX: isTabletWorkspace ? 'auto' : 'visible',
                            flexWrap: isTabletWorkspace ? 'nowrap' : 'wrap',
                            whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                            pb: isTabletWorkspace ? 0.2 : 0,
                          }}
                        >
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-timing-down"
                            disabled={!selectedSpatialBookmark}
                            onClick={() => handleFlythroughTimingDelta(-600)}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                          >
                            Shorter
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-timing-up"
                            disabled={!selectedSpatialBookmark}
                            onClick={() => handleFlythroughTimingDelta(600)}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                          >
                            Longer
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-transition"
                            disabled={!selectedSpatialBookmark}
                            onClick={handleFlythroughTransitionCycle}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: '#fde68a', bgcolor: 'rgba(246,178,77,0.12)' }}
                          >
                            {selectedSpatialBookmark ? `Transition: ${selectedSpatialBookmark.transition}` : 'Transition'}
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-capture-view"
                            disabled={!selectedSpatialBookmark || !activeSpatialCanvas}
                            onClick={handleFlythroughCaptureSelectedView}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: '#bfdbfe', bgcolor: 'rgba(96,165,250,0.14)' }}
                          >
                            Capture View
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-reset-view"
                            disabled={!selectedSpatialBookmark}
                            onClick={handleFlythroughResetSelectedView}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                          >
                            Reset View
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-move-up"
                            disabled={!selectedFlythroughEntry || selectedFlythroughEntry.index <= 0}
                            onClick={() => handleFlythroughMoveSelected(-1)}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                          >
                            Earlier
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-move-down"
                            disabled={!selectedFlythroughEntry || selectedFlythroughEntry.index >= (flythroughSequence.length - 1)}
                            onClick={() => handleFlythroughMoveSelected(1)}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                          >
                            Later
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-flythrough-remove"
                            disabled={!selectedSpatialBookmark}
                            onClick={handleFlythroughRemoveSelected}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: '#fda4af', bgcolor: 'rgba(127,29,29,0.26)' }}
                          >
                            Remove
                          </Button>
                        </Stack>

                        <Stack
                          data-testid="frame-editor-flythrough-visibility-list"
                          direction="row"
                          spacing={0.6}
                          flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                          useFlexGap={!isTabletWorkspace}
                          sx={{
                            overflowX: isTabletWorkspace ? 'auto' : 'visible',
                            flexWrap: isTabletWorkspace ? 'nowrap' : 'wrap',
                            whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                            pb: isTabletWorkspace ? 0.2 : 0,
                          }}
                        >
                          {spatialCanvases.map((canvas) => {
                            const canvasId = toTestIdFragment(canvas.name);
                            const isVisibleInBookmark = Boolean(selectedSpatialBookmark?.visibleCanvasIds.includes(canvas.id));
                            return (
                              <Chip
                                key={canvas.id}
                                data-testid={`frame-editor-flythrough-visibility-${canvasId}`}
                                clickable={Boolean(selectedSpatialBookmark)}
                                onClick={() => handleFlythroughVisibilityToggle(canvas.id)}
                                label={`${canvas.name}${isVisibleInBookmark ? ' ON' : ' OFF'}`}
                                sx={{
                                  height: isTabletWorkspace ? 30 : undefined,
                                  bgcolor: isVisibleInBookmark ? 'rgba(96,165,250,0.18)' : 'rgba(255,255,255,0.05)',
                                  color: isVisibleInBookmark ? '#bfdbfe' : 'rgba(248,250,252,0.74)',
                                  '& .MuiChip-label': {
                                    px: isTabletWorkspace ? 0.85 : 0.6,
                                    fontSize: isTabletWorkspace ? '0.62rem' : '0.56rem',
                                    fontWeight: 700,
                                  },
                                }}
                              />
                            );
                          })}
                        </Stack>
                      </Paper>

                      <Paper
                        data-testid="frame-editor-spatial-projection-card"
                        sx={{
                          p: 0.9,
                          borderRadius: 1.6,
                          bgcolor: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.65 }}>
                          <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.54)', letterSpacing: 1.1 }}>
                            PROJECTION
                          </Typography>
                          <Chip
                            label={formatProjectionModeLabel(drawingDocument.projection.mode)}
                            size="small"
                            sx={{
                              height: 18,
                              borderRadius: 999,
                              bgcolor: 'rgba(255,255,255,0.06)',
                              color: 'rgba(248,250,252,0.78)',
                              '& .MuiChip-label': { px: 0.55, fontSize: '0.52rem', fontWeight: 700, letterSpacing: 0.35 },
                            }}
                          />
                        </Stack>
                        <ToggleButtonGroup
                          exclusive
                          size="small"
                          value={drawingDocument.projection.mode}
                          data-testid="frame-editor-spatial-projection-mode-tabs"
                          onChange={(_, value: StoryboardDocumentProjectionMode | null) => {
                            if (value) {
                              handleProjectionModeChange(value);
                            }
                          }}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                              gap: 0.55,
                              mb: 0.85,
                              '& .MuiToggleButton-root': {
                                minWidth: 0,
                                py: isTabletWorkspace ? 0.55 : 0.3,
                                minHeight: isTabletWorkspace ? 34 : undefined,
                                border: '1px solid rgba(148,163,184,0.18)',
                                color: 'rgba(226,232,240,0.72)',
                                fontSize: isTabletWorkspace ? '0.62rem' : '0.58rem',
                                letterSpacing: 0.7,
                                textTransform: 'uppercase',
                              },
                            '& .Mui-selected': {
                              color: '#f8fafc',
                              backgroundColor: 'rgba(96,165,250,0.18)',
                            },
                          }}
                        >
                          {STUDIO_PROJECTION_MODES.map((mode) => (
                            <ToggleButton key={mode} value={mode}>
                              {formatProjectionModeLabel(mode)}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>

                        <Stack spacing={0.65}>
                          <Button
                            data-testid="frame-editor-spatial-projection-source"
                            size="small"
                            onClick={() => {
                              const sourceIndex = spatialCanvases.findIndex((canvas) => canvas.id === projectionSourceCanvas?.id);
                              const nextCanvas = spatialCanvases[(sourceIndex + 1) % Math.max(1, spatialCanvases.length)];
                              if (nextCanvas) {
                                handleProjectionSourceChange(nextCanvas.id);
                              }
                            }}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, justifyContent: 'space-between', color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                          >
                            Source: {projectionSourceCanvas?.name || 'None'}
                            <ArrowForward fontSize="small" />
                          </Button>
                          <Button
                            data-testid="frame-editor-spatial-projection-target"
                            size="small"
                            onClick={() => {
                              const targetIndex = spatialCanvases.findIndex((canvas) => canvas.id === projectionTargetCanvas?.id);
                              const nextCanvas = spatialCanvases[(targetIndex + 1) % Math.max(1, spatialCanvases.length)];
                              if (nextCanvas) {
                                handleProjectionTargetChange(nextCanvas.id);
                              }
                            }}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, justifyContent: 'space-between', color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                          >
                            Target: {projectionTargetCanvas?.name || 'None'}
                            <ArrowForward fontSize="small" />
                          </Button>
                          <Paper
                            data-testid="frame-editor-spatial-projection-summary"
                            sx={{
                              p: 0.75,
                              borderRadius: 1.45,
                              bgcolor: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack spacing={0.2}>
                              <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                                {drawingDocument.projection.appliedCount > 0
                                  ? `${drawingDocument.projection.appliedCount} projection passes`
                                  : 'No projection passes yet'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.58)' }}>
                                {lastProjectedBookmark
                                  ? `${lastProjectedBookmark.name} · ${formatClockDuration(lastProjectedBookmark.timingMs)}`
                                  : 'Apply projection to stage the active sheet onto the target canvas.'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.58)' }}>
                                {projectionTargetCanvas
                                  ? `${projectionTargetCanvas.name} · ${formatCanvasTransformSummary(projectionTargetCanvas)}`
                                  : 'No target canvas selected'}
                              </Typography>
                            </Stack>
                          </Paper>
                          <Stack
                            data-testid="frame-editor-spatial-projection-toggles"
                            direction="row"
                            spacing={0.7}
                            flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                            useFlexGap={!isTabletWorkspace}
                            sx={{
                              overflowX: isTabletWorkspace ? 'auto' : 'visible',
                              flexWrap: isTabletWorkspace ? 'nowrap' : 'wrap',
                              whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                              pb: isTabletWorkspace ? 0.2 : 0,
                            }}
                          >
                            <Chip
                              clickable
                              label={drawingDocument.projection.reinterpretExistingStrokes ? 'Reinterpret ON' : 'Reinterpret OFF'}
                              onClick={() => handleProjectionToggle('reinterpretExistingStrokes')}
                              sx={{
                                height: isTabletWorkspace ? 30 : undefined,
                                bgcolor: 'rgba(255,255,255,0.05)',
                                color: '#f8fafc',
                                '& .MuiChip-label': {
                                  px: isTabletWorkspace ? 0.85 : 0.6,
                                  fontSize: isTabletWorkspace ? '0.62rem' : '0.56rem',
                                  fontWeight: 700,
                                },
                              }}
                            />
                            <Chip
                              clickable
                              label={drawingDocument.projection.arrangeAfterDrawing ? 'Arrange Later ON' : 'Arrange Later OFF'}
                              onClick={() => handleProjectionToggle('arrangeAfterDrawing')}
                              sx={{
                                height: isTabletWorkspace ? 30 : undefined,
                                bgcolor: 'rgba(255,255,255,0.05)',
                                color: '#f8fafc',
                                '& .MuiChip-label': {
                                  px: isTabletWorkspace ? 0.85 : 0.6,
                                  fontSize: isTabletWorkspace ? '0.62rem' : '0.56rem',
                                  fontWeight: 700,
                                },
                              }}
                            />
                          </Stack>
                          <Button
                            data-testid="frame-editor-spatial-projection-apply"
                            size="small"
                            onClick={handleApplyProjection}
                            disabled={!projectionSourceCanvas || !projectionTargetCanvas || projectionSourceCanvas.id === projectionTargetCanvas.id}
                            startIcon={<Reply fontSize="small" />}
                            sx={{
                              minHeight: tabletTouchSecondaryButtonHeight,
                              justifyContent: 'space-between',
                              color: '#fde68a',
                              bgcolor: 'rgba(246,178,77,0.12)',
                              border: '1px solid rgba(246,178,77,0.2)',
                            }}
                          >
                            Project Active Sheet
                          </Button>
                        </Stack>
                      </Paper>
                    </Paper>
                    <Paper
                      data-testid="frame-editor-shape-intent-card"
                      sx={{
                        p: 1.05,
                        borderRadius: 1.9,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.9 }}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'rgba(248,250,252,0.6)', fontSize: '0.68rem', lineHeight: 1, letterSpacing: 1.55, fontWeight: 700 }}
                        >
                          SHAPE INTENT ASSIST
                        </Typography>
                        <Chip
                          data-testid="frame-editor-shape-intent-primitive"
                          label={shapeIntentAnalysis
                            ? `${shapeIntentAnalysis.displayLabel.toUpperCase()} · ${Math.round(shapeIntentAnalysis.confidence * 100)}%`
                            : shapeIntentParkedPrimitive
                              ? `${shapeIntentParkedPrimitive.toUpperCase()} · PARKED`
                              : 'IDLE'}
                          size="small"
                          sx={{
                            height: 20,
                            borderRadius: 999,
                            bgcolor: shapeIntentAnalysis || shapeIntentParkedPrimitive ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.06)',
                            color: shapeIntentAnalysis || shapeIntentParkedPrimitive ? '#fde68a' : 'rgba(226,232,240,0.68)',
                            '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.35 },
                          }}
                        />
                      </Stack>

                      {shapeIntentVisible && shapeIntentAnalysis && selectedShapeIntentSuggestion ? (
                        <Stack spacing={0.85}>
                          <Stack spacing={0.25}>
                            <Typography
                              data-testid="frame-editor-shape-intent-headline"
                              variant="body2"
                              sx={{ color: '#f8fafc', fontWeight: 700 }}
                            >
                              {shapeIntentAnalysis.headline}
                            </Typography>
                            <Typography
                              data-testid="frame-editor-shape-intent-summary"
                              variant="caption"
                              sx={{ color: 'rgba(226,232,240,0.68)' }}
                            >
                              {shapeIntentAnalysis.summary}
                            </Typography>
                          </Stack>

                          <Stack
                            direction="row"
                            spacing={0.7}
                            flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                            useFlexGap={!isTabletWorkspace}
                            sx={{
                              overflowX: isTabletWorkspace ? 'auto' : 'visible',
                              whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                              pb: isTabletWorkspace ? 0.2 : 0,
                            }}
                          >
                            <Button
                              size="small"
                              data-testid="frame-editor-shape-intent-normalize"
                              onClick={handleApplyShapeIntentNormalizedGuide}
                              startIcon={<AutoAwesome fontSize="small" />}
                              sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(245,158,11,0.12)', color: '#fde68a' }}
                            >
                              {shapeIntentAnalysis.normalizedGuideLabel}
                            </Button>
                            <Button
                              size="small"
                              data-testid="frame-editor-shape-intent-shuffle"
                              onClick={handleShapeIntentShuffle}
                              startIcon={<Shuffle fontSize="small" />}
                              sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                            >
                              Shuffle Ideas
                            </Button>
                            <Button
                              size="small"
                              data-testid="frame-editor-shape-intent-dismiss"
                              onClick={handleDismissShapeIntent}
                              sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(226,232,240,0.72)' }}
                            >
                              Park
                            </Button>
                          </Stack>

                          <Stack
                            data-testid="frame-editor-shape-intent-suggestions"
                            direction="row"
                            spacing={0.7}
                            flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                            useFlexGap={!isTabletWorkspace}
                            sx={{
                              overflowX: isTabletWorkspace ? 'auto' : 'visible',
                              whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                              pb: isTabletWorkspace ? 0.2 : 0,
                            }}
                          >
                            {visibleShapeIntentSuggestions.map((suggestion) => (
                              <Button
                                key={suggestion.id}
                                size="small"
                                data-testid={`frame-editor-shape-intent-suggestion-${suggestion.id}`}
                                onClick={() => handleSelectShapeIntentSuggestion(suggestion)}
                                sx={{
                                  minHeight: tabletTouchSecondaryButtonHeight,
                                  borderRadius: 999,
                                  px: 1.1,
                                  color: shapeIntentSelectedSuggestionId === suggestion.id ? '#111827' : '#f8fafc',
                                  bgcolor: shapeIntentSelectedSuggestionId === suggestion.id ? suggestion.accentColor : 'rgba(255,255,255,0.05)',
                                  border: `1px solid ${shapeIntentSelectedSuggestionId === suggestion.id ? alpha(suggestion.accentColor, 0.36) : 'rgba(255,255,255,0.06)'}`,
                                }}
                              >
                                {suggestion.title}
                              </Button>
                            ))}
                          </Stack>

                          <Paper
                            data-testid="frame-editor-shape-intent-preview-card"
                            sx={{
                              p: 0.8,
                              borderRadius: 1.55,
                              bgcolor: 'rgba(255,255,255,0.028)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack spacing={0.8}>
                              <Stack direction="row" spacing={0.85} alignItems="flex-start">
                                <Box
                                  component="img"
                                  data-testid="frame-editor-shape-intent-preview"
                                  alt={`${selectedShapeIntentSuggestion.title} preview`}
                                  src={shapeIntentPreviewDataUrl}
                                  sx={{
                                    width: isTabletWorkspace ? 132 : 120,
                                    height: isTabletWorkspace ? 96 : 88,
                                    borderRadius: 1.25,
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    bgcolor: 'rgba(15,23,42,0.92)',
                                    objectFit: 'cover',
                                    flexShrink: 0,
                                  }}
                                />
                                <Stack spacing={0.28} sx={{ minWidth: 0 }}>
                                  <Typography
                                    variant="body2"
                                    sx={{ color: '#f8fafc', fontWeight: 700 }}
                                  >
                                    {selectedShapeIntentSuggestion.title}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: selectedShapeIntentSuggestion.accentColor, fontWeight: 700, letterSpacing: 0.7 }}
                                  >
                                    {selectedShapeIntentSuggestion.category.toUpperCase()}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: 'rgba(226,232,240,0.68)' }}
                                  >
                                    {selectedShapeIntentSuggestion.description}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    sx={{ color: 'rgba(226,232,240,0.56)' }}
                                  >
                                    {selectedShapeIntentSuggestion.learningFocus}
                                  </Typography>
                                  {shapeIntentContextSignals.length > 0 && (
                                    <Stack
                                      data-testid="frame-editor-shape-intent-context-signals"
                                      direction="row"
                                      spacing={0.45}
                                      flexWrap="wrap"
                                      useFlexGap
                                    >
                                      {shapeIntentContextSignals.map((signal) => (
                                        <Chip
                                          key={signal.id}
                                          data-testid={`frame-editor-shape-intent-context-signal-${signal.id}`}
                                          label={signal.label}
                                          size="small"
                                          sx={{
                                            height: 18,
                                            borderRadius: 999,
                                            bgcolor: signal.tone === 'workflow'
                                              ? 'rgba(96,165,250,0.14)'
                                              : signal.tone === 'pinned'
                                                ? 'rgba(250,204,21,0.16)'
                                              : signal.tone === 'library'
                                                ? 'rgba(245,158,11,0.14)'
                                                : 'rgba(16,185,129,0.14)',
                                            color: signal.tone === 'workflow'
                                              ? '#bfdbfe'
                                              : signal.tone === 'pinned'
                                                ? '#fde047'
                                              : signal.tone === 'library'
                                                ? '#fde68a'
                                                : '#a7f3d0',
                                            '& .MuiChip-label': {
                                              px: 0.7,
                                              fontSize: '0.54rem',
                                              fontWeight: 700,
                                              letterSpacing: 0.28,
                                            },
                                          }}
                                        />
                                      ))}
                                    </Stack>
                                  )}
                                  {shapeIntentLibraryPresetEntries.length > 0 && (
                                    <Stack
                                      data-testid="frame-editor-shape-intent-library-presets"
                                      spacing={0.32}
                                    >
                                      <Typography
                                        variant="caption"
                                        sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.42 }}
                                      >
                                        Saved Presets
                                      </Typography>
                                      <Stack spacing={0.45}>
                                        {shapeIntentLibraryPresetEntries.map((entry) => {
                                          const presetSuggestion = getShapeIntentSuggestionDefinitionById(entry.suggestionId);
                                          if (!presetSuggestion) {
                                            return null;
                                          }
                                          return (
                                            <Stack
                                              key={entry.id}
                                              direction="row"
                                              spacing={0.45}
                                              alignItems="center"
                                              flexWrap="wrap"
                                              useFlexGap
                                            >
                                              <Button
                                                size="small"
                                                data-testid={`frame-editor-shape-intent-library-preset-${entry.id}`}
                                                onPointerDown={(event) => handleApplyShapeIntentLibraryPresetPointer(event, entry.id)}
                                                onClick={(event) => handleApplyShapeIntentLibraryPresetClick(event, entry.id)}
                                                sx={{
                                                  minHeight: tabletTouchSecondaryButtonHeight,
                                                  borderRadius: 999,
                                                  px: 0.95,
                                                  color: '#f8fafc',
                                                  bgcolor: alpha(presetSuggestion.accentColor, 0.14),
                                                  border: `1px solid ${alpha(presetSuggestion.accentColor, 0.24)}`,
                                                }}
                                              >
                                                {entry.name}
                                              </Button>
                                              <Button
                                                size="small"
                                                data-testid={`frame-editor-shape-intent-library-preset-study-${entry.id}`}
                                                onClick={() => handleStartShapeScaffoldLibraryEntryStudy(entry.id)}
                                                sx={{
                                                  minHeight: tabletTouchSecondaryButtonHeight,
                                                  borderRadius: 999,
                                                  px: 0.9,
                                                  color: '#bfdbfe',
                                                  bgcolor: 'rgba(59,130,246,0.12)',
                                                }}
                                              >
                                                Study
                                              </Button>
                                              <Button
                                                size="small"
                                                data-testid={`frame-editor-shape-intent-library-preset-pin-${entry.id}`}
                                                onClick={() => handleToggleShapeScaffoldLibraryEntryPinned(entry.id)}
                                                sx={{
                                                  minHeight: tabletTouchSecondaryButtonHeight,
                                                  borderRadius: 999,
                                                  px: 0.9,
                                                  color: entry.pinned ? '#fef08a' : 'rgba(248,250,252,0.72)',
                                                  bgcolor: entry.pinned ? 'rgba(250,204,21,0.16)' : 'rgba(255,255,255,0.045)',
                                                }}
                                              >
                                                {entry.pinned ? 'Pinned' : 'Pin'}
                                              </Button>
                                            </Stack>
                                          );
                                        })}
                                      </Stack>
                                    </Stack>
                                  )}
                                </Stack>
                              </Stack>

                              <Stack
                                data-testid="frame-editor-shape-intent-apply-modes"
                                direction="row"
                                spacing={0.55}
                                flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                                useFlexGap={!isTabletWorkspace}
                                sx={{
                                  overflowX: isTabletWorkspace ? 'auto' : 'visible',
                                  whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                                  pb: isTabletWorkspace ? 0.2 : 0,
                                }}
                              >
                                {(['rough', 'construction', 'clean'] as ShapeIntentApplyMode[]).map((modeOption) => {
                                  const selected = shapeIntentApplyMode === modeOption;
                                  return (
                                    <Button
                                      key={modeOption}
                                      size="small"
                                      data-testid={`frame-editor-shape-intent-mode-${modeOption}`}
                                      onClick={() => setShapeIntentApplyMode(modeOption)}
                                      sx={{
                                        minHeight: tabletTouchSecondaryButtonHeight,
                                        borderRadius: 999,
                                        px: 1,
                                        color: selected ? '#111827' : '#f8fafc',
                                        bgcolor: selected ? selectedShapeIntentSuggestion.accentColor : 'rgba(255,255,255,0.045)',
                                        border: `1px solid ${selected ? alpha(selectedShapeIntentSuggestion.accentColor, 0.36) : 'rgba(255,255,255,0.06)'}`,
                                      }}
                                    >
                                      {modeOption === 'rough' ? 'Rough' : modeOption === 'construction' ? 'Construction' : 'Clean'}
                                    </Button>
                                  );
                                })}
                              </Stack>

                              <Stack
                                data-testid="frame-editor-shape-intent-variant-shelf"
                                direction="row"
                                spacing={0.7}
                                flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                                useFlexGap={!isTabletWorkspace}
                                sx={{
                                  overflowX: isTabletWorkspace ? 'auto' : 'visible',
                                  whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                                  pb: isTabletWorkspace ? 0.2 : 0,
                                }}
                              >
                                {shapeIntentVariantCards.map((variantCard) => {
                                  const selected = variantCard.suggestion.id === selectedShapeIntentSuggestion.id;
                                  return (
                                    <Button
                                      key={variantCard.suggestion.id}
                                      data-testid={`frame-editor-shape-intent-variant-${variantCard.suggestion.id}`}
                                      onClick={() => handleSelectShapeIntentSuggestion(variantCard.suggestion)}
                                      sx={{
                                        minWidth: isTabletWorkspace ? 148 : 136,
                                        px: 0.7,
                                        py: 0.65,
                                        borderRadius: 1.35,
                                        alignItems: 'stretch',
                                        textTransform: 'none',
                                        justifyContent: 'flex-start',
                                        bgcolor: selected ? alpha(variantCard.suggestion.accentColor, 0.16) : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${selected ? alpha(variantCard.suggestion.accentColor, 0.38) : 'rgba(255,255,255,0.06)'}`,
                                      }}
                                    >
                                      <Stack spacing={0.45} sx={{ width: '100%', textAlign: 'left' }}>
                                        <Box
                                          component="img"
                                          alt={`${variantCard.suggestion.title} variant`}
                                          src={variantCard.previewDataUrl}
                                          sx={{
                                            width: '100%',
                                            height: 64,
                                            borderRadius: 1,
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            bgcolor: 'rgba(15,23,42,0.92)',
                                            objectFit: 'cover',
                                          }}
                                        />
                                        <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700, lineHeight: 1.2 }}>
                                          {variantCard.suggestion.title}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: selected ? variantCard.suggestion.accentColor : 'rgba(226,232,240,0.62)', lineHeight: 1.2 }}>
                                          {variantCard.suggestion.category}
                                        </Typography>
                                      </Stack>
                                    </Button>
                                  );
                                })}
                              </Stack>

                              <Stack data-testid="frame-editor-shape-intent-parameters" spacing={0.65}>
                                {selectedShapeIntentSuggestion.parameters.map((parameter) => {
                                  const selectedValues = activeShapeIntentSelections[parameter.id]?.length
                                    ? activeShapeIntentSelections[parameter.id]
                                    : parameter.defaultValue;
                                  return (
                                    <Stack key={parameter.id} spacing={0.35}>
                                      <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                        {parameter.label}
                                      </Typography>
                                      <Stack
                                        direction="row"
                                        spacing={0.55}
                                        flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                                        useFlexGap={!isTabletWorkspace}
                                        sx={{
                                          overflowX: isTabletWorkspace ? 'auto' : 'visible',
                                          whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                                          pb: isTabletWorkspace ? 0.2 : 0,
                                        }}
                                      >
                                        {parameter.options.map((option) => {
                                          const selected = selectedValues.includes(option.id);
                                          return (
                                            <Button
                                              key={option.id}
                                              size="small"
                                              data-testid={`frame-editor-shape-intent-parameter-${parameter.id}-${option.id}`}
                                              onClick={() => handleShapeIntentParameterToggle(parameter, option.id)}
                                              sx={{
                                                minHeight: tabletTouchSecondaryButtonHeight,
                                                borderRadius: 999,
                                                px: 0.95,
                                                color: selected ? '#111827' : '#f8fafc',
                                                bgcolor: selected ? selectedShapeIntentSuggestion.accentColor : 'rgba(255,255,255,0.045)',
                                                border: `1px solid ${selected ? alpha(selectedShapeIntentSuggestion.accentColor, 0.34) : 'rgba(255,255,255,0.06)'}`,
                                              }}
                                            >
                                              {option.label}
                                            </Button>
                                          );
                                        })}
                                      </Stack>
                                    </Stack>
                                  );
                                })}
                              </Stack>

                              <Paper
                                data-testid="frame-editor-shape-intent-selection-summary"
                                sx={{
                                  p: 0.65,
                                  borderRadius: 1.2,
                                  bgcolor: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.66)' }}>
                                  {shapeIntentParameterSummary} · Apply Mode: {shapeIntentApplyMode === 'rough' ? 'Rough' : shapeIntentApplyMode === 'construction' ? 'Construction' : 'Clean'}
                                </Typography>
                              </Paper>

                              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                                <Button
                                  size="small"
                                  data-testid="frame-editor-shape-intent-apply-guide"
                                  onClick={handleApplyShapeIntentGuide}
                                  startIcon={<Create fontSize="small" />}
                                  sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(245,158,11,0.12)', color: '#fde68a' }}
                                >
                                  Add Guide
                                </Button>
                                <Button
                                  size="small"
                                  data-testid="frame-editor-shape-intent-save-scaffold"
                                  onClick={handleAddShapeIntentScaffold}
                                  startIcon={<Layers fontSize="small" />}
                                  sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0' }}
                                >
                                  Save Scaffold
                                </Button>
                                <Button
                                  size="small"
                                  data-testid="frame-editor-shape-intent-apply-reference"
                                  onClick={handleApplyShapeIntentReference}
                                  startIcon={<ImageIcon fontSize="small" />}
                                  sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                                >
                                  Add Reference
                                </Button>
                                <Button
                                  size="small"
                                  data-testid="frame-editor-shape-intent-start-study"
                                  onClick={handleStartShapeIntentReferenceStudy}
                                  startIcon={<FlashOn fontSize="small" />}
                                  sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                                >
                                  Study Idea
                                </Button>
                                <Button
                                  size="small"
                                  data-testid="frame-editor-shape-intent-variant-pack"
                                  onClick={handleApplyShapeIntentVariantPack}
                                  startIcon={<ContentCopy fontSize="small" />}
                                  sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#c4b5fd' }}
                                >
                                  Add 3 Variants
                                </Button>
                                <Button
                                  size="small"
                                  data-testid="frame-editor-shape-intent-study-pack"
                                  onClick={handleStartShapeIntentVariantStudy}
                                  startIcon={<Shuffle fontSize="small" />}
                                  sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(167,139,250,0.14)', color: '#ddd6fe' }}
                                >
                                  Study 3 Variants
                                </Button>
                              </Stack>
                            </Stack>
                          </Paper>
                        </Stack>
                      ) : shapeIntentAnalysis || shapeIntentParkedPrimitive ? (
                        <Alert
                          data-testid="frame-editor-shape-intent-parked"
                          severity="info"
                          sx={{ bgcolor: 'rgba(59,130,246,0.08)', color: '#bfdbfe', border: '1px solid rgba(96,165,250,0.16)' }}
                        >
                          Shape assist is parked until the next sketch stroke. Last read: {shapeIntentAnalysis?.displayLabel || shapeIntentParkedPrimitive}.
                        </Alert>
                      ) : (
                        <Alert
                          data-testid="frame-editor-shape-intent-empty"
                          severity="info"
                          sx={{ bgcolor: 'rgba(59,130,246,0.08)', color: '#bfdbfe', border: '1px solid rgba(96,165,250,0.16)' }}
                        >
                          Draw a circle, box, line, or loose blob to get multiple object ideas, parameter choices, and guide overlays.
                        </Alert>
                      )}

                      {shapeScaffolds.length > 0 && (
                        <Paper
                          data-testid="frame-editor-shape-scaffold-shelf"
                          sx={{
                            mt: 0.9,
                            p: 0.8,
                            borderRadius: 1.45,
                            bgcolor: 'rgba(255,255,255,0.028)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <Stack spacing={0.75}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                              <Typography
                                variant="caption"
                                sx={{ color: 'rgba(248,250,252,0.68)', fontWeight: 700, letterSpacing: 0.6 }}
                              >
                                SCAFFOLD LAYER
                              </Typography>
                              <Chip
                                data-testid="frame-editor-shape-scaffold-count"
                                label={`${shapeScaffolds.length} saved`}
                                size="small"
                                sx={{
                                  height: 20,
                                  borderRadius: 999,
                                  bgcolor: 'rgba(16,185,129,0.12)',
                                  color: '#a7f3d0',
                                  '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.35 },
                                }}
                              />
                            </Stack>

                            <Stack
                              direction="row"
                              spacing={0.7}
                              flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                              useFlexGap={!isTabletWorkspace}
                              sx={{
                                overflowX: isTabletWorkspace ? 'auto' : 'visible',
                                whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                                pb: isTabletWorkspace ? 0.2 : 0,
                              }}
                            >
                              {shapeScaffolds.map((scaffold) => {
                                const selected = scaffold.id === selectedShapeScaffold?.id;
                                const selectedForBatch = shapeScaffoldBatchIds.includes(scaffold.id);
                                return (
                                  <Button
                                    key={scaffold.id}
                                    data-testid={`frame-editor-shape-scaffold-card-${scaffold.id}`}
                                    onClick={() => handleSelectShapeScaffold(scaffold.id)}
                                    sx={{
                                      minWidth: isTabletWorkspace ? 164 : 152,
                                      px: 0.8,
                                      py: 0.7,
                                      borderRadius: 1.35,
                                      textTransform: 'none',
                                      alignItems: 'stretch',
                                      justifyContent: 'flex-start',
                                      bgcolor: selected ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.03)',
                                      border: `1px solid ${selected ? 'rgba(16,185,129,0.34)' : 'rgba(255,255,255,0.06)'}`,
                                    }}
                                  >
                                    <Stack spacing={0.38} sx={{ width: '100%', textAlign: 'left' }}>
                                      <Stack direction="row" spacing={0.45} alignItems="center" flexWrap="wrap" useFlexGap>
                                        <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700, lineHeight: 1.2 }}>
                                          {scaffold.name}
                                        </Typography>
                                        {selectedForBatch && (
                                          <Chip
                                            label="Batch"
                                            size="small"
                                            sx={{
                                              height: 18,
                                              borderRadius: 999,
                                              bgcolor: 'rgba(246,178,77,0.16)',
                                              color: '#fde68a',
                                              '& .MuiChip-label': { px: 0.55, fontSize: '0.52rem', fontWeight: 700, letterSpacing: 0.22 },
                                            }}
                                          />
                                        )}
                                      </Stack>
                                      <Typography variant="caption" sx={{ color: selected ? '#a7f3d0' : 'rgba(226,232,240,0.62)', lineHeight: 1.2 }}>
                                        {scaffold.applyMode.toUpperCase()} · {scaffold.visible ? 'Canvas On' : 'Hidden'}
                                      </Typography>
                                    </Stack>
                                  </Button>
                                );
                              })}
                            </Stack>

                            {selectedShapeScaffold && selectedShapeScaffoldSuggestion && (
                              <Stack
                                data-testid="frame-editor-shape-scaffold-selected"
                                spacing={0.75}
                                sx={{
                                  p: 0.8,
                                  borderRadius: 1.3,
                                  bgcolor: 'rgba(7,10,18,0.42)',
                                  border: '1px solid rgba(16,185,129,0.12)',
                                }}
                              >
                                <Stack direction="row" spacing={0.9} alignItems="flex-start">
                                  <Box
                                    component="img"
                                    data-testid="frame-editor-shape-scaffold-preview"
                                    alt={`${selectedShapeScaffold.name} scaffold preview`}
                                    src={selectedShapeScaffoldPreviewDataUrl}
                                    sx={{
                                      width: isTabletWorkspace ? 132 : 120,
                                      height: isTabletWorkspace ? 96 : 88,
                                      borderRadius: 1.15,
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      bgcolor: 'rgba(15,23,42,0.92)',
                                      objectFit: 'cover',
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Stack spacing={0.24} sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                      {selectedShapeScaffold.name}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: selectedShapeScaffoldSuggestion.accentColor, fontWeight: 700, letterSpacing: 0.65 }}>
                                      {selectedShapeScaffoldSuggestion.title.toUpperCase()}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.64)' }}>
                                      {summarizeShapeIntentSelections(selectedShapeScaffoldSuggestion, selectedShapeScaffold.selections)}
                                    </Typography>
                                    <Typography data-testid="frame-editor-shape-scaffold-frame-summary" variant="caption" sx={{ color: 'rgba(167,243,208,0.78)', fontWeight: 700, letterSpacing: 0.28 }}>
                                      {selectedShapeScaffoldFrameLabel}
                                    </Typography>
                                  </Stack>
                                </Stack>

                                <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                                  <Button
                                    size="small"
                                    data-testid="frame-editor-shape-scaffold-visibility"
                                    onClick={handleToggleSelectedShapeScaffoldVisibility}
                                    sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: selectedShapeScaffold.visible ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.05)', color: selectedShapeScaffold.visible ? '#a7f3d0' : '#f8fafc' }}
                                  >
                                    {selectedShapeScaffold.visible ? 'Canvas On' : 'Canvas Off'}
                                  </Button>
                                  <Button
                                    size="small"
                                    data-testid="frame-editor-shape-scaffold-study"
                                    onClick={handleStartSelectedShapeScaffoldStudy}
                                    startIcon={<FlashOn fontSize="small" />}
                                    sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                                  >
                                    Study Scaffold
                                  </Button>
                                  <Button
                                    size="small"
                                    data-testid="frame-editor-shape-scaffold-save-library"
                                    onClick={handleSaveSelectedShapeScaffoldToLibrary}
                                    sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(245,158,11,0.12)', color: '#fde68a' }}
                                  >
                                    Save to Library
                                  </Button>
                                  <Button
                                    size="small"
                                    data-testid="frame-editor-shape-scaffold-batch-toggle"
                                    onClick={handleToggleShapeScaffoldBatchMembership}
                                    sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: shapeScaffoldBatchIds.includes(selectedShapeScaffold.id) ? 'rgba(246,178,77,0.16)' : 'rgba(255,255,255,0.05)', color: shapeScaffoldBatchIds.includes(selectedShapeScaffold.id) ? '#fde68a' : '#f8fafc' }}
                                  >
                                    {shapeScaffoldBatchIds.includes(selectedShapeScaffold.id) ? 'In Batch' : 'Add to Batch'}
                                  </Button>
                                  <Button
                                    size="small"
                                    data-testid="frame-editor-shape-scaffold-convert-editable"
                                    onClick={handleConvertSelectedShapeScaffoldToEditableStrokes}
                                    sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0' }}
                                  >
                                    Editable Strokes
                                  </Button>
                                  <Button
                                    size="small"
                                    data-testid="frame-editor-shape-scaffold-promote-layer"
                                    onClick={handlePromoteSelectedShapeScaffoldToLayer}
                                    sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                                  >
                                    Promote Layer
                                  </Button>
                                  <Button
                                    size="small"
                                    data-testid="frame-editor-shape-scaffold-duplicate-variant"
                                    onClick={handleDuplicateSelectedShapeScaffoldToVariant}
                                    sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(125,211,252,0.12)', color: '#dbeafe' }}
                                  >
                                    Duplicate Variant
                                  </Button>
                                  <Button
                                    size="small"
                                    data-testid="frame-editor-shape-scaffold-remove"
                                    onClick={handleRemoveSelectedShapeScaffold}
                                    sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(239,68,68,0.12)', color: '#fecaca' }}
                                  >
                                    Remove
                                  </Button>
                                </Stack>

                                <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                                  {(['rough', 'construction', 'clean'] as ShapeIntentApplyMode[]).map((modeOption) => {
                                    const selected = selectedShapeScaffold.applyMode === modeOption;
                                    return (
                                      <Button
                                        key={modeOption}
                                        size="small"
                                        data-testid={`frame-editor-shape-scaffold-mode-${modeOption}`}
                                        onClick={() => handleShapeScaffoldModeChange(modeOption)}
                                        sx={{
                                          minHeight: tabletTouchSecondaryButtonHeight,
                                          borderRadius: 999,
                                          px: 1,
                                          color: selected ? '#111827' : '#f8fafc',
                                          bgcolor: selected ? selectedShapeScaffoldSuggestion.accentColor : 'rgba(255,255,255,0.045)',
                                          border: `1px solid ${selected ? alpha(selectedShapeScaffoldSuggestion.accentColor, 0.36) : 'rgba(255,255,255,0.06)'}`,
                                        }}
                                      >
                                        {modeOption === 'rough' ? 'Rough' : modeOption === 'construction' ? 'Construction' : 'Clean'}
                                      </Button>
                                    );
                                  })}
                                </Stack>

                                {selectedShapeScaffoldQuickSwapSuggestions.length > 0 && (
                                  <Stack spacing={0.35}>
                                    <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                      Quick Swap
                                    </Typography>
                                    <Stack
                                      data-testid="frame-editor-shape-scaffold-quick-swap"
                                      direction="row"
                                      spacing={0.55}
                                      flexWrap="wrap"
                                      useFlexGap
                                    >
                                      {selectedShapeScaffoldQuickSwapSuggestions.map((suggestion) => (
                                        <Button
                                          key={suggestion.id}
                                          size="small"
                                          data-testid={`frame-editor-shape-scaffold-quick-swap-${suggestion.id}`}
                                          onClick={() => handleQuickSwapSelectedShapeScaffold(suggestion.id)}
                                          sx={{
                                            minHeight: tabletTouchSecondaryButtonHeight,
                                            borderRadius: 999,
                                            px: 0.95,
                                            color: '#f8fafc',
                                            bgcolor: 'rgba(255,255,255,0.045)',
                                            border: `1px solid ${alpha(suggestion.accentColor, 0.24)}`,
                                          }}
                                        >
                                          {suggestion.title}
                                        </Button>
                                      ))}
                                    </Stack>
                                  </Stack>
                                )}

                                {selectedShapeScaffoldLibraryPresetEntries.length > 0 && (
                                  <Stack spacing={0.35}>
                                    <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                      Saved Presets
                                    </Typography>
                                    <Stack
                                      data-testid="frame-editor-shape-scaffold-library-presets"
                                      direction="row"
                                      spacing={0.55}
                                      flexWrap="wrap"
                                      useFlexGap
                                    >
                                      {selectedShapeScaffoldLibraryPresetEntries.map((entry) => {
                                        const suggestion = getShapeIntentSuggestionDefinitionById(entry.suggestionId);
                                        if (!suggestion) {
                                          return null;
                                        }
                                        const active = (
                                          entry.suggestionId === selectedShapeScaffold.suggestionId
                                          && entry.applyMode === selectedShapeScaffold.applyMode
                                          && areShapeIntentSelectionsEqual(entry.selections, selectedShapeScaffold.selections)
                                        );
                                        return (
                                          <Button
                                            key={entry.id}
                                            size="small"
                                            data-testid={`frame-editor-shape-scaffold-library-preset-${entry.id}`}
                                            onPointerDown={(event) => handleApplySelectedShapeScaffoldLibraryPresetPointer(event, entry.id)}
                                            onClick={(event) => handleApplySelectedShapeScaffoldLibraryPresetClick(event, entry.id)}
                                            sx={{
                                              minHeight: tabletTouchSecondaryButtonHeight,
                                              borderRadius: 999,
                                              px: 0.95,
                                              color: active ? '#111827' : '#f8fafc',
                                              bgcolor: active ? suggestion.accentColor : 'rgba(255,255,255,0.045)',
                                              border: `1px solid ${active ? alpha(suggestion.accentColor, 0.36) : 'rgba(255,255,255,0.06)'}`,
                                            }}
                                          >
                                            {entry.name}{active ? ' Active' : ''}
                                          </Button>
                                        );
                                      })}
                                    </Stack>
                                  </Stack>
                                )}

                                {availableShapeScaffoldAssemblyTemplates.length > 0 && (
                                  <Stack spacing={0.45}>
                                    <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                      Assembly Blocks
                                    </Typography>
                                    <Stack spacing={0.45}>
                                      {availableShapeScaffoldAssemblyTemplates.map((template) => (
                                        <Paper
                                          key={template.id}
                                          data-testid={`frame-editor-shape-scaffold-assembly-template-card-${template.id}`}
                                          sx={{
                                            p: 0.55,
                                            borderRadius: 1.1,
                                            bgcolor: 'rgba(255,255,255,0.028)',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                          }}
                                        >
                                          <Stack direction="row" spacing={0.65} alignItems="center" justifyContent="space-between">
                                            <Stack spacing={0.18} sx={{ minWidth: 0 }}>
                                              <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                                {template.title}
                                              </Typography>
                                              <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.62)' }}>
                                                {template.description}
                                              </Typography>
                                            </Stack>
                                            <Button
                                              size="small"
                                              data-testid={`frame-editor-shape-scaffold-assembly-template-${template.id}`}
                                              onClick={() => handleCreateShapeScaffoldAssemblyFromTemplate(template.id)}
                                              sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, px: 1, bgcolor: 'rgba(246,178,77,0.14)', color: '#fde68a' }}
                                            >
                                              Build
                                            </Button>
                                          </Stack>
                                        </Paper>
                                      ))}
                                    </Stack>
                                  </Stack>
                                )}

                                <Stack spacing={0.55}>
                                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                      Opacity
                                    </Typography>
                                    <Typography data-testid="frame-editor-shape-scaffold-opacity-value" variant="caption" sx={{ color: '#a7f3d0', fontWeight: 700 }}>
                                      {Math.round(selectedShapeScaffold.opacity * 100)}%
                                    </Typography>
                                  </Stack>
                                  <Slider
                                    data-testid="frame-editor-shape-scaffold-opacity"
                                    value={Math.round(selectedShapeScaffold.opacity * 100)}
                                    min={20}
                                    max={100}
                                    step={5}
                                    onChange={(_, value) => handleShapeScaffoldOpacityChange((Array.isArray(value) ? value[0] : value) / 100)}
                                    sx={{ color: '#34d399', '& .MuiSlider-thumb': { width: 14, height: 14 } }}
                                  />
                                </Stack>

                                <Stack spacing={0.55}>
                                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                      Scale
                                    </Typography>
                                    <Typography data-testid="frame-editor-shape-scaffold-scale-value" variant="caption" sx={{ color: '#a7f3d0', fontWeight: 700 }}>
                                      {selectedShapeScaffoldScalePercent}%
                                    </Typography>
                                  </Stack>
                                  <Slider
                                    data-testid="frame-editor-shape-scaffold-scale"
                                    value={selectedShapeScaffoldScalePercent}
                                    min={60}
                                    max={180}
                                    step={5}
                                    onChange={(_, value) => handleShapeScaffoldScaleChange(Array.isArray(value) ? value[0] : value)}
                                    sx={{ color: '#34d399', '& .MuiSlider-thumb': { width: 14, height: 14 } }}
                                  />
                                </Stack>

                                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                  <Button size="small" data-testid="frame-editor-shape-scaffold-nudge-up" onClick={() => handleNudgeShapeScaffold(0, -0.02)} sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.045)', color: '#f8fafc' }}>Up</Button>
                                  <Button size="small" data-testid="frame-editor-shape-scaffold-nudge-left" onClick={() => handleNudgeShapeScaffold(-0.02, 0)} sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.045)', color: '#f8fafc' }}>Left</Button>
                                  <Button size="small" data-testid="frame-editor-shape-scaffold-nudge-right" onClick={() => handleNudgeShapeScaffold(0.02, 0)} sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.045)', color: '#f8fafc' }}>Right</Button>
                                  <Button size="small" data-testid="frame-editor-shape-scaffold-nudge-down" onClick={() => handleNudgeShapeScaffold(0, 0.02)} sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.045)', color: '#f8fafc' }}>Down</Button>
                                </Stack>

                                <Stack spacing={0.6}>
                                  {selectedShapeScaffoldSuggestion.parameters.map((parameter) => {
                                    const selectedValues = selectedShapeScaffold.selections[parameter.id]?.length
                                      ? selectedShapeScaffold.selections[parameter.id]
                                      : parameter.defaultValue;
                                    return (
                                      <Stack key={parameter.id} spacing={0.3}>
                                        <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                          {parameter.label}
                                        </Typography>
                                        <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                                          {parameter.options.map((option) => {
                                            const selected = selectedValues.includes(option.id);
                                            return (
                                              <Button
                                                key={option.id}
                                                size="small"
                                                data-testid={`frame-editor-shape-scaffold-parameter-${parameter.id}-${option.id}`}
                                                onClick={() => handleShapeScaffoldParameterToggle(parameter, option.id)}
                                                sx={{
                                                  minHeight: tabletTouchSecondaryButtonHeight,
                                                  borderRadius: 999,
                                                  px: 0.95,
                                                  color: selected ? '#111827' : '#f8fafc',
                                                  bgcolor: selected ? selectedShapeScaffoldSuggestion.accentColor : 'rgba(255,255,255,0.045)',
                                                  border: `1px solid ${selected ? alpha(selectedShapeScaffoldSuggestion.accentColor, 0.34) : 'rgba(255,255,255,0.06)'}`,
                                                }}
                                              >
                                                {option.label}
                                              </Button>
                                            );
                                          })}
                                        </Stack>
                                      </Stack>
                                    );
                                  })}
                                </Stack>
                              </Stack>
                            )}
                          </Stack>
                        </Paper>
                      )}

                      {(shapeScaffoldAssemblies.length > 0 || selectedShapeScaffoldBatch.length > 0) && (
                        <Paper
                          data-testid="frame-editor-shape-scaffold-assemblies"
                          sx={{
                            mt: 0.9,
                            p: 0.8,
                            borderRadius: 1.45,
                            bgcolor: 'rgba(255,255,255,0.028)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <Stack spacing={0.75}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                              <Typography
                                variant="caption"
                                sx={{ color: 'rgba(248,250,252,0.68)', fontWeight: 700, letterSpacing: 0.6 }}
                              >
                                SCAFFOLD ASSEMBLIES
                              </Typography>
                              <Chip
                                data-testid="frame-editor-shape-scaffold-assembly-count"
                                label={`${shapeScaffoldAssemblies.length} saved · ${selectedShapeScaffoldBatch.length} batched`}
                                size="small"
                                sx={{
                                  height: 20,
                                  borderRadius: 999,
                                  bgcolor: 'rgba(59,130,246,0.12)',
                                  color: '#bfdbfe',
                                  '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.35 },
                                }}
                              />
                            </Stack>

                            <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                              <TextField
                                data-testid="frame-editor-shape-scaffold-assembly-name"
                                size="small"
                                value={shapeScaffoldAssemblyDraftName}
                                onChange={(event) => setShapeScaffoldAssemblyDraftName(event.target.value)}
                                placeholder="Assembly name"
                                sx={{
                                  minWidth: 188,
                                  '& .MuiInputBase-root': {
                                    minHeight: 36,
                                    borderRadius: 999,
                                    bgcolor: 'rgba(255,255,255,0.04)',
                                    color: '#f8fafc',
                                  },
                                }}
                              />
                              <Button
                                size="small"
                                data-testid="frame-editor-shape-scaffold-assembly-create"
                                onClick={handleCreateShapeScaffoldAssembly}
                                disabled={selectedShapeScaffoldBatch.length < 2}
                                sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                              >
                                Create Assembly
                              </Button>
                              <Button
                                size="small"
                                data-testid="frame-editor-shape-scaffold-assembly-convert"
                                onClick={handleConvertSelectedShapeScaffoldBatchToEditableStrokes}
                                disabled={activeShapeScaffoldPromotionBatch.length === 0}
                                sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0' }}
                              >
                                Convert Batch
                              </Button>
                              <Button
                                size="small"
                                data-testid="frame-editor-shape-scaffold-assembly-promote"
                                onClick={handlePromoteSelectedShapeScaffoldBatchToLayerGroup}
                                disabled={activeShapeScaffoldPromotionBatch.length < 2}
                                sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0' }}
                              >
                                Promote Stack
                              </Button>
                              <Button
                                size="small"
                                data-testid="frame-editor-shape-scaffold-assembly-duplicate-variant"
                                onClick={handleDuplicateSelectedShapeScaffoldBatchToVariant}
                                disabled={activeShapeScaffoldPromotionBatch.length < 2}
                                sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(125,211,252,0.12)', color: '#dbeafe' }}
                              >
                                Duplicate Variant
                              </Button>
                              <Button
                                size="small"
                                data-testid="frame-editor-shape-scaffold-assembly-clear-batch"
                                onClick={() => {
                                  setShapeScaffoldBatchIds([]);
                                  setSelectedShapeScaffoldAssemblyId(undefined);
                                }}
                                disabled={activeShapeScaffoldPromotionBatch.length === 0}
                                sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                              >
                                Clear Batch
                              </Button>
                              <Button
                                size="small"
                                data-testid="frame-editor-shape-scaffold-assembly-remove"
                                onClick={handleRemoveSelectedShapeScaffoldAssembly}
                                disabled={!selectedShapeScaffoldAssembly}
                                sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(120,18,18,0.32)', color: '#fecaca' }}
                              >
                                Remove Assembly
                              </Button>
                            </Stack>

                            {activeShapeScaffoldPromotionBatch.length > 0 && (
                              <Paper
                                data-testid="frame-editor-shape-scaffold-batch-summary"
                                sx={{
                                  p: 0.7,
                                  borderRadius: 1.2,
                                  bgcolor: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                }}
                              >
                                <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.68)' }}>
                                  {(selectedShapeScaffoldAssembly?.name
                                    ? [`${selectedShapeScaffoldAssembly.name}:`, ...activeShapeScaffoldPromotionBatch.map((entry) => entry.name)]
                                    : activeShapeScaffoldPromotionBatch.map((entry) => entry.name)
                                  ).join(' · ')}
                                </Typography>
                              </Paper>
                            )}

                            {shapeScaffoldAssemblies.length > 0 && (
                              <Stack spacing={0.6}>
                                {shapeScaffoldAssemblies.map((assembly) => {
                                  const selected = selectedShapeScaffoldAssembly?.id === assembly.id;
                                  return (
                                    <Paper
                                      key={assembly.id}
                                      data-testid={`frame-editor-shape-scaffold-assembly-card-${assembly.id}`}
                                      onClick={() => handleSelectShapeScaffoldAssembly(assembly.id)}
                                      sx={{
                                        p: 0.7,
                                        borderRadius: 1.25,
                                        bgcolor: selected ? 'rgba(59,130,246,0.16)' : 'rgba(255,255,255,0.025)',
                                        border: `1px solid ${selected ? 'rgba(96,165,250,0.26)' : 'rgba(255,255,255,0.05)'}`,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Stack spacing={0.28}>
                                        <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                          {assembly.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: selected ? '#bfdbfe' : 'rgba(226,232,240,0.62)' }}>
                                          {assembly.scaffoldIds.length} scaffolds · {assembly.scaffoldIds.map((entryId) => getStoryboardDocumentShapeScaffoldById(drawingDocument, entryId)?.name || '').filter(Boolean).join(' · ')}
                                        </Typography>
                                      </Stack>
                                    </Paper>
                                  );
                                })}
                              </Stack>
                            )}
                          </Stack>
                        </Paper>
                      )}

                      {shapeScaffoldLibraryEntries.length > 0 ? (
                      <Paper
                        data-testid="frame-editor-shape-scaffold-library"
                        sx={{
                          mt: 0.9,
                          p: 0.8,
                          borderRadius: 1.45,
                          bgcolor: 'rgba(255,255,255,0.028)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <Stack spacing={0.75}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Typography
                              variant="caption"
                              sx={{ color: 'rgba(248,250,252,0.68)', fontWeight: 700, letterSpacing: 0.6 }}
                            >
                              SCAFFOLD LIBRARY
                            </Typography>
                            <Chip
                              data-testid="frame-editor-shape-scaffold-library-count"
                              label={
                                filteredShapeScaffoldLibraryEntries.length === shapeScaffoldLibraryEntries.length
                                  ? `${shapeScaffoldLibraryEntries.length} saved`
                                  : `${shapeScaffoldLibraryEntries.length} saved · ${filteredShapeScaffoldLibraryEntries.length} visible`
                              }
                              size="small"
                              sx={{
                                height: 20,
                                borderRadius: 999,
                                bgcolor: 'rgba(245,158,11,0.12)',
                                color: '#fde68a',
                                '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.35 },
                              }}
                            />
                          </Stack>
                          
                          <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                            <TextField
                              data-testid="frame-editor-shape-scaffold-library-search"
                              size="small"
                              value={shapeScaffoldLibrarySearch}
                              onChange={(event) => setShapeScaffoldLibrarySearch(event.target.value)}
                              placeholder="Search presets"
                              sx={{
                                minWidth: 188,
                                '& .MuiInputBase-root': {
                                  minHeight: 36,
                                  borderRadius: 999,
                                  bgcolor: 'rgba(255,255,255,0.04)',
                                  color: '#f8fafc',
                                },
                              }}
                            />
                            {(['all', 'pinned', 'defaults', 'Food', 'Vehicle', 'Furniture', 'Prop', 'Environment'] as const).map((filterValue) => {
                              const selected = shapeScaffoldLibraryFilter === filterValue;
                              return (
                                <Button
                                  key={filterValue}
                                  size="small"
                                  data-testid={`frame-editor-shape-scaffold-library-filter-${String(filterValue).toLowerCase()}`}
                                  onClick={() => setShapeScaffoldLibraryFilter(filterValue)}
                                  sx={{
                                    minHeight: tabletTouchSecondaryButtonHeight,
                                    borderRadius: 999,
                                    px: 0.95,
                                    color: selected ? '#111827' : '#f8fafc',
                                    bgcolor: selected ? '#fde68a' : 'rgba(255,255,255,0.045)',
                                    border: `1px solid ${selected ? 'rgba(246,178,77,0.24)' : 'rgba(255,255,255,0.06)'}`,
                                  }}
                                >
                                  {filterValue === 'all' ? 'All' : filterValue === 'pinned' ? 'Pinned' : filterValue === 'defaults' ? 'Defaults' : filterValue}
                                </Button>
                              );
                            })}
                          </Stack>
                          
                          <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                            <Button
                              size="small"
                              data-testid="frame-editor-shape-scaffold-library-export"
                              onClick={handleExportShapeScaffoldLibrary}
                              disabled={shapeScaffoldLibraryEntries.length === 0}
                              sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                            >
                              Export
                            </Button>
                            <Button
                              size="small"
                              data-testid="frame-editor-shape-scaffold-library-import"
                              onClick={() => shapeScaffoldLibraryImportRef.current?.click()}
                              sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0' }}
                            >
                              Import
                            </Button>
                          </Stack>
                          
                          <Stack spacing={0.6}>
                            {filteredShapeScaffoldLibraryEntries.map((entry) => {
                              const suggestion = getShapeIntentSuggestionDefinitionById(entry.suggestionId);
                              if (!suggestion) {
                                return null;
                              }
                              const matchesSelectedScaffold = Boolean(
                                selectedShapeScaffold
                                && entry.suggestionId === selectedShapeScaffold.suggestionId
                                && entry.applyMode === selectedShapeScaffold.applyMode
                                && areShapeIntentSelectionsEqual(entry.selections, selectedShapeScaffold.selections)
                              );
                              const canUpdateFromSelected = selectedShapeScaffoldCompatibleLibraryPresetEntryIds.has(entry.id);

                              return (
                                <Paper
                                  key={entry.id}
                                  data-testid={`frame-editor-shape-scaffold-library-card-${entry.id}`}
                                  sx={{
                                    p: 0.7,
                                    borderRadius: 1.25,
                                    bgcolor: 'rgba(255,255,255,0.025)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                  }}
                                >
                                  <Stack spacing={0.55}>
                                    <Stack direction="row" spacing={0.75} alignItems="flex-start">
                                      {shapeScaffoldLibraryPreviewMap[entry.id] ? (
                                        <Box
                                          component="img"
                                          alt={`${entry.name} library preview`}
                                          src={shapeScaffoldLibraryPreviewMap[entry.id]}
                                          sx={{
                                            width: 96,
                                            height: 72,
                                            borderRadius: 1,
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            bgcolor: 'rgba(15,23,42,0.92)',
                                            objectFit: 'cover',
                                            flexShrink: 0,
                                          }}
                                        />
                                      ) : null}
                                      <Stack spacing={0.18} sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                          {entry.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: suggestion.accentColor, fontWeight: 700, letterSpacing: 0.55 }}>
                                          {suggestion.title.toUpperCase()}
                                        </Typography>
                                        <Stack direction="row" spacing={0.45} flexWrap="wrap" useFlexGap>
                                          {entry.pinned && (
                                            <Chip
                                              size="small"
                                              label="Pinned"
                                              data-testid={`frame-editor-shape-scaffold-library-pinned-${entry.id}`}
                                              sx={{
                                                height: 18,
                                                borderRadius: 999,
                                                bgcolor: 'rgba(250,204,21,0.16)',
                                                color: '#fde047',
                                                '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.24 },
                                              }}
                                            />
                                          )}
                                          {entry.defaultForPrimitive && (
                                            <Chip
                                              size="small"
                                              label="Default"
                                              data-testid={`frame-editor-shape-scaffold-library-default-${entry.id}`}
                                              sx={{
                                                height: 18,
                                                borderRadius: 999,
                                                bgcolor: 'rgba(16,185,129,0.16)',
                                                color: '#a7f3d0',
                                                '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.24 },
                                              }}
                                            />
                                          )}
                                          <Chip
                                            size="small"
                                            label={`${entry.usageCount} uses`}
                                            data-testid={`frame-editor-shape-scaffold-library-usage-${entry.id}`}
                                            sx={{
                                              height: 18,
                                              borderRadius: 999,
                                              bgcolor: 'rgba(59,130,246,0.12)',
                                              color: '#bfdbfe',
                                              '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.24 },
                                            }}
                                          />
                                        </Stack>
                                        <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.64)' }}>
                                          {summarizeShapeIntentSelections(suggestion, entry.selections)}
                                        </Typography>
                                        {entry.tags.length > 0 && (
                                          <Stack direction="row" spacing={0.4} flexWrap="wrap" useFlexGap>
                                            {entry.tags.slice(0, 4).map((tag) => (
                                              <Chip
                                                key={tag}
                                                size="small"
                                                label={tag}
                                                sx={{
                                                  height: 18,
                                                  borderRadius: 999,
                                                  bgcolor: 'rgba(255,255,255,0.06)',
                                                  color: 'rgba(226,232,240,0.72)',
                                                  '& .MuiChip-label': { px: 0.55, fontSize: '0.52rem', fontWeight: 700, letterSpacing: 0.2 },
                                                }}
                                              />
                                            ))}
                                          </Stack>
                                        )}
                                      </Stack>
                                    </Stack>

                                    <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                                      <Button
                                        size="small"
                                        data-testid={`frame-editor-shape-scaffold-library-apply-${entry.id}`}
                                        onClick={() => handleApplyShapeScaffoldLibraryEntry(entry.id)}
                                        sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                                      >
                                        Load to Canvas
                                      </Button>
                                      <Button
                                        size="small"
                                        data-testid={`frame-editor-shape-scaffold-library-study-${entry.id}`}
                                        onClick={() => handleStartShapeScaffoldLibraryEntryStudy(entry.id)}
                                        sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(34,197,94,0.14)', color: '#bbf7d0' }}
                                      >
                                        Study
                                      </Button>
                                      <Button
                                        size="small"
                                        data-testid={`frame-editor-shape-scaffold-library-pin-${entry.id}`}
                                        onClick={() => handleToggleShapeScaffoldLibraryEntryPinned(entry.id)}
                                        sx={{
                                          minHeight: tabletTouchSecondaryButtonHeight,
                                          borderRadius: 999,
                                          bgcolor: entry.pinned ? 'rgba(250,204,21,0.16)' : 'rgba(255,255,255,0.045)',
                                          color: entry.pinned ? '#fef08a' : 'rgba(248,250,252,0.78)',
                                        }}
                                      >
                                        {entry.pinned ? 'Unpin' : 'Pin'}
                                      </Button>
                                      <Button
                                        size="small"
                                        data-testid={`frame-editor-shape-scaffold-library-default-toggle-${entry.id}`}
                                        onClick={() => handleSetShapeScaffoldLibraryEntryDefault(entry.id)}
                                        sx={{
                                          minHeight: tabletTouchSecondaryButtonHeight,
                                          borderRadius: 999,
                                          bgcolor: entry.defaultForPrimitive ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.045)',
                                          color: entry.defaultForPrimitive ? '#a7f3d0' : 'rgba(248,250,252,0.78)',
                                        }}
                                      >
                                        {entry.defaultForPrimitive ? 'Default' : 'Make Default'}
                                      </Button>
                                      <Button
                                        size="small"
                                        data-testid={`frame-editor-shape-scaffold-library-duplicate-${entry.id}`}
                                        onClick={() => handleDuplicateShapeScaffoldLibraryEntry(entry.id)}
                                        sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                                      >
                                        Duplicate
                                      </Button>
                                      <Button
                                        size="small"
                                        data-testid={`frame-editor-shape-scaffold-library-rename-${entry.id}`}
                                        onClick={() => handleOpenShapeScaffoldLibraryRename(entry.id)}
                                        sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                                      >
                                        Rename
                                      </Button>
                                      {canUpdateFromSelected && (
                                        <Button
                                          size="small"
                                          data-testid={`frame-editor-shape-scaffold-library-update-${entry.id}`}
                                          onClick={() => handleUpdateShapeScaffoldLibraryEntryFromSelected(entry.id)}
                                          sx={{
                                            minHeight: tabletTouchSecondaryButtonHeight,
                                            borderRadius: 999,
                                            bgcolor: matchesSelectedScaffold ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)',
                                            color: matchesSelectedScaffold ? '#d1fae5' : '#a7f3d0',
                                          }}
                                        >
                                          {matchesSelectedScaffold ? 'Current Match' : 'Update from Selected'}
                                        </Button>
                                      )}
                                      <Button
                                        size="small"
                                        data-testid={`frame-editor-shape-scaffold-library-remove-${entry.id}`}
                                        onClick={() => handleRemoveShapeScaffoldLibraryEntry(entry.id)}
                                        sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(239,68,68,0.12)', color: '#fecaca' }}
                                      >
                                        Remove
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Paper>
                              );
                            })}
                            {filteredShapeScaffoldLibraryEntries.length === 0 && (
                              <Alert
                                data-testid="frame-editor-shape-scaffold-library-empty"
                                severity="info"
                                sx={{ bgcolor: 'rgba(59,130,246,0.08)', color: '#bfdbfe', border: '1px solid rgba(96,165,250,0.16)' }}
                              >
                                {shapeScaffoldLibraryEntries.length === 0
                                  ? 'Save or import presets to build your scaffold library.'
                                  : 'No presets match the current search and filter.'}
                              </Alert>
                            )}
                          </Stack>
                        </Stack>
                      </Paper>
                      ) : (
                        <Paper
                          data-testid="frame-editor-shape-scaffold-library-empty-state"
                          sx={{
                            mt: 0.9,
                            p: 0.8,
                            borderRadius: 1.45,
                            bgcolor: 'rgba(255,255,255,0.022)',
                            border: '1px dashed rgba(255,255,255,0.08)',
                          }}
                        >
                          <Stack spacing={0.75}>
                            <Typography
                              variant="caption"
                              sx={{ color: 'rgba(248,250,252,0.68)', fontWeight: 700, letterSpacing: 0.6 }}
                            >
                              SCAFFOLD LIBRARY
                            </Typography>
                            <Alert
                              data-testid="frame-editor-shape-scaffold-library-empty"
                              severity="info"
                              sx={{ bgcolor: 'rgba(59,130,246,0.08)', color: '#bfdbfe', border: '1px solid rgba(96,165,250,0.16)' }}
                            >
                              Save or import presets to build your scaffold library.
                            </Alert>
                            <Button
                              size="small"
                              data-testid="frame-editor-shape-scaffold-library-import"
                              onClick={() => shapeScaffoldLibraryImportRef.current?.click()}
                              sx={{ minHeight: tabletTouchSecondaryButtonHeight, alignSelf: 'flex-start', borderRadius: 999, bgcolor: 'rgba(16,185,129,0.14)', color: '#a7f3d0' }}
                            >
                              Import
                            </Button>
                          </Stack>
                        </Paper>
                      )}
                    </Paper>
                    <Paper
                      data-testid="frame-editor-reference-study-card"
                      sx={{
                        p: 1.05,
                        borderRadius: 1.9,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.9 }}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'rgba(248,250,252,0.6)', fontSize: '0.68rem', lineHeight: 1, letterSpacing: 1.55, fontWeight: 700 }}
                        >
                          REFERENCE STUDY
                        </Typography>
                        <Chip
                          data-testid="frame-editor-reference-study-state"
                          label={referenceStudyActive
                            ? (referenceStudyReveal ? 'COMPARE ON' : 'MEMORY DRAW')
                            : 'IDLE'}
                          size="small"
                          sx={{
                            height: 20,
                            borderRadius: 999,
                            bgcolor: referenceStudyActive ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.06)',
                            color: referenceStudyActive ? '#bfdbfe' : 'rgba(226,232,240,0.68)',
                            '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.35 },
                          }}
                        />
                      </Stack>

                      <Stack spacing={0.75}>
                        <Paper
                          data-testid="frame-editor-reference-study-summary"
                          sx={{
                            p: 0.75,
                            borderRadius: 1.35,
                            bgcolor: 'rgba(255,255,255,0.028)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <Stack spacing={0.22}>
                            <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                              {referenceStudyActive
                                ? (referenceStudyReferenceRecord?.name || 'Reference study')
                                : (activeReferenceRecord?.name || 'Choose a reference')}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.66)' }}>
                              {referenceStudyActive
                                ? (referenceStudyReveal
                                  ? `Compare overlay visible at ${Math.round(referenceStudyCompareOpacity * 100)}% opacity. ${referenceStudyStrokeDelta} new stroke${referenceStudyStrokeDelta === 1 ? '' : 's'} since start.`
                                  : referenceStudyGhostEnabled && selectedReferenceStudyAttempt
                                    ? `Reference hidden from canvas. Ghosting ${selectedReferenceStudyAttempt.name} at ${Math.round(referenceStudyGhostOpacity * 100)}% opacity. ${referenceStudyStrokeDelta} new stroke${referenceStudyStrokeDelta === 1 ? '' : 's'} in the current round.`
                                    : `Reference hidden from canvas. ${referenceStudyStrokeDelta} new stroke${referenceStudyStrokeDelta === 1 ? '' : 's'} since start.`)
                                : activeReferenceRecord
                                  ? 'Lock the selected reference, hide it, redraw from memory, then reveal to compare.'
                                  : 'Select a reference from the deck to start a study session.'}
                            </Typography>
                          </Stack>
                        </Paper>

                        {referenceStudyActive && (
                          <Paper
                            data-testid="frame-editor-reference-study-compare-card"
                            sx={{
                              p: 0.7,
                              borderRadius: 1.35,
                              bgcolor: 'rgba(255,255,255,0.028)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack spacing={0.45}>
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                  Compare Opacity
                                </Typography>
                                <Typography
                                  data-testid="frame-editor-reference-study-opacity-value"
                                  variant="caption"
                                  sx={{ color: '#bfdbfe', fontWeight: 700 }}
                                >
                                  {Math.round(referenceStudyCompareOpacity * 100)}%
                                </Typography>
                              </Stack>
                              <Slider
                                data-testid="frame-editor-reference-study-opacity"
                                value={Math.round(referenceStudyCompareOpacity * 100)}
                                min={15}
                                max={100}
                                step={5}
                                onChange={(_, value) => setReferenceStudyCompareOpacity((Array.isArray(value) ? value[0] : value) / 100)}
                                sx={{
                                  color: '#60a5fa',
                                  '& .MuiSlider-thumb': { width: 14, height: 14 },
                                }}
                              />
                            </Stack>
                          </Paper>
                        )}

                        {referenceStudyAttempts.length > 0 && (
                          <Paper
                            data-testid="frame-editor-reference-study-ghost-card"
                            sx={{
                              p: 0.7,
                              borderRadius: 1.35,
                              bgcolor: 'rgba(255,255,255,0.028)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack spacing={0.55}>
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                  Ghost Previous Attempt
                                </Typography>
                                <Chip
                                  data-testid="frame-editor-reference-study-attempt-count"
                                  label={`${referenceStudyAttempts.length} saved`}
                                  size="small"
                                  sx={{
                                    height: 18,
                                    borderRadius: 999,
                                    bgcolor: 'rgba(96,165,250,0.14)',
                                    color: '#bfdbfe',
                                    '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.35 },
                                  }}
                                />
                              </Stack>

                              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                                <Button
                                  size="small"
                                  data-testid="frame-editor-reference-study-ghost-toggle"
                                  onClick={() => setReferenceStudyGhostEnabled((prev) => !prev)}
                                  sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: referenceStudyGhostEnabled ? '#bfdbfe' : '#f8fafc' }}
                                >
                                  {referenceStudyGhostEnabled ? 'Ghost On' : 'Ghost Off'}
                                </Button>
                                {selectedReferenceStudyAttempt && (
                                  <Typography
                                    data-testid="frame-editor-reference-study-selected-attempt"
                                    variant="caption"
                                    sx={{ color: 'rgba(226,232,240,0.68)', alignSelf: 'center' }}
                                  >
                                    {selectedReferenceStudyAttempt.name} · {selectedReferenceStudyAttempt.pointCount} pts
                                  </Typography>
                                )}
                              </Stack>

                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.62)', fontWeight: 700 }}>
                                  Ghost Opacity
                                </Typography>
                                <Typography
                                  data-testid="frame-editor-reference-study-ghost-opacity-value"
                                  variant="caption"
                                  sx={{ color: '#93c5fd', fontWeight: 700 }}
                                >
                                  {Math.round(referenceStudyGhostOpacity * 100)}%
                                </Typography>
                              </Stack>
                              <Slider
                                data-testid="frame-editor-reference-study-ghost-opacity"
                                value={Math.round(referenceStudyGhostOpacity * 100)}
                                min={10}
                                max={70}
                                step={5}
                                onChange={(_, value) => setReferenceStudyGhostOpacity((Array.isArray(value) ? value[0] : value) / 100)}
                                sx={{
                                  color: '#93c5fd',
                                  '& .MuiSlider-thumb': { width: 14, height: 14 },
                                }}
                              />

                              <Stack data-testid="frame-editor-reference-study-attempt-list" spacing={0.5}>
                                {referenceStudyAttempts.map((attempt, index) => {
                                  const attemptId = toTestIdFragment(attempt.name);
                                  const selectedAttempt = selectedReferenceStudyAttempt?.id === attempt.id;
                                  return (
                                    <Paper
                                      key={attempt.id}
                                      data-testid={`frame-editor-reference-study-attempt-card-${attemptId}`}
                                      sx={{
                                        p: 0.6,
                                        borderRadius: 1.2,
                                        bgcolor: selectedAttempt ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.025)',
                                        border: `1px solid ${selectedAttempt ? 'rgba(96,165,250,0.22)' : 'rgba(255,255,255,0.05)'}`,
                                      }}
                                    >
                                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                        <Stack spacing={0.15} sx={{ minWidth: 0 }}>
                                          <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                                            {attempt.name}
                                          </Typography>
                                          <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                                            {attempt.strokeCount} strokes · {attempt.pointCount} pts · Round {referenceStudyAttempts.length - index}
                                          </Typography>
                                        </Stack>
                                        <Button
                                          size="small"
                                          data-testid={`frame-editor-reference-study-attempt-select-${attemptId}`}
                                          onClick={() => handleSelectReferenceStudyAttempt(attempt.id)}
                                          sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: selectedAttempt ? '#bfdbfe' : '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                                        >
                                          {selectedAttempt ? 'Selected' : 'Use Ghost'}
                                        </Button>
                                      </Stack>
                                    </Paper>
                                  );
                                })}
                              </Stack>
                            </Stack>
                          </Paper>
                        )}

                        {referenceStudyActive && (
                          <Paper
                            data-testid="frame-editor-reference-study-scorecard"
                            sx={{
                              p: 0.7,
                              borderRadius: 1.35,
                              bgcolor: 'rgba(255,255,255,0.028)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack spacing={0.55}>
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                  Study Scorecard
                                </Typography>
                                <Typography
                                  data-testid="frame-editor-reference-study-scorecard-baseline"
                                  variant="caption"
                                  sx={{ color: '#bfdbfe', fontWeight: 700 }}
                                >
                                  {selectedReferenceStudyAttempt ? `vs ${selectedReferenceStudyAttempt.name}` : 'No baseline yet'}
                                </Typography>
                              </Stack>

                              <Typography
                                data-testid="frame-editor-reference-study-scorecard-summary"
                                variant="caption"
                                sx={{ color: 'rgba(226,232,240,0.7)' }}
                              >
                                {referenceStudyScorecardSummary}
                              </Typography>

                              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                {([
                                  ['composition', 'Composition'],
                                  ['placement', 'Placement'],
                                  ['economy', 'Economy'],
                                ] as const).map(([mode, label]) => {
                                  const selected = referenceStudyFocusMode === mode;
                                  return (
                                    <Button
                                      key={mode}
                                      size="small"
                                      data-testid={`frame-editor-reference-study-focus-${mode}`}
                                      onClick={() => setReferenceStudyFocusMode(mode)}
                                      sx={{
                                        minHeight: tabletTouchSecondaryButtonHeight,
                                        borderRadius: 999,
                                        px: 0.95,
                                        color: selected ? '#111827' : '#f8fafc',
                                        bgcolor: selected ? '#bfdbfe' : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${selected ? 'rgba(191,219,254,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                      }}
                                    >
                                      {label}
                                    </Button>
                                  );
                                })}
                              </Stack>

                              {selectedReferenceStudyAttempt && currentReferenceStudyAttemptMetrics.pointCount > 0 && (
                                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                  <Chip
                                    data-testid="frame-editor-reference-study-scorecard-width"
                                    label={`Width ${formatReferenceStudyMetricDelta(currentReferenceStudyAttemptMetrics.widthRatio - selectedReferenceStudyAttempt.metrics.widthRatio)}`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      borderRadius: 999,
                                      bgcolor: 'rgba(245,158,11,0.12)',
                                      color: '#fde68a',
                                      '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                    }}
                                  />
                                  <Chip
                                    data-testid="frame-editor-reference-study-scorecard-height"
                                    label={`Height ${formatReferenceStudyMetricDelta(currentReferenceStudyAttemptMetrics.heightRatio - selectedReferenceStudyAttempt.metrics.heightRatio)}`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      borderRadius: 999,
                                      bgcolor: 'rgba(59,130,246,0.14)',
                                      color: '#bfdbfe',
                                      '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                    }}
                                  />
                                  <Chip
                                    data-testid="frame-editor-reference-study-scorecard-position"
                                    label={`Y ${formatReferenceStudyMetricDelta(currentReferenceStudyAttemptMetrics.centerYRatio - selectedReferenceStudyAttempt.metrics.centerYRatio)}`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      borderRadius: 999,
                                      bgcolor: 'rgba(148,163,184,0.12)',
                                      color: '#cbd5e1',
                                      '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                    }}
                                  />
                                  <Chip
                                    data-testid="frame-editor-reference-study-scorecard-passes"
                                    label={`Passes ${currentReferenceStudyAttemptMetrics.strokeCount - selectedReferenceStudyAttempt.metrics.strokeCount >= 0 ? '+' : ''}${currentReferenceStudyAttemptMetrics.strokeCount - selectedReferenceStudyAttempt.metrics.strokeCount}`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      borderRadius: 999,
                                      bgcolor: 'rgba(255,255,255,0.06)',
                                      color: '#f8fafc',
                                      '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                    }}
                                  />
                                </Stack>
                              )}
                            </Stack>
                          </Paper>
                        )}

                        {referenceStudyActive && (
                          <Paper
                            data-testid="frame-editor-reference-study-read-check"
                            sx={{
                              p: 0.7,
                              borderRadius: 1.35,
                              bgcolor: 'rgba(255,255,255,0.028)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack spacing={0.55}>
                              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                Read Check
                              </Typography>
                              <Typography
                                data-testid="frame-editor-reference-study-read-summary"
                                variant="caption"
                                sx={{ color: 'rgba(226,232,240,0.7)' }}
                              >
                                {referenceStudyReadCheckSummary}
                              </Typography>
                              {currentReferenceStudyAttemptMetrics.pointCount > 0 && (
                                <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                  <Chip
                                    data-testid="frame-editor-reference-study-read-silhouette"
                                    label={`Silhouette ${referenceStudySilhouetteRead}`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      borderRadius: 999,
                                      bgcolor: 'rgba(245,158,11,0.12)',
                                      color: '#fde68a',
                                      '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                    }}
                                  />
                                  <Chip
                                    data-testid="frame-editor-reference-study-read-focus"
                                    label={`Focus ${referenceStudyFocusRead}`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      borderRadius: 999,
                                      bgcolor: 'rgba(59,130,246,0.14)',
                                      color: '#bfdbfe',
                                      '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                    }}
                                  />
                                  <Chip
                                    data-testid="frame-editor-reference-study-read-balance"
                                    label={`Balance ${referenceStudyBalanceRead}`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      borderRadius: 999,
                                      bgcolor: 'rgba(148,163,184,0.12)',
                                      color: '#cbd5e1',
                                      '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                    }}
                                  />
                                </Stack>
                              )}
                            </Stack>
                          </Paper>
                        )}

                        {referenceStudyAttempts.length > 0 && (
                          <Paper
                            data-testid="frame-editor-reference-study-read-history"
                            sx={{
                              p: 0.7,
                              borderRadius: 1.35,
                              bgcolor: 'rgba(255,255,255,0.028)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack spacing={0.55}>
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                  Read History
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                                  {suggestedReferenceStudyAttempt && (
                                    <Chip
                                      data-testid="frame-editor-reference-study-read-history-suggested"
                                      label={`${formatReferenceStudyFocusModeLabel(referenceStudyFocusMode)} · ${suggestedReferenceStudyAttempt.name}`}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        borderRadius: 999,
                                        bgcolor: 'rgba(96,165,250,0.14)',
                                        color: '#bfdbfe',
                                        '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                      }}
                                    />
                                  )}
                                  <Chip
                                    data-testid="frame-editor-reference-study-read-history-count"
                                    label={`${referenceStudyAttempts.length} rounds`}
                                    size="small"
                                    sx={{
                                      height: 20,
                                      borderRadius: 999,
                                      bgcolor: 'rgba(255,255,255,0.06)',
                                      color: '#f8fafc',
                                      '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                    }}
                                  />
                                </Stack>
                              </Stack>

                              {suggestedReferenceStudyAttempt && (
                                <Button
                                  size="small"
                                  data-testid="frame-editor-reference-study-read-history-use-suggested"
                                  onClick={() => handleSelectReferenceStudyAttempt(suggestedReferenceStudyAttempt.id)}
                                  sx={{
                                    alignSelf: 'flex-start',
                                    minHeight: tabletTouchSecondaryButtonHeight,
                                    borderRadius: 999,
                                    px: 1,
                                    color: selectedReferenceStudyAttempt?.id === suggestedReferenceStudyAttempt.id ? '#111827' : '#bfdbfe',
                                    bgcolor: selectedReferenceStudyAttempt?.id === suggestedReferenceStudyAttempt.id ? '#bfdbfe' : 'rgba(59,130,246,0.12)',
                                    border: `1px solid ${selectedReferenceStudyAttempt?.id === suggestedReferenceStudyAttempt.id ? 'rgba(191,219,254,0.45)' : 'rgba(96,165,250,0.18)'}`,
                                  }}
                                >
                                  {selectedReferenceStudyAttempt?.id === suggestedReferenceStudyAttempt.id ? 'Suggested Active' : 'Use Suggested Baseline'}
                                </Button>
                              )}

                              {referenceStudySessionLead && (
                                <Paper
                                  data-testid="frame-editor-reference-study-session-card"
                                  sx={{
                                    p: 0.6,
                                    borderRadius: 1.2,
                                    bgcolor: 'rgba(255,255,255,0.025)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                  }}
                                >
                                  <Stack spacing={0.45}>
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                      <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                        Best of Session
                                      </Typography>
                                      <Chip
                                        data-testid="frame-editor-reference-study-session-lead"
                                        label={`Lead · ${referenceStudySessionLead.attempt.name}`}
                                        size="small"
                                        sx={{
                                          height: 20,
                                          borderRadius: 999,
                                          bgcolor: 'rgba(167,139,250,0.14)',
                                          color: '#ddd6fe',
                                          '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                        }}
                                      />
                                    </Stack>
                                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                      <Chip
                                        data-testid="frame-editor-reference-study-session-spread"
                                        label={`${referenceStudySessionLead.winCount} of ${referenceStudySessionLead.totalModes} lanes`}
                                        size="small"
                                        sx={{
                                          height: 20,
                                          borderRadius: 999,
                                          bgcolor: 'rgba(255,255,255,0.06)',
                                          color: '#f8fafc',
                                          '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                        }}
                                      />
                                      {referenceStudySessionLead.leadModes.map((mode) => (
                                        <Chip
                                          key={`session-lead-${mode}`}
                                          data-testid={`frame-editor-reference-study-session-mode-${mode}`}
                                          label={formatReferenceStudyFocusModeLabel(mode)}
                                          size="small"
                                          sx={{
                                            height: 20,
                                            borderRadius: 999,
                                            bgcolor: 'rgba(96,165,250,0.14)',
                                            color: '#bfdbfe',
                                            '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                          }}
                                        />
                                      ))}
                                    </Stack>
                                    <Typography
                                      data-testid="frame-editor-reference-study-session-summary"
                                      variant="caption"
                                      sx={{ color: 'rgba(226,232,240,0.66)' }}
                                    >
                                      {referenceStudySessionLead.summary}
                                    </Typography>
                                    <Button
                                      size="small"
                                      data-testid="frame-editor-reference-study-session-use-lead"
                                      onClick={() => handleSelectReferenceStudyAttempt(referenceStudySessionLead.attempt.id)}
                                      sx={{
                                        alignSelf: 'flex-start',
                                        minHeight: tabletTouchSecondaryButtonHeight,
                                        borderRadius: 999,
                                        px: 1,
                                        color: selectedReferenceStudyAttempt?.id === referenceStudySessionLead.attempt.id ? '#111827' : '#ddd6fe',
                                        bgcolor: selectedReferenceStudyAttempt?.id === referenceStudySessionLead.attempt.id ? '#ddd6fe' : 'rgba(167,139,250,0.12)',
                                        border: `1px solid ${selectedReferenceStudyAttempt?.id === referenceStudySessionLead.attempt.id ? 'rgba(221,214,254,0.45)' : 'rgba(167,139,250,0.18)'}`,
                                      }}
                                    >
                                      {selectedReferenceStudyAttempt?.id === referenceStudySessionLead.attempt.id ? 'Lead Active' : 'Use Session Lead'}
                                    </Button>
                                  </Stack>
                                </Paper>
                              )}

                              {referenceStudyRankedAttemptsByFocus.some((entry) => entry.attempts.length > 0) && (
                                <Paper
                                  data-testid="frame-editor-reference-study-ladders"
                                  sx={{
                                    p: 0.6,
                                    borderRadius: 1.2,
                                    bgcolor: 'rgba(255,255,255,0.025)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                  }}
                                >
                                  <Stack spacing={0.5}>
                                    <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                      Study Ladders
                                    </Typography>
                                    {referenceStudyRankedAttemptsByFocus.map(({ mode, attempts }) => (
                                      <Stack
                                        key={`study-ladder-${mode}`}
                                        data-testid={`frame-editor-reference-study-ladder-${mode}`}
                                        spacing={0.3}
                                      >
                                        <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.66)', fontWeight: 700 }}>
                                          {formatReferenceStudyFocusModeLabel(mode)}
                                        </Typography>
                                        <Chip
                                          data-testid={`frame-editor-reference-study-ladder-gap-${mode}`}
                                          label={buildReferenceStudyLaneGapLabel(mode, attempts)}
                                          size="small"
                                          sx={{
                                            alignSelf: 'flex-start',
                                            height: 18,
                                            borderRadius: 999,
                                            bgcolor: 'rgba(255,255,255,0.06)',
                                            color: 'rgba(226,232,240,0.78)',
                                            '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.25 },
                                          }}
                                        />
                                        <Chip
                                          data-testid={`frame-editor-reference-study-ladder-confidence-${mode}`}
                                          label={buildReferenceStudyLaneConfidenceLabel(mode, attempts)}
                                          size="small"
                                          sx={{
                                            alignSelf: 'flex-start',
                                            height: 18,
                                            borderRadius: 999,
                                            bgcolor: 'rgba(96,165,250,0.1)',
                                            color: '#bfdbfe',
                                            '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.25 },
                                          }}
                                        />
                                        <Typography
                                          data-testid={`frame-editor-reference-study-ladder-next-move-${mode}`}
                                          variant="caption"
                                          sx={{ color: 'rgba(191,219,254,0.72)' }}
                                        >
                                          {buildReferenceStudyLaneNextMoveLabel(mode, attempts)}
                                        </Typography>
                                        <Typography
                                          data-testid={`frame-editor-reference-study-ladder-summary-${mode}`}
                                          variant="caption"
                                          sx={{ color: 'rgba(226,232,240,0.58)' }}
                                        >
                                          {buildReferenceStudyLaneSummary(mode, attempts)}
                                        </Typography>
                                        <Stack direction="row" spacing={0.45} flexWrap="wrap" useFlexGap>
                                          {attempts.map((attempt, index) => {
                                            const selectedFocus = referenceStudyFocusMode === mode;
                                            const activeAttempt = selectedReferenceStudyAttempt?.id === attempt.id;
                                            return (
                                              <Button
                                                key={`${mode}-${attempt.id}`}
                                                size="small"
                                                data-testid={`frame-editor-reference-study-ladder-${mode}-${toTestIdFragment(attempt.name)}`}
                                                onClick={() => {
                                                  setReferenceStudyFocusMode(mode);
                                                  handleSelectReferenceStudyAttempt(attempt.id);
                                                }}
                                                sx={{
                                                  minHeight: tabletTouchSecondaryButtonHeight,
                                                  borderRadius: 999,
                                                  px: 0.95,
                                                  color: selectedFocus && activeAttempt ? '#111827' : '#f8fafc',
                                                  bgcolor: selectedFocus && activeAttempt ? '#bfdbfe' : 'rgba(255,255,255,0.05)',
                                                  border: `1px solid ${selectedFocus && activeAttempt ? 'rgba(191,219,254,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                                }}
                                              >
                                                #{index + 1} {attempt.name}
                                              </Button>
                                            );
                                          })}
                                        </Stack>
                                      </Stack>
                                    ))}
                                  </Stack>
                                </Paper>
                              )}

                              {referenceStudyBestAttemptsByFocus.some((entry) => entry.attempt) && (
                                <Paper
                                  data-testid="frame-editor-reference-study-picks"
                                  sx={{
                                    p: 0.6,
                                    borderRadius: 1.2,
                                    bgcolor: 'rgba(255,255,255,0.025)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                  }}
                                >
                                  <Stack spacing={0.45}>
                                    <Stack spacing={0.2}>
                                      <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                        Study Picks
                                      </Typography>
                                      {referenceStudySuggestedPickSummary && (
                                        <Typography
                                          data-testid="frame-editor-reference-study-picks-summary"
                                          variant="caption"
                                          sx={{ color: 'rgba(226,232,240,0.66)' }}
                                        >
                                          {referenceStudySuggestedPickSummary}
                                        </Typography>
                                      )}
                                    </Stack>
                                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                      {REFERENCE_STUDY_FOCUS_MODES.map((mode) => {
                                        const selected = referenceStudyFocusMode === mode;
                                        return (
                                          <Button
                                            key={`study-picks-focus-${mode}`}
                                            size="small"
                                            data-testid={`frame-editor-reference-study-picks-focus-${mode}`}
                                            onClick={() => setReferenceStudyFocusMode(mode)}
                                            sx={{
                                              minHeight: tabletTouchSecondaryButtonHeight,
                                              borderRadius: 999,
                                              px: 0.95,
                                              color: selected ? '#111827' : '#f8fafc',
                                              bgcolor: selected ? '#bfdbfe' : 'rgba(255,255,255,0.05)',
                                              border: `1px solid ${selected ? 'rgba(191,219,254,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                            }}
                                          >
                                            {formatReferenceStudyFocusModeLabel(mode)}
                                          </Button>
                                        );
                                      })}
                                    </Stack>
                                    <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                                      {referenceStudyBestAttemptsByFocus.map(({ mode, attempt }) => {
                                        if (!attempt) {
                                          return null;
                                        }
                                        const active = selectedReferenceStudyAttempt?.id === attempt.id;
                                        return (
                                          <Stack
                                            key={`${mode}-${attempt.id}`}
                                            spacing={0.25}
                                            sx={{ minWidth: 0, flex: '0 1 auto' }}
                                          >
                                            <Button
                                              size="small"
                                              data-testid={`frame-editor-reference-study-pick-${mode}`}
                                              onClick={() => handleSelectReferenceStudyAttempt(attempt.id)}
                                              sx={{
                                                minHeight: tabletTouchSecondaryButtonHeight,
                                                borderRadius: 999,
                                                px: 0.95,
                                                color: active ? '#111827' : '#f8fafc',
                                                bgcolor: active ? '#bfdbfe' : 'rgba(255,255,255,0.05)',
                                                border: `1px solid ${active ? 'rgba(191,219,254,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                              }}
                                            >
                                              {formatReferenceStudyFocusModeLabel(mode)} · {attempt.name}
                                            </Button>
                                            <Typography
                                              data-testid={`frame-editor-reference-study-pick-reason-${mode}`}
                                              variant="caption"
                                              sx={{ color: 'rgba(226,232,240,0.62)', px: 0.35 }}
                                            >
                                              {buildReferenceStudyPickReason(attempt.metrics, mode)}
                                            </Typography>
                                          </Stack>
                                        );
                                      })}
                                    </Stack>
                                  </Stack>
                                </Paper>
                              )}

                              <Stack spacing={0.5}>
                                {referenceStudyAttempts.map((attempt) => {
                                  const attemptId = toTestIdFragment(attempt.name);
                                  const selectedAttempt = selectedReferenceStudyAttempt?.id === attempt.id;
                                  const suggestedAttempt = suggestedReferenceStudyAttempt?.id === attempt.id;
                                  const bestModes = referenceStudyBestModesByAttemptId.get(attempt.id) ?? [];
                                  const focusRanks = referenceStudyFocusRanksByAttemptId.get(attempt.id);
                                  const compareSummary = selectedReferenceStudyAttempt && !selectedAttempt
                                    ? buildReferenceStudyAttemptDeltaSummary(
                                        attempt.metrics,
                                        selectedReferenceStudyAttempt.metrics,
                                        selectedReferenceStudyAttempt.name,
                                      )
                                    : null;
                                  return (
                                    <Paper
                                      key={`read-history-${attempt.id}`}
                                      data-testid={`frame-editor-reference-study-read-history-${attemptId}`}
                                      sx={{
                                        p: 0.6,
                                        borderRadius: 1.2,
                                        bgcolor: selectedAttempt ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.025)',
                                        border: `1px solid ${selectedAttempt ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)'}`,
                                      }}
                                    >
                                      <Stack spacing={0.45}>
                                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                          <Stack direction="row" spacing={0.65} alignItems="center" flexWrap="wrap" useFlexGap sx={{ minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                                              {attempt.name}
                                            </Typography>
                                            <Button
                                              size="small"
                                              data-testid={`frame-editor-reference-study-read-history-select-${attemptId}`}
                                              onClick={() => handleSelectReferenceStudyAttempt(attempt.id)}
                                              sx={{
                                                minHeight: 20,
                                                borderRadius: 999,
                                                px: 0.85,
                                                color: selectedAttempt ? '#111827' : '#f8fafc',
                                                bgcolor: selectedAttempt ? '#bfdbfe' : 'rgba(255,255,255,0.05)',
                                                border: `1px solid ${selectedAttempt ? 'rgba(191,219,254,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                              }}
                                            >
                                              {selectedAttempt ? 'Baseline' : 'Use as Baseline'}
                                            </Button>
                                            <Button
                                              size="small"
                                              data-testid={`frame-editor-reference-study-promote-${attemptId}`}
                                              onClick={() => handlePromoteReferenceStudyAttemptToVariant(attempt.id)}
                                              disabled={referenceStudyBaselineStrokeCount === null}
                                              sx={{
                                                minHeight: 20,
                                                borderRadius: 999,
                                                px: 0.85,
                                                color: '#fde68a',
                                                bgcolor: 'rgba(245,158,11,0.12)',
                                                border: '1px solid rgba(245,158,11,0.2)',
                                              }}
                                            >
                                              Make Variant
                                            </Button>
                                          </Stack>
                                          <Stack direction="row" spacing={0.45} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                                            {suggestedAttempt && (
                                              <Chip
                                                data-testid={`frame-editor-reference-study-read-history-suggested-${attemptId}`}
                                                label="Suggested"
                                                size="small"
                                                sx={{
                                                  height: 18,
                                                  borderRadius: 999,
                                                  bgcolor: 'rgba(96,165,250,0.14)',
                                                  color: '#bfdbfe',
                                                  '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.25 },
                                                }}
                                              />
                                            )}
                                            {attempt.drillId && attempt.drillStatus && (
                                              <Chip
                                                data-testid={`frame-editor-reference-study-read-history-drill-${attemptId}`}
                                                label={`${getReferenceStudyDrillLabel(attempt.drillId)} · ${attempt.drillStatus === 'met' ? 'Met' : 'Retry'}`}
                                                size="small"
                                                sx={{
                                                  height: 18,
                                                  borderRadius: 999,
                                                  bgcolor: attempt.drillStatus === 'met' ? 'rgba(34,197,94,0.14)' : 'rgba(245,158,11,0.12)',
                                                  color: attempt.drillStatus === 'met' ? '#86efac' : '#fde68a',
                                                  '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.25 },
                                                }}
                                              />
                                            )}
                                            {selectedAttempt && (
                                              <Chip
                                                data-testid={`frame-editor-reference-study-read-history-selected-${attemptId}`}
                                                label="Baseline"
                                                size="small"
                                                sx={{
                                                  height: 18,
                                                  borderRadius: 999,
                                                  bgcolor: 'rgba(96,165,250,0.14)',
                                                  color: '#bfdbfe',
                                                  '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.25 },
                                                }}
                                              />
                                            )}
                                            {bestModes.map((mode) => (
                                              <Chip
                                                key={`${attempt.id}-${mode}`}
                                                data-testid={`frame-editor-reference-study-read-history-best-${mode}-${attemptId}`}
                                                label={`Best ${formatReferenceStudyFocusModeLabel(mode)}`}
                                                size="small"
                                                sx={{
                                                  height: 18,
                                                  borderRadius: 999,
                                                  bgcolor: 'rgba(167,139,250,0.12)',
                                                  color: '#ddd6fe',
                                                  '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.25 },
                                                }}
                                              />
                                            ))}
                                          </Stack>
                                        </Stack>
                                        <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                                          <Chip
                                            data-testid={`frame-editor-reference-study-read-history-silhouette-${attemptId}`}
                                            label={`Silhouette ${attempt.silhouetteRead}`}
                                            size="small"
                                            sx={{
                                              height: 20,
                                              borderRadius: 999,
                                              bgcolor: 'rgba(245,158,11,0.12)',
                                              color: '#fde68a',
                                              '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                            }}
                                          />
                                          <Chip
                                            data-testid={`frame-editor-reference-study-read-history-focus-${attemptId}`}
                                            label={`Focus ${attempt.focusRead}`}
                                            size="small"
                                            sx={{
                                              height: 20,
                                              borderRadius: 999,
                                              bgcolor: 'rgba(59,130,246,0.14)',
                                              color: '#bfdbfe',
                                              '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                            }}
                                          />
                                          <Chip
                                            data-testid={`frame-editor-reference-study-read-history-balance-${attemptId}`}
                                            label={`Balance ${attempt.balanceRead}`}
                                            size="small"
                                            sx={{
                                              height: 20,
                                              borderRadius: 999,
                                              bgcolor: 'rgba(148,163,184,0.12)',
                                              color: '#cbd5e1',
                                              '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                            }}
                                          />
                                        </Stack>
                                        {focusRanks && (
                                          <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap>
                                            {REFERENCE_STUDY_FOCUS_MODES.map((mode) => (
                                              <Chip
                                                key={`${attempt.id}-rank-${mode}`}
                                                data-testid={`frame-editor-reference-study-read-history-rank-${mode}-${attemptId}`}
                                                label={`${formatReferenceStudyFocusModeLabel(mode)} #${focusRanks[mode]}`}
                                                size="small"
                                                sx={{
                                                  height: 18,
                                                  borderRadius: 999,
                                                  bgcolor: referenceStudyFocusMode === mode ? 'rgba(96,165,250,0.14)' : 'rgba(255,255,255,0.05)',
                                                  color: referenceStudyFocusMode === mode ? '#bfdbfe' : '#cbd5e1',
                                                  '& .MuiChip-label': { px: 0.7, fontSize: '0.54rem', fontWeight: 700, letterSpacing: 0.25 },
                                                }}
                                              />
                                            ))}
                                          </Stack>
                                        )}
                                        {compareSummary && (
                                          <Typography
                                            data-testid={`frame-editor-reference-study-read-history-compare-${attemptId}`}
                                            variant="caption"
                                            sx={{ color: 'rgba(226,232,240,0.66)' }}
                                          >
                                            {compareSummary}
                                          </Typography>
                                        )}
                                      </Stack>
                                    </Paper>
                                  );
                                })}
                              </Stack>
                            </Stack>
                          </Paper>
                        )}

                        {referenceStudyActive && (
                          <Paper
                            data-testid="frame-editor-reference-study-drill-card"
                            sx={{
                              p: 0.7,
                              borderRadius: 1.35,
                              bgcolor: 'rgba(255,255,255,0.028)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack spacing={0.55}>
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                  Next Drill
                                </Typography>
                                <Chip
                                  data-testid="frame-editor-reference-study-drill-status"
                                  label={`Recommended · ${getReferenceStudyDrillLabel(referenceStudyRecommendedDrillId)}`}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    borderRadius: 999,
                                    bgcolor: 'rgba(96,165,250,0.14)',
                                    color: '#bfdbfe',
                                    '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                  }}
                                />
                              </Stack>

                              <Typography
                                data-testid="frame-editor-reference-study-drill-summary"
                                variant="caption"
                                sx={{ color: 'rgba(226,232,240,0.7)' }}
                              >
                                {referenceStudyDrillSummary}
                              </Typography>

                              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                {([
                                  'focus-up',
                                  'focus-right',
                                  'widen',
                                  'reduce-passes',
                                  'balance-center',
                                ] as const).map((drillId) => {
                                  const selected = referenceStudyActiveDrillId === drillId;
                                  return (
                                    <Button
                                      key={drillId}
                                      size="small"
                                      data-testid={`frame-editor-reference-study-drill-${drillId}`}
                                      onClick={() => setReferenceStudyArmedDrillId(drillId)}
                                      sx={{
                                        minHeight: tabletTouchSecondaryButtonHeight,
                                        borderRadius: 999,
                                        px: 0.95,
                                        color: selected ? '#111827' : '#f8fafc',
                                        bgcolor: selected ? '#fde68a' : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${selected ? 'rgba(253,230,138,0.5)' : 'rgba(255,255,255,0.06)'}`,
                                      }}
                                    >
                                      {getReferenceStudyDrillLabel(drillId)}
                                    </Button>
                                  );
                                })}
                              </Stack>
                            </Stack>
                          </Paper>
                        )}

                        {referenceStudyActive && (
                          <Paper
                            data-testid="frame-editor-reference-study-drill-trajectory"
                            sx={{
                              p: 0.7,
                              borderRadius: 1.35,
                              bgcolor: 'rgba(255,255,255,0.028)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack spacing={0.55}>
                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                  Drill Trajectory
                                </Typography>
                                <Chip
                                  data-testid="frame-editor-reference-study-drill-trajectory-progress"
                                  label={`${Math.round(referenceStudyDrillProgressValue * 100)}%`}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    borderRadius: 999,
                                    bgcolor: referenceStudyDrillProgressValue >= 1 ? 'rgba(34,197,94,0.14)' : 'rgba(96,165,250,0.14)',
                                    color: referenceStudyDrillProgressValue >= 1 ? '#86efac' : '#bfdbfe',
                                    '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                  }}
                                />
                              </Stack>

                              <Typography
                                data-testid="frame-editor-reference-study-drill-trajectory-summary"
                                variant="caption"
                                sx={{ color: 'rgba(226,232,240,0.7)' }}
                              >
                                {referenceStudyDrillTrajectorySummary}
                              </Typography>

                              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                <Chip
                                  data-testid="frame-editor-reference-study-drill-trajectory-direction"
                                  label={referenceStudyDrillDirectionLabel}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    borderRadius: 999,
                                    bgcolor: 'rgba(148,163,184,0.12)',
                                    color: '#cbd5e1',
                                    '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                  }}
                                />
                                <Chip
                                  data-testid="frame-editor-reference-study-drill-trajectory-target"
                                  label={getReferenceStudyDrillLabel(referenceStudyActiveDrillId)}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    borderRadius: 999,
                                    bgcolor: 'rgba(245,158,11,0.12)',
                                    color: '#fde68a',
                                    '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                  }}
                                />
                              </Stack>

                              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
                                <Chip
                                  data-testid="frame-editor-reference-study-drill-checkpoint-current"
                                  label={referenceStudyDrillCheckpoints.current}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    borderRadius: 999,
                                    bgcolor: 'rgba(59,130,246,0.14)',
                                    color: '#bfdbfe',
                                    '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                  }}
                                />
                                <Chip
                                  data-testid="frame-editor-reference-study-drill-checkpoint-goal"
                                  label={referenceStudyDrillCheckpoints.goal}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    borderRadius: 999,
                                    bgcolor: 'rgba(245,158,11,0.12)',
                                    color: '#fde68a',
                                    '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                  }}
                                />
                                <Chip
                                  data-testid="frame-editor-reference-study-drill-checkpoint-remaining"
                                  label={referenceStudyDrillCheckpoints.remaining}
                                  size="small"
                                  sx={{
                                    height: 20,
                                    borderRadius: 999,
                                    bgcolor: 'rgba(148,163,184,0.12)',
                                    color: '#cbd5e1',
                                    '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.25 },
                                  }}
                                />
                              </Stack>
                            </Stack>
                          </Paper>
                        )}

                        {referenceStudyActive && (
                          <Paper
                            data-testid="frame-editor-reference-study-drill-playbook"
                            sx={{
                              p: 0.7,
                              borderRadius: 1.35,
                              bgcolor: 'rgba(255,255,255,0.028)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack spacing={0.55}>
                              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.45 }}>
                                Next Stroke Cues
                              </Typography>
                              <Typography
                                data-testid="frame-editor-reference-study-drill-playbook-headline"
                                variant="caption"
                                sx={{ color: 'rgba(226,232,240,0.7)' }}
                              >
                                {referenceStudyDrillPlaybook.headline}
                              </Typography>
                              <Stack spacing={0.45}>
                                <Paper
                                  data-testid="frame-editor-reference-study-drill-playbook-primary"
                                  sx={{
                                    p: 0.55,
                                    borderRadius: 1.1,
                                    bgcolor: 'rgba(96,165,250,0.08)',
                                    border: '1px solid rgba(96,165,250,0.12)',
                                  }}
                                >
                                  <Typography variant="caption" sx={{ color: '#bfdbfe', fontWeight: 700 }}>
                                    DO · {referenceStudyDrillPlaybook.primary}
                                  </Typography>
                                </Paper>
                                <Paper
                                  data-testid="frame-editor-reference-study-drill-playbook-secondary"
                                  sx={{
                                    p: 0.55,
                                    borderRadius: 1.1,
                                    bgcolor: 'rgba(245,158,11,0.08)',
                                    border: '1px solid rgba(245,158,11,0.12)',
                                  }}
                                >
                                  <Typography variant="caption" sx={{ color: '#fde68a', fontWeight: 700 }}>
                                    HOLD · {referenceStudyDrillPlaybook.secondary}
                                  </Typography>
                                </Paper>
                                <Paper
                                  data-testid="frame-editor-reference-study-drill-playbook-watch"
                                  sx={{
                                    p: 0.55,
                                    borderRadius: 1.1,
                                    bgcolor: 'rgba(148,163,184,0.08)',
                                    border: '1px solid rgba(148,163,184,0.12)',
                                  }}
                                >
                                  <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 700 }}>
                                    WATCH · {referenceStudyDrillPlaybook.watch}
                                  </Typography>
                                </Paper>
                              </Stack>
                            </Stack>
                          </Paper>
                        )}

                        <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                          <Button
                            size="small"
                            data-testid="frame-editor-reference-study-start"
                            onClick={handleStartReferenceStudy}
                            disabled={!activeReferenceRecord}
                            startIcon={<AutoAwesome fontSize="small" />}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(59,130,246,0.14)', color: '#bfdbfe' }}
                          >
                            {referenceStudyActive ? 'Restart Study' : 'Start Memory Draw'}
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-reference-study-reveal"
                            onClick={handleRevealReferenceStudy}
                            disabled={!referenceStudyActive}
                            startIcon={<Visibility fontSize="small" />}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                          >
                            {referenceStudyReveal ? 'Hide Compare' : 'Reveal Compare'}
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-reference-study-save-attempt"
                            onClick={handleSaveReferenceStudyAttempt}
                            disabled={!referenceStudyActive || referenceStudyAttemptStrokes.length === 0}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(96,165,250,0.12)', color: '#bfdbfe' }}
                          >
                            Save Attempt
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-reference-study-next-round"
                            onClick={handleStartNextReferenceStudyRound}
                            disabled={!referenceStudyActive}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(245,158,11,0.12)', color: '#fde68a' }}
                          >
                            Next Round
                          </Button>
                          <Button
                            size="small"
                            data-testid="frame-editor-reference-study-reset"
                            onClick={handleResetReferenceStudy}
                            disabled={!referenceStudyActive}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: 'rgba(226,232,240,0.72)' }}
                          >
                            Reset Session
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                    <Paper
                      data-testid="frame-editor-reference-deck-card"
                      sx={{
                        p: 1.05,
                        borderRadius: 1.9,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.9 }}>
                        <Typography
                          variant="caption"
                          sx={{ color: 'rgba(248,250,252,0.6)', fontSize: '0.68rem', lineHeight: 1, letterSpacing: 1.55, fontWeight: 700 }}
                        >
                          REFERENCE DECK
                        </Typography>
                        <Chip
                          label={`${drawingDocument.references.length} refs`}
                          size="small"
                          sx={{
                            height: 20,
                            borderRadius: 999,
                            bgcolor: 'rgba(245,158,11,0.14)',
                            color: '#fde68a',
                            '& .MuiChip-label': { px: 0.75, fontSize: '0.56rem', fontWeight: 700, letterSpacing: 0.35 },
                          }}
                        />
                      </Stack>

                      <Stack
                        data-testid="frame-editor-reference-actions"
                        direction="row"
                        spacing={0.7}
                        flexWrap={isTabletWorkspace ? 'nowrap' : 'wrap'}
                        useFlexGap={!isTabletWorkspace}
                        sx={{
                          mb: 1,
                          overflowX: isTabletWorkspace ? 'auto' : 'visible',
                          flexWrap: isTabletWorkspace ? 'nowrap' : 'wrap',
                          whiteSpace: isTabletWorkspace ? 'nowrap' : 'normal',
                          pb: isTabletWorkspace ? 0.2 : 0,
                        }}
                      >
                        <Button
                          size="small"
                          data-testid="frame-editor-reference-add"
                          onClick={handleAddReference}
                          startIcon={<Add fontSize="small" />}
                          sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                        >
                          Add Ref
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-reference-upload"
                          onClick={() => referenceUploadInputRef.current?.click()}
                          startIcon={<ImageIcon fontSize="small" />}
                          sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                        >
                          Upload Ref
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-base-image-upload"
                          onClick={() => baseImageUploadInputRef.current?.click()}
                          startIcon={<CameraAlt fontSize="small" />}
                          sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(245,158,11,0.12)', color: '#fde68a' }}
                        >
                          Draw Over Image
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-reference-fit-mode"
                          onClick={() => handleCycleReferenceFitMode(activeReferenceRecord)}
                          disabled={!activeReferenceRecord}
                          startIcon={<AspectRatio fontSize="small" />}
                          sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                        >
                          {activeReferenceRecord?.fitMode || 'free'}
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-reference-rotate"
                          onClick={() => handleRotateReference(activeReferenceRecord)}
                          disabled={!activeReferenceRecord}
                          startIcon={<Reply fontSize="small" />}
                          sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.05)', color: '#f8fafc' }}
                        >
                          Rotate
                        </Button>
                        <Button
                          size="small"
                          data-testid="frame-editor-reference-remove"
                          onClick={() => activeReferenceRecord && handleRemoveReference(activeReferenceRecord.id)}
                          disabled={!activeReferenceRecord}
                          startIcon={<Delete fontSize="small" />}
                          sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, bgcolor: 'rgba(120,18,18,0.32)', color: '#fecaca' }}
                        >
                          Remove
                        </Button>
                      </Stack>
                      <input
                        ref={referenceUploadInputRef}
                        data-testid="frame-editor-reference-upload-input"
                        type="file"
                        accept="image/*"
                        onChange={handleReferenceFileUpload}
                        style={{ display: 'none' }}
                      />
                      <input
                        ref={baseImageUploadInputRef}
                        data-testid="frame-editor-base-image-upload-input"
                        type="file"
                        accept="image/*"
                        onChange={handleBaseImageFileUpload}
                        style={{ display: 'none' }}
                      />

                      <Paper
                        data-testid="frame-editor-base-image-status"
                        sx={{
                          p: 0.8,
                          mb: 1,
                          borderRadius: 1.45,
                          bgcolor: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.05)',
                        }}
                      >
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Stack spacing={0.18} sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                              {hasBaseImageOverride ? 'Custom canvas base loaded' : activeBaseImage ? 'Canvas base ready' : 'No canvas base'}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                              {hasBaseImageOverride
                                ? 'Uploaded image is active as draw-over background.'
                                : activeBaseImage
                                  ? 'Using existing storyboard frame as base.'
                                  : 'Upload an image to sketch directly on top of it.'}
                            </Typography>
                          </Stack>
                          <Button
                            size="small"
                            data-testid="frame-editor-base-image-reset"
                            onClick={handleResetBaseImage}
                            disabled={!hasBaseImageOverride}
                            sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                          >
                            Reset
                          </Button>
                        </Stack>
                      </Paper>

                      <Stack data-testid="frame-editor-reference-list" spacing={0.7}>
                        {drawingDocument.references.map((reference, index) => {
                          const referenceName = reference.name || `Reference ${index + 1}`;
                          const referenceId = toTestIdFragment(referenceName);
                          const selectedReference = activeReferenceRecord?.id === reference.id;
                          return (
                            <Paper
                              key={reference.id}
                              data-testid={`frame-editor-reference-card-${referenceId}`}
                              sx={{
                                p: isTabletWorkspace ? 0.95 : 0.8,
                                borderRadius: 1.5,
                                bgcolor: selectedReference ? 'rgba(37,99,235,0.18)' : 'rgba(255,255,255,0.025)',
                                border: `1px solid ${selectedReference ? 'rgba(96,165,250,0.24)' : 'rgba(255,255,255,0.05)'}`,
                              }}
                            >
                              <Stack direction="row" justifyContent="space-between" spacing={0.8}>
                                <Stack spacing={0.22} sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ color: '#f8fafc' }}>
                                    {referenceName}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                                    {reference.fitMode || 'free'} · {Math.round(reference.opacity * 100)}% · {Math.round(reference.rotation || 0)}°
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                                    {Math.round(reference.width)} × {Math.round(reference.height)}
                                  </Typography>
                                </Stack>
                                <Stack spacing={0.45} sx={{ flexShrink: 0 }}>
                                  <Button
                                    size="small"
                                    data-testid={`frame-editor-reference-select-${referenceId}`}
                                    onClick={() => handleSelectReference(reference.id)}
                                    sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.05)' }}
                                  >
                                    Focus
                                  </Button>
                                  <Button
                                    size="small"
                                    data-testid={`frame-editor-reference-toggle-${referenceId}`}
                                    onClick={() => handleToggleReferenceVisibility(reference.id)}
                                    sx={{ minHeight: tabletTouchSecondaryButtonHeight, borderRadius: 999, color: reference.visible ? '#fde68a' : 'rgba(248,250,252,0.72)', bgcolor: 'rgba(255,255,255,0.05)' }}
                                  >
                                    {reference.visible ? 'Visible' : 'Hidden'}
                                  </Button>
                                </Stack>
                              </Stack>
                            </Paper>
                          );
                        })}
                      </Stack>
                    </Paper>
                    <Paper
                      data-testid="frame-editor-board-polish-card"
                      sx={{
                        p: isTabletWorkspace ? 1.05 : 0.95,
                        mb: 1,
                        borderRadius: 1.8,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <Stack spacing={0.95}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Stack spacing={0.25}>
                            <Typography variant="subtitle2" sx={{ color: '#f8fafc' }}>
                              BOARD POLISH
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                              Switch between editing chrome and a cleaner presentation-grade board read.
                            </Typography>
                          </Stack>
                          <Chip
                            data-testid="frame-editor-board-polish-summary"
                            label={activeBoardPolishStatusLabel}
                            size="small"
                            sx={{
                              height: isTabletWorkspace ? 28 : 22,
                              borderRadius: 999,
                              bgcolor: boardPolishPresentationActive ? 'rgba(245,158,11,0.16)' : 'rgba(255,255,255,0.06)',
                              color: boardPolishPresentationActive ? '#fde68a' : 'rgba(248,250,252,0.82)',
                              '& .MuiChip-label': {
                                px: isTabletWorkspace ? 0.95 : 0.8,
                                fontSize: isTabletWorkspace ? '0.64rem' : '0.58rem',
                                fontWeight: 700,
                                letterSpacing: 0.45,
                              },
                            }}
                          />
                        </Stack>
                        <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                          <Button
                            size="small"
                            data-testid="frame-editor-board-polish-card-mode"
                            onClick={handleToggleBoardPolishMode}
                            sx={{
                              minHeight: tabletTouchSecondaryButtonHeight,
                              borderRadius: 999,
                              px: 1.05,
                              bgcolor: boardPolishPresentationActive ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.05)',
                              color: boardPolishPresentationActive ? '#fde68a' : '#f8fafc',
                            }}
                          >
                            {boardPolishPresentationActive ? 'Exit Present' : 'Enter Present'}
                          </Button>
                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={boardPolishTone}
                            data-testid="frame-editor-board-polish-card-tones"
                            onChange={(_, value: StoryboardDocumentBoardPolishTone | null) => {
                              if (!value) {
                                return;
                              }
                              handleSetBoardPolishTone(value);
                            }}
                            sx={{
                              '& .MuiToggleButton-root': {
                                minHeight: tabletTouchSecondaryButtonHeight,
                                px: 0.95,
                                color: 'rgba(255,255,255,0.78)',
                                borderColor: 'rgba(255,255,255,0.08)',
                                bgcolor: 'rgba(255,255,255,0.03)',
                                textTransform: 'none',
                              },
                              '& .Mui-selected': {
                                bgcolor: 'rgba(246,178,77,0.14) !important',
                                color: '#fde68a',
                              },
                            }}
                          >
                            {STUDIO_BOARD_POLISH_TONES.map((tone) => (
                              <ToggleButton
                                key={tone}
                                value={tone}
                                data-testid={`frame-editor-board-polish-card-tone-${tone}`}
                              >
                                {STUDIO_BOARD_POLISH_TONE_CONFIG[tone].label}
                              </ToggleButton>
                            ))}
                          </ToggleButtonGroup>
                        </Stack>
                        <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={boardPolishFinish}
                            data-testid="frame-editor-board-polish-card-finishes"
                            onChange={(_, value: StoryboardDocumentBoardPolishFinish | null) => {
                              if (!value) {
                                return;
                              }
                              handleSetBoardPolishFinish(value);
                            }}
                            sx={{
                              '& .MuiToggleButton-root': {
                                minHeight: tabletTouchSecondaryButtonHeight,
                                px: 0.95,
                                color: 'rgba(255,255,255,0.78)',
                                borderColor: 'rgba(255,255,255,0.08)',
                                bgcolor: 'rgba(255,255,255,0.03)',
                                textTransform: 'none',
                              },
                              '& .Mui-selected': {
                                bgcolor: 'rgba(34,197,94,0.15) !important',
                                color: '#bbf7d0',
                              },
                            }}
                          >
                            {STUDIO_BOARD_POLISH_FINISHES.map((finish) => (
                              <ToggleButton
                                key={finish}
                                value={finish}
                                data-testid={`frame-editor-board-polish-card-finish-${finish}`}
                              >
                                {STUDIO_BOARD_POLISH_FINISH_CONFIG[finish].label}
                              </ToggleButton>
                            ))}
                          </ToggleButtonGroup>
                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={boardPolishWeather}
                            data-testid="frame-editor-board-polish-card-weather"
                            onChange={(_, value: StoryboardDocumentBoardPolishWeather | null) => {
                              if (!value) {
                                return;
                              }
                              handleSetBoardPolishWeather(value);
                            }}
                            sx={{
                              '& .MuiToggleButton-root': {
                                minHeight: tabletTouchSecondaryButtonHeight,
                                px: 0.95,
                                color: 'rgba(255,255,255,0.78)',
                                borderColor: 'rgba(255,255,255,0.08)',
                                bgcolor: 'rgba(255,255,255,0.03)',
                                textTransform: 'none',
                              },
                              '& .Mui-selected': {
                                bgcolor: 'rgba(56,189,248,0.14) !important',
                                color: '#bae6fd',
                              },
                            }}
                          >
                            {STUDIO_BOARD_POLISH_WEATHER_OPTIONS.map((weather) => (
                              <ToggleButton
                                key={weather}
                                value={weather}
                                data-testid={`frame-editor-board-polish-card-weather-${weather}`}
                              >
                                {STUDIO_BOARD_POLISH_WEATHER_CONFIG[weather].label}
                              </ToggleButton>
                            ))}
                          </ToggleButtonGroup>
                        </Stack>
                        <Typography
                          variant="caption"
                          data-testid="frame-editor-board-polish-style-summary"
                          sx={{ color: 'rgba(226,232,240,0.62)' }}
                        >
                          {boardPolishStyleSummary}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.5)' }}>
                          {`${boardPolishFinishConfig.summary} ${boardPolishWeatherConfig.summary}`}
                        </Typography>
                        <Paper
                          data-testid="frame-editor-board-polish-fx-stack"
                          sx={{
                            p: 0.75,
                            borderRadius: 1.2,
                            bgcolor: 'rgba(255,255,255,0.024)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <Stack spacing={0.55}>
                            <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.55 }}>
                              TONE / FX STACK
                            </Typography>
                            {boardPolishArmedEffectLayers.map((layer) => {
                              const effectLayerState = boardPolishEffectLayerStateMap[layer.id];
                              const effectLayerRecord = activeSheetLayerStack.find((entry) => entry.type === 'effect' && entry.effectId === layer.id);
                              return (
                              <Stack
                                key={layer.id}
                                data-testid={`frame-editor-board-polish-fx-stack-${layer.id}`}
                                data-enabled={effectLayerState.enabled ? 'true' : 'false'}
                                data-opacity={effectLayerState.opacity.toFixed(3)}
                                sx={{
                                  px: 0.75,
                                  py: 0.55,
                                  borderRadius: 1,
                                  bgcolor: effectLayerState.enabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.018)',
                                  border: '1px solid rgba(255,255,255,0.05)',
                                }}
                              >
                                <Stack spacing={0.55}>
                                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                                    <Stack spacing={0.18} sx={{ minWidth: 0 }}>
                                      <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700, opacity: effectLayerState.enabled ? 1 : 0.72 }}>
                                        {layer.label}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.55)' }}>
                                        {layer.summary}
                                      </Typography>
                                    </Stack>
                                    <Stack direction="row" alignItems="center" spacing={0.8}>
                                      {effectLayerRecord && (
                                        <Button
                                          size="small"
                                          data-testid={`frame-editor-board-polish-fx-edit-${layer.id}`}
                                          onClick={() => {
                                            setInspectorMode('layers');
                                            setSelectedStudioLayerId(effectLayerRecord.id);
                                          }}
                                          sx={{
                                            minHeight: 20,
                                            borderRadius: 999,
                                            px: 0.8,
                                            bgcolor: 'rgba(125,211,252,0.12)',
                                            color: '#e0f2fe',
                                            textTransform: 'none',
                                          }}
                                        >
                                          Mask
                                        </Button>
                                      )}
                                      <Chip
                                        size="small"
                                        label={`${Math.round(effectLayerState.opacity * 100)}%`}
                                        sx={{
                                          height: 20,
                                          borderRadius: 999,
                                          bgcolor: effectLayerState.enabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                                          color: effectLayerState.enabled ? 'rgba(248,250,252,0.8)' : 'rgba(226,232,240,0.5)',
                                          '& .MuiChip-label': {
                                            px: 0.7,
                                            fontSize: '0.56rem',
                                            fontWeight: 700,
                                            letterSpacing: 0.35,
                                          },
                                        }}
                                      />
                                      <Chip
                                        size="small"
                                        label={layer.mixBlendMode}
                                        sx={{
                                          height: 20,
                                          borderRadius: 999,
                                          bgcolor: 'rgba(255,255,255,0.06)',
                                          color: 'rgba(248,250,252,0.8)',
                                          '& .MuiChip-label': {
                                            px: 0.7,
                                            fontSize: '0.56rem',
                                            fontWeight: 700,
                                            letterSpacing: 0.35,
                                          },
                                        }}
                                      />
                                      <Switch
                                        data-testid={`frame-editor-board-polish-fx-toggle-${layer.id}`}
                                        size="small"
                                        checked={effectLayerState.enabled}
                                        onChange={() => handleToggleBoardPolishEffectLayer(layer.id)}
                                        inputProps={{ 'aria-label': `${layer.label} effect toggle` }}
                                        sx={{
                                          '& .MuiSwitch-switchBase.Mui-checked': {
                                            color: '#f8fafc',
                                          },
                                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                            bgcolor: 'rgba(134,239,172,0.45)',
                                          },
                                          '& .MuiSwitch-track': {
                                            bgcolor: 'rgba(255,255,255,0.18)',
                                          },
                                        }}
                                      />
                                    </Stack>
                                  </Stack>
                                  <Slider
                                    data-testid={`frame-editor-board-polish-fx-opacity-${layer.id}`}
                                    value={effectLayerState.opacity}
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    disabled={!effectLayerState.enabled}
                                    onChange={(_, value) => handleSetBoardPolishEffectLayerOpacity(layer.id, Array.isArray(value) ? value[0] : value)}
                                    sx={{
                                      color: effectLayerState.enabled ? '#f8fafc' : 'rgba(226,232,240,0.3)',
                                      '& .MuiSlider-thumb': {
                                        width: 12,
                                        height: 12,
                                      },
                                    }}
                                  />
                                </Stack>
                              </Stack>
                              );
                            })}
                          </Stack>
                        </Paper>
                        <Stack spacing={0.35}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.66)', fontWeight: 600, letterSpacing: 0.25 }}>
                              Atmosphere
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                              {Math.round(boardPolishAtmosphere * 100)}%
                            </Typography>
                          </Stack>
                          <Slider
                            data-testid="frame-editor-board-polish-atmosphere"
                            value={boardPolishAtmosphere}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={(_, value) => handleSetBoardPolishAtmosphere(Array.isArray(value) ? value[0] : value)}
                            sx={{
                              color: '#86efac',
                              '& .MuiSlider-thumb': {
                                width: 14,
                                height: 14,
                                boxShadow: '0 0 0 4px rgba(134,239,172,0.16)',
                              },
                            }}
                          />
                        </Stack>
                        <Stack spacing={0.35}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.66)', fontWeight: 600, letterSpacing: 0.25 }}>
                              Line Boost
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                              {Math.round(boardPolishLineBoost * 100)}%
                            </Typography>
                          </Stack>
                          <Slider
                            data-testid="frame-editor-board-polish-line-boost"
                            value={boardPolishLineBoost}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={(_, value) => handleSetBoardPolishLineBoost(Array.isArray(value) ? value[0] : value)}
                            sx={{
                              color: '#f6b24d',
                              '& .MuiSlider-thumb': {
                                width: 14,
                                height: 14,
                                boxShadow: '0 0 0 4px rgba(245,158,11,0.16)',
                              },
                            }}
                          />
                        </Stack>
                        <Stack spacing={0.35}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.66)', fontWeight: 600, letterSpacing: 0.25 }}>
                              Vignette
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                              {Math.round(boardPolishVignette * 100)}%
                            </Typography>
                          </Stack>
                          <Slider
                            data-testid="frame-editor-board-polish-vignette"
                            value={boardPolishVignette}
                            min={0}
                            max={1}
                            step={0.01}
                            onChange={(_, value) => handleSetBoardPolishVignette(Array.isArray(value) ? value[0] : value)}
                            sx={{
                              color: '#7dd3fc',
                              '& .MuiSlider-thumb': {
                                width: 14,
                                height: 14,
                                boxShadow: '0 0 0 4px rgba(125,211,252,0.15)',
                              },
                            }}
                          />
                        </Stack>
                        <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.56)' }}>
                          {boardPolishPresentationActive
                            ? 'Present mode hides safe-area rails, scaffold overlays, and reference chrome so the board reads more like a final panel.'
                            : 'Edit mode keeps production overlays visible while arming the present look for export reviews.'}
                        </Typography>
                        <Paper
                          data-testid="frame-editor-board-polish-scene-kits"
                          sx={{
                            p: 0.7,
                            borderRadius: 1.35,
                            bgcolor: 'rgba(255,255,255,0.028)',
                            border: '1px solid rgba(255,255,255,0.05)',
                          }}
                        >
                          <Stack spacing={0.65}>
                            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                              <Typography variant="caption" sx={{ color: 'rgba(248,250,252,0.72)', fontWeight: 700, letterSpacing: 0.55 }}>
                                CINEMATIC SCENE KITS
                              </Typography>
                              <Chip
                                data-testid="frame-editor-board-polish-scene-kit-summary"
                                label={selectedCinematicSceneKit ? `${selectedCinematicSceneKit.title} armed` : 'No scene kit armed'}
                                size="small"
                                sx={{
                                  height: isTabletWorkspace ? 28 : 20,
                                  borderRadius: 999,
                                  bgcolor: selectedCinematicSceneKit ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.05)',
                                  color: selectedCinematicSceneKit ? '#bfdbfe' : 'rgba(226,232,240,0.68)',
                                  '& .MuiChip-label': {
                                    px: isTabletWorkspace ? 0.85 : 0.7,
                                    fontSize: isTabletWorkspace ? '0.62rem' : '0.56rem',
                                    fontWeight: 700,
                                    letterSpacing: 0.35,
                                  },
                                }}
                              />
                            </Stack>
                            <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.58)' }}>
                              Stage harder silhouettes, volumetric beams, haze, wet reflections, and foreground blocks with one applied scene build.
                            </Typography>
                            <Stack spacing={0.55}>
                              {cinematicSceneKits.map((kit) => {
                                const selected = selectedCinematicSceneKitId === kit.id;
                                return (
                                  <Button
                                    key={kit.id}
                                    size="small"
                                    data-testid={`frame-editor-board-polish-scene-kit-${kit.id}`}
                                    onClick={() => handleApplyCinematicSceneKit(kit.id)}
                                    sx={{
                                      minHeight: tabletTouchSecondaryButtonHeight,
                                      justifyContent: 'space-between',
                                      textTransform: 'none',
                                      borderRadius: 1.2,
                                      px: 1,
                                      py: 0.75,
                                      bgcolor: selected ? 'rgba(59,130,246,0.16)' : 'rgba(255,255,255,0.045)',
                                      color: '#f8fafc',
                                      border: `1px solid ${selected ? 'rgba(96,165,250,0.24)' : 'rgba(255,255,255,0.06)'}`,
                                    }}
                                  >
                                    <Stack spacing={0.18} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                      <Typography variant="body2" sx={{ color: '#f8fafc', fontWeight: 700 }}>
                                        {kit.title}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.6)', textAlign: 'left' }}>
                                        {kit.description}
                                      </Typography>
                                    </Stack>
                                  </Button>
                                );
                              })}
                            </Stack>
                            {selectedCinematicSceneKit ? (
                              <Stack
                                spacing={0.55}
                                data-testid="frame-editor-board-polish-scene-kit-detail"
                                sx={{
                                  p: 0.7,
                                  borderRadius: 1.1,
                                  bgcolor: 'rgba(96,165,250,0.08)',
                                  border: '1px solid rgba(96,165,250,0.14)',
                                }}
                              >
                                <Stack
                                  direction="row"
                                  spacing={0.55}
                                  flexWrap="wrap"
                                  useFlexGap
                                  data-testid="frame-editor-board-polish-scene-kit-tags"
                                >
                                  {selectedCinematicSceneKit.tags.map((tag) => (
                                    <Chip
                                      key={tag}
                                      data-testid={`frame-editor-board-polish-scene-kit-tag-${toTestIdFragment(tag)}`}
                                      label={tag}
                                      size="small"
                                      sx={{
                                        height: isTabletWorkspace ? 28 : 20,
                                        borderRadius: 999,
                                        bgcolor: 'rgba(15,23,42,0.72)',
                                        color: '#bfdbfe',
                                        border: '1px solid rgba(147,197,253,0.16)',
                                        '& .MuiChip-label': {
                                          px: isTabletWorkspace ? 0.85 : 0.7,
                                          fontSize: isTabletWorkspace ? '0.62rem' : '0.56rem',
                                          fontWeight: 700,
                                          letterSpacing: 0.35,
                                        },
                                      }}
                                    />
                                  ))}
                                </Stack>
                                <Typography
                                  variant="caption"
                                  data-testid="frame-editor-board-polish-scene-kit-hero"
                                  sx={{ color: '#dbeafe', lineHeight: 1.45 }}
                                >
                                  {selectedCinematicSceneKit.heroRead}
                                </Typography>
                              </Stack>
                            ) : null}
                          </Stack>
                        </Paper>
                      </Stack>
                    </Paper>
                    <Stack data-testid="frame-editor-shot-notes-stack" spacing={0.8}>
                      {studioShotNotes.map((item) => {
                        const noteId = toTestIdFragment(item.label);
                        return (
                          <Paper
                            key={item.label}
                            data-testid={`frame-editor-shot-note-${noteId}`}
                            sx={{
                              p: isTabletWorkspace ? 1.1 : 1,
                              borderRadius: 1.8,
                              bgcolor: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                              <Stack direction="row" spacing={0.8} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                <Box
                                  sx={{
                                    width: 10,
                                    height: 10,
                                    borderRadius: '50%',
                                    bgcolor: item.accent,
                                    boxShadow: `0 0 12px ${alpha(item.accent, 0.4)}`,
                                    mt: 0.4,
                                    flexShrink: 0,
                                  }}
                                />
                                <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                                  <Typography variant="subtitle2" sx={{ color: '#f8fafc' }}>
                                    {item.label}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'rgba(226,232,240,0.66)' }}>
                                    {item.note}
                                  </Typography>
                                </Stack>
                              </Stack>
                              <Chip
                                label={item.tag}
                                size="small"
                                sx={{
                                  height: isTabletWorkspace ? 28 : 20,
                                  borderRadius: 999,
                                  bgcolor: alpha(item.accent, 0.12),
                                  color: item.accent,
                                  '& .MuiChip-label': {
                                    px: isTabletWorkspace ? 0.9 : 0.7,
                                    fontSize: isTabletWorkspace ? '0.62rem' : '0.56rem',
                                    fontWeight: 700,
                                    letterSpacing: 0.45,
                                  },
                                }}
                              />
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Stack>
                )}
              </Box>
            </Paper>
          </Box>
        </Box>
      ) : (
        <CanvasWrapper data-testid="frame-editor-canvas-shell">
          {canvasElement}
        </CanvasWrapper>
      )}

      {/* Status Bar */}
      <StatusBar data-testid="frame-editor-statusbar">
        <Stack
          data-testid="frame-editor-status-metrics"
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{
            flexWrap: isTabletWorkspace ? 'nowrap' : 'wrap',
            flex: '1 1 320px',
            minWidth: 0,
            px: 0.7,
            py: 0.45,
            borderRadius: 999,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            overflowX: isTabletWorkspace ? 'auto' : 'visible',
            overflowY: 'hidden',
          }}
        >
          <Chip
            label={workflowLevel === 'idea' ? 'Thumbnail flow' : workflowLevel}
            size="small"
            data-testid="frame-editor-workflow-chip"
            sx={{
              bgcolor: enableStudioChrome ? 'rgba(246,178,77,0.12)' : 'rgba(56,189,248,0.16)',
              color: enableStudioChrome ? '#fde68a' : '#7dd3fc',
            }}
          />
            <Chip
            data-testid="frame-editor-status-dimensions"
            label={`${exportCanvasWidth} × ${exportCanvasHeight}px`}
            size="small"
            sx={{
              height: 24,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.05)',
              color: '#f8fafc',
              '& .MuiChip-label': { px: 0.95, fontSize: '0.69rem', fontWeight: 600, letterSpacing: 0.2 },
            }}
          />
          <Chip
            data-testid="frame-editor-status-aspect"
            label={aspectRatio}
            size="small"
            sx={{
              height: 24,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.04)',
              color: 'rgba(255,255,255,0.72)',
              '& .MuiChip-label': { px: 0.85, fontSize: '0.69rem', fontWeight: 600, letterSpacing: 0.2 },
            }}
          />
          <Chip
            data-testid="frame-editor-status-strokes"
            label={`Strokes: ${strokes.length}`}
            size="small"
            sx={{
              height: 24,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.05)',
              color: '#f8fafc',
              '& .MuiChip-label': { px: 0.95, fontSize: '0.69rem', fontWeight: 600, letterSpacing: 0.2 },
            }}
          />
          {(boardPolishPresentationActive || boardPolishDocumentSnapshot) && (
            <Chip
              data-testid="frame-editor-status-board-polish"
              label={activeBoardPolishStatusLabel}
              size="small"
              sx={{
                height: 24,
                borderRadius: 999,
                bgcolor: boardPolishPresentationActive ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.05)',
                color: boardPolishPresentationActive ? '#fde68a' : 'rgba(248,250,252,0.82)',
                '& .MuiChip-label': { px: 0.95, fontSize: '0.69rem', fontWeight: 600, letterSpacing: 0.2 },
              }}
            />
          )}
          {shapeIntentAnalysis && (
            <Chip
              data-testid="frame-editor-status-shape-intent"
              label={shapeIntentVisible && selectedShapeIntentSuggestion
                ? `${shapeIntentAnalysis.displayLabel} → ${selectedShapeIntentSuggestion.title}`
                : `${shapeIntentAnalysis.displayLabel} detected`}
              size="small"
              sx={{
                height: 24,
                borderRadius: 999,
                bgcolor: 'rgba(246,178,77,0.12)',
                color: '#fde68a',
                '& .MuiChip-label': { px: 0.95, fontSize: '0.69rem', fontWeight: 600, letterSpacing: 0.2 },
              }}
            />
          )}
          {selectedShapeScaffold && (
            <Chip
              data-testid="frame-editor-status-shape-scaffold"
              label={`scaffold → ${selectedShapeScaffold.name}`}
              size="small"
              sx={{
                height: 24,
                borderRadius: 999,
                bgcolor: 'rgba(16,185,129,0.14)',
                color: '#a7f3d0',
                '& .MuiChip-label': { px: 0.95, fontSize: '0.69rem', fontWeight: 600, letterSpacing: 0.2 },
              }}
            />
          )}
          {referenceStudyActive && (
            <Chip
              data-testid="frame-editor-status-reference-study"
              label={referenceStudyReveal
                ? `compare → ${referenceStudyReferenceRecord?.name || 'reference'}`
                : referenceStudyGhostEnabled && selectedReferenceStudyAttempt
                  ? `ghost → ${selectedReferenceStudyAttempt.name}`
                  : `memory draw → ${referenceStudyReferenceRecord?.name || 'reference'}`}
              size="small"
              sx={{
                height: 24,
                borderRadius: 999,
                bgcolor: 'rgba(59,130,246,0.14)',
                color: '#bfdbfe',
                '& .MuiChip-label': { px: 0.95, fontSize: '0.69rem', fontWeight: 600, letterSpacing: 0.2 },
              }}
            />
          )}
          {referenceStudyActive && (
            <Chip
              data-testid="frame-editor-status-reference-study-drill"
              label={`${referenceStudyArmedDrillId ? 'drill' : 'next drill'} → ${getReferenceStudyDrillLabel(referenceStudyActiveDrillId)}`}
              size="small"
              sx={{
                height: 24,
                borderRadius: 999,
                bgcolor: referenceStudyArmedDrillId ? 'rgba(245,158,11,0.14)' : 'rgba(148,163,184,0.12)',
                color: referenceStudyArmedDrillId ? '#fde68a' : '#cbd5e1',
                '& .MuiChip-label': { px: 0.95, fontSize: '0.69rem', fontWeight: 600, letterSpacing: 0.2 },
              }}
            />
          )}
          {hasUnsavedChanges && (
            <Chip 
              label="Unsaved" 
              size="small" 
              sx={{ bgcolor: 'rgba(245,158,11,0.2)', color: '#f59e0b', height: 22, borderRadius: 999 }}
            />
          )}
        </Stack>

        <Stack
          data-testid="frame-editor-status-actions"
          direction="row"
          spacing={1}
          sx={{
            flexWrap: isTabletWorkspace ? 'nowrap' : 'wrap',
            justifyContent: { xs: 'flex-start', md: 'flex-end' },
            alignItems: 'center',
            flex: '1 1 280px',
            px: 0.7,
            py: 0.45,
            borderRadius: 999,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            overflowX: isTabletWorkspace ? 'auto' : 'visible',
            overflowY: 'hidden',
          }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={handleCancel}
            sx={{
              minHeight: isTabletWorkspace ? 34 : 28,
              px: 1.3,
              borderRadius: 999,
              color: 'rgba(255,255,255,0.87)',
              borderColor: 'rgba(255,255,255,0.12)',
              bgcolor: 'rgba(255,255,255,0.02)',
            }}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Save />}
            disabled={!hasUnsavedChanges}
            data-testid="frame-editor-save"
            sx={{
              minHeight: isTabletWorkspace ? 34 : 28,
              px: 1.35,
              borderRadius: 999,
              color: hasUnsavedChanges ? '#f8fafc' : 'rgba(248,250,252,0.32)',
              borderColor: hasUnsavedChanges ? 'rgba(245,158,11,0.24)' : 'rgba(255,255,255,0.08)',
              bgcolor: hasUnsavedChanges ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.02)',
            }}
            onClick={handleSaveFromToolbar}
          >
            Save to Frame
          </Button>
        </Stack>
      </StatusBar>

      <input
        ref={shapeScaffoldLibraryImportRef}
        data-testid="frame-editor-shape-scaffold-library-import-input"
        type="file"
        accept="application/json"
        style={{ display: 'none' }}
        onChange={handleImportShapeScaffoldLibrary}
      />

      <Dialog
        open={Boolean(shapeScaffoldLibraryRenameEntryId)}
        onClose={handleCloseShapeScaffoldLibraryRename}
        PaperProps={{
          sx: { bgcolor: '#1a1a2e', backgroundImage: 'none', minWidth: 360 },
        }}
      >
        <DialogTitle sx={{ color: '#fff' }}>Rename Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="Preset name"
            value={shapeScaffoldLibraryRenameValue}
            onChange={(event) => setShapeScaffoldLibraryRenameValue(event.target.value)}
            sx={{
              mt: 0.5,
              '& .MuiInputBase-root': { color: '#f8fafc' },
              '& .MuiInputLabel-root': { color: 'rgba(226,232,240,0.62)' },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseShapeScaffoldLibraryRename} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Cancel
          </Button>
          <Button onClick={handleSaveShapeScaffoldLibraryRename} variant="contained" sx={{ bgcolor: '#2563eb' }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Discard Changes Dialog */}
      <Dialog
        open={showDiscardDialog}
        onClose={() => setShowDiscardDialog(false)}
        PaperProps={{
          sx: { bgcolor: '#1a1a2e', backgroundImage: 'none' },
        }}
      >
        <DialogTitle sx={{ color: '#fff' }}>Discard Changes?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.87)' }}>
            You have unsaved changes. Are you sure you want to discard them?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDiscardDialog(false)} sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Keep Editing
          </Button>
          <Button onClick={handleDiscardChanges} color="error">
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </EditorContainer>
  );

  // Render based on mode
  if (mode === 'dialog') {
    return (
      <Dialog
        open
        onClose={handleCancel}
        fullScreen={isFullscreen}
        maxWidth={false}
        fullWidth={false}
        PaperProps={{
          sx: {
            bgcolor: 'transparent',
            backgroundImage: 'none',
            boxShadow: 'none',
            overflow: 'visible',
            m: isFullscreen ? 0 : { xs: 0.5, sm: 1.5, md: 2 },
            width: 'fit-content',
            maxWidth: '100vw',
          },
        }}
      >
        {editorContent}
      </Dialog>
    );
  }

  return editorContent;
};

// =============================================================================
// Quick Drawing Button Component
// =============================================================================

export interface QuickDrawButtonProps {
  frameId: string;
  storyboardId: string;
  aspectRatio?: '16:9' | '4:3' | '2.39:1' | '2.35:1' | '1.85:1' | '2.76:1' | '1:1' | '9:16';
  existingImage?: string;
  onDrawingComplete?: (drawingData: FrameDrawingData, imageDataUrl: string) => void;
}

export const QuickDrawButton: FC<QuickDrawButtonProps> = ({
  frameId,
  storyboardId,
  aspectRatio = '16:9',
  existingImage,
  onDrawingComplete,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const device = useDeviceDetection();

  return (
    <>
      <Tooltip title={device.hasPencilSupport ? 'Draw with Apple Pencil' : 'Draw Frame'}>
        <IconButton
          onClick={() => setIsOpen(true)}
          sx={{
            bgcolor: 'rgba(139,92,246,0.1)',
            '&:hover': { bgcolor: 'rgba(139,92,246,0.2)' },
          }}
        >
          <Brush sx={{ color: '#8b5cf6' }} />
        </IconButton>
      </Tooltip>

      {isOpen && (
        <FrameDrawingEditor
          frameId={frameId}
          storyboardId={storyboardId}
          aspectRatio={aspectRatio}
          initialImage={existingImage}
          mode="dialog"
          onSave={(data, imageUrl) => {
            onDrawingComplete?.(data, imageUrl);
            setIsOpen(false);
          }}
          onCancel={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default FrameDrawingEditor;
