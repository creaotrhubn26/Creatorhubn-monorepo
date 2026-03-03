/**
 * Light Setup Recommendation Service
 *
 * Recommends lighting configurations based on character type, HDRI environment,
 * and shooting context. Provides complete lighting setups with key, fill, and
 * accent lights with positions, modifiers, and power settings.
 */

import { logger } from './logger';

const log = logger.module('LightSetupRecommendation');

export interface LightConfig {
  type: 'key' | 'fill' | 'rim' | 'hair' | 'background' | 'accent';
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  power: number;
  colorTemp: number;
  modifier: string;
  modifierSize?: string;
  enabled: boolean;
}

export interface LightSetupRecommendation {
  id: string;
  name: string;
  description: string;
  category: 'portrait' | 'dramatic' | 'commercial' | 'natural' | 'cinematic' | 'practical';
  lights: LightConfig[];
  keyToFillRatio: string;
  mood: string;
  bestFor: string[];
  matchScore: number;
  reason: string;
  tips: string[];
}

export interface CharacterContext {
  name: string;
  tags?: string[];
  genre?: string;
  era?: string;
  mood?: string;
}

export interface HDRIContext {
  id: string;
  category: string;
  name: string;
}

type LightSetupBase = Omit<LightSetupRecommendation, 'matchScore' | 'reason'>;

const LIGHT_SETUPS: Record<string, LightSetupBase> = {
  'classic-portrait': {
    id: 'classic-portrait',
    name: 'Classic Portrait',
    description: 'Traditional 45-degree key light with soft fill.',
    category: 'portrait',
    lights: [
      {
        type: 'key',
        name: 'Key Light',
        position: { x: -2, y: 2.5, z: 2 },
        rotation: { x: -30, y: 45, z: 0 },
        power: 75,
        colorTemp: 5600,
        modifier: 'softbox',
        modifierSize: '90x120cm',
        enabled: true,
      },
      {
        type: 'fill',
        name: 'Fill Light',
        position: { x: 2, y: 2, z: 1.5 },
        rotation: { x: -20, y: -30, z: 0 },
        power: 35,
        colorTemp: 5600,
        modifier: 'umbrella',
        modifierSize: '120cm',
        enabled: true,
      },
      {
        type: 'hair',
        name: 'Hair Light',
        position: { x: 0, y: 3, z: -1.5 },
        rotation: { x: -60, y: 0, z: 0 },
        power: 45,
        colorTemp: 5600,
        modifier: 'stripbox',
        modifierSize: '30x120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '2:1',
    mood: 'Professional and flattering',
    bestFor: ['headshots', 'business portraits', 'actor cards'],
    tips: [
      'Keep key light slightly above eye level.',
      'Adjust fill for skin texture control.',
      'Use hair light to separate from dark backgrounds.',
    ],
  },
  'butterfly-beauty': {
    id: 'butterfly-beauty',
    name: 'Butterfly / Beauty',
    description: 'Centered top light for beauty and glamour portraits.',
    category: 'portrait',
    lights: [
      {
        type: 'key',
        name: 'Beauty Dish',
        position: { x: 0, y: 3, z: 2 },
        rotation: { x: -45, y: 0, z: 0 },
        power: 82,
        colorTemp: 5600,
        modifier: 'beauty-dish',
        modifierSize: '56cm',
        enabled: true,
      },
      {
        type: 'fill',
        name: 'Clamshell Fill',
        position: { x: 0, y: 0.8, z: 1.6 },
        rotation: { x: 35, y: 0, z: 0 },
        power: 48,
        colorTemp: 5600,
        modifier: 'reflector',
        modifierSize: '100cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '1.7:1',
    mood: 'Polished and elegant',
    bestFor: ['beauty', 'fashion', 'social content'],
    tips: ['Use small chin tilt down for butterfly shadow shape.', 'Raise fill for softer jaw shadows.'],
  },
  rembrandt: {
    id: 'rembrandt',
    name: 'Rembrandt',
    description: 'Painterly contrast with cheek triangle light.',
    category: 'portrait',
    lights: [
      {
        type: 'key',
        name: 'Key Softbox',
        position: { x: -2.5, y: 2.5, z: 1.5 },
        rotation: { x: -35, y: 50, z: 0 },
        power: 70,
        colorTemp: 5200,
        modifier: 'softbox',
        modifierSize: '90x120cm',
        enabled: true,
      },
      {
        type: 'fill',
        name: 'Bounce Fill',
        position: { x: 2, y: 1.6, z: 1.8 },
        rotation: { x: -10, y: -30, z: 0 },
        power: 24,
        colorTemp: 5200,
        modifier: 'reflector',
        modifierSize: '100cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '3:1',
    mood: 'Artistic and dramatic',
    bestFor: ['editorial', 'cinematic portraits', 'dramatic interviews'],
    tips: ['Tune angle until the cheek triangle appears.', 'Reduce fill to strengthen mood.'],
  },
  'split-light': {
    id: 'split-light',
    name: 'Split Lighting',
    description: 'Hard side key for strong half-face contrast.',
    category: 'dramatic',
    lights: [
      {
        type: 'key',
        name: 'Side Key',
        position: { x: -3, y: 2, z: 0.5 },
        rotation: { x: -20, y: 90, z: 0 },
        power: 78,
        colorTemp: 5600,
        modifier: 'gridded-softbox',
        modifierSize: '60x90cm',
        enabled: true,
      },
      {
        type: 'rim',
        name: 'Rim Light',
        position: { x: 2.5, y: 2.5, z: -1 },
        rotation: { x: -30, y: -60, z: 0 },
        power: 40,
        colorTemp: 5600,
        modifier: 'stripbox',
        modifierSize: '30x90cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '8:1',
    mood: 'Intense and edgy',
    bestFor: ['music', 'character studies', 'dark narrative'],
    tips: ['Use black negative fill opposite key for maximum contrast.'],
  },
  clamshell: {
    id: 'clamshell',
    name: 'Clamshell',
    description: 'Balanced top and bottom soft lights.',
    category: 'commercial',
    lights: [
      {
        type: 'key',
        name: 'Top Key',
        position: { x: 0, y: 2.8, z: 2 },
        rotation: { x: -40, y: 0, z: 0 },
        power: 72,
        colorTemp: 5600,
        modifier: 'beauty-dish',
        modifierSize: '56cm',
        enabled: true,
      },
      {
        type: 'fill',
        name: 'Bottom Fill',
        position: { x: 0, y: 0.8, z: 1.4 },
        rotation: { x: 30, y: 0, z: 0 },
        power: 55,
        colorTemp: 5600,
        modifier: 'softbox',
        modifierSize: '60x90cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '1.3:1',
    mood: 'Clean and polished',
    bestFor: ['corporate portraits', 'makeup', 'content creators'],
    tips: ['Keep both modifiers close for skin-friendly softness.'],
  },
  'high-key': {
    id: 'high-key',
    name: 'High Key',
    description: 'Bright low-contrast setup with clean shadow handling.',
    category: 'commercial',
    lights: [
      {
        type: 'key',
        name: 'Main Octa',
        position: { x: -1.5, y: 2.6, z: 2 },
        rotation: { x: -30, y: 30, z: 0 },
        power: 70,
        colorTemp: 5600,
        modifier: 'octabox',
        modifierSize: '150cm',
        enabled: true,
      },
      {
        type: 'fill',
        name: 'Fill Octa',
        position: { x: 1.5, y: 2.3, z: 2 },
        rotation: { x: -25, y: -30, z: 0 },
        power: 60,
        colorTemp: 5600,
        modifier: 'octabox',
        modifierSize: '120cm',
        enabled: true,
      },
      {
        type: 'background',
        name: 'Background Pair',
        position: { x: 0, y: 1.5, z: -2.5 },
        rotation: { x: 0, y: 180, z: 0 },
        power: 95,
        colorTemp: 5600,
        modifier: 'bare',
        enabled: true,
      },
    ],
    keyToFillRatio: '1.2:1',
    mood: 'Bright and commercial',
    bestFor: ['ads', 'ecommerce', 'beauty'],
    tips: ['Overexpose background by one stop for crisp white.'],
  },
  'low-key': {
    id: 'low-key',
    name: 'Low Key',
    description: 'Minimal fill with controlled highlights.',
    category: 'dramatic',
    lights: [
      {
        type: 'key',
        name: 'Key Spot',
        position: { x: -2, y: 2.2, z: 1 },
        rotation: { x: -25, y: 55, z: 0 },
        power: 66,
        colorTemp: 5200,
        modifier: 'gridded-softbox',
        modifierSize: '60x90cm',
        enabled: true,
      },
      {
        type: 'rim',
        name: 'Edge Rim',
        position: { x: 2, y: 2.5, z: -1.5 },
        rotation: { x: -35, y: -50, z: 0 },
        power: 50,
        colorTemp: 5200,
        modifier: 'stripbox',
        modifierSize: '30x120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: 'No fill',
    mood: 'Dark and cinematic',
    bestFor: ['moody portraits', 'music videos', 'dramatic ads'],
    tips: ['Use flags to avoid background contamination.'],
  },
  'barber-shop': {
    id: 'barber-shop',
    name: 'Barbershop',
    description: 'Warm mirror-like setup for grooming content.',
    category: 'commercial',
    lights: [
      {
        type: 'key',
        name: 'Mirror Key',
        position: { x: 0, y: 2.2, z: 2.4 },
        rotation: { x: -25, y: 0, z: 0 },
        power: 70,
        colorTemp: 4500,
        modifier: 'softbox',
        modifierSize: '90x120cm',
        enabled: true,
      },
      {
        type: 'fill',
        name: 'Dual Fill',
        position: { x: 2, y: 1.8, z: 1.5 },
        rotation: { x: -15, y: -25, z: 0 },
        power: 40,
        colorTemp: 4500,
        modifier: 'umbrella',
        modifierSize: '100cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '1.5:1',
    mood: 'Warm and inviting',
    bestFor: ['barber', 'salon', 'portrait branding'],
    tips: ['Slight warmth emphasizes skin and hair texture.'],
  },
  'chef-kitchen': {
    id: 'chef-kitchen',
    name: 'Chef / Kitchen',
    description: 'Practical cinematic setup for culinary scenes.',
    category: 'practical',
    lights: [
      {
        type: 'key',
        name: 'Prep Key',
        position: { x: -2.5, y: 2.5, z: 1.5 },
        rotation: { x: -30, y: 45, z: 0 },
        power: 75,
        colorTemp: 5000,
        modifier: 'softbox',
        modifierSize: '90x120cm',
        enabled: true,
      },
      {
        type: 'accent',
        name: 'Counter Accent',
        position: { x: 0, y: 3.2, z: 0 },
        rotation: { x: -90, y: 0, z: 0 },
        power: 52,
        colorTemp: 4800,
        modifier: 'softbox',
        modifierSize: '60x90cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '2.5:1',
    mood: 'Dynamic and practical',
    bestFor: ['chef reels', 'food tutorials', 'kitchen documentaries'],
    tips: ['Use top accent for food texture and steam detail.'],
  },
  'mechanic-workshop': {
    id: 'mechanic-workshop',
    name: 'Workshop / Garage',
    description: 'Industrial overhead source with strong separation.',
    category: 'practical',
    lights: [
      {
        type: 'key',
        name: 'Industrial Overhead',
        position: { x: 0, y: 4, z: 1 },
        rotation: { x: -70, y: 0, z: 0 },
        power: 80,
        colorTemp: 4000,
        modifier: 'industrial-reflector',
        modifierSize: '45cm',
        enabled: true,
      },
      {
        type: 'rim',
        name: 'Workshop Rim',
        position: { x: 2, y: 2, z: -2 },
        rotation: { x: -25, y: -60, z: 0 },
        power: 55,
        colorTemp: 5600,
        modifier: 'stripbox',
        modifierSize: '30x120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '3:1',
    mood: 'Industrial and gritty',
    bestFor: ['mechanics', 'craft', 'workshop branding'],
    tips: ['Allow harder shadows for realism and texture.'],
  },
  'tattoo-artist': {
    id: 'tattoo-artist',
    name: 'Tattoo Studio',
    description: 'High-contrast setup with creative accent color.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Studio Key',
        position: { x: -2, y: 2.2, z: 1.5 },
        rotation: { x: -25, y: 40, z: 0 },
        power: 65,
        colorTemp: 5600,
        modifier: 'softbox',
        modifierSize: '60x90cm',
        enabled: true,
      },
      {
        type: 'accent',
        name: 'Neon Accent',
        position: { x: 2.5, y: 1.5, z: 0 },
        rotation: { x: 0, y: -90, z: 0 },
        power: 32,
        colorTemp: 9000,
        modifier: 'bare',
        enabled: true,
      },
    ],
    keyToFillRatio: '4:1',
    mood: 'Urban and edgy',
    bestFor: ['tattoo artists', 'creative portraits', 'street-style reels'],
    tips: ['Color gel accents help define brand tone.'],
  },
  'film-noir': {
    id: 'film-noir',
    name: 'Film Noir',
    description: 'Classic hard key with deep directional shadows.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Hard Key Fresnel',
        position: { x: -3, y: 3, z: 1 },
        rotation: { x: -40, y: 60, z: 0 },
        power: 85,
        colorTemp: 5600,
        modifier: 'fresnel',
        modifierSize: '20cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '8:1+',
    mood: 'Mysterious and classic',
    bestFor: ['noir', 'detective style', 'dramatic posters'],
    tips: ['Cut spill aggressively with flags and gobos.'],
  },
  'sci-fi-cool': {
    id: 'sci-fi-cool',
    name: 'Sci-Fi / Futuristic',
    description: 'Cool key and cyan accents for a futuristic look.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Cool Key',
        position: { x: -1.5, y: 2.5, z: 2 },
        rotation: { x: -30, y: 25, z: 0 },
        power: 70,
        colorTemp: 7000,
        modifier: 'softbox',
        modifierSize: '90x120cm',
        enabled: true,
      },
      {
        type: 'accent',
        name: 'Blue Accent',
        position: { x: 2.5, y: 1.5, z: -1 },
        rotation: { x: -10, y: -70, z: 0 },
        power: 45,
        colorTemp: 10000,
        modifier: 'stripbox',
        modifierSize: '30x120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '3:1',
    mood: 'Futuristic and cold',
    bestFor: ['tech videos', 'sci-fi characters', 'cyberpunk visuals'],
    tips: ['Pair with practical RGB lights in the background.'],
  },
  'western-golden': {
    id: 'western-golden',
    name: 'Western / Golden Hour',
    description: 'Warm side key and strong sun rim simulation.',
    category: 'natural',
    lights: [
      {
        type: 'key',
        name: 'Golden Key',
        position: { x: -3, y: 1.5, z: 2 },
        rotation: { x: -10, y: 50, z: 0 },
        power: 75,
        colorTemp: 3200,
        modifier: 'bare',
        enabled: true,
      },
      {
        type: 'rim',
        name: 'Sun Rim',
        position: { x: 0, y: 2, z: -3 },
        rotation: { x: -20, y: 180, z: 0 },
        power: 90,
        colorTemp: 2800,
        modifier: 'bare',
        enabled: true,
      },
    ],
    keyToFillRatio: '4:1',
    mood: 'Warm and nostalgic',
    bestFor: ['western themes', 'rustic branding', 'outdoor portraits'],
    tips: ['Use haze for stronger sunset shafts.'],
  },
  'horror-dramatic': {
    id: 'horror-dramatic',
    name: 'Horror / Dramatic',
    description: 'Underlighting and hard side slash for unease.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Underlight',
        position: { x: 0, y: 0.3, z: 1.5 },
        rotation: { x: 60, y: 0, z: 0 },
        power: 60,
        colorTemp: 5600,
        modifier: 'softbox',
        modifierSize: '60x60cm',
        enabled: true,
      },
      {
        type: 'accent',
        name: 'Side Slash',
        position: { x: -3, y: 2, z: 0 },
        rotation: { x: -15, y: 90, z: 0 },
        power: 40,
        colorTemp: 5600,
        modifier: 'snoot',
        enabled: true,
      },
    ],
    keyToFillRatio: 'Inverted',
    mood: 'Unsettling',
    bestFor: ['horror scenes', 'villain portraits'],
    tips: ['Add subtle fog for amplified volumetric look.'],
  },
  'cosmic-horror': {
    id: 'cosmic-horror',
    name: 'Cosmic Horror',
    description: 'Mixed warm/cool accents for eldritch atmosphere.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Eerie Key',
        position: { x: -2, y: 2, z: 1 },
        rotation: { x: -25, y: 40, z: 0 },
        power: 50,
        colorTemp: 4000,
        modifier: 'softbox',
        modifierSize: '60x60cm',
        enabled: true,
      },
      {
        type: 'accent',
        name: 'Void Glow',
        position: { x: 2, y: 1, z: -1 },
        rotation: { x: -10, y: -60, z: 0 },
        power: 35,
        colorTemp: 10000,
        modifier: 'bare',
        enabled: true,
      },
    ],
    keyToFillRatio: '6:1',
    mood: 'Otherworldly',
    bestFor: ['eldritch horror', 'dark fantasy'],
    tips: ['Use asymmetrical color mixes for disorientation.'],
  },
  'fantasy-magical': {
    id: 'fantasy-magical',
    name: 'Fantasy / Magical',
    description: 'Soft warm key with halo accent.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Main Soft Key',
        position: { x: -2, y: 2.5, z: 2 },
        rotation: { x: -35, y: 40, z: 0 },
        power: 70,
        colorTemp: 4500,
        modifier: 'softbox',
        modifierSize: '90x120cm',
        enabled: true,
      },
      {
        type: 'hair',
        name: 'Halo Backlight',
        position: { x: 0, y: 3.5, z: -1 },
        rotation: { x: -70, y: 0, z: 0 },
        power: 45,
        colorTemp: 5600,
        modifier: 'stripbox',
        modifierSize: '30x90cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '2:1',
    mood: 'Magical and warm',
    bestFor: ['fantasy heroes', 'storybook portraits'],
    tips: ['Use practical candle or fairy lights for scene continuity.'],
  },
  'action-hero': {
    id: 'action-hero',
    name: 'Action Hero',
    description: 'High-contrast shape-focused lighting.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Hard Key',
        position: { x: -2.5, y: 2.5, z: 1 },
        rotation: { x: -30, y: 50, z: 0 },
        power: 85,
        colorTemp: 5600,
        modifier: 'gridded-softbox',
        modifierSize: '60x90cm',
        enabled: true,
      },
      {
        type: 'rim',
        name: 'Power Rim',
        position: { x: 2, y: 2.5, z: -1.5 },
        rotation: { x: -35, y: -55, z: 0 },
        power: 70,
        colorTemp: 5600,
        modifier: 'stripbox',
        modifierSize: '30x120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '5:1',
    mood: 'Powerful and dynamic',
    bestFor: ['sports portraits', 'action content'],
    tips: ['Keep fill very low to preserve hard facial shape.'],
  },
  'period-drama-elegant': {
    id: 'period-drama-elegant',
    name: 'Period Drama',
    description: 'Painterly window-style key and soft bounce fill.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Window Key',
        position: { x: -3, y: 2, z: 1 },
        rotation: { x: -20, y: 55, z: 0 },
        power: 65,
        colorTemp: 5200,
        modifier: 'softbox',
        modifierSize: '120x180cm',
        enabled: true,
      },
      {
        type: 'fill',
        name: 'Bounce Fill',
        position: { x: 2, y: 1.5, z: 2 },
        rotation: { x: -10, y: -30, z: 0 },
        power: 25,
        colorTemp: 5000,
        modifier: 'reflector',
        modifierSize: '120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '2.5:1',
    mood: 'Elegant and classical',
    bestFor: ['historical portraits', 'editorials', 'period campaigns'],
    tips: ['Use diffusion to mimic old-painting softness.'],
  },
  'asian-cinema-dramatic': {
    id: 'asian-cinema-dramatic',
    name: 'Asian Cinema Dramatic',
    description: 'Stylized contrast with directional color accents.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Side Key',
        position: { x: -2.2, y: 2.3, z: 1.1 },
        rotation: { x: -28, y: 48, z: 0 },
        power: 72,
        colorTemp: 5300,
        modifier: 'softbox',
        modifierSize: '60x90cm',
        enabled: true,
      },
      {
        type: 'accent',
        name: 'Color Kick',
        position: { x: 2.4, y: 1.4, z: -0.4 },
        rotation: { x: -10, y: -70, z: 0 },
        power: 35,
        colorTemp: 8500,
        modifier: 'stripbox',
        modifierSize: '30x90cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '4:1',
    mood: 'Stylized and dramatic',
    bestFor: ['neo-noir', 'stylized narratives', 'action portraits'],
    tips: ['Use practical colored signage to reinforce style.'],
  },
  'superhero-epic': {
    id: 'superhero-epic',
    name: 'Superhero Epic',
    description: 'Bold heroic key with strong contour rim.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Hero Key',
        position: { x: -2.6, y: 2.7, z: 1.2 },
        rotation: { x: -30, y: 52, z: 0 },
        power: 88,
        colorTemp: 5600,
        modifier: 'gridded-softbox',
        modifierSize: '60x90cm',
        enabled: true,
      },
      {
        type: 'rim',
        name: 'Epic Rim',
        position: { x: 2.3, y: 2.7, z: -1.6 },
        rotation: { x: -36, y: -56, z: 0 },
        power: 75,
        colorTemp: 6200,
        modifier: 'stripbox',
        modifierSize: '30x120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '6:1',
    mood: 'Epic and heroic',
    bestFor: ['superhero shoots', 'campaign posters', 'sports hero visuals'],
    tips: ['Slight haze and low camera angle amplify heroic form.'],
  },
  'corporate-talking-head': {
    id: 'corporate-talking-head',
    name: 'Corporate Talking Head',
    description: 'Reliable interview setup with balanced skin rendering.',
    category: 'commercial',
    lights: [
      {
        type: 'key',
        name: 'Interview Key',
        position: { x: -2, y: 2.3, z: 2 },
        rotation: { x: -28, y: 35, z: 0 },
        power: 68,
        colorTemp: 5600,
        modifier: 'softbox',
        modifierSize: '90x120cm',
        enabled: true,
      },
      {
        type: 'fill',
        name: 'Soft Fill',
        position: { x: 2, y: 2, z: 1.8 },
        rotation: { x: -20, y: -30, z: 0 },
        power: 42,
        colorTemp: 5600,
        modifier: 'umbrella',
        modifierSize: '120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '1.8:1',
    mood: 'Trustworthy and clear',
    bestFor: ['corporate videos', 'talking heads', 'education content'],
    tips: ['Keep catchlights symmetrical for natural eye contact.'],
  },
  'interview-2cam': {
    id: 'interview-2cam',
    name: 'Interview 2-Cam',
    description: 'Cross-safe interview setup for dual-camera angles.',
    category: 'commercial',
    lights: [
      {
        type: 'key',
        name: 'Main Key',
        position: { x: -2.2, y: 2.4, z: 1.9 },
        rotation: { x: -26, y: 40, z: 0 },
        power: 66,
        colorTemp: 5600,
        modifier: 'softbox',
        modifierSize: '90x120cm',
        enabled: true,
      },
      {
        type: 'background',
        name: 'Background Separation',
        position: { x: 0, y: 2.2, z: -2.8 },
        rotation: { x: -8, y: 180, z: 0 },
        power: 38,
        colorTemp: 5600,
        modifier: 'bare',
        enabled: true,
      },
    ],
    keyToFillRatio: '2:1',
    mood: 'Documentary and informative',
    bestFor: ['interviews', 'podcasts', 'panel recordings'],
    tips: ['Avoid heavy side spill to keep reverse angle consistent.'],
  },
  'broadcast-studio': {
    id: 'broadcast-studio',
    name: 'Broadcast Studio',
    description: 'Even, high-clarity setup for studio broadcast.',
    category: 'commercial',
    lights: [
      {
        type: 'key',
        name: 'Studio Key',
        position: { x: -1.7, y: 2.6, z: 2.1 },
        rotation: { x: -30, y: 30, z: 0 },
        power: 72,
        colorTemp: 5600,
        modifier: 'softbox',
        modifierSize: '120x120cm',
        enabled: true,
      },
      {
        type: 'fill',
        name: 'Studio Fill',
        position: { x: 1.7, y: 2.4, z: 2.1 },
        rotation: { x: -28, y: -30, z: 0 },
        power: 62,
        colorTemp: 5600,
        modifier: 'softbox',
        modifierSize: '120x120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '1.4:1',
    mood: 'Neutral and broadcast-ready',
    bestFor: ['live streams', 'news studio', 'broadcast'],
    tips: ['Prioritize flicker-free fixtures and consistent white balance.'],
  },
  'documentary-natural': {
    id: 'documentary-natural',
    name: 'Documentary Natural',
    description: 'Naturalistic interview light preserving location feel.',
    category: 'natural',
    lights: [
      {
        type: 'key',
        name: 'Window Emulation',
        position: { x: -2.6, y: 2.3, z: 1.8 },
        rotation: { x: -20, y: 45, z: 0 },
        power: 60,
        colorTemp: 5400,
        modifier: 'softbox',
        modifierSize: '120x180cm',
        enabled: true,
      },
      {
        type: 'fill',
        name: 'Subtle Fill',
        position: { x: 2, y: 1.8, z: 1.6 },
        rotation: { x: -15, y: -25, z: 0 },
        power: 24,
        colorTemp: 5400,
        modifier: 'reflector',
        modifierSize: '120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '2.5:1',
    mood: 'Authentic and grounded',
    bestFor: ['documentary interviews', 'social issue pieces', 'journalism'],
    tips: ['Match practicals to location white balance for realism.'],
  },
  'music-video-dramatic': {
    id: 'music-video-dramatic',
    name: 'Music Video Dramatic',
    description: 'Punchy high-contrast setup for performance visuals.',
    category: 'cinematic',
    lights: [
      {
        type: 'key',
        name: 'Performance Key',
        position: { x: -2.4, y: 2.4, z: 1 },
        rotation: { x: -28, y: 50, z: 0 },
        power: 78,
        colorTemp: 5600,
        modifier: 'gridded-softbox',
        modifierSize: '60x90cm',
        enabled: true,
      },
      {
        type: 'accent',
        name: 'Color Accent',
        position: { x: 2.4, y: 1.6, z: -0.8 },
        rotation: { x: -10, y: -70, z: 0 },
        power: 45,
        colorTemp: 9000,
        modifier: 'stripbox',
        modifierSize: '30x90cm',
        enabled: true,
      },
    ],
    keyToFillRatio: '4.5:1',
    mood: 'High energy and stylized',
    bestFor: ['music videos', 'performance sessions', 'artist promos'],
    tips: ['Use rhythm-synced practicals to reinforce music energy.'],
  },
  'youtube-creator': {
    id: 'youtube-creator',
    name: 'YouTube Creator',
    description: 'Friendly creator setup with high clarity and eye-catch lights.',
    category: 'commercial',
    lights: [
      {
        type: 'key',
        name: 'Creator Key',
        position: { x: -1.8, y: 2.4, z: 2 },
        rotation: { x: -30, y: 28, z: 0 },
        power: 68,
        colorTemp: 5600,
        modifier: 'softbox',
        modifierSize: '90x120cm',
        enabled: true,
      },
      {
        type: 'accent',
        name: 'RGB Background',
        position: { x: 1.8, y: 1.5, z: -2.6 },
        rotation: { x: -4, y: -165, z: 0 },
        power: 36,
        colorTemp: 8000,
        modifier: 'bare',
        enabled: true,
      },
    ],
    keyToFillRatio: '2:1',
    mood: 'Friendly and modern',
    bestFor: ['youtube', 'tutorials', 'streamers', 'social content'],
    tips: ['Keep background accents subtle to avoid skin pollution.'],
  },
  'green-screen-even': {
    id: 'green-screen-even',
    name: 'Green Screen Even',
    description: 'Even screen illumination with subject separation.',
    category: 'practical',
    lights: [
      {
        type: 'background',
        name: 'Screen Wash Left',
        position: { x: -2.5, y: 1.8, z: -2.5 },
        rotation: { x: 0, y: 150, z: 0 },
        power: 82,
        colorTemp: 5600,
        modifier: 'bare',
        enabled: true,
      },
      {
        type: 'background',
        name: 'Screen Wash Right',
        position: { x: 2.5, y: 1.8, z: -2.5 },
        rotation: { x: 0, y: -150, z: 0 },
        power: 82,
        colorTemp: 5600,
        modifier: 'bare',
        enabled: true,
      },
      {
        type: 'rim',
        name: 'Separation Rim',
        position: { x: 0, y: 2.8, z: -1.8 },
        rotation: { x: -50, y: 180, z: 0 },
        power: 44,
        colorTemp: 5600,
        modifier: 'stripbox',
        modifierSize: '30x120cm',
        enabled: true,
      },
    ],
    keyToFillRatio: 'Screen-first',
    mood: 'Technical and controlled',
    bestFor: ['green screen', 'vfx', 'virtual production'],
    tips: ['Keep subject at least 2m from screen to reduce spill.'],
  },
};

const TAG_SETUP_MAP: Record<string, string[]> = {
  photographer: ['classic-portrait', 'rembrandt', 'clamshell'],
  videographer: ['interview-2cam', 'corporate-talking-head', 'broadcast-studio'],
  barber: ['barber-shop', 'classic-portrait', 'rembrandt'],
  chef: ['chef-kitchen', 'documentary-natural', 'classic-portrait'],
  mechanic: ['mechanic-workshop', 'low-key', 'split-light'],
  'tattoo-artist': ['tattoo-artist', 'split-light', 'low-key'],
  youtuber: ['youtube-creator', 'corporate-talking-head', 'high-key'],
  streamer: ['broadcast-studio', 'youtube-creator', 'interview-2cam'],
  interview: ['interview-2cam', 'documentary-natural', 'corporate-talking-head'],
  portrait: ['classic-portrait', 'butterfly-beauty', 'rembrandt'],
  cinematic: ['film-noir', 'sci-fi-cool', 'action-hero'],
};

const GENRE_SETUP_MAP: Record<string, string[]> = {
  'film-noir': ['film-noir', 'split-light', 'low-key'],
  'sci-fi': ['sci-fi-cool', 'split-light', 'low-key'],
  western: ['western-golden', 'rembrandt', 'classic-portrait'],
  horror: ['horror-dramatic', 'split-light', 'low-key'],
  'cosmic-horror': ['cosmic-horror', 'horror-dramatic', 'low-key'],
  fantasy: ['fantasy-magical', 'rembrandt', 'classic-portrait'],
  action: ['action-hero', 'superhero-epic', 'low-key'],
  'period-drama': ['period-drama-elegant', 'rembrandt', 'classic-portrait'],
  'asian-cinema': ['asian-cinema-dramatic', 'split-light', 'rembrandt'],
  superhero: ['superhero-epic', 'action-hero', 'low-key'],
  documentary: ['documentary-natural', 'interview-2cam', 'corporate-talking-head'],
};

const HDRI_SETUP_MAP: Record<string, string[]> = {
  studio: ['classic-portrait', 'clamshell', 'high-key', 'broadcast-studio'],
  indoor: ['classic-portrait', 'rembrandt', 'chef-kitchen', 'barber-shop'],
  outdoor: ['western-golden', 'classic-portrait', 'documentary-natural'],
  sunset: ['western-golden', 'rembrandt', 'low-key'],
  night: ['film-noir', 'low-key', 'split-light', 'horror-dramatic'],
  overcast: ['classic-portrait', 'clamshell', 'high-key'],
  school: ['clamshell', 'high-key', 'classic-portrait'],
  warehouse: ['mechanic-workshop', 'low-key', 'split-light'],
};

const MOOD_SETUP_MAP: Record<string, string[]> = {
  gritty: ['low-key', 'split-light', 'mechanic-workshop'],
  elegant: ['butterfly-beauty', 'classic-portrait', 'clamshell'],
  professional: ['classic-portrait', 'clamshell', 'corporate-talking-head'],
  dramatic: ['low-key', 'split-light', 'film-noir'],
  warm: ['western-golden', 'barber-shop', 'chef-kitchen'],
  cool: ['sci-fi-cool', 'low-key', 'broadcast-studio'],
  mysterious: ['film-noir', 'cosmic-horror', 'low-key'],
  energetic: ['action-hero', 'music-video-dramatic', 'superhero-epic'],
};

function addScore(
  scoring: Map<string, { score: number; reasons: string[] }>,
  setupId: string,
  scoreDelta: number,
  reason: string,
): void {
  const setup = LIGHT_SETUPS[setupId];
  if (!setup) return;

  const existing = scoring.get(setupId);
  if (existing) {
    existing.score += scoreDelta;
    if (!existing.reasons.includes(reason)) {
      existing.reasons.push(reason);
    }
    return;
  }

  scoring.set(setupId, {
    score: scoreDelta,
    reasons: [reason],
  });
}

function normalizeLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Get lighting setup recommendations based on character and HDRI.
 */
export function getLightSetupRecommendations(
  character: CharacterContext,
  hdri?: HDRIContext,
): LightSetupRecommendation[] {
  const scoring = new Map<string, { score: number; reasons: string[] }>();

  for (const tag of character.tags || []) {
    const key = normalizeLookupKey(tag);
    const mapped = TAG_SETUP_MAP[key];
    if (!mapped) continue;

    mapped.forEach((setupId, index) => {
      addScore(scoring, setupId, 15 - index * 3, `Good fit for tag "${tag}"`);
    });
  }

  if (character.genre) {
    const genreKey = normalizeLookupKey(character.genre);
    const mapped = GENRE_SETUP_MAP[genreKey];
    if (mapped) {
      mapped.forEach((setupId, index) => {
        addScore(scoring, setupId, 12 - index * 2, `Matches genre "${character.genre}"`);
      });
    }
  }

  if (character.mood) {
    const moodKey = normalizeLookupKey(character.mood);
    const mapped = MOOD_SETUP_MAP[moodKey];
    if (mapped) {
      mapped.forEach((setupId, index) => {
        addScore(scoring, setupId, 8 - index * 2, `Supports mood "${character.mood}"`);
      });
    }
  }

  if (hdri?.category) {
    const hdriKey = normalizeLookupKey(hdri.category);
    const mapped = HDRI_SETUP_MAP[hdriKey];
    if (mapped) {
      mapped.forEach((setupId, index) => {
        addScore(scoring, setupId, 10 - index * 2, `Complements HDRI category "${hdri.category}"`);
      });
    }
  }

  if (scoring.size === 0) {
    ['classic-portrait', 'clamshell', 'rembrandt'].forEach((setupId, index) => {
      addScore(scoring, setupId, 6 - index, 'Versatile default setup');
    });
  }

  const recommendations: LightSetupRecommendation[] = [];
  for (const [setupId, data] of scoring.entries()) {
    const setup = LIGHT_SETUPS[setupId];
    if (!setup) continue;

    const normalizedScore = Math.max(0, Math.min(100, Math.round(data.score * 4)));
    recommendations.push({
      ...setup,
      matchScore: normalizedScore,
      reason: data.reasons[0] || 'General suitability',
    });
  }

  recommendations.sort((a, b) => b.matchScore - a.matchScore);
  const top = recommendations.slice(0, 6);

  log.debug(`Generated ${top.length} lighting recommendations for ${character.name}`, {
    character,
    hdri,
    topIds: top.map((setup) => setup.id),
  });

  return top;
}

/**
 * Get all available lighting setups.
 */
export function getAllLightSetups(): LightSetupRecommendation[] {
  return Object.values(LIGHT_SETUPS).map((setup) => ({
    ...setup,
    matchScore: 0,
    reason: '',
  }));
}

/**
 * Get a specific lighting setup by ID.
 */
export function getLightSetupById(id: string): LightSetupRecommendation | undefined {
  const setup = LIGHT_SETUPS[id];
  if (!setup) return undefined;

  return {
    ...setup,
    matchScore: 0,
    reason: '',
  };
}

export default {
  getLightSetupRecommendations,
  getAllLightSetups,
  getLightSetupById,
};
