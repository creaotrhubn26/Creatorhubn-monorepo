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
  power: number; // 0-100%
  colorTemp: number; // Kelvin
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

// Predefined lighting setups
const LIGHT_SETUPS: Record<string, Omit<LightSetupRecommendation, 'matchScore' | , 'reason, '>> = {
  // Portrait Setups
  'classic-portrait': {
    id: 'classic-portrait',
    name: 'Classic Portrait',
    description: 'Traditional 45-degree key light with soft fill',
    category: 'portrait',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -2, y: 2.5, z: 2 }, rotation: { x: -30, y: 45, z: 0 }, power: 75, colorTemp: 5600, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'fill', name: 'Fill Light', position: { x: 2, y: 2, z: 1.5 }, rotation: { x: -20, y: -30, z: 0 }, power: 35, colorTemp: 5600, modifier: 'umbrella', modifierSize: '120cm', enabled: true },
      { type: 'hair', name: 'Hair Light', position: { x: 0, y: 3, z: -1.5 }, rotation: { x: -60, y: 0, z: 0 }, power: 50, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x120cm', enabled: true },
    ],
    keyToFillRatio: '2:1',
    mood: 'Professional, flattering',
    bestFor: ['headshots','business portraits','yearbook photos'],
    tips: ['Position key light at eye level or slightly above','Use reflector as fill for more natural look','Feather key light for softer falloff'],
  }, 'butterfly-beauty': {
    id: 'butterfly-beauty',
    name: 'Butterfly / Paramount',
    description: 'Key light directly above camera for glamorous beauty lighting',
    category: 'portrait',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: 0, y: 3, z: 2 }, rotation: { x: -45, y: 0, z: 0 }, power: 80, colorTemp: 5600, modifier: 'beauty-dish', modifierSize: '56cm', enabled: true },
      { type: 'fill', name: 'Fill Reflector', position: { x: 0, y: 0.5, z: 1 }, rotation: { x: 45, y: 0, z: 0 }, power: 0, colorTemp: 5600, modifier: 'reflector', modifierSize: '100cm', enabled: true },
      { type: 'hair', name: 'Hair Light', position: { x: 0, y: 3.5, z: -2 }, rotation: { x: -70, y: 0, z: 0 }, power: 45, colorTemp: 5600, modifier: 'gridded-softbox', modifierSize: '60x60cm', enabled: true },
    ],
    keyToFillRatio: '3:1',
    mood: 'Glamorous, beauty',
    bestFor: ['beauty shots','makeup artists','fashion portraits'],
    tips: ['Creates butterfly shadow under nose','Best for subjects with defined cheekbones','Add clamshell fill from below for extra glow'],
  }, 'rembrandt': {
    id: 'rembrandt',
    name: 'Rembrandt',
    description: 'Classic artistic lighting with triangle highlight on cheek',
    category: 'portrait',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -2.5, y: 2.5, z: 1.5 }, rotation: { x: -35, y: 50, z: 0 }, power: 70, colorTemp: 5200, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'fill', name: 'Fill Light', position: { x: 2, y: 1.8, z: 2 }, rotation: { x: -15, y: -25, z: 0 }, power: 25, colorTemp: 5200, modifier: 'umbrella', modifierSize: '100cm', enabled: true },
    ],
    keyToFillRatio: '3:1',
    mood: 'Artistic, dramatic',
    bestFor: ['character portraits','artistic headshots','editorial'],
    tips: ['Look for triangle of light on shadow side cheek','Works best with subjects facing slightly away from key','More dramatic with higher ratio'],
  }, 'split-light': {
    id: 'split-light',
    name: 'Split Lighting',
    description: 'Half the face in light, half in shadow for dramatic effect',
    category: 'dramatic',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -3, y: 2, z: 0 }, rotation: { x: -20, y: 90, z: 0 }, power: 80, colorTemp: 5600, modifier: 'softbox', modifierSize: '60x90cm', enabled: true },
      { type: 'rim', name: 'Rim Light', position: { x: 2.5, y: 2.5, z: -1 }, rotation: { x: -30, y: -60, z: 0 }, power: 40, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x90cm', enabled: true },
    ],
    keyToFillRatio: '8:1',
    mood: 'Mysterious, dramatic',
    bestFor: ['film noir','horror','dramatic portraits','musicians'],
    tips: ['Position light at exact 90 degrees to subject','Works well for masculine subjects','Add subtle fill to reveal shadow detail if needed'],
  },
  
  // Commercial/Professional Setups
  'clamshell': {
    id: 'clamshell',
    name: 'Clamshell',
    description: 'Two lights surrounding the face for even, flattering light',
    category: 'commercial',
    lights: [
      { type: 'key', name: 'Top Key', position: { x: 0, y: 2.8, z: 2 }, rotation: { x: -40, y: 0, z: 0 }, power: 75, colorTemp: 5600, modifier: 'beauty-dish', modifierSize: '56cm', enabled: true },
      { type: 'fill', name: 'Bottom Fill', position: { x: 0, y: 0.8, z: 1.5 }, rotation: { x: 30, y: 0, z: 0 }, power: 50, colorTemp: 5600, modifier: 'softbox', modifierSize: '60x90cm', enabled: true },
      { type: 'background', name: 'Background', position: { x: 0, y: 1.5, z: -3 }, rotation: { x: 0, y: 180, z: 0 }, power: 60, colorTemp: 5600, modifier: 'bare', enabled: true },
    ],
    keyToFillRatio: '1.5:1',
    mood: 'Clean, professional',
    bestFor: ['headshots','corporate','yearbook','passport'],
    tips: ['Minimizes wrinkles and blemishes','Very flattering for all face shapes','Keep lights close for softer quality'],
  }, 'high-key': {
    id: 'high-key',
    name: 'High Key',
    description: 'Bright, even lighting with minimal shadows',
    category: 'commercial',
    lights: [
      { type: 'key', name: 'Main Key', position: { x: -1.5, y: 2.5, z: 2 }, rotation: { x: -30, y: 30, z: 0 }, power: 70, colorTemp: 5600, modifier: 'octabox', modifierSize: '150cm', enabled: true },
      { type: 'fill', name: 'Fill Light', position: { x: 1.5, y: 2.3, z: 2 }, rotation: { x: -25, y: -30, z: 0 }, power: 60, colorTemp: 5600, modifier: 'octabox', modifierSize: '120cm', enabled: true },
      { type: 'background', name: 'Background Left', position: { x: -2, y: 1.5, z: -2.5 }, rotation: { x: 0, y: 150, z: 0 }, power: 100, colorTemp: 5600, modifier: 'bare', enabled: true },
      { type: 'background', name: 'Background Right', position: { x: 2, y: 1.5, z: -2.5 }, rotation: { x: 0, y: -150, z: 0 }, power: 100, colorTemp: 5600, modifier: 'bare', enabled: true },
    ],
    keyToFillRatio: '1.2:1',
    mood: 'Bright, clean, cheerful',
    bestFor: ['product photography','commercial','cosmetics','food'],
    tips: ['Overexpose background by 1-2 stops','Use large soft sources close to subject','Great for showing detail and texture'],
  }, 'low-key': {
    id: 'low-key',
    name: 'Low Key',
    description: 'Dark, moody lighting with dramatic shadows',
    category: 'dramatic',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -2, y: 2.2, z: 1 }, rotation: { x: -25, y: 55, z: 0 }, power: 65, colorTemp: 5200, modifier: 'gridded-softbox', modifierSize: '60x90cm', enabled: true },
      { type: 'rim', name: 'Rim Light', position: { x: 2, y: 2.5, z: -1.5 }, rotation: { x: -35, y: -50, z: 0 }, power: 45, colorTemp: 5200, modifier: 'stripbox', modifierSize: '30x120cm', enabled: true },
    ],
    keyToFillRatio: 'No fill',
    mood: 'Mysterious, dramatic, intense',
    bestFor: ['film noir','dramatic portraits','musicians','athletes'],
    tips: ['Use black v-flats to absorb spill','Grid your lights to control spread','Dark background essential'],
  },

  // Profession-Specific Setups
  'barber-shop': {
    id: 'barber-shop',
    name: 'Barbershop Portrait',
    description: 'Flattering light mimicking classic barbershop mirrors',
    category: 'commercial',
    lights: [
      { type: 'key', name: 'Main Light', position: { x: 0, y: 2.2, z: 2.5 }, rotation: { x: -25, y: 0, z: 0 }, power: 70, colorTemp: 4500, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'fill', name: 'Fill Left', position: { x: -2, y: 1.8, z: 1.5 }, rotation: { x: -15, y: 25, z: 0 }, power: 45, colorTemp: 4500, modifier: 'umbrella', modifierSize: '100cm', enabled: true },
      { type: 'fill', name: 'Fill Right', position: { x: 2, y: 1.8, z: 1.5 }, rotation: { x: -15, y: -25, z: 0 }, power: 45, colorTemp: 4500, modifier: 'umbrella', modifierSize: '100cm', enabled: true },
      { type: 'accent', name: 'Hair Detail', position: { x: 0, y: 3, z: -1 }, rotation: { x: -60, y: 0, z: 0 }, power: 35, colorTemp: 5000, modifier: 'stripbox', modifierSize: '30x60cm', enabled: true },
    ],
    keyToFillRatio: '1.5:1',
    mood: 'Warm, inviting, professional',
    bestFor: ['barbers','stylists','salon photos','grooming'],
    tips: ['Slightly warm color temp mimics incandescent','Even fill shows hair detail on both sides','Hair light reveals texture and cut quality'],
  }, 'chef-kitchen': {
    id: 'chef-kitchen',
    name: 'Chef / Kitchen',
    description: 'Dynamic lighting for culinary professionals',
    category: 'commercial',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -2.5, y: 2.5, z: 1.5 }, rotation: { x: -30, y: 45, z: 0 }, power: 75, colorTemp: 5000, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'fill', name: 'Fill/Bounce', position: { x: 2, y: 1.5, z: 2 }, rotation: { x: -10, y: -30, z: 0 }, power: 30, colorTemp: 5000, modifier: 'reflector', modifierSize: '120cm', enabled: true },
      { type: 'accent', name: 'Counter Top', position: { x: 0, y: 3.5, z: 0 }, rotation: { x: -90, y: 0, z: 0 }, power: 50, colorTemp: 4800, modifier: 'softbox', modifierSize: '60x90cm', enabled: true },
      { type: 'rim', name: 'Steam/Separation', position: { x: 1, y: 2, z: -2 }, rotation: { x: -20, y: -45, z: 0 }, power: 40, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x90cm', enabled: true },
    ],
    keyToFillRatio: '2.5:1',
    mood: 'Dynamic, professional, appetizing',
    bestFor: ['chefs','cooks','culinary','food photography'],
    tips: ['Top light mimics kitchen pendant lights','Slightly warm for appetizing look','Rim light catches steam and smoke beautifully'],
  }, 'mechanic-workshop': {
    id: 'mechanic-workshop',
    name: 'Workshop / Garage',
    description: 'Industrial lighting for trades and mechanical work',
    category: 'dramatic',
    lights: [
      { type: 'key', name: 'Overhead Industrial', position: { x: 0, y: 4, z: 1 }, rotation: { x: -70, y: 0, z: 0 }, power: 80, colorTemp: 4000, modifier: 'industrial-reflector', modifierSize: '45cm', enabled: true },
      { type: 'fill', name: 'Work Light', position: { x: -2, y: 1.2, z: 2 }, rotation: { x: -10, y: 30, z: 0 }, power: 40, colorTemp: 4500, modifier: 'bare', enabled: true },
      { type: 'rim', name: 'Back Edge', position: { x: 2, y: 2, z: -2 }, rotation: { x: -25, y: -60, z: 0 }, power: 55, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x120cm', enabled: true },
    ],
    keyToFillRatio: '3:1',
    mood: 'Industrial, authentic, gritty',
    bestFor: ['mechanics','craftspeople','welders','industrial'],
    tips: ['Tungsten color temp adds authenticity','Let shadows fall naturally','Rim light separates from dark backgrounds'],
  }, 'tattoo-artist': {
    id: 'tattoo-artist',
    name: 'Tattoo Studio',
    description: 'Edgy lighting for tattoo artists and creative professionals',
    category: 'cinematic',
    lights: [
      { type: 'key', name: 'Main Key', position: { x: -2, y: 2.2, z: 1.5 }, rotation: { x: -25, y: 40, z: 0 }, power: 65, colorTemp: 5600, modifier: 'softbox', modifierSize: '60x90cm', enabled: true },
      { type: 'accent', name: 'Neon Accent', position: { x: 2.5, y: 1.5, z: 0 }, rotation: { x: 0, y: -90, z: 0 }, power: 30, colorTemp: 6500, modifier: 'bare', enabled: true },
      { type: 'rim', name: 'Edge Light', position: { x: 1.5, y: 2.5, z: -2 }, rotation: { x: -35, y: -45, z: 0 }, power: 50, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x90cm', enabled: true },
    ],
    keyToFillRatio: '4:1',
    mood: 'Edgy, urban, creative',
    bestFor: ['tattoo artists','piercers','alternative portraits'],
    tips: ['Colored accent adds urban vibe','High contrast suits edgy aesthetic','Can gel accent light for neon effect'],
  },

  // Cinematic Setups
  'film-noir': {
    id: 'film-noir',
    name: 'Film Noir',
    description: 'Classic black and white cinema lighting',
    category: 'cinematic',
    lights: [
      { type: 'key', name: 'Hard Key', position: { x: -3, y: 3, z: 1 }, rotation: { x: -40, y: 60, z: 0 }, power: 85, colorTemp: 5600, modifier: 'fresnel', modifierSize: '20cm', enabled: true },
      { type: 'accent', name: 'Venetian Blind', position: { x: 2, y: 2.5, z: 2 }, rotation: { x: -30, y: -45, z: 0 }, power: 40, colorTemp: 5600, modifier: 'gobo-blinds', enabled: true },
    ],
    keyToFillRatio: '8:1+',
    mood: 'Mysterious, dramatic, classic',
    bestFor: ['film noir','detective','mystery','1940s'],
    tips: ['Hard light source creates sharp shadows','Window blind gobo adds classic noir look','Minimal fill for maximum drama'],
  }, 'sci-fi-cool': {
    id: 'sci-fi-cool',
    name: 'Sci-Fi / Futuristic',
    description: 'Cool, technological lighting for futuristic themes',
    category: 'cinematic',
    lights: [
      { type: 'key', name: 'Cool Key', position: { x: -1.5, y: 2.5, z: 2 }, rotation: { x: -30, y: 25, z: 0 }, power: 70, colorTemp: 7000, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'accent', name: 'Blue Accent', position: { x: 2.5, y: 1.5, z: -1 }, rotation: { x: -10, y: -70, z: 0 }, power: 45, colorTemp: 10000, modifier: 'stripbox', modifierSize: '30x120cm', enabled: true },
      { type: 'rim', name: 'Tech Rim', position: { x: 0, y: 3, z: -2 }, rotation: { x: -50, y: 0, z: 0 }, power: 40, colorTemp: 8000, modifier: 'stripbox', modifierSize: '30x90cm', enabled: true },
    ],
    keyToFillRatio: '3:1',
    mood: 'Futuristic, technological, cool',
    bestFor: ['sci-fi','tech','futuristic','corporate tech'],
    tips: ['Cool color temperature suggests technology','Blue accent lights add sci-fi atmosphere','Can add practical LED strips in scene'],
  }, 'western-golden': {
    id: 'western-golden',
    name: 'Western / Golden Hour',
    description: 'Warm sunset lighting for western and outdoor themes',
    category: 'natural',
    lights: [
      { type: 'key', name: 'Golden Key', position: { x: -3, y: 1.5, z: 2 }, rotation: { x: -10, y: 50, z: 0 }, power: 75, colorTemp: 3200, modifier: 'bare', enabled: true },
      { type: 'fill', name: 'Bounce Fill', position: { x: 2, y: 1, z: 1 }, rotation: { x: 0, y: -40, z: 0 }, power: 20, colorTemp: 4500, modifier: 'reflector-gold', modifierSize: '100cm', enabled: true },
      { type: 'rim', name: 'Sun Rim', position: { x: 0, y: 2, z: -3 }, rotation: { x: -20, y: 180, z: 0 }, power: 90, colorTemp: 2800, modifier: 'bare', enabled: true },
    ],
    keyToFillRatio: '4:1',
    mood: 'Warm, nostalgic, cinematic',
    bestFor: ['western','outdoor','golden hour','rustic'],
    tips: ['Low key angle mimics setting sun','Gold reflector warms shadows','Strong backlight creates sun flare'],
  }, 'horror-dramatic': {
    id: 'horror-dramatic',
    name: 'Horror / Dramatic',
    description: 'Unsettling underlighting for horror themes',
    category: 'cinematic',
    lights: [
      { type: 'key', name: 'Underlight', position: { x: 0, y: 0.3, z: 1.5 }, rotation: { x: 60, y: 0, z: 0 }, power: 60, colorTemp: 5600, modifier: 'softbox', modifierSize: '60x60cm', enabled: true },
      { type: 'accent', name: 'Side Slash', position: { x: -3, y: 2, z: 0 }, rotation: { x: -15, y: 90, z: 0 }, power: 40, colorTemp: 5600, modifier: 'snoot', enabled: true },
    ],
    keyToFillRatio: 'Inverted',
    mood: 'Unsettling, horror, dramatic',
    bestFor: ['horror','villain','dramatic','halloween'],
    tips: ['Underlighting creates unnatural shadows','Inverts normal facial features','Add subtle top fill if too extreme'],
  },
  
  // Additional Cinematic Setups for Film Characters
  'cosmic-horror': {
    id: 'cosmic-horror',
    name: 'Cosmic Horror / Eldritch',
    description: 'Otherworldly lighting with unnatural colors',
    category: 'cinematic',
    lights: [
      { type: 'key', name: 'Eerie Key', position: { x: -2, y: 2, z: 1 }, rotation: { x: -25, y: 40, z: 0 }, power: 50, colorTemp: 4000, modifier: 'softbox', modifierSize: '60x60cm', enabled: true },
      { type: 'accent', name: 'Void Glow', position: { x: 2, y: 1, z: -1 }, rotation: { x: -10, y: -60, z: 0 }, power: 35, colorTemp: 10000, modifier: 'bare', enabled: true },
      { type: 'rim', name: 'Tentacle Light', position: { x: 0, y: 0.5, z: -2 }, rotation: { x: 30, y: 180, z: 0 }, power: 25, colorTemp: 3000, modifier: 'stripbox', modifierSize: '30x60cm', enabled: true },
    ],
    keyToFillRatio: '6:1',
    mood: 'Otherworldly, unsettling, mysterious',
    bestFor: ['cosmic-horror','lovecraft','eldritch','supernatural'],
    tips: ['Mix warm and cool creates unease','Uplighting from below adds dread','Low overall brightness for mystery'],
  }, 'fantasy-magical': {
    id: 'fantasy-magical',
    name: 'Fantasy / Magical',
    description: 'Warm, ethereal lighting with magical quality',
    category: 'cinematic',
    lights: [
      { type: 'key', name: 'Main Light', position: { x: -2, y: 2.5, z: 2 }, rotation: { x: -35, y: 40, z: 0 }, power: 70, colorTemp: 4500, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'fill', name: 'Ambient Fill', position: { x: 2, y: 2, z: 1 }, rotation: { x: -20, y: -35, z: 0 }, power: 40, colorTemp: 5000, modifier: 'umbrella', modifierSize: '120cm', enabled: true },
      { type: 'accent', name: 'Magic Glow', position: { x: 0, y: 1, z: -1 }, rotation: { x: 0, y: 180, z: 0 }, power: 30, colorTemp: 6500, modifier: 'bare', enabled: true },
      { type: 'hair', name: 'Halo Light', position: { x: 0, y: 3.5, z: -1 }, rotation: { x: -70, y: 0, z: 0 }, power: 45, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x90cm', enabled: true },
    ],
    keyToFillRatio: '2:1',
    mood: 'Magical, ethereal, warm',
    bestFor: ['fantasy','medieval','fairy tale','magical'],
    tips: ['Soft lighting creates dreamlike quality','Warm tones feel inviting','Halo light adds angelic quality'],
  }, 'action-hero': {
    id: 'action-hero',
    name: 'Action Hero',
    description: 'Dynamic, high-contrast lighting for action scenes',
    category: 'cinematic',
    lights: [
      { type: 'key', name: 'Hard Key', position: { x: -2.5, y: 2.5, z: 1 }, rotation: { x: -30, y: 50, z: 0 }, power: 85, colorTemp: 5600, modifier: 'gridded-softbox', modifierSize: '60x90cm', enabled: true },
      { type: 'rim', name: 'Power Rim', position: { x: 2, y: 2.5, z: -1.5 }, rotation: { x: -35, y: -55, z: 0 }, power: 70, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x120cm', enabled: true },
      { type: 'accent', name: 'Kick Light', position: { x: 2.5, y: 1, z: 1 }, rotation: { x: -10, y: -70, z: 0 }, power: 40, colorTemp: 5600, modifier: 'snoot', enabled: true },
    ],
    keyToFillRatio: '5:1',
    mood: 'Powerful, dynamic, heroic',
    bestFor: ['action','superhero','athlete','dynamic'],
    tips: ['High contrast emphasizes muscle definition','Strong rim light creates heroic silhouette','No fill for dramatic shadows'],
  }, 'period-drama-elegant': {
    id: 'period-drama-elegant',
    name: 'Period Drama / Elegant',
    description: 'Soft, painterly lighting inspired by classic art',
    category: 'cinematic',
    lights: [
      { type: 'key', name: 'Window Light', position: { x: -3, y: 2, z: 1 }, rotation: { x: -20, y: 55, z: 0 }, power: 65, colorTemp: 5200, modifier: 'softbox', modifierSize: '120x180cm', enabled: true },
      { type: 'fill', name: 'Bounce Fill', position: { x: 2, y: 1.5, z: 2 }, rotation: { x: -10, y: -30, z: 0 }, power: 25, colorTemp: 5000, modifier: 'reflector', modifierSize: '120cm', enabled: true },
      { type: 'hair', name: 'Accent Light', position: { x: 0.5, y: 3, z: -1.5 }, rotation: { x: -60, y: 0, z: 0 }, power: 35, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x60cm', enabled: true },
    ],
    keyToFillRatio: '2.5:1',
    mood: 'Elegant, refined, classical',
    bestFor: ['period-drama','victorian','regency','classical'],
    tips: ['Large soft source mimics window light','Subtle ratios create painterly look','Slightly warm for candlelit feel'],
  }, 'asian-cinema-dramatic': {
    id: 'asian-cinema-dramatic',
    name: 'Asian Cinema / Martial Arts',
    description: 'High contrast lighting for martial arts and Asian cinema',
    category: 'cinematic',
    lights: [
      { type: 'key', name: 'Main Key', position: { x: -2, y: 2.2, z: 1.5 }, rotation: { x: -25, y: 45, z: 0 }, power: 75, colorTemp: 5600, modifier: 'softbox', modifierSize: '60x90cm', enabled: true },
      { type: 'rim', name: 'Silhouette Rim', position: { x: 0, y: 2.5, z: -2 }, rotation: { x: -40, y: 180, z: 0 }, power: 65, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x120cm', enabled: true },
      { type: 'accent', name: 'Red Accent', position: { x: 2.5, y: 1.5, z: 0 }, rotation: { x: 0, y: -80, z: 0 }, power: 30, colorTemp: 3200, modifier: 'bare', enabled: true },
    ],
    keyToFillRatio: '4:1',
    mood: 'Dramatic, dynamic, powerful',
    bestFor: ['asian-cinema','martial-arts','samurai','wuxia'],
    tips: ['Strong backlight for silhouette shots','Red accent adds cultural warmth','High contrast for dramatic effect'],
  }, 'superhero-epic': {
    id: 'superhero-epic',
    name: 'Superhero / Epic',
    description: 'Dramatic uplighting with heroic rim lights',
    category: 'cinematic',
    lights: [
      { type: 'key', name: 'Hero Key', position: { x: 0, y: 0.5, z: 2 }, rotation: { x: 45, y: 0, z: 0 }, power: 60, colorTemp: 5600, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'rim', name: 'Cape Rim Left', position: { x: -2.5, y: 2.5, z: -1 }, rotation: { x: -35, y: 60, z: 0 }, power: 70, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x120cm', enabled: true },
      { type: 'rim', name: 'Cape Rim Right', position: { x: 2.5, y: 2.5, z: -1 }, rotation: { x: -35, y: -60, z: 0 }, power: 70, colorTemp: 5600, modifier: 'stripbox', modifierSize: '30x120cm', enabled: true },
      { type: 'accent', name: 'City Glow', position: { x: 0, y: 1, z: -3 }, rotation: { x: 0, y: 180, z: 0 }, power: 30, colorTemp: 4000, modifier: 'bare', enabled: true },
    ],
    keyToFillRatio: '3:1',
    mood: 'Heroic, epic, powerful',
    bestFor: ['superhero','hero','epic','powerful'],
    tips: ['Uplighting creates imposing presence','Double rim for cape silhouette','City glow suggests urban environment'],
  },

  // ============================================================================
  // VIDEOGRAPHER / CONTINUOUS LIGHTING SETUPS
  // ============================================================================
  
  'interview-2cam': {
    id: 'interview-2cam',
    name: 'Interview (2-Camera)',
    description: 'Professional interview setup with continuous lights',
    category: 'video',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -2, y: 2.2, z: 1.5 }, rotation: { x: -25, y: 40, z: 0 }, power: 70, colorTemp: 5600, modifier: 'led-panel', modifierSize: '1x1', enabled: true },
      { type: 'fill', name: 'Fill Light', position: { x: 2, y: 2, z: 1 }, rotation: { x: -20, y: -35, z: 0 }, power: 40, colorTemp: 5600, modifier: 'led-panel', modifierSize: '1x1', enabled: true },
      { type: 'hair', name: 'Hair Light', position: { x: 0.5, y: 2.8, z: -1 }, rotation: { x: -50, y: 0, z: 0 }, power: 45, colorTemp: 5600, modifier: 'led-panel', modifierSize: '1x2', enabled: true },
      { type: 'background', name: 'Background Light', position: { x: 0, y: 1.5, z: -2.5 }, rotation: { x: 0, y: 180, z: 0 }, power: 30, colorTemp: 5600, modifier: 'led-panel', modifierSize: '1x1', enabled: true },
    ],
    keyToFillRatio: '2:1',
    mood: 'Professional, clean, corporate',
    bestFor: ['interview','documentary','corporate','talking head'],
    tips: ['Use continuous LED panels for video','Match color temperature to ambient','Add slight separation from background'],
  }, 'documentary-natural': {
    id: 'documentary-natural',
    name: 'Documentary Natural',
    description: 'Minimal lighting that complements natural sources',
    category: 'video',
    lights: [
      { type: 'fill', name: 'Bounce Fill', position: { x: 2, y: 1.5, z: 1 }, rotation: { x: -10, y: -40, z: 0 }, power: 25, colorTemp: 5200, modifier: 'led-panel', modifierSize: '1x1', enabled: true },
      { type: 'eye', name: 'Eye Light', position: { x: 0, y: 1.8, z: 2 }, rotation: { x: -15, y: 0, z: 0 }, power: 15, colorTemp: 5600, modifier: 'led-panel', modifierSize: '6in', enabled: true },
    ],
    keyToFillRatio: 'Natural',
    mood: 'Authentic, natural, observational',
    bestFor: ['documentary','reality','observational'],
    tips: ['Use available light as key','Add subtle fill only','Small eye light for catchlight'],
  }, 'broadcast-studio': {
    id: 'broadcast-studio',
    name: 'Broadcast Studio',
    description: 'Even, professional lighting for news/broadcast',
    category: 'video',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -1.5, y: 2.5, z: 2 }, rotation: { x: -30, y: 25, z: 0 }, power: 75, colorTemp: 5600, modifier: 'led-panel', modifierSize: '2x2', enabled: true },
      { type: 'fill', name: 'Fill Light', position: { x: 1.5, y: 2.5, z: 2 }, rotation: { x: -30, y: -25, z: 0 }, power: 60, colorTemp: 5600, modifier: 'led-panel', modifierSize: '2x2', enabled: true },
      { type: 'back', name: 'Back Light', position: { x: 0, y: 3, z: -1.5 }, rotation: { x: -60, y: 0, z: 0 }, power: 50, colorTemp: 5600, modifier: 'led-panel', modifierSize: '1x2', enabled: true },
      { type: 'background', name: 'Cyc Light', position: { x: 0, y: 0.5, z: -3 }, rotation: { x: 60, y: 180, z: 0 }, power: 40, colorTemp: 5600, modifier: 'led-strip', enabled: true },
    ],
    keyToFillRatio: '1.5:1',
    mood: 'Professional, even, broadcast-ready',
    bestFor: ['broadcast','news','live streaming','webcast'],
    tips: ['Very even lighting for HD/4K','Minimal shadows for clean look','Match all color temps exactly'],
  }, 'youtube-creator': {
    id: 'youtube-creator',
    name: 'YouTube / Content Creator',
    description: 'Flattering lighting for talking head content',
    category: 'video',
    lights: [
      { type: 'key', name: 'Ring Light', position: { x: 0, y: 2, z: 2 }, rotation: { x: -20, y: 0, z: 0 }, power: 70, colorTemp: 5600, modifier: 'ring-light', modifierSize: '18in', enabled: true },
      { type: 'hair', name: 'Hair/Edge', position: { x: 1.5, y: 2.5, z: -1 }, rotation: { x: -45, y: -45, z: 0 }, power: 40, colorTemp: 5600, modifier: 'led-panel', modifierSize: '1x1', enabled: true },
    ],
    keyToFillRatio: '1.5:1',
    mood: 'Flattering, engaging, energetic',
    bestFor: ['youtube','tiktok','instagram','content creator','vlogger'],
    tips: ['Ring light for even face lighting','Camera at or slightly above eye level','Add hair light for depth'],
  }, 'music-video-dramatic': {
    id: 'music-video-dramatic',
    name: 'Music Video Dramatic',
    description: 'High contrast with colored accent lights',
    category: 'video',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -2.5, y: 2, z: 1 }, rotation: { x: -25, y: 50, z: 0 }, power: 80, colorTemp: 5600, modifier: 'fresnel', modifierSize: '10in', enabled: true },
      { type: 'accent', name: 'Color Accent 1', position: { x: 2.5, y: 1.5, z: -1 }, rotation: { x: -10, y: -60, z: 0 }, power: 50, colorTemp: 3200, modifier: 'tube-light', enabled: true },
      { type: 'accent', name: 'Color Accent 2', position: { x: -2, y: 1, z: -1.5 }, rotation: { x: 0, y: 70, z: 0 }, power: 50, colorTemp: 10000, modifier: 'tube-light', enabled: true },
      { type: 'rim', name: 'Strong Rim', position: { x: 0, y: 2.5, z: -2 }, rotation: { x: -40, y: 180, z: 0 }, power: 70, colorTemp: 5600, modifier: 'stripbox', modifierSize: '1x4', enabled: true },
    ],
    keyToFillRatio: '6:1',
    mood: 'Dramatic, stylized, colorful',
    bestFor: ['music video','performance','artist','concert'],
    tips: ['Use RGB tubes for color accents','Hard key for dramatic shadows','No fill for high contrast'],
  }, 'green-screen-even': {
    id: 'green-screen-even',
    name: 'Green Screen (Even)',
    description: 'Flat, even lighting for clean chroma key',
    category: 'video',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -2, y: 2.2, z: 2 }, rotation: { x: -25, y: 35, z: 0 }, power: 70, colorTemp: 5600, modifier: 'softbox', modifierSize: '3x4', enabled: true },
      { type: 'fill', name: 'Fill Light', position: { x: 2, y: 2.2, z: 2 }, rotation: { x: -25, y: -35, z: 0 }, power: 55, colorTemp: 5600, modifier: 'softbox', modifierSize: '3x4', enabled: true },
      { type: 'background', name: 'Screen Left', position: { x: -2, y: 1.5, z: -2 }, rotation: { x: 0, y: 45, z: 0 }, power: 60, colorTemp: 5600, modifier: 'softbox', modifierSize: '2x3', enabled: true },
      { type: 'background', name: 'Screen Right', position: { x: 2, y: 1.5, z: -2 }, rotation: { x: 0, y: -45, z: 0 }, power: 60, colorTemp: 5600, modifier: 'softbox', modifierSize: '2x3', enabled: true },
    ],
    keyToFillRatio: '1.3:1',
    mood: 'Clean, technical, VFX-ready',
    bestFor: ['green screen','vfx','compositing','chroma key'],
    tips: ['Light screen and subject separately','Keep subject 6-10ft from screen','Avoid green spill on subject'],
  }, 'corporate-talking-head': {
    id: 'corporate-talking-head',
    name: 'Corporate Talking Head',
    description: 'Clean, professional single-person setup',
    category: 'video',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -1.5, y: 2.2, z: 1.5 }, rotation: { x: -25, y: 30, z: 0 }, power: 70, colorTemp: 5600, modifier: 'softbox', modifierSize: '2x3', enabled: true },
      { type: 'fill', name: 'Fill Panel', position: { x: 1.5, y: 2, z: 1 }, rotation: { x: -20, y: -30, z: 0 }, power: 40, colorTemp: 5600, modifier: 'led-panel', modifierSize: '1x1', enabled: true },
      { type: 'hair', name: 'Edge Light', position: { x: 1, y: 2.5, z: -1 }, rotation: { x: -45, y: -45, z: 0 }, power: 35, colorTemp: 5600, modifier: 'stripbox', modifierSize: '1x3', enabled: true },
    ],
    keyToFillRatio: '2:1',
    mood: 'Professional, approachable, corporate',
    bestFor: ['corporate','training','testimonial','internal comms'],
    tips: ['Soft key light flatters most faces','Slight edge light adds dimension','Match brand guidelines if applicable'],
  },
};

// ============================================================================
// SCHOOL PHOTOGRAPHY LIGHT SETUPS
// ============================================================================
  'school-portrait-standard': {
    id: 'school-portrait-standard',
    name: 'School Portrait (Standard)',
    description: 'Classic individual school portrait lighting - fast, consistent results',
    category: 'portrait',
    lights: [
      { type: 'key', name: 'Main Softbox', position: { x: 1.5, y: 2.2, z: 2 }, rotation: { x: -25, y: -35, z: 0 }, power: 70, colorTemp: 5500, modifier: 'softbox', modifierSize: '80x120cm', enabled: true },
      { type: 'fill', name: 'Fill Softbox', position: { x: -1.5, y: 2, z: 2 }, rotation: { x: -20, y: 30, z: 0 }, power: 40, colorTemp: 5500, modifier: 'softbox', modifierSize: '60x90cm', enabled: true },
      { type: 'hair', name: 'Hair Light', position: { x: 0, y: 2.5, z: -1 }, rotation: { x: -60, y: 0, z: 0 }, power: 35, colorTemp: 5500, modifier: 'stripbox', modifierSize: '30x90cm', enabled: true },
    ],
    keyToFillRatio: '2:1',
    mood: 'Clean, consistent, professional',
    bestFor: ['school portraits','yearbook','ID photos','volume photography'],
    tips: ['Position stool consistently for each student','Mark floor positions with tape','Use consistent camera settings: f/5.6, ISO 100'],
  }, 'school-portrait-premium': {
    id: 'school-portrait-premium',
    name: 'School Portrait (Premium)',
    description: 'Higher-end school portrait with more dimension and depth',
    category: 'portrait',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -2, y: 2.5, z: 2 }, rotation: { x: -30, y: 45, z: 0 }, power: 75, colorTemp: 5500, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'fill', name: 'Fill Light', position: { x: 2, y: 2, z: 1.5 }, rotation: { x: -20, y: -30, z: 0 }, power: 30, colorTemp: 5500, modifier: 'umbrella', modifierSize: '120cm', enabled: true },
      { type: 'hair', name: 'Hair Light', position: { x: 0, y: 3, z: -1.5 }, rotation: { x: -65, y: 0, z: 0 }, power: 45, colorTemp: 5500, modifier: 'gridded-softbox', modifierSize: '60x60cm', enabled: true },
      { type: 'background', name: 'Background Light', position: { x: 0, y: 1, z: -2 }, rotation: { x: 30, y: 180, z: 0 }, power: 25, colorTemp: 5500, modifier: 'standard-reflector', enabled: true },
    ],
    keyToFillRatio: '2.5:1',
    mood: 'Professional, dimensional, polished',
    bestFor: ['senior portraits','faculty photos','premium yearbook packages'],
    tips: ['More dramatic lighting creates better depth','Use background light for separation','Good for upgrade packages'],
  }, 'school-group-wide': {
    id: 'school-group-wide',
    name: 'Class Photo (Wide Group)',
    description: 'Even lighting for large class groups of 15-30+ students',
    category: 'commercial',
    lights: [
      { type: 'key', name: 'Key Left', position: { x: -4, y: 3, z: 4 }, rotation: { x: -35, y: 30, z: 0 }, power: 85, colorTemp: 5500, modifier: 'octabox', modifierSize: '150cm', enabled: true },
      { type: 'key', name: 'Key Right', position: { x: 4, y: 3, z: 4 }, rotation: { x: -35, y: -30, z: 0 }, power: 85, colorTemp: 5500, modifier: 'octabox', modifierSize: '150cm', enabled: true },
      { type: 'fill', name: 'Center Fill', position: { x: 0, y: 2.5, z: 5 }, rotation: { x: -25, y: 0, z: 0 }, power: 50, colorTemp: 5500, modifier: 'softbox', modifierSize: '120x180cm', enabled: true },
      { type: 'background', name: 'Background Fill', position: { x: 0, y: 2, z: -3 }, rotation: { x: 20, y: 180, z: 0 }, power: 40, colorTemp: 5500, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
    ],
    keyToFillRatio: '1.5:1',
    mood: 'Even, inclusive, professional',
    bestFor: ['class photos','large groups','faculty groups','sports teams'],
    tips: ['Use identical lights at equal distances','Higher key lights reduce shadows on back rows','Shoot at f/8-f/11 for depth of field'],
  }, 'school-group-small': {
    id: 'school-group-small',
    name: 'Small Group (5-15 Students)',
    description: 'Balanced lighting for small to medium groups',
    category: 'commercial',
    lights: [
      { type: 'key', name: 'Main Key', position: { x: -3, y: 2.8, z: 3 }, rotation: { x: -30, y: 35, z: 0 }, power: 75, colorTemp: 5500, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'fill', name: 'Fill Light', position: { x: 3, y: 2.5, z: 3 }, rotation: { x: -30, y: -35, z: 0 }, power: 55, colorTemp: 5500, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'hair', name: 'Back Row Light', position: { x: 0, y: 3.5, z: -1 }, rotation: { x: -55, y: 0, z: 0 }, power: 40, colorTemp: 5500, modifier: 'stripbox', modifierSize: '30x150cm', enabled: true },
    ],
    keyToFillRatio: '1.5:1',
    mood: 'Balanced, flattering, even coverage',
    bestFor: ['small class photos','clubs','activity groups','student council'],
    tips: ['Position lights higher to cover all rows','Back row light prevents dark hair','Keep groups tight for better composition'],
  }, 'school-yearbook-classic': {
    id: 'school-yearbook-classic',
    name: 'Yearbook (Classic)',
    description: 'Traditional yearbook portrait style with clean background',
    category: 'portrait',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: 2, y: 2.2, z: 2 }, rotation: { x: -28, y: -40, z: 0 }, power: 75, colorTemp: 5500, modifier: 'softbox', modifierSize: '80x120cm', enabled: true },
      { type: 'fill', name: 'Fill', position: { x: -1.5, y: 1.8, z: 2 }, rotation: { x: -18, y: 25, z: 0 }, power: 35, colorTemp: 5500, modifier: 'reflector', modifierSize: '100cm', enabled: true },
    ],
    keyToFillRatio: '2:1',
    mood: 'Traditional, timeless, clean',
    bestFor: ['yearbook photos','school ID','traditional portraits'],
    tips: ['Consistent key position for all students','Use gray or blue background for classic look','Simple 2-light setup for speed'],
  }, 'school-graduation': {
    id: 'school-graduation',
    name: 'Graduation Portrait',
    description: 'Slightly more dramatic lighting for cap and gown photos',
    category: 'portrait',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -2, y: 2.5, z: 2 }, rotation: { x: -32, y: 45, z: 0 }, power: 75, colorTemp: 5500, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'fill', name: 'Fill Light', position: { x: 2, y: 2, z: 1.5 }, rotation: { x: -22, y: -32, z: 0 }, power: 30, colorTemp: 5500, modifier: 'umbrella', modifierSize: '100cm', enabled: true },
      { type: 'hair', name: 'Cap Light', position: { x: 0, y: 3, z: -1 }, rotation: { x: -65, y: 0, z: 0 }, power: 45, colorTemp: 5500, modifier: 'gridded-softbox', modifierSize: '60x60cm', enabled: true },
      { type: 'rim', name: 'Rim Light', position: { x: 2, y: 2.5, z: -1 }, rotation: { x: -35, y: -50, z: 0 }, power: 30, colorTemp: 5500, modifier: 'stripbox', modifierSize: '30x90cm', enabled: true },
    ],
    keyToFillRatio: '2.5:1',
    mood: 'Celebratory, polished, memorable',
    bestFor: ['graduation photos','cap and gown','senior portraits'],
    tips: ['Hair light highlights the graduation cap','Rim light adds celebratory feel','Slightly lower fill for more drama'],
  }, 'school-sports-team': {
    id: 'school-sports-team',
    name: 'Sports Team Photo',
    description: 'Dramatic lighting with dark background for sports teams',
    category: 'dramatic',
    lights: [
      { type: 'key', name: 'Main Key', position: { x: 0, y: 4, z: 4 }, rotation: { x: -40, y: 0, z: 0 }, power: 90, colorTemp: 5500, modifier: 'octabox', modifierSize: '150cm', enabled: true },
      { type: 'rim', name: 'Rim Left', position: { x: -4, y: 2.5, z: -1 }, rotation: { x: -25, y: 60, z: 0 }, power: 55, colorTemp: 5500, modifier: 'stripbox', modifierSize: '30x120cm', enabled: true },
      { type: 'rim', name: 'Rim Right', position: { x: 4, y: 2.5, z: -1 }, rotation: { x: -25, y: -60, z: 0 }, power: 55, colorTemp: 5500, modifier: 'stripbox', modifierSize: '30x120cm', enabled: true },
    ],
    keyToFillRatio: '4:1',
    mood: 'Athletic, powerful, dramatic',
    bestFor: ['sports teams','athletic portraits','competitive teams'],
    tips: ['Black backdrop for drama','Strong rim lights separate from background','Minimal fill keeps it intense'],
  }, 'school-faculty': {
    id: 'school-faculty',
    name: 'Faculty/Staff Portrait',
    description: 'Professional lighting for teachers and staff',
    category: 'portrait',
    lights: [
      { type: 'key', name: 'Key Light', position: { x: -1.8, y: 2.3, z: 2 }, rotation: { x: -28, y: 40, z: 0 }, power: 70, colorTemp: 5500, modifier: 'softbox', modifierSize: '90x120cm', enabled: true },
      { type: 'fill', name: 'Fill Light', position: { x: 1.8, y: 2, z: 1.8 }, rotation: { x: -20, y: -35, z: 0 }, power: 40, colorTemp: 5500, modifier: 'softbox', modifierSize: '60x90cm', enabled: true },
      { type: 'hair', name: 'Hair Light', position: { x: 0, y: 2.8, z: -1.2 }, rotation: { x: -58, y: 0, z: 0 }, power: 35, colorTemp: 5500, modifier: 'stripbox', modifierSize: '30x90cm', enabled: true },
    ],
    keyToFillRatio: '2:1',
    mood: 'Professional, approachable, authoritative',
    bestFor: ['teacher portraits','staff photos','administrator headshots'],
    tips: ['Slightly more polished than student photos','Can use gray or environmental backgrounds','Allow more time per subject'],
  }, 'school-preschool': {
    id: 'school-preschool',
    name: 'Preschool/Elementary',
    description: 'Very soft, child-friendly lighting',
    category: 'portrait',
    lights: [
      { type: 'key', name: 'Super Soft Key', position: { x: 0, y: 2.5, z: 2.5 }, rotation: { x: -30, y: 0, z: 0 }, power: 60, colorTemp: 5500, modifier: 'octabox', modifierSize: '150cm', enabled: true },
      { type: 'fill', name: 'Wrap Fill', position: { x: -2, y: 1.8, z: 1 }, rotation: { x: -15, y: 35, z: 0 }, power: 40, colorTemp: 5500, modifier: 'umbrella', modifierSize: '150cm', enabled: true },
      { type: 'fill', name: 'Wrap Fill 2', position: { x: 2, y: 1.8, z: 1 }, rotation: { x: -15, y: -35, z: 0 }, power: 40, colorTemp: 5500, modifier: 'umbrella', modifierSize: '150cm', enabled: true },
    ],
    keyToFillRatio: '1.3:1',
    mood: 'Soft, cheerful, forgiving',
    bestFor: ['preschool','kindergarten','elementary school','young children'],
    tips: ['Very flat lighting hides wiggly kids','Large soft sources are forgiving','Keep sessions short for attention spans'],
  }'school-outdoor-natural': {
    id: 'school-outdoor-natural',
    name: 'Outdoor School Photos',
    description: 'Natural light with fill for outdoor school sessions',
    category: 'natural',
    lights: [
      { type: 'fill', name: 'Reflector Fill', position: { x: -2, y: 1, z: 2 }, rotation: { x: 20, y: 45, z: 0 }, power: 0, colorTemp: 5500, modifier: 'reflector-silver', modifierSize: '120cm', enabled: true },
      { type: 'fill', name: 'Flash Fill', position: { x: 0, y: 2, z: 3 }, rotation: { x: -15, y: 0, z: 0 }, power: 35, colorTemp: 5500, modifier: 'softbox', modifierSize: '60x60cm', enabled: true },
    ],
    keyToFillRatio: 'Natural:Flash',
    mood: 'Natural, fresh, outdoor',
    bestFor: ['outdoor school photos','campus shots','natural light portraits'],
    tips: ['Find open shade for consistent light','Use flash as fill, not key','Watch for dappled light on faces'],
  },

// Character tag to lighting setup mappings
const TAG_SETUP_MAP: Record<string, string[]> = {
  // School Photography
  'school-portrait': ['school-portrait-standard','school-portrait-premium','school-yearbook-classic']'yearbook': ['school-yearbook-classic','school-portrait-standard','classic-portrait']'class-photo': ['school-group-wide','school-group-small','school-preschool']'group-school': ['school-group-wide','school-group-small']'graduation': ['school-graduation','school-portrait-premium']'sports-team': ['school-sports-team','school-group-wide']'faculty': ['school-faculty','classic-portrait','school-portrait-premium']'preschool': ['school-preschool','school-portrait-standard']'elementary': ['school-preschool','school-portrait-standard']'school': ['school-portrait-standard','school-yearbook-classic','school-group-wide']'school_photography': ['school-portrait-standard','school-yearbook-classic','school-group-wide'],
  
  // Barbershop & Salon
  barber: ['barber-shop','classic-portrait','clamshell'],
  salon: ['barber-shop','butterfly-beauty','high-key'],
  stylist: ['butterfly-beauty','barber-shop','clamshell']'makeup-artist': ['butterfly-beauty','clamshell','high-key'],
  
  // Culinary
  chef: ['chef-kitchen','classic-portrait','rembrandt'],
  pastry: ['chef-kitchen','high-key','clamshell'],
  sushi: ['chef-kitchen','low-key','rembrandt'],
  bbq: ['chef-kitchen','western-golden','low-key'],
  barista: ['chef-kitchen','classic-portrait','rembrandt'],
  
  // Trades
  mechanic: ['mechanic-workshop','low-key','split-light'],
  carpenter: ['mechanic-workshop','rembrandt','classic-portrait'],
  welder: ['mechanic-workshop','low-key','split-light'],
  blacksmith: ['mechanic-workshop','low-key','western-golden'],
  
  // Creative
  'tattoo-artist': ['tattoo-artist','split-light','low-key'],
  jeweler: ['high-key','classic-portrait','rembrandt'],
  florist: ['high-key','classic-portrait','butterfly-beauty'],
  potter: ['rembrandt','low-key','mechanic-workshop'],
  tailor: ['classic-portrait','rembrandt','clamshell'],
  
  // General
  professional: ['classic-portrait','clamshell','high-key'],
  creative: ['rembrandt','split-light','low-key'],
  elegant: ['butterfly-beauty','classic-portrait','clamshell'],
  
  // ============================================================================
  // VIDEOGRAPHER SPECIALIZATIONS
  // ============================================================================
  
  // Cinematographer
  cinematographer: ['film-noir','fantasy-magical','action-hero']'film-maker': ['film-noir','sci-fi-cool','western-golden'],
  
  // Commercial Video
  'commercial-video': ['corporate-talking-head','interview-2cam','broadcast-studio'],
  advertising: ['high-key','corporate-talking-head','interview-2cam'],
  
  // Documentary
  documentary: ['documentary-natural','interview-2cam','rembrandt'],
  journalism: ['documentary-natural','interview-2cam','broadcast-studio'],
  
  // Music Video
  'music-video': ['music-video-dramatic','low-key','split-light'],
  performance: ['music-video-dramatic','action-hero','low-key'],
  concert: ['music-video-dramatic','low-key','split-light'],
  
  // Corporate Video
  'corporate-video': ['corporate-talking-head','interview-2cam','broadcast-studio'],
  training: ['corporate-talking-head','interview-2cam','high-key'],
  testimonial: ['interview-2cam','corporate-talking-head','documentary-natural'],
  
  // Social Media / Content Creator
  youtube: ['youtube-creator','corporate-talking-head','high-key'],
  tiktok: ['youtube-creator','music-video-dramatic','high-key'],
  instagram: ['youtube-creator','butterfly-beauty','high-key'],
  vlogger: ['youtube-creator','documentary-natural','high-key']'content-creator': ['youtube-creator','interview-2cam','high-key'],
  
  // Live Streaming / Broadcast
  broadcast: ['broadcast-studio','interview-2cam','high-key']'live-streaming': ['broadcast-studio','youtube-creator','interview-2cam'],
  news: ['broadcast-studio','interview-2cam','high-key'],
  podcast: ['interview-2cam','youtube-creator','corporate-talking-head'],
  
  // VFX / Green Screen
  vfx: ['green-screen-even','high-key','broadcast-studio']'green-screen': ['green-screen-even','high-key','broadcast-studio'],
  compositing: ['green-screen-even','high-key','split-light'],
  
  // Interview
  interview: ['interview-2cam','documentary-natural','corporate-talking-head']'talking-head': ['corporate-talking-head','interview-2cam','youtube-creator'],
};


// Genre to lighting setup mappings
const GENRE_SETUP_MAP: Record<string, string[]> = {
  'film-noir': ['film-noir','split-light','low-key']'sci-fi': ['sci-fi-cool','split-light','low-key']'western': ['western-golden','rembrandt','classic-portrait']'horror': ['horror-dramatic','split-light','low-key']'cosmic-horror': ['cosmic-horror','horror-dramatic','low-key']'fantasy': ['fantasy-magical','rembrandt','classic-portrait']'action': ['action-hero','low-key','split-light']'period-drama': ['period-drama-elegant','rembrandt','classic-portrait']'asian-cinema': ['asian-cinema-dramatic','split-light','rembrandt']'superhero': ['superhero-epic','action-hero','low-key']'profession': ['classic-portrait','clamshell','rembrandt'],
};

// HDRI category to lighting setup mappings
const HDRI_SETUP_MAP: Record<string, string[]> = {
  studio: ['classic-portrait','clamshell','butterfly-beauty','high-key'],
  indoor: ['classic-portrait','rembrandt','chef-kitchen','barber-shop'],
  outdoor: ['western-golden','classic-portrait','rembrandt'],
  sunset: ['western-golden','rembrandt','low-key'],
  night: ['film-noir','low-key','split-light','horror-dramatic'],
  overcast: ['classic-portrait','clamshell','high-key'],
  school: ['clamshell','high-key','classic-portrait'],
};

// Mood to lighting mappings
const MOOD_SETUP_MAP: Record<string, string[]> = {
  gritty: ['low-key','split-light','mechanic-workshop'],
  elegant: ['butterfly-beauty','classic-portrait','clamshell'],
  professional: ['classic-portrait','clamshell','high-key'],
  dramatic: ['low-key','split-light','film-noir'],
  warm: ['western-golden','barber-shop','chef-kitchen'],
  cool: ['sci-fi-cool','low-key','split-light'],
  mysterious: ['film-noir','low-key','split-light'],
  authoritative: ['rembrandt','classic-portrait','low-key'],
};

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

/**
 * Get lighting setup recommendations based on character and HDRI
 */
export function getLightSetupRecommendations(
  character: CharacterContext,
  hdri?: HDRIContext
): LightSetupRecommendation[] {
  const recommendations: Map<string, { score: number; reasons: string[] }> = new Map();
  
  // Score based on character tags
  character.tags?.forEach(tag => {
    const tagLower = tag.toLowerCase();
    const matchingSetups = TAG_SETUP_MAP[tagLower];
    if (matchingSetups) {
      matchingSetups.forEach((setupId, index) => {
        const existing = recommendations.get(setupId) || { score: 0, reasons: [] };
        existing.score += (15 - index * 3);
        existing.reasons.push(`Perfect for ${tag} professionals, `);
        recommendations.set(setupId, existing);
      });
    }
  });
  
  // Score based on genre
  if (character.genre) {
    const genreSetups = GENRE_SETUP_MAP[character.genre];
    if (genreSetups) {
      genreSetups.forEach((setupId, index) => {
        const existing = recommendations.get(setupId) || { score: 0, reasons: [] };
        existing.score += (12 - index * 2);
        existing.reasons.push(`Matches ${character.genre} aesthetic, `);
        recommendations.set(setupId, existing);
      });
    }
  }
  
  // Score based on HDRI category
  if (hdri?.category) {
    const hdriSetups = HDRI_SETUP_MAP[hdri.category];
    if (hdriSetups) {
      hdriSetups.forEach((setupId, index) => {
        const existing = recommendations.get(setupId) || { score: 0, reasons: [] };
        existing.score += (10 - index * 2);
        existing.reasons.push(`Complements ${hdri.category} environment`);
        recommendations.set(setupId, existing);
      });
    }
  }
  
  // Score based on mood
  if (character.mood) {
    const moodSetups = MOOD_SETUP_MAP[character.mood];
    if (moodSetups) {
      moodSetups.forEach((setupId, index) => {
        const existing = recommendations.get(setupId) || { score: 0, reasons: [] };
        existing.score += (8 - index * 2);
        existing.reasons.push(`Creates ${character.mood} mood`);
        recommendations.set(setupId, existing);
      });
    }
  }
  
  // If no matches, add default setups
  if (recommendations.size === 0) {
    ['classic-portrait','clamshell', 'rembrandt'].forEach((setupId, index) => {
      recommendations.set(setupId, {
        score: 5 - index,
        reasons: ['Versatile portrait lighting'],
      });
    });
  }
  
  // Convert to array with full setup data
  const results: LightSetupRecommendation[] = [];
  recommendations.forEach((data, setupId) => {
    const setup = LIGHT_SETUPS[setupId];
    if (setup) {
      results.push({
        ...setup,
        matchScore: Math.min(100, data.score * 4),
        reason: data.reasons[0],
      });
    }
  });
  
  // Sort by score and take top 6
  results.sort((a, b) => b.matchScore - a.matchScore);
  
  log.debug(`Light setup recommendations for ${character.name}:`, results.slice(0, 6));
  
  return results.slice(0, 6);
}

/**
 * Get all available lighting setups
 */
export function getAllLightSetups(): LightSetupRecommendation[] {
  return Object.values(LIGHT_SETUPS).map(setup => ({
    ...setup,
    matchScore: 0,
    reason: '',
  }));
}

/**
 * Get a specific lighting setup by ID
 */
export function getLightSetupById(id: string) {
  return LIGHT_SETUPS[id];
}

export default {
  getLightSetupRecommendations,
  getAllLightSetups,
  getLightSetupById,
};

