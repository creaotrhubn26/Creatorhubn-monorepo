/**
 * Actor Presets Library
 * 
 * Predefined actor configurations for common cinematography scenarios.
 * Based on industry-standard body types and demographics.
 * 
 * Research sources:
 * - Anthropometric data: CDC growth charts, WHO standards
 * - Fashion industry: standard model measurements
 * - Film industry: typical actor demographics
 */

import type { ActorPreset } from '../services/virtualActorService';

/**
 * Skin tone presets based on Fitzpatrick scale
 * Research: https://en.wikipedia.org/wiki/Fitzpatrick_scale
 */
export const SKIN_TONES = {
  // Type I-II: Very fair to fair
  fair: '#fde7d6',
  // Type III: Medium
  medium: '#f4c2a0',
  // Type IV: Olive
  olive: '#d4a574',
  // Type V: Brown
  brown: '#a67c52',
  // Type VI: Dark brown to black
  dark: '#6b4423',
} as const;

/**
 * Predefined actor presets for common scenarios
 */
export const ACTOR_PRESETS: ActorPreset[] = [
  // ============================================================================
  // PORTRAIT PHOTOGRAPHY
  // ============================================================================
  {
    id: 'portrait-female-young',
    name: 'Young Female Model',
    description: 'Fashion/portrait model, 20s, average height',
    category: 'portrait',
    parameters: {
      age: 25,
      gender: 0.0,    // Female
      height: 0.55,   // ~170cm (5'7, ")
      weight: 0.35,   // Slim
      muscle: 0.3,    // Low muscle definition
    },
  },
  {
    id: 'portrait-male-young',
    name: 'Young Male Model',
    description: 'Fashion/portrait model, 20s, tall',
    category: 'portrait',
    parameters: {
      age: 27,
      gender: 1.0,    // Male
      height: 0.65,   // ~183cm (6'0")
      weight: 0.45,   // Average
      muscle: 0.5,    // Moderate muscle
    },
  },
  {
    id: 'portrait-mature-female',
    name: 'Mature Female',
    description: 'Professional woman, 40s',
    category: 'portrait',
    parameters: {
      age: 45,
      gender: 0.0,
      height: 0.5,    // ~165cm (5'5")
      weight: 0.5,    // Average
      muscle: 0.3,
    },
  },
  {
    id: 'portrait-mature-male',
    name: 'Mature Male',
    description: 'Professional man, 40s',
    category: 'portrait',
    parameters: {
      age: 48,
      gender: 1.0,
      height: 0.58,   // ~178cm (5'10")
      weight: 0.55,   // Slightly above average
      muscle: 0.4,
    },
  },

  // ============================================================================
  // FASHION PHOTOGRAPHY
  // ============================================================================
  {
    id: 'fashion-runway-female',
    name: 'Runway Model (Female)',
    description: 'High fashion runway model, tall and slim',
    category: 'fashion',
    parameters: {
      age: 22,
      gender: 0.0,
      height: 0.7,    // ~180cm (5'11") - runway standard
      weight: 0.25,   // Very slim
      muscle: 0.25,
    },
  },
  {
    id: 'fashion-runway-male',
    name: 'Runway Model (Male)',
    description: 'High fashion runway model, tall and lean',
    category: 'fashion',
    parameters: {
      age: 24,
      gender: 1.0,
      height: 0.75,   // ~188cm (6'2") - runway standard
      weight: 0.35,   // Lean
      muscle: 0.45,
    },
  },
  {
    id: 'fashion-plus-size',
    name: 'Plus-Size Model',
    description: 'Plus-size fashion model',
    category: 'fashion',
    parameters: {
      age: 28,
      gender: 0.0,
      height: 0.55,
      weight: 0.75,   // Plus-size
      muscle: 0.35,
    },
  },

  // ============================================================================
  // COMMERCIAL PHOTOGRAPHY
  // ============================================================================
  {
    id: 'commercial-average-female',
    name: 'Average Female',
    description: 'Typical consumer, relatable',
    category: 'commercial',
    parameters: {
      age: 35,
      gender: 0.0,
      height: 0.48,   // ~163cm (5'4") - US female average
      weight: 0.55,   // Average
      muscle: 0.35,
    },
  },
  {
    id: 'commercial-average-male',
    name: 'Average Male',
    description: 'Typical consumer, relatable',
    category: 'commercial',
    parameters: {
      age: 38,
      gender: 1.0,
      height: 0.55,   // ~175cm (5'9") - US male average
      weight: 0.6,    // Average
      muscle: 0.4,
    },
  },

  // ============================================================================
  // FITNESS PHOTOGRAPHY
  // ============================================================================
  {
    id: 'fitness-female-athletic',
    name: 'Athletic Female',
    description: 'Fitness model, toned and muscular',
    category: 'fitness',
    parameters: {
      age: 28,
      gender: 0.0,
      height: 0.52,
      weight: 0.45,
      muscle: 0.75,   // High muscle definition
    },
  },
  {
    id: 'fitness-male-bodybuilder',
    name: 'Male Bodybuilder',
    description: 'Muscular fitness model',
    category: 'fitness',
    parameters: {
      age: 30,
      gender: 1.0,
      height: 0.6,
      weight: 0.7,
      muscle: 0.95,   // Very high muscle definition
    },
  },

  // ============================================================================
  // CHILD PHOTOGRAPHY
  // ============================================================================
  {
    id: 'child-toddler',
    name: 'Toddler (3 years)',
    description: 'Young child for family photography',
    category: 'child',
    parameters: {
      age: 3,
      gender: 0.5,    // Neutral
      height: 0.15,   // ~95cm (3'1")
      weight: 0.3,
      muscle: 0.2,
    },
  },
  {
    id: 'child-school-age',
    name: 'School-Age Child (8 years)',
    description: 'Elementary school age',
    category: 'child',
    parameters: {
      age: 8,
      gender: 0.5,
      height: 0.25,   // ~127cm (4'2")
      weight: 0.35,
      muscle: 0.25,
    },
  },
  {
    id: 'child-teen-female',
    name: 'Teen Female (15 years)',
    description: 'Teenage girl',
    category: 'child',
    parameters: {
      age: 15,
      gender: 0.0,
      height: 0.48,   // ~163cm (5'4")
      weight: 0.4,
      muscle: 0.3,
    },
  },
  {
    id: 'child-teen-male',
    name: 'Teen Male (16 years)',
    description: 'Teenage boy',
    category: 'child',
    parameters: {
      age: 16,
      gender: 1.0,
      height: 0.55,   // ~175cm (5'9")
      weight: 0.45,
      muscle: 0.4,
    },
  },

  // ============================================================================
  // ELDER PHOTOGRAPHY
  // ============================================================================
  {
    id: 'elder-female-60s',
    name: 'Senior Female (60s)',
    description: 'Active senior woman',
    category: 'elder',
    parameters: {
      age: 65,
      gender: 0.0,
      height: 0.45,   // ~160cm (5'3") - height decreases with age
      weight: 0.55,
      muscle: 0.25,
    },
  },
  {
    id: 'elder-male-60s',
    name: 'Senior Male (60s)',
    description: 'Active senior man',
    category: 'elder',
    parameters: {
      age: 67,
      gender: 1.0,
      height: 0.52,   // ~173cm (5'8")
      weight: 0.6,
      muscle: 0.3,
    },
  },
  {
    id: 'elder-female-80s',
    name: 'Elderly Female (80s)',
    description: 'Elderly woman',
    category: 'elder',
    parameters: {
      age: 82,
      gender: 0.0,
      height: 0.4,    // ~155cm (5'1")
      weight: 0.5,
      muscle: 0.2,
    },
  },
  {
    id: 'elder-male-80s',
    name: 'Elderly Male (80s)',
    description: 'Elderly man',
    category: 'elder',
    parameters: {
      age: 85,
      gender: 1.0,
      height: 0.48,   // ~168cm (5'6")
      weight: 0.55,
      muscle: 0.25,
    },
  },

  // ============================================================================
  // SPORTS PHOTOGRAPHY
  // ============================================================================
  {
    id: 'sports-swimmer-female',
    name: 'Female Swimmer',
    description: 'Athletic swimmer build, lean and toned',
    category: 'fitness',
    parameters: {
      age: 22,
      gender: 0.0,
      height: 0.58,   // ~175cm
      weight: 0.4,
      muscle: 0.7,
    },
  },
  {
    id: 'sports-basketball-male',
    name: 'Male Basketball Player',
    description: 'Tall athletic build for basketball',
    category: 'fitness',
    parameters: {
      age: 25,
      gender: 1.0,
      height: 0.85,   // ~198cm (6'6")
      weight: 0.55,
      muscle: 0.65,
    },
  },
  {
    id: 'sports-gymnast-female',
    name: 'Female Gymnast',
    description: 'Compact, muscular gymnast build',
    category: 'fitness',
    parameters: {
      age: 20,
      gender: 0.0,
      height: 0.38,   // ~157cm (5'2")
      weight: 0.35,
      muscle: 0.8,
    },
  },
  {
    id: 'sports-runner-male',
    name: 'Male Marathon Runner',
    description: 'Lean endurance athlete build',
    category: 'fitness',
    parameters: {
      age: 28,
      gender: 1.0,
      height: 0.55,   // ~175cm
      weight: 0.3,
      muscle: 0.55,
    },
  },
  {
    id: 'sports-weightlifter-female',
    name: 'Female Weightlifter',
    description: 'Powerlifter build with strength',
    category: 'fitness',
    parameters: {
      age: 26,
      gender: 0.0,
      height: 0.5,    // ~168cm
      weight: 0.65,
      muscle: 0.85,
    },
  },

  // ============================================================================
  // BUSINESS/CORPORATE PHOTOGRAPHY
  // ============================================================================
  {
    id: 'business-executive-female',
    name: 'Female Executive',
    description: 'Professional businesswoman, polished appearance',
    category: 'commercial',
    parameters: {
      age: 42,
      gender: 0.0,
      height: 0.52,   // ~168cm
      weight: 0.48,
      muscle: 0.3,
    },
  },
  {
    id: 'business-executive-male',
    name: 'Male Executive',
    description: 'Professional businessman, authoritative presence',
    category: 'commercial',
    parameters: {
      age: 50,
      gender: 1.0,
      height: 0.6,    // ~180cm
      weight: 0.58,
      muscle: 0.35,
    },
  },
  {
    id: 'business-young-professional-female',
    name: 'Young Professional Female',
    description: 'Early career professional woman',
    category: 'commercial',
    parameters: {
      age: 28,
      gender: 0.0,
      height: 0.5,    // ~165cm
      weight: 0.45,
      muscle: 0.35,
    },
  },
  {
    id: 'business-young-professional-male',
    name: 'Young Professional Male',
    description: 'Early career professional man',
    category: 'commercial',
    parameters: {
      age: 30,
      gender: 1.0,
      height: 0.58,   // ~178cm
      weight: 0.5,
      muscle: 0.45,
    },
  },

  // ============================================================================
  // DIVERSE BODY TYPES
  // ============================================================================
  {
    id: 'diverse-petite-female',
    name: 'Petite Female',
    description: 'Small frame, delicate build',
    category: 'portrait',
    parameters: {
      age: 26,
      gender: 0.0,
      height: 0.35,   // ~155cm (5'1")
      weight: 0.35,
      muscle: 0.25,
    },
  },
  {
    id: 'diverse-tall-female',
    name: 'Tall Female',
    description: 'Tall, elegant build',
    category: 'portrait',
    parameters: {
      age: 29,
      gender: 0.0,
      height: 0.72,   // ~182cm (6'0")
      weight: 0.45,
      muscle: 0.35,
    },
  },
  {
    id: 'diverse-curvy-female',
    name: 'Curvy Female',
    description: 'Full-figured, curvy build',
    category: 'portrait',
    parameters: {
      age: 32,
      gender: 0.0,
      height: 0.5,    // ~165cm
      weight: 0.7,
      muscle: 0.3,
    },
  },
  {
    id: 'diverse-stocky-male',
    name: 'Stocky Male',
    description: 'Broad, stocky build',
    category: 'portrait',
    parameters: {
      age: 35,
      gender: 1.0,
      height: 0.52,   // ~170cm
      weight: 0.72,
      muscle: 0.55,
    },
  },
  {
    id: 'diverse-athletic-androgynous',
    name: 'Androgynous Athletic',
    description: 'Gender-neutral athletic build',
    category: 'fashion',
    parameters: {
      age: 24,
      gender: 0.5,    // Neutral
      height: 0.55,   // ~175cm
      weight: 0.42,
      muscle: 0.5,
    },
  },

  // ============================================================================
  // MATERNITY PHOTOGRAPHY
  // ============================================================================
  {
    id: 'maternity-early',
    name: 'Early Pregnancy (20 weeks)',
    description: 'Early pregnancy showing small bump',
    category: 'portrait',
    parameters: {
      age: 30,
      gender: 0.0,
      height: 0.5,
      weight: 0.55,
      muscle: 0.3,
    },
  },
  {
    id: 'maternity-mid',
    name: 'Mid Pregnancy (28 weeks)',
    description: 'Mid-pregnancy with visible bump',
    category: 'portrait',
    parameters: {
      age: 32,
      gender: 0.0,
      height: 0.5,
      weight: 0.62,
      muscle: 0.28,
    },
  },
  {
    id: 'maternity-late',
    name: 'Late Pregnancy (36 weeks)',
    description: 'Late pregnancy, full term approaching',
    category: 'portrait',
    parameters: {
      age: 28,
      gender: 0.0,
      height: 0.48,
      weight: 0.7,
      muscle: 0.25,
    },
  },

  // ============================================================================
  // MEDICAL/HEALTHCARE PHOTOGRAPHY
  // ============================================================================
  {
    id: 'medical-doctor-female',
    name: 'Female Doctor',
    description: 'Healthcare professional, confident pose',
    category: 'commercial',
    parameters: {
      age: 38,
      gender: 0.0,
      height: 0.52,
      weight: 0.5,
      muscle: 0.32,
    },
  },
  {
    id: 'medical-nurse-male',
    name: 'Male Nurse',
    description: 'Healthcare professional, approachable',
    category: 'commercial',
    parameters: {
      age: 32,
      gender: 1.0,
      height: 0.58,
      weight: 0.52,
      muscle: 0.4,
    },
  },

  // ============================================================================
  // CREATIVE/ARTISTIC PHOTOGRAPHY
  // ============================================================================
  {
    id: 'artistic-dancer-female',
    name: 'Female Dancer',
    description: 'Ballet/contemporary dancer build',
    category: 'fitness',
    parameters: {
      age: 24,
      gender: 0.0,
      height: 0.52,   // ~168cm
      weight: 0.32,
      muscle: 0.6,
    },
  },
  {
    id: 'artistic-dancer-male',
    name: 'Male Dancer',
    description: 'Contemporary dancer build',
    category: 'fitness',
    parameters: {
      age: 26,
      gender: 1.0,
      height: 0.6,    // ~180cm
      weight: 0.4,
      muscle: 0.65,
    },
  },
  {
    id: 'artistic-musician',
    name: 'Musician',
    description: 'Casual artistic appearance',
    category: 'portrait',
    parameters: {
      age: 28,
      gender: 0.5,    // Neutral
      height: 0.55,
      weight: 0.48,
      muscle: 0.35,
    },
  },
];

/**
 * Get presets by category
 */
export function getPresetsByCategory(category: ActorPreset['category']): ActorPreset[] {
  return ACTOR_PRESETS.filter(preset => preset.category === category);
}

/**
 * Get preset by ID
 */
export function getPresetById(id: string): ActorPreset | undefined {
  return ACTOR_PRESETS.find(preset => preset.id === id);
}

