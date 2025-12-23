/**
 * Light-Lens Integration Panel
 * 
 * Master panel for all light, lens, and camera integration features:
 * - Scene exposure analysis
 * - Recommended camera settings
 * - Lens attachment manager
 * - Flash sync warnings
 * - Focus validation
 * - Inverse square calculator
 * - Lens effects preview
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Tabs,
  Tab,
  Chip,
  Alert,
  AlertTitle,
  Button,
  Divider,
  Collapse,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Lightbulb as LightIcon,
  CameraAlt as CameraIcon,
  Circle as LensIcon,
  Warning as WarningIcon,
  AutoAwesome as MagicIcon,
  Calculate as CalcIcon,
  Tune as TuneIcon,
  ExpandMore as ExpandIcon,
  Link as LinkIcon,
  FlashOn as FlashIcon,
  Straighten as DistanceIcon,
  Visibility as ViewIcon,
  MovieFilter as PatternIcon,
  Hub as HubIcon,
} from '@mui/icons-material';
import { useLightLensIntegration } from '@/hooks/useLightLensIntegration';
import { RecommendedSettingsPanel, InverseSquareLawCalculator } from './RecommendedSettingsPanel';
import { LensAttachmentManager } from '@/ui/components/LensAttachmentManager';
import { LensEffectsPreview } from '@/ui/components/LensEffectsPreview';
import { PatternExposurePanel } from './PatternExposurePanel';
import { MasterIntegrationPanel } from './MasterIntegrationPanel';

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ display: value === index ? 'block' : 'none' }}
    >
      {value === index && children}
    </Box>
  );
}

function formatShutter(shutter: number): string {
  if (shutter >= 1) return `${shutter}"`;
  return `1/${Math.round(1 / shutter)}`;
}

// =============================================================================
// QUICK STATUS CARD
// =============================================================================

function QuickStatusCard() {
  const { lights, camera, sceneAnalysis } = useLightLensIntegration();
  
  const hasWarnings = Object.keys(sceneAnalysis.warnings).length > 0;
  const warningCount = Object.values(sceneAnalysis.warnings).flat().filter(Boolean).length;
  
  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        {/* Lights */}
        <Tooltip title={`${lights.length} light${lights.length !== 1 ? 's' : ','} in scene`}>
          <Chip
            icon={<LightIcon />}
            label={lights.length}
            color={lights.length > 0 ? 'warning' : 'default'}
            size="small"
          />
        </Tooltip>
        
        {/* Camera */}
        <Tooltip title={camera ? `${camera.brand} ${camera.model}` : 'No camera'}>
          <Chip
            icon={<CameraIcon />}
            label={camera ? camera.name : 'None'}
            color={camera ? 'primary' : 'default'}
            size="small"
          />
        </Tooltip>
        
        {/* Lens */}
        {camera?.attachedLens && (
          <Tooltip title={`${camera.attachedLens.brand} ${camera.attachedLens.model}`}>
            <Chip
              icon={<LensIcon />}
              label={camera.attachedLens.model}
              color="info"
              size="small"
            />
          </Tooltip>
        )}
        
        {/* EV */}
        <Tooltip title="Scene Exposure Value">
          <Chip
            label={`EV ${sceneAnalysis.totalEV.toFixed(1)}`}
            size="small"
            variant="outlined"
          />
        </Tooltip>
        
        {/* Contrast */}
        {sceneAnalysis.contrastRatio !== 'N/A' && (
          <Tooltip title="Key-to-Fill Contrast Ratio">
            <Chip
              label={sceneAnalysis.contrastRatio}
              size="small"
              variant="outlined"
            />
          </Tooltip>
        )}
        
        {/* Warnings */}
        {hasWarnings && (
          <Badge badgeContent={warningCount} color="error">
            <Chip
              icon={<WarningIcon />}
              label="Warnings"
              color="error"
              size="small"
              variant="outlined"
            />
          </Badge>
        )}
      </Stack>
    </Paper>
  );
}

// =============================================================================
// WARNINGS PANEL
// =============================================================================

function WarningsPanel() {
  const { sceneAnalysis, validateFlashSync, validateFocusDistance } = useLightLensIntegration();
  const { warnings } = sceneAnalysis;
  
  const hasWarnings = Object.keys(warnings).some(key => warnings[key as keyof typeof warnings]);
  
  if (!hasWarnings) return null;
  
  return (
    <Box sx={{ mb: 2 }}>
      {warnings.flashSync && (
        <Alert severity="error" sx={{ mb: 1 }} icon={<FlashIcon />}>
          <AlertTitle>Flash Sync Issue</AlertTitle>
          {warnings.flashSync}
        </Alert>
      )}
      
      {warnings.focusDistance && (
        <Alert severity="warning" sx={{ mb: 1 }} icon={<DistanceIcon />}>
          <AlertTitle>Focus Distance Warning</AlertTitle>
          {warnings.focusDistance}
        </Alert>
      )}
      
      {warnings.mountCompatibility && (
        <Alert severity="warning" sx={{ mb: 1 }} icon={<LinkIcon />}>
          <AlertTitle>Mount Compatibility</AlertTitle>
          {warnings.mountCompatibility}
        </Alert>
      )}
      
      {warnings.exposure && warnings.exposure.length > 0 && (
        <Alert severity="info" sx={{ mb: 1 }}>
          <AlertTitle>Exposure Notes</AlertTitle>
          {warnings.exposure.map((w, i) => (
            <Typography key={i} variant="body2">• {w}</Typography>
          ))}
        </Alert>
      )}
    </Box>
  );
}

// =============================================================================
// QUICK SETTINGS SUMMARY
// =============================================================================

function QuickSettingsSummary() {
  const { camera, sceneAnalysis, applyRecommendedSettings } = useLightLensIntegration();
  const { recommendedSettings } = sceneAnalysis;
  
  return (
    <Paper sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <MagicIcon color="primary" />
        <Typography variant="subtitle2" sx={{ flex: 1 }}>
          Quick Recommendation
        </Typography>
        <Button
          size="small"
          variant="contained"
          onClick={applyRecommendedSettings}
          disabled={!camera}
          startIcon={<MagicIcon />}
        >
          Apply
        </Button>
      </Stack>
      
      <Stack direction="row" spacing={3} justifyContent="space-around">
        <Box textAlign="center">
          <Typography variant="h5" fontWeight="bold" color="primary">
            f/{recommendedSettings.aperture}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Aperture
          </Typography>
        </Box>
        <Box textAlign="center">
          <Typography variant="h5" fontWeight="bold" color="primary">
            {formatShutter(recommendedSettings.shutter)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Shutter
          </Typography>
        </Box>
        <Box textAlign="center">
          <Typography variant="h5" fontWeight="bold" color="primary">
            {recommendedSettings.iso}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ISO
          </Typography>
        </Box>
      </Stack>
      
      {!camera && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={1}>
          Add a camera to apply settings
        </Typography>
      )}
    </Paper>
  );
}

// =============================================================================
// LIGHT LIST
// =============================================================================

function LightsList() {
  const { lights, getModifierLoss } = useLightLensIntegration();
  
  if (lights.length === 0) {
    return (
      <Alert severity="info">
        No lights in scene. Add lights from the Equipment Browser.
      </Alert>
    );
  }
  
  return (
    <Stack spacing={1}>
      {lights.map(light => (
        <Paper key={light.id} variant="outlined" sx={{ p: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <LightIcon color="warning" fontSize="small" />
            <Typography variant="body2" fontWeight="medium" sx={{ flex: 1 }}>
              {light.name}
            </Typography>
            <Chip label={light.type} size="small" variant="outlined" />
          </Stack>
          
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Box>
              <Typography variant="caption" color="text.secondary">Power</Typography>
              <Typography variant="body2">
                {light.type === 'speedlite' ? `GN ${light.power}` : `${light.power}${light.type === 'strobe' ? 'Ws' : 'W'}`}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Distance</Typography>
              <Typography variant="body2">{light.distance.toFixed(1)}m</Typography>
            </Box>
            {light.modifier && (
              <Box>
                <Typography variant="caption" color="text.secondary">Modifier</Typography>
                <Typography variant="body2" color="warning.main">
                  {light.modifier} (-{light.modifierLoss.toFixed(1)} stops)
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">Rec. f-stop</Typography>
              <Typography variant="body2" color="primary.main" fontWeight="bold">
                f/{light.recommendedFStop.toFixed(1)}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

// =============================================================================
// CAMERA INFO
// =============================================================================

function CameraInfo() {
  const { camera, attachLens, detachLens } = useLightLensIntegration();
  const [showLensManager, setShowLensManager] = useState(false);
  
  if (!camera) {
    return (
      <Alert severity="info">
        No camera in scene. Add a camera from the Equipment Browser.
      </Alert>
    );
  }
  
  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <CameraIcon color="primary" />
          <Typography variant="body1" fontWeight="medium" sx={{ flex: 1 }}>
            {camera.brand} {camera.model}
          </Typography>
          <Chip label={camera.mount?.toUpperCase()} size="small" />
        </Stack>
        
        <Stack direction="row" spacing={2} mb={2} flexWrap="wrap" useFlexGap>
          <Box>
            <Typography variant="caption" color="text.secondary">Aperture</Typography>
            <Typography variant="body2">f/{camera.aperture}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Shutter</Typography>
            <Typography variant="body2">{formatShutter(camera.shutter)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">ISO</Typography>
            <Typography variant="body2">{camera.iso}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Focal Length</Typography>
            <Typography variant="body2">{camera.focalLength}mm</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">EV</Typography>
            <Typography variant="body2">{camera.ev.toFixed(1)}</Typography>
          </Box>
        </Stack>
        
        <Divider sx={{ my: 1 }} />
        
        {/* Lens Section */}
        <Stack direction="row" alignItems="center" spacing={1}>
          <LensIcon fontSize="small" />
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {camera.attachedLens ? 
              `${camera.attachedLens.brand} ${camera.attachedLens.model}` : 
              'No lens attached'
            }
          </Typography>
          <Button
            size="small"
            variant={camera.attachedLens ? 'text' : 'outlined'}
            onClick={() => setShowLensManager(true)}
            startIcon={<LinkIcon />}
          >
            {camera.attachedLens ? 'Change' : 'Attach Lens'}
          </Button>
        </Stack>
      </Paper>
      
      {/* Lens Manager Dialog */}
      <Collapse in={showLensManager}>
        <Box sx={{ mt: 2 }}>
          <LensAttachmentManager 
            cameraNodeId={camera.id} 
            onClose={() => setShowLensManager(false)}
          />
        </Box>
      </Collapse>
    </Box>
  );
}

// =============================================================================
// MAIN PANEL
// =============================================================================

export function LightLensIntegrationPanel() {
  const [activeTab, setActiveTab] = useState(0);
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Quick Status */}
      <QuickStatusCard />
      
      {/* Warnings */}
      <WarningsPanel />
      
      {/* Quick Settings */}
      <QuickSettingsSummary />
      
      {/* Tabs */}
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<TuneIcon />} label="Exposure" iconPosition="start" />
          <Tab icon={<PatternIcon />} label="Patterns" iconPosition="start" />
          <Tab icon={<HubIcon />} label="Hub" iconPosition="start" />
          <Tab icon={<LightIcon />} label="Lights" iconPosition="start" />
          <Tab icon={<CameraIcon />} label="Camera" iconPosition="start" />
          <Tab icon={<ViewIcon />} label="Lens FX" iconPosition="start" />
          <Tab icon={<CalcIcon />} label="Calculator" iconPosition="start" />
        </Tabs>
        
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {/* Exposure Tab */}
          <TabPanel value={activeTab} index={0}>
            <RecommendedSettingsPanel />
          </TabPanel>
          
          {/* Patterns Tab */}
          <TabPanel value={activeTab} index={1}>
            <PatternExposurePanel />
          </TabPanel>
          
          {/* Master Integration Hub Tab */}
          <TabPanel value={activeTab} index={2}>
            <MasterIntegrationPanel />
          </TabPanel>
          
          {/* Lights Tab */}
          <TabPanel value={activeTab} index={3}>
            <LightsList />
          </TabPanel>
          
          {/* Camera Tab */}
          <TabPanel value={activeTab} index={4}>
            <CameraInfo />
          </TabPanel>
          
          {/* Lens Effects Tab */}
          <TabPanel value={activeTab} index={5}>
            <LensEffectsPreview />
          </TabPanel>
          
          {/* Calculator Tab */}
          <TabPanel value={activeTab} index={6}>
            <InverseSquareLawCalculator />
          </TabPanel>
        </Box>
      </Paper>
    </Box>
  );
}

// =============================================================================
// COMPACT VERSION (for toolbar/sidebar)
// =============================================================================

export function CompactExposureWidget() {
  const { sceneAnalysis, applyRecommendedSettings, camera } = useLightLensIntegration();
  const { recommendedSettings, warnings } = sceneAnalysis;
  const hasWarnings = Object.keys(warnings).some(k => warnings[k as keyof typeof warnings]);
  
  return (
    <Paper sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Tooltip title="Recommended Settings">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MagicIcon fontSize="small" color={hasWarnings ? 'error' : 'primary'} />
            <Typography variant="body2">
              f/{recommendedSettings.aperture} • {formatShutter(recommendedSettings.shutter)} • ISO {recommendedSettings.iso}
            </Typography>
          </Box>
        </Tooltip>
        <Tooltip title="Apply to camera">
          <span>
            <IconButton 
              size="small" 
              onClick={applyRecommendedSettings}
              disabled={!camera}
            >
              <MagicIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {hasWarnings && (
          <Tooltip title="See warnings">
            <WarningIcon fontSize="small" color="error" />
          </Tooltip>
        )}
      </Stack>
    </Paper>
  );
}

export default LightLensIntegrationPanel;

