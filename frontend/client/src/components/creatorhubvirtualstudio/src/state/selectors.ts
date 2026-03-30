import { useAppStore } from './store';
import { useMemo } from 'react';

export const useScene = () => useAppStore((s) => s.scene);
export const useSelection = () => useAppStore((s) => s.scene.selection);
export const useNodes = () => useAppStore((s) => s.scene.nodes);
export const useMeasurements = () => useAppStore((s) => s.measurements);
export const useMeasureMode = () => useAppStore((s) => s.measureMode);
export const useShowLightCones = () => useAppStore((s) => s.showLightCones);
export const useShowStudioGuides = () => useAppStore((s) => s.showStudioGuides);
export const useFalseColorEnabled = () => useAppStore((s) => s.falseColorEnabled);
export const useHeatmapEnabled = () => useAppStore((s) => s.heatmapEnabled);
export const useFalseColorOpacity = () => useAppStore((s) => s.falseColorOpacity);
export const useHeatmapOpacity = () => useAppStore((s) => s.heatmapOpacity);
export const useHDRIEnvironmentId = () => useAppStore((s) => s.hdriEnvironmentId);
export const useHDRIIntensity = () => useAppStore((s) => s.hdriIntensity);
export const useHDRIRotation = () => useAppStore((s) => s.hdriRotation);
export const useHDRIVisible = () => useAppStore((s) => s.hdriVisible);
export const useStudioGuideSettings = () => useAppStore((s) => s.studioGuideSettings);
export const useAdvancedGuideSettings = () => useAppStore((s) => s.advancedGuideSettings);

export const useActions = () => {
  // Get store methods directly - they should be stable references
  const addNode = useAppStore((s) => s.addNode);
  const updateNode = useAppStore((s) => s.updateNode);
  const transformNode = useAppStore((s) => s.transformNode);
  const deleteNode = useAppStore((s) => s.deleteNode);
  const select = useAppStore((s) => s.select);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const setScene = useAppStore((s) => s.setScene);
  const toggleMeasureMode = useAppStore((s) => s.toggleMeasureMode);
  const toggleLightCones = useAppStore((s) => s.toggleLightCones);
  const toggleStudioGuides = useAppStore((s) => s.toggleStudioGuides);
  const toggleFalseColor = useAppStore((s) => s.toggleFalseColor);
  const toggleHeatmap = useAppStore((s) => s.toggleHeatmap);
  const setFalseColorOpacity = useAppStore((s) => s.setFalseColorOpacity);
  const setHeatmapOpacity = useAppStore((s) => s.setHeatmapOpacity);
  const setHDRIEnvironment = useAppStore((s) => s.setHDRIEnvironment);
  const setHDRIIntensity = useAppStore((s) => s.setHDRIIntensity);
  const setHDRIRotation = useAppStore((s) => s.setHDRIRotation);
  const toggleHDRIVisible = useAppStore((s) => s.toggleHDRIVisible);
  const toggleLightContribution = useAppStore((s) => s.toggleLightContribution);
  const updateStudioGuideSettings = useAppStore((s) => s.updateStudioGuideSettings);
  const updateAdvancedGuideSettings = useAppStore((s) => s.updateAdvancedGuideSettings);
  const addMeasurementPoints = useAppStore((s) => s.addMeasurementPoints);
  const addMeasurementBetween = useAppStore((s) => s.addMeasurementBetween);
  const removeMeasurement = useAppStore((s) => s.removeMeasurement);

  // Memoize the actions object - only recreate if function references change
  return useMemo(
    () => ({
      addNode,
      updateNode,
      transformNode,
      deleteNode,
      select,
      undo,
      redo,
      setScene,
      toggleMeasureMode,
      toggleLightCones,
      toggleStudioGuides,
      toggleFalseColor,
      toggleHeatmap,
      setFalseColorOpacity,
      setHeatmapOpacity,
      setHDRIEnvironment,
      setHDRIIntensity,
      setHDRIRotation,
      toggleHDRIVisible,
      toggleLightContribution,
      updateStudioGuideSettings,
      updateAdvancedGuideSettings,
      addMeasurementPoints,
      addMeasurementBetween,
      removeMeasurement,
    }),
    [
      addNode,
      updateNode,
      transformNode,
      deleteNode,
      select,
      undo,
      redo,
      setScene,
      toggleMeasureMode,
      toggleLightCones,
      toggleStudioGuides,
      toggleFalseColor,
      toggleHeatmap,
      setFalseColorOpacity,
      setHeatmapOpacity,
      setHDRIEnvironment,
      setHDRIIntensity,
      setHDRIRotation,
      toggleHDRIVisible,
      toggleLightContribution,
      updateStudioGuideSettings,
      updateAdvancedGuideSettings,
      addMeasurementPoints,
      addMeasurementBetween,
      removeMeasurement,
    ]
  );
};
