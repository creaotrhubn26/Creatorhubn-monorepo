/**
 * Equipment Specifications Service
 * 
 * Provides detailed specifications for lighting equipment including:
 * - Wattage and power consumption
 * - Beam patterns and angles
 * - Color accuracy (CRI, TLCI)
 * - Mount types and compatibility
 */

export interface LightSpecifications {
  // Power specifications
  wattage: number; // Watts
  powerConsumption: number; // Actual power draw (W)
  equivalentWattage?: number; // Equivalent tungsten wattage
  
  // Beam characteristics
  beamAngle: number; // degrees
  fieldAngle: number; // degrees
  beamPattern: 'spot, ' | 'flood' | 'adjustable' | 'soft' | 'hard';
  
  // Color accuracy
  cri: number; // Color Rendering Index (0-100)
  tlci: number; // Television Lighting Consistency Index (0-100)
  cct: number; // Correlated Color Temperature (K)
  cctRange?: [number, number]; // Adjustable CCT range
  
  // Physical specifications
  mountType: 'bowens' | 'profoto' | 'elinchrom' | 'godox' | 'universal' | 'proprietary';
  weight: number; // kg
  dimensions: { width: number; height: number; depth: number }; // cm
  
  // Compatibility
  compatibleModifiers: string[]; // List of compatible modifier types
  dmxChannels?: number; // DMX control channels
  wirelessControl?: boolean;
  
  // Performance
  lightOutput: number; // Lumens or lux at 1m
  powerModes?: string[]; // e.g., ['full','half','quarter']
  dimmingRange?: [number, number]; // percentage
  fanNoise?: number; // dB
  
  // Additional info
  brand: string;
  model: string;
  lightType: 'led' | 'cob' | 'fresnel' | 'panel' | 'tube' | 'strobe' | 'tungsten';
  releaseYear?: number;
  msrpPrice?: number; // USD
}

export interface ModifierSpecifications {
  type: 'softbox' | 'octabox' | 'stripbox' | 'umbrella' | 'beauty_dish' | 'reflector' | 'grid' | 'snoot' | 'gobo';
  shape: 'rectangular' | 'octagonal' | 'circular' | 'strip' | 'parabolic';
  size: string; // e.g., "60x90cm","120cm","7ft"
  dimensions: { width: number; height: number } | { diameter: number }; // cm
  
  // Mount compatibility
  mountType: 'bowens' | 'profoto' | 'elinchrom' | 'godox' | 'universal';
  speedRing?: string; // Speed ring type if required
  
  // Optical properties
  diffusionLayers: number;
  innerBaffle: boolean;
  outerDiffuser: boolean;
  gridIncluded: boolean;
  gridDegrees?: number; // e.g., 30°, 40°, 50°
  
  // Effects on light
  beamAngleModifier: number; // Multiplier (e.g., 0.5 = narrows by 50%)
  powerLossStops: number; // Light loss in f-stops
  diffusionFactor: number; // 0-1 (0 = hard, 1 = very soft)
  
  // Physical
  weight: number; // kg
  collapsible: boolean;
  
  // Additional
  brand: string;
  model: string;
  msrpPrice?: number; // USD
}

// Predefined equipment database
export const LIGHT_SPECS_DATABASE: Record<string, LightSpecifications> = {
  'profoto-d2-500': {
    wattage: 500,
    powerConsumption: 500,
    equivalentWattage: 2000,
    beamAngle: 80,
    fieldAngle: 90,
    beamPattern: 'adjustable',
    cri: 95,
    tlci: 95,
    cct: 5600,
    mountType: 'profoto',
    weight: 2.5,
    dimensions: { width: 20, height: 30, depth: 15 },
    compatibleModifiers: ['softbox','octabox','beauty_dish','umbrella','reflector'],
    wirelessControl: true,
    lightOutput: 100000,
    powerModes: ['full','half','quarter'],
    dimmingRange: [1, 100],
    fanNoise: 35,
    brand: 'Profoto',
    model: 'D2 500',
    lightType: 'strobe',
    releaseYear: 2015,
    msrpPrice: 1995,
  }, 'aputure-600d-pro': {
    wattage: 600,
    powerConsumption: 720,
    equivalentWattage: 2500,
    beamAngle: 55,
    fieldAngle: 120,
    beamPattern: 'adjustable',
    cri: 96,
    tlci: 97,
    cct: 5600,
    mountType: 'bowens',
    weight: 8.5,
    dimensions: { width: 35, height: 40, depth: 25 },
    compatibleModifiers: ['softbox','octabox','fresnel','spotlight'],
    dmxChannels: 4,
    wirelessControl: true,
    lightOutput: 90000,
    dimmingRange: [0, 100],
    fanNoise: 25,
    brand: 'Aputure',
    model: '600d Pro',
    lightType: 'cob',
    releaseYear: 2020,
    msrpPrice: 1899,
  }'godox-sl60w': {
    wattage: 60,
    powerConsumption: 65,
    equivalentWattage: 300,
    beamAngle: 60,
    fieldAngle: 120,
    beamPattern: 'flood',
    cri: 95,
    tlci: 96,
    cct: 5600,
    mountType: 'bowens',
    weight: 1.8,
    dimensions: { width: 25, height: 28, depth: 18 },
    compatibleModifiers: ['softbox','umbrella','reflector'],
    wirelessControl: false,
    lightOutput: 5500,
    dimmingRange: [10, 100],
    fanNoise: 30,
    brand: 'Godox',
    model: 'SL-60W',
    lightType: 'led',
    releaseYear: 2018,
    msrpPrice: 119,
  },
};

export const MODIFIER_SPECS_DATABASE: Record<string, ModifierSpecifications> = {
  'profoto-rfi-softbox-3x4': {
    type: 'softbox',
    shape: 'rectangular',
    size: '90x120cm',
    dimensions: { width: 90, height: 120 },
    mountType: 'profoto',
    diffusionLayers: 2,
    innerBaffle: true,
    outerDiffuser: true,
    gridIncluded: false,
    beamAngleModifier: 0.6,
    powerLossStops: 1.0,
    diffusionFactor: 0.8,
    weight: 1.2,
    collapsible: true,
    brand: 'Profoto',
    model: 'RFi Softbox 3x4',
    msrpPrice: 299,
  },
};

class EquipmentSpecsService {
  /**
   * Get light specifications by ID
   */
  getLightSpecs(lightId: string): LightSpecifications | null {
    return LIGHT_SPECS_DATABASE[lightId] || null;
  }

  /**
   * Get modifier specifications by ID
   */
  getModifierSpecs(modifierId: string): ModifierSpecifications | null {
    return MODIFIER_SPECS_DATABASE[modifierId] || null;
  }

  /**
   * Get all available lights
   */
  getAllLights(): LightSpecifications[] {
    return Object.values(LIGHT_SPECS_DATABASE);
  }

  /**
   * Get all available modifiers
   */
  getAllModifiers(): ModifierSpecifications[] {
    return Object.values(MODIFIER_SPECS_DATABASE);
  }

  /**
   * Check if modifier is compatible with light
   */
  isCompatible(lightId: string, modifierId: string): boolean {
    const light = this.getLightSpecs(lightId);
    const modifier = this.getModifierSpecs(modifierId);
    
    if (!light || !modifier) return false;
    
    // Check mount type compatibility
    if (light.mountType !== modifier.mountType && modifier.mountType !=='universal') {
      return false;
    }
    
    // Check if modifier type is in compatible list
    return light.compatibleModifiers.includes(modifier.type);
  }

  /**
   * Calculate effective light output with modifier
   */
  calculateEffectiveOutput(lightId: string, modifierId: string): number {
    const light = this.getLightSpecs(lightId);
    const modifier = this.getModifierSpecs(modifierId);
    
    if (!light || !modifier) return 0;
    
    // Calculate power loss from modifier
    const powerLossMultiplier = Math.pow(0.5, modifier.powerLossStops);
    
    return light.lightOutput * powerLossMultiplier;
  }
}

export const equipmentSpecsService = new EquipmentSpecsService();

