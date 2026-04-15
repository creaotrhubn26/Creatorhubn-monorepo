// @ts-nocheck
/**
 * PencilCanvas - Apple Pencil optimized drawing canvas
 * 
 * Features:
 * - Pressure-sensitive stroke width
 * - Tilt-aware brush effects
 * - Palm rejection (only pencil when drawing)
 * - Pencil hover preview (Pencil 2)
 * - Double-tap tool switch (Pencil 2)
 * - Multiple brush types (pen, marker, brush, highlighter)
 * - Real-time stroke preview
 */

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle } from 'react';
import {
  Box,
  IconButton,
  Stack,
  Tooltip,
  Slider,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Popover,
  Fade,
} from '@mui/material';
import {
  Edit,
  Brush,
  Create,
  Highlight,
  FormatColorFill,
  Undo,
  Redo,
  Delete,
  Save,
  ColorLens,
  LineWeight,
  TouchApp,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import {
  useApplePencil,
  drawPressureStroke,
  drawTiltStroke,
  type PencilPoint,
  type PencilStroke,
  type InputType,
} from '../hooks/useApplePencil';
import { useDeviceDetection } from '../hooks/useDeviceDetection';

// =============================================================================
// Types
// =============================================================================

export type BrushType = 'pen' | 'marker' | 'brush' | 'highlighter' | 'eraser';

export interface BrushSettings {
  type: BrushType;
  size: number;
  color: string;
  opacity: number;
}

export interface PencilCanvasProps {
  width: number;
  height: number;
  backgroundImage?: string;
  initialStrokes?: PencilStroke[];
  brushSettings?: Partial<BrushSettings>;
  showToolbar?: boolean;
  showPressureIndicator?: boolean;
  palmRejection?: 'off' | 'pencil-only' | 'smart';
  onStrokesChange?: (strokes: PencilStroke[]) => void;
  onSave?: (imageData: string) => void;
}

export interface PencilCanvasHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  save: () => void;
  setBrush: (settings: Partial<BrushSettings>) => void;
}

// =============================================================================
// Styled Components
// =============================================================================

const CanvasContainer = styled(Box)({
  position: 'relative',
  backgroundColor: '#1a1a2e',
  borderRadius: 8,
  overflow: 'hidden',
});

const DrawingCanvas = styled('canvas')({
  position: 'absolute',
  top: 0,
  left: 0,
  touchAction: 'none', // Required for pointer events
  cursor: 'crosshair',
});

const PreviewCanvas = styled('canvas')({
  position: 'absolute',
  top: 0,
  left: 0,
  pointerEvents: 'none', // Don't capture events
});

const Toolbar = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'drawing',
})<{ drawing?: boolean }>(({ drawing = false }) => ({
  position: 'absolute',
  bottom: 16,
  left: '50%',
  transform: 'translate3d(-50%, 0, 0)',
  padding: '8px 16px',
  borderRadius: 24,
  backgroundColor: drawing ? 'rgba(18, 20, 36, 0.995)' : 'rgba(26, 26, 46, 0.97)',
  backdropFilter: drawing ? 'none' : 'blur(6px)',
  WebkitBackdropFilter: drawing ? 'none' : 'blur(6px)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  boxShadow: drawing
    ? '0 12px 30px rgba(0,0,0,0.48)'
    : '0 10px 26px rgba(0,0,0,0.4)',
  willChange: 'transform',
  contain: 'layout paint',
  isolation: 'isolate',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
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

const HoverCursor = styled(Box)({
  position: 'absolute',
  pointerEvents: 'none',
  transform: 'translate(-50%, -50%)',
  borderRadius: '50%',
  border: '2px solid rgba(255, 255, 255, 0.5)',
  transition: 'width 0.1s, height 0.1s',
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

const ColorSwatch = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ selected }) => ({
  width: 24,
  height: 24,
  borderRadius: '50%',
  cursor: 'pointer',
  border: selected ? '3px solid white' : '2px solid rgba(255,255,255,0.3)',
  transition: 'transform 0.2s, border 0.2s','&:hover': {
    transform: 'scale(1.15)',
  },
}));

// =============================================================================
// Constants
// =============================================================================

const COLORS = [
  '#000000','#FFFFFF','#FF5252','#FF9800','#FFEB3B','#4CAF50','#2196F3','#9C27B0','#795548', '#607D8B',
];

const DEFAULT_BRUSH: BrushSettings = {
  type: 'pen',
  size: 4,
  color: '#FFFFFF',
  opacity: 1,
};

// =============================================================================
// Component
// =============================================================================

export const PencilCanvas = React.forwardRef<PencilCanvasHandle, PencilCanvasProps>(({
  width,
  height,
  backgroundImage,
  initialStrokes = [],
  brushSettings: initialBrushSettings,
  showToolbar = true,
  showPressureIndicator = true,
  palmRejection = 'smart',
  onStrokesChange,
  onSave,
}, ref) => {
  // Device detection
  const device = useDeviceDetection();
  
  // Canvas refs
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const previewLastPointRef = useRef<PencilPoint | null>(null);
  
  // State
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    ...DEFAULT_BRUSH,
    ...initialBrushSettings,
  });
  const [strokes, setStrokes] = useState<PencilStroke[]>(initialStrokes);
  const [undoStack, setUndoStack] = useState<PencilStroke[][]>([]);
  const [redoStack, setRedoStack] = useState<PencilStroke[][]>([]);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [lastInputType, setLastInputType] = useState<InputType>('mouse');
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [sizeAnchor, setSizeAnchor] = useState<HTMLElement | null>(null);
  
  // Apple Pencil hook
  const {
    ref: pencilRef,
    state: pencilState,
    getStrokeWidth,
    getOpacity,
  } = useApplePencil({
    onStrokeStart: (point: PencilPoint, inputType: InputType) => {
      setLastInputType((prev) => (prev === inputType ? prev : inputType));
      // Clear preview canvas
      const previewCtx = previewCanvasRef.current?.getContext('2d');
      if (previewCtx) {
        previewCtx.clearRect(0, 0, width, height);
      }
      previewLastPointRef.current = point;
    },
    
    onStrokeMove: (point: PencilPoint, inputType: InputType) => {
      setLastInputType((prev) => (prev === inputType ? prev : inputType));
      if (!previewCanvasRef.current) return;
      const ctx = previewCanvasRef.current.getContext('2d');
      if (!ctx) return;

      const previousPoint = previewLastPointRef.current;
      if (!previousPoint) {
        previewLastPointRef.current = point;
        return;
      }

      drawStrokeToCanvas(ctx, [previousPoint, point], brushSettings);
      previewLastPointRef.current = point;
    },
    
    onStrokeEnd: (stroke: PencilStroke, inputType: InputType) => {
      setLastInputType((prev) => (prev === inputType ? prev : inputType));
      previewLastPointRef.current = null;
      // Handle eraser
      if (brushSettings.type === 'eraser') {
        // Erase strokes that intersect with this stroke
        const newStrokes = strokes.filter(s => !strokesIntersect(s, stroke));
        saveToUndo();
        setStrokes(newStrokes);
        onStrokesChange?.(newStrokes);
      } else {
        // Add completed stroke
        saveToUndo();
        const newStrokes = [...strokes, stroke];
        setStrokes(newStrokes);
        onStrokesChange?.(newStrokes);
      }
      
      // Clear preview and redraw main canvas
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
      // Toggle between pen and eraser on double-tap
      setBrushSettings(prev => ({
        ...prev,
        type: prev.type === 'eraser' ? 'pen' : 'eraser',
      }));
    },
  }, {
    palmRejection,
    minPressure: 0.01,
    pressureSmoothing: 0.2,
    enableHover: true,
    enableDoubleTap: true,
  });

  const setCanvasContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    pencilRef.current = node;
  }, [pencilRef]);

  useEffect(() => {
    if (!initialBrushSettings) return;
    setBrushSettings((prev) => ({ ...prev, ...initialBrushSettings }));
  }, [
    initialBrushSettings?.type,
    initialBrushSettings?.size,
    initialBrushSettings?.color,
    initialBrushSettings?.opacity,
  ]);
  
  // Draw stroke to canvas
  const drawStrokeToCanvas = useCallback((
    ctx: CanvasRenderingContext2D,
    points: PencilPoint[],
    settings: BrushSettings
  ) => {
    if (points.length < 2) return;
    
    switch (settings.type) {
      case 'pen':
        drawPressureStroke(ctx, points, {
          baseWidth: settings.size,
          color: settings.color,
          opacity: settings.opacity,
          lineCap: 'round',
        });
        break;
        
      case 'marker':
        drawTiltStroke(ctx, points, {
          baseWidth: settings.size * 3,
          baseHeight: settings.size,
          color: settings.color,
          opacity: settings.opacity * 0.8,
        });
        break;
        
      case 'brush':
        // Soft brush with pressure-based opacity
        drawPressureStroke(ctx, points, {
          baseWidth: settings.size * 2,
          color: settings.color,
          opacity: settings.opacity * 0.5,
          lineCap: 'round',
        });
        break;
        
      case 'highlighter':
        ctx.globalCompositeOperation = 'multiply';
        drawPressureStroke(ctx, points, {
          baseWidth: settings.size * 4,
          color: settings.color,
          opacity: 0.3,
          lineCap: 'butt',
        });
        ctx.globalCompositeOperation = 'source-over';
        break;
        
      case 'eraser':
        ctx.globalCompositeOperation = 'destination-out';
        drawPressureStroke(ctx, points, {
          baseWidth: settings.size * 3,
          color: '#000000',
          opacity: 1,
          lineCap: 'round',
        });
        ctx.globalCompositeOperation = 'source-over';
        break;
    }
  }, []);
  
  // Redraw main canvas
  const redrawMainCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Draw background image if provided
    if (backgroundImage) {
      const img = new Image();
      img.src = backgroundImage;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        // Draw strokes on top
        strokes.forEach(stroke => {
          drawStrokeToCanvas(ctx, stroke.points, brushSettings);
        });
      };
    } else {
      // Just draw strokes
      strokes.forEach(stroke => {
        drawStrokeToCanvas(ctx, stroke.points, brushSettings);
      });
    }
  }, [width, height, backgroundImage, strokes, brushSettings, drawStrokeToCanvas]);
  
  // Redraw when strokes change
  useEffect(() => {
    redrawMainCanvas();
  }, [redrawMainCanvas]);
  
  // Check if two strokes intersect (for eraser)
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
    setRedoStack([]); // Clear redo on new action
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
  
  // Clear canvas
  const clearCanvas = useCallback(() => {
    saveToUndo();
    setStrokes([]);
    onStrokesChange?.([]);
    redrawMainCanvas();
  }, [saveToUndo, onStrokesChange, redrawMainCanvas]);
  
  // Save canvas
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
    setBrush: (settings: Partial<BrushSettings>) => {
      setBrushSettings((prev) => ({ ...prev, ...settings }));
    },
  }), [undo, redo, clearCanvas, saveCanvas]);
  
  // Calculate dynamic cursor size
  const activePressure = pencilState.currentPressure || 0.5;
  const dynamicStrokeWidth = getStrokeWidth(activePressure, brushSettings.size);
  const dynamicOpacity = getOpacity(activePressure, brushSettings.opacity);
  const cursorSize = dynamicStrokeWidth;
  const inputLabel = pencilState.isPencilConnected
    ? 'Apple Pencil'
    : lastInputType === 'touch' || (lastInputType === 'mouse' && device.hasTouchScreen)
      ? 'Touch'
      : 'Mouse';
  
  return (
    <CanvasContainer
      ref={setCanvasContainerRef}
      sx={{ width, height }}
    >
      {/* Main canvas with completed strokes */}
      <DrawingCanvas
        ref={mainCanvasRef}
        width={width}
        height={height}
      />
      
      {/* Preview canvas for current stroke */}
      <PreviewCanvas
        ref={previewCanvasRef}
        width={width}
        height={height}
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
          <Stack spacing={0.25}>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              Pressure: {(pencilState.currentPressure * 100).toFixed(0)}%
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
              Width {dynamicStrokeWidth.toFixed(1)}px • Opacity {(dynamicOpacity * 100).toFixed(0)}%
            </Typography>
          </Stack>
          <Box
            sx={{
              mt: 0.5,
              height: 4,
              borderRadius: 2,
              bgcolor: 'rgba(255,255,255,0.2)',
              overflow: 'hidden'}}
          >
            <Box
              sx={{
                height: '100%',
                width: `${pencilState.currentPressure * 100}%`,
                bgcolor: 'primary.main',
                transition: 'width 0.1s'}}
            />
          </Box>
        </PressureIndicator>
      )}
      
      {/* Hover cursor (Pencil 2) */}
      {hoverPosition && (
        <HoverCursor
          sx={{
            left: hoverPosition.x,
            top: hoverPosition.y,
            width: cursorSize * 2,
            height: cursorSize * 2,
            borderColor: brushSettings.type === 'eraser'
              ? 'rgba(255, 255, 255, 0.5)'
              : brushSettings.color}}
        />
      )}
      
      {/* Toolbar */}
      {showToolbar && (
        <Toolbar data-pencil-ignore="true" drawing={pencilState.isDrawing}>
          {/* Brush type selection */}
          <ToggleButtonGroup
            value={brushSettings.type}
            exclusive
            size="small"
            onChange={(_, value) => value && setBrushSettings(prev => ({ ...prev, type: value }))}
          >
            <ToggleButton value="pen">
              <Tooltip title="Pen"><Create sx={{ fontSize: 18 }} /></Tooltip>
            </ToggleButton>
            <ToggleButton value="marker">
              <Tooltip title="Marker"><Edit sx={{ fontSize: 18 }} /></Tooltip>
            </ToggleButton>
            <ToggleButton value="brush">
              <Tooltip title="Brush"><Brush sx={{ fontSize: 18 }} /></Tooltip>
            </ToggleButton>
            <ToggleButton value="highlighter">
              <Tooltip title="Highlighter"><Highlight sx={{ fontSize: 18 }} /></Tooltip>
            </ToggleButton>
            <ToggleButton value="eraser">
              <Tooltip title="Eraser"><FormatColorFill sx={{ fontSize: 18 }} /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          
          <Box sx={{ width: 1, height: 24, bgcolor: 'divider' }} />
          
          {/* Color picker */}
          <Tooltip title="Color">
            <IconButton
              size="small"
              onClick={(e) => setColorAnchor(e.currentTarget)}
            >
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <ColorLens sx={{ fontSize: 14 }} />
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: brushSettings.color,
                    border: '2px solid white'}}
                />
              </Stack>
            </IconButton>
          </Tooltip>
          
          <Popover
            open={Boolean(colorAnchor)}
            anchorEl={colorAnchor}
            onClose={() => setColorAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1, maxWidth: 150 }}>
              {COLORS.map(color => (
                <ColorSwatch
                  key={color}
                  sx={{ bgcolor: color }}
                  selected={brushSettings.color === color}
                  onClick={() => {
                    setBrushSettings(prev => ({ ...prev, color }));
                    setColorAnchor(null);
                  }}
                />
              ))}
            </Box>
          </Popover>
          
          {/* Size picker */}
          <Tooltip title="Size">
            <IconButton
              size="small"
              onClick={(e) => setSizeAnchor(e.currentTarget)}
            >
              <LineWeight sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          
          <Popover
            open={Boolean(sizeAnchor)}
            anchorEl={sizeAnchor}
            onClose={() => setSizeAnchor(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Box sx={{ p: 2, width: 150 }}>
              <Typography variant="caption" gutterBottom>
                Size: {brushSettings.size}px
              </Typography>
              <Slider
                value={brushSettings.size}
                min={1}
                max={50}
                onChange={(_, value) => setBrushSettings(prev => ({ ...prev, size: value as number }))}
              />
            </Box>
          </Popover>
          
          <Box sx={{ width: 1, height: 24, bgcolor: 'divider' }} />
          
          {/* Undo/Redo */}
          <Tooltip title="Undo">
            <span>
              <IconButton size="small" onClick={undo} disabled={undoStack.length === 0}>
                <Undo sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton size="small" onClick={redo} disabled={redoStack.length === 0}>
                <Redo sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          
          <Box sx={{ width: 1, height: 24, bgcolor: 'divider' }} />
          
          {/* Clear */}
          <Tooltip title="Clear">
            <IconButton size="small" onClick={clearCanvas}>
              <Delete sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          
          {/* Save */}
          {onSave && (
            <Tooltip title="Save">
              <IconButton size="small" onClick={saveCanvas}>
                <Save sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          
          {/* Input indicator */}
          <Box sx={{ width: 1, height: 24, bgcolor: 'divider' }} />
          <Tooltip title={pencilState.isPencilConnected ? 'Apple Pencil detected' : 'Touch/Mouse'}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                color: pencilState.isPencilConnected ? 'success.main' : 'text.secondary'}}
            >
              {pencilState.isPencilConnected ? <Create sx={{ fontSize: 16 }} /> : <TouchApp sx={{ fontSize: 16 }} />}
              <Typography variant="caption" sx={{ ml: 0.5 }}>
                {inputLabel}
              </Typography>
            </Box>
          </Tooltip>
        </Toolbar>
      )}
    </CanvasContainer>
  );
});

PencilCanvas.displayName = 'PencilCanvas';

export default PencilCanvas;
