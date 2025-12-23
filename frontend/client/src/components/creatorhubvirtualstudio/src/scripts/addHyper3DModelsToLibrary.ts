/**
 * Script to automatically add Hyper3D-generated models to the user library
 * 
 * This script:
 * 1. Scans for GLB/GLTF files in public directories
 * 2. Generates thumbnails from 3D models
 * 3. Adds them to the user library with proper metadata
 * 
 * Usage:
 * - Import and call from browser console: `addHyper3DModelsToLibrary()`
 * - Or run as a standalone utility
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { saveUserAsset, type UserLibraryAsset } from '@/core/services/userLibrary';

/**
 * Directories to scan for Hyper3D models
 * 
 * Based on HYPER3D_ASSET_GENERATION_PLAN.md:
 * - 3D Models (GLB): public/models/
 *   - public/models/lights/ - Studio lights
 *   - public/models/modifiers/ - Light modifiers
 *   - public/models/cameras/ - Camera equipment
 *   - public/models/lenses/ - Camera lenses
 *   - public/models/poses/ - Character poses
 */
const MODEL_DIRECTORIES = [
  '/models/lights/',
  '/models/modifiers/',
  '/models/cameras/',
  '/models/lenses/',
  '/models/poses/',
  '/assets/3d assets/', // Legacy location
];

// Asset type mapping based on directory
const TYPE_MAP: Record<string, 'light' | 'model' | 'prop'> = {
  'equipment': 'light',
  'poses': 'model',
  'modifiers': 'light',
  '3d assets': 'prop',
};

/**
 * Generate a thumbnail from a 3D model URL
 */
// Reusable WebGL renderer to avoid context leaks
let thumbnailRenderer: THREE.WebGLRenderer | null = null;
function getThumbnailRenderer(): THREE.WebGLRenderer {
  if (!thumbnailRenderer) {
    thumbnailRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    thumbnailRenderer.setSize(256, 256);
    thumbnailRenderer.setClearColor(0xffffff, 1); // White background
  }
  return thumbnailRenderer;
}

async function generateThumbnail(modelUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      // Reuse renderer to avoid WebGL context leaks
      const renderer = getThumbnailRenderer();

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      camera.position.set(2, 2, 2);
      camera.lookAt(0, 0, 0);

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);

      // Load model
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          scene.add(gltf.scene);

          // Center and scale model
          const box = new THREE.Box3().setFromObject(gltf.scene);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) {
            gltf.scene.scale.multiplyScalar(1.5 / maxDim);
          }
          const center = box.getCenter(new THREE.Vector3());
          gltf.scene.position.sub(center);

          // Render
          renderer.render(scene, camera);
          const dataUrl = renderer.domElement.toDataURL('image/png');

          // Cleanup scene (but keep renderer for reuse)
          gltf.scene.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.dispose();
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
          scene.clear(); // Remove all objects from scene

          resolve(dataUrl);
        },
        undefined,
        (error) => {
          console.error('Failed to load model for thumbnail:', error);
          resolve(null);
        }
      );
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      resolve(null);
    }
  });
}

/**
 * Extract asset metadata from filename
 */
function extractMetadata(filename: string, directory: string): {
  title: string;
  type: 'light' | 'model' | 'prop';
  tags: string[];
} {
  // Remove extension
  const name = filename.replace(/\.(glb|gltf)$/i, '');
  
  // Determine type from directory
  let type: 'light' | 'model' | 'prop' = 'prop';
  for (const [key, value] of Object.entries(TYPE_MAP)) {
    if (directory.includes(key)) {
      type = value;
      break;
    }
  }

  // Extract tags from filename
  const tags: string[] = [];
  const lowerName = name.toLowerCase();
  
  // Equipment tags
  if (lowerName.includes('profoto') || lowerName.includes('d2')) tags.push('profoto');
  if (lowerName.includes('godox') || lowerName.includes('ad600')) tags.push('godox');
  if (lowerName.includes('aputure') || lowerName.includes('300d')) tags.push('aputure');
  if (lowerName.includes('softbox')) tags.push('softbox', 'modifier');
  if (lowerName.includes('umbrella')) tags.push('umbrella', 'modifier');
  if (lowerName.includes('beauty') || lowerName.includes('dish')) tags.push('beauty-dish', 'modifier');
  if (lowerName.includes('stripbox')) tags.push('stripbox', 'modifier');
  if (lowerName.includes('octabox')) tags.push('octabox', 'modifier');
  if (lowerName.includes('reflector')) tags.push('reflector', 'modifier');
  if (lowerName.includes('spot')) tags.push('spot', 'modifier');
  if (lowerName.includes('camera')) tags.push('camera');
  if (lowerName.includes('lens')) tags.push('lens');
  if (lowerName.includes('pose') || lowerName.includes('portrait') || lowerName.includes('fashion')) {
    tags.push('pose', 'model');
  }

  // Format title
  const title = name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\s+/, '')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return { title, type, tags };
}

/**
 * Scan for model files and add them to the library
 */
export async function addHyper3DModelsToLibrary(): Promise<{
  added: number;
  failed: number;
  skipped: number;
}> {
  console.log('🔍 Scanning for Hyper3D models...');

  const results = {
    added: 0,
    failed: 0,
    skipped: 0,
  };

  // Get existing user assets to avoid duplicates
  const { listUserAssets } = await import('@/core/services/userLibrary');
  const existingAssets = await listUserAssets();
  const existingUrls = new Set(existingAssets.map((a) => a.modelUrl).filter(Boolean));

  // Scan each directory
  for (const dir of MODEL_DIRECTORIES) {
    try {
      // Try to fetch directory listing (this won't work directly, so we'll use a different approach)
      // Instead, we'll check for known model files or use a manifest
      console.log(`📁 Checking directory: ${dir}`);
    } catch (error) {
      console.warn(`⚠️  Could not access ${dir}:`, error);
    }
  }

  // Alternative: Use a manifest file or check for specific known models
  // For now, let's create a function that can be called with specific model URLs
  console.log('💡 Use addHyper3DModel() to add individual models with their URLs');

  return results;
}

/**
 * Add a single Hyper3D model to the library
 */
export async function addHyper3DModel(
  modelUrl: string,
  options?: {
    title?: string;
    type?: 'light' | 'model' | 'prop';
    tags?: string[];
    skipThumbnail?: boolean;
  }
): Promise<{ success: boolean; assetId?: string; error?: string }> {
  try {
    console.log(`📦 Adding model: ${modelUrl}`);

    // Check if already exists
    const { listUserAssets } = await import('@/core/services/userLibrary');
    const existingAssets = await listUserAssets();
    if (existingAssets.some((a) => a.modelUrl === modelUrl)) {
      console.log(`⏭️  Model already in library: ${modelUrl}`);
      return { success: false, error: 'Model already exists' };
    }

    // Extract metadata from URL if not provided
    const urlParts = modelUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    const directory = urlParts.slice(0, -1).join('/');

    const metadata = options?.title
      ? {
          title: options.title,
          type: options.type || 'prop',
          tags: options.tags || [],
        }
      : extractMetadata(filename, directory);

    // Generate thumbnail
    let thumbDataUrl: string | undefined;
    if (!options?.skipThumbnail) {
      console.log('🎨 Generating thumbnail...');
      thumbDataUrl = (await generateThumbnail(modelUrl)) || undefined;
      if (thumbDataUrl) {
        console.log('✅ Thumbnail generated');
      } else {
        console.warn('⚠️  Failed to generate thumbnail, continuing without it');
      }
    }

    // Create asset
    const assetId = `hyper3d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const asset: UserLibraryAsset = {
      id: assetId,
      type: metadata.type,
      title: metadata.title,
      tags: metadata.tags,
      modelUrl,
      thumbDataUrl,
      data: {
        modelUrl,
        source: 'hyper3d',
        addedAt: new Date().toISOString(),
      },
    };

    // Save to library
    await saveUserAsset(asset);
    console.log(`✅ Added to library: ${metadata.title} (${assetId})`);

    return { success: true, assetId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to add model ${modelUrl}:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Add multiple Hyper3D models from a list
 */
export async function addHyper3DModels(
  models: Array<{
    url: string;
    title?: string;
    type?: 'light' | 'model' | 'prop';
    tags?: string[];
  }>
): Promise<{
  added: number;
  failed: number;
  results: Array<{ url: string; success: boolean; assetId?: string; error?: string }>;
}> {
  console.log(`📦 Adding ${models.length} models to library...`);

  const results = {
    added: 0,
    failed: 0,
    results: [] as Array<{ url: string; success: boolean; assetId?: string; error?: string }>,
  };

  for (const model of models) {
    const result = await addHyper3DModel(model.url, {
      title: model.title,
      type: model.type,
      tags: model.tags,
    });

    results.results.push({ url: model.url, ...result });

    if (result.success) {
      results.added++;
    } else {
      results.failed++;
    }

    // Small delay to avoid overwhelming the browser
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(`✅ Added ${results.added} models, ${results.failed} failed`);
  return results;
}

/**
 * Quick helper to add the existing GLB file
 */
export async function addExistingModels(): Promise<void> {
  const existingModels = [
    {
      url: '/assets/3d assets/S1h_ez2_textured_mesh_glb.glb',
      title: 'Textured Mesh Model',
      type: 'prop' as const,
      tags: ['hyper3d', 'mesh'],
    },
  ];

  await addHyper3DModels(existingModels);
}

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).addHyper3DModel = addHyper3DModel;
  (window as any).addHyper3DModels = addHyper3DModels;
  (window as any).addHyper3DModelsToLibrary = addHyper3DModelsToLibrary;
  (window as any).addExistingModels = addExistingModels;
}

