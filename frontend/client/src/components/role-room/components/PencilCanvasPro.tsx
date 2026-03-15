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

import React, { useRef, useEffect, useState, useCallback, useMemo, useImperativeHandle } from 'react';
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
  ToggleButtonGroup,
  ToggleButton,
  Badge,
  Divider,
  TextField,
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
  Opacity,
  BrushOutlined,
  GridOn,
  Build,
  Straighten,
  RestartAlt,
  AutoFixHigh,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  useApplePencil,
  type PencilPoint,
  type PencilStroke,
  type InputType,
} from '../hooks/useApplePencil';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import {
  AdvancedBrushEngine,
  DEFAULT_BRUSH_SETTINGS,
  type BrushConfig,
  type ProBrushType,
  type ProBrushSettings,
} from './drawing/AdvancedBrushEngine';
import {
  DrawingToolsPanel,
  DEFAULT_DRAWING_STATE,
  type ActiveTool,
  type DrawingState,
} from './drawing/DrawingToolsPanel';
import {
  getMirroredPoints,
  drawSymmetryGuides,
  type SymmetrySettings,
} from './drawing/SymmetryMode';
import {
  evaluatePressureCurve,
  type PressureCurve,
} from './drawing/PressureCurveEditor';
import {
  useGestureHandler,
  type GestureAction,
  type GestureSettings,
} from './drawing/GestureShortcuts';
import {
  SelectionBox,
  getStrokeBounds,
  isStrokeInLasso,
  isStrokeInRectangle,
  transformStroke,
  type SelectionBounds,
  type Transform,
} from './drawing/SelectionTools';
import {
  getOnionFrames,
  renderOnionSkins,
  type OnionSkinSettings,
} from './drawing/OnionSkinning';
import {
  drawShape,
  type Shape,
  type ShapeType,
  type ShapeStyle,
} from './drawing/ShapeTools';
import { drawTextAnnotation } from './drawing/TextAnnotations';
import {
  type ExportFrame,
  type ExportSettings,
  exportAsImage,
  downloadBlob,
  generateFilename,
} from './drawing/ExportOptions';
import { calculateAspectRatio, drawGuides, getFrameDimensions } from './drawing/StoryboardTemplates';
import type { DrawingLayer } from './drawing/LayersPanel';

// =============================================================================
// Types
// =============================================================================

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  strokes: PencilStroke[];
  canvas?: HTMLCanvasElement;
}

export interface ReferenceImage {
  src: string;
  opacity: number;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PencilCanvasProProps {
  width: number;
  height: number;
  backgroundImage?: string;
  referenceImage?: ReferenceImage;
  initialStrokes?: PencilStroke[];
  brushSettings?: Partial<ProBrushSettings>;
  showToolbar?: boolean;
  showPressureIndicator?: boolean;
  showReferenceImageControls?: boolean;
  showGridOverlay?: boolean;
  showDrawingToolsPanel?: boolean;
  drawingToolsPanelPosition?: 'left' | 'right';
  initialToolsPanelCollapsed?: boolean;
  drawingToolsPanelWidth?: number;
  drawingToolsPanelCollapsedWidth?: number;
  palmRejection?: 'off' | 'pencil-only' | 'smart';
  currentFrameIndex?: number;
  totalFrames?: number;
  getFrameImage?: (index: number) => HTMLCanvasElement | null;
  onStrokesChange?: (strokes: PencilStroke[]) => void;
  onSave?: (imageData: string) => void;
  onReferenceImageChange?: (ref: ReferenceImage | null) => void;
  onExport?: (settings: ExportSettings, frameIndices: number[]) => Promise<void>;
}

export interface PencilCanvasProHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  save: () => void;
  setBrush: (settings: Partial<ProBrushSettings>) => void;
}

interface GestureActionData {
  center?: { x: number; y: number };
  scale?: number;
  angle?: number;
  dx?: number;
  dy?: number;
}

type BrushSettingsUpdate =
  | Partial<ProBrushSettings>
  | ((prev: ProBrushSettings) => Partial<ProBrushSettings> | ProBrushSettings);

interface RulerGuide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type RulerDragTarget = 'start' | 'end' | 'line';

interface SelectionDragRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface SelectionDragState {
  pointerId: number;
  mode: 'rectangle' | 'lasso';
  start: { x: number; y: number };
  current: { x: number; y: number };
  lassoPoints: PencilPoint[];
}

function brushConfigDiffers(a: ProBrushSettings, b: BrushConfig): boolean {
  return (
    a.type !== b.type
    || a.size !== b.size
    || a.color !== b.color
    || a.opacity !== b.opacity
    || a.hardness !== b.hardness
    || a.flow !== b.flow
    || a.wetness !== b.wetness
    || a.grain !== b.grain
    || a.tiltSensitivity !== b.tiltSensitivity
    || a.pressureSensitivity !== b.pressureSensitivity
  );
}

const PRO_BRUSH_TYPES: readonly ProBrushType[] = [
  'watercolor',
  'pencil',
  'pen',
  'marker',
  'ink',
  'brush',
  'highlighter',
  'eraser',
];

function isProBrushType(value: string): value is ProBrushType {
  return (PRO_BRUSH_TYPES as readonly string[]).includes(value);
}

function drawLivePreviewSegment(
  ctx: CanvasRenderingContext2D,
  from: PencilPoint,
  to: PencilPoint,
  brush: ProBrushSettings
): void {
  const avgPressure = Math.max(0.05, (from.pressure + to.pressure) / 2);
  const pressureFactor = 0.35 + avgPressure * 0.65 * brush.pressureSensitivity;
  const sizeMultiplier =
    brush.type === 'highlighter' ? 3
      : brush.type === 'marker' ? 2.2
        : brush.type === 'brush' ? 1.6
          : brush.type === 'watercolor' ? 2.4
            : 1;
  const width = Math.max(0.8, brush.size * sizeMultiplier * pressureFactor);

  ctx.save();
  if (brush.type === 'eraser') {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.globalAlpha = 1;
  } else {
    ctx.strokeStyle = brush.color;
    ctx.globalAlpha = brush.type === 'highlighter'
      ? Math.min(0.5, brush.opacity * 0.45)
      : brush.opacity;
  }
  ctx.lineWidth = width;
  ctx.lineCap = brush.type === 'marker' ? 'square' : 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function projectPointToLine(point: PencilPoint, guide: RulerGuide): PencilPoint {
  const dx = guide.x2 - guide.x1;
  const dy = guide.y2 - guide.y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1) return point;
  const t = ((point.x - guide.x1) * dx + (point.y - guide.y1) * dy) / lengthSq;
  return {
    ...point,
    x: guide.x1 + t * dx,
    y: guide.y1 + t * dy,
  };
}

const QUICK_SHAPE_HOLD_MS = 300;
const QUICK_SHAPE_HOLD_RADIUS_PX = 8;
const QUICK_SHAPE_MIN_LENGTH_PX = 20;
const QUICK_SHAPE_LINEARITY_THRESHOLD = 0.88;
const QUICK_SHAPE_MAX_DEVIATION_PX = 12;
const MIN_BRUSH_SIZE = 1;
const MAX_BRUSH_SIZE = 72;
const BRUSH_SIZE_SCRUB_SENSITIVITY = 0.22;
const BRUSH_SIZE_PRESETS = [2, 4, 8, 16, 32] as const;
const BRUSH_SIZE_SNAP_TOLERANCE = 0.8;

function pointDistance(a: PencilPoint, b: PencilPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(points: PencilPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += pointDistance(points[i - 1], points[i]);
  }
  return total;
}

function distanceToLine(point: PencilPoint, start: PencilPoint, end: PencilPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return pointDistance(point, start);
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lenSq;
  const px = start.x + t * dx;
  const py = start.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

function isStraightEnough(points: PencilPoint[]): boolean {
  if (points.length < 2) return false;
  const start = points[0];
  const end = points[points.length - 1];
  const directLength = pointDistance(start, end);
  const totalPathLength = pathLength(points);
  if (directLength < QUICK_SHAPE_MIN_LENGTH_PX || totalPathLength < QUICK_SHAPE_MIN_LENGTH_PX) {
    return false;
  }

  const linearity = directLength / Math.max(1, totalPathLength);
  if (linearity < QUICK_SHAPE_LINEARITY_THRESHOLD) return false;

  const maxDeviation = points.reduce((max, point) => (
    Math.max(max, distanceToLine(point, start, end))
  ), 0);

  const deviationThreshold = Math.max(QUICK_SHAPE_MAX_DEVIATION_PX, directLength * 0.07);
  return maxDeviation <= deviationThreshold;
}

function createLinePoints(start: PencilPoint, end: PencilPoint, timestamp: number): PencilPoint[] {
  return [
    { ...start },
    {
      ...end,
      timestamp,
      pressure: Math.max(start.pressure, end.pressure),
    },
  ];
}

function maybeConvertToQuickShapeLine(points: PencilPoint[]): PencilPoint[] {
  if (points.length < 2) return points;

  const last = points[points.length - 1];
  const start = points[0];

  if (points.length >= 3) {
    const secondLast = points[points.length - 2];
    const pointerUpHoldDuration = last.timestamp - secondLast.timestamp;
    const pointerUpHoldDistance = pointDistance(secondLast, last);
    if (
      pointerUpHoldDuration >= QUICK_SHAPE_HOLD_MS
      && pointerUpHoldDistance <= QUICK_SHAPE_HOLD_RADIUS_PX * 2
      && pointDistance(start, secondLast) >= QUICK_SHAPE_MIN_LENGTH_PX
    ) {
      return createLinePoints(start, secondLast, last.timestamp);
    }
  }

  let holdStartIndex = points.length - 1;
  while (
    holdStartIndex > 0
    && pointDistance(points[holdStartIndex - 1], last) <= QUICK_SHAPE_HOLD_RADIUS_PX
  ) {
    holdStartIndex -= 1;
  }

  const holdDuration = last.timestamp - points[holdStartIndex].timestamp;
  if (holdDuration >= QUICK_SHAPE_HOLD_MS) {
    const endIndex = Math.max(0, holdStartIndex - 1);
    if (endIndex >= 1) {
      const end = points[endIndex];
      if (pointDistance(start, end) >= QUICK_SHAPE_MIN_LENGTH_PX) {
        return createLinePoints(start, end, last.timestamp);
      }
    }
  }

  if (isStraightEnough(points)) {
    return createLinePoints(start, last, last.timestamp);
  }

  return points;
}

function shapePressure(points: PencilPoint[]): number {
  if (!points.length) return 0.6;
  const total = points.reduce((sum, point) => sum + point.pressure, 0);
  return total / points.length;
}

function interpolateLinePoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  pressure: number,
  timestamp: number,
  steps = 24
): PencilPoint[] {
  const count = Math.max(2, steps);
  const result: PencilPoint[] = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    result.push({
      x: startX + (endX - startX) * t,
      y: startY + (endY - startY) * t,
      pressure,
      tiltX: 0,
      tiltY: 0,
      timestamp: timestamp + i,
    });
  }
  return result;
}

interface GestureFrame {
  centerX: number;
  centerY: number;
  axisX: number;
  axisY: number;
  perpX: number;
  perpY: number;
  halfMajor: number;
  halfMinor: number;
}

function buildGestureFrame(points: PencilPoint[]): GestureFrame {
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const gestureLength = Math.max(1, Math.hypot(dx, dy));
  const axisX = dx / gestureLength;
  const axisY = dy / gestureLength;
  const perpX = -axisY;
  const perpY = axisX;
  const centerX = (first.x + last.x) / 2;
  const centerY = (first.y + last.y) / 2;

  let halfMajorFromPoints = gestureLength / 2;
  let halfMinorFromPoints = 0;
  for (const point of points) {
    const rx = point.x - centerX;
    const ry = point.y - centerY;
    halfMajorFromPoints = Math.max(halfMajorFromPoints, Math.abs(rx * axisX + ry * axisY));
    halfMinorFromPoints = Math.max(halfMinorFromPoints, Math.abs(rx * perpX + ry * perpY));
  }

  const halfMajor = Math.max(12, halfMajorFromPoints);
  const minHalfMinor = Math.max(6, Math.min(halfMajor * 0.5, 36));
  const halfMinor = Math.max(halfMinorFromPoints, minHalfMinor);

  return {
    centerX,
    centerY,
    axisX,
    axisY,
    perpX,
    perpY,
    halfMajor,
    halfMinor,
  };
}

function frameToWorld(frame: GestureFrame, localX: number, localY: number): { x: number; y: number } {
  return {
    x: frame.centerX + frame.axisX * localX + frame.perpX * localY,
    y: frame.centerY + frame.axisY * localX + frame.perpY * localY,
  };
}

function buildPolylineFromVertices(
  vertices: Array<{ x: number; y: number }>,
  pressure: number,
  timestamp: number,
  closePath = true,
  stepsPerEdge = 12
): PencilPoint[] {
  if (vertices.length < 2) return [];
  const edges = closePath ? vertices.length : vertices.length - 1;
  const result: PencilPoint[] = [];
  for (let i = 0; i < edges; i += 1) {
    const current = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    result.push(
      ...interpolateLinePoints(
        current.x,
        current.y,
        next.x,
        next.y,
        pressure,
        timestamp + i * 10,
        stepsPerEdge
      )
    );
  }
  return result;
}

function createShapePointsFromGesture(
  points: PencilPoint[],
  shapeType: ShapeType,
  style: ShapeStyle
): PencilPoint[] {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const ts = last.timestamp;
  const pressure = shapePressure(points);
  const frame = buildGestureFrame(points);
  const { halfMajor, halfMinor } = frame;

  if (shapeType === 'line') {
    return interpolateLinePoints(first.x, first.y, last.x, last.y, pressure, ts);
  }

  if (shapeType === 'arrow') {
    const shaft = interpolateLinePoints(first.x, first.y, last.x, last.y, pressure, ts, 18);
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / length;
    const uy = dy / length;
    const headLength = Math.min(36, Math.max(12, length * 0.18));
    const angle = Math.PI / 7;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const leftX = last.x - headLength * (ux * cosA - uy * sinA);
    const leftY = last.y - headLength * (uy * cosA + ux * sinA);
    const rightX = last.x - headLength * (ux * cosA + uy * sinA);
    const rightY = last.y - headLength * (uy * cosA - ux * sinA);
    const leftWing = interpolateLinePoints(last.x, last.y, leftX, leftY, pressure, ts + 20, 8);
    const rightWing = interpolateLinePoints(last.x, last.y, rightX, rightY, pressure, ts + 40, 8);
    return [...shaft, ...leftWing, ...rightWing];
  }

  if (shapeType === 'rectangle') {
    const vertices = [
      frameToWorld(frame, -halfMajor, -halfMinor),
      frameToWorld(frame, halfMajor, -halfMinor),
      frameToWorld(frame, halfMajor, halfMinor),
      frameToWorld(frame, -halfMajor, halfMinor),
    ];
    return buildPolylineFromVertices(vertices, pressure, ts, true, 12);
  }

  if (shapeType === 'ellipse') {
    const segments = 64;
    const result: PencilPoint[] = [];
    for (let i = 0; i <= segments; i += 1) {
      const angle = (i / segments) * Math.PI * 2;
      const localX = Math.cos(angle) * halfMajor;
      const localY = Math.sin(angle) * halfMinor;
      const world = frameToWorld(frame, localX, localY);
      result.push({
        x: world.x,
        y: world.y,
        pressure,
        tiltX: 0,
        tiltY: 0,
        timestamp: ts + i,
      });
    }
    return result;
  }

  if (shapeType === 'triangle') {
    const vertices = [
      frameToWorld(frame, -halfMajor, 0),
      frameToWorld(frame, halfMajor, -halfMinor),
      frameToWorld(frame, halfMajor, halfMinor),
    ];
    return buildPolylineFromVertices(vertices, pressure, ts, true, 14);
  }

  if (shapeType === 'polygon' || shapeType === 'star') {
    const sides = shapeType === 'polygon'
      ? Math.max(3, Math.min(10, Math.round(style.sides ?? 6)))
      : Math.max(4, Math.min(16, Math.round(style.points ?? 5) * 2));
    const outerRadiusX = halfMajor;
    const outerRadiusY = halfMinor;
    const innerRadiusX = shapeType === 'star' ? outerRadiusX * 0.45 : outerRadiusX;
    const innerRadiusY = shapeType === 'star' ? outerRadiusY * 0.45 : outerRadiusY;
    const vertices: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < sides; i += 1) {
      const angle = -Math.PI / 2 + (i / sides) * Math.PI * 2;
      const radiusX = shapeType === 'star' && i % 2 === 1 ? innerRadiusX : outerRadiusX;
      const radiusY = shapeType === 'star' && i % 2 === 1 ? innerRadiusY : outerRadiusY;
      vertices.push({
        ...frameToWorld(frame, Math.cos(angle) * radiusX, Math.sin(angle) * radiusY),
      });
    }
    return buildPolylineFromVertices(vertices, pressure, ts, true, 10);
  }

  return points;
}

function normalizeSelectionRect(rect: SelectionDragRect): SelectionDragRect {
  return {
    x1: Math.min(rect.x1, rect.x2),
    y1: Math.min(rect.y1, rect.y2),
    x2: Math.max(rect.x1, rect.x2),
    y2: Math.max(rect.y1, rect.y2),
  };
}

function strokeHitDistance(stroke: PencilStroke, point: { x: number; y: number }): number {
  let best = Number.POSITIVE_INFINITY;
  for (const strokePoint of stroke.points) {
    const dx = strokePoint.x - point.x;
    const dy = strokePoint.y - point.y;
    const dist = Math.hypot(dx, dy);
    if (dist < best) best = dist;
  }
  return best;
}

function isTransformIdentity(transform: Transform): boolean {
  return (
    transform.translateX === 0
    && transform.translateY === 0
    && transform.scaleX === 1
    && transform.scaleY === 1
    && transform.rotation === 0
  );
}

function selectionBoundsEqual(a: SelectionBounds | null, b: SelectionBounds | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.x === b.x
    && a.y === b.y
    && a.width === b.width
    && a.height === b.height
    && a.rotation === b.rotation
  );
}

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

const ProToolbar = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'drawing',
})<{ drawing?: boolean }>(({ drawing = false }) => ({
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translate3d(-50%, 0, 0)',
  width: 'fit-content',
  minWidth: 'min(560px, calc(100% - 16px))',
  maxWidth: 'calc(100% - 16px)',
  padding: '6px 14px',
  borderRadius: 28,
  backgroundColor: drawing ? 'rgba(14, 18, 30, 0.995)' : 'rgba(20, 20, 30, 0.97)',
  backdropFilter: drawing ? 'none' : 'blur(8px)',
  WebkitBackdropFilter: drawing ? 'none' : 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  overflowX: 'auto',
  overflowY: 'hidden',
  whiteSpace: 'nowrap',
  scrollbarWidth: 'thin',
  boxShadow: drawing
    ? '0 14px 34px rgba(0,0,0,0.5)'
    : '0 12px 30px rgba(0,0,0,0.42)',
  willChange: 'transform',
  contain: 'layout paint',
  isolation: 'isolate',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
}));

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

export const PencilCanvasPro = React.forwardRef<PencilCanvasProHandle, PencilCanvasProProps>(({
  width,
  height,
  backgroundImage,
  referenceImage: initialRefImage,
  initialStrokes = [],
  brushSettings: initialBrushSettings,
  showToolbar = true,
  showPressureIndicator = false,
  showReferenceImageControls = true,
  showGridOverlay: initialShowGrid = false,
  showDrawingToolsPanel = true,
  drawingToolsPanelPosition = 'right',
  initialToolsPanelCollapsed,
  drawingToolsPanelWidth,
  drawingToolsPanelCollapsedWidth = 48,
  palmRejection = 'smart',
  currentFrameIndex = 0,
  totalFrames = 1,
  getFrameImage,
  onStrokesChange,
  onSave,
  onReferenceImageChange,
  onExport,
}, ref) => {
  // Device detection
  const device = useDeviceDetection();
  
  // Canvas refs
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const referenceCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const symmetryCanvasRef = useRef<HTMLCanvasElement>(null);
  const onionCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const previewLastPointRef = useRef<PencilPoint | null>(null);
  const liveStrokeBrushRef = useRef<ProBrushSettings>({ ...DEFAULT_BRUSH_SETTINGS });
  const brushSizeMemoryRef = useRef<Record<ProBrushType, number>>({
    watercolor: DEFAULT_BRUSH_SETTINGS.size,
    pencil: DEFAULT_BRUSH_SETTINGS.size,
    pen: DEFAULT_BRUSH_SETTINGS.size,
    marker: DEFAULT_BRUSH_SETTINGS.size,
    ink: DEFAULT_BRUSH_SETTINGS.size,
    brush: DEFAULT_BRUSH_SETTINGS.size,
    highlighter: DEFAULT_BRUSH_SETTINGS.size,
    eraser: DEFAULT_BRUSH_SETTINGS.size,
  });
  const sizeScrubRef = useRef<{
    pointerId: number;
    startX: number;
    startSize: number;
    moved: boolean;
    triggerEl: HTMLElement | null;
  } | null>(null);
  const sizePreviewTimerRef = useRef<number | null>(null);
  const rulerDragPointerIdRef = useRef<number | null>(null);
  const rulerDragTargetRef = useRef<RulerDragTarget | null>(null);
  const rulerDragOriginRef = useRef<RulerGuide | null>(null);
  const rulerDragStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const selectionTransformRef = useRef<{
    pointerId: number;
    startPoint: { x: number; y: number };
    baselineBounds: SelectionBounds;
    baselineStrokes: PencilStroke[];
    selectedIndexes: number[];
  } | null>(null);
  
  // Brush engine
  const brushEngineRef = useRef<AdvancedBrushEngine | null>(null);
  
  // State
  const [brushSettings, setBrushSettings] = useState<ProBrushSettings>({
    ...DEFAULT_BRUSH_SETTINGS,
    ...initialBrushSettings,
  });
  const [strokes, setStrokes] = useState<PencilStroke[]>(initialStrokes);
  const [undoStack, setUndoStack] = useState<PencilStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<PencilStroke[][]>([]);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [sizePreview, setSizePreview] = useState<{ size: number; active: boolean }>({
    size: DEFAULT_BRUSH_SETTINGS.size,
    active: false,
  });
  const [brushSizeInput, setBrushSizeInput] = useState<string>(String(DEFAULT_BRUSH_SETTINGS.size));
  const [lastInputType, setLastInputType] = useState<InputType>('mouse');
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(initialRefImage || null);
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [refOpacity, setRefOpacity] = useState(initialRefImage?.opacity || 0.3);
  const defaultDesktopCollapsed = width < 2200 || device.isIPad;
  const [toolsPanelCollapsed, setToolsPanelCollapsed] = useState(
    () => initialToolsPanelCollapsed ?? defaultDesktopCollapsed
  );
  const [hasUserSetToolsPanelState, setHasUserSetToolsPanelState] = useState(false);
  const [viewTransform, setViewTransform] = useState({ scale: 1, rotation: 0, offsetX: 0, offsetY: 0 });
  const [rulerEnabled, setRulerEnabled] = useState(false);
  const [quickShapeEnabled, setQuickShapeEnabled] = useState(false);
  const [rulerGuide, setRulerGuide] = useState<RulerGuide>(() => ({
    x1: Math.max(40, width * 0.25),
    y1: Math.round(height * 0.5),
    x2: Math.min(width - 40, width * 0.75),
    y2: Math.round(height * 0.5),
  }));
  
  // Drawing state for professional features
  const [drawingState, setDrawingState] = useState<DrawingState>(() => ({
    ...DEFAULT_DRAWING_STATE,
    brushConfig: {
      ...DEFAULT_DRAWING_STATE.brushConfig,
      ...DEFAULT_BRUSH_SETTINGS,
      ...initialBrushSettings,
    },
  }));
  
  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<PencilStroke[]>([]);
  const [selectionDragState, setSelectionDragState] = useState<SelectionDragState | null>(null);
  
  // Popover anchors
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [sizeAnchor, setSizeAnchor] = useState<HTMLElement | null>(null);
  const [refAnchor, setRefAnchor] = useState<HTMLElement | null>(null);
  const [advancedAnchor, setAdvancedAnchor] = useState<HTMLElement | null>(null);
  const resolvedDrawingToolsPanelWidth = useMemo(() => {
    if (typeof drawingToolsPanelWidth === 'number' && Number.isFinite(drawingToolsPanelWidth)) {
      return Math.max(240, Math.min(420, drawingToolsPanelWidth));
    }
    if (width >= 3840) return 360;
    if (width >= 2560) return 320;
    if (width >= 1920) return 288;
    if (width >= 1400) return 268;
    return 252;
  }, [drawingToolsPanelWidth, width]);

  const selectedStrokeIndexes = useMemo(() => (
    drawingState.selectedStrokeIds
      .map((id) => Number(id.replace('stroke-', '')))
      .filter((index) => Number.isFinite(index) && index >= 0 && index < strokes.length)
  ), [drawingState.selectedStrokeIds, strokes.length]);

  useEffect(() => {
    if (!drawingState.selectedStrokeIds.length) {
      if (drawingState.selectionBounds) {
        setDrawingState((prev) => ({ ...prev, selectionBounds: null }));
      }
      return;
    }

    if (!selectedStrokeIndexes.length) {
      setDrawingState((prev) => ({ ...prev, selectedStrokeIds: [], selectionBounds: null }));
      return;
    }

    const selectedStrokes = selectedStrokeIndexes.map((index) => strokes[index]).filter(Boolean);
    const nextBounds = getStrokeBounds(selectedStrokes);
    if (!selectionBoundsEqual(nextBounds, drawingState.selectionBounds)) {
      setDrawingState((prev) => ({ ...prev, selectionBounds: nextBounds }));
    }
  }, [
    drawingState.selectedStrokeIds,
    drawingState.selectionBounds,
    selectedStrokeIndexes,
    strokes,
  ]);
  
  const normalizeBrushSize = useCallback((value: number): number => (
    clamp(Number.isFinite(value) ? value : DEFAULT_BRUSH_SETTINGS.size, MIN_BRUSH_SIZE, MAX_BRUSH_SIZE)
  ), []);

  const formatBrushSize = useCallback((value: number): string => (
    value.toFixed(value % 1 === 0 ? 0 : 1)
  ), []);

  const snapBrushSize = useCallback((value: number): number => {
    const nearestPreset = BRUSH_SIZE_PRESETS.reduce((nearest, preset) => (
      Math.abs(preset - value) < Math.abs(nearest - value) ? preset : nearest
    ), BRUSH_SIZE_PRESETS[0]);
    return Math.abs(nearestPreset - value) <= BRUSH_SIZE_SNAP_TOLERANCE ? nearestPreset : value;
  }, []);

  const previewBrushSize = useCallback((size: number) => {
    const nextSize = normalizeBrushSize(size);
    setSizePreview({ size: nextSize, active: true });
    if (sizePreviewTimerRef.current !== null) {
      window.clearTimeout(sizePreviewTimerRef.current);
    }
    sizePreviewTimerRef.current = window.setTimeout(() => {
      setSizePreview((prev) => ({ ...prev, active: false }));
      sizePreviewTimerRef.current = null;
    }, 420);
  }, [normalizeBrushSize]);

  const setBrushSize = useCallback((size: number, options?: { snap?: boolean; preview?: boolean }) => {
    const shouldSnap = options?.snap ?? false;
    const shouldPreview = options?.preview ?? true;
    const normalized = normalizeBrushSize(size);
    const nextSize = shouldSnap ? snapBrushSize(normalized) : normalized;

    setBrushSettings((prev) => {
      if (prev.size === nextSize) return prev;
      brushSizeMemoryRef.current[prev.type] = nextSize;
      return { ...prev, size: nextSize };
    });
    if (shouldPreview) {
      previewBrushSize(nextSize);
    }
  }, [normalizeBrushSize, previewBrushSize, snapBrushSize]);

  const setActiveBrushType = useCallback((type: ProBrushType) => {
    setBrushSettings((prev) => {
      if (prev.type === type) return prev;
      brushSizeMemoryRef.current[prev.type] = prev.size;
      const rememberedSize = normalizeBrushSize(
        brushSizeMemoryRef.current[type] ?? prev.size ?? DEFAULT_BRUSH_SETTINGS.size
      );
      brushSizeMemoryRef.current[type] = rememberedSize;
      previewBrushSize(rememberedSize);
      return {
        ...prev,
        type,
        size: rememberedSize,
      };
    });
  }, [normalizeBrushSize, previewBrushSize]);

  const commitBrushSizeInput = useCallback(() => {
    const normalizedInput = brushSizeInput.replace(',', '.').trim();
    const parsed = Number(normalizedInput);
    if (!Number.isFinite(parsed)) {
      setBrushSizeInput(formatBrushSize(brushSettings.size));
      return;
    }
    setBrushSize(parsed, { snap: true, preview: true });
  }, [brushSizeInput, brushSettings.size, formatBrushSize, setBrushSize]);

  const applyBrushSettings = useCallback((update: BrushSettingsUpdate) => {
    setBrushSettings((prev) => {
      const resolved = typeof update === 'function' ? update(prev) : update;
      const requestedType = resolved.type && isProBrushType(resolved.type) ? resolved.type : prev.type;
      const next = { ...prev, ...resolved, type: requestedType };

      if (resolved.type && requestedType !== prev.type && resolved.size === undefined) {
        const rememberedSize = normalizeBrushSize(
          brushSizeMemoryRef.current[requestedType] ?? next.size ?? prev.size
        );
        next.size = rememberedSize;
      }

      if (typeof next.size === 'number') {
        next.size = normalizeBrushSize(next.size);
        brushSizeMemoryRef.current[next.type] = next.size;
      }
      return brushConfigDiffers(next, prev) ? next : prev;
    });
  }, [normalizeBrushSize]);

  // Update drawing state helper
  const updateDrawingState = useCallback((updates: Partial<DrawingState>) => {
    const { brushConfig, ...rest } = updates;

    if (brushConfig) {
      applyBrushSettings(brushConfig);
    }

    if (Object.keys(rest).length > 0) {
      setDrawingState((prev) => ({ ...prev, ...rest }));
    }
  }, [applyBrushSettings]);

  const activeTool: ActiveTool = drawingState.activeTool;
  const gestureSettings: GestureSettings = drawingState.gestureSettings;
  const symmetrySettings: SymmetrySettings = drawingState.symmetrySettings;
  const pressureCurve: PressureCurve = drawingState.pressureCurve;
  const onionSkinSettings: OnionSkinSettings = drawingState.onionSkinSettings;
  const selectedShapeType: ShapeType | null = drawingState.activeShapeType;
  const selectedShapeStyle: ShapeStyle = drawingState.shapeStyle;
  const activeBrushConfig: BrushConfig = brushSettings;
  const canDrawStroke = activeTool === 'brush' || (activeTool === 'shape' && Boolean(selectedShapeType));

  useEffect(() => {
    brushSizeMemoryRef.current[brushSettings.type] = normalizeBrushSize(brushSettings.size);
  }, [brushSettings.type, brushSettings.size, normalizeBrushSize]);

  useEffect(() => {
    const formatted = formatBrushSize(brushSettings.size);
    setBrushSizeInput((prev) => (prev === formatted ? prev : formatted));
  }, [brushSettings.size, formatBrushSize]);

  useEffect(() => {
    const handleBrushSizeShortcut = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key !== '[' && event.key !== ']') return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
      }
      event.preventDefault();
      const delta = event.shiftKey ? 4 : 1;
      const direction = event.key === ']' ? 1 : -1;
      setBrushSize(brushSettings.size + direction * delta, { snap: false, preview: true });
    };

    window.addEventListener('keydown', handleBrushSizeShortcut);
    return () => window.removeEventListener('keydown', handleBrushSizeShortcut);
  }, [brushSettings.size, setBrushSize]);
  
  // Apply pressure curve to points
  const applyPressureCurve = useCallback((point: PencilPoint): PencilPoint => {
    return {
      ...point,
      pressure: evaluatePressureCurve(pressureCurve, point.pressure),
    };
  }, [pressureCurve]);

  const getLocalPointFromPointerEvent = useCallback((event: PointerEvent | React.PointerEvent) => {
    const element = containerRef.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: clamp(event.clientX - rect.left, 0, width),
      y: clamp(event.clientY - rect.top, 0, height),
    };
  }, [width, height]);

  const applySelectionByIndexes = useCallback((indexes: number[]) => {
    const uniqueIndexes = Array.from(new Set(indexes))
      .filter((index) => Number.isInteger(index) && index >= 0 && index < strokes.length)
      .sort((a, b) => a - b);
    const selectedStrokeIds = uniqueIndexes.map((index) => `stroke-${index}`);
    const selectedStrokes = uniqueIndexes.map((index) => strokes[index]).filter(Boolean);
    updateDrawingState({
      selectedStrokeIds,
      selectionBounds: getStrokeBounds(selectedStrokes),
    });
  }, [strokes, updateDrawingState]);

  const effectiveSelectionMode: 'rectangle' | 'lasso' = drawingState.selectionMode === 'lasso'
    ? 'lasso'
    : 'rectangle';

  const handleSelectionOverlayPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'select') return;
    const point = getLocalPointFromPointerEvent(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    setSelectionDragState({
      pointerId: event.pointerId,
      mode: effectiveSelectionMode,
      start: point,
      current: point,
      lassoPoints: effectiveSelectionMode === 'lasso'
        ? [{ x: point.x, y: point.y, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: Date.now() }]
        : [],
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [activeTool, getLocalPointFromPointerEvent, effectiveSelectionMode]);

  const handleSelectionOverlayPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    setSelectionDragState((prev) => {
      if (!prev || prev.pointerId !== event.pointerId) return prev;
      const point = getLocalPointFromPointerEvent(event);
      if (!point) return prev;
      const nextLasso = prev.mode === 'lasso'
        ? [...prev.lassoPoints, { x: point.x, y: point.y, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: Date.now() }]
        : prev.lassoPoints;
      return {
        ...prev,
        current: point,
        lassoPoints: nextLasso,
      };
    });
  }, [getLocalPointFromPointerEvent]);

  const handleSelectionOverlayPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = selectionDragState;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);

    const dragDx = dragState.current.x - dragState.start.x;
    const dragDy = dragState.current.y - dragState.start.y;
    const dragDistance = Math.hypot(dragDx, dragDy);
    let nextSelectionIndexes: number[] = [];

    if (dragState.mode === 'lasso' && dragState.lassoPoints.length >= 3 && dragDistance >= 4) {
      nextSelectionIndexes = strokes
        .map((stroke, index) => (isStrokeInLasso(stroke, dragState.lassoPoints) ? index : -1))
        .filter((index) => index >= 0);
    } else if (dragDistance >= 4) {
      const rect = normalizeSelectionRect({
        x1: dragState.start.x,
        y1: dragState.start.y,
        x2: dragState.current.x,
        y2: dragState.current.y,
      });
      nextSelectionIndexes = strokes
        .map((stroke, index) => (isStrokeInRectangle(stroke, rect) ? index : -1))
        .filter((index) => index >= 0);
    } else {
      for (let i = strokes.length - 1; i >= 0; i -= 1) {
        const hitDistance = strokeHitDistance(strokes[i], dragState.current);
        const threshold = Math.max(12, (strokes[i].width || 2) * 2);
        if (hitDistance <= threshold) {
          nextSelectionIndexes = [i];
          break;
        }
      }
    }

    applySelectionByIndexes(nextSelectionIndexes);
    setSelectionDragState(null);
  }, [selectionDragState, strokes, applySelectionByIndexes]);

  const selectionPreviewRect = useMemo<SelectionDragRect | null>(() => {
    if (!selectionDragState || selectionDragState.mode !== 'rectangle') return null;
    return normalizeSelectionRect({
      x1: selectionDragState.start.x,
      y1: selectionDragState.start.y,
      x2: selectionDragState.current.x,
      y2: selectionDragState.current.y,
    });
  }, [selectionDragState]);

  const selectionLassoPath = useMemo(() => {
    if (!selectionDragState || selectionDragState.mode !== 'lasso' || selectionDragState.lassoPoints.length < 2) {
      return '';
    }
    const [first, ...rest] = selectionDragState.lassoPoints;
    return `M ${first.x} ${first.y} ${rest.map((point) => `L ${point.x} ${point.y}`).join(' ')}`;
  }, [selectionDragState]);

  const snapPointWithRuler = useCallback((point: PencilPoint): PencilPoint => {
    if (!rulerEnabled) return point;
    return projectPointToLine(point, rulerGuide);
  }, [rulerEnabled, rulerGuide]);

  const resetRulerGuide = useCallback(() => {
    setRulerGuide({
      x1: Math.max(40, width * 0.25),
      y1: Math.round(height * 0.5),
      x2: Math.min(width - 40, width * 0.75),
      y2: Math.round(height * 0.5),
    });
  }, [width, height]);

  const handleRulerDragMove = useCallback((event: PointerEvent) => {
    if (rulerDragPointerIdRef.current !== null && event.pointerId !== rulerDragPointerIdRef.current) {
      return;
    }
    const origin = rulerDragOriginRef.current;
    const startPoint = rulerDragStartPointRef.current;
    const target = rulerDragTargetRef.current;
    const point = getLocalPointFromPointerEvent(event);
    if (!origin || !startPoint || !target || !point) return;

    const dx = point.x - startPoint.x;
    const dy = point.y - startPoint.y;

    if (target === 'line') {
      setRulerGuide({
        x1: clamp(origin.x1 + dx, 0, width),
        y1: clamp(origin.y1 + dy, 0, height),
        x2: clamp(origin.x2 + dx, 0, width),
        y2: clamp(origin.y2 + dy, 0, height),
      });
      return;
    }

    if (target === 'start') {
      setRulerGuide({
        ...origin,
        x1: clamp(origin.x1 + dx, 0, width),
        y1: clamp(origin.y1 + dy, 0, height),
      });
      return;
    }

    setRulerGuide({
      ...origin,
      x2: clamp(origin.x2 + dx, 0, width),
      y2: clamp(origin.y2 + dy, 0, height),
    });
  }, [getLocalPointFromPointerEvent, width, height]);

  const handleRulerDragEnd = useCallback((event: PointerEvent) => {
    if (rulerDragPointerIdRef.current !== null && event.pointerId !== rulerDragPointerIdRef.current) {
      return;
    }
    rulerDragPointerIdRef.current = null;
    rulerDragTargetRef.current = null;
    rulerDragOriginRef.current = null;
    rulerDragStartPointRef.current = null;
    window.removeEventListener('pointermove', handleRulerDragMove);
    window.removeEventListener('pointerup', handleRulerDragEnd);
  }, [handleRulerDragMove]);

  const startRulerDrag = useCallback((target: RulerDragTarget) => (event: React.PointerEvent<HTMLDivElement>) => {
    const startPoint = getLocalPointFromPointerEvent(event);
    if (!startPoint) return;
    event.preventDefault();
    event.stopPropagation();
    rulerDragPointerIdRef.current = event.pointerId;
    rulerDragTargetRef.current = target;
    rulerDragOriginRef.current = { ...rulerGuide };
    rulerDragStartPointRef.current = startPoint;
    window.addEventListener('pointermove', handleRulerDragMove);
    window.addEventListener('pointerup', handleRulerDragEnd);
  }, [getLocalPointFromPointerEvent, handleRulerDragMove, handleRulerDragEnd, rulerGuide]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', handleRulerDragMove);
    window.removeEventListener('pointerup', handleRulerDragEnd);
  }, [handleRulerDragMove, handleRulerDragEnd]);

  const handleSizeScrubMove = useCallback((event: PointerEvent) => {
    const scrubState = sizeScrubRef.current;
    if (!scrubState || event.pointerId !== scrubState.pointerId) return;
    const deltaX = event.clientX - scrubState.startX;
    if (!scrubState.moved && Math.abs(deltaX) >= 3) {
      scrubState.moved = true;
    }
    if (!scrubState.moved) return;
    event.preventDefault();
    const nextSize = scrubState.startSize + deltaX * BRUSH_SIZE_SCRUB_SENSITIVITY;
    setBrushSize(nextSize, { snap: false, preview: true });
  }, [setBrushSize]);

  const handleSizeScrubEnd = useCallback((event: PointerEvent) => {
    const scrubState = sizeScrubRef.current;
    if (!scrubState || event.pointerId !== scrubState.pointerId) return;
    sizeScrubRef.current = null;
    window.removeEventListener('pointermove', handleSizeScrubMove);
    window.removeEventListener('pointerup', handleSizeScrubEnd);
    window.removeEventListener('pointercancel', handleSizeScrubEnd);

    if (!scrubState.moved && scrubState.triggerEl) {
      setSizeAnchor(scrubState.triggerEl);
    }
  }, [handleSizeScrubMove]);

  const handleSizeControlPointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (
      event.button !== 0
      && event.pointerType !== 'touch'
      && event.pointerType !== 'pen'
    ) {
      return;
    }
    event.preventDefault();
    sizeScrubRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startSize: brushSettings.size,
      moved: false,
      triggerEl: event.currentTarget,
    };
    window.addEventListener('pointermove', handleSizeScrubMove, { passive: false });
    window.addEventListener('pointerup', handleSizeScrubEnd);
    window.addEventListener('pointercancel', handleSizeScrubEnd);
  }, [brushSettings.size, handleSizeScrubMove, handleSizeScrubEnd]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', handleSizeScrubMove);
    window.removeEventListener('pointerup', handleSizeScrubEnd);
    window.removeEventListener('pointercancel', handleSizeScrubEnd);
  }, [handleSizeScrubMove, handleSizeScrubEnd]);

  useEffect(() => () => {
    if (sizePreviewTimerRef.current !== null) {
      window.clearTimeout(sizePreviewTimerRef.current);
      sizePreviewTimerRef.current = null;
    }
  }, []);

  const shapePreview = useMemo<Shape | null>(() => {
    if (!selectedShapeType || !hoverPosition) return null;
    return {
      id: 'shape-preview',
      type: selectedShapeType,
      x: hoverPosition.x - 40,
      y: hoverPosition.y - 30,
      width: 80,
      height: 60,
      rotation: 0,
      style: selectedShapeStyle,
    };
  }, [selectedShapeType, hoverPosition, selectedShapeStyle]);
  
  // Apple Pencil hook
  const {
    ref: pencilRef,
    state: pencilState,
  } = useApplePencil({
    onStrokeStart: (point: PencilPoint, inputType: InputType) => {
      setLastInputType((prev) => (prev === inputType ? prev : inputType));
      setHoverPosition(null);
      if (!canDrawStroke) {
        previewLastPointRef.current = null;
        const previewCtx = previewCanvasRef.current?.getContext('2d');
        if (previewCtx) {
          previewCtx.clearRect(0, 0, width, height);
        }
        return;
      }
      liveStrokeBrushRef.current = { ...brushSettings };
      const previewCtx = previewCanvasRef.current?.getContext('2d');
      if (previewCtx) {
        previewCtx.clearRect(0, 0, width, height);
      }
      // Apply ruler snap + pressure curve
      const adjustedPoint = applyPressureCurve(snapPointWithRuler(point));
      previewLastPointRef.current = adjustedPoint;
      brushEngineRef.current?.startStroke(adjustedPoint);
    },
    
    onStrokeMove: (point: PencilPoint, inputType: InputType) => {
      setLastInputType((prev) => (prev === inputType ? prev : inputType));
      if (!canDrawStroke) return;
      if (!previewCanvasRef.current) return;
      const ctx = previewCanvasRef.current.getContext('2d');
      if (!ctx) return;

      const adjustedPoint = applyPressureCurve(snapPointWithRuler(point));
      const previousPoint = previewLastPointRef.current;
      if (!previousPoint) {
        previewLastPointRef.current = adjustedPoint;
        return;
      }

      const segment = [previousPoint, adjustedPoint];
      const liveBrush = liveStrokeBrushRef.current;
      if (drawingState.symmetrySettings.type !== 'none') {
        const mirroredPointSets = getMirroredPoints(
          segment,
          drawingState.symmetrySettings,
          width,
          height
        );
        mirroredPointSets.forEach((points) => {
          if (points.length >= 2) {
            drawLivePreviewSegment(ctx, points[0], points[1], liveBrush);
          }
        });
      } else {
        drawLivePreviewSegment(ctx, previousPoint, adjustedPoint, liveBrush);
      }
      previewLastPointRef.current = adjustedPoint;
    },
    
    onStrokeEnd: (stroke: PencilStroke, inputType: InputType) => {
      setLastInputType((prev) => (prev === inputType ? prev : inputType));
      setHoverPosition(null);
      previewLastPointRef.current = null;
      brushEngineRef.current?.endStroke();
      if (!canDrawStroke) {
        const previewCtx = previewCanvasRef.current?.getContext('2d');
        if (previewCtx) {
          previewCtx.clearRect(0, 0, width, height);
        }
        return;
      }
      
      // Apply pressure curve to stroke points
      const brushSnapshot = { ...liveStrokeBrushRef.current };
      const snappedPoints = stroke.points.map((point) => applyPressureCurve(snapPointWithRuler(point)));
      const isShapeToolActive = activeTool === 'shape' && Boolean(selectedShapeType);
      if (isShapeToolActive && selectedShapeType) {
        const shapePoints = createShapePointsFromGesture(snappedPoints, selectedShapeType, selectedShapeStyle);
        if (shapePoints.length >= 2) {
          const shapeStroke: PencilStroke = {
            ...stroke,
            points: shapePoints,
            color: selectedShapeStyle.strokeColor,
            width: Math.max(1, selectedShapeStyle.strokeWidth),
            opacity: clamp(selectedShapeStyle.strokeOpacity, 0, 1),
            brush: {
              type: 'pen',
              size: Math.max(1, selectedShapeStyle.strokeWidth),
              color: selectedShapeStyle.strokeColor,
              opacity: clamp(selectedShapeStyle.strokeOpacity, 0, 1),
              hardness: 0.9,
              flow: 1,
              wetness: 0,
              grain: 0,
              tiltSensitivity: 0.2,
              pressureSensitivity: 0.2,
            },
          };
          saveToUndo();
          const newShapeStrokes = [...strokes, shapeStroke];
          setStrokes(newShapeStrokes);
          onStrokesChange?.(newShapeStrokes);
        }
        const previewCtx = previewCanvasRef.current?.getContext('2d');
        if (previewCtx) {
          previewCtx.clearRect(0, 0, width, height);
        }
        return;
      }

      const shouldApplyQuickShape = quickShapeEnabled
        && activeTool === 'brush'
        && brushSnapshot.type !== 'eraser';
      const finalPoints = shouldApplyQuickShape
        ? maybeConvertToQuickShapeLine(snappedPoints)
        : snappedPoints;
      const adjustedStroke: PencilStroke = {
        ...stroke,
        points: finalPoints,
        color: brushSnapshot.color,
        width: brushSnapshot.size,
        opacity: brushSnapshot.opacity,
        brush: {
          type: brushSnapshot.type,
          size: brushSnapshot.size,
          color: brushSnapshot.color,
          opacity: brushSnapshot.opacity,
          hardness: brushSnapshot.hardness,
          flow: brushSnapshot.flow,
          wetness: brushSnapshot.wetness,
          grain: brushSnapshot.grain,
          tiltSensitivity: brushSnapshot.tiltSensitivity,
          pressureSensitivity: brushSnapshot.pressureSensitivity,
        },
      };
      
      if (brushSettings.type === 'eraser') {
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
          const mirroredStrokes = mirroredPointSets.map((points) => ({
            ...adjustedStroke,
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
        previewCtx.clearRect(0, 0, width, height);
      }
    },
    
    onHoverStart: (point: PencilPoint) => {
      setHoverPosition({ x: point.x, y: point.y });
    },
    
    onHoverMove: (point: PencilPoint) => {
      setHoverPosition({ x: point.x, y: point.y });
    },
    
    onHoverEnd: () => {
      setHoverPosition(null);
    },
    
    onDoubleTap: () => {
      setActiveBrushType(brushSettings.type === 'eraser' ? 'pencil' : 'eraser');
    },
  }, {
    palmRejection,
    minPressure: 0.01,
    pressureSmoothing: 0.15,
    enableHover: true,
    enableDoubleTap: true,
  });

  const setCanvasContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    pencilRef.current = node;
  }, [pencilRef]);
  
  // Initialize brush engine
  useEffect(() => {
    if (!brushEngineRef.current && mainCanvasRef.current) {
      const ctx = mainCanvasRef.current.getContext('2d');
      if (ctx) {
        brushEngineRef.current = new AdvancedBrushEngine(ctx, brushSettings);
      }
    }
  }, [brushSettings]);
  
  useEffect(() => {
    if (!initialBrushSettings) return;
    applyBrushSettings(initialBrushSettings);
  }, [
    applyBrushSettings,
    initialBrushSettings?.type,
    initialBrushSettings?.size,
    initialBrushSettings?.color,
    initialBrushSettings?.opacity,
    initialBrushSettings?.hardness,
    initialBrushSettings?.flow,
    initialBrushSettings?.wetness,
    initialBrushSettings?.grain,
    initialBrushSettings?.tiltSensitivity,
    initialBrushSettings?.pressureSensitivity,
  ]);

  useEffect(() => {
    // Keep small layouts compact by default, but never fight manual user choice.
    if (hasUserSetToolsPanelState) return;
    if (width < 1360 && !toolsPanelCollapsed) {
      setToolsPanelCollapsed(true);
    }
  }, [width, toolsPanelCollapsed, hasUserSetToolsPanelState]);

  const handleToolsPanelCollapsedChange = useCallback((collapsed: boolean) => {
    setHasUserSetToolsPanelState(true);
    setToolsPanelCollapsed(collapsed);
  }, []);

  const handleToolsPanelToggle = useCallback(() => {
    setHasUserSetToolsPanelState(true);
    setToolsPanelCollapsed((prev) => !prev);
  }, []);
  
  // Draw reference image
  useEffect(() => {
    if (!referenceCanvasRef.current) return;
    const ctx = referenceCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    if (referenceImage && referenceImage.visible) {
      const img = new window.Image();
      img.onload = () => {
        ctx.globalAlpha = referenceImage.opacity;
        ctx.drawImage(
          img,
          referenceImage.x,
          referenceImage.y,
          referenceImage.width,
          referenceImage.height
        );
        ctx.globalAlpha = 1;
      };
      img.src = referenceImage.src;
    }
  }, [referenceImage, width, height]);

  useEffect(() => {
    if (!referenceImage) return;
    if (Math.abs(referenceImage.opacity - refOpacity) < 0.001) return;
    const nextReference = { ...referenceImage, opacity: refOpacity };
    setReferenceImage(nextReference);
    onReferenceImageChange?.(nextReference);
  }, [refOpacity, referenceImage, onReferenceImageChange]);
  
  // Draw grid overlay
  useEffect(() => {
    if (!gridCanvasRef.current) return;
    const ctx = gridCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    if (showGrid) {
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
  }, [showGrid, width, height]);
  
  // Draw symmetry guides
  useEffect(() => {
    if (!symmetryCanvasRef.current) return;
    const ctx = symmetryCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw storyboard template guides
    if (drawingState.storyboardTemplate?.guides.enabled) {
      const template = drawingState.storyboardTemplate;
      const aspectRatio = calculateAspectRatio(template.aspectRatio.width, template.aspectRatio.height);
      const frameSize = getFrameDimensions(aspectRatio, width, height);
      const frameX = (width - frameSize.width) / 2;
      const frameY = (height - frameSize.height) / 2;
      const rightEdge = frameX + frameSize.width;
      const bottomEdge = frameY + frameSize.height;

      ctx.save();

      if (frameY > 0) {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
        ctx.fillRect(0, 0, width, frameY);
        ctx.fillRect(0, bottomEdge, width, Math.max(0, height - bottomEdge));
      }
      if (frameX > 0) {
        ctx.fillStyle = 'rgba(2, 6, 23, 0.42)';
        ctx.fillRect(0, frameY, frameX, frameSize.height);
        ctx.fillRect(rightEdge, frameY, Math.max(0, width - rightEdge), frameSize.height);
      }

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(frameX + 0.5, frameY + 0.5, Math.max(0, frameSize.width - 1), Math.max(0, frameSize.height - 1));

      ctx.translate(frameX, frameY);
      drawGuides(ctx, frameSize.width, frameSize.height, template.guides);
      ctx.restore();
    }
    
    // Draw symmetry guides
    if (symmetrySettings.type !== 'none' && symmetrySettings.showGuides) {
      drawSymmetryGuides(ctx, symmetrySettings, width, height);
    }

    // Draw shape preview for shape tools
    if (shapePreview) {
      drawShape(ctx, shapePreview, true);
    }
  }, [drawingState.storyboardTemplate, symmetrySettings, shapePreview, width, height]);
  
  // Draw onion skinning
  useEffect(() => {
    if (!onionCanvasRef.current || !getFrameImage) return;
    const ctx = onionCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    if (onionSkinSettings.enabled) {
      const frames = getOnionFrames(currentFrameIndex, totalFrames, onionSkinSettings);
      renderOnionSkins(ctx, width, height, frames, getFrameImage, onionSkinSettings);
    }
  }, [onionSkinSettings, currentFrameIndex, totalFrames, getFrameImage, width, height]);

  const getStrokeBrushSettings = useCallback((stroke: PencilStroke): Partial<BrushConfig> => {
    const storedType = stroke.brush?.type;
    const safeType = storedType && isProBrushType(storedType) ? storedType : 'pen';
    return {
      ...DEFAULT_BRUSH_SETTINGS,
      ...(stroke.brush ?? {}),
      type: safeType,
      size: typeof stroke.width === 'number' ? stroke.width : DEFAULT_BRUSH_SETTINGS.size,
      color: stroke.color || DEFAULT_BRUSH_SETTINGS.color,
      opacity: typeof stroke.opacity === 'number' ? stroke.opacity : DEFAULT_BRUSH_SETTINGS.opacity,
    };
  }, []);
  
  // Redraw main canvas
  const redrawMainCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const engine = brushEngineRef.current;
    if (!canvas || !ctx || !engine) return;
    
    ctx.clearRect(0, 0, width, height);
    
    if (backgroundImageRef.current) {
      ctx.drawImage(backgroundImageRef.current, 0, 0, width, height);
    }
    strokes.forEach(stroke => {
      engine.renderStroke(ctx, stroke.points, getStrokeBrushSettings(stroke));
    });
    const shouldShowTextSelection = drawingState.activeTool === 'text';
    drawingState.textAnnotations.forEach((annotation) => {
      drawTextAnnotation(
        ctx,
        annotation,
        shouldShowTextSelection && annotation.id === drawingState.selectedTextAnnotationId
      );
    });
  }, [
    width,
    height,
    strokes,
    getStrokeBrushSettings,
    drawingState.activeTool,
    drawingState.textAnnotations,
    drawingState.selectedTextAnnotationId,
  ]);
  
  // Redraw when strokes change
  useEffect(() => {
    redrawMainCanvas();
  }, [redrawMainCanvas]);

  useEffect(() => {
    if (!backgroundImage) {
      backgroundImageRef.current = null;
      redrawMainCanvas();
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      backgroundImageRef.current = img;
      redrawMainCanvas();
    };
    img.src = backgroundImage;
  }, [backgroundImage, redrawMainCanvas]);
  
  // Check if strokes intersect (for eraser)
  const strokesIntersect = (s1: PencilStroke, s2: PencilStroke): boolean => {
    const threshold = brushSettings.size * 3;
    for (const p1 of s1.points) {
      for (const p2 of s2.points) {
        const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
        if (dist < threshold) return true;
      }
    }
    return false;
  };
  
  // Undo/Redo
  const saveToUndo = useCallback(() => {
    setUndoStack(prev => [...prev, strokes]);
    setRedoStack([]);
  }, [strokes]);
  
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, strokes]);
    setUndoStack(prev => prev.slice(0, -1));
    setStrokes(previous);
    onStrokesChange?.(previous);
  }, [undoStack, strokes, onStrokesChange]);
  
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, strokes]);
    setRedoStack(prev => prev.slice(0, -1));
    setStrokes(next);
    onStrokesChange?.(next);
  }, [redoStack, strokes, onStrokesChange]);

  // Clipboard operations
  const copySelection = useCallback(() => {
    const selected = selectedStrokeIndexes.map((index) => strokes[index]).filter(Boolean);
    setClipboard(selected);
  }, [selectedStrokeIndexes, strokes]);
  
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
    const selected = selectedStrokeIndexes.map((index) => strokes[index]).filter(Boolean);
    if (!selected.length) return;
    setClipboard(selected);
    saveToUndo();
    const selectedIndexSet = new Set(selectedStrokeIndexes);
    const remaining = strokes.filter((_, index) => !selectedIndexSet.has(index));
    setStrokes(remaining);
    onStrokesChange?.(remaining);
    updateDrawingState({ selectedStrokeIds: [], selectionBounds: null });
  }, [selectedStrokeIndexes, strokes, saveToUndo, onStrokesChange, updateDrawingState]);
  
  const deleteSelection = useCallback(() => {
    if (!selectedStrokeIndexes.length) return;
    const selectedIndexSet = new Set(selectedStrokeIndexes);
    const remaining = strokes.filter((_, index) => !selectedIndexSet.has(index));
    if (remaining.length === strokes.length) return;
    saveToUndo();
    setStrokes(remaining);
    onStrokesChange?.(remaining);
    updateDrawingState({ selectedStrokeIds: [], selectionBounds: null });
  }, [selectedStrokeIndexes, strokes, saveToUndo, onStrokesChange, updateDrawingState]);

  const handleSelectionTransformMove = useCallback((event: PointerEvent) => {
    const transformState = selectionTransformRef.current;
    if (!transformState || transformState.pointerId !== event.pointerId) return;
    const point = getLocalPointFromPointerEvent(event);
    if (!point) return;

    const dx = point.x - transformState.startPoint.x;
    const dy = point.y - transformState.startPoint.y;
    const selectedIndexSet = new Set(transformState.selectedIndexes);
    const transformedStrokes = transformState.baselineStrokes.map((stroke, index) => (
      selectedIndexSet.has(index)
        ? transformStroke(
          stroke,
          { translateX: dx, translateY: dy, scaleX: 1, scaleY: 1, rotation: 0 },
          0,
          0
        )
        : stroke
    ));
    setStrokes(transformedStrokes);
    onStrokesChange?.(transformedStrokes);
    updateDrawingState({
      selectionBounds: {
        ...transformState.baselineBounds,
        x: transformState.baselineBounds.x + dx,
        y: transformState.baselineBounds.y + dy,
      },
    });
  }, [getLocalPointFromPointerEvent, onStrokesChange, updateDrawingState]);

  const handleSelectionTransformEnd = useCallback((event: PointerEvent) => {
    const transformState = selectionTransformRef.current;
    if (!transformState || transformState.pointerId !== event.pointerId) return;
    selectionTransformRef.current = null;
    window.removeEventListener('pointermove', handleSelectionTransformMove);
    window.removeEventListener('pointerup', handleSelectionTransformEnd);
  }, [handleSelectionTransformMove]);

  const handleSelectionTransformStart = useCallback((handle: string, event: React.PointerEvent) => {
    if (handle !== 'move') return;
    if (!drawingState.selectionBounds || selectedStrokeIndexes.length === 0) return;
    const point = getLocalPointFromPointerEvent(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    saveToUndo();
    selectionTransformRef.current = {
      pointerId: event.pointerId,
      startPoint: point,
      baselineBounds: drawingState.selectionBounds,
      baselineStrokes: strokes,
      selectedIndexes: selectedStrokeIndexes,
    };
    window.addEventListener('pointermove', handleSelectionTransformMove);
    window.addEventListener('pointerup', handleSelectionTransformEnd);
  }, [
    drawingState.selectionBounds,
    selectedStrokeIndexes,
    strokes,
    saveToUndo,
    getLocalPointFromPointerEvent,
    handleSelectionTransformMove,
    handleSelectionTransformEnd,
  ]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', handleSelectionTransformMove);
    window.removeEventListener('pointerup', handleSelectionTransformEnd);
  }, [handleSelectionTransformMove, handleSelectionTransformEnd]);

  useEffect(() => {
    if (activeTool !== 'select' || drawingState.selectionMode !== 'none') return;
    updateDrawingState({ selectionMode: 'rectangle' });
  }, [activeTool, drawingState.selectionMode, updateDrawingState]);

  useEffect(() => {
    if (isTransformIdentity(drawingState.transform)) return;
    if (!selectedStrokeIndexes.length || !drawingState.selectionBounds) {
      updateDrawingState({
        transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      });
      return;
    }

    const pivotX = drawingState.selectionBounds.x + drawingState.selectionBounds.width / 2;
    const pivotY = drawingState.selectionBounds.y + drawingState.selectionBounds.height / 2;
    const selectedIndexSet = new Set(selectedStrokeIndexes);
    const transformedStrokes = strokes.map((stroke, index) => (
      selectedIndexSet.has(index)
        ? transformStroke(stroke, drawingState.transform, pivotX, pivotY)
        : stroke
    ));
    const transformedSelected = selectedStrokeIndexes
      .map((index) => transformedStrokes[index])
      .filter(Boolean);
    const nextBounds = getStrokeBounds(transformedSelected) ?? drawingState.selectionBounds;
    setStrokes(transformedStrokes);
    onStrokesChange?.(transformedStrokes);
    updateDrawingState({
      selectionBounds: nextBounds,
      transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    });
  }, [
    drawingState.transform,
    drawingState.selectionBounds,
    selectedStrokeIndexes,
    strokes,
    onStrokesChange,
    updateDrawingState,
  ]);
  
  // Gesture action handler
  const handleGestureAction = useCallback((action: GestureAction, data?: GestureActionData) => {
    const isTransformAction =
      action === 'zoom-fit'
      || action === 'zoom-in'
      || action === 'rotate-canvas'
      || action === 'pan-canvas';
    if (isTransformAction && (pencilState.isDrawing || lastInputType === 'pen') && activeTool !== 'pan') {
      return;
    }

    switch (action) {
      case 'undo':
        undo();
        break;
      case 'redo':
        redo();
        break;
      case 'zoom-fit':
        setViewTransform({ scale: 1, rotation: 0, offsetX: 0, offsetY: 0 });
        break;
      case 'zoom-in':
        setViewTransform((prev) => {
          const requestedScale = data?.scale ? prev.scale * data.scale : prev.scale * 1.08;
          return {
            ...prev,
            scale: Math.min(4, Math.max(0.3, requestedScale)),
          };
        });
        break;
      case 'rotate-canvas':
        setViewTransform((prev) => ({
          ...prev,
          rotation: prev.rotation + (data?.angle ?? 2),
        }));
        break;
      case 'pan-canvas':
        setViewTransform((prev) => ({
          ...prev,
          offsetX: prev.offsetX + (data?.dx ?? 0),
          offsetY: prev.offsetY + (data?.dy ?? 0),
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
  }, [undo, redo, copySelection, pasteClipboard, cutSelection, pencilState.isDrawing, lastInputType, activeTool]);
  
  // Gesture handler hook
  useGestureHandler({
    element: containerRef.current,
    settings: gestureSettings,
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
  
  const saveCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const imageData = canvas.toDataURL('image/png');
    onSave?.(imageData);
  }, [onSave]);

  useImperativeHandle(ref, () => ({
    undo,
    redo,
    clear: clearCanvas,
    save: saveCanvas,
    setBrush: (settings: Partial<ProBrushSettings>) => {
      applyBrushSettings(settings);
    },
  }), [undo, redo, clearCanvas, saveCanvas, applyBrushSettings]);
  
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
  
  // Color presets
  const COLOR_PRESETS = [
    '#000000', '#FFFFFF', '#FF5252', '#FF9800', '#FFEB3B',
    '#4CAF50', '#2196F3', '#9C27B0', '#795548', '#607D8B',
  ];
  const QUICK_BRUSH_TYPES: ProBrushType[] = ['pen', 'marker', 'highlighter', 'eraser'];
  const EXTRA_BRUSH_TYPES: ProBrushType[] = PRO_BRUSH_TYPES.filter(
    (type) => !QUICK_BRUSH_TYPES.includes(type)
  );
  const toolbarCompact = width < 1400 || device.isIPad;
  const visibleSizePresets = toolbarCompact ? BRUSH_SIZE_PRESETS.slice(0, 4) : BRUSH_SIZE_PRESETS;
  
  // Calculate cursor size
  const cursorSize = brushSettings.size * (0.5 + (pencilState.currentPressure || 0.5));
  const cursorDisplaySize = sizePreview.active ? sizePreview.size : cursorSize;
  const cursorDisplayPosition = hoverPosition ?? (
    sizePreview.active
      ? { x: width / 2, y: height / 2 }
      : null
  );
  const cursorBorderColor = brushSettings.type === 'eraser'
    ? 'rgba(255,255,255,0.58)'
    : brushSettings.color;
  const cursorFillColor = brushSettings.type === 'watercolor'
    ? `${brushSettings.color}20`
    : 'transparent';
  const rulerDx = rulerGuide.x2 - rulerGuide.x1;
  const rulerDy = rulerGuide.y2 - rulerGuide.y1;
  const rulerLength = Math.max(1, Math.hypot(rulerDx, rulerDy));
  const rulerAngleRad = Math.atan2(rulerDy, rulerDx);
  const inputLabel = pencilState.isPencilConnected
    ? 'Apple Pencil'
    : lastInputType === 'touch' || (lastInputType === 'mouse' && device.hasTouchScreen)
      ? 'Touch'
      : 'Mouse';
  const exportFrames = useMemo<ExportFrame[]>(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return [];
    return [{ index: currentFrameIndex, canvas }];
  }, [currentFrameIndex, strokes.length, width, height]);
  const hasSelection = selectedStrokeIndexes.length > 0 && Boolean(drawingState.selectionBounds);
  
  return (
    <CanvasContainer ref={setCanvasContainerRef} sx={{ width, height }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${viewTransform.offsetX}px, ${viewTransform.offsetY}px) scale(${viewTransform.scale}) rotate(${viewTransform.rotation}deg)`,
          transformOrigin: 'center center',
          transition: 'transform 120ms ease-out',
        }}
      >
        {/* Reference image layer */}
        <ReferenceLayer
          ref={referenceCanvasRef}
          width={width}
          height={height}
          style={{ opacity: refOpacity }}
        />
        
        {/* Main canvas with completed strokes */}
        <CanvasLayer
          ref={mainCanvasRef}
          width={width}
          height={height}
          style={{ cursor: 'crosshair' }}
        />
        
        {/* Preview canvas for current stroke */}
        <CanvasLayer
          ref={previewCanvasRef}
          width={width}
          height={height}
          style={{ pointerEvents: 'none' }}
        />
        
        {/* Grid overlay */}
        <GridOverlay
          ref={gridCanvasRef}
          width={width}
          height={height}
        />
        
        {/* Onion skinning layer */}
        <CanvasLayer
          ref={onionCanvasRef}
          width={width}
          height={height}
          style={{ pointerEvents: 'none', opacity: 0.5 }}
        />
        
        {/* Symmetry guides layer */}
        <CanvasLayer
          ref={symmetryCanvasRef}
          width={width}
          height={height}
          style={{ pointerEvents: 'none' }}
        />

        {activeTool === 'select' && (
          <Box
            data-pencil-ignore="true"
            onPointerDown={handleSelectionOverlayPointerDown}
            onPointerMove={handleSelectionOverlayPointerMove}
            onPointerUp={handleSelectionOverlayPointerUp}
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              cursor: drawingState.selectionMode === 'lasso' ? 'cell' : 'crosshair',
              touchAction: 'none',
            }}
          >
            {selectionPreviewRect && (
              <Box
                sx={{
                  position: 'absolute',
                  left: selectionPreviewRect.x1,
                  top: selectionPreviewRect.y1,
                  width: Math.max(1, selectionPreviewRect.x2 - selectionPreviewRect.x1),
                  height: Math.max(1, selectionPreviewRect.y2 - selectionPreviewRect.y1),
                  border: '1px dashed rgba(56, 189, 248, 0.95)',
                  bgcolor: 'rgba(14, 165, 233, 0.12)',
                  boxShadow: 'inset 0 0 0 1px rgba(103,232,249,0.25)',
                  pointerEvents: 'none',
                }}
              />
            )}
            {selectionLassoPath && (
              <svg
                width={width}
                height={height}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
              >
                <path
                  d={selectionLassoPath}
                  fill="rgba(14, 165, 233, 0.12)"
                  stroke="rgba(56, 189, 248, 0.95)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                />
              </svg>
            )}
          </Box>
        )}

        {activeTool === 'select' && hasSelection && drawingState.selectionBounds && (
          <Box
            data-pencil-ignore="true"
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 6,
              pointerEvents: 'auto',
            }}
          >
            <SelectionBox
              bounds={drawingState.selectionBounds}
              onTransformStart={handleSelectionTransformStart}
              showRotate={false}
            />
          </Box>
        )}

        {rulerEnabled && (
          <Box
            data-pencil-ignore="true"
            sx={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 4,
            }}
          >
            <Box
              data-pencil-ignore="true"
              onPointerDown={startRulerDrag('line')}
              sx={{
                position: 'absolute',
                left: rulerGuide.x1,
                top: rulerGuide.y1,
                width: rulerLength,
                height: 6,
                transformOrigin: '0 50%',
                transform: `translateY(-50%) rotate(${rulerAngleRad}rad)`,
                pointerEvents: 'auto',
                cursor: 'grab',
                borderRadius: 999,
                border: '1px solid rgba(56, 189, 248, 0.95)',
                background: 'linear-gradient(90deg, rgba(8, 145, 178, 0.35), rgba(56, 189, 248, 0.5))',
                boxShadow: '0 0 14px rgba(56,189,248,0.35)',
                '&:active': {
                  cursor: 'grabbing',
                },
              }}
            />
            <Box
              data-pencil-ignore="true"
              onPointerDown={startRulerDrag('start')}
              sx={{
                position: 'absolute',
                left: rulerGuide.x1,
                top: rulerGuide.y1,
                width: 18,
                height: 18,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                pointerEvents: 'auto',
                cursor: 'grab',
                bgcolor: 'rgba(56, 189, 248, 0.95)',
                border: '2px solid rgba(12, 18, 36, 0.95)',
                boxShadow: '0 0 10px rgba(56,189,248,0.45)',
                '&:active': {
                  cursor: 'grabbing',
                },
              }}
            />
            <Box
              data-pencil-ignore="true"
              onPointerDown={startRulerDrag('end')}
              sx={{
                position: 'absolute',
                left: rulerGuide.x2,
                top: rulerGuide.y2,
                width: 18,
                height: 18,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
                pointerEvents: 'auto',
                cursor: 'grab',
                bgcolor: 'rgba(56, 189, 248, 0.95)',
                border: '2px solid rgba(12, 18, 36, 0.95)',
                boxShadow: '0 0 10px rgba(56,189,248,0.45)',
                '&:active': {
                  cursor: 'grabbing',
                },
              }}
            />
          </Box>
        )}
      </Box>
      
      {/* Pencil mode indicator */}
      {pencilState.isPencilConnected && (
        <Fade in={pencilState.isActive || pencilState.isHovering}>
          <PencilModeIndicator>
            <Create sx={{ fontSize: 14 }} />
            Apple Pencil
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

      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          px: 1.25,
          py: 0.5,
          borderRadius: 999,
          bgcolor: 'rgba(4, 12, 30, 0.7)',
          border: '1px solid rgba(34, 211, 238, 0.35)',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 1,
          pointerEvents: 'none',
          maxWidth: 'calc(100% - 20px)',
        }}
      >
        <Typography variant="caption" sx={{ color: '#67e8f9', fontWeight: 700 }}>
          {activeTool.toUpperCase()}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
          Flow {(activeBrushConfig.flow * 100).toFixed(0)}%
        </Typography>
        {symmetrySettings.type !== 'none' && (
          <Typography variant="caption" sx={{ color: '#c084fc' }}>
            Symmetry
          </Typography>
        )}
        {rulerEnabled && (
          <Typography variant="caption" sx={{ color: '#7dd3fc' }}>
            Ruler
          </Typography>
        )}
        {quickShapeEnabled && (
          <Typography variant="caption" sx={{ color: '#facc15' }}>
            QuickShape
          </Typography>
        )}
        {onionSkinSettings.enabled && (
          <Typography variant="caption" sx={{ color: '#fbbf24' }}>
            Onion
          </Typography>
        )}
      </Box>
      
      {/* Hover cursor */}
      {cursorDisplayPosition && (
        <HoverCursor
          sx={{
            left: cursorDisplayPosition.x,
            top: cursorDisplayPosition.y,
            width: cursorDisplaySize * 2,
            height: cursorDisplaySize * 2,
            border: `2px solid ${cursorBorderColor}`,
            backgroundColor: cursorFillColor,
            boxShadow: sizePreview.active && !hoverPosition ? '0 0 0 2px rgba(34, 211, 238, 0.25)' : 'none',
          }}
        />
      )}
      
      {/* Professional Toolbar */}
      {showToolbar && (
        <ProToolbar data-pencil-ignore="true" elevation={8} drawing={pencilState.isDrawing}>
          <Stack direction="row" alignItems="center" gap={1.1} sx={{ px: 0.75 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)', letterSpacing: 0.5 }}>
              TOOL
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={activeTool}
              onChange={(_, value: ActiveTool | null) => {
                if (!value) return;
                updateDrawingState({ activeTool: value });
              }}
            >
              <ToggleButton value="brush">
                <Tooltip title="Brush Tool"><BrushOutlined sx={{ fontSize: 16 }} /></Tooltip>
              </ToggleButton>
              <ToggleButton value="shape">
                <Tooltip title="Shape Tool"><Build sx={{ fontSize: 16 }} /></Tooltip>
              </ToggleButton>
              <ToggleButton value="select">
                <Tooltip title="Selection Tool"><Layers sx={{ fontSize: 16 }} /></Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ mx: 1.2, bgcolor: 'rgba(255,255,255,0.1)' }} />

          <Stack direction="row" alignItems="center" gap={0.9} sx={{ px: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)', letterSpacing: 0.5 }}>
              BRUSH
            </Typography>
            {QUICK_BRUSH_TYPES.map((type) => (
              <Tooltip key={type} title={type.charAt(0).toUpperCase() + type.slice(1)} placement="top">
                <BrushButton
                  selected={brushSettings.type === type}
                  brushColor={brushSettings.color}
                  onClick={() => setActiveBrushType(type)}
                >
                  <Box sx={{ color: brushSettings.type === type ? brushSettings.color : 'rgba(255,255,255,0.6)' }}>
                    {BrushIcons[type]}
                  </Box>
                </BrushButton>
              </Tooltip>
            ))}
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ mx: 1.2, bgcolor: 'rgba(255,255,255,0.1)' }} />

          <Stack direction="row" alignItems="center" gap={1} sx={{ px: 0.5 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)', letterSpacing: 0.5 }}>
              STYLE
            </Typography>
            <Tooltip title="Color" placement="top">
              <ColorButton
                color={brushSettings.color}
                onClick={(e) => setColorAnchor(e.currentTarget)}
              />
            </Tooltip>
            <Stack direction="row" alignItems="center" gap={0.85}>
              {visibleSizePresets.map((size) => (
                <Tooltip key={size} title={`${size}px`} placement="top">
                  <Box
                    onClick={() => setBrushSize(size, { snap: true, preview: true })}
                    sx={{
                      width: device.isIPad ? 40 : 32,
                      height: device.isIPad ? 40 : 32,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
                    }}
                  >
                    <SizeDot
                      dotSize={Math.min(size / 2 + 4, 16)}
                      selected={Math.abs(brushSettings.size - size) <= BRUSH_SIZE_SNAP_TOLERANCE}
                    />
                  </Box>
                </Tooltip>
              ))}
            </Stack>
            <Slider
              size="small"
              value={brushSettings.size}
              min={MIN_BRUSH_SIZE}
              max={MAX_BRUSH_SIZE}
              step={0.5}
              onChange={(_, value) => {
                if (Array.isArray(value)) return;
                setBrushSize(value, { snap: false, preview: true });
              }}
              onChangeCommitted={(_, value) => {
                if (Array.isArray(value)) return;
                setBrushSize(value, { snap: true, preview: true });
              }}
              sx={{
                width: toolbarCompact ? 94 : 122,
                mx: 0.2,
                color: brushSettings.color,
                '& .MuiSlider-thumb': { width: 14, height: 14 },
              }}
            />
            <Tooltip title="Brush Controls" placement="top">
              <IconButton
                size="small"
                onPointerDown={handleSizeControlPointerDown}
                onClick={(e) => {
                  if (e.detail === 0) {
                    setSizeAnchor(e.currentTarget);
                  }
                }}
              >
                <Stack direction="row" spacing={0.25} alignItems="center">
                  <BrushOutlined sx={{ fontSize: 16 }} />
                  <Opacity sx={{ fontSize: 14 }} />
                </Stack>
              </IconButton>
            </Tooltip>
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ mx: 1.2, bgcolor: 'rgba(255,255,255,0.1)' }} />

          <Stack direction="row" alignItems="center" gap={0.85} sx={{ px: 0.5 }}>
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
            <Tooltip title="Clear Canvas" placement="top">
              <IconButton size="small" onClick={clearCanvas}>
                <Delete sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            {onSave && (
              <Tooltip title="Save" placement="top">
                <IconButton size="small" onClick={saveCanvas}>
                  <Save sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          <Divider orientation="vertical" flexItem sx={{ mx: 1.2, bgcolor: 'rgba(255,255,255,0.1)' }} />

          <Tooltip title="Avansert" placement="top">
            <IconButton size="small" onClick={(e) => setAdvancedAnchor(e.currentTarget)}>
              <Build sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          <Popover
            open={Boolean(advancedAnchor)}
            anchorEl={advancedAnchor}
            onClose={() => setAdvancedAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.98)', backdropFilter: 'blur(8px)', width: toolbarCompact ? 280 : 340 } } }}
          >
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.92)', mb: 1 }}>
                Avanserte kontroller
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                Ekstra brush-typer
              </Typography>
              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75, mb: 1.5 }}>
                {EXTRA_BRUSH_TYPES.map((type) => (
                  <Tooltip key={type} title={type.charAt(0).toUpperCase() + type.slice(1)} placement="top">
                    <BrushButton
                      selected={brushSettings.type === type}
                      brushColor={brushSettings.color}
                      onClick={() => setActiveBrushType(type)}
                    >
                      <Box sx={{ color: brushSettings.type === type ? brushSettings.color : 'rgba(255,255,255,0.6)' }}>
                        {BrushIcons[type]}
                      </Box>
                    </BrushButton>
                  </Tooltip>
                ))}
              </Stack>

              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                Hjelpeverktøy
              </Typography>
              <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75} sx={{ mt: 0.75 }}>
                <ToggleButton
                  size="small"
                  value="grid"
                  selected={showGrid}
                  onChange={() => setShowGrid((prev) => !prev)}
                >
                  <GridOn sx={{ fontSize: 16, mr: 0.5 }} /> Grid
                </ToggleButton>
                <ToggleButton
                  size="small"
                  value="ruler"
                  selected={rulerEnabled}
                  onChange={() => setRulerEnabled((prev) => !prev)}
                >
                  <Straighten sx={{ fontSize: 16, mr: 0.5 }} /> Linjal
                </ToggleButton>
                <ToggleButton
                  size="small"
                  value="quickshape"
                  selected={quickShapeEnabled}
                  onChange={() => setQuickShapeEnabled((prev) => !prev)}
                >
                  <AutoFixHigh sx={{ fontSize: 16, mr: 0.5 }} /> QuickShape
                </ToggleButton>
                {rulerEnabled && (
                  <Tooltip title="Reset Linjal" placement="top">
                    <IconButton size="small" onClick={resetRulerGuide}>
                      <RestartAlt sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>

              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
                <Stack direction="row" alignItems="center" gap={0.75}>
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
                  {showDrawingToolsPanel && (
                    <Tooltip title="Drawing Tools Sidepanel" placement="top">
                      <IconButton
                        size="small"
                        onClick={handleToolsPanelToggle}
                        sx={{ color: !toolsPanelCollapsed ? 'primary.main' : 'inherit' }}
                      >
                        <Layers sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  {pencilState.isPencilConnected
                    ? <Create sx={{ fontSize: 14, color: '#22c55e' }} />
                    : <TouchApp sx={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }} />}
                  <Typography variant="caption" sx={{ color: pencilState.isPencilConnected ? '#22c55e' : 'rgba(255,255,255,0.6)' }}>
                    {inputLabel}{device.isIPad ? ' • iPad' : ''}
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          </Popover>

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
                    applyBrushSettings({ color });
                    setColorAnchor(null);
                  }}
                />
              ))}
            </Box>
          </Popover>

          <Popover
            open={Boolean(sizeAnchor)}
            anchorEl={sizeAnchor}
            onClose={() => setSizeAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            slotProps={{ paper: { sx: { bgcolor: 'rgba(30,30,40,0.95)', backdropFilter: 'blur(8px)', width: 240 } } }}
          >
            <Box sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  Brush size
                </Typography>
                <TextField
                  value={brushSizeInput}
                  size="small"
                  type="number"
                  inputProps={{
                    min: MIN_BRUSH_SIZE,
                    max: MAX_BRUSH_SIZE,
                    step: 0.5,
                    inputMode: 'decimal',
                  }}
                  onChange={(event) => setBrushSizeInput(event.target.value)}
                  onBlur={commitBrushSizeInput}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitBrushSizeInput();
                    }
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setBrushSizeInput(formatBrushSize(brushSettings.size));
                    }
                  }}
                  sx={{
                    width: 84,
                    '& .MuiInputBase-root': {
                      height: 30,
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.9)',
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255,255,255,0.22)',
                    },
                  }}
                />
              </Stack>
              <Slider
                value={brushSettings.size}
                min={MIN_BRUSH_SIZE}
                max={MAX_BRUSH_SIZE}
                step={0.5}
                marks={BRUSH_SIZE_PRESETS.map((value) => ({ value }))}
                onChange={(_, value) => {
                  if (Array.isArray(value)) return;
                  setBrushSize(value, { snap: false, preview: true });
                }}
                onChangeCommitted={(_, value) => {
                  if (Array.isArray(value)) return;
                  setBrushSize(value, { snap: true, preview: true });
                }}
              />
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.5, mb: 0.6 }}>
                {BRUSH_SIZE_PRESETS.map((preset) => (
                  <Box
                    key={preset}
                    onClick={() => setBrushSize(preset, { snap: true, preview: true })}
                    sx={{
                      px: 1,
                      py: 0.4,
                      borderRadius: 999,
                      fontSize: 11,
                      lineHeight: 1,
                      border: Math.abs(brushSettings.size - preset) <= BRUSH_SIZE_SNAP_TOLERANCE
                        ? '1px solid rgba(34, 211, 238, 0.65)'
                        : '1px solid rgba(255,255,255,0.15)',
                      color: Math.abs(brushSettings.size - preset) <= BRUSH_SIZE_SNAP_TOLERANCE
                        ? '#67e8f9'
                        : 'rgba(255,255,255,0.68)',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: 'rgba(34, 211, 238, 0.65)',
                        color: '#67e8f9',
                      },
                    }}
                  >
                    {preset}px
                  </Box>
                ))}
              </Stack>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)' }}>
                Live: {formatBrushSize(brushSettings.size)}px
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1, display: 'block' }}>
                Opacity {(brushSettings.opacity * 100).toFixed(0)}%
              </Typography>
              <Slider
                value={brushSettings.opacity}
                min={0.05}
                max={1}
                step={0.05}
                onChange={(_, value) => applyBrushSettings({ opacity: Number(value) })}
              />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mt: 1, display: 'block' }}>
                Flow {(brushSettings.flow * 100).toFixed(0)}%
              </Typography>
              <Slider
                value={brushSettings.flow}
                min={0.1}
                max={1}
                step={0.05}
                onChange={(_, value) => applyBrushSettings({ flow: Number(value) })}
              />
              <ToggleButtonGroup
                color="primary"
                exclusive
                fullWidth
                size="small"
                value={brushSettings.hardness > 0.75 ? 'hard' : brushSettings.hardness < 0.35 ? 'soft' : 'balanced'}
                onChange={(_, value: 'soft' | 'balanced' | 'hard' | null) => {
                  if (!value) return;
                  const hardnessMap = { soft: 0.2, balanced: 0.5, hard: 0.9 } as const;
                  applyBrushSettings({ hardness: hardnessMap[value] });
                }}
                sx={{ mt: 1 }}
              >
                <ToggleButton value="soft">Soft</ToggleButton>
                <ToggleButton value="balanced">Balanced</ToggleButton>
                <ToggleButton value="hard">Hard</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Popover>

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
        </ProToolbar>
      )}
      
      {/* Drawing Tools Panel */}
      {showDrawingToolsPanel && (
        <DrawingToolsPanel
          canvas={mainCanvasRef.current}
          state={{ ...drawingState, brushConfig: brushSettings }}
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
            const sourceIndex = drawingState.layers.findIndex((layer) => layer.id === id);
            if (sourceIndex <= 0) return;
            const targetIndex = sourceIndex - 1;
            const sourceLayer = drawingState.layers[sourceIndex];
            const targetLayer = drawingState.layers[targetIndex];
            const mergedLayers = drawingState.layers.map((layer, index) => {
              if (index === targetIndex) {
                return {
                  ...targetLayer,
                  strokes: [...targetLayer.strokes, ...sourceLayer.strokes],
                };
              }
              return layer;
            }).filter((layer) => layer.id !== id);
            updateDrawingState({
              layers: mergedLayers,
              activeLayerId: targetLayer.id,
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
          getFrameImage={getFrameImage || (() => null)}
          exportFrames={exportFrames}
          selectedFrameIndices={[currentFrameIndex]}
          onColorPick={(color) => {
            applyBrushSettings({ color });
          }}
          onExport={handleExport}
          onGestureAction={handleGestureAction}
          onUndo={undo}
          onRedo={redo}
          onCopy={copySelection}
          onPaste={pasteClipboard}
          onCut={cutSelection}
          onDelete={deleteSelection}
          position={drawingToolsPanelPosition}
          collapsed={toolsPanelCollapsed}
          onCollapsedChange={handleToolsPanelCollapsedChange}
          panelWidth={resolvedDrawingToolsPanelWidth}
          collapsedWidth={drawingToolsPanelCollapsedWidth}
        />
      )}
    </CanvasContainer>
  );
});

PencilCanvasPro.displayName = 'PencilCanvasPro';

export default PencilCanvasPro;
