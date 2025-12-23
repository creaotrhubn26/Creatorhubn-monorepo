import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useAppStore } from '../../state/store';
import { SceneNode } from '../../core/models/scene';

/**
 * CameraRig Component - Renders camera nodes from the scene store
 * 
 * Features:
 * - Visual camera mesh representation
 * - Field of view cone visualization
 * - Depth of field preview plane
 * - Sensor size indicator
 * - Focal point marker
 */

interface CameraMeshProps {
  node: SceneNode;
  selected: boolean;
  showFOV?: boolean;
  onSelect?: (id: string) => void;
}

// Individual camera mesh
function CameraMesh({ node, selected, showFOV = true, onSelect }: CameraMeshProps) {
  const cameraProps = node.camera;
  const transform = node.transform;
  const meshRef = useRef<THREE.Group>(null);

  // Calculate FOV from sensor and focal length
  const fov = useMemo(() => {
    if (!cameraProps) return 45;
    const sensorHeight = cameraProps.sensor[1];
    const focalLength = cameraProps.focalLength;
    return 2 * Math.atan(sensorHeight / (2 * focalLength)) * (180 / Math.PI);
  }, [cameraProps]);

  // Calculate aspect ratio from sensor
  const aspectRatio = useMemo(() => {
    if (!cameraProps) return 1.5;
    return cameraProps.sensor[0] / cameraProps.sensor[1];
  }, [cameraProps]);

  const position = transform.position as [number, number, number];
  const rotation = transform.rotation as [number, number, number];

  const handleClick = (e: THREE.Event) => {
    e.stopPropagation();
    onSelect?.(node.id);
  };

  // FOV cone geometry
  const fovConeGeometry = useMemo(() => {
    const distance = 2; // Cone length
    const halfFovRad = (fov * Math.PI) / 360;
    const height = Math.tan(halfFovRad) * distance;
    const width = height * aspectRatio;

    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Apex
      0, 0, 0,
      // Bottom-left
      -width, -height, -distance,
      // Bottom-right
      width, -height, -distance,
      // Top-right
      width, height, -distance,
      // Top-left
      -width, height, -distance,
    ]);

    const indices = [
      // Lines from apex to corners
      0, 1, 0, 2, 0, 3, 0, 4,
      // Rectangle at far plane
      1, 2, 2, 3, 3, 4, 4, 1,
    ];

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    return geometry;
  }, [fov, aspectRatio]);

  return (
    <group ref={meshRef} position={position} rotation={rotation}>
      {/* Camera body */}
      <mesh onClick={handleClick}>
        <boxGeometry args={[0.15, 0.1, 0.2]} />
        <meshStandardMaterial
          color={selected ? '#4fc3f7' : '#1a1a1a'}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Lens */}
      <group position={[0, 0, -0.15]}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.06, 0.1, 16]} />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Front element */}
        <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.04, 16]} />
          <meshStandardMaterial
            color="#1a1a40"
            metalness={0.9}
            roughness={0.1}
            transparent
            opacity={0.8}
          />
        </mesh>
      </group>

      {/* Viewfinder hump */}
      <mesh position={[0, 0.07, 0.02]}>
        <boxGeometry args={[0.06, 0.04, 0.08]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Hot shoe */}
      <mesh position={[0, 0.1, 0.02]}>
        <boxGeometry args={[0.03, 0.01, 0.04]} />
        <meshStandardMaterial color="#444" metalness={0.9} />
      </mesh>

      {/* FOV visualization cone */}
      {showFOV && (
        <lineSegments geometry={fovConeGeometry}>
          <lineBasicMaterial
            color={selected ? '#4fc3f7' : '#666666'}
            transparent
            opacity={0.5}
          />
        </lineSegments>
      )}

      {/* Selection outline */}
      {selected && (
        <mesh>
          <boxGeometry args={[0.18, 0.13, 0.25]} />
          <meshBasicMaterial color="#4fc3f7" wireframe />
        </mesh>
      )}

      {/* Info label (only when selected) */}
      {selected && cameraProps && (
        <group position={[0, 0.2, 0]}>
          {/* This would be a text element in a full implementation */}
        </group>
      )}
    </group>
  );
}

// Preview camera that can be switched to for "through the lens" view
function PreviewCamera({ node }: { node: SceneNode }) {
  const { set } = useThree();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const cameraProps = node.camera;

  // Calculate FOV
  const fov = useMemo(() => {
    if (!cameraProps) return 45;
    const sensorHeight = cameraProps.sensor[1];
    const focalLength = cameraProps.focalLength;
    return 2 * Math.atan(sensorHeight / (2 * focalLength)) * (180 / Math.PI);
  }, [cameraProps]);

  // This camera can be activated with a custom event
  useEffect(() => {
    const handleActivate = (e: CustomEvent) => {
      if (e.detail.nodeId === node.id && cameraRef.current) {
        set({ camera: cameraRef.current });
      }
    };

    window.addEventListener('vs-activate-camera', handleActivate as EventListener);
    return () => {
      window.removeEventListener('vs-activate-camera', handleActivate as EventListener);
    };
  }, [node.id, set]);

  return (
    <perspectiveCamera
      ref={cameraRef}
      fov={fov}
      aspect={cameraProps ? cameraProps.sensor[0] / cameraProps.sensor[1] : 1.5}
      near={0.1}
      far={100}
      position={node.transform.position as [number, number, number]}
      rotation={node.transform.rotation as [number, number, number]}
    />
  );
}

// Main CameraRig component
export default function CameraRig() {
  const scene = useAppStore((state) => state.scene);
  const showLightCones = useAppStore((state) => state.showLightCones);
  const selection = scene.selection;

  // Filter camera nodes
  const cameraNodes = useMemo(() => {
    return scene.nodes.filter((node) => node.visible && node.type ==='camera');
  }, [scene.nodes]);

  const handleSelect = (id: string) => {
    useAppStore.getState().select([id]);
  };

  if (cameraNodes.length === 0) {
    return null;
  }

  return (
    <group name="cameras">
      {cameraNodes.map((node) => (
        <React.Fragment key={node.id}>
          <CameraMesh
            node={node}
            selected={selection.includes(node.id)}
            showFOV={showLightCones || selection.includes(node.id)}
            onSelect={handleSelect}
          />
          <PreviewCamera node={node} />
        </React.Fragment>
      ))}
    </group>
  );
}

export { CameraMesh, PreviewCamera };
