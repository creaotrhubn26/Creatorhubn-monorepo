/**
 * Clothing Rendering Service
 *
 * Handles clothing-specific rendering and customization for virtual actors.
 * Uses the universal AssetLoadingService for optimized loading and caching.
 *
 * Features:
 * - Clothing color customization (HSL)
 * - Fabric material optimization
 * - Size/fit adjustments
 * - LOD support for distant actors
 * - GPU instancing for crowds
 * - Integration with universal asset loading system
 *
 * Performance Improvements (via AssetLoadingService):
 */

import { logger } from './logger';

const log = logger.module('ClothingService');

import * as THREE from 'three';
import { ClothingStyleDefinition } from '../data/clothingStyles';
import { assetLoadingService } from'./assetLoadingService';

export interface ClothingColorOptions {
  hue?: number; // 0-360
  saturation?: number; // 0-1
  lightness?: number; // 0-1
}

export interface ClothingLoadOptions {
  color?: ClothingColorOptions;
  scale?: number;
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  
  // Fabric options
  roughness?: number; // 0-1 (0 = smooth/silk, 1 = rough/wool)
  metalness?: number; // 0-1 (0 = fabric, 1 = metallic)
  
  // LOD options
  enableLOD?: boolean; // Enable LOD for distant actors
  lodDistances?: number[]; // Custom LOD distances [close, medium, far]
  
  // GPU Instancing options (for crowds)
  enableGPUInstancing?: boolean; // Enable GPU instancing for many actors
  maxInstances?: number; // Max instances (default: 100)
}

export class ClothingRenderingService {
  /**
   * Load a clothing model from GLB file
   * Uses universal AssetLoadingService for optimized loading
   * 
   * Supports:
   * - LOD (Level of Detail) for distant actors
   * - GPU Instancing for crowds
   * - Clothing color customization
   * - Fabric material customization
   */
  async loadClothingModel(
    clothing: ClothingStyleDefinition,
    options?: ClothingLoadOptions
  ): Promise<THREE.Group> {
    // Prepare LOD levels if enabled
    let lodLevels;
    if (options?.enableLOD) {
      const distances = options.lodDistances || [5, 15, 30]; // Default distances
      lodLevels = [
        { distance: distances[0], simplificationRatio: 0.7 }, // Medium detail
        { distance: distances[1], simplificationRatio: 0.4 }, // Low detail
        { distance: distances[2], simplificationRatio: 0.2 }, // Minimal detail
      ];
    }

    // Load asset using universal service
    const clothingModel = await assetLoadingService.loadAsset({
      path: clothing.modelPath,
      meshName: clothing.meshName,
      instanceGeometry: true, // Enable geometry instancing
      shareMaterials: false, // Clone materials for color customization
      optimizeMaterials: true,
      compressTextures: true,
      castShadow: true,
      receiveShadow: true,
      scale: options?.scale || 1.0,
      position: options?.position || new THREE.Vector3(0, 0, 0),
      rotation: options?.rotation,
      
      // LOD options
      enableLOD: options?.enableLOD || false,
      lodLevels,
      
      // GPU Instancing options
      enableGPUInstancing: options?.enableGPUInstancing || false,
      maxInstances: options?.maxInstances || 100,
    });

    // Apply clothing-specific optimizations
    this.optimizeClothingMaterials(clothingModel, options);

    // Apply clothing color if specified
    if (options?.color) {
      this.applyClothingColor(clothingModel, options.color);
    }

    return clothingModel;
  }

  /**
   * Optimize materials specifically for clothing rendering
   */
  private optimizeClothingMaterials(clothingModel: THREE.Group, options?: ClothingLoadOptions): void {
    clothingModel.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material;

        if (Array.isArray(material)) {
          material.forEach((mat) => this.optimizeClothingMaterial(mat, options));
        } else if (material) {
          this.optimizeClothingMaterial(material, options);
        }
      }
    });
  }

  /**
   * Optimize single material for clothing
   */
  private optimizeClothingMaterial(material: THREE.Material, options?: ClothingLoadOptions): void {
    if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const mat = material as THREE.MeshStandardMaterial;

      // Fabric-specific settings
      mat.roughness = options?.roughness ?? 0.8; // Default: slightly rough (cotton/denim)
      mat.metalness = options?.metalness ?? 0.0; // Default: non-metallic
      mat.side = THREE.FrontSide; // Clothing typically single-sided

      // Enable shadow casting
      mat.shadowSide = THREE.FrontSide;
    }
  }

  /**
   * Apply clothing color using HSL adjustment
   */
  private applyClothingColor(model: THREE.Group, color: ClothingColorOptions): void {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material as THREE.MeshStandardMaterial;

        if (material && material.isMeshStandardMaterial) {
          // Get current color
          const currentColor = material.color.clone();

          // Convert to HSL for easier manipulation
          const hsl = { h: 0, s: 0, l: 0 };
          currentColor.getHSL(hsl);

          // Apply adjustments
          if (color.hue !== undefined) {
            hsl.h = color.hue / 360; // Convert to 0-1 range
          }
          if (color.saturation !== undefined) {
            hsl.s = color.saturation;
          }
          if (color.lightness !== undefined) {
            hsl.l = color.lightness;
          }

          // Set new color
          material.color.setHSL(hsl.h, hsl.s, hsl.l);
        }
      }
    });
  }

  /**
   * Preload a clothing model
   */
  async preloadClothingModel(clothing: ClothingStyleDefinition): Promise<void> {
    try {
      await assetLoadingService.preloadAsset({
        path: clothing.modelPath,
        meshName: clothing.meshName,
        instanceGeometry: true,
        optimizeMaterials: true,
      });
      log.debug(`Preloaded clothing model: ${clothing.name}`);
    } catch (error) {
      log.warn(`Failed to preload clothing model: ${clothing.name}`, error);
    }
  }

  /**
   * Preload multiple clothing models
   */
  async preloadClothingModels(clothingItems: ClothingStyleDefinition[]): Promise<void> {
    log.info(`Preloading ${clothingItems.length} clothing models...`);
    await Promise.all(clothingItems.map((item) => this.preloadClothingModel(item)));
    log.info(`Preloaded ${clothingItems.length} clothing models, `);
  }

  /**
   * Get cache statistics (delegates to AssetLoadingService)
   */
  getCacheStats() {
    return assetLoadingService.getCacheStats();
  }

  /**
   * Clear cache (delegates to AssetLoadingService)
   */
  clearCache(): void {
    assetLoadingService.clearCache();
  }

  // ============================================================================
  // GPU Instancing Methods (for crowds)
  // ============================================================================

  /**
   * Add clothing instance to GPU instanced mesh (for crowds)
   */
  addClothingInstance(
    clothing: ClothingStyleDefinition,
    position: THREE.Vector3,
    rotation?: THREE.Euler,
    scale?: THREE.Vector3
  ): boolean {
    return assetLoadingService.addGPUInstance(
      clothing.modelPath,
      position,
      rotation,
      scale
    );
  }

  /**
   * Update clothing instance transform (for animated crowds)
   */
  updateClothingInstance(
    clothing: ClothingStyleDefinition,
    instanceIndex: number,
    position: THREE.Vector3,
    rotation?: THREE.Euler,
    scale?: THREE.Vector3
  ): boolean {
    return assetLoadingService.updateGPUInstance(
      clothing.modelPath,
      instanceIndex,
      position,
      rotation,
      scale
    );
  }

  /**
   * Load clothing for crowd scene (GPU instanced with LOD)
   */
  async loadCrowdClothing(
    clothing: ClothingStyleDefinition,
    maxActors: number = 100,
    options?: ClothingLoadOptions
  ): Promise<THREE.Group> {
    log.debug(`Loading crowd clothing for ${maxActors} actors with LOD and GPU instancing`);

    return this.loadClothingModel(clothing, {
      ...options,
      enableLOD: true,
      enableGPUInstancing: true,
      maxInstances: maxActors,
      lodDistances: [5, 15, 30], // Optimized for crowds
    });
  }
}

// Singleton instance
export const clothingRenderingService = new ClothingRenderingService();


