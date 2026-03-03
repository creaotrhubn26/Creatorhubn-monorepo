/**
 * CreatorHub Academy Hero Visual
 * Premium 3D scene built with React Three Fiber.
 */

import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AcademyLogo3DProps {
  width?: number;
  height?: number;
}

const amber = '#f59e0b';
const orange = '#ea580c';
const blue = '#3b82f6';
const violet = '#8b5cf6';

type HaloGlyph = 'video' | 'quiz' | 'annotate' | 'modules' | 'analytics' | 'security';

interface HaloFeature {
  label: string;
  color: string;
  glyph: HaloGlyph;
}

const haloFeatures: HaloFeature[] = [
  { label: 'Videospiller', color: '#f59e0b', glyph: 'video' },
  { label: 'Interaktive Quizer', color: '#8b5cf6', glyph: 'quiz' },
  { label: 'Annotasjon', color: '#22c55e', glyph: 'annotate' },
  { label: 'Moduler', color: '#3b82f6', glyph: 'modules' },
  { label: 'Analyser', color: '#06b6d4', glyph: 'analytics' },
  { label: 'Sikkerhet', color: '#ef4444', glyph: 'security' },
];

function createLabelTexture(text: string, color: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const radius = 26;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  ctx.moveTo(radius, 10);
  ctx.lineTo(canvas.width - radius, 10);
  ctx.quadraticCurveTo(canvas.width - 10, 10, canvas.width - 10, radius);
  ctx.lineTo(canvas.width - 10, canvas.height - radius);
  ctx.quadraticCurveTo(canvas.width - 10, canvas.height - 10, canvas.width - radius, canvas.height - 10);
  ctx.lineTo(radius, canvas.height - 10);
  ctx.quadraticCurveTo(10, canvas.height - 10, 10, canvas.height - radius);
  ctx.lineTo(10, radius);
  ctx.quadraticCurveTo(10, 10, radius, 10);
  ctx.closePath();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = '#e5e7eb';
  ctx.font = '700 38px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 3);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function HaloLabel({ text, color }: { text: string; color: string }) {
  const texture = useMemo(() => createLabelTexture(text, color), [text, color]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!texture) return null;

  return (
    <sprite position={[0, -0.7, 0.15]} scale={[2.35, 0.56, 1]}>
      <spriteMaterial map={texture} transparent opacity={0.95} toneMapped={false} depthWrite={false} />
    </sprite>
  );
}

function FeatureGlyph({ glyph, color }: { glyph: HaloGlyph; color: string }) {
  if (glyph === 'video') {
    return (
      <mesh position={[0.08, 0, 0.19]}>
        <coneGeometry args={[0.2, 0.36, 3]} />
        <meshStandardMaterial color="#ffffff" emissive="#e2e8f0" emissiveIntensity={0.35} metalness={0.1} roughness={0.15} />
      </mesh>
    );
  }

  if (glyph === 'quiz') {
    return (
      <group position={[0, 0, 0.15]}>
        <mesh position={[0, 0.08, 0]}>
          <torusGeometry args={[0.16, 0.045, 12, 60]} />
          <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, -0.18, 0]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.4} />
        </mesh>
      </group>
    );
  }

  if (glyph === 'annotate') {
    return (
      <group position={[0, 0.02, 0.18]} rotation={[0, 0, -0.45]}>
        <mesh>
          <boxGeometry args={[0.28, 0.08, 0.08]} />
          <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0.16, 0, 0]}>
          <coneGeometry args={[0.05, 0.14, 8]} />
          <meshStandardMaterial color="#d1d5db" />
        </mesh>
      </group>
    );
  }

  if (glyph === 'modules') {
    return (
      <group position={[0, 0, 0.18]}>
        <mesh position={[0, 0.12, 0]}>
          <boxGeometry args={[0.28, 0.12, 0.08]} />
          <meshStandardMaterial color="#f8fafc" emissive={color} emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, -0.01, 0]}>
          <boxGeometry args={[0.28, 0.12, 0.08]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.28, 0.12, 0.08]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      </group>
    );
  }

  if (glyph === 'analytics') {
    return (
      <group position={[0, -0.02, 0.18]}>
        <mesh position={[-0.1, -0.05, 0]}>
          <boxGeometry args={[0.08, 0.14, 0.08]} />
          <meshStandardMaterial color="#e0f2fe" emissive={color} emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.08, 0.3, 0.08]} />
          <meshStandardMaterial color="#bae6fd" emissive={color} emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0.1, 0.11, 0]}>
          <boxGeometry args={[0.08, 0.46, 0.08]} />
          <meshStandardMaterial color="#7dd3fc" emissive={color} emissiveIntensity={0.4} />
        </mesh>
      </group>
    );
  }

  return (
    <mesh position={[0, 0, 0.18]} rotation={[Math.PI / 4, 0, 0]}>
      <octahedronGeometry args={[0.2, 0]} />
      <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={0.35} roughness={0.25} metalness={0.2} />
    </mesh>
  );
}

function FeatureHalo() {
  const haloRef = useRef<THREE.Group>(null);
  const nodeRefs = useRef<THREE.Group[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (haloRef.current) {
      haloRef.current.rotation.z = t * 0.12;
      haloRef.current.rotation.y = Math.sin(t * 0.23) * 0.18;
      haloRef.current.position.y = 0.58 + Math.sin(t * 0.35) * 0.06;
    }

    nodeRefs.current.forEach((node, i) => {
      if (!node) return;
      node.position.z = Math.sin(t * 1.3 + i * 0.85) * 0.18;
      const pulse = 1 + Math.sin(t * 2.1 + i * 0.7) * 0.05;
      node.scale.setScalar(pulse);
    });
  });

  return (
    <group ref={haloRef} position={[0, 0.58, 0.62]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.75, 0.03, 16, 120]} />
        <meshStandardMaterial color="#475569" emissive="#1e293b" emissiveIntensity={0.65} roughness={0.45} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.85, 0.02, 14, 96]} />
        <meshStandardMaterial color="#334155" emissive="#0f172a" emissiveIntensity={0.45} roughness={0.55} />
      </mesh>

      {haloFeatures.map((feature, i) => {
        const angle = (i / haloFeatures.length) * Math.PI * 2 - Math.PI / 2;
        const radiusX = 3.75;
        const radiusY = 2.15;
        const x = Math.cos(angle) * radiusX;
        const y = Math.sin(angle) * radiusY;

        return (
          <group
            key={feature.label}
            ref={(node: THREE.Group | null) => {
              if (node) nodeRefs.current[i] = node;
            }}
            position={[x, y, 0]}
          >
            <mesh>
              <cylinderGeometry args={[0.42, 0.42, 0.12, 28]} />
              <meshStandardMaterial color="#0f172a" roughness={0.22} metalness={0.5} emissive="#111827" emissiveIntensity={0.55} />
            </mesh>
            <mesh position={[0, 0, 0.07]}>
              <cylinderGeometry args={[0.33, 0.33, 0.05, 28]} />
              <meshStandardMaterial color={feature.color} emissive={feature.color} emissiveIntensity={0.9} roughness={0.35} metalness={0.2} />
            </mesh>
            <FeatureGlyph glyph={feature.glyph} color={feature.color} />
            <HaloLabel text={feature.label} color={feature.color} />
          </group>
        );
      })}
    </group>
  );
}

function CameraRig() {
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime();
    const x = Math.sin(t * 0.22) * 0.55;
    const y = 1.35 + Math.cos(t * 0.18) * 0.18;
    const z = 11.8 + Math.sin(t * 0.15) * 0.25;

    camera.position.lerp(new THREE.Vector3(x, y, z), 0.04);
    camera.lookAt(0, 0.45, 0);
  });

  return null;
}

function LearningConsole() {
  const panelRef = useRef<THREE.Group>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);
  const barsRef = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (panelRef.current) {
      panelRef.current.rotation.y = Math.sin(t * 0.28) * 0.1;
      panelRef.current.position.y = Math.sin(t * 0.55) * 0.08;
    }

    if (ringARef.current) {
      ringARef.current.rotation.z = t * 0.7;
    }

    if (ringBRef.current) {
      ringBRef.current.rotation.z = -t * 0.45;
    }

    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      const strength = 0.55 + Math.sin(t * 2.2 + i * 0.55) * 0.45;
      bar.scale.y = Math.max(0.25, strength);
      bar.position.y = -1.35 + (bar.scale.y * 0.45) / 2;
    });
  });

  return (
    <group ref={panelRef}>
      {/* Outer frame */}
      <mesh position={[0, 0.15, -0.35]}>
        <boxGeometry args={[8.8, 5.2, 0.45]} />
        <meshStandardMaterial color="#0b1220" metalness={0.75} roughness={0.2} />
      </mesh>

      {/* Main panel */}
      <mesh position={[0, 0.15, -0.1]}>
        <boxGeometry args={[8.3, 4.7, 0.15]} />
        <meshStandardMaterial
          color="#0f172a"
          roughness={0.2}
          metalness={0.5}
          emissive="#0b1020"
          emissiveIntensity={0.55}
        />
      </mesh>

      {/* Screen highlight */}
      <mesh position={[0, 0.28, 0.03]} rotation={[-0.06, 0, 0]}>
        <planeGeometry args={[7.5, 3.8]} />
        <meshStandardMaterial color="#1e293b" emissive="#111827" emissiveIntensity={0.9} roughness={0.12} metalness={0.3} />
      </mesh>

      {/* Center play core */}
      <group position={[0, 0.4, 0.15]}>
        <mesh>
          <sphereGeometry args={[0.78, 48, 48]} />
          <meshStandardMaterial color="#111827" metalness={0.75} roughness={0.15} emissive="#0f172a" emissiveIntensity={0.8} />
        </mesh>
        <mesh ref={ringARef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.15, 0.06, 24, 140]} />
          <meshStandardMaterial color={amber} emissive={orange} emissiveIntensity={1.1} metalness={0.4} roughness={0.25} />
        </mesh>
        <mesh ref={ringBRef} rotation={[Math.PI / 2, 0.45, 0]}>
          <torusGeometry args={[1.45, 0.04, 20, 120]} />
          <meshStandardMaterial color={blue} emissive={blue} emissiveIntensity={0.8} metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[0.12, 0, 0.78]}>
          <coneGeometry args={[0.35, 0.62, 3]} />
          <meshStandardMaterial color="#ffffff" emissive="#dbeafe" emissiveIntensity={0.55} roughness={0.15} metalness={0.1} />
        </mesh>
      </group>

      {/* Left audio/activity bars */}
      {Array.from({ length: 8 }).map((_, i) => {
        const x = -3.15 + i * 0.4;
        return (
          <mesh
            key={`bar-${i}`}
            ref={(node: THREE.Mesh | null) => {
              if (node) barsRef.current[i] = node;
            }}
            position={[x, -1.15, 0.12]}
          >
            <boxGeometry args={[0.22, 0.45, 0.12]} />
            <meshStandardMaterial color="#22c55e" emissive="#16a34a" emissiveIntensity={0.65} />
          </mesh>
        );
      })}

      {/* Right progress dots */}
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 3 }).map((__, col) => {
          const x = 2.3 + col * 0.55;
          const y = 1.35 - row * 0.55;
          const glow = (row + col) % 2 === 0 ? violet : blue;
          return (
            <mesh key={`dot-${row}-${col}`} position={[x, y, 0.14]}>
              <sphereGeometry args={[0.12, 24, 24]} />
              <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.9} />
            </mesh>
          );
        }),
      )}
    </group>
  );
}

function FloatingCards() {
  const cardsRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (!cardsRef.current) return;

    cardsRef.current.children.forEach((child, index) => {
      child.position.y = Math.sin(t * 0.8 + index * 0.9) * 0.15 + (index % 2 === 0 ? 0.9 : -0.9);
      child.rotation.y = Math.sin(t * 0.5 + index * 0.6) * 0.25;
      child.rotation.z = Math.cos(t * 0.35 + index * 0.8) * 0.08;
    });
  });

  return (
    <group ref={cardsRef}>
      <group position={[-4.9, 1.1, 1.1]}>
        <mesh>
          <boxGeometry args={[1.85, 1.2, 0.16]} />
          <meshStandardMaterial color="#111827" roughness={0.25} metalness={0.55} emissive="#1e293b" emissiveIntensity={0.55} />
        </mesh>
        <mesh position={[0, 0, 0.09]}>
          <planeGeometry args={[1.5, 0.8]} />
          <meshStandardMaterial color="#f59e0b" emissive="#f97316" emissiveIntensity={0.75} roughness={0.25} />
        </mesh>
      </group>

      <group position={[5.1, -0.8, 1.35]}>
        <mesh>
          <boxGeometry args={[2.05, 1.3, 0.16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.25} metalness={0.5} emissive="#172554" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0, 0.25, 0.09]}>
          <boxGeometry args={[1.4, 0.16, 0.02]} />
          <meshStandardMaterial color="#e2e8f0" emissive="#cbd5e1" emissiveIntensity={0.2} />
        </mesh>
        <mesh position={[0, -0.05, 0.09]}>
          <boxGeometry args={[1.1, 0.13, 0.02]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
        <mesh position={[0, -0.3, 0.09]}>
          <boxGeometry args={[0.85, 0.13, 0.02]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      </group>
    </group>
  );
}

function EnergyParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 260;

  const positions = useMemo(() => {
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      array[i * 3] = (Math.random() - 0.5) * 16;
      array[i * 3 + 1] = (Math.random() - 0.5) * 8;
      array[i * 3 + 2] = (Math.random() - 0.5) * 9 - 2.5;
    }
    return array;
  }, [count]);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    pointsRef.current.rotation.y = t * 0.045;
    pointsRef.current.rotation.x = Math.sin(t * 0.14) * 0.07;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#fbbf24" size={0.06} transparent opacity={0.65} sizeAttenuation />
    </points>
  );
}

function AcademyScene() {
  return (
    <>
      <color attach="background" args={['#05070f']} />
      <fog attach="fog" args={['#05070f', 8, 24]} />

      <ambientLight intensity={0.35} color="#1e293b" />
      <directionalLight position={[6, 8, 7]} intensity={1.45} color="#fff1e0" />
      <pointLight position={[-5, 3, 3]} intensity={2.4} color={amber} />
      <pointLight position={[5, -1, 2]} intensity={1.8} color={blue} />
      <spotLight position={[0, 7, 8]} intensity={2.1} angle={0.35} penumbra={0.8} color="#f8fafc" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.25, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#070b16" metalness={0.35} roughness={0.55} />
      </mesh>

      <LearningConsole />
      <FeatureHalo />
      <FloatingCards />
      <EnergyParticles />
      <CameraRig />
    </>
  );
}

export default function AcademyLogo3D({ width = 600, height = 400 }: AcademyLogo3DProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: '18px',
        overflow: 'hidden',
        boxShadow: '0 30px 90px rgba(15, 23, 42, 0.8), 0 0 110px rgba(245, 158, 11, 0.25)',
      }}
    >
      <Canvas
        camera={{ position: [0, 1.4, 12], fov: 33, near: 0.1, far: 120 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        dpr={[1, 1.75]}
      >
        <Suspense fallback={null}>
          <AcademyScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
