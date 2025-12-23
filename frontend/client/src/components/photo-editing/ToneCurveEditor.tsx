/**
 * TONE CURVE EDITOR
 * Lightroom-style interactive tone curve editor
 * Supports RGB, Red, Green, Blue channel curves
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Button,
  IconButton,
  Stack,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import {
  Refresh,
  Delete,
  ZoomIn,
  ZoomOut,
  GridOn,
  GridOff,
} from '@mui/icons-material';
import { ToneCurveEngine, CurvePoint, ToneCurve } from '@/services/tone-curve-engine';
import { useTheming } from '../../utils/theming-helper';

interface ToneCurveEditorProps {
  imageUrl?: string;
  onCurveChange?: (curves: Partial<ToneCurve>) => void;
  initialCurves?: Partial<ToneCurve>;
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function ToneCurveEditor({
  imageUrl,
  onCurveChange,
  initialCurves,
  profession = 'photographer',
}: ToneCurveEditorProps) {
  const [comparisonCurve, setComparisonCurve] = useState<CurvePoint[] | null>(null);
  const [smoothingEnabled, setSmoothingEnabled] = useState(false);
  const [colorSpace, setColorSpace] = useState<'rgb' | 'lab'>('rgb');
  const theming = useTheming(profession);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeChannel, setActiveChannel] = useState<'rgb' | 'red' | 'green' | 'blue'>('rgb');
  const [curves, setCurves] = useState<Partial<ToneCurve>>(
    initialCurves || {
      rgb: ToneCurveEngine.DEFAULT_CURVE,
      red: ToneCurveEngine.DEFAULT_CURVE,
      green: ToneCurveEngine.DEFAULT_CURVE,
      blue: ToneCurveEngine.DEFAULT_CURVE,
    }
  );
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [preset, setPreset] = useState<string>('');

  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 400;
  const PADDING = 40;
  const GRAPH_WIDTH = CANVAS_WIDTH - PADDING * 2;
  const GRAPH_HEIGHT = CANVAS_HEIGHT - PADDING * 2;

  // Convert curve point to canvas coordinates
  const pointToCanvas = useCallback((point: CurvePoint): { x: number; y: number } => {
    return {
      x: PADDING + (point.x / 255) * GRAPH_WIDTH,
      y: PADDING + GRAPH_HEIGHT - (point.y / 255) * GRAPH_HEIGHT,
    };
  }, []);

  // Convert canvas coordinates to curve point
  const canvasToPoint = useCallback((x: number, y: number): CurvePoint => {
    return {
      x: Math.max(0, Math.min(255, ((x - PADDING) / GRAPH_WIDTH) * 255)),
      y: Math.max(0, Math.min(255, ((CANVAS_HEIGHT - y - PADDING) / GRAPH_HEIGHT) * 255)),
    };
  }, []);

  // Draw the curve
  const drawCurve = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let i = 0; i <= 4; i++) {
        const x = PADDING + (i / 4) * GRAPH_WIDTH;
        ctx.beginPath();
        ctx.moveTo(x, PADDING);
        ctx.lineTo(x, CANVAS_HEIGHT - PADDING);
        ctx.stroke();
      }

      // Horizontal lines
      for (let i = 0; i <= 4; i++) {
        const y = PADDING + (i / 4) * GRAPH_HEIGHT;
        ctx.beginPath();
        ctx.moveTo(PADDING, y);
        ctx.lineTo(CANVAS_WIDTH - PADDING, y);
        ctx.stroke();
      }
    }

    // Draw diagonal reference line
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(PADDING, CANVAS_HEIGHT - PADDING);
    ctx.lineTo(CANVAS_WIDTH - PADDING, PADDING);
    ctx.stroke();
    ctx.setLineDash([]);

    // Get current curve
    const currentCurve = curves[activeChannel] || ToneCurveEngine.DEFAULT_CURVE;

    // Draw curve
    ctx.strokeStyle = activeChannel === 'rgb' ? '#fff' : 
                     activeChannel === 'red' ? '#ff4444' :
                     activeChannel === 'green' ? '#44ff44' :
                     '#4444ff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x <= 255; x++) {
      const y = ToneCurveEngine.bezierInterpolation(currentCurve, x);
      const canvasPos = pointToCanvas({ x, y });
      if (x === 0) {
        ctx.moveTo(canvasPos.x, canvasPos.y);
      } else {
        ctx.lineTo(canvasPos.x, canvasPos.y);
      }
    }
    ctx.stroke();

    // Draw control points
    currentCurve.forEach((point, index) => {
      const canvasPos = pointToCanvas(point);
      const isSelected = selectedPoint === index;

      // Point circle
      ctx.fillStyle = isSelected ? '#fff' : '#888';
      ctx.strokeStyle = isSelected ? '#4CAF50' : '#555';
      ctx.lineWidth = isSelected ? 3 : 2;

      ctx.beginPath();
      ctx.arc(canvasPos.x, canvasPos.y, isSelected ? 6 : 5, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Draw labels
    ctx.fillStyle = '#aaa';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Shadows', PADDING / 2, CANVAS_HEIGHT - PADDING / 2);
    ctx.fillText('Highlights', CANVAS_WIDTH - PADDING / 2, PADDING / 2);
  }, [curves, activeChannel, selectedPoint, showGrid, pointToCanvas]);

  useEffect(() => {
    drawCurve();
  }, [drawCurve]);

  // Handle mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const currentCurve = curves[activeChannel] || ToneCurveEngine.DEFAULT_CURVE;

    // Check if clicking on existing point
    for (let i = 0; i < currentCurve.length; i++) {
      const canvasPos = pointToCanvas(currentCurve[i]);
      const distance = Math.sqrt(
        Math.pow(x - canvasPos.x, 2) + Math.pow(y - canvasPos.y, 2)
      );

      if (distance < 10) {
        setSelectedPoint(i);
        setIsDragging(true);
        return;
      }
    }

    // Add new point
    const newPoint = canvasToPoint(x, y);
    const newCurve = [...currentCurve, newPoint].sort((a, b) => a.x - b.x);
    
    setCurves(prev => ({
      ...prev,
      [activeChannel]: ToneCurveEngine.normalizeCurve(newCurve),
    }));
    
    const newIndex = newCurve.findIndex(p => p.x === newPoint.x);
    setSelectedPoint(newIndex);
    setIsDragging(true);
  }, [curves, activeChannel, pointToCanvas, canvasToPoint]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || selectedPoint === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const currentCurve = curves[activeChannel] || ToneCurveEngine.DEFAULT_CURVE;
    const newPoint = canvasToPoint(x, y);

    // Update point
    const newCurve = [...currentCurve];
    newCurve[selectedPoint] = newPoint;

    // Sort and normalize
    const sorted = newCurve.sort((a, b) => a.x - b.x);
    const normalized = ToneCurveEngine.normalizeCurve(sorted);

    setCurves(prev => ({
      ...prev,
      [activeChannel]: normalized,
    }));

    // Update selected point index
    const newIndex = normalized.findIndex(p => 
      Math.abs(p.x - newPoint.x) < 1 && Math.abs(p.y - newPoint.y) < 1
    );
    if (newIndex !== -1) setSelectedPoint(newIndex);

    // Notify parent
    onCurveChange?.({
      ...curves,
      [activeChannel]: normalized,
    });
  }, [isDragging, selectedPoint, curves, activeChannel, canvasToPoint, onCurveChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleReset = useCallback(() => {
    setCurves(prev => ({
      ...prev,
      [activeChannel]: ToneCurveEngine.DEFAULT_CURVE,
    }));
    setSelectedPoint(null);
    onCurveChange?.({
      ...curves,
      [activeChannel]: ToneCurveEngine.DEFAULT_CURVE,
    });
  }, [activeChannel, curves, onCurveChange]);

  const handleDeletePoint = useCallback(() => {
    if (selectedPoint === null) return;

    const currentCurve = curves[activeChannel] || ToneCurveEngine.DEFAULT_CURVE;
    if (currentCurve.length <= 2) return; // Keep at least 2 points

    const newCurve = currentCurve.filter((_, i) => i !== selectedPoint);
    const normalized = ToneCurveEngine.normalizeCurve(newCurve);

    setCurves(prev => ({
      ...prev,
      [activeChannel]: normalized,
    }));
    setSelectedPoint(null);

    onCurveChange?.({
      ...curves,
      [activeChannel]: normalized,
    });
  }, [selectedPoint, curves, activeChannel, onCurveChange]);

  const handlePresetChange = useCallback((presetName: string) => {
    const presets = ToneCurveEngine.getCurvePresets();
    const preset = presets.find(p => p.name === presetName);
    
    if (preset) {
      setCurves(prev => ({
        ...prev,
        [activeChannel]: preset.curve,
      }));
      setPreset(presetName);
      onCurveChange?.({
        ...curves,
        [activeChannel]: preset.curve,
      });
    }
  }, [activeChannel, curves, onCurveChange]);

  return (
    <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ color: theming.colors.primary }}>
          Tone Curve
        </Typography>

        {/* Channel Tabs */}
        <Tabs
          value={activeChannel === 'rgb' ? 0 : activeChannel === 'red' ? 1 : activeChannel === 'green' ? 2 : 3}
          onChange={(_, value) => {
            const channels: Array<'rgb' | 'red' | 'green' | 'blue'> = ['rgb', 'red', 'green', 'blue'];
            setActiveChannel(channels[value]);
            setSelectedPoint(null);
          }}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="RGB" />
          <Tab label="Red" sx={{ color: '#ff4444' }} />
          <Tab label="Green" sx={{ color: '#44ff44' }} />
          <Tab label="Blue" sx={{ color: '#4444ff' }} />
        </Tabs>

        {/* Preset Selector */}
        <FormControl fullWidth size="small">
          <InputLabel>Preset</InputLabel>
          <Select
            value={preset}
            label="Preset"
            onChange={(e) => handlePresetChange(e.target.value)}
          >
            <MenuItem value="">Custom</MenuItem>
            {ToneCurveEngine.getCurvePresets().map((p) => (
              <MenuItem key={p.name} value={p.name}>
                {p.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Curve Canvas */}
        <Box sx={{ position: 'relative', display: 'inline-block' }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              border: '1px solid #444',
              borderRadius: '4px'}}
          />
        </Box>

        {/* Controls */}
        <Stack direction="row" spacing={1} justifyContent="space-between">
          <Stack direction="row" spacing={1}>
            <Tooltip title="Reset Curve">
              <IconButton size="small" onClick={handleReset}>
                <Refresh />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete Point">
              <IconButton
                size="small"
                onClick={handleDeletePoint}
                disabled={selectedPoint === null}
              >
                <Delete />
              </IconButton>
            </Tooltip>
            <Tooltip title={showGrid ? 'Hide Grid' : 'Show Grid'}>
              <IconButton size="small" onClick={() => setShowGrid(!showGrid)}>
                {showGrid ? <GridOff /> : <GridOn />}
              </IconButton>
            </Tooltip>
          </Stack>

          {selectedPoint !== null && (
            <Chip
              label={`Point ${selectedPoint + 1}: (${Math.round((curves[activeChannel] || [])[selectedPoint]?.x || 0)}, ${Math.round((curves[activeChannel] || [])[selectedPoint]?.y || 0)})`}
              size="small"
              color="primary"
            />
          )}
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Click to add points, drag to adjust. Double-click to delete.
        </Typography>
      </Stack>
    </Paper>
  );
}

