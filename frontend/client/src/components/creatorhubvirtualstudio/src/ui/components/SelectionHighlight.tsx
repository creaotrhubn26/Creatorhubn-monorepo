/**
 * SelectionHighlight - Visual selection highlighting in 3D canvas
 * 
 * Features:
 * - Outline effect for selected objects
 * - Hover highlighting
 * - Multi-selection bounding box
 * - Transform gizmo indicators
 */

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useSelection } from '../../core/services/selectionService';

// ============================================================================
// Types
// ============================================================================

interface SelectionHighlightProps {
  nodes: Map<string, THREE.Object3D>;
  color?: string;
  hoverColor?: string;
  lineWidth?: number;
  pulseSpeed?: number;
}

// ============================================================================
// Outline Material
// ============================================================================

const outlineVertexShader = `
  uniform float outlineThickness;
  
  void main() {
    vec3 pos = position + normal * outlineThickness;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const outlineFragmentShader = `
  uniform vec3 outlineColor;
  uniform float opacity;
  uniform float time;
  uniform float pulseSpeed;
  
  void main() {
    float pulse = 0.7 + 0.3 * sin(time * pulseSpeed);
    gl_FragColor = vec4(outlineColor, opacity * pulse);
  }
`;

// ============================================================================
// Selection Box Component
// ============================================================================

interface SelectionBoxProps {
  min: THREE.Vector3;
  max: THREE.Vector3;
  color: string;
}

function SelectionBox({ min, max, color }: SelectionBoxProps) {
  const points = useMemo(() => {
    const p = [];
    // Bottom
    p.push(new THREE.Vector3(min.x, min.y, min.z));
    p.push(new THREE.Vector3(max.x, min.y, min.z));
    p.push(new THREE.Vector3(max.x, min.y, max.z));
    p.push(new THREE.Vector3(min.x, min.y, max.z));
    p.push(new THREE.Vector3(min.x, min.y, min.z));
    // Top
    p.push(new THREE.Vector3(min.x, max.y, min.z));
    p.push(new THREE.Vector3(max.x, max.y, min.z));
    p.push(new THREE.Vector3(max.x, max.y, max.z));
    p.push(new THREE.Vector3(min.x, max.y, max.z));
    p.push(new THREE.Vector3(min.x, max.y, min.z));
    // Verticals
    p.push(new THREE.Vector3(max.x, max.y, min.z));
    p.push(new THREE.Vector3(max.x, min.y, min.z));
    p.push(new THREE.Vector3(max.x, min.y, max.z));
    p.push(new THREE.Vector3(max.x, max.y, max.z));
    p.push(new THREE.Vector3(min.x, max.y, max.z));
    p.push(new THREE.Vector3(min.x, min.y, max.z));
    return p;
  }, [min, max]);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, [points]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} linewidth={2} transparent opacity={0.8} />
    </lineSegments>
  );
}

// ============================================================================
// Object Outline Component
// ============================================================================

interface ObjectOutlineProps {
  object: THREE.Object3D;
  color: string;
  thickness?: number;
  pulse?: boolean;
}

function ObjectOutline({ object, color, thickness = 0.02, pulse = true }: ObjectOutlineProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  // Clone geometry from object
  const outlineGeometry = useMemo(() => {
    let geometry: THREE.BufferGeometry | null = null;

    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !geometry) {
        geometry = (child as THREE.Mesh).geometry.clone();
      }
    });

    return geometry;
  }, [object]);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: outlineVertexShader,
      fragmentShader: outlineFragmentShader,
      uniforms: {
        outlineThickness: { value: thickness },
        outlineColor: { value: new THREE.Color(color) },
        opacity: { value: 0.8 },
        time: { value: 0 },
        pulseSpeed: { value: pulse ? 3.0 : 0 },
      },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, [color, thickness, pulse]);

  useFrame((_, delta) => {
    if (material.uniforms) {
      timeRef.current += delta;
      material.uniforms.time.value = timeRef.current;
    }
  });

  if (!outlineGeometry) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={outlineGeometry}
      material={material}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
    />
  );
}

// ============================================================================
// Selection Indicator (Corner brackets)
// ============================================================================

interface CornerBracketsProps {
  position: THREE.Vector3;
  size: number;
  color: string;
}

function CornerBrackets({ position, size, color }: CornerBracketsProps) {
  const halfSize = size / 2;
  const bracketLength = size * 0.2;

  const points = useMemo(() => {
    const corners = [
      // Top-left-front
      [
        new THREE.Vector3(-halfSize, halfSize, halfSize),
        new THREE.Vector3(-halfSize + bracketLength, halfSize, halfSize),
        new THREE.Vector3(-halfSize, halfSize, halfSize),
        new THREE.Vector3(-halfSize, halfSize - bracketLength, halfSize),
      ],
      // Top-right-front
      [
        new THREE.Vector3(halfSize, halfSize, halfSize),
        new THREE.Vector3(halfSize - bracketLength, halfSize, halfSize),
        new THREE.Vector3(halfSize, halfSize, halfSize),
        new THREE.Vector3(halfSize, halfSize - bracketLength, halfSize),
      ],
      // Bottom-left-front
      [
        new THREE.Vector3(-halfSize, -halfSize, halfSize),
        new THREE.Vector3(-halfSize + bracketLength, -halfSize, halfSize),
        new THREE.Vector3(-halfSize, -halfSize, halfSize),
        new THREE.Vector3(-halfSize, -halfSize + bracketLength, halfSize),
      ],
      // Bottom-right-front
      [
        new THREE.Vector3(halfSize, -halfSize, halfSize),
        new THREE.Vector3(halfSize - bracketLength, -halfSize, halfSize),
        new THREE.Vector3(halfSize, -halfSize, halfSize),
        new THREE.Vector3(halfSize, -halfSize + bracketLength, halfSize),
      ],
    ];
    return corners.flat();
  }, [halfSize, bracketLength]);

  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [points]);

  return (
    <group position={position}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={color} linewidth={3} />
      </lineSegments>
    </group>
  );
}

// ============================================================================
// Hover Ring
// ============================================================================

interface HoverRingProps {
  position: THREE.Vector3;
  radius: number;
  color: string;
}

function HoverRing({ position, radius, color }: HoverRingProps) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 2;
    }
  });

  return (
    <mesh ref={ringRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.8, radius, 32, 1, 0, Math.PI * 1.5]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ============================================================================
// Main Selection Highlight Component
// ============================================================================

import { colors } from '../../styles/designTokens';

export function SelectionHighlight({
  nodes,
  color = colors.border.focus,
  hoverColor = colors.success,
  lineWidth = 2,
  pulseSpeed = 3,
}: SelectionHighlightProps) {
  const selection = useSelection('3d-canvas');

  // Calculate bounding box for multi-selection
  const selectionBounds = useMemo(() => {
    if (selection.selectedIds.length < 2) return null;

    const box = new THREE.Box3();
    let hasValidBounds = false;

    selection.selectedIds.forEach((id) => {
      const obj = nodes.get(id);
      if (obj) {
        const objBox = new THREE.Box3().setFromObject(obj);
        if (!objBox.isEmpty()) {
          box.union(objBox);
          hasValidBounds = true;
        }
      }
    });

    return hasValidBounds ? box : null;
  }, [selection.selectedIds, nodes]);

  return (
    <group name="selection-highlights">
      {/* Individual selection outlines */}
      {selection.selectedIds.map((id) => {
        const obj = nodes.get(id);
        if (!obj) return null;

        return (
          <group key={id}>
            <ObjectOutline object={obj} color={color} pulse />
            <CornerBrackets
              position={obj.position}
              size={2}
              color={color}
            />
          </group>
        );
      })}

      {/* Multi-selection bounding box */}
      {selectionBounds && (
        <SelectionBox
          min={selectionBounds.min}
          max={selectionBounds.max}
          color={color}
        />
      )}

      {/* Hover highlight */}
      {selection.hoveredId && !selection.selectedIds.includes(selection.hoveredId) && (
        (() => {
          const obj = nodes.get(selection.hoveredId);
          if (!obj) return null;
          return (
            <HoverRing
              position={obj.position}
              radius={1.5}
              color={hoverColor}
            />
          );
        })()
      )}
    </group>
  );
}

export default SelectionHighlight;

