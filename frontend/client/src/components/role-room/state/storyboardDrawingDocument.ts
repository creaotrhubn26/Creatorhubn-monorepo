import type { PencilStroke } from '../hooks/useApplePencil';

// Cinema-bransjestandard + sosiale formater. 2.39:1 (moderne anamorphic),
// 1.85:1 (Academy Flat) og 2.76:1 (Ultra Panavision) er kritiske for
// storyboard-artister som jobber mot film/commercial.
export type StoryboardDocumentAspectRatio =
  | '16:9'
  | '4:3'
  | '2.39:1'
  | '2.35:1'
  | '1.85:1'
  | '2.76:1'
  | '1:1'
  | '9:16';
export type StoryboardDocumentLayerType = 'drawing' | 'group' | 'video' | 'audio' | 'transformation' | 'effect';
export type StoryboardDocumentBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';
export type StoryboardDocumentWorkflowLevel = 'idea' | 'blocking' | 'shot' | 'presentation';
export type StoryboardDocumentTransition = 'cut' | 'linear' | 'ease';
export type StoryboardDocumentProjectionMode = 'planar' | 'projection' | 'rearrange';
export type StoryboardDocumentCornerWarpCorner = 'nw' | 'ne' | 'se' | 'sw';

export interface StoryboardDocumentCornerWarpOffset {
  x: number;
  y: number;
}

export interface StoryboardDocumentCornerWarp {
  nw: StoryboardDocumentCornerWarpOffset;
  ne: StoryboardDocumentCornerWarpOffset;
  se: StoryboardDocumentCornerWarpOffset;
  sw: StoryboardDocumentCornerWarpOffset;
}

export interface StoryboardDocumentWarpBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StoryboardDocumentBrushSettings {
  type: string;
  size: number;
  color: string;
  opacity: number;
}

export type StoryboardDocumentBoardPolishMode = 'edit' | 'present';
export type StoryboardDocumentBoardPolishTone = 'neutral' | 'noir' | 'amber';
export type StoryboardDocumentBoardPolishFinish = 'clean' | 'hatch' | 'marker';
export type StoryboardDocumentBoardPolishWeather = 'none' | 'mist' | 'rain';
export type StoryboardDocumentBoardPolishEffectLayerId = 'atmosphere' | 'weather' | 'finish' | 'vignette';

export interface StoryboardDocumentBoardPolishEffectLayerState {
  id: StoryboardDocumentBoardPolishEffectLayerId;
  enabled: boolean;
  opacity: number;
}

export interface StoryboardDocumentBoardPolishEffectRegion {
  id: StoryboardDocumentBoardPolishEffectLayerId;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  feather: number;
}

export interface StoryboardDocumentBoardPolishState {
  mode: StoryboardDocumentBoardPolishMode;
  tone: StoryboardDocumentBoardPolishTone;
  finish: StoryboardDocumentBoardPolishFinish;
  weather: StoryboardDocumentBoardPolishWeather;
  atmosphere: number;
  lineBoost: number;
  vignette: number;
  effectLayers: StoryboardDocumentBoardPolishEffectLayerState[];
  effectRegions: StoryboardDocumentBoardPolishEffectRegion[];
  updatedAt: string;
}

const createIdentityStoryboardDocumentCornerWarp = (): StoryboardDocumentCornerWarp => ({
  nw: { x: 0, y: 0 },
  ne: { x: 0, y: 0 },
  se: { x: 0, y: 0 },
  sw: { x: 0, y: 0 },
});

const normalizeStoryboardDocumentCornerWarp = (value: unknown): StoryboardDocumentCornerWarp => {
  const fallback = createIdentityStoryboardDocumentCornerWarp();
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const normalizeOffset = (offsetValue: unknown, fallbackOffset: StoryboardDocumentCornerWarpOffset): StoryboardDocumentCornerWarpOffset => {
    const offsetRecord = offsetValue && typeof offsetValue === 'object' ? offsetValue as Record<string, unknown> : {};
    return {
      x: typeof offsetRecord.x === 'number' ? offsetRecord.x : fallbackOffset.x,
      y: typeof offsetRecord.y === 'number' ? offsetRecord.y : fallbackOffset.y,
    };
  };

  return {
    nw: normalizeOffset(record.nw, fallback.nw),
    ne: normalizeOffset(record.ne, fallback.ne),
    se: normalizeOffset(record.se, fallback.se),
    sw: normalizeOffset(record.sw, fallback.sw),
  };
};

const interpolateStoryboardDocumentCornerWarp = (
  previous: StoryboardDocumentCornerWarp,
  next: StoryboardDocumentCornerWarp,
  progress: number,
): StoryboardDocumentCornerWarp => ({
  nw: {
    x: previous.nw.x + ((next.nw.x - previous.nw.x) * progress),
    y: previous.nw.y + ((next.nw.y - previous.nw.y) * progress),
  },
  ne: {
    x: previous.ne.x + ((next.ne.x - previous.ne.x) * progress),
    y: previous.ne.y + ((next.ne.y - previous.ne.y) * progress),
  },
  se: {
    x: previous.se.x + ((next.se.x - previous.se.x) * progress),
    y: previous.se.y + ((next.se.y - previous.se.y) * progress),
  },
  sw: {
    x: previous.sw.x + ((next.sw.x - previous.sw.x) * progress),
    y: previous.sw.y + ((next.sw.y - previous.sw.y) * progress),
  },
});

export interface StoryboardDocumentStrokeRecord {
  id: string;
  stroke: PencilStroke;
  createdAt: string;
  updatedAt: string;
}

interface StoryboardDocumentLayerBase {
  id: string;
  type: StoryboardDocumentLayerType;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: StoryboardDocumentBlendMode;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDocumentDrawingLayer extends StoryboardDocumentLayerBase {
  type: 'drawing';
  strokeIds: string[];
}

export interface StoryboardDocumentGroupLayer extends StoryboardDocumentLayerBase {
  type: 'group';
  childLayerIds: string[];
}

export interface StoryboardDocumentVideoLayer extends StoryboardDocumentLayerBase {
  type: 'video';
  mediaAssetId?: string;
}

export interface StoryboardDocumentAudioLayer extends StoryboardDocumentLayerBase {
  type: 'audio';
  mediaAssetId?: string;
}

export interface StoryboardDocumentTransformationKeyframe {
  id: string;
  frame: number;
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  perspectiveX: number;
  perspectiveY: number;
  cornerWarp: StoryboardDocumentCornerWarp;
  easing: StoryboardDocumentTransition;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDocumentTransformationLayer extends StoryboardDocumentLayerBase {
  type: 'transformation';
  childLayerIds: string[];
  keyframes: StoryboardDocumentTransformationKeyframe[];
  pivotMode: 'global' | 'per-layer';
}

export interface StoryboardDocumentEffectLayer extends StoryboardDocumentLayerBase {
  type: 'effect';
  effectId: StoryboardDocumentBoardPolishEffectLayerId;
  effectScope: 'board-polish';
}

export interface StoryboardDocumentAppliedTransform {
  layerId: string;
  layerName: string;
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  perspectiveX: number;
  perspectiveY: number;
  cornerWarp: StoryboardDocumentCornerWarp;
  pivotX: number;
  pivotY: number;
  warpBounds?: StoryboardDocumentWarpBounds;
}

export type StoryboardDocumentLayer =
  | StoryboardDocumentDrawingLayer
  | StoryboardDocumentGroupLayer
  | StoryboardDocumentVideoLayer
  | StoryboardDocumentAudioLayer
  | StoryboardDocumentTransformationLayer
  | StoryboardDocumentEffectLayer;

export interface StoryboardDocumentSheet {
  id: string;
  name: string;
  index: number;
  exposure: number;
  durationMs: number;
  frameStart: number;
  layerIds: string[];
  activeLayerId?: string;
  linkedSourceSheetId?: string;
  markerIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDocumentTimelineMarker {
  id: string;
  frame: number;
  label: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDocumentReferenceImage {
  id: string;
  name?: string;
  src: string;
  opacity: number;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fitMode: 'free' | 'contain' | 'cover';
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDocumentBookmarkView {
  id: string;
  name: string;
  timingMs: number;
  transition: StoryboardDocumentTransition;
  visibleCanvasIds: string[];
  camera: {
    x: number;
    y: number;
    z: number;
    zoom: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDocumentSpatialCanvas {
  id: string;
  name: string;
  width: number;
  height: number;
  aspectRatio?: StoryboardDocumentAspectRatio;
  sheetIds: string[];
  bookmarkIds: string[];
  transform: {
    x: number;
    y: number;
    z: number;
    rotationX: number;
    rotationY: number;
    rotationZ: number;
    scale: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDocumentTimelineState {
  fps: number;
  defaultExposure: number;
  scrubFrame: number;
  onionSkinEnabled: boolean;
  onionSkinFramesBefore: number;
  onionSkinFramesAfter: number;
  selectedSheetIds: string[];
  selectedMarkerIds: string[];
}

export interface StoryboardDocumentProjectionState {
  mode: StoryboardDocumentProjectionMode;
  reinterpretExistingStrokes: boolean;
  arrangeAfterDrawing: boolean;
  sourceCanvasId?: string;
  targetCanvasId?: string;
  appliedCount: number;
  lastProjectedSheetId?: string;
  lastProjectedBookmarkId?: string;
  lastProjectedAt?: string;
}

export type StoryboardDocumentReferenceStudyFocusMode = 'composition' | 'placement' | 'economy';
export type StoryboardDocumentReferenceStudyDrillId = 'focus-up' | 'focus-right' | 'widen' | 'reduce-passes' | 'balance-center';
export type StoryboardDocumentShapeScaffoldPrimitive = 'ellipse' | 'rectangle' | 'line' | 'blob';
export type StoryboardDocumentShapeScaffoldApplyMode = 'rough' | 'construction' | 'clean';

export interface StoryboardDocumentReferenceStudyAttemptMetrics {
  strokeCount: number;
  pointCount: number;
  widthRatio: number;
  heightRatio: number;
  centerXRatio: number;
  centerYRatio: number;
  averageStrokeWidth: number;
  totalPathLength: number;
  focusXRatio: number;
  focusYRatio: number;
  horizontalBalance: number;
  verticalBalance: number;
  silhouetteDensity: number;
}

export interface StoryboardDocumentReferenceStudyAttemptRecord {
  id: string;
  name: string;
  createdAt: string;
  strokeCount: number;
  pointCount: number;
  strokeSignature: string;
  strokes: PencilStroke[];
  previewDataUrl: string;
  metrics: StoryboardDocumentReferenceStudyAttemptMetrics;
  focusRead: string;
  balanceRead: string;
  silhouetteRead: string;
  drillId?: StoryboardDocumentReferenceStudyDrillId;
  drillStatus?: 'met' | 'retry';
  drillBaselineName?: string;
}

export interface StoryboardDocumentReferenceStudyState {
  active: boolean;
  reveal: boolean;
  referenceId?: string;
  baselineStrokeCount: number | null;
  compareOpacity: number;
  focusMode: StoryboardDocumentReferenceStudyFocusMode;
  armedDrillId?: StoryboardDocumentReferenceStudyDrillId;
  attempts: StoryboardDocumentReferenceStudyAttemptRecord[];
  selectedAttemptId?: string;
  ghostEnabled: boolean;
  ghostOpacity: number;
  updatedAt?: string;
}

export interface StoryboardDocumentShapeScaffoldFrame {
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
  baseWidthRatio: number;
  baseHeightRatio: number;
}

export interface StoryboardDocumentShapeScaffold {
  id: string;
  name: string;
  primitive: StoryboardDocumentShapeScaffoldPrimitive;
  suggestionId: string;
  selections: Record<string, string[]>;
  applyMode: StoryboardDocumentShapeScaffoldApplyMode;
  frame: StoryboardDocumentShapeScaffoldFrame;
  visible: boolean;
  opacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDocumentShapeScaffoldAssembly {
  id: string;
  name: string;
  scaffoldIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDocumentShapeScaffoldLibraryEntry {
  id: string;
  name: string;
  primitive: StoryboardDocumentShapeScaffoldPrimitive;
  suggestionId: string;
  selections: Record<string, string[]>;
  applyMode: StoryboardDocumentShapeScaffoldApplyMode;
  frame: StoryboardDocumentShapeScaffoldFrame;
  opacity: number;
  pinned: boolean;
  defaultForPrimitive: boolean;
  tags: string[];
  usageCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoryboardDocumentTimelineFrame {
  timelineIndex: number;
  frameNumber: number;
  sheetId: string;
  sheetName: string;
  exposureIndex: number;
  exposureLength: number;
  linkedSourceSheetId?: string;
  markerIds: string[];
}

export interface StoryboardDocumentRenderableLayer {
  id: string;
  name: string;
  type: StoryboardDocumentLayerType;
  effectId?: StoryboardDocumentBoardPolishEffectLayerId;
  effectScope?: 'board-polish';
  depth: number;
  parentLayerId?: string;
  visible: boolean;
  effectiveVisible: boolean;
  locked: boolean;
  effectiveLocked: boolean;
  opacity: number;
  effectiveOpacity: number;
  blendMode: StoryboardDocumentBlendMode;
  strokes: PencilStroke[];
  appliedTransforms: StoryboardDocumentAppliedTransform[];
}

export type StoryboardDocumentLayerStackEntry = StoryboardDocumentRenderableLayer;

export interface StoryboardDrawingDocument {
  version: 1;
  id: string;
  frameId?: string;
  storyboardId?: string;
  aspectRatio?: StoryboardDocumentAspectRatio;
  createdAt: string;
  updatedAt: string;
  primarySheetId: string;
  primaryCanvasId: string;
  sheets: StoryboardDocumentSheet[];
  layers: StoryboardDocumentLayer[];
  strokes: StoryboardDocumentStrokeRecord[];
  markers: StoryboardDocumentTimelineMarker[];
  references: StoryboardDocumentReferenceImage[];
  bookmarks: StoryboardDocumentBookmarkView[];
  canvases: StoryboardDocumentSpatialCanvas[];
  timeline: StoryboardDocumentTimelineState;
  projection: StoryboardDocumentProjectionState;
  metadata: {
    workflowLevel?: StoryboardDocumentWorkflowLevel;
    baseImageUrl?: string;
    originalBaseImageUrl?: string;
    lastCompositeImageUrl?: string;
    brushSettings?: StoryboardDocumentBrushSettings;
    boardPolish?: StoryboardDocumentBoardPolishState;
    referenceStudy?: StoryboardDocumentReferenceStudyState;
    shapeScaffolds?: StoryboardDocumentShapeScaffold[];
    shapeScaffoldAssemblies?: StoryboardDocumentShapeScaffoldAssembly[];
    shapeScaffoldLibrary?: StoryboardDocumentShapeScaffoldLibraryEntry[];
  };
}

export interface StoryboardDrawingDocumentSeed {
  frameId?: string;
  storyboardId?: string;
  aspectRatio?: StoryboardDocumentAspectRatio;
  workflowLevel?: StoryboardDocumentWorkflowLevel;
  baseImageUrl?: string;
  originalBaseImageUrl?: string;
  imageDataUrl?: string;
  strokes?: PencilStroke[];
  brushSettings?: StoryboardDocumentBrushSettings;
  referenceImage?: {
    src: string;
    opacity: number;
    visible: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_FPS = 12;
const DEFAULT_EXPOSURE = 2;
const MIN_TIMELINE_VALUE = 1;
const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeBoardPolishState = (
  value: unknown,
  fallbackUpdatedAt: string,
): StoryboardDocumentBoardPolishState | undefined => {
  if (!isRecord(value)) return undefined;
  const defaultEffectLayers: StoryboardDocumentBoardPolishEffectLayerState[] = [
    { id: 'atmosphere', enabled: true, opacity: 1 },
    { id: 'weather', enabled: true, opacity: 1 },
    { id: 'finish', enabled: true, opacity: 1 },
    { id: 'vignette', enabled: true, opacity: 1 },
  ];
  const effectLayersValue = Array.isArray(value.effectLayers) ? value.effectLayers : [];
  const normalizedEffectLayers = defaultEffectLayers.map((fallbackLayer) => {
    const persistedLayer = effectLayersValue.find((entry) => (
      entry
      && typeof entry === 'object'
      && (entry as Record<string, unknown>).id === fallbackLayer.id
    )) as Record<string, unknown> | undefined;
    return {
      id: fallbackLayer.id,
      enabled: typeof persistedLayer?.enabled === 'boolean' ? persistedLayer.enabled : fallbackLayer.enabled,
      opacity:
        typeof persistedLayer?.opacity === 'number'
          ? Math.min(1, Math.max(0, persistedLayer.opacity))
          : fallbackLayer.opacity,
    };
  });
  const defaultEffectRegions: StoryboardDocumentBoardPolishEffectRegion[] = [
    { id: 'atmosphere', xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, feather: 0.34 },
    { id: 'weather', xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, feather: 0.24 },
    { id: 'finish', xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, feather: 0.12 },
    { id: 'vignette', xRatio: 0, yRatio: 0, widthRatio: 1, heightRatio: 1, feather: 0.08 },
  ];
  const effectRegionsValue = Array.isArray(value.effectRegions) ? value.effectRegions : [];
  const normalizedEffectRegions = defaultEffectRegions.map((fallbackRegion) => {
    const persistedRegion = effectRegionsValue.find((entry) => (
      entry
      && typeof entry === 'object'
      && (entry as Record<string, unknown>).id === fallbackRegion.id
    )) as Record<string, unknown> | undefined;
    const widthRatio = typeof persistedRegion?.widthRatio === 'number'
      ? Math.max(0.08, Math.min(1, persistedRegion.widthRatio))
      : fallbackRegion.widthRatio;
    const heightRatio = typeof persistedRegion?.heightRatio === 'number'
      ? Math.max(0.08, Math.min(1, persistedRegion.heightRatio))
      : fallbackRegion.heightRatio;
    const xRatio = typeof persistedRegion?.xRatio === 'number'
      ? Math.max(0, Math.min(1 - widthRatio, persistedRegion.xRatio))
      : fallbackRegion.xRatio;
    const yRatio = typeof persistedRegion?.yRatio === 'number'
      ? Math.max(0, Math.min(1 - heightRatio, persistedRegion.yRatio))
      : fallbackRegion.yRatio;
    return {
      id: fallbackRegion.id,
      xRatio,
      yRatio,
      widthRatio,
      heightRatio,
      feather:
        typeof persistedRegion?.feather === 'number'
          ? Math.min(0.48, Math.max(0, persistedRegion.feather))
          : fallbackRegion.feather,
    };
  });
  return {
    mode: value.mode === 'present' ? 'present' : 'edit',
    tone: value.tone === 'noir' || value.tone === 'amber' ? value.tone : 'neutral',
    finish: value.finish === 'hatch' || value.finish === 'marker' ? value.finish : 'clean',
    weather: value.weather === 'mist' || value.weather === 'rain' ? value.weather : 'none',
    atmosphere:
      typeof value.atmosphere === 'number'
        ? Math.min(1, Math.max(0, value.atmosphere))
        : 0.36,
    lineBoost:
      typeof value.lineBoost === 'number'
        ? Math.min(1, Math.max(0, value.lineBoost))
        : 0.42,
    vignette:
      typeof value.vignette === 'number'
        ? Math.min(1, Math.max(0, value.vignette))
        : 0.54,
    effectLayers: normalizedEffectLayers,
    effectRegions: normalizedEffectRegions,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallbackUpdatedAt,
  };
};

const STORYBOARD_BOARD_POLISH_EFFECT_LAYER_LABELS: Record<StoryboardDocumentBoardPolishEffectLayerId, string> = {
  atmosphere: 'FX Atmosphere',
  weather: 'FX Weather',
  finish: 'FX Finish',
  vignette: 'FX Vignette',
};

const getStoryboardDocumentBoardPolishEffectLayerId = (
  effectId: StoryboardDocumentBoardPolishEffectLayerId,
): string => `effect-board-polish-${effectId}`;

const createStoryboardDocumentBoardPolishEffectLayer = (
  effectState: StoryboardDocumentBoardPolishEffectLayerState,
  updatedAt: string,
  existingLayer?: StoryboardDocumentEffectLayer,
): StoryboardDocumentEffectLayer => ({
  id: existingLayer?.id || getStoryboardDocumentBoardPolishEffectLayerId(effectState.id),
  type: 'effect',
  effectId: effectState.id,
  effectScope: 'board-polish',
  name: STORYBOARD_BOARD_POLISH_EFFECT_LAYER_LABELS[effectState.id],
  visible: effectState.enabled,
  locked: existingLayer?.locked ?? false,
  opacity: effectState.opacity,
  blendMode: existingLayer?.blendMode ?? 'normal',
  createdAt: existingLayer?.createdAt || updatedAt,
  updatedAt,
});

const syncStoryboardDrawingDocumentBoardPolishEffectLayers = (
  document: StoryboardDrawingDocument,
  updatedAt: string,
): StoryboardDocumentLayer[] => {
  const nonBoardPolishEffectLayers = document.layers.filter((layer) => !(
    layer.type === 'effect' && layer.effectScope === 'board-polish'
  ));
  const boardPolish = normalizeBoardPolishState(document.metadata.boardPolish, updatedAt);
  if (!boardPolish) {
    return nonBoardPolishEffectLayers;
  }

  const existingEffectLayers = new Map(
    document.layers
      .filter((layer): layer is StoryboardDocumentEffectLayer => layer.type === 'effect' && layer.effectScope === 'board-polish')
      .map((layer) => [layer.effectId, layer]),
  );

  const nextEffectLayers = boardPolish.effectLayers.map((effectState) => (
    createStoryboardDocumentBoardPolishEffectLayer(effectState, updatedAt, existingEffectLayers.get(effectState.id))
  ));

  return [...nonBoardPolishEffectLayers, ...nextEffectLayers];
};

const createDocumentId = (prefix: string): string => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isBlendMode = (value: unknown): value is StoryboardDocumentBlendMode =>
  value === 'normal'
  || value === 'multiply'
  || value === 'screen'
  || value === 'overlay'
  || value === 'darken'
  || value === 'lighten'
  || value === 'color-dodge'
  || value === 'color-burn'
  || value === 'hard-light'
  || value === 'soft-light'
  || value === 'difference'
  || value === 'exclusion';

const normalizeBlendMode = (value: unknown): StoryboardDocumentBlendMode =>
  isBlendMode(value) ? value : 'normal';

const isWorkflowLevel = (value: unknown): value is StoryboardDocumentWorkflowLevel =>
  value === 'idea' || value === 'blocking' || value === 'shot' || value === 'presentation';

const isReferenceStudyFocusMode = (value: unknown): value is StoryboardDocumentReferenceStudyFocusMode =>
  value === 'composition' || value === 'placement' || value === 'economy';

const isReferenceStudyDrillId = (value: unknown): value is StoryboardDocumentReferenceStudyDrillId =>
  value === 'focus-up'
  || value === 'focus-right'
  || value === 'widen'
  || value === 'reduce-passes'
  || value === 'balance-center';

const isShapeScaffoldPrimitive = (value: unknown): value is StoryboardDocumentShapeScaffoldPrimitive =>
  value === 'ellipse' || value === 'rectangle' || value === 'line' || value === 'blob';

const isShapeScaffoldApplyMode = (value: unknown): value is StoryboardDocumentShapeScaffoldApplyMode =>
  value === 'rough' || value === 'construction' || value === 'clean';

const normalizeReferenceStudyAttemptMetrics = (
  value: unknown,
): StoryboardDocumentReferenceStudyAttemptMetrics => {
  const record = isRecord(value) ? value : {};
  return {
    strokeCount: typeof record.strokeCount === 'number' ? record.strokeCount : 0,
    pointCount: typeof record.pointCount === 'number' ? record.pointCount : 0,
    widthRatio: typeof record.widthRatio === 'number' ? record.widthRatio : 0,
    heightRatio: typeof record.heightRatio === 'number' ? record.heightRatio : 0,
    centerXRatio: typeof record.centerXRatio === 'number' ? record.centerXRatio : 0,
    centerYRatio: typeof record.centerYRatio === 'number' ? record.centerYRatio : 0,
    averageStrokeWidth: typeof record.averageStrokeWidth === 'number' ? record.averageStrokeWidth : 0,
    totalPathLength: typeof record.totalPathLength === 'number' ? record.totalPathLength : 0,
    focusXRatio: typeof record.focusXRatio === 'number' ? record.focusXRatio : 0,
    focusYRatio: typeof record.focusYRatio === 'number' ? record.focusYRatio : 0,
    horizontalBalance: typeof record.horizontalBalance === 'number' ? record.horizontalBalance : 0,
    verticalBalance: typeof record.verticalBalance === 'number' ? record.verticalBalance : 0,
    silhouetteDensity: typeof record.silhouetteDensity === 'number' ? record.silhouetteDensity : 0,
  };
};

const normalizeReferenceStudyAttemptRecord = (
  value: unknown,
  fallbackCreatedAt: string,
): StoryboardDocumentReferenceStudyAttemptRecord | null => {
  const record = isRecord(value) ? value : null;
  if (!record || typeof record.id !== 'string' || typeof record.name !== 'string') {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : fallbackCreatedAt,
    strokeCount: typeof record.strokeCount === 'number' ? record.strokeCount : 0,
    pointCount: typeof record.pointCount === 'number' ? record.pointCount : 0,
    strokeSignature: typeof record.strokeSignature === 'string' ? record.strokeSignature : '',
    strokes: Array.isArray(record.strokes) ? (record.strokes as PencilStroke[]) : [],
    previewDataUrl: typeof record.previewDataUrl === 'string' ? record.previewDataUrl : '',
    metrics: normalizeReferenceStudyAttemptMetrics(record.metrics),
    focusRead: typeof record.focusRead === 'string' ? record.focusRead : 'centered',
    balanceRead: typeof record.balanceRead === 'string' ? record.balanceRead : 'balanced',
    silhouetteRead: typeof record.silhouetteRead === 'string' ? record.silhouetteRead : 'open',
    drillId: isReferenceStudyDrillId(record.drillId) ? record.drillId : undefined,
    drillStatus: record.drillStatus === 'met' || record.drillStatus === 'retry' ? record.drillStatus : undefined,
    drillBaselineName: typeof record.drillBaselineName === 'string' ? record.drillBaselineName : undefined,
  };
};

const normalizeReferenceStudyState = (
  value: unknown,
  fallbackUpdatedAt: string,
): StoryboardDocumentReferenceStudyState | undefined => {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return undefined;
  }

  const attempts = Array.isArray(record.attempts)
    ? record.attempts
        .map((attempt) => normalizeReferenceStudyAttemptRecord(attempt, fallbackUpdatedAt))
        .filter((attempt): attempt is StoryboardDocumentReferenceStudyAttemptRecord => Boolean(attempt))
        .slice(0, 8)
    : [];
  const attemptIdSet = new Set(attempts.map((attempt) => attempt.id));
  const selectedAttemptId = typeof record.selectedAttemptId === 'string' && attemptIdSet.has(record.selectedAttemptId)
    ? record.selectedAttemptId
    : attempts[0]?.id;

  return {
    active: typeof record.active === 'boolean' ? record.active : false,
    reveal: typeof record.reveal === 'boolean' ? record.reveal : false,
    referenceId: typeof record.referenceId === 'string' ? record.referenceId : undefined,
    baselineStrokeCount:
      typeof record.baselineStrokeCount === 'number' && Number.isFinite(record.baselineStrokeCount)
        ? record.baselineStrokeCount
        : null,
    compareOpacity: typeof record.compareOpacity === 'number' ? record.compareOpacity : 0.58,
    focusMode: isReferenceStudyFocusMode(record.focusMode) ? record.focusMode : 'composition',
    armedDrillId: isReferenceStudyDrillId(record.armedDrillId) ? record.armedDrillId : undefined,
    attempts,
    selectedAttemptId,
    ghostEnabled: typeof record.ghostEnabled === 'boolean' ? record.ghostEnabled : false,
    ghostOpacity: typeof record.ghostOpacity === 'number' ? record.ghostOpacity : 0.3,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : fallbackUpdatedAt,
  };
};

const normalizeShapeScaffoldSelections = (value: unknown): Record<string, string[]> => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string[]>>((result, [key, entryValue]) => {
    if (!Array.isArray(entryValue)) {
      return result;
    }
    const values = entryValue.filter((entry): entry is string => typeof entry === 'string');
    if (values.length > 0) {
      result[key] = values;
    }
    return result;
  }, {});
};

const normalizeShapeScaffoldFrame = (value: unknown): StoryboardDocumentShapeScaffoldFrame => {
  const record = isRecord(value) ? value : {};
  const widthRatio = typeof record.widthRatio === 'number' ? Math.max(0.02, Math.min(1, record.widthRatio)) : 0.18;
  const heightRatio = typeof record.heightRatio === 'number' ? Math.max(0.02, Math.min(1, record.heightRatio)) : 0.18;
  const xRatio = typeof record.xRatio === 'number' ? Math.max(0, Math.min(1 - widthRatio, record.xRatio)) : 0.32;
  const yRatio = typeof record.yRatio === 'number' ? Math.max(0, Math.min(1 - heightRatio, record.yRatio)) : 0.28;
  return {
    xRatio,
    yRatio,
    widthRatio,
    heightRatio,
    baseWidthRatio:
      typeof record.baseWidthRatio === 'number'
        ? Math.max(0.02, Math.min(1, record.baseWidthRatio))
        : widthRatio,
    baseHeightRatio:
      typeof record.baseHeightRatio === 'number'
        ? Math.max(0.02, Math.min(1, record.baseHeightRatio))
        : heightRatio,
  };
};

const normalizeShapeScaffold = (
  value: unknown,
  fallbackUpdatedAt: string,
): StoryboardDocumentShapeScaffold | null => {
  const record = isRecord(value) ? value : null;
  if (!record || typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.suggestionId !== 'string') {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    primitive: isShapeScaffoldPrimitive(record.primitive) ? record.primitive : 'ellipse',
    suggestionId: record.suggestionId,
    selections: normalizeShapeScaffoldSelections(record.selections),
    applyMode: isShapeScaffoldApplyMode(record.applyMode) ? record.applyMode : 'clean',
    frame: normalizeShapeScaffoldFrame(record.frame),
    visible: typeof record.visible === 'boolean' ? record.visible : true,
    opacity: typeof record.opacity === 'number' ? Math.max(0.1, Math.min(1, record.opacity)) : 0.82,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : fallbackUpdatedAt,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : fallbackUpdatedAt,
  };
};

const normalizeShapeScaffoldAssembly = (
  value: unknown,
  fallbackUpdatedAt: string,
): StoryboardDocumentShapeScaffoldAssembly | null => {
  const record = isRecord(value) ? value : null;
  const scaffoldIds = Array.isArray(record?.scaffoldIds)
    ? record.scaffoldIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  if (!record || typeof record.id !== 'string' || typeof record.name !== 'string' || scaffoldIds.length === 0) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    scaffoldIds: Array.from(new Set(scaffoldIds)),
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : fallbackUpdatedAt,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : fallbackUpdatedAt,
  };
};

const normalizeShapeScaffoldLibraryEntry = (
  value: unknown,
  fallbackUpdatedAt: string,
): StoryboardDocumentShapeScaffoldLibraryEntry | null => {
  const record = isRecord(value) ? value : null;
  if (!record || typeof record.id !== 'string' || typeof record.name !== 'string' || typeof record.suggestionId !== 'string') {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    primitive: isShapeScaffoldPrimitive(record.primitive) ? record.primitive : 'ellipse',
    suggestionId: record.suggestionId,
    selections: normalizeShapeScaffoldSelections(record.selections),
    applyMode: isShapeScaffoldApplyMode(record.applyMode) ? record.applyMode : 'clean',
    frame: normalizeShapeScaffoldFrame(record.frame),
    opacity: typeof record.opacity === 'number' ? Math.max(0.1, Math.min(1, record.opacity)) : 0.82,
    pinned: record.pinned === true,
    defaultForPrimitive: record.defaultForPrimitive === true,
    tags: Array.isArray(record.tags)
      ? Array.from(new Set(record.tags.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)))
      : [],
    usageCount: typeof record.usageCount === 'number' && Number.isFinite(record.usageCount)
      ? Math.max(0, Math.round(record.usageCount))
      : 0,
    lastUsedAt: typeof record.lastUsedAt === 'string' ? record.lastUsedAt : undefined,
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : fallbackUpdatedAt,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : fallbackUpdatedAt,
  };
};

const parseLegacyStrokes = (value: unknown): PencilStroke[] => {
  if (typeof value !== 'string' || value.trim().length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as PencilStroke[]) : [];
  } catch {
    return [];
  }
};

const buildStrokeRecords = (
  strokes: PencilStroke[],
  timestamp: string,
  existing?: StoryboardDocumentStrokeRecord[]
): StoryboardDocumentStrokeRecord[] => (
  strokes.map((stroke, index) => ({
    id: existing?.[index]?.id || createDocumentId('stroke'),
    stroke,
    createdAt: existing?.[index]?.createdAt || timestamp,
    updatedAt: timestamp,
  }))
);

const clampPositiveInteger = (value: number | undefined, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(MIN_TIMELINE_VALUE, Math.round(value));
};

const getOrderedSheets = (sheets: StoryboardDocumentSheet[]): StoryboardDocumentSheet[] => (
  [...sheets].sort((left, right) => left.index - right.index)
);

const recalculateSheets = (
  sheets: StoryboardDocumentSheet[],
  fps: number
): StoryboardDocumentSheet[] => {
  let frameCursor = 0;
  return getOrderedSheets(sheets).map((sheet, index) => {
    const exposure = clampPositiveInteger(sheet.exposure, DEFAULT_EXPOSURE);
    const durationMs = Math.max(1, Math.round((1000 / fps) * exposure));
    const nextSheet: StoryboardDocumentSheet = {
      ...sheet,
      index,
      exposure,
      durationMs,
      frameStart: frameCursor,
    };
    frameCursor += exposure;
    return nextSheet;
  });
};

const getTimelineFrameCount = (sheets: StoryboardDocumentSheet[]): number => (
  sheets.reduce((total, sheet) => total + clampPositiveInteger(sheet.exposure, DEFAULT_EXPOSURE), 0)
);

const cloneSheetLayersAndStrokes = (
  document: StoryboardDrawingDocument,
  sourceSheet: StoryboardDocumentSheet,
  updatedAt: string
): {
  layers: StoryboardDocumentLayer[];
  strokes: StoryboardDocumentStrokeRecord[];
  layerIds: string[];
  activeLayerId?: string;
} => {
  const sourceLayers = sourceSheet.layerIds
    .map((layerId) => getLayerById(document, layerId))
    .filter((layer): layer is StoryboardDocumentLayer => Boolean(layer));
  const sourceStrokeMap = new Map(document.strokes.map((stroke) => [stroke.id, stroke]));
  const nextStrokeRecords: StoryboardDocumentStrokeRecord[] = [];
  const clonedLayerIdMap = new Map<string, string>();
  const clonedLayers: StoryboardDocumentLayer[] = [];
  const cloneLayer = (layer: StoryboardDocumentLayer): StoryboardDocumentLayer => {
    const existingLayerId = clonedLayerIdMap.get(layer.id);
    if (existingLayerId) {
      const existingLayer = clonedLayers.find((entry) => entry.id === existingLayerId);
      if (existingLayer) {
        return existingLayer;
      }
    }

    const clonedLayerId = createDocumentId('layer');
    clonedLayerIdMap.set(layer.id, clonedLayerId);

    let clonedLayer: StoryboardDocumentLayer;
    if (layer.type === 'drawing') {
      const clonedStrokeIds = layer.strokeIds.map((strokeId) => {
        const sourceStroke = sourceStrokeMap.get(strokeId);
        const clonedStrokeId = createDocumentId('stroke');
        if (sourceStroke) {
          nextStrokeRecords.push({
            ...sourceStroke,
            id: clonedStrokeId,
            createdAt: updatedAt,
            updatedAt,
          });
        }
        return clonedStrokeId;
      });

      clonedLayer = {
        ...layer,
        id: clonedLayerId,
        strokeIds: clonedStrokeIds,
        createdAt: updatedAt,
        updatedAt,
      };
    } else if (layer.type === 'group' || layer.type === 'transformation') {
      const clonedChildLayers = layer.childLayerIds
        .map((childLayerId) => getLayerById(document, childLayerId))
        .filter((childLayer): childLayer is StoryboardDocumentLayer => Boolean(childLayer))
        .map(cloneLayer);

      clonedLayer = {
        ...layer,
        id: clonedLayerId,
        childLayerIds: clonedChildLayers.map((childLayer) => childLayer.id),
        ...(layer.type === 'transformation'
          ? {
              keyframes: layer.keyframes.map((keyframe) => ({
                ...keyframe,
                id: createDocumentId('keyframe'),
                createdAt: updatedAt,
                updatedAt,
              })),
            }
          : {}),
        createdAt: updatedAt,
        updatedAt,
      };
    } else {
      clonedLayer = {
        ...layer,
        id: clonedLayerId,
        createdAt: updatedAt,
        updatedAt,
      };
    }

    clonedLayers.push(clonedLayer);
    return clonedLayer;
  };

  const topLevelClonedLayers = sourceLayers.map(cloneLayer);

  return {
    layers: clonedLayers,
    strokes: nextStrokeRecords,
    layerIds: topLevelClonedLayers.map((layer) => layer.id),
    activeLayerId: sourceSheet.activeLayerId ? clonedLayerIdMap.get(sourceSheet.activeLayerId) : topLevelClonedLayers[0]?.id,
  };
};

const normalizeStoryboardDrawingDocument = (
  document: StoryboardDrawingDocument,
  updatedAt: string = document.updatedAt
): StoryboardDrawingDocument => {
  if (!document.sheets.length || !document.layers.length) {
    return createStoryboardDrawingDocument({
      frameId: document.frameId,
      storyboardId: document.storyboardId,
      aspectRatio: document.aspectRatio,
      workflowLevel: document.metadata.workflowLevel,
      baseImageUrl: document.metadata.baseImageUrl,
      originalBaseImageUrl: document.metadata.originalBaseImageUrl,
      imageDataUrl: document.metadata.lastCompositeImageUrl,
      brushSettings: document.metadata.brushSettings,
      createdAt: document.createdAt,
      updatedAt,
    });
  }

  const fps = clampPositiveInteger(document.timeline.fps, DEFAULT_FPS);
  const sheets = recalculateSheets(document.sheets, fps);
  const totalFrames = Math.max(1, getTimelineFrameCount(sheets));
  const validSheetIds = new Set(sheets.map((sheet) => sheet.id));
  const validMarkerIds = new Set(document.markers.map((marker) => marker.id));
  const validShapeScaffoldIds = new Set((document.metadata.shapeScaffolds || []).map((entry) => entry.id));
  const primarySheetId = validSheetIds.has(document.primarySheetId) ? document.primarySheetId : sheets[0].id;
  const selectedSheetIds = document.timeline.selectedSheetIds.filter((sheetId) => validSheetIds.has(sheetId));
  const selectedMarkerIds = document.timeline.selectedMarkerIds.filter((markerId) => validMarkerIds.has(markerId));
  const normalizedBoardPolish = normalizeBoardPolishState(document.metadata.boardPolish, updatedAt) || undefined;
  const syncedLayers = syncStoryboardDrawingDocumentBoardPolishEffectLayers({
    ...document,
    metadata: {
      ...document.metadata,
      boardPolish: normalizedBoardPolish,
    },
  }, updatedAt);

  return {
    ...document,
    updatedAt,
    primarySheetId,
    layers: syncedLayers.map((layer) => {
      if (layer.type !== 'transformation') return layer;
      return {
        ...layer,
        keyframes: layer.keyframes.map((keyframe) => ({
          ...keyframe,
          perspectiveX: keyframe.perspectiveX ?? 0,
          perspectiveY: keyframe.perspectiveY ?? 0,
          cornerWarp: normalizeStoryboardDocumentCornerWarp(keyframe.cornerWarp),
        })),
      };
    }),
    sheets: sheets.map((sheet) => {
      const validLayerIds = sheet.layerIds.filter((layerId) => Boolean(document.layers.some((layer) => layer.id === layerId)));
      const layerMap = new Map(document.layers.map((layer) => [layer.id, layer]));
      const collectDrawingLayerIds = (ids: string[], visited: Set<string> = new Set()): string[] => ids.flatMap((layerId) => {
        if (visited.has(layerId)) return [];
        visited.add(layerId);
        const layer = layerMap.get(layerId);
        if (!layer) return [];
        if (layer.type === 'drawing') {
          visited.delete(layerId);
          return [layer.id];
        }
        const childIds = layer.type === 'group' || layer.type === 'transformation' ? layer.childLayerIds : [];
        const descendants = collectDrawingLayerIds(childIds, visited);
        visited.delete(layerId);
        return descendants;
      });
      const resolveActiveDrawingLayerId = (layerId?: string, visited: Set<string> = new Set()): string | undefined => {
        if (!layerId || visited.has(layerId)) return undefined;
        visited.add(layerId);
        const layer = layerMap.get(layerId);
        if (!layer) return undefined;
        if (layer.type === 'drawing') return layer.id;
        const childIds = layer.type === 'group' || layer.type === 'transformation' ? layer.childLayerIds : [];
        for (const childLayerId of childIds) {
          const descendant = resolveActiveDrawingLayerId(childLayerId, visited);
          if (descendant) return descendant;
        }
        return undefined;
      };
      const drawingLayerIds = collectDrawingLayerIds(validLayerIds.length > 0 ? validLayerIds : sheet.layerIds);
      const resolvedActiveLayerId = resolveActiveDrawingLayerId(sheet.activeLayerId) || sheet.activeLayerId;
      const activeLayerId = drawingLayerIds.includes(resolvedActiveLayerId || '') ? resolvedActiveLayerId : drawingLayerIds[0];
      return {
        ...sheet,
        layerIds: validLayerIds.length > 0 ? validLayerIds : sheet.layerIds,
        activeLayerId,
      };
    }),
    markers: document.markers
      .filter((marker) => marker.frame >= 0 && marker.frame < totalFrames)
      .sort((left, right) => left.frame - right.frame),
    timeline: {
      ...document.timeline,
      fps,
      defaultExposure: clampPositiveInteger(document.timeline.defaultExposure, DEFAULT_EXPOSURE),
      scrubFrame: Math.max(0, Math.min(totalFrames - 1, Math.round(document.timeline.scrubFrame))),
      onionSkinFramesBefore: clampPositiveInteger(document.timeline.onionSkinFramesBefore, 2),
      onionSkinFramesAfter: clampPositiveInteger(document.timeline.onionSkinFramesAfter, 2),
      selectedSheetIds: selectedSheetIds.length > 0 ? selectedSheetIds : [primarySheetId],
      selectedMarkerIds,
    },
    metadata: {
      ...document.metadata,
      boardPolish: normalizedBoardPolish,
      shapeScaffoldAssemblies: (document.metadata.shapeScaffoldAssemblies || [])
        .map((assembly) => ({
          ...assembly,
          scaffoldIds: assembly.scaffoldIds.filter((entry) => validShapeScaffoldIds.has(entry)),
        }))
        .filter((assembly) => assembly.scaffoldIds.length > 0),
      shapeScaffoldLibrary: (document.metadata.shapeScaffoldLibrary || []).map((entry) => {
        if (!entry.defaultForPrimitive) {
          return entry;
        }
        const competingDefaults = (document.metadata.shapeScaffoldLibrary || []).filter((candidate) => (
          candidate.primitive === entry.primitive && candidate.defaultForPrimitive
        ));
        const sortedDefaults = [...competingDefaults].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        return {
          ...entry,
          defaultForPrimitive: sortedDefaults[0]?.id === entry.id,
        };
      }),
    },
  };
};

export const createStoryboardDrawingDocument = (
  seed: StoryboardDrawingDocumentSeed = {}
): StoryboardDrawingDocument => {
  const createdAt = seed.createdAt || new Date().toISOString();
  const updatedAt = seed.updatedAt || createdAt;
  const primaryLayerId = createDocumentId('layer');
  const primarySheetId = createDocumentId('sheet');
  const primaryCanvasId = createDocumentId('canvas');
  const primaryBookmarkId = createDocumentId('bookmark');
  const strokeRecords = buildStrokeRecords(seed.strokes || [], updatedAt);

  const referenceImage = seed.referenceImage
    ? [{
        id: createDocumentId('reference'),
        name: 'Reference 1',
        src: seed.referenceImage.src,
        opacity: seed.referenceImage.opacity,
        visible: seed.referenceImage.visible,
        x: seed.referenceImage.x,
        y: seed.referenceImage.y,
        width: seed.referenceImage.width,
        height: seed.referenceImage.height,
        rotation: 0,
        fitMode: 'free' as const,
        createdAt,
        updatedAt,
      }]
    : [];

  return {
    version: 1,
    id: createDocumentId('storyboard-document'),
    frameId: seed.frameId,
    storyboardId: seed.storyboardId,
    aspectRatio: seed.aspectRatio,
    createdAt,
    updatedAt,
    primarySheetId,
    primaryCanvasId,
    sheets: [{
      id: primarySheetId,
      name: 'Sheet 1',
      index: 0,
      exposure: DEFAULT_EXPOSURE,
      durationMs: Math.round((1000 / DEFAULT_FPS) * DEFAULT_EXPOSURE),
      frameStart: 0,
      layerIds: [primaryLayerId],
      activeLayerId: primaryLayerId,
      markerIds: [],
      createdAt,
      updatedAt,
    }],
    layers: [{
      id: primaryLayerId,
      type: 'drawing',
      name: 'Drawing Layer 1',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      strokeIds: strokeRecords.map((entry) => entry.id),
      createdAt,
      updatedAt,
    }],
    strokes: strokeRecords,
    markers: [],
    references: referenceImage,
    bookmarks: [{
      id: primaryBookmarkId,
      name: 'Origin',
      timingMs: 1200,
      transition: 'ease',
      visibleCanvasIds: [primaryCanvasId],
      camera: {
        x: 0,
        y: 0,
        z: 0,
        zoom: 1,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
      },
      createdAt,
      updatedAt,
    }],
    canvases: [{
      id: primaryCanvasId,
      name: 'Canvas 1',
      width: 1920,
      height: 1080,
      aspectRatio: seed.aspectRatio,
      sheetIds: [primarySheetId],
      bookmarkIds: [primaryBookmarkId],
      transform: {
        x: 0,
        y: 0,
        z: 0,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        scale: 1,
      },
      createdAt,
      updatedAt,
    }],
    timeline: {
      fps: DEFAULT_FPS,
      defaultExposure: DEFAULT_EXPOSURE,
      scrubFrame: 0,
      onionSkinEnabled: false,
      onionSkinFramesBefore: 2,
      onionSkinFramesAfter: 2,
      selectedSheetIds: [primarySheetId],
      selectedMarkerIds: [],
    },
    projection: {
      mode: 'planar',
      reinterpretExistingStrokes: false,
      arrangeAfterDrawing: false,
      sourceCanvasId: primaryCanvasId,
      targetCanvasId: primaryCanvasId,
      appliedCount: 0,
    },
    metadata: {
      workflowLevel: seed.workflowLevel,
      baseImageUrl: seed.baseImageUrl,
      originalBaseImageUrl: seed.originalBaseImageUrl ?? seed.baseImageUrl,
      lastCompositeImageUrl: seed.imageDataUrl,
      brushSettings: seed.brushSettings,
      boardPolish: undefined,
      referenceStudy: undefined,
      shapeScaffolds: [],
      shapeScaffoldAssemblies: [],
      shapeScaffoldLibrary: [],
    },
  };
};

export const restoreStoryboardDrawingDocument = (
  value: unknown,
  seed: StoryboardDrawingDocumentSeed = {}
): StoryboardDrawingDocument => {
  const fallback = createStoryboardDrawingDocument(seed);
  if (!isRecord(value) || value.version !== 1) {
    return fallback;
  }

  return normalizeStoryboardDrawingDocument({
    ...fallback,
    ...value,
    version: 1,
    frameId: typeof value.frameId === 'string' ? value.frameId : fallback.frameId,
    storyboardId: typeof value.storyboardId === 'string' ? value.storyboardId : fallback.storyboardId,
    aspectRatio: typeof value.aspectRatio === 'string' ? (value.aspectRatio as StoryboardDocumentAspectRatio) : fallback.aspectRatio,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : fallback.createdAt,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : fallback.updatedAt,
    primarySheetId: typeof value.primarySheetId === 'string' ? value.primarySheetId : fallback.primarySheetId,
    primaryCanvasId: typeof value.primaryCanvasId === 'string' ? value.primaryCanvasId : fallback.primaryCanvasId,
    sheets: Array.isArray(value.sheets) ? (value.sheets as StoryboardDocumentSheet[]) : fallback.sheets,
    layers: Array.isArray(value.layers) ? (value.layers as StoryboardDocumentLayer[]) : fallback.layers,
    strokes: Array.isArray(value.strokes) ? (value.strokes as StoryboardDocumentStrokeRecord[]) : fallback.strokes,
    markers: Array.isArray(value.markers) ? (value.markers as StoryboardDocumentTimelineMarker[]) : fallback.markers,
    references: Array.isArray(value.references) ? (value.references as StoryboardDocumentReferenceImage[]) : fallback.references,
    bookmarks: Array.isArray(value.bookmarks) ? (value.bookmarks as StoryboardDocumentBookmarkView[]) : fallback.bookmarks,
    canvases: Array.isArray(value.canvases) ? (value.canvases as StoryboardDocumentSpatialCanvas[]) : fallback.canvases,
    timeline: isRecord(value.timeline)
      ? {
          fps: typeof value.timeline.fps === 'number' ? value.timeline.fps : fallback.timeline.fps,
          defaultExposure:
            typeof value.timeline.defaultExposure === 'number'
              ? value.timeline.defaultExposure
              : fallback.timeline.defaultExposure,
          scrubFrame: typeof value.timeline.scrubFrame === 'number' ? value.timeline.scrubFrame : fallback.timeline.scrubFrame,
          onionSkinEnabled:
            typeof value.timeline.onionSkinEnabled === 'boolean'
              ? value.timeline.onionSkinEnabled
              : fallback.timeline.onionSkinEnabled,
          onionSkinFramesBefore:
            typeof value.timeline.onionSkinFramesBefore === 'number'
              ? value.timeline.onionSkinFramesBefore
              : fallback.timeline.onionSkinFramesBefore,
          onionSkinFramesAfter:
            typeof value.timeline.onionSkinFramesAfter === 'number'
              ? value.timeline.onionSkinFramesAfter
              : fallback.timeline.onionSkinFramesAfter,
          selectedSheetIds: Array.isArray(value.timeline.selectedSheetIds)
            ? (value.timeline.selectedSheetIds as string[])
            : fallback.timeline.selectedSheetIds,
          selectedMarkerIds: Array.isArray(value.timeline.selectedMarkerIds)
            ? (value.timeline.selectedMarkerIds as string[])
            : fallback.timeline.selectedMarkerIds,
        }
      : fallback.timeline,
    projection: isRecord(value.projection)
      ? {
          mode:
            value.projection.mode === 'planar'
            || value.projection.mode === 'projection'
            || value.projection.mode === 'rearrange'
              ? value.projection.mode
              : fallback.projection.mode,
          reinterpretExistingStrokes:
            typeof value.projection.reinterpretExistingStrokes === 'boolean'
              ? value.projection.reinterpretExistingStrokes
              : fallback.projection.reinterpretExistingStrokes,
          arrangeAfterDrawing:
            typeof value.projection.arrangeAfterDrawing === 'boolean'
              ? value.projection.arrangeAfterDrawing
              : fallback.projection.arrangeAfterDrawing,
          sourceCanvasId:
            typeof value.projection.sourceCanvasId === 'string'
              ? value.projection.sourceCanvasId
              : fallback.projection.sourceCanvasId,
          targetCanvasId:
            typeof value.projection.targetCanvasId === 'string'
              ? value.projection.targetCanvasId
              : fallback.projection.targetCanvasId,
          appliedCount:
            typeof value.projection.appliedCount === 'number'
              ? value.projection.appliedCount
              : fallback.projection.appliedCount,
          lastProjectedSheetId:
            typeof value.projection.lastProjectedSheetId === 'string'
              ? value.projection.lastProjectedSheetId
              : fallback.projection.lastProjectedSheetId,
          lastProjectedBookmarkId:
            typeof value.projection.lastProjectedBookmarkId === 'string'
              ? value.projection.lastProjectedBookmarkId
              : fallback.projection.lastProjectedBookmarkId,
          lastProjectedAt:
            typeof value.projection.lastProjectedAt === 'string'
              ? value.projection.lastProjectedAt
              : fallback.projection.lastProjectedAt,
        }
      : fallback.projection,
    metadata: isRecord(value.metadata)
      ? {
          workflowLevel: isWorkflowLevel(value.metadata.workflowLevel)
            ? value.metadata.workflowLevel
            : fallback.metadata.workflowLevel,
          baseImageUrl:
            typeof value.metadata.baseImageUrl === 'string'
              ? value.metadata.baseImageUrl
              : fallback.metadata.baseImageUrl,
          originalBaseImageUrl:
            typeof value.metadata.originalBaseImageUrl === 'string'
              ? value.metadata.originalBaseImageUrl
              : fallback.metadata.originalBaseImageUrl,
          lastCompositeImageUrl:
            typeof value.metadata.lastCompositeImageUrl === 'string'
              ? value.metadata.lastCompositeImageUrl
              : fallback.metadata.lastCompositeImageUrl,
          brushSettings: isRecord(value.metadata.brushSettings)
            ? {
                type:
                  typeof value.metadata.brushSettings.type === 'string'
                    ? value.metadata.brushSettings.type
                    : fallback.metadata.brushSettings?.type || 'pen',
                size:
                  typeof value.metadata.brushSettings.size === 'number'
                    ? value.metadata.brushSettings.size
                    : fallback.metadata.brushSettings?.size || 4,
                color:
                  typeof value.metadata.brushSettings.color === 'string'
                    ? value.metadata.brushSettings.color
                    : fallback.metadata.brushSettings?.color || '#ffffff',
                opacity:
                  typeof value.metadata.brushSettings.opacity === 'number'
                    ? value.metadata.brushSettings.opacity
                    : fallback.metadata.brushSettings?.opacity || 1,
              }
            : fallback.metadata.brushSettings,
          boardPolish: normalizeBoardPolishState(value.metadata.boardPolish, fallback.updatedAt)
            || fallback.metadata.boardPolish,
          referenceStudy: normalizeReferenceStudyState(value.metadata.referenceStudy, fallback.updatedAt),
          shapeScaffolds: Array.isArray(value.metadata.shapeScaffolds)
            ? value.metadata.shapeScaffolds
              .map((entry) => normalizeShapeScaffold(entry, fallback.updatedAt))
              .filter((entry): entry is StoryboardDocumentShapeScaffold => Boolean(entry))
            : fallback.metadata.shapeScaffolds,
          shapeScaffoldAssemblies: Array.isArray(value.metadata.shapeScaffoldAssemblies)
            ? value.metadata.shapeScaffoldAssemblies
              .map((entry) => normalizeShapeScaffoldAssembly(entry, fallback.updatedAt))
              .filter((entry): entry is StoryboardDocumentShapeScaffoldAssembly => Boolean(entry))
            : fallback.metadata.shapeScaffoldAssemblies,
          shapeScaffoldLibrary: Array.isArray(value.metadata.shapeScaffoldLibrary)
            ? value.metadata.shapeScaffoldLibrary
              .map((entry) => normalizeShapeScaffoldLibraryEntry(entry, fallback.updatedAt))
              .filter((entry): entry is StoryboardDocumentShapeScaffoldLibraryEntry => Boolean(entry))
            : fallback.metadata.shapeScaffoldLibrary,
        }
      : fallback.metadata,
  });
};

export const restoreStoryboardDrawingDocumentFromLegacy = (
  input: {
    document?: unknown;
    strokes?: unknown;
    baseImageUrl?: string;
    originalBaseImageUrl?: string;
    dataUrl?: string;
    brushSettings?: StoryboardDocumentBrushSettings;
    referenceImage?: StoryboardDrawingDocumentSeed['referenceImage'];
  },
  seed: Omit<StoryboardDrawingDocumentSeed, 'strokes' | 'baseImageUrl' | 'imageDataUrl' | 'brushSettings' | 'referenceImage'> = {}
): StoryboardDrawingDocument => {
  const legacyStrokes = parseLegacyStrokes(input.strokes);
  return restoreStoryboardDrawingDocument(input.document, {
    ...seed,
    strokes: legacyStrokes,
    baseImageUrl: input.baseImageUrl,
    originalBaseImageUrl: input.originalBaseImageUrl,
    imageDataUrl: input.dataUrl,
    brushSettings: input.brushSettings,
    referenceImage: input.referenceImage || null,
  });
};

const getSheetById = (
  document: StoryboardDrawingDocument,
  sheetId: string
): StoryboardDocumentSheet | undefined => (
  document.sheets.find((sheet) => sheet.id === sheetId)
);

const getLayerById = (
  document: StoryboardDrawingDocument,
  layerId: string
): StoryboardDocumentLayer | undefined => (
  document.layers.find((entry) => entry.id === layerId)
);

const getDrawingLayerById = (
  document: StoryboardDrawingDocument,
  layerId: string
): StoryboardDocumentDrawingLayer | undefined => {
  const layer = getLayerById(document, layerId);
  return layer?.type === 'drawing' ? layer : undefined;
};

const getChildLayerIds = (
  layer: StoryboardDocumentLayer | undefined
): string[] => {
  if (!layer) return [];
  if (layer.type === 'group' || layer.type === 'transformation') {
    return layer.childLayerIds;
  }
  return [];
};

const getLayerStackEntries = (
  document: StoryboardDrawingDocument,
  layerIds: string[],
  options: {
    frameIndex: number;
    depth: number;
    parentLayerId?: string;
    inheritedVisible: boolean;
    inheritedLocked: boolean;
    inheritedOpacity: number;
    appliedTransforms: StoryboardDocumentAppliedTransform[];
    strokeMap: Map<string, PencilStroke>;
    sheetPivot: { x: number; y: number };
    visited: Set<string>;
  }
): StoryboardDocumentLayerStackEntry[] => {
  return layerIds.flatMap((layerId) => {
    if (options.visited.has(layerId)) {
      return [];
    }
    const layer = getLayerById(document, layerId);
    if (!layer) {
      return [];
    }

    options.visited.add(layerId);
    const effectiveVisible = options.inheritedVisible && layer.visible;
    const effectiveLocked = options.inheritedLocked || layer.locked;
    const effectiveOpacity = Math.max(0, Math.min(1, options.inheritedOpacity * layer.opacity));
    const nextAppliedTransforms = [...options.appliedTransforms];
    if (layer.type === 'transformation') {
      const keyframeValue = getTransformationLayerValueAtFrame(layer, options.frameIndex);
      const descendantBounds = getStrokeBounds(getLayerDescendantStrokes(document, layer.id, options.strokeMap));
      nextAppliedTransforms.push({
        layerId: layer.id,
        layerName: layer.name,
        translateX: keyframeValue.translateX,
        translateY: keyframeValue.translateY,
        scaleX: keyframeValue.scaleX,
        scaleY: keyframeValue.scaleY,
        rotation: keyframeValue.rotation,
        perspectiveX: keyframeValue.perspectiveX,
        perspectiveY: keyframeValue.perspectiveY,
        cornerWarp: keyframeValue.cornerWarp,
        pivotX: layer.pivotMode === 'global' ? options.sheetPivot.x : descendantBounds.centerX,
        pivotY: layer.pivotMode === 'global' ? options.sheetPivot.y : descendantBounds.centerY,
        warpBounds: {
          x: descendantBounds.minX,
          y: descendantBounds.minY,
          width: descendantBounds.width,
          height: descendantBounds.height,
        },
      });
    }
    const entry: StoryboardDocumentLayerStackEntry = {
      id: layer.id,
      name: layer.name,
      type: layer.type,
      depth: options.depth,
      parentLayerId: options.parentLayerId,
      visible: layer.visible,
      effectiveVisible,
      locked: layer.locked,
      effectiveLocked,
      opacity: layer.opacity,
      effectiveOpacity,
      blendMode: layer.blendMode,
      appliedTransforms: nextAppliedTransforms,
      strokes:
        layer.type === 'drawing'
          ? layer.strokeIds
              .map((strokeId) => options.strokeMap.get(strokeId))
              .filter((stroke): stroke is PencilStroke => Boolean(stroke))
              .map((stroke) => applyTransformsToStroke(stroke, nextAppliedTransforms))
          : [],
    };
    const childEntries = getLayerStackEntries(document, getChildLayerIds(layer), {
      frameIndex: options.frameIndex,
      depth: options.depth + 1,
      parentLayerId: layer.id,
      inheritedVisible: effectiveVisible,
      inheritedLocked: effectiveLocked,
      inheritedOpacity: effectiveOpacity,
      appliedTransforms: nextAppliedTransforms,
      strokeMap: options.strokeMap,
      sheetPivot: options.sheetPivot,
      visited: options.visited,
    });
    options.visited.delete(layerId);
    return [entry, ...childEntries];
  });
};

const getSheetLayerStackEntries = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  frameIndex: number = document.timeline.scrubFrame
): StoryboardDocumentLayerStackEntry[] => {
  const sheet = getSheetById(document, sheetId);
  if (!sheet) return [];
  const strokeMap = getStrokeMap(document);
  const sheetBounds = getStrokeBounds(
    sheet.layerIds.flatMap((layerId) => getLayerDescendantStrokes(document, layerId, strokeMap))
  );
  const sheetEntries = getLayerStackEntries(document, sheet.layerIds, {
    frameIndex,
    depth: 0,
    inheritedVisible: true,
    inheritedLocked: false,
    inheritedOpacity: 1,
    appliedTransforms: [],
    strokeMap,
    sheetPivot: { x: sheetBounds.centerX, y: sheetBounds.centerY },
    visited: new Set<string>(),
  });
  const boardPolishEffectEntries = document.layers
    .filter((layer): layer is StoryboardDocumentEffectLayer => layer.type === 'effect' && layer.effectScope === 'board-polish')
    .map((layer) => ({
      id: layer.id,
      name: layer.name,
      type: layer.type,
      effectId: layer.effectId,
      effectScope: layer.effectScope,
      depth: 0,
      parentLayerId: undefined,
      visible: layer.visible,
      effectiveVisible: layer.visible,
      locked: layer.locked,
      effectiveLocked: layer.locked,
      opacity: layer.opacity,
      effectiveOpacity: layer.opacity,
      blendMode: layer.blendMode,
      strokes: [],
      appliedTransforms: [],
    }));
  return [...sheetEntries, ...boardPolishEffectEntries];
};

const findDrawingDescendantLayerId = (
  document: StoryboardDrawingDocument,
  layerId: string,
  visited: Set<string> = new Set()
): string | undefined => {
  if (visited.has(layerId)) return undefined;
  visited.add(layerId);
  const layer = getLayerById(document, layerId);
  if (!layer) return undefined;
  if (layer.type === 'drawing') return layer.id;
  for (const childLayerId of getChildLayerIds(layer)) {
    const descendant = findDrawingDescendantLayerId(document, childLayerId, visited);
    if (descendant) {
      return descendant;
    }
  }
  return undefined;
};

type LayerContainerTarget =
  | { kind: 'sheet'; sheetId: string; layerIds: string[] }
  | { kind: 'layer'; ownerLayerId: string; ownerType: 'group' | 'transformation'; layerIds: string[] };

const findLayerContainer = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  layerId: string
): LayerContainerTarget | undefined => {
  const sheet = getSheetById(document, sheetId);
  if (!sheet) return undefined;

  const visit = (ids: string[], parent?: { id: string; type: 'group' | 'transformation' }): LayerContainerTarget | undefined => {
    if (ids.includes(layerId)) {
      return parent
        ? { kind: 'layer', ownerLayerId: parent.id, ownerType: parent.type, layerIds: ids }
        : { kind: 'sheet', sheetId, layerIds: ids };
    }

    for (const candidateId of ids) {
      const candidate = getLayerById(document, candidateId);
      if (!candidate || (candidate.type !== 'group' && candidate.type !== 'transformation')) continue;
      const found = visit(candidate.childLayerIds, { id: candidate.id, type: candidate.type });
      if (found) return found;
    }

    return undefined;
  };

  return visit(sheet.layerIds);
};

const applyLayerContainerIds = (
  document: StoryboardDrawingDocument,
  targetSheetId: string,
  container: LayerContainerTarget,
  nextLayerIds: string[],
  updatedAt: string
): StoryboardDrawingDocument => {
  if (container.kind === 'sheet') {
    const familySheetIds = new Set(getLinkedSheetFamilyIds(document, targetSheetId));
    return {
      ...document,
      updatedAt,
      sheets: document.sheets.map((sheet) => (
        familySheetIds.has(sheet.id)
          ? {
              ...sheet,
              layerIds: nextLayerIds,
              updatedAt,
            }
          : sheet
      )),
    };
  }

  return {
    ...document,
    updatedAt,
    layers: document.layers.map((layer) => (
      layer.id === container.ownerLayerId && (layer.type === 'group' || layer.type === 'transformation')
        ? {
            ...layer,
            childLayerIds: nextLayerIds,
            updatedAt,
          }
        : layer
    )),
  };
};

const getLinkedSheetFamilyIds = (
  document: StoryboardDrawingDocument,
  sheetId: string
): string[] => {
  const sourceSheetId = getSheetById(document, sheetId)?.linkedSourceSheetId || sheetId;
  return document.sheets
    .filter((sheet) => sheet.id === sourceSheetId || sheet.linkedSourceSheetId === sourceSheetId)
    .map((sheet) => sheet.id);
};

const getSheetTargetId = (
  document: StoryboardDrawingDocument,
  sheetId: string
): string => getSheetById(document, sheetId)?.linkedSourceSheetId || sheetId;

const getStrokeMap = (
  document: StoryboardDrawingDocument
): Map<string, PencilStroke> => new Map(document.strokes.map((entry) => [entry.id, entry.stroke]));

interface StrokeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

const getStrokeBounds = (strokes: PencilStroke[]): StrokeBounds => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  strokes.forEach((stroke) => {
    stroke.points.forEach((point) => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return {
      minX: 0,
      minY: 0,
      maxX: DEFAULT_CANVAS_WIDTH,
      maxY: DEFAULT_CANVAS_HEIGHT,
      width: DEFAULT_CANVAS_WIDTH,
      height: DEFAULT_CANVAS_HEIGHT,
      centerX: DEFAULT_CANVAS_WIDTH / 2,
      centerY: DEFAULT_CANVAS_HEIGHT / 2,
    };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

const getLayerDescendantStrokes = (
  document: StoryboardDrawingDocument,
  layerId: string,
  strokeMap: Map<string, PencilStroke>,
  visited: Set<string> = new Set()
): PencilStroke[] => {
  if (visited.has(layerId)) return [];
  visited.add(layerId);
  const layer = getLayerById(document, layerId);
  if (!layer) {
    visited.delete(layerId);
    return [];
  }
  if (layer.type === 'drawing') {
    const strokes = layer.strokeIds
      .map((strokeId) => strokeMap.get(strokeId))
      .filter((stroke): stroke is PencilStroke => Boolean(stroke));
    visited.delete(layerId);
    return strokes;
  }
  if (layer.type === 'group' || layer.type === 'transformation') {
    const descendantStrokes = layer.childLayerIds.flatMap((childLayerId) => (
      getLayerDescendantStrokes(document, childLayerId, strokeMap, visited)
    ));
    visited.delete(layerId);
    return descendantStrokes;
  }
  visited.delete(layerId);
  return [];
};

const getTransformationLayerValueAtFrame = (
  layer: StoryboardDocumentTransformationLayer,
  frameIndex: number
): Omit<StoryboardDocumentAppliedTransform, 'layerId' | 'layerName' | 'pivotX' | 'pivotY'> => {
  const sortedKeyframes = [...layer.keyframes].sort((left, right) => left.frame - right.frame);
  if (!sortedKeyframes.length) {
    return {
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      perspectiveX: 0,
      perspectiveY: 0,
      cornerWarp: createIdentityStoryboardDocumentCornerWarp(),
    };
  }

  if (frameIndex <= sortedKeyframes[0].frame) {
    const [first] = sortedKeyframes;
    return {
      translateX: first.translateX,
      translateY: first.translateY,
      scaleX: first.scaleX,
      scaleY: first.scaleY,
      rotation: first.rotation,
      perspectiveX: first.perspectiveX ?? 0,
      perspectiveY: first.perspectiveY ?? 0,
      cornerWarp: normalizeStoryboardDocumentCornerWarp(first.cornerWarp),
    };
  }

  const lastKeyframe = sortedKeyframes[sortedKeyframes.length - 1];
  if (frameIndex >= lastKeyframe.frame) {
    return {
      translateX: lastKeyframe.translateX,
      translateY: lastKeyframe.translateY,
      scaleX: lastKeyframe.scaleX,
      scaleY: lastKeyframe.scaleY,
      rotation: lastKeyframe.rotation,
      perspectiveX: lastKeyframe.perspectiveX ?? 0,
      perspectiveY: lastKeyframe.perspectiveY ?? 0,
      cornerWarp: normalizeStoryboardDocumentCornerWarp(lastKeyframe.cornerWarp),
    };
  }

  for (let index = 1; index < sortedKeyframes.length; index += 1) {
    const previous = sortedKeyframes[index - 1];
    const next = sortedKeyframes[index];
    if (frameIndex > next.frame) continue;
    if (frameIndex === next.frame) {
      return {
        translateX: next.translateX,
        translateY: next.translateY,
        scaleX: next.scaleX,
        scaleY: next.scaleY,
        rotation: next.rotation,
        perspectiveX: next.perspectiveX ?? 0,
        perspectiveY: next.perspectiveY ?? 0,
        cornerWarp: normalizeStoryboardDocumentCornerWarp(next.cornerWarp),
      };
    }
    const duration = Math.max(1, next.frame - previous.frame);
    let progress = (frameIndex - previous.frame) / duration;
    if (previous.easing === 'cut' || next.easing === 'cut') {
      progress = 0;
    } else if (previous.easing === 'ease' || next.easing === 'ease') {
      progress = progress * progress * (3 - (2 * progress));
    }
    return {
      translateX: previous.translateX + ((next.translateX - previous.translateX) * progress),
      translateY: previous.translateY + ((next.translateY - previous.translateY) * progress),
      scaleX: previous.scaleX + ((next.scaleX - previous.scaleX) * progress),
      scaleY: previous.scaleY + ((next.scaleY - previous.scaleY) * progress),
      rotation: previous.rotation + ((next.rotation - previous.rotation) * progress),
      perspectiveX: (previous.perspectiveX ?? 0) + (((next.perspectiveX ?? 0) - (previous.perspectiveX ?? 0)) * progress),
      perspectiveY: (previous.perspectiveY ?? 0) + (((next.perspectiveY ?? 0) - (previous.perspectiveY ?? 0)) * progress),
      cornerWarp: interpolateStoryboardDocumentCornerWarp(
        normalizeStoryboardDocumentCornerWarp(previous.cornerWarp),
        normalizeStoryboardDocumentCornerWarp(next.cornerWarp),
        progress,
      ),
    };
  }

  return {
    translateX: lastKeyframe.translateX,
    translateY: lastKeyframe.translateY,
    scaleX: lastKeyframe.scaleX,
    scaleY: lastKeyframe.scaleY,
    rotation: lastKeyframe.rotation,
    perspectiveX: lastKeyframe.perspectiveX ?? 0,
    perspectiveY: lastKeyframe.perspectiveY ?? 0,
    cornerWarp: normalizeStoryboardDocumentCornerWarp(lastKeyframe.cornerWarp),
  };
};

const applyTransformToPoint = (
  point: PencilStroke['points'][number],
  transform: StoryboardDocumentAppliedTransform
): PencilStroke['points'][number] => {
  const perspectiveX = transform.perspectiveX ?? 0;
  const perspectiveY = transform.perspectiveY ?? 0;
  const rotationRadians = (transform.rotation * Math.PI) / 180;
  let x = point.x - transform.pivotX;
  let y = point.y - transform.pivotY;

  x *= transform.scaleX;
  y *= transform.scaleY;

  if (transform.warpBounds) {
    const cornerWarp = normalizeStoryboardDocumentCornerWarp(transform.cornerWarp);
    const baseLeft = (transform.warpBounds.x - transform.pivotX) * transform.scaleX;
    const baseTop = (transform.warpBounds.y - transform.pivotY) * transform.scaleY;
    const baseWidth = Math.max(0.0001, transform.warpBounds.width * Math.max(0.0001, Math.abs(transform.scaleX)));
    const baseHeight = Math.max(0.0001, transform.warpBounds.height * Math.max(0.0001, Math.abs(transform.scaleY)));
    const u = (x - baseLeft) / baseWidth;
    const v = (y - baseTop) / baseHeight;
    const invU = 1 - u;
    const invV = 1 - v;
    x +=
      (cornerWarp.nw.x * invU * invV) +
      (cornerWarp.ne.x * u * invV) +
      (cornerWarp.se.x * u * v) +
      (cornerWarp.sw.x * invU * v);
    y +=
      (cornerWarp.nw.y * invU * invV) +
      (cornerWarp.ne.y * u * invV) +
      (cornerWarp.se.y * u * v) +
      (cornerWarp.sw.y * invU * v);
  }

  const perspectiveXPosition = x + (y * perspectiveX);
  const perspectiveYPosition = (x * perspectiveY) + y;
  const rotatedX = (perspectiveXPosition * Math.cos(rotationRadians)) - (perspectiveYPosition * Math.sin(rotationRadians));
  const rotatedY = (perspectiveXPosition * Math.sin(rotationRadians)) + (perspectiveYPosition * Math.cos(rotationRadians));

  return {
    ...point,
    x: transform.pivotX + transform.translateX + rotatedX,
    y: transform.pivotY + transform.translateY + rotatedY,
  };
};

const applyTransformsToStroke = (
  stroke: PencilStroke,
  transforms: StoryboardDocumentAppliedTransform[]
): PencilStroke => {
  if (!transforms.length) return stroke;
  return transforms.reduce<PencilStroke>((currentStroke, transform) => ({
    ...currentStroke,
    points: currentStroke.points.map((point) => applyTransformToPoint(point, transform)),
  }), stroke);
};

export const getStoryboardDocumentSheetById = (
  document: StoryboardDrawingDocument,
  sheetId: string
): StoryboardDocumentSheet | undefined => getSheetById(document, sheetId);

export const getStoryboardDocumentSheetLayerStack = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  frameIndex?: number
): StoryboardDocumentLayerStackEntry[] => getSheetLayerStackEntries(document, sheetId, frameIndex);

export const getStoryboardDocumentSheetLayers = (
  document: StoryboardDrawingDocument,
  sheetId: string
): StoryboardDocumentDrawingLayer[] => {
  return getSheetLayerStackEntries(document, sheetId)
    .filter((entry): entry is StoryboardDocumentLayerStackEntry & { type: 'drawing' } => entry.type === 'drawing')
    .map((entry) => getDrawingLayerById(document, entry.id))
    .filter((layer): layer is StoryboardDocumentDrawingLayer => Boolean(layer));
};

export const getStoryboardDocumentActiveLayerId = (
  document: StoryboardDrawingDocument,
  sheetId: string
): string | undefined => {
  const sheet = getSheetById(document, sheetId);
  if (!sheet) return undefined;
  const drawingLayerIds = getStoryboardDocumentSheetLayers(document, sheetId).map((layer) => layer.id);
  const resolvedActiveLayerId = findDrawingDescendantLayerId(document, sheet.activeLayerId || '') || sheet.activeLayerId;
  return drawingLayerIds.includes(resolvedActiveLayerId || '') ? resolvedActiveLayerId : drawingLayerIds[0];
};

export const getStoryboardDocumentActiveDrawingLayer = (
  document: StoryboardDrawingDocument,
  sheetId: string
): StoryboardDocumentDrawingLayer | undefined => {
  const activeLayerId = getStoryboardDocumentActiveLayerId(document, sheetId);
  return activeLayerId ? getDrawingLayerById(document, activeLayerId) : undefined;
};

export const getStoryboardDocumentDrawingLayerStrokes = (
  document: StoryboardDrawingDocument,
  layerId: string
): PencilStroke[] => {
  const layer = getDrawingLayerById(document, layerId);
  if (!layer) return [];
  const strokeMap = getStrokeMap(document);
  return layer.strokeIds
    .map((strokeId) => strokeMap.get(strokeId))
    .filter((stroke): stroke is PencilStroke => Boolean(stroke));
};

export const getStoryboardDocumentSheetRenderableLayers = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  frameIndex: number = document.timeline.scrubFrame
): StoryboardDocumentRenderableLayer[] => (
  getSheetLayerStackEntries(document, sheetId, frameIndex)
    .filter((entry): entry is StoryboardDocumentLayerStackEntry & { type: 'drawing' } => entry.type === 'drawing')
    .map((entry) => ({
      ...entry,
      strokes: entry.strokes,
    }))
);

export const getStoryboardDocumentTimelineFrames = (
  document: StoryboardDrawingDocument
): StoryboardDocumentTimelineFrame[] => {
  const markerMap = new Map<number, string[]>();
  document.markers.forEach((marker) => {
    const existing = markerMap.get(marker.frame);
    if (existing) {
      existing.push(marker.id);
      return;
    }
    markerMap.set(marker.frame, [marker.id]);
  });

  let frameNumber = 0;
  return getOrderedSheets(document.sheets).flatMap((sheet) =>
    Array.from({ length: clampPositiveInteger(sheet.exposure, DEFAULT_EXPOSURE) }, (_, exposureIndex) => {
      const entry: StoryboardDocumentTimelineFrame = {
        timelineIndex: frameNumber,
        frameNumber,
        sheetId: sheet.id,
        sheetName: sheet.name,
        exposureIndex,
        exposureLength: clampPositiveInteger(sheet.exposure, DEFAULT_EXPOSURE),
        linkedSourceSheetId: sheet.linkedSourceSheetId,
        markerIds: markerMap.get(frameNumber) || [],
      };
      frameNumber += 1;
      return entry;
    })
  );
};

export const setStoryboardDrawingDocumentActiveSheet = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const sheet = getSheetById(document, sheetId);
  if (!sheet) return document;
  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    primarySheetId: sheet.id,
    timeline: {
      ...document.timeline,
      scrubFrame: sheet.frameStart,
      selectedSheetIds: [sheet.id],
    },
  }, updatedAt);
};

export const setStoryboardDrawingDocumentActiveLayer = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  layerId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const sheet = getSheetById(document, sheetId);
  const sheetLayerIds = new Set(getSheetLayerStackEntries(document, sheetId).map((entry) => entry.id));
  const resolvedLayerId = getDrawingLayerById(document, layerId)?.id || findDrawingDescendantLayerId(document, layerId);
  if (!sheet || !resolvedLayerId || !sheetLayerIds.has(layerId)) return document;
  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    sheets: document.sheets.map((entry) => (
      entry.id === sheetId
        ? {
            ...entry,
            activeLayerId: resolvedLayerId,
            updatedAt,
          }
        : entry
    )),
  }, updatedAt);
};

export const updateStoryboardDrawingDocumentLayer = (
  document: StoryboardDrawingDocument,
  layerId: string,
  updates: Partial<Pick<StoryboardDocumentLayer, 'name' | 'visible' | 'locked' | 'opacity' | 'blendMode'>>,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  layers: document.layers.map((layer) => (
    layer.id === layerId
      ? {
          ...layer,
          ...updates,
          updatedAt,
        }
      : layer
  )),
}, updatedAt);

export const addStoryboardDrawingDocumentLayer = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  options: {
    name?: string;
    insertAfterLayerId?: string;
  } = {},
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const targetSheetId = getSheetTargetId(document, sheetId);
  const targetSheet = getSheetById(document, targetSheetId);
  if (!targetSheet) return document;

  const nextLayerId = createDocumentId('layer');
  const nextLayer: StoryboardDocumentDrawingLayer = {
    id: nextLayerId,
    type: 'drawing',
    name: options.name || `Drawing Layer ${targetSheet.layerIds.length + 1}`,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    strokeIds: [],
    createdAt: updatedAt,
    updatedAt,
  };
  const insertAfterLayerId = options.insertAfterLayerId || getStoryboardDocumentActiveLayerId(document, sheetId);
  const container = insertAfterLayerId
    ? findLayerContainer(document, targetSheetId, insertAfterLayerId)
    : undefined;
  const baseContainer = container || { kind: 'sheet' as const, sheetId: targetSheetId, layerIds: [...targetSheet.layerIds] };
  const insertAfterIndex = insertAfterLayerId ? baseContainer.layerIds.indexOf(insertAfterLayerId) : baseContainer.layerIds.length - 1;
  const nextLayerIds = [...baseContainer.layerIds];
  nextLayerIds.splice(insertAfterIndex >= 0 ? insertAfterIndex + 1 : nextLayerIds.length, 0, nextLayerId);
  const nextDocument = applyLayerContainerIds({
    ...document,
    updatedAt,
    layers: [...document.layers, nextLayer],
  }, targetSheetId, baseContainer, nextLayerIds, updatedAt);

  return normalizeStoryboardDrawingDocument({
    ...nextDocument,
    sheets: nextDocument.sheets.map((sheet) => (
      sheet.id === sheetId
        ? {
            ...sheet,
            activeLayerId: nextLayerId,
            updatedAt,
          }
        : sheet
    )),
  }, updatedAt);
};

export const groupStoryboardDrawingDocumentLayers = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  layerIds: string[],
  options: {
    name?: string;
  } = {},
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const targetSheetId = getSheetTargetId(document, sheetId);
  const targetSheet = getSheetById(document, targetSheetId);
  if (!targetSheet) return document;

  const container = layerIds[0]
    ? findLayerContainer(document, targetSheetId, layerIds[0])
    : undefined;
  const baseContainer = container || { kind: 'sheet' as const, sheetId: targetSheetId, layerIds: [...targetSheet.layerIds] };
  const orderedLayerIds = baseContainer.layerIds.filter((layerId) => layerIds.includes(layerId));
  if (orderedLayerIds.length < 2) return document;

  const nextGroupId = createDocumentId('layer');
  const insertAt = Math.min(
    ...orderedLayerIds
      .map((entryLayerId) => baseContainer.layerIds.indexOf(entryLayerId))
      .filter((index) => index >= 0)
  );
  const nextLayerIds = baseContainer.layerIds.filter((entryLayerId) => !orderedLayerIds.includes(entryLayerId));
  nextLayerIds.splice(insertAt >= 0 ? insertAt : nextLayerIds.length, 0, nextGroupId);

  const groupLayer: StoryboardDocumentGroupLayer = {
    id: nextGroupId,
    type: 'group',
    name: options.name || `Group ${orderedLayerIds.length}`,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    childLayerIds: orderedLayerIds,
    createdAt: updatedAt,
    updatedAt,
  };

  const nextDocument = applyLayerContainerIds({
    ...document,
    updatedAt,
    layers: [...document.layers, groupLayer],
  }, targetSheetId, baseContainer, nextLayerIds, updatedAt);

  return normalizeStoryboardDrawingDocument(nextDocument, updatedAt);
};

export const ungroupStoryboardDrawingDocumentLayer = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  layerId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const targetSheetId = getSheetTargetId(document, sheetId);
  const groupLayer = getLayerById(document, layerId);
  const container = findLayerContainer(document, targetSheetId, layerId);
  if (!groupLayer || groupLayer.type !== 'group' || !container) return document;

  const groupIndex = container.layerIds.indexOf(layerId);
  if (groupIndex < 0) return document;

  const nextLayerIds = [...container.layerIds];
  nextLayerIds.splice(groupIndex, 1, ...groupLayer.childLayerIds);

  const nextDocument = applyLayerContainerIds({
    ...document,
    updatedAt,
    layers: document.layers.filter((layer) => layer.id !== layerId),
  }, targetSheetId, container, nextLayerIds, updatedAt);

  return normalizeStoryboardDrawingDocument(nextDocument, updatedAt);
};

export const addStoryboardDrawingDocumentTransformationLayer = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  layerIds: string[],
  options: {
    name?: string;
    pivotMode?: StoryboardDocumentTransformationLayer['pivotMode'];
    frame?: number;
  } = {},
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const targetSheetId = getSheetTargetId(document, sheetId);
  const targetSheet = getSheetById(document, targetSheetId);
  if (!targetSheet) return document;

  const container = layerIds[0]
    ? findLayerContainer(document, targetSheetId, layerIds[0])
    : undefined;
  const baseContainer = container || { kind: 'sheet' as const, sheetId: targetSheetId, layerIds: [...targetSheet.layerIds] };
  const orderedLayerIds = baseContainer.layerIds.filter((entry) => layerIds.includes(entry));
  if (!orderedLayerIds.length) return document;

  const nextTransformLayerId = createDocumentId('layer');
  const insertAt = Math.min(
    ...orderedLayerIds
      .map((layerId) => baseContainer.layerIds.indexOf(layerId))
      .filter((index) => index >= 0)
  );
  const nextLayerIds = baseContainer.layerIds.filter((entry) => !orderedLayerIds.includes(entry));
  nextLayerIds.splice(insertAt >= 0 ? insertAt : nextLayerIds.length, 0, nextTransformLayerId);

  const frame = Math.max(0, Math.round(options.frame ?? document.timeline.scrubFrame));
  const transformLayer: StoryboardDocumentTransformationLayer = {
    id: nextTransformLayerId,
    type: 'transformation',
    name: options.name || `Motion Rig ${orderedLayerIds.length}`,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    childLayerIds: orderedLayerIds,
    keyframes: [{
      id: createDocumentId('keyframe'),
      frame,
      translateX: 0,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      perspectiveX: 0,
      perspectiveY: 0,
      cornerWarp: createIdentityStoryboardDocumentCornerWarp(),
      easing: 'linear',
      createdAt: updatedAt,
      updatedAt,
    }],
    pivotMode: options.pivotMode || 'per-layer',
    createdAt: updatedAt,
    updatedAt,
  };

  const nextDocument = applyLayerContainerIds({
    ...document,
    updatedAt,
    layers: [...document.layers, transformLayer],
  }, targetSheetId, baseContainer, nextLayerIds, updatedAt);

  return normalizeStoryboardDrawingDocument(nextDocument, updatedAt);
};

export const removeStoryboardDrawingDocumentLayer = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  layerId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const targetSheetId = getSheetTargetId(document, sheetId);
  const targetLayer = getDrawingLayerById(document, layerId);
  const container = findLayerContainer(document, targetSheetId, layerId);
  const drawingLayerCount = getStoryboardDocumentSheetLayers(document, targetSheetId).length;
  if (!targetLayer || !container || drawingLayerCount <= 1) {
    return document;
  }

  const nextLayerIds = container.layerIds.filter((entry) => entry !== layerId);
  const removedStrokeIds = new Set(targetLayer.strokeIds);
  const nextDocument = applyLayerContainerIds({
    ...document,
    updatedAt,
    layers: document.layers.filter((layer) => layer.id !== layerId),
    strokes: document.strokes.filter((stroke) => !removedStrokeIds.has(stroke.id)),
  }, targetSheetId, container, nextLayerIds, updatedAt);
  const nextActiveLayerId = getStoryboardDocumentActiveLayerId(nextDocument, sheetId);
  return normalizeStoryboardDrawingDocument({
    ...nextDocument,
    sheets: nextDocument.sheets.map((sheet) => (
      sheet.id === sheetId
        ? {
            ...sheet,
            activeLayerId: nextActiveLayerId,
            updatedAt,
          }
        : sheet
    )),
  }, updatedAt);
};

export const duplicateStoryboardDrawingDocumentLayer = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  layerId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const targetSheetId = getSheetTargetId(document, sheetId);
  const sourceLayer = getDrawingLayerById(document, layerId);
  const container = findLayerContainer(document, targetSheetId, layerId);
  if (!sourceLayer || !container) return document;

  const strokeMap = new Map(document.strokes.map((stroke) => [stroke.id, stroke]));
  const nextStrokeRecords: StoryboardDocumentStrokeRecord[] = sourceLayer.strokeIds.map((strokeId) => {
    const sourceStroke = strokeMap.get(strokeId);
    const nextStrokeId = createDocumentId('stroke');
    return {
      id: nextStrokeId,
      stroke: sourceStroke?.stroke || {
        inputType: 'pen',
        color: '#ffffff',
        width: 3,
        opacity: 1,
        points: [],
      },
      createdAt: updatedAt,
      updatedAt,
    };
  });
  const nextLayerId = createDocumentId('layer');
  const nextLayer: StoryboardDocumentDrawingLayer = {
    ...sourceLayer,
    id: nextLayerId,
    name: `${sourceLayer.name} Copy`,
    strokeIds: nextStrokeRecords.map((stroke) => stroke.id),
    createdAt: updatedAt,
    updatedAt,
  };
  const insertAt = container.layerIds.indexOf(layerId);
  const nextLayerIds = [...container.layerIds];
  nextLayerIds.splice(insertAt >= 0 ? insertAt + 1 : nextLayerIds.length, 0, nextLayerId);
  const nextDocument = applyLayerContainerIds({
    ...document,
    updatedAt,
    layers: [...document.layers, nextLayer],
    strokes: [...document.strokes, ...nextStrokeRecords],
  }, targetSheetId, container, nextLayerIds, updatedAt);

  return normalizeStoryboardDrawingDocument({
    ...nextDocument,
    sheets: nextDocument.sheets.map((sheet) => (
      sheet.id === sheetId
        ? {
            ...sheet,
            activeLayerId: nextLayerId,
            updatedAt,
          }
        : sheet
    )),
  }, updatedAt);
};

export const reorderStoryboardDrawingDocumentLayer = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  layerId: string,
  toIndex: number,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const targetSheetId = getSheetTargetId(document, sheetId);
  const container = findLayerContainer(document, targetSheetId, layerId);
  if (!container) return document;
  const fromIndex = container.layerIds.indexOf(layerId);
  if (fromIndex < 0) return document;
  const clampedToIndex = Math.max(0, Math.min(container.layerIds.length - 1, toIndex));
  if (fromIndex === clampedToIndex) return document;

  const nextLayerIds = [...container.layerIds];
  const [movedLayerId] = nextLayerIds.splice(fromIndex, 1);
  nextLayerIds.splice(clampedToIndex, 0, movedLayerId);

  return normalizeStoryboardDrawingDocument(
    applyLayerContainerIds(document, targetSheetId, container, nextLayerIds, updatedAt),
    updatedAt,
  );
};

export const mergeStoryboardDrawingDocumentLayerDown = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  layerId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const targetSheetId = getSheetTargetId(document, sheetId);
  const container = findLayerContainer(document, targetSheetId, layerId);
  if (!container) return document;
  const sourceIndex = container.layerIds.indexOf(layerId);
  if (sourceIndex < 0 || sourceIndex >= container.layerIds.length - 1) return document;

  const sourceLayer = getDrawingLayerById(document, layerId);
  const targetLayerId = container.layerIds[sourceIndex + 1];
  const targetLayer = getDrawingLayerById(document, targetLayerId);
  if (!sourceLayer || !targetLayer) return document;

  const nextLayerIds = container.layerIds.filter((entry) => entry !== layerId);
  const nextDocument = applyLayerContainerIds({
    ...document,
    updatedAt,
    layers: document.layers
      .filter((layer) => layer.id !== layerId)
      .map((layer) => (
        layer.id === targetLayerId
          ? {
              ...layer,
              strokeIds: [...targetLayer.strokeIds, ...sourceLayer.strokeIds],
              updatedAt,
            }
          : layer
      )),
  }, targetSheetId, container, nextLayerIds, updatedAt);
  return normalizeStoryboardDrawingDocument({
    ...nextDocument,
    sheets: nextDocument.sheets.map((sheet) => (
      sheet.id === sheetId && sheet.activeLayerId === layerId
        ? {
            ...sheet,
            activeLayerId: targetLayerId,
            updatedAt,
          }
        : sheet
    )),
  }, updatedAt);
};

export const getStoryboardDocumentTransformationLayerById = (
  document: StoryboardDrawingDocument,
  layerId: string
): StoryboardDocumentTransformationLayer | undefined => {
  const layer = getLayerById(document, layerId);
  return layer?.type === 'transformation' ? layer : undefined;
};

export const getStoryboardDocumentTransformationLayerPreview = (
  document: StoryboardDrawingDocument,
  transformationLayerId: string,
  frameIndex: number = document.timeline.scrubFrame
): {
  layer: StoryboardDocumentTransformationLayer;
  currentTransform: Omit<StoryboardDocumentAppliedTransform, 'layerId' | 'layerName' | 'pivotX' | 'pivotY'>;
  keyframeCount: number;
  activeKeyframe?: StoryboardDocumentTransformationKeyframe;
} | undefined => {
  const layer = getStoryboardDocumentTransformationLayerById(document, transformationLayerId);
  if (!layer) return undefined;
  return {
    layer,
    currentTransform: getTransformationLayerValueAtFrame(layer, frameIndex),
    keyframeCount: layer.keyframes.length,
    activeKeyframe: layer.keyframes.find((entry) => entry.frame === frameIndex),
  };
};

export const upsertStoryboardDrawingDocumentTransformationKeyframe = (
  document: StoryboardDrawingDocument,
  transformationLayerId: string,
  frame: number,
  updates: Partial<Omit<StoryboardDocumentTransformationKeyframe, 'id' | 'frame' | 'createdAt' | 'updatedAt'>>,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const transformationLayer = getStoryboardDocumentTransformationLayerById(document, transformationLayerId);
  if (!transformationLayer) return document;

  const clampedFrame = Math.max(0, Math.round(frame));
  const existingKeyframe = transformationLayer.keyframes.find((entry) => entry.frame === clampedFrame);
  const nextKeyframe: StoryboardDocumentTransformationKeyframe = existingKeyframe
    ? {
        ...existingKeyframe,
        ...updates,
        frame: clampedFrame,
        perspectiveX: updates.perspectiveX ?? existingKeyframe.perspectiveX ?? 0,
        perspectiveY: updates.perspectiveY ?? existingKeyframe.perspectiveY ?? 0,
        cornerWarp: updates.cornerWarp ?? existingKeyframe.cornerWarp ?? createIdentityStoryboardDocumentCornerWarp(),
        updatedAt,
      }
    : {
        id: createDocumentId('keyframe'),
        frame: clampedFrame,
        translateX: updates.translateX ?? 0,
        translateY: updates.translateY ?? 0,
        scaleX: updates.scaleX ?? 1,
        scaleY: updates.scaleY ?? 1,
        rotation: updates.rotation ?? 0,
        perspectiveX: updates.perspectiveX ?? 0,
        perspectiveY: updates.perspectiveY ?? 0,
        cornerWarp: updates.cornerWarp ?? createIdentityStoryboardDocumentCornerWarp(),
        easing: updates.easing ?? 'linear',
        createdAt: updatedAt,
        updatedAt,
      };

  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    layers: document.layers.map((layer) => {
      if (layer.id !== transformationLayerId || layer.type !== 'transformation') return layer;
      const nextKeyframes = existingKeyframe
        ? layer.keyframes.map((entry) => (entry.id === existingKeyframe.id ? nextKeyframe : entry))
        : [...layer.keyframes, nextKeyframe];
      return {
        ...layer,
        keyframes: nextKeyframes.sort((left, right) => left.frame - right.frame),
        updatedAt,
      };
    }),
  }, updatedAt);
};

export const setStoryboardDrawingDocumentScrubFrame = (
  document: StoryboardDrawingDocument,
  frameIndex: number,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const timelineFrames = getStoryboardDocumentTimelineFrames(document);
  if (!timelineFrames.length) return document;
  const clampedFrame = Math.max(0, Math.min(timelineFrames.length - 1, Math.round(frameIndex)));
  const timelineFrame = timelineFrames[clampedFrame];
  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    primarySheetId: timelineFrame.sheetId,
    timeline: {
      ...document.timeline,
      scrubFrame: clampedFrame,
      selectedSheetIds: [timelineFrame.sheetId],
    },
  }, updatedAt);
};

export const updateStoryboardDrawingDocumentTimelineState = (
  document: StoryboardDrawingDocument,
  updates: Partial<StoryboardDocumentTimelineState>,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  timeline: {
    ...document.timeline,
    ...updates,
  },
}, updatedAt);

export const updateStoryboardDrawingDocumentSheetExposure = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  exposure: number,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  sheets: document.sheets.map((sheet) => (
    sheet.id === sheetId
      ? {
          ...sheet,
          exposure: clampPositiveInteger(exposure, document.timeline.defaultExposure),
          updatedAt,
        }
      : sheet
  )),
}, updatedAt);

export const addStoryboardDrawingDocumentSheet = (
  document: StoryboardDrawingDocument,
  options: {
    afterSheetId?: string;
    name?: string;
    linkedSourceSheetId?: string;
    exposure?: number;
  } = {},
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const orderedSheets = getOrderedSheets(document.sheets);
  const referenceSheet = options.afterSheetId
    ? getSheetById(document, options.afterSheetId)
    : orderedSheets[orderedSheets.length - 1];
  const referenceIndex = referenceSheet ? orderedSheets.findIndex((sheet) => sheet.id === referenceSheet.id) : orderedSheets.length - 1;
  const insertAt = referenceIndex >= 0 ? referenceIndex + 1 : orderedSheets.length;
  const newSheetId = createDocumentId('sheet');
  const newLayerId = createDocumentId('layer');
  const nextSheetNumber = orderedSheets.length + 1;
  const linkedSourceSheet = options.linkedSourceSheetId
    ? getSheetById(document, options.linkedSourceSheetId)
    : undefined;
  const layerIds = options.linkedSourceSheetId
    ? (linkedSourceSheet?.layerIds || [newLayerId])
    : [newLayerId];
  const activeLayerId = options.linkedSourceSheetId
    ? (linkedSourceSheet?.activeLayerId || layerIds[0])
    : newLayerId;
  const nextLayers = options.linkedSourceSheetId
    ? document.layers
    : [
        ...document.layers,
        {
          id: newLayerId,
          type: 'drawing' as const,
          name: `Drawing Layer ${nextSheetNumber}`,
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'normal' as const,
          strokeIds: [],
          createdAt: updatedAt,
          updatedAt,
        },
      ];

  const nextSheets = [...orderedSheets];
  nextSheets.splice(insertAt, 0, {
    id: newSheetId,
    name: options.name || `Sheet ${nextSheetNumber}`,
    index: insertAt,
    exposure: clampPositiveInteger(options.exposure, document.timeline.defaultExposure),
    durationMs: Math.round((1000 / clampPositiveInteger(document.timeline.fps, DEFAULT_FPS)) * clampPositiveInteger(options.exposure, document.timeline.defaultExposure)),
    frameStart: 0,
    layerIds,
    activeLayerId,
    linkedSourceSheetId: options.linkedSourceSheetId,
    markerIds: [],
    createdAt: updatedAt,
    updatedAt,
  });

  return setStoryboardDrawingDocumentActiveSheet(normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    layers: nextLayers,
    sheets: nextSheets,
  }, updatedAt), newSheetId, updatedAt);
};

export const duplicateStoryboardDrawingDocumentSheet = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  options: {
    linked?: boolean;
    name?: string;
  } = {},
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const sourceSheet = getSheetById(document, sheetId);
  if (!sourceSheet) return document;

  if (options.linked) {
    return addStoryboardDrawingDocumentSheet(document, {
      afterSheetId: sourceSheet.id,
      name: options.name || `${sourceSheet.name} Link`,
      linkedSourceSheetId: sourceSheet.id,
      exposure: sourceSheet.exposure,
    }, updatedAt);
  }

  const cloned = cloneSheetLayersAndStrokes(document, sourceSheet, updatedAt);
  const nextSheetId = createDocumentId('sheet');
  const orderedSheets = getOrderedSheets(document.sheets);
  const sourceIndex = orderedSheets.findIndex((sheet) => sheet.id === sourceSheet.id);
  const insertAt = sourceIndex >= 0 ? sourceIndex + 1 : orderedSheets.length;
  const nextSheets = [...orderedSheets];
  nextSheets.splice(insertAt, 0, {
    ...sourceSheet,
    id: nextSheetId,
    name: options.name || `${sourceSheet.name} Copy`,
    index: insertAt,
    frameStart: 0,
    layerIds: cloned.layerIds,
    activeLayerId: cloned.activeLayerId || cloned.layerIds[0],
    linkedSourceSheetId: undefined,
    createdAt: updatedAt,
    updatedAt,
  });

  return setStoryboardDrawingDocumentActiveSheet(normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    layers: [...document.layers, ...cloned.layers],
    strokes: [...document.strokes, ...cloned.strokes],
    sheets: nextSheets,
  }, updatedAt), nextSheetId, updatedAt);
};

export const addStoryboardDrawingDocumentMarker = (
  document: StoryboardDrawingDocument,
  options: {
    frame?: number;
    label?: string;
    color?: string;
  } = {},
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const timelineFrames = getStoryboardDocumentTimelineFrames(document);
  const clampedFrame = timelineFrames.length > 0
    ? Math.max(0, Math.min(timelineFrames.length - 1, Math.round(options.frame ?? document.timeline.scrubFrame)))
    : 0;
  const markerId = createDocumentId('marker');
  const marker = {
    id: markerId,
    frame: clampedFrame,
    label: options.label || `Marker ${document.markers.length + 1}`,
    color: options.color || '#f6b24d',
    createdAt: updatedAt,
    updatedAt,
  };
  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    markers: [...document.markers, marker],
    timeline: {
      ...document.timeline,
      selectedMarkerIds: [markerId],
    },
  }, updatedAt);
};

export const removeStoryboardDrawingDocumentMarker = (
  document: StoryboardDrawingDocument,
  markerId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  markers: document.markers.filter((marker) => marker.id !== markerId),
  timeline: {
    ...document.timeline,
    selectedMarkerIds: document.timeline.selectedMarkerIds.filter((selectedId) => selectedId !== markerId),
  },
}, updatedAt);

export const getStoryboardDocumentSheetStrokes = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  frameIndex: number = document.timeline.scrubFrame
): PencilStroke[] => {
  return getStoryboardDocumentSheetRenderableLayers(document, sheetId, frameIndex)
    .filter((layer) => layer.effectiveVisible)
    .flatMap((layer) => layer.strokes);
};

export const getPrimaryStoryboardDocumentStrokes = (
  document: StoryboardDrawingDocument
): PencilStroke[] => getStoryboardDocumentSheetStrokes(document, document.primarySheetId);

export const getPrimaryStoryboardDocumentReferenceImage = (
  document: StoryboardDrawingDocument
): StoryboardDocumentReferenceImage | undefined => (
  document.references.find((reference) => reference.visible) || document.references[0]
);

export const getStoryboardDocumentReferenceById = (
  document: StoryboardDrawingDocument,
  referenceId: string
): StoryboardDocumentReferenceImage | undefined => (
  document.references.find((reference) => reference.id === referenceId)
);

export const addStoryboardDrawingDocumentReference = (
  document: StoryboardDrawingDocument,
  options: {
    id?: string;
    name?: string;
    src?: string;
    opacity?: number;
    visible?: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    fitMode?: StoryboardDocumentReferenceImage['fitMode'];
  } = {},
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const nextReferenceIndex = document.references.length + 1;
  const nextReference: StoryboardDocumentReferenceImage = {
    id: options.id || createDocumentId('reference'),
    name: options.name || `Reference ${nextReferenceIndex}`,
    src: options.src || document.metadata.baseImageUrl || document.metadata.lastCompositeImageUrl || '',
    opacity: typeof options.opacity === 'number' ? options.opacity : 0.62,
    visible: typeof options.visible === 'boolean' ? options.visible : true,
    x: typeof options.x === 'number' ? options.x : 96 + ((nextReferenceIndex - 1) * 24),
    y: typeof options.y === 'number' ? options.y : 96 + ((nextReferenceIndex - 1) * 16),
    width: typeof options.width === 'number' ? options.width : 420,
    height: typeof options.height === 'number' ? options.height : 240,
    rotation: typeof options.rotation === 'number' ? options.rotation : 0,
    fitMode: options.fitMode || 'contain',
    createdAt: updatedAt,
    updatedAt,
  };
  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    references: [...document.references, nextReference],
  }, updatedAt);
};

export const updateStoryboardDrawingDocumentReference = (
  document: StoryboardDrawingDocument,
  referenceId: string,
  updates: Partial<Pick<StoryboardDocumentReferenceImage, 'name' | 'src' | 'opacity' | 'visible' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'fitMode'>>,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  references: document.references.map((reference) => (
    reference.id === referenceId
      ? {
          ...reference,
          ...updates,
          updatedAt,
        }
      : reference
  )),
}, updatedAt);

export const removeStoryboardDrawingDocumentReference = (
  document: StoryboardDrawingDocument,
  referenceId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  references: document.references.filter((reference) => reference.id !== referenceId),
}, updatedAt);

export const getStoryboardDocumentCanvasById = (
  document: StoryboardDrawingDocument,
  canvasId: string
): StoryboardDocumentSpatialCanvas | undefined => (
  document.canvases.find((canvas) => canvas.id === canvasId)
);

export const getPrimaryStoryboardDocumentCanvas = (
  document: StoryboardDrawingDocument
): StoryboardDocumentSpatialCanvas | undefined => (
  getStoryboardDocumentCanvasById(document, document.primaryCanvasId) || document.canvases[0]
);

export const getStoryboardDocumentCanvasBookmarks = (
  document: StoryboardDrawingDocument,
  canvasId: string
): StoryboardDocumentBookmarkView[] => {
  const canvas = getStoryboardDocumentCanvasById(document, canvasId);
  if (!canvas) return [];
  return canvas.bookmarkIds
    .map((bookmarkId) => document.bookmarks.find((bookmark) => bookmark.id === bookmarkId))
    .filter((bookmark): bookmark is StoryboardDocumentBookmarkView => Boolean(bookmark));
};

export const getStoryboardDocumentBookmarkCanvasId = (
  document: StoryboardDrawingDocument,
  bookmarkId: string
): string | undefined => (
  document.canvases.find((canvas) => canvas.bookmarkIds.includes(bookmarkId))?.id
);

export const setStoryboardDrawingDocumentPrimaryCanvas = (
  document: StoryboardDrawingDocument,
  canvasId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const canvas = getStoryboardDocumentCanvasById(document, canvasId);
  if (!canvas) return document;
  return normalizeStoryboardDrawingDocument({
    ...document,
    primaryCanvasId: canvas.id,
    updatedAt,
    projection: {
      ...document.projection,
      sourceCanvasId: document.projection.sourceCanvasId || canvas.id,
      targetCanvasId: document.projection.targetCanvasId || canvas.id,
    },
  }, updatedAt);
};

export const updateStoryboardDrawingDocumentProjection = (
  document: StoryboardDrawingDocument,
  updates: Partial<StoryboardDocumentProjectionState>,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const sourceCanvasId = updates.sourceCanvasId ?? document.projection.sourceCanvasId ?? document.primaryCanvasId;
  const targetCanvasId = updates.targetCanvasId ?? document.projection.targetCanvasId ?? document.primaryCanvasId;
  const resolvedSourceCanvasId = getStoryboardDocumentCanvasById(document, sourceCanvasId || '')?.id || document.primaryCanvasId;
  const resolvedTargetCanvasId = getStoryboardDocumentCanvasById(document, targetCanvasId || '')?.id || document.primaryCanvasId;
  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    projection: {
      ...document.projection,
      ...updates,
      sourceCanvasId: resolvedSourceCanvasId,
      targetCanvasId: resolvedTargetCanvasId,
    },
  }, updatedAt);
};

export const addStoryboardDrawingDocumentCanvas = (
  document: StoryboardDrawingDocument,
  options: {
    name?: string;
    aspectRatio?: StoryboardDocumentAspectRatio;
    sheetIds?: string[];
    select?: boolean;
  } = {},
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const baseCanvas = getPrimaryStoryboardDocumentCanvas(document) || document.canvases[0];
  const nextCanvasId = createDocumentId('canvas');
  const nextCanvasCount = document.canvases.length + 1;
  const nextSheetIds = Array.from(new Set((options.sheetIds && options.sheetIds.length > 0 ? options.sheetIds : [document.primarySheetId]).filter(Boolean)));
  const nextCanvas: StoryboardDocumentSpatialCanvas = {
    id: nextCanvasId,
    name: options.name || `Canvas ${nextCanvasCount}`,
    width: baseCanvas?.width || DEFAULT_CANVAS_WIDTH,
    height: baseCanvas?.height || DEFAULT_CANVAS_HEIGHT,
    aspectRatio: options.aspectRatio || baseCanvas?.aspectRatio || document.aspectRatio,
    sheetIds: nextSheetIds,
    bookmarkIds: [],
    transform: {
      x: (baseCanvas?.transform.x || 0) + 220,
      y: (baseCanvas?.transform.y || 0) + 120,
      z: (baseCanvas?.transform.z || 0) + 24,
      rotationX: baseCanvas?.transform.rotationX || 0,
      rotationY: baseCanvas?.transform.rotationY || 0,
      rotationZ: baseCanvas?.transform.rotationZ || 0,
      scale: baseCanvas?.transform.scale || 1,
    },
    createdAt: updatedAt,
    updatedAt,
  };

  const nextDocument = normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    canvases: [...document.canvases, nextCanvas],
    primaryCanvasId: options.select === false ? document.primaryCanvasId : nextCanvasId,
  }, updatedAt);

  return updateStoryboardDrawingDocumentProjection(nextDocument, {
    sourceCanvasId: nextDocument.projection.sourceCanvasId || nextCanvasId,
    targetCanvasId: nextDocument.projection.targetCanvasId || nextCanvasId,
  }, updatedAt);
};

export const updateStoryboardDrawingDocumentCanvas = (
  document: StoryboardDrawingDocument,
  canvasId: string,
  updates: Partial<Pick<StoryboardDocumentSpatialCanvas, 'name' | 'width' | 'height' | 'aspectRatio' | 'sheetIds'>>,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  canvases: document.canvases.map((canvas) => (
    canvas.id === canvasId
      ? {
          ...canvas,
          ...updates,
          updatedAt,
        }
      : canvas
  )),
}, updatedAt);

export const updateStoryboardDrawingDocumentCanvasTransform = (
  document: StoryboardDrawingDocument,
  canvasId: string,
  updates: Partial<StoryboardDocumentSpatialCanvas['transform']>,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  canvases: document.canvases.map((canvas) => (
    canvas.id === canvasId
      ? {
          ...canvas,
          transform: {
            ...canvas.transform,
            ...updates,
          },
          updatedAt,
        }
      : canvas
  )),
}, updatedAt);

export const applyStoryboardDrawingDocumentBookmarkView = (
  document: StoryboardDrawingDocument,
  bookmarkId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const bookmark = document.bookmarks.find((entry) => entry.id === bookmarkId);
  const canvasId = getStoryboardDocumentBookmarkCanvasId(document, bookmarkId);
  const canvas = canvasId ? getStoryboardDocumentCanvasById(document, canvasId) : undefined;
  if (!bookmark || !canvas) {
    return document;
  }

  return normalizeStoryboardDrawingDocument({
    ...document,
    primaryCanvasId: canvas.id,
    updatedAt,
    canvases: document.canvases.map((entry) => (
      entry.id === canvas.id
        ? {
            ...entry,
            transform: {
              x: bookmark.camera.x,
              y: bookmark.camera.y,
              z: bookmark.camera.z,
              rotationX: bookmark.camera.rotationX,
              rotationY: bookmark.camera.rotationY,
              rotationZ: bookmark.camera.rotationZ,
              scale: Math.max(0.25, bookmark.camera.zoom),
            },
            updatedAt,
          }
        : entry
    )),
  }, updatedAt);
};

export const applyStoryboardDrawingDocumentProjection = (
  document: StoryboardDrawingDocument,
  options: {
    sheetId?: string;
  } = {},
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const sourceCanvas = getStoryboardDocumentCanvasById(
    document,
    document.projection.sourceCanvasId || document.primaryCanvasId,
  ) || getPrimaryStoryboardDocumentCanvas(document);
  const targetCanvas = getStoryboardDocumentCanvasById(
    document,
    document.projection.targetCanvasId || document.primaryCanvasId,
  ) || getPrimaryStoryboardDocumentCanvas(document);
  const targetSheet = getSheetById(document, options.sheetId || document.primarySheetId) || document.sheets[0];

  if (!sourceCanvas || !targetCanvas || !targetSheet || sourceCanvas.id === targetCanvas.id) {
    return document;
  }

  const projectionCount = document.projection.appliedCount + 1;
  const projectionLabel = document.projection.mode === 'rearrange'
    ? 'Rearrange Pass'
    : document.projection.mode === 'projection'
      ? 'Projection Pass'
      : 'Planar Pass';
  const projectionBookmarkId = createDocumentId('bookmark');
  const nextVisibleCanvasIds = document.projection.arrangeAfterDrawing
    ? [targetCanvas.id]
    : Array.from(new Set([sourceCanvas.id, targetCanvas.id]));
  const projectedTransform = document.projection.mode === 'rearrange'
    ? {
        x: sourceCanvas.transform.x + 320,
        y: sourceCanvas.transform.y - 48,
        z: sourceCanvas.transform.z + 64,
        rotationX: sourceCanvas.transform.rotationX,
        rotationY: sourceCanvas.transform.rotationY - 6,
        rotationZ: sourceCanvas.transform.rotationZ,
        scale: Math.max(0.4, sourceCanvas.transform.scale * 0.92),
      }
    : document.projection.mode === 'projection'
      ? {
          x: sourceCanvas.transform.x + 140,
          y: sourceCanvas.transform.y + 72,
          z: sourceCanvas.transform.z + 36,
          rotationX: sourceCanvas.transform.rotationX,
          rotationY: sourceCanvas.transform.rotationY + 12,
          rotationZ: sourceCanvas.transform.rotationZ,
          scale: Math.max(0.4, sourceCanvas.transform.scale * 0.96),
        }
      : {
          ...sourceCanvas.transform,
        };
  const projectionBookmark: StoryboardDocumentBookmarkView = {
    id: projectionBookmarkId,
    name: `${projectionLabel} ${projectionCount}`,
    timingMs: document.projection.mode === 'planar' ? 900 : 1200,
    transition: document.projection.mode === 'rearrange' ? 'linear' : 'ease',
    visibleCanvasIds: nextVisibleCanvasIds,
    camera: {
      x: projectedTransform.x,
      y: projectedTransform.y,
      z: projectedTransform.z,
      zoom: document.projection.mode === 'planar' ? 1.02 : document.projection.mode === 'projection' ? 1.12 : 1.18,
      rotationX: projectedTransform.rotationX,
      rotationY: projectedTransform.rotationY,
      rotationZ: projectedTransform.rotationZ,
    },
    createdAt: updatedAt,
    updatedAt,
  };

  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    bookmarks: [...document.bookmarks, projectionBookmark],
    canvases: document.canvases.map((canvas) => (
      canvas.id === targetCanvas.id
        ? {
            ...canvas,
            sheetIds: Array.from(new Set([...canvas.sheetIds, targetSheet.id])),
            bookmarkIds: [...canvas.bookmarkIds, projectionBookmarkId],
            transform: projectedTransform,
            updatedAt,
          }
        : canvas
    )),
    projection: {
      ...document.projection,
      appliedCount: projectionCount,
      lastProjectedAt: updatedAt,
      lastProjectedSheetId: targetSheet.id,
      lastProjectedBookmarkId: projectionBookmarkId,
    },
  }, updatedAt);
};

export const attachStoryboardDrawingDocumentSheetToCanvas = (
  document: StoryboardDrawingDocument,
  canvasId: string,
  sheetId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const canvas = getStoryboardDocumentCanvasById(document, canvasId);
  const sheet = getStoryboardDocumentSheetById(document, sheetId);
  if (!canvas || !sheet) return document;
  if (canvas.sheetIds.includes(sheet.id)) return document;
  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    canvases: document.canvases.map((entry) => (
      entry.id === canvas.id
        ? {
            ...entry,
            sheetIds: [...entry.sheetIds, sheet.id],
            updatedAt,
          }
        : entry
    )),
  }, updatedAt);
};

export const addStoryboardDrawingDocumentBookmark = (
  document: StoryboardDrawingDocument,
  options: {
    canvasId?: string;
    name?: string;
    timingMs?: number;
    transition?: StoryboardDocumentTransition;
    visibleCanvasIds?: string[];
    camera?: StoryboardDocumentBookmarkView['camera'];
  } = {},
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const targetCanvas = getStoryboardDocumentCanvasById(
    document,
    options.canvasId || document.primaryCanvasId,
  ) || document.canvases[0];
  if (!targetCanvas) return document;

  const nextBookmarkId = createDocumentId('bookmark');
  const nextBookmarkCount = document.bookmarks.length + 1;
  const bookmark: StoryboardDocumentBookmarkView = {
    id: nextBookmarkId,
    name: options.name || `Bookmark ${nextBookmarkCount}`,
    timingMs: typeof options.timingMs === 'number' ? options.timingMs : 1800,
    transition: options.transition || 'ease',
    visibleCanvasIds: options.visibleCanvasIds && options.visibleCanvasIds.length > 0
      ? Array.from(new Set(options.visibleCanvasIds))
      : [targetCanvas.id],
    camera: options.camera || {
      x: targetCanvas.transform.x,
      y: targetCanvas.transform.y,
      z: targetCanvas.transform.z,
      zoom: 1 + (document.timeline.scrubFrame * 0.02),
      rotationX: targetCanvas.transform.rotationX,
      rotationY: targetCanvas.transform.rotationY,
      rotationZ: targetCanvas.transform.rotationZ,
    },
    createdAt: updatedAt,
    updatedAt,
  };

  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    bookmarks: [...document.bookmarks, bookmark],
    canvases: document.canvases.map((canvas) => (
      canvas.id === targetCanvas.id
        ? {
            ...canvas,
            bookmarkIds: [...canvas.bookmarkIds, bookmark.id],
            updatedAt,
          }
        : canvas
    )),
  }, updatedAt);
};

export const updateStoryboardDrawingDocumentBookmark = (
  document: StoryboardDrawingDocument,
  bookmarkId: string,
  updates: Partial<Pick<StoryboardDocumentBookmarkView, 'name' | 'timingMs' | 'transition' | 'visibleCanvasIds' | 'camera'>>,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const bookmark = document.bookmarks.find((entry) => entry.id === bookmarkId);
  if (!bookmark) return document;

  const nextVisibleCanvasIds = Array.isArray(updates.visibleCanvasIds)
    ? Array.from(new Set(
        updates.visibleCanvasIds.filter((canvasId) => Boolean(getStoryboardDocumentCanvasById(document, canvasId)))
      ))
    : bookmark.visibleCanvasIds;

  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    bookmarks: document.bookmarks.map((entry) => (
      entry.id === bookmark.id
        ? {
            ...entry,
            ...updates,
            timingMs:
              typeof updates.timingMs === 'number'
                ? Math.max(400, Math.round(updates.timingMs))
                : entry.timingMs,
            visibleCanvasIds:
              nextVisibleCanvasIds.length > 0
                ? nextVisibleCanvasIds
                : [document.primaryCanvasId],
            updatedAt,
          }
        : entry
    )),
  }, updatedAt);
};

export const removeStoryboardDrawingDocumentBookmark = (
  document: StoryboardDrawingDocument,
  bookmarkId: string,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  bookmarks: document.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
  canvases: document.canvases.map((canvas) => ({
    ...canvas,
    bookmarkIds: canvas.bookmarkIds.filter((entryId) => entryId !== bookmarkId),
    updatedAt: canvas.bookmarkIds.includes(bookmarkId) ? updatedAt : canvas.updatedAt,
  })),
}, updatedAt);

export const reorderStoryboardDrawingDocumentCanvasBookmarks = (
  document: StoryboardDrawingDocument,
  canvasId: string,
  bookmarkId: string,
  offset: number,
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => {
  const canvas = getStoryboardDocumentCanvasById(document, canvasId);
  if (!canvas || offset === 0) return document;

  const currentIndex = canvas.bookmarkIds.indexOf(bookmarkId);
  if (currentIndex === -1) return document;

  const nextIndex = Math.max(0, Math.min(canvas.bookmarkIds.length - 1, currentIndex + offset));
  if (nextIndex === currentIndex) return document;

  const nextBookmarkIds = [...canvas.bookmarkIds];
  nextBookmarkIds.splice(currentIndex, 1);
  nextBookmarkIds.splice(nextIndex, 0, bookmarkId);

  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    canvases: document.canvases.map((entry) => (
      entry.id === canvas.id
        ? {
            ...entry,
            bookmarkIds: nextBookmarkIds,
            updatedAt,
          }
        : entry
    )),
  }, updatedAt);
};

export const updateStoryboardDrawingDocumentSheetContent = (
  document: StoryboardDrawingDocument,
  sheetId: string,
  seed: {
    strokes: PencilStroke[];
    layerId?: string;
    brushSettings?: StoryboardDocumentBrushSettings;
    baseImageUrl?: string;
    imageDataUrl?: string;
    workflowLevel?: StoryboardDocumentWorkflowLevel;
    updatedAt?: string;
    referenceImage?: StoryboardDrawingDocumentSeed['referenceImage'];
  }
): StoryboardDrawingDocument => {
  const updatedAt = seed.updatedAt || new Date().toISOString();
  const targetSheetId = getSheetTargetId(document, sheetId);
  const targetSheet = getSheetById(document, targetSheetId) || document.sheets[0];
  const targetLayerId = seed.layerId && getSheetLayerStackEntries(document, targetSheetId).some((entry) => entry.id === seed.layerId)
    ? seed.layerId
    : getStoryboardDocumentActiveLayerId(document, sheetId)
      || getStoryboardDocumentActiveLayerId(document, targetSheetId);
  const targetLayer = targetLayerId ? getDrawingLayerById(document, targetLayerId) : undefined;

  if (!targetSheet || !targetLayer) {
    return createStoryboardDrawingDocument({
      frameId: document.frameId,
      storyboardId: document.storyboardId,
      aspectRatio: document.aspectRatio,
      workflowLevel: seed.workflowLevel || document.metadata.workflowLevel,
      baseImageUrl: seed.baseImageUrl || document.metadata.baseImageUrl,
      originalBaseImageUrl: document.metadata.originalBaseImageUrl,
      imageDataUrl: seed.imageDataUrl || document.metadata.lastCompositeImageUrl,
      strokes: seed.strokes,
      brushSettings: seed.brushSettings || document.metadata.brushSettings,
      referenceImage: seed.referenceImage,
      createdAt: document.createdAt,
      updatedAt,
    });
  }

  const preservedStrokes = document.strokes.filter((entry) => !targetLayer.strokeIds.includes(entry.id));
  const nextStrokeRecords = buildStrokeRecords(
    seed.strokes,
    updatedAt,
    document.strokes.filter((entry) => targetLayer.strokeIds.includes(entry.id))
  );
  const references =
    seed.referenceImage === undefined
      ? document.references
      : seed.referenceImage
        ? [{
            id: document.references[0]?.id || createDocumentId('reference'),
            name: document.references[0]?.name || 'Reference 1',
            src: seed.referenceImage.src,
            opacity: seed.referenceImage.opacity,
            visible: seed.referenceImage.visible,
            x: seed.referenceImage.x,
            y: seed.referenceImage.y,
            width: seed.referenceImage.width,
            height: seed.referenceImage.height,
            rotation: document.references[0]?.rotation || 0,
            fitMode: document.references[0]?.fitMode || 'free',
            createdAt: document.references[0]?.createdAt || updatedAt,
            updatedAt,
          }]
        : [];

  return normalizeStoryboardDrawingDocument({
    ...document,
    updatedAt,
    layers: document.layers.map((layer) => (
      layer.id === targetLayer.id
        ? {
            ...layer,
            opacity: layer.opacity,
            blendMode: normalizeBlendMode(layer.blendMode),
            strokeIds: nextStrokeRecords.map((entry) => entry.id),
            updatedAt,
          }
        : layer
    )),
    strokes: [...preservedStrokes, ...nextStrokeRecords],
    sheets: document.sheets.map((sheet) => (
      sheet.id === sheetId
        ? {
            ...sheet,
            activeLayerId: targetLayer.id,
            updatedAt,
          }
        : sheet
    )),
    references,
    metadata: {
      ...document.metadata,
      workflowLevel: seed.workflowLevel || document.metadata.workflowLevel,
      baseImageUrl: seed.baseImageUrl !== undefined ? seed.baseImageUrl : document.metadata.baseImageUrl,
      originalBaseImageUrl:
        document.metadata.originalBaseImageUrl !== undefined
          ? document.metadata.originalBaseImageUrl
          : seed.baseImageUrl !== undefined
            ? seed.baseImageUrl
            : document.metadata.baseImageUrl,
      lastCompositeImageUrl:
        seed.imageDataUrl !== undefined ? seed.imageDataUrl : document.metadata.lastCompositeImageUrl,
      brushSettings: seed.brushSettings || document.metadata.brushSettings,
      boardPolish: document.metadata.boardPolish,
    },
  }, updatedAt);
};

export const updateStoryboardDrawingDocumentPrimaryContent = (
  document: StoryboardDrawingDocument,
  seed: {
    strokes: PencilStroke[];
    brushSettings?: StoryboardDocumentBrushSettings;
    baseImageUrl?: string;
    imageDataUrl?: string;
    workflowLevel?: StoryboardDocumentWorkflowLevel;
    updatedAt?: string;
    referenceImage?: StoryboardDrawingDocumentSeed['referenceImage'];
  }
): StoryboardDrawingDocument => updateStoryboardDrawingDocumentSheetContent(
  document,
  document.primarySheetId,
  seed,
);

export const updateStoryboardDrawingDocumentMediaState = (
  document: StoryboardDrawingDocument,
  seed: {
    baseImageUrl?: string;
    originalBaseImageUrl?: string;
    imageDataUrl?: string;
  },
  updatedAt: string = new Date().toISOString()
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    baseImageUrl: seed.baseImageUrl !== undefined ? seed.baseImageUrl : document.metadata.baseImageUrl,
    originalBaseImageUrl:
      seed.originalBaseImageUrl !== undefined
        ? seed.originalBaseImageUrl
        : document.metadata.originalBaseImageUrl !== undefined
          ? document.metadata.originalBaseImageUrl
          : document.metadata.baseImageUrl,
    lastCompositeImageUrl:
      seed.imageDataUrl !== undefined ? seed.imageDataUrl : document.metadata.lastCompositeImageUrl,
  },
}, updatedAt);

export const updateStoryboardDrawingDocumentReferenceStudy = (
  document: StoryboardDrawingDocument,
  referenceStudy: Omit<StoryboardDocumentReferenceStudyState, 'updatedAt'> | StoryboardDocumentReferenceStudyState | null,
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    referenceStudy: referenceStudy
      ? normalizeReferenceStudyState(
          {
            ...referenceStudy,
            updatedAt,
          },
          updatedAt,
        )
      : undefined,
  },
}, updatedAt);

export const updateStoryboardDrawingDocumentBoardPolish = (
  document: StoryboardDrawingDocument,
  boardPolish: Omit<StoryboardDocumentBoardPolishState, 'updatedAt'> | StoryboardDocumentBoardPolishState | null,
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    boardPolish: boardPolish
      ? normalizeBoardPolishState(
          {
            ...boardPolish,
            updatedAt,
          },
          updatedAt,
        )
      : undefined,
  },
}, updatedAt);

export const getStoryboardDocumentShapeScaffoldById = (
  document: StoryboardDrawingDocument,
  scaffoldId: string,
): StoryboardDocumentShapeScaffold | undefined => (
  document.metadata.shapeScaffolds?.find((entry) => entry.id === scaffoldId)
);

export const getStoryboardDocumentShapeScaffoldAssemblyById = (
  document: StoryboardDrawingDocument,
  assemblyId: string,
): StoryboardDocumentShapeScaffoldAssembly | undefined => (
  document.metadata.shapeScaffoldAssemblies?.find((entry) => entry.id === assemblyId)
);

export const addStoryboardDrawingDocumentShapeScaffold = (
  document: StoryboardDrawingDocument,
  scaffold: Omit<StoryboardDocumentShapeScaffold, 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    shapeScaffolds: [
      ...(document.metadata.shapeScaffolds || []),
      {
        ...scaffold,
        id: scaffold.id || createDocumentId('shape-scaffold'),
        createdAt: updatedAt,
        updatedAt,
      },
    ]
      .map((entry) => normalizeShapeScaffold(entry, updatedAt))
      .filter((entry): entry is StoryboardDocumentShapeScaffold => Boolean(entry)),
  },
}, updatedAt);

export const updateStoryboardDrawingDocumentShapeScaffold = (
  document: StoryboardDrawingDocument,
  scaffoldId: string,
  updates: Partial<Omit<StoryboardDocumentShapeScaffold, 'id' | 'createdAt' | 'updatedAt'>>,
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    shapeScaffolds: (document.metadata.shapeScaffolds || []).map((entry) => (
      entry.id === scaffoldId
        ? normalizeShapeScaffold(
            {
              ...entry,
              ...updates,
              frame: updates.frame ? { ...entry.frame, ...updates.frame } : entry.frame,
              updatedAt,
            },
            updatedAt,
          ) || entry
        : entry
    )),
  },
}, updatedAt);

export const removeStoryboardDrawingDocumentShapeScaffold = (
  document: StoryboardDrawingDocument,
  scaffoldId: string,
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    shapeScaffolds: (document.metadata.shapeScaffolds || []).filter((entry) => entry.id !== scaffoldId),
    shapeScaffoldAssemblies: (document.metadata.shapeScaffoldAssemblies || [])
      .map((entry) => ({
        ...entry,
        scaffoldIds: entry.scaffoldIds.filter((entryId) => entryId !== scaffoldId),
      }))
      .filter((entry) => entry.scaffoldIds.length > 0),
  },
}, updatedAt);

export const addStoryboardDrawingDocumentShapeScaffoldAssembly = (
  document: StoryboardDrawingDocument,
  assembly: Omit<StoryboardDocumentShapeScaffoldAssembly, 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    shapeScaffoldAssemblies: [
      ...(document.metadata.shapeScaffoldAssemblies || []),
      {
        ...assembly,
        id: assembly.id || createDocumentId('shape-scaffold-assembly'),
        createdAt: updatedAt,
        updatedAt,
      },
    ]
      .map((entry) => normalizeShapeScaffoldAssembly(entry, updatedAt))
      .filter((entry): entry is StoryboardDocumentShapeScaffoldAssembly => Boolean(entry)),
  },
}, updatedAt);

export const updateStoryboardDrawingDocumentShapeScaffoldAssembly = (
  document: StoryboardDrawingDocument,
  assemblyId: string,
  updates: Partial<Omit<StoryboardDocumentShapeScaffoldAssembly, 'id' | 'createdAt' | 'updatedAt'>>,
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    shapeScaffoldAssemblies: (document.metadata.shapeScaffoldAssemblies || []).map((entry) => (
      entry.id === assemblyId
        ? normalizeShapeScaffoldAssembly(
            {
              ...entry,
              ...updates,
              updatedAt,
            },
            updatedAt,
          ) || entry
        : entry
    )),
  },
}, updatedAt);

export const removeStoryboardDrawingDocumentShapeScaffoldAssembly = (
  document: StoryboardDrawingDocument,
  assemblyId: string,
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    shapeScaffoldAssemblies: (document.metadata.shapeScaffoldAssemblies || []).filter((entry) => entry.id !== assemblyId),
  },
}, updatedAt);

export const getStoryboardDocumentShapeScaffoldLibraryEntryById = (
  document: StoryboardDrawingDocument,
  entryId: string,
): StoryboardDocumentShapeScaffoldLibraryEntry | undefined => (
  document.metadata.shapeScaffoldLibrary?.find((entry) => entry.id === entryId)
);

export const addStoryboardDrawingDocumentShapeScaffoldLibraryEntry = (
  document: StoryboardDrawingDocument,
  entry: Omit<StoryboardDocumentShapeScaffoldLibraryEntry, 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    shapeScaffoldLibrary: [
      ...(document.metadata.shapeScaffoldLibrary || []),
      {
        ...entry,
        id: entry.id || createDocumentId('shape-scaffold-library'),
        createdAt: updatedAt,
        updatedAt,
      },
    ]
      .map((libraryEntry) => normalizeShapeScaffoldLibraryEntry(libraryEntry, updatedAt))
      .filter((libraryEntry): libraryEntry is StoryboardDocumentShapeScaffoldLibraryEntry => Boolean(libraryEntry)),
  },
}, updatedAt);

export const updateStoryboardDrawingDocumentShapeScaffoldLibraryEntry = (
  document: StoryboardDrawingDocument,
  entryId: string,
  updates: Partial<Omit<StoryboardDocumentShapeScaffoldLibraryEntry, 'id' | 'createdAt' | 'updatedAt'>>,
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    shapeScaffoldLibrary: (document.metadata.shapeScaffoldLibrary || []).map((entry) => (
      entry.id === entryId
        ? normalizeShapeScaffoldLibraryEntry(
            {
              ...entry,
              ...updates,
              frame: updates.frame ? { ...entry.frame, ...updates.frame } : entry.frame,
              updatedAt,
            },
            updatedAt,
          ) || entry
        : entry
    )),
  },
}, updatedAt);

export const removeStoryboardDrawingDocumentShapeScaffoldLibraryEntry = (
  document: StoryboardDrawingDocument,
  entryId: string,
  updatedAt: string = new Date().toISOString(),
): StoryboardDrawingDocument => normalizeStoryboardDrawingDocument({
  ...document,
  updatedAt,
  metadata: {
    ...document.metadata,
    shapeScaffoldLibrary: (document.metadata.shapeScaffoldLibrary || []).filter((entry) => entry.id !== entryId),
  },
}, updatedAt);
