/**
 * Light Cone Helper
 * 
 * Visualizes light beam as a 3D cone in the scene
 * - Shows beam angle and direction
 * - Color-coded by intensity
 * - Semi-transparent for visibility
 * - Updates in real-time
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface LightConeHelperProps {
  position: [number, number, number];
  rotation: [number, number, number];
  beamAngle: number; // in degrees
  intensity: number; // 0-1
  distance?: number; // cone length
  color?: string;
  visible?: boolean;
}

export function LightConeHelper({
  position,
  rotation,
  beamAngle,
  intensity,
  distance = 3,
  color = '#ffff00',
  visible = true,
}: LightConeHelperProps) {
  const coneRef = useRef<THREE.Mesh>(null);
  const outlineRef = useRef<THREE.LineSegments>(null);

  // Calculate cone geometry based on beam angle
  const { geometry, outlineGeometry } = useMemo(() => {
    const radiusTop = 0;
    const radiusBottom = Math.tan((beamAngle / 2) * (Math.PI / 180)) * distance;
    const height = distance;
    const radialSegments = 32;

    const coneGeometry = new THREE.ConeGeometry(
      radiusBottom,
      height,
      radialSegments,
      1,
      false
    );

    // Rotate cone to point in -Z direction (forward)
    coneGeometry.rotateX(Math.PI / 2);
    coneGeometry.translate(0, 0, -height / 2);

    // Create outline geometry
    const edges = new THREE.EdgesGeometry(coneGeometry, 15);

    return { geometry: coneGeometry, outlineGeometry: edges };
  }, [beamAngle, distance]);

  // Material with intensity-based opacity
  const material = useMemo(() => {
    const baseColor = new THREE.Color(color);
    return new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: Math.min(intensity * 0.3, 0.4),
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [color, intensity]);

  // Outline material
  const outlineMaterial = useMemo(() => {
    const baseColor = new THREE.Color(color);
    return new THREE.LineBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: Math.min(intensity * 0.6, 0.8),
      linewidth: 2,
    });
  }, [color, intensity]);

  // Animate subtle pulsing effect
  useFrame((state) => {
    if (!coneRef.current || !visible) return;
    
    const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.05 + 1;
    coneRef.current.scale.setScalar(pulse);
    
    if (outlineRef.current) {
      outlineRef.current.scale.setScalar(pulse);
    }
  });

  if (!visible) return null;

  return (
    <group position={position} rotation={rotation}>
      {/* Main cone */}
      <mesh ref={coneRef} geometry={geometry} material={material} />
      
      {/* Outline */}
      <lineSegments ref={outlineRef} geometry={outlineGeometry} material={outlineMaterial} />
      
      {/* Center ray */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([0, 0, 0, 0, 0, -distance])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} opacity={0.8} transparent />
      </line>
    </group>
  );
}

/**
 * Light Coverage Helper
 * 
 * Shows the coverage area on the ground plane
 */
interface LightCoverageHelperProps {
  position: [number, number, number];
  beamAngle: number;
  intensity: number;
  color?: string;
  visible?: boolean;
}

export function LightCoverageHelper({
  position,
  beamAngle,
  intensity,
  color ='#ffff00',
  visible = true,
}: LightCoverageHelperProps) {
  // Calculate coverage radius on ground (y=0)
  const radius = useMemo(() => {
    const height = position[1]; // Y position
    return Math.tan((beamAngle / 2) * (Math.PI / 180)) * height;
  }, [position, beamAngle]);

  const material = useMemo(() => {
    const baseColor = new THREE.Color(color);
    return new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: Math.min(intensity * 0.2, 0.3),
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, [color, intensity]);

  if (!visible || radius <= 0) return null;

  return (
    <mesh position={[position[0], 0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <circleGeometry args={[radius, 64]} />
    </mesh>
  );
}

