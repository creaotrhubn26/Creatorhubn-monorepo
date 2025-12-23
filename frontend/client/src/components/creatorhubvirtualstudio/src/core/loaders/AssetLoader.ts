/**
 * Asset Loader System
 * 
 * Handles loading of 3D models, textures, and other assets
 * Features:
 * - GLB/GLTF loading
 * - LOD (Level of Detail) system
 * - Asset caching
 * - Progress tracking
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { logger } from '../services/logger';

const log = logger.module('AssetLoader');

export interface AssetLoadOptions {
  useDraco?: boolean;
  generateLODs?: boolean;
  cacheable?: boolean;
}

export interface LoadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (progress: LoadProgress) => void;

export class AssetLoader {
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;
  private textureLoader: THREE.TextureLoader;
  private cache: Map<string, any> = new Map();
  private loadingQueue: Map<string, Promise<any>> = new Map();

  constructor() {
    // Initialize GLTF loader
    this.gltfLoader = new GLTFLoader();

    // Initialize Draco loader for compressed models
    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath('/draco/'); // Path to Draco decoder
    this.gltfLoader.setDRACOLoader(this.dracoLoader);

    // Initialize texture loader
    this.textureLoader = new THREE.TextureLoader();
  }

  /**
   * Load a 3D model (GLB/GLTF)
   */
  public async loadModel(
    url: string,
    options: AssetLoadOptions = {},
    onProgress?: ProgressCallback,
  ): Promise<THREE.Group> {
    const { cacheable = true, generateLODs = false } = options;

    // Check cache
    if (cacheable && this.cache.has(url)) {
      return this.cache.get(url).clone();
    }

    // Check if already loading
    if (this.loadingQueue.has(url)) {
      const result = await this.loadingQueue.get(url);
      return result.clone();
    }

    // Load model
    const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;

          // Generate LODs if requested
          if (generateLODs) {
            this.generateLODs(model);
          }

          // Optimize materials
          this.optimizeMaterials(model);

          // Cache if requested
          if (cacheable) {
            this.cache.set(url, model);
          }

          this.loadingQueue.delete(url);
          resolve(model);
        },
        (progress) => {
          if (onProgress) {
            onProgress({
              loaded: progress.loaded,
              total: progress.total,
              percentage: (progress.loaded / progress.total) * 100,
            });
          }
        },
        (error) => {
          this.loadingQueue.delete(url);
          reject(error);
        },
      );
    });

    this.loadingQueue.set(url, loadPromise);
    return loadPromise;
  }

  /**
   * Load a texture
   */
  public async loadTexture(
    url: string,
    options: { sRGB?: boolean; cacheable?: boolean } = {},
  ): Promise<THREE.Texture> {
    const { sRGB = true, cacheable = true } = options;

    // Check cache
    if (cacheable && this.cache.has(url)) {
      return this.cache.get(url);
    }

    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          if (sRGB) {
            texture.colorSpace = THREE.SRGBColorSpace;
          }

          if (cacheable) {
            this.cache.set(url, texture);
          }

          resolve(texture);
        },
        undefined,
        reject,
      );
    });
  }

  /**
   * Generate LOD (Level of Detail) meshes
   */
  private generateLODs(model: THREE.Group): void {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const lod = new THREE.LOD();

        // Original mesh (high detail)
        lod.addLevel(object.clone(), 0);

        // Medium detail (50% vertices)
        const mediumMesh = this.simplifyMesh(object, 0.5);
        if (mediumMesh) {
          lod.addLevel(mediumMesh, 10);
        }

        // Low detail (25% vertices)
        const lowMesh = this.simplifyMesh(object, 0.25);
        if (lowMesh) {
          lod.addLevel(lowMesh, 30);
        }

        // Replace original mesh with LOD
        if (object.parent) {
          object.parent.add(lod);
          object.parent.remove(object);
        }
      }
    });
  }

  /**
   * Simplify mesh (basic decimation)
   */
  private simplifyMesh(mesh: THREE.Mesh, ratio: number): THREE.Mesh | null {
    // This is a placeholder - in production, use a proper mesh simplification library
    // like three-mesh-bvh or simplify-modifier
    return null;
  }

  /**
   * Optimize materials for performance
   */
  private optimizeMaterials(model: THREE.Group): void {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const material = object.material;

        if (material instanceof THREE.MeshStandardMaterial) {
          // Enable flat shading for low-poly models
          if (object.geometry.attributes.position.count < 1000) {
            material.flatShading = true;
          }

          // Optimize texture filtering
          if (material.map) {
            material.map.anisotropy = 4;
          }
        }
      }
    });
  }

  /**
   * Preload multiple assets
   */
  public async preloadAssets(
    urls: string[],
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    let loaded = 0;
    const total = urls.length;

    const promises = urls.map(async (url) => {
      try {
        if (url.endsWith('.glb') || url.endsWith('.gltf')) {
          await this.loadModel(url);
        } else {
          await this.loadTexture(url);
        }
        loaded++;
        if (onProgress) {
          onProgress(loaded, total);
        }
      } catch (error) {
        log.error(`Failed to load asset: ${url}`, error);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  public getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.cache.clear();
    this.loadingQueue.clear();
    this.dracoLoader.dispose();
  }
}

// Singleton instance
export const assetLoader = new AssetLoader();

