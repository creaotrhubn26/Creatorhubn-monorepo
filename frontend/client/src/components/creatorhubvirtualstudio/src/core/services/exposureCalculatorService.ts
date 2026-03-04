/**
 * Exposure Calculator Service
 * 
 * Connects lights, lenses, and cameras for accurate exposure calculations.
 * Implements professional photography exposure formulas.
 * 
 * References:
 * - Guide Number formula: GN = Distance × f-number
 * - Inverse Square Law: I₂ = I₁ × (d₁/d₂)²
 * - Flash exposure: f-number = GN / distance
 * - Continuous light EV calculation
 */

import type { LightSpec } from '../data/LightSpecifications';
import type { LensSpec } from '../data/LensSpecifications';

// =============================================================================
// TYPES
// =============================================================================

export interface LightSource {
  id: string;
  type: 'strobe' | 'speedlite' | 'continuous' | 'led_panel';
  power: number;          // Ws for strobes, W for continuous, GN for speedlites
  distance: number;       // meters from subject
  modifier?: string;      // softbox, umbrella, etc.
  modifierSize?: [number, number]; // meters
  position: [number, number, number];
  colorTemp?: number;
  
  // From real specs
  specifications?: Partial<LightSpec>;
}

export interface CameraSettings {
  aperture: number;       // f-number
  shutter: number;        // seconds
  iso: number;
  focalLength: number;    // mm
  focusDistance: number;  // meters
  sensorSize: [number, number]; // mm
  
  // From real specs
  lensSpecs?: Partial<LensSpec>;
}

export interface ExposureRecommendation {
  aperture: number;
  shutter: number;
  iso: number;
  ev: number;
  confidence: number;     // 0-1 confidence in recommendation
  notes: string[];
  warnings: string[];
}

export interface LightAtDistance {
  effectivePower: number;     // Power reaching subject
  fStopAt100ISO: number;      // Recommended f-stop at ISO 100
  evContribution: number;     // EV contribution of this light
  falloffPercent: number;     // Light loss due to distance
  modifierLoss: number;       // Stops lost to modifier
}

export interface SceneExposureAnalysis {
  totalEV: number;
  keyLightEV: number;
  fillLightEV: number;
  contrastRatio: string;
  recommendedSettings: ExposureRecommendation;
  perLightAnalysis: Map<string, LightAtDistance>;
  flashSyncWarning?: string;
  focusWarning?: string;
  mountCompatibilityWarning?: string;
}

// =============================================================================
// MODIFIER LIGHT LOSS (in stops)
// =============================================================================

export const MODIFIER_LIGHT_LOSS: Record<string, number> = {
  // Direct/Bare
  bare: 0,
  standard: 0,
  reflector: 0,
  
  // Softboxes
  softbox: 1.5,
  'softbox-small': 1.3,
  'softbox-large': 1.7,
  stripbox: 1.5,
  octabox: 1.5,
  
  // Umbrellas
  umbrella: 1.0,
  'umbrella-shoot-through': 1.5,
  'umbrella-reflective': 0.8,
  'umbrella-white': 1.2,
  'umbrella-silver': 0.8,
  
  // Dishes
  beautydish: 0.7,
  'beauty-dish': 0.7,
  
  // Grids/Snoots (don't lose light, just focus it)
  grid: 0.5,
  snoot: 0.3,
  spot: 0.3,
  
  // Diffusion
  scrim: 1.0,
  silk: 1.5,
  diffusion: 1.0,
  
  // Panels
  panel: 0,
  'led-panel': 0,
  
  // Flash
  flash: 0,
  speedlite: 0,
  
  // Ring
  ring: 0.5,
};

// =============================================================================
// FLASH SYNC SPEEDS BY CAMERA
// =============================================================================

export const FLASH_SYNC_SPEEDS: Record<string, number> = {
  // Canon
  canon: 1 / 200,
  'canon-r5': 1 / 200,
  'canon-r6': 1 / 200,
  'canon-r3': 1 / 200,
  'canon-5d': 1 / 200,
  
  // Sony
  sony: 1 / 250,
  'sony-a7': 1 / 250,
  'sony-a9': 1 / 250,
  'sony-a1': 1 / 400,  // Electronic shutter
  
  // Nikon
  nikon: 1 / 250,
  'nikon-z9': 1 / 200,
  'nikon-z8': 1 / 200,
  
  // Fujifilm
  fujifilm: 1 / 250,
  'fujifilm-gfx': 1 / 125, // Medium format
  
  // Panasonic
  panasonic: 1 / 250,
  
  // Leica
  leica: 1 / 180,
  
  // Default
  default: 1 / 200,
};

// =============================================================================
// LENS MOUNT COMPATIBILITY
// =============================================================================

export const MOUNT_COMPATIBILITY: Record<string, string[]> = {
  // Canon RF cameras accept
  rf: ['rf'],
  'rf-adapter': ['rf', 'ef'],
  
  // Canon EF cameras accept
  ef: ['ef', 'ef-s'],
  
  // Sony E-mount accepts
  fe: ['fe', 'e'],
  e: ['e'],
  
  // Nikon Z accepts
  z: ['z'],
  'z-adapter': ['z', 'f'],
  
  // Nikon F accepts
  f: ['f', 'f-dx'],
  
  // Fujifilm X accepts
  x: ['x'],
  
  // Fujifilm GFX accepts
  gfx: ['gfx', 'g'],
  
  // Panasonic/Leica L-mount
  l: ['l'],
  
  // Micro Four Thirds
  mft: ['mft'],
  
  // Universal (manual lenses)
  universal: ['universal', 'ef', 'f', 'a', 'sa'],
};

// =============================================================================
// EXPOSURE CALCULATOR SERVICE
// =============================================================================

class ExposureCalculatorService {
  
  // ===========================================================================
  // INVERSE SQUARE LAW
  // ===========================================================================
  
  /**
   * Calculate light intensity at a given distance using inverse square law
   * I₂ = I₁ × (d₁/d₂)²
   */
  calculateIntensityAtDistance(
    powerAtSource: number,
    distance: number,
    referenceDistance: number = 1
  ): number {
    if (distance <= 0) return powerAtSource;
    return powerAtSource * Math.pow(referenceDistance / distance, 2);
  }
  
  /**
   * Calculate required power to achieve target intensity at distance
   */
  calculateRequiredPower(
    targetIntensity: number,
    distance: number,
    referenceDistance: number = 1
  ): number {
    return targetIntensity * Math.pow(distance / referenceDistance, 2);
  }
  
  /**
   * Calculate light falloff between two distances
   * Returns the stops of light lost
   */
  calculateFalloff(distance1: number, distance2: number): number {
    if (distance1 <= 0 || distance2 <= 0) return 0;
    const ratio = Math.pow(distance1 / distance2, 2);
    return Math.log2(ratio);
  }
  
  // ===========================================================================
  // MODIFIER LIGHT LOSS
  // ===========================================================================
  
  /**
   * Get light loss in stops for a modifier
   */
  getModifierLightLoss(modifier?: string): number {
    if (!modifier) return 0;
    const normalized = modifier.toLowerCase().replace(/\s+/g, '-');
    return MODIFIER_LIGHT_LOSS[normalized] ?? 0;
  }
  
  /**
   * Calculate effective power after modifier
   */
  calculatePowerAfterModifier(power: number, modifier?: string): number {
    const lossStops = this.getModifierLightLoss(modifier);
    return power / Math.pow(2, lossStops);
  }
  
  // ===========================================================================
  // STROBE/FLASH EXPOSURE
  // ===========================================================================
  
  /**
   * Calculate Guide Number from power (Ws)
   * Approximate: GN ≈ √(Power × 2) at ISO 100
   */
  calculateGuideNumber(powerWs: number): number {
    // Industry approximation: GN = sqrt(Ws × coefficient)
    // Coefficient varies by reflector efficiency (typically 1.5-2.5)
    return Math.sqrt(powerWs * 2);
  }
  
  /**
   * Calculate f-stop for strobe at distance
   * f = GN / distance
   */
  calculateFStopForStrobe(
    powerWs: number,
    distance: number,
    modifier?: string,
    iso: number = 100
  ): number {
    // Get effective GN
    let gn = this.calculateGuideNumber(powerWs);
    
    // Apply modifier loss
    const modifierLoss = this.getModifierLightLoss(modifier);
    gn = gn / Math.pow(2, modifierLoss / 2); // GN loss is half the power loss in stops
    
    // Adjust for ISO (GN doubles every 2 stops of ISO)
    const isoFactor = Math.sqrt(iso / 100);
    gn = gn * isoFactor;
    
    // Calculate f-stop
    return gn / distance;
  }
  
  /**
   * Calculate required strobe power for desired f-stop
   */
  calculateRequiredStrobePower(
    fStop: number,
    distance: number,
    modifier?: string,
    iso: number = 100
  ): number {
    // Reverse the f-stop calculation
    const isoFactor = Math.sqrt(iso / 100);
    let targetGN = fStop * distance / isoFactor;
    
    // Account for modifier
    const modifierLoss = this.getModifierLightLoss(modifier);
    targetGN = targetGN * Math.pow(2, modifierLoss / 2);
    
    // GN² / 2 = Power
    return Math.pow(targetGN, 2) / 2;
  }
  
  // ===========================================================================
  // CONTINUOUS LIGHT EXPOSURE
  // ===========================================================================
  
  /**
   * Estimate EV from continuous light lumens at distance
   */
  calculateEVFromContinuous(
    lumens: number,
    distance: number,
    reflectance: number = 0.18 // 18% grey
  ): number {
    // Lux at distance (inverse square law)
    const lux = lumens / (4 * Math.PI * distance * distance);
    
    // EV from lux (EV = log2(lux / 2.5) for ISO 100)
    const ev = Math.log2(lux * reflectance / 2.5);
    
    return ev;
  }
  
  /**
   * Calculate exposure settings for continuous light
   */
  calculateContinuousExposure(
    watts: number,
    distance: number,
    modifier?: string
  ): { ev: number; suggestedSettings: ExposureRecommendation } {
    // Estimate lumens from watts (LED efficiency ~100 lm/W)
    const lumensPerWatt = 100;
    let lumens = watts * lumensPerWatt;
    
    // Apply modifier loss
    lumens = this.calculatePowerAfterModifier(lumens, modifier);
    
    const ev = this.calculateEVFromContinuous(lumens, distance);
    
    return {
      ev,
      suggestedSettings: this.getSettingsForEV(ev),
    };
  }
  
  // ===========================================================================
  // EXPOSURE VALUE CALCULATIONS
  // ===========================================================================
  
  /**
   * Calculate EV from camera settings
   * EV = log2(N² / t) - log2(ISO / 100)
   */
  calculateEV(aperture: number, shutter: number, iso: number): number {
    const ev100 = Math.log2((aperture * aperture) / shutter);
    return ev100 - Math.log2(iso / 100);
  }
  
  /**
   * Get suggested camera settings for a target EV
   */
  getSettingsForEV(targetEV: number, priority: 'aperture' | 'shutter' | 'iso' = 'aperture'): ExposureRecommendation {
    const notes: string[] = [];
    const warnings: string[] = [];
    
    // Standard settings to start
    let aperture = 8;
    let shutter = 1/125;
    let iso = 100;
    
    // Calculate what EV we have
    const currentEV = this.calculateEV(aperture, shutter, iso);
    const evDiff = targetEV - currentEV;
    
    // Adjust based on priority
    if (priority === 'aperture') {
      // Adjust aperture first
      aperture = aperture * Math.pow(2, evDiff / 2);
      
      // Clamp aperture to reasonable range
      if (aperture < 1.4) {
        const remaining = Math.log2(1.4 / aperture) * 2;
        aperture = 1.4;
        // Compensate with ISO
        iso = iso * Math.pow(2, remaining);
        notes.push('Aperture limited to f/1.4, increased ISO');
      }
      if (aperture > 22) {
        const remaining = Math.log2(aperture / 22) * 2;
        aperture = 22;
        // Compensate with shutter
        shutter = shutter * Math.pow(2, remaining);
        notes.push('Aperture limited to f/22, adjusted shutter');
      }
    }
    
    // Round to standard values
    aperture = this.roundToStandardAperture(aperture);
    shutter = this.roundToStandardShutter(shutter);
    iso = this.roundToStandardISO(iso);
    
    // Recalculate actual EV
    const actualEV = this.calculateEV(aperture, shutter, iso);
    
    // Check for warnings
    if (iso > 6400) {
      warnings.push('High ISO may introduce noise');
    }
    if (shutter > 1/60 && priority !== 'shutter') {
      warnings.push('Slow shutter may cause motion blur');
    }
    
    return {
      aperture,
      shutter,
      iso,
      ev: actualEV,
      confidence: 1 - Math.abs(targetEV - actualEV) / 5,
      notes,
      warnings,
    };
  }
  
  // ===========================================================================
  // FLASH SYNC VALIDATION
  // ===========================================================================
  
  /**
   * Get flash sync speed for a camera
   */
  getFlashSyncSpeed(cameraBrand?: string, cameraModel?: string): number {
    if (cameraModel) {
      const modelKey = cameraModel.toLowerCase().replace(/\s+/g, '-');
      if (FLASH_SYNC_SPEEDS[modelKey]) {
        return FLASH_SYNC_SPEEDS[modelKey];
      }
    }
    if (cameraBrand) {
      const brandKey = cameraBrand.toLowerCase();
      if (FLASH_SYNC_SPEEDS[brandKey]) {
        return FLASH_SYNC_SPEEDS[brandKey];
      }
    }
    return FLASH_SYNC_SPEEDS['default'];
  }
  
  /**
   * Check if shutter speed exceeds flash sync
   */
  checkFlashSync(
    shutter: number,
    cameraBrand?: string,
    cameraModel?: string,
    lightSupportsHSS?: boolean
  ): { valid: boolean; warning?: string; syncSpeed: number } {
    const syncSpeed = this.getFlashSyncSpeed(cameraBrand, cameraModel);
    
    if (shutter < syncSpeed) {
      // Shutter is faster than sync speed
      if (lightSupportsHSS) {
        return {
          valid: true,
          warning: `Using HSS mode (shutter 1/${Math.round(1/shutter)} faster than sync 1/${Math.round(1/syncSpeed)})`,
          syncSpeed,
        };
      } else {
        return {
          valid: false,
          warning: `Shutter speed 1/${Math.round(1/shutter)} exceeds flash sync speed 1/${Math.round(1/syncSpeed)}. Enable HSS or use slower shutter.`,
          syncSpeed,
        };
      }
    }
    
    return { valid: true, syncSpeed };
  }
  
  // ===========================================================================
  // FOCUS DISTANCE VALIDATION
  // ===========================================================================
  
  /**
   * Validate focus distance against lens minimum
   */
  validateFocusDistance(
    focusDistance: number,
    minFocusDistance: number,
    lensModel?: string
  ): { valid: boolean; warning?: string } {
    if (focusDistance < minFocusDistance) {
      return {
        valid: false,
        warning: `Focus distance ${(focusDistance * 100).toFixed(0)}cm is less than ${lensModel || 'lens'} minimum focus distance ${(minFocusDistance * 100).toFixed(0)}cm`,
      };
    }
    return { valid: true };
  }
  
  // ===========================================================================
  // MOUNT COMPATIBILITY
  // ===========================================================================
  
  /**
   * Check if lens mount is compatible with camera mount
   */
  checkMountCompatibility(
    cameraMount: string,
    lensMount: string
  ): { compatible: boolean; warning?: string; adapterRequired?: boolean } {
    const cameraM = cameraMount.toLowerCase();
    const lensM = lensMount.toLowerCase();
    
    // Same mount is always compatible
    if (cameraM === lensM) {
      return { compatible: true };
    }
    
    // Check with adapter
    const adapterKey = `${cameraM}-adapter`;
    if (MOUNT_COMPATIBILITY[adapterKey]?.includes(lensM)) {
      return {
        compatible: true,
        adapterRequired: true,
        warning: `Adapter required for ${lensMount} lens on ${cameraMount} camera`,
      };
    }
    
    // Universal mounts (manual lenses)
    if (lensM === 'universal') {
      return {
        compatible: true,
        adapterRequired: true,
        warning: 'Manual focus adapter required',
      };
    }
    
    return {
      compatible: false,
      warning: `${lensMount} lens is not compatible with ${cameraMount} camera mount`,
    };
  }
  
  // ===========================================================================
  // COMPREHENSIVE SCENE ANALYSIS
  // ===========================================================================
  
  /**
   * Analyze entire scene exposure
   */
  analyzeSceneExposure(
    lights: LightSource[],
    camera: CameraSettings,
    subjectPosition: [number, number, number] = [0, 0, 0],
    cameraBrand?: string,
    cameraModel?: string
  ): SceneExposureAnalysis {
    const perLightAnalysis = new Map<string, LightAtDistance>();
    const warnings: string[] = [];
    
    let totalEV = 0;
    let keyLightEV = -Infinity;
    let fillLightEV = -Infinity;
    
    // Analyze each light
    for (const light of lights) {
      // Calculate distance to subject
      const dx = light.position[0] - subjectPosition[0];
      const dy = light.position[1] - subjectPosition[1];
      const dz = light.position[2] - subjectPosition[2];
      const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      let effectivePower: number;
      let evContribution: number;
      let fStopAt100ISO: number;
      
      if (light.type === 'strobe' || light.type === 'speedlite') {
        // Strobe calculation
        fStopAt100ISO = this.calculateFStopForStrobe(
          light.power,
          distance,
          light.modifier,
          100
        );
        effectivePower = this.calculatePowerAfterModifier(light.power, light.modifier);
        effectivePower = this.calculateIntensityAtDistance(effectivePower, distance);
        evContribution = Math.log2(fStopAt100ISO * fStopAt100ISO);
      } else {
        // Continuous calculation
        const result = this.calculateContinuousExposure(light.power, distance, light.modifier);
        evContribution = result.ev;
        effectivePower = this.calculatePowerAfterModifier(light.power, light.modifier);
        effectivePower = this.calculateIntensityAtDistance(effectivePower, distance);
        fStopAt100ISO = Math.sqrt(Math.pow(2, evContribution));
      }
      
      const modifierLoss = this.getModifierLightLoss(light.modifier);
      const falloffPercent = (1 - this.calculateIntensityAtDistance(1, distance)) * 100;
      
      perLightAnalysis.set(light.id, {
        effectivePower,
        fStopAt100ISO,
        evContribution,
        falloffPercent,
        modifierLoss,
      });
      
      // Track key and fill lights
      if (evContribution > keyLightEV) {
        fillLightEV = keyLightEV;
        keyLightEV = evContribution;
      } else if (evContribution > fillLightEV) {
        fillLightEV = evContribution;
      }
      
      // Sum for total (not quite right but approximation)
      totalEV = Math.log2(Math.pow(2, totalEV) + Math.pow(2, evContribution));
    }
    
    // Calculate contrast ratio
    const contrastStops = keyLightEV - fillLightEV;
    const contrastRatio = contrastStops > 0 
      ? `${Math.round(Math.pow(2, contrastStops))}:1`
      : 'N/A';
    
    // Get recommended settings
    const recommendedSettings = this.getSettingsForEV(totalEV);
    
    // Check flash sync
    const hasStrobes = lights.some(l => l.type === 'strobe' || l.type ==='speedlite');
    let flashSyncWarning: string | undefined;
    
    if (hasStrobes) {
      const anyHSS = lights.some(l => l.specifications?.hss);
      const syncCheck = this.checkFlashSync(
        recommendedSettings.shutter,
        cameraBrand,
        cameraModel,
        anyHSS
      );
      if (!syncCheck.valid) {
        flashSyncWarning = syncCheck.warning;
        warnings.push(syncCheck.warning!);
      }
    }
    
    // Check focus distance
    let focusWarning: string | undefined;
    if (camera.lensSpecs?.minFocusDistance) {
      const focusCheck = this.validateFocusDistance(
        camera.focusDistance,
        camera.lensSpecs.minFocusDistance,
        camera.lensSpecs.model as string
      );
      if (!focusCheck.valid) {
        focusWarning = focusCheck.warning;
        warnings.push(focusCheck.warning!);
      }
    }
    
    return {
      totalEV,
      keyLightEV,
      fillLightEV,
      contrastRatio,
      recommendedSettings,
      perLightAnalysis,
      flashSyncWarning,
      focusWarning,
    };
  }
  
  // ===========================================================================
  // HELPER FUNCTIONS
  // ===========================================================================
  
  private roundToStandardAperture(f: number): number {
    const stops = [1.0, 1.4, 2.0, 2.8, 4.0, 5.6, 8.0, 11, 16, 22, 32];
    return stops.reduce((prev, curr) => 
      Math.abs(curr - f) < Math.abs(prev - f) ? curr : prev
    );
  }
  
  private roundToStandardShutter(s: number): number {
    const speeds = [
      1/8000, 1/4000, 1/2000, 1/1000, 1/500, 1/250, 1/125, 1/60, 
      1/30, 1/15, 1/8, 1/4, 1/2, 1, 2, 4, 8, 15, 30
    ];
    return speeds.reduce((prev, curr) => 
      Math.abs(curr - s) < Math.abs(prev - s) ? curr : prev
    );
  }
  
  private roundToStandardISO(iso: number): number {
    const values = [50, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200];
    return values.reduce((prev, curr) => 
      Math.abs(curr - iso) < Math.abs(prev - iso) ? curr : prev
    );
  }
}

// Export singleton
export const exposureCalculator = new ExposureCalculatorService();
export default exposureCalculator;
