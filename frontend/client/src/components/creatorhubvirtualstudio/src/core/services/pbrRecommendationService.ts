/**
 * PBR Recommendation Service
 * 
 * Recommends props, materials, and scene elements based on character type,
 * HDRI environment, and lighting setup. Provides contextual scene building
 * suggestions for realistic photography simulation.
 */

import { logger } from './logger';

const log = logger.module('PBRRecommendation, ');

export interface PBRItem {
  id: string;
  name: string;
  type: 'prop, ' | 'backdrop' | 'floor' | 'furniture' | 'tool' | 'accessory';
  category: string;
  thumbnail: string;
  model?: string; // GLB/GLTF model path
  material?: {
    color?: string;
    roughness?: number;
    metalness?: number;
    texture?: string;
  };
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
}

export interface PBRRecommendation {
  id: string;
  name: string;
  description: string;
  category: 'essential' | 'recommended' | 'optional' | 'atmosphere';
  items: PBRItem[];
  matchScore: number;
  reason: string;
  previewImage?: string;
}

// Predefined PBR item library
const PBR_ITEMS: Record<string, PBRItem> = {
  // Barbershop Props
  'barber-chair': {
    id: 'barber-chair',
    name: 'Barber Chair',
    type: 'furniture',
    category: 'barbershop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/barber_chair.png',
    material: { color: '#8B0000', roughness: 0.3, metalness: 0.8 },
    position: { x: 0, y: 0, z: 0 },
  }, 'barber-pole': {
    id: 'barber-pole',
    name: 'Barber Pole',
    type: 'prop',
    category: 'barbershop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/barber_pole.png',
    material: { color: '#FFFFFF', roughness: 0.2, metalness: 0.1 },
    position: { x: -2, y: 0, z: 0 },
  }, 'mirror-salon': {
    id: 'mirror-salon',
    name: 'Salon Mirror',
    type: 'furniture',
    category: 'barbershop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/mirror.png',
    material: { color: '#C0C0C0', roughness: 0.05, metalness: 1.0 },
    position: { x: 0, y: 1.5, z: -1 },
  }, 'scissors-comb': {
    id: 'scissors-comb',
    name: 'Scissors & Comb Set',
    type: 'tool',
    category: 'barbershop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/scissors.png',
    material: { color: '#C0C0C0', roughness: 0.2, metalness: 0.9 },
    position: { x: 0.5, y: 1.2, z: -0.5 },
    scale: { x: 0.1, y: 0.1, z: 0.1 },
  }, 'towel-rack': {
    id: 'towel-rack',
    name: 'Towel Rack',
    type: 'prop',
    category: 'barbershop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/towel_rack.png',
    material: { color: '#FFFFFF', roughness: 0.8, metalness: 0.1 },
  },
  
  // Kitchen/Chef Props
  'chef-counter': {
    id: 'chef-counter',
    name: 'Stainless Steel Counter',
    type: 'furniture',
    category: 'kitchen',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/steel_counter.png',
    material: { color: '#C0C0C0', roughness: 0.3, metalness: 0.9 },
    position: { x: 0, y: 0, z: -1 },
  }, 'knife-block': {
    id: 'knife-block',
    name: 'Knife Block',
    type: 'tool',
    category: 'kitchen',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/knife_block.png',
    material: { color: '#4a3728', roughness: 0.6, metalness: 0.0 },
    position: { x: 0.8, y: 0.9, z: -0.8 },
  }, 'cutting-board': {
    id: 'cutting-board',
    name: 'Cutting Board',
    type: 'tool',
    category: 'kitchen',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/cutting_board.png',
    material: { color: '#8B7355', roughness: 0.7, metalness: 0.0 },
  }, 'pot-pan-set': {
    id: 'pot-pan-set',
    name: 'Pots & Pans',
    type: 'tool',
    category: 'kitchen',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/pots.png',
    material: { color: '#C0C0C0', roughness: 0.25, metalness: 0.95 },
  }, 'spice-rack': {
    id: 'spice-rack',
    name: 'Spice Rack',
    type: 'prop',
    category: 'kitchen',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/spice_rack.png',
    material: { color: '#8B4513', roughness: 0.5, metalness: 0.0 },
  },
  
  // Workshop/Mechanic Props
  'tool-chest': {
    id: 'tool-chest',
    name: 'Tool Chest',
    type: 'furniture',
    category: 'workshop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/tool_chest.png',
    material: { color: '#B22222', roughness: 0.4, metalness: 0.7 },
    position: { x: -2, y: 0, z: 0 },
  }, 'workbench': {
    id: 'workbench',
    name: 'Workbench',
    type: 'furniture',
    category: 'workshop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/workbench.png',
    material: { color: '#5C4033', roughness: 0.7, metalness: 0.1 },
    position: { x: 0, y: 0, z: -1 },
  }, 'wrench-set': {
    id: 'wrench-set',
    name: 'Wrench Set',
    type: 'tool',
    category: 'workshop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/wrenches.png',
    material: { color: '#C0C0C0', roughness: 0.3, metalness: 0.85 },
  }, 'car-lift': {
    id: 'car-lift',
    name: 'Car Lift',
    type: 'furniture',
    category: 'workshop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/car_lift.png',
    material: { color: '#2F4F4F', roughness: 0.5, metalness: 0.6 },
  }, 'oil-cans': {
    id: 'oil-cans',
    name: 'Oil Cans',
    type: 'prop',
    category: 'workshop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/oil_cans.png',
    material: { color: '#696969', roughness: 0.4, metalness: 0.5 },
  },
  
  // Tattoo Studio Props
  'tattoo-chair': {
    id: 'tattoo-chair',
    name: 'Tattoo Chair',
    type: 'furniture',
    category: 'tattoo',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/tattoo_chair.png',
    material: { color: '#1a1a1a', roughness: 0.4, metalness: 0.3 },
    position: { x: 0, y: 0, z: 0 },
  }, 'ink-station': {
    id: 'ink-station',
    name: 'Ink Station',
    type: 'furniture',
    category: 'tattoo',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/ink_station.png',
    material: { color: '#2a2a2a', roughness: 0.5, metalness: 0.4 },
  }, 'tattoo-flash': {
    id: 'tattoo-flash',
    name: 'Flash Art Wall',
    type: 'backdrop',
    category: 'tattoo',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/flash_art.png',
    material: { color: '#FFFFFF', roughness: 0.9, metalness: 0.0 },
  }, 'neon-sign': {
    id: 'neon-sign',
    name: 'Neon Sign',
    type: 'prop',
    category: 'tattoo',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/neon_sign.png',
    material: { color: '#FF1493', roughness: 0.1, metalness: 0.0 },
  },
  
  // Studio/Portrait Props
  'stool-posing': {
    id: 'stool-posing',
    name: 'Posing Stool',
    type: 'furniture',
    category: 'studio',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/stool.png',
    material: { color: '#2a2a2a', roughness: 0.5, metalness: 0.3 },
    position: { x: 0, y: 0, z: 0 },
  }, 'apple-box': {
    id: 'apple-box',
    name: 'Apple Box Set',
    type: 'prop',
    category: 'studio',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/apple_box.png',
    material: { color: '#D2691E', roughness: 0.8, metalness: 0.0 },
  }, 'v-flat-white': {
    id: 'v-flat-white',
    name: 'V-Flat (White)',
    type: 'prop',
    category: 'studio',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/v_flat_white.png',
    material: { color: '#FFFFFF', roughness: 0.9, metalness: 0.0 },
  }, 'v-flat-black': {
    id: 'v-flat-black',
    name: 'V-Flat (Black)',
    type: 'prop',
    category: 'studio',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/v_flat_black.png',
    material: { color: '#1a1a1a', roughness: 0.95, metalness: 0.0 },
  },
  
  // ============================================================================
  // SCHOOL PHOTOGRAPHY PROPS
  // ============================================================================
  
  // Seating
  'school-stool': {
    id: 'school-stool',
    name: 'School Photo Stool',
    type: 'furniture',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/stool.png',
    material: { color: '#2F2F2F', roughness: 0.5, metalness: 0.2 },
    position: { x: 0, y: 0, z: 0 },
  }, 'riser-3step': {
    id: 'riser-3step',
    name: '3-Step Riser',
    type: 'furniture',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/riser.png',
    material: { color: '#4A4A4A', roughness: 0.7, metalness: 0.1 },
    position: { x: 0, y: 0, z: -1 },
    scale: { x: 4, y: 1, z: 2 },
  }, 'riser-4step': {
    id: 'riser-4step',
    name: '4-Step Riser',
    type: 'furniture',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/riser.png',
    material: { color: '#4A4A4A', roughness: 0.7, metalness: 0.1 },
    position: { x: 0, y: 0, z: -1 },
    scale: { x: 5, y: 1.3, z: 2.5 },
  }, 'folding-chair-school': {
    id: 'folding-chair-school',
    name: 'Folding Chair',
    type: 'furniture',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/folding_chair.png',
    material: { color: '#3D3D3D', roughness: 0.5, metalness: 0.6 },
    position: { x: 0, y: 0, z: 0 },
  }, 'bench-wooden': {
    id: 'bench-wooden',
    name: 'Wooden Bench',
    type: 'furniture',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/wooden_bench.png',
    material: { color: '#8B7355', roughness: 0.7, metalness: 0.0 },
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 2, y: 1, z: 1 },
  }, 'step-box': {
    id: 'step-box',
    name: 'Step Box',
    type: 'prop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/step_box.png',
    material: { color: '#2F2F2F', roughness: 0.6, metalness: 0.2 },
    position: { x: 0, y: 0, z: 0 },
  },
  
  // Backdrops
  'backdrop-school-grey': {
    id: 'backdrop-school-grey',
    name: 'Mottled Grey Backdrop',
    type: 'backdrop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/mottled_grey.png',
    material: { color: '#6B6B6B', roughness: 0.9, metalness: 0.0, texture: 'mottled' },
    position: { x: 0, y: 0, z: -3 },
    scale: { x: 6, y: 4, z: 1 },
  }, 'backdrop-school-blue': {
    id: 'backdrop-school-blue',
    name: 'Classic Blue Backdrop',
    type: 'backdrop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/blue_backdrop.png',
    material: { color: '#4169E1', roughness: 0.9, metalness: 0.0, texture: 'mottled' },
    position: { x: 0, y: 0, z: -3 },
    scale: { x: 6, y: 4, z: 1 },
  }, 'backdrop-school-green': {
    id: 'backdrop-school-green',
    name: 'Classic Green Backdrop',
    type: 'backdrop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/green_backdrop.png',
    material: { color: '#2E8B57', roughness: 0.9, metalness: 0.0, texture: 'mottled' },
    position: { x: 0, y: 0, z: -3 },
    scale: { x: 6, y: 4, z: 1 },
  }, 'backdrop-school-brown': {
    id: 'backdrop-school-brown',
    name: 'Mottled Brown Backdrop',
    type: 'backdrop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/brown_backdrop.png',
    material: { color: '#8B7355', roughness: 0.9, metalness: 0.0, texture: 'mottled' },
    position: { x: 0, y: 0, z: -3 },
    scale: { x: 6, y: 4, z: 1 },
  }, 'backdrop-graduation': {
    id: 'backdrop-graduation',
    name: 'Graduation Backdrop',
    type: 'backdrop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/graduation_bg.png',
    material: { color: '#1A1A3E', roughness: 0.85, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
    scale: { x: 6, y: 4, z: 1 },
  }, 'backdrop-muslin-grey': {
    id: 'backdrop-muslin-grey',
    name: 'Muslin Grey',
    type: 'backdrop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/muslin_grey.png',
    material: { color: '#808080', roughness: 0.95, metalness: 0.0, texture: 'muslin' },
    position: { x: 0, y: 0, z: -3 },
    scale: { x: 6, y: 4, z: 1 },
  },
  
  // Group Photo Props
  'floor-tape-marks': {
    id: 'floor-tape-marks',
    name: 'Floor Position Markers',
    type: 'prop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/tape_marks.png',
    material: { color: '#FFD700', roughness: 0.8, metalness: 0.0 },
    position: { x: 0, y: 0.01, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
  }, 'number-cards': {
    id: 'number-cards',
    name: 'Class Number Cards',
    type: 'prop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/number_cards.png',
    material: { color: '#FFFFFF', roughness: 0.9, metalness: 0.0 },
    position: { x: 0, y: 0.5, z: 0 },
    scale: { x: 0.3, y: 0.3, z: 0.01 },
  }, 'school-banner': {
    id: 'school-banner',
    name: 'School Banner',
    type: 'prop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/banner.png',
    material: { color: '#1A1A8E', roughness: 0.8, metalness: 0.0 },
    position: { x: 0, y: 2.5, z: -2.5 },
    scale: { x: 3, y: 0.8, z: 0.1 },
  }, 'year-sign': {
    id: 'year-sign',
    name: 'Graduation Year Sign',
    type: 'prop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/year_sign.png',
    material: { color: '#FFD700', roughness: 0.3, metalness: 0.7 },
    position: { x: 0, y: 0.8, z: 1 },
    scale: { x: 0.6, y: 0.4, z: 0.1 },
  },
  
  // Sports Photography
  'sports-banner': {
    id: 'sports-banner',
    name: 'Team Banner',
    type: 'backdrop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/team_banner.png',
    material: { color: '#1A1A8E', roughness: 0.8, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
    scale: { x: 6, y: 4, z: 1 },
  }, 'football-prop': {
    id: 'football-prop',
    name: 'Football',
    type: 'prop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/football.png',
    material: { color: '#8B4513', roughness: 0.7, metalness: 0.0 },
    position: { x: 0, y: 0.15, z: 0.5 },
    scale: { x: 0.3, y: 0.3, z: 0.3 },
  }, 'basketball-prop': {
    id: 'basketball-prop',
    name: 'Basketball',
    type: 'prop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/basketball.png',
    material: { color: '#FF6B35', roughness: 0.6, metalness: 0.0 },
    position: { x: 0, y: 0.12, z: 0.5 },
    scale: { x: 0.24, y: 0.24, z: 0.24 },
  }, 'soccer-ball-prop': {
    id: 'soccer-ball-prop',
    name: 'Soccer Ball',
    type: 'prop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/soccer_ball.png',
    material: { color: '#FFFFFF', roughness: 0.5, metalness: 0.0 },
    position: { x: 0, y: 0.11, z: 0.5 },
    scale: { x: 0.22, y: 0.22, z: 0.22 },
  },
  
  // Graduation Props
  'cap-gown-stand': {
    id: 'cap-gown-stand',
    name: 'Cap & Gown Display',
    type: 'prop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/cap_gown.png',
    material: { color: '#1A1A1A', roughness: 0.7, metalness: 0.1 },
    position: { x: 1.5, y: 0, z: 0 },
  }, 'diploma-prop': {
    id: 'diploma-prop',
    name: 'Diploma Prop',
    type: 'prop',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/diploma.png',
    material: { color: '#F5F5DC', roughness: 0.8, metalness: 0.0 },
    position: { x: 0, y: 1, z: 0.3 },
    scale: { x: 0.3, y: 0.2, z: 0.02 },
  }, 'tassel': {
    id: 'tassel',
    name: 'Graduation Tassel',
    type: 'accessory',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/tassel.png',
    material: { color: '#FFD700', roughness: 0.6, metalness: 0.3 },
  },
  
  // Floor Options
  'floor-gym': {
    id: 'floor-gym',
    name: 'Gymnasium Floor',
    type: 'floor',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/gym_floor.png',
    material: { color: '#CD853F', roughness: 0.4, metalness: 0.1, texture: 'gym-wood' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 15, y: 15, z: 1 },
  }, 'floor-stage': {
    id: 'floor-stage',
    name: 'Stage Floor',
    type: 'floor',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/stage_floor.png',
    material: { color: '#2F2F2F', roughness: 0.3, metalness: 0.2, texture: 'stage' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  }, 'floor-carpet-blue': {
    id: 'floor-carpet-blue',
    name: 'Blue Carpet',
    type: 'floor',
    category: 'school',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/carpet_blue.png',
    material: { color: '#1E3A5F', roughness: 0.9, metalness: 0.0, texture: 'carpet' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 8, y: 8, z: 1 },
  },
  
  // Backdrops
  'backdrop-grey': {
    id: 'backdrop-grey',
    name: 'Seamless Grey',
    type: 'backdrop',
    category: 'backdrop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/grey_backdrop.png',
    material: { color: '#808080', roughness: 0.9, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
    scale: { x: 6, y: 4, z: 1 },
  }, 'backdrop-white': {
    id: 'backdrop-white',
    name: 'Seamless White',
    type: 'backdrop',
    category: 'backdrop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/white_backdrop.png',
    material: { color: '#F5F5F5', roughness: 0.95, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
    scale: { x: 6, y: 4, z: 1 },
  }, 'backdrop-black': {
    id: 'backdrop-black',
    name: 'Seamless Black',
    type: 'backdrop',
    category: 'backdrop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/black_backdrop.png',
    material: { color: '#1a1a1a', roughness: 0.98, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
    scale: { x: 6, y: 4, z: 1 },
  }, 'backdrop-brick': {
    id: 'backdrop-brick',
    name: 'Brick Wall',
    type: 'backdrop',
    category: 'backdrop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/brick_wall.png',
    material: { color: '#8B4513', roughness: 0.85, metalness: 0.0, texture: 'brick' },
    position: { x: 0, y: 0, z: -3 },
  }, 'backdrop-wood': {
    id: 'backdrop-wood',
    name: 'Wood Paneling',
    type: 'backdrop',
    category: 'backdrop',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/wood_panel.png',
    material: { color: '#8B7355', roughness: 0.6, metalness: 0.0, texture: 'wood' },
    position: { x: 0, y: 0, z: -3 },
  },
  
  // Floors
  'floor-concrete': {
    id: 'floor-concrete',
    name: 'Concrete Floor',
    type: 'floor',
    category: 'floor',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/concrete_floor.png',
    material: { color: '#808080', roughness: 0.8, metalness: 0.0, texture: 'concrete' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  }, 'floor-wood': {
    id: 'floor-wood',
    name: 'Hardwood Floor',
    type: 'floor',
    category: 'floor',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/hardwood_floor.png',
    material: { color: '#8B7355', roughness: 0.4, metalness: 0.0, texture: 'hardwood' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  }, 'floor-tile': {
    id: 'floor-tile',
    name: 'Tile Floor',
    type: 'floor',
    category: 'floor',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/tile_floor.png',
    material: { color: '#F5F5DC', roughness: 0.3, metalness: 0.1, texture: 'tile' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  }, 'floor-checkered': {
    id: 'floor-checkered',
    name: 'Checkered Floor',
    type: 'floor',
    category: 'floor',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/checkered_floor.png',
    material: { color: '#FFFFFF', roughness: 0.3, metalness: 0.1, texture: 'checkered' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  },
  
  // ============================================================================
  // FILM CHARACTER PROPS
  // ============================================================================
  
  // Film Noir Props
  'venetian-blinds': {
    id: 'venetian-blinds',
    name: 'Venetian Blinds',
    type: 'prop',
    category: 'film-noir',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/venetian_blinds.png',
    material: { color: '#D2B48C', roughness: 0.6, metalness: 0.1 },
    position: { x: 2, y: 2, z: -2 },
  }, 'fedora-hat': {
    id: 'fedora-hat',
    name: 'Fedora Hat',
    type: 'accessory',
    category: 'film-noir',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/fedora.png',
    material: { color: '#2F2F2F', roughness: 0.7, metalness: 0.0 },
  }, 'whiskey-glass': {
    id: 'whiskey-glass',
    name: 'Whiskey Glass',
    type: 'prop',
    category: 'film-noir',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/whiskey_glass.png',
    material: { color: '#D4A574', roughness: 0.1, metalness: 0.0 },
  }, 'desk-detective': {
    id: 'desk-detective',
    name: 'Detective Desk',
    type: 'furniture',
    category: 'film-noir',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/desk_wood.png',
    material: { color: '#4A3728', roughness: 0.5, metalness: 0.0 },
  }, 'backdrop-noir': {
    id: 'backdrop-noir',
    name: 'Noir Office Wall',
    type: 'backdrop',
    category: 'film-noir',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/noir_wall.png',
    material: { color: '#2C2C2C', roughness: 0.8, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
  },
  
  // Sci-Fi Props
  'console-scifi': {
    id: 'console-scifi',
    name: 'Sci-Fi Console',
    type: 'furniture',
    category: 'sci-fi',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/console_scifi.png',
    material: { color: '#1a1a2e', roughness: 0.3, metalness: 0.8 },
  }, 'hologram-display': {
    id: 'hologram-display',
    name: 'Holographic Display',
    type: 'prop',
    category: 'sci-fi',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/hologram.png',
    material: { color: '#00D4FF', roughness: 0.1, metalness: 0.0 },
  }, 'floor-scifi': {
    id: 'floor-scifi',
    name: 'Sci-Fi Metal Floor',
    type: 'floor',
    category: 'sci-fi',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/floor_scifi.png',
    material: { color: '#4A5568', roughness: 0.4, metalness: 0.7, texture: 'metal-grid' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  }, 'backdrop-scifi': {
    id: 'backdrop-scifi',
    name: 'Spacecraft Interior',
    type: 'backdrop',
    category: 'sci-fi',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/spacecraft.png',
    material: { color: '#1A1A2E', roughness: 0.4, metalness: 0.6 },
    position: { x: 0, y: 0, z: -3 },
  }, 'neon-lights-scifi': {
    id: 'neon-lights-scifi',
    name: 'Neon Light Strips',
    type: 'prop',
    category: 'sci-fi',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/neon_strips.png',
    material: { color: '#00FFFF', roughness: 0.1, metalness: 0.0 },
  },
  
  // Western Props
  'saloon-doors': {
    id: 'saloon-doors',
    name: 'Saloon Doors',
    type: 'prop',
    category: 'western',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/saloon_doors.png',
    material: { color: '#8B4513', roughness: 0.7, metalness: 0.1 },
  }, 'wagon-wheel': {
    id: 'wagon-wheel',
    name: 'Wagon Wheel',
    type: 'prop',
    category: 'western',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/wagon_wheel.png',
    material: { color: '#5C4033', roughness: 0.8, metalness: 0.0 },
  }, 'barrel-wooden': {
    id: 'barrel-wooden',
    name: 'Wooden Barrel',
    type: 'prop',
    category: 'western',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/barrel.png',
    material: { color: '#6B4423', roughness: 0.7, metalness: 0.0 },
  }, 'floor-dusty': {
    id: 'floor-dusty',
    name: 'Dusty Desert Floor',
    type: 'floor',
    category: 'western',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/dusty_floor.png',
    material: { color: '#C4A574', roughness: 0.9, metalness: 0.0, texture: 'sand' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  }, 'backdrop-saloon': {
    id: 'backdrop-saloon',
    name: 'Saloon Interior',
    type: 'backdrop',
    category: 'western',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/saloon.png',
    material: { color: '#5C4033', roughness: 0.6, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
  },
  
  // Horror Props
  'cobwebs': {
    id: 'cobwebs',
    name: 'Cobwebs',
    type: 'prop',
    category: 'horror',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/cobwebs.png',
    material: { color: '#FFFFFF', roughness: 0.9, metalness: 0.0 },
  }, 'candelabra': {
    id: 'candelabra',
    name: 'Gothic Candelabra',
    type: 'prop',
    category: 'horror',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/candelabra.png',
    material: { color: '#1A1A1A', roughness: 0.4, metalness: 0.8 },
  }, 'tombstone': {
    id: 'tombstone',
    name: 'Tombstone',
    type: 'prop',
    category: 'horror',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/tombstone.png',
    material: { color: '#696969', roughness: 0.8, metalness: 0.0 },
  }, 'floor-stone-old': {
    id: 'floor-stone-old',
    name: 'Old Stone Floor',
    type: 'floor',
    category: 'horror',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/stone_floor.png',
    material: { color: '#4A4A4A', roughness: 0.9, metalness: 0.0, texture: 'stone-cracked' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  }, 'backdrop-crypt': {
    id: 'backdrop-crypt',
    name: 'Crypt Wall',
    type: 'backdrop',
    category: 'horror',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/crypt.png',
    material: { color: '#2F2F2F', roughness: 0.85, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
  },
  
  // Cosmic Horror Props
  'tentacle-statue': {
    id: 'tentacle-statue',
    name: 'Eldritch Statue',
    type: 'prop',
    category: 'cosmic-horror',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/tentacle_statue.png',
    material: { color: '#1A3A2A', roughness: 0.5, metalness: 0.3 },
  }, 'ancient-tome': {
    id: 'ancient-tome',
    name: 'Ancient Tome',
    type: 'prop',
    category: 'cosmic-horror',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/ancient_book.png',
    material: { color: '#3D2B1F', roughness: 0.8, metalness: 0.0 },
  }, 'backdrop-void': {
    id: 'backdrop-void',
    name: 'The Void',
    type: 'backdrop',
    category: 'cosmic-horror',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/void.png',
    material: { color: '#0A0A1A', roughness: 0.95, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
  },
  
  // Fantasy Props
  'sword-medieval': {
    id: 'sword-medieval',
    name: 'Medieval Sword',
    type: 'prop',
    category: 'fantasy',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/sword.png',
    material: { color: '#C0C0C0', roughness: 0.3, metalness: 0.9 },
  }, 'throne-royal': {
    id: 'throne-royal',
    name: 'Royal Throne',
    type: 'furniture',
    category: 'fantasy',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/throne.png',
    material: { color: '#8B0000', roughness: 0.6, metalness: 0.3 },
  }, 'crystal-magic': {
    id: 'crystal-magic',
    name: 'Magic Crystal',
    type: 'prop',
    category: 'fantasy',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/crystal.png',
    material: { color: '#9966CC', roughness: 0.1, metalness: 0.2 },
  }, 'floor-castle': {
    id: 'floor-castle',
    name: 'Castle Stone Floor',
    type: 'floor',
    category: 'fantasy',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/castle_floor.png',
    material: { color: '#696969', roughness: 0.7, metalness: 0.0, texture: 'stone-cobble' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  }, 'backdrop-castle': {
    id: 'backdrop-castle',
    name: 'Castle Interior',
    type: 'backdrop',
    category: 'fantasy',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/castle.png',
    material: { color: '#4A4A4A', roughness: 0.75, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
  },
  
  // Action Props
  'crate-military': {
    id: 'crate-military',
    name: 'Military Crate',
    type: 'prop',
    category: 'action',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/military_crate.png',
    material: { color: '#4A5D23', roughness: 0.7, metalness: 0.2 },
  }, 'sandbags': {
    id: 'sandbags',
    name: 'Sandbag Wall',
    type: 'prop',
    category: 'action',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/sandbags.png',
    material: { color: '#C4A574', roughness: 0.9, metalness: 0.0 },
  }, 'backdrop-warehouse-action': {
    id: 'backdrop-warehouse-action',
    name: 'Action Warehouse',
    type: 'backdrop',
    category: 'action',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/warehouse_action.png',
    material: { color: '#3D3D3D', roughness: 0.8, metalness: 0.1 },
    position: { x: 0, y: 0, z: -3 },
  },
  
  // Period Drama Props
  'chandelier-crystal': {
    id: 'chandelier-crystal',
    name: 'Crystal Chandelier',
    type: 'prop',
    category: 'period-drama',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/chandelier.png',
    material: { color: '#FFFFFF', roughness: 0.1, metalness: 0.3 },
  }, 'chair-victorian': {
    id: 'chair-victorian',
    name: 'Victorian Chair',
    type: 'furniture',
    category: 'period-drama',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/victorian_chair.png',
    material: { color: '#8B4513', roughness: 0.5, metalness: 0.0 },
  }, 'mirror-ornate': {
    id: 'mirror-ornate',
    name: 'Ornate Mirror',
    type: 'prop',
    category: 'period-drama',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/ornate_mirror.png',
    material: { color: '#FFD700', roughness: 0.3, metalness: 0.7 },
  }, 'floor-marble': {
    id: 'floor-marble',
    name: 'Marble Floor',
    type: 'floor',
    category: 'period-drama',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/marble_floor.png',
    material: { color: '#F5F5F5', roughness: 0.2, metalness: 0.1, texture: 'marble' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  }, 'backdrop-manor': {
    id: 'backdrop-manor',
    name: 'Manor Interior',
    type: 'backdrop',
    category: 'period-drama',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/manor.png',
    material: { color: '#8B7355', roughness: 0.6, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
  },
  
  // Asian Cinema Props
  'lantern-paper': {
    id: 'lantern-paper',
    name: 'Paper Lantern',
    type: 'prop',
    category: 'asian-cinema',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/paper_lantern.png',
    material: { color: '#FF4500', roughness: 0.8, metalness: 0.0 },
  }, 'katana-stand': {
    id: 'katana-stand',
    name: 'Katana Stand',
    type: 'prop',
    category: 'asian-cinema',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/katana_stand.png',
    material: { color: '#1A1A1A', roughness: 0.5, metalness: 0.0 },
  }, 'screen-shoji': {
    id: 'screen-shoji',
    name: 'Shoji Screen',
    type: 'prop',
    category: 'asian-cinema',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/shoji.png',
    material: { color: '#F5F5DC', roughness: 0.9, metalness: 0.0 },
  }, 'floor-tatami': {
    id: 'floor-tatami',
    name: 'Tatami Floor',
    type: 'floor',
    category: 'asian-cinema',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/tatami.png',
    material: { color: '#C4A574', roughness: 0.85, metalness: 0.0, texture: 'tatami' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  }, 'backdrop-dojo': {
    id: 'backdrop-dojo',
    name: 'Dojo Interior',
    type: 'backdrop',
    category: 'asian-cinema',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/dojo.png',
    material: { color: '#8B7355', roughness: 0.7, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
  },
  
  // Superhero Props
  'city-rooftop': {
    id: 'city-rooftop',
    name: 'City Rooftop Edge',
    type: 'prop',
    category: 'superhero',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/rooftop.png',
    material: { color: '#4A4A4A', roughness: 0.7, metalness: 0.2 },
  }, 'spotlight-hero': {
    id: 'spotlight-hero',
    name: 'Hero Spotlight',
    type: 'prop',
    category: 'superhero',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/spotlight.png',
    material: { color: '#FFD700', roughness: 0.1, metalness: 0.0 },
  }, 'backdrop-cityscape': {
    id: 'backdrop-cityscape',
    name: 'Night Cityscape',
    type: 'backdrop',
    category: 'superhero',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/cityscape.png',
    material: { color: '#1A1A2E', roughness: 0.8, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
  }, 'floor-rooftop': {
    id: 'floor-rooftop',
    name: 'Rooftop Surface',
    type: 'floor',
    category: 'superhero',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/rooftop_floor.png',
    material: { color: '#3D3D3D', roughness: 0.8, metalness: 0.1, texture: 'asphalt' },
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: -90, y: 0, z: 0 },
    scale: { x: 10, y: 10, z: 1 },
  },
  
  // ============================================================================
  // VIDEOGRAPHER / FILM PRODUCTION PROPS
  // ============================================================================
  
  // Director & Production
  'directors-chair': {
    id: 'directors-chair',
    name: 'Director\'s Chair',
    type: 'furniture',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/directors_chair.png',
    material: { color: '#1A1A1A', roughness: 0.7, metalness: 0.2 },
    position: { x: -2, y: 0, z: 0 },
  }, 'clapperboard': {
    id: 'clapperboard',
    name: 'Clapperboard',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/clapperboard.png',
    material: { color: '#1A1A1A', roughness: 0.6, metalness: 0.0 },
    position: { x: 0.5, y: 1.2, z: 0.5 },
    scale: { x: 0.3, y: 0.3, z: 0.3 },
  }, 'monitor-director': {
    id: 'monitor-director',
    name: 'Director\'s Monitor',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/director_monitor.png',
    material: { color: '#2A2A2A', roughness: 0.4, metalness: 0.6 },
    position: { x: -1.5, y: 1.0, z: 0 },
  }, 'camera-cinema': {
    id: 'camera-cinema',
    name: 'Cinema Camera',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/cinema_camera.png',
    material: { color: '#1A1A1A', roughness: 0.3, metalness: 0.8 },
  },
  
  // Grip & Support
  'c-stand': {
    id: 'c-stand',
    name: 'C-Stand',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/c_stand.png',
    material: { color: '#C0C0C0', roughness: 0.4, metalness: 0.8 },
    position: { x: 2, y: 0, z: -1 },
  }, 'tripod-video': {
    id: 'tripod-video',
    name: 'Video Tripod',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/video_tripod.png',
    material: { color: '#2A2A2A', roughness: 0.5, metalness: 0.7 },
  }, 'sandbag-grip': {
    id: 'sandbag-grip',
    name: 'Sandbag',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/sandbag.png',
    material: { color: '#4A4A4A', roughness: 0.9, metalness: 0.0 },
    position: { x: 2.5, y: 0, z: -1 },
    scale: { x: 0.5, y: 0.5, z: 0.5 },
  },
  
  // Audio
  'boom-mic': {
    id: 'boom-mic',
    name: 'Boom Microphone',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/boom_mic.png',
    material: { color: '#1A1A1A', roughness: 0.5, metalness: 0.3 },
    position: { x: 0, y: 2.5, z: 0.5 },
  }, 'lav-mic': {
    id: 'lav-mic',
    name: 'Lavalier Mic',
    type: 'accessory',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/lav_mic.png',
    material: { color: '#2A2A2A', roughness: 0.4, metalness: 0.5 },
  }, 'audio-mixer': {
    id: 'audio-mixer',
    name: 'Audio Mixer',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/audio_mixer.png',
    material: { color: '#1A1A1A', roughness: 0.3, metalness: 0.6 },
    position: { x: -2, y: 1, z: 0.5 },
  },
  
  // Continuous Lighting
  'led-panel': {
    id: 'led-panel',
    name: 'LED Panel',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/led_panel.png',
    material: { color: '#2A2A2A', roughness: 0.3, metalness: 0.7 },
    position: { x: -2, y: 2, z: 1 },
  }, 'tube-light': {
    id: 'tube-light',
    name: 'RGB Tube Light',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/tube_light.png',
    material: { color: '#FFFFFF', roughness: 0.1, metalness: 0.0 },
  }, 'fresnel-light': {
    id: 'fresnel-light',
    name: 'Fresnel Light',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/fresnel.png',
    material: { color: '#2A2A2A', roughness: 0.4, metalness: 0.6 },
  },
  
  // Green Screen / VFX
  'green-screen': {
    id: 'green-screen',
    name: 'Green Screen',
    type: 'backdrop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/green_screen.png',
    material: { color: '#00FF00', roughness: 0.8, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
  }, 'tracking-markers': {
    id: 'tracking-markers',
    name: 'Tracking Markers',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/tracking_markers.png',
    material: { color: '#00FF00', roughness: 0.9, metalness: 0.0 },
  },
  
  // Camera Movement
  'dolly-track': {
    id: 'dolly-track',
    name: 'Dolly Track',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/dolly_track.png',
    material: { color: '#4A4A4A', roughness: 0.5, metalness: 0.7 },
    position: { x: 0, y: 0, z: 2 },
  }, 'gimbal': {
    id: 'gimbal',
    name: 'Gimbal Stabilizer',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/gimbal.png',
    material: { color: '#1A1A1A', roughness: 0.3, metalness: 0.8 },
  },
  
  // Broadcast
  'teleprompter': {
    id: 'teleprompter',
    name: 'Teleprompter',
    type: 'prop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/teleprompter.png',
    material: { color: '#1A1A1A', roughness: 0.4, metalness: 0.5 },
    position: { x: 0, y: 1.5, z: 2 },
  }, 'broadcast-desk': {
    id: 'broadcast-desk',
    name: 'Broadcast Desk',
    type: 'furniture',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/broadcast_desk.png',
    material: { color: '#2A2A2A', roughness: 0.3, metalness: 0.5 },
    position: { x: 0, y: 0, z: 0 },
  },
  
  // Interview Setup
  'interview-chair': {
    id: 'interview-chair',
    name: 'Interview Chair',
    type: 'furniture',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/interview_chair.png',
    material: { color: '#2F2F2F', roughness: 0.6, metalness: 0.1 },
    position: { x: 0, y: 0, z: 0 },
  },
  
  // Backdrops for Video
  'backdrop-interview': {
    id: 'backdrop-interview',
    name: 'Interview Backdrop',
    type: 'backdrop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/interview_backdrop.png',
    material: { color: '#3D3D3D', roughness: 0.8, metalness: 0.0 },
    position: { x: 0, y: 0, z: -3 },
  }, 'backdrop-broadcast': {
    id: 'backdrop-broadcast',
    name: 'Broadcast Background',
    type: 'backdrop',
    category: 'video-production',
    thumbnail: 'https://cdn.polyhaven.com/asset_img/thumbs/broadcast_bg.png',
    material: { color: '#1A1A2E', roughness: 0.6, metalness: 0.1 },
    position: { x: 0, y: 0, z: -3 },
  },
};

// Profession to PBR recommendations mapping
const PROFESSION_PBR_MAP: Record<string, { essential: string[]; recommended: string[]; optional: string[] }> = {
  // ============================================================================
  // SCHOOL PHOTOGRAPHY
  // ============================================================================
  'school-portrait': {
    essential: ['school-stool','backdrop-school-grey'],
    recommended: ['step-box','floor-carpet-blue','apple-box'],
    optional: ['v-flat-white','floor-tape-marks'],
  }, 'yearbook': {
    essential: ['school-stool','backdrop-school-grey'],
    recommended: ['step-box','backdrop-school-blue','floor-carpet-blue'],
    optional: ['apple-box','v-flat-white'],
  }, 'class-photo': {
    essential: ['riser-3step','backdrop-school-grey','floor-tape-marks'],
    recommended: ['riser-4step','bench-wooden','folding-chair-school','school-banner'],
    optional: ['floor-gym','number-cards','year-sign'],
  }, 'group-school': {
    essential: ['riser-3step','backdrop-school-grey'],
    recommended: ['bench-wooden','folding-chair-school','floor-tape-marks'],
    optional: ['riser-4step','school-banner'],
  }, 'graduation': {
    essential: ['school-stool','backdrop-graduation'],
    recommended: ['diploma-prop','year-sign','tassel'],
    optional: ['cap-gown-stand','floor-stage'],
  }, 'sports-team': {
    essential: ['riser-3step','sports-banner','floor-gym'],
    recommended: ['bench-wooden','floor-tape-marks'],
    optional: ['football-prop','basketball-prop','soccer-ball-prop'],
  }, 'preschool': {
    essential: ['school-stool','backdrop-school-blue'],
    recommended: ['step-box','floor-carpet-blue'],
    optional: ['apple-box','backdrop-school-green'],
  }, 'elementary': {
    essential: ['school-stool','backdrop-school-grey'],
    recommended: ['step-box','floor-carpet-blue'],
    optional: ['apple-box','backdrop-school-blue'],
  }, 'faculty': {
    essential: ['school-stool','backdrop-school-grey'],
    recommended: ['backdrop-muslin-grey','step-box'],
    optional: ['v-flat-white','floor-carpet-blue'],
  }, 'school': {
    essential: ['school-stool','backdrop-school-grey'],
    recommended: ['step-box','apple-box','floor-carpet-blue'],
    optional: ['v-flat-white','floor-tape-marks'],
  }, 'school_photography': {
    essential: ['school-stool','backdrop-school-grey','riser-3step'],
    recommended: ['step-box','bench-wooden','floor-tape-marks','floor-carpet-blue'],
    optional: ['backdrop-school-blue','school-banner','apple-box'],
  },
  
  barber: {
    essential: ['barber-chair','mirror-salon'],
    recommended: ['scissors-comb','towel-rack','barber-pole'],
    optional: ['floor-checkered','backdrop-wood'],
  },
  salon: {
    essential: ['barber-chair','mirror-salon'],
    recommended: ['towel-rack','stool-posing'],
    optional: ['backdrop-white','floor-tile'],
  },
  chef: {
    essential: ['chef-counter','knife-block'],
    recommended: ['cutting-board','pot-pan-set','spice-rack'],
    optional: ['floor-tile','backdrop-brick'],
  },
  pastry: {
    essential: ['chef-counter','cutting-board'],
    recommended: ['spice-rack'],
    optional: ['backdrop-white','floor-tile'],
  },
  mechanic: {
    essential: ['tool-chest','workbench'],
    recommended: ['wrench-set','oil-cans'],
    optional: ['car-lift','floor-concrete'],
  },
  carpenter: {
    essential: ['workbench'],
    recommended: ['tool-chest'],
    optional: ['floor-concrete','backdrop-wood'],
  },
  welder: {
    essential: ['workbench','tool-chest'],
    recommended: ['floor-concrete'],
    optional: ['backdrop-brick'],
  }, 'tattoo-artist': {
    essential: ['tattoo-chair','ink-station'],
    recommended: ['tattoo-flash','neon-sign'],
    optional: ['backdrop-brick','floor-concrete'],
  },
  jeweler: {
    essential: ['workbench'],
    recommended: ['stool-posing'],
    optional: ['backdrop-black','v-flat-black'],
  },
  florist: {
    essential: ['workbench'],
    recommended: ['stool-posing'],
    optional: ['backdrop-white','floor-wood'],
  },
  professional: {
    essential: ['stool-posing'],
    recommended: ['v-flat-white','apple-box'],
    optional: ['backdrop-grey','floor-wood'],
  },
  
  // ============================================================================
  // VIDEOGRAPHER SPECIALIZATIONS
  // ============================================================================
  
  // Cinematographer
  cinematographer: {
    essential: ['directors-chair','monitor-director','c-stand'],
    recommended: ['clapperboard','dolly-track','sandbag-grip'],
    optional: ['camera-cinema','fresnel-light','boom-mic'],
  },
  // Commercial Video
  'commercial-video': {
    essential: ['led-panel','c-stand','tripod-video'],
    recommended: ['monitor-director','boom-mic','sandbag-grip'],
    optional: ['teleprompter','dolly-track'],
  },
  // Documentary
  documentary: {
    essential: ['interview-chair','led-panel','lav-mic'],
    recommended: ['boom-mic','c-stand','tripod-video'],
    optional: ['backdrop-interview','monitor-director'],
  },
  // Music Video
  'music-video': {
    essential: ['tube-light','c-stand','gimbal'],
    recommended: ['dolly-track','fresnel-light','sandbag-grip'],
    optional: ['neon-sign','backdrop-black'],
  },
  // Corporate Video
  'corporate-video': {
    essential: ['interview-chair','led-panel','teleprompter'],
    recommended: ['backdrop-interview','lav-mic','c-stand'],
    optional: ['monitor-director','boom-mic'],
  },
  // Social Media / Content Creator
  'social-media': {
    essential: ['led-panel','tripod-video'],
    recommended: ['lav-mic','tube-light'],
    optional: ['backdrop-grey','stool-posing'],
  },
  // Live Streaming / Broadcast
  'live-streaming': {
    essential: ['broadcast-desk','led-panel','teleprompter'],
    recommended: ['backdrop-broadcast','lav-mic','monitor-director'],
    optional: ['tube-light','c-stand'],
  },
  broadcast: {
    essential: ['broadcast-desk','teleprompter','led-panel'],
    recommended: ['backdrop-broadcast','lav-mic'],
    optional: ['monitor-director','c-stand'],
  },
  // VFX / Green Screen
  vfx: {
    essential: ['green-screen','tracking-markers','led-panel'],
    recommended: ['c-stand','sandbag-grip','monitor-director'],
    optional: ['dolly-track','gimbal'],
  }, 'green-screen': {
    essential: ['green-screen','led-panel','c-stand'],
    recommended: ['tracking-markers','sandbag-grip'],
    optional: ['monitor-director','boom-mic'],
  },
  // Interview
  interview: {
    essential: ['interview-chair','led-panel','boom-mic'],
    recommended: ['backdrop-interview','lav-mic','c-stand'],
    optional: ['monitor-director','tripod-video'],
  },
};

// Genre to PBR recommendations mapping
const GENRE_PBR_MAP: Record<string, { essential: string[]; recommended: string[]; optional: string[] }> = {
  'film-noir': {
    essential: ['backdrop-noir','venetian-blinds','desk-detective'],
    recommended: ['fedora-hat','whiskey-glass','v-flat-black'],
    optional: ['floor-concrete','stool-posing'],
  }, 'sci-fi': {
    essential: ['backdrop-scifi','console-scifi','floor-scifi'],
    recommended: ['hologram-display','neon-lights-scifi','neon-sign'],
    optional: ['v-flat-white','floor-tile'],
  }, 'western': {
    essential: ['backdrop-saloon','saloon-doors','floor-dusty'],
    recommended: ['wagon-wheel','barrel-wooden','backdrop-wood'],
    optional: ['floor-wood','apple-box'],
  }, 'horror': {
    essential: ['backdrop-crypt','cobwebs','floor-stone-old'],
    recommended: ['candelabra','tombstone','v-flat-black'],
    optional: ['backdrop-black','floor-concrete'],
  }, 'cosmic-horror': {
    essential: ['backdrop-void','tentacle-statue','ancient-tome'],
    recommended: ['candelabra','floor-stone-old','v-flat-black'],
    optional: ['backdrop-black','cobwebs'],
  }, 'fantasy': {
    essential: ['backdrop-castle','throne-royal','floor-castle'],
    recommended: ['sword-medieval','crystal-magic','candelabra'],
    optional: ['chandelier-crystal','mirror-ornate'],
  }, 'action': {
    essential: ['backdrop-warehouse-action','crate-military','floor-concrete'],
    recommended: ['sandbags','v-flat-black'],
    optional: ['backdrop-brick','neon-sign'],
  }, 'period-drama': {
    essential: ['backdrop-manor','chair-victorian','floor-marble'],
    recommended: ['chandelier-crystal','mirror-ornate','floor-wood'],
    optional: ['candelabra','stool-posing'],
  }, 'asian-cinema': {
    essential: ['backdrop-dojo','screen-shoji','floor-tatami'],
    recommended: ['lantern-paper','katana-stand'],
    optional: ['stool-posing','v-flat-white'],
  }, 'superhero': {
    essential: ['backdrop-cityscape','city-rooftop','floor-rooftop'],
    recommended: ['spotlight-hero','v-flat-black'],
    optional: ['neon-sign','backdrop-black'],
  }, 'profession': {
    essential: ['stool-posing'],
    recommended: ['backdrop-grey','v-flat-white'],
    optional: ['apple-box'],
  },
};

// HDRI environment to PBR recommendations
const HDRI_PBR_MAP: Record<string, { essential: string[]; recommended: string[] }> = {
  'studio': {
    essential: ['backdrop-grey','stool-posing'],
    recommended: ['v-flat-white','apple-box'],
  }, 'indoor': {
    essential: ['backdrop-wood'],
    recommended: ['floor-wood','stool-posing'],
  }, 'outdoor': {
    essential: [],
    recommended: ['floor-dusty','apple-box'],
  }, 'sunset': {
    essential: ['backdrop-wood'],
    recommended: ['floor-wood','v-flat-white'],
  }, 'night': {
    essential: ['backdrop-black','v-flat-black'],
    recommended: ['floor-concrete','neon-sign'],
  }, 'overcast': {
    essential: ['backdrop-grey'],
    recommended: ['stool-posing','v-flat-white'],
  }, 'school': {
    essential: ['backdrop-grey','stool-posing'],
    recommended: ['apple-box','v-flat-white'],
  },
};

export interface CharacterContext {
  name: string;
  tags?: string[];
  genre?: string;
  mood?: string;
}

export interface HDRIContext {
  id: string;
  name: string;
  category: string;
}

/**
 * Get PBR/prop recommendations based on character and HDRI environment
 * 
 * Flow: Character → HDRI → PBR/Props → Light Setup → Add to Scene
 * Props are selected BEFORE lighting because lighting needs to account for
 * all reflective surfaces (backdrops, floors, props) in the scene.
 */
export function getPBRRecommendations(
  character: CharacterContext,
  hdri?: HDRIContext
): PBRRecommendation[] {
  const essentialItems: Set<string> = new Set();
  const recommendedItems: Set<string> = new Set();
  const optionalItems: Set<string> = new Set();
  const reasons: Map<string, string> = new Map();

  // Collect items from profession tags
  character.tags?.forEach(tag => {
    const tagLower = tag.toLowerCase();
    const mapping = PROFESSION_PBR_MAP[tagLower];
    if (mapping) {
      mapping.essential.forEach(id => {
        essentialItems.add(id);
        reasons.set(id, `Essential for ${tag} setup`);
      });
      mapping.recommended.forEach(id => {
        recommendedItems.add(id);
        reasons.set(id, `Recommended for ${tag}`);
      });
      mapping.optional.forEach(id => {
        optionalItems.add(id);
        reasons.set(id, `Optional ${tag} atmosphere`);
      });
    }
  });

  // Collect items from genre
  if (character.genre) {
    const genreMapping = GENRE_PBR_MAP[character.genre];
    if (genreMapping) {
      genreMapping.essential.forEach(id => {
        if (!essentialItems.has(id)) essentialItems.add(id);
        reasons.set(id, reasons.get(id) || `Fits ${character.genre} aesthetic`);
      });
      genreMapping.recommended.forEach(id => {
        if (!essentialItems.has(id) && !recommendedItems.has(id)) recommendedItems.add(id);
        reasons.set(id, reasons.get(id) || `Complements ${character.genre} style`);
      });
      genreMapping.optional.forEach(id => {
        if (!essentialItems.has(id) && !recommendedItems.has(id)) optionalItems.add(id);
      });
    }
  }

  // Collect items from HDRI environment
  if (hdri?.category) {
    const hdriMapping = HDRI_PBR_MAP[hdri.category];
    if (hdriMapping) {
      hdriMapping.essential.forEach(id => {
        if (!essentialItems.has(id)) essentialItems.add(id);
        reasons.set(id, reasons.get(id) || `Matches ${hdri.name} environment`);
      });
      hdriMapping.recommended.forEach(id => {
        if (!essentialItems.has(id) && !recommendedItems.has(id)) recommendedItems.add(id);
        reasons.set(id, reasons.get(id) || `Complements ${hdri.category} setting`);
      });
    }
  }

  // If no matches, add default studio items
  if (essentialItems.size === 0) {
    essentialItems.add('stool-posing,');
    essentialItems.add('backdrop-grey');
    reasons.set('stool-posing, ', 'Standard portrait setup');
    reasons.set('backdrop-grey', 'Versatile background');
  }

  // Build recommendations
  const recommendations: PBRRecommendation[] = [];

  // Essential bundle
  if (essentialItems.size > 0) {
    recommendations.push({
      id: 'essential-bundle',
      name: 'Essential Props',
      description: 'Must-have items for this setup',
      category: 'essential',
      items: Array.from(essentialItems).map(id => PBR_ITEMS[id]).filter(Boolean),
      matchScore: 100,
      reason: `Core setup for ${character.name}`,
    });
  }

  // Recommended bundle
  if (recommendedItems.size > 0) {
    recommendations.push({
      id: 'recommended-bundle',
      name: 'Recommended Additions',
      description: 'Enhance your scene with these items',
      category: 'recommended',
      items: Array.from(recommendedItems).map(id => PBR_ITEMS[id]).filter(Boolean),
      matchScore: 75,
      reason: 'Adds authenticity and detail',
    });
  }

  // Optional/atmosphere bundle
  if (optionalItems.size > 0) {
    recommendations.push({
      id: 'optional-bundle',
      name: 'Atmosphere & Details',
      description: 'Optional items for extra realism',
      category: 'optional',
      items: Array.from(optionalItems).map(id => PBR_ITEMS[id]).filter(Boolean),
      matchScore: 50,
      reason: 'Creates immersive environment',
    });
  }

  // Add backdrop options if not already included
  const backdropIncluded = [...essentialItems, ...recommendedItems].some(id => id.startsWith('backdrop-'));
  if (!backdropIncluded) {
    recommendations.push({
      id: 'backdrop-options',
      name: 'Backdrop Options',
      description: 'Choose a background for your scene',
      category: 'atmosphere',
      items: [
        PBR_ITEMS['backdrop-grey'],
        PBR_ITEMS['backdrop-white'],
        PBR_ITEMS['backdrop-black'],
        PBR_ITEMS['backdrop-brick'],
      ].filter(Boolean),
      matchScore: 60,
      reason: 'Select backdrop based on mood',
    });
  }

  // Add floor options if not already included
  const floorIncluded = [...essentialItems, ...recommendedItems, ...optionalItems].some(id => id.startsWith('floor-'));
  if (!floorIncluded) {
    recommendations.push({
      id: 'floor-options',
      name: 'Floor Options',
      description: 'Choose a floor surface',
      category: 'atmosphere',
      items: [
        PBR_ITEMS['floor-concrete'],
        PBR_ITEMS['floor-wood'],
        PBR_ITEMS['floor-tile'],
      ].filter(Boolean),
      matchScore: 40,
      reason: 'Ground the scene realistically',
    });
  }

  log.debug(`PBR recommendations for ${character.name}:`, recommendations);

  return recommendations;
}

/**
 * Get all available PBR items
 */
export function getAllPBRItems(): PBRItem[] {
  return Object.values(PBR_ITEMS);
}

/**
 * Get PBR item by ID
 */
export function getPBRItemById(id: string): PBRItem | undefined {
  return PBR_ITEMS[id];
}

/**
 * Get items by category
 */
export function getPBRItemsByCategory(category: string): PBRItem[] {
  return Object.values(PBR_ITEMS).filter(item => item.category === category);
}

export default {
  getPBRRecommendations,
  getAllPBRItems,
  getPBRItemById,
  getPBRItemsByCategory,
};
