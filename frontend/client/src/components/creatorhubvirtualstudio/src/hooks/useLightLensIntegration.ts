/**
 * Light-Lens Integration Hook
 * 
 * Provides unified access to the light, lens, and camera integration features:
 * - Exposure calculations
 * - Lens attachment
 * - Flash sync validation
 * - Focus distance validation
 * - Inverse square law
 * - Modifier light loss
 * - Vignetting preview
 */

import { useMemo, useCallback, useEffect, useState } from 'react';
import { useNodes, useActions } from '@/state/selectors';
import { 
  exposureCalculator, 
  SceneExposureAnalysis,
  LightSource,
  CameraSettings,
  ExposureRecommendation,
  MODIFIER_LIGHT_LOSS,
} from '@/core/services/exposureCalculatorService';
import { findLensSpec, findLensSpecByBrand, LensSpec, getFocalLengthFromLensSpec, getMaxApertureFromLensSpec } from '@/core/data/LensSpecifications';
import { lensSpecToEffects, LensEffectsParams } from '@/core/rendering/LensEffectsRenderer';

// =============================================================================
// TYPES
// =============================================================================

export interface LightInfo {
  id: string;
  name: string;
  type: 'strobe' | 'speedlite' | 'continuous' | 'led_panel';
  power: number;
  powerAtSubject: number;
  distance: number;
  modifier?: string;
  modifierLoss: number;
  colorTemp?: number;
  recommendedFStop: number;
  position: [number, number, number];
  hss?: boolean;
  ttl?: boolean;
}

export interface CameraInfo {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  mount?: string;
  aperture: number;
  shutter: number;
  iso: number;
  focalLength: number;
  focusDistance: number;
  sensorSize: [number, number];
  ev: number;
  attachedLens?: {
    id?: string;
    brand?: string;
    model?: string;
  };
  lensSpecs?: Partial<LensSpec>;
  lensEffects?: LensEffectsParams;
}

export interface IntegrationWarnings {
  flashSync?: string;
  focusDistance?: string;
  mountCompatibility?: string;
  exposure?: string[];
}

export interface SceneAnalysis {
  totalEV: number;
  keyLightEV: number;
  fillLightEV: number;
  contrastRatio: string;
  recommendedSettings: ExposureRecommendation;
  warnings: IntegrationWarnings;
  lights: LightInfo[];
  camera: CameraInfo | null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useLightLensIntegration() {
  const nodes = useNodes();
  const { updateNode } = useActions();
  const [subjectPosition, setSubjectPosition] = useState<[number, number, number]>([0, 1.6, 0]);
  
  // ==========================================================================
  // EXTRACT LIGHTS
  // ==========================================================================
  
  const lights = useMemo<LightInfo[]>(() => {
    return nodes
      .filter(n => n.light && n.visible !== false)
      .map(n => {
        const userData = n.userData || {};
        const specs = userData.specifications || {};
        
        // Determine light type
        const lightType = userData.lightType || 
          (specs.guideNumber ? 'speedlite' : 
           specs.lumens ? 'continuous' : 'strobe');
        
        // Get raw power
        let power = n.light.power || 0.5;
        if (userData.wattage) {
          power = userData.wattage;
        } else if (lightType === 'strobe') {
          power = power * 1000;
        } else if (lightType === 'continuous' || lightType === 'led_panel') {
          power = power * 600;
        } else if (lightType === 'speedlite') {
          power = specs.guideNumber || 40;
        }
        
        // Calculate distance to subject
        const dx = n.transform.position[0] - subjectPosition[0];
        const dy = n.transform.position[1] - subjectPosition[1];
        const dz = n.transform.position[2] - subjectPosition[2];
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // Get modifier loss
        const modifierLoss = exposureCalculator.getModifierLightLoss(n.light.modifier);
        
        // Calculate power at subject
        const effectivePower = exposureCalculator.calculatePowerAfterModifier(power, n.light.modifier);
        const powerAtSubject = exposureCalculator.calculateIntensityAtDistance(effectivePower, distance);
        
        // Calculate recommended f-stop
        const recommendedFStop = exposureCalculator.calculateFStopForStrobe(
          power,
          distance,
          n.light.modifier,
          100
        );
        
        return {
          id: n.id,
          name: n.name,
          type: lightType as any,
          power,
          powerAtSubject,
          distance,
          modifier: n.light.modifier,
          modifierLoss,
          colorTemp: n.light.cct || specs.colorTemp,
          recommendedFStop,
          position: n.transform.position as [number, number, number],
          hss: specs.hss,
          ttl: specs.ttl,
        };
      });
  }, [nodes, subjectPosition]);
  
  // ==========================================================================
  // EXTRACT CAMERA
  // ==========================================================================
  
  const camera = useMemo<CameraInfo | null>(() => {
    const camNode = nodes.find(n => n.camera && n.visible !== false);
    if (!camNode?.camera) return null;
    
    const userData = camNode.userData || {};
    const lensSpecs = userData.lensSpecs;
    
    // Detect mount
    const brand = (userData.brand || '').toLowerCase();
    const model = (userData.model || '').toLowerCase();
    let mount = 'universal';
    if (brand.includes('canon')) mount = model.includes('eos r') ? 'rf' : 'ef';
    else if (brand.includes('sony')) mount = 'fe';
    else if (brand.includes('nikon')) mount = model.includes('z') ? 'z' : 'f';
    else if (brand.includes('fuji')) mount = model.includes('gfx') ? 'gfx' : 'x';
    
    // Calculate EV
    const aperture = camNode.camera.aperture || 2.8;
    const shutter = camNode.camera.shutter || 1/125;
    const iso = camNode.camera.iso || 100;
    const ev = exposureCalculator.calculateEV(aperture, shutter, iso);
    
    // Get lens effects
    const lensEffects = lensSpecs ? lensSpecToEffects(lensSpecs) : undefined;
    
    return {
      id: camNode.id,
      name: camNode.name,
      brand: userData.brand,
      model: userData.model,
      mount,
      aperture,
      shutter,
      iso,
      focalLength: camNode.camera.focalLength || 50,
      focusDistance: userData.focusDistance || 2,
      sensorSize: camNode.camera.sensor || [36, 24],
      ev,
      attachedLens: userData.attachedLens,
      lensSpecs,
      lensEffects,
    };
  }, [nodes]);
  
  // ==========================================================================
  // SCENE ANALYSIS
  // ==========================================================================
  
  const sceneAnalysis = useMemo<SceneAnalysis>(() => {
    const warnings: IntegrationWarnings = {};
    
    if (lights.length === 0) {
      return {
        totalEV: camera?.ev || 8,
        keyLightEV: 0,
        fillLightEV: 0,
        contrastRatio: 'N/A',
        recommendedSettings: {
          aperture: 8,
          shutter: 1/125,
          iso: 100,
          ev: 8,
          confidence: 0,
          notes: ['Add lights to scene for exposure recommendations'],
          warnings: [],
        },
        warnings,
        lights,
        camera,
      };
    }
    
    // Build light sources for analysis
    const lightSources: LightSource[] = lights.map(l => ({
      id: l.id,
      type: l.type,
      power: l.power,
      distance: l.distance,
      modifier: l.modifier,
      position: l.position,
      colorTemp: l.colorTemp,
      specifications: { hss: l.hss, ttl: l.ttl },
    }));
    
    const cameraSettings: CameraSettings = camera ? {
      aperture: camera.aperture,
      shutter: camera.shutter,
      iso: camera.iso,
      focalLength: camera.focalLength,
      focusDistance: camera.focusDistance,
      sensorSize: camera.sensorSize,
      lensSpecs: camera.lensSpecs,
    } : {
      aperture: 8,
      shutter: 1/125,
      iso: 100,
      focalLength: 50,
      focusDistance: 2,
      sensorSize: [36, 24],
    };
    
    // Run exposure analysis
    const analysis = exposureCalculator.analyzeSceneExposure(
      lightSources,
      cameraSettings,
      subjectPosition,
      camera?.brand,
      camera?.model
    );
    
    // Collect warnings
    if (analysis.flashSyncWarning) {
      warnings.flashSync = analysis.flashSyncWarning;
    }
    if (analysis.focusWarning) {
      warnings.focusDistance = analysis.focusWarning;
    }
    if (analysis.mountCompatibilityWarning) {
      warnings.mountCompatibility = analysis.mountCompatibilityWarning;
    }
    if (analysis.recommendedSettings.warnings.length > 0) {
      warnings.exposure = analysis.recommendedSettings.warnings;
    }
    
    return {
      totalEV: analysis.totalEV,
      keyLightEV: analysis.keyLightEV,
      fillLightEV: analysis.fillLightEV,
      contrastRatio: analysis.contrastRatio,
      recommendedSettings: analysis.recommendedSettings,
      warnings,
      lights,
      camera,
    };
  }, [lights, camera, subjectPosition]);
  
  // ==========================================================================
  // ACTIONS
  // ==========================================================================
  
  /**
   * Apply recommended exposure settings to camera
   */
  const applyRecommendedSettings = useCallback(() => {
    if (!camera) return;
    
    const { recommendedSettings } = sceneAnalysis;
    
    updateNode(camera.id, {
      camera: {
        aperture: recommendedSettings.aperture,
        shutter: recommendedSettings.shutter,
        iso: recommendedSettings.iso,
      },
    });
  }, [camera, sceneAnalysis, updateNode]);
  
  /**
   * Attach a lens to the current camera
   */
  const attachLens = useCallback((lens: {
    id?: string;
    brand?: string;
    model?: string;
  }) => {
    if (!camera) return;
    
    const lensSpec = findLensSpec(lens.brand, lens.model) || 
                     findLensSpecByBrand(lens.brand);
    
    const focalLength = lensSpec ? getFocalLengthFromLensSpec(lensSpec as LensSpec) : 50;
    const maxAperture = lensSpec ? getMaxApertureFromLensSpec(lensSpec as LensSpec) : 2.8;
    
    updateNode(camera.id, {
      camera: {
        focalLength,
        aperture: Math.max(camera.aperture, maxAperture),
      },
      userData: {
        attachedLens: lens,
        lensSpecs: lensSpec,
      },
    });
  }, [camera, updateNode]);
  
  /**
   * Detach current lens from camera
   */
  const detachLens = useCallback(() => {
    if (!camera) return;
    
    updateNode(camera.id, {
      userData: {
        attachedLens: undefined,
        lensSpecs: undefined,
      },
    });
  }, [camera, updateNode]);
  
  /**
   * Update subject position for exposure calculations
   */
  const updateSubjectPosition = useCallback((position: [number, number, number]) => {
    setSubjectPosition(position);
  }, []);
  
  /**
   * Calculate exposure for a specific light
   */
  const calculateLightExposure = useCallback((lightId: string, iso: number = 100) => {
    const light = lights.find(l => l.id === lightId);
    if (!light) return null;
    
    return {
      recommendedFStop: exposureCalculator.calculateFStopForStrobe(
        light.power,
        light.distance,
        light.modifier,
        iso
      ),
      powerAtSubject: light.powerAtSubject,
      modifierLoss: light.modifierLoss,
      distance: light.distance,
    };
  }, [lights]);
  
  /**
   * Calculate inverse square falloff between two distances
   */
  const calculateFalloff = useCallback((distance1: number, distance2: number) => {
    return {
      stopsLost: exposureCalculator.calculateFalloff(distance1, distance2),
      intensityRatio: Math.pow(distance1 / distance2, 2),
    };
  }, []);
  
  /**
   * Validate flash sync for current settings
   */
  const validateFlashSync = useCallback(() => {
    if (!camera || lights.length === 0) return { valid: true };
    
    const hasStrobes = lights.some(l => l.type === 'strobe' || l.type ==='speedlite');
    if (!hasStrobes) return { valid: true };
    
    const anyHSS = lights.some(l => l.hss);
    return exposureCalculator.checkFlashSync(
      camera.shutter,
      camera.brand,
      camera.model,
      anyHSS
    );
  }, [camera, lights]);
  
  /**
   * Validate focus distance against lens minimum
   */
  const validateFocusDistance = useCallback(() => {
    if (!camera?.lensSpecs?.minFocusDistance) return { valid: true };
    
    return exposureCalculator.validateFocusDistance(
      camera.focusDistance,
      camera.lensSpecs.minFocusDistance,
      camera.attachedLens?.model
    );
  }, [camera]);
  
  /**
   * Get modifier light loss
   */
  const getModifierLoss = useCallback((modifier: string) => {
    return exposureCalculator.getModifierLightLoss(modifier);
  }, []);
  
  // ==========================================================================
  // RETURN
  // ==========================================================================
  
  return {
    // Data
    lights,
    camera,
    sceneAnalysis,
    subjectPosition,
    
    // Actions
    applyRecommendedSettings,
    attachLens,
    detachLens,
    updateSubjectPosition,
    
    // Calculations
    calculateLightExposure,
    calculateFalloff,
    validateFlashSync,
    validateFocusDistance,
    getModifierLoss,
    
    // Reference data
    modifierLossTable: MODIFIER_LIGHT_LOSS,
  };
}

export default useLightLensIntegration;

