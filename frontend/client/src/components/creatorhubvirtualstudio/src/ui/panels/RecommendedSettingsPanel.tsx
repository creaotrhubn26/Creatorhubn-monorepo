/**
 * Recommended Settings Panel
 * 
 * Analyzes the scene, 's lights, cameras, and lenses to provide:
 * - Recommended camera exposure settings
 * - Flash sync warnings
 * - Focus distance validation
 * - Inverse square law calculations
 * - Modifier light loss information
 */

import React, { useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Chip,
  Alert,
  AlertTitle,
  Tooltip,
  IconButton,
  Divider,
  Collapse,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Lightbulb as LightIcon,
  CameraAlt as CameraIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandIcon,
  Speed as SpeedIcon,
  Adjust as ApertureIcon,
  Iso as IsoIcon,
  Timer as ShutterIcon,
  StraightenOutlined as DistanceIcon,
  Tune as TuneIcon,
  AutoAwesome as MagicIcon,
  Refresh as RefreshIcon,
  FlashOn as FlashIcon,
} from '@mui/icons-material';
import { useNodes, useActions } from '@/state/selectors';
import { 
  exposureCalculator, 
  SceneExposureAnalysis, 
  LightSource,
  MODIFIER_LIGHT_LOSS,
} from '@/core/services/exposureCalculatorService';

// =============================================================================
// TYPES
// =============================================================================

interface LightNodeInfo {
  id: string;
  name: string;
  type: 'strobe' | 'speedlite' | 'continuous' | 'led_panel';
  power: number;
  position: [number, number, number];
  modifier?: string;
  colorTemp?: number;
  specifications?: any;
}

interface CameraNodeInfo {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  aperture: number;
  shutter: number;
  iso: number;
  focalLength: number;
  focusDistance: number;
  sensorSize: [number, number];
  attachedLens?: any;
  lensSpecs?: any;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function formatShutter(shutter: number): string {
  if (shutter >= 1) return `${shutter} "`;
  return `1/${Math.round(1 / shutter)}`;
}

function formatAperture(f: number): string {
  return `f/${f.toFixed(1)}`.replace('.0', ', ');
}

function formatDistance(meters: number): string {
  if (meters < 1) return `${Math.round(meters * 100)}cm`;
  return `${meters.toFixed(1)}m`;
}

function getEVLabel(ev: number): { label: string; color: 'success' | 'warning' | 'error' | 'info' } {
  if (ev < 0) return { label: 'Very Dark', color: 'error' };
  if (ev < 4) return { label: 'Low Light', color: 'warning' };
  if (ev < 8) return { label: 'Indoor', color: 'info' };
  if (ev < 12) return { label: 'Overcast', color: 'success' };
  if (ev < 15) return { label: 'Sunny', color: 'success' };
  return { label: 'Bright Sun', color: 'warning' };
}

// =============================================================================
// RECOMMENDED SETTINGS PANEL
// =============================================================================

export function RecommendedSettingsPanel() {
  const nodes = useNodes();
  const { updateNode } = useActions();
  const [expanded, setExpanded] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  
  // Extract lights from scene
  const lights = useMemo<LightNodeInfo[]>(() => {
    return nodes
      .filter(n => n.light && n.visible !== false)
      .map(n => {
        const userData = n.userData || {};
        const lightType = userData.lightType || 
          (userData.specifications?.guideNumber ? 'speedlite' : 
           userData.specifications?.lumens ? 'continuous' : 'strobe');
        
        // Get raw power (denormalize from 0-1)
        let power = n.light.power || 0.5;
        if (userData.wattage) {
          power = userData.wattage;
        } else if (lightType === 'strobe') {
          power = power * 1000; // Scale back to Ws
        } else if (lightType === 'continuous' || lightType === 'led_panel') {
          power = power * 600; // Scale back to W
        } else if (lightType === 'speedlite') {
          power = userData.specifications?.guideNumber || 40;
        }
        
        return {
          id: n.id,
          name: n.name,
          type: lightType as any,
          power: power,
          position: n.transform.position as [number, number, number],
          modifier: n.light.modifier,
          colorTemp: n.light.cct || userData.specifications?.colorTemp,
          specifications: userData.specifications,
        };
      });
  }, [nodes]);
  
  // Extract active camera
  const activeCamera = useMemo<CameraNodeInfo | null>(() => {
    const camNode = nodes.find(n => n.camera && n.visible !== false);
    if (!camNode?.camera) return null;
    
    return {
      id: camNode.id,
      name: camNode.name,
      brand: camNode.userData?.brand,
      model: camNode.userData?.model,
      aperture: camNode.camera.aperture || 2.8,
      shutter: camNode.camera.shutter || 1/125,
      iso: camNode.camera.iso || 100,
      focalLength: camNode.camera.focalLength || 50,
      focusDistance: camNode.userData?.focusDistance || 2,
      sensorSize: camNode.camera.sensor || [36, 24],
      attachedLens: camNode.userData?.attachedLens,
      lensSpecs: camNode.userData?.lensSpecs,
    };
  }, [nodes]);
  
  // Calculate scene exposure analysis
  const analysis = useMemo<SceneExposureAnalysis | null>(() => {
    if (lights.length === 0) return null;
    
    const lightSources: LightSource[] = lights.map(l => ({
      id: l.id,
      type: l.type,
      power: l.power,
      distance: Math.sqrt(
        l.position[0] ** 2 + 
        (l.position[1] - 1.6) ** 2 + // Assume subject at 1.6m height
        l.position[2] ** 2
      ),
      modifier: l.modifier,
      position: l.position,
      colorTemp: l.colorTemp,
      specifications: l.specifications,
    }));
    
    const cameraSettings = activeCamera ? {
      aperture: activeCamera.aperture,
      shutter: activeCamera.shutter,
      iso: activeCamera.iso,
      focalLength: activeCamera.focalLength,
      focusDistance: activeCamera.focusDistance,
      sensorSize: activeCamera.sensorSize,
      lensSpecs: activeCamera.lensSpecs,
    } : {
      aperture: 8,
      shutter: 1/125,
      iso: 100,
      focalLength: 50,
      focusDistance: 2,
      sensorSize: [36, 24] as [number, number],
    };
    
    return exposureCalculator.analyzeSceneExposure(
      lightSources,
      cameraSettings,
      [0, 1.6, 0], // Subject position
      activeCamera?.brand,
      activeCamera?.model
    );
  }, [lights, activeCamera]);
  
  // Apply recommended settings
  const applyRecommendedSettings = () => {
    if (!analysis || !activeCamera) return;
    
    const { recommendedSettings } = analysis;
    
    updateNode(activeCamera.id, {
      camera: {
        aperture: recommendedSettings.aperture,
        shutter: recommendedSettings.shutter,
        iso: recommendedSettings.iso,
      },
    });
  };
  
  // No lights in scene
  if (lights.length === 0) {
    return (
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <TuneIcon color="primary" />
          <Typography variant="subtitle1" fontWeight="medium">
            Recommended Settings
          </Typography>
        </Stack>
        <Alert severity="info">
          Add lights to your scene to get exposure recommendations.
        </Alert>
      </Paper>
    );
  }
  
  const evInfo = analysis ? getEVLabel(analysis.totalEV) : { label: 'Unknown', color: 'info' as const };
  const hasWarnings = !!(analysis?.flashSyncWarning || analysis?.focusWarning);
  
  return (
    <Paper sx={{ overflow: 'hidden' }}>
      {/* Header */}
      <Box 
        sx={{ 
          p: 2, 
          bgcolor: hasWarnings ? 'warning.dark' : 'primary.dark',
          cursor: 'pointer'}}
        onClick={() => setExpanded(!expanded)}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <MagicIcon />
          <Typography variant="subtitle1" fontWeight="medium" sx={{ flex: 1 }}>
            Recommended Settings
          </Typography>
          <Chip 
            label={evInfo.label} 
            size="small" 
            color={evInfo.color}
          />
          <ExpandIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </Stack>
      </Box>
      
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {analysis && (
            <>
              {/* Warnings */}
              {analysis.flashSyncWarning && (
                <Alert severity="error" sx={{ mb: 2 }} icon={<FlashIcon />}>
                  <AlertTitle>Flash Sync Warning</AlertTitle>
                  {analysis.flashSyncWarning}
                </Alert>
              )}
              
              {analysis.focusWarning && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <AlertTitle>Focus Distance Warning</AlertTitle>
                  {analysis.focusWarning}
                </Alert>
              )}
              
              {/* Recommended Camera Settings */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="overline" color="text.secondary">
                  Recommended Camera Settings
                </Typography>
                
                <Stack direction="row" spacing={2} mt={1} flexWrap="wrap" useFlexGap>
                  {/* Aperture */}
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 1.5, 
                      minWidth: 80, 
                      textAlign: 'center',
                      bgcolor: 'action.hover'}}
                  >
                    <ApertureIcon color="primary" fontSize="small" />
                    <Typography variant="h6" fontWeight="bold">
                      {formatAperture(analysis.recommendedSettings.aperture)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Aperture
                    </Typography>
                  </Paper>
                  
                  {/* Shutter */}
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 1.5, 
                      minWidth: 80, 
                      textAlign: 'center',
                      bgcolor: 'action.hover'}}
                  >
                    <ShutterIcon color="primary" fontSize="small" />
                    <Typography variant="h6" fontWeight="bold">
                      {formatShutter(analysis.recommendedSettings.shutter)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Shutter
                    </Typography>
                  </Paper>
                  
                  {/* ISO */}
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 1.5, 
                      minWidth: 80, 
                      textAlign: 'center',
                      bgcolor: 'action.hover'}}
                  >
                    <IsoIcon color="primary" fontSize="small" />
                    <Typography variant="h6" fontWeight="bold">
                      {analysis.recommendedSettings.iso}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ISO
                    </Typography>
                  </Paper>
                  
                  {/* EV */}
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      p: 1.5, 
                      minWidth: 80, 
                      textAlign: 'center',
                      bgcolor: 'action.hover'}}
                  >
                    <SpeedIcon color="primary" fontSize="small" />
                    <Typography variant="h6" fontWeight="bold">
                      {analysis.recommendedSettings.ev.toFixed(1)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      EV
                    </Typography>
                  </Paper>
                </Stack>
                
                {/* Apply Button */}
                {activeCamera && (
                  <Button
                    variant="contained"
                    startIcon={<MagicIcon />}
                    onClick={applyRecommendedSettings}
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Apply Recommended Settings
                  </Button>
                )}
                
                {/* Notes */}
                {analysis.recommendedSettings.notes.length > 0 && (
                  <Stack spacing={0.5} mt={2}>
                    {analysis.recommendedSettings.notes.map((note, i) => (
                      <Typography key={i} variant="caption" color="text.secondary">
                        • {note}
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              {/* Scene Lighting Summary */}
              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="overline" color="text.secondary">
                    Lighting Analysis
                  </Typography>
                  <IconButton size="small" onClick={() => setShowDetails(!showDetails)}>
                    <ExpandIcon sx={{ transform: showDetails ? 'rotate(180deg)' : 'none' }} />
                  </IconButton>
                </Stack>
                
                <Stack direction="row" spacing={3} mt={1}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Key Light
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      EV {analysis.keyLightEV.toFixed(1)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Fill Light
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      EV {analysis.fillLightEV > -Infinity ? analysis.fillLightEV.toFixed(1) : 'N/A'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Contrast Ratio
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                      {analysis.contrastRatio}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
              
              {/* Detailed Per-Light Analysis */}
              <Collapse in={showDetails}>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="overline" color="text.secondary">
                    Per-Light Analysis
                  </Typography>
                  
                  {lights.map((light) => {
                    const lightAnalysis = analysis.perLightAnalysis.get(light.id);
                    if (!lightAnalysis) return null;
                    
                    return (
                      <Paper
                        key={light.id}
                        variant="outlined"
                        sx={{ p: 1.5, mt: 1 }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                          <LightIcon fontSize="small" color="warning" />
                          <Typography variant="body2" fontWeight="medium">
                            {light.name}
                          </Typography>
                          <Chip 
                            label={light.type} 
                            size="small" 
                            variant="outlined"
                          />
                        </Stack>
                        
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell sx={{ py: 0.5, border: 0 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Power at Source
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ py: 0.5, border: 0 }}>
                                <Typography variant="caption">
                                  {light.type === 'speedlite' ? `GN ${light.power}` : `${light.power}${light.type === 'strobe' ? 'Ws' : 'W'}`}
                                </Typography>
                              </TableCell>
                            </TableRow>
                            {light.modifier && (
                              <TableRow>
                                <TableCell sx={{ py: 0.5, border: 0 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Modifier Loss
                                  </Typography>
                                </TableCell>
                                <TableCell align="right" sx={{ py: 0.5, border: 0 }}>
                                  <Typography variant="caption" color="warning.main">
                                    -{lightAnalysis.modifierLoss.toFixed(1)} stops ({light.modifier})
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )}
                            <TableRow>
                              <TableCell sx={{ py: 0.5, border: 0 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Distance Falloff
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ py: 0.5, border: 0 }}>
                                <Typography variant="caption">
                                  {lightAnalysis.falloffPercent.toFixed(0)}% loss
                                </Typography>
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell sx={{ py: 0.5, border: 0 }}>
                                <Typography variant="caption" color="text.secondary">
                                  Recommended f-stop
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ py: 0.5, border: 0 }}>
                                <Typography variant="caption" fontWeight="bold" color="primary.main">
                                  f/{lightAnalysis.fStopAt100ISO.toFixed(1)} @ ISO 100
                                </Typography>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </Paper>
                    );
                  })}
                </Box>
              </Collapse>
              
              {/* Modifier Light Loss Reference */}
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandIcon />}>
                  <Typography variant="body2">Modifier Light Loss Reference</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Table size="small">
                    <TableBody>
                      {Object.entries(MODIFIER_LIGHT_LOSS)
                        .filter(([, loss]) => loss > 0)
                        .sort((a, b) => a[1] - b[1])
                        .map(([modifier, loss]) => (
                          <TableRow key={modifier}>
                            <TableCell sx={{ py: 0.5 }}>
                              <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                                {modifier.replace(/-/g, ', ')}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ py: 0.5 }}>
                              <Chip 
                                label={`-${loss} stops`} 
                                size="small" 
                                color={loss > 1 ? 'warning' : 'default'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </AccordionDetails>
              </Accordion>
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

// =============================================================================
// INVERSE SQUARE LAW CALCULATOR (Standalone Tool)
// =============================================================================

export function InverseSquareLawCalculator() {
  const [power, setPower] = useState(500);
  const [distance1, setDistance1] = useState(1);
  const [distance2, setDistance2] = useState(2);
  
  const intensityAt1m = power;
  const intensityAtD1 = exposureCalculator.calculateIntensityAtDistance(power, distance1);
  const intensityAtD2 = exposureCalculator.calculateIntensityAtDistance(power, distance2);
  const falloff = exposureCalculator.calculateFalloff(distance1, distance2);
  
  return (
    <Paper sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <DistanceIcon color="primary" />
        <Typography variant="subtitle1" fontWeight="medium">
          Inverse Square Law Calculator
        </Typography>
      </Stack>
      
      <Typography variant="caption" color="text.secondary" display="block" mb={2}>
        Light intensity decreases with the square of the distance. 
        Double the distance = 1/4 the light (2 stops loss).
      </Typography>
      
      <Stack spacing={2}>
        <Box>
          <Typography variant="caption" color="text.secondary">
            Light Power (Ws)
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <input
              type="range"
              min={100}
              max={2000}
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <Typography variant="body2" sx={{ minWidth: 60 }}>
              {power}Ws
            </Typography>
          </Stack>
        </Box>
        
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Distance 1
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.1}
                value={distance1}
                onChange={(e) => setDistance1(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <Typography variant="body2" sx={{ minWidth: 40 }}>
                {distance1}m
              </Typography>
            </Stack>
          </Box>
          
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Distance 2
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <input
                type="range"
                min={0.5}
                max={10}
                step={0.1}
                value={distance2}
                onChange={(e) => setDistance2(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <Typography variant="body2" sx={{ minWidth: 40 }}>
                {distance2}m
              </Typography>
            </Stack>
          </Box>
        </Stack>
        
        <Divider />
        
        <Stack direction="row" spacing={2}>
          <Paper variant="outlined" sx={{ p: 1.5, flex: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Intensity @ {distance1}m
            </Typography>
            <Typography variant="h6">
              {intensityAtD1.toFixed(0)}
            </Typography>
          </Paper>
          
          <Paper variant="outlined" sx={{ p: 1.5, flex: 1, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Intensity @ {distance2}m
            </Typography>
            <Typography variant="h6">
              {intensityAtD2.toFixed(0)}
            </Typography>
          </Paper>
          
          <Paper variant="outlined" sx={{ p: 1.5, flex: 1, textAlign: 'center', bgcolor: 'warning.dark' }}>
            <Typography variant="caption" color="text.secondary">
              Light Loss
            </Typography>
            <Typography variant="h6">
              {Math.abs(falloff).toFixed(1)} stops
            </Typography>
          </Paper>
        </Stack>
        
        <Alert severity="info" icon={<LightIcon />}>
          Moving from {distance1}m to {distance2}m {falloff < 0 ? 'loses' : 'gains'} {Math.abs(falloff).toFixed(1)} stops of light.
          {Math.abs(falloff) > 1 &&' Consider adjusting your light power or camera settings.'}
        </Alert>
      </Stack>
    </Paper>
  );
}

export default RecommendedSettingsPanel;

