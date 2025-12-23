/**
 * Advanced Guides Panel
 * 
 * Unified control panel for all visual guides:
 * - Composition Overlays
 * - Lighting Visualization
 * - Depth of Field Preview
 * - Video Production Guides
 * - Height References
 * - Safety & Spacing
 * - Color & Exposure
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Stack,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  ExpandMore,
  GridOn,
  Lightbulb,
  CameraAlt,
  Videocam,
  Straighten,
  Warning,
  Palette,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { CompositionGuideType } from '../components/CompositionOverlays';
import { AspectRatioType } from '../components/VideoProductionGuides';
import { useAppStore } from '../../state/store';

export interface AdvancedGuideSettings {
  // Composition
  composition: {
    enabled: boolean;
    guides: CompositionGuideType[];
    color: string;
    opacity: number;
  };
  // Lighting
  lighting: {
    enabled: boolean;
    showShadowDirection: boolean;
    showLightFalloff: boolean;
    showCatchlightPreview: boolean;
    showLightingRatio: boolean;
    showReflectorBounce: boolean;
  };
  // Depth of Field
  depthOfField: {
    enabled: boolean;
    showFocusPlane: boolean;
    showInFocusZone: boolean;
    showHyperfocalDistance: boolean;
    showNearFarLimits: boolean;
  };
  // Video Production
  videoProduction: {
    enabled: boolean;
    showTitleSafe: boolean;
    showActionSafe: boolean;
    showAspectRatioMask: boolean;
    showCenterMarkers: boolean;
    aspectRatio: AspectRatioType;
  };
  // Height References
  heightReferences: {
    enabled: boolean;
    showSubjectHeights: boolean;
    showCameraHeights: boolean;
    showLightHeights: boolean;
    showBackgroundHeight: boolean;
  };
  // Safety & Spacing
  safetySpacing: {
    enabled: boolean;
    showEquipmentClearance: boolean;
    showCableRoutes: boolean;
    showMovementZones: boolean;
    showHotLightWarning: boolean;
  };
  // Color & Exposure
  colorExposure: {
    enabled: boolean;
    showColorTemperatureScale: boolean;
    showGrayCardPosition: boolean;
    showExposureZones: boolean;
    showColorCheckerPosition: boolean;
  };
}

const DEFAULT_SETTINGS: AdvancedGuideSettings = {
  composition: {
    enabled: false,
    guides: ['rule_of_thirds'],
    color: '#00ff88',
    opacity: 0.5,
  },
  lighting: {
    enabled: false,
    showShadowDirection: true,
    showLightFalloff: true,
    showCatchlightPreview: true,
    showLightingRatio: true,
    showReflectorBounce: false,
  },
  depthOfField: {
    enabled: false,
    showFocusPlane: true,
    showInFocusZone: true,
    showHyperfocalDistance: false,
    showNearFarLimits: true,
  },
  videoProduction: {
    enabled: false,
    showTitleSafe: true,
    showActionSafe: true,
    showAspectRatioMask: false,
    showCenterMarkers: true,
    aspectRatio: '16:9',
  },
  heightReferences: {
    enabled: false,
    showSubjectHeights: true,
    showCameraHeights: true,
    showLightHeights: true,
    showBackgroundHeight: true,
  },
  safetySpacing: {
    enabled: false,
    showEquipmentClearance: true,
    showCableRoutes: true,
    showMovementZones: true,
    showHotLightWarning: false,
  },
  colorExposure: {
    enabled: false,
    showColorTemperatureScale: true,
    showGrayCardPosition: true,
    showExposureZones: true,
    showColorCheckerPosition: false,
  },
};

interface AdvancedGuidesPanelProps {
  settings?: AdvancedGuideSettings;
  onSettingsChange?: (settings: AdvancedGuideSettings) => void;
}

export const AdvancedGuidesPanel: React.FC<AdvancedGuidesPanelProps> = ({
  settings: propSettings,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<AdvancedGuideSettings>(propSettings || DEFAULT_SETTINGS);
  const [allEnabled, setAllEnabled] = useState(false);

  const updateSettings = useCallback((
    category: keyof AdvancedGuideSettings,
    updates: Partial<AdvancedGuideSettings[typeof category]>
  ) => {
    const newSettings = {
      ...settings,
      [category]: { ...settings[category], ...updates },
    };
    setSettings(newSettings);
    onSettingsChange?.(newSettings);

    // Dispatch event for 3D components to listen to
    window.dispatchEvent(new CustomEvent('vs-advanced-guides-changed', {
      detail: newSettings,
    }));
  }, [settings, onSettingsChange]);

  const toggleAllGuides = useCallback(() => {
    const newEnabled = !allEnabled;
    setAllEnabled(newEnabled);
    
    const newSettings: AdvancedGuideSettings = {
      composition: { ...settings.composition, enabled: newEnabled },
      lighting: { ...settings.lighting, enabled: newEnabled },
      depthOfField: { ...settings.depthOfField, enabled: newEnabled },
      videoProduction: { ...settings.videoProduction, enabled: newEnabled },
      heightReferences: { ...settings.heightReferences, enabled: newEnabled },
      safetySpacing: { ...settings.safetySpacing, enabled: newEnabled },
      colorExposure: { ...settings.colorExposure, enabled: newEnabled },
    };
    
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
    window.dispatchEvent(new CustomEvent('vs-advanced-guides-changed', { detail: newSettings }));
  }, [allEnabled, settings, onSettingsChange]);

  const countEnabledGuides = () => {
    let count = 0;
    if (settings.composition.enabled) count += settings.composition.guides.length;
    if (settings.lighting.enabled) count += Object.values(settings.lighting).filter(v => v === true).length - 1;
    if (settings.depthOfField.enabled) count += Object.values(settings.depthOfField).filter(v => v === true).length - 1;
    if (settings.videoProduction.enabled) count += Object.values(settings.videoProduction).filter(v => v === true).length - 1;
    if (settings.heightReferences.enabled) count += Object.values(settings.heightReferences).filter(v => v === true).length - 1;
    if (settings.safetySpacing.enabled) count += Object.values(settings.safetySpacing).filter(v => v === true).length - 1;
    if (settings.colorExposure.enabled) count += Object.values(settings.colorExposure).filter(v => v === true).length - 1;
    return count;
  };

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">
          Advanced Guides
          <Chip 
            label={`${countEnabledGuides()} active`} 
            size="small" 
            color="primary" 
            sx={{ ml: 1 }} 
          />
        </Typography>
        <Tooltip title={allEnabled ? 'Hide All' : 'Show All'}>
          <IconButton onClick={toggleAllGuides} color={allEnabled ? 'primary' : 'default'}>
            {allEnabled ? <Visibility /> : <VisibilityOff />}
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Composition Guides */}
      <Accordion defaultExpanded={settings.composition.enabled}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, mr: 2 }}>
            <GridOn color={settings.composition.enabled ? 'primary' : 'disabled'} />
            <Typography>Composition</Typography>
            <Switch
              checked={settings.composition.enabled}
              onChange={(e) => updateSettings('composition', { enabled: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
              size="small"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Select overlay guides:
          </Typography>
          <ToggleButtonGroup
            value={settings.composition.guides}
            onChange={(_, guides) => updateSettings('composition', { guides: guides || [] })}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            <ToggleButton value="rule_of_thirds">Thirds</ToggleButton>
            <ToggleButton value="golden_ratio">Golden Ratio</ToggleButton>
            <ToggleButton value="golden_spiral">Spiral</ToggleButton>
            <ToggleButton value="diagonal">Diagonal</ToggleButton>
            <ToggleButton value="center_cross">Center</ToggleButton>
            <ToggleButton value="golden_triangle">Triangle</ToggleButton>
            <ToggleButton value="dynamic_symmetry">Dynamic</ToggleButton>
          </ToggleButtonGroup>
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption">Opacity: {settings.composition.opacity}</Typography>
            <Slider
              value={settings.composition.opacity}
              onChange={(_, v) => updateSettings('composition', { opacity: v as number })}
              min={0.1}
              max={1}
              step={0.1}
              size="small"
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Lighting Visualization */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, mr: 2 }}>
            <Lightbulb color={settings.lighting.enabled ? 'warning' : 'disabled'} />
            <Typography>Lighting</Typography>
            <Switch
              checked={settings.lighting.enabled}
              onChange={(e) => updateSettings('lighting', { enabled: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
              size="small"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5}>
            <FormControlLabel
              control={<Switch size="small" checked={settings.lighting.showShadowDirection} onChange={(e) => updateSettings('lighting', { showShadowDirection: e.target.checked })} />}
              label={<Typography variant="body2">Shadow Direction</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.lighting.showLightFalloff} onChange={(e) => updateSettings('lighting', { showLightFalloff: e.target.checked })} />}
              label={<Typography variant="body2">Light Fall-off (Inverse Square)</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.lighting.showCatchlightPreview} onChange={(e) => updateSettings('lighting', { showCatchlightPreview: e.target.checked })} />}
              label={<Typography variant="body2">Catchlight Preview</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.lighting.showLightingRatio} onChange={(e) => updateSettings('lighting', { showLightingRatio: e.target.checked })} />}
              label={<Typography variant="body2">Lighting Ratio</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.lighting.showReflectorBounce} onChange={(e) => updateSettings('lighting', { showReflectorBounce: e.target.checked })} />}
              label={<Typography variant="body2">Reflector Bounce Path</Typography>}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Depth of Field */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, mr: 2 }}>
            <CameraAlt color={settings.depthOfField.enabled ? 'info' : 'disabled'} />
            <Typography>Depth of Field</Typography>
            <Switch
              checked={settings.depthOfField.enabled}
              onChange={(e) => updateSettings('depthOfField', { enabled: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
              size="small"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5}>
            <FormControlLabel
              control={<Switch size="small" checked={settings.depthOfField.showFocusPlane} onChange={(e) => updateSettings('depthOfField', { showFocusPlane: e.target.checked })} />}
              label={<Typography variant="body2">Focus Plane</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.depthOfField.showInFocusZone} onChange={(e) => updateSettings('depthOfField', { showInFocusZone: e.target.checked })} />}
              label={<Typography variant="body2">In-Focus Zone (DoF Volume)</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.depthOfField.showHyperfocalDistance} onChange={(e) => updateSettings('depthOfField', { showHyperfocalDistance: e.target.checked })} />}
              label={<Typography variant="body2">Hyperfocal Distance</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.depthOfField.showNearFarLimits} onChange={(e) => updateSettings('depthOfField', { showNearFarLimits: e.target.checked })} />}
              label={<Typography variant="body2">Near/Far Focus Limits</Typography>}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Video Production */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, mr: 2 }}>
            <Videocam color={settings.videoProduction.enabled ? 'error' : 'disabled'} />
            <Typography>Video Production</Typography>
            <Switch
              checked={settings.videoProduction.enabled}
              onChange={(e) => updateSettings('videoProduction', { enabled: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
              size="small"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            <FormControlLabel
              control={<Switch size="small" checked={settings.videoProduction.showTitleSafe} onChange={(e) => updateSettings('videoProduction', { showTitleSafe: e.target.checked })} />}
              label={<Typography variant="body2">Title Safe (90%)</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.videoProduction.showActionSafe} onChange={(e) => updateSettings('videoProduction', { showActionSafe: e.target.checked })} />}
              label={<Typography variant="body2">Action Safe (93%)</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.videoProduction.showCenterMarkers} onChange={(e) => updateSettings('videoProduction', { showCenterMarkers: e.target.checked })} />}
              label={<Typography variant="body2">Center Markers</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.videoProduction.showAspectRatioMask} onChange={(e) => updateSettings('videoProduction', { showAspectRatioMask: e.target.checked })} />}
              label={<Typography variant="body2">Aspect Ratio Mask</Typography>}
            />
            {settings.videoProduction.showAspectRatioMask && (
              <FormControl size="small" fullWidth>
                <InputLabel>Aspect Ratio</InputLabel>
                <Select
                  value={settings.videoProduction.aspectRatio}
                  onChange={(e) => updateSettings('videoProduction', { aspectRatio: e.target.value as AspectRatioType })}
                  label="Aspect Ratio"
                >
                  <MenuItem value="16:9">16:9 (HD/4K)</MenuItem>
                  <MenuItem value="4:3">4:3 (Classic)</MenuItem>
                  <MenuItem value="21:9">21:9 (Ultrawide)</MenuItem>
                  <MenuItem value="2.35:1">2.35:1 (Cinemascope)</MenuItem>
                  <MenuItem value="1.85:1">1.85:1 (Academy Flat)</MenuItem>
                  <MenuItem value="1:1">1:1 (Square)</MenuItem>
                  <MenuItem value="9:16">9:16 (Vertical)</MenuItem>
                  <MenuItem value="4:5">4:5 (Instagram)</MenuItem>
                </Select>
              </FormControl>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Height References */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, mr: 2 }}>
            <Straighten color={settings.heightReferences.enabled ? 'success' : 'disabled'} />
            <Typography>Height References</Typography>
            <Switch
              checked={settings.heightReferences.enabled}
              onChange={(e) => updateSettings('heightReferences', { enabled: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
              size="small"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5}>
            <FormControlLabel
              control={<Switch size="small" checked={settings.heightReferences.showSubjectHeights} onChange={(e) => updateSettings('heightReferences', { showSubjectHeights: e.target.checked })} />}
              label={<Typography variant="body2">Subject Heights</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.heightReferences.showCameraHeights} onChange={(e) => updateSettings('heightReferences', { showCameraHeights: e.target.checked })} />}
              label={<Typography variant="body2">Camera Heights</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.heightReferences.showLightHeights} onChange={(e) => updateSettings('heightReferences', { showLightHeights: e.target.checked })} />}
              label={<Typography variant="body2">Light Heights</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.heightReferences.showBackgroundHeight} onChange={(e) => updateSettings('heightReferences', { showBackgroundHeight: e.target.checked })} />}
              label={<Typography variant="body2">Background Coverage</Typography>}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Safety & Spacing */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, mr: 2 }}>
            <Warning color={settings.safetySpacing.enabled ? 'warning' : 'disabled'} />
            <Typography>Safety & Spacing</Typography>
            <Switch
              checked={settings.safetySpacing.enabled}
              onChange={(e) => updateSettings('safetySpacing', { enabled: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
              size="small"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5}>
            <FormControlLabel
              control={<Switch size="small" checked={settings.safetySpacing.showEquipmentClearance} onChange={(e) => updateSettings('safetySpacing', { showEquipmentClearance: e.target.checked })} />}
              label={<Typography variant="body2">Equipment Clearance Zones</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.safetySpacing.showCableRoutes} onChange={(e) => updateSettings('safetySpacing', { showCableRoutes: e.target.checked })} />}
              label={<Typography variant="body2">Cable Routes</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.safetySpacing.showMovementZones} onChange={(e) => updateSettings('safetySpacing', { showMovementZones: e.target.checked })} />}
              label={<Typography variant="body2">Movement Zones</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.safetySpacing.showHotLightWarning} onChange={(e) => updateSettings('safetySpacing', { showHotLightWarning: e.target.checked })} />}
              label={<Typography variant="body2">Hot Light Warning</Typography>}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Color & Exposure */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, mr: 2 }}>
            <Palette color={settings.colorExposure.enabled ? 'secondary' : 'disabled'} />
            <Typography>Color & Exposure</Typography>
            <Switch
              checked={settings.colorExposure.enabled}
              onChange={(e) => updateSettings('colorExposure', { enabled: e.target.checked })}
              onClick={(e) => e.stopPropagation()}
              size="small"
            />
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.5}>
            <FormControlLabel
              control={<Switch size="small" checked={settings.colorExposure.showColorTemperatureScale} onChange={(e) => updateSettings('colorExposure', { showColorTemperatureScale: e.target.checked })} />}
              label={<Typography variant="body2">Color Temperature Scale</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.colorExposure.showExposureZones} onChange={(e) => updateSettings('colorExposure', { showExposureZones: e.target.checked })} />}
              label={<Typography variant="body2">Exposure Zone System</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.colorExposure.showGrayCardPosition} onChange={(e) => updateSettings('colorExposure', { showGrayCardPosition: e.target.checked })} />}
              label={<Typography variant="body2">Gray Card Position</Typography>}
            />
            <FormControlLabel
              control={<Switch size="small" checked={settings.colorExposure.showColorCheckerPosition} onChange={(e) => updateSettings('colorExposure', { showColorCheckerPosition: e.target.checked })} />}
              label={<Typography variant="body2">Color Checker Position</Typography>}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Tips */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2">
          Use composition guides for framing, lighting guides for setup verification,
          and safety guides during studio setup.
        </Typography>
      </Alert>
    </Box>
  );
};

export default AdvancedGuidesPanel;

