/**
 * Prop Mesh Component
 * 
 * Renders prop models (furniture, objects, decorations) in the 3D scene.
 * Integrates with React Three Fiber for efficient rendering.
 * 
 * Features:
 * - Dynamic prop model loading from GLB files
 * - Automatic LOD based on prop complexity
 * - Automatic GPU instancing for repeated props
 * - Category-specific material optimization
 * - Transform controls (position, rotation, scale)
 * - Shadow casting and receiving
 * - Visibility toggle
 * - Frustum and occlusion culling support
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { SceneNode } from '../../core/models/scene';
import { propRenderingService, PropLoadOptions } from '../../core/services/propRenderingService';
import { getPropById } from '../../core/data/propDefinitions';
import { logger } from '../../core/services/logger';

const log = logger.module('PropMesh');

// Dynamic THREE import
let THREE: any = null;
try {
  THREE = require('three');
} catch {
  log.warn('THREE.js not available in PropMesh');
}

interface PropMeshProps {
  node: SceneNode;
}

/**
 * PropMesh Component
 * 
 * Renders a prop model in the scene.
 * The prop model is loaded from the propRenderingService with automatic
 * optimization based on prop type and complexity.
 */
export function PropMesh({ node }: PropMeshProps) {
  const groupRef = useRef<any>(null);
  const [propModel, setPropModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract prop configuration from node userData
  const propConfig = useMemo(() => {
    if (!node.userData) return null;

    return {
      propId: node.userData.propId as string,
      propScale: node.userData.propScale as number | undefined,
      castShadow: node.userData.castShadow as boolean | undefined,
      receiveShadow: node.userData.receiveShadow as boolean | undefined,
      enableLOD: node.userData.enableLOD as boolean | undefined,
      enableGPUInstancing: node.userData.enableGPUInstancing as boolean | undefined,
      maxInstances: node.userData.maxInstances as number | undefined,
      enableFrustumCulling: node.userData.enableFrustumCulling as boolean | undefined,
      enableOcclusionCulling: node.userData.enableOcclusionCulling as boolean | undefined,
    };
  }, [node.userData]);

  // Load prop model when configuration changes
  useEffect(() => {
    if (!propConfig || !propConfig.propId || !THREE) {
      setLoading(false);
      return;
    }

    const loadProp = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get prop definition
        const prop = getPropById(propConfig.propId);
        if (!prop) {
          throw new Error(`Prop not found: ${propConfig.propId}`);
        }

        // Prepare load options
        const loadOptions: PropLoadOptions = {
          scale: propConfig.propScale || 1.0,
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
          castShadow: propConfig.castShadow !== false, // Enable by default
          receiveShadow: propConfig.receiveShadow !== false, // Enable by default
          enableLOD: propConfig.enableLOD, // Auto-enabled based on complexity
          enableGPUInstancing: propConfig.enableGPUInstancing, // Auto-enabled if supported
          maxInstances: propConfig.maxInstances,
          enableFrustumCulling: propConfig.enableFrustumCulling !== false, // Enable by default
          enableOcclusionCulling: propConfig.enableOcclusionCulling || false, // Disable by default
        };

        // Load prop model with automatic optimizations
        const model = await propRenderingService.loadProp(prop, loadOptions);

        setPropModel(model);
        setLoading(false);
      } catch (err) {
        log.error('Failed to load prop model: ', err);
        setError(err instanceof Error ? err.message :'Unknown error');
        setLoading(false);
      }
    };

    loadProp();
  }, [propConfig, node.transform]);

  // Update prop model when it changes
  useEffect(() => {
    if (!groupRef.current || !propModel) return;

    // Clear previous children
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    // Add new prop model
    groupRef.current.add(propModel);

    return () => {
      // Cleanup
      if (groupRef.current && propModel) {
        groupRef.current.remove(propModel);
      }
    };
  }, [propModel]);

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
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#f59e0b" wireframe />
      </mesh>
    );
  }

  // Error state - show error box
  if (error) {
    return (
      <mesh
        position={node.transform.position}
        rotation={node.transform.rotation}
        scale={node.transform.scale}
      >
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    );
  }

  // Don't render if no model
  if (!propModel) {
    return null;
  }

  // Render prop model
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

export default PropMesh;

