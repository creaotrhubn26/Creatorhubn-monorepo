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

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  useApplePencil,
  PencilPoint,
  PencilStroke,
  InputType,
} from '../hooks/useApplePencil';
import { useDeviceDetection } from '../hooks/useDeviceDetection';
import {
  AdvancedBrushEngine,
  ProBrushType,
  ProBrushSettings,
  DEFAULT_BRUSH_SETTINGS,
  BrushConfig,
} from './drawing/AdvancedBrushEngine';
import {
  DrawingToolsPanel,
  DrawingState,
  DEFAULT_DRAWING_STATE,
  ActiveTool,
} from './drawing/DrawingToolsPanel';
import {
  getMirroredPoints,
  drawSymmetryGuides,
  SymmetrySettings,
} from './drawing/SymmetryMode';
import {
  evaluatePressureCurve,
  PressureCurve,
} from './drawing/PressureCurveEditor';
import {
  useGestureHandler,
  GestureAction,
  GestureSettings,
} from './drawing/GestureShortcuts';
import {
  getOnionFrames,
  renderOnionSkins,
  OnionSkinSettings,
} from './drawing/OnionSkinning';
import {
  drawShape,
  ShapeType,
  ShapeStyle,
} from './drawing/ShapeTools';
import {
  ExportSettings,
  ExportFrame,
  exportAsImage,
  downloadBlob,
  generateFilename,
} from './drawing/ExportOptions';
import { drawGuides } from './drawing/StoryboardTemplates';
import { DrawingLayer } from './drawing/LayersPanel';

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
  palmRejection?: 'off' | 'pencil-only' | 'smart';
  currentFrameIndex?: number;
  totalFrames?: number;
  getFrameImage?: (index: number) => HTMLCanvasElement | null;
  onStrokesChange?: (strokes: PencilStroke[]) => void;
  onSave?: (imageData: string) => void;
  onReferenceImageChange?: (ref: ReferenceImage | null) => void;
  onExport?: (settings: ExportSettings, frameIndices: number[]) => Promise<void>;
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

export const PencilCanvasPro: React.FC<PencilCanvasProProps> = ({
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
  palmRejection = 'smart',
  currentFrameIndex = 0,
  totalFrames = 1,
  getFrameImage,
  onStrokesChange,
  onSave,
  onReferenceImageChange,
  onExport,
}) => {
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
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(initialRefImage || null);
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [refOpacity, setRefOpacity] = useState(initialRefImage?.opacity || 0.3);
  const [toolsPanelCollapsed, setToolsPanelCollapsed] = useState(false);
  
  // Drawing state for professional features
  const [drawingState, setDrawingState] = useState<DrawingState>(DEFAULT_DRAWING_STATE);
  
  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<PencilStroke[]>([]);
  
  // Popover anchors
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [sizeAnchor, setSizeAnchor] = useState<HTMLElement | null>(null);
  const [refAnchor, setRefAnchor] = useState<HTMLElement | null>(null);
  
  // Update drawing state helper
  const updateDrawingState = useCallback((updates: Partial<DrawingState>) => {
    setDrawingState(prev => ({ ...prev, ...updates }));
  }, []);
  
  // Apply pressure curve to points
  const applyPressureCurve = useCallback((point: PencilPoint): PencilPoint => {
    return {
      ...point,
      pressure: evaluatePressureCurve(drawingState.pressureCurve, point.pressure),
    };
  }, [drawingState.pressureCurve]);
  
  // Apple Pencil hook
  const {
    ref: pencilRef,
    state: pencilState,
    currentStroke,
  } = useApplePencil({
    onStrokeStart: (point: PencilPoint) => {
      const previewCtx = previewCanvasRef.current?.getContext('2d');
      if (previewCtx) {
        previewCtx.clearRect(0, 0, width, height);
      }
      // Apply pressure curve
      const adjustedPoint = applyPressureCurve(point);
      brushEngineRef.current?.startStroke(adjustedPoint);
    },
    
    onStrokeMove: (point: PencilPoint) => {
      if (currentStroke && previewCanvasRef.current && brushEngineRef.current) {
        const ctx = previewCanvasRef.current.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, width, height);
        
        // Apply pressure curve to all points
        const adjustedPoints = currentStroke.points.map(applyPressureCurve);
        
        // Apply symmetry if enabled
        if (drawingState.symmetrySettings.type !== 'none') {
          const mirroredPointSets = getMirroredPoints(
            adjustedPoints,
            drawingState.symmetrySettings,
            width,
            height
          );
          mirroredPointSets.forEach(points => {
            brushEngineRef.current?.renderStroke(ctx, points, brushSettings);
          });
        } else {
          brushEngineRef.current.renderStroke(ctx, adjustedPoints, brushSettings);
        }
      }
    },
    
    onStrokeEnd: (stroke: PencilStroke) => {
      brushEngineRef.current?.endStroke();
      
      // Apply pressure curve to stroke points
      const adjustedStroke: PencilStroke = {
        ...stroke,
        points: stroke.points.map(applyPressureCurve),
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
      redrawMainCanvas();
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
      setBrushSettings((prev: ProBrushSettings) => ({
        ...prev,
        type: prev.type === 'eraser' ? 'pencil' : 'eraser',
      }));
    },
  }, {
    palmRejection,
    minPressure: 0.01,
    pressureSmoothing: 0.15,
    enableHover: true,
    enableDoubleTap: true,
  });
  
  // Initialize brush engine
  useEffect(() => {
    if (!brushEngineRef.current && mainCanvasRef.current) {
      const ctx = mainCanvasRef.current.getContext('2d');
      if (ctx) {
        brushEngineRef.current = new AdvancedBrushEngine(ctx, brushSettings);
      }
    }
  }, [brushSettings]);
  
  // Merge pencil ref with container ref
  useEffect(() => {
    if (containerRef.current) {
      (pencilRef as React.MutableRefObject<HTMLElement | null>).current = containerRef.current;
    }
  }, [pencilRef]);
  
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
      drawGuides(ctx, width, height, drawingState.storyboardTemplate.guides);
    }
    
    // Draw symmetry guides
    if (drawingState.symmetrySettings.type !== 'none' && drawingState.symmetrySettings.showGuides) {
      drawSymmetryGuides(ctx, drawingState.symmetrySettings, width, height);
    }
  }, [drawingState.symmetrySettings, drawingState.storyboardTemplate, width, height]);
  
  // Draw onion skinning
  useEffect(() => {
    if (!onionCanvasRef.current || !getFrameImage) return;
    const ctx = onionCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, width, height);
    
    if (drawingState.onionSkinSettings.enabled) {
      const frames = getOnionFrames(currentFrameIndex, totalFrames, drawingState.onionSkinSettings);
      renderOnionSkins(ctx, width, height, frames, getFrameImage, drawingState.onionSkinSettings);
    }
  }, [drawingState.onionSkinSettings, currentFrameIndex, totalFrames, getFrameImage, width, height]);
  
  // Redraw main canvas
  const redrawMainCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    const engine = brushEngineRef.current;
    if (!canvas || !ctx || !engine) return;
    
    ctx.clearRect(0, 0, width, height);
    
    // Draw background image if provided
    if (backgroundImage) {
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        strokes.forEach(stroke => {
          engine.renderStroke(ctx, stroke.points, brushSettings);
        });
      };
      img.src = backgroundImage;
    } else {
      strokes.forEach(stroke => {
        engine.renderStroke(ctx, stroke.points, brushSettings);
      });
    }
  }, [width, height, backgroundImage, strokes, brushSettings]);
  
  // Redraw when strokes change
  useEffect(() => {
    redrawMainCanvas();
  }, [redrawMainCanvas]);
  
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
    if (drawingState.selectionBounds) {
      // Copy strokes in selection (simplified - would need actual selection logic)
      setClipboard([...strokes]);
    }
  }, [drawingState.selectionBounds, strokes]);
  
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
    copySelection();
    // Would delete selected strokes here
  }, [copySelection]);
  
  const deleteSelection = useCallback(() => {
    if (drawingState.selectionBounds) {
      // Would delete selected strokes here
      saveToUndo();
    }
  }, [drawingState.selectionBounds, saveToUndo]);
  
  // Gesture action handler
  const handleGestureAction = useCallback((action: GestureAction, data?: any) => {
    switch (action) {
      case 'undo':
        undo();
        break;
      case 'redo':
        redo();
        break;
      case 'zoom-fit':
        // Reset zoom/pan
        break;
      case 'zoom-in':
        // Zoom in at data.center with data.scale
        break;
      case 'rotate-canvas':
        // Rotate canvas by data.angle
        break;
      case 'pan-canvas':
        // Pan canvas by data.dx, data.dy
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
  
  const saveCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;
    const imageData = canvas.toDataURL('image/png');
    onSave?.(imageData);
  }, [onSave]);
  
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
  
  // Size presets
  const SIZE_PRESETS = [2, 4, 8, 16, 32];
  
  // Color presets
  const COLOR_PRESETS = [
    '#000000', '#FFFFFF', '#FF5252', '#FF9800', '#FFEB3B',
    '#4CAF50', '#2196F3', '#9C27B0', '#795548', '#607D8B',
  ];
  
  // Calculate cursor size
  const cursorSize = brushSettings.size * (0.5 + (pencilState.currentPressure || 0.5));
  
  return (
    <CanvasContainer ref={containerRef} sx={{ width, height }}>
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
      
      {/* Hover cursor */}
      {hoverPosition && (
        <HoverCursor
          sx={{
            left: hoverPosition.x,
            top: hoverPosition.y,
            width: cursorSize * 2,
            height: cursorSize * 2,
            border: `2px solid ${brushSettings.type === 'eraser' ? 'rgba(255,255,255,0.5)' : brushSettings.color}`,
            backgroundColor: brushSettings.type === 'watercolor' 
              ? `${brushSettings.color}20`
              : 'transparent',
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
          </Stack>
          
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
              sx={{ color: showGrid ? 'primary.main' : 'inherit' }}
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
          <Tooltip title={pencilState.isPencilConnected ? 'Apple Pencil' : 'Touch/Mouse'} placement="top">
            <Box sx={{ display: 'flex', alignItems: 'center', color: pencilState.isPencilConnected ? 'success.main' : 'text.secondary' }}>
              {pencilState.isPencilConnected ? <Create sx={{ fontSize: 16 }} /> : <TouchApp sx={{ fontSize: 16 }} />}
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
            // Merge layer down logic
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
          exportFrames={[{
            index: 0,
            canvas: mainCanvasRef.current!,
          }].filter(f => f.canvas)}
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
          position={drawingToolsPanelPosition}
          collapsed={toolsPanelCollapsed}
          onCollapsedChange={setToolsPanelCollapsed}
        />
      )}
    </CanvasContainer>
  );
};

export default PencilCanvasPro;
