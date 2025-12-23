/**
 * Backdrop Mesh Component
 * 
 * Renders backdrop/environment models in the 3D scene.
 * Integrates with React Three Fiber for efficient rendering.
 * 
 * Features:
 * - Dynamic backdrop model loading from GLB files
 * - Environment map integration (HDR)
 * - Skybox support (360-degree)
 * - Ambient lighting setup
 * - Automatic LOD for complex backdrops
 * - Material optimization per category
 * - Transform controls (position, rotation, scale)
 * - Shadow receiving (no casting)
 * - Visibility toggle
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { SceneNode } from '../../core/models/scene';
import { backdropRenderingService, BackdropLoadOptions } from '../../core/services/backdropRenderingService';
import { getBackdropById } from '../../core/data/backdropDefinitions';
import { logger } from '../../core/services/logger';

const log = logger.module('BackdropMesh');

// Dynamic THREE import
let THREE: any = null;
try {
  THREE = require('three');
} catch {
  log.warn('THREE.js not available in BackdropMesh');
}

interface BackdropMeshProps {
  node: SceneNode;
  scene: any; // THREE.Scene - needed for environment map and ambient light
}

/**
 * BackdropMesh Component
 * 
 * Renders a backdrop/environment model in the scene.
 * The backdrop model is loaded from the backdropRenderingService with
 * automatic environment map and ambient lighting setup.
 */
export function BackdropMesh({ node, scene }: BackdropMeshProps) {
  const groupRef = useRef<any>(null);
  const [backdropModel, setBackdropModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract backdrop configuration from node userData
  const backdropConfig = useMemo(() => {
    if (!node.userData) return null;

    return {
      backdropId: node.userData.backdropId as string,
      backdropScale: node.userData.backdropScale as number | undefined,
      applyEnvironmentMap: node.userData.applyEnvironmentMap as boolean | undefined,
      applyAmbientLight: node.userData.applyAmbientLight as boolean | undefined,
      receiveShadow: node.userData.receiveShadow as boolean | undefined,
      enableLOD: node.userData.enableLOD as boolean | undefined,
    };
  }, [node.userData]);

  // Load backdrop model when configuration changes
  useEffect(() => {
    if (!backdropConfig || !backdropConfig.backdropId || !THREE || !scene) {
      setLoading(false);
      return;
    }

    const loadBackdrop = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get backdrop definition
        const backdrop = getBackdropById(backdropConfig.backdropId);
        if (!backdrop) {
          throw new Error(`Backdrop not found: ${backdropConfig.backdropId}`);
        }

        // Prepare load options
        const loadOptions: BackdropLoadOptions = {
          scale: backdropConfig.backdropScale || 1.0,
          position: new THREE.Vector3(
            node.transform.position[0],
            node.transform.position[1],
            node.transform.position[2]
          ),
          rotation: new THREE.Euler(
            node.transform.rotation[0],
            node.transform.rotation[1],
            node.transform.rotation[2]
          ),
          applyEnvironmentMap: backdropConfig.applyEnvironmentMap !== false, // Enable by default
          applyAmbientLight: backdropConfig.applyAmbientLight !== false, // Enable by default
          receiveShadow: backdropConfig.receiveShadow !== false, // Enable by default
          enableLOD: backdropConfig.enableLOD, // Auto-enabled based on complexity
          enableFrustumCulling: false, // Backdrops are always visible
          enableOcclusionCulling: false, // Backdrops don't occlude
        };

        // Load backdrop model with environment setup
        const model = await backdropRenderingService.loadBackdrop(backdrop, scene, loadOptions);

        setBackdropModel(model);
        setLoading(false);
      } catch (err) {
        log.error('Failed to load backdrop model: ', err);
        setError(err instanceof Error ? err.message :'Unknown error');
        setLoading(false);
      }
    };

    loadBackdrop();
  }, [backdropConfig, node.transform, scene]);

  // Update backdrop model when it changes
  useEffect(() => {
    if (!groupRef.current || !backdropModel) return;

    // Clear previous children
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    // Add new backdrop model
    groupRef.current.add(backdropModel);

    return () => {
      // Cleanup
      if (groupRef.current && backdropModel) {
        groupRef.current.remove(backdropModel);
      }
    };
  }, [backdropModel]);

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
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#8b5cf6" wireframe />
      </mesh>
    );
  }

  // Error state - show error plane
  if (error) {
    return (
      <mesh
        position={node.transform.position}
        rotation={node.transform.rotation}
        scale={node.transform.scale}
      >
        <planeGeometry args={[10, 5]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    );
  }

  // Don't render if no model
  if (!backdropModel) {
    return null;
  }

  // Render backdrop model
  // Note: The model is already added to the scene by backdropRenderingService
  // This component just manages the lifecycle
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

export default BackdropMesh;

