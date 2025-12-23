/**
 * CreatorHub Academy 3D Logo - 60 Second Creator Journey
 * Built with React Three Fiber
 */

import React, { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AcademyLogo3DProps {
  width?: number;
  height?: number;
}

// === COLORS ===
const skinColor = '#e0b090';
const darkColor = '#1a1a1a';
const amberColor = '#f59e0b';
const redDressColor = '#c41e3a';
const greenScreenColor = '#00b140';

// === PHOTO STUDIO ===
function PhotoStudio() {
  const modelRef = useRef<THREE.Group>(null);
  const flashRef = useRef<THREE.PointLight>(null);
  const lastFlash = useRef(0);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (modelRef.current) {
      modelRef.current.rotation.y = Math.sin(t * 0.5) * 0.15;
    }
    if (flashRef.current) {
      if (t - lastFlash.current > 0.8) {
        flashRef.current.intensity = 40;
        lastFlash.current = t;
      }
      flashRef.current.intensity *= 0.85;
    }
  });

  return (
    <group position={[-35, 0, 0]}>
      {/* Cyclorama */}
      <mesh position={[0, 2, -6]}>
        <boxGeometry args={[18, 14, 0.3]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.9} />
      </mesh>

      {/* Fashion Model */}
      <group ref={modelRef} position={[0, 3, 0]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.35, 0.3, 1.4, 16]} />
          <meshStandardMaterial color={redDressColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.7, 0]} rotation={[Math.PI, 0, 0]} castShadow>
          <coneGeometry args={[1, 2, 24, 1, true]} />
          <meshStandardMaterial color={redDressColor} roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <sphereGeometry args={[0.34, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={darkColor} roughness={0.55} />
        </mesh>
      </group>

      {/* Photographer */}
      <group position={[0, -2, 8]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.7, 0]}>
          <capsuleGeometry args={[0.4, 1.3, 8, 16]} />
          <meshStandardMaterial color={darkColor} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.28, 32, 32]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.4, 0.5]} castShadow>
          <boxGeometry args={[0.5, 0.35, 0.35]} />
          <meshStandardMaterial color={darkColor} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.4, 0.9]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.4, 32]} />
          <meshStandardMaterial color={darkColor} metalness={0.8} roughness={0.2} />
        </mesh>
      </group>

      {/* Softboxes */}
      <Softbox position={[-5, 5, 3]} rotation={[0.3, 0.4, 0]} />
      <Softbox position={[5, 5, 3]} rotation={[0.3, -0.4, 0]} />

      {/* Lights */}
      <spotLight position={[0, 10, 5]} angle={Math.PI / 5} penumbra={0.7} intensity={8} castShadow color="#fff0e8" />
      <pointLight ref={flashRef} position={[0, 4, 8]} intensity={0} color="#ffffff" />
    </group>
  );
}

function Softbox({ position, rotation }: { position: [number, number, number]; rotation: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <circleGeometry args={[1.2, 8]} />
        <meshBasicMaterial color="#fff8f0" transparent opacity={0.9} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -3, -0.3]} rotation={[0.1, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 5, 8]} />
        <meshStandardMaterial color={darkColor} metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// === VIDEO PRODUCTION ===
function VideoStudio() {
  const presenterRef = useRef<THREE.Group>(null);
  const tallyRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (presenterRef.current) {
      presenterRef.current.rotation.y = Math.sin(t * 0.4) * 0.1;
    }
    if (tallyRef.current) {
      (tallyRef.current.material as THREE.MeshBasicMaterial).opacity = Math.sin(t * 4) > 0 ? 1 : 0.2;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Green Screen */}
      <mesh position={[0, 1, -5]}>
        <boxGeometry args={[16, 12, 0.3]} />
        <meshStandardMaterial color={greenScreenColor} roughness={0.8} />
      </mesh>

      {/* Presenter */}
      <group ref={presenterRef} position={[0, 3, 0]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <capsuleGeometry args={[0.4, 1.4, 8, 16]} />
          <meshStandardMaterial color="#2563eb" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.75, 0]}>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
      </group>

      {/* Cinema Camera */}
      <group position={[0, 1, 10]} rotation={[0, Math.PI, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.8, 0.5, 0.6]} />
          <meshStandardMaterial color={darkColor} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.55]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.2, 0.5, 32]} />
          <meshStandardMaterial color={darkColor} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh ref={tallyRef} position={[-0.35, 0.2, 0.31]}>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshBasicMaterial color="#ff0000" transparent />
        </mesh>
      </group>

      <spotLight position={[-4, 8, 6]} angle={Math.PI / 5} penumbra={0.6} intensity={6} castShadow color="#fff8f0" />
    </group>
  );
}

// === MUSIC PRODUCTION ===
function MusicStudio() {
  const fadersRef = useRef<THREE.Mesh[]>([]);
  const metersRef = useRef<THREE.Mesh[][]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    fadersRef.current.forEach((fader, i) => {
      if (fader) {
        const wave = Math.sin(t * 3 + i * 0.35) * 0.3;
        fader.position.z = 0.7 + wave;
      }
    });
    metersRef.current.forEach((chMeters, ch) => {
      const level = 3 + Math.floor(Math.sin(t * 3.5 + ch * 0.4) * 3.5);
      chMeters?.forEach((led, m) => {
        if (led) {
          (led.material as THREE.MeshBasicMaterial).opacity = m < level ? 0.85 : 0.12;
        }
      });
    });
  });

  return (
    <group position={[35, 0, 0]}>
      {/* Acoustic Panels */}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[-5 + i * 2.5, 3.5, -5]}>
          <boxGeometry args={[2.5, 3.5, 0.4]} />
          <meshStandardMaterial color="#2d2d2d" roughness={0.9} />
        </mesh>
      ))}

      {/* Mixing Console */}
      <group position={[0, -2, 2]}>
        <mesh castShadow>
          <boxGeometry args={[10, 0.7, 4]} />
          <meshStandardMaterial color={darkColor} metalness={0.4} roughness={0.3} />
        </mesh>

        {/* Faders */}
        {Array.from({ length: 16 }).map((_, i) => {
          const x = -3.5 + i * 0.45;
          return (
            <mesh
              key={i}
              ref={(el) => { if (el) fadersRef.current[i] = el; }}
              position={[x, 0.42, 0.7]}
            >
              <boxGeometry args={[0.12, 0.08, 0.25]} />
              <meshStandardMaterial color="#3b82f6" emissive="#1e40af" emissiveIntensity={0.2} />
            </mesh>
          );
        })}

        {/* Master Fader */}
        <mesh position={[4, 0.45, 0.7]}>
          <boxGeometry args={[0.2, 0.12, 0.4]} />
          <meshStandardMaterial color={amberColor} emissive="#f97316" emissiveIntensity={0.8} />
        </mesh>
      </group>

      {/* Producer */}
      <group position={[0, 1, 5]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 0.7, 0]}>
          <capsuleGeometry args={[0.4, 1.3, 8, 16]} />
          <meshStandardMaterial color={darkColor} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <sphereGeometry args={[0.28, 32, 32]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
      </group>

      <spotLight position={[0, 10, 4]} angle={Math.PI / 6} penumbra={0.6} intensity={5} castShadow color={amberColor} />
      <pointLight position={[-5, 3, 0]} intensity={2} color="#a855f7" />
    </group>
  );
}

// === PODCAST STUDIO ===
function PodcastStudio() {
  return (
    <group position={[70, 0, 0]}>
      {/* Acoustic Foam Wall */}
      {Array.from({ length: 4 }).map((_, row) =>
        Array.from({ length: 8 }).map((_, col) => (
          <mesh key={`${row}-${col}`} position={[-4.8 + col * 1.4, 1.5 + row * 1.4, -4]}>
            <boxGeometry args={[1.2, 1.2, 0.6]} />
            <meshStandardMaterial color={darkColor} roughness={0.95} />
          </mesh>
        ))
      )}

      {/* Desk */}
      <mesh position={[0, -1.5, 1]} castShadow>
        <boxGeometry args={[6, 0.15, 2]} />
        <meshStandardMaterial color="#8b4513" roughness={0.7} />
      </mesh>

      {/* Hosts */}
      <Host position={[-1.5, 1, 2.5]} color="#4f46e5" />
      <Host position={[1.5, 1, 2.5]} color="#059669" />

      <spotLight position={[0, 8, 6]} angle={Math.PI / 5} penumbra={0.7} intensity={5} castShadow color="#fff0e8" />
    </group>
  );
}

function Host({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.6, 0]}>
        <capsuleGeometry args={[0.35, 1.2, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.26, 32, 32]} />
        <meshStandardMaterial color={skinColor} roughness={0.5} />
      </mesh>
    </group>
  );
}

// === ONLINE COURSE STUDIO ===
function CourseStudio() {
  return (
    <group position={[105, 0, 0]}>
      {/* Backdrop */}
      <mesh position={[0, 2, -4]}>
        <boxGeometry args={[14, 10, 0.3]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>

      {/* Instructor */}
      <group position={[-2, 3, 0]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <capsuleGeometry args={[0.4, 1.4, 8, 16]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.75, 0]}>
          <sphereGeometry args={[0.3, 32, 32]} />
          <meshStandardMaterial color={skinColor} roughness={0.5} />
        </mesh>
      </group>

      {/* Whiteboard */}
      <group position={[2, 3.5, -2]}>
        <mesh>
          <boxGeometry args={[5, 3, 0.15]} />
          <meshStandardMaterial color={darkColor} metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0, 0.09]}>
          <boxGeometry args={[4.7, 2.7, 0.02]} />
          <meshStandardMaterial color="#f5f5f5" roughness={0.3} />
        </mesh>
      </group>

      {/* Ring Light */}
      <mesh position={[0, 4, 6]}>
        <torusGeometry args={[0.8, 0.08, 16, 48]} />
        <meshBasicMaterial color="#fff8f0" />
      </mesh>

      <spotLight position={[-3, 10, 5]} angle={Math.PI / 5} penumbra={0.6} intensity={6} castShadow color="#ffffff" />
    </group>
  );
}

// === CREATORHUB CORE ===
function CreatorHubCore() {
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.1;
      coreRef.current.rotation.x = Math.sin(t * 0.15) * 0.08;
      coreRef.current.scale.setScalar(1 + Math.sin(t * 1.2) * 0.05);
    }
    if (shellRef.current) {
      shellRef.current.rotation.y = -t * 0.08;
    }
  });

  return (
    <group position={[140, 3, 0]}>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[2, 4]} />
        <meshStandardMaterial color={amberColor} emissive="#f97316" emissiveIntensity={1.5} />
      </mesh>
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[3, 2]} />
        <meshBasicMaterial color={amberColor} transparent opacity={0.12} wireframe />
      </mesh>
    </group>
  );
}

// === PARTICLES ===
function Particles() {
  const count = 400;
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 200 + 70;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.008;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.08} color={amberColor} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

// === CAMERA CONTROLLER ===
function CameraController() {
  const cameraPath = useMemo(() => [
    { pos: [-35, 5, 25], look: [-35, 2, 0], time: 0 },
    { pos: [-30, 4, 10], look: [-35, 3, 0], time: 8 },
    { pos: [-5, 4, 15], look: [0, 3, 0], time: 14 },
    { pos: [5, 3, 12], look: [0, 2, 0], time: 20 },
    { pos: [30, 4, 14], look: [35, -1, 2], time: 28 },
    { pos: [40, 2, 10], look: [35, -2, 2], time: 34 },
    { pos: [65, 4, 14], look: [70, 0, 1], time: 42 },
    { pos: [75, 3, 10], look: [70, 0, 1], time: 48 },
    { pos: [100, 4, 14], look: [105, 3, 0], time: 52 },
    { pos: [130, 5, 18], look: [140, 3, 0], time: 56 },
    { pos: [140, 5, 25], look: [140, 3, 0], time: 60 },
  ], []);

  useFrame(({ clock, camera }) => {
    const duration = 60;
    const loopTime = clock.getElapsedTime() % duration;

    let kfIdx = 0;
    for (let i = 0; i < cameraPath.length - 1; i++) {
      if (loopTime >= cameraPath[i].time && loopTime < cameraPath[i + 1].time) {
        kfIdx = i;
        break;
      }
    }
    if (loopTime >= cameraPath[cameraPath.length - 1].time) kfIdx = cameraPath.length - 2;

    const kf1 = cameraPath[kfIdx];
    const kf2 = cameraPath[kfIdx + 1];
    const segDur = kf2.time - kf1.time;
    const t = segDur > 0 ? (loopTime - kf1.time) / segDur : 0;
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    camera.position.set(
      kf1.pos[0] + (kf2.pos[0] - kf1.pos[0]) * eased,
      kf1.pos[1] + (kf2.pos[1] - kf1.pos[1]) * eased,
      kf1.pos[2] + (kf2.pos[2] - kf1.pos[2]) * eased
    );
    camera.lookAt(
      kf1.look[0] + (kf2.look[0] - kf1.look[0]) * eased,
      kf1.look[1] + (kf2.look[1] - kf1.look[1]) * eased,
      kf1.look[2] + (kf2.look[2] - kf1.look[2]) * eased
    );
  });

  return null;
}

// === MAIN COMPONENT ===
export default function AcademyLogo3D({ width = 600, height = 400 }: AcademyLogo3DProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 0 80px rgba(245, 158, 11, 0.25), 0 0 100px rgba(168, 85, 247, 0.12)',
      }}
    >
      <Canvas
        shadows
        camera={{ fov: 35, near: 0.1, far: 500, position: [-35, 5, 25] }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
      >
        <Suspense fallback={null}>
          <CameraController />
          
          <fog attach="fog" args={['#080812', 10, 150]} />
          <color attach="background" args={['#080812']} />

          {/* Lighting */}
          <ambientLight intensity={0.15} color="#1a1a2e" />
          <directionalLight
            position={[-20, 25, 15]}
            intensity={1.5}
            color="#ffeedd"
            castShadow
          />

          {/* Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]} receiveShadow>
            <planeGeometry args={[200, 200]} />
            <meshStandardMaterial color="#0a0a0a" metalness={0.3} roughness={0.4} />
          </mesh>

          {/* Scenarios */}
          <PhotoStudio />
          <VideoStudio />
          <MusicStudio />
          <PodcastStudio />
          <CourseStudio />
          <CreatorHubCore />

          {/* Particles */}
          <Particles />
        </Suspense>
      </Canvas>
    </div>
  );
}












