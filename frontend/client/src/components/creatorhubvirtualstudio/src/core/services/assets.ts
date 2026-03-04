import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { logger } from './logger';

const log = logger.module('Assets');

export interface LoadedModel {
  url: string;
  scene?: THREE.Group;
  animations?: THREE.AnimationClip[];
  cameras?: THREE.Camera[];
  loaded: boolean;
  error?: string;
}

const cache = new Map<string, LoadedModel>();
let gltfLoader: GLTFLoader | null = null;
let dracoLoader: DRACOLoader | null = null;

/**
 * Initialize the GLTF loader with Draco compression support
 */
function getGLTFLoader(): GLTFLoader {
  if (!gltfLoader) {
    gltfLoader = new GLTFLoader();
    
    // Setup Draco loader for compressed models
    try {
      dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      gltfLoader.setDRACOLoader(dracoLoader);
    } catch (e) {
      log.warn('Draco loader not available, compressed models may fail to load');
    }
  }
  return gltfLoader;
}

/**
 * Load a 3D model from URL (GLTF/GLB format)
 */
export async function loadModel(url: string): Promise<LoadedModel> {
  // Return cached model if available
  if (cache.has(url)) {
    return cache.get(url)!;
  }

  // Create placeholder entry to prevent duplicate loading
  const placeholder: LoadedModel = { url, loaded: false };
  cache.set(url, placeholder);

  try {
    const loader = getGLTFLoader();
    
    const gltf: GLTF = await new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => resolve(gltf),
        (progress) => {
          // Optional: track loading progress
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            log.debug(`Loading ${url}: ${percent.toFixed(0)}%`);
          }
        },
        (error) => reject(error)
      );
    });

    // Create loaded model with scene and animations
    const loadedModel: LoadedModel = {
      url,
      scene: gltf.scene,
      animations: gltf.animations,
      cameras: gltf.cameras,
      loaded: true,
    };

    // Optimize the loaded model
    optimizeModel(gltf.scene);

    // Update cache with loaded model
    cache.set(url, loadedModel);
    return loadedModel;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message :'Unknown error';
    log.error(`Failed to load model: ${url}`, error);
    
    const failedModel: LoadedModel = {
      url,
      loaded: false,
      error: errorMessage,
    };
    
    cache.set(url, failedModel);
    return failedModel;
  }
}

/**
 * Optimize loaded model for better performance
 */
function optimizeModel(scene: THREE.Group): void {
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      // Enable frustum culling
      child.frustumCulled = true;
      
      // Enable shadow casting/receiving
      child.castShadow = true;
      child.receiveShadow = true;
      
      // Optimize materials
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            mat.needsUpdate = true;
          }
        });
      }
    }
  });
}

/**
 * Clone a loaded model for use in scene
 */
export function cloneModel(model: LoadedModel): THREE.Group | null {
  if (!model.scene) return null;
  
  const clone = model.scene.clone();
  
  // Deep clone materials to prevent shared state issues
  clone.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material = child.material.map((m) => m.clone());
      } else {
        child.material = child.material.clone();
      }
    }
  });
  
  return clone;
}

/**
 * Preload multiple models
 */
export async function preloadModels(urls: string[]): Promise<LoadedModel[]> {
  return Promise.all(urls.map((url) => loadModel(url)));
}

/**
 * Check if a model is cached
 */
export function isModelCached(url: string): boolean {
  return cache.has(url) && cache.get(url)!.loaded;
}

/**
 * Clear model cache
 */
export function clearModelCache(): void {
  cache.forEach((model) => {
    if (model.scene) {
      model.scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat) => {
              mat.dispose();
            });
          }
        }
      });
    }
  });
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; loaded: number; failed: number } {
  let loaded = 0;
  let failed = 0;
  
  cache.forEach((model) => {
    if (model.loaded) loaded++;
    if (model.error) failed++;
  });
  
  return { count: cache.size, loaded, failed };
}
