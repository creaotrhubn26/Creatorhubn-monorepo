/**
 * HEALING TOOLBAR
 * Lightroom-style healing tools: Spot Removal, Healing Brush, Clone Stamp
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  Slider,
  Stack,
  IconButton,
  Tooltip,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Healing,
  ContentCopy,
  Delete,
  Visibility,
  VisibilityOff,
  Refresh,
  AutoAwesome,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { sam2Service } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';
import { Alert, CircularProgress } from '@mui/material';

export type HealingTool = 'spot' | 'heal' | 'clone';

export interface HealingPoint {
  id: string;
  type: HealingTool;
  x: number;
  y: number;
  size: number;
  sourceX?: number; // For clone stamp
  sourceY?: number; // For clone stamp
}

interface HealingToolbarProps {
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  onHealingChange?: (points: HealingPoint[]) => void;
  initialPoints?: HealingPoint[];
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor';
}

export default function HealingToolbar({
  imageUrl,
  imageWidth = 800,
  imageHeight = 600,
  onHealingChange,
  initialPoints = [],
  profession = 'photographer',
}: HealingToolbarProps) {
  const theming = useTheming(profession);
  const [activeTool, setActiveTool] = useState<HealingTool | null>(null);
  const [points, setPoints] = useState<HealingPoint[]>(initialPoints);
  const [brushSize, setBrushSize] = useState(50);
  const [opacity, setOpacity] = useState(100);
  const [showOverlay, setShowOverlay] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<string | null>(null);
  const [isDetectingBlemishes, setIsDetectingBlemishes] = useState(false);
  const [detectedBlemishes, setDetectedBlemishes] = useState<Array<{ x: number; y: number; confidence: number }>>([]);

  const handleToolSelect = useCallback((tool: HealingTool) => {
    setActiveTool(activeTool === tool ? null : tool);
  }, [activeTool]);

  const handleAddPoint = useCallback(
    (x: number, y: number) => {
      if (!activeTool) return;

      const newPoint: HealingPoint = {
        id: `healing_${Date.now()}`,
        type: activeTool,
        x,
        y,
        size: brushSize,
      };

      // For clone stamp, set source point
      if (activeTool === 'clone') {
        newPoint.sourceX = x - 50; // Default offset
        newPoint.sourceY = y - 50;
      }

      setPoints((prev) => {
        const updated = [...prev, newPoint];
        onHealingChange?.(updated);
        return updated;
      });
    },
    [activeTool, brushSize, onHealingChange]
  );

  const handleDeletePoint = useCallback(
    (pointId: string) => {
      setPoints((prev) => {
        const updated = prev.filter((p) => p.id !== pointId);
        onHealingChange?.(updated);
        return updated;
      });
      if (selectedPoint === pointId) {
        setSelectedPoint(null);
      }
    },
    [selectedPoint, onHealingChange]
  );

  const handleReset = useCallback(() => {
    setPoints([]);
    setSelectedPoint(null);
    setDetectedBlemishes([]);
    onHealingChange?.([]);
  }, [onHealingChange]);

  // AI blemish detection mutation
  const detectBlemishesMutation = useMutation({
    mutationFn: async () => {
      if (!imageUrl) {
        throw new Error('Image URL is required for blemish detection ');
      }
      
      setIsDetectingBlemishes(true);
      try {
        // Use SAM 2 to detect small objects/blemishes
        // Sample multiple points across the image to find blemishes
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = imageUrl;
        });
        
        const width = image.width;
        const height = image.height;
        
        // Sample points in a grid pattern to detect blemishes
        const samplePoints: Array<[number, number]> = [];
        const step = 100; // Sample every 100 pixels
        for (let y = step; y < height - step; y += step) {
          for (let x = step; x < width - step; x += step) {
            samplePoints.push([x, y]);
          }
        }
        
        // Segment at each sample point to find small objects (potential blemishes)
        const blemishCandidates: Array<{ x: number; y: number; confidence: number }> = [];
        
        // Process in batches to avoid overwhelming the API
        for (let i = 0; i < Math.min(samplePoints.length, 20); i++) {
          const point = samplePoints[i];
          try {
            const result = await sam2Service.segmentImageFromUrl(
              imageUrl,
              { points: [point] }, 'point', 'tiny' // Use tiny model for speed
            );
            
            // If segmentation finds a small object (likely a blemish)
            if (result.masks && result.masks.length > 0) {
              const mask = result.masks[0];
              // Check if it's a small area (blemish-like)
              if (mask.area < 5000 && mask.confidence > 0.7) {
                blemishCandidates.push({
                  x: mask.center[0],
                  y: mask.center[1],
                  confidence: mask.confidence,
                });
              }
            }
          } catch (error) {
            // Continue with next point if one fails
            console.warn(`Blemish detection failed at point ${point}:`, error);
          }
        }
        
        setDetectedBlemishes(blemishCandidates);
        return blemishCandidates;
      } finally {
        setIsDetectingBlemishes(false);
      }
    },
    onSuccess: (blemishes) => {
      // Auto-add detected blemishes as healing points
      const newPoints: HealingPoint[] = blemishes.map((blemish, idx) => ({
        id: `ai_blemish_${Date.now()}_${idx}`,
        type: 'spot',
        x: blemish.x,
        y: blemish.y,
        size: brushSize,
      }));
      
      setPoints((prev) => {
        const updated = [...prev, ...newPoints];
        onHealingChange?.(updated);
        return updated;
      });
    },
    onError: (error: any) => {
      console.error('Blemish detection failed:', error);
    },
  });

  const handleDetectBlemishes = () => {
    detectBlemishesMutation.mutate();
  };

  return (
    <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Healing & Cloning
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title={showOverlay ? 'Hide Overlay' : 'Show Overlay'}>
              <IconButton size="small" onClick={() => setShowOverlay(!showOverlay)}>
                {showOverlay ? <Visibility /> : <VisibilityOff />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Reset All">
              <IconButton size="small" onClick={handleReset}>
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* AI Blemish Detection */}
        <Box>
          <Button
            variant="outlined"
            color="primary"
            fullWidth
            onClick={handleDetectBlemishes}
            disabled={!imageUrl || isDetectingBlemishes}
            startIcon={isDetectingBlemishes ? <CircularProgress size={16} /> : <AutoAwesome />}
            sx={{ mb: 2 }}
          >
            {isDetectingBlemishes ? 'Detecting Blemishes...' : 'AI Detect Blemishes'}
          </Button>
          {detectedBlemishes.length > 0 && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Found {detectedBlemishes.length} potential blemish(es). Click to add healing points.
            </Alert>
          )}
        </Box>

        {/* Tool Selection */}
        <ButtonGroup fullWidth variant="outlined" size="small">
          <Tooltip title="Spot Removal (Auto)">
            <Button
              startIcon={<AutoAwesome />}
              onClick={() => handleToolSelect('spot')}
              variant={activeTool === 'spot' ? 'contained' : 'outlined'}
            >
              Spot
            </Button>
          </Tooltip>
          <Tooltip title="Healing Brush">
            <Button
              startIcon={<Healing />}
              onClick={() => handleToolSelect('heal')}
              variant={activeTool === 'heal' ? 'contained' : 'outlined'}
            >
              Heal
            </Button>
          </Tooltip>
          <Tooltip title="Clone Stamp">
            <Button
              startIcon={<ContentCopy />}
              onClick={() => handleToolSelect('clone')}
              variant={activeTool === 'clone' ? 'contained' : 'outlined'}
            >
              Clone
            </Button>
          </Tooltip>
        </ButtonGroup>

        {/* Brush Settings */}
        {activeTool && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Brush Settings
            </Typography>
            <Stack spacing={2}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Size</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {brushSize}px
                  </Typography>
                </Box>
                <Slider
                  value={brushSize}
                  onChange={(_, v) => setBrushSize(v as number)}
                  min={5}
                  max={200}
                />
              </Box>

              {activeTool !== 'spot' && (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Opacity</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {opacity}%
                    </Typography>
                  </Box>
                  <Slider
                    value={opacity}
                    onChange={(_, v) => setOpacity(v as number)}
                    min={0}
                    max={100}
                  />
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {/* Active Points List */}
        {points.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Active Points ({points.length})
            </Typography>
            <Stack spacing={1}>
              {points.map((point) => (
                <Paper
                  key={point.id}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    bgcolor: selectedPoint === point.id ? 'action.selected' : 'background.paper',
                    cursor: 'pointer'}}
                  onClick={() => setSelectedPoint(point.id === selectedPoint ? null : point.id)}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Chip
                      label={point.type}
                      size="small"
                      color={point.type === 'spot' ? 'primary' : point.type === 'heal' ? 'success' : 'default'}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">
                        {point.type === 'spot' ? 'Spot Removal' :
                         point.type === 'heal' ? 'Healing Brush' : 'Clone Stamp'} at ({Math.round(point.x)}, {Math.round(point.y)})
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Size: {point.size}px
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePoint(point.id);
                      }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Box>
        )}

        {/* Instructions */}
        {activeTool && (
          <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {activeTool === 'spot' && 'Click on spots or blemishes to automatically remove them'}
              {activeTool === 'heal' && 'Click and drag to heal areas using surrounding texture'}
              {activeTool === 'clone' && 'Alt+Click to set source, then click to clone from that area'}
            </Typography>
          </Box>
        )}

        {points.length === 0 && !activeTool && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            Select a tool above to start healing or cloning
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

