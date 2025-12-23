/**
 * Clothing Mesh Component
 * 
 * Renders clothing models for virtual actors in the 3D scene.
 * Integrates with React Three Fiber for efficient rendering.
 * 
 * Features:
 * - Dynamic clothing model loading from GLB files
 * - Clothing color customization (HSL)
 * - Fabric material customization (roughness, metalness)
 * - Attachment to actor body position
 * - Transform controls (position, rotation, scale)
 * - LOD support for distant actors
 * - GPU instancing for crowds
 * - Visibility toggle
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { SceneNode } from '../../core/models/scene';
import { clothingRenderingService, ClothingLoadOptions } from '../../core/services/clothingRenderingService';
import { getClothingStyleById } from '../../core/data/clothingStyles';
import { logger } from '../../core/services/logger';

const log = logger.module('ClothingMesh');

// Dynamic THREE import
let THREE: any = null;
try {
  THREE = require('three');
} catch {
  log.warn('THREE.js not available in ClothingMesh');
}

interface ClothingMeshProps {
  node: SceneNode;
  actorNode?: SceneNode; // Parent actor node for positioning
}

/**
 * ClothingMesh Component
 * 
 * Renders a clothing model attached to a virtual actor.
 * The clothing model is loaded from the clothingRenderingService and positioned
 * relative to the actor's body.
 */
export function ClothingMesh({ node, actorNode }: ClothingMeshProps) {
  const groupRef = useRef<any>(null);
  const [clothingModel, setClothingModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract clothing configuration from node userData
  const clothingConfig = useMemo(() => {
    if (!node.userData) return null;

    return {
      clothingStyleId: node.userData.clothingStyleId as string,
      clothingColor: node.userData.clothingColor as { hue: number; saturation: number; lightness: number } | undefined,
      clothingScale: node.userData.clothingScale as number | undefined,
      clothingOffset: node.userData.clothingOffset as { x: number; y: number; z: number } | undefined,
      roughness: node.userData.roughness as number | undefined,
      metalness: node.userData.metalness as number | undefined,
      enableLOD: node.userData.enableLOD as boolean | undefined,
    };
  }, [node.userData]);

  // Load clothing model when configuration changes
  useEffect(() => {
    if (!clothingConfig || !clothingConfig.clothingStyleId || !THREE) {
      setLoading(false);
      return;
    }

    const loadClothing = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get clothing style definition
        const clothingStyle = getClothingStyleById(clothingConfig.clothingStyleId);
        if (!clothingStyle) {
          throw new Error(`Clothing style not found: ${clothingConfig.clothingStyleId}`);
        }

        // Prepare load options
        const loadOptions: ClothingLoadOptions = {
          color: clothingConfig.clothingColor,
          scale: clothingConfig.clothingScale || 1.0,
          position: clothingConfig.clothingOffset
            ? new THREE.Vector3(
                clothingConfig.clothingOffset.x,
                clothingConfig.clothingOffset.y,
                clothingConfig.clothingOffset.z
              )
            : new THREE.Vector3(0, 0, 0), // Default body position
          roughness: clothingConfig.roughness || 0.8, // Cotton default
          metalness: clothingConfig.metalness || 0.0, // Non-metallic default
          enableLOD: clothingConfig.enableLOD !== false, // Enable by default
        };

        // Load clothing model with customizations
        const model = await clothingRenderingService.loadClothingModel(clothingStyle, loadOptions);

        setClothingModel(model);
        setLoading(false);
      } catch (err) {
        log.error('Failed to load clothing model: ', err);
        setError(err instanceof Error ? err.message :'Unknown error');
        setLoading(false);
      }
    };

    loadClothing();
  }, [clothingConfig]);

  // Update clothing model when it changes
  useEffect(() => {
    if (!groupRef.current || !clothingModel) return;

    // Clear previous children
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    // Add new clothing model
    groupRef.current.add(clothingModel);

    return () => {
      // Cleanup
      if (groupRef.current && clothingModel) {
        groupRef.current.remove(clothingModel);
      }
    };
  }, [clothingModel]);

  // Don't render if THREE.js is not available
  if (!THREE) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <mesh
        position={node.transform.position}
        rotation={node.transform.rotation}
        scale={node.transform.scale}
      >
        <boxGeometry args={[0.4, 0.6, 0.2]} />
        <meshStandardMaterial color="#10b981" wireframe />
      </mesh>
    );
  }

  // Error state
  if (error || !clothingModel) {
    return null; // Silently fail - actor will render without clothing
  }

  // Render clothing model
  return (
    <group
      ref={groupRef}
      position={node.transform.position}
      rotation={node.transform.rotation}
      scale={node.transform.scale}
      visible={node.visible}
    />
  );
}

export default ClothingMesh;

