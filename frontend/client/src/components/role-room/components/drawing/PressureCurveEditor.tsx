/**
 * PressureCurveEditor - Customize Apple Pencil pressure response curve
 * 
 * Features:
 * - Visual curve editor with control points
 * - Preset curves (linear, soft, hard, S-curve)
 * - Real-time preview
 * - Save custom curves
 * - Test area for pressure
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Tooltip,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Button,
} from '@mui/material';
import {
  Refresh,
  SaveAlt,
  Timeline,
  ShowChart,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

// =============================================================================
// Types
// =============================================================================

export interface CurvePoint {
  x: number; // 0-1 input pressure
  y: number; // 0-1 output pressure
}

export interface PressureCurve {
  id: string;
  name: string;
  points: CurvePoint[]; // Control points for bezier curve
}

export interface PressureCurveEditorProps {
  curve: PressureCurve;
  onCurveChange: (curve: PressureCurve) => void;
  width?: number;
  height?: number;
}

// =============================================================================
// Constants
// =============================================================================

const PRESET_CURVES: PressureCurve[] = [
  {
    id: 'linear',
    name: 'Linear',
    points: [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.75 },
      { x: 1, y: 1 },
    ],
  },
  {
    id: 'soft',
    name: 'Soft',
    points: [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.45 },
      { x: 0.75, y: 0.85 },
      { x: 1, y: 1 },
    ],
  },
  {
    id: 'hard',
    name: 'Hard',
    points: [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.1 },
      { x: 0.75, y: 0.5 },
      { x: 1, y: 1 },
    ],
  },
  {
    id: 's-curve',
    name: 'S-Curve',
    points: [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.1 },
      { x: 0.75, y: 0.9 },
      { x: 1, y: 1 },
    ],
  },
  {
    id: 'light-touch',
    name: 'Light Touch',
    points: [
      { x: 0, y: 0 },
      { x: 0.1, y: 0.5 },
      { x: 0.5, y: 0.9 },
      { x: 1, y: 1 },
    ],
  },
  {
    id: 'heavy-hand',
    name: 'Heavy Hand',
    points: [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.15 },
      { x: 0.9, y: 0.5 },
      { x: 1, y: 1 },
    ],
  },
];

export const DEFAULT_PRESSURE_CURVE = PRESET_CURVES[0];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Cubic bezier interpolation
 */
function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

/**
 * Get Y value at a given X on the curve
 */
export function evaluatePressureCurve(curve: PressureCurve, inputPressure: number): number {
  const { points } = curve;
  if (points.length < 2) return inputPressure;
  
  // Clamp input
  const x = Math.max(0, Math.min(1, inputPressure));
  
  // Find which segment we're in
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p3 = points[i + 1];
    
    if (x >= p0.x && x <= p3.x) {
      // Normalize t within this segment
      const range = p3.x - p0.x;
      if (range === 0) return p0.y;
      
      const t = (x - p0.x) / range;
      
      // Control points for smooth bezier
      const p1y = p0.y + (p3.y - p0.y) * 0.33;
      const p2y = p0.y + (p3.y - p0.y) * 0.67;
      
      return cubicBezier(t, p0.y, p1y, p2y, p3.y);
    }
  }
  
  return inputPressure;
}

/**
 * Generate SVG path for curve
 */
function generateCurvePath(points: CurvePoint[], width: number, height: number): string {
  if (points.length < 2) return '';
  
  let path = `M ${points[0].x * width} ${height - points[0].y * height}`;
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p3 = points[i + 1];
    
    // Control points
    const cp1x = p0.x + (p3.x - p0.x) * 0.5;
    const cp1y = p0.y;
    const cp2x = p0.x + (p3.x - p0.x) * 0.5;
    const cp2y = p3.y;
    
    path += ` C ${cp1x * width} ${height - cp1y * height}, `;
    path += `${cp2x * width} ${height - cp2y * height}, `;
    path += `${p3.x * width} ${height - p3.y * height}`;
  }
  
  return path;
}

// =============================================================================
// Styled Components
// =============================================================================

const EditorContainer = styled(Paper)(({ theme }) => ({
  backgroundColor: 'rgba(20, 20, 30, 0.95)',
  backdropFilter: 'blur(12px)',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid rgba(255,255,255,0.08)',
}));

const CurveCanvas = styled(Box)({
  position: 'relative',
  backgroundColor: 'rgba(0,0,0,0.3)',
  borderRadius: 8,
  overflow: 'hidden',
});

const ControlPoint = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active' && prop !== 'locked',
})<{ active?: boolean; locked?: boolean }>(({ active, locked }) => ({
  position: 'absolute',
  width: locked ? 8 : 14,
  height: locked ? 8 : 14,
  borderRadius: '50%',
  backgroundColor: locked ? '#6b7280' : active ? '#3b82f6' : '#fff',
  border: `2px solid ${locked ? '#4b5563' : active ? '#60a5fa' : '#9ca3af'}`,
  cursor: locked ? 'default' : 'move',
  transform: 'translate(-50%, -50%)',
  transition: 'box-shadow 0.15s',
  zIndex: active ? 10 : 5,
  '&:hover': locked ? {} : {
    boxShadow: '0 0 12px rgba(59, 130, 246, 0.5)',
  },
}));

const TestArea = styled(Box)({
  height: 60,
  backgroundColor: 'rgba(0,0,0,0.3)',
  borderRadius: 8,
  position: 'relative',
  overflow: 'hidden',
  touchAction: 'none',
});

// =============================================================================
// Component
// =============================================================================

export const PressureCurveEditor: React.FC<PressureCurveEditorProps> = ({
  curve,
  onCurveChange,
  width = 240,
  height = 180,
}) => {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>(curve.id);
  const [testPressure, setTestPressure] = useState(0);
  const [testOutput, setTestOutput] = useState(0);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Update output when curve or test pressure changes
  useEffect(() => {
    setTestOutput(evaluatePressureCurve(curve, testPressure));
  }, [curve, testPressure]);

  const handlePresetChange = useCallback((
    _: React.MouseEvent<HTMLElement>,
    newPreset: string | null
  ) => {
    if (newPreset) {
      const preset = PRESET_CURVES.find(p => p.id === newPreset);
      if (preset) {
        onCurveChange({ ...preset });
        setSelectedPreset(newPreset);
      }
    }
  }, [onCurveChange]);

  const handlePointDrag = useCallback((
    e: React.PointerEvent | PointerEvent,
    pointIndex: number
  ) => {
    if (!canvasRef.current) return;
    
    // Don't allow dragging endpoints
    if (pointIndex === 0 || pointIndex === curve.points.length - 1) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height));
    
    // Ensure X stays within bounds of neighbors
    const prevX = curve.points[pointIndex - 1]?.x ?? 0;
    const nextX = curve.points[pointIndex + 1]?.x ?? 1;
    const clampedX = Math.max(prevX + 0.05, Math.min(nextX - 0.05, x));
    
    const newPoints = [...curve.points];
    newPoints[pointIndex] = { x: clampedX, y };
    
    onCurveChange({
      ...curve,
      id: 'custom',
      name: 'Custom',
      points: newPoints,
    });
    setSelectedPreset('custom');
  }, [curve, onCurveChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent, pointIndex: number) => {
    if (pointIndex === 0 || pointIndex === curve.points.length - 1) return;
    
    setActivePointIndex(pointIndex);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [curve.points.length]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (activePointIndex !== null) {
      handlePointDrag(e, activePointIndex);
    }
  }, [activePointIndex, handlePointDrag]);

  const handlePointerUp = useCallback(() => {
    setActivePointIndex(null);
  }, []);

  const handleTestPointerMove = useCallback((e: React.PointerEvent) => {
    // Use pressure if available (Apple Pencil)
    if (e.pressure > 0 && e.pressure < 1) {
      setTestPressure(e.pressure);
    } else {
      // Fallback: use Y position
      const rect = e.currentTarget.getBoundingClientRect();
      const y = 1 - (e.clientY - rect.top) / rect.height;
      setTestPressure(Math.max(0, Math.min(1, y)));
    }
  }, []);

  const curvePath = useMemo(() => 
    generateCurvePath(curve.points, width, height),
    [curve.points, width, height]
  );

  const resetCurve = useCallback(() => {
    const linearPreset = PRESET_CURVES[0];
    onCurveChange({ ...linearPreset });
    setSelectedPreset('linear');
  }, [onCurveChange]);

  return (
    <EditorContainer>
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" gap={1}>
            <Timeline sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Pressure Curve
            </Typography>
          </Stack>
          <Tooltip title="Reset">
            <IconButton size="small" onClick={resetCurve}>
              <Refresh sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Preset buttons */}
      <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <ToggleButtonGroup
          value={selectedPreset}
          exclusive
          onChange={handlePresetChange}
          size="small"
          sx={{ 
            flexWrap: 'wrap',
            '& .MuiToggleButton-root': {
              fontSize: 10,
              py: 0.3,
              px: 1,
              borderColor: 'rgba(255,255,255,0.2)',
            }
          }}
        >
          {PRESET_CURVES.map(preset => (
            <ToggleButton key={preset.id} value={preset.id}>
              {preset.name}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {/* Curve editor */}
      <Box sx={{ p: 1.5 }}>
        <CurveCanvas
          ref={canvasRef}
          sx={{ width, height }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Grid lines */}
          <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
            {/* Grid */}
            {[0.25, 0.5, 0.75].map(v => (
              <React.Fragment key={v}>
                <line
                  x1={v * width}
                  y1={0}
                  x2={v * width}
                  y2={height}
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="4 4"
                />
                <line
                  x1={0}
                  y1={v * height}
                  x2={width}
                  y2={v * height}
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="4 4"
                />
              </React.Fragment>
            ))}
            
            {/* Diagonal reference */}
            <line
              x1={0}
              y1={height}
              x2={width}
              y2={0}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="6 6"
            />
            
            {/* The curve */}
            <path
              d={curvePath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
            
            {/* Gradient fill under curve */}
            <defs>
              <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(59,130,246,0.3)" />
                <stop offset="100%" stopColor="rgba(59,130,246,0)" />
              </linearGradient>
            </defs>
            <path
              d={`${curvePath} L ${width} ${height} L 0 ${height} Z`}
              fill="url(#curveGradient)"
            />
          </svg>

          {/* Control points */}
          {curve.points.map((point, index) => {
            const isLocked = index === 0 || index === curve.points.length - 1;
            return (
              <ControlPoint
                key={index}
                active={activePointIndex === index}
                locked={isLocked}
                style={{
                  left: point.x * width,
                  top: (1 - point.y) * height,
                }}
                onPointerDown={(e) => handlePointerDown(e, index)}
              />
            );
          })}

          {/* Labels */}
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              bottom: 2,
              right: 4,
              fontSize: 9,
              color: 'text.secondary',
            }}
          >
            Input Pressure →
          </Typography>
          <Typography
            variant="caption"
            sx={{
              position: 'absolute',
              top: 4,
              left: 4,
              fontSize: 9,
              color: 'text.secondary',
              transform: 'rotate(-90deg)',
              transformOrigin: 'left top',
            }}
          >
            Output
          </Typography>
        </CurveCanvas>
      </Box>

      {/* Test area */}
      <Box sx={{ p: 1.5, pt: 0 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', mb: 0.5, display: 'block' }}>
          Test Area (draw here with Apple Pencil)
        </Typography>
        <TestArea onPointerMove={handleTestPointerMove}>
          {/* Input indicator */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: `${testPressure * 100}%`,
              width: 2,
              height: '100%',
              bgcolor: 'rgba(255,255,255,0.6)',
              transform: 'translateX(-50%)',
            }}
          />
          {/* Output indicator */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: `${testPressure * 100}%`,
              width: 12,
              height: `${testOutput * 100}%`,
              bgcolor: 'primary.main',
              borderRadius: '6px 6px 0 0',
              transform: 'translateX(-50%)',
              transition: 'height 0.05s',
            }}
          />
          {/* Labels */}
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{
              position: 'absolute',
              bottom: 4,
              left: 8,
              right: 8,
            }}
          >
            <Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary' }}>
              In: {Math.round(testPressure * 100)}%
            </Typography>
            <Typography variant="caption" sx={{ fontSize: 9, color: 'primary.main', fontWeight: 600 }}>
              Out: {Math.round(testOutput * 100)}%
            </Typography>
          </Stack>
        </TestArea>
      </Box>
    </EditorContainer>
  );
};

export default PressureCurveEditor;
