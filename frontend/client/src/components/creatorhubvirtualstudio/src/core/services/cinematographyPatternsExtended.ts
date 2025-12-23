/**
 * Extended Cinematography Patterns
 * 
 * Additional Hollywood lighting patterns (Part 2)
 * These methods extend the main cinematographyPatternsService
 */

import type { CinematographyPattern } from './cinematographyPatternsService';

/**
 * Clamshell Lighting
 * 
 * Beauty lighting with top and bottom lights creating even, flattering illumination.
 * Named for the clamshell shape of the light placement.
 * 
 * Reference: "Set Lighting Technician's Handbook"
 */
export function createClamshellLighting(): CinematographyPattern {
  return {
    id: 'clamshell',
    name: 'Clamshell Lighting',
    category: 'beauty',
    description: 'Beauty lighting with top and bottom lights. Creates even, flattering, shadow-free illumination.',
    keyToFillRatio: 1,
    mood: 'bright',
    difficulty: 'intermediate',
    usedIn: ['Beauty photography','Fashion','Cosmetics advertising'],
    reference: 'Box, H. C. (2013). Set Lighting Technician\'s Handbook. Chapter 11',
    lights: [
      {
        role: 'key',
        name: 'Top Light',
        position: [0, 2.2, 1.8],
        rotation: [-55, 0, 0],
        power: 1.0,
        cct: 5600,
        beam: 55,
        modifier: 'octabox',
        distance: 2.85,
        angle: 0,
        height: 2.2,
      },
      {
        role: 'fill',
        name: 'Bottom Reflector',
        position: [0, 0.6, 1.5],
        rotation: [40, 0, 0],
        power: 1.0,
        cct: 5600,
        beam: 90,
        modifier: 'reflector',
        distance: 1.62,
        angle: 0,
        height: 0.6,
        ratioToKey: 1.0, // 1:1 ratio
      },
      {
        role: 'hair',
        name: 'Hair Light',
        position: [0, 3.0, -1.0],
        rotation: [-70, 180, 0],
        power: 0.3,
        cct: 5600,
        beam: 25,
        modifier: 'snoot',
        distance: 3.16,
        angle: 180,
        height: 3.0,
        ratioToKey: 0.3,
      },
    ],
  };
}

/**
 * Beauty Lighting
 * 
 * Glamorous lighting for beauty and fashion.
 * Large soft source with fill from below.
 * 
 * Reference: ASC Manual
 */
export function createBeautyLighting(): CinematographyPattern {
  return {
    id: 'beauty',
    name: 'Beauty Lighting',
    category: 'beauty',
    description: 'Glamorous lighting for beauty and fashion. Large soft source creates flawless skin.',
    keyToFillRatio: 1.5,
    mood: 'bright',
    difficulty: 'intermediate',
    usedIn: ['Beauty campaigns','Fashion editorials','Cosmetics'],
    reference: 'ASC Manual, 10th Edition. Chapter 15: Beauty Lighting',
    lights: [
      {
        role: 'key',
        name: 'Large Softbox',
        position: [0, 2.0, 1.5],
        rotation: [-50, 0, 0],
        power: 1.0,
        cct: 5600,
        beam: 70,
        modifier: 'octabox',
        distance: 2.50,
        angle: 0,
        height: 2.0,
      },
      {
        role: 'fill',
        name: 'Fill Reflector',
        position: [0, 0.8, 1.2],
        rotation: [35, 0, 0],
        power: 0.67,
        cct: 5600,
        beam: 85,
        modifier: 'reflector',
        distance: 1.44,
        angle: 0,
        height: 0.8,
        ratioToKey: 0.67,
      },
      {
        role: 'rim',
        name: 'Rim Light',
        position: [-2.0, 2.2, -1.5],
        rotation: [-55, 135, 0],
        power: 0.4,
        cct: 5600,
        beam: 35,
        modifier: 'grid',
        distance: 3.27,
        angle: 135,
        height: 2.2,
        ratioToKey: 0.4,
      },
    ],
  };
}

/**
 * Interview Lighting
 * 
 * Professional single-person interview setup.
 * Flattering but natural-looking.
 * 
 * Reference: "Set Lighting Technician's Handbook"
 */
export function createInterviewLighting(): CinematographyPattern {
  return {
    id: 'interview',
    name: 'Interview Lighting',
    category: 'interview',
    description: 'Professional single-person interview setup. Flattering but natural-looking.',
    keyToFillRatio: 2.5,
    mood: 'neutral',
    difficulty: 'beginner',
    usedIn: ['Documentaries','News interviews','Corporate videos'],
    reference: 'Box, H. C. (2013). Set Lighting Technician\'s Handbook. Chapter 12',
    lights: [
      {
        role: 'key',
        name: 'Key Light',
        position: [1.8, 1.9, 2.0],
        rotation: [-42, -40, 0],
        power: 1.0,
        cct: 5600,
        beam: 50,
        modifier: 'softbox',
        distance: 3.18,
        angle: 40,
        height: 1.9,
      },
      {
        role: 'fill',
        name: 'Fill Light',
        position: [-1.3, 1.6, 1.8],
        rotation: [-38, 38, 0],
        power: 0.4,
        cct: 5600,
        beam: 65,
        modifier: 'umbrella',
        distance: 2.73,
        angle: -38,
        height: 1.6,
        ratioToKey: 0.4,
      },
      {
        role: 'rim',
        name: 'Back Light',
        position: [-1.5, 2.3, -2.0],
        rotation: [-52, 140, 0],
        power: 0.5,
        cct: 5600,
        beam: 32,
        modifier: 'grid',
        distance: 3.38,
        angle: 140,
        height: 2.3,
        ratioToKey: 0.5,
      },
      {
        role: 'background',
        name: 'Background Light',
        position: [-1.8, 1.8, -2.8],
        rotation: [-32, 155, 0],
        power: 0.35,
        cct: 5600,
        beam: 48,
        modifier: 'flood',
        distance: 3.79,
        angle: 155,
        height: 1.8,
        ratioToKey: 0.35,
      },
    ],
  };
}

/**
 * Two-Person Interview
 * 
 * Lighting setup for two people facing each other.
 * Each person has their own key/fill.
 * 
 * Reference: ASC Manual
 */
export function createTwoPersonInterview(): CinematographyPattern {
  return {
    id: 'two-person-interview',
    name: 'Two-Person Interview',
    category: 'interview',
    description: 'Setup for two people facing each other. Each person has dedicated key and fill.',
    keyToFillRatio: 2,
    mood: 'neutral',
    difficulty: 'intermediate',
    usedIn: ['Talk shows','Interviews','Conversations'],
    reference: 'ASC Manual, 10th Edition. Chapter 13: Multi-Person Lighting',
    lights: [
      {
        role: 'key',
        name: 'Key Light Person A',
        position: [2.5, 2.0, 1.0],
        rotation: [-45, -70, 0],
        power: 1.0,
        cct: 5600,
        beam: 45,
        modifier: 'softbox',
        distance: 3.35,
        angle: 70,
        height: 2.0,
      },
      {
        role: 'key',
        name: 'Key Light Person B',
        position: [-2.5, 2.0, 1.0],
        rotation: [-45, 70, 0],
        power: 1.0,
        cct: 5600,
        beam: 45,
        modifier: 'softbox',
        distance: 3.35,
        angle: -70,
        height: 2.0,
      },
      {
        role: 'fill',
        name: 'Shared Fill',
        position: [0, 1.5, 2.5],
        rotation: [-35, 0, 0],
        power: 0.5,
        cct: 5600,
        beam: 75,
        modifier: 'umbrella',
        distance: 2.92,
        angle: 0,
        height: 1.5,
        ratioToKey: 0.5,
      },
      {
        role: 'background',
        name: 'Background Light',
        position: [0, 2.2, -3.5],
        rotation: [-30, 180, 0],
        power: 0.4,
        cct: 5600,
        beam: 60,
        modifier: 'flood',
        distance: 4.14,
        angle: 180,
        height: 2.2,
        ratioToKey: 0.4,
      },
    ],
  };
}

/**
 * Natural Window Light
 *
 * Simulates soft window light from the side.
 * Natural, flattering, commonly used in films.
 *
 * Reference: "Film Lighting" by Kris Malkiewicz
 */
export function createNaturalWindowLight(): CinematographyPattern {
  return {
    id: 'natural-window',
    name: 'Natural Window Light',
    category: 'portrait',
    description: 'Simulates soft natural light from a window. Flattering and commonly used in films.',
    keyToFillRatio: 3,
    mood: 'neutral',
    difficulty: 'beginner',
    usedIn: ['Her (2013)','Call Me By Your Name (2017)','Natural-looking films'],
    reference: 'Malkiewicz, K. (2012). Film Lighting. Chapter 6: Natural Light',
    lights: [
      {
        role: 'key',
        name: 'Window Light',
        position: [3.0, 1.8, 0.5],
        rotation: [-35, -85, 0],
        power: 1.0,
        cct: 5600,
        beam: 70,
        modifier: 'softbox',
        distance: 3.44,
        angle: 85,
        height: 1.8,
      },
      {
        role: 'fill',
        name: 'Bounce Fill',
        position: [-2.0, 1.2, 1.0],
        rotation: [-25, 60, 0],
        power: 0.33,
        cct: 5600,
        beam: 85,
        modifier: 'bounce',
        distance: 2.45,
        angle: -60,
        height: 1.2,
        ratioToKey: 0.33,
      },
    ],
  };
}

/**
 * Golden Hour Lighting
 *
 * Simulates warm sunset/sunrise light.
 * Warm CCT, low angle, soft quality.
 *
 * Reference: ASC Manual
 */
export function createGoldenHourLighting(): CinematographyPattern {
  return {
    id: 'golden-hour',
    name: 'Golden Hour Lighting',
    category: 'portrait',
    description: 'Simulates warm sunset/sunrise light. Warm color temperature, low angle, soft and flattering.',
    keyToFillRatio: 4,
    mood: 'neutral',
    difficulty: 'intermediate',
    usedIn: ['Days of Heaven (1978)','The Revenant (2015)','Outdoor scenes'],
    reference: 'ASC Manual, 10th Edition. Chapter 16: Natural Light Simulation',
    lights: [
      {
        role: 'key',
        name: 'Sun (Low Angle)',
        position: [4.0, 1.2, 2.0],
        rotation: [-20, -60, 0],
        power: 1.0,
        cct: 3200, // Warm golden hour
        beam: 40,
        modifier: 'softbox',
        distance: 4.69,
        angle: 60,
        height: 1.2,
      },
      {
        role: 'fill',
        name: 'Sky Fill',
        position: [-1.5, 2.0, 1.5],
        rotation: [-40, 45, 0],
        power: 0.25,
        cct: 4500, // Cooler sky
        beam: 80,
        modifier: 'bounce',
        distance: 3.04,
        angle: -45,
        height: 2.0,
        ratioToKey: 0.25,
      },
      {
        role: 'rim',
        name: 'Rim Light',
        position: [-3.0, 1.5, -2.0],
        rotation: [-30, 145, 0],
        power: 0.6,
        cct: 3200,
        beam: 35,
        modifier: 'grid',
        distance: 4.03,
        angle: 145,
        height: 1.5,
        ratioToKey: 0.6,
      },
    ],
  };
}

/**
 * Moonlight Lighting
 *
 * Simulates cool moonlight.
 * Blue CCT, low intensity, high contrast.
 *
 * Reference: "Painting with Light" by John Alton
 */
export function createMoonlightLighting(): CinematographyPattern {
  return {
    id: 'moonlight',
    name: 'Moonlight Lighting',
    category: 'dramatic',
    description: 'Simulates cool moonlight. Blue color temperature, low intensity, high contrast.',
    keyToFillRatio: 8,
    mood: 'dark',
    difficulty: 'advanced',
    usedIn: ['Night scenes','Horror films','Romantic scenes'],
    reference: 'Alton, J. (1995). Painting with Light. Chapter 8: Night Lighting',
    lights: [
      {
        role: 'key',
        name: 'Moonlight',
        position: [2.5, 3.5, 1.5],
        rotation: [-60, -55, 0],
        power: 0.6,
        cct: 6500, // Cool blue moonlight
        beam: 50,
        modifier: 'softbox',
        distance: 4.61,
        angle: 55,
        height: 3.5,
      },
      {
        role: 'fill',
        name: 'Minimal Fill',
        position: [-1.0, 1.0, 1.5],
        rotation: [-25, 35, 0],
        power: 0.075,
        cct: 6500,
        beam: 75,
        modifier: 'bounce',
        distance: 2.06,
        angle: -35,
        height: 1.0,
        ratioToKey: 0.125,
      },
    ],
  };
}

/**
 * Candlelight Lighting
 */
export function createCandlelightLighting(): CinematographyPattern {
  return {
    id: 'candlelight',
    name: 'Candlelight Lighting',
    category: 'dramatic',
    description: 'Simulates warm, intimate candlelight. Very warm color temperature, low angle, soft quality.',
    keyToFillRatio: 16,
    mood: 'dark',
    difficulty: 'advanced',
    usedIn: ['Barry Lyndon (1975)','Romantic scenes','Period dramas'],
    reference: 'Malkiewicz, K. (2012). Film Lighting. Chapter 10: Motivated Lighting',
    lights: [
      {
        role: 'key',
        name: 'Candle Source',
        position: [0.8, 0.8, 0.8],
        rotation: [-30, -45, 0],
        power: 0.4,
        cct: 2000,
        beam: 60,
        modifier: 'bare',
        distance: 1.39,
        angle: 45,
        height: 0.8,
      },
    ],
  };
}

/**
 * Product Lighting
 */
export function createProductLighting(): CinematographyPattern {
  return {
    id: 'product',
    name: 'Product Lighting',
    category: 'product',
    description: 'Clean, even lighting for product photography.',
    keyToFillRatio: 1.5,
    mood: 'bright',
    difficulty: 'intermediate',
    usedIn: ['E-commerce','Product photography'],
    reference: 'Box, H. C. (2013). Set Lighting Technician\'s Handbook. Chapter 14',
    lights: [
      {
        role: 'key',
        name: 'Main Light',
        position: [1.5, 2.0, 1.5],
        rotation: [-50, -45, 0],
        power: 1.0,
        cct: 5600,
        beam: 55,
        modifier: 'softbox',
        distance: 2.92,
        angle: 45,
        height: 2.0,
      },
    ],
  };
}

/**
 * Jewelry Lighting
 */
export function createJewelryLighting(): CinematographyPattern {
  return {
    id: 'jewelry',
    name: 'Jewelry Lighting',
    category: 'product',
    description: 'Specialized lighting for jewelry and reflective objects.',
    keyToFillRatio: 1,
    mood: 'bright',
    difficulty: 'advanced',
    usedIn: ['Jewelry photography','Luxury products'],
    reference: 'ASC Manual, 10th Edition. Chapter 17',
    lights: [
      {
        role: 'key',
        name: 'Top Light',
        position: [0, 2.5, 0.5],
        rotation: [-70, 0, 0],
        power: 1.0,
        cct: 5600,
        beam: 30,
        modifier: 'softbox',
        distance: 2.55,
        angle: 0,
        height: 2.5,
      },
    ],
  };
}
