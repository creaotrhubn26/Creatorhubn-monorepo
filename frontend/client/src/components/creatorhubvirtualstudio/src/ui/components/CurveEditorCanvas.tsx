/**
 * CurveEditorCanvas - Visual bezier curve editor for keyframe interpolation
 * 
 * Features:
 * - Bezier curve visualization
 * - Draggable control points
 * - Preset curves
 * - Real-time preview
 * - Grid and guides
 */

import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Chip,
  Divider,
  Slider,
  TextField,
} from '@mui/material';
import {
  Refresh,
  Save,
  ContentCopy,
  Straighten,
  GridOn,
  PlayArrow,
} from '@mui/icons-material';

// ============================================================================
// Types
// ============================================================================

export interface BezierPoint {
  x: number;  // 0-1
  y: number;  // Can exceed 0-1 for overshoot
}

export interface BezierCurve {
  p0: BezierPoint;  // Start point (always 0,0)
  p1: BezierPoint;  // Control point 1
  p2: BezierPoint;  // Control point 2
  p3: BezierPoint;  // End point (always 1,1)
}

// ============================================================================
// Preset Curves
// ============================================================================

export const CURVE_PRESETS: Record<string, BezierCurve> = {
  linear: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.25, y: 0.25 },
    p2: { x: 0.75, y: 0.75 },
    p3: { x: 1, y: 1 },
  },
  easeIn: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.42, y: 0 },
    p2: { x: 1, y: 1 },
    p3: { x: 1, y: 1 },
  },
  easeOut: {
    p0: { x: 0, y: 0 },
    p1: { x: 0, y: 0 },
    p2: { x: 0.58, y: 1 },
    p3: { x: 1, y: 1 },
  },
  easeInOut: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.42, y: 0 },
    p2: { x: 0.58, y: 1 },
    p3: { x: 1, y: 1 },
  },
  easeInQuad: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.55, y: 0.085 },
    p2: { x: 0.68, y: 0.53 },
    p3: { x: 1, y: 1 },
  },
  easeOutQuad: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.25, y: 0.46 },
    p2: { x: 0.45, y: 0.94 },
    p3: { x: 1, y: 1 },
  },
  easeInOutQuad: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.455, y: 0.03 },
    p2: { x: 0.515, y: 0.955 },
    p3: { x: 1, y: 1 },
  },
  easeInCubic: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.55, y: 0.055 },
    p2: { x: 0.675, y: 0.19 },
    p3: { x: 1, y: 1 },
  },
  easeOutCubic: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.215, y: 0.61 },
    p2: { x: 0.355, y: 1 },
    p3: { x: 1, y: 1 },
  },
  easeInOutCubic: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.645, y: 0.045 },
    p2: { x: 0.355, y: 1 },
    p3: { x: 1, y: 1 },
  },
  easeInBack: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.6, y: -0.28 },
    p2: { x: 0.735, y: 0.045 },
    p3: { x: 1, y: 1 },
  },
  easeOutBack: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.175, y: 0.885 },
    p2: { x: 0.32, y: 1.275 },
    p3: { x: 1, y: 1 },
  },
  easeInOutBack: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.68, y: -0.55 },
    p2: { x: 0.265, y: 1.55 },
    p3: { x: 1, y: 1 },
  },
  bounce: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.175, y: 0.885 },
    p2: { x: 0.32, y: 1.4 },
    p3: { x: 1, y: 1 },
  },
  elastic: {
    p0: { x: 0, y: 0 },
    p1: { x: 0.5, y: 1.5 },
    p2: { x: 0.75, y: 0.9 },
    p3: { x: 1, y: 1 },
  },
  snap: {
    p0: { x: 0, y: 0 },
    p1: { x: 0, y: 1 },
    p2: { x: 0, y: 1 },
    p3: { x: 1, y: 1 },
  },
};

// ============================================================================
// Bezier Math
// ============================================================================

function cubicBezier(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function evaluateCurve(curve: BezierCurve, t: number): BezierPoint {
  return {
    x: cubicBezier(t, curve.p0.x, curve.p1.x, curve.p2.x, curve.p3.x),
    y: cubicBezier(t, curve.p0.y, curve.p1.y, curve.p2.y, curve.p3.y),
  };
}

function generateCurvePoints(curve: BezierCurve, segments: number = 50): BezierPoint[] {
  const points: BezierPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    points.push(evaluateCurve(curve, i / segments));
  }
  return points;
}

// Find Y for a given X (binary search approximation)
function findYForX(curve: BezierCurve, targetX: number, tolerance: number = 0.001): number {
  let low = 0;
  let high = 1;
  
  while (high - low > tolerance) {
    const mid = (low + high) / 2;
    const point = evaluateCurve(curve, mid);
    
    if (point.x < targetX) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  return evaluateCurve(curve, (low + high) / 2).y;
}

// ============================================================================
// Control Point Component
// ============================================================================

interface ControlPointProps {
  point: BezierPoint;
  anchorPoint?: BezierPoint;
  width: number;
  height: number;
  padding: number;
  color: string;
  onChange: (newPoint: BezierPoint) => void;
  showHandle?: boolean;
}

function ControlPoint({
  point,
  anchorPoint,
  width,
  height,
  padding,
  color,
  onChange,
  showHandle = true,
}: ControlPointProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<SVGGElement>(null);

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Convert normalized coordinates to SVG coordinates
  const toSvgX = (x: number) => padding + x * chartWidth;
  const toSvgY = (y: number) => padding + (1 - y) * chartHeight;

  // Convert SVG coordinates to normalized
  const toNormX = (svgX: number) => Math.max(0, Math.min(1, (svgX - padding) / chartWidth));
  const toNormY = (svgY: number) => 1 - (svgY - padding) / chartHeight;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const svg = containerRef.current?.ownerSVGElement;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      onChange({
        x: toNormX(x),
        y: toNormY(y),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove, ', handleMouseMove);
    window.addEventListener('mouseup,', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onChange, toNormX, toNormY]);

  const svgX = toSvgX(point.x);
  const svgY = toSvgY(point.y);
  const anchorSvgX = anchorPoint ? toSvgX(anchorPoint.x) : svgX;
  const anchorSvgY = anchorPoint ? toSvgY(anchorPoint.y) : svgY;

  return (
    <g ref={containerRef}>
      {/* Handle line */}
      {showHandle && anchorPoint && (
        <line
          x1={anchorSvgX}
          y1={anchorSvgY}
          x2={svgX}
          y2={svgY}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="4,4"
          opacity={0.5}
        />
      )}
      
      {/* Control point */}
      <circle
        cx={svgX}
        cy={svgY}
        r={isDragging ? 8 : 6}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
        cursor="grab"
        onMouseDown={handleMouseDown}
        style={{ transition: isDragging ? 'none' : 'r 0.1s' }}
      />
    </g>
  );
}

// ============================================================================
// Main Curve Editor Canvas
// ============================================================================

interface CurveEditorCanvasProps {
  curve: BezierCurve;
  onChange: (curve: BezierCurve) => void;
  width?: number;
  height?: number;
  showPreview?: boolean;
  previewValue?: number;
}

export function CurveEditorCanvas({
  curve,
  onChange,
  width = 300,
  height = 300,
  showPreview = true,
  previewValue,
}: CurveEditorCanvasProps) {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [animating, setAnimating] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Generate curve path
  const curvePoints = useMemo(() => generateCurvePoints(curve, 100), [curve]);
  const pathD = useMemo(() => {
    const toSvgX = (x: number) => padding + x * chartWidth;
    const toSvgY = (y: number) => padding + (1 - y) * chartHeight;

    return curvePoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(p.x)} ${toSvgY(p.y)}`)
      .join('');
  }, [curvePoints, chartWidth, chartHeight, padding]);

  // Animation preview
  useEffect(() => {
    if (!animating) return;

    let start: number | null = null;
    let frameId: number;

    const animate = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / 2000); // 2 second animation

      setAnimationProgress(progress);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      } else {
        setAnimating(false);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [animating]);

  const handlePresetChange = useCallback((presetName: string) => {
    const preset = CURVE_PRESETS[presetName];
    if (preset) {
      onChange({ ...preset });
      setSelectedPreset(presetName);
    }
  }, [onChange]);

  const handleReset = useCallback(() => {
    onChange({ ...CURVE_PRESETS.linear });
    setSelectedPreset('linear');
  }, [onChange]);

  const handleCopy = useCallback(() => {
    const cssValue = `cubic-bezier(${curve.p1.x.toFixed(3)}, ${curve.p1.y.toFixed(3)}, ${curve.p2.x.toFixed(3)}, ${curve.p2.y.toFixed(3)})`;
    navigator.clipboard.writeText(cssValue);
  }, [curve]);

  const toSvgX = (x: number) => padding + x * chartWidth;
  const toSvgY = (y: number) => padding + (1 - y) * chartHeight;

  // Current preview Y value
  const currentY = previewValue !== undefined 
    ? findYForX(curve, previewValue)
    : animating 
      ? findYForX(curve, animationProgress)
      : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Preset</InputLabel>
          <Select
            value={selectedPreset || ', '}
            label="Preset"
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            {Object.keys(CURVE_PRESETS).map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="Toggle Grid">
          <IconButton size="small" onClick={() => setShowGrid(!showGrid)}>
            <GridOn color={showGrid ? 'primary' : 'inherit'} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Reset to Linear">
          <IconButton size="small" onClick={handleReset}>
            <Refresh />
          </IconButton>
        </Tooltip>

        <Tooltip title="Copy CSS">
          <IconButton size="small" onClick={handleCopy}>
            <ContentCopy />
          </IconButton>
        </Tooltip>

        <Tooltip title="Preview Animation">
          <IconButton size="small" onClick={() => setAnimating(true)} disabled={animating}>
            <PlayArrow />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Canvas */}
      <Paper
        elevation={0}
        sx={{
          backgroundColor: '#1a1a1a',
          borderRadius: 2,
          overflow: 'hidden'}}
      >
        <svg width={width} height={height}>
          {/* Background */}
          <rect x={0} y={0} width={width} height={height} fill="#1a1a1a" />

          {/* Grid */}
          {showGrid && (
            <g opacity={0.2}>
              {/* Vertical lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((x) => (
                <line
                  key={`v-${x}`}
                  x1={toSvgX(x)}
                  y1={toSvgY(0)}
                  x2={toSvgX(x)}
                  y2={toSvgY(1)}
                  stroke="#666"
                  strokeWidth={x === 0 || x === 1 ? 2 : 1}
                />
              ))}
              {/* Horizontal lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((y) => (
                <line
                  key={`h-${y}`}
                  x1={toSvgX(0)}
                  y1={toSvgY(y)}
                  x2={toSvgX(1)}
                  y2={toSvgY(y)}
                  stroke="#666"
                  strokeWidth={y === 0 || y === 1 ? 2 : 1}
                />
              ))}
            </g>
          )}

          {/* Diagonal reference (linear) */}
          <line
            x1={toSvgX(0)}
            y1={toSvgY(0)}
            x2={toSvgX(1)}
            y2={toSvgY(1)}
            stroke="#333"
            strokeWidth={1}
            strokeDasharray="4,4"
          />

          {/* Curve */}
          <path d={pathD} fill="none" stroke="#2196f3" strokeWidth={3} />

          {/* Control points */}
          <ControlPoint
            point={curve.p1}
            anchorPoint={curve.p0}
            width={width}
            height={height}
            padding={padding}
            color="#f44336"
            onChange={(p) => onChange({ ...curve, p1: p })}
          />
          <ControlPoint
            point={curve.p2}
            anchorPoint={curve.p3}
            width={width}
            height={height}
            padding={padding}
            color="#4caf50"
            onChange={(p) => onChange({ ...curve, p2: p })}
          />

          {/* End points (fixed) */}
          <circle
            cx={toSvgX(0)}
            cy={toSvgY(0)}
            r={4}
            fill="#fff"
          />
          <circle
            cx={toSvgX(1)}
            cy={toSvgY(1)}
            r={4}
            fill="#fff"
          />

          {/* Preview marker */}
          {(previewValue !== undefined || animating) && (
            <g>
              <circle
                cx={toSvgX(previewValue ?? animationProgress)}
                cy={toSvgY(currentY)}
                r={8}
                fill="#ff9800"
                stroke="#fff"
                strokeWidth={2}
              />
              {/* Crosshair */}
              <line
                x1={toSvgX(previewValue ?? animationProgress)}
                y1={toSvgY(0)}
                x2={toSvgX(previewValue ?? animationProgress)}
                y2={toSvgY(currentY)}
                stroke="#ff9800"
                strokeWidth={1}
                strokeDasharray="2,2"
                opacity={0.5}
              />
              <line
                x1={toSvgX(0)}
                y1={toSvgY(currentY)}
                x2={toSvgX(previewValue ?? animationProgress)}
                y2={toSvgY(currentY)}
                stroke="#ff9800"
                strokeWidth={1}
                strokeDasharray="2,2"
                opacity={0.5}
              />
            </g>
          )}

          {/* Labels */}
          <text x={padding - 5} y={toSvgY(0) + 4} textAnchor="end" fill="#888" fontSize={10}>
            0
          </text>
          <text x={padding - 5} y={toSvgY(1) + 4} textAnchor="end" fill="#888" fontSize={10}>
            1
          </text>
          <text x={toSvgX(0)} y={height - 10} textAnchor="middle" fill="#888" fontSize={10}>
            0
          </text>
          <text x={toSvgX(1)} y={height - 10} textAnchor="middle" fill="#888" fontSize={10}>
            1
          </text>
          <text x={width / 2} y={height - 10} textAnchor="middle" fill="#666" fontSize={10}>
            Time →
          </text>
          <text
            x={10}
            y={height / 2}
            textAnchor="middle"
            fill="#666"
            fontSize={10}
            transform={`rotate(-90, 10, ${height / 2})`}
          >
            Value →
          </text>
        </svg>
      </Paper>

      {/* Control point values */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Paper sx={{ p: 1, flex: 1, backgroundColor: '#f4433622' }}>
          <Typography variant="caption" color="error" fontWeight={600}>
            Control Point 1
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <TextField
              size="small"
              label="X"
              type="number"
              value={curve.p1.x.toFixed(3)}
              onChange={(e) => onChange({ ...curve, p1: { ...curve.p1, x: parseFloat(e.target.value) || 0 } })}
              inputProps={{ step: 0.01, min: 0, max: 1 }}
              sx={{ width: 80 }}
            />
            <TextField
              size="small"
              label="Y"
              type="number"
              value={curve.p1.y.toFixed(3)}
              onChange={(e) => onChange({ ...curve, p1: { ...curve.p1, y: parseFloat(e.target.value) || 0 } })}
              inputProps={{ step: 0.01 }}
              sx={{ width: 80 }}
            />
          </Box>
        </Paper>
        <Paper sx={{ p: 1, flex: 1, backgroundColor: '#4caf5022' }}>
          <Typography variant="caption" color="success" fontWeight={600}>
            Control Point 2
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <TextField
              size="small"
              label="X"
              type="number"
              value={curve.p2.x.toFixed(3)}
              onChange={(e) => onChange({ ...curve, p2: { ...curve.p2, x: parseFloat(e.target.value) || 0 } })}
              inputProps={{ step: 0.01, min: 0, max: 1 }}
              sx={{ width: 80 }}
            />
            <TextField
              size="small"
              label="Y"
              type="number"
              value={curve.p2.y.toFixed(3)}
              onChange={(e) => onChange({ ...curve, p2: { ...curve.p2, y: parseFloat(e.target.value) || 0 } })}
              inputProps={{ step: 0.01 }}
              sx={{ width: 80 }}
            />
          </Box>
        </Paper>
      </Box>

      {/* CSS Output */}
      <Paper sx={{ p: 1, backgroundColor: '#252530' }}>
        <Typography variant="caption" color="text.secondary">
          CSS cubic-bezier:
        </Typography>
        <Typography variant="body2" fontFamily="monospace" sx={{ color: '#4caf50' }}>
          cubic-bezier({curve.p1.x.toFixed(3)}, {curve.p1.y.toFixed(3)}, {curve.p2.x.toFixed(3)}, {curve.p2.y.toFixed(3)})
        </Typography>
      </Paper>
    </Box>
  );
}

export default CurveEditorCanvas;

