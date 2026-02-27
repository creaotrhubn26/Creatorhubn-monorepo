/**
 * PencilCanvasPro - Professional-grade Apple Pencil drawing canvas
 * 
 * Features (extends PencilCanvas):
 * - All original PencilCanvas features
 * - Advanced brush engine (watercolor, pencil, marker, ink)
 * - Wet blending for watercolor
 * - Texture effects (grain, paper tooth)
 * - Professional brush toolbar
 * - Reference image layer support
 * - Layer system with opacity
 * - Matches Apple Storyboards quality
 * 
 * New Professional Features:
 * - Multi-layer system with blend modes
 * - Shape tools (rectangle, ellipse, arrows, etc.)
 * - Text annotations
 * - Selection and transform tools
 * - Symmetry mode (mirror drawing)
 * - Brush library with presets
 * - Pressure curve editor
 * - Onion skinning for animation
 * - Eyedropper color sampling
 * - Gesture shortcuts (iPadOS style)
 * - Export options (PNG, JPEG, SVG, PDF, PSD)
 */

import React, { useRef, useEffect, useState, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Slider,
  Paper,
  Typography,
  Popover,
  Fade,
  Badge,
  Divider,
} from '@mui/material';
import {
  Undo,
  Redo,
  Delete,
  Save,
  Create,
  TouchApp,
  Image,
  Layers,
  BrushOutlined,
  GridOn,
  Build,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  useApplePencil,
  PencilPoint,
  PencilStroke,
} from '../hooks/useApplePencil';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import {
  AdvancedBrushEngine,
  ProBrushType,
  ProBrushSettings,
  DEFAULT_BRUSH_SETTINGS,
  CINEMATIC_BRUSH_PRESETS,
} from './drawing/AdvancedBrushEngine';
import {
  DrawingToolsPanel,
  DrawingState,
  DEFAULT_DRAWING_STATE,
} from './drawing/DrawingToolsPanel';
import type { ScriptContext } from './drawing/DrawingToolsPanel';
import {
  getMirroredPoints,
  drawSymmetryGuides,
} from './drawing/SymmetryMode';
import {
  evaluatePressureCurve,
} from './drawing/PressureCurveEditor';
import {
  useGestureHandler,
  GestureAction,
} from './drawing/GestureShortcuts';
import {
  getOnionFrames,
  renderOnionSkins,
} from './drawing/OnionSkinning';
import {
  ExportSettings,
  ExportFrame,
  exportAsImage,
  downloadBlob,
  generateFilename,
} from './drawing/ExportOptions';
import { drawGuides } from './drawing/StoryboardTemplates';
import type { FrameGuides } from './drawing/StoryboardTemplates';
import { DrawingLayer } from './drawing/LayersPanel';
import { drawShape, Shape } from './drawing/ShapeTools';
import { WebGLBrushEngine } from './drawing/WebGLBrushEngine';
import {
  DEFAULT_FRAME_DECISION_DATA,
  cloneFrameDecisionData,
} from '../state/storyboardStore';
import type {
  FrameConceptArtData,
  FrameDecisionData,
} from '../state/storyboardStore';

// =============================================================================
// Types
// =============================================================================

export interface ReferenceImage {
  src: string;
  opacity: number;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CanvasTexturePreset = 'none' | 'paper' | 'canvas' | 'grain' | 'blueprint';

export interface CanvasSurfaceSettings {
  fillColor: string;
  texture: CanvasTexturePreset;
  textureOpacity: number;
  textureScale: number;
}

export interface PencilCanvasProProps {
  projectId?: string;
  currentFrameId?: string;
  currentStoryboardId?: string;
  width: number;
  height: number;
  backgroundImage?: string;
  canvasSurface?: Partial<CanvasSurfaceSettings>;
  referenceImage?: ReferenceImage;
  initialStrokes?: PencilStroke[];
  brushSettings?: Partial<ProBrushSettings>;
  showToolbar?: boolean;
  showPressureIndicator?: boolean;
  showReferenceImageControls?: boolean;
  showGridOverlay?: boolean;
  showDrawingToolsPanel?: boolean;
  initialDrawingState?: DrawingState;
  drawingToolsPanelPosition?: 'left' | 'right';
  toolsPanelCollapsed?: boolean;
  onToolsPanelCollapsedChange?: (collapsed: boolean) => void;
  palmRejection?: 'off' | 'pencil-only' | 'smart';
  currentFrameIndex?: number;
  totalFrames?: number;
  getFrameImage?: (index: number) => HTMLCanvasElement | null;
  onStrokesChange?: (strokes: PencilStroke[]) => void;
  onSave?: (imageData: string) => void;
  onReferenceImageChange?: (ref: ReferenceImage | null) => void;
  onDrawingStateChange?: (state: DrawingState) => void;
  initialShapes?: Shape[];
  onShapesChange?: (shapes: Shape[]) => void;
  onExport?: (settings: ExportSettings, frameIndices: number[]) => Promise<void>;
  initialConceptArt?: FrameConceptArtData;
  onConceptArtChange?: (conceptArt: FrameConceptArtData) => void;
  initialDecisionData?: FrameDecisionData;
  onDecisionDataChange?: (decisionData: FrameDecisionData) => void;
  scriptContext?: ScriptContext | null;
}

export interface PencilCanvasProHandle {
  save: () => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  getCanvas: () => HTMLCanvasElement | null;
  /** Returns a canvas compositing reference + strokes layers into one bitmap */
  getCompositeCanvas: () => HTMLCanvasElement | null;
}

export const DEFAULT_CANVAS_SURFACE: CanvasSurfaceSettings = {
  fillColor: '#ffffff',
  texture: 'none',
  textureOpacity: 0.22,
  textureScale: 1,
};

const BRUSH_SETTING_KEYS: Array<keyof ProBrushSettings> = [
  'type',
  'size',
  'color',
  'opacity',
  'hardness',
  'flow',
  'wetness',
  'grain',
  'tiltSensitivity',
  'pressureSensitivity',
  'blendMode',
  'cinematicPreset',
  'lensMm',
  'aperture',
  'keyLightDirection',
  'keyLightIntensity',
  'valueContrast',
  'shadowBias',
  'highlightBias',
  'warmTint',
  'hatchAngle',
  'hatchDensity',
  'motionAccent',
  'lightWrap',
  'lensAwareShading',
  'lightingAware',
];

const serializeBrushSettings = (settings: ProBrushSettings): Record<string, unknown> => ({ ...settings });

const parseStoredBrushSettings = (stored?: Record<string, unknown>): Partial<ProBrushSettings> | null => {
  if (!stored || typeof stored !== 'object') return null;
  const parsed: Partial<ProBrushSettings> = {};
  BRUSH_SETTING_KEYS.forEach((key) => {
    const value = stored[key];
    if (value !== undefined) {
      if (
        (
          key === 'type' ||
          key === 'color' ||
          key === 'blendMode' ||
          key === 'cinematicPreset'
        ) &&
        typeof value === 'string'
      ) {
        parsed[key] = value as ProBrushSettings[typeof key];
      } else if ((key === 'lensAwareShading' || key === 'lightingAware') && typeof value === 'boolean') {
        parsed[key] = value as ProBrushSettings[typeof key];
      } else if (typeof value === 'number') {
        parsed[key] = value as ProBrushSettings[typeof key];
      }
    }
  });
  return Object.keys(parsed).length > 0 ? parsed : null;
};

const buildGuidesFromDecision = (decisionData: FrameDecisionData): FrameGuides => {
  const { overlays } = decisionData;
  const guideType = overlays.safeAreas
    ? 'safe'
    : overlays.centerCross
      ? 'center'
      : overlays.ruleOfThirds
        ? 'thirds'
        : 'none';

  return {
    type: guideType,
    enabled: guideType !== 'none',
    opacity: overlays.opacity,
    color: '#ffffff',
    showActionSafe: overlays.showActionSafe || overlays.safeAreas,
    showTitleSafe: overlays.showTitleSafe || overlays.safeAreas,
  };
};

const drawEyelineGuide = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opacity: number
) => {
  ctx.save();
  ctx.globalAlpha = Math.max(0.15, Math.min(opacity, 1));
  ctx.strokeStyle = '#93c5fd';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  const eyelineY = height * 0.38;
  ctx.beginPath();
  ctx.moveTo(0, eyelineY);
  ctx.lineTo(width, eyelineY);
  ctx.stroke();
  ctx.restore();
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

interface PerspectiveGeometry {
  horizonY: number;
  centerVanishing: { x: number; y: number };
  leftVanishing: { x: number; y: number };
  rightVanishing: { x: number; y: number };
}

interface LineSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const getPerspectiveGeometry = (
  width: number,
  height: number,
  decisionData: FrameDecisionData
): PerspectiveGeometry => {
  const normalizedHeight = clamp((decisionData.cinematography.cameraHeightCm - 20) / 280, 0, 1);
  const horizonY = height * clamp(0.68 - normalizedHeight * 0.46, 0.22, 0.78);
  const wideLensSpread = clamp((50 - decisionData.cinematography.lensMm) / 42, -0.4, 0.7);
  const spreadMultiplier = 1.35 + wideLensSpread * 0.9;
  const spread = width * spreadMultiplier;

  return {
    horizonY,
    centerVanishing: { x: width * 0.5, y: horizonY },
    leftVanishing: { x: width * 0.5 - spread, y: horizonY },
    rightVanishing: { x: width * 0.5 + spread, y: horizonY },
  };
};

const projectPointToLine = (
  point: { x: number; y: number },
  line: LineSegment,
): { x: number; y: number; distance: number } => {
  const vx = line.end.x - line.start.x;
  const vy = line.end.y - line.start.y;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 0.0001) {
    const distance = Math.hypot(point.x - line.start.x, point.y - line.start.y);
    return { x: line.start.x, y: line.start.y, distance };
  }
  const t = ((point.x - line.start.x) * vx + (point.y - line.start.y) * vy) / lenSq;
  const clampedT = clamp(t, 0, 1);
  const x = line.start.x + vx * clampedT;
  const y = line.start.y + vy * clampedT;
  return { x, y, distance: Math.hypot(point.x - x, point.y - y) };
};

const snapPointToPerspective = (
  point: PencilPoint,
  width: number,
  height: number,
  decisionData: FrameDecisionData,
): PencilPoint => {
  if (!decisionData.overlays.perspectiveSnap) return point;

  const geometry = getPerspectiveGeometry(width, height, decisionData);
  const lines: LineSegment[] = [
    { start: { x: 0, y: geometry.horizonY }, end: { x: width, y: geometry.horizonY } },
    { start: { x: width * 0.5, y: 0 }, end: { x: width * 0.5, y: height } },
  ];

  const anchors = 8;
  for (let i = 0; i <= anchors; i++) {
    const anchorX = (width * i) / anchors;
    const anchorY = height;
    lines.push({ start: geometry.centerVanishing, end: { x: anchorX, y: anchorY } });
    if (decisionData.overlays.vanishingPoints || decisionData.overlays.perspectiveGrid) {
      const verticalAnchorY = (height * i) / anchors;
      lines.push({ start: geometry.leftVanishing, end: { x: width, y: verticalAnchorY } });
      lines.push({ start: geometry.rightVanishing, end: { x: 0, y: verticalAnchorY } });
    }
  }

  const snapThreshold = clamp(width * 0.018, 10, 22);
  let closest = { x: point.x, y: point.y, distance: Number.POSITIVE_INFINITY };
  lines.forEach((line) => {
    const projected = projectPointToLine(point, line);
    if (projected.distance < closest.distance) {
      closest = projected;
    }
  });

  if (closest.distance > snapThreshold) return point;

  return {
    ...point,
    x: closest.x,
    y: closest.y,
  };
};

const drawProductionOverlays = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  decisionData: FrameDecisionData,
) => {
  const overlays = decisionData.overlays;
  const showPerspective = overlays.perspectiveGrid || overlays.vanishingPoints;
  if (!showPerspective && !overlays.lensFalloff && !overlays.lightingVector) return;

  const geometry = getPerspectiveGeometry(width, height, decisionData);
  const alpha = clamp(overlays.opacity, 0.1, 1);

  if (showPerspective) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    ctx.moveTo(0, geometry.horizonY);
    ctx.lineTo(width, geometry.horizonY);
    ctx.stroke();

    const rays = 8;
    for (let i = 0; i <= rays; i++) {
      const x = (width * i) / rays;
      ctx.beginPath();
      ctx.moveTo(geometry.centerVanishing.x, geometry.centerVanishing.y);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    if (overlays.vanishingPoints) {
      ctx.setLineDash([3, 3]);
      for (let i = 1; i < rays; i++) {
        const y = (height * i) / rays;
        ctx.beginPath();
        ctx.moveTo(geometry.leftVanishing.x, geometry.leftVanishing.y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(geometry.rightVanishing.x, geometry.rightVanishing.y);
        ctx.lineTo(0, y);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(56, 189, 248, 0.95)';
      [geometry.centerVanishing, geometry.leftVanishing, geometry.rightVanishing].forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  }

  if (overlays.lensFalloff) {
    ctx.save();
    const lensMm = decisionData.cinematography.lensMm;
    const wideFactor = clamp((35 - lensMm) / 30, 0, 1);
    const vignetteStrength = 0.08 + wideFactor * 0.2;
    const gradient = ctx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.2,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.62
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${vignetteStrength * alpha})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  if (overlays.lightingVector) {
    const lightAngle = (decisionData.cinematography.keyLightDirection * Math.PI) / 180;
    const arrowLength = Math.min(width, height) * 0.18;
    const startX = width - 24;
    const startY = 24;
    const endX = startX + Math.cos(lightAngle) * arrowLength;
    const endY = startY + Math.sin(lightAngle) * arrowLength;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#fde68a';
    ctx.fillStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    const headSize = 7;
    const headAngle = Math.atan2(endY - startY, endX - startX);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(
      endX - Math.cos(headAngle - Math.PI / 6) * headSize,
      endY - Math.sin(headAngle - Math.PI / 6) * headSize
    );
    ctx.lineTo(
      endX - Math.cos(headAngle + Math.PI / 6) * headSize,
      endY - Math.sin(headAngle + Math.PI / 6) * headSize
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
};

const resolveEffectiveBrushSettings = (
  base: ProBrushSettings,
  decisionData: FrameDecisionData
): ProBrushSettings => {
  const cinematicPreset = base.cinematicPreset ?? 'none';
  const cinematicConfig = cinematicPreset !== 'none'
    ? CINEMATIC_BRUSH_PRESETS[cinematicPreset].config
    : {};

  return {
    ...DEFAULT_BRUSH_SETTINGS,
    ...cinematicConfig,
    ...base,
    lensMm: decisionData.cinematography.lensMm,
    aperture: decisionData.cinematography.apertureFStop,
    keyLightDirection: decisionData.cinematography.keyLightDirection,
    keyLightIntensity: decisionData.cinematography.keyLightIntensity,
    lensAwareShading: cinematicPreset !== 'none' ? true : base.lensAwareShading,
    lightingAware: cinematicPreset !== 'none' ? true : base.lightingAware,
  };
};

const buildCanvasTextureTile = (
  texture: CanvasTexturePreset,
  scale: number
): HTMLCanvasElement => {
  const normalizedScale = clamp(scale, 0.6, 2.4);
  const tileSize = Math.max(64, Math.round(120 * normalizedScale));
  const tile = document.createElement('canvas');
  tile.width = tileSize;
  tile.height = tileSize;
  const ctx = tile.getContext('2d');
  if (!ctx) return tile;

  ctx.clearRect(0, 0, tileSize, tileSize);

  if (texture === 'paper') {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < tileSize; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 6, tileSize);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < 120; i++) {
      const px = Math.random() * tileSize;
      const py = Math.random() * tileSize;
      ctx.fillRect(px, py, 1, 1);
    }
  } else if (texture === 'canvas') {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1.2;
    for (let x = 0; x < tileSize; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, tileSize);
      ctx.stroke();
    }
    for (let y = 0; y < tileSize; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tileSize, y);
      ctx.stroke();
    }
  } else if (texture === 'grain') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let i = 0; i < 480; i++) {
      const px = Math.random() * tileSize;
      const py = Math.random() * tileSize;
      const dot = Math.random() > 0.85 ? 2 : 1;
      ctx.fillRect(px, py, dot, dot);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < 220; i++) {
      const px = Math.random() * tileSize;
      const py = Math.random() * tileSize;
      ctx.fillRect(px, py, 1, 1);
    }
  } else if (texture === 'blueprint') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    for (let x = 0; x < tileSize; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, tileSize);
      ctx.stroke();
    }
    for (let y = 0; y < tileSize; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(tileSize, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    for (let x = 0; x < tileSize; x += 18) {
      for (let y = 0; y < tileSize; y += 18) {
        ctx.fillRect(x - 0.5, y - 0.5, 1.2, 1.2);
      }
    }
  }

  return tile;
};

const paintCanvasSurface = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  surface: CanvasSurfaceSettings,
  textureTile: HTMLCanvasElement | null
) => {
  ctx.save();
  ctx.fillStyle = surface.fillColor;
  ctx.fillRect(0, 0, width, height);

  if (surface.texture !== 'none' && textureTile && surface.textureOpacity > 0) {
    const pattern = ctx.createPattern(textureTile, 'repeat');
    if (pattern) {
      ctx.globalAlpha = clamp(surface.textureOpacity, 0, 1);
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
    }
  }
  ctx.restore();
};

// =============================================================================
// Module-scope constants (hoisted from render body — P-4 fix)
// =============================================================================

const SIZE_PRESETS = [2, 4, 8, 16, 32] as const;

const COLOR_PRESETS = [
  '#000000', '#FFFFFF', '#FF5252', '#FF9800', '#FFEB3B',
  '#4CAF50', '#2196F3', '#9C27B0', '#795548', '#607D8B',
] as const;

// =============================================================================
// Styled Components
// =============================================================================

const CanvasContainer = styled(Box)({
  position: 'relative',
  backgroundColor: '#1a1a2e',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
});

const CanvasLayer = styled('canvas')({
  position: 'absolute',
  top: 0,
  left: 0,
  touchAction: 'none',
});

const ReferenceLayer = styled('canvas')({
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
});

const GridOverlay = styled('canvas')({
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none',
  opacity: 0.2,
});

const ProToolbar = styled(Paper)({
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '6px 12px',
  borderRadius: 28,
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  backdropFilter: 'blur(12px)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid rgba(255,255,255,0.08)',
});

const BrushButton = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected' && prop !== 'brushColor',
})<{ selected?: boolean; brushColor?: string }>(({ selected, brushColor }) => ({
  width: 40,
  height: 40,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  backgroundColor: selected ? 'rgba(255,255,255,0.15)' : 'transparent',
  border: selected ? `2px solid ${brushColor || '#fff'}` : '2px solid transparent',
  transition: 'all 0.2s',
  '&:hover': {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  '&:active': {
    transform: 'scale(0.95)',
  },
}));

const SizeDot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'dotSize' && prop !== 'selected',
})<{ dotSize: number; selected?: boolean }>(({ dotSize, selected }) => ({
  width: dotSize,
  height: dotSize,
  borderRadius: '50%',
  backgroundColor: selected ? '#fff' : 'rgba(255,255,255,0.5)',
  cursor: 'pointer',
  transition: 'all 0.2s',
  '&:hover': {
    backgroundColor: '#fff',
    transform: 'scale(1.2)',
  },
}));

const ColorButton = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  width: 28,
  height: 28,
  borderRadius: '50%',
  backgroundColor: color,
  cursor: 'pointer',
  border: '3px solid rgba(255,255,255,0.3)',
  transition: 'all 0.2s',
  '&:hover': {
    transform: 'scale(1.1)',
    border: '3px solid rgba(255,255,255,0.6)',
  },
}));

const PressureIndicator = styled(Box)({
  position: 'absolute',
  top: 16,
  right: 16,
  padding: '8px 12px',
  borderRadius: 8,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
});

const PencilModeIndicator = styled(Box)({
  position: 'absolute',
  top: 16,
  left: 16,
  padding: '4px 12px',
  borderRadius: 16,
  backgroundColor: 'rgba(76, 175, 80, 0.2)',
  color: '#4CAF50',
  fontSize: 12,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const HoverCursor = styled(Box)({
  position: 'absolute',
  pointerEvents: 'none',
  transform: 'translate(-50%, -50%)',
  borderRadius: '50%',
  transition: 'width 0.05s, height 0.05s',
});

// =============================================================================
// Brush Icons (SVG paths matching Apple style)
// =============================================================================

const BrushIcons: Record<ProBrushType, React.ReactNode> = {
  watercolor: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" opacity="0.9"/>
    </svg>
  ),
  pencil: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.07 4.93l-1.41-1.41c-.39-.39-1.02-.39-1.41 0L3 16.75V21h4.25L20.49 7.76c.39-.39.39-1.02 0-1.41l-1.42-1.42zM5.92 19l-1.41-1.41L15.34 6.76l1.41 1.41L5.92 19z"/>
    </svg>
  ),
  pen: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  ),
  marker: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.71 4.04c-.39-.39-1.02-.39-1.41 0l-2.83 2.83-5.66-5.66c-.39-.39-1.02-.39-1.41 0s-.39 1.02 0 1.41l.71.71-4.24 4.24c-.39.39-.39 1.02 0 1.41l7.07 7.07c.39.39 1.02.39 1.41 0l4.24-4.24.71.71c.39.39 1.02.39 1.41 0s.39-1.02 0-1.41l-5.66-5.66 2.83-2.83c.39-.39.39-1.02 0-1.41zM6.41 12L12 6.41 17.59 12 12 17.59 6.41 12z"/>
    </svg>
  ),
  ink: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C9.24 2 7 4.24 7 7c0 1.99 1.59 4.83 4 7.55V22h2v-7.45c2.41-2.72 4-5.56 4-7.55 0-2.76-2.24-5-5-5zm0 7c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
  ),
  brush: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3zm13.71-9.37l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41z"/>
    </svg>
  ),
  highlighter: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 14l3 3v5h6v-5l3-3V9H6v5zm5-12h2v3h-2V2zM3.5 5.88l1.41-1.41 2.12 2.12L5.62 8 3.5 5.88zm13.46.71l2.12-2.12 1.41 1.41L18.38 8l-1.42-1.41z"/>
    </svg>
  ),
  eraser: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73c-.78.78-.78 2.05 0 2.83l3.54 3.54c.37.37.88.59 1.41.59H14c.53 0 1.04-.21 1.41-.59l6.59-6.59c.78-.78.78-2.05 0-2.83l-5.45-5.45c-.39-.39-.9-.59-1.41-.59zM7.54 19L4 15.46l5.46-5.46 3.54 3.54L7.54 19z"/>
    </svg>
  ),
};

// =============================================================================
// Component
// =============================================================================

export const PencilCanvasPro = forwardRef<PencilCanvasProHandle, PencilCanvasProProps>(({
  projectId,
  currentFrameId,
  currentStoryboardId,
  width,
  height,
  backgroundImage,
  canvasSurface: canvasSurfaceProp,
  referenceImage: initialRefImage,
  initialStrokes = [],
  brushSettings: initialBrushSettings,
  showToolbar = true,
  showPressureIndicator = false,
  showReferenceImageControls = true,
  showGridOverlay: initialShowGrid = false,
  showDrawingToolsPanel = true,
  initialDrawingState,
  drawingToolsPanelPosition = 'right',
  toolsPanelCollapsed: controlledToolsPanelCollapsed,
  onToolsPanelCollapsedChange,
  palmRejection = 'smart',
  currentFrameIndex = 0,
  totalFrames = 1,
  getFrameImage,
  onStrokesChange,
  onSave,
  onReferenceImageChange,
  onDrawingStateChange,
  initialShapes,
  onShapesChange,
  onExport,
  initialConceptArt,
  onConceptArtChange,
  initialDecisionData,
  onDecisionDataChange,
  scriptContext,
}, ref) => {
  // Device detection — adapt UI for touch devices
  const device = useDeviceDetection();
  const isTouchDevice = device.hasTouchScreen && !device.hasPencilSupport;
  
  // Canvas refs
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const referenceCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const symmetryCanvasRef = useRef<HTMLCanvasElement>(null);
  const onionCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // HiDPI support — scale canvas buffers to native resolution
  const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const bufferWidth = Math.round(width * dpr);
  const bufferHeight = Math.round(height * dpr);
  
  // Brush engine
  const brushEngineRef = useRef<AdvancedBrushEngine | null>(null);
  
  // WebGL accelerated brush engine (optional — falls back to Canvas 2D)
  const webglEngineRef = useRef<WebGLBrushEngine | null>(null);
  const [useWebGL, setUseWebGL] = useState(false);
  
  // Cached reference image element to avoid re-creating Image per render
  const refImageCacheRef = useRef<{ src: string; img: HTMLImageElement } | null>(null);
  // Cached background image element
  const bgImageCacheRef = useRef<{ src: string; img: HTMLImageElement } | null>(null);
  /** Generation counter to discard stale async background image loads */
  const redrawGenRef = useRef(0);
  
  // Canvas transform state (zoom, pan, rotation)
  const [canvasTransform, setCanvasTransform] = useState({ zoom: 1, panX: 0, panY: 0, rotation: 0 });
  const surfaceTextureCacheRef = useRef<{ key: string; tile: HTMLCanvasElement } | null>(null);
  
  // State
  const [canvasSurface, setCanvasSurface] = useState<CanvasSurfaceSettings>({
    ...DEFAULT_CANVAS_SURFACE,
    ...canvasSurfaceProp,
  });
  const [brushSettings, setBrushSettings] = useState<ProBrushSettings>({
    ...DEFAULT_BRUSH_SETTINGS,
    ...initialBrushSettings,
  });
  const [strokes, setStrokes] = useState<PencilStroke[]>(initialStrokes);
  /** Stable ref mirror — always holds the latest strokes for use in closures that
   *  may fire before a batched React state update has flushed. */
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const [undoStack, setUndoStack] = useState<PencilStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<PencilStroke[][]>([]);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(initialRefImage || null);
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [refOpacity, setRefOpacity] = useState(initialRefImage?.opacity || 0.3);
  const [internalToolsPanelCollapsed, setInternalToolsPanelCollapsed] = useState(false);
  const toolsPanelCollapsed = controlledToolsPanelCollapsed ?? internalToolsPanelCollapsed;
  const setToolsPanelCollapsed = onToolsPanelCollapsedChange ?? setInternalToolsPanelCollapsed;
  
  // Drawing state for professional features
  const [drawingState, setDrawingState] = useState<DrawingState>(() => ({
    ...DEFAULT_DRAWING_STATE,
    ...(initialDrawingState ?? {}),
    decisionData: initialDecisionData
      ? cloneFrameDecisionData(initialDecisionData)
      : cloneFrameDecisionData(DEFAULT_FRAME_DECISION_DATA),
    conceptArt: initialConceptArt
      ? {
          intent: { ...initialConceptArt.intent },
          variants: [...initialConceptArt.variants],
          selectedVariantId: initialConceptArt.selectedVariantId,
          lastGeneratedAt: initialConceptArt.lastGeneratedAt,
        }
      : {
          ...DEFAULT_DRAWING_STATE.conceptArt,
          intent: { ...DEFAULT_DRAWING_STATE.conceptArt.intent },
          variants: [...DEFAULT_DRAWING_STATE.conceptArt.variants],
        },
    scriptContext: scriptContext ?? DEFAULT_DRAWING_STATE.scriptContext,
  }));

  // Stabilise initialDrawingState: only apply when the serialised form actually changes,
  // preventing re-render loops when the parent recreates the object on every render.
  const prevInitialDrawingStateJson = useRef<string | null>(null);
  useEffect(() => {
    if (!initialDrawingState) return;
    const json = JSON.stringify(initialDrawingState);
    if (json === prevInitialDrawingStateJson.current) return;
    prevInitialDrawingStateJson.current = json;
    setDrawingState(initialDrawingState);
  }, [initialDrawingState]);

  // Debounce drawing state change notifications to the parent to avoid
  // excessive re-renders when sub-fields change rapidly (H6 fix).
  const drawingStateChangeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDrawingStateRef = useRef(drawingState);
  latestDrawingStateRef.current = drawingState;
  useEffect(() => {
    if (!onDrawingStateChange) return;
    if (drawingStateChangeTimerRef.current) clearTimeout(drawingStateChangeTimerRef.current);
    drawingStateChangeTimerRef.current = setTimeout(() => {
      onDrawingStateChange(latestDrawingStateRef.current);
    }, 60); // ~1 frame at 16 Hz
    return () => {
      if (drawingStateChangeTimerRef.current) clearTimeout(drawingStateChangeTimerRef.current);
    };
  }, [drawingState, onDrawingStateChange]);
  
  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<PencilStroke[]>([]);
  
  // Shape objects on the canvas
  const [shapes, setShapes] = useState<Shape[]>(initialShapes ?? []);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  useEffect(() => {
    if (initialShapes) setShapes(initialShapes);
  }, [initialShapes]);

  // M6: Sync initialStrokes when parent provides new data (e.g., loading a different frame)
  const prevInitialStrokesRef = useRef(initialStrokes);
  useEffect(() => {
    if (initialStrokes !== prevInitialStrokesRef.current) {
      prevInitialStrokesRef.current = initialStrokes;
      setStrokes(initialStrokes);
    }
  }, [initialStrokes]);

  useEffect(() => {
    onShapesChange?.(shapes);
  }, [shapes, onShapesChange]);
  /** Tracks in-progress shape creation drag (startX, startY) */
  const shapeDragRef = useRef<{ startX: number; startY: number; shapeId: string } | null>(null);
  const conceptArtSyncReadyRef = useRef(false);
  const decisionDataSyncReadyRef = useRef(false);
  
  // Popover anchors
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [sizeAnchor, setSizeAnchor] = useState<HTMLElement | null>(null);
  const [refAnchor, setRefAnchor] = useState<HTMLElement | null>(null);
  
  // Update drawing state helper
  const updateDrawingState = useCallback((updates: Partial<DrawingState>) => {
    setDrawingState(prev => ({ ...prev, ...updates }));
  }, []);

  useEffect(() => {
    if (!initialConceptArt) return;
    updateDrawingState({
      conceptArt: {
        intent: { ...initialConceptArt.intent },
        variants: [...initialConceptArt.variants],
        selectedVariantId: initialConceptArt.selectedVariantId,
        lastGeneratedAt: initialConceptArt.lastGeneratedAt,
      },
    });
  }, [initialConceptArt, updateDrawingState]);

  useEffect(() => {
    if (!onConceptArtChange) return;
    if (!conceptArtSyncReadyRef.current) {
      conceptArtSyncReadyRef.current = true;
      return;
    }
    onConceptArtChange(drawingState.conceptArt);
  }, [drawingState.conceptArt, onConceptArtChange]);

  useEffect(() => {
    if (!initialDecisionData) return;
    updateDrawingState({
      decisionData: cloneFrameDecisionData(initialDecisionData),
    });
  }, [initialDecisionData, updateDrawingState]);

  useEffect(() => {
    if (!onDecisionDataChange) return;
    if (!decisionDataSyncReadyRef.current) {
      decisionDataSyncReadyRef.current = true;
      return;
    }
    onDecisionDataChange(drawingState.decisionData);
  }, [drawingState.decisionData, onDecisionDataChange]);

  useEffect(() => {
    if (scriptContext === undefined) return;
    updateDrawingState({ scriptContext });
  }, [scriptContext, updateDrawingState]);

  useEffect(() => {
    if (!initialBrushSettings) return;
    setBrushSettings((prev) => ({ ...prev, ...initialBrushSettings }));
  }, [initialBrushSettings]);

  useEffect(() => {
    if (!canvasSurfaceProp) return;
    setCanvasSurface((previous) => ({ ...previous, ...canvasSurfaceProp }));
  }, [canvasSurfaceProp]);
  
  // Apply pressure curve to points
  const applyPressureCurve = useCallback((point: PencilPoint): PencilPoint => {
    return {
      ...point,
      pressure: evaluatePressureCurve(drawingState.pressureCurve, point.pressure),
    };
  }, [drawingState.pressureCurve]);

  const applyInputPointAdjustments = useCallback((point: PencilPoint): PencilPoint => {
    const snapped = snapPointToPerspective(point, width, height, drawingState.decisionData);
    return applyPressureCurve(snapped);
  }, [applyPressureCurve, drawingState.decisionData, height, width]);

  const effectiveBrushSettings = useMemo(
    () => resolveEffectiveBrushSettings(brushSettings, drawingState.decisionData),
    [brushSettings, drawingState.decisionData]
  );

  const surfaceTextureTile = useMemo(() => {
    if (canvasSurface.texture === 'none') return null;
    const key = `${canvasSurface.texture}:${canvasSurface.textureScale.toFixed(2)}`;
    const cached = surfaceTextureCacheRef.current;
    if (cached && cached.key === key) {
      return cached.tile;
    }
    const tile = buildCanvasTextureTile(canvasSurface.texture, canvasSurface.textureScale);
    surfaceTextureCacheRef.current = { key, tile };
    return tile;
  }, [canvasSurface.texture, canvasSurface.textureScale]);
  
  // Apple Pencil hook
  const {
    ref: pencilRef,
    state: pencilState,
    currentStroke,
    getCurrentStroke,
    invalidateRectCache,
    getStrokeWidth,
    getOpacity,
  } = useApplePencil({
    onStrokeStart: (point: PencilPoint) => {
      const previewCtx = previewCanvasRef.current?.getContext('2d');
      if (previewCtx) {
        previewCtx.setTransform(1, 0, 0, 1, 0, 0);
        previewCtx.clearRect(0, 0, bufferWidth, bufferHeight);
        previewCtx.scale(dpr, dpr);
      }
      const adjustedPoint = applyInputPointAdjustments(point);
      brushEngineRef.current?.startStroke(adjustedPoint);
    },
    
    onStrokeMove: (point: PencilPoint) => {
      // Use the live ref getter to avoid stale render-time snapshot
      const liveStroke = getCurrentStroke();
      if (liveStroke && previewCanvasRef.current && brushEngineRef.current) {
        const adjustedCurrentPoint = applyInputPointAdjustments(point);
        setHoverPosition({ x: adjustedCurrentPoint.x, y: adjustedCurrentPoint.y });
        const ctx = previewCanvasRef.current.getContext('2d');
        if (!ctx) return;
        
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, bufferWidth, bufferHeight);
        ctx.scale(dpr, dpr);
        
        const adjustedPoints = liveStroke.points.map(applyInputPointAdjustments);
        
        // Apply symmetry if enabled
        if (drawingState.symmetrySettings.type !== 'none') {
          const mirroredPointSets = getMirroredPoints(
            adjustedPoints,
            drawingState.symmetrySettings,
            width,
            height
          );
          mirroredPointSets.forEach(points => {
            brushEngineRef.current?.renderStroke(ctx, points, effectiveBrushSettings);
          });
        } else {
          brushEngineRef.current.renderStroke(ctx, adjustedPoints, effectiveBrushSettings);
        }
      }
    },
    
    onStrokeEnd: (stroke: PencilStroke) => {
      brushEngineRef.current?.endStroke();
      
      const adjustedStroke: PencilStroke = {
        ...stroke,
        points: stroke.points.map(applyInputPointAdjustments),
        // Snapshot brush config so replay uses the same settings
        brushSettings: serializeBrushSettings(effectiveBrushSettings),
        layerId: drawingState.activeLayerId,
      };
      
      if (effectiveBrushSettings.type === 'eraser') {
        const newStrokes = strokes.filter(s => !strokesIntersect(s, adjustedStroke));
        saveToUndo();
        setStrokes(newStrokes);
        onStrokesChange?.(newStrokes);
      } else {
        saveToUndo();
        
        // Handle symmetry - add mirrored strokes
        let newStrokes: PencilStroke[];
        if (drawingState.symmetrySettings.type !== 'none') {
          const mirroredPointSets = getMirroredPoints(
            adjustedStroke.points,
            drawingState.symmetrySettings,
            width,
            height
          );
          const mirroredStrokes = mirroredPointSets.map((points, i) => ({
            ...adjustedStroke,
            id: `${adjustedStroke.id}-mirror-${i}`,
            seed: (adjustedStroke.seed + i + 1) >>> 0,
            points,
          }));
          newStrokes = [...strokes, ...mirroredStrokes];
        } else {
          newStrokes = [...strokes, adjustedStroke];
        }
        
        setStrokes(newStrokes);
        onStrokesChange?.(newStrokes);
      }
      
      const previewCtx = previewCanvasRef.current?.getContext('2d');
      if (previewCtx) {
        previewCtx.setTransform(1, 0, 0, 1, 0, 0);
        previewCtx.clearRect(0, 0, bufferWidth, bufferHeight);
      }
      redrawMainCanvas();
    },
    
    onHoverStart: (point: PencilPoint) => {
      const adjustedPoint = applyInputPointAdjustments(point);
      setHoverPosition({ x: adjustedPoint.x, y: adjustedPoint.y });
    },
    
    onHoverMove: (point: PencilPoint) => {
      const adjustedPoint = applyInputPointAdjustments(point);
      setHoverPosition({ x: adjustedPoint.x, y: adjustedPoint.y });
    },
    
    onHoverEnd: () => {
      setHoverPosition(null);
    },
    
    onDoubleTap: () => {
      setBrushSettings((prev: ProBrushSettings) => ({
        ...prev,
        type: prev.type === 'eraser' ? 'pencil' : 'eraser',
      }));
    },
  }, {
    palmRejection,
    minPressure: 0.01,
    pressureSmoothing: 0.15,
    enableHover: device.hasPencilSupport && !isTouchDevice,
    enableDoubleTap: device.hasPencilSupport,
  });
  
  // Initialize brush engine + keep config in sync
  useEffect(() => {
    if (!brushEngineRef.current && mainCanvasRef.current) {
      const ctx = mainCanvasRef.current.getContext('2d');
      if (ctx) {
        brushEngineRef.current = new AdvancedBrushEngine(ctx, effectiveBrushSettings);
      }
    } else if (brushEngineRef.current) {
      brushEngineRef.current.setConfig(effectiveBrushSettings);
    }
  }, [effectiveBrushSettings]);

  const initialWebGLSetupRef = useRef<{
    width: number;
    height: number;
    settings: ProBrushSettings;
  } | null>(null);
  if (!initialWebGLSetupRef.current) {
    initialWebGLSetupRef.current = {
      width,
      height,
      settings: effectiveBrushSettings,
    };
  }

  // Initialize WebGL engine once when available
  useEffect(() => {
    const initialSetup = initialWebGLSetupRef.current;
    if (!initialSetup) return;
    const glEngine = WebGLBrushEngine.create(
      initialSetup.width,
      initialSetup.height,
      initialSetup.settings
    );
    if (glEngine) {
      webglEngineRef.current = glEngine;
      setUseWebGL(true);
    }

    return () => {
      webglEngineRef.current?.dispose();
      webglEngineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!webglEngineRef.current) return;
    webglEngineRef.current.resize(width, height);
    webglEngineRef.current.setConfig(effectiveBrushSettings);
  }, [width, height, effectiveBrushSettings]);

  // Sync brushSettings ← drawingState.brushConfig (from BrushLibrary / DrawingToolsPanel)
  useEffect(() => {
    setBrushSettings(prev => {
      const next = drawingState.brushConfig;
      // Only update if something actually changed to avoid loop
      if (
        prev.type === next.type &&
        prev.size === next.size &&
        prev.color === next.color &&
        prev.opacity === next.opacity &&
        prev.hardness === next.hardness &&
        prev.flow === next.flow &&
        prev.wetness === next.wetness &&
        prev.grain === next.grain &&
        prev.tiltSensitivity === next.tiltSensitivity &&
        prev.pressureSensitivity === next.pressureSensitivity &&
        prev.blendMode === next.blendMode &&
        prev.cinematicPreset === next.cinematicPreset &&
        prev.valueContrast === next.valueContrast &&
        prev.shadowBias === next.shadowBias &&
        prev.highlightBias === next.highlightBias &&
        prev.warmTint === next.warmTint &&
        prev.hatchAngle === next.hatchAngle &&
        prev.hatchDensity === next.hatchDensity &&
        prev.motionAccent === next.motionAccent &&
        prev.lightWrap === next.lightWrap &&
        prev.lensAwareShading === next.lensAwareShading &&
        prev.lightingAware === next.lightingAware &&
        prev.lensMm === next.lensMm &&
        prev.aperture === next.aperture &&
        prev.keyLightDirection === next.keyLightDirection &&
        prev.keyLightIntensity === next.keyLightIntensity
      ) {
        return prev;
      }
      return { ...prev, ...next };
    });
  }, [drawingState.brushConfig]);
  
  // Merge pencil ref with container ref
  useEffect(() => {
    if (containerRef.current) {
      (pencilRef as React.MutableRefObject<HTMLElement | null>).current = containerRef.current;
    }
  }, [pencilRef]);

  // Redraw main canvas
  const redrawMainCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const engine = brushEngineRef.current;
    if (!canvas || !ctx || !engine) return;

    // HiDPI: reset transform, clear at buffer resolution, then apply DPR scale
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bufferWidth, bufferHeight);
    ctx.scale(dpr, dpr);
    // M2: Explicit smoothing control for consistent cross-browser rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    paintCanvasSurface(ctx, width, height, canvasSurface, surfaceTextureTile);

    const renderContent = () => {
      // Group strokes by layer for correct visibility/blend ordering
      const layerMap = new Map<string, DrawingLayer>();
      drawingState.layers.forEach(l => layerMap.set(l.id, l));

      // Try GPU-accelerated path first for simple strokes (no blend modes)
      const glEngine = webglEngineRef.current;
      const hasComplexBlending = strokes.some(s => {
        const layer = layerMap.get(s.layerId);
        return layer && (layer.blendMode !== 'normal' || layer.opacity < 1);
      });
      const cinematicActive = effectiveBrushSettings.cinematicPreset !== 'none';

      if (glEngine && !hasComplexBlending && !cinematicActive) {
        // ── WebGL fast path ──
        glEngine.resize(width, height);
        glEngine.clear();

        strokes.forEach(stroke => {
          const layer = layerMap.get(stroke.layerId);
          if (layer && !layer.visible) return;

          const strokeBrush = stroke.brushSettings
            ? (parseStoredBrushSettings(stroke.brushSettings) ?? effectiveBrushSettings)
            : effectiveBrushSettings;

          glEngine.renderStroke(stroke.points, strokeBrush);
        });

        // Blit WebGL result onto the 2D canvas
        glEngine.copyTo2D(ctx);
      } else {
        // ── Canvas 2D path (supports blend modes, per-layer opacity) ──
        strokes.forEach(stroke => {
          const layer = layerMap.get(stroke.layerId);
          if (layer && !layer.visible) return;

          const strokeBrush = stroke.brushSettings
            ? (parseStoredBrushSettings(stroke.brushSettings) ?? effectiveBrushSettings)
            : effectiveBrushSettings;

          if (layer && layer.blendMode !== 'normal') {
            ctx.globalCompositeOperation = layer.blendMode;
          }
          if (layer) {
            ctx.globalAlpha = layer.opacity;
          }

          engine.renderStroke(ctx, stroke.points, strokeBrush);

          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        });
      }

      // Render shape objects on top of strokes
      shapes.forEach(shape => {
        drawShape(ctx, shape, shape.id === selectedShapeId);
      });
    };

    // Draw background image if provided (cached to avoid re-creating Image)
    // Uses a generation counter to discard stale async loads (C4 fix).
    const gen = ++redrawGenRef.current;
    if (backgroundImage) {
      if (bgImageCacheRef.current && bgImageCacheRef.current.src === backgroundImage) {
        ctx.drawImage(bgImageCacheRef.current.img, 0, 0, width, height);
        renderContent();
      } else {
        const img = new window.Image();
        img.onload = () => {
          if (redrawGenRef.current !== gen) return; // stale — discard
          bgImageCacheRef.current = { src: backgroundImage, img };
          ctx.drawImage(img, 0, 0, width, height);
          renderContent();
        };
        img.src = backgroundImage;
      }
    } else {
      renderContent();
    }
  }, [
    width,
    height,
    dpr,
    bufferWidth,
    bufferHeight,
    backgroundImage,
    strokes,
    shapes,
    selectedShapeId,
    effectiveBrushSettings,
    drawingState.layers,
    canvasSurface,
    surfaceTextureTile,
  ]);
  
  // Shape interaction — pointer handlers when active tool is 'shape'
  useEffect(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas || drawingState.activeTool !== 'shape' || !drawingState.activeShapeType) return;

    const getCanvasPoint = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const rawPoint: PencilPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: 0.5,
        tiltX: 0,
        tiltY: 0,
        timestamp: Date.now(),
      };
      const snapped = snapPointToPerspective(rawPoint, width, height, drawingState.decisionData);
      return { x: snapped.x, y: snapped.y };
    };

    const handleShapeDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation(); // prevent pencil hook from seeing this event
      const pt = getCanvasPoint(e);
      const id = `shape-${Date.now()}`;
      const newShape: Shape = {
        id,
        type: drawingState.activeShapeType!,
        x: pt.x,
        y: pt.y,
        width: 0,
        height: 0,
        rotation: 0,
        style: { ...drawingState.shapeStyle },
      };
      shapeDragRef.current = { startX: pt.x, startY: pt.y, shapeId: id };
      setShapes(prev => [...prev, newShape]);
      setSelectedShapeId(id);
    };

    const handleShapeMove = (e: PointerEvent) => {
      if (!shapeDragRef.current) return;
      e.preventDefault();
      const pt = getCanvasPoint(e);
      const { startX, startY, shapeId } = shapeDragRef.current;
      setShapes(prev => prev.map(s => {
        if (s.id !== shapeId) return s;
        return {
          ...s,
          x: Math.min(startX, pt.x),
          y: Math.min(startY, pt.y),
          width: Math.abs(pt.x - startX),
          height: Math.abs(pt.y - startY),
        };
      }));
      redrawMainCanvas();
    };

    const handleShapeUp = (e: PointerEvent) => {
      if (!shapeDragRef.current) return;
      e.preventDefault();
      // Remove zero-area shapes
      const { shapeId } = shapeDragRef.current;
      setShapes(prev => prev.filter(s => s.id !== shapeId || (s.width > 2 && s.height > 2)));
      shapeDragRef.current = null;
      redrawMainCanvas();
    };

    canvas.addEventListener('pointerdown', handleShapeDown, { capture: true });
    canvas.addEventListener('pointermove', handleShapeMove, { capture: true });
    // Attach pointerup to window so it fires even if pointer leaves the canvas (M5 fix)
    window.addEventListener('pointerup', handleShapeUp);

    return () => {
      canvas.removeEventListener('pointerdown', handleShapeDown, { capture: true });
      canvas.removeEventListener('pointermove', handleShapeMove, { capture: true });
      window.removeEventListener('pointerup', handleShapeUp);
    };
  }, [
    drawingState.activeTool,
    drawingState.activeShapeType,
    drawingState.shapeStyle,
    drawingState.decisionData,
    width,
    height,
    redrawMainCanvas,
  ]);
  
  // Draw reference image (cached Image element to avoid re-creating per render)
  useEffect(() => {
    if (!referenceCanvasRef.current) return;
    const ctx = referenceCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bufferWidth, bufferHeight);
    ctx.scale(dpr, dpr);
    
    if (referenceImage && referenceImage.visible) {
      const drawRefImage = (img: HTMLImageElement) => {
        ctx.save();
        ctx.globalAlpha = referenceImage.opacity;
        ctx.drawImage(
          img,
          referenceImage.x,
          referenceImage.y,
          referenceImage.width,
          referenceImage.height
        );
        ctx.restore();
      };

      // Reuse cached image if src unchanged
      if (refImageCacheRef.current && refImageCacheRef.current.src === referenceImage.src) {
        drawRefImage(refImageCacheRef.current.img);
      } else {
        const img = new window.Image();
        img.onload = () => {
          refImageCacheRef.current = { src: referenceImage.src, img };
          drawRefImage(img);
        };
        img.src = referenceImage.src;
      }
    }
  }, [referenceImage, width, height]);
  
  // Draw grid overlay
  useEffect(() => {
    if (!gridCanvasRef.current) return;
    const ctx = gridCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bufferWidth, bufferHeight);
    ctx.scale(dpr, dpr);

    const gridEnabled = showGrid || drawingState.decisionData.overlays.grid;

    if (gridEnabled) {
      const gridSize = 50;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 0.5;
      
      // Vertical lines
      for (let x = gridSize; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      
      // Horizontal lines
      for (let y = gridSize; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      // Center crosshairs
      ctx.strokeStyle = 'rgba(255, 200, 100, 0.4)';
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }
  }, [showGrid, drawingState.decisionData.overlays.grid, width, height]);
  
  // Draw symmetry guides
  useEffect(() => {
    if (!symmetryCanvasRef.current) return;
    const ctx = symmetryCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bufferWidth, bufferHeight);
    ctx.scale(dpr, dpr);

    const decisionGuides = buildGuidesFromDecision(drawingState.decisionData);
    if (decisionGuides.enabled) {
      drawGuides(ctx, width, height, decisionGuides);
    }
    if (drawingState.decisionData.overlays.eyelineMatch) {
      drawEyelineGuide(ctx, width, height, drawingState.decisionData.overlays.opacity);
    }
    if (drawingState.decisionData.overlays.centerCross && decisionGuides.type !== 'center') {
      ctx.save();
      ctx.globalAlpha = drawingState.decisionData.overlays.opacity;
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.restore();
    }
    drawProductionOverlays(ctx, width, height, drawingState.decisionData);
    
    // Draw storyboard template guides
    if (drawingState.storyboardTemplate?.guides.enabled) {
      drawGuides(ctx, width, height, drawingState.storyboardTemplate.guides);
    }
    
    // Draw symmetry guides
    if (drawingState.symmetrySettings.type !== 'none' && drawingState.symmetrySettings.showGuides) {
      drawSymmetryGuides(ctx, drawingState.symmetrySettings, width, height);
    }
  }, [drawingState.decisionData, drawingState.symmetrySettings, drawingState.storyboardTemplate, width, height]);
  
  // Built-in frame snapshot cache for onion skinning when no external getFrameImage is provided
  const frameSnapshotsRef = useRef<Map<number, HTMLCanvasElement>>(new Map());

  /** Snapshot the current canvas into the frame cache */
  const captureFrameSnapshot = useCallback(() => {
    const src = mainCanvasRef.current;
    if (!src) return;
    const snapshot = document.createElement('canvas');
    snapshot.width = src.width;
    snapshot.height = src.height;
    const ctx = snapshot.getContext('2d');
    if (ctx) {
      ctx.drawImage(src, 0, 0);
      frameSnapshotsRef.current.set(currentFrameIndex, snapshot);
    }
  }, [currentFrameIndex]);

  /** Resolve frame images: prefer external prop, fallback to built-in cache */
  const resolvedGetFrameImage = useCallback((index: number): HTMLCanvasElement | null => {
    if (getFrameImage) return getFrameImage(index);
    return frameSnapshotsRef.current.get(index) ?? null;
  }, [getFrameImage]);

  // Auto-capture frame snapshot after each stroke for onion skinning
  // (only when onion skinning is enabled and no external source)
  useEffect(() => {
    if (drawingState.onionSkinSettings.enabled && !getFrameImage && strokes.length > 0) {
      captureFrameSnapshot();
    }
  }, [strokes, drawingState.onionSkinSettings.enabled, getFrameImage, captureFrameSnapshot]);

  // Draw onion skinning
  useEffect(() => {
    if (!onionCanvasRef.current) return;
    const ctx = onionCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, bufferWidth, bufferHeight);
    ctx.scale(dpr, dpr);
    
    if (drawingState.onionSkinSettings.enabled) {
      const frames = getOnionFrames(currentFrameIndex, totalFrames, drawingState.onionSkinSettings);
      renderOnionSkins(ctx, width, height, frames, resolvedGetFrameImage, drawingState.onionSkinSettings);
    }
  }, [drawingState.onionSkinSettings, currentFrameIndex, totalFrames, resolvedGetFrameImage, width, height]);
  
  // Redraw when strokes change
  useEffect(() => {
    redrawMainCanvas();
  }, [redrawMainCanvas]);
  
  // Check if strokes intersect (for eraser) — P-2/P-3 fix:
  // Uses spatial grid hashing instead of O(n²) point-by-point comparison.
  const strokesIntersect = useCallback((s1: PencilStroke, s2: PencilStroke): boolean => {
    const threshold = brushSettings.size * 3;
    const cellSize = threshold;
    // Build a spatial hash from the shorter stroke
    const [gridStroke, queryStroke] = s1.points.length <= s2.points.length ? [s1, s2] : [s2, s1];
    const grid = new Map<string, true>();
    for (const p of gridStroke.points) {
      const cx = Math.floor(p.x / cellSize);
      const cy = Math.floor(p.y / cellSize);
      // Insert into the cell and the 8 neighbours to avoid boundary misses
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          grid.set(`${cx + dx},${cy + dy}`, true);
        }
      }
    }
    // Query points against the grid — O(n)
    for (const p of queryStroke.points) {
      const cx = Math.floor(p.x / cellSize);
      const cy = Math.floor(p.y / cellSize);
      if (grid.has(`${cx},${cy}`)) {
        // Potential hit — do precise distance check against grid stroke neighbours
        for (const gp of gridStroke.points) {
          const dist = Math.hypot(p.x - gp.x, p.y - gp.y);
          if (dist < threshold) return true;
        }
      }
    }
    return false;
  }, [brushSettings.size]);
  
  // Undo/Redo — bounded to prevent O(n²) memory growth
  // Uses strokesRef so the snapshot is always accurate even when React batches
  // multiple state updates in the same frame (e.g., rapid strokes).
  const MAX_UNDO_DEPTH = 80;
  const saveToUndo = useCallback(() => {
    const snapshot = strokesRef.current;
    setUndoStack(prev => {
      const next = [...prev, snapshot];
      return next.length > MAX_UNDO_DEPTH ? next.slice(next.length - MAX_UNDO_DEPTH) : next;
    });
    setRedoStack([]);
  }, []);
  
  const undo = useCallback(() => {
    setUndoStack(prevUndo => {
      if (prevUndo.length === 0) return prevUndo;
      const previous = prevUndo[prevUndo.length - 1];
      setRedoStack(prevRedo => [...prevRedo, strokesRef.current]);
      setStrokes(previous);
      onStrokesChange?.(previous);
      return prevUndo.slice(0, -1);
    });
  }, [onStrokesChange]);
  
  const redo = useCallback(() => {
    setRedoStack(prevRedo => {
      if (prevRedo.length === 0) return prevRedo;
      const next = prevRedo[prevRedo.length - 1];
      setUndoStack(prevUndo => [...prevUndo, strokesRef.current]);
      setStrokes(next);
      onStrokesChange?.(next);
      return prevRedo.slice(0, -1);
    });
  }, [onStrokesChange]);
  
  // Clipboard operations — selection-aware

  /** Return indices of strokes that have at least one point inside the selection bounds */
  const getSelectedStrokeIndices = useCallback((): number[] => {
    const bounds = drawingState.selectionBounds;
    if (!bounds) return [];
    const { x, y, width: bw, height: bh } = bounds;
    return strokes.reduce<number[]>((acc, stroke, idx) => {
      const inside = stroke.points.some(
        p => p.x >= x && p.x <= x + bw && p.y >= y && p.y <= y + bh
      );
      if (inside) acc.push(idx);
      return acc;
    }, []);
  }, [drawingState.selectionBounds, strokes]);

  const copySelection = useCallback(() => {
    const indices = getSelectedStrokeIndices();
    if (indices.length > 0) {
      setClipboard(indices.map(i => strokes[i]));
    } else {
      // Fallback: copy all strokes when no selection
      setClipboard([...strokes]);
    }
  }, [getSelectedStrokeIndices, strokes]);
  
  const pasteClipboard = useCallback(() => {
    if (clipboard.length > 0) {
      saveToUndo();
      const pastedStrokes = clipboard.map(s => ({
        ...s,
        points: s.points.map(p => ({ ...p, x: p.x + 20, y: p.y + 20 })),
      }));
      const newStrokes = [...strokes, ...pastedStrokes];
      setStrokes(newStrokes);
      onStrokesChange?.(newStrokes);
    }
  }, [clipboard, strokes, saveToUndo, onStrokesChange]);
  
  const cutSelection = useCallback(() => {
    const indices = getSelectedStrokeIndices();
    if (indices.length > 0) {
      saveToUndo();
      setClipboard(indices.map(i => strokes[i]));
      const indexSet = new Set(indices);
      const remaining = strokes.filter((_, i) => !indexSet.has(i));
      setStrokes(remaining);
      onStrokesChange?.(remaining);
    } else {
      copySelection();
    }
  }, [getSelectedStrokeIndices, strokes, saveToUndo, onStrokesChange, copySelection]);
  
  const deleteSelection = useCallback(() => {
    const indices = getSelectedStrokeIndices();
    if (indices.length > 0) {
      saveToUndo();
      const indexSet = new Set(indices);
      const remaining = strokes.filter((_, i) => !indexSet.has(i));
      setStrokes(remaining);
      onStrokesChange?.(remaining);
      updateDrawingState({ selectionBounds: null, selectedStrokeIds: [] });
    }
  }, [getSelectedStrokeIndices, strokes, saveToUndo, onStrokesChange, updateDrawingState]);
  
  // Gesture action handler
  const handleGestureAction = useCallback((action: GestureAction, data?: Record<string, number>) => {
    switch (action) {
      case 'undo':
        undo();
        break;
      case 'redo':
        redo();
        break;
      case 'zoom-fit':
        setCanvasTransform({ zoom: 1, panX: 0, panY: 0, rotation: 0 });
        break;
      case 'zoom-in':
        setCanvasTransform(prev => ({
          ...prev,
          zoom: Math.min(prev.zoom * (data?.scale ?? 1.25), 5),
        }));
        break;
      case 'rotate-canvas':
        setCanvasTransform(prev => ({
          ...prev,
          rotation: (prev.rotation + (data?.angle ?? 0)) % 360,
        }));
        break;
      case 'pan-canvas':
        setCanvasTransform(prev => ({
          ...prev,
          panX: prev.panX + (data?.dx ?? 0),
          panY: prev.panY + (data?.dy ?? 0),
        }));
        break;
      case 'copy':
        copySelection();
        break;
      case 'paste':
        pasteClipboard();
        break;
      case 'cut':
        cutSelection();
        break;
      default:
        break;
    }
  }, [undo, redo, copySelection, pasteClipboard, cutSelection]);
  
  // K-1 fix: Keyboard shortcuts for undo/redo/copy/paste/cut/delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      // Ignore keyboard shortcuts when typing in an input/textarea/contentEditable
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement)?.isContentEditable) return;

      if (ctrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z'))) {
        e.preventDefault();
        redo();
      } else if (ctrl && e.key === 'c') {
        e.preventDefault();
        copySelection();
      } else if (ctrl && e.key === 'v') {
        e.preventDefault();
        pasteClipboard();
      } else if (ctrl && e.key === 'x') {
        e.preventDefault();
        cutSelection();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelection();
      } else if (e.key === 'Escape') {
        updateDrawingState({ selectionBounds: null, selectedStrokeIds: [] });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, copySelection, pasteClipboard, cutSelection, deleteSelection, updateDrawingState]);

  // L1: Invalidate rect cache and reset hover on tab visibility change
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        invalidateRectCache();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [invalidateRectCache]);

  // Gesture handler hook
  useGestureHandler({
    element: containerRef.current,
    settings: drawingState.gestureSettings,
    onAction: handleGestureAction,
  });
  
  // Export handler
  const handleExport = useCallback(async (settings: ExportSettings, frameIndices: number[]) => {
    if (onExport) {
      await onExport(settings, frameIndices);
    } else {
      // Default export behavior
      const canvas = mainCanvasRef.current;
      if (canvas) {
        const blob = await exportAsImage(
          canvas,
          settings.format === 'jpeg' ? 'jpeg' : 'png',
          settings.quality,
          settings.scale,
          settings.includeBackground
        );
        const filename = generateFilename(settings.fileNamePattern, 0, settings.format);
        downloadBlob(blob, filename);
      }
    }
  }, [onExport]);
  
  const clearCanvas = useCallback(() => {
    saveToUndo();
    setStrokes([]);
    onStrokesChange?.([]);
    redrawMainCanvas();
  }, [saveToUndo, onStrokesChange, redrawMainCanvas]);
  
  /**
   * Composite all visible layers (reference + strokes) into one offscreen
   * canvas so the exported PNG includes the reference layer underneath.
   */
  const getCompositeCanvas = useCallback((): HTMLCanvasElement | null => {
    const main = mainCanvasRef.current;
    if (!main) return null;
    const composite = document.createElement('canvas');
    composite.width = main.width;
    composite.height = main.height;
    const ctx = composite.getContext('2d');
    if (!ctx) return null;

    // 1) Reference layer (if visible)
    const refCanvas = referenceCanvasRef.current;
    if (refCanvas) {
      ctx.drawImage(refCanvas, 0, 0);
    }

    // 2) Main strokes layer
    ctx.drawImage(main, 0, 0);

    return composite;
  }, []);

  const saveCanvas = useCallback(() => {
    // Composite reference + strokes into a single merged bitmap
    const composite = getCompositeCanvas();
    const canvas = composite ?? mainCanvasRef.current;
    if (!canvas) return;
    const imageData = canvas.toDataURL('image/png');
    onSave?.(imageData);
  }, [getCompositeCanvas, onSave]);

  const applyConceptReference = useCallback((imageUrl: string) => {
    const newReference: ReferenceImage = {
      src: imageUrl,
      opacity: refOpacity,
      visible: true,
      x: 0,
      y: 0,
      width,
      height,
    };
    setReferenceImage(newReference);
    onReferenceImageChange?.(newReference);
  }, [height, onReferenceImageChange, refOpacity, width]);

  useImperativeHandle(ref, () => ({
    save: saveCanvas,
    clear: clearCanvas,
    undo,
    redo,
    getCanvas: () => mainCanvasRef.current,
    getCompositeCanvas,
  }), [saveCanvas, clearCanvas, undo, redo, getCompositeCanvas]);
  
  // Handle reference image upload
  const handleRefImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const newRef: ReferenceImage = {
        src: event.target?.result as string,
        opacity: 0.3,
        visible: true,
        x: 0,
        y: 0,
        width,
        height,
      };
      setReferenceImage(newRef);
      onReferenceImageChange?.(newRef);
    };
    reader.readAsDataURL(file);
  }, [width, height, onReferenceImageChange]);
  
  // (SIZE_PRESETS and COLOR_PRESETS hoisted to module scope for stable references)
  
  // Calculate cursor metrics with pressure-aware helpers
  const cursorSize = getStrokeWidth(
    pencilState.currentPressure || 0.5,
    effectiveBrushSettings.size
  );
  const cursorOpacity = getOpacity(
    pencilState.currentPressure || 0.5,
    effectiveBrushSettings.opacity
  );
  
  // P-11 fix: Memoize exportFrames to avoid array literal recreated per render
  const exportFramesMemo = useMemo((): ExportFrame[] => {
    if (!mainCanvasRef.current) return [];
    return [{ index: 0, canvas: mainCanvasRef.current }];
  }, [strokes]);

  // Compute CSS transform from canvasTransform state
  const canvasTransformStyle = useMemo(() => ({
    transform: `scale(${canvasTransform.zoom}) translate(${canvasTransform.panX}px, ${canvasTransform.panY}px) rotate(${canvasTransform.rotation}deg)`,
    transformOrigin: 'center center',
    transition: 'transform 0.15s ease-out',
  }), [canvasTransform]);

  const activeInputLabel = useMemo(() => {
    if (pencilState.currentInputType === 'pen') return 'Apple Pencil';
    if (pencilState.currentInputType === 'touch') return 'Touch Input';
    if (pencilState.currentInputType === 'mouse') return 'Mouse Input';
    if (device.hasPencilSupport) return 'Pencil Ready';
    if (isTouchDevice) return 'Touch Device';
    return 'Pointer Device';
  }, [device.hasPencilSupport, isTouchDevice, pencilState.currentInputType]);

  return (
    <CanvasContainer ref={containerRef} sx={{ width, height }}>
      {/* Transformable canvas wrapper */}
      <Box sx={{ position: 'absolute', inset: 0, ...canvasTransformStyle }}>
      {/* Reference image layer */}
      <ReferenceLayer
        ref={referenceCanvasRef}
        width={bufferWidth}
        height={bufferHeight}
        style={{ opacity: refOpacity, width, height }}
      />
      
      {/* Main canvas with completed strokes */}
      <CanvasLayer
        ref={mainCanvasRef}
        width={bufferWidth}
        height={bufferHeight}
        style={{ cursor: 'crosshair', width, height }}
      />
      
      {/* Preview canvas for current stroke */}
      <CanvasLayer
        ref={previewCanvasRef}
        width={bufferWidth}
        height={bufferHeight}
        style={{ pointerEvents: 'none', width, height }}
      />
      
      {/* Grid overlay */}
      <GridOverlay
        ref={gridCanvasRef}
        width={bufferWidth}
        height={bufferHeight}
        style={{ width, height }}
      />
      
      {/* Onion skinning layer */}
      <CanvasLayer
        ref={onionCanvasRef}
        width={bufferWidth}
        height={bufferHeight}
        style={{ pointerEvents: 'none', opacity: 0.5, width, height }}
      />
      
      {/* Symmetry guides layer */}
      <CanvasLayer
        ref={symmetryCanvasRef}
        width={bufferWidth}
        height={bufferHeight}
        style={{ pointerEvents: 'none', width, height }}
      />
      </Box>{/* End transformable canvas wrapper */}
      
      {/* Pencil mode indicator */}
      {pencilState.isPencilConnected && (
        <Fade in={pencilState.isActive || pencilState.isHovering}>
          <PencilModeIndicator>
            <Create sx={{ fontSize: 14 }} />
            Apple Pencil{useWebGL ? ' · GPU' : ''}
          </PencilModeIndicator>
        </Fade>
      )}
      
      {/* Pressure indicator */}
      {showPressureIndicator && pencilState.isActive && (
        <PressureIndicator>
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
            Pressure: {(pencilState.currentPressure * 100).toFixed(0)}%
          </Typography>
        </PressureIndicator>
      )}
      
      {/* Hover cursor - hidden on touch devices where it's not useful */}
      {hoverPosition && !isTouchDevice && (
        <HoverCursor
          sx={{
            left: hoverPosition.x,
            top: hoverPosition.y,
            width: cursorSize * 2,
            height: cursorSize * 2,
            border: `2px solid ${effectiveBrushSettings.type === 'eraser' ? 'rgba(255,255,255,0.5)' : effectiveBrushSettings.color}`,
            backgroundColor: effectiveBrushSettings.type === 'watercolor' 
              ? `${effectiveBrushSettings.color}20`
              : 'transparent',
            opacity: clamp(cursorOpacity, 0.2, 1),
          }}
        />
      )}
      
      {/* Professional Toolbar */}
      {showToolbar && (
        <ProToolbar elevation={8}>
          {/* Brush type buttons */}
          {(['watercolor', 'pencil', 'marker', 'ink', 'brush', 'eraser'] as ProBrushType[]).map((type) => (
            <Tooltip key={type} title={type.charAt(0).toUpperCase() + type.slice(1)} placement="top">
              <BrushButton
                selected={brushSettings.type === type}
                brushColor={brushSettings.color}
                onClick={() => setBrushSettings((prev: ProBrushSettings) => ({ ...prev, type }))}
              >
                <Box sx={{ color: brushSettings.type === type ? brushSettings.color : 'rgba(255,255,255,0.6)' }}>
                  {BrushIcons[type]}
                </Box>
              </BrushButton>
            </Tooltip>
          ))}
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />
          
          {/* Size dots */}
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ px: 1 }}>
            {SIZE_PRESETS.map((size) => (
              <Tooltip key={size} title={`${size}px`} placement="top">
                <SizeDot
                  dotSize={Math.min(size / 2 + 4, 16)}
                  selected={brushSettings.size === size}
                  onClick={() => setBrushSettings((prev: ProBrushSettings) => ({ ...prev, size }))}
                />
              </Tooltip>
            ))}
            {/* Custom size slider button */}
            <Tooltip title="Custom size" placement="top">
              <IconButton
                size={isTouchDevice ? 'medium' : 'small'}
                onClick={(e) => setSizeAnchor(e.currentTarget)}
                sx={{ color: 'rgba(255,255,255,0.6)', ml: 0.5 }}
              >
                <BrushOutlined sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
          
          {/* Size slider popover */}
          <Popover
            open={Boolean(sizeAnchor)}
            anchorEl={sizeAnchor}
            onClose={() => setSizeAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)', p: 2 } } }}
          >
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1, display: 'block' }}>
              Brush Size: {brushSettings.size.toFixed(1)}px
            </Typography>
            <Slider
              value={brushSettings.size}
              min={0.5}
              max={100}
              step={0.5}
              onChange={(_e, val) => setBrushSettings((prev: ProBrushSettings) => ({ ...prev, size: val as number }))}
              sx={{ width: 160, color: brushSettings.color }}
            />
          </Popover>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />
          
          {/* Color button */}
          <Tooltip title="Color" placement="top">
            <ColorButton
              color={brushSettings.color}
              onClick={(e) => setColorAnchor(e.currentTarget)}
            />
          </Tooltip>
          
          <Popover
            open={Boolean(colorAnchor)}
            anchorEl={colorAnchor}
            onClose={() => setColorAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)' } } }}
          >
            <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1, maxWidth: 180 }}>
              {COLOR_PRESETS.map(color => (
                <Box
                  key={color}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: color,
                    cursor: 'pointer',
                    border: brushSettings.color === color ? '3px solid white' : '2px solid rgba(255,255,255,0.3)',
                    '&:hover': { transform: 'scale(1.1)' },
                    transition: 'all 0.2s',
                  }}
                  onClick={() => {
                    setBrushSettings((prev: ProBrushSettings) => ({ ...prev, color }));
                    setColorAnchor(null);
                  }}
                />
              ))}
            </Box>
          </Popover>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />
          
          {/* Undo/Redo */}
          <Tooltip title="Undo" placement="top">
            <span>
              <IconButton size="small" onClick={undo} disabled={undoStack.length === 0}>
                <Undo sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo" placement="top">
            <span>
              <IconButton size="small" onClick={redo} disabled={redoStack.length === 0}>
                <Redo sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1, bgcolor: 'rgba(255,255,255,0.1)' }} />
          
          {/* Grid toggle */}
          <Tooltip title="Toggle Grid" placement="top">
            <IconButton
              size="small"
              onClick={() => setShowGrid(prev => !prev)}
              sx={{ color: showGrid || drawingState.decisionData.overlays.grid ? 'primary.main' : 'inherit' }}
            >
              <GridOn sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          
          {/* Reference image */}
          {showReferenceImageControls && (
            <Tooltip title="Reference Image" placement="top">
              <IconButton
                size="small"
                onClick={(e) => setRefAnchor(e.currentTarget)}
                sx={{ color: referenceImage ? 'primary.main' : 'inherit' }}
              >
                <Badge color="primary" variant="dot" invisible={!referenceImage}>
                  <Image sx={{ fontSize: 18 }} />
                </Badge>
              </IconButton>
            </Tooltip>
          )}
          
          <Popover
            open={Boolean(refAnchor)}
            anchorEl={refAnchor}
            onClose={() => setRefAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)' } } }}
          >
            <Box sx={{ p: 2, width: 200 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>Reference Image</Typography>
              <input
                type="file"
                accept="image/*"
                onChange={handleRefImageUpload}
                style={{ width: '100%', marginTop: 8 }}
              />
              {referenceImage && (
                <>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption">Opacity</Typography>
                    <Slider
                      size="small"
                      value={refOpacity}
                      min={0}
                      max={1}
                      step={0.1}
                      onChange={(_, v) => setRefOpacity(v as number)}
                    />
                  </Box>
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        if (referenceImage) {
                          setReferenceImage({ ...referenceImage, visible: !referenceImage.visible });
                        }
                      }}
                    >
                      <Layers sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setReferenceImage(null);
                        onReferenceImageChange?.(null);
                      }}
                    >
                      <Delete sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                </>
              )}
            </Box>
          </Popover>
          
          {/* Clear */}
          <Tooltip title="Clear Canvas" placement="top">
            <IconButton size="small" onClick={clearCanvas}>
              <Delete sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          
          {/* Save */}
          {onSave && (
            <Tooltip title="Save" placement="top">
              <IconButton size="small" onClick={saveCanvas}>
                <Save sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          
          {/* Input indicator */}
          <Tooltip title={activeInputLabel} placement="top">
            <Box sx={{ display: 'flex', alignItems: 'center', color: pencilState.currentInputType === 'pen' ? 'success.main' : 'text.secondary' }}>
              {pencilState.currentInputType === 'pen' ? <Create sx={{ fontSize: 16 }} /> : <TouchApp sx={{ fontSize: 16 }} />}
            </Box>
          </Tooltip>
          
          {/* Drawing Tools Panel toggle */}
          {showDrawingToolsPanel && (
            <Tooltip title="Drawing Tools" placement="top">
              <IconButton
                size="small"
                onClick={() => setToolsPanelCollapsed(!toolsPanelCollapsed)}
                sx={{ color: !toolsPanelCollapsed ? 'primary.main' : 'inherit' }}
              >
                <Build sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </ProToolbar>
      )}
      
      {/* Drawing Tools Panel */}
      {showDrawingToolsPanel && (
        <DrawingToolsPanel
          projectId={projectId}
          currentFrameId={currentFrameId}
          currentStoryboardId={currentStoryboardId}
          canvas={mainCanvasRef.current}
          state={drawingState}
          onStateChange={updateDrawingState}
          onLayerSelect={(id) => updateDrawingState({ activeLayerId: id })}
          onLayerAdd={() => {
            const newLayer: DrawingLayer = {
              id: `layer-${Date.now()}`,
              name: `Layer ${drawingState.layers.length + 1}`,
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'normal',
              strokes: [],
            };
            updateDrawingState({ 
              layers: [...drawingState.layers, newLayer],
              activeLayerId: newLayer.id,
            });
          }}
          onLayerDelete={(id) => {
            if (drawingState.layers.length > 1) {
              const newLayers = drawingState.layers.filter(l => l.id !== id);
              // Remove strokes belonging to deleted layer
              const newStrokes = strokes.filter(s => s.layerId !== id);
              setStrokes(newStrokes);
              onStrokesChange?.(newStrokes);
              updateDrawingState({
                layers: newLayers,
                activeLayerId: drawingState.activeLayerId === id ? newLayers[0].id : drawingState.activeLayerId,
              });
            }
          }}
          onLayerVisibilityToggle={(id) => {
            updateDrawingState({
              layers: drawingState.layers.map(l => 
                l.id === id ? { ...l, visible: !l.visible } : l
              ),
            });
          }}
          onLayerOpacityChange={(id, opacity) => {
            updateDrawingState({
              layers: drawingState.layers.map(l => 
                l.id === id ? { ...l, opacity } : l
              ),
            });
          }}
          onLayerReorder={(fromIndex, toIndex) => {
            const newLayers = [...drawingState.layers];
            const [removed] = newLayers.splice(fromIndex, 1);
            newLayers.splice(toIndex, 0, removed);
            updateDrawingState({ layers: newLayers });
          }}
          onLayerMerge={(id) => {
            const layers = drawingState.layers;
            const idx = layers.findIndex(l => l.id === id);
            // Can only merge down if there's a layer below
            if (idx <= 0) return;
            const upper = layers[idx];
            const lower = layers[idx - 1];
            const merged: DrawingLayer = {
              ...lower,
              name: lower.name,
              strokes: [...lower.strokes, ...upper.strokes],
            };
            const newLayers = layers.filter((_, i) => i !== idx);
            newLayers[idx - 1] = merged;
            // Re-assign upper layer's strokes to the merged layer
            const newStrokes = strokes.map(s =>
              s.layerId === upper.id ? { ...s, layerId: merged.id } : s
            );
            setStrokes(newStrokes);
            onStrokesChange?.(newStrokes);
            updateDrawingState({
              layers: newLayers,
              activeLayerId: merged.id,
            });
          }}
          onLayerDuplicate={(id) => {
            const layer = drawingState.layers.find(l => l.id === id);
            if (layer) {
              const duplicate: DrawingLayer = {
                ...layer,
                id: `${id}-copy-${Date.now()}`,
                name: `${layer.name} Copy`,
              };
              updateDrawingState({
                layers: [...drawingState.layers, duplicate],
              });
            }
          }}
          strokes={strokes}
          onStrokesChange={(newStrokes) => {
            setStrokes(newStrokes);
            onStrokesChange?.(newStrokes);
          }}
          currentFrameIndex={currentFrameIndex}
          totalFrames={totalFrames}
          getFrameImage={resolvedGetFrameImage}
          exportFrames={exportFramesMemo}
          selectedFrameIndices={[0]}
          onColorPick={(color) => {
            setBrushSettings(prev => ({ ...prev, color }));
            updateDrawingState({
              brushConfig: { ...drawingState.brushConfig, color },
            });
          }}
          onExport={handleExport}
          onGestureAction={handleGestureAction}
          onUndo={undo}
          onRedo={redo}
          onCopy={copySelection}
          onPaste={pasteClipboard}
          onCut={cutSelection}
          onDelete={deleteSelection}
          onApplyReferenceImage={applyConceptReference}
          position={drawingToolsPanelPosition}
          collapsed={toolsPanelCollapsed}
          onCollapsedChange={setToolsPanelCollapsed}
        />
      )}
    </CanvasContainer>
  );
});

PencilCanvasPro.displayName = 'PencilCanvasPro';

export default PencilCanvasPro;
