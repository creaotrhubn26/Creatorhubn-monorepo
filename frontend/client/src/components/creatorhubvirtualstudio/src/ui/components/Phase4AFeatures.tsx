import React from 'react';
import { Box, Divider } from '@mui/material';
import { ExposureVisualizationPanel } from './ExposureVisualizationPanel';
import { LightContributionPanel } from './LightContributionPanel';
import { HDRIBrowserPanel } from './HDRIBrowserPanel';
import {
  useFalseColorEnabled,
  useHeatmapEnabled,
  useFalseColorOpacity,
  useHeatmapOpacity,
  useHDRIEnvironmentId,
  useHDRIIntensity,
  useHDRIRotation,
  useHDRIVisible,
  useActions,
} from '@/state/selectors';
import { lightContributionService } from '@/core/services/lightContributionService';
import { hdriEnvironmentService } from'@/core/services/hdriEnvironmentService';

/**
 * Phase 4A Features Container
 * 
 * Integrates all Phase 4A features:
 * - False Color Exposure View
 * - Luminance Heatmap
 * - Light Contribution Breakdown
 * - HDRI Environment Browser
 */
export function Phase4AFeatures() {
  const falseColorEnabled = useFalseColorEnabled();
  const heatmapEnabled = useHeatmapEnabled();
  const falseColorOpacity = useFalseColorOpacity();
  const heatmapOpacity = useHeatmapOpacity();
  const hdriEnvironmentId = useHDRIEnvironmentId();
  const hdriIntensity = useHDRIIntensity();
  const hdriRotation = useHDRIRotation();
  const hdriVisible = useHDRIVisible();
  const actions = useActions();

  // Light Contribution handlers
  const handleToggleLight = (lightId: string, enabled: boolean) => {
    lightContributionService.toggleLight(lightId, enabled);
    // Force re-render by toggling a dummy state
    actions.toggleLightContribution();
    actions.toggleLightContribution();
  };

  const handleSoloLight = (lightId: string) => {
    lightContributionService.soloLight(lightId);
    // Force re-render
    actions.toggleLightContribution();
    actions.toggleLightContribution();
  };

  const handleEnableAllLights = () => {
    lightContributionService.enableAllLights();
    // Force re-render
    actions.toggleLightContribution();
    actions.toggleLightContribution();
  };

  // HDRI handlers
  const handleLoadEnvironment = (environmentId: string) => {
    const settings = hdriEnvironmentService.loadEnvironment(environmentId);
    actions.setHDRIEnvironment(settings.environmentId);
    actions.setHDRIIntensity(settings.intensity);
    actions.setHDRIRotation(settings.rotation);
  };

  const handleClearEnvironment = () => {
    hdriEnvironmentService.clearEnvironment();
    actions.setHDRIEnvironment(null);
  };

  return (
    <Box>
      {/* Exposure Visualization */}
      <ExposureVisualizationPanel
        falseColorEnabled={falseColorEnabled}
        heatmapEnabled={heatmapEnabled}
        falseColorOpacity={falseColorOpacity}
        heatmapOpacity={heatmapOpacity}
        onToggleFalseColor={actions.toggleFalseColor}
        onToggleHeatmap={actions.toggleHeatmap}
        onFalseColorOpacityChange={actions.setFalseColorOpacity}
        onHeatmapOpacityChange={actions.setHeatmapOpacity}
      />

      <Divider sx={{ my: 2 }} />

      {/* Light Contribution */}
      <LightContributionPanel
        onToggleLight={handleToggleLight}
        onSoloLight={handleSoloLight}
        onEnableAllLights={handleEnableAllLights}
      />

      <Divider sx={{ my: 2 }} />

      {/* HDRI Environment Browser */}
      <HDRIBrowserPanel
        currentEnvironmentId={hdriEnvironmentId}
        intensity={hdriIntensity}
        rotation={hdriRotation}
        visible={hdriVisible}
        onLoadEnvironment={handleLoadEnvironment}
        onUpdateIntensity={actions.setHDRIIntensity}
        onUpdateRotation={actions.setHDRIRotation}
        onToggleVisible={actions.toggleHDRIVisible}
        onClearEnvironment={handleClearEnvironment}
      />
    </Box>
  );
}

