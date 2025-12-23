import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../../state/store';
import { SceneNode } from '../../core/models/scene';

/**
 * Lights Component - Renders all light nodes from the scene store
 * 
 * Supports:
 * - Softbox (area light simulation)
 * - Umbrella (point light with falloff)
 * - Spot (spotlight with beam angle)
 * - Reflector (bounced light simulation)
 */

interface LightMeshProps {
  node: SceneNode;
  selected: boolean;
  onSelect?: (id: string) => void;
}

// Individual light mesh component
function LightMesh({ node, selected, onSelect }: LightMeshProps) {
  const lightProps = node.light;
  const transform = node.transform;

  // Calculate light intensity from power (0-1) to lumens
  const intensity = useMemo(() => {
    const basePower = lightProps?.power || 0.5;
    return basePower * 5; // Scale to reasonable Three.js intensity
  }, [lightProps?.power]);

  // Color temperature to RGB
  const color = useMemo(() => {
    const cct = lightProps?.cct || 5600; // Default daylight
    return cctToRgb(cct);
  }, [lightProps?.cct]);

  // Beam angle for spotlights
  const beamAngle = useMemo(() => {
    return THREE.MathUtils.degToRad(lightProps?.beam || 45);
  }, [lightProps?.beam]);

  // Common props for all light types
  const position = transform.position as [number, number, number];
  const rotation = transform.rotation as [number, number, number];

  const handleClick = (e: THREE.Event) => {
    e.stopPropagation();
    onSelect?.(node.id);
  };

  // Modifier size for softboxes
  const modSize = lightProps?.modifierSize || [0.6, 0.6];

  switch (node.type) {
    case 'softbox':
      return (
        <group position={position} rotation={rotation}>
          {/* Area light simulation using rect light */}
          <rectAreaLight
            args={[color, intensity, modSize[0], modSize[1]]}
            position={[0, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
          
          {/* Visual mesh for the softbox */}
          <mesh onClick={handleClick}>
            <boxGeometry args={[modSize[0], modSize[1], 0.15]} />
            <meshStandardMaterial
              color={selected ? '#4fc3f7' : '#333333'}
              emissive={color}
              emissiveIntensity={0.3}
            />
          </mesh>
          
          {/* Selection indicator */}
          {selected && (
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(modSize[0] + 0.05, modSize[1] + 0.05, 0.2)]} />
              <lineBasicMaterial color="#4fc3f7" linewidth={2} />
            </lineSegments>
          )}
        </group>
      );

    case 'umbrella':
      return (
        <group position={position} rotation={rotation}>
          {/* Point light for umbrella */}
          <pointLight
            color={color}
            intensity={intensity * 2}
            distance={10}
            decay={2}
          />
          
          {/* Umbrella visual */}
          <mesh onClick={handleClick} rotation={[Math.PI / 6, 0, 0]}>
            <coneGeometry args={[0.5, 0.4, 32, 1, true]} />
            <meshStandardMaterial
              color={selected ? '#4fc3f7' : '#f5f5f5'}
              side={THREE.DoubleSide}
            />
          </mesh>
          
          {/* Handle */}
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.6]} />
            <meshStandardMaterial color="#444" />
          </mesh>
        </group>
      );

    case 'spot':
      return (
        <group position={position} rotation={rotation}>
          {/* Spotlight */}
          <spotLight
            color={color}
            intensity={intensity * 3}
            angle={beamAngle / 2}
            penumbra={0.5}
            distance={15}
            decay={2}
            castShadow
          />
          
          {/* Housing visual */}
          <mesh onClick={handleClick}>
            <cylinderGeometry args={[0.1, 0.15, 0.25, 16]} />
            <meshStandardMaterial color={selected ? '#4fc3f7' : '#222222'} />
          </mesh>
          
          {/* Lens */}
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={color}
              emissiveIntensity={0.5}
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>
      );

    case 'reflector':
      return (
        <group position={position} rotation={rotation}>
          {/* Simulated bounced light using dim point light */}
          <pointLight
            color={color}
            intensity={intensity * 0.3}
            distance={5}
            decay={2}
          />
          
          {/* Reflector dish */}
          <mesh onClick={handleClick} rotation={[Math.PI / 8, 0, 0]}>
            <circleGeometry args={[0.4, 32]} />
            <meshStandardMaterial
              color={selected ? '#4fc3f7' : '#c0c0c0'}
              metalness={0.9}
              roughness={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
          
          {/* Handle */}
          <mesh position={[0, -0.3, 0.15]} rotation={[Math.PI / 4, 0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.4]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      );

    default:
      return null;
  }
}

// Helper: Convert color temperature (Kelvin) to RGB hex
function cctToRgb(kelvin: number): string {
  const temp = kelvin / 100;
  let r: number, g: number, b: number;

  if (temp <= 66) {
    r = 255;
    g = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661));
  } else {
    r = Math.min(255, Math.max(0, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
    g = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
  }

  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
  }

  const toHex = (c: number) => Math.round(c).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Main Lights component
export default function Lights() {
  const scene = useAppStore((state) => state.scene);
  const selection = scene.selection;

  // Filter light nodes
  const lightNodes = useMemo(() => {
    return scene.nodes.filter(
      (node) =>
        node.visible &&
        ['softbox','umbrella','spot','reflector'].includes(node.type)
    );
  }, [scene.nodes]);

  const handleSelect = (id: string) => {
    useAppStore.getState().select([id]);
  };

  if (lightNodes.length === 0) {
    return null;
  }

  return (
    <group name="lights">
      {lightNodes.map((node) => (
        <LightMesh
          key={node.id}
          node={node}
          selected={selection.includes(node.id)}
          onSelect={handleSelect}
        />
      ))}
    </group>
  );
}

export { LightMesh, cctToRgb };
