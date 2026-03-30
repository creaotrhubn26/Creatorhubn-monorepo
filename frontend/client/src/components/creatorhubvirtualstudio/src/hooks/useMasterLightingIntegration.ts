/**
 * Master Lighting Integration Hook
 * 
 * Provides unified access to all lighting integrations:
 * - AI Recommendations
 * - HDRI Exposure
 * - Template Enhancement
 * - Cost Calculator
 * - Gear Presets
 * - LUT Recommendations
 * - Multi-Camera Sync
 * - Histogram Analysis
 * - Community Sharing
 * - Virtual Actor Metering
 * - Timeline Animation
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { logger } from '../core/services/logger';
import { useNodes, useActions } from '@/state/selectors';

const log = logger.module('MasterLightingIntegration');
import { useUserEquipmentInventory } from './useUserEquipmentInventory';
import { preferencesApi } from '../core/api/virtualStudioApi';
import { 
  masterLightingIntegration,
  type HDRIExposureData,
  type TemplateExposureData,
  type GearPresetState,
  type LUTRecommendation,
  type MultiCameraExposure,
  type HistogramFeedback,
  type CommunityShareData,
  type VirtualActorMetering,
  type TimelineExposureKeyframe,
} from '@/core/services/masterLightingIntegration';
import type { CinematographyPattern } from '@/core/services/cinematographyPatternsService';
import type { PatternExposureAnalysis } from '@/core/services/patternExposureIntegration';

// =============================================================================
// TYPES
// =============================================================================

export interface AIRecommendation {
  pattern: CinematographyPattern;
  analysis: PatternExposureAnalysis;
  aiScore: number;
  reasoning: string;
}

export interface MasterIntegrationState {
  // AI
  aiRecommendations: AIRecommendation[];
  isLoadingAI: boolean;
  
  // HDRI
  hdriExposure: HDRIExposureData | null;
  currentHDRI: string | null;
  
  // Templates
  enhancedTemplates: Map<string, TemplateExposureData>;
  
  // Presets
  savedPresets: GearPresetState[];
  
  // LUTs
  lutRecommendations: LUTRecommendation[];
  
  // Multi-Camera
  cameraExposures: MultiCameraExposure[];
  syncMode: 'match-ev' | 'match-aperture' | 'independent';
  
  // Histogram
  histogramFeedback: HistogramFeedback | null;
  
  // Virtual Actors
  actorMetering: Map<string, VirtualActorMetering>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useMasterLightingIntegration() {
  const nodes = useNodes();
  const { updateNode, addNode } = useActions();
  const { inventory: userInventory, isLoading: inventoryLoading } = useUserEquipmentInventory();
  
  // State
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [currentHDRI, setCurrentHDRI] = useState<string | null>(null);
  const [savedPresets, setSavedPresets] = useState<GearPresetState[]>([]);
  const [syncMode, setSyncMode] = useState<'match-ev' | 'match-aperture' | 'independent'>('match-ev');
  const [histogramData, setHistogramData] = useState<{ r: number[]; g: number[]; b: number[] } | null>(null);

  const isVisibleLightNode = useCallback(
    (
      node: (typeof nodes)[number],
    ): node is (typeof nodes)[number] & { light: NonNullable<(typeof nodes)[number]['light']> } =>
      Boolean(node.light) && node.visible !== false,
    [],
  );

  const isVisibleCameraNode = useCallback(
    (
      node: (typeof nodes)[number],
    ): node is (typeof nodes)[number] & { camera: NonNullable<(typeof nodes)[number]['camera']> } =>
      Boolean(node.camera) && node.visible !== false,
    [],
  );
  
  // ==========================================================================
  // EXTRACT SCENE DATA
  // ==========================================================================
  
  const lights = useMemo(() => {
    return nodes
      .filter(isVisibleLightNode)
      .map((n) => ({
        id: n.id,
        position: n.transform.position as [number, number, number],
        rotation: n.transform.rotation as [number, number, number],
        power: n.userData.wattage ?? n.light.power * 1000,
        cct: n.light.cct || 5600,
        modifier: n.light.modifier,
        userData: n.userData,
      }));
  }, [isVisibleLightNode, nodes]);
  
  const cameras = useMemo(() => {
    return nodes
      .filter(isVisibleCameraNode)
      .map((n) => ({
        id: n.id,
        name: n.name ?? 'Camera',
        position: n.transform.position as [number, number, number],
        currentSettings: {
          aperture: n.camera.aperture || 2.8,
          shutter: n.camera.shutter || 1/125,
          iso: n.camera.iso || 100,
          focalLength: n.camera.focalLength || 50,
        },
        isMain: n.userData.isMainCamera ?? false,
        userData: n.userData,
      }));
  }, [isVisibleCameraNode, nodes]);
  
  const activeCamera = useMemo(() => {
    return cameras.find(c => c.isMain) || cameras[0];
  }, [cameras]);

  const inferLightNodeType = useCallback((modifier?: string) => {
    const normalizedModifier = modifier?.toLowerCase() ?? '';
    if (normalizedModifier.includes('umbrella')) return 'umbrella';
    if (normalizedModifier.includes('reflector')) return 'reflector';
    if (normalizedModifier.includes('fresnel') || normalizedModifier.includes('spot')) return 'spot';
    return 'softbox';
  }, []);
  
  // ==========================================================================
  // 1. AI RECOMMENDATIONS
  // ==========================================================================
  
  const getAIRecommendations = useCallback(async (
    mood: string,
    subject: 'portrait' | 'product' | 'fashion' | 'automotive' | 'food',
    constraints?: {
      maxBudget?: number;
      availableSpace?: number;
      skillLevel?: 'beginner' | 'intermediate' | 'advanced';
    }
  ) => {
    if (!userInventory) return;
    
    setIsLoadingAI(true);
    
    // Simulate async for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const result = masterLightingIntegration.getAIRecommendations(
      mood,
      subject,
      userInventory,
      constraints
    );
    
    setAiRecommendations(result.recommendedPatterns);
    setIsLoadingAI(false);
    
    return result;
  }, [userInventory]);
  
  // ==========================================================================
  // 2. HDRI EXPOSURE
  // ==========================================================================
  
  const hdriExposure = useMemo(() => {
    if (!currentHDRI) return null;
    
    const lightData = lights.map(l => ({
      power: l.power,
      distance: Math.sqrt(
        l.position[0] ** 2 +
        (l.position[1] - 1.6) ** 2 +
        l.position[2] ** 2
      ),
      modifier: l.modifier,
    }));
    
    return masterLightingIntegration.calculateHDRIExposure(
      currentHDRI,
      lightData,
      activeCamera?.currentSettings.aperture || 8
    );
  }, [currentHDRI, lights, activeCamera]);
  
  const setHDRI = useCallback((hdriPath: string) => {
    setCurrentHDRI(hdriPath);
    
    // Dispatch event for other components
    window.dispatchEvent(new CustomEvent('ch-hdri-exposure-update', {
      detail: { hdriPath },
    }));
  }, []);
  
  // ==========================================================================
  // 3. TEMPLATE ENHANCEMENT
  // ==========================================================================
  
  const enhanceTemplate = useCallback((template: {
    id: string;
    name: string;
    category: string;
    lights: any[];
  }): TemplateExposureData | null => {
    if (!userInventory) return null;
    
    return masterLightingIntegration.enhanceTemplate(template, userInventory);
  }, [userInventory]);
  
  // ==========================================================================
  // 4. COST CALCULATION
  // ==========================================================================
  
  const calculatePatternCost = useCallback((patternId: string, rentalDays: number = 1) => {
    if (!userInventory) return null;
    
    return masterLightingIntegration.calculatePatternCost(patternId, userInventory, rentalDays);
  }, [userInventory]);
  
  // ==========================================================================
  // 5. GEAR PRESETS
  // ==========================================================================
  
  const saveCurrentAsPreset = useCallback((name: string, tags: string[] = []) => {
    if (!activeCamera) return null;
    
    const sceneState = {
      lights: lights.map(l => ({
        id: l.id,
        position: l.position,
        rotation: l.rotation,
        power: l.power,
        cct: l.cct,
        modifier: l.modifier,
        userData: l.userData,
      })),
      camera: {
        id: activeCamera.id,
        position: activeCamera.position,
        aperture: activeCamera.currentSettings.aperture,
        shutter: activeCamera.currentSettings.shutter,
        iso: activeCamera.currentSettings.iso,
        focalLength: activeCamera.userData?.focalLength || activeCamera.currentSettings?.focalLength || 50,
        userData: activeCamera.userData,
      },
    };
    
    const preset = masterLightingIntegration.createGearPreset(
      name,
      sceneState,
      undefined,
      tags
    );
    
    setSavedPresets(prev => [...prev, preset]);
    
    // Persist to localStorage as backup
    const allPresets = [...savedPresets, preset];
    localStorage.setItem('virtualStudio_gearPresets', JSON.stringify(allPresets));
    
    // Save to database
    preferencesApi.update({ gearPresets: allPresets }).catch(() => {
      log.warn('Failed to save gear presets to database');
    });
    
    return preset;
  }, [lights, activeCamera, savedPresets]);
  
  const loadPreset = useCallback((preset: GearPresetState) => {
    const { lights: presetLights, camera, events } = masterLightingIntegration.applyGearPreset(preset);
    const sceneLightNodes = nodes.filter((node) => Boolean(node.light));

    presetLights.forEach((light, index) => {
      const existingLight = sceneLightNodes[index];
      const normalizedPower = light.power > 1 ? Math.min(1, light.power / 1000) : light.power;

      if (existingLight) {
        updateNode(existingLight.id, {
          name: light.model ? `${light.brand ?? 'Studio'} ${light.model}` : existingLight.name,
          transform: {
            position: light.position,
            rotation: light.rotation,
            scale: existingLight.transform.scale,
          },
          light: {
            ...existingLight.light,
            power: normalizedPower,
            cct: light.cct,
            modifier: light.modifier,
          },
          userData: {
            ...existingLight.userData,
            brand: light.brand,
            model: light.model,
            wattage: light.power,
          },
        });
        return;
      }

      addNode({
        id: `preset_light_${preset.id}_${index}`,
        type: inferLightNodeType(light.modifier),
        name: light.model ? `${light.brand ?? 'Studio'} ${light.model}` : `Preset Light ${index + 1}`,
        visible: true,
        transform: {
          position: light.position,
          rotation: light.rotation,
          scale: [1, 1, 1],
        },
        light: {
          power: normalizedPower,
          cct: light.cct,
          modifier: light.modifier,
          beam: 45,
        },
        userData: {
          brand: light.brand,
          model: light.model,
          wattage: light.power,
        },
      });
    });

    const existingCameraNode = nodes.find((node) => Boolean(node.camera)) ?? null;
    if (existingCameraNode) {
      updateNode(existingCameraNode.id, {
        transform: {
          position: camera.position,
          rotation: existingCameraNode.transform.rotation,
          scale: existingCameraNode.transform.scale,
        },
        camera: {
          ...existingCameraNode.camera,
          aperture: camera.aperture,
          shutter: camera.shutter,
          iso: camera.iso,
          focalLength: camera.focalLength,
        },
      });
    } else {
      addNode({
        id: `preset_camera_${preset.id}`,
        type: 'camera',
        name: preset.camera.model ? `${preset.camera.brand ?? 'Preset'} ${preset.camera.model}` : 'Preset Camera',
        visible: true,
        transform: {
          position: camera.position,
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        camera: {
          sensor: [36, 24],
          aperture: camera.aperture,
          shutter: camera.shutter,
          iso: camera.iso,
          focalLength: camera.focalLength,
        },
        userData: {
          brand: preset.camera.brand,
          model: preset.camera.model,
          equipmentId: preset.camera.equipmentId,
          attachedLens: preset.lens,
          isMainCamera: true,
        },
      });
    }

    for (const event of events) {
      window.dispatchEvent(new CustomEvent(event.type, { detail: event.detail }));
    }
    
    return { lights: presetLights, camera };
  }, [addNode, inferLightNodeType, nodes, updateNode]);
  
  const deletePreset = useCallback((presetId: string) => {
    setSavedPresets(prev => {
      const updated = prev.filter(p => p.id !== presetId);
      localStorage.setItem('virtualStudio_gearPresets', JSON.stringify(updated));
      
      // Update database
      preferencesApi.update({ gearPresets: updated }).catch(() => {
        log.warn('Failed to update gear presets in database');
      });
      
      return updated;
    });
  }, []);
  
  // Load presets from database with localStorage fallback
  useEffect(() => {
    const loadPresets = async () => {
      // Try database first
      try {
        const prefs = await preferencesApi.get();
        if (prefs?.gearPresets) {
          setSavedPresets(prefs.gearPresets);
          return;
        }
      } catch {
        // Database failed
      }
      
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('virtualStudio_gearPresets');
        if (stored) {
          setSavedPresets(JSON.parse(stored));
        }
      } catch (e) {
        log.warn('Failed to load gear presets: ', e);
      }
    };
    
    loadPresets();
  }, []);
  
  // ==========================================================================
  // 6. LUT RECOMMENDATIONS
  // ==========================================================================
  
  const getLUTRecommendations = useCallback((
    patternMood: string,
    contrastRatio: string,
    availableLUTs: Array<{ id: string; name: string; category: string; preview?: string }>
  ): LUTRecommendation[] => {
    return masterLightingIntegration.getLUTRecommendations(
      patternMood,
      contrastRatio,
      availableLUTs
    );
  }, []);
  
  // ==========================================================================
  // 7. MULTI-CAMERA SYNC
  // ==========================================================================
  
  const cameraExposures = useMemo(() => {
    if (cameras.length === 0) return [];
    
    const lightData = lights.map(l => ({
      position: l.position,
      power: l.power,
      modifier: l.modifier,
    }));
    
    return masterLightingIntegration.calculateMultiCameraExposure(
      cameras,
      lightData,
      syncMode
    );
  }, [cameras, lights, syncMode]);
  
  const applyCameraSync = useCallback((cameraId: string) => {
    const exposure = cameraExposures.find(e => e.cameraId === cameraId);
    if (!exposure) return;
    
    updateNode(cameraId, {
      camera: {
        aperture: exposure.recommendedSettings.aperture,
        shutter: exposure.recommendedSettings.shutter,
        iso: exposure.recommendedSettings.iso,
      },
    });
  }, [cameraExposures, updateNode]);
  
  const syncAllCameras = useCallback(() => {
    for (const exposure of cameraExposures) {
      if (exposure.syncStatus !== 'synced') {
        applyCameraSync(exposure.cameraId);
      }
    }
  }, [cameraExposures, applyCameraSync]);
  
  // ==========================================================================
  // 8. HISTOGRAM ANALYSIS
  // ==========================================================================
  
  const histogramFeedback = useMemo(() => {
    if (!histogramData || !activeCamera) return null;
    
    return masterLightingIntegration.analyzeHistogram(
      histogramData,
      activeCamera.currentSettings
    );
  }, [histogramData, activeCamera]);
  
  const updateHistogram = useCallback((data: { r: number[]; g: number[]; b: number[] }) => {
    setHistogramData(data);
  }, []);
  
  const applyHistogramSuggestion = useCallback(() => {
    if (!histogramFeedback || !activeCamera) return;
    
    const { suggestedAdjustment } = histogramFeedback;
    if (suggestedAdjustment.direction === 'optimal') return;
    
    const factor = suggestedAdjustment.direction === 'brighter' 
      ? Math.pow(2, suggestedAdjustment.stops)
      : Math.pow(2, -suggestedAdjustment.stops);
    
    const currentSettings = activeCamera.currentSettings;
    const newSettings = { ...currentSettings };
    
    switch (suggestedAdjustment.method) {
      case 'aperture':
        newSettings.aperture = currentSettings.aperture / Math.sqrt(factor);
        break;
      case 'shutter':
        newSettings.shutter = currentSettings.shutter * factor;
        break;
      case 'iso':
        newSettings.iso = Math.round(currentSettings.iso * factor);
        break;
    }
    
    updateNode(activeCamera.id, { camera: newSettings });
  }, [histogramFeedback, activeCamera, updateNode]);
  
  // ==========================================================================
  // 9. COMMUNITY SHARING
  // ==========================================================================
  
  const prepareCommunityShare = useCallback((
    patternId?: string,
    notes?: string
  ): CommunityShareData | null => {
    if (!activeCamera) return null;
    
    const sceneState = {
      lights: lights.map(l => ({
        userData: l.userData,
        power: l.power,
        cct: l.cct,
        modifier: l.modifier,
      })),
      camera: activeCamera.currentSettings,
    };
    
    return masterLightingIntegration.prepareCommunityShare(sceneState, patternId, notes);
  }, [lights, activeCamera]);
  
  // ==========================================================================
  // 10. VIRTUAL ACTOR METERING
  // ==========================================================================
  
  const getActorMetering = useCallback((
    actorId: string,
    skinTone: 'light' | 'medium' | 'dark'
  ): VirtualActorMetering => {
    return masterLightingIntegration.getVirtualActorMetering(actorId, skinTone);
  }, []);
  
  // ==========================================================================
  // 11. TIMELINE ANIMATION
  // ==========================================================================
  
  const generateExposureAnimation = useCallback((
    endSettings: { aperture: number; shutter: number; iso: number },
    duration: number,
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'ease-in-out'
  ): TimelineExposureKeyframe[] | null => {
    if (!activeCamera) return null;
    
    return masterLightingIntegration.generateExposureAnimation(
      activeCamera.currentSettings,
      endSettings,
      duration,
      1,  // 1 second keyframe interval
      easing
    );
  }, [activeCamera]);
  
  // ==========================================================================
  // 12. GOBO/IES
  // ==========================================================================
  
  const calculateGoboLoss = useCallback((
    goboType: string,
    goboPattern: 'solid' | 'pattern' |'breakup'): number => {
    return masterLightingIntegration.calculateGoboLightLoss(goboType, goboPattern);
  }, []);
  
  // ==========================================================================
  // RETURN
  // ==========================================================================
  
  return {
    // Loading state
    isLoading: inventoryLoading,
    
    // Scene data
    lights,
    cameras,
    activeCamera,
    
    // 1. AI Recommendations
    aiRecommendations,
    isLoadingAI,
    getAIRecommendations,
    
    // 2. HDRI
    hdriExposure,
    currentHDRI,
    setHDRI,
    
    // 3. Templates
    enhanceTemplate,
    
    // 4. Cost
    calculatePatternCost,
    
    // 5. Presets
    savedPresets,
    saveCurrentAsPreset,
    loadPreset,
    deletePreset,
    
    // 6. LUTs
    getLUTRecommendations,
    
    // 7. Multi-Camera
    cameraExposures,
    syncMode,
    setSyncMode,
    applyCameraSync,
    syncAllCameras,
    
    // 8. Histogram
    histogramFeedback,
    updateHistogram,
    applyHistogramSuggestion,
    
    // 9. Community
    prepareCommunityShare,
    
    // 10. Virtual Actors
    getActorMetering,
    
    // 11. Timeline
    generateExposureAnimation,
    
    // 12. Gobo/IES
    calculateGoboLoss,
  };
}

export default useMasterLightingIntegration;
