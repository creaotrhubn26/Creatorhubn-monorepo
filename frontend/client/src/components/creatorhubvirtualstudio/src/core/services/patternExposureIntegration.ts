/**
 * Pattern-Exposure Integration Service
 * 
 * Connects cinematography lighting patterns to the exposure calculator
 * and user equipment inventory to provide:
 * 
 * 1. Recommended camera settings for each pattern
 * 2. Equipment matching from user, 's inventory
 * 3. Power calculations based on pattern ratios
 * 4. Real-world light specs for pattern lights
 * 5. Warnings for missing/incompatible equipment
 */

import {
  exposureCalculator,
  MODIFIER_LIGHT_LOSS,
  type LightSource,
  type ExposureRecommendation,
} from './exposureCalculatorService';
import {
  cinematographyPatternsService,
  type CinematographyPattern,
  type LightSetup,
} from './cinematographyPatternsService';
import {
  findLightSpec,
  findLightSpecByBrand,
  getDefaultLightSpec,
  type StudioLight,
} from '../data/LightSpecifications';
import type { UserEquipmentItem } from '@/hooks/useUserEquipmentInventory';

// =============================================================================
// TYPES
// =============================================================================

export interface PatternLightRequirement {
  role: LightSetup['role'];
  name: string;
  minPower: number;        // Minimum Ws required
  idealPower: number;      // Ideal Ws for best results
  modifier: string;        // Required modifier type
  modifierSize?: [number, number];
  cct: number;             // Required color temperature
  position: [number, number, number];
  distance: number;
  angle: number;
  ratioToKey?: number;
}

export interface EquipmentMatch {
  requirement: PatternLightRequirement;
  matchedEquipment?: UserEquipmentItem;
  matchedSpec?: Partial<StudioLight>;
  powerMatch: 'exact' | 'close' | 'underpowered' | 'overpowered' | 'none';
  modifierMatch: 'exact' | 'similar' | 'none';
  score: number;           // 0-1 match score
  warnings: string[];
  suggestions: string[];
}

export interface PatternExposureAnalysis {
  pattern: CinematographyPattern;
  
  // Exposure
  recommendedSettings: ExposureRecommendation;
  keyLightPower: number;   // Recommended Ws for key
  fillLightPower: number;  // Calculated from ratio
  rimLightPower: number;   // Calculated from ratio
  
  // Contrast
  contrastRatio: string;   // e.g. "4:1"
  dynamicRangeRequired: number; // Stops
  
  // Equipment
  requirements: PatternLightRequirement[];
  equipmentMatches: EquipmentMatch[];
  missingEquipment: PatternLightRequirement[];
  
  // Overall
  feasibilityScore: number; // 0-1 based on equipment match
  totalWattageNeeded: number;
  warnings: string[];
  tips: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Modifier equivalents for matching
const MODIFIER_EQUIVALENTS: Record<string, string[]> = {
  softbox: ['softbox', 'octabox', 'stripbox', 'rectangular-softbox'],
  umbrella: [
    'umbrella',
    'shoot-through',
    'reflective-umbrella',
    'white-umbrella',
    'silver-umbrella',
  ],
  'beauty-dish': ['beauty-dish', 'beautydish', 'beauty dish'],
  grid: ['grid', 'honeycomb', 'egg-crate', 'louver'],
  snoot: ['snoot', 'spot', 'tube'],
  reflector: ['reflector', 'standard', 'standard-reflector', 'dish'],
  scrim: ['scrim', 'silk', 'diffusion', 'frame'],
  ring: ['ring', 'ring-light', 'ringlight'],
};

// Power requirements by role (base watts at 2m for f/8)
const BASE_POWER_BY_ROLE: Record<string, number> = {
  key: 500,
  fill: 250,
  rim: 300,
  background: 200,
  kicker: 200,
  hair: 150,
  eye: 100,
  bounce: 150,
};

type EquipmentSpecifications = {
  power?: number;
  modifier?: string;
  colorTemp?: number;
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate required power in Ws for a target f-stop at a given distance
 */
function calculateRequiredPower(
  targetFStop: number,
  distance: number,
  modifier?: string,
  iso: number = 100
): number {
  const normalizedModifier = modifier?.toLowerCase();
  const modifierLoss =
    normalizedModifier && normalizedModifier in MODIFIER_LIGHT_LOSS
      ? MODIFIER_LIGHT_LOSS[normalizedModifier]
      : undefined;

  if (modifierLoss === undefined) {
    return exposureCalculator.calculateRequiredStrobePower(
      targetFStop,
      distance,
      modifier,
      iso,
    );
  }

  const isoFactor = Math.sqrt(iso / 100);
  let targetGuideNumber = (targetFStop * distance) / isoFactor;
  targetGuideNumber *= Math.pow(2, modifierLoss / 2);
  return Math.pow(targetGuideNumber, 2) / 2;
}

/**
 * Check if a modifier matches the requirement
 */
function modifierMatches(required: string, available?: string): 'exact' | 'similar' | 'none' {
  if (!available) return 'none';
  
  const reqLower = required.toLowerCase();
  const avlLower = available.toLowerCase();
  
  // Exact match
  if (reqLower === avlLower) return 'exact';
  
  // Check equivalents
  for (const [key, equivalents] of Object.entries(MODIFIER_EQUIVALENTS)) {
    if (equivalents.includes(reqLower) && equivalents.includes(avlLower)) {
      return 'similar';
    }
    if (key === reqLower && equivalents.includes(avlLower)) {
      return 'similar';
    }
  }
  
  return 'none';
}

/**
 * Score equipment match (0-1)
 */
function scoreEquipmentMatch(
  requirement: PatternLightRequirement,
  equipment?: UserEquipmentItem,
  spec?: Partial<StudioLight>
): { score: number; powerMatch: EquipmentMatch['powerMatch']; modifierMatch: EquipmentMatch['modifierMatch'] } {
  if (!equipment && !spec) {
    return { score: 0, powerMatch: 'none', modifierMatch: 'none' };
  }
  
  let score = 0;
  let powerMatch: EquipmentMatch['powerMatch'] = 'none';
  let modifierMatch: EquipmentMatch['modifierMatch'] = 'none';
  const equipmentSpecifications = equipment?.specifications as EquipmentSpecifications | undefined;
  
  // Power scoring (60% weight)
  const availablePower = spec?.power || equipmentSpecifications?.power || 0;
  if (availablePower > 0) {
    const ratio = availablePower / requirement.idealPower;
    if (ratio >= 0.95 && ratio <= 1.1) {
      powerMatch = 'exact';
      score += 0.6;
    } else if (ratio >= 0.7 && ratio < 0.95) {
      powerMatch = 'close';
      score += 0.45;
    } else if (ratio < 0.7 && ratio >= 0.3) {
      powerMatch = 'underpowered';
      score += 0.2;
    } else if (ratio > 1.1 && ratio <= 2) {
      powerMatch = 'overpowered';
      score += 0.5; // Overpowered is okay, can be dialed down
    } else if (ratio > 2) {
      powerMatch = 'overpowered';
      score += 0.3;
    }
  }
  
  // Modifier scoring (30% weight)
  const equipmentModifier = equipmentSpecifications?.modifier || 
                            equipment?.name?.toLowerCase() || '';
  const modMatch = modifierMatches(requirement.modifier, equipmentModifier);
  modifierMatch = modMatch;
  
  if (modMatch === 'exact') {
    score += 0.3;
  } else if (modMatch === 'similar') {
    score += 0.2;
  }
  
  // CCT scoring (10% weight)
  const availableCCT = spec?.colorTemp || equipmentSpecifications?.colorTemp || 5600;
  const cctDiff = Math.abs(availableCCT - requirement.cct);
  if (cctDiff <= 200) {
    score += 0.1;
  } else if (cctDiff <= 500) {
    score += 0.05;
  }
  
  return { score, powerMatch, modifierMatch };
}

/**
 * Find best equipment match from inventory
 */
function findBestEquipmentMatch(
  requirement: PatternLightRequirement,
  inventory: UserEquipmentItem[],
  alreadyUsed: Set<string>
): { equipment?: UserEquipmentItem; spec?: Partial<StudioLight>; score: number } {
  let bestMatch: { equipment?: UserEquipmentItem; spec?: Partial<StudioLight>; score: number } = {
    score: 0,
  };
  
  // Filter to lights only
  const lights = inventory.filter((item) => {
    const cat = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    return (
      cat.includes('light') ||
      cat.includes('flash') ||
      cat.includes('strobe') ||
      name.includes('light') ||
      name.includes('flash') ||
      name.includes('strobe')
    ) && !alreadyUsed.has(item.id);
  });
  
  for (const light of lights) {
    const spec =
      (light.brand && light.model ? findLightSpec(light.brand, light.model) : null) ||
      (light.brand ? findLightSpecByBrand(light.brand) : null) ||
      getDefaultLightSpec('strobe');
    
    const { score } = scoreEquipmentMatch(requirement, light, spec);
    
    if (score > bestMatch.score) {
      bestMatch = { equipment: light, spec, score };
    }
  }
  
  return bestMatch;
}

// =============================================================================
// MAIN SERVICE
// =============================================================================

class PatternExposureIntegrationService {
  
  /**
   * Analyze a pattern and calculate exposure settings
   */
  analyzePattern(
    pattern: CinematographyPattern,
    targetFStop: number = 8,
    targetISO: number = 100,
    subjectDistance: number = 2
  ): Omit<PatternExposureAnalysis, 'equipmentMatches' | 'missingEquipment' | 'feasibilityScore'> {
    const requirements: PatternLightRequirement[] = [];
    const warnings: string[] = [];
    const tips: string[] = [];
    
    // Find key light
    const keyLight = pattern.lights.find(l => l.role === 'key');
    if (!keyLight) {
      warnings.push('Pattern has no key light defined');
    }
    
    // Calculate key light power needed
    const keyDistance = keyLight?.distance || subjectDistance;
    const modifierLoss = exposureCalculator.getModifierLightLoss(keyLight?.modifier);
    const keyLightPower = calculateRequiredPower(targetFStop, keyDistance, keyLight?.modifier, targetISO);
    
    // Process all lights
    for (const light of pattern.lights) {
      const distance = light.distance || subjectDistance;
      let idealPower: number;
      
      if (light.role === 'key') {
        idealPower = keyLightPower;
      } else if (light.ratioToKey !== undefined) {
        idealPower = keyLightPower * light.ratioToKey;
      } else {
        idealPower = BASE_POWER_BY_ROLE[light.role] || 250;
      }
      
      // Minimum power is 50% of ideal
      const minPower = idealPower * 0.5;
      
      requirements.push({
        role: light.role,
        name: light.name,
        minPower,
        idealPower,
        modifier: light.modifier || 'standard',
        cct: light.cct,
        position: light.position,
        distance,
        angle: light.angle,
        ratioToKey: light.ratioToKey,
      });
    }
    
    // Calculate fill and rim power
    const fillLight = pattern.lights.find(l => l.role === 'fill');
    const rimLight = pattern.lights.find(l => l.role === 'rim');
    const fillLightPower = fillLight ? keyLightPower * (fillLight.ratioToKey || 1 / pattern.keyToFillRatio) : 0;
    const rimLightPower = rimLight ? keyLightPower * (rimLight.ratioToKey || 0.6) : 0;
    
    // Total wattage
    const totalWattageNeeded = requirements.reduce((sum, r) => sum + r.idealPower, 0);
    
    // Dynamic range required
    const dynamicRangeRequired = Math.log2(pattern.keyToFillRatio) + 2; // Add 2 stops for shadows
    
    // Generate exposure recommendation
    const lightSources: LightSource[] = requirements.map((r, i) => ({
      id: `pattern-light-${i}`,
      type: 'strobe',
      power: r.idealPower,
      distance: r.distance,
      modifier: r.modifier,
      position: r.position,
      colorTemp: r.cct,
    }));
    
    const analysis = exposureCalculator.analyzeSceneExposure(
      lightSources,
      {
        aperture: targetFStop,
        shutter: 1/125,
        iso: targetISO,
        focalLength: 85,
        focusDistance: subjectDistance,
        sensorSize: [36, 24],
      },
      [0, 1.6, 0]
    );
    
    // Tips based on pattern
    if (pattern.mood === 'dramatic' || pattern.mood === 'low-key') {
      tips.push('Use black flags or negative fill to deepen shadows');
      tips.push('Consider a grid on the key light to control spill');
    }
    if (pattern.mood === 'high-key') {
      tips.push('Add white reflectors near the subject for even fill');
      tips.push('Consider overexposing the background by 1-2 stops');
    }
    if (pattern.keyToFillRatio >= 4) {
      tips.push(`High contrast ratio (${pattern.keyToFillRatio}:1) - ensure camera has sufficient dynamic range`);
    }
    if (modifierLoss > 1) {
      tips.push(`The ${keyLight?.modifier} loses ${modifierLoss.toFixed(1)} stops - ensure key light has enough power`);
    }
    
    return {
      pattern,
      recommendedSettings: analysis.recommendedSettings,
      keyLightPower,
      fillLightPower,
      rimLightPower,
      contrastRatio: `${pattern.keyToFillRatio}:1`,
      dynamicRangeRequired,
      requirements,
      totalWattageNeeded,
      warnings,
      tips,
    };
  }
  
  /**
   * Match user equipment to pattern requirements
   */
  matchEquipment(
    requirements: PatternLightRequirement[],
    inventory: UserEquipmentItem[]
  ): {
    matches: EquipmentMatch[];
    missing: PatternLightRequirement[];
    feasibilityScore: number;
  } {
    const matches: EquipmentMatch[] = [];
    const missing: PatternLightRequirement[] = [];
    const usedEquipment = new Set<string>();
    
    // Sort requirements by role priority (key first)
    const rolePriority = ['key','fill','rim','background','kicker','hair', 'eye', 'bounce'];
    const sortedRequirements = [...requirements].sort(
      (a, b) => rolePriority.indexOf(a.role) - rolePriority.indexOf(b.role)
    );
    
    for (const req of sortedRequirements) {
      const { equipment, spec, score } = findBestEquipmentMatch(req, inventory, usedEquipment);
      
      if (equipment && score >= 0.3) {
        usedEquipment.add(equipment.id);
        
        const { powerMatch, modifierMatch } = scoreEquipmentMatch(req, equipment, spec);
        const warnings: string[] = [];
        const suggestions: string[] = [];
        
        // Generate warnings
        if (powerMatch === 'underpowered') {
          warnings.push(`${equipment.brand} ${equipment.model} may be underpowered for ${req.role} (need ${req.idealPower}Ws)`);
          suggestions.push('Move light closer to subject');
          suggestions.push('Increase ISO or use wider aperture');
        }
        if (modifierMatch === 'none') {
          warnings.push(`${req.modifier} recommended but not available`);
          suggestions.push(`Consider adding a ${req.modifier} to your kit`);
        }
        
        matches.push({
          requirement: req,
          matchedEquipment: equipment,
          matchedSpec: spec,
          powerMatch,
          modifierMatch,
          score,
          warnings,
          suggestions,
        });
      } else {
        missing.push(req);
        
        matches.push({
          requirement: req,
          matchedEquipment: undefined,
          matchedSpec: undefined,
          powerMatch: 'none',
          modifierMatch: 'none',
          score: 0,
          warnings: [`No suitable equipment found for ${req.role}`],
          suggestions: [
            `Need a ${req.idealPower}Ws+ light with ${req.modifier}`,
            `Consider renting equipment for this pattern`,
          ],
        });
      }
    }
    
    // Calculate overall feasibility
    const totalScore = matches.reduce((sum, m) => sum + m.score, 0);
    const feasibilityScore = requirements.length > 0 ? totalScore / requirements.length : 0;
    
    return { matches, missing, feasibilityScore };
  }
  
  /**
   * Full pattern analysis with equipment matching
   */
  analyzePatternWithEquipment(
    pattern: CinematographyPattern,
    inventory: UserEquipmentItem[],
    options: {
      targetFStop?: number;
      targetISO?: number;
      subjectDistance?: number;
    } = {}
  ): PatternExposureAnalysis {
    const {
      targetFStop = 8,
      targetISO = 100,
      subjectDistance = 2,
    } = options;
    
    // Get base analysis
    const baseAnalysis = this.analyzePattern(pattern, targetFStop, targetISO, subjectDistance);
    
    // Match equipment
    const { matches, missing, feasibilityScore } = this.matchEquipment(
      baseAnalysis.requirements,
      inventory
    );
    
    // Add equipment-specific warnings
    const warnings = [...baseAnalysis.warnings];
    
    if (feasibilityScore < 0.5) {
      warnings.push('Your current equipment may not be ideal for this pattern');
    }
    if (missing.length > 0) {
      warnings.push(`Missing ${missing.length} light(s) for complete pattern`);
    }
    
    // Add equipment-specific tips
    const tips = [...baseAnalysis.tips];
    
    if (feasibilityScore < 0.8 && feasibilityScore >= 0.5) {
      tips.push('Consider improvising with reflectors or natural light for missing lights');
    }
    
    return {
      ...baseAnalysis,
      equipmentMatches: matches,
      missingEquipment: missing,
      feasibilityScore,
      warnings,
      tips,
    };
  }
  
  /**
   * Get all patterns compatible with user's equipment
   */
  getCompatiblePatterns(
    inventory: UserEquipmentItem[],
    minFeasibility: number = 0.6
  ): Array<{ pattern: CinematographyPattern; feasibilityScore: number }> {
    const patterns = cinematographyPatternsService.getAllPatterns();
    const compatible: Array<{ pattern: CinematographyPattern; feasibilityScore: number }> = [];
    
    for (const pattern of patterns) {
      const analysis = this.analyzePatternWithEquipment(pattern, inventory);
      if (analysis.feasibilityScore >= minFeasibility) {
        compatible.push({
          pattern,
          feasibilityScore: analysis.feasibilityScore,
        });
      }
    }
    
    // Sort by feasibility
    return compatible.sort((a, b) => b.feasibilityScore - a.feasibilityScore);
  }
  
  /**
   * Suggest equipment purchases to unlock more patterns
   */
  suggestEquipmentForPatterns(
    inventory: UserEquipmentItem[],
    targetPatterns?: string[]
  ): Array<{
    equipment: string;
    power: number;
    type: string;
    unlocksPatterns: string[];
    priority: 'high' | 'medium' | 'low';
  }> {
    const patterns = targetPatterns 
      ? cinematographyPatternsService.getAllPatterns().filter(p => targetPatterns.includes(p.id))
      : cinematographyPatternsService.getAllPatterns();
    
    const missingMap = new Map<string, { patterns: string[]; power: number; type: string }>();
    
    for (const pattern of patterns) {
      const analysis = this.analyzePatternWithEquipment(pattern, inventory);
      
      for (const missing of analysis.missingEquipment) {
        const key = `${missing.modifier}-${Math.round(missing.idealPower / 100) * 100}`;
        const existing = missingMap.get(key);
        
        if (existing) {
          existing.patterns.push(pattern.name);
          existing.power = Math.max(existing.power, missing.idealPower);
        } else {
          missingMap.set(key, {
            patterns: [pattern.name],
            power: missing.idealPower,
            type: missing.modifier,
          });
        }
      }
    }
    
    // Convert to array and prioritize
    const suggestions = Array.from(missingMap.entries()).map(([key, value]) => ({
      suggestionKey: key,
      equipment: `${Math.round(value.power)}Ws ${value.type}`,
      power: value.power,
      type: value.type,
      unlocksPatterns: value.patterns,
      priority: value.patterns.length >= 5 ? 'high' as const :
                value.patterns.length >= 2 ? 'medium' as const : 'low' as const,
    }));
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
  
  /**
   * Calculate adjusted pattern for available equipment
   */
  adjustPatternForEquipment(
    pattern: CinematographyPattern,
    inventory: UserEquipmentItem[],
    targetFStop?: number
  ): {
    adjustedFStop: number;
    adjustedISO: number;
    adjustedPositions: Array<{ role: string; newDistance: number; reason: string }>;
    notes: string[];
  } {
    const analysis = this.analyzePatternWithEquipment(pattern, inventory, { targetFStop });
    const notes: string[] = [];
    const adjustedPositions: Array<{ role: string; newDistance: number; reason: string }> = [];
    
    let adjustedFStop = targetFStop || 8;
    let adjustedISO = 100;
    
    // Check if we need to adjust for underpowered lights
    for (const match of analysis.equipmentMatches) {
      if (match.powerMatch ==='underpowered' && match.matchedSpec) {
        const availablePower = match.matchedSpec.power || 250;
        const requiredPower = match.requirement.idealPower;
        const powerRatio = availablePower / requiredPower;
        
        if (powerRatio < 0.7) {
          // Option 1: Move light closer
          const currentDistance = match.requirement.distance;
          const newDistance = currentDistance * Math.sqrt(powerRatio);
          
          if (newDistance >= 1) { // Minimum safe distance
            adjustedPositions.push({
              role: match.requirement.role,
              newDistance,
              reason: `Move ${match.requirement.name} from ${currentDistance.toFixed(1)}m to ${newDistance.toFixed(1)}m to compensate for power, `,
            });
          } else {
            // Option 2: Adjust camera settings
            const stopsNeeded = Math.log2(1 / powerRatio) / 2;
            
            if (stopsNeeded <= 2) {
              // Widen aperture
              const newFStop = adjustedFStop / Math.pow(2, stopsNeeded / 2);
              if (newFStop >= 1.4) {
                adjustedFStop = Math.round(newFStop * 10) / 10;
                notes.push(`Opened aperture to f/${adjustedFStop} due to ${match.requirement.role} power, `);
              } else {
                // Increase ISO
                adjustedISO = adjustedISO * Math.pow(2, stopsNeeded);
                notes.push(`Increased ISO to ${adjustedISO} to compensate for lighting power`);
              }
            }
          }
        }
      }
    }
    
    return {
      adjustedFStop,
      adjustedISO,
      adjustedPositions,
      notes,
    };
  }
}

// Export singleton
export const patternExposureIntegration = new PatternExposureIntegrationService();
export default patternExposureIntegration;
