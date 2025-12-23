/**
 * Modifier Library
 * Comprehensive database of lighting modifiers with metadata
 */

import { logger } from '../services/logger';

const log = logger.module('ModifierLibrary');

export interface ModifierDimensions {
  diameter?: number; // meters
  width?: number; // meters
  height?: number; // meters
  depth?: number; // meters
}

export interface ModifierFiles {
  obj: string;
  glb: string;
  thumbnail: string;
  icon: string;
}

export interface Modifier {
  id: string;
  name: string;
  brand: string;
  type: 'beauty-dish' | 'softbox' | 'stripbox' | 'octabox' | 'reflector';
  description: string;
  dimensions: ModifierDimensions;
  mount_type: 'profoto' | 'godox' | 'bowens' | 'elinchrom' | 'universal';
  material: 'aluminum' | 'fabric' | 'plastic';
  finish: 'white' | 'silver' | 'gold' | 'white_diffusion';
  weight_kg: number;
  files: ModifierFiles;
}

export interface ModifierMetadata {
  version: string;
  generated_at: string;
  generator: string;
  quality: string;
  modifiers: Modifier[];
}

/**
 * Modifier Library Class
 * Manages loading and accessing modifier metadata
 */
export class ModifierLibrary {
  private static instance: ModifierLibrary;
  private metadata: ModifierMetadata | null = null;
  private modifiersById: Map<string, Modifier> = new Map();
  private modifiersByType: Map<string, Modifier[]> = new Map();
  private modifiersByBrand: Map<string, Modifier[]> = new Map();

  private constructor() {}

  static getInstance(): ModifierLibrary {
    if (!ModifierLibrary.instance) {
      ModifierLibrary.instance = new ModifierLibrary();
    }
    return ModifierLibrary.instance;
  }

  /**
   * Load modifier metadata from JSON
   */
  async loadMetadata(metadataPath: string = '/models/modifiers/modifiers.json'): Promise<void> {
    try {
      const response = await fetch(metadataPath);
      if (!response.ok) {
        throw new Error(`Failed to load modifier metadata: ${response.statusText}`);
      }

      this.metadata = await response.json();
      this.indexModifiers();

      log.info(`Loaded ${this.metadata!.modifiers.length} modifiers`);
    } catch (error) {
      log.error('Failed to load modifier metadata: ', error);
      // Use fallback data if metadata file doesn't exist
      this.useFallbackData();
    }
  }

  /**
   * Index modifiers for fast lookup
   */
  private indexModifiers(): void {
    if (!this.metadata) return;

    this.modifiersById.clear();
    this.modifiersByType.clear();
    this.modifiersByBrand.clear();

    for (const modifier of this.metadata.modifiers) {
      // Index by ID
      this.modifiersById.set(modifier.id, modifier);

      // Index by type
      if (!this.modifiersByType.has(modifier.type)) {
        this.modifiersByType.set(modifier.type, []);
      }
      this.modifiersByType.get(modifier.type)!.push(modifier);

      // Index by brand
      if (!this.modifiersByBrand.has(modifier.brand)) {
        this.modifiersByBrand.set(modifier.brand, []);
      }
      this.modifiersByBrand.get(modifier.brand)!.push(modifier);
    }
  }

  /**
   * Get all modifiers
   */
  getAllModifiers(): Modifier[] {
    return this.metadata?.modifiers || [];
  }

  /**
   * Get modifier by ID
   */
  getModifierById(id: string): Modifier | undefined {
    return this.modifiersById.get(id);
  }

  /**
   * Get modifiers by type
   */
  getModifiersByType(type: Modifier['type']): Modifier[] {
    return this.modifiersByType.get(type) || [];
  }

  /**
   * Get modifiers by brand
   */
  getModifiersByBrand(brand: string): Modifier[] {
    return this.modifiersByBrand.get(brand) || [];
  }

  /**
   * Get all brands
   */
  getAllBrands(): string[] {
    return Array.from(this.modifiersByBrand.keys());
  }

  /**
   * Get all types
   */
  getAllTypes(): string[] {
    return Array.from(this.modifiersByType.keys());
  }

  /**
   * Search modifiers by name or description
   */
  searchModifiers(query: string): Modifier[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllModifiers().filter(
      (m) =>
        m.name.toLowerCase().includes(lowerQuery) ||
        m.description.toLowerCase().includes(lowerQuery) ||
        m.brand.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Use fallback data if metadata file doesn't exist
   */
  private useFallbackData(): void {
    log.debug('Using fallback modifier data');
    this.metadata = {
      version: '1.0.0',
      generated_at: '2025-12-03',
      generator: 'fallback',
      quality: 'procedural',
      modifiers: FALLBACK_MODIFIERS,
    };
    this.indexModifiers();
  }
}

/**
 * Fallback modifier definitions
 */
const FALLBACK_MODIFIERS: Modifier[] = [
  // Beauty Dishes
  {
    id: 'profoto-beauty-dish-white-22',
    name: 'Profoto Softlight Reflector White 22"',
    brand: 'Profoto',
    type: 'beauty-dish',
    description: 'Classic 22" white beauty dish for soft, wrapping light',
    dimensions: { diameter: 0.56 },
    mount_type: 'profoto',
    material: 'aluminum',
    finish: 'white',
    weight_kg: 1.2,
    files: { obj: '/models/modifiers/profoto_beauty_dish_22.obj', glb: '/models/modifiers/profoto_beauty_dish_22.glb', thumbnail: '/thumbnails/modifiers/profoto_beauty_dish_22.jpg', icon: '/icons/modifiers/beauty-dish.svg' },
  },
  {
    id: 'profoto-beauty-dish-silver-22',
    name: 'Profoto Softlight Reflector Silver 22"',
    brand: 'Profoto',
    type: 'beauty-dish',
    description: 'Silver beauty dish for more contrast and punch',
    dimensions: { diameter: 0.56 },
    mount_type: 'profoto',
    material: 'aluminum',
    finish: 'silver',
    weight_kg: 1.2,
    files: { obj: '/models/modifiers/profoto_beauty_dish_silver_22.obj', glb: '/models/modifiers/profoto_beauty_dish_silver_22.glb', thumbnail: '/thumbnails/modifiers/profoto_beauty_dish_silver_22.jpg', icon: '/icons/modifiers/beauty-dish.svg' },
  },
  {
    id: 'godox-beauty-dish-white-21',
    name: 'Godox Beauty Dish 21"',
    brand: 'Godox',
    type: 'beauty-dish',
    description: 'Budget-friendly 21" beauty dish with grid option',
    dimensions: { diameter: 0.53 },
    mount_type: 'bowens',
    material: 'aluminum',
    finish: 'white',
    weight_kg: 0.9,
    files: { obj: '/models/modifiers/godox_beauty_dish_21.obj', glb: '/models/modifiers/godox_beauty_dish_21.glb', thumbnail: '/thumbnails/modifiers/godox_beauty_dish_21.jpg', icon: '/icons/modifiers/beauty-dish.svg' },
  },
  {
    id: 'mola-setti-28',
    name: 'Mola Setti 28.5"',
    brand: 'Mola',
    type: 'beauty-dish',
    description: 'Premium large beauty dish with unique light quality',
    dimensions: { diameter: 0.72 },
    mount_type: 'universal',
    material: 'aluminum',
    finish: 'white',
    weight_kg: 1.8,
    files: { obj: '/models/modifiers/mola_setti_28.obj', glb: '/models/modifiers/mola_setti_28.glb', thumbnail: '/thumbnails/modifiers/mola_setti_28.jpg', icon: '/icons/modifiers/beauty-dish.svg' },
  },

  // Softboxes
  {
    id: 'profoto-softbox-3x4',
    name: 'Profoto Softbox RFi 3x4\', ',
    brand: 'Profoto',
    type: 'softbox',
    description: 'Large rectangular softbox for full-body or group shots',
    dimensions: { width: 0.9, height: 1.2, depth: 0.4 },
    mount_type: 'profoto',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 2.5,
    files: { obj: '/models/modifiers/profoto_softbox_3x4.obj', glb: '/models/modifiers/profoto_softbox_3x4.glb', thumbnail: '/thumbnails/modifiers/profoto_softbox_3x4.jpg', icon: '/icons/modifiers/softbox.svg' },
  },
  {
    id: 'profoto-softbox-2x3',
    name: 'Profoto Softbox RFi 2x3\', ',
    brand: 'Profoto',
    type: 'softbox',
    description: 'Medium rectangular softbox for portraits',
    dimensions: { width: 0.6, height: 0.9, depth: 0.35 },
    mount_type: 'profoto',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 1.8,
    files: { obj: '/models/modifiers/profoto_softbox_2x3.obj', glb: '/models/modifiers/profoto_softbox_2x3.glb', thumbnail: '/thumbnails/modifiers/profoto_softbox_2x3.jpg', icon: '/icons/modifiers/softbox.svg' },
  },
  {
    id: 'godox-softbox-80x120',
    name: 'Godox Softbox 80x120cm',
    brand: 'Godox',
    type: 'softbox',
    description: 'Large rectangular softbox with grid compatibility',
    dimensions: { width: 0.8, height: 1.2, depth: 0.35 },
    mount_type: 'bowens',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 1.5,
    files: { obj: '/models/modifiers/godox_softbox_80x120.obj', glb: '/models/modifiers/godox_softbox_80x120.glb', thumbnail: '/thumbnails/modifiers/godox_softbox_80x120.jpg', icon: '/icons/modifiers/softbox.svg' },
  },
  {
    id: 'godox-softbox-60x90',
    name: 'Godox Softbox 60x90cm',
    brand: 'Godox',
    type: 'softbox',
    description: 'Medium rectangular softbox for portraits',
    dimensions: { width: 0.6, height: 0.9, depth: 0.3 },
    mount_type: 'bowens',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 1.2,
    files: { obj: '/models/modifiers/godox_softbox_60x90.obj', glb: '/models/modifiers/godox_softbox_60x90.glb', thumbnail: '/thumbnails/modifiers/godox_softbox_60x90.jpg', icon: '/icons/modifiers/softbox.svg' },
  },
  {
    id: 'elinchrom-rotalux-135',
    name: 'Elinchrom Rotalux 135cm',
    brand: 'Elinchrom',
    type: 'softbox',
    description: 'Deep octagonal softbox for dramatic portraits',
    dimensions: { diameter: 1.35, depth: 0.5 },
    mount_type: 'elinchrom',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 2.2,
    files: { obj: '/models/modifiers/elinchrom_rotalux_135.obj', glb: '/models/modifiers/elinchrom_rotalux_135.glb', thumbnail: '/thumbnails/modifiers/elinchrom_rotalux_135.jpg', icon: '/icons/modifiers/softbox.svg' },
  },

  // Strip Boxes
  {
    id: 'profoto-stripbox-1x4',
    name: 'Profoto Softbox Strip RFi 1x4\',',
    brand: 'Profoto',
    type: 'stripbox',
    description: 'Narrow strip light for rim and accent lighting',
    dimensions: { width: 0.3, height: 1.2, depth: 0.35 },
    mount_type: 'profoto',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 1.5,
    files: { obj: '/models/modifiers/profoto_stripbox_1x4.obj', glb: '/models/modifiers/profoto_stripbox_1x4.glb', thumbnail: '/thumbnails/modifiers/profoto_stripbox_1x4.jpg', icon: '/icons/modifiers/stripbox.svg' },
  },
  {
    id: 'profoto-stripbox-1x6',
    name: 'Profoto Softbox Strip RFi 1x6\',',
    brand: 'Profoto',
    type: 'stripbox',
    description: 'Long strip light for full-body rim lighting',
    dimensions: { width: 0.3, height: 1.8, depth: 0.35 },
    mount_type: 'profoto',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 1.8,
    files: { obj: '/models/modifiers/profoto_stripbox_1x6.obj', glb: '/models/modifiers/profoto_stripbox_1x6.glb', thumbnail: '/thumbnails/modifiers/profoto_stripbox_1x6.jpg', icon: '/icons/modifiers/stripbox.svg' },
  },
  {
    id: 'godox-stripbox-30x120',
    name: 'Godox Strip Softbox 30x120cm',
    brand: 'Godox',
    type: 'stripbox',
    description: 'Versatile strip box with honeycomb grid',
    dimensions: { width: 0.3, height: 1.2, depth: 0.3 },
    mount_type: 'bowens',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 1.0,
    files: { obj: '/models/modifiers/godox_stripbox_30x120.obj', glb: '/models/modifiers/godox_stripbox_30x120.glb', thumbnail: '/thumbnails/modifiers/godox_stripbox_30x120.jpg', icon: '/icons/modifiers/stripbox.svg' },
  },

  // Octaboxes
  {
    id: 'profoto-octa-5',
    name: 'Profoto Softbox Octa RFi 5\',',
    brand: 'Profoto',
    type: 'octabox',
    description: 'Large octagonal softbox with beautiful catchlights',
    dimensions: { diameter: 1.5, depth: 0.5 },
    mount_type: 'profoto',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 3.0,
    files: { obj: '/models/modifiers/profoto_octa_5.obj', glb: '/models/modifiers/profoto_octa_5.glb', thumbnail: '/thumbnails/modifiers/profoto_octa_5.jpg', icon: '/icons/modifiers/octabox.svg' },
  },
  {
    id: 'profoto-octa-3',
    name: 'Profoto Softbox Octa RFi 3\', ',
    brand: 'Profoto',
    type: 'octabox',
    description: 'Medium octagonal softbox for versatile portraits',
    dimensions: { diameter: 0.9, depth: 0.4 },
    mount_type: 'profoto',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 1.8,
    files: { obj: '/models/modifiers/profoto_octa_3.obj', glb: '/models/modifiers/profoto_octa_3.glb', thumbnail: '/thumbnails/modifiers/profoto_octa_3.jpg', icon: '/icons/modifiers/octabox.svg' },
  },
  {
    id: 'godox-octa-120',
    name: 'Godox Octabox 120cm',
    brand: 'Godox',
    type: 'octabox',
    description: 'Large octagonal softbox with umbrella-style setup',
    dimensions: { diameter: 1.2, depth: 0.45 },
    mount_type: 'bowens',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 2.0,
    files: { obj: '/models/modifiers/godox_octa_120.obj', glb: '/models/modifiers/godox_octa_120.glb', thumbnail: '/thumbnails/modifiers/godox_octa_120.jpg', icon: '/icons/modifiers/octabox.svg' },
  },
  {
    id: 'godox-octa-80',
    name: 'Godox Octabox 80cm',
    brand: 'Godox',
    type: 'octabox',
    description: 'Compact octagonal softbox for tight spaces',
    dimensions: { diameter: 0.8, depth: 0.35 },
    mount_type: 'bowens',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 1.2,
    files: { obj: '/models/modifiers/godox_octa_80.obj', glb: '/models/modifiers/godox_octa_80.glb', thumbnail: '/thumbnails/modifiers/godox_octa_80.jpg', icon: '/icons/modifiers/octabox.svg' },
  },
  {
    id: 'elinchrom-deep-octa-100',
    name: 'Elinchrom Deep Octabox 100cm',
    brand: 'Elinchrom',
    type: 'octabox',
    description: 'Deep octabox for focused, dramatic light',
    dimensions: { diameter: 1.0, depth: 0.6 },
    mount_type: 'elinchrom',
    material: 'fabric',
    finish: 'white_diffusion',
    weight_kg: 2.5,
    files: { obj: '/models/modifiers/elinchrom_deep_octa_100.obj', glb: '/models/modifiers/elinchrom_deep_octa_100.glb', thumbnail: '/thumbnails/modifiers/elinchrom_deep_octa_100.jpg', icon: '/icons/modifiers/octabox.svg' },
  },

  // Reflectors
  {
    id: 'profoto-zoom-reflector',
    name: 'Profoto Zoom Reflector 2',
    brand: 'Profoto',
    type: 'reflector',
    description: 'Standard reflector with adjustable zoom',
    dimensions: { diameter: 0.2 },
    mount_type: 'profoto',
    material: 'aluminum',
    finish: 'silver',
    weight_kg: 0.4,
    files: { obj: '/models/modifiers/profoto_zoom_reflector.obj', glb: '/models/modifiers/profoto_zoom_reflector.glb', thumbnail: '/thumbnails/modifiers/profoto_zoom_reflector.jpg', icon: '/icons/modifiers/reflector.svg' },
  },
  {
    id: 'profoto-magnum-reflector',
    name: 'Profoto Magnum Reflector',
    brand: 'Profoto',
    type: 'reflector',
    description: 'Large parabolic reflector for maximum output',
    dimensions: { diameter: 0.38 },
    mount_type: 'profoto',
    material: 'aluminum',
    finish: 'silver',
    weight_kg: 0.8,
    files: { obj: '/models/modifiers/profoto_magnum_reflector.obj', glb: '/models/modifiers/profoto_magnum_reflector.glb', thumbnail: '/thumbnails/modifiers/profoto_magnum_reflector.jpg', icon: '/icons/modifiers/reflector.svg' },
  },
  {
    id: 'godox-standard-reflector-7',
    name: 'Godox Standard Reflector 7"',
    brand: 'Godox',
    type: 'reflector',
    description: 'Standard 7-inch reflector for hard light',
    dimensions: { diameter: 0.18 },
    mount_type: 'bowens',
    material: 'aluminum',
    finish: 'silver',
    weight_kg: 0.3,
    files: { obj: '/models/modifiers/godox_reflector_7.obj', glb: '/models/modifiers/godox_reflector_7.glb', thumbnail: '/thumbnails/modifiers/godox_reflector_7.jpg', icon: '/icons/modifiers/reflector.svg' },
  },
  {
    id: 'broncolor-p70',
    name: 'Broncolor P70 Reflector',
    brand: 'Broncolor',
    type: 'reflector',
    description: 'High-quality standard reflector',
    dimensions: { diameter: 0.18 },
    mount_type: 'universal',
    material: 'aluminum',
    finish: 'silver',
    weight_kg: 0.35,
    files: { obj: '/models/modifiers/broncolor_p70.obj', glb: '/models/modifiers/broncolor_p70.glb', thumbnail: '/thumbnails/modifiers/broncolor_p70.jpg', icon:'/icons/modifiers/reflector.svg' },
  },
];

// Export singleton instance
export const modifierLibrary = ModifierLibrary.getInstance();

// Export convenience functions
export const loadModifierMetadata = () => modifierLibrary.loadMetadata();
export const getAllModifiers = () => modifierLibrary.getAllModifiers();
export const getModifierById = (id: string) => modifierLibrary.getModifierById(id);
export const getModifiersByType = (type: Modifier['type']) =>
  modifierLibrary.getModifiersByType(type);
export const getModifiersByBrand = (brand: string) => modifierLibrary.getModifiersByBrand(brand);
export const searchModifiers = (query: string) => modifierLibrary.searchModifiers(query);

