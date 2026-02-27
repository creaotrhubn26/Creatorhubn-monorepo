/**
 * FrameDrawingEditor - Storyboard frame drawing interface
 * 
 * Wraps PencilCanvas for storyboard frame sketching on iPad
 * Integrates with StoryboardStore for persistence
 */

import { useState, useCallback, useMemo, useRef, useEffect, type FC } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Stack,
  Typography,
  Button,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Fade,
  Alert,
  useMediaQuery,
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
  CheckCircle,
  Share,
  FileDownload,
  GridOn,
  CameraAlt,
  LightMode,
  ViewSidebar,
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  Tune,
  KeyboardDoubleArrowLeft,
  KeyboardDoubleArrowRight,
  CenterFocusStrong,
  PhotoLibrary,
  EditOutlined,
} from '@mui/icons-material';
import { styled, useTheme } from '@mui/material/styles';

import { PencilCanvas, BrushType, BrushSettings, PencilCanvasHandle } from './PencilCanvas';
import {
  PencilCanvasPro,
  PencilCanvasProHandle,
  ReferenceImage,
  DEFAULT_CANVAS_SURFACE,
  type CanvasSurfaceSettings,
  type CanvasTexturePreset,
} from './PencilCanvasPro';
import {
  ProBrushType,
  ProBrushSettings,
  CINEMATIC_BRUSH_PRESETS,
  type CinematicBrushPresetId,
} from './drawing/AdvancedBrushEngine';
import { type DrawingState, type DrawingLayer, DEFAULT_DRAWING_STATE } from './drawing/DrawingToolsPanel';
import type { Shape } from './drawing/ShapeTools';
import type { TextAnnotation } from './drawing/TextAnnotations';
import storyboardPackService, { saveFrameAssetPackage, loadFrameAssetPackage } from '../services/storyboardPackService';
import type { StoryboardPackManifest, StoryboardPackSlot } from './storyboardPackTypes';
import { PencilStroke } from '../hooks/useApplePencil';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import { 
  useStoryboardStore, 
  StoryboardFrame, 
  type FrameAssetPackage,
  type FrameAssetLayer,
  FrameDrawingData,
  FrameImageSource,
  FrameConceptArtData,
  FrameDecisionData,
  DEFAULT_FRAME_DECISION_DATA,
  DEFAULT_AUTHORING_METADATA,
  cloneFrameDecisionData,
  type AuthoringMetadata,
  type CameraAngle,
  type CameraMovement,
} from '../state/storyboardStore';
import type { StoryboardPack } from './storyboardPackTypes';

// =============================================================================
// Types
// =============================================================================

export interface FrameDrawingEditorProps {
  projectId?: string;
  frameId?: string;
  storyboardId?: string;
  aspectRatio?: '16:9' | '4:3' | '2.35:1' | '1:1' | '9:16';
  initialImage?: string;
  initialStrokes?: PencilStroke[];
  onSave?: (drawingData: FrameDrawingData, imageDataUrl: string) => void;
  onCancel?: () => void;
  mode?: 'dialog' | 'inline' | 'fullscreen';
  sceneId?: string; // Link to manuscript scene
  manuscriptId?: string;
  /** Enable pro mode with watercolor, reference images, advanced brushes */
  proMode?: boolean;
  /** Reference image for tracing (pro mode only) */
  referenceImage?: ReferenceImage;
  /** Existing concept art metadata for this frame */
  initialConceptArt?: FrameConceptArtData;
  /** Existing visual decision metadata for this frame */
  initialDecisionData?: FrameDecisionData;
}

interface CanvasDimensions {
  width: number;
  height: number;
}

// ── Asset-package size guardrails ─────────────────────────────────────────────
const MAX_STROKES_PER_PACKAGE = 10_000;
const MAX_LAYERS_PER_PACKAGE = 64;
const MAX_SHAPES_PER_PACKAGE = 500;
const MAX_TEXT_ANNOTATIONS_PER_PACKAGE = 200;
const MAX_PACKAGE_JSON_BYTES = 8 * 1024 * 1024; // 8 MB

const validateAssetPackageLimits = (params: {
  strokes: PencilStroke[];
  drawingLayers: DrawingLayer[];
  shapes?: Shape[];
  textAnnotations?: TextAnnotation[];
}): string[] => {
  const warnings: string[] = [];
  if (params.strokes.length > MAX_STROKES_PER_PACKAGE) {
    warnings.push(`Stroke count (${params.strokes.length}) exceeds limit of ${MAX_STROKES_PER_PACKAGE}. Oldest strokes may be truncated.`);
  }
  if (params.drawingLayers.length > MAX_LAYERS_PER_PACKAGE) {
    warnings.push(`Layer count (${params.drawingLayers.length}) exceeds limit of ${MAX_LAYERS_PER_PACKAGE}. Extra layers will be dropped.`);
  }
  if ((params.shapes?.length ?? 0) > MAX_SHAPES_PER_PACKAGE) {
    warnings.push(`Shape count (${params.shapes?.length}) exceeds limit of ${MAX_SHAPES_PER_PACKAGE}.`);
  }
  if ((params.textAnnotations?.length ?? 0) > MAX_TEXT_ANNOTATIONS_PER_PACKAGE) {
    warnings.push(`Text annotation count (${params.textAnnotations?.length}) exceeds limit of ${MAX_TEXT_ANNOTATIONS_PER_PACKAGE}.`);
  }
  return warnings;
};

const buildFrameAssetPackage = (params: {
  imageData: string;
  strokes: PencilStroke[];
  activePackId: string;
  activeSlotId: string;
  activeCinematography: FrameDrawingData['cinematography'];
  overlaySettings: FrameDrawingData['overlay'];
  referenceImage: ReferenceImage | null;
  drawingLayers: DrawingLayer[];
  activeLayerId?: string;
  annotations: Array<{ id: string; type: string; label?: string; notes?: string; x: number; y: number; rotation?: number; color?: string }>;
  shapes?: Shape[];
  textAnnotations?: TextAnnotation[];
  authoringMetadata?: AuthoringMetadata;
  canvasEl?: HTMLCanvasElement | null;
}): FrameAssetPackage => {
  const now = new Date().toISOString();
  // PencilCanvasPro keeps strokes in a flat array (each tagged with layerId)
  // rather than inside each DrawingLayer.strokes — so we must distribute
  // the flat strokes into the correct per-layer buckets here.
  const layers: FrameAssetPackage['layers'] = params.drawingLayers.length
    ? params.drawingLayers.map<FrameAssetLayer>((layer) => ({
      id: layer.id,
      kind: 'stroke',
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      strokeData: JSON.stringify(params.strokes.filter(s => s.layerId === layer.id)),
    }))
    : [{
      id: 'layer-strokes-primary',
      kind: 'stroke',
      name: 'Primary Strokes',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      strokeData: JSON.stringify(params.strokes),
    }];

  if (params.referenceImage?.src) {
    layers.unshift({
      id: 'layer-reference-base',
      kind: 'reference',
      name: 'Reference Image',
      visible: Boolean(params.referenceImage.visible),
      locked: true,
      opacity: params.referenceImage.opacity,
      blendMode: 'normal',
      referenceSrc: params.referenceImage.src,
      vectorData: JSON.stringify({
        x: params.referenceImage.x,
        y: params.referenceImage.y,
        width: params.referenceImage.width,
        height: params.referenceImage.height,
      }),
    });
  }

  if (params.annotations.length) {
    layers.push({
      id: 'layer-annotations',
      kind: 'annotation',
      name: 'Frame Annotations',
      visible: true,
      locked: false,
      opacity: 1,
      annotationData: JSON.stringify(params.annotations),
    });
  }

  // ── Shapes layer (first-class vector objects) ──
  if (params.shapes && params.shapes.length > 0) {
    const cappedShapes = params.shapes.slice(0, MAX_SHAPES_PER_PACKAGE);
    layers.push({
      id: 'layer-shapes',
      kind: 'vector',
      name: 'Shape Objects',
      visible: true,
      locked: false,
      opacity: 1,
      vectorData: JSON.stringify({ shapes: cappedShapes }),
    });
  }

  // ── Text annotations layer (first-class editable text) ──
  if (params.textAnnotations && params.textAnnotations.length > 0) {
    const cappedText = params.textAnnotations.slice(0, MAX_TEXT_ANNOTATIONS_PER_PACKAGE);
    layers.push({
      id: 'layer-text-annotations',
      kind: 'vector',
      name: 'Text Annotations',
      visible: true,
      locked: false,
      opacity: 1,
      vectorData: JSON.stringify({ textAnnotations: cappedText }),
    });
  }

  layers.push({
    id: 'layer-vector-settings',
    kind: 'vector',
    name: 'Vector & Tool State',
    visible: true,
    locked: false,
    opacity: 1,
    vectorData: JSON.stringify({
      activeShot: params.activeCinematography,
      overlay: params.overlaySettings,
      drawingState: {
        activeLayerId: params.activeLayerId ?? params.drawingLayers[0]?.id,
      },
    }),
  });

  // ── Multi-format exports ──
  const exports: FrameAssetPackage['exports'] = [
    {
      id: 'export-primary-png',
      format: 'png',
      dataUrl: params.imageData,
      createdAt: now,
    },
  ];

  // Generate JPEG export (smaller footprint)
  if (params.canvasEl) {
    try {
      const jpegDataUrl = params.canvasEl.toDataURL('image/jpeg', 0.85);
      exports.push({
        id: 'export-jpeg-85',
        format: 'jpeg',
        dataUrl: jpegDataUrl,
        createdAt: now,
      });
    } catch {
      // Canvas tainted or unavailable — skip JPEG
    }

    try {
      const webpDataUrl = params.canvasEl.toDataURL('image/webp', 0.80);
      exports.push({
        id: 'export-webp-80',
        format: 'webp',
        dataUrl: webpDataUrl,
        createdAt: now,
      });
    } catch {
      // Browser may not support WebP canvas export — skip
    }

    // Thumbnail (256px wide)
    try {
      const thumbCanvas = document.createElement('canvas');
      const scale = 256 / params.canvasEl.width;
      thumbCanvas.width = 256;
      thumbCanvas.height = Math.round(params.canvasEl.height * scale);
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        thumbCtx.drawImage(params.canvasEl, 0, 0, thumbCanvas.width, thumbCanvas.height);
        exports.push({
          id: 'export-thumbnail-256',
          format: 'webp',
          dataUrl: thumbCanvas.toDataURL('image/webp', 0.65),
          createdAt: now,
        });
      }
    } catch {
      // Skip thumbnail on failure
    }
  }

  // ── Prune exports: keep only the latest N per format (max 3 per format) ──
  const MAX_EXPORTS_PER_FORMAT = 3;
  const formatBuckets = new Map<string, typeof exports>();
  for (const exp of exports) {
    const key = exp.format || 'unknown';
    const bucket = formatBuckets.get(key) ?? [];
    bucket.push(exp);
    formatBuckets.set(key, bucket);
  }
  const prunedExports = Array.from(formatBuckets.values()).flatMap(bucket =>
    bucket.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, MAX_EXPORTS_PER_FORMAT)
  );

  return {
    version: 2,
    baseBitmap: params.referenceImage?.src,
    layers: layers.slice(0, MAX_LAYERS_PER_PACKAGE),
    renderSettings: {
      storyboardPackSelection: params.activePackId && params.activeSlotId
        ? { packId: params.activePackId, slotId: params.activeSlotId }
        : undefined,
      cinematography: params.activeCinematography,
      overlay: params.overlaySettings,
    },
    exports: prunedExports,
    authoringMetadata: params.authoringMetadata,
    updatedAt: now,
  };
};

const migrateFrameAssetPackage = (assetPackage?: FrameDrawingData['assetPackage']): FrameDrawingData['assetPackage'] | null => {
  if (!assetPackage) return null;

  const normalizeV1 = (input: NonNullable<FrameDrawingData['assetPackage']>): NonNullable<FrameDrawingData['assetPackage']> => ({
    version: 1,
    baseBitmap: input.baseBitmap,
    layers: (input.layers || []).map((layer) => ({ ...layer, locked: layer.locked ?? false })),
    renderSettings: input.renderSettings || {},
    exports: input.exports || [],
    authoringMetadata: input.authoringMetadata,
    updatedAt: input.updatedAt || new Date().toISOString(),
  });

  const migrateV1ToV2 = (input: NonNullable<FrameDrawingData['assetPackage']>): NonNullable<FrameDrawingData['assetPackage']> => {
    const normalized = normalizeV1(input);
    return {
      ...normalized,
      version: 2,
      layers: normalized.layers.map((layer, index) => ({
        ...layer,
        id: layer.id || `layer-${index}`,
        name: layer.name || `Layer ${index + 1}`,
        blendMode: layer.blendMode || 'normal',
      })),
      exports: normalized.exports.map((assetExport, index) => ({
        ...assetExport,
        id: assetExport.id || `export-${index}`,
        createdAt: assetExport.createdAt || normalized.updatedAt,
      })),
      updatedAt: normalized.updatedAt || new Date().toISOString(),
    };
  };

  /** V2 packages only need light field-backfill; no version reset. */
  const normalizeV2 = (input: NonNullable<FrameDrawingData['assetPackage']>): NonNullable<FrameDrawingData['assetPackage']> => ({
    ...input,
    version: 2,
    layers: (input.layers || []).map((layer, index) => ({
      ...layer,
      id: layer.id || `layer-${index}`,
      name: layer.name || `Layer ${index + 1}`,
      locked: layer.locked ?? false,
      blendMode: layer.blendMode || 'normal',
    })),
    exports: (input.exports || []).map((assetExport, index) => ({
      ...assetExport,
      id: assetExport.id || `export-${index}`,
      createdAt: assetExport.createdAt || input.updatedAt || new Date().toISOString(),
    })),
    renderSettings: input.renderSettings || {},
    updatedAt: input.updatedAt || new Date().toISOString(),
  });

  const migrationTargets: Record<number, (input: NonNullable<FrameDrawingData['assetPackage']>) => NonNullable<FrameDrawingData['assetPackage']>> = {
    1: migrateV1ToV2,
    2: normalizeV2,
  };

  const migrate = migrationTargets[assetPackage.version] || migrateV1ToV2;
  return migrate(assetPackage);
};

const parseFrameAssetPackage = (assetPackage?: FrameDrawingData['assetPackage']) => {
  const migrated = migrateFrameAssetPackage(assetPackage);
  if (!migrated) return null;
  const referenceLayer = migrated.layers.find((layer) => layer.kind === 'reference' && layer.referenceSrc);
  const strokeLayers = migrated.layers.filter((layer) => layer.kind === 'stroke' && layer.strokeData);

  // Merge strokes from ALL stroke layers into one flat array (PencilCanvasPro
  // uses a flat strokes list where each stroke carries a layerId).
  let strokesFromPackage: PencilStroke[] | null = null;
  if (strokeLayers.length) {
    const merged: PencilStroke[] = [];
    for (const sl of strokeLayers) {
      if (!sl.strokeData) continue;
      try {
        const parsed = JSON.parse(sl.strokeData) as PencilStroke[];
        // Ensure every stroke carries the correct layerId
        for (const s of parsed) {
          merged.push({ ...s, layerId: s.layerId || sl.id });
        }
      } catch (e) {
        console.warn('[parseFrameAssetPackage] Malformed strokeData in layer', sl.id, e);
      }
    }
    strokesFromPackage = merged.length ? merged : null;
  }

  let referenceRect: { x: number; y: number; width: number; height: number } | null = null;
  if (referenceLayer?.vectorData) {
    try {
      referenceRect = JSON.parse(referenceLayer.vectorData) as { x: number; y: number; width: number; height: number };
    } catch (e) {
      console.warn('[parseFrameAssetPackage] Malformed reference vectorData', e);
      referenceRect = null;
    }
  }

  const vectorLayer = migrated.layers.find((layer) => layer.kind === 'vector' && layer.vectorData);
  let vectorState: { drawingState?: { activeLayerId?: string }; activeShot?: FrameDrawingData['cinematography']; overlay?: FrameDrawingData['overlay'] } | null = null;
  if (vectorLayer?.vectorData) {
    try {
      vectorState = JSON.parse(vectorLayer.vectorData) as { drawingState?: { activeLayerId?: string } };
    } catch (e) {
      console.warn('[parseFrameAssetPackage] Malformed vector vectorData', e);
      vectorState = null;
    }
  }

  const annotationLayer = migrated.layers.find((layer) => layer.kind === 'annotation' && layer.annotationData);
  let annotations: Array<{ id: string; type: string; label?: string; notes?: string; x: number; y: number; rotation?: number; color?: string }> = [];
  if (annotationLayer?.annotationData) {
    try {
      annotations = JSON.parse(annotationLayer.annotationData) as Array<{ id: string; type: string; label?: string; notes?: string; x: number; y: number; rotation?: number; color?: string }>;
    } catch (e) {
      console.warn('[parseFrameAssetPackage] Malformed annotationData', e);
      annotations = [];
    }
  }

  // ── Shapes layer (vector objects) ──
  const shapesLayer = migrated.layers.find((layer) => layer.kind === 'vector' && layer.id === 'layer-shapes' && layer.vectorData);
  let shapes: Shape[] = [];
  if (shapesLayer?.vectorData) {
    try {
      const parsed = JSON.parse(shapesLayer.vectorData) as { shapes?: Shape[] };
      shapes = Array.isArray(parsed.shapes) ? parsed.shapes : [];
    } catch (e) {
      console.warn('[parseFrameAssetPackage] Malformed shapes vectorData', e);
      shapes = [];
    }
  }

  // ── Text annotations layer (editable text objects) ──
  const textAnnotationsLayer = migrated.layers.find((layer) => layer.kind === 'vector' && layer.id === 'layer-text-annotations' && layer.vectorData);
  let textAnnotations: TextAnnotation[] = [];
  if (textAnnotationsLayer?.vectorData) {
    try {
      const parsed = JSON.parse(textAnnotationsLayer.vectorData) as { textAnnotations?: TextAnnotation[] };
      textAnnotations = Array.isArray(parsed.textAnnotations) ? parsed.textAnnotations : [];
    } catch (e) {
      console.warn('[parseFrameAssetPackage] Malformed textAnnotations vectorData', e);
      textAnnotations = [];
    }
  }

  return {
    strokes: strokesFromPackage,
    drawingLayers: strokeLayers.map((layer, index) => {
      let layerStrokes: PencilStroke[] = [];
      try {
        layerStrokes = JSON.parse(layer.strokeData || '[]') as PencilStroke[];
      } catch (e) {
        console.warn('[parseFrameAssetPackage] Malformed stroke layer data', layer.id, e);
        layerStrokes = [];
      }
      return {
        id: layer.id || `asset-layer-${index}`,
        name: layer.name || `Layer ${index + 1}`,
        visible: layer.visible,
        locked: layer.locked ?? false,
        opacity: layer.opacity,
        blendMode: (layer.blendMode as DrawingLayer['blendMode']) || 'normal',
        strokes: layerStrokes,
      } as DrawingLayer;
    }),
    storyboardPackSelection: migrated.renderSettings.storyboardPackSelection,
    cinematography: migrated.renderSettings.cinematography ?? vectorState?.activeShot,
    overlay: migrated.renderSettings.overlay ?? vectorState?.overlay,
    annotations,
    shapes,
    textAnnotations,
    activeLayerId: vectorState?.drawingState?.activeLayerId,
    authoringMetadata: migrated.authoringMetadata ?? null,
    reference: referenceLayer?.referenceSrc
      ? {
          src: referenceLayer.referenceSrc,
          visible: referenceLayer.visible,
          opacity: referenceLayer.opacity,
          x: referenceRect?.x ?? 0,
          y: referenceRect?.y ?? 0,
          width: referenceRect?.width ?? 0,
          height: referenceRect?.height ?? 0,
        }
      : null,
  };
};

// =============================================================================
// Styled Components
// =============================================================================

const EditorContainer = styled(Paper)(({ theme }) => ({
  background:
    'radial-gradient(circle at 20% 0%, rgba(29,78,216,0.16), rgba(8,11,18,0.98) 48%), #05070d',
  borderRadius: theme.spacing(3),
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid rgba(148,163,184,0.22)',
  boxShadow: '0 24px 64px rgba(2,6,23,0.65)',
  color: '#f8fafc',
}));

const HeaderBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(1.25, 2),
  background: 'rgba(4,8,16,0.72)',
  borderBottom: '1px solid rgba(148,163,184,0.2)',
  backdropFilter: 'blur(10px)',
}));

const SecondaryBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(0.85, 2),
  background: 'rgba(2,6,16,0.82)',
  borderBottom: '1px solid rgba(148,163,184,0.15)',
}));

const Workbench = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'grid',
  gap: theme.spacing(1.25),
  padding: theme.spacing(1.25),
  minHeight: 0,
}));

const Dock = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(180deg, rgba(10,16,30,0.92), rgba(4,8,16,0.96))',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: theme.spacing(1.5),
  padding: theme.spacing(1.25),
  overflow: 'auto',
  color: '#cbd5e1',
}));

const DockRail = styled(Paper)(({ theme }) => ({
  background: 'linear-gradient(180deg, rgba(10,16,30,0.92), rgba(4,8,16,0.96))',
  border: '1px solid rgba(148,163,184,0.2)',
  borderRadius: theme.spacing(1.5),
  padding: theme.spacing(0.8),
  color: '#cbd5e1',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  alignItems: 'center',
  minHeight: 0,
}));

const CanvasWrapper = styled(Box)({
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
});

const CanvasShell = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background:
    'linear-gradient(180deg, rgba(2,6,23,0.88), rgba(2,6,23,0.62)), radial-gradient(circle at 50% 0%, rgba(30,41,59,0.35), transparent 70%)',
  border: '1px solid rgba(148,163,184,0.22)',
  borderRadius: theme.spacing(1.5),
  position: 'relative',
  overflow: 'hidden',
}));

const FilmStrip = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  borderRadius: theme.spacing(1.25),
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(2,6,18,0.86)',
  overflowX: 'auto',
}));

const FilmFrameThumb = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ active }) => ({
  width: 86,
  minWidth: 86,
  height: 48,
  borderRadius: 8,
  border: active ? '1px solid rgba(250,204,21,0.8)' : '1px solid rgba(148,163,184,0.25)',
  background:
    'linear-gradient(145deg, rgba(148,163,184,0.2), rgba(30,41,59,0.3)), radial-gradient(circle at 70% 20%, rgba(250,204,21,0.2), transparent 60%)',
  boxShadow: active ? '0 0 0 2px rgba(250,204,21,0.18)' : 'none',
  cursor: 'pointer',
}));

const BrushStrip = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  borderRadius: theme.spacing(1.25),
  border: '1px solid rgba(148,163,184,0.18)',
  background: 'rgba(2,6,18,0.86)',
  overflowX: 'auto',
}));

const BrushTile = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ active }) => ({
  width: 92,
  minWidth: 92,
  height: 44,
  borderRadius: 8,
  border: active ? '1px solid rgba(250,204,21,0.8)' : '1px solid rgba(148,163,184,0.25)',
  background:
    'linear-gradient(145deg, rgba(148,163,184,0.14), rgba(15,23,42,0.22)), radial-gradient(circle at 70% 20%, rgba(56,189,248,0.18), transparent 58%)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: active ? '#fde68a' : '#cbd5e1',
}));

const PackCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ active }) => ({
  border: active ? '1px solid rgba(56,189,248,0.7)' : '1px solid rgba(148,163,184,0.26)',
  borderRadius: 10,
  padding: '10px 10px 8px',
  background: active
    ? 'linear-gradient(180deg, rgba(15,23,42,0.88), rgba(2,6,23,0.96))'
    : 'linear-gradient(180deg, rgba(15,23,42,0.5), rgba(2,6,23,0.84))',
  cursor: 'pointer',
  boxShadow: active ? 'inset 0 0 0 1px rgba(56,189,248,0.25)' : 'none',
}));

const PackPreview = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 6,
  marginTop: 8,
});

const PackPreviewCell = styled(Box)(({ theme }) => ({
  height: 22,
  borderRadius: 6,
  border: '1px solid rgba(148,163,184,0.3)',
  background:
    'linear-gradient(140deg, rgba(148,163,184,0.42), rgba(15,23,42,0.68)), radial-gradient(circle at 70% 20%, rgba(248,250,252,0.28), transparent 50%)',
  [theme.breakpoints.down('lg')]: {
    height: 20,
  },
}));

const StatusBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(0.9, 1.5),
  background: 'rgba(2,6,16,0.9)',
  borderTop: '1px solid rgba(148,163,184,0.18)',
}));

// =============================================================================
// Aspect Ratio Helpers
// =============================================================================

const ASPECT_RATIOS: Record<string, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '2.35:1': 2.35,
  '1:1': 1,
  '9:16': 9 / 16,
};

function getCanvasDimensions(
  aspectRatio: string,
  containerWidth: number,
  containerHeight: number
): CanvasDimensions {
  const ratio = ASPECT_RATIOS[aspectRatio] || 16 / 9;
  const maxWidth = containerWidth - 40;
  const maxHeight = containerHeight - 40;

  let width = maxWidth;
  let height = width / ratio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }

  return { width: Math.floor(width), height: Math.floor(height) };
}

const SHOT_SIZE_TO_SHOT_TYPE: Record<FrameDecisionData['cinematography']['shotSize'], StoryboardFrame['shotType']> = {
  EWS: 'Establishing',
  WS: 'Wide',
  MS: 'Medium',
  CU: 'Close-up',
  ECU: 'Extreme Close-up',
};

interface CinematicPackDescriptor {
  id: Exclude<CinematicBrushPresetId, 'none'>;
  title: string;
  accent: string;
}

const CINEMATIC_PACKS: CinematicPackDescriptor[] = [
  { id: 'noir-lighting', title: 'NOIR LIGHTING PACK', accent: '#f8fafc' },
  { id: 'commercial-high-key', title: 'COMMERCIAL HIGH-KEY', accent: '#fbbf24' },
  { id: 'action-crosshatch', title: 'ACTION CROSSHATCH', accent: '#ef4444' },
  { id: 'soft-drama-wash', title: 'SOFT DRAMA WASH', accent: '#d6a677' },
];

const BRUSH_LIBRARY_GROUPS = ['Construction', 'Inks', 'Shadows', 'Texture', 'FX', 'Custom'];

const LAYER_PRESETS = ['Sketch', 'Line Art', 'Shadows', 'Lighting', 'PX / Grain'];

interface CanvasBackgroundOption {
  label: string;
  fillColor: string;
}

const CANVAS_BACKGROUND_OPTIONS: CanvasBackgroundOption[] = [
  { label: 'White', fillColor: '#ffffff' },
  { label: 'Ivory', fillColor: '#f9f3e7' },
  { label: 'Fog', fillColor: '#edf1f6' },
  { label: 'Slate', fillColor: '#dce2ef' },
  { label: 'Midnight', fillColor: '#0f172a' },
];

const CANVAS_TEXTURE_OPTIONS: Array<{ id: CanvasTexturePreset; label: string }> = [
  { id: 'none', label: 'Flat' },
  { id: 'paper', label: 'Paper' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'grain', label: 'Grain' },
  { id: 'blueprint', label: 'Blueprint' },
];

// =============================================================================
// Main Component
// =============================================================================

export const FrameDrawingEditor: FC<FrameDrawingEditorProps> = ({
  projectId,
  frameId,
  storyboardId,
  aspectRatio = '16:9',
  initialImage,
  initialStrokes,
  onSave,
  onCancel,
  mode = 'dialog',
  sceneId,
  manuscriptId,
  proMode = true, // Default to pro mode with advanced brushes
  referenceImage: initialReferenceImage,
  initialConceptArt,
  initialDecisionData,
}) => {
  const device = useDeviceDetection();
  const theme = useTheme();
  const isCompactLayout = useMediaQuery(theme.breakpoints.down('lg'));
  const isSingleColumnLayout = useMediaQuery(theme.breakpoints.down('md'));
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasViewportRef = useRef<HTMLDivElement>(null);
  const pencilCanvasRef = useRef<PencilCanvasHandle | null>(null);
  const pencilCanvasProRef = useRef<PencilCanvasProHandle | null>(null);
  const preFocusLayoutRef = useRef({
    leftDockCollapsed: false,
    rightDockCollapsed: false,
    toolsPanelCollapsed: true,
  });
  
  // Store actions
  const { updateFrame, storyboards } = useStoryboardStore();

  // State
  const [strokes, setStrokes] = useState<PencilStroke[]>(initialStrokes || []);
  const [brushSettings, setBrushSettings] = useState<Partial<BrushSettings>>({
    type: 'pen',
    size: 3,
    color: '#ffffff',
    opacity: 1,
  });
  const [proBrushSettings, setProBrushSettings] = useState<Partial<ProBrushSettings>>({
    type: 'pencil',
    size: 3,
    color: '#111827',
    opacity: 1,
  });
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(initialReferenceImage || null);
  const resolvedInitialConceptArt = useMemo<FrameConceptArtData | undefined>(() => {
    if (initialConceptArt) return initialConceptArt;
    if (!frameId || !storyboardId) return undefined;
    const storyboard = storyboards.find((item) => item.id === storyboardId);
    const frame = storyboard?.frames.find((item) => item.id === frameId);
    return frame?.drawingData?.conceptArt;
  }, [frameId, initialConceptArt, storyboardId, storyboards]);
  const resolvedInitialDecisionData = useMemo<FrameDecisionData>(() => {
    if (initialDecisionData) return cloneFrameDecisionData(initialDecisionData);
    if (!frameId || !storyboardId) return cloneFrameDecisionData(DEFAULT_FRAME_DECISION_DATA);
    const storyboard = storyboards.find((item) => item.id === storyboardId);
    const frame = storyboard?.frames.find((item) => item.id === frameId);
    return frame?.drawingData?.decisionData
      ? cloneFrameDecisionData(frame.drawingData.decisionData)
      : cloneFrameDecisionData(DEFAULT_FRAME_DECISION_DATA);
  }, [frameId, initialDecisionData, storyboardId, storyboards]);
  const [conceptArt, setConceptArt] = useState<FrameConceptArtData | undefined>(resolvedInitialConceptArt);
  const [decisionData, setDecisionData] = useState<FrameDecisionData>(resolvedInitialDecisionData);
  const [isFullscreen, setIsFullscreen] = useState(mode === 'fullscreen');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [lastSavedImage, setLastSavedImage] = useState<string | null>(null);
  const [toolsPanelCollapsed, setToolsPanelCollapsed] = useState(true);
  const [leftDockCollapsed, setLeftDockCollapsed] = useState(false);
  const [rightDockCollapsed, setRightDockCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [transportPlaying, setTransportPlaying] = useState(false);
  const [selectedLibraryGroup, setSelectedLibraryGroup] = useState('Shadows');
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [canvasSurface, setCanvasSurface] = useState<CanvasSurfaceSettings>({
    ...DEFAULT_CANVAS_SURFACE,
    fillColor: '#ffffff',
    texture: 'paper',
    textureOpacity: 0.18,
    textureScale: 1,
  });
  const [canvasViewportSize, setCanvasViewportSize] = useState<CanvasDimensions>({
    width: 960,
    height: 560,
  });

  // Storyboard Pack state
  const [storyboardManifest, setStoryboardManifest] = useState<StoryboardPackManifest | null>(null);
  const [storyboardActivePackId, setStoryboardActivePackId] = useState<string>('');
  const [storyboardActiveSlotId, setStoryboardActiveSlotId] = useState<string>('');
  const [storyboardBrushOverrides, setStoryboardBrushOverrides] = useState<Partial<ProBrushSettings>>({});
  const [storyboardCinematography, setStoryboardCinematography] = useState<StoryboardPackSlot['patch']['cinematography']>({});
  const [storyboardOverlaySettings, setStoryboardOverlaySettings] = useState<StoryboardPackSlot['patch']['overlay']>({});
  const [drawingStateSnapshot, setDrawingStateSnapshot] = useState<DrawingState>(DEFAULT_DRAWING_STATE);
  const [shapesSnapshot, setShapesSnapshot] = useState<Shape[]>([]);
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);
  const [assetPackageServerVersion, setAssetPackageServerVersion] = useState<number | undefined>(undefined);

  const currentFrame = useStoryboardStore((state) => {
    const board = state.storyboards.find((storyboard) => storyboard.id === state.currentStoryboardId);
    return board?.frames.find((frame) => frame.id === frameId);
  });

  const handleConceptArtChange = useCallback((nextConceptArt: FrameConceptArtData) => {
    setConceptArt(nextConceptArt);
    setHasUnsavedChanges(true);
  }, []);

  const handleDecisionDataChange = useCallback((nextDecisionData: FrameDecisionData) => {
    setDecisionData(nextDecisionData);
    setHasUnsavedChanges(true);
  }, []);

  const updateDecisionData = useCallback(
    (updater: (nextData: FrameDecisionData) => void) => {
      setDecisionData((previous) => {
        const nextData = cloneFrameDecisionData(previous);
        updater(nextData);
        return nextData;
      });
      setHasUnsavedChanges(true);
    },
    []
  );

  useEffect(() => {
    setConceptArt(resolvedInitialConceptArt);
  }, [resolvedInitialConceptArt]);

  useEffect(() => {
    setDecisionData(resolvedInitialDecisionData);
  }, [resolvedInitialDecisionData]);

  const setViewportSize = useCallback((width: number, height: number) => {
    const nextWidth = Math.max(320, Math.floor(width));
    const nextHeight = Math.max(240, Math.floor(height));
    setCanvasViewportSize((previous) => (
      previous.width === nextWidth && previous.height === nextHeight
        ? previous
        : { width: nextWidth, height: nextHeight }
    ));
  }, []);

  useEffect(() => {
    const viewport = canvasViewportRef.current;
    if (!viewport) return;

    const refreshSize = () => {
      const rect = viewport.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize(rect.width, rect.height);
      }
    };

    refreshSize();
    window.addEventListener('resize', refreshSize);

    if (typeof ResizeObserver === 'undefined') {
      return () => {
        window.removeEventListener('resize', refreshSize);
      };
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setViewportSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(viewport);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', refreshSize);
    };
  }, [isFullscreen, leftDockCollapsed, rightDockCollapsed, isSingleColumnLayout, setViewportSize]);

  const toggleLeftDock = useCallback(() => {
    setLeftDockCollapsed((previous) => !previous);
    if (focusMode) {
      setFocusMode(false);
    }
  }, [focusMode]);

  const toggleRightDock = useCallback(() => {
    setRightDockCollapsed((previous) => !previous);
    if (focusMode) {
      setFocusMode(false);
    }
  }, [focusMode]);

  const toggleFocusMode = useCallback(() => {
    if (!focusMode) {
      preFocusLayoutRef.current = {
        leftDockCollapsed,
        rightDockCollapsed,
        toolsPanelCollapsed,
      };
      setLeftDockCollapsed(true);
      setRightDockCollapsed(true);
      setToolsPanelCollapsed(true);
      setFocusMode(true);
      return;
    }

    setLeftDockCollapsed(preFocusLayoutRef.current.leftDockCollapsed);
    setRightDockCollapsed(preFocusLayoutRef.current.rightDockCollapsed);
    setToolsPanelCollapsed(preFocusLayoutRef.current.toolsPanelCollapsed);
    setFocusMode(false);
  }, [focusMode, leftDockCollapsed, rightDockCollapsed, toolsPanelCollapsed]);

  const toggleAdvancedToolsPanel = useCallback(() => {
    setToolsPanelCollapsed((previous) => !previous);
    if (focusMode) {
      setFocusMode(false);
    }
  }, [focusMode]);

  const workbenchColumns = useMemo(() => {
    if (isSingleColumnLayout) {
      return 'minmax(0, 1fr)';
    }
    const leftWidth = leftDockCollapsed ? 58 : isCompactLayout ? 262 : 300;
    const rightWidth = rightDockCollapsed ? 58 : isCompactLayout ? 252 : 280;
    return `${leftWidth}px minmax(0, 1fr) ${rightWidth}px`;
  }, [isCompactLayout, isSingleColumnLayout, leftDockCollapsed, rightDockCollapsed]);

  // Calculate canvas dimensions based on available center viewport and aspect ratio
  const canvasDimensions = useMemo(() => {
    const fallbackWidth = isFullscreen
      ? (typeof window !== 'undefined' ? window.innerWidth - 260 : 1100)
      : 900;
    const fallbackHeight = isFullscreen
      ? (typeof window !== 'undefined' ? window.innerHeight - 260 : 680)
      : 560;
    const containerWidth = canvasViewportSize.width || fallbackWidth;
    const containerHeight = canvasViewportSize.height || fallbackHeight;
    return getCanvasDimensions(aspectRatio, containerWidth, containerHeight);
  }, [aspectRatio, canvasViewportSize.height, canvasViewportSize.width, isFullscreen]);

  const drawingScriptContext = useMemo(() => {
    const parsedSceneNumber = Number.parseInt(decisionData.script.sceneNumber, 10);
    const sceneNumber = Number.isFinite(parsedSceneNumber) ? parsedSceneNumber : null;
    const sceneHeading = sceneId ? `Scene ${sceneId}` : '';
    const dialogueText = decisionData.script.dialogueReference;
    if (!sceneId && !sceneNumber && !dialogueText) {
      return null;
    }
    return {
      sceneId: sceneId ?? null,
      sceneNumber,
      sceneHeading,
      dialogueCharacter: undefined,
      dialogueText,
      actionDescription: decisionData.script.versionCompareSummary,
      scriptLineNumber: decisionData.script.scriptLineStart ?? 0,
    };
  }, [decisionData.script.dialogueReference, decisionData.script.sceneNumber, decisionData.script.scriptLineStart, decisionData.script.versionCompareSummary, sceneId]);

  const activePackId = useMemo<Exclude<CinematicBrushPresetId, 'none'>>(() => {
    const preset = proBrushSettings.cinematicPreset;
    if (preset && preset !== 'none') {
      return preset;
    }
    return 'noir-lighting';
  }, [proBrushSettings.cinematicPreset]);

  const getCurrentCanvas = useCallback(
    () => (proMode ? pencilCanvasProRef.current : pencilCanvasRef.current),
    [proMode]
  );

  // =========================================================================
  // Storyboard Pack integration
  // =========================================================================

  const buildReferenceFromSlot = useCallback((slotImageUrl: string): ReferenceImage => {
    const width = Math.round(canvasDimensions.width * 0.86);
    const height = Math.round(canvasDimensions.height * 0.86);
    const x = Math.round((canvasDimensions.width - width) / 2);
    const y = Math.round((canvasDimensions.height - height) / 2);
    return {
      src: slotImageUrl,
      opacity: 0.45,
      visible: true,
      x,
      y,
      width,
      height,
    };
  }, [canvasDimensions.height, canvasDimensions.width]);

  useEffect(() => {
    storyboardPackService.getPublished().then((manifest) => {
      setStoryboardManifest(manifest);
      setStoryboardActivePackId(manifest.packs[0]?.id ?? '');
      setStoryboardActiveSlotId(manifest.packs[0]?.slots[0]?.id ?? '');
    });
  }, []);

  const activePack = useMemo(
    () => storyboardManifest?.packs.find((pack) => pack.id === storyboardActivePackId) ?? storyboardManifest?.packs[0],
    [storyboardManifest, storyboardActivePackId],
  );

  /** Apply full slot patch to ALL live canvas state — brush, cinematography & overlays */
  const applySlotPatchToLiveState = useCallback((
    mergedBrush: Partial<ProBrushSettings>,
    cine: StoryboardPackSlot['patch']['cinematography'],
    overlay: StoryboardPackSlot['patch']['overlay'],
  ) => {
    // ── Brush overrides → proBrushSettings (the prop PencilCanvasPro reads) ──
    setStoryboardBrushOverrides(mergedBrush);
    setProBrushSettings((prev) => ({ ...prev, ...mergedBrush }));

    // ── Cinematography patch → decisionData.cinematography ──
    setStoryboardCinematography(cine ?? {});
    if (cine && Object.keys(cine).length > 0) {
      updateDecisionData((next) => {
        if (cine.cameraAngle) next.cinematography.angle = cine.cameraAngle as CameraAngle;
        if (cine.movement) next.cinematography.movement = cine.movement as CameraMovement;
        if (cine.shotType) {
          const shotMap: Record<string, FrameDecisionData['cinematography']['shotSize']> = {
            'Extreme Wide': 'EWS', 'Wide': 'WS', 'Medium': 'MS', 'Close Up': 'CU', 'Extreme Close Up': 'ECU',
          };
          const mapped = shotMap[cine.shotType];
          if (mapped) next.cinematography.shotSize = mapped;
        }
        if (cine.lens) {
          const lensNum = parseInt(cine.lens, 10);
          if (!Number.isNaN(lensNum) && lensNum > 0) next.cinematography.lensMm = lensNum;
        }
      });
    }

    // ── Overlay patch → decisionData.overlays ──
    setStoryboardOverlaySettings(overlay ?? {});
    if (overlay) {
      updateDecisionData((next) => {
        if (overlay.showGrid !== undefined) next.overlays.grid = overlay.showGrid;
        if (overlay.showSafeArea !== undefined) next.overlays.safeAreas = overlay.showSafeArea;
      });
    }
  }, [updateDecisionData]);

  const applyPackSlot = useCallback((slot: StoryboardPackSlot, options?: { useAsReference?: boolean }) => {
    if (!activePack) return;
    setStoryboardActivePackId(activePack.id);
    setStoryboardActiveSlotId(slot.id);

    const mergedBrush = { ...activePack.baseBrushSettings, ...slot.patch.brushSettings };
    applySlotPatchToLiveState(mergedBrush, slot.patch.cinematography, slot.patch.overlay);

    if (options?.useAsReference && slot.imageUrl) {
      setReferenceImage(buildReferenceFromSlot(slot.imageUrl));
    }
    setHasUnsavedChanges(true);
  }, [activePack, applySlotPatchToLiveState, buildReferenceFromSlot]);

  useEffect(() => {
    const selectedPack = storyboardManifest?.packs.find((pack) => pack.id === storyboardActivePackId);
    const selectedSlot = selectedPack?.slots.find((slot) => slot.id === storyboardActiveSlotId);
    if (!selectedPack || !selectedSlot) return;
    const mergedBrush = { ...selectedPack.baseBrushSettings, ...selectedSlot.patch.brushSettings };
    applySlotPatchToLiveState(mergedBrush, selectedSlot.patch.cinematography, selectedSlot.patch.overlay);
  }, [storyboardManifest, storyboardActivePackId, storyboardActiveSlotId, applySlotPatchToLiveState]);

  // ── Load asset package from server on mount (C1: dedicated endpoint) ──
  useEffect(() => {
    if (!frameId) return;
    let cancelled = false;
    loadFrameAssetPackage(frameId).then((serverResult) => {
      if (cancelled || !serverResult) return;
      setAssetPackageServerVersion(serverResult.version);
      // Merge server asset package into the frame so the restore effect below picks it up
      const serverAsset = serverResult.assetPackage as FrameDrawingData['assetPackage'];
      if (serverAsset && currentFrame?.drawingData) {
        const localUpdatedAt = currentFrame.drawingData.assetPackage?.updatedAt;
        const serverUpdatedAt = serverAsset.updatedAt;
        // Prefer whichever is newer; fallback to server if timestamps are missing
        if (!localUpdatedAt || (serverUpdatedAt && serverUpdatedAt > localUpdatedAt)) {
          if (frameId && storyboardId) {
            updateFrame(frameId, {
              drawingData: { ...currentFrame.drawingData, assetPackage: serverAsset },
            });
          }
        }
      }
    }).catch(() => { /* server unreachable — use store data */ });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameId]);

  useEffect(() => {
    if (!currentFrame?.drawingData) return;

    // ── 1. Parse asset package (always attempt, regardless of pack selection) ──
    const assetState = parseFrameAssetPackage(currentFrame.drawingData.assetPackage);

    // ── 2. Restore per-layer strokes from asset package ──
    // Only overwrite when the package contains real strokes; an empty array
    // from a corrupted save must NOT wipe initialStrokes.
    if (assetState?.strokes && assetState.strokes.length > 0) {
      setStrokes(assetState.strokes);
    }

    if (assetState?.drawingLayers?.length) {
      setDrawingStateSnapshot((prev) => ({
        ...prev,
        layers: assetState.drawingLayers,
        activeLayerId: assetState.activeLayerId ?? assetState.drawingLayers[0]?.id ?? prev.activeLayerId,
        // Restore text annotations into DrawingState
        ...(assetState.textAnnotations?.length ? { textAnnotations: assetState.textAnnotations } : {}),
        // Restore authoring metadata
        ...(assetState.authoringMetadata ? { authoringMetadata: assetState.authoringMetadata } : {}),
      }));
    } else if (assetState?.authoringMetadata) {
      // Even if no drawing layers, restore authoring metadata
      setDrawingStateSnapshot((prev) => ({ ...prev, authoringMetadata: assetState.authoringMetadata }));
    }

    // Fallback: restore authoring metadata from drawingData if asset package didn't have it
    if (!assetState?.authoringMetadata && currentFrame.drawingData.authoringMetadata) {
      setDrawingStateSnapshot((prev) => ({ ...prev, authoringMetadata: currentFrame.drawingData!.authoringMetadata! }));
    }

    // Restore shapes (vector objects)
    if (assetState?.shapes?.length) {
      setShapesSnapshot(assetState.shapes);
    }

    if (assetState?.annotations?.length && frameId && storyboardId) {
      updateFrame(frameId, {
        annotations: assetState.annotations.map((annotation) => ({
          ...annotation,
          createdAt: annotation.createdAt || new Date().toISOString(),
        })),
      });
    }

    if (!referenceImage) {
      if (assetState?.reference) {
        setReferenceImage(assetState.reference);
      } else if (currentFrame.drawingData.referenceImageSrc) {
        setReferenceImage(buildReferenceFromSlot(currentFrame.drawingData.referenceImageSrc));
      }
    }

    // ── 3. Restore storyboard pack selection & apply slot patch (only if present) ──
    if (!storyboardManifest) return;
    const savedSelection = assetState?.storyboardPackSelection ?? currentFrame.drawingData.storyboardPackSelection;
    if (!savedSelection) return;

    const pack = storyboardManifest.packs.find((item) => item.id === savedSelection.packId);
    const slot = pack?.slots.find((item) => item.id === savedSelection.slotId);
    if (!pack || !slot) return;

    setStoryboardActivePackId(pack.id);
    setStoryboardActiveSlotId(slot.id);
    const restoredCine = assetState?.cinematography ?? currentFrame.drawingData.cinematography ?? slot.patch.cinematography ?? {};
    const restoredOverlay = assetState?.overlay ?? currentFrame.drawingData.overlay ?? slot.patch.overlay ?? {};
    const mergedBrush = { ...pack.baseBrushSettings, ...slot.patch.brushSettings };
    applySlotPatchToLiveState(mergedBrush, restoredCine, restoredOverlay);
  }, [buildReferenceFromSlot, currentFrame?.drawingData, referenceImage, storyboardManifest]);

  // Handle stroke changes
  const handleStrokesChange = useCallback((newStrokes: PencilStroke[]) => {
    setStrokes(newStrokes);
    setHasUnsavedChanges(true);
  }, []);

  // Handle save
  const handleSave = useCallback((imageData: string) => {
    const activeBrush = proMode ? proBrushSettings : brushSettings;
    const imageSource: FrameImageSource = 'drawn';
    const nextDecisionData: FrameDecisionData = {
      ...cloneFrameDecisionData(decisionData),
      updatedAt: new Date().toISOString(),
    };
    const normalizedBrushSettings: FrameDrawingData['brushSettings'] = {
      type: activeBrush.type ?? 'pen',
      size: activeBrush.size ?? 3,
      color: activeBrush.color ?? '#ffffff',
      opacity: activeBrush.opacity ?? 1,
    };

    // Pre-save validation
    const warnings = validateAssetPackageLimits({
      strokes,
      drawingLayers: drawingStateSnapshot.layers,
      shapes: shapesSnapshot,
      textAnnotations: drawingStateSnapshot.textAnnotations,
    });
    setSaveWarnings(warnings);

    // Cap strokes at limit to prevent oversized payloads
    const cappedStrokes = strokes.slice(-MAX_STROKES_PER_PACKAGE);

    // Get canvas element for multi-format export
    const canvasEl = pencilCanvasProRef.current?.getCompositeCanvas?.()
      ?? pencilCanvasProRef.current?.getCanvas?.()
      ?? null;

    const drawingData: FrameDrawingData = {
      dataUrl: imageData,
      strokes: JSON.stringify(cappedStrokes),
      brushSettings: normalizedBrushSettings,
      storyboardPackSelection: storyboardActivePackId && storyboardActiveSlotId ? { packId: storyboardActivePackId, slotId: storyboardActiveSlotId } : undefined,
      cinematography: storyboardCinematography,
      overlay: storyboardOverlaySettings,
      referenceImageSrc: referenceImage?.src,
      assetPackage: buildFrameAssetPackage({
        imageData,
        strokes: cappedStrokes,
        activePackId: storyboardActivePackId,
        activeSlotId: storyboardActiveSlotId,
        activeCinematography: storyboardCinematography,
        overlaySettings: storyboardOverlaySettings,
        referenceImage,
        drawingLayers: drawingStateSnapshot.layers,
        activeLayerId: drawingStateSnapshot.activeLayerId,
        annotations: (currentFrame?.annotations ?? []).map((annotation) => ({
          id: annotation.id,
          type: annotation.type,
          label: annotation.label,
          notes: annotation.notes,
          x: annotation.x,
          y: annotation.y,
          rotation: annotation.rotation,
          color: annotation.color,
        })),
        shapes: shapesSnapshot,
        textAnnotations: drawingStateSnapshot.textAnnotations,
        authoringMetadata: drawingStateSnapshot.authoringMetadata.authorName
          ? drawingStateSnapshot.authoringMetadata
          : undefined,
        canvasEl,
      }),
      deviceType: device.hasPencilSupport ? 'pencil' : device.hasTouchScreen ? 'touch' : 'mouse',
      conceptArt: conceptArt && conceptArt.variants.length > 0 ? conceptArt : undefined,
      decisionData: nextDecisionData,
      authoringMetadata: drawingStateSnapshot.authoringMetadata.authorName
        ? drawingStateSnapshot.authoringMetadata
        : undefined,
      createdAt: currentFrame?.drawingData?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Final size check — warn if the serialized package is very large
    try {
      const serializedSize = JSON.stringify(drawingData.assetPackage).length;
      if (serializedSize > MAX_PACKAGE_JSON_BYTES) {
        console.warn(`[FrameDrawingEditor] Asset package is ${(serializedSize / 1024 / 1024).toFixed(1)} MB — exceeds ${MAX_PACKAGE_JSON_BYTES / 1024 / 1024} MB limit`);
      }
    } catch {
      // Serialization check failed — proceed anyway
    }

    // Update frame in store if we have a frame ID
    if (frameId && storyboardId) {
      updateFrame(frameId, {
        imageUrl: imageData,
        drawingData,
        imageSource,
        shotType: SHOT_SIZE_TO_SHOT_TYPE[nextDecisionData.cinematography.shotSize],
        cameraAngle: nextDecisionData.cinematography.angle,
        cameraMovement: nextDecisionData.cinematography.movement,
        duration: Math.max(0.25, nextDecisionData.animatic.frameTimingMs / 1000),
        updatedAt: new Date().toISOString(),
      });
    }

    // Persist asset package to server (non-blocking — store update above is the source of truth for in-session state)
    if (frameId && drawingData.assetPackage) {
      saveFrameAssetPackage(
        frameId,
        drawingData.assetPackage as Record<string, unknown>,
        assetPackageServerVersion,
      ).then((result) => {
        if (result) setAssetPackageServerVersion(result.version);
      }).catch(() => {
        console.warn('[FrameDrawingEditor] Server asset package save failed — data is still in local store');
      });
    }

    // Call external save handler
    onSave?.(drawingData, imageData);
    
    setLastSavedImage(imageData);
    setHasUnsavedChanges(false);
  }, [strokes, brushSettings, proBrushSettings, proMode, decisionData, device, frameId, storyboardId, updateFrame, onSave, conceptArt, storyboardActivePackId, storyboardActiveSlotId, storyboardCinematography, storyboardOverlaySettings, referenceImage, drawingStateSnapshot.layers, drawingStateSnapshot.activeLayerId, drawingStateSnapshot.textAnnotations, drawingStateSnapshot.authoringMetadata, currentFrame?.annotations, shapesSnapshot, assetPackageServerVersion]);

  const handleApplyCinematicPack = useCallback((packId: Exclude<CinematicBrushPresetId, 'none'>) => {
    const pack = CINEMATIC_BRUSH_PRESETS[packId];
    if (!pack) return;
    setProBrushSettings((previous) => ({
      ...previous,
      ...pack.config,
      cinematicPreset: packId,
    }));

    updateDecisionData((nextData) => {
      nextData.overlays.perspectiveGrid = true;
      nextData.overlays.vanishingPoints = packId === 'action-crosshatch';
      nextData.overlays.lightingVector = true;
      nextData.overlays.lensFalloff = packId !== 'commercial-high-key';
      nextData.overlays.perspectiveSnap = true;

      if (packId === 'noir-lighting') {
        nextData.cinematography.lensMm = 50;
        nextData.cinematography.apertureFStop = 1.8;
        nextData.cinematography.keyLightIntensity = 0.9;
      } else if (packId === 'commercial-high-key') {
        nextData.cinematography.lensMm = 35;
        nextData.cinematography.apertureFStop = 2.8;
        nextData.cinematography.keyLightIntensity = 0.7;
      } else if (packId === 'action-crosshatch') {
        nextData.cinematography.lensMm = 28;
        nextData.cinematography.apertureFStop = 2.2;
        nextData.cinematography.keyLightIntensity = 0.65;
      } else if (packId === 'soft-drama-wash') {
        nextData.cinematography.lensMm = 85;
        nextData.cinematography.apertureFStop = 1.8;
        nextData.cinematography.keyLightIntensity = 0.5;
      }
    });
  }, [updateDecisionData]);

  const handleExportPng = useCallback(() => {
    const canvas = getCurrentCanvas()?.getCanvas();
    if (!canvas) return;
    const href = canvas.toDataURL('image/png');
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `storyboard-${storyboardId ?? 'frame'}-${frameId ?? 'draft'}.png`;
    anchor.click();
  }, [frameId, getCurrentCanvas, storyboardId]);

  const handleShare = useCallback(async () => {
    const summary = [
      `Scene ${sceneId ?? '-'}`,
      `Frame ${frameId ?? 'draft'}`,
      `${decisionData.cinematography.shotSize} ${decisionData.cinematography.lensMm}mm`,
      `${(decisionData.animatic.frameTimingMs / 1000).toFixed(2)}s`,
    ].join(' | ');
    try {
      await navigator.clipboard.writeText(summary);
      setShareFeedback('Frame summary copied');
      window.setTimeout(() => setShareFeedback(null), 1600);
    } catch {
      setShareFeedback('Copy failed');
      window.setTimeout(() => setShareFeedback(null), 1600);
    }
  }, [decisionData.animatic.frameTimingMs, decisionData.cinematography.lensMm, decisionData.cinematography.shotSize, frameId, sceneId]);

  // Handle cancel with unsaved changes check
  const handleCancel = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
    } else {
      onCancel?.();
    }
  }, [hasUnsavedChanges, onCancel]);

  // ── Warn user before navigating away with unsaved work (L10) ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

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

  const handleUndo = useCallback(() => getCurrentCanvas()?.undo(), [getCurrentCanvas]);
  const handleRedo = useCallback(() => getCurrentCanvas()?.redo(), [getCurrentCanvas]);
  const handleClear = useCallback(() => getCurrentCanvas()?.clear(), [getCurrentCanvas]);
  const handleSaveFromCanvas = useCallback(() => getCurrentCanvas()?.save(), [getCurrentCanvas]);

  const currentBrushType = proMode ? (proBrushSettings.type ?? 'pencil') : (brushSettings.type ?? 'pen');
  const currentSurfaceName = useMemo(() => {
    const matched = CANVAS_BACKGROUND_OPTIONS.find(
      (option) => option.fillColor.toLowerCase() === canvasSurface.fillColor.toLowerCase()
    );
    return matched?.label ?? canvasSurface.fillColor;
  }, [canvasSurface.fillColor]);
  const frameRecord = useMemo<Pick<StoryboardFrame, 'id' | 'index'>>(
    () => ({ id: frameId ?? 'preview', index: 0 }),
    [frameId]
  );

  // Render the editor content
  const editorContent = (
    <EditorContainer
      ref={containerRef}
      sx={{
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : mode === 'inline' ? 'min(86vh, 880px)' : 'min(88vh, 920px)',
        minHeight: isFullscreen ? '100vh' : 700,
        maxWidth: isFullscreen ? 'none' : 1320,
      }}
    >
      <HeaderBar>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
          <Chip
            label="CREATORHUB"
            size="small"
            sx={{
              bgcolor: 'rgba(15,23,42,0.75)',
              color: '#e2e8f0',
              border: '1px solid rgba(148,163,184,0.3)',
              letterSpacing: 0.8,
              fontWeight: 600,
            }}
          />
          <Chip
            label="STORYBOARD PRO"
            size="small"
            sx={{
              bgcolor: 'rgba(250,204,21,0.15)',
              color: '#facc15',
              border: '1px solid rgba(250,204,21,0.4)',
              letterSpacing: 0.8,
              fontWeight: 600,
            }}
          />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
            Scene {sceneId ?? decisionData.script.sceneNumber ?? '-'}
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#93c5fd', whiteSpace: 'nowrap' }}>
            Shot {frameRecord.id.slice(-4)}
          </Typography>
          <Chip
            label={decisionData.versioning.currentVersionLabel || 'Version 1'}
            size="small"
            sx={{ bgcolor: 'rgba(30,41,59,0.9)', color: '#94a3b8', fontWeight: 600 }}
          />
          <Chip
            icon={
              device.hasPencilSupport ? (
                <Create sx={{ fontSize: 14 }} />
              ) : (
                <TouchApp sx={{ fontSize: 14 }} />
              )
            }
            label={device.hasPencilSupport ? 'Pencil' : device.hasTouchScreen ? 'Touch' : 'Mouse'}
            size="small"
            sx={{
              bgcolor: device.hasPencilSupport ? 'rgba(34,197,94,0.16)' : 'rgba(30,41,59,0.85)',
              color: device.hasPencilSupport ? '#86efac' : '#cbd5e1',
              fontWeight: 600,
            }}
          />
          {manuscriptId && (
            <Chip
              icon={<ImageIcon sx={{ fontSize: 14 }} />}
              label={manuscriptId.slice(0, 10)}
              size="small"
              sx={{ bgcolor: 'rgba(236,72,153,0.16)', color: '#f9a8d4', fontWeight: 600 }}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            icon={<CheckCircle sx={{ fontSize: 14 }} />}
            label={decisionData.production.shotStatus === 'approved' ? 'Approved' : 'In Progress'}
            size="small"
            onClick={() =>
              updateDecisionData((nextData) => {
                nextData.production.shotStatus =
                  nextData.production.shotStatus === 'approved' ? 'planned' : 'approved';
              })
            }
            sx={{
              bgcolor:
                decisionData.production.shotStatus === 'approved'
                  ? 'rgba(34,197,94,0.18)'
                  : 'rgba(59,130,246,0.16)',
              color:
                decisionData.production.shotStatus === 'approved' ? '#86efac' : '#93c5fd',
              border: '1px solid rgba(148,163,184,0.3)',
            }}
          />
          <Button
            size="small"
            startIcon={<Share sx={{ fontSize: 14 }} />}
            onClick={handleShare}
            sx={{ color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.3)' }}
          >
            Share
          </Button>
          <Button
            size="small"
            startIcon={<FileDownload sx={{ fontSize: 14 }} />}
            onClick={handleExportPng}
            sx={{ color: '#e2e8f0', border: '1px solid rgba(148,163,184,0.3)' }}
          >
            Export
          </Button>
          <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            <IconButton onClick={toggleFullscreen} sx={{ color: '#cbd5e1' }}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Close">
            <IconButton onClick={handleCancel} sx={{ color: '#cbd5e1' }}>
              <Close />
            </IconButton>
          </Tooltip>
        </Stack>
      </HeaderBar>

      <SecondaryBar>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" sx={{ color: '#94a3b8', letterSpacing: 0.9 }}>
            CINEMATOGRAPHY BRUSH PACKS
          </Typography>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setSelectedLibraryGroup('Custom');
              setProBrushSettings((previous) => ({ ...previous, cinematicPreset: 'none' }));
            }}
            sx={{
              color: '#cbd5e1',
              borderColor: 'rgba(148,163,184,0.35)',
              minWidth: 0,
              px: 1.1,
            }}
          >
            + New Pack
          </Button>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={currentBrushType}
            onChange={(_e, value: BrushType | ProBrushType | null) => {
              if (!value) return;
              if (proMode) {
                setProBrushSettings((previous) => ({ ...previous, type: value as ProBrushType }));
              } else {
                setBrushSettings((previous) => ({ ...previous, type: value as BrushType }));
              }
            }}
            sx={{
              '& .MuiToggleButton-root': {
                color: '#cbd5e1',
                py: 0.2,
                px: 0.8,
                borderColor: 'rgba(148,163,184,0.3)',
              },
            }}
          >
            <ToggleButton value={proMode ? 'pencil' : 'pen'}><Create sx={{ fontSize: 14 }} /></ToggleButton>
            <ToggleButton value="brush"><Brush sx={{ fontSize: 14 }} /></ToggleButton>
            <ToggleButton value={proMode ? 'watercolor' : 'highlighter'}>
              {proMode ? <AutoAwesome sx={{ fontSize: 14 }} /> : <Highlight sx={{ fontSize: 14 }} />}
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Stack direction="row" spacing={0.75} alignItems="center">
          <Chip
            icon={<AspectRatio sx={{ fontSize: 13 }} />}
            label={aspectRatio}
            size="small"
            sx={{ bgcolor: 'rgba(15,23,42,0.9)', color: '#e2e8f0' }}
          />
          <Chip
            icon={<GridOn sx={{ fontSize: 13 }} />}
            label="Grid"
            size="small"
            onClick={() =>
              updateDecisionData((nextData) => {
                nextData.overlays.grid = !nextData.overlays.grid;
              })
            }
            sx={{
              bgcolor: decisionData.overlays.grid ? 'rgba(56,189,248,0.25)' : 'rgba(15,23,42,0.9)',
              color: decisionData.overlays.grid ? '#67e8f9' : '#cbd5e1',
            }}
          />
          <Chip
            icon={<CameraAlt sx={{ fontSize: 13 }} />}
            label="Camera"
            size="small"
            onClick={() =>
              updateDecisionData((nextData) => {
                nextData.overlays.centerCross = !nextData.overlays.centerCross;
              })
            }
            sx={{
              bgcolor: decisionData.overlays.centerCross ? 'rgba(96,165,250,0.25)' : 'rgba(15,23,42,0.9)',
              color: decisionData.overlays.centerCross ? '#93c5fd' : '#cbd5e1',
            }}
          />
          <Chip
            icon={<LightMode sx={{ fontSize: 13 }} />}
            label="Light"
            size="small"
            onClick={() =>
              updateDecisionData((nextData) => {
                nextData.overlays.lightingVector = !nextData.overlays.lightingVector;
              })
            }
            sx={{
              bgcolor: decisionData.overlays.lightingVector ? 'rgba(250,204,21,0.26)' : 'rgba(15,23,42,0.9)',
              color: decisionData.overlays.lightingVector ? '#fde68a' : '#cbd5e1',
            }}
          />
          <Tooltip title="Toggle Advanced Panel">
            <IconButton
              size="small"
              onClick={toggleAdvancedToolsPanel}
              sx={{
                color: toolsPanelCollapsed ? '#94a3b8' : '#67e8f9',
                border: '1px solid rgba(148,163,184,0.28)',
                borderRadius: 1,
              }}
            >
              <ViewSidebar sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={leftDockCollapsed ? 'Expand Left Panel' : 'Collapse Left Panel'}>
            <IconButton
              size="small"
              onClick={toggleLeftDock}
              sx={{
                color: leftDockCollapsed ? '#94a3b8' : '#67e8f9',
                border: '1px solid rgba(148,163,184,0.28)',
                borderRadius: 1,
              }}
            >
              {leftDockCollapsed ? (
                <KeyboardDoubleArrowRight sx={{ fontSize: 16 }} />
              ) : (
                <KeyboardDoubleArrowLeft sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={rightDockCollapsed ? 'Expand Right Panel' : 'Collapse Right Panel'}>
            <IconButton
              size="small"
              onClick={toggleRightDock}
              sx={{
                color: rightDockCollapsed ? '#94a3b8' : '#67e8f9',
                border: '1px solid rgba(148,163,184,0.28)',
                borderRadius: 1,
              }}
            >
              {rightDockCollapsed ? (
                <KeyboardDoubleArrowLeft sx={{ fontSize: 16 }} />
              ) : (
                <KeyboardDoubleArrowRight sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={focusMode ? 'Exit Focus Mode' : 'Focus Mode'}>
            <IconButton
              size="small"
              onClick={toggleFocusMode}
              sx={{
                color: focusMode ? '#fde68a' : '#94a3b8',
                border: '1px solid rgba(148,163,184,0.28)',
                borderRadius: 1,
                bgcolor: focusMode ? 'rgba(250,204,21,0.16)' : 'transparent',
              }}
            >
              <CenterFocusStrong sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </SecondaryBar>

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
            Apple Pencil detected. Pressure and tilt are active.
          </Alert>
        </Fade>
      )}

      <Workbench
        sx={{
          gridTemplateColumns: workbenchColumns,
          transition: 'grid-template-columns 220ms ease',
          ...(isSingleColumnLayout
            ? {
                display: 'flex',
                flexDirection: 'column',
              }
            : {}),
        }}
      >
        {leftDockCollapsed ? (
          <DockRail>
            <Tooltip title="Expand Brush Library">
              <IconButton
                size="small"
                onClick={toggleLeftDock}
                sx={{ color: '#67e8f9', border: '1px solid rgba(103,232,249,0.35)', borderRadius: 1 }}
              >
                <KeyboardDoubleArrowRight sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Stack spacing={1} alignItems="center" sx={{ py: 1 }}>
              <Brush sx={{ fontSize: 18, color: '#93c5fd' }} />
              <AutoAwesome sx={{ fontSize: 16, color: '#fbbf24' }} />
              <GridOn sx={{ fontSize: 16, color: '#94a3b8' }} />
            </Stack>
            <Typography
              variant="caption"
              sx={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                letterSpacing: 1.4,
                color: '#64748b',
                fontWeight: 700,
              }}
            >
              LIBRARY
            </Typography>
          </DockRail>
        ) : (
        <Dock>
          <Stack spacing={1.1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" sx={{ letterSpacing: 0.75, color: '#94a3b8' }}>
                BRUSH PACKS
              </Typography>
              <Tooltip title="Collapse Left Panel">
                <IconButton
                  size="small"
                  onClick={toggleLeftDock}
                  sx={{ color: '#67e8f9', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 1 }}
                >
                  <KeyboardDoubleArrowLeft sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
            {CINEMATIC_PACKS.map((pack) => (
              <PackCard
                key={pack.id}
                active={activePackId === pack.id}
                onClick={() => handleApplyCinematicPack(pack.id)}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.7, color: '#e2e8f0' }}>
                    {pack.title}
                  </Typography>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: pack.accent,
                      boxShadow: `0 0 12px ${pack.accent}`,
                    }}
                  />
                </Stack>
                <PackPreview>
                  {[0, 1, 2, 3].map((index) => (
                    <PackPreviewCell key={`${pack.id}-${index}`} />
                  ))}
                </PackPreview>
              </PackCard>
            ))}

            <Divider sx={{ borderColor: 'rgba(148,163,184,0.25)' }} />

            {/* ── Storyboard Pack Slot Selection ── */}
            <Typography variant="caption" sx={{ letterSpacing: 0.7, color: '#94a3b8' }}>
              STORYBOARD PACKS
            </Typography>

            {storyboardManifest && storyboardManifest.packs.length > 0 && (
              <>
                {/* Pack selector tabs */}
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {storyboardManifest.packs.map((sbPack: StoryboardPack) => (
                    <Chip
                      key={sbPack.id}
                      label={sbPack.name}
                      size="small"
                      onClick={() => {
                        setStoryboardActivePackId(sbPack.id);
                        const firstSlot = sbPack.slots[0];
                        if (firstSlot) {
                          setStoryboardActiveSlotId(firstSlot.id);
                          applyPackSlot(firstSlot);
                        }
                      }}
                      sx={{
                        bgcolor: storyboardActivePackId === sbPack.id ? 'rgba(56,189,248,0.22)' : 'rgba(15,23,42,0.72)',
                        color: storyboardActivePackId === sbPack.id ? '#67e8f9' : '#cbd5e1',
                        border: `1px solid ${storyboardActivePackId === sbPack.id ? 'rgba(56,189,248,0.5)' : 'rgba(148,163,184,0.26)'}`,
                        fontWeight: 600,
                        fontSize: 11,
                      }}
                    />
                  ))}
                </Stack>

                {/* Slots for the active pack */}
                {activePack && activePack.slots.map((slot) => {
                  const isActive = storyboardActiveSlotId === slot.id;
                  return (
                    <Box
                      key={slot.id}
                      onClick={() => applyPackSlot(slot)}
                      sx={{
                        p: 0.8,
                        borderRadius: 1.5,
                        border: `1px solid ${isActive ? 'rgba(56,189,248,0.55)' : 'rgba(148,163,184,0.22)'}`,
                        bgcolor: isActive ? 'rgba(56,189,248,0.1)' : 'rgba(15,23,42,0.55)',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'rgba(56,189,248,0.08)', borderColor: 'rgba(56,189,248,0.35)' },
                        transition: 'all 150ms ease',
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        {slot.imageUrl && (
                          <Box
                            component="img"
                            src={slot.imageUrl}
                            alt={slot.name}
                            sx={{
                              width: 42,
                              height: 42,
                              borderRadius: 1,
                              objectFit: 'cover',
                              border: '1px solid rgba(148,163,184,0.25)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <Stack sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: isActive ? '#67e8f9' : '#e2e8f0', lineHeight: 1.2 }}>
                            {slot.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', fontSize: 10, lineHeight: 1.2 }} noWrap>
                            {slot.description}
                          </Typography>
                        </Stack>
                        <Tooltip title="Edit in Canvas">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              applyPackSlot(slot, { useAsReference: true });
                            }}
                            sx={{
                              color: '#93c5fd',
                              border: '1px solid rgba(147,197,253,0.3)',
                              borderRadius: 1,
                              p: 0.4,
                              '&:hover': { bgcolor: 'rgba(147,197,253,0.15)' },
                            }}
                          >
                            <EditOutlined sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      {/* Patch summary chips */}
                      <Stack direction="row" spacing={0.4} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                        {slot.patch.cinematography?.shotType && (
                          <Chip label={slot.patch.cinematography.shotType} size="small" sx={{ height: 18, fontSize: 9, bgcolor: 'rgba(96,165,250,0.15)', color: '#93c5fd' }} />
                        )}
                        {slot.patch.cinematography?.lens && (
                          <Chip label={slot.patch.cinematography.lens} size="small" sx={{ height: 18, fontSize: 9, bgcolor: 'rgba(250,204,21,0.15)', color: '#fde68a' }} />
                        )}
                        {slot.patch.overlay?.showGrid && (
                          <Chip icon={<GridOn sx={{ fontSize: 10 }} />} label="Grid" size="small" sx={{ height: 18, fontSize: 9, bgcolor: 'rgba(56,189,248,0.15)', color: '#67e8f9' }} />
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </>
            )}

            <Divider sx={{ borderColor: 'rgba(148,163,184,0.25)' }} />

            <Typography variant="caption" sx={{ letterSpacing: 0.7, color: '#94a3b8' }}>
              BRUSH LIBRARY
            </Typography>
            <Stack spacing={0.7}>
              {BRUSH_LIBRARY_GROUPS.map((group) => (
                <Chip
                  key={group}
                  label={group}
                  onClick={() => setSelectedLibraryGroup(group)}
                  size="small"
                  sx={{
                    justifyContent: 'flex-start',
                    bgcolor: selectedLibraryGroup === group ? 'rgba(245,158,11,0.2)' : 'rgba(15,23,42,0.72)',
                    color: selectedLibraryGroup === group ? '#fde68a' : '#cbd5e1',
                    border: `1px solid ${
                      selectedLibraryGroup === group ? 'rgba(245,158,11,0.4)' : 'rgba(148,163,184,0.26)'
                    }`,
                  }}
                />
              ))}
            </Stack>

            <Divider sx={{ borderColor: 'rgba(148,163,184,0.25)' }} />

            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Size {Math.round(proBrushSettings.size ?? 42)}px
            </Typography>
            <Slider
              size="small"
              min={1}
              max={120}
              value={proBrushSettings.size ?? 42}
              onChange={(_event, value) =>
                setProBrushSettings((previous) => ({
                  ...previous,
                  size: value as number,
                }))
              }
            />

            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Opacity {Math.round((proBrushSettings.opacity ?? 0.78) * 100)}%
            </Typography>
            <Slider
              size="small"
              min={0.05}
              max={1}
              step={0.01}
              value={proBrushSettings.opacity ?? 0.78}
              onChange={(_event, value) =>
                setProBrushSettings((previous) => ({
                  ...previous,
                  opacity: value as number,
                }))
              }
            />

            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Flow {Math.round((proBrushSettings.flow ?? 0.65) * 100)}%
            </Typography>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.01}
              value={proBrushSettings.flow ?? 0.65}
              onChange={(_event, value) =>
                setProBrushSettings((previous) => ({
                  ...previous,
                  flow: value as number,
                }))
              }
            />

            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Pressure {Math.round((proBrushSettings.pressureSensitivity ?? 0.75) * 100)}%
            </Typography>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.01}
              value={proBrushSettings.pressureSensitivity ?? 0.75}
              onChange={(_event, value) =>
                setProBrushSettings((previous) => ({
                  ...previous,
                  pressureSensitivity: value as number,
                }))
              }
            />

            <Divider sx={{ borderColor: 'rgba(148,163,184,0.25)' }} />

            <Typography variant="caption" sx={{ letterSpacing: 0.7, color: '#94a3b8' }}>
              CANVAS SURFACE
            </Typography>

            <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
              {CANVAS_BACKGROUND_OPTIONS.map((option) => {
                const selected = canvasSurface.fillColor.toLowerCase() === option.fillColor.toLowerCase();
                return (
                  <Tooltip key={option.fillColor} title={option.label}>
                    <IconButton
                      size="small"
                      onClick={() =>
                        setCanvasSurface((previous) => ({
                          ...previous,
                          fillColor: option.fillColor,
                          texture:
                            option.fillColor.toLowerCase() === '#ffffff' && previous.texture === 'none'
                              ? 'paper'
                              : previous.texture,
                        }))
                      }
                      sx={{
                        width: 24,
                        height: 24,
                        p: 0,
                        borderRadius: '50%',
                        bgcolor: option.fillColor,
                        border: selected
                          ? '2px solid rgba(56,189,248,0.95)'
                          : '1px solid rgba(148,163,184,0.45)',
                        boxShadow: selected ? '0 0 0 2px rgba(56,189,248,0.25)' : 'none',
                      }}
                    />
                  </Tooltip>
                );
              })}
            </Stack>

            <ToggleButtonGroup
              size="small"
              exclusive
              value={canvasSurface.texture}
              onChange={(_event, value: CanvasTexturePreset | null) => {
                if (!value) return;
                setCanvasSurface((previous) => ({ ...previous, texture: value }));
              }}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                '& .MuiToggleButton-root': {
                  color: '#cbd5e1',
                  py: 0.25,
                  px: 0.7,
                  borderColor: 'rgba(148,163,184,0.28)',
                  fontSize: 11,
                },
                '& .Mui-selected': {
                  color: '#fde68a !important',
                  bgcolor: 'rgba(250,204,21,0.18) !important',
                },
              }}
            >
              {CANVAS_TEXTURE_OPTIONS.map((option) => (
                <ToggleButton key={option.id} value={option.id}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Texture Intensity {Math.round(canvasSurface.textureOpacity * 100)}%
            </Typography>
            <Slider
              size="small"
              min={0}
              max={0.8}
              step={0.01}
              value={canvasSurface.textureOpacity}
              onChange={(_event, value) =>
                setCanvasSurface((previous) => ({
                  ...previous,
                  textureOpacity: value as number,
                }))
              }
            />
            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Texture Scale {canvasSurface.textureScale.toFixed(2)}x
            </Typography>
            <Slider
              size="small"
              min={0.6}
              max={2.4}
              step={0.05}
              value={canvasSurface.textureScale}
              onChange={(_event, value) =>
                setCanvasSurface((previous) => ({
                  ...previous,
                  textureScale: value as number,
                }))
              }
            />
          </Stack>
        </Dock>
        )}

        <CanvasWrapper sx={{ minWidth: 0 }}>
          <CanvasShell
            ref={canvasViewportRef}
            sx={{
              minHeight: isSingleColumnLayout ? 420 : 0,
            }}
          >
            {proMode ? (
              <PencilCanvasPro
                projectId={projectId}
                currentFrameId={frameId}
                currentStoryboardId={storyboardId}
                ref={pencilCanvasProRef}
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                backgroundImage={initialImage}
                canvasSurface={canvasSurface}
                referenceImage={referenceImage || undefined}
                initialStrokes={strokes}
                brushSettings={proBrushSettings}
                showToolbar={false}
                showPressureIndicator={device.hasPencilSupport}
                showReferenceImageControls={false}
                showGridOverlay={decisionData.overlays.grid}
                showDrawingToolsPanel
                drawingToolsPanelPosition="right"
                toolsPanelCollapsed={toolsPanelCollapsed}
                onToolsPanelCollapsedChange={setToolsPanelCollapsed}
                palmRejection="smart"
                initialDrawingState={drawingStateSnapshot}
                onDrawingStateChange={setDrawingStateSnapshot}
                initialShapes={shapesSnapshot}
                onShapesChange={setShapesSnapshot}
                onStrokesChange={handleStrokesChange}
                onSave={handleSave}
                onReferenceImageChange={setReferenceImage}
                initialConceptArt={conceptArt}
                onConceptArtChange={handleConceptArtChange}
                initialDecisionData={decisionData}
                onDecisionDataChange={handleDecisionDataChange}
                scriptContext={drawingScriptContext}
              />
            ) : (
              <PencilCanvas
                ref={pencilCanvasRef}
                width={canvasDimensions.width}
                height={canvasDimensions.height}
                backgroundImage={initialImage}
                initialStrokes={strokes}
                brushSettings={brushSettings}
                showToolbar
                showPressureIndicator={device.hasPencilSupport}
                palmRejection="smart"
                onStrokesChange={handleStrokesChange}
                onSave={handleSave}
              />
            )}
          </CanvasShell>

          <BrushStrip>
            {(['rough', 'ink', 'shadow', 'light', 'fx', 'text'] as const).map((label) => (
              <BrushTile
                key={label}
                active={label === 'shadow'}
                onClick={() => setSelectedLibraryGroup(label.toUpperCase())}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
                  {label.toUpperCase()}
                </Typography>
              </BrushTile>
            ))}
            <Chip
              label="Perspective Grid"
              size="small"
              onClick={() =>
                updateDecisionData((nextData) => {
                  nextData.overlays.perspectiveGrid = !nextData.overlays.perspectiveGrid;
                })
              }
              sx={{
                alignSelf: 'center',
                bgcolor: decisionData.overlays.perspectiveGrid ? 'rgba(56,189,248,0.25)' : 'rgba(15,23,42,0.75)',
                color: decisionData.overlays.perspectiveGrid ? '#67e8f9' : '#cbd5e1',
              }}
            />
            <Chip
              label="Snap"
              size="small"
              onClick={() =>
                updateDecisionData((nextData) => {
                  nextData.overlays.perspectiveSnap = !nextData.overlays.perspectiveSnap;
                })
              }
              sx={{
                alignSelf: 'center',
                bgcolor: decisionData.overlays.perspectiveSnap ? 'rgba(250,204,21,0.26)' : 'rgba(15,23,42,0.75)',
                color: decisionData.overlays.perspectiveSnap ? '#fde68a' : '#cbd5e1',
              }}
            />
            <Chip
              label="Light Aware Brush"
              size="small"
              onClick={() =>
                setProBrushSettings((previous) => ({
                  ...previous,
                  lightingAware: !(previous.lightingAware ?? true),
                }))
              }
              sx={{
                alignSelf: 'center',
                bgcolor: proBrushSettings.lightingAware ? 'rgba(250,204,21,0.3)' : 'rgba(15,23,42,0.75)',
                color: proBrushSettings.lightingAware ? '#fde68a' : '#cbd5e1',
                fontWeight: 700,
              }}
            />
          </BrushStrip>

          <FilmStrip>
            <Stack direction="row" spacing={0.4} alignItems="center" sx={{ minWidth: 176 }}>
              <IconButton size="small" sx={{ color: '#94a3b8' }}>
                <SkipPrevious sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton
                size="small"
                sx={{ color: transportPlaying ? '#fde68a' : '#93c5fd' }}
                onClick={() => setTransportPlaying((previous) => !previous)}
              >
                {transportPlaying ? <Pause sx={{ fontSize: 18 }} /> : <PlayArrow sx={{ fontSize: 18 }} />}
              </IconButton>
              <IconButton size="small" sx={{ color: '#94a3b8' }}>
                <SkipNext sx={{ fontSize: 18 }} />
              </IconButton>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#f8fafc', ml: 0.5 }}>
                {(decisionData.animatic.frameTimingMs / 1000).toFixed(2)}s
              </Typography>
            </Stack>
            <Box sx={{ minWidth: 220, flex: 1, px: 1 }}>
              <Slider
                size="small"
                min={250}
                max={10000}
                step={50}
                value={decisionData.animatic.frameTimingMs}
                onChange={(_event, value) =>
                  updateDecisionData((nextData) => {
                    nextData.animatic.frameTimingMs = value as number;
                  })
                }
                sx={{
                  color: '#facc15',
                  '& .MuiSlider-thumb': { width: 12, height: 12 },
                }}
              />
            </Box>
            <Stack direction="row" spacing={0.7}>
              {[0, 1, 2, 3, 4].map((index) => (
                <FilmFrameThumb
                  key={index}
                  active={index === 2}
                  onClick={() =>
                    updateDecisionData((nextData) => {
                      nextData.animatic.cutVariant = index % 2 === 0 ? 'director' : 'edit';
                    })
                  }
                />
              ))}
            </Stack>
          </FilmStrip>
        </CanvasWrapper>

        {rightDockCollapsed ? (
          <DockRail>
            <Tooltip title="Expand Inspector">
              <IconButton
                size="small"
                onClick={toggleRightDock}
                sx={{ color: '#67e8f9', border: '1px solid rgba(103,232,249,0.35)', borderRadius: 1 }}
              >
                <KeyboardDoubleArrowLeft sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Stack spacing={1} alignItems="center" sx={{ py: 1 }}>
              <LightMode sx={{ fontSize: 18, color: '#fde68a' }} />
              <CameraAlt sx={{ fontSize: 16, color: '#93c5fd' }} />
              <Tune sx={{ fontSize: 16, color: '#fbbf24' }} />
            </Stack>
            <Typography
              variant="caption"
              sx={{
                writingMode: 'vertical-rl',
                letterSpacing: 1.4,
                color: '#64748b',
                fontWeight: 700,
              }}
            >
              INSPECT
            </Typography>
          </DockRail>
        ) : (
        <Dock>
          <Stack spacing={1.25}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700, letterSpacing: 0.8 }}>
                LIGHTING
              </Typography>
              <Stack direction="row" spacing={0.4}>
                <IconButton
                  size="small"
                  sx={{ color: '#fbbf24' }}
                  onClick={() =>
                    updateDecisionData((nextData) => {
                      nextData.cinematography.keyLightDirection = 315;
                      nextData.cinematography.keyLightIntensity = 0.7;
                    })
                  }
                >
                  <Tune sx={{ fontSize: 16 }} />
                </IconButton>
                <Tooltip title="Collapse Right Panel">
                  <IconButton
                    size="small"
                    onClick={toggleRightDock}
                    sx={{ color: '#67e8f9', border: '1px solid rgba(148,163,184,0.28)', borderRadius: 1 }}
                  >
                    <KeyboardDoubleArrowRight sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>

            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Key Light Direction ({Math.round(decisionData.cinematography.keyLightDirection)} deg)
            </Typography>
            <Slider
              size="small"
              min={0}
              max={360}
              value={decisionData.cinematography.keyLightDirection}
              onChange={(_event, value) =>
                updateDecisionData((nextData) => {
                  nextData.cinematography.keyLightDirection = value as number;
                })
              }
              sx={{ color: '#fbbf24' }}
            />

            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Intensity {Math.round(decisionData.cinematography.keyLightIntensity * 100)}%
            </Typography>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.01}
              value={decisionData.cinematography.keyLightIntensity}
              onChange={(_event, value) =>
                updateDecisionData((nextData) => {
                  nextData.cinematography.keyLightIntensity = value as number;
                })
              }
              sx={{ color: '#fbbf24' }}
            />

            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Lens {decisionData.cinematography.lensMm}mm
            </Typography>
            <Slider
              size="small"
              min={8}
              max={200}
              value={decisionData.cinematography.lensMm}
              onChange={(_event, value) =>
                updateDecisionData((nextData) => {
                  nextData.cinematography.lensMm = value as number;
                })
              }
            />

            <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
              Aperture f/{decisionData.cinematography.apertureFStop.toFixed(1)}
            </Typography>
            <Slider
              size="small"
              min={0.95}
              max={22}
              step={0.05}
              value={decisionData.cinematography.apertureFStop}
              onChange={(_event, value) =>
                updateDecisionData((nextData) => {
                  nextData.cinematography.apertureFStop = value as number;
                })
              }
            />

            <Divider sx={{ borderColor: 'rgba(148,163,184,0.22)' }} />

            <Typography variant="caption" sx={{ color: '#f8fafc', fontWeight: 700, letterSpacing: 0.8 }}>
              SHOT SETTINGS
            </Typography>
            <Stack spacing={0.65}>
              {LAYER_PRESETS.map((layer) => (
                <Chip
                  key={layer}
                  label={layer}
                  size="small"
                  sx={{
                    justifyContent: 'flex-start',
                    bgcolor: layer === 'Shadows' ? 'rgba(250,204,21,0.2)' : 'rgba(15,23,42,0.72)',
                    color: layer === 'Shadows' ? '#fde68a' : '#cbd5e1',
                    border: `1px solid ${
                      layer === 'Shadows' ? 'rgba(250,204,21,0.35)' : 'rgba(148,163,184,0.26)'
                    }`,
                  }}
                />
              ))}
            </Stack>

            <Divider sx={{ borderColor: 'rgba(148,163,184,0.22)' }} />

            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Undo">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleUndo}
                    disabled={strokes.length === 0}
                    sx={{ color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 1 }}
                  >
                    <Undo sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Redo">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleRedo}
                    disabled={strokes.length === 0}
                    sx={{ color: '#cbd5e1', border: '1px solid rgba(148,163,184,0.25)', borderRadius: 1 }}
                  >
                    <Redo sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Clear Canvas">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleClear}
                    disabled={strokes.length === 0}
                    sx={{ color: '#fca5a5', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 1 }}
                  >
                    <Delete sx={{ fontSize: 16 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Save">
                <IconButton
                  size="small"
                  onClick={handleSaveFromCanvas}
                  sx={{ color: '#86efac', border: '1px solid rgba(74,222,128,0.35)', borderRadius: 1 }}
                >
                  <Save sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Dock>
        )}
      </Workbench>

      {/* Status Bar */}
      <StatusBar>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
            {canvasDimensions.width} × {canvasDimensions.height}px
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.87)' }}>
            Strokes: {strokes.length}
          </Typography>
          <Chip
            size="small"
            label={
              focusMode
                ? 'Focus Mode'
                : leftDockCollapsed || rightDockCollapsed
                  ? 'Panels Minimized'
                  : 'Panels Expanded'
            }
            sx={{
              bgcolor: focusMode ? 'rgba(250,204,21,0.18)' : 'rgba(148,163,184,0.14)',
              color: focusMode ? '#fde68a' : '#cbd5e1',
              height: 20,
            }}
          />
          <Chip
            size="small"
            label={`Surface ${currentSurfaceName} • ${canvasSurface.texture}`}
            sx={{ bgcolor: 'rgba(56,189,248,0.14)', color: '#7dd3fc', height: 20 }}
          />
          <Chip
            size="small"
            label={`${decisionData.cinematography.shotSize} • ${decisionData.cinematography.lensMm}mm • ${decisionData.cinematography.frameRate}fps`}
            sx={{ bgcolor: 'rgba(96,165,250,0.15)', color: '#93c5fd', height: 20 }}
          />
          <Chip
            size="small"
            label={`${(decisionData.animatic.frameTimingMs / 1000).toFixed(2)}s`}
            sx={{ bgcolor: 'rgba(248,113,113,0.15)', color: '#fca5a5', height: 20 }}
          />
          {hasUnsavedChanges && (
            <Chip 
              label="Unsaved" 
              size="small" 
              sx={{ bgcolor: 'rgba(245,158,11,0.2)', color: '#f59e0b', height: 20 }}
            />
          )}
          {saveWarnings.length > 0 && (
            <Tooltip title={saveWarnings.join('\n')}>
              <Chip
                label={`${saveWarnings.length} warning${saveWarnings.length > 1 ? 's' : ''}`}
                size="small"
                sx={{ bgcolor: 'rgba(239,68,68,0.2)', color: '#ef4444', height: 20, cursor: 'help' }}
              />
            </Tooltip>
          )}
          {lastSavedImage && !hasUnsavedChanges && (
            <Chip
              label="Saved"
              size="small"
              sx={{ bgcolor: 'rgba(34,197,94,0.2)', color: '#22c55e', height: 20 }}
            />
          )}
          {shareFeedback && (
            <Chip
              label={shareFeedback}
              size="small"
              sx={{ bgcolor: 'rgba(125,211,252,0.2)', color: '#7dd3fc', height: 20 }}
            />
          )}
        </Stack>

        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleCancel}
            sx={{ color: 'rgba(255,255,255,0.87)', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<Save />}
            disabled={!hasUnsavedChanges}
            sx={{ bgcolor: '#7c3aed', '&:hover': { bgcolor: '#6d28d9' } }}
            onClick={handleSaveFromCanvas}
          >
            Save to Frame
          </Button>
        </Stack>
      </StatusBar>

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
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'transparent',
            backgroundImage: 'none',
            boxShadow: 'none',
            overflow: 'visible',
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
  projectId?: string;
  frameId: string;
  storyboardId: string;
  aspectRatio?: '16:9' | '4:3' | '2.35:1' | '1:1' | '9:16';
  existingImage?: string;
  onDrawingComplete?: (drawingData: FrameDrawingData, imageDataUrl: string) => void;
}

export const QuickDrawButton: FC<QuickDrawButtonProps> = ({
  projectId,
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
          projectId={projectId}
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
