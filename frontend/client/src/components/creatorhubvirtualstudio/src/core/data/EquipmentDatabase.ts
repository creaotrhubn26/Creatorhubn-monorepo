/**
 * Professional Studio Equipment Database
 * 
 * Real equipment specifications from major brands:
 * - Profoto
 * - Godox
 * - Elinchrom
 * - Broncolor
 * - Aputure
 */

export interface StudioLight {
  id: string;
  brand: string;
  model: string;
  type: 'strobe' | 'continuous' | 'led_panel' | 'fresnel';
  
  // Power specs
  power: number; // Watts or Ws (watt-seconds for strobes)
  powerRange?: [number, number]; // Min/max power
  colorTemperature: number; // Kelvin
  cri?: number; // Color Rendering Index
  tlci?: number; // Television Lighting Consistency Index
  
  // Physical specs
  weight: number; // kg
  dimensions: [number, number, number]; // [width, height, depth] in cm
  mountType: 'bowens' | 'profoto' | 'elinchrom' | 'broncolor' | 'custom';
  
  // Features
  hss?: boolean; // High-Speed Sync
  ttl?: boolean; // Through-The-Lens metering
  wireless?: boolean;
  battery?: boolean;
  
  // 3D model path
  modelPath?: string;
  thumbnailPath?: string;
  
  // IES profile
  iesProfile?: string;
  
  // Price (for cost calculation)
  price?: number; // USD
  rentalPrice?: number; // USD per day
}

export interface LightModifier {
  id: string;
  name: string;
  type: 'softbox' | 'umbrella' | 'beauty_dish' | 'grid' | 'snoot' | 'reflector' | 'gobo';
  
  // Dimensions
  size: [number, number]; // [width, height] in meters
  shape: 'rectangular' | 'octagonal' | 'circular' | 'strip';
  
  // Light characteristics
  diffusion: number; // 0-1
  lightLoss: number; // stops of light loss
  beamAngle?: number; // degrees (for grids/snoots)
  
  // Compatibility
  mountType: 'bowens' | 'profoto' | 'elinchrom' | 'universal';
  
  // 3D model
  modelPath?: string;
  thumbnailPath?: string;
  
  price?: number;
  rentalPrice?: number;
}

// Profoto Equipment
export const PROFOTO_LIGHTS: StudioLight[] = [
  {
    id: 'profoto_d2_500',
    brand: 'Profoto',
    model: 'D2 500',
    type: 'strobe',
    power: 500,
    powerRange: [4, 500],
    colorTemperature: 5600,
    weight: 1.9,
    dimensions: [19, 19, 11],
    mountType: 'profoto',
    hss: true,
    ttl: true,
    wireless: true,
    battery: false,
    price: 2495,
    rentalPrice: 75,
    modelPath: '/models/lights/profoto_d2_500.glb',
    thumbnailPath: '/thumbnails/profoto_d2_500.jpg',
  },
  {
    id: 'profoto_b10_plus',
    brand: 'Profoto',
    model: 'B10 Plus',
    type: 'strobe',
    power: 500,
    colorTemperature: 5600,
    weight: 1.9,
    dimensions: [10.5, 21, 10.5],
    mountType: 'profoto',
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
    price: 2095,
    rentalPrice: 65,
    modelPath: '/models/lights/profoto_b10_plus.glb',
  },
];

// Godox Equipment
export const GODOX_LIGHTS: StudioLight[] = [
  {
    id: 'godox_ad600pro',
    brand: 'Godox',
    model: 'AD600 Pro',
    type: 'strobe',
    power: 600,
    colorTemperature: 5600,
    weight: 3.0,
    dimensions: [19, 28, 13],
    mountType: 'bowens',
    hss: true,
    ttl: true,
    wireless: true,
    battery: true,
    price: 899,
    rentalPrice: 35,
    modelPath: '/models/lights/godox_ad600pro.glb',
  },
  {
    id: 'godox_sl60w',
    brand: 'Godox',
    model: 'SL-60W',
    type: 'led_panel',
    power: 60,
    colorTemperature: 5600,
    cri: 96,
    tlci: 96,
    weight: 1.35,
    dimensions: [22, 14, 14],
    mountType: 'bowens',
    wireless: false,
    battery: false,
    price: 119,
    rentalPrice: 15,
    modelPath: '/models/lights/godox_sl60w.glb',
  },
];

// Aputure Equipment
export const APUTURE_LIGHTS: StudioLight[] = [
  {
    id: 'aputure_600d',
    brand: 'Aputure',
    model: '600d Pro',
    type: 'led_panel',
    power: 600,
    colorTemperature: 5600,
    cri: 96,
    tlci: 97,
    weight: 9.5,
    dimensions: [38, 38, 20],
    mountType: 'bowens',
    wireless: true,
    battery: false,
    price: 1899,
    rentalPrice: 75,
    modelPath: '/models/lights/aputure_600d.glb',
  },
];

export const ALL_LIGHTS: StudioLight[] = [
  ...PROFOTO_LIGHTS,
  ...GODOX_LIGHTS,
  ...APUTURE_LIGHTS,
];

// Light Modifiers
export const SOFTBOXES: LightModifier[] = [
  {
    id: 'softbox_60x60',
    name: 'Softbox 60x60cm',
    type: 'softbox',
    size: [0.6, 0.6],
    shape: 'rectangular',
    diffusion: 0.8,
    lightLoss: 1.0,
    mountType: 'bowens',
    price: 89,
    rentalPrice: 10,
    modelPath: '/models/modifiers/softbox_60x60.glb',
  },
  {
    id: 'softbox_90x120',
    name: 'Softbox 90x120cm',
    type: 'softbox',
    size: [0.9, 1.2],
    shape: 'rectangular',
    diffusion: 0.85,
    lightLoss: 1.2,
    mountType: 'bowens',
    price: 129,
    rentalPrice: 15,
    modelPath: '/models/modifiers/softbox_90x120.glb',
  },
  {
    id: 'octabox_120',
    name: 'Octabox 120cm',
    type: 'softbox',
    size: [1.2, 1.2],
    shape: 'octagonal',
    diffusion: 0.9,
    lightLoss: 1.3,
    mountType: 'bowens',
    price: 159,
    rentalPrice: 20,
    modelPath: '/models/modifiers/octabox_120.glb',
  },
];

export const UMBRELLAS: LightModifier[] = [
  {
    id: 'umbrella_white_105',
    name: 'White Umbrella 105cm',
    type: 'umbrella',
    size: [1.05, 1.05],
    shape: 'circular',
    diffusion: 0.7,
    lightLoss: 0.5,
    mountType: 'universal',
    price: 29,
    rentalPrice: 5,
    modelPath: '/models/modifiers/umbrella_white_105.glb',
  },
  {
    id: 'umbrella_silver_105',
    name: 'Silver Umbrella 105cm',
    type: 'umbrella',
    size: [1.05, 1.05],
    shape: 'circular',
    diffusion: 0.3,
    lightLoss: 0.3,
    mountType: 'universal',
    price: 29,
    rentalPrice: 5,
    modelPath: '/models/modifiers/umbrella_silver_105.glb',
  },
];

export const BEAUTY_DISHES: LightModifier[] = [
  {
    id: 'beauty_dish_55',
    name: 'Beauty Dish 55cm',
    type: 'beauty_dish',
    size: [0.55, 0.55],
    shape: 'circular',
    diffusion: 0.5,
    lightLoss: 0.7,
    mountType: 'bowens',
    price: 149,
    rentalPrice: 15,
    modelPath: '/models/modifiers/beauty_dish_55.glb',
  },
];

export const GRIDS: LightModifier[] = [
  {
    id: 'grid_10deg',
    name: 'Honeycomb Grid 10°',
    type: 'grid',
    size: [0.2, 0.2],
    shape: 'circular',
    diffusion: 0.0,
    lightLoss: 0.5,
    beamAngle: 10,
    mountType: 'bowens',
    price: 49,
    rentalPrice: 5,
  },
  {
    id: 'grid_30deg',
    name: 'Honeycomb Grid 30°',
    type: 'grid',
    size: [0.2, 0.2],
    shape: 'circular',
    diffusion: 0.0,
    lightLoss: 0.3,
    beamAngle: 30,
    mountType: 'bowens',
    price: 49,
    rentalPrice: 5,
  },
];

export const ALL_MODIFIERS: LightModifier[] = [
  ...SOFTBOXES,
  ...UMBRELLAS,
  ...BEAUTY_DISHES,
  ...GRIDS,
];

