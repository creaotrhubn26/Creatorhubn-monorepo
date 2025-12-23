import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Tooltip,
  Chip,
  Divider,
} from '@mui/material';
import { Timeline, ShowChart, LinearScale, Edit, Undo, Redo, Restore } from '@mui/icons-material';
import { useAnimationStore, type EasingFunction } from '../../state/animationStore';

interface BezierPoint {
  x: number;
  y: number;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 300;
const PADDING = 40;
const GRAPH_WIDTH = CANVAS_WIDTH - PADDING * 2;
const GRAPH_HEIGHT = CANVAS_HEIGHT - PADDING * 2;
const HANDLE_RADIUS = 6;

// Preset easing curves with bezier control points
const EASING_PRESETS: Record<EasingFunction, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  bezier: [0.25, 0.1, 0.25, 1], // Default bezier
};

export const CurveEditor: React.FC = () => {
  const { tracks, updateKeyframe } = useAnimationStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedEasing, setSelectedEasing] = useState<EasingFunction>('easeInOut');
  const [controlPoints, setControlPoints] = useState<BezierPoint[]>([
    { x: 0.42, y: 0 },
    { x: 0.58, y: 1 },
  ]);
  const [isDragging, setIsDragging] = useState<number | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [isAnimatingPreview, setIsAnimatingPreview] = useState(false);

  // Load preset when easing changes
  useEffect(() => {
    const preset = EASING_PRESETS[selectedEasing];
    setControlPoints([
      { x: preset[0], y: preset[1] },
      { x: preset[2], y: preset[3] },
    ]);
  }, [selectedEasing]);

  // Cubic bezier calculation
  const cubicBezier = useCallback(
    (t: number): number => {
      const [p1x, p1y, p2x, p2y] = [
        controlPoints[0].x,
        controlPoints[0].y,
        controlPoints[1].x,
        controlPoints[1].y,
      ];

      // Binary search to find t for given x
      const epsilon = 0.001;
      let start = 0;
      let end = 1;
      let mid = 0.5;

      while (end - start > epsilon) {
        mid = (start + end) / 2;
        const x = 3 * (1 - mid) ** 2 * mid * p1x + 3 * (1 - mid) * mid ** 2 * p2x + mid ** 3;
        if (x < t) {
          start = mid;
        } else {
          end = mid;
        }
      }

      // Calculate y for the found t
      const y = 3 * (1 - mid) ** 2 * mid * p1y + 3 * (1 - mid) * mid ** 2 * p2y + mid ** 3;
      return y;
    },
    [controlPoints],
  );

  // Draw curve editor canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Vertical grid lines
    for (let i = 0; i <= 4; i++) {
      const x = PADDING + (GRAPH_WIDTH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, PADDING);
      ctx.lineTo(x, PADDING + GRAPH_HEIGHT);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = PADDING + (GRAPH_HEIGHT / 4) * i;
      ctx.beginPath();
      ctx.moveTo(PADDING, y);
      ctx.lineTo(PADDING + GRAPH_WIDTH, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PADDING, PADDING);
    ctx.lineTo(PADDING, PADDING + GRAPH_HEIGHT);
    ctx.lineTo(PADDING + GRAPH_WIDTH, PADDING + GRAPH_HEIGHT);
    ctx.stroke();

    // Labels
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText('Time', CANVAS_WIDTH / 2 - 20, CANVAS_HEIGHT - 10);
    ctx.save();
    ctx.translate(15, CANVAS_HEIGHT / 2 + 30);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Value', 0, 0);
    ctx.restore();

    // Draw bezier curve
    ctx.strokeStyle = '#2196f3';
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const x = PADDING + t * GRAPH_WIDTH;
      const y = PADDING + GRAPH_HEIGHT - cubicBezier(t) * GRAPH_HEIGHT;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();

    // Draw control point handles
    const p1x = PADDING + controlPoints[0].x * GRAPH_WIDTH;
    const p1y = PADDING + GRAPH_HEIGHT - controlPoints[0].y * GRAPH_HEIGHT;
    const p2x = PADDING + controlPoints[1].x * GRAPH_WIDTH;
    const p2y = PADDING + GRAPH_HEIGHT - controlPoints[1].y * GRAPH_HEIGHT;

    // Control lines
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);

    ctx.beginPath();
    ctx.moveTo(PADDING, PADDING + GRAPH_HEIGHT);
    ctx.lineTo(p1x, p1y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(PADDING + GRAPH_WIDTH, PADDING);
    ctx.lineTo(p2x, p2y);
    ctx.stroke();

    ctx.setLineDash([]);

    // Control points
    ctx.fillStyle = '#4caf50';
    ctx.beginPath();
    ctx.arc(p1x, p1y, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p2x, p2y, HANDLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Start/end points
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(PADDING, PADDING + GRAPH_HEIGHT, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(PADDING + GRAPH_WIDTH, PADDING, 4, 0, Math.PI * 2);
    ctx.fill();

    // Preview progress indicator
    if (isAnimatingPreview) {
      const progressX = PADDING + previewProgress * GRAPH_WIDTH;
      const progressY = PADDING + GRAPH_HEIGHT - cubicBezier(previewProgress) * GRAPH_HEIGHT;

      ctx.fillStyle = '#ff4081';
      ctx.beginPath();
      ctx.arc(progressX, progressY, 8, 0, Math.PI * 2);
      ctx.fill();

      // Vertical line
      ctx.strokeStyle = '#ff4081';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(progressX, PADDING);
      ctx.lineTo(progressX, PADDING + GRAPH_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [controlPoints, cubicBezier, previewProgress, isAnimatingPreview]);

  // Handle mouse events for dragging control points
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on control points
    const p1x = PADDING + controlPoints[0].x * GRAPH_WIDTH;
    const p1y = PADDING + GRAPH_HEIGHT - controlPoints[0].y * GRAPH_HEIGHT;
    const p2x = PADDING + controlPoints[1].x * GRAPH_WIDTH;
    const p2y = PADDING + GRAPH_HEIGHT - controlPoints[1].y * GRAPH_HEIGHT;

    const dist1 = Math.sqrt((x - p1x) ** 2 + (y - p1y) ** 2);
    const dist2 = Math.sqrt((x - p2x) ** 2 + (y - p2y) ** 2);

    if (dist1 < HANDLE_RADIUS * 2) {
      setIsDragging(0);
    } else if (dist2 < HANDLE_RADIUS * 2) {
      setIsDragging(1);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left - PADDING) / GRAPH_WIDTH));
    const y = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top - PADDING) / GRAPH_HEIGHT));

    setControlPoints((prev) => {
      const newPoints = [...prev];
      newPoints[isDragging] = { x, y };
      return newPoints;
    });

    // Update to custom bezier
    setSelectedEasing('bezier');
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  // Preview animation
  const handlePreviewAnimation = () => {
    setIsAnimatingPreview(true);
    setPreviewProgress(0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.01;
      if (progress >= 1) {
        progress = 0;
        clearInterval(interval);
        setIsAnimatingPreview(false);
      }
      setPreviewProgress(progress);
    }, 16); // ~60fps
  };

  // Reset to preset
  const handleReset = () => {
    const preset = EASING_PRESETS[selectedEasing];
    setControlPoints([
      { x: preset[0], y: preset[1] },
      { x: preset[2], y: preset[3] },
    ]);
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        backgroundColor: '#1a1a1a',
        color: '#fff',
        minWidth: 450}}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ShowChart color="primary" />
        <Typography variant="h6">Curve Editor</Typography>
      </Box>

      {/* Easing presets */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Easing Presets
        </Typography>
        <ToggleButtonGroup
          value={selectedEasing}
          exclusive
          onChange={(_, value) => value && setSelectedEasing(value)}
          size="small"
          fullWidth
        >
          <ToggleButton value="linear">
            <Tooltip title="Constant speed">
              <span>Linear</span>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="easeIn">
            <Tooltip title="Slow start, fast end">
              <span>Ease In</span>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="easeOut">
            <Tooltip title="Fast start, slow end">
              <span>Ease Out</span>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="easeInOut">
            <Tooltip title="Slow start and end">
              <span>Ease In/Out</span>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="bezier">
            <Tooltip title="Custom bezier curve">
              <span>Custom</span>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ my: 2, borderColor: '#333' }} />

      {/* Canvas */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          mb: 2,
          backgroundColor: '#0a0a0a',
          borderRadius: 1,
          p: 1}}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: isDragging !== null ? 'grabbing' : 'default' }}
        />
      </Box>

      {/* Control point values */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Control Points
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Chip
            label={`P1: (${controlPoints[0].x.toFixed(2)}, ${controlPoints[0].y.toFixed(2)})`}
            size="small"
            sx={{ backgroundColor: '#4caf50' }}
          />
          <Chip
            label={`P2: (${controlPoints[1].x.toFixed(2)}, ${controlPoints[1].y.toFixed(2)})`}
            size="small"
            sx={{ backgroundColor: '#4caf50' }}
          />
        </Box>
      </Box>

      <Divider sx={{ my: 2, borderColor: '#333' }} />

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Preview animation">
            <IconButton
              size="small"
              onClick={handlePreviewAnimation}
              disabled={isAnimatingPreview}
              color="primary"
            >
              <Timeline />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reset to preset">
            <IconButton size="small" onClick={handleReset} color="secondary">
              <Restore />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'flex', alignItems: 'center' }}
        >
          Drag green handles to adjust curve
        </Typography>
      </Box>

      {/* Instructions */}
      <Box
        sx={{
          mt: 2,
          p: 1.5,
          backgroundColor: '#222',
          borderRadius: 1,
          borderLeft: '3px solid #2196f3'}}
      >
        <Typography variant="caption">
          <strong>How to use:</strong>
          <br />
          • Select a preset or choose Custom
          <br />
          • Drag green handles to shape the curve
          <br />
          • Click preview to see animation
          <br />• Curve affects keyframe interpolation
        </Typography>
      </Box>
    </Paper>
  );
};
