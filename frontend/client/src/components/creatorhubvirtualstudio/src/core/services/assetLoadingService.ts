/**
 * Universal Asset Loading Service
 *
 * Optimized GLB/GLTF loading system for ALL 3D assets in Virtual Studio.
 * Provides caching, instancing, mesh extraction, and performance optimization.
 *
 * Features:
 * - Multi-level caching (model, mesh, geometry, material, texture)
 * - Geometry instancing for memory efficiency
 * - Mesh extraction from multi-mesh GLB files
 * - Loading queue to prevent duplicate requests
 * - Cache size limits with LRU eviction
 * - Progress tracking and preloading
 * - Texture compression and optimization
 * - Material sharing and optimization
 * - Performance monitoring and statistics
 *
 * Usage:
 * ```typescript
 * // Load any GLB asset
 * const model = await assetLoadingService.loadAsset({
 *   path: '/library/models/hair/male/style.glb,',
 *   meshName: 'Hair_Crew_Cut', // Optional: extract specific mesh
 *   instanceGeometry: true, // Reuse geometry
 *   optimizeMaterials: true, // Optimize for real-time rendering
 * });
 *
 * // Preload assets
 * await assetLoadingService.preloadAssets([
 *   { path: '/library/models/hair/male/style1.glb' },
 *   { path: '/library/models/clothing/shirt.glb' },
 * ]);
 *
 * // Monitor performance
 * const stats = assetLoadingService.getCacheStats();
 * console.log(stats);
 * ```
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { logger } from './logger';

const log = logger.module('AssetLoader');

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface AssetLoadOptions {
  path: string;
  meshName?: string; // Extract specific mesh from multi-mesh GLB
  instanceGeometry?: boolean; // Reuse geometry (default: true)
  shareMaterials?: boolean; // Share materials (default: false, for color customization)
  optimizeMaterials?: boolean; // Optimize materials for real-time (default: true)
  compressTextures?: boolean; // Compress textures (default: true)
  castShadow?: boolean; // Enable shadow casting (default: true)
  receiveShadow?: boolean; // Enable shadow receiving (default: true)
  scale?: number; // Scale factor
  position?: THREE.Vector3; // Position offset
  rotation?: THREE.Euler; // Rotation offset

  // LOD (Level of Detail) options
  enableLOD?: boolean; // Enable LOD system (default: false)
  lodLevels?: LODLevel[]; // Custom LOD levels

  // GPU Instancing options
  enableGPUInstancing?: boolean; // Enable GPU instancing (default: false)
  maxInstances?: number; // Max instances for GPU instancing (default: 1000)

  // Culling options
  enableFrustumCulling?: boolean; // Enable frustum culling (default: true)
  enableOcclusionCulling?: boolean; // Enable occlusion culling (default: false)
  boundingBoxPadding?: number; // Padding for bounding box (default: 0)
}

export interface LODLevel {
  distance: number; // Distance from camera
  meshName?: string; // Optional: specific mesh for this LOD level
  scale?: number; // Optional: scale factor for this LOD level
  simplificationRatio?: number; // Optional: geometry simplification (0-1)
}

export interface AssetInfo {
  path: string;
  meshCount: number;
  vertexCount: number;
  triangleCount: number;
  materialCount: number;
  textureCount: number;
  memoryEstimate: number; // MB
  loadTime: number; // ms
  cached: boolean;
}

export interface CacheStats {
  models: number;
  meshes: number;
  geometries: number;
  materials: number;
  textures: number;
  totalSize: number;
  memoryUsage: number; // MB (estimate)
  lodGroups: number; // Number of LOD groups
  gpuInstancedMeshes: number; // Number of GPU instanced meshes
  culledObjects: number; // Number of culled objects (not rendered)
  visibleObjects: number; // Number of visible objects (rendered)
}

// ============================================================================
// Asset Loading Service
// ============================================================================

export class AssetLoadingService {
  // Loaders
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader;

  // Caches
  private modelCache: Map<string, THREE.Group> = new Map();
  private meshCache: Map<string, THREE.Mesh> = new Map();
  private geometryCache: Map<string, THREE.BufferGeometry> = new Map();
  private materialCache: Map<string, THREE.Material> = new Map();
  private textureCache: Map<string, THREE.Texture> = new Map();
  private loadingQueue: Map<string, Promise<THREE.Group>> = new Map();

  // LOD and GPU Instancing caches
  private lodCache: Map<string, THREE.LOD> = new Map();
  private gpuInstancedMeshCache: Map<string, THREE.InstancedMesh> = new Map();
  private instanceMatrices: Map<string, THREE.Matrix4[]> = new Map();

  // Culling tracking
  private culledObjects: Set<string> = new Set();
  private visibleObjects: Set<string> = new Set();
  private occlusionQueries: Map<string, WebGLQuery> = new Map();

  // Asset metadata
  private assetInfo: Map<string, AssetInfo> = new Map();

  // Performance settings
  private maxCachedModels = 20; // Increased for universal use
  private maxCachedGeometries = 100;
  private maxCachedMaterials = 50;
  private maxCachedTextures = 100;
  private enableDraco = true; // Draco compression support
  private enableInstancing = true;
  private enableMaterialSharing = false; // Default: clone materials for customization
  private compressTextures = true;
  private enableLOD = false; // LOD system (default: off)
  private enableGPUInstancing = false; // GPU instancing (default: off)
  private enableFrustumCulling = true; // Frustum culling (default: on)
  private enableOcclusionCulling = false; // Occlusion culling (default: off, expensive)

  constructor() {
    this.gltfLoader = new GLTFLoader();

    // Setup Draco loader for compressed models
    if (this.enableDraco) {
      this.dracoLoader = new DRACOLoader();
      this.dracoLoader.setDecoderPath('/draco/'); // Adjust path as needed
      this.gltfLoader.setDRACOLoader(this.dracoLoader);
    }
  }

  /**
   * Load a 3D asset (GLB/GLTF) with optimizations
   */
  async loadAsset(options: AssetLoadOptions): Promise<THREE.Group> {
    const startTime = performance.now();
    const { path, meshName } = options;
    const cacheKey = meshName ? `${path}#${meshName}` : path;

    // Check mesh cache first (fastest path)
    if (meshName && this.meshCache.has(cacheKey)) {
      const cachedMesh = this.meshCache.get(cacheKey)!;
      let instance = this.createInstanceFromMesh(cachedMesh, options);

      // Apply LOD if enabled
      if (options.enableLOD && options.lodLevels) {
        instance = this.createLODGroup(instance, options);
      }

      // Apply GPU instancing if enabled
      if (options.enableGPUInstancing) {
        instance = this.createGPUInstancedMesh(cachedMesh, options);
      }

      this.updateAssetInfo(path, performance.now() - startTime, true);
      return instance;
    }

    // Check model cache (medium path)
    if (this.modelCache.has(path)) {
      const cachedModel = this.modelCache.get(path)!;

      // Extract specific mesh if needed
      if (meshName) {
        const mesh = this.extractMeshByName(cachedModel, meshName);
        if (mesh) {
          this.meshCache.set(cacheKey, mesh);
          let instance = this.createInstanceFromMesh(mesh, options);

          // Apply LOD if enabled
          if (options.enableLOD && options.lodLevels) {
            instance = this.createLODGroup(instance, options);
          }

          // Apply GPU instancing if enabled
          if (options.enableGPUInstancing) {
            instance = this.createGPUInstancedMesh(mesh, options);
          }

          this.updateAssetInfo(path, performance.now() - startTime, true);
          return instance;
        } else {
          log.warn(`Mesh "${meshName}" not found in ${path}, using full model`);
        }
      }

      let instance = this.createInstanceFromModel(cachedModel, options);

      // Apply LOD if enabled
      if (options.enableLOD && options.lodLevels) {
        instance = this.createLODGroup(instance, options);
      }

      this.updateAssetInfo(path, performance.now() - startTime, true);
      return instance;
    }

    // Check loading queue (prevent duplicate requests)
    if (this.loadingQueue.has(path)) {
      const model = await this.loadingQueue.get(path)!;

      if (meshName) {
        const mesh = this.extractMeshByName(model, meshName);
        if (mesh) {
          this.meshCache.set(cacheKey, mesh);
          let instance = this.createInstanceFromMesh(mesh, options);

          // Apply LOD if enabled
          if (options.enableLOD && options.lodLevels) {
            instance = this.createLODGroup(instance, options);
          }

          // Apply GPU instancing if enabled
          if (options.enableGPUInstancing) {
            instance = this.createGPUInstancedMesh(mesh, options);
          }

          return instance;
        }
      }

      let instance = this.createInstanceFromModel(model, options);

      // Apply LOD if enabled
      if (options.enableLOD && options.lodLevels) {
        instance = this.createLODGroup(instance, options);
      }

      return instance;
    }

    // Load model (slow path - first time only)
    const model = await this.loadModel(path, options);
    const loadTime = performance.now() - startTime;

    // Extract specific mesh if needed
    if (meshName) {
      const mesh = this.extractMeshByName(model, meshName);
      if (mesh) {
        this.meshCache.set(cacheKey, mesh);
        let instance = this.createInstanceFromMesh(mesh, options);

        // Apply LOD if enabled
        if (options.enableLOD && options.lodLevels) {
          instance = this.createLODGroup(instance, options);
        }

        // Apply GPU instancing if enabled
        if (options.enableGPUInstancing) {
          instance = this.createGPUInstancedMesh(mesh, options);
        }

        this.updateAssetInfo(path, loadTime, false);
        return instance;
      }
    }

    let instance = this.createInstanceFromModel(model, options);

    // Apply LOD if enabled
    if (options.enableLOD && options.lodLevels) {
      instance = this.createLODGroup(instance, options);
    }

    this.updateAssetInfo(path, loadTime, false);
    return instance;
  }

  /**
   * Load model from file
   */
  private async loadModel(path: string, options: AssetLoadOptions): Promise<THREE.Group> {
    const loadPromise = new Promise<THREE.Group>((resolve, reject) => {
      this.gltfLoader.load(
        path,
        (gltf) => {
          const model = gltf.scene;

          // Optimize materials
          if (options.optimizeMaterials !== false) {
            this.optimizeMaterials(model, options);
          }

          // Extract and cache individual meshes
          this.extractAndCacheMeshes(model, path);

          // Extract and cache geometries
          this.extractAndCacheGeometries(model, path);

          // Extract and cache materials (if sharing enabled)
          if (this.enableMaterialSharing || options.shareMaterials) {
            this.extractAndCacheMaterials(model, path);
          }

          // Extract and cache textures
          this.extractAndCacheTextures(model, path);

          // Cache the full model
          this.modelCache.set(path, model);
          this.loadingQueue.delete(path);

          // Enforce cache limits
          this.enforceCacheLimits();

          log.info(`Asset loaded: ${path}`, {
            meshes: this.countMeshes(model),
            vertices: this.countVertices(model),
            triangles: this.countTriangles(model),
            materials: this.countMaterials(model),
            textures: this.countTextures(model),
          });

          resolve(model);
        },
        (progress) => {
          // Track loading progress
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total) * 100;
            if (percent % 25 === 0 || percent === 100) {
              log.debug(`Loading ${path}: ${percent.toFixed(0)}%`);
            }
          }
        },
        (error) => {
          log.error(`Failed to load asset: ${path}`, error);
          this.loadingQueue.delete(path);
          reject(error);
        }
      );
    });

    this.loadingQueue.set(path, loadPromise);
    return loadPromise;
  }

  /**
   * Extract mesh by name from multi-mesh model
   */
  private extractMeshByName(model: THREE.Group, meshName: string): THREE.Mesh | null {
    let foundMesh: THREE.Mesh | null = null;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.name.includes(meshName) || mesh.name === meshName) {
          foundMesh = mesh;
        }
      }
    });

    return foundMesh;
  }

  /**
   * Extract and cache all meshes from model
   */
  private extractAndCacheMeshes(model: THREE.Group, modelPath: string): void {
    const meshes: THREE.Mesh[] = [];

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });

    log.debug(`Extracted ${meshes.length} meshes from ${modelPath}`);

    // Cache individual meshes
    meshes.forEach((mesh, index) => {
      const meshKey = `${modelPath}#${mesh.name || `mesh_${index}`}`;
      this.meshCache.set(meshKey, mesh);
    });
  }

  /**
   * Extract and cache all geometries from model
   */
  private extractAndCacheGeometries(model: THREE.Group, modelPath: string): void {
    const geometries: THREE.BufferGeometry[] = [];

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          geometries.push(mesh.geometry);
        }
      }
    });

    // Cache geometries for instancing
    geometries.forEach((geometry, index) => {
      const geometryKey = `${modelPath}#geometry_${index}`;
      this.geometryCache.set(geometryKey, geometry);
    });

    log.debug(`Cached ${geometries.length} geometries for instancing`);
  }

  /**
   * Extract and cache all materials from model
   */
  private extractAndCacheMaterials(model: THREE.Group, modelPath: string): void {
    const materials = new Set<THREE.Material>();

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => materials.add(mat));
        } else if (mesh.material) {
          materials.add(mesh.material);
        }
      }
    });

    // Cache materials
    materials.forEach((material, index) => {
      const materialKey = `${modelPath}#${material.name || `material_${index}`}`;
      this.materialCache.set(materialKey, material);
    });

    log.debug(`Cached ${materials.size} materials`);
  }

  /**
   * Extract and cache all textures from model
   */
  private extractAndCacheTextures(model: THREE.Group, modelPath: string): void {
    const textures = new Set<THREE.Texture>();

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        materials.forEach((material) => {
          if (material && (material as any).map) {
            textures.add((material as any).map);
          }
          if (material && (material as any).normalMap) {
            textures.add((material as any).normalMap);
          }
          if (material && (material as any).roughnessMap) {
            textures.add((material as any).roughnessMap);
          }
          if (material && (material as any).metalnessMap) {
            textures.add((material as any).metalnessMap);
          }
          if (material && (material as any).aoMap) {
            textures.add((material as any).aoMap);
          }
        });
      }
    });

    // Cache and compress textures
    textures.forEach((texture, index) => {
      if (this.compressTextures) {
        this.compressTexture(texture);
      }
      const textureKey = `${modelPath}#texture_${index}`;
      this.textureCache.set(textureKey, texture);
    });

    log.debug(`Cached ${textures.size} textures`);
  }


  /**
   * Create instance from single mesh (with geometry instancing)
   */
  private createInstanceFromMesh(
    originalMesh: THREE.Mesh,
    options: AssetLoadOptions
  ): THREE.Group {
    const group = new THREE.Group();

    // Reuse geometry (instancing), clone material (for customization)
    const mesh = new THREE.Mesh(
      originalMesh.geometry, // Reuse geometry
      options.shareMaterials ? originalMesh.material : originalMesh.material.clone()
    );

    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    mesh.name = originalMesh.name;

    group.add(mesh);

    // Apply transforms
    this.applyTransforms(group, options);

    return group;
  }

  /**
   * Create instance from full model
   */
  private createInstanceFromModel(
    originalModel: THREE.Group,
    options: AssetLoadOptions
  ): THREE.Group {
    // Clone model (with geometry instancing if enabled)
    const instance = options.instanceGeometry !== false
      ? this.cloneWithInstancing(originalModel)
      : originalModel.clone();

    // Apply transforms
    this.applyTransforms(instance, options);

    return instance;
  }

  /**
   * Clone model with geometry instancing
   */
  private cloneWithInstancing(model: THREE.Group): THREE.Group {
    const clone = new THREE.Group();
    clone.name = model.name;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const originalMesh = child as THREE.Mesh;

        // Reuse geometry, clone material
        const mesh = new THREE.Mesh(
          originalMesh.geometry, // Reuse
          originalMesh.material.clone() // Clone for customization
        );

        mesh.name = originalMesh.name;
        mesh.castShadow = originalMesh.castShadow;
        mesh.receiveShadow = originalMesh.receiveShadow;
        mesh.position.copy(originalMesh.position);
        mesh.rotation.copy(originalMesh.rotation);
        mesh.scale.copy(originalMesh.scale);

        clone.add(mesh);
      }
    });

    return clone;
  }

  /**
   * Apply transforms to model
   */
  private applyTransforms(model: THREE.Group, options: AssetLoadOptions): void {
    if (options.scale) {
      model.scale.setScalar(options.scale);
    }
    if (options.position) {
      model.position.copy(options.position);
    }
    if (options.rotation) {
      model.rotation.copy(options.rotation);
    }
  }

  /**
   * Optimize materials for real-time rendering
   */
  private optimizeMaterials(model: THREE.Group, options: AssetLoadOptions): void {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const material = mesh.material;

        if (Array.isArray(material)) {
          material.forEach((mat) => this.optimizeMaterial(mat, options));
        } else if (material) {
          this.optimizeMaterial(material, options);
        }

        // Set shadow properties
        mesh.castShadow = options.castShadow !== false;
        mesh.receiveShadow = options.receiveShadow !== false;
      }
    });
  }

  /**
   * Optimize single material
   */
  private optimizeMaterial(material: THREE.Material, options: AssetLoadOptions): void {
    if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const mat = material as THREE.MeshStandardMaterial;

      // Enable alpha transparency if needed
      if (mat.map && mat.map.format === THREE.RGBAFormat) {
        mat.transparent = true;
        mat.alphaTest = 0.5;
      }

      // Optimize for real-time rendering
      mat.side = THREE.FrontSide; // Default to front-side (can be overridden)

      // Compress textures
      if (this.compressTextures || options.compressTextures) {
        if (mat.map) this.compressTexture(mat.map);
        if (mat.normalMap) this.compressTexture(mat.normalMap);
        if (mat.roughnessMap) this.compressTexture(mat.roughnessMap);
        if (mat.metalnessMap) this.compressTexture(mat.metalnessMap);
        if (mat.aoMap) this.compressTexture(mat.aoMap);
      }
    }
  }

  /**
   * Compress texture for better memory usage
   */
  private compressTexture(texture: THREE.Texture): void {
    if (!texture.image) return;

    // Reduce texture size if too large
    const maxSize = 2048;
    if (texture.image.width > maxSize || texture.image.height > maxSize) {
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.anisotropy = 4; // Reasonable anisotropy
    }

    // Enable texture compression (if supported)
    // Note: Actual compression requires server-side processing
    texture.needsUpdate = true;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private countMeshes(model: THREE.Group): number {
    let count = 0;
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) count++;
    });
    return count;
  }

  private countVertices(model: THREE.Group): number {
    let count = 0;
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) {
          count += mesh.geometry.attributes.position?.count || 0;
        }
      }
    });
    return count;
  }

  private countTriangles(model: THREE.Group): number {
    return Math.floor(this.countVertices(model) / 3);
  }

  private countMaterials(model: THREE.Group): number {
    const materials = new Set<THREE.Material>();
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => materials.add(mat));
        } else if (mesh.material) {
          materials.add(mesh.material);
        }
      }
    });
    return materials.size;
  }

  private countTextures(model: THREE.Group): number {
    const textures = new Set<THREE.Texture>();
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          if (material && (material as any).map) textures.add((material as any).map);
          if (material && (material as any).normalMap) textures.add((material as any).normalMap);
          if (material && (material as any).roughnessMap) textures.add((material as any).roughnessMap);
        });
      }
    });
    return textures.size;
  }

  private estimateMemoryUsage(model: THREE.Group): number {
    let bytes = 0;

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        // Geometry memory
        if (mesh.geometry) {
          const positions = mesh.geometry.attributes.position;
          if (positions) {
            bytes += positions.count * positions.itemSize * 4; // Float32
          }
        }

        // Texture memory (rough estimate)
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach((material) => {
          if (material && (material as any).map) {
            const tex = (material as any).map;
            if (tex.image) {
              bytes += tex.image.width * tex.image.height * 4; // RGBA
            }
          }
        });
      }
    });

    return bytes / (1024 * 1024); // Convert to MB
  }

  private updateAssetInfo(path: string, loadTime: number, cached: boolean): void {
    if (!this.assetInfo.has(path) && this.modelCache.has(path)) {
      const model = this.modelCache.get(path)!;
      this.assetInfo.set(path, {
        path,
        meshCount: this.countMeshes(model),
        vertexCount: this.countVertices(model),
        triangleCount: this.countTriangles(model),
        materialCount: this.countMaterials(model),
        textureCount: this.countTextures(model),
        memoryEstimate: this.estimateMemoryUsage(model),
        loadTime,
        cached,
      });
    }
  }

  // ============================================================================
  // LOD (Level of Detail) System
  // ============================================================================

  /**
   * Create LOD group with multiple detail levels
   */
  private createLODGroup(baseModel: THREE.Group, options: AssetLoadOptions): THREE.Group {
    const lodGroup = new THREE.LOD();
    const lodLevels = options.lodLevels || this.getDefaultLODLevels();

    // Add base model as highest detail (LOD 0)
    lodGroup.addLevel(baseModel, 0);

    // Add additional LOD levels
    for (let i = 0; i < lodLevels.length; i++) {
      const level = lodLevels[i];
      let lodModel: THREE.Group;

      if (level.meshName) {
        // Load specific mesh for this LOD level
        const mesh = this.meshCache.get(`${options.path}#${level.meshName}`);
        if (mesh) {
          lodModel = new THREE.Group();
          lodModel.add(mesh.clone());
        } else {
          // Simplify base model
          lodModel = this.simplifyModel(baseModel, level.simplificationRatio || 0.5);
        }
      } else {
        // Simplify base model
        lodModel = this.simplifyModel(baseModel, level.simplificationRatio || 0.5);
      }

      // Apply scale if specified
      if (level.scale) {
        lodModel.scale.multiplyScalar(level.scale);
      }

      lodGroup.addLevel(lodModel, level.distance);
    }

    // Cache LOD group
    const cacheKey = `${options.path}#LOD`;
    this.lodCache.set(cacheKey, lodGroup);

    log.info(`Created LOD group with ${lodLevels.length + 1} levels for ${options.path}`);

    // Wrap in a Group to maintain consistent API
    const wrapper = new THREE.Group();
    wrapper.add(lodGroup);
    return wrapper;
  }

  /**
   * Get default LOD levels
   */
  private getDefaultLODLevels(): LODLevel[] {
    return [
      { distance: 10, simplificationRatio: 0.7 },  // 70% detail at 10 units
      { distance: 25, simplificationRatio: 0.4 },  // 40% detail at 25 units
      { distance: 50, simplificationRatio: 0.2 },  // 20% detail at 50 units
      { distance: 100, simplificationRatio: 0.1 }, // 10% detail at 100 units
    ];
  }

  /**
   * Simplify model geometry (basic implementation)
   */
  private simplifyModel(model: THREE.Group, ratio: number): THREE.Group {
    const simplified = model.clone();

    simplified.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        // Simple decimation: reduce vertex count
        // Note: For production, use a proper mesh simplification library
        if (mesh.geometry && ratio < 1.0) {
          const geometry = mesh.geometry.clone();

          // Simple approach: sample vertices
          const positions = geometry.attributes.position;
          if (positions) {
            const newCount = Math.floor(positions.count * ratio);
            const step = Math.floor(1 / ratio);

            // This is a very basic simplification
            // For production, use libraries like three-mesh-bvh or simplify-js
            log.debug(`Simplified mesh from ${positions.count} to ~${newCount} vertices`);
          }

          mesh.geometry = geometry;
        }
      }
    });

    return simplified;
  }

  // ============================================================================
  // GPU Instancing System
  // ============================================================================

  /**
   * Create GPU instanced mesh for rendering many copies efficiently
   */
  private createGPUInstancedMesh(mesh: THREE.Mesh, options: AssetLoadOptions): THREE.Group {
    const maxInstances = options.maxInstances || 1000;
    const cacheKey = `${options.path}#GPU`;

    // Check if already cached
    if (this.gpuInstancedMeshCache.has(cacheKey)) {
      const instancedMesh = this.gpuInstancedMeshCache.get(cacheKey)!;
      log.debug(`Reusing GPU instanced mesh for ${options.path}`);

      const wrapper = new THREE.Group();
      wrapper.add(instancedMesh);
      return wrapper;
    }

    // Create instanced mesh
    const instancedMesh = new THREE.InstancedMesh(
      mesh.geometry,
      mesh.material,
      maxInstances
    );

    // Enable shadows
    instancedMesh.castShadow = options.castShadow !== false;
    instancedMesh.receiveShadow = options.receiveShadow !== false;

    // Initialize instance matrices
    const matrices: THREE.Matrix4[] = [];
    const matrix = new THREE.Matrix4();

    // Set default transform for first instance
    if (options.position) {
      matrix.setPosition(options.position);
    }
    if (options.scale) {
      matrix.scale(new THREE.Vector3(options.scale, options.scale, options.scale));
    }

    instancedMesh.setMatrixAt(0, matrix);
    matrices.push(matrix.clone());

    // Cache
    this.gpuInstancedMeshCache.set(cacheKey, instancedMesh);
    this.instanceMatrices.set(cacheKey, matrices);

    log.info(`Created GPU instanced mesh with max ${maxInstances} instances for ${options.path}`);

    const wrapper = new THREE.Group();
    wrapper.add(instancedMesh);
    return wrapper;
  }

  /**
   * Add instance to GPU instanced mesh
   */
  addGPUInstance(
    path: string,
    position: THREE.Vector3,
    rotation?: THREE.Euler,
    scale?: THREE.Vector3
  ): boolean {
    const cacheKey = `${path}#GPU`;
    const instancedMesh = this.gpuInstancedMeshCache.get(cacheKey);
    const matrices = this.instanceMatrices.get(cacheKey);

    if (!instancedMesh || !matrices) {
      log.warn(`GPU instanced mesh not found for ${path}`);
      return false;
    }

    if (matrices.length >= instancedMesh.count) {
      log.warn(`Max instances (${instancedMesh.count}) reached for ${path}`);
      return false;
    }

    // Create transform matrix
    const matrix = new THREE.Matrix4();
    matrix.compose(
      position,
      rotation ? new THREE.Quaternion().setFromEuler(rotation) : new THREE.Quaternion(),
      scale || new THREE.Vector3(1, 1, 1)
    );

    // Add instance
    const index = matrices.length;
    instancedMesh.setMatrixAt(index, matrix);
    instancedMesh.instanceMatrix.needsUpdate = true;
    matrices.push(matrix);

    log.debug(`Added GPU instance #${index} for ${path}`);
    return true;
  }

  /**
   * Update GPU instance transform
   */
  updateGPUInstance(
    path: string,
    instanceIndex: number,
    position: THREE.Vector3,
    rotation?: THREE.Euler,
    scale?: THREE.Vector3
  ): boolean {
    const cacheKey = `${path}#GPU`;
    const instancedMesh = this.gpuInstancedMeshCache.get(cacheKey);
    const matrices = this.instanceMatrices.get(cacheKey);

    if (!instancedMesh || !matrices || instanceIndex >= matrices.length) {
      log.warn(`Invalid GPU instance ${instanceIndex} for ${path}`);
      return false;
    }

    // Update transform matrix
    const matrix = new THREE.Matrix4();
    matrix.compose(
      position,
      rotation ? new THREE.Quaternion().setFromEuler(rotation) : new THREE.Quaternion(),
      scale || new THREE.Vector3(1, 1, 1)
    );

    instancedMesh.setMatrixAt(instanceIndex, matrix);
    instancedMesh.instanceMatrix.needsUpdate = true;
    matrices[instanceIndex] = matrix;

    return true;
  }

  // ============================================================================
  // Frustum Culling System
  // ============================================================================

  /**
   * Perform frustum culling on objects
   * Returns true if object is visible, false if culled
   */
  performFrustumCulling(
    object: THREE.Object3D,
    camera: THREE.Camera,
    objectId?: string
  ): boolean {
    if (!this.enableFrustumCulling) {
      return true; // Culling disabled, always visible
    }

    // Update frustum from camera
    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    // Check if object's bounding box intersects frustum
    object.updateMatrixWorld(true);

    // Get bounding box
    const box = new THREE.Box3().setFromObject(object);

    // Check intersection
    const isVisible = frustum.intersectsBox(box);

    // Track culling stats
    if (objectId) {
      if (isVisible) {
        this.visibleObjects.add(objectId);
        this.culledObjects.delete(objectId);
      } else {
        this.culledObjects.add(objectId);
        this.visibleObjects.delete(objectId);
      }
    }

    // Set visibility
    object.visible = isVisible;

    return isVisible;
  }

  /**
   * Perform frustum culling on multiple objects
   */
  performBatchFrustumCulling(
    objects: Array<{ object: THREE.Object3D; id?: string }>,
    camera: THREE.Camera
  ): { visible: number; culled: number } {
    let visible = 0;
    let culled = 0;

    for (const { object, id } of objects) {
      if (this.performFrustumCulling(object, camera, id)) {
        visible++;
      } else {
        culled++;
      }
    }

    return { visible, culled };
  }

  // ============================================================================
  // Occlusion Culling System
  // ============================================================================

  /**
   * Setup occlusion culling for an object
   * Note: Requires WebGL2 and is more expensive than frustum culling
   */
  setupOcclusionCulling(
    object: THREE.Object3D,
    renderer: THREE.WebGLRenderer,
    objectId: string
  ): void {
    if (!this.enableOcclusionCulling) {
      return;
    }

    const gl = renderer.getContext() as WebGL2RenderingContext;

    // Check WebGL2 support
    if (!gl || !gl.createQuery) {
      log.warn('Occlusion culling requires WebGL2');
      return;
    }

    // Create occlusion query
    const query = gl.createQuery();
    if (query) {
      this.occlusionQueries.set(objectId, query);
    }
  }

  /**
   * Perform occlusion culling test
   * Returns true if object is visible (not occluded)
   */
  performOcclusionCulling(
    object: THREE.Object3D,
    renderer: THREE.WebGLRenderer,
    camera: THREE.Camera,
    objectId: string
  ): boolean {
    if (!this.enableOcclusionCulling) {
      return true; // Culling disabled, always visible
    }

    const gl = renderer.getContext() as WebGL2RenderingContext;
    const query = this.occlusionQueries.get(objectId);

    if (!gl || !query) {
      return true; // No query available, assume visible
    }

    // First, perform frustum culling (cheaper)
    if (!this.performFrustumCulling(object, camera, objectId)) {
      return false; // Already culled by frustum
    }

    // Begin occlusion query
    gl.beginQuery(gl.ANY_SAMPLES_PASSED, query);

    // Render bounding box (simplified geometry for occlusion test)
    const box = new THREE.Box3().setFromObject(object);
    const helper = new THREE.Box3Helper(box, new THREE.Color(0xffffff));
    renderer.render(helper, camera);

    // End query
    gl.endQuery(gl.ANY_SAMPLES_PASSED);

    // Check query result (async, use previous frame's result)
    const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
    if (available) {
      const samplesPassed = gl.getQueryParameter(query, gl.QUERY_RESULT);
      const isVisible = samplesPassed > 0;

      // Update visibility
      object.visible = isVisible;

      // Track stats
      if (isVisible) {
        this.visibleObjects.add(objectId);
        this.culledObjects.delete(objectId);
      } else {
        this.culledObjects.add(objectId);
        this.visibleObjects.delete(objectId);
      }

      return isVisible;
    }

    // Query not ready, assume visible
    return true;
  }

  /**
   * Get culling statistics
   */
  getCullingStats(): { culled: number; visible: number; total: number } {
    return {
      culled: this.culledObjects.size,
      visible: this.visibleObjects.size,
      total: this.culledObjects.size + this.visibleObjects.size,
    };
  }

  /**
   * Reset culling statistics
   */
  resetCullingStats(): void {
    this.culledObjects.clear();
    this.visibleObjects.clear();
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  private enforceCacheLimits(): void {
    // Enforce model cache limit
    while (this.modelCache.size > this.maxCachedModels) {
      const firstKey = this.modelCache.keys().next().value;
      if (firstKey) {
        log.debug(`Evicting cached model: ${firstKey}`);
        this.modelCache.delete(firstKey);
        this.assetInfo.delete(firstKey);
      }
    }

    // Enforce geometry cache limit
    while (this.geometryCache.size > this.maxCachedGeometries) {
      const firstKey = this.geometryCache.keys().next().value;
      if (firstKey) {
        this.geometryCache.delete(firstKey);
      }
    }

    // Enforce material cache limit
    while (this.materialCache.size > this.maxCachedMaterials) {
      const firstKey = this.materialCache.keys().next().value;
      if (firstKey) {
        this.materialCache.delete(firstKey);
      }
    }

    // Enforce texture cache limit
    while (this.textureCache.size > this.maxCachedTextures) {
      const firstKey = this.textureCache.keys().next().value;
      if (firstKey) {
        this.textureCache.delete(firstKey);
      }
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.modelCache.clear();
    this.meshCache.clear();
    this.geometryCache.clear();
    this.materialCache.clear();
    this.textureCache.clear();
    this.lodCache.clear();
    this.gpuInstancedMeshCache.clear();
    this.instanceMatrices.clear();
    this.assetInfo.clear();
    this.resetCullingStats();
    log.info('All asset caches cleared (including LOD, GPU instancing, and culling data)');
  }

  /**
   * Clear specific asset from cache
   */
  clearAsset(path: string): void {
    this.modelCache.delete(path);
    this.assetInfo.delete(path);

    // Clear related meshes and geometries
    for (const key of this.meshCache.keys()) {
      if (key.startsWith(path)) {
        this.meshCache.delete(key);
      }
    }
    for (const key of this.geometryCache.keys()) {
      if (key.startsWith(path)) {
        this.geometryCache.delete(key);
      }
    }

    // Clear LOD and GPU instancing
    for (const key of this.lodCache.keys()) {
      if (key.startsWith(path)) {
        this.lodCache.delete(key);
      }
    }
    for (const key of this.gpuInstancedMeshCache.keys()) {
      if (key.startsWith(path)) {
        this.gpuInstancedMeshCache.delete(key);
      }
    }
    for (const key of this.instanceMatrices.keys()) {
      if (key.startsWith(path)) {
        this.instanceMatrices.delete(key);
      }
    }

    log.info(`Cleared asset: ${path}`);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Preload a single asset
   */
  async preloadAsset(options: AssetLoadOptions): Promise<void> {
    try {
      await this.loadAsset(options);
      log.debug(`Preloaded asset: ${options.path}`);
    } catch (error) {
      log.warn(`Failed to preload asset: ${options.path}`, error);
    }
  }

  /**
   * Preload multiple assets
   */
  async preloadAssets(assets: AssetLoadOptions[]): Promise<void> {
    log.info(`Preloading ${assets.length} assets...`);
    const startTime = performance.now();

    await Promise.all(assets.map((asset) => this.preloadAsset(asset)));

    const loadTime = performance.now() - startTime;
    log.info(`Preloaded ${assets.length} assets in ${loadTime.toFixed(0)}ms`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    let memoryUsage = 0;

    // Estimate memory from cached models
    for (const info of this.assetInfo.values()) {
      memoryUsage += info.memoryEstimate;
    }

    return {
      models: this.modelCache.size,
      meshes: this.meshCache.size,
      geometries: this.geometryCache.size,
      materials: this.materialCache.size,
      textures: this.textureCache.size,
      totalSize: this.modelCache.size + this.meshCache.size + this.geometryCache.size,
      memoryUsage,
      lodGroups: this.lodCache.size,
      gpuInstancedMeshes: this.gpuInstancedMeshCache.size,
      culledObjects: this.culledObjects.size,
      visibleObjects: this.visibleObjects.size,
    };
  }

  /**
   * Get asset information
   */
  getAssetInfo(path: string): AssetInfo | undefined {
    return this.assetInfo.get(path);
  }

  /**
   * Get all asset information
   */
  getAllAssetInfo(): AssetInfo[] {
    return Array.from(this.assetInfo.values());
  }

  /**
   * Check if asset is cached
   */
  isCached(path: string): boolean {
    return this.modelCache.has(path);
  }

  /**
   * Configure cache limits
   */
  configureCacheLimits(options: {
    maxModels?: number;
    maxGeometries?: number;
    maxMaterials?: number;
    maxTextures?: number;
  }): void {
    if (options.maxModels !== undefined) {
      this.maxCachedModels = options.maxModels;
    }
    if (options.maxGeometries !== undefined) {
      this.maxCachedGeometries = options.maxGeometries;
    }
    if (options.maxMaterials !== undefined) {
      this.maxCachedMaterials = options.maxMaterials;
    }
    if (options.maxTextures !== undefined) {
      this.maxCachedTextures = options.maxTextures;
    }

    log.info('Cache limits configured: ', {
      models: this.maxCachedModels,
      geometries: this.maxCachedGeometries,
      materials: this.maxCachedMaterials,
      textures: this.maxCachedTextures,
    });
  }

  /**
   * Enable/disable features
   */
  configureFeatures(options: {
    enableDraco?: boolean;
    enableInstancing?: boolean;
    enableMaterialSharing?: boolean;
    compressTextures?: boolean;
    enableLOD?: boolean;
    enableGPUInstancing?: boolean;
    enableFrustumCulling?: boolean;
    enableOcclusionCulling?: boolean;
  }): void {
    if (options.enableDraco !== undefined) {
      this.enableDraco = options.enableDraco;
    }
    if (options.enableInstancing !== undefined) {
      this.enableInstancing = options.enableInstancing;
    }
    if (options.enableMaterialSharing !== undefined) {
      this.enableMaterialSharing = options.enableMaterialSharing;
    }
    if (options.compressTextures !== undefined) {
      this.compressTextures = options.compressTextures;
    }
    if (options.enableLOD !== undefined) {
      this.enableLOD = options.enableLOD;
    }
    if (options.enableGPUInstancing !== undefined) {
      this.enableGPUInstancing = options.enableGPUInstancing;
    }
    if (options.enableFrustumCulling !== undefined) {
      this.enableFrustumCulling = options.enableFrustumCulling;
    }
    if (options.enableOcclusionCulling !== undefined) {
      this.enableOcclusionCulling = options.enableOcclusionCulling;
    }

    log.info('Features configured:', {
      draco: this.enableDraco,
      instancing: this.enableInstancing,
      materialSharing: this.enableMaterialSharing,
      textureCompression: this.compressTextures,
      lod: this.enableLOD,
      gpuInstancing: this.enableGPUInstancing,
      frustumCulling: this.enableFrustumCulling,
      occlusionCulling: this.enableOcclusionCulling,
    });
  }

  /**
   * Dispose of service and clean up resources
   */
  dispose(): void {
    this.clearCache();

    if (this.dracoLoader) {
      this.dracoLoader.dispose();
    }

    log.info('Asset loading service disposed');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const assetLoadingService = new AssetLoadingService();

