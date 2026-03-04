/**
 * Master Lighting Integration Service
 * 
 * Central hub connecting the Light-Lens-Pattern system to ALL Virtual Studio features:
 * 
 * 1. AI Lighting Assistant - Smart recommendations using real specs
 * 2. HDRI Environment - Auto-adjust exposure for environment lighting
 * 3. Scene Templates - Equipment matching for templates
 * 4. Cost Calculator - Cost analysis for patterns
 * 5. Gear Presets - Save/load complete studio states
 * 6. LUT Recommendations - Match LUTs to lighting mood
 * 7. Multi-Camera - Sync exposure across cameras
 * 8. Histogram - Feedback loop for exposure
 * 9. Community - Share patterns with exposure data
 * 10. Gobo/IES - Include light modifiers in calculations
 * 11. Timeline - Animate exposure over time
 * 12. Virtual Actors - Skin tone metering
 */

import type { ExposureRecommendation} from './exposureCalculatorService';
import { exposureCalculator, MODIFIER_LIGHT_LOSS } from './exposureCalculatorService';
import type { PatternExposureAnalysis } from './patternExposureIntegration';
import { patternExposureIntegration } from './patternExposureIntegration';
import type { CinematographyPattern, LightSetup } from './cinematographyPatternsService';
import { cinematographyPatternsService } from './cinematographyPatternsService';
import type { StudioLight } from '../data/LightSpecifications';
import { findLightSpec, findLensSpec } from '../data/LightSpecifications';
import type { UserEquipmentItem } from '@/hooks/useUserEquipmentInventory';

// =============================================================================
// TYPES
// =============================================================================

export interface HDRIExposureData {
  name: string;
  path: string;
  brightness: number;        // 0-1 normalized
  evContribution: number;    // EV from HDRI
  dominantColorTemp: number; // Kelvin
  recommendedAdjustment: {
    exposureCompensation: number;  // Stops
    whiteBalance: number;          // Kelvin
    mixWarning?: string;           // Warning about mixed lighting
  };
}

export interface TemplateExposureData {
  templateId: string;
  templateName: string;
  category: string;
  requiredEquipment: Array<{
    role: string;
    minPower: number;
    idealPower: number;
    modifier: string;
  }>;
  recommendedSettings: ExposureRecommendation;
  feasibilityWithUserGear: number;
  missingEquipment: string[];
  estimatedCost: {
    purchase: number;
    rental: number;
  };
}

export interface GearPresetState {
  id: string;
  name: string;
  createdAt: Date;
  
  // Light configuration
  lights: Array<{
    equipmentId?: string;
    brand?: string;
    model?: string;
    position: [number, number, number];
    rotation: [number, number, number];
    power: number;
    cct: number;
    modifier?: string;
  }>;
  
  // Camera configuration
  camera: {
    equipmentId?: string;
    brand?: string;
    model?: string;
    position: [number, number, number];
    aperture: number;
    shutter: number;
    iso: number;
    focalLength: number;
  };
  
  // Lens configuration
  lens?: {
    equipmentId?: string;
    brand?: string;
    model?: string;
  };
  
  // Environment
  hdri?: string;
  
  // Pattern reference
  patternId?: string;
  patternName?: string;
  
  // Exposure metadata
  exposureData: {
    ev: number;
    contrastRatio: string;
    dynamicRange: number;
  };
  
  // Tags
  tags: string[];
  thumbnail?: string;
}

export interface LUTRecommendation {
  lutId: string;
  lutName: string;
  category: string;
  matchScore: number;
  reason: string;
  preview?: string;
}

export interface MultiCameraExposure {
  cameraId: string;
  cameraName: string;
  position: [number, number, number];
  currentSettings: {
    aperture: number;
    shutter: number;
    iso: number;
  };
  recommendedSettings: ExposureRecommendation;
  evDifference: number;  // Difference from main camera
  syncStatus: 'synced' | 'offset' | 'manual';
}

export interface HistogramFeedback {
  overexposed: number;     // % of pixels
  underexposed: number;    // % of pixels
  midtones: number;        // % of pixels
  clipping: {
    highlights: boolean;
    shadows: boolean;
  };
  suggestedAdjustment: {
    direction: 'brighter' | 'darker' | 'optimal';
    stops: number;
    method: 'aperture' | 'shutter' | 'iso' | 'light-power';
  };
}

export interface CommunityShareData {
  patternId?: string;
  patternName?: string;
  exposureSettings: ExposureRecommendation;
  equipmentUsed: Array<{
    brand: string;
    model: string;
    role: string;
  }>;
  contrastRatio: string;
  tags: string[];
  notes?: string;
}

export interface VirtualActorMetering {
  actorId: string;
  skinTone: 'light' | 'medium' | 'dark';
  exposureAdjustment: number;  // Stops
  recommendedKeyFill: number;  // Ratio
  notes: string;
}

export interface TimelineExposureKeyframe {
  time: number;           // Seconds
  settings: {
    aperture: number;
    shutter: number;
    iso: number;
  };
  lightPowers: Record<string, number>;  // lightId -> power
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

// =============================================================================
// HDRI EXPOSURE DATA
// =============================================================================

const HDRI_EXPOSURE_DATA: Record<string, Partial<HDRIExposureData>> = {
  // Studio HDRIs
  'studio-soft': { brightness: 0.3, evContribution: 2, dominantColorTemp: 5500 },
  'studio-bright': { brightness: 0.6, evContribution: 5, dominantColorTemp: 5600 },
  'studio-dark': { brightness: 0.1, evContribution: -1, dominantColorTemp: 5500 },
  
  // Outdoor HDRIs
  'sunny-day': { brightness: 0.95, evContribution: 14, dominantColorTemp: 5500 },
  overcast: { brightness: 0.5, evContribution: 10, dominantColorTemp: 6500 },
  'golden-hour': { brightness: 0.7, evContribution: 12, dominantColorTemp: 3500 },
  'blue-hour': { brightness: 0.2, evContribution: 4, dominantColorTemp: 9000 },
  sunset: { brightness: 0.6, evContribution: 11, dominantColorTemp: 3000 },
  
  // Indoor HDRIs
  office: { brightness: 0.4, evContribution: 7, dominantColorTemp: 4000 },
  warehouse: { brightness: 0.3, evContribution: 5, dominantColorTemp: 5000 },
  'living-room': { brightness: 0.25, evContribution: 4, dominantColorTemp: 2700 },
  
  // Night HDRIs
  'night-city': { brightness: 0.15, evContribution: 1, dominantColorTemp: 4500 },
  moonlight: { brightness: 0.05, evContribution: -3, dominantColorTemp: 6500 },
};

// =============================================================================
// LUT MOOD MAPPING
// =============================================================================

const LUT_MOOD_MAPPING: Record<string, string[]> = {
  // Pattern moods -> LUT categories
  bright: ['clean', 'vibrant', 'summer', 'fresh'],
  'high-key': ['bright', 'airy', 'fashion', 'beauty'],
  neutral: ['natural', 'balanced', 'documentary'],
  dramatic: ['cinematic', 'contrast', 'moody', 'film'],
  'low-key': ['dark', 'noir', 'shadows', 'mysterious'],
  dark: ['noir', 'thriller', 'horror', 'night'],
};

// =============================================================================
// SKIN TONE METERING
// =============================================================================

const SKIN_TONE_ADJUSTMENTS: Record<string, { evAdjust: number; keyFillRatio: number; notes: string }> = {
  light: {
    evAdjust: 0,
    keyFillRatio: 3,
    notes: 'Standard metering, avoid overexposure on highlights',
  },
  medium: {
    evAdjust: 0.3,
    keyFillRatio: 2.5,
    notes: 'Slight overexposure for natural look',
  },
  dark: {
    evAdjust: 0.7,
    keyFillRatio: 2,
    notes: 'Open up exposure, use lower contrast ratio for detail',
  },
};

// =============================================================================
// MASTER INTEGRATION SERVICE
// =============================================================================

class MasterLightingIntegrationService {
  
  // ===========================================================================
  // 1. AI LIGHTING ASSISTANT INTEGRATION
  // ===========================================================================
  
  /**
   * Get AI recommendations enhanced with real exposure data
   */
  getAIRecommendations(
    mood: string,
    subject: 'portrait' | 'product' | 'fashion' | 'automotive' | 'food',
    userInventory: UserEquipmentItem[],
    constraints?: {
      maxBudget?: number;
      availableSpace?: number;  // meters
      skillLevel?: 'beginner' | 'intermediate' | 'advanced';
    }
  ): {
    recommendedPatterns: Array<{
      pattern: CinematographyPattern;
      analysis: PatternExposureAnalysis;
      aiScore: number;
      reasoning: string;
    }>;
    quickSetup: {
      lights: number;
      totalPower: number;
      estimatedTime: string;
      difficulty: string;
    };
  } {
    const patterns = cinematographyPatternsService.getAllPatterns();
    const recommendations: Array<{
      pattern: CinematographyPattern;
      analysis: PatternExposureAnalysis;
      aiScore: number;
      reasoning: string;
    }> = [];
    
    for (const pattern of patterns) {
      // Filter by mood
      if (mood && pattern.mood !== mood && !this.moodMatches(pattern.mood, mood)) {
        continue;
      }
      
      // Filter by skill level
      if (constraints?.skillLevel) {
        const difficultyOrder = ['beginner','intermediate','advanced','expert'];
        const patternDiff = difficultyOrder.indexOf(pattern.difficulty);
        const userDiff = difficultyOrder.indexOf(constraints.skillLevel);
        if (patternDiff > userDiff + 1) continue;  // Allow one level above
      }
      
      // Get full analysis with equipment matching
      const analysis = patternExposureIntegration.analyzePatternWithEquipment(
        pattern,
        userInventory
      );
      
      // Calculate AI score
      let aiScore = analysis.feasibilityScore * 0.5;  // Equipment match
      
      // Bonus for matching subject type
      if (this.subjectMatchesCategory(subject, pattern.category)) {
        aiScore += 0.2;
      }
      
      // Bonus for appropriate difficulty
      if (pattern.difficulty === constraints?.skillLevel) {
        aiScore += 0.1;
      }
      
      // Penalty for budget overrun
      if (constraints?.maxBudget) {
        const estimatedCost = this.estimateCost(analysis.requirements, userInventory);
        if (estimatedCost.rental > constraints.maxBudget) {
          aiScore -= 0.2;
        }
      }
      
      // Generate reasoning
      const reasoning = this.generateRecommendationReasoning(pattern, analysis, aiScore);
      
      recommendations.push({
        pattern,
        analysis,
        aiScore: Math.min(1, Math.max(0, aiScore)),
        reasoning,
      });
    }
    
    // Sort by AI score
    recommendations.sort((a, b) => b.aiScore - a.aiScore);
    
    // Quick setup summary
    const topPattern = recommendations[0];
    const quickSetup = topPattern ? {
      lights: topPattern.analysis.requirements.length,
      totalPower: topPattern.analysis.totalWattageNeeded,
      estimatedTime: this.estimateSetupTime(topPattern.pattern.difficulty),
      difficulty: topPattern.pattern.difficulty,
    } : {
      lights: 3,
      totalPower: 1000,
      estimatedTime: '15-20 min',
      difficulty: 'intermediate',
    };
    
    return {
      recommendedPatterns: recommendations.slice(0, 5),
      quickSetup,
    };
  }
  
  // ===========================================================================
  // 2. HDRI ENVIRONMENT INTEGRATION
  // ===========================================================================
  
  /**
   * Calculate exposure adjustment for HDRI environment
   */
  calculateHDRIExposure(
    hdriPath: string,
    studioLights: Array<{ power: number; distance: number; modifier?: string }>,
    targetFStop: number = 8
  ): HDRIExposureData {
    // Extract HDRI name from path
    const hdriName = hdriPath.split('/,').pop()?.replace(/\.[^.]+$/g, ',') || 'unknown';
    const hdriData = HDRI_EXPOSURE_DATA[hdriName] || {
      brightness: 0.3,
      evContribution: 3,
      dominantColorTemp: 5500,
    };
    
    // Calculate studio light EV contribution
    let studioEV = 0;
    if (studioLights.length > 0) {
      const totalPower = studioLights.reduce((sum, l) => {
        const effectivePower = exposureCalculator.calculatePowerAfterModifier(l.power, l.modifier);
        return sum + exposureCalculator.calculateIntensityAtDistance(effectivePower, l.distance);
      }, 0);
      studioEV = Math.log2(totalPower / 100) + 8;  // Approximate EV from power
    }
    
    // Determine mixing situation
    const hdriEV = hdriData.evContribution || 3;
    const evDifference = Math.abs(studioEV - hdriEV);
    
    let mixWarning: string | undefined;
    if (evDifference > 3 && studioLights.length > 0 && hdriData.brightness! > 0.3) {
      mixWarning = `HDRI (EV ${hdriEV}) and studio lights (EV ${studioEV.toFixed(1)}) differ by ${evDifference.toFixed(1)} stops. Consider adjusting light power or using a darker HDRI.`;
    }
    
    // Calculate recommended adjustment
    const combinedEV = studioLights.length > 0 
      ? Math.log2(Math.pow(2, studioEV) + Math.pow(2, hdriEV))
      : hdriEV;
    
    const targetEV = exposureCalculator.calculateEV(targetFStop, 1/125, 100);
    const exposureCompensation = targetEV - combinedEV;
    
    // Color temperature recommendation
    let whiteBalance = hdriData.dominantColorTemp || 5500;
    if (studioLights.length > 0) {
      // Assume studio lights at 5600K, blend
      whiteBalance = Math.round((whiteBalance + 5600) / 2);
    }
    
    return {
      name: hdriName,
      path: hdriPath,
      brightness: hdriData.brightness || 0.3,
      evContribution: hdriEV,
      dominantColorTemp: hdriData.dominantColorTemp || 5500,
      recommendedAdjustment: {
        exposureCompensation,
        whiteBalance,
        mixWarning,
      },
    };
  }
  
  // ===========================================================================
  // 3. SCENE TEMPLATES INTEGRATION
  // ===========================================================================
  
  /**
   * Enhance template with exposure and equipment data
   */
  enhanceTemplate(
    template: {
      id: string;
      name: string;
      category: string;
      lights: LightSetup[];
    },
    userInventory: UserEquipmentItem[]
  ): TemplateExposureData {
    // Convert template lights to requirements
    const requirements = template.lights.map(light => ({
      role: light.role,
      minPower: light.power * 500 * 0.5,  // Denormalize and get min
      idealPower: light.power * 500,       // Denormalize
      modifier: light.modifier || 'standard',
    }));
    
    // Match equipment
    const { matches, missing, feasibilityScore } = patternExposureIntegration.matchEquipment(
      requirements.map((r, i) => ({
        ...r,
        name: template.lights[i].name,
        cct: template.lights[i].cct,
        position: template.lights[i].position,
        distance: template.lights[i].distance,
        angle: template.lights[i].angle,
      })),
      userInventory
    );
    
    // Calculate exposure
    const recommendedSettings = exposureCalculator.getSettingsForEV(
      8 + Math.log2(requirements.reduce((sum, r) => sum + r.idealPower, 0) / 500)
    );
    
    // Estimate costs
    const estimatedCost = this.estimateCost(requirements, userInventory);
    
    return {
      templateId: template.id,
      templateName: template.name,
      category: template.category,
      requiredEquipment: requirements,
      recommendedSettings,
      feasibilityWithUserGear: feasibilityScore,
      missingEquipment: missing.map(m => `${m.idealPower}Ws ${m.modifier}`),
      estimatedCost,
    };
  }
  
  // ===========================================================================
  // 4. COST CALCULATOR INTEGRATION
  // ===========================================================================
  
  /**
   * Calculate equipment costs for a pattern/template
   */
  calculatePatternCost(
    patternId: string,
    userInventory: UserEquipmentItem[],
    rentalDays: number = 1
  ): {
    ownedEquipmentValue: number;
    missingEquipmentCost: number;
    rentalCost: number;
    totalCost: number;
    breakdown: Array<{
      item: string;
      owned: boolean;
      purchasePrice: number;
      rentalPrice: number;
    }>;
  } {
    const pattern = cinematographyPatternsService.getPatternById(patternId);
    if (!pattern) {
      return {
        ownedEquipmentValue: 0,
        missingEquipmentCost: 0,
        rentalCost: 0,
        totalCost: 0,
        breakdown: [],
      };
    }
    
    const analysis = patternExposureIntegration.analyzePatternWithEquipment(pattern, userInventory);
    const breakdown: Array<{
      item: string;
      owned: boolean;
      purchasePrice: number;
      rentalPrice: number;
    }> = [];
    
    let ownedEquipmentValue = 0;
    let missingEquipmentCost = 0;
    let rentalCost = 0;
    
    for (const match of analysis.equipmentMatches) {
      const spec = match.matchedSpec as StudioLight | undefined;
      const purchasePrice = spec?.price || this.estimatePrice(match.requirement.idealPower, match.requirement.modifier);
      const rentalPrice = spec?.rentalPrice || Math.round(purchasePrice * 0.05);  // 5% of purchase per day
      
      if (match.matchedEquipment) {
        ownedEquipmentValue += purchasePrice;
        breakdown.push({
          item: `${match.matchedEquipment.brand} ${match.matchedEquipment.model} (${match.requirement.role})`,
          owned: true,
          purchasePrice,
          rentalPrice,
        });
      } else {
        missingEquipmentCost += purchasePrice;
        rentalCost += rentalPrice * rentalDays;
        breakdown.push({
          item: `${match.requirement.idealPower}Ws ${match.requirement.modifier} (${match.requirement.role})`,
          owned: false,
          purchasePrice,
          rentalPrice: rentalPrice * rentalDays,
        });
      }
    }
    
    return {
      ownedEquipmentValue,
      missingEquipmentCost,
      rentalCost,
      totalCost: rentalCost, // User would rent missing, not buy
      breakdown,
    };
  }
  
  // ===========================================================================
  // 5. GEAR PRESETS INTEGRATION
  // ===========================================================================
  
  /**
   * Create a gear preset from current scene state
   */
  createGearPreset(
    name: string,
    sceneState: {
      lights: Array<{
        id: string;
        position: [number, number, number];
        rotation: [number, number, number];
        power: number;
        cct: number;
        modifier?: string;
        userData?: any;
      }>;
      camera: {
        id: string;
        position: [number, number, number];
        aperture: number;
        shutter: number;
        iso: number;
        focalLength: number;
        userData?: any;
      };
    },
    patternId?: string,
    tags: string[] = []
  ): GearPresetState {
    // Calculate exposure data
    const ev = exposureCalculator.calculateEV(
      sceneState.camera.aperture,
      sceneState.camera.shutter,
      sceneState.camera.iso
    );
    
    // Determine contrast ratio from lights
    const keyLight = sceneState.lights.find(l => l.userData?.role === 'key, ');
    const fillLight = sceneState.lights.find(l => l.userData?.role === 'fill');
    const contrastRatio = keyLight && fillLight 
      ? `${Math.round(keyLight.power / fillLight.power)}:1`
      : 'N/A';
    
    // Dynamic range estimate
    const powers = sceneState.lights.map(l => l.power);
    const dynamicRange = powers.length > 1 
      ? Math.log2(Math.max(...powers) / Math.min(...powers)) + 3
      : 5;
    
    return {
      id: `preset_${Date.now()}`,
      name,
      createdAt: new Date(),
      lights: sceneState.lights.map(l => ({
        equipmentId: l.userData?.equipmentId,
        brand: l.userData?.brand,
        model: l.userData?.model,
        position: l.position,
        rotation: l.rotation,
        power: l.power,
        cct: l.cct,
        modifier: l.modifier,
      })),
      camera: {
        equipmentId: sceneState.camera.userData?.equipmentId,
        brand: sceneState.camera.userData?.brand,
        model: sceneState.camera.userData?.model,
        position: sceneState.camera.position,
        aperture: sceneState.camera.aperture,
        shutter: sceneState.camera.shutter,
        iso: sceneState.camera.iso,
        focalLength: sceneState.camera.focalLength,
      },
      lens: sceneState.camera.userData?.attachedLens,
      patternId,
      patternName: patternId ? cinematographyPatternsService.getPatternById(patternId)?.name : undefined,
      exposureData: {
        ev,
        contrastRatio,
        dynamicRange,
      },
      tags,
    };
  }
  
  /**
   * Apply a gear preset to scene
   */
  applyGearPreset(preset: GearPresetState): {
    lights: Array<{
      position: [number, number, number];
      rotation: [number, number, number];
      power: number;
      cct: number;
      modifier?: string;
      brand?: string;
      model?: string;
    }>;
    camera: {
      position: [number, number, number];
      aperture: number;
      shutter: number;
      iso: number;
      focalLength: number;
    };
    events: Array<{ type: string; detail: any }>;
  } {
    const events: Array<{ type: string; detail: any }> = [];
    
    // Prepare light data
    const lights = preset.lights.map(l => ({
      position: l.position,
      rotation: l.rotation,
      power: l.power,
      cct: l.cct,
      modifier: l.modifier,
      brand: l.brand,
      model: l.model,
    }));
    
    // Prepare camera data
    const camera = {
      position: preset.camera.position,
      aperture: preset.camera.aperture,
      shutter: preset.camera.shutter,
      iso: preset.camera.iso,
      focalLength: preset.camera.focalLength,
    };
    
    // Generate events for scene updates
    events.push({
      type: 'ch-apply-preset-lights',
      detail: { lights, presetName: preset.name },
    });
    
    events.push({
      type: 'ch-apply-preset-camera',
      detail: { camera, presetName: preset.name },
    });
    
    if (preset.lens) {
      events.push({
        type: 'ch-apply-preset-lens',
        detail: { lens: preset.lens },
      });
    }
    
    return { lights, camera, events };
  }
  
  // ===========================================================================
  // 6. LUT RECOMMENDATIONS INTEGRATION
  // ===========================================================================
  
  /**
   * Get LUT recommendations based on lighting mood
   */
  getLUTRecommendations(
    patternMood: string,
    contrastRatio: string,
    availableLUTs: Array<{ id: string; name: string; category: string; preview?: string }>
  ): LUTRecommendation[] {
    const recommendations: LUTRecommendation[] = [];
    const targetCategories = LUT_MOOD_MAPPING[patternMood] || ['natural','balanced'];
    
    for (const lut of availableLUTs) {
      let matchScore = 0;
      let reason = ', ';
      
      // Check category match
      const lutCategoryLower = lut.category.toLowerCase();
      const lutNameLower = lut.name.toLowerCase();
      
      for (const targetCat of targetCategories) {
        if (lutCategoryLower.includes(targetCat) || lutNameLower.includes(targetCat)) {
          matchScore += 0.4;
          reason = `Matches ${patternMood} mood`;
          break;
        }
      }
      
      // Check contrast ratio compatibility
      const contrastNum = parseInt(contrastRatio.split(':')[0]);
      if (contrastNum >= 4 && (lutNameLower.includes('contrast') || lutCategoryLower.includes('cinematic'))) {
        matchScore += 0.3;
        reason += reason ? `, high contrast compatible` : 'High contrast compatible';
      }
      if (contrastNum <= 2 && (lutNameLower.includes('soft') || lutNameLower.includes('flat'))) {
        matchScore += 0.3;
        reason += reason ? `, low contrast compatible` : 'Low contrast compatible';
      }
      
      // Add if score > 0
      if (matchScore > 0) {
        recommendations.push({
          lutId: lut.id,
          lutName: lut.name,
          category: lut.category,
          matchScore: Math.min(1, matchScore),
          reason: reason || 'General match',
          preview: lut.preview,
        });
      }
    }
    
    return recommendations.sort((a, b) => b.matchScore - a.matchScore).slice(0, 10);
  }
  
  // ===========================================================================
  // 7. MULTI-CAMERA EXPOSURE SYNC
  // ===========================================================================
  
  /**
   * Calculate exposure for multiple cameras
   */
  calculateMultiCameraExposure(
    cameras: Array<{
      id: string;
      name: string;
      position: [number, number, number];
      currentSettings: { aperture: number; shutter: number; iso: number };
      isMain?: boolean;
    }>,
    lights: Array<{
      position: [number, number, number];
      power: number;
      modifier?: string;
    }>,
    syncMode: 'match-ev' | 'match-aperture' | 'independent' = 'match-ev'
  ): MultiCameraExposure[] {
    const results: MultiCameraExposure[] = [];
    
    // Find main camera
    const mainCamera = cameras.find(c => c.isMain) || cameras[0];
    const mainEV = exposureCalculator.calculateEV(
      mainCamera.currentSettings.aperture,
      mainCamera.currentSettings.shutter,
      mainCamera.currentSettings.iso
    );
    
    for (const cam of cameras) {
      // Calculate light intensity at this camera position
      let totalIntensity = 0;
      for (const light of lights) {
        const dx = light.position[0] - cam.position[0];
        const dy = light.position[1] - cam.position[1];
        const dz = light.position[2] - cam.position[2];
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        const effectivePower = exposureCalculator.calculatePowerAfterModifier(light.power, light.modifier);
        totalIntensity += exposureCalculator.calculateIntensityAtDistance(effectivePower, distance);
      }
      
      // Calculate recommended settings
      const camEV = exposureCalculator.calculateEV(
        cam.currentSettings.aperture,
        cam.currentSettings.shutter,
        cam.currentSettings.iso
      );
      
      let recommendedSettings: ExposureRecommendation;
      let syncStatus: 'synced' | 'offset' | 'manual';
      
      if (syncMode === 'match-ev') {
        recommendedSettings = exposureCalculator.getSettingsForEV(mainEV);
        syncStatus = Math.abs(camEV - mainEV) < 0.3 ? 'synced' : 'offset';
      } else if (syncMode === 'match-aperture') {
        // Keep same aperture, adjust shutter/ISO
        const targetEV = mainEV;
        const aperture = mainCamera.currentSettings.aperture;
        const shuttIso = this.solveForShutterISO(targetEV, aperture);
        recommendedSettings = {
          aperture,
          shutter: shuttIso.shutter,
          iso: shuttIso.iso,
          ev: targetEV,
          confidence: 0.9,
          notes: ['Aperture matched to main camera'],
          warnings: [],
        };
        syncStatus = 'synced';
      } else {
        recommendedSettings = exposureCalculator.getSettingsForEV(camEV);
        syncStatus = 'manual';
      }
      
      results.push({
        cameraId: cam.id,
        cameraName: cam.name,
        position: cam.position,
        currentSettings: cam.currentSettings,
        recommendedSettings,
        evDifference: camEV - mainEV,
        syncStatus,
      });
    }
    
    return results;
  }
  
  // ===========================================================================
  // 8. HISTOGRAM FEEDBACK LOOP
  // ===========================================================================
  
  /**
   * Analyze histogram and suggest exposure adjustments
   */
  analyzeHistogram(
    histogramData: { r: number[]; g: number[]; b: number[] },
    currentSettings: { aperture: number; shutter: number; iso: number }
  ): HistogramFeedback {
    // Analyze histogram distribution
    const totalPixels = histogramData.r.reduce((a, b) => a + b, 0);
    
    // Calculate exposure zones
    let overexposed = 0;
    let underexposed = 0;
    let midtones = 0;
    
    for (let i = 0; i < 256; i++) {
      const avgValue = (histogramData.r[i] + histogramData.g[i] + histogramData.b[i]) / 3;
      
      if (i < 20) {
        underexposed += avgValue;
      } else if (i > 235) {
        overexposed += avgValue;
      } else {
        midtones += avgValue;
      }
    }
    
    const overPct = (overexposed / totalPixels) * 100;
    const underPct = (underexposed / totalPixels) * 100;
    const midPct = (midtones / totalPixels) * 100;
    
    // Determine clipping
    const highlightClipping = overPct > 5;
    const shadowClipping = underPct > 10;
    
    // Suggest adjustment
    let direction: 'brighter' | 'darker' | 'optimal' = 'optimal';
    let stops = 0;
    let method: 'aperture' | 'shutter' | 'iso' | 'light-power' = 'aperture';
    
    if (highlightClipping && overPct > 10) {
      direction = 'darker';
      stops = Math.min(2, Math.log2(overPct / 5));
      method = currentSettings.aperture < 11 ? 'aperture' : 
               currentSettings.shutter < 1/500 ? 'shutter' : 'light-power';
    } else if (shadowClipping && underPct > 20 && !highlightClipping) {
      direction = 'brighter';
      stops = Math.min(2, Math.log2(underPct / 10));
      method = currentSettings.iso < 3200 ? 'iso' :
               currentSettings.aperture > 2.8 ? 'aperture' : 'light-power';
    }
    
    return {
      overexposed: Math.round(overPct * 10) / 10,
      underexposed: Math.round(underPct * 10) / 10,
      midtones: Math.round(midPct * 10) / 10,
      clipping: {
        highlights: highlightClipping,
        shadows: shadowClipping,
      },
      suggestedAdjustment: {
        direction,
        stops: Math.round(stops * 10) / 10,
        method,
      },
    };
  }
  
  // ===========================================================================
  // 9. COMMUNITY SHARING INTEGRATION
  // ===========================================================================
  
  /**
   * Prepare data for community sharing
   */
  prepareCommunityShare(
    sceneState: {
      lights: Array<{ userData?: any; power: number; cct: number; modifier?: string }>;
      camera: { aperture: number; shutter: number; iso: number };
    },
    patternId?: string,
    notes?: string
  ): CommunityShareData {
    const pattern = patternId ? cinematographyPatternsService.getPatternById(patternId) : undefined;
    
    // Extract equipment used
    const equipmentUsed = sceneState.lights
      .filter(l => l.userData?.brand && l.userData?.model)
      .map(l => ({
        brand: l.userData!.brand,
        model: l.userData!.model,
        role: l.userData?.role || 'light',
      }));
    
    // Calculate exposure settings
    const ev = exposureCalculator.calculateEV(
      sceneState.camera.aperture,
      sceneState.camera.shutter,
      sceneState.camera.iso
    );
    
    // Calculate contrast ratio
    const powers = sceneState.lights.map(l => l.power);
    const contrastRatio = powers.length >= 2 
      ? `${Math.round(Math.max(...powers) / Math.min(...powers))}:1`
      : 'N/A';
    
    // Auto-generate tags
    const tags: string[] = [];
    if (pattern) {
      tags.push(pattern.category);
      tags.push(pattern.mood);
      tags.push(pattern.difficulty);
    }
    tags.push(`${sceneState.lights.length}-light`);
    if (contrastRatio !== 'N/A') {
      tags.push(contrastRatio.replace(':','to'));
    }
    
    return {
      patternId,
      patternName: pattern?.name,
      exposureSettings: {
        aperture: sceneState.camera.aperture,
        shutter: sceneState.camera.shutter,
        iso: sceneState.camera.iso,
        ev,
        confidence: 1,
        notes: [],
        warnings: [],
      },
      equipmentUsed,
      contrastRatio,
      tags,
      notes,
    };
  }
  
  // ===========================================================================
  // 10. VIRTUAL ACTOR METERING
  // ===========================================================================
  
  /**
   * Get exposure adjustment for virtual actor skin tone
   */
  getVirtualActorMetering(
    actorId: string,
    skinTone: 'light' | 'medium' | 'dark'
  ): VirtualActorMetering {
    const adjustment = SKIN_TONE_ADJUSTMENTS[skinTone];
    
    return {
      actorId,
      skinTone,
      exposureAdjustment: adjustment.evAdjust,
      recommendedKeyFill: adjustment.keyFillRatio,
      notes: adjustment.notes,
    };
  }
  
  // ===========================================================================
  // 11. TIMELINE EXPOSURE ANIMATION
  // ===========================================================================
  
  /**
   * Generate exposure keyframes for animation
   */
  generateExposureAnimation(
    startSettings: { aperture: number; shutter: number; iso: number },
    endSettings: { aperture: number; shutter: number; iso: number },
    duration: number,
    keyframeInterval: number = 1,
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' = 'ease-in-out'
  ): TimelineExposureKeyframe[] {
    const keyframes: TimelineExposureKeyframe[] = [];
    const numKeyframes = Math.ceil(duration / keyframeInterval) + 1;
    
    for (let i = 0; i < numKeyframes; i++) {
      const time = Math.min(i * keyframeInterval, duration);
      const t = time / duration;
      
      // Apply easing
      const easedT = this.applyEasing(t, easing);
      
      // Interpolate settings
      const aperture = this.lerp(startSettings.aperture, endSettings.aperture, easedT);
      const shutter = this.lerp(startSettings.shutter, endSettings.shutter, easedT);
      const iso = Math.round(this.lerp(startSettings.iso, endSettings.iso, easedT));
      
      keyframes.push({
        time,
        settings: { aperture, shutter, iso },
        lightPowers: {},
        easing,
      });
    }
    
    return keyframes;
  }
  
  // ===========================================================================
  // 12. GOBO/IES INTEGRATION
  // ===========================================================================
  
  /**
   * Calculate light loss from gobo
   */
  calculateGoboLightLoss(
    goboType: string,
    goboPattern: 'solid' | 'pattern' | 'breakup'
  ): number {
    // Gobos block light, calculate stops lost
    const baseLoss: Record<string, number> = {
      'solid': 0,        // No loss (just shapes the light)
      'pattern': 0.5,    // Some light blocked
      'breakup': 1.0,    // More light blocked
    };
    
    return baseLoss[goboPattern] || 0.5;
  }
  
  /**
   * Get IES profile contribution to exposure
   */
  getIESExposureContribution(
    iesProfile: { maxIntensity: number; beamAngle: number },
    distance: number,
    angleFromCenter: number
  ): number {
    // IES profiles affect light distribution
    // Calculate intensity at angle
    const intensityAtAngle = angleFromCenter <= iesProfile.beamAngle / 2
      ? iesProfile.maxIntensity * Math.cos(angleFromCenter * Math.PI / 180)
      : iesProfile.maxIntensity * 0.1;  // Falloff outside beam
    
    // Apply inverse square law
    const intensityAtDistance = intensityAtAngle / (distance * distance);
    
    return intensityAtDistance;
  }
  
  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================
  
  private moodMatches(patternMood: string, targetMood: string): boolean {
    const moodGroups = {
      bright: ['bright','high-key'],
      dark: ['dark','low-key','dramatic'],
      neutral: ['neutral'],
    };
    
    for (const group of Object.values(moodGroups)) {
      if (group.includes(patternMood) && group.includes(targetMood)) {
        return true;
      }
    }
    return false;
  }
  
  private subjectMatchesCategory(subject: string, category: string): boolean {
    const mapping: Record<string, string[]> = {
      portrait: ['portrait', 'beauty', 'interview'],
      product: ['product', 'commercial'],
      fashion: ['fashion', 'beauty', 'commercial'],
      automotive: ['product', 'commercial'],
      food: ['product'],
    };
    
    return mapping[subject]?.includes(category) || false;
  }
  
  private estimateCost(
    requirements: Array<{ idealPower: number; modifier: string }>,
    inventory: UserEquipmentItem[]
  ): { purchase: number; rental: number } {
    let purchaseCost = 0;
    let rentalCost = 0;
    
    for (const req of requirements) {
      const hasEquipment = inventory.some(item => {
        const spec = findLightSpec(item.brand, item.model);
        return spec && spec.power! >= req.idealPower * 0.7;
      });
      
      if (!hasEquipment) {
        const price = this.estimatePrice(req.idealPower, req.modifier);
        purchaseCost += price;
        rentalCost += Math.round(price * 0.05);
      }
    }
    
    return { purchase: purchaseCost, rental: rentalCost };
  }
  
  private estimatePrice(power: number, modifier: string): number {
    // Rough price estimates based on power and modifier
    const basePrices: Record<string, number> = {
      standard: 200,
      softbox: 350,
      umbrella: 250,
      'beauty-dish': 400,
      grid: 300,
      octabox: 450,
    };
    
    const basePrice = basePrices[modifier] || 300;
    const powerMultiplier = power / 500;  // 500W is baseline
    
    return Math.round(basePrice * powerMultiplier);
  }
  
  private estimateSetupTime(difficulty: string): string {
    const times: Record<string, string> = {
      beginner: '10-15 min',
      intermediate: '15-25 min',
      advanced: '25-40 min',
      expert: '40-60 min',
    };
    return times[difficulty] || '20-30 min';
  }
  
  private generateRecommendationReasoning(
    pattern: CinematographyPattern,
    analysis: PatternExposureAnalysis,
    score: number
  ): string {
    const reasons: string[] = [];
    
    if (analysis.feasibilityScore >= 0.8) {
      reasons.push('Excellent match with your equipment');
    } else if (analysis.feasibilityScore >= 0.5) {
      reasons.push('Good match with your equipment');
    } else {
      reasons.push('Partial equipment match');
    }
    
    if (analysis.missingEquipment.length === 0) {
      reasons.push('No additional equipment needed');
    } else {
      reasons.push(`${analysis.missingEquipment.length} light(s) to acquire/rent`);
    }
    
    reasons.push(`${pattern.difficulty} difficulty level`);
    
    if (pattern.usedIn.length > 0) {
      reasons.push(`Used in: ${pattern.usedIn[0]}`);
    }
    
    return reasons.join('.');
  }
  
  private solveForShutterISO(targetEV: number, aperture: number): { shutter: number; iso: number } {
    // EV = log2(N² / t) - log2(ISO / 100)
    // Start with ISO 100
    let iso = 100;
    let shutter = (aperture * aperture) / Math.pow(2, targetEV + Math.log2(iso / 100));
    
    // If shutter is too slow, increase ISO
    while (shutter > 1/30 && iso < 6400) {
      iso *= 2;
      shutter = (aperture * aperture) / Math.pow(2, targetEV + Math.log2(iso / 100));
    }
    
    // Clamp to valid range
    shutter = Math.max(1/8000, Math.min(30, shutter));
    iso = Math.max(100, Math.min(25600, iso));
    
    return { shutter, iso };
  }
  
  private applyEasing(t: number, easing: string): number {
    switch (easing) {
      case 'ease-in':
        return t * t;
      case 'ease-out':
        return 1 - (1 - t) * (1 - t);
      case'ease-in-out':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      default:
        return t;
    }
  }
  
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}

// Export singleton
export const masterLightingIntegration = new MasterLightingIntegrationService();
export default masterLightingIntegration;
