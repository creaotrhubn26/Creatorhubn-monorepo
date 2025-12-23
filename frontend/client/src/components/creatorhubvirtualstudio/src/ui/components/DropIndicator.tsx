/**
 * DropIndicator - Visual indicator for drag-and-drop placement
 * 
 * Features:
 * - Animated ring showing drop position
 * - Vertical guide line
 * - Pulsing animation
 * - Grid snapping visualization
 */

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DropIndicatorProps {
  position: THREE.Vector3 | null;
  visible?: boolean;
  color?: string;
  gridSize?: number;
  showGrid?: boolean;
}

export function DropIndicator({
  position,
  visible = true,
  color = '#00ff88',
  gridSize = 0.5,
  showGrid = true,
}: DropIndicatorProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lineRef = useRef<THREE.Line>(null);
  const gridRef = useRef<THREE.GridHelper>(null);
  const pulseRef = useRef(0);

  // Create materials
  const ringMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
  }, [color]);

  const lineMaterial = useMemo(() => {
    return new THREE.LineDashedMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      dashSize: 0.1,
      gapSize: 0.05,
    });
  }, [color]);

  // Create geometries
  const ringGeometry = useMemo(() => {
    const geo = new THREE.RingGeometry(0.25, 0.4, 32);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const lineGeometry = useMemo(() => {
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 3, 0),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, []);

  // Animation
  useFrame((_, delta) => {
    if (!groupRef.current || !position) return;

    // Pulse animation
    pulseRef.current += delta * 3;
    const pulse = Math.sin(pulseRef.current) * 0.5 + 0.5;

    // Update ring scale and opacity
    if (ringRef.current) {
      const scale = 0.8 + pulse * 0.4;
      ringRef.current.scale.set(scale, scale, scale);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + pulse * 0.3;
    }

    // Update line opacity
    if (lineRef.current) {
      (lineRef.current.material as THREE.LineDashedMaterial).opacity = 0.2 + pulse * 0.2;
    }

    // Smooth position transition
    groupRef.current.position.lerp(position, 0.3);
  });

  if (!position || !visible) return null;

  return (
    <group ref={groupRef} position={position}>
      {/* Main ring indicator */}
      <mesh ref={ringRef} geometry={ringGeometry} material={ringMaterial} />

      {/* Outer ring (static) */}
      <mesh position={[0, 0.001, 0]}>
        <ringGeometry args={[0.45, 0.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>

      {/* Center dot */}
      <mesh position={[0, 0.002, 0]}>
        <circleGeometry args={[0.05, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {/* Vertical guide line */}
      <line ref={lineRef} geometry={lineGeometry}>
        <lineDashedMaterial attach="material" color={color} transparent opacity={0.3} dashSize={0.1} gapSize={0.05} />
      </line>

      {/* Local grid (optional) */}
      {showGrid && (
        <gridHelper
          ref={gridRef}
          args={[2, Math.round(2 / gridSize), color, color]}
          position={[0, 0.003, 0]}
          material-transparent
          material-opacity={0.15}
        />
      )}

      {/* Crosshairs */}
      <group position={[0, 0.004, 0]}>
        {/* X axis */}
        <mesh rotation={[0, 0, 0]}>
          <planeGeometry args={[0.8, 0.02]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
        {/* Z axis */}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.8, 0.02]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Height indicator text placeholder - would need Text from drei */}
      {/* <Text position={[0.6, 0.1, 0]} fontSize={0.1} color={color}>
        y: {position.y.toFixed(2)}m
      </Text> */}
    </group>
  );
}

/**
 * DragOverlay - Full-screen overlay when dragging
 */
interface DragOverlayProps {
  visible: boolean;
  message?: string;
}

export function DragOverlay({ visible, message = 'Drop to place equipment' }: DragOverlayProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 10}}
    >
      <div
        style={{
          padding: '12px 24px',
          background: 'rgba(0, 255, 136, 0.15)',
          border: '2px dashed rgba(0, 255, 136, 0.5)',
          borderRadius: 12,
          color: '#00ff88',
          fontSize: 14,
          fontWeight: 600,
          backdropFilter: 'blur(4px)'}}
      >
        {message}
      </div>
    </div>
  );
}

export default DropIndicator;

