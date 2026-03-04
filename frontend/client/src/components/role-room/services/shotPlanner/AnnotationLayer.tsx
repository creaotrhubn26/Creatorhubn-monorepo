/**
 * Annotation Layer - Drawing with Apple Pencil on Shot Planner
 * 
 * Allows directors to annotate shot plans with:
 * - Freehand drawing
 * - Pressure-sensitive strokes
 * - Multiple brush types
 * - Annotation layers
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  Box,
  Paper,
  Button,
  IconButton,
  Tooltip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Slider,
  Typography,
  Divider,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Edit as DrawIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Delete as ClearIcon,
  Close as CloseIcon,
  Palette as BrushIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import type { PencilPoint } from '../../hooks/useApplePencil';
import { useApplePencil } from '../../hooks/useApplePencil';

// Brush configuration
interface BrushConfig {
  type: string;
  size: number;
  color: string;
  opacity: number;
}

const DEFAULT_BRUSH_CONFIG: BrushConfig = {
  type: 'pencil',
  size: 4,
  color: '#000000',
  opacity: 1,
};

interface AnnotationLayerProps {
  visible: boolean;
  onClose: () => void;
  canvasWidth: number;
  canvasHeight: number;
  onAnnotationSave?: (annotations: AnnotationData[]) => void;
}

export interface AnnotationData {
  id: string;
  strokes: AnnotationStroke[];
  timestamp: number;
}

export interface AnnotationStroke {
  x: number[];
  y: number[];
  pressure: number[];
  tiltX?: number[];
  tiltY?: number[];
  brushType: string;
  color: string;
  size: number;
}

const BRUSH_TYPES = [
  { id: 'pencil', label: 'Pencil', icon: '✏️' },
  { id: 'pen', label: 'Pen', icon: '🖊️' },
  { id: 'marker', label: 'Marker', icon: '🖍️' },
  { id: 'brush', label: 'Brush', icon: '🎨' },
];

export const AnnotationLayer: React.FC<AnnotationLayerProps> = ({
  visible,
  onClose,
  canvasWidth,
  canvasHeight,
  onAnnotationSave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [brushConfig, setBrushConfig] = useState<BrushConfig>(DEFAULT_BRUSH_CONFIG);
  const [isDrawing, setIsDrawing] = useState(false);
  const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
  const [currentStroke, setCurrentStroke] = useState<AnnotationStroke | null>(null);
  const [brushMenuAnchor, setBrushMenuAnchor] = useState<null | HTMLElement>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // Initialize Apple Pencil support
  const pencilState = useApplePencil({
    onStrokeStart: () => setIsDrawing(true),
    onStrokeMove: (point: PencilPoint) => {
      if (!currentStroke) {
        setCurrentStroke({
          x: [point.x],
          y: [point.y],
          pressure: [point.pressure],
          tiltX: [point.tiltX || 0],
          tiltY: [point.tiltY || 0],
          brushType: brushConfig.type,
          color: brushConfig.color,
          size: brushConfig.size,
        });
      } else {
        setCurrentStroke((prev: AnnotationStroke | null) => prev ? {
          ...prev,
          x: [...prev.x, point.x],
          y: [...prev.y, point.y],
          pressure: [...prev.pressure, point.pressure],
          tiltX: [...(prev.tiltX || []), point.tiltX || 0],
          tiltY: [...(prev.tiltY || []), point.tiltY || 0],
        } : null);
      }
    },
    onStrokeEnd: () => {
      if (currentStroke && currentStroke.x.length > 1) {
        setAnnotations(prev => [...prev, {
          id: `annotation-${Date.now()}`,
          strokes: [currentStroke],
          timestamp: Date.now(),
        }]);
      }
      setCurrentStroke(null);
      setIsDrawing(false);
    },
  });

  // Initialize canvas
  useEffect(() => {
    if (!visible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const context = canvas.getContext('2d');
    if (!context) return;

    contextRef.current = context;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.globalAlpha = brushConfig.opacity;

    // Draw all annotations
    drawAnnotations();
  }, [visible, canvasWidth, canvasHeight, brushConfig.opacity]);

  // Draw on canvas
  const drawAnnotations = useCallback(() => {
    const context = contextRef.current;
    if (!context) return;

    context.clearRect(0, 0, canvasWidth, canvasHeight);

    annotations.forEach(annotation => {
      annotation.strokes.forEach(stroke => {
        for (let i = 0; i < stroke.x.length - 1; i++) {
          const x1 = stroke.x[i];
          const y1 = stroke.y[i];
          const x2 = stroke.x[i + 1];
          const y2 = stroke.y[i + 1];
          const pressure = stroke.pressure[i];

          // Draw with pressure-sensitive width
          const lineWidth = stroke.size * (0.5 + pressure * 1.5);

          context.strokeStyle = stroke.color;
          context.lineWidth = lineWidth;
          context.globalAlpha = brushConfig.opacity;

          context.beginPath();
          context.moveTo(x1, y1);
          context.lineTo(x2, y2);
          context.stroke();
        }
      });
    });

    // Draw current stroke
    if (currentStroke) {
      for (let i = 0; i < currentStroke.x.length - 1; i++) {
        const x1 = currentStroke.x[i];
        const y1 = currentStroke.y[i];
        const x2 = currentStroke.x[i + 1];
        const y2 = currentStroke.y[i + 1];
        const pressure = currentStroke.pressure[i];

        const lineWidth = currentStroke.size * (0.5 + pressure * 1.5);

        context.strokeStyle = currentStroke.color;
        context.lineWidth = lineWidth;
        context.globalAlpha = brushConfig.opacity;

        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
      }
    }
  }, [annotations, currentStroke, canvasWidth, canvasHeight, brushConfig.opacity]);

  // Redraw when annotations change
  useEffect(() => {
    drawAnnotations();
  }, [annotations, currentStroke, drawAnnotations]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure || 0.5;
    const pointerType = e.pointerType;

    setIsDrawing(true);
    setCurrentStroke({
      x: [x],
      y: [y],
      pressure: [pressure],
      tiltX: [0],
      tiltY: [0],
      brushType: brushConfig.type,
      color: brushConfig.color,
      size: brushConfig.size,
    });
  }, [brushConfig]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !currentStroke) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure || 0.5;

    setCurrentStroke(prev => prev ? {
      ...prev,
      x: [...prev.x, x],
      y: [...prev.y, y],
      pressure: [...prev.pressure, pressure],
    } : null);
  }, [isDrawing, currentStroke]);

  const handleCanvasPointerUp = useCallback(() => {
    if (!currentStroke || currentStroke.x.length < 2) {
      setCurrentStroke(null);
      setIsDrawing(false);
      return;
    }

    setAnnotations(prev => [...prev, {
      id: `annotation-${Date.now()}`,
      strokes: [currentStroke],
      timestamp: Date.now(),
    }]);

    setCurrentStroke(null);
    setIsDrawing(false);
  }, [currentStroke]);

  const handleClear = () => {
    contextRef.current?.clearRect(0, 0, canvasWidth, canvasHeight);
    setAnnotations([]);
    setCurrentStroke(null);
  };

  const handleUndo = () => {
    setAnnotations(prev => prev.slice(0, -1));
  };

  const handleSave = () => {
    onAnnotationSave?.(annotations);
    onClose();
  };

  if (!visible) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={handleCanvasPointerUp}
        style={{
          flex: 1,
          cursor: 'crosshair',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          touchAction: 'none',
        }}
      />

      {/* Toolbar */}
      <Paper
        elevation={8}
        sx={{
          p: 2,
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(30, 45, 61, 0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Brush Controls */}
        <Stack direction="row" spacing={1} alignItems="center">
          <ToggleButtonGroup
            value={brushConfig.type}
            exclusive
            onChange={(_, newType) => {
              if (newType) {
                setBrushConfig((prev: BrushConfig) => ({ ...prev, type: newType }));
              }
            }}
            sx={{ mr: 2 }}
          >
            {BRUSH_TYPES.map(type => (
              <Tooltip key={type.id} title={type.label}>
                <ToggleButton value={type.id} size="small">
                  <span style={{ fontSize: '16px' }}>{type.icon}</span>
                </ToggleButton>
              </Tooltip>
            ))}
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          {/* Color Picker */}
          <input
            type="color"
            value={brushConfig.color}
            onChange={(e) => setBrushConfig((prev: BrushConfig) => ({ ...prev, color: e.target.value }))}
            style={{
              width: 40,
              height: 40,
              cursor: 'pointer',
              border: 'none',
              borderRadius: 4,
            }}
            title="Brush color"
          />

          {/* Size Slider */}
          <Box sx={{ minWidth: 150 }}>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              Size: {brushConfig.size}
            </Typography>
            <Slider
              value={brushConfig.size}
              onChange={(_, value) => setBrushConfig((prev: BrushConfig) => ({ ...prev, size: value as number }))}
              min={1}
              max={50}
              step={1}
              size="small"
            />
          </Box>

          {/* Opacity Slider */}
          <Box sx={{ minWidth: 150 }}>
            <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
              Opacity: {Math.round(brushConfig.opacity * 100)}%
            </Typography>
            <Slider
              value={brushConfig.opacity}
              onChange={(_, value) => setBrushConfig((prev: BrushConfig) => ({ ...prev, opacity: value as number }))}
              min={0}
              max={1}
              step={0.05}
              size="small"
            />
          </Box>
        </Stack>

        {/* Action Buttons */}
        <Stack direction="row" spacing={1}>
          <Tooltip title={`${annotations.length} annotations`}>
            <Typography variant="caption" sx={{ px: 1 }}>
              {annotations.length} strokes
            </Typography>
          </Tooltip>

          <Tooltip title="Undo last stroke">
            <span>
              <IconButton
                size="small"
                onClick={handleUndo}
                disabled={annotations.length === 0}
                color="primary"
              >
                <UndoIcon />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Clear all annotations">
            <IconButton
              size="small"
              onClick={handleClear}
              disabled={annotations.length === 0 && !currentStroke}
              color="error"
            >
              <ClearIcon />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem />

          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            startIcon={<DrawIcon />}
          >
            Save Annotations
          </Button>

          <Tooltip title="Close annotation mode">
            <IconButton
              size="small"
              onClick={onClose}
              color="inherit"
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>
    </Box>
  );
};

export default AnnotationLayer;
