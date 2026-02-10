/**
 * MASK TOOLBAR
 * Lightroom-style local adjustment masks
 * Gradient, Radial, Brush masks with overlay visualization
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonGroup,
  Stack,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Chip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Gradient,
  RadioButtonUnchecked,
  Brush,
  Visibility,
  VisibilityOff,
  Delete,
  Refresh,
  AutoAwesome,
} from '@mui/icons-material';
import { useTheming } from '../../utils/theming-helper';
import { sam2Service, type SAM2SegmentationResult } from '@/services/SAM2Service';
import { useMutation } from '@tanstack/react-query';

export type MaskType = 'gradient' | 'radial' | 'brush' | 'range';

export interface Mask {
  id: string;
  type: MaskType;
  enabled: boolean;
  invert: boolean;
  feather: number; // 0-100
  density: number; // 0-100
  adjustments: {
    exposure?: number;
    contrast?: number;
    highlights?: number;
    shadows?: number;
    whites?: number;
    blacks?: number;
    saturation?: number;
    clarity?: number;
    sharpness?: number;
  };
  // Position data (varies by mask type)
  position?: {
    // Gradient
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    angle?: number;
    // Radial
    centerX?: number;
    centerY?: number;
    radius?: number;
    // Brush
    points?: Array<{ x: number; y: number; size: number }>;
    // Range
    luminanceRange?: { min: number; max: number };
    colorRange?: { hue: number; saturation: number; tolerance: number };
  };
}

interface MaskToolbarProps {
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  onMaskChange?: (masks: Mask[]) => void;
  initialMasks?: Mask[];
  profession?: 'photographer' | 'videographer' | 'music_producer' | 'vendor' | 'enterprise';
}

export default function MaskToolbar({
  imageUrl,
  imageWidth = 800,
  imageHeight = 600,
  onMaskChange,
  initialMasks = [],
  profession = 'photographer',
}: MaskToolbarProps) {
  const theming = useTheming(profession);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeMaskType, setActiveMaskType] = useState<MaskType | null>(null);
  const [masks, setMasks] = useState<Mask[]>(initialMasks);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(50);
  const [feather, setFeather] = useState(50);
  const [density, setDensity] = useState(100);
  const [isAISelecting, setIsAISelecting] = useState(false);
  const [aiSelectionResult, setAISelectionResult] = useState<SAM2SegmentationResult | null>(null);

  const selectedMask = masks.find((m) => m.id === selectedMaskId);

  // AI Selection mutation
  const aiSelectionMutation = useMutation({
    mutationFn: async (clickPoint: { x: number; y: number }) => {
      if (!imageUrl) {
        throw new Error('Image URL is required for AI selection ');
      }
      
      setIsAISelecting(true);
      try {
        const result = await sam2Service.segmentImageFromUrl(
          imageUrl,
          { points: [[clickPoint.x, clickPoint.y]] }, 'point','small'
        );
        setAISelectionResult(result);
        return result;
      } finally {
        setIsAISelecting(false);
      }
    },
    onSuccess: (result) => {
      // Create mask from first segmentation result
      if (result.masks && result.masks.length > 0) {
        const firstMask = result.masks[0];
        const newMask: Mask = {
          id: `mask_ai_${Date.now()}`,
          type: 'brush', // AI masks are treated as brush masks
          enabled: true,
          invert: false,
          feather: 50,
          density: 100,
          adjustments: {},
          position: {
            points: [], // Will be populated from mask data
          },
        };

        // Convert mask base64 to points (simplified - in production use proper mask processing)
        // For now, use the bounding box to create a radial mask
        if (firstMask.bbox) {
          const [x, y, w, h] = firstMask.bbox;
          newMask.position = {
            centerX: x + w / 2,
            centerY: y + h / 2,
            radius: Math.max(w, h) / 2,
          };
        }

        setMasks((prev) => {
          const updated = [...prev, newMask];
          onMaskChange?.(updated);
          return updated;
        });

        setSelectedMaskId(newMask.id);
        setActiveMaskType('brush');
      }
    },
    onError: (error: any) => {
      console.error('AI selection failed: ', error);
      // Could show error toast here
    },
  });

  // Create new mask
  const handleCreateMask = useCallback(
    (type: MaskType) => {
      const newMask: Mask = {
        id: `mask_${Date.now()}`,
        type,
        enabled: true,
        invert: false,
        feather: 50,
        density: 100,
        adjustments: {},
        position: {},
      };

      setMasks((prev) => {
        const updated = [...prev, newMask];
        onMaskChange?.(updated);
        return updated;
      });

      setSelectedMaskId(newMask.id);
      setActiveMaskType(type);
    },
    [onMaskChange]
  );

  // Update mask adjustments
  const handleAdjustmentChange = useCallback(
    (maskId: string, adjustment: string, value: number) => {
      setMasks((prev) => {
        const updated = prev.map((mask) => {
          if (mask.id === maskId) {
            return {
              ...mask,
              adjustments: {
                ...mask.adjustments,
                [adjustment]: value,
              },
            };
          }
          return mask;
        });
        onMaskChange?.(updated);
        return updated;
      });
    },
    [onMaskChange]
  );

  // Update mask properties
  const handleMaskPropertyChange = useCallback(
    (maskId: string, property: keyof Mask, value: any) => {
      setMasks((prev) => {
        const updated = prev.map((mask) => {
          if (mask.id === maskId) {
            return { ...mask, [property]: value };
          }
          return mask;
        });
        onMaskChange?.(updated);
        return updated;
      });
    },
    [onMaskChange]
  );

  // Delete mask
  const handleDeleteMask = useCallback(
    (maskId: string) => {
      setMasks((prev) => {
        const updated = prev.filter((m) => m.id !== maskId);
        onMaskChange?.(updated);
        return updated;
      });
      if (selectedMaskId === maskId) {
        setSelectedMaskId(null);
        setActiveMaskType(null);
      }
    },
    [selectedMaskId, onMaskChange]
  );

  // Draw mask overlay on canvas
  const drawMaskOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !showOverlay) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    masks
      .filter((m) => m.enabled && m.id === selectedMaskId)
      .forEach((mask) => {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = mask.invert ? '#ff0000' : '#00ff00';

        if (mask.type === 'gradient' && mask.position) {
          const { startX = 0, startY = 0, endX = 100, endY = 100 } = mask.position;
          const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
          gradient.addColorStop(0, mask.invert ? 'rgba(255,0,0,0.5)' : 'rgba(0,255,0,0.5)');
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (mask.type === 'radial' && mask.position) {
          const { centerX = canvas.width / 2, centerY = canvas.height / 2, radius = 100 } = mask.position;
          const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
          gradient.addColorStop(0, mask.invert ? 'rgba(255,0,0,0.5)' : 'rgba(0,255,0,0.5)');
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (mask.type === 'brush' && mask.position?.points) {
          ctx.strokeStyle = mask.invert ? '#ff0000' : '#00ff00';
          ctx.lineWidth = 2;
          mask.position.points.forEach((point) => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, point.size / 2, 0, Math.PI * 2);
            ctx.stroke();
          });
        }

        ctx.restore();
      });
  }, [masks, selectedMaskId, showOverlay]);

  useEffect(() => {
    drawMaskOverlay();
  }, [drawMaskOverlay]);

  return (
    <Paper sx={{ p: 3,...theming.getThemedCardSx() }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ color: theming.colors.primary }}>
            Local Adjustments (Masks)
          </Typography>
          <FormControlLabel
            control={
              <Switch checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} size="small" />
            }
            label="Show Overlay"
          />
        </Box>

        {/* Mask Type Buttons */}
        <ButtonGroup fullWidth variant="outlined" size="small">
          <Tooltip title="Linear Gradient Mask">
            <Button
              startIcon={<Gradient />}
              onClick={() => handleCreateMask('gradient')}
              variant={activeMaskType === 'gradient' ? 'contained' : 'outlined'}
            >
              Gradient
            </Button>
          </Tooltip>
          <Tooltip title="Radial Mask">
            <Button
              startIcon={<RadioButtonUnchecked />}
              onClick={() => handleCreateMask('radial')}
              variant={activeMaskType === 'radial' ? 'contained' : 'outlined'}
            >
              Radial
            </Button>
          </Tooltip>
          <Tooltip title="Brush Mask">
            <Button
              startIcon={<Brush />}
              onClick={() => handleCreateMask('brush')}
              variant={activeMaskType === 'brush' ? 'contained' : 'outlined'}
            >
              Brush
            </Button>
          </Tooltip>
          <Tooltip title="Range Mask (Auto)">
            <Button
              startIcon={<AutoAwesome />}
              onClick={() => handleCreateMask('range')}
              variant={activeMaskType === 'range' ? 'contained' : 'outlined'}
            >
              Range
            </Button>
          </Tooltip>
          <Tooltip title="AI Select (SAM 2)">
            <Button
              startIcon={<AutoAwesome />}
              onClick={() => {
                setActiveMaskType(null);
                // AI selection will be triggered on image click
              }}
              variant={activeMaskType === null && !isAISelecting ? 'contained' : 'outlined'}
              disabled={!imageUrl || isAISelecting}
            >
              {isAISelecting ? 'Selecting...' : 'AI Select'}
            </Button>
          </Tooltip>
        </ButtonGroup>

        {/* Mask Canvas Overlay */}
        {imageUrl && (
          <Box sx={{ position: 'relative', border: '1px solid #444', borderRadius: 1 }}>
            <img
              src={imageUrl}
              alt="Mask preview"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
            <canvas
              ref={canvasRef}
              width={imageWidth}
              height={imageHeight}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: (activeMaskType || isAISelecting) ? 'auto' : 'none',
                cursor: (activeMaskType === 'brush' || isAISelecting) ? 'crosshair' : 'default'}}
              onClick={async (e) => {
                if (isAISelecting || (!activeMaskType && imageUrl)) {
                  const rect = canvasRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = ((e.clientX - rect.left) / rect.width) * imageWidth;
                    const y = ((e.clientY - rect.top) / rect.height) * imageHeight;
                    aiSelectionMutation.mutate({ x, y });
                  }
                } else if (activeMaskType === 'brush') {
                  // Existing brush drawing logic
                  const rect = canvasRef.current?.getBoundingClientRect();
                  if (rect && selectedMaskId) {
                    const x = ((e.clientX - rect.left) / rect.width) * imageWidth;
                    const y = ((e.clientY - rect.top) / rect.height) * imageHeight;
                    // Add point to brush mask
                    handleMaskPropertyChange(selectedMaskId, 'position', {
                      ...selectedMask?.position,
                      points: [
                        ...(selectedMask?.position?.points || []),
                        { x, y, size: brushSize },
                      ],
                    });
                  }
                }
              }}
            />
          </Box>
        )}

        {/* Active Masks List */}
        {masks.length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Active Masks ({masks.length})
            </Typography>
            <Stack spacing={1}>
              {masks.map((mask) => (
                <Paper
                  key={mask.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    bgcolor: selectedMaskId === mask.id ? 'action.selected' : 'background.paper',
                    cursor: 'pointer'}}
                  onClick={() => {
                    setSelectedMaskId(mask.id);
                    setActiveMaskType(mask.type);
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Chip
                      label={mask.type}
                      size="small"
                      color={mask.enabled ? 'primary' : 'default'}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2">
                        {mask.type.charAt(0).toUpperCase() + mask.type.slice(1)} Mask
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Feather: {mask.feather}% | Density: {mask.density}%
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMask(mask.id);
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

        {/* Selected Mask Adjustments */}
        {selectedMask && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Adjustments for {selectedMask.type} mask
            </Typography>

            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedMask.enabled}
                    onChange={(e) =>
                      handleMaskPropertyChange(selectedMask.id, 'enabled', e.target.checked)
                    }
                  />
                }
                label="Enable Mask"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedMask.invert}
                    onChange={(e) =>
                      handleMaskPropertyChange(selectedMask.id, 'invert', e.target.checked)
                    }
                  />
                }
                label="Invert Mask"
              />

              <Box>
                <Typography variant="body2" gutterBottom>
                  Feather: {feather}%
                </Typography>
                <Slider
                  value={feather}
                  onChange={(_, v) => {
                    setFeather(v as number);
                    handleMaskPropertyChange(selectedMask.id, 'feather', v);
                  }}
                  min={0}
                  max={100}
                />
              </Box>

              <Box>
                <Typography variant="body2" gutterBottom>
                  Density: {density}%
                </Typography>
                <Slider
                  value={density}
                  onChange={(_, v) => {
                    setDensity(v as number);
                    handleMaskPropertyChange(selectedMask.id, 'density', v);
                  }}
                  min={0}
                  max={100}
                />
              </Box>

              {/* Adjustment Sliders */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Adjustments
                </Typography>
                <Stack spacing={2}>
                  {[
                    { key: 'exposure', label: 'Exposure', min: -200, max: 200 },
                    { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
                    { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
                    { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
                    { key: 'whites', label: 'Whites', min: -100, max: 100 },
                    { key: 'blacks', label: 'Blacks', min: -100, max: 100 },
                    { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
                    { key: 'clarity', label: 'Clarity', min: -100, max: 100 },
                    { key: 'sharpness', label: 'Sharpness', min: 0, max: 100 },
                  ].map((adj) => {
                    const value = selectedMask.adjustments[adj.key as keyof typeof selectedMask.adjustments] || 0;
                    return (
                      <Box key={adj.key}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">{adj.label}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {value > 0 ? '+' : ', '}{value}
                          </Typography>
                        </Box>
                        <Slider
                          value={value}
                          onChange={(_, v) =>
                            handleAdjustmentChange(selectedMask.id, adj.key, v as number)
                          }
                          min={adj.min}
                          max={adj.max}
                          size="small"
                        />
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            </Stack>
          </Box>
        )}

        {masks.length === 0 && !isAISelecting && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            Click a mask type above to create a local adjustment
            <br />
            Or use "AI Select" and click on an object in the image
          </Typography>
        )}
        
        {isAISelecting && (
          <Typography variant="body2" color="primary" sx={{ textAlign: 'center', py: 2 }}>
            Click on an object in the image to select it with AI
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

