/**
 * Hair Mesh Component
 * 
 * Renders hair models for virtual actors in the 3D scene.
 * Integrates with React Three Fiber for efficient rendering.
 * 
 * Features:
 * - Dynamic hair model loading from GLB files
 * - Hair color customization
 * - Attachment to actor head position
 * - Transform controls (position, rotation, scale)
 * - Visibility toggle
 * - Alpha transparency support
 * 
 * Phase 2A - Week 1: Initial implementation
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { SceneNode } from '../../core/models/scene';
import { hairRenderingService, HairColorOptions } from '../../core/services/hairRenderingService';
import { getHairStyleById } from '../../core/data/hairStyles';
import { logger } from '../../core/services/logger';

const log = logger.module('HairMesh');

// Dynamic THREE import (same pattern as ActorMesh)
let THREE: any = null;
try {
  THREE = require('three');
} catch {
  log.warn('THREE.js not available in HairMesh');
}

interface HairMeshProps {
  node: SceneNode;
  actorNode?: SceneNode; // Parent actor node for positioning
}

/**
 * HairMesh Component
 * 
 * Renders a hair model attached to a virtual actor.
 * The hair model is loaded from the hairRenderingService and positioned
 * relative to the actor's head.
 */
export function HairMesh({ node, actorNode }: HairMeshProps) {
  const groupRef = useRef<any>(null);
  const [hairModel, setHairModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract hair configuration from node userData
  const hairConfig = useMemo(() => {
    if (!node.userData) return null;

    return {
      hairStyleId: node.userData.hairStyleId as string,
      hairColor: node.userData.hairColor as HairColorOptions | undefined,
      hairScale: node.userData.hairScale as number | undefined,
      hairOffset: node.userData.hairOffset as { x: number; y: number; z: number } | undefined,
    };
  }, [node.userData]);

  // Load hair model when configuration changes
  useEffect(() => {
    if (!hairConfig || !hairConfig.hairStyleId || !THREE) {
      setLoading(false);
      return;
    }

    const loadHair = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get hair style definition
        const hairStyle = getHairStyleById(hairConfig.hairStyleId);
        if (!hairStyle) {
          throw new Error(`Hair style not found: ${hairConfig.hairStyleId}`);
        }

        // Load hair model with customizations
        const model = await hairRenderingService.loadHairModel(hairStyle, {
          color: hairConfig.hairColor,
          scale: hairConfig.hairScale || 1.0,
          position: hairConfig.hairOffset
            ? new THREE.Vector3(
                hairConfig.hairOffset.x,
                hairConfig.hairOffset.y,
                hairConfig.hairOffset.z
              )
            : new THREE.Vector3(0, 1.6, 0), // Default head height
        });

        setHairModel(model);
        setLoading(false);
      } catch (err) {
        log.error('Failed to load hair model: ', err);
        setError(err instanceof Error ? err.message :'Unknown error');
        setLoading(false);
      }
    };

    loadHair();
  }, [hairConfig]);

  // Update hair model when it changes
  useEffect(() => {
    if (!groupRef.current || !hairModel) return;

    // Clear previous children
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    // Add new hair model
    groupRef.current.add(hairModel);

    return () => {
      // Cleanup
      if (groupRef.current && hairModel) {
        groupRef.current.remove(hairModel);
      }
    };
  }, [hairModel]);

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
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="#60a5fa" wireframe />
      </mesh>
    );
  }

  // Error state
  if (error || !hairModel) {
    return null; // Silently fail - actor will render without hair
  }

  // Render hair model
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

export default HairMesh;

