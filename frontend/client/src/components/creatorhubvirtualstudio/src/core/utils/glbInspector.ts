/**
 * GLB Inspector Utility
 * 
 * Utility for inspecting GLB files to extract mesh names, polygon counts, and other metadata.
 * Useful for debugging and optimizing hair model loading.
 * 
 * Usage:
 * ```typescript
 * import { inspectGLB } from './glbInspector';
 * 
 * const info = await inspectGLB('/library/models/hair/male/free_male_fashion_hair_collection_02_lowpoly.glb');
 * console.log(info);
 * ```
 */

import { logger } from '../services/logger';
import * as THREE from 'three';

const log = logger.module('GLBInspector');
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export interface MeshInfo {
  name: string;
  index: number;
  vertices: number;
  triangles: number;
  materials: string[];
  hasSkeleton: boolean;
  hasTextures: boolean;
}

export interface GLBInfo {
  path: string;
  totalMeshes: number;
  totalVertices: number;
  totalTriangles: number;
  meshes: MeshInfo[];
  materials: string[];
  textures: string[];
}

/**
 * Inspect a GLB file and return detailed information
 */
export async function inspectGLB(path: string): Promise<GLBInfo> {
  const loader = new GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        const scene = gltf.scene;
        const meshes: MeshInfo[] = [];
        const materials = new Set<string>();
        const textures = new Set<string>();
        let totalVertices = 0;
        let totalTriangles = 0;
        let meshIndex = 0;

        // Traverse scene and collect mesh info
        scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            const geometry = mesh.geometry;
            const material = mesh.material;

            // Count vertices and triangles
            const vertices = geometry.attributes.position?.count || 0;
            const triangles = vertices / 3;

            totalVertices += vertices;
            totalTriangles += triangles;

            // Collect material names
            const materialNames: string[] = [];
            if (Array.isArray(material)) {
              material.forEach((mat) => {
                materials.add(mat.name || 'Unnamed');
                materialNames.push(mat.name || 'Unnamed');
              });
            } else if (material) {
              materials.add(material.name || 'Unnamed');
              materialNames.push(material.name || 'Unnamed');

              // Check for textures
              if ((material as THREE.MeshStandardMaterial).map) {
                textures.add('diffuse');
              }
              if ((material as THREE.MeshStandardMaterial).normalMap) {
                textures.add('normal');
              }
              if ((material as THREE.MeshStandardMaterial).roughnessMap) {
                textures.add('roughness');
              }
            }

            // Check for skeleton
            const hasSkeleton = !!(mesh as any).skeleton;

            meshes.push({
              name: mesh.name || `Mesh_${meshIndex}`,
              index: meshIndex,
              vertices,
              triangles: Math.floor(triangles),
              materials: materialNames,
              hasSkeleton,
              hasTextures: materialNames.length > 0,
            });

            meshIndex++;
          }
        });

        const info: GLBInfo = {
          path,
          totalMeshes: meshes.length,
          totalVertices,
          totalTriangles: Math.floor(totalTriangles),
          meshes,
          materials: Array.from(materials),
          textures: Array.from(textures),
        };

        resolve(info);
      },
      undefined,
      (error) => {
        reject(error);
      }
    );
  });
}

/**
 * Print GLB info to console in a readable format
 */
export function printGLBInfo(info: GLBInfo): void {
  log.info('GLB File Information', {
    path: info.path,
    totalMeshes: info.totalMeshes,
    totalVertices: info.totalVertices,
    totalTriangles: info.totalTriangles,
    materials: info.materials,
    textures: info.textures,
  });
  
  info.meshes.forEach((mesh) => {
    log.debug(`Mesh [${mesh.index}] ${mesh.name}`, {
      vertices: mesh.vertices,
      triangles: mesh.triangles,
      materials: mesh.materials,
      hasSkeleton: mesh.hasSkeleton,
      hasTextures: mesh.hasTextures,
    });
  });
  
  log.debug('GLB inspection complete');
}

