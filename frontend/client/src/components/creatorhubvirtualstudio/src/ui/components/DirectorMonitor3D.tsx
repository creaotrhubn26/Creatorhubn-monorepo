/**
 * DirectorMonitor3D
 * 
 * A 3D monitor component that displays live camera feeds in the viewport.
 * Can be placed anywhere in the scene and shows real-time views from
 * registered cameras with various layout options.
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useNodes } from '../../state/store';
import { monitorFeedService, MonitorRenderer, MonitorLayout } from '../../core/services/monitorFeedService';
import { logger } from '../../core/services/logger';

const log = logger.module('DirectorMonitor3D, ');

let THREE: any = null;
try {
  THREE = require('three');
} catch {}

// ============================================================================
// Types
// ============================================================================

interface DirectorMonitor3DProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  layout?: MonitorLayout;
  showControls?: boolean;
  screenSize?: [number, number]; // Width, Height in meters
  bezelColor?: string;
  onCameraSelect?: (cameraId: string) => void;
}

// ============================================================================
// Monitor Screen Component
// ============================================================================

const MonitorScreen: React.FC<{
  renderer: MonitorRenderer;
  width: number;
  height: number;
}> = ({ renderer, width, height }) => {
  const meshRef = useRef<any>(null);
  const textureRef = useRef<any>(null);
  
  // Create geometry and material
  const geometry = useMemo(() => {
    if (!THREE) return null;
    return new THREE.PlaneGeometry(width, height);
  }, [width, height]);
  
  const material = useMemo(() => {
    if (!THREE) return null;
    return new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.FrontSide,
    });
  }, []);
  
  // Update texture every frame
  useFrame(() => {
    if (!renderer || !material) return;
    
    const newTexture = renderer.render();
    if (newTexture && meshRef.current) {
      // Dispose old texture
      if (textureRef.current && textureRef.current !== newTexture) {
        textureRef.current.dispose();
      }
      
      textureRef.current = newTexture;
      material.map = newTexture;
      material.needsUpdate = true;
    }
  });
  
  // Cleanup
  useEffect(() => {
    return () => {
      textureRef.current?.dispose();
      geometry?.dispose();
      material?.dispose();
    };
  }, [geometry, material]);
  
  if (!geometry || !material) return null;
  
  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  );
};

// ============================================================================
// Monitor Frame Component
// ============================================================================

const MonitorFrame: React.FC<{
  width: number;
  height: number;
  depth: number;
  bezelColor: string;
}> = ({ width, height, depth, bezelColor }) => {
  const bezelWidth = 0.02;
  
  if (!THREE) return null;
  
  return (
    <group>
      {/* Back panel */}
      <mesh position={[0, 0, -depth / 2]}>
        <boxGeometry args={[width + bezelWidth * 2, height + bezelWidth * 2, depth]} />
        <meshStandardMaterial color={bezelColor} roughness={0.7} metalness={0.3} />
      </mesh>
      
      {/* Top bezel */}
      <mesh position={[0, (height + bezelWidth) / 2, 0]}>
        <boxGeometry args={[width + bezelWidth * 2, bezelWidth, bezelWidth]} />
        <meshStandardMaterial color={bezelColor} roughness={0.5} metalness={0.5} />
      </mesh>
      
      {/* Bottom bezel */}
      <mesh position={[0, -(height + bezelWidth) / 2, 0]}>
        <boxGeometry args={[width + bezelWidth * 2, bezelWidth, bezelWidth]} />
        <meshStandardMaterial color={bezelColor} roughness={0.5} metalness={0.5} />
      </mesh>
      
      {/* Left bezel */}
      <mesh position={[-(width + bezelWidth) / 2, 0, 0]}>
        <boxGeometry args={[bezelWidth, height, bezelWidth]} />
        <meshStandardMaterial color={bezelColor} roughness={0.5} metalness={0.5} />
      </mesh>
      
      {/* Right bezel */}
      <mesh position={[(width + bezelWidth) / 2, 0, 0]}>
        <boxGeometry args={[bezelWidth, height, bezelWidth]} />
        <meshStandardMaterial color={bezelColor} roughness={0.5} metalness={0.5} />
      </mesh>
      
      {/* Stand */}
      <mesh position={[0, -height / 2 - 0.15, -0.05]}>
        <cylinderGeometry args={[0.02, 0.03, 0.3, 8]} />
        <meshStandardMaterial color={bezelColor} roughness={0.5} metalness={0.5} />
      </mesh>
      
      {/* Base */}
      <mesh position={[0, -height / 2 - 0.28, -0.05]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.02, 16]} />
        <meshStandardMaterial color={bezelColor} roughness={0.5} metalness={0.5} />
      </mesh>
    </group>
  );
};

// ============================================================================
// Monitor Controls (HTML overlay)
// ============================================================================

const MonitorControls: React.FC<{
  renderer: MonitorRenderer;
  onLayoutChange: (layout: MonitorLayout) => void;
  currentLayout: MonitorLayout;
}> = ({ renderer, onLayoutChange, currentLayout }) => {
  const layouts: MonitorLayout[] = ['single','2x1', '2x2', 'pip'];
  
  return (
    <Html position={[0, -0.25, 0.05]} center>
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '4px',
        background: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '4px',
        fontSize: '10px'}}>
        {layouts.map(layout => (
          <button
            key={layout}
            onClick={() => onLayoutChange(layout)}
            style={{
              padding: '4px 8px',
              background: currentLayout === layout ? '#2563eb' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontSize: '10px'}}
          >
            {layout.toUpperCase()}
          </button>
        ))}
        <button
          onClick={() => renderer.cycleCamera()}
          style={{
            padding: '4px 8px',
            background: '#059669',
            color: '#fff',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            fontSize: '10px'}}
        >
          NEXT CAM
        </button>
      </div>
    </Html>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const DirectorMonitor3D: React.FC<DirectorMonitor3DProps> = ({
  position = [0, 1.5, -2],
  rotation = [0, 0, 0],
  scale = 1,
  layout = 'single',
  showControls = true,
  screenSize = [0.5, 0.28], // 16:9 aspect ratio
  bezelColor = '#1a1a1a',
  onCameraSelect,
}) => {
  const { scene } = useThree();
  const nodes = useNodes();
  const [currentLayout, setCurrentLayout] = useState<MonitorLayout>(layout);
  const [renderer, setRenderer] = useState<MonitorRenderer | null>(null);
  
  // Initialize renderer
  useEffect(() => {
    const r = monitorFeedService.init(512, 288);
    r.setScene(scene);
    r.setConfig({ layout: currentLayout });
    setRenderer(r);
    
    log.info('DirectorMonitor3D initialized');
    
    return () => {
      // Don't dispose - other monitors may use it
    };
  }, [scene]);
  
  // Register cameras
  useEffect(() => {
    if (!renderer) return;
    
    const cameraNodes = nodes.filter(n => n.type ==='camera' || n.camera);
    
    cameraNodes.forEach(node => {
      renderer.registerCamera({
        id: node.id,
        name: node.name || `Camera ${node.id}`,
        transform: node.transform,
        camera: node.camera,
      });
    });
    
    log.debug('Registered cameras:', cameraNodes.length);
  }, [nodes, renderer]);
  
  // Update layout
  useEffect(() => {
    renderer?.setConfig({ layout: currentLayout });
  }, [currentLayout, renderer]);
  
  const handleLayoutChange = (newLayout: MonitorLayout) => {
    setCurrentLayout(newLayout);
  };
  
  if (!THREE || !renderer) {
    return null;
  }
  
  const [width, height] = screenSize;
  const scaledWidth = width * scale;
  const scaledHeight = height * scale;
  
  return (
    <group 
      position={position} 
      rotation={[rotation[0], rotation[1], rotation[2]]}
    >
      {/* Monitor frame */}
      <MonitorFrame 
        width={scaledWidth} 
        height={scaledHeight} 
        depth={0.04} 
        bezelColor={bezelColor} 
      />
      
      {/* Screen with camera feeds */}
      <group position={[0, 0, 0.001]}>
        <MonitorScreen 
          renderer={renderer} 
          width={scaledWidth} 
          height={scaledHeight} 
        />
      </group>
      
      {/* Controls overlay */}
      {showControls && (
        <MonitorControls 
          renderer={renderer}
          onLayoutChange={handleLayoutChange}
          currentLayout={currentLayout}
        />
      )}
    </group>
  );
};

export default DirectorMonitor3D;

