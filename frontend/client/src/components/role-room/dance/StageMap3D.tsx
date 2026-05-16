/**
 * StageMap3D — Three.js-basert 3D-stage for DanceFlow-paritet.
 *
 * Bygd på @react-three/fiber + drei. Stage er en 12×8m flate (matcher
 * default proscenium-dimensjoner) sentrert ved (0,0,0). Dansere er
 * fargede sylindere på X/Z-planet, med kamera i isometrisk perspektiv
 * og OrbitControls aktivert.
 *
 * Klikk på en danser → onDancerSelect.
 * Drag-and-drop er bevisst utelatt fra V1; brukere kan redigere
 * posisjoner i 2D-modusen. 3D er primært visualisering + perspektiv-
 * inspeksjon.
 */

import React, { Suspense } from 'react';
import { Box } from '@mui/material';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Text } from '@react-three/drei';
import type { Dancer, Formation } from './formationTypes';

const STAGE_WIDTH_M = 12;
const STAGE_DEPTH_M = 8;
const PUCK_HEIGHT_M = 1.7;     // Avatar-høyde (representativ)
const PUCK_RADIUS_M = 0.35;

export interface StageMap3DProps {
  formation: Formation;
  dancers: readonly Dancer[];
  hiddenDancerIds?: ReadonlySet<string>;
  showIds?: boolean;
  onDancerSelect?: (dancerId: string) => void;
}

interface DancerProps3D {
  dancer: Dancer;
  x: number; // normalisert 0..1
  y: number; // normalisert 0..1 (mapped to z)
  facing?: number;
  isLead?: boolean;
  showId: boolean;
  onSelect: () => void;
}

const Dancer3D: React.FC<DancerProps3D> = ({ dancer, x, y, facing = 0, isLead, showId, onSelect }) => {
  // Map normaliserte koordinater til world-space.
  // x ∈ [0,1] → world-X ∈ [-W/2, +W/2]
  // y ∈ [0,1] → world-Z ∈ [-D/2, +D/2]
  const worldX = (x - 0.5) * STAGE_WIDTH_M;
  const worldZ = (y - 0.5) * STAGE_DEPTH_M;
  const color = dancer.color ?? '#a78bfa';
  return (
    <group
      position={[worldX, PUCK_HEIGHT_M / 2, worldZ]}
      rotation={[0, ((-facing) * Math.PI) / 180, 0]}
      onClick={(e: { stopPropagation: () => void }) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Body: cylinder for "kropp" */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[PUCK_RADIUS_M, PUCK_RADIUS_M, PUCK_HEIGHT_M, 24]} />
        <meshStandardMaterial
          color={color}
          roughness={0.55}
          metalness={0.15}
          emissive={isLead ? '#fbbf24' : color}
          emissiveIntensity={isLead ? 0.25 : 0.04}
        />
      </mesh>
      {/* Head: liten sphere oppå */}
      <mesh position={[0, PUCK_HEIGHT_M / 2 + 0.22, 0]} castShadow>
        <sphereGeometry args={[0.18, 18, 18]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Facing indicator: liten kjegle foran */}
      <mesh position={[0, PUCK_HEIGHT_M / 2 - 0.1, -PUCK_RADIUS_M - 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.2, 12]} />
        <meshBasicMaterial color="#ffffff" opacity={0.6} transparent />
      </mesh>
      {/* Initialer over hodet */}
      <Text
        position={[0, PUCK_HEIGHT_M / 2 + 0.6, 0]}
        fontSize={0.32}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {dancer.initials || dancer.name.slice(0, 2).toUpperCase()}
      </Text>
      {/* Dancer-id om Show IDs er på */}
      {showId ? (
        <Text
          position={[0, PUCK_HEIGHT_M / 2 + 1.05, 0]}
          fontSize={0.18}
          color="rgba(255,255,255,0.65)"
          anchorX="center"
          anchorY="middle"
        >
          {dancer.id}
        </Text>
      ) : null}
    </group>
  );
};

const StageFloor: React.FC = () => (
  <>
    {/* Gulv */}
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[STAGE_WIDTH_M, STAGE_DEPTH_M]} />
      <meshStandardMaterial color="#0d0f14" roughness={0.85} />
    </mesh>
    {/* Grid */}
    <Grid
      args={[STAGE_WIDTH_M, STAGE_DEPTH_M]}
      cellSize={1}
      cellThickness={0.5}
      cellColor="rgba(167,139,250,0.18)"
      sectionSize={4}
      sectionThickness={1}
      sectionColor="rgba(167,139,250,0.4)"
      position={[0, 0.001, 0]}
      infiniteGrid={false}
    />
    {/* Upstage / Downstage / Left / Right markører */}
    <Text position={[0, 0.05, -STAGE_DEPTH_M / 2 - 0.4]} fontSize={0.32} color="#a78bfa" anchorX="center">
      UPSTAGE
    </Text>
    <Text position={[0, 0.05, STAGE_DEPTH_M / 2 + 0.4]} fontSize={0.32} color="#a78bfa" anchorX="center">
      DOWNSTAGE
    </Text>
    <Text
      position={[-STAGE_WIDTH_M / 2 - 0.6, 0.05, 0]}
      fontSize={0.28}
      color="#a78bfa"
      rotation={[0, Math.PI / 2, 0]}
    >
      LEFT
    </Text>
    <Text
      position={[STAGE_WIDTH_M / 2 + 0.6, 0.05, 0]}
      fontSize={0.28}
      color="#a78bfa"
      rotation={[0, -Math.PI / 2, 0]}
    >
      RIGHT
    </Text>
  </>
);

export function StageMap3D({
  formation,
  dancers,
  hiddenDancerIds,
  showIds = false,
  onDancerSelect,
}: StageMap3DProps): React.ReactElement {
  const dancersById = React.useMemo(
    () => new Map(dancers.map((d) => [d.id, d])),
    [dancers],
  );
  const visiblePositions = formation.positions.filter(
    (p) => !hiddenDancerIds?.has(p.dancerId),
  );
  return (
    <Box
      data-testid="formation-stage-3d"
      sx={{
        width: '100%',
        height: '100%',
        minHeight: { xs: 240, sm: 320, md: 360 },
        bgcolor: '#050608',
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <Canvas
        shadows
        camera={{ position: [8, 9, 12], fov: 35 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#050608']} />
        <ambientLight intensity={0.42} />
        <directionalLight
          position={[6, 10, 6]}
          intensity={0.85}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={0.5}
          shadow-camera-far={40}
          shadow-camera-left={-10}
          shadow-camera-right={10}
          shadow-camera-top={10}
          shadow-camera-bottom={-10}
        />
        <pointLight position={[-4, 5, -4]} intensity={0.25} color="#8b5cf6" />
        <Suspense fallback={null}>
          <StageFloor />
          {visiblePositions.map((p) => {
            const dancer = dancersById.get(p.dancerId);
            if (!dancer) return null;
            return (
              <Dancer3D
                key={p.dancerId}
                dancer={dancer}
                x={p.x}
                y={p.y}
                facing={p.facing}
                isLead={p.isLead}
                showId={showIds}
                onSelect={() => onDancerSelect?.(p.dancerId)}
              />
            );
          })}
        </Suspense>
        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          maxPolarAngle={Math.PI / 2.2}
          minDistance={5}
          maxDistance={28}
          target={[0, 0.5, 0]}
        />
      </Canvas>
    </Box>
  );
}

export default StageMap3D;
