/**
 * PIXI.JS FILTER ENGINE
 * GPU-accelerated 2D filters and effects
 * Professional quality like After Effects
 */

import * as PIXI from 'pixi.js';

export type PixiFilterType = 
  | 'blur'
  | 'bloom'
  | 'color_matrix'
  | 'displacement'
  | 'noise'
  | 'rgb_split'
  | 'glitch'
  | 'crt'
  | 'old_film'
  | 'vignette'
  | 'sharpen'
  | 'emboss';

export interface FilterConfig {
  type: PixiFilterType;
  params: Record<string, any>;
}

/**
 * PixiJS Filter Engine for GPU effects
 */
export class PixiFilterEngine {
  private app: PIXI.Application | null = null;
  private sprite: PIXI.Sprite | null = null;
  private filters: Map<string, PIXI.Filter> = new Map();
  
  /**
   * Initialize Pixi application
   */
  async init(canvas: HTMLCanvasElement) {
    this.app = new PIXI.Application();
    
    await this.app.init({
      canvas,
      width: canvas.width,
      height: canvas.height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio
    });
    
    console.log('✅ PixiJS Filter Engine initialized');
  }
  
  /**
   * Set source video/canvas
   */
  setSource(source: HTMLVideoElement | HTMLCanvasElement) {
    if (!this.app) return;
    
    // Create texture from source
    const texture = PIXI.Texture.from(source);
    
    // Create or update sprite
    if (!this.sprite) {
      this.sprite = new PIXI.Sprite(texture);
      this.app.stage.addChild(this.sprite);
    } else {
      this.sprite.texture = texture;
    }
    
    // Fit to canvas
    this.sprite.width = this.app.screen.width;
    this.sprite.height = this.app.screen.height;
  }
  
  /**
   * Apply filter
   */
  applyFilter(filterId: string, config: FilterConfig) {
    if (!this.sprite) return;
    
    let filter: PIXI.Filter;
    
    switch (config.type) {
      case 'blur':
        filter = new PIXI.BlurFilter({
          strength: config.params.strength || 8,
          quality: config.params.quality || 4
        });
        break;
        
      case 'color_matrix':
        filter = new PIXI.ColorMatrixFilter();
        const colorMatrix = filter as PIXI.ColorMatrixFilter;
        
        if (config.params.brightness) {
          colorMatrix.brightness(config.params.brightness, false);
        }
        if (config.params.contrast) {
          colorMatrix.contrast(config.params.contrast, false);
        }
        if (config.params.saturate) {
          colorMatrix.saturate(config.params.saturate, false);
        }
        if (config.params.hue) {
          colorMatrix.hue(config.params.hue, false);
        }
        if (config.params.greyscale) {
          colorMatrix.greyscale(config.params.greyscale, false);
        }
        if (config.params.sepia) {
          colorMatrix.sepia(config.params.sepia, false);
        }
        break;
        
      case 'noise':
        filter = new PIXI.NoiseFilter({
          noise: config.params.noise || 0.5,
          seed: config.params.seed || Math.random()
        });
        break;
        
      default:
        console.warn(`Filter type ${config.type} not implemented yet`);
        return;
    }
    
    this.filters.set(filterId, filter);
    this.updateSpriteFilters();
  }
  
  /**
   * Remove filter
   */
  removeFilter(filterId: string) {
    this.filters.delete(filterId);
    this.updateSpriteFilters();
  }
  
  /**
   * Update sprite with all active filters
   */
  private updateSpriteFilters() {
    if (!this.sprite) return;
    
    const filterArray = Array.from(this.filters.values());
    this.sprite.filters = filterArray.length > 0 ? filterArray : null;
  }
  
  /**
   * Clear all filters
   */
  clearFilters() {
    this.filters.clear();
    if (this.sprite) {
      this.sprite.filters = null;
    }
  }
  
  /**
   * Render current frame
   */
  render() {
    if (this.app) {
      this.app.renderer.render(this.app.stage);
    }
  }
  
  /**
   * Get filter presets
   */
  getFilterPresets(): Array<{ name: string; config: FilterConfig }> {
    return PixiFilterEngine.getFilterPresets();
  }

  /**
   * Get filter presets
   */
  static getFilterPresets(): Array<{ name: string; config: FilterConfig }> {
    return [
      {
        name: 'Soft Blur',
        config: { type: 'blur', params: { strength: 4, quality: 2 } }
      },
      {
        name: 'Heavy Blur',
        config: { type: 'blur', params: { strength: 16, quality: 4 } }
      },
      {
        name: 'Brighten',
        config: { type: 'color_matrix', params: { brightness: 1.3 } }
      },
      {
        name: 'High Contrast',
        config: { type: 'color_matrix', params: { contrast: 1.5 } }
      },
      {
        name: 'Vibrant',
        config: { type: 'color_matrix', params: { saturate: 1.5 } }
      },
      {
        name: 'Black & White',
        config: { type: 'color_matrix', params: { greyscale: 1.0 } }
      },
      {
        name: 'Sepia',
        config: { type: 'color_matrix', params: { sepia: 1.0 } }
      },
      {
        name: 'Film Grain',
        config: { type: 'noise', params: { noise: 0.3 } }
      }
    ];
  }
  
  /**
   * Cleanup
   */
  dispose() {
    this.clearFilters();
    this.app?.destroy();
    this.app = null;
    this.sprite = null;
  }
}

export const pixiFilterEngine = new PixiFilterEngine();

