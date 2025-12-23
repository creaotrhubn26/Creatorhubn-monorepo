/**
 * Backdrop Definitions Data Library
 *
 * Defines backdrops (environments, backgrounds) for virtual studio scenes.
 *
 * Categories:
 * - Studio: Professional studio backdrops (white, black, gray, colored)
 * - Outdoor: Natural outdoor environments (parks, streets, beaches)
 * - Indoor: Interior environments (offices, homes, warehouses)
 * - Abstract: Abstract and artistic backgrounds
 * - Green Screen: Chroma key backgrounds for compositing
 * - Skybox: 360-degree environment maps
 */

// ============================================================================
// Types and Enums
// ============================================================================

export type BackdropCategory = 
  | 'studio' 
  | 'outdoor' 
  | 'indoor' 
  | 'abstract' 
  | 'green-screen'
  | 'skybox'
  | 'cyclorama';

export type BackdropStyle = 
  | 'realistic' 
  | 'stylized' 
  | 'minimalist' 
  | 'dramatic'
  | 'natural'
  | 'urban';

export type BackdropLighting = 
  | 'bright' 
  | 'neutral' 
  | 'dark' 
  | 'dramatic'
  | 'natural'
  | 'studio';

export type BackdropSize = 'small' | 'medium' | 'large' | 'infinite';

// ============================================================================
// Backdrop Definition Interface
// ============================================================================

export interface BackdropDefinition {
  id: string;
  name: string;
  description: string;
  category: BackdropCategory;
  style: BackdropStyle;
  lighting: BackdropLighting;
  size: BackdropSize;
  modelPath: string;
  meshName?: string; // For multi-mesh GLB files
  thumbnailPath?: string;
  polyCount?: number;
  tags?: string[];
  
  // Environment properties
  hasEnvironmentMap?: boolean; // Whether it includes environment lighting
  environmentMapPath?: string; // Path to HDR environment map
  skyboxPath?: string; // Path to skybox textures
  
  // Physical properties
  dimensions?: {
    width: number;  // meters
    height: number; // meters
    depth: number;  // meters
  };
  
  // Lighting properties
  ambientColor?: string; // Hex color for ambient light
  ambientIntensity?: number; // 0-1
  
  // Optimization hints
  supportsLOD?: boolean;
  isInfinite?: boolean; // Whether backdrop extends infinitely (skybox)
}

// ============================================================================
// Placeholder Backdrop Collections
// ============================================================================

/**
 * NOTE: These are placeholder definitions.
 * Replace with actual backdrop models from Sketchfab or other sources.
 */

export const STUDIO_BACKDROPS: BackdropDefinition[] = [
  {
    id: 'studio-white-cyclorama',
    name: 'White Cyclorama',
    description: 'Classic white studio cyclorama with seamless curves',
    category: 'cyclorama',
    style: 'minimalist',
    lighting: 'bright',
    size: 'large',
    modelPath: '/library/models/backdrops/studio/cyclorama_white.glb',
    meshName: 'Cyclorama_White',
    polyCount: 5000,
    tags: ['studio','white','cyclorama','professional'],
    dimensions: { width: 10.0, height: 5.0, depth: 10.0 },
    ambientColor: '#ffffff',
    ambientIntensity: 0.8,
    supportsLOD: false,
    isInfinite: false,
  },
  {
    id: 'studio-black-backdrop',
    name: 'Black Studio Backdrop',
    description: 'Dramatic black studio backdrop for high-contrast shots',
    category: 'studio',
    style: 'dramatic',
    lighting: 'dark',
    size: 'large',
    modelPath: '/library/models/backdrops/studio/backdrop_black.glb',
    meshName: 'Backdrop_Black',
    polyCount: 2000,
    tags: ['studio','black','dramatic','professional'],
    dimensions: { width: 8.0, height: 4.0, depth: 0.1 },
    ambientColor: '#000000',
    ambientIntensity: 0.1,
    supportsLOD: false,
    isInfinite: false,
  },
];

export const OUTDOOR_BACKDROPS: BackdropDefinition[] = [
  {
    id: 'outdoor-park-day',
    name: 'Park - Daytime',
    description: 'Sunny park environment with trees and grass',
    category: 'outdoor',
    style: 'realistic',
    lighting: 'natural',
    size: 'infinite',
    modelPath: '/library/models/backdrops/outdoor/park_day.glb',
    meshName: 'Park_Day',
    polyCount: 50000,
    tags: ['outdoor','park','nature','daytime'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/park_day.hdr',
    ambientColor: '#87CEEB',
    ambientIntensity: 0.6,
    supportsLOD: true,
    isInfinite: true,
  },
  {
    id: 'outdoor-urban-street',
    name: 'Urban Street',
    description: 'Modern city street with buildings',
    category: 'outdoor',
    style: 'urban',
    lighting: 'neutral',
    size: 'large',
    modelPath: '/library/models/backdrops/outdoor/urban_street.glb',
    meshName: 'Urban_Street',
    polyCount: 80000,
    tags: ['outdoor','urban','city','street'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/urban_day.hdr',
    ambientColor: '#B0C4DE',
    ambientIntensity: 0.5,
    supportsLOD: true,
    isInfinite: false,
  },
];

export const INDOOR_BACKDROPS: BackdropDefinition[] = [
  {
    id: 'indoor-office-modern',
    name: 'Modern Office',
    description: 'Contemporary office interior with large windows',
    category: 'indoor',
    style: 'realistic',
    lighting: 'bright',
    size: 'large',
    modelPath: '/library/models/backdrops/indoor/office_modern.glb',
    meshName: 'Office_Modern',
    polyCount: 60000,
    tags: ['indoor','office','modern','professional'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/office_interior.hdr',
    ambientColor: '#F5F5F5',
    ambientIntensity: 0.7,
    supportsLOD: true,
    isInfinite: false,
  },
  {
    id: 'indoor-living-room',
    name: 'Living Room',
    description: 'Cozy modern living room with natural light',
    category: 'indoor',
    style: 'realistic',
    lighting: 'natural',
    size: 'medium',
    modelPath: '/library/models/backdrops/indoor/living_room.glb',
    polyCount: 45000,
    tags: ['indoor','living','home','cozy'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/living_room.hdr',
    ambientColor: '#FFF8DC',
    ambientIntensity: 0.6,
    supportsLOD: true,
    isInfinite: false,
  },
  {
    id: 'indoor-warehouse',
    name: 'Industrial Warehouse',
    description: 'Large industrial warehouse with exposed brick',
    category: 'indoor',
    style: 'urban',
    lighting: 'dramatic',
    size: 'large',
    modelPath: '/library/models/backdrops/indoor/warehouse.glb',
    polyCount: 70000,
    tags: ['indoor','warehouse','industrial','urban'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/warehouse.hdr',
    ambientColor: '#8B8682',
    ambientIntensity: 0.4,
    supportsLOD: true,
    isInfinite: false,
  },
  {
    id: 'indoor-kitchen',
    name: 'Modern Kitchen',
    description: 'Contemporary kitchen with island',
    category: 'indoor',
    style: 'realistic',
    lighting: 'bright',
    size: 'medium',
    modelPath: '/library/models/backdrops/indoor/kitchen.glb',
    polyCount: 55000,
    tags: ['indoor','kitchen','home','modern'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/kitchen.hdr',
    ambientColor: '#FFFFFF',
    ambientIntensity: 0.7,
    supportsLOD: true,
    isInfinite: false,
  },
  {
    id: 'indoor-cafe',
    name: 'Coffee Shop',
    description: 'Cozy coffee shop interior',
    category: 'indoor',
    style: 'natural',
    lighting: 'neutral',
    size: 'medium',
    modelPath: '/library/models/backdrops/indoor/cafe.glb',
    polyCount: 50000,
    tags: ['indoor','cafe','coffee','cozy'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/cafe.hdr',
    ambientColor: '#D2691E',
    ambientIntensity: 0.5,
    supportsLOD: true,
    isInfinite: false,
  },
];

export const ABSTRACT_BACKDROPS: BackdropDefinition[] = [
  {
    id: 'abstract-gradient-blue',
    name: 'Blue Gradient',
    description: 'Smooth blue gradient background',
    category: 'abstract',
    style: 'minimalist',
    lighting: 'neutral',
    size: 'infinite',
    modelPath: '/library/models/backdrops/abstract/gradient_blue.glb',
    polyCount: 1000,
    tags: ['abstract','gradient','blue','minimalist'],
    ambientColor: '#4169E1',
    ambientIntensity: 0.5,
    supportsLOD: false,
    isInfinite: true,
  },
  {
    id: 'abstract-gradient-sunset',
    name: 'Sunset Gradient',
    description: 'Warm sunset gradient background',
    category: 'abstract',
    style: 'dramatic',
    lighting: 'natural',
    size: 'infinite',
    modelPath: '/library/models/backdrops/abstract/gradient_sunset.glb',
    polyCount: 1000,
    tags: ['abstract','gradient','sunset','warm'],
    ambientColor: '#FF6347',
    ambientIntensity: 0.6,
    supportsLOD: false,
    isInfinite: true,
  },
  {
    id: 'abstract-geometric',
    name: 'Geometric Shapes',
    description: 'Abstract geometric pattern background',
    category: 'abstract',
    style: 'stylized',
    lighting: 'neutral',
    size: 'large',
    modelPath: '/library/models/backdrops/abstract/geometric.glb',
    polyCount: 5000,
    tags: ['abstract','geometric','pattern','modern'],
    ambientColor: '#708090',
    ambientIntensity: 0.5,
    supportsLOD: false,
    isInfinite: false,
  },
  {
    id: 'abstract-bokeh',
    name: 'Bokeh Lights',
    description: 'Soft bokeh light background',
    category: 'abstract',
    style: 'dramatic',
    lighting: 'dark',
    size: 'infinite',
    modelPath: '/library/models/backdrops/abstract/bokeh.glb',
    polyCount: 2000,
    tags: ['abstract','bokeh','lights','dreamy'],
    ambientColor: '#1C1C1C',
    ambientIntensity: 0.2,
    supportsLOD: false,
    isInfinite: true,
  },
  {
    id: 'abstract-neon',
    name: 'Neon Lines',
    description: 'Vibrant neon light lines',
    category: 'abstract',
    style: 'stylized',
    lighting: 'dramatic',
    size: 'large',
    modelPath: '/library/models/backdrops/abstract/neon.glb',
    polyCount: 3000,
    tags: ['abstract','neon','cyberpunk','futuristic'],
    ambientColor: '#FF00FF',
    ambientIntensity: 0.4,
    supportsLOD: false,
    isInfinite: false,
  },
];

export const GREEN_SCREEN_BACKDROPS: BackdropDefinition[] = [
  {
    id: 'green-screen-standard',
    name: 'Standard Green Screen',
    description: 'Professional chroma key green backdrop',
    category: 'green-screen',
    style: 'minimalist',
    lighting: 'studio',
    size: 'large',
    modelPath: '/library/models/backdrops/green-screen/standard.glb',
    polyCount: 2000,
    tags: ['green-screen','chroma','vfx','professional'],
    ambientColor: '#00FF00',
    ambientIntensity: 0.8,
    supportsLOD: false,
    isInfinite: false,
  },
  {
    id: 'green-screen-cyclorama',
    name: 'Green Cyclorama',
    description: 'Seamless green cyclorama for full coverage',
    category: 'green-screen',
    style: 'minimalist',
    lighting: 'studio',
    size: 'large',
    modelPath: '/library/models/backdrops/green-screen/cyclorama.glb',
    polyCount: 5000,
    tags: ['green-screen','cyclorama','vfx','seamless'],
    ambientColor: '#00FF00',
    ambientIntensity: 0.8,
    supportsLOD: false,
    isInfinite: false,
  },
  {
    id: 'blue-screen-standard',
    name: 'Blue Screen',
    description: 'Professional chroma key blue backdrop',
    category: 'green-screen',
    style: 'minimalist',
    lighting: 'studio',
    size: 'large',
    modelPath: '/library/models/backdrops/green-screen/blue_screen.glb',
    polyCount: 2000,
    tags: ['blue-screen','chroma','vfx','professional'],
    ambientColor: '#0000FF',
    ambientIntensity: 0.8,
    supportsLOD: false,
    isInfinite: false,
  },
];

export const SKYBOX_BACKDROPS: BackdropDefinition[] = [
  {
    id: 'skybox-clear-day',
    name: 'Clear Day Sky',
    description: '360-degree clear blue sky',
    category: 'skybox',
    style: 'realistic',
    lighting: 'bright',
    size: 'infinite',
    modelPath: '/library/models/backdrops/skybox/clear_day.glb',
    polyCount: 1000,
    tags: ['skybox','sky','day','clear'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/clear_day.hdr',
    skyboxPath: '/library/skybox/clear_day',
    ambientColor: '#87CEEB',
    ambientIntensity: 0.7,
    supportsLOD: false,
    isInfinite: true,
  },
  {
    id: 'skybox-sunset',
    name: 'Sunset Sky',
    description: '360-degree golden hour sunset',
    category: 'skybox',
    style: 'dramatic',
    lighting: 'natural',
    size: 'infinite',
    modelPath: '/library/models/backdrops/skybox/sunset.glb',
    polyCount: 1000,
    tags: ['skybox','sky','sunset','golden'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/sunset.hdr',
    skyboxPath: '/library/skybox/sunset',
    ambientColor: '#FFA500',
    ambientIntensity: 0.6,
    supportsLOD: false,
    isInfinite: true,
  },
  {
    id: 'skybox-night-stars',
    name: 'Starry Night',
    description: '360-degree night sky with stars',
    category: 'skybox',
    style: 'dramatic',
    lighting: 'dark',
    size: 'infinite',
    modelPath: '/library/models/backdrops/skybox/night_stars.glb',
    polyCount: 1000,
    tags: ['skybox','sky','night','stars'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/night_stars.hdr',
    skyboxPath: '/library/skybox/night_stars',
    ambientColor: '#191970',
    ambientIntensity: 0.2,
    supportsLOD: false,
    isInfinite: true,
  },
  {
    id: 'skybox-overcast',
    name: 'Overcast Sky',
    description: '360-degree cloudy overcast sky',
    category: 'skybox',
    style: 'realistic',
    lighting: 'neutral',
    size: 'infinite',
    modelPath: '/library/models/backdrops/skybox/overcast.glb',
    polyCount: 1000,
    tags: ['skybox','sky','cloudy','overcast'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/overcast.hdr',
    skyboxPath: '/library/skybox/overcast',
    ambientColor: '#A9A9A9',
    ambientIntensity: 0.5,
    supportsLOD: false,
    isInfinite: true,
  },
  {
    id: 'skybox-space',
    name: 'Deep Space',
    description: '360-degree space environment with nebula',
    category: 'skybox',
    style: 'stylized',
    lighting: 'dark',
    size: 'infinite',
    modelPath: '/library/models/backdrops/skybox/space.glb',
    polyCount: 1000,
    tags: ['skybox','space','galaxy','sci-fi'],
    hasEnvironmentMap: true,
    environmentMapPath: '/library/hdri/space.hdr',
    skyboxPath: '/library/skybox/space',
    ambientColor: '#0D0D2B',
    ambientIntensity: 0.1,
    supportsLOD: false,
    isInfinite: true,
  },
];

export const CYCLORAMA_BACKDROPS: BackdropDefinition[] = [
  {
    id: 'cyclorama-white',
    name: 'White Cyclorama',
    description: 'Classic white seamless cyclorama',
    category: 'cyclorama',
    style: 'minimalist',
    lighting: 'bright',
    size: 'large',
    modelPath: '/library/models/backdrops/cyclorama/white.glb',
    polyCount: 5000,
    tags: ['cyclorama','white','seamless','studio'],
    ambientColor: '#FFFFFF',
    ambientIntensity: 0.8,
    supportsLOD: false,
    isInfinite: false,
  },
  {
    id: 'cyclorama-gray',
    name: 'Gray Cyclorama',
    description: 'Neutral gray seamless cyclorama',
    category: 'cyclorama',
    style: 'minimalist',
    lighting: 'neutral',
    size: 'large',
    modelPath: '/library/models/backdrops/cyclorama/gray.glb',
    polyCount: 5000,
    tags: ['cyclorama','gray','seamless','neutral'],
    ambientColor: '#808080',
    ambientIntensity: 0.5,
    supportsLOD: false,
    isInfinite: false,
  },
  {
    id: 'cyclorama-black',
    name: 'Black Cyclorama',
    description: 'Dramatic black seamless cyclorama',
    category: 'cyclorama',
    style: 'dramatic',
    lighting: 'dark',
    size: 'large',
    modelPath: '/library/models/backdrops/cyclorama/black.glb',
    polyCount: 5000,
    tags: ['cyclorama','black','seamless','dramatic'],
    ambientColor: '#1A1A1A',
    ambientIntensity: 0.1,
    supportsLOD: false,
    isInfinite: false,
  },
  {
    id: 'cyclorama-colored',
    name: 'Colored Cyclorama',
    description: 'Customizable colored seamless cyclorama',
    category: 'cyclorama',
    style: 'stylized',
    lighting: 'studio',
    size: 'large',
    modelPath: '/library/models/backdrops/cyclorama/colored.glb',
    polyCount: 5000,
    tags: ['cyclorama','colored','seamless','customizable'],
    ambientColor: '#FF6B6B',
    ambientIntensity: 0.6,
    supportsLOD: false,
    isInfinite: false,
  },
];

// ============================================================================
// Backdrop Collections Export
// ============================================================================

export const ALL_BACKDROPS: BackdropDefinition[] = [
  ...STUDIO_BACKDROPS,
  ...OUTDOOR_BACKDROPS,
  ...INDOOR_BACKDROPS,
  ...ABSTRACT_BACKDROPS,
  ...GREEN_SCREEN_BACKDROPS,
  ...SKYBOX_BACKDROPS,
  ...CYCLORAMA_BACKDROPS,
];

export const BACKDROPS_BY_CATEGORY = {
  studio: STUDIO_BACKDROPS,
  outdoor: OUTDOOR_BACKDROPS,
  indoor: INDOOR_BACKDROPS,
  abstract: ABSTRACT_BACKDROPS,
  'green-screen': GREEN_SCREEN_BACKDROPS,
  skybox: SKYBOX_BACKDROPS,
  cyclorama: CYCLORAMA_BACKDROPS,
};

/**
 * Get backdrop by ID
 */
export function getBackdropById(id: string): BackdropDefinition | undefined {
  return ALL_BACKDROPS.find(backdrop => backdrop.id === id);
}

