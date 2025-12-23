/**
 * Lens Effects Preview Component
 * 
 * Shows visual preview of lens optical characteristics:
 * - Vignetting visualization
 * - Distortion preview
 * - Controls for adjusting effects
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Slider,
  Switch,
  FormControlLabel,
  Chip,
  Divider,
  Tooltip,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  Circle as LensIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ExpandMore as ExpandIcon,
  RestartAlt as ResetIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useNodes } from '@/state/selectors';
import { LensEffectsParams, DEFAULT_LENS_EFFECTS, lensSpecToEffects, drawVignetteOverlay } from '@/core/rendering/LensEffectsRenderer';

// =============================================================================
// VIGNETTE CANVAS PREVIEW
// =============================================================================

interface VignettePreviewProps {
  vignetting: number;
  width?: number;
  height?: number;
  showGrid?: boolean;
}

function VignetteCanvas({ vignetting, width = 200, height = 150, showGrid = true }: VignettePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Draw grid background
    if (showGrid) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, width, height);
      
      ctx.strokeStyle = '#2a2a4e';
      ctx.lineWidth = 1;
      const gridSize = 20;
      
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    
    // Draw center circle
    ctx.strokeStyle = '#4a4a6e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * 0.35, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw vignette
    drawVignetteOverlay(ctx, width, height, { vignetting });
    
  }, [vignetting, width, height, showGrid]);
  
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: '100%',
        height: 'auto',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)'}}
    />
  );
}

// =============================================================================
// DISTORTION PREVIEW
// =============================================================================

interface DistortionPreviewProps {
  distortion: number;
  width?: number;
  height?: number;
}

function DistortionCanvas({ distortion, width = 200, height = 150 }: DistortionPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const gridSize = 30;
    
    ctx.strokeStyle = '#4a8af4';
    ctx.lineWidth = 1.5;
    
    // Draw distorted grid
    for (let gx = -5; gx <= 5; gx++) {
      ctx.beginPath();
      for (let gy = -5; gy <= 5; gy++) {
        const x = centerX + gx * gridSize;
        const y = centerY + gy * gridSize;
        
        // Apply distortion
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        const normalizedDist = dist / maxDist;
        
        const factor = 1 + distortion * normalizedDist * normalizedDist * 0.5;
        const distX = centerX + dx * factor;
        const distY = centerY + dy * factor;
        
        if (gy === -5) {
          ctx.moveTo(distX, distY);
        } else {
          ctx.lineTo(distX, distY);
        }
      }
      ctx.stroke();
    }
    
    for (let gy = -5; gy <= 5; gy++) {
      ctx.beginPath();
      for (let gx = -5; gx <= 5; gx++) {
        const x = centerX + gx * gridSize;
        const y = centerY + gy * gridSize;
        
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        const normalizedDist = dist / maxDist;
        
        const factor = 1 + distortion * normalizedDist * normalizedDist * 0.5;
        const distX = centerX + dx * factor;
        const distY = centerY + dy * factor;
        
        if (gx === -5) {
          ctx.moveTo(distX, distY);
        } else {
          ctx.lineTo(distX, distY);
        }
      }
      ctx.stroke();
    }
    
  }, [distortion, width, height]);
  
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        width: '100%',
        height: 'auto',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.1)'}}
    />
  );
}

// =============================================================================
// LENS EFFECTS PREVIEW PANEL
// =============================================================================

interface LensEffectsPreviewProps {
  onEffectsChange?: (effects: Partial<LensEffectsParams>) => void;
}

export function LensEffectsPreview({ onEffectsChange }: LensEffectsPreviewProps) {
  const nodes = useNodes();
  const [expanded, setExpanded] = useState(true);
  const [enabled, setEnabled] = useState(true);
  
  // Get active camera's lens specs
  const activeCamera = useMemo(() => {
    return nodes.find(n => n.camera && n.visible !== false);
  }, [nodes]);
  
  const lensSpecs = activeCamera?.userData?.lensSpecs;
  const attachedLens = activeCamera?.userData?.attachedLens;
  
  // Derive effects from lens specs or use defaults
  const baseEffects = useMemo(() => {
    if (lensSpecs) {
      return lensSpecToEffects(lensSpecs);
    }
    return DEFAULT_LENS_EFFECTS;
  }, [lensSpecs]);
  
  // Local state for adjustments
  const [effects, setEffects] = useState<LensEffectsParams>(baseEffects);
  
  // Update when lens changes
  useEffect(() => {
    setEffects(baseEffects);
  }, [baseEffects]);
  
  const handleEffectChange = (key: keyof LensEffectsParams, value: number | boolean) => {
    const newEffects = { ...effects, [key]: value };
    setEffects(newEffects);
    onEffectsChange?.(newEffects);
  };
  
  const handleReset = () => {
    setEffects(baseEffects);
    onEffectsChange?.(baseEffects);
  };
  
  return (
    <Paper sx={{ overflow: 'hidden' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          bgcolor: 'primary.dark',
          cursor: 'pointer'}}
        onClick={() => setExpanded(!expanded)}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <LensIcon />
          <Typography variant="subtitle1" fontWeight="medium" sx={{ flex: 1 }}>
            Lens Effects
          </Typography>
          {attachedLens && (
            <Chip
              label={`${attachedLens.brand} ${attachedLens.model}`}
              size="small"
              color="info"
            />
          )}
          <ExpandIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </Stack>
      </Box>
      
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {/* Enable/Disable Toggle */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  size="small"
                />
              }
              label="Enable Lens Effects"
            />
            <Tooltip title="Reset to lens defaults">
              <IconButton size="small" onClick={handleReset}>
                <ResetIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          
          {!attachedLens && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <InfoIcon fontSize="small" color="info" />
                <Typography variant="caption" color="text.secondary">
                  Attach a lens to your camera for accurate optical simulation
                </Typography>
              </Stack>
            </Box>
          )}
          
          {/* Vignetting Section */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="body2" fontWeight="medium">
                Vignetting
              </Typography>
              <Chip
                label={`${(effects.vignetting * 100).toFixed(0)}%`}
                size="small"
                color={effects.vignetting > 0.5 ? 'warning' : 'default'}
              />
            </Stack>
            
            <VignetteCanvas vignetting={enabled ? effects.vignetting : 0} />
            
            <Slider
              value={effects.vignetting}
              onChange={(_, v) => handleEffectChange('vignetting', v as number)}
              min={0}
              max={1}
              step={0.05}
              disabled={!enabled}
              sx={{ mt: 1 }}
              marks={[
                { value: 0, label: 'None' },
                { value: 0.3, label: 'Normal' },
                { value: 0.7, label: 'Heavy' },
              ]}
            />
            
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Corner light falloff typical in wide aperture shots.
              {lensSpecs?.vignetting && ` This lens: ${(lensSpecs.vignetting * 100).toFixed(0)}% natural vignetting.`}
            </Typography>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {/* Distortion Section */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="body2" fontWeight="medium">
                Distortion
              </Typography>
              <Chip
                label={
                  effects.distortion < -0.05 ? 'Barrel' :
                  effects.distortion > 0.05 ? 'Pincushion' : 'None'
                }
                size="small"
                color={Math.abs(effects.distortion) > 0.1 ? 'warning' : 'default'}
              />
            </Stack>
            
            <DistortionCanvas distortion={enabled ? effects.distortion : 0} />
            
            <Slider
              value={effects.distortion}
              onChange={(_, v) => handleEffectChange('distortion', v as number)}
              min={-0.5}
              max={0.5}
              step={0.02}
              disabled={!enabled}
              sx={{ mt: 1 }}
              marks={[
                { value: -0.3, label: 'Barrel' },
                { value: 0, label: 'None' },
                { value: 0.3, label: 'Pincushion' },
              ]}
            />
            
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Wide-angle lenses show barrel distortion; telephotos show pincushion.
            </Typography>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {/* Chromatic Aberration */}
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="body2" fontWeight="medium">
                Chromatic Aberration
              </Typography>
              <Chip
                label={effects.chromaticAberration > 0.05 ? 'Visible' : 'Minimal'}
                size="small"
                color={effects.chromaticAberration > 0.05 ? 'warning' : 'success'}
              />
            </Stack>
            
            <Slider
              value={effects.chromaticAberration}
              onChange={(_, v) => handleEffectChange('chromaticAberration', v as number)}
              min={0}
              max={0.15}
              step={0.01}
              disabled={!enabled}
              marks={[
                { value: 0, label: 'None' },
                { value: 0.05, label: 'Low' },
                { value: 0.1, label: 'High' },
              ]}
            />
            
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Color fringing at high-contrast edges. Premium lenses minimize this.
            </Typography>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          
          {/* Lens Info */}
          {lensSpecs && (
            <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="overline" color="text.secondary">
                Lens Optical Data
              </Typography>
              <Stack direction="row" spacing={2} mt={1} flexWrap="wrap" useFlexGap>
                {lensSpecs.elements && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Elements</Typography>
                    <Typography variant="body2">{lensSpecs.elements}</Typography>
                  </Box>
                )}
                {lensSpecs.groups && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Groups</Typography>
                    <Typography variant="body2">{lensSpecs.groups}</Typography>
                  </Box>
                )}
                {lensSpecs.apertureBlades && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Aperture Blades</Typography>
                    <Typography variant="body2">{lensSpecs.apertureBlades}</Typography>
                  </Box>
                )}
                {lensSpecs.bokehQuality && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Bokeh Quality</Typography>
                    <Typography variant="body2">{(lensSpecs.bokehQuality * 100).toFixed(0)}%</Typography>
                  </Box>
                )}
                {effects.transmissionFactor && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">Light Transmission</Typography>
                    <Typography variant="body2">{(effects.transmissionFactor * 100).toFixed(1)}%</Typography>
                  </Box>
                )}
              </Stack>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default LensEffectsPreview;

