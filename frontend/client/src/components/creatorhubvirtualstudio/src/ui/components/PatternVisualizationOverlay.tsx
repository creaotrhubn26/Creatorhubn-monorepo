/**
 * Pattern Visualization Overlay
 * 
 * Shows the complete light pattern setup in 3D scene:
 * - Ideal light positions as markers
 * - Angle indicators as lines
 * - Distance rings
 * - Role labels (Key/Fill/Rim/Background)
 * - Pattern name
 * - Confidence score
 */

import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface LightSetup {
  type: string;
  name: string;
  role: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  power: number;
  modifier?: string;
  modifierSize?: string;
  distance?: number;
  angle?: number;
  height?: string;
}

interface PatternVisualizationOverlayProps {
  patternName: string;
  patternSlug: string;
  lightSetup: LightSetup[];
  subjectPosition?: [number, number, number];
  visible?: boolean;
  showLabels?: boolean;
  showDistanceRings?: boolean;
  showAngleLines?: boolean;
}

export function PatternVisualizationOverlay({
  patternName,
  lightSetup,
  subjectPosition = [0, 0, 0],
  visible = true,
  showLabels = true,
  showDistanceRings = true,
  showAngleLines = true,
}: PatternVisualizationOverlayProps) {
  // Calculate unique distances for rings
  const distances = useMemo(() => {
    const dists = lightSetup
      .map((light) => {
        const dx = light.position.x - subjectPosition[0];
        const dy = light.position.y - subjectPosition[1];
        const dz = light.position.z - subjectPosition[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      })
      .filter((d) => d > 0);
    
    return [...new Set(dists)].sort((a, b) => a - b);
  }, [lightSetup, subjectPosition]);

  // Role colors
  const getRoleColor = (role: string): string => {
    switch (role.toLowerCase()) {
      case 'key':
        return '#FF6B6B'; // Red
      case 'fill':
        return '#4ECDC4'; // Cyan
      case 'rim':
      case 'back':
        return '#FFE66D'; // Yellow
      case 'background':
        return '#95E1D3'; // Light green
      default:
        return '#A8DADC'; // Light blue
    }
  };

  if (!visible) return null;

  return (
    <group>
      {/* Pattern Name Label */}
      <Html position={[0, 3, 0]} center>
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none'}}
        >
          📐 {patternName}
        </div>
      </Html>

      {/* Distance Rings */}
      {showDistanceRings &&
        distances.map((distance, index) => (
          <mesh
            key={`ring-${index}`}
            position={[subjectPosition[0], 0.01, subjectPosition[2]]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[distance - 0.02, distance + 0.02, 64]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

      {/* Light Position Markers and Labels */}
      {lightSetup.map((light, index) => {
        const position: [number, number, number] = [
          light.position.x,
          light.position.y,
          light.position.z,
        ];
        const color = getRoleColor(light.role);

        return (
          <group key={`light-${index}`}>
            {/* Position Marker */}
            <mesh position={position}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshBasicMaterial color={color} transparent opacity={0.8} />
            </mesh>

            {/* Outer Glow */}
            <mesh position={position}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={0.3}
                side={THREE.BackSide}
              />
            </mesh>

            {/* Angle Line to Subject */}
            {showAngleLines && (
              <line>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={2}
                    array={
                      new Float32Array([
                        position[0],
                        position[1],
                        position[2],
                        subjectPosition[0],
                        subjectPosition[1],
                        subjectPosition[2],
                      ])
                    }
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color={color} transparent opacity={0.5} linewidth={2} />
              </line>
            )}

            {/* Label */}
            {showLabels && (
              <Html position={[position[0], position[1] + 0.3, position[2]]} center>
                <div
                  style={{
                    background: color,
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'}}
                >
                  {light.role}
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* Subject Position Marker */}
      <mesh position={subjectPosition}>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

