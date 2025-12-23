/**
 * Virtual Actor Service
 * 
 * Integrates with Python ML Service (Anny) to generate 3D human body meshes
 * for lighting tests and cinematography visualization.
 * 
 * Research-based implementation using Anny parametric body model:
 * - Paper: https://arxiv.org/abs/2511.03589
 * - License: Apache 2.0 (FREE for commercial use)
 * - Organization: NAVER Labs Europe
 */

import * as THREE from 'three';
import { logger } from './logger';

const log = logger.module('VirtualActorService');

// Backend API URL (Node.js server proxies to Python ML service)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050';

/**
 * Actor generation parameters based on Anny phenotype model
 */
export interface ActorParameters {
  // Core phenotypes (0-1 normalized)
  age: number;           // Age in years (0-100)
  gender: number;        // 0=female, 1=male, 0.5=neutral
  height: number;        // Height parameter (0-1)
  weight: number;        // Weight parameter (0-1)
  muscle: number;        // Muscle definition (0-1)
  
  // Pose parameters (optional - axis-angle rotations)
  body_pose?: number[];      // 63 values (21 joints × 3 DoF)
  global_orient?: number[];  // 3 values (global rotation)
  transl?: number[];         // 3 values (global translation)
}

/**
 * Actor mesh data returned from API
 */
export interface ActorMeshData {
  vertices: number[][];  // (N, 3) vertex positions
  faces: number[][];     // (F, 4) quad faces (Anny uses quads)
  model: string;         // Model name ('anny')
  license: string;       // License info
  age: number;           // Actual age used
  phenotypes: {
    age: number;
    age_normalized: number;
    gender: number;
    height: number;
    weight: number;
    muscle: number;
  };
  num_vertices: number;
  num_faces: number;
}

/**
 * Actor preset configurations
 */
export interface ActorPreset {
  id: string;
  name: string;
  description: string;
  category: 'portrait' | 'fashion' | 'commercial' | 'fitness' | 'child' | 'elder' | 'film-character';
  parameters: ActorParameters;
  thumbnail?: string;
  tags?: string[];
  
  // Extended properties for film characters
  appearance?: {
    skinTone?: string;
    hairStyle?: string;
    hairColor?: string;
    facialHair?: string;
    eyeColor?: string;
    facialExpression?: string;
  };
  costume?: {
    clothingStyle?: string;
    accessories?: string[];
  };
  metadata?: {
    genre?: string;
    era?: string;
    mood?: string;
  };
}

/**
 * Anny model information
 */
export interface AnnyModelInfo {
  available: boolean;
  model?: string;
  version?: string;
  license?: string;
  organization?: string;
  paper?: string;
  github?: string;
  features?: {
    age_range: string;
    body_parts: string;
    parameters: string;
    vertices: string;
    faces: string;
    commercial_use: string;
  };
  device?: string;
}

/**
 * ML Service health status
 */
export interface MLServiceHealth {
  status: string;
  services: {
    anny: boolean;
    opencv: boolean;
    openexr: boolean;
    pyrender: boolean;
  };
}

/**
 * Virtual Actor Service
 * Handles communication with Python ML service for actor generation
 */
class VirtualActorService {
  private cache: Map<string, THREE.BufferGeometry> = new Map();
  private healthCache: MLServiceHealth | null = null;
  private healthCacheTime: number = 0;
  private readonly HEALTH_CACHE_TTL = 30000; // 30 seconds

  /**
   * Check if Anny service is available
   */
  async checkHealth(): Promise<MLServiceHealth> {
    // Return cached health if fresh
    if (this.healthCache && Date.now() - this.healthCacheTime < this.HEALTH_CACHE_TTL) {
      return this.healthCache;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/ml/health`, {
        method: 'GET',
        headers: {
          'Content-Type' : 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      const data = await response.json();
      this.healthCache = data;
      this.healthCacheTime = Date.now();
      return data;
    } catch (error) {
      log.warn('Health check failed: ', error);
      return {
        status: 'unhealthy',
        services: {
          anny: false,
          opencv: false,
          openexr: false,
          pyrender: false,
        },
      };
    }
  }

  /**
   * Get Anny model information
   */
  async getModelInfo(): Promise<AnnyModelInfo> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ml/poses/model-info`, {
        method: 'GET',
        headers: {
          'Content-Type' : 'application/json',
        },
      });

      if (!response.ok) {
        return { available: false };
      }

      return await response.json();
    } catch (error) {
      log.warn('Failed to get model info:', error);
      return { available: false };
    }
  }

  /**
   * Check if Anny is available (quick check)
   */
  async isAnnyAvailable(): Promise<boolean> {
    const health = await this.checkHealth();
    return health.services?.anny === true;
  }

  /**
   * Generate actor mesh from parameters
   */
  async generateActor(params: ActorParameters): Promise<ActorMeshData> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ml/poses/generate`, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate actor');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      log.error('Error generating actor:', error);
      throw error;
    }
  }

  /**
   * Convert actor mesh data to Three.js BufferGeometry
   */
  createGeometry(meshData: ActorMeshData): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    // Convert vertices to Float32Array
    const vertices = new Float32Array(meshData.vertices.flat());
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // Convert quad faces to triangle indices
    // Anny uses quad faces (4 vertices per face), need to triangulate
    const indices: number[] = [];
    for (const face of meshData.faces) {
      if (face.length === 4) {
        // Quad face: split into two triangles
        // Triangle 1: [0, 1, 2]
        indices.push(face[0], face[1], face[2]);
        // Triangle 2: [0, 2, 3]
        indices.push(face[0], face[2], face[3]);
      } else if (face.length === 3) {
        // Already a triangle
        indices.push(face[0], face[1], face[2]);
      }
    }

    geometry.setIndex(indices);

    // Compute normals for lighting
    geometry.computeVertexNormals();

    // Compute bounding sphere for camera framing
    geometry.computeBoundingSphere();

    return geometry;
  }

  /**
   * Create realistic skin material with PBR properties
   * Based on research: https://therealmjp.github.io/posts/sss-intro/
   *
   * @param params.skinTone - Hex color string (e.g.'#f4c2a0') or THREE.Color
   * @param params.roughness - Surface roughness (0-1)
   * @param params.subsurfaceColor - Hex color string for subsurface scattering
   */
  createSkinMaterial(params: {
    skinTone?: string | THREE.Color;
    roughness?: number;
    subsurfaceColor?: string | THREE.Color;
  }): THREE.MeshStandardMaterial {
    const {
      skinTone = '#f4c2a0', // Default caucasian skin tone
      roughness = 0.6,       // Skin is moderately rough
    } = params;

    // Convert string to THREE.Color if needed
    const color = typeof skinTone ==='string' ? new THREE.Color(skinTone) : skinTone;

    return new THREE.MeshStandardMaterial({
      color: color,
      roughness: roughness,
      metalness: 0.0,  // Skin is non-metallic
      // Note: Three.js doesn't support SSS out of the box
      // For production, consider custom shader with SSS
    });
  }
}

export const virtualActorService = new VirtualActorService();

