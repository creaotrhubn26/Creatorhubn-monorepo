// @ts-nocheck
import * as React from 'react';
import { Box, Typography } from '@mui/material';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useNodes, useActions, useMeasureMode, useScene, useMeasurements, useShowLightCones, useShowStudioGuides, useStudioGuideSettings, useAdvancedGuideSettings } from '@/state/selectors';
import { photometricCalculator } from '../../core/services/photometric';
import { StudioGuidesOverlay } from '../components/StudioGuidesOverlay';
import { LightingVisualization } from '../components/LightingVisualization';
import { DepthOfFieldPreview } from '../components/DepthOfFieldPreview';
import { HeightReferenceGuides } from '../components/HeightReferenceGuides';
import { SafetySpacingGuides } from '../components/SafetySpacingGuides';
import { GlassesReflectionGuide } from '../components/GlassesReflectionGuide';
import { FaceAnalysisOverlay } from '../components/FaceAnalysisOverlay';
import { SelectionHighlight } from '../components/SelectionHighlight';
import { useFaceAnalysis } from '../../contexts/FaceAnalysisContext';
import type { AdvancedGuideSettings } from '../panels/AdvancedGuidesPanel';
import {
  setR3FCanvas,
  setHistogramCanvas,
  getActiveCameraId,
  setThreeScene,
  getOverlayMode,
  getHistogramCanvas,
  setDepthCanvas,
  getDepthCanvas,
  setMainCamera,
  getMainCamera,
  setDragGhost,
  getDragGhost,
  getDragGhostAsset,
  setDragGhostPayload,
} from '@/core/services/viewports';

function LightCones({ nodes, visible }: { nodes: any[]; visible: boolean }) {
  if (!visible || !THREE) return null;

  return (
    <>
      {nodes
        .filter((n) => n.light && n.visible !== false)
        .map((n) => {
          const beam = n.light?.beam || 60;
          const isSpot = beam && (n.light?.modifier === 'spot' || beam < 60);

          if (isSpot) {
            // Calculate cone dimensions
            let effectiveBeam = beam;
            const ies = n.userData?.iesId as string | undefined;
            if (ies && /narrow/i.test(ies)) effectiveBeam = Math.max(5, beam * 0.6);

            const angle = Math.max(5, (Math.min(120, effectiveBeam) * Math.PI) / 180);
            const coneLength = 3; // meters
            const coneRadius = Math.tan(angle / 2) * coneLength;

            // Get light color
            const lightColor = n.light?.color || '#ffffff';

            return (
              <mesh
                key={`cone-${n.id}`}
                position={n.transform.position}
                rotation={[-Math.PI / 2, 0, 0]} // Point downward
              >
                <coneGeometry args={[coneRadius, coneLength, 32, 1, true]} />
                <meshBasicMaterial
                  color={lightColor}
                  transparent={true}
                  opacity={0.15}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            );
          }

          // Point lights get a sphere visualization
          return (
            <mesh
              key={`sphere-${n.id}`}
              position={n.transform.position}
            >
              <sphereGeometry args={[1.5, 16, 16]} />
              <meshBasicMaterial
                color={n.light?.color || '#ffffff'}
                transparent={true}
                opacity={0.1}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          );
        })}
    </>
  );
}

function Lights({ nodes }: { nodes: any[] }) {
  const [texCache] = React.useState<Record<string, any>>({});
  return (
    <>
      {nodes
        .filter((n) => n.light && n.visible !== false)
        .map((n) => {
          const beam = n.light?.beam;
          const isSpot = beam && (n.light?.modifier === 'spot' || beam < 60);
          
          // Calculate physically accurate intensity using photometric calculator
          const power = n.light?.power ?? 0.5;
          const beamAngle = isSpot ? beam : undefined;
          const intensity = photometricCalculator.calculateThreeJSIntensity(
            power,
            undefined, // wattage - will use default
            undefined, // efficacy - will use default
            beamAngle
          );
          
          if (isSpot) {
            let effectiveBeam = beam; // IES tweak
            const ies = n.userData?.iesId as string | undefined;
            if (ies && /narrow/i.test(ies)) effectiveBeam = Math.max(5, beam * 0.6);
            const angle = Math.max(5, (Math.min(120, effectiveBeam) * Math.PI) / 180);
            let mapTex: any = null;
            const goboId = n.userData?.goboId;
            if (goboId && THREE) {
              if (!texCache[goboId]) {
                const url = `/gobos/${goboId}.png`;
                texCache[goboId] = new THREE.TextureLoader().load(url);
              }
              mapTex = texCache[goboId];
            }
            return (
              <spotLight
                key={n.id}
                position={n.transform.position}
                angle={angle}
                intensity={intensity}
                decay={2} // Inverse square law falloff
                {...(mapTex ? { map: mapTex } : {})}
              />
            );
          }
          return (
            <pointLight
              key={n.id}
              position={n.transform.position}
              intensity={intensity}
              decay={2} // Inverse square law falloff
            />
          );
        })}
    </>
  );
}

function GroundPicker() {
  const { gl, camera, scene } = useThree();
  const { addMeasurementPoints, toggleMeasureMode } = useActions();
  const measureMode3D = useMeasureMode();
  const pending = React.useRef<[number, number] | null>(null);

  const onPointerDown = (e: any) => {
    if (!measureMode3D) return;
    const p = e.point as { x: number; y: number; z: number };
    const pt: [number, number] = [p.x, p.z];
    if (!pending.current) pending.current = pt;
    else {
      addMeasurementPoints(pending.current, pt);
      pending.current = null;
      toggleMeasureMode();
    }
  };

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onPointerDown={onPointerDown}>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#e5e7eb" />
    </mesh>
  );
}

function CameraRef() {
  const { camera } = useThree();
  React.useEffect(() => {
    setMainCamera(camera);
  }, [camera]);
  return null;
}

function DragGhost3D() {
  const [pos, setPos] = React.useState<[number, number, number] | null>(getDragGhost());
  useFrame(() => {
    setPos(getDragGhost());
  });
  if (!pos) return null;
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial color="#22c55e" />
    </mesh>
  );
}

function SceneMeshes({ nodes }: { nodes: any[] }) {
  const [texCache] = React.useState<Record<string, any>>({});
  return (
    <>
      {nodes
        .filter((n) => n.light && n.visible !== false)
        .map((n) => {
          const beam = n.light?.beam;
          const isSpot = beam && (n.light?.modifier === 'spot' || beam < 60);
          
          // Calculate physically accurate intensity using photometric calculator
          const power = n.light?.power ?? 0.5;
          const beamAngle = isSpot ? beam : undefined;
          const intensity = photometricCalculator.calculateThreeJSIntensity(
            power,
            undefined, // wattage - will use default
            undefined, // efficacy - will use default
            beamAngle
          );
          
          if (isSpot) {
            let effectiveBeam = beam; // IES tweak
            const ies = n.userData?.iesId as string | undefined;
            if (ies && /narrow/i.test(ies)) effectiveBeam = Math.max(5, beam * 0.6);
            const angle = Math.max(5, (Math.min(120, effectiveBeam) * Math.PI) / 180);
            let mapTex: any = null;
            const goboId = n.userData?.goboId;
            if (goboId && THREE) {
              if (!texCache[goboId]) {
                const url = `/gobos/${goboId}.png`;
                texCache[goboId] = new THREE.TextureLoader().load(url);
              }
              mapTex = texCache[goboId];
            }
            return (
              <spotLight
                key={n.id}
                position={n.transform.position}
                angle={angle}
                intensity={intensity}
                decay={2} // Inverse square law falloff
                {...(mapTex ? { map: mapTex } : {})}
              />
            );
          }
          return (
            <pointLight
              key={n.id}
              position={n.transform.position}
              intensity={intensity}
              decay={2} // Inverse square law falloff
            />
          );
        })}
    </>
  );
}

/**
 * EquipmentMeshes - Renders 3D representations of studio equipment
 * Supports procedural generation and GLB model loading
 */
function EquipmentMeshes({ nodes }: { nodes: any[] }) {
  if (!THREE) return null;
  
  return (
    <>
      {/* Render Light Equipment Meshes */}
      {nodes
        .filter((n) => n.light && n.visible !== false)
        .map((n) => (
          <LightEquipmentMesh key={`eq-${n.id}`} node={n} />
        ))}
      
      {/* Render Camera Equipment Meshes */}
      {nodes
        .filter((n) => n.camera && n.visible !== false)
        .map((n) => (
          <CameraEquipmentMesh key={`eq-${n.id}`} node={n} />
        ))}
    </>
  );
}

/**
 * LightEquipmentMesh - Procedural 3D representation of a studio light
 * Uses brand-specific styling (Profoto blue, Godox orange, Aputure red)
 */
function LightEquipmentMesh({ node }: { node: any }) {
  if (!THREE) return null;
  
  const brandStyle = node.model3d?.brandStyle || node.userData?.brand?.toLowerCase() || 'generic';
  const modifier = node.light?.modifier || 'softbox';
  const modifierSize = node.light?.modifierSize || [0.6, 0.6];
  
  // Brand accent colors
  const accentColors: Record<string, string> = {
    profoto: '#0066cc',  // Blue
    godox: '#ff6600',    // Orange
    aputure: '#cc0000',  // Red
    generic: '#666666',  // Gray
  };
  
  const accentColor = accentColors[brandStyle] || accentColors.generic;
  const position = node.transform?.position || [0, 1.5, 0];
  const rotation = node.transform?.rotation || [0, 0, 0];
  
  return (
    <group position={position} rotation={rotation}>
      {/* Light Head Body */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.1, 0.2, 32]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Front Glass/Diffuser */}
      <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.09, 32]} />
        <meshStandardMaterial 
          color="#ffffff" 
          metalness={0} 
          roughness={0.1} 
          transparent 
          opacity={0.9} 
        />
      </mesh>
      
      {/* Brand Accent Ring */}
      <mesh position={[0, 0, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.095, 0.005, 16, 32]} />
        <meshStandardMaterial color={accentColor} metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Mounting Bracket */}
      <mesh position={[0, -0.1, -0.05]}>
        <boxGeometry args={[0.05, 0.15, 0.03]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.4} />
      </mesh>
      
      {/* Modifier (Softbox, Beauty Dish, etc.) */}
      <ModifierMesh type={modifier} size={modifierSize} />
    </group>
  );
}

/**
 * ModifierMesh - 3D representation of light modifiers
 */
function ModifierMesh({ type, size }: { type: string; size: [number, number] }) {
  if (!THREE) return null;
  
  const [width, height] = size;
  
  switch (type) {
    case 'softbox':
      return (
        <group position={[0, 0, 0.2]}>
          {/* Softbox body */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[width, height, 0.3]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
          {/* Diffusion panel */}
          <mesh position={[0, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        </group>
      );
      
    case 'beautydish':
      return (
        <group position={[0, 0, 0.15]}>
          {/* Dish */}
          <mesh rotation={[Math.PI, 0, 0]}>
            <sphereGeometry args={[width / 2, 32, 32, 0, Math.PI * 2, 0, Math.PI / 3]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.9} roughness={0.1} side={THREE.DoubleSide} />
          </mesh>
          {/* Center deflector */}
          <mesh position={[0, 0, -width * 0.3]}>
            <cylinderGeometry args={[width * 0.15, width * 0.175, 0.05, 32]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      );
      
    case 'umbrella':
      return (
        <group position={[0, 0, 0.3]}>
          {/* Umbrella canopy */}
          <mesh rotation={[Math.PI, 0, 0]}>
            <sphereGeometry args={[width / 2, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#f0f0f0" metalness={0} roughness={0.9} transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
          {/* Shaft */}
          <mesh position={[0, -width * 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.01, 0.01, width * 0.6, 16]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.4} />
          </mesh>
        </group>
      );
      
    case 'octabox':
      return (
        <group position={[0, 0, 0.2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[width / 2, width / 2, 0.3, 8]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[width / 2, 8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        </group>
      );
      
    case 'stripbox':
      return (
        <group position={[0, 0, 0.2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[width, height, 0.25]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.13]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        </group>
      );
      
    case 'spot':
    case 'grid':
      return (
        <group position={[0, 0, 0.12]}>
          {/* Snoot/Grid */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.1, 0.2, 32]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.3} />
          </mesh>
        </group>
      );
      
    case 'panel':
      return (
        <group position={[0, 0, 0.05]}>
          {/* LED Panel */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[width, height, 0.05]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.5} />
          </mesh>
          {/* LED surface */}
          <mesh position={[0, 0, 0.026]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[width * 0.95, height * 0.95]} />
            <meshStandardMaterial color="#fffdf5" emissive="#fffdf5" emissiveIntensity={0.3} />
          </mesh>
        </group>
      );
      
    default:
      // Default: small sphere representing the light source
      return (
        <mesh position={[0, 0, 0.12]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color="#ffffff" emissive="#fffdf5" emissiveIntensity={0.5} />
        </mesh>
      );
  }
}

/**
 * CameraEquipmentMesh - Procedural 3D representation of a camera
 */
function CameraEquipmentMesh({ node }: { node: any }) {
  if (!THREE) return null;
  
  const position = node.transform?.position || [3, 1.5, 3];
  const rotation = node.transform?.rotation || [0, 0, 0];
  const brand = node.userData?.brand?.toLowerCase() || ', ';
  
  // Brand-specific body colors
  const bodyColors: Record<string, string> = {
    canon: '#1a1a1a',
    sony: '#1a1a1a',
    nikon: '#1a1a1a',
    fujifilm: '#1a1a1a',
    panasonic: '#1a1a1a',
    leica: '#1a1a1a',
    red: '#8b0000',      // RED cameras have red accent
    blackmagic: '#1a1a1a',
  };
  
  // Brand accent colors
  const accentColors: Record<string, string> = {
    canon: '#cc0000',    // Red ring
    sony: '#ff6600',     // Orange
    nikon: '#ffcc00',    // Yellow
    fujifilm: '#006600', // Green
    panasonic: '#0066cc', // Blue
    leica: '#cc0000',    // Red dot
    red: '#ff0000',
    blackmagic: '#ff6600',
  };
  
  const bodyColor = bodyColors[brand] || '#1a1a1a';
  const accentColor = accentColors[brand] || '#666666';
  
  return (
    <group position={position} rotation={rotation}>
      {/* Camera Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.1, 0.08]} />
        <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Viewfinder/EVF hump */}
      <mesh position={[0, 0.06, -0.02]}>
        <boxGeometry args={[0.05, 0.04, 0.04]} />
        <meshStandardMaterial color={bodyColor} metalness={0.6} roughness={0.4} />
      </mesh>
      
      {/* Lens Mount */}
      <mesh position={[0, 0, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.01, 32]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Lens Barrel */}
      <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.035, 0.04, 0.1, 32]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Lens Front Element */}
      <mesh position={[0, 0, 0.155]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.032, 32]} />
        <meshStandardMaterial color="#1a1a2a" metalness={0.1} roughness={0.05} transparent opacity={0.9} />
      </mesh>
      
      {/* Brand Accent Ring on Lens */}
      <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.038, 0.003, 16, 32]} />
        <meshStandardMaterial color={accentColor} metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Tripod Mount Point */}
      <mesh position={[0, -0.055, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.01, 16]} />
        <meshStandardMaterial color="#4a4a4a" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  );
}

function LineWithLabel({
  a,
  b,
  label,
  color,
}: {
  a: [number, number];
  b: [number, number];
  label: string;
  color?: string;
}) {
  const ref = React.useRef<any>(null);
  const geom = React.useMemo(() => {
    if (!THREE) return null;
    const g = new THREE.BufferGeometry();
    const verts = new Float32Array([a[0], 0.02, a[1], b[0], 0.02, b[1]]);
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    return g;
  }, [a[0], a[1], b[0], b[1]]);
  const mid: [number, number, number] = [(a[0] + b[0]) / 2, 0.06, (a[1] + b[1]) / 2];
  return (
    <group>
      {/* @ts-ignore */}
      <line ref={ref} geometry={geom}>
        <lineBasicMaterial attach="material" color={color || '#2563eb'} linewidth={2} />
      </line>
      {Html ? (
        <Html position={mid} center distanceFactor={12}>
          <div
            style={{
              padding: '2px 6px',
              border: '1px solid #93c5fd',
              background: '#fff',
              color: '#0f172a',
              fontSize: 12,
              borderRadius: 6}}
          >
            {label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

function Measurements3D() {
  const ms = useMeasurements();
  return (
    <>
      {ms.map((m) => {
        const dx = m.a[0] - m.b[0],
          dz = m.a[1] - m.b[1];
        const d = Math.hypot(dx, dz).toFixed(2);
        return <LineWithLabel key={m.id} a={m.a} b={m.b} label={`${d} m`} color={m.color} />;
      })}
    </>
  );
}

function OffscreenHistogramRender({ nodes }: { nodes: any[] }) {
  const { scene } = useThree();
  const offscreenRef = React.useRef<any>(null as any);
  const depthOffscreenRef = React.useRef<any>(null as any);
  const cameraRef = React.useRef<any>(null as any);

  React.useEffect(() => {
    if (!THREE) return;
    const cvs = document.createElement('canvas');
    cvs.width = 256;
    cvs.height = 256;
    const renderer = new THREE.WebGLRenderer({
      canvas: cvs,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(256, 256, false);
    renderer.setPixelRatio(1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    offscreenRef.current = renderer;
    setHistogramCanvas(cvs);
    cameraRef.current = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    // depth canvas
    const depth = document.createElement('canvas');
    depth.width = 256;
    depth.height = 256;
    setDepthCanvas(depth);
    const depthRenderer = new THREE.WebGLRenderer({
      canvas: depth,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    depthRenderer.setSize(256, 256, false);
    depthRenderer.setPixelRatio(1);
    depthOffscreenRef.current = depthRenderer;
    setThreeScene(scene);
    return () => {
      setHistogramCanvas(null);
      setDepthCanvas(null);
      renderer.dispose();
      depthOffscreenRef.current &&
        depthOffscreenRef.current.dispose &&
        depthOffscreenRef.current.dispose();
    };
  }, []);

  useFrame(() => {
    if (!THREE || !offscreenRef.current || !cameraRef.current) return;
    const activeId = getActiveCameraId();
    const camNode = activeId ? nodes.find((n) => n.id === activeId) : nodes.find((n) => n.camera);
    const renderer = offscreenRef.current as any;
    const cam3 = cameraRef.current as any;

    let pos = [3, 3, 3] as [number, number, number];
    let look = [0, 1.6, 0] as [number, number, number];
    let fov = 50;
    let exposure = 1.0;
    let filmic = true;

    if (camNode?.camera) {
      pos = camNode.transform.position;
      look = [0, camNode.transform.position[1], 0];
      const sensor = camNode.camera.sensor || [36, 24];
      const focal = camNode.camera.focalLength || 50;
      const fovRad = 2 * Math.atan(sensor[1] / 2 / focal);
      fov = (fovRad * 180) / Math.PI;
      const nd = camNode.userData?.video?.ndStops || 0;
      filmic = !!camNode.userData?.video?.filmic;
      exposure = Math.pow(2, -nd);
    }

    cam3.fov = fov;
    cam3.aspect = 1;
    cam3.position.set(pos[0], pos[1], pos[2]);
    cam3.lookAt(look[0], look[1], look[2]);
    cam3.updateProjectionMatrix();

    renderer.toneMapping = filmic ? THREE.ACESFilmicToneMapping : THREE.LinearToneMapping;
    renderer.toneMappingExposure = exposure;
    renderer.render(scene, cam3);
    if (depthOffscreenRef.current) {
      const old = scene.overrideMaterial;
      scene.overrideMaterial = new THREE.MeshDepthMaterial();
      depthOffscreenRef.current.render(scene, cam3);
      scene.overrideMaterial = old;
    }
  });

  return null;
}

/**
 * Face Analysis Overlay Wrapper
 * Connects context to overlay component
 */
function FaceAnalysisOverlayWrapper() {
  const { analysisData, showOverlay } = useFaceAnalysis();
  const guideSettings = useStudioGuideSettings();
  
  if (!showOverlay || !analysisData) {
    return null;
  }

  // Use subject position from guide settings, or default
  const facePosition: [number, number, number] = guideSettings?.subjectPosition || [0, 1.65, 0];

  return (
    <FaceAnalysisOverlay
      landmarks={analysisData.landmarks}
      headPose={analysisData.headPose}
      compositionGuides={analysisData.compositionGuides}
      showLandmarks={true}
      showCompositionGuides={true}
      showHeadPose={true}
      showFaceCenter={true}
      facePosition={facePosition}
      scale={1}
    />
  );
}

function OverlayExposureTools() {
  const ref = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    let raf: number;
    const loop = () => {
      const mode = getOverlayMode();
      const src = getHistogramCanvas();
      const dst = ref.current;
      if (src && dst) {
        if (dst.width !== src.width || dst.height !== src.height) {
          dst.width = src.width;
          dst.height = src.height;
        }
        const sctx = src.getContext('2d');
        const dctx = dst.getContext('2d');
        if (!sctx || !dctx) {
          raf = requestAnimationFrame(loop);
          return;
        }
        const img = sctx.getImageData(0, 0, src.width, src.height);
        const data = img.data;
        const out = dctx.createImageData(img.width, img.height);
        const odata = out.data;
        // Precompute luma
        const lumas = new Uint8ClampedArray(img.width * img.height);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          lumas[p] = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
        }
        if (mode === 'peaking') {
          const depthSrc = getDepthCanvas();
          if (depthSrc) {
            const dctx2 = depthSrc.getContext('2d');
            if (!dctx2) {
              raf = requestAnimationFrame(loop);
              return;
            }
            const dimg = dctx2.getImageData(0, 0, depthSrc.width, depthSrc.height);
            const ddata = dimg.data; // depth encoded in RGB
            // Build luma and depth arrays
            const w = img.width,
              h = img.height;
            const lumas = new Uint8ClampedArray(w * h);
            const depths = new Float32Array(w * h);
            for (let i = 0, p = 0; i < data.length; i += 4, p++) {
              const r = data[i],
                g = data[i + 1],
                b = data[i + 2];
              lumas[p] = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;
              const dr = ddata[i],
                dg = ddata[i + 1],
                db = ddata[i + 2];
              const nd = (dr + dg + db) / (3 * 255); // approximate normalized depth
              depths[p] = nd;
            }
            // Approximate focus normalized t ~ focusDistance in [near,far]=[0.1,100]
            const near = 0.1,
              far = 100;
            const focusMeters = 3.0; // fallback
            const focusT = (focusMeters - near) / (far - near);
            // Use CoC to set band width
            const band = 0.05; // wide enough visually; could scale with CoC later

            // Sobel on luma then gate by depth proximity
            const Gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
            const Gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
            for (let y = 1; y < h - 1; y++) {
              for (let x = 1; x < w - 1; x++) {
                let sx = 0,
                  sy = 0,
                  k = 0;
                for (let j = -1; j <= 1; j++) {
                  for (let i2 = -1; i2 <= 1; i2++, k++) {
                    const idx = (y + j) * w + (x + i2);
                    const v = lumas[idx];
                    sx += v * Gx[k];
                    sy += v * Gy[k];
                  }
                }
                const mag = Math.min(255, Math.hypot(sx, sy) / 4);
                const pidx = y * w + x;
                const depth = depths[pidx];
                const nearFocus = Math.abs(depth - focusT) < band;
                const di = pidx * 4;
                if (mag > 64 && nearFocus) {
                  odata[di] = 0;
                  odata[di + 1] = 255;
                  odata[di + 2] = 128;
                  odata[di + 3] = 180;
                } else {
                  odata[di + 3] = 0;
                }
              }
            }
          }
        } else {
          for (let i = 0; i < data.length; i += 4) {
            const y = lumas[i / 4];
            if (mode === 'zebra') {
              if (y > 230 || y < 10) {
                const x = (i / 4) % img.width;
                odata[i] = 255;
                odata[i + 1] = x % 8 < 4 ? 255 : 0;
                odata[i + 2] = 0;
                odata[i + 3] = 128;
              } else {
                odata[i + 3] = 0;
              }
            } else if (mode === 'falsecolor') {
              let rr = 0,
                gg = 0,
                bb = 0;
              const t = y / 255;
              if (t < 0.1) {
                rr = 0;
                gg = 0;
                bb = 128;
              } else if (t < 0.2) {
                rr = 0;
                gg = 0;
                bb = 255;
              } else if (t < 0.4) {
                rr = 0;
                gg = 255;
                bb = 255;
              } else if (t < 0.6) {
                rr = 0;
                gg = 255;
                bb = 0;
              } else if (t < 0.8) {
                rr = 255;
                gg = 255;
                bb = 0;
              } else {
                rr = 255;
                gg = 0;
                bb = 0;
              }
              odata[i] = rr;
              odata[i + 1] = gg;
              odata[i + 2] = bb;
              odata[i + 3] = 128;
            } else {
              odata[i + 3] = 0;
            }
          }
        }
        dctx.putImageData(out, 0, 0);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', inset: 0, imageRendering: 'pixelated', pointerEvents: 'none' }}
    />
  );
}

export default function Stage3D() {
  const nodes = useNodes();
  const scene = useScene();
  const showLightCones = useShowLightCones();
  const showStudioGuides = useShowStudioGuides();
  const guideSettings = useStudioGuideSettings();
  const advancedGuideSettings = useAdvancedGuideSettings();
  const onDragOver3D = (e: any) => {
    e.preventDefault();
    let asset: any = null;
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) asset = JSON.parse(raw).asset;
    } catch {}

    // compute ground intersection for ghost
    const cam = getMainCamera();
    const canvas = e.currentTarget.querySelector('canvas');
    if (!cam || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    // ray -> ground y=0
    if (THREE && cam) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera({ x, y }, cam);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y=0
      const p = new THREE.Vector3();
      ray.ray.intersectPlane(plane, p);
      if (p) {
        // snap to 0.25m
        const snap = (v: number) => Math.round(v / 0.25) * 0.25;
        if (asset) setDragGhostPayload({ pos: [snap(p.x), 0, snap(p.z)], asset });
        else setDragGhost([snap(p.x), 0, snap(p.z)]);
      }
    }
  };
  const onDrop3D = (e: any) => {
    e.preventDefault();
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (!raw) return;
      const { asset } = JSON.parse(raw);
      // Approximate drop to center for now (R3F raycaster is not available here without extra wiring)
      const ev = new CustomEvent('ch-add-asset-at', { detail: { asset, position: [0, 0, 0] } });
      window.dispatchEvent(ev as any);
    } catch {}
  };
  return (
    <Box
      onDragOver={onDragOver3D}
      onDrop={onDrop3D}
      sx={{
        height: 180,
        border: '1px solid #e2e8f0',
        borderRadius: 2,
        overflow: 'hidden',
        position: 'relative'}}
    >
      <Canvas
        camera={{ position: [3, 3, 3], fov: 50 }}
        onCreated={({ gl, scene }) => {
          setR3FCanvas(gl.domElement as HTMLCanvasElement);
          setThreeScene(scene);
        }}
      >
        <ambientLight intensity={0.6} />
        <CameraRef />
        <DragGhost3D />
        <Lights nodes={nodes} />
        <LightCones nodes={nodes} visible={showLightCones} />
        <EquipmentMeshes nodes={nodes} />
        <GroundPicker />
        <SceneMeshes nodes={nodes} />
        <Measurements3D />
        <OffscreenHistogramRender nodes={nodes} />
        {/* Studio Guides Overlay */}
        {showStudioGuides && guideSettings && (
          <StudioGuidesOverlay
            showDistanceGuides={guideSettings.showDistanceGuides}
            showAngleGuides={guideSettings.showAngleGuides}
            showPositionMarkers={guideSettings.showPositionMarkers}
            showGridOverlay={guideSettings.showGridOverlay}
            subjectPosition={guideSettings.subjectPosition}
            backgroundDistance={guideSettings.backgroundDistance}
            keyLightPosition={[
              guideSettings.subjectPosition[0] + Math.sin((guideSettings.keyLightAngle * Math.PI) / 180) * guideSettings.keyLightDistance,
              guideSettings.keyLightHeight,
              guideSettings.subjectPosition[2] + Math.cos((guideSettings.keyLightAngle * Math.PI) / 180) * guideSettings.keyLightDistance,
            ]}
            fillPosition={[
              guideSettings.subjectPosition[0] - Math.sin(((guideSettings.keyLightAngle * 0.5) * Math.PI) / 180) * guideSettings.fillDistance,
              guideSettings.keyLightHeight - 0.3,
              guideSettings.subjectPosition[2] + Math.cos(((guideSettings.keyLightAngle * 0.5) * Math.PI) / 180) * guideSettings.fillDistance,
            ]}
            cameraPosition={[
              guideSettings.subjectPosition[0],
              1.5,
              guideSettings.subjectPosition[2] + guideSettings.cameraDistance,
            ]}
          />
        )}

        {/* Lighting Visualization */}
        {advancedGuideSettings?.lighting?.enabled && (
          <LightingVisualization
            showShadowDirection={advancedGuideSettings.lighting.showShadowDirection}
            showLightFalloff={advancedGuideSettings.lighting.showLightFalloff}
            showCatchlightPreview={advancedGuideSettings.lighting.showCatchlightPreview}
            showLightingRatio={advancedGuideSettings.lighting.showLightingRatio}
            showReflectorBounce={advancedGuideSettings.lighting.showReflectorBounce}
            keyLightPosition={[
              guideSettings.subjectPosition[0] + Math.sin((guideSettings.keyLightAngle * Math.PI) / 180) * guideSettings.keyLightDistance,
              guideSettings.keyLightHeight,
              guideSettings.subjectPosition[2] + Math.cos((guideSettings.keyLightAngle * Math.PI) / 180) * guideSettings.keyLightDistance,
            ]}
            fillLightPosition={[
              guideSettings.subjectPosition[0] - Math.sin(((guideSettings.keyLightAngle * 0.5) * Math.PI) / 180) * guideSettings.fillDistance,
              guideSettings.keyLightHeight - 0.3,
              guideSettings.subjectPosition[2] + Math.cos(((guideSettings.keyLightAngle * 0.5) * Math.PI) / 180) * guideSettings.fillDistance,
            ]}
            subjectPosition={guideSettings.subjectPosition}
            subjectHeight={1.7}
            keyLightPower={0.8}
            fillLightPower={0.4}
          />
        )}

        {/* Depth of Field Preview */}
        {advancedGuideSettings?.depthOfField?.enabled && (
          <DepthOfFieldPreview
            showFocusPlane={advancedGuideSettings.depthOfField.showFocusPlane}
            showInFocusZone={advancedGuideSettings.depthOfField.showInFocusZone}
            showHyperfocalDistance={advancedGuideSettings.depthOfField.showHyperfocalDistance}
            showNearFarLimits={advancedGuideSettings.depthOfField.showNearFarLimits}
            cameraPosition={[
              guideSettings.subjectPosition[0],
              1.5,
              guideSettings.subjectPosition[2] + guideSettings.cameraDistance,
            ]}
            focusDistance={guideSettings.cameraDistance}
            aperture={2.8}
            focalLength={85}
          />
        )}

        {/* Height Reference Guides */}
        {advancedGuideSettings?.heightReferences?.enabled && (
          <HeightReferenceGuides
            showSubjectHeights={advancedGuideSettings.heightReferences.showSubjectHeights}
            showCameraHeights={advancedGuideSettings.heightReferences.showCameraHeights}
            showLightHeights={advancedGuideSettings.heightReferences.showLightHeights}
            showBackgroundHeight={advancedGuideSettings.heightReferences.showBackgroundHeight}
            position={guideSettings.subjectPosition}
            backdropHeight={3.0}
            backdropWidth={4.0}
          />
        )}

        {/* Safety & Spacing Guides */}
        {advancedGuideSettings?.safetySpacing?.enabled && (
          <SafetySpacingGuides
            showEquipmentClearance={advancedGuideSettings.safetySpacing.showEquipmentClearance}
            showCableRoutes={advancedGuideSettings.safetySpacing.showCableRoutes}
            showMovementZones={advancedGuideSettings.safetySpacing.showMovementZones}
            showHotLightWarning={advancedGuideSettings.safetySpacing.showHotLightWarning}
            subjectPosition={guideSettings.subjectPosition}
            equipmentPositions={[
              {
                position: [
                  guideSettings.subjectPosition[0] + Math.sin((guideSettings.keyLightAngle * Math.PI) / 180) * guideSettings.keyLightDistance,
                  0,
                  guideSettings.subjectPosition[2] + Math.cos((guideSettings.keyLightAngle * Math.PI) / 180) * guideSettings.keyLightDistance,
                ],
                type: 'light_stand' as const,
                name: 'Key Light Stand',
              },
            ]}
          />
        )}

        {/* Glasses Reflection Guide */}
        {advancedGuideSettings?.glassesReflection?.enabled && (
          <GlassesReflectionGuide
            subjectPosition={guideSettings.subjectPosition}
            keyLightPosition={[
              guideSettings.subjectPosition[0] + Math.sin((guideSettings.keyLightAngle * Math.PI) / 180) * guideSettings.keyLightDistance,
              guideSettings.keyLightHeight,
              guideSettings.subjectPosition[2] + Math.cos((guideSettings.keyLightAngle * Math.PI) / 180) * guideSettings.keyLightDistance,
            ]}
            cameraPosition={[
              guideSettings.subjectPosition[0],
              1.5,
              guideSettings.subjectPosition[2] + guideSettings.cameraDistance,
            ]}
            subjectHeight={1.65}
            headTiltAngle={advancedGuideSettings.glassesReflection.headTiltAngle}
            glassesAngle={advancedGuideSettings.glassesReflection.glassesAngle}
          />
        )}

        {/* Face Analysis Overlay */}
        <FaceAnalysisOverlayWrapper />
      </Canvas>
      <OverlayExposureTools />
    </Box>
  );
}
