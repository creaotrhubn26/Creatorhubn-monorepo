/**
 * Studio Guides Overlay
 * 
 * Visual helping guides with indicators for:
 * - Distance measurements (subject to background, light to subject)
 * - Light angle guides
 * - Subject positioning markers
 * - Rule of thirds grid
 * - Camera framing guides
 */

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html, Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { EyeSystem, useEyeMovement, CatchlightPreview, EYE_COLORS, LightSourceData, useLightSourcesFromNodes } from './EyeSystem';
import { useNodes } from '../../state/selectors';
import { 
  BodyAnimationController, 
  BODY_ANIMATION_PRESETS,
  HEAD_PRESETS,
  HAND_PRESETS,
  FULL_BODY_POSES,
  HandGesture,
} from '../../core/animations/BodyAnimations';

interface StudioGuidesProps {
  showDistanceGuides?: boolean;
  showAngleGuides?: boolean;
  showPositionMarkers?: boolean;
  showGridOverlay?: boolean;
  subjectPosition?: [number, number, number];
  backgroundDistance?: number;
  keyLightPosition?: [number, number, number];
  fillPosition?: [number, number, number];
  cameraPosition?: [number, number, number];
  // Light sources can be passed directly or extracted from scene
  lightSources?: LightSourceData[];
}

// Distance indicator line with measurement label
const DistanceIndicator: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  label: string;
  color?: string;
  showArrows?: boolean;
}> = ({ start, end, label, color = '#00ff88', showArrows = true }) => {
  const distance = useMemo(() => {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const dz = end[2] - start[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, [start, end]);

  const midpoint: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2 + 0.3,
    (start[2] + end[2]) / 2,
  ];

  return (
    <group>
      {/* Main line */}
      <Line
        points={[start, end]}
        color={color}
        lineWidth={2}
        dashed
        dashSize={0.1}
        dashScale={10}
      />
      
      {/* Start marker */}
      <mesh position={start}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* End marker */}
      <mesh position={end}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* Distance label */}
      <Html position={midpoint} center>
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          color: color,
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          border: `1px solid ${color}`}}>
          {label}: {distance.toFixed(2)}m
        </div>
      </Html>
    </group>
  );
};

// Angle indicator arc
const AngleIndicator: React.FC<{
  center: [number, number, number];
  angle: number;
  radius?: number;
  color?: string;
  label: string;
}> = ({ center, angle, radius = 1, color = '#ffaa00', label }) => {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const segments = 20;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * (angle * Math.PI / 180);
      pts.push([
        center[0] + Math.sin(a) * radius,
        center[1],
        center[2] + Math.cos(a) * radius,
      ]);
    }
    return pts;
  }, [center, angle, radius]);

  const labelPos: [number, number, number] = [
    center[0] + Math.sin((angle / 2) * Math.PI / 180) * (radius + 0.3),
    center[1] + 0.2,
    center[2] + Math.cos((angle / 2) * Math.PI / 180) * (radius + 0.3),
  ];

  return (
    <group>
      <Line points={points} color={color} lineWidth={3} />
      <Html position={labelPos} center>
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          color: color,
          padding: '3px 6px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold'}}>
          {label}: {angle}
        </div>
      </Html>
    </group>
  );
};

// Position marker with label
const PositionMarker: React.FC<{
  position: [number, number, number];
  label: string;
  color?: string;
  size?: number;
}> = ({ position, label, color = '#ff4488', size = 0.3 }) => {
  return (
    <group position={position}>
      {/* X marker */}
      <Line
        points={[[-size/2, 0, -size/2], [size/2, 0, size/2]]}
        color={color}
        lineWidth={3}
      />
      <Line
        points={[[-size/2, 0, size/2], [size/2, 0, -size/2]]}
        color={color}
        lineWidth={3}
      />
      
      {/* Vertical indicator */}
      <Line
        points={[[0, 0, 0], [0, 0.5, 0]]}
        color={color}
        lineWidth={2}
        dashed
      />
      
      {/* Label */}
      <Html position={[0, 0.7, 0]} center>
        <div style={{
          background: color,
          color: 'white',
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'}}>
          {label}
        </div>
      </Html>
    </group>
  );
};

// Floor grid with measurements
const FloorGrid: React.FC<{
  size?: number;
  divisions?: number;
  showMeasurements?: boolean;
}> = ({ size = 10, divisions = 10, showMeasurements = true }) => {
  const lines = useMemo(() => {
    const result: [number, number, number][][] = [];
    const step = size / divisions;
    const half = size / 2;

    for (let i = 0; i <= divisions; i++) {
      const pos = -half + i * step;
      // X-axis lines
      result.push([[-half, 0, pos], [half, 0, pos]]);
      // Z-axis lines
      result.push([[pos, 0, -half], [pos, 0, half]]);
    }
    return result;
  }, [size, divisions]);

  return (
    <group>
      {lines.map((points, i) => (
        <Line
          key={i}
          points={points}
          color={i % 5 === divisions / 2 ? '#666' : '#333'}
          lineWidth={i % 5 === divisions / 2 ? 2 : 1}
        />
      ))}
      
      {showMeasurements && (
        <>
          {/* Measurement labels every meter */}
          {[-4, -3, -2, -1, 1, 2, 3, 4].map((m) => (
            <Html key={m} position={[m, 0.01, size / 2 + 0.3]} center>
              <div style={{
                color: '#888',
                fontSize: '10px'}}>
                {m}m
              </div>
            </Html>
          ))}
        </>
      )}
    </group>
  );
};

// Light placement guide circle
const LightPlacementGuide: React.FC<{
  center: [number, number, number];
  radius: number;
  height?: number;
  label: string;
  color?: string;
  recommended?: boolean;
}> = ({ center, radius, height = 0, label, color = '#4488ff', recommended = false }) => {
  const points = useMemo(() => {
    const pts: [number, number, number][] = [];
    const segments = 64;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push([
        center[0] + Math.cos(angle) * radius,
        height,
        center[2] + Math.sin(angle) * radius,
      ]);
    }
    return pts;
  }, [center, radius, height]);

  return (
    <group>
      <Line
        points={points}
        color={color}
        lineWidth={recommended ? 3 : 2}
        dashed={!recommended}
        dashSize={recommended ? 0 : 0.15}
      />
      <Html position={[center[0] + radius + 0.2, height + 0.1, center[2]]} center>
        <div style={{
          background: recommended ? color : 'rgba(0,0,0,0.7)',
          color: recommended ? 'white' : color,
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: recommended ? 'bold' : 'normal',
          border: `1px solid ${color}`}}>
          {label}
        </div>
      </Html>
    </group>
  );
};

// Height guide vertical line
const HeightGuide: React.FC<{
  position: [number, number, number];
  heights: { value: number; label: string; color?: string }[];
}> = ({ position, heights }) => {
  const maxHeight = Math.max(...heights.map(h => h.value));
  
  return (
    <group position={position}>
      {/* Vertical line */}
      <Line
        points={[[0, 0, 0], [0, maxHeight + 0.5, 0]]}
        color="#666"
        lineWidth={1}
        dashed
      />
      
      {/* Height markers */}
      {heights.map((h, i) => (
        <group key={i} position={[0, h.value, 0]}>
          <Line
            points={[[-0.1, 0, 0], [0.1, 0, 0]]}
            color={h.color || '#ffaa00'}
            lineWidth={2}
          />
          <Html position={[0.3, 0, 0]}>
            <div style={{
              background: 'rgba(0,0,0,0.8)',
              color: h.color || '#ffaa00',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              whiteSpace: 'nowrap'}}>
              {h.label}: {h.value}m
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

// Subject silhouette - Detailed human figure wireframe with eyes, catchlights, and body animations
const SubjectSilhouette: React.FC<{
  position: [number, number, number];
  height?: number;
  type?: 'standing' | 'sitting' | 'headshot';
  showMeasurements?: boolean;
  showEyes?: boolean;
  eyeColor?: string;
  gazeTarget?: [number, number, number];
  lightSources?: LightSourceData[]; // Full light source data for accurate catchlights
  // Legacy props
  lightPositions?: Array<[number, number, number]>;
  lightColors?: string[];
  // Body animation props
  enableBodyAnimation?: boolean;
  headPreset?: keyof typeof HEAD_PRESETS;
  handPreset?: keyof typeof HAND_PRESETS;
  gesture?: HandGesture;
  fullBodyPose?: keyof typeof FULL_BODY_POSES;
  animationPreset?: keyof typeof BODY_ANIMATION_PRESETS;
}> = ({ 
  position, 
  height = 1.7, 
  type = 'standing', 
  showMeasurements = true,
  showEyes = true,
  eyeColor = EYE_COLORS.brown,
  gazeTarget,
  lightSources,
  lightPositions = [],
  lightColors = [],
  enableBodyAnimation = false,
  headPreset,
  handPreset,
  gesture,
  fullBodyPose,
  animationPreset = 'portrait',
}) => {
  // Eye movement hook for auto-blink
  const eyeMovement = useEyeMovement({ autoLook: false, blinkInterval: 4000 });
  
  // Body animation controller
  const bodyControllerRef = useRef<BodyAnimationController | null>(null);
  const [bodyState, setBodyState] = useState<{
    headRotation: THREE.Euler;
    leftHandPos: THREE.Vector3;
    rightHandPos: THREE.Vector3;
    leftArmRotation: THREE.Euler;
    rightArmRotation: THREE.Euler;
    leftElbowAngle: number;
    rightElbowAngle: number;
  }>({
    headRotation: new THREE.Euler(),
    leftHandPos: new THREE.Vector3(-0.25, 0.5, 0.05),
    rightHandPos: new THREE.Vector3(0.25, 0.5, 0.05),
    leftArmRotation: new THREE.Euler(),
    rightArmRotation: new THREE.Euler(),
    leftElbowAngle: 0.15,
    rightElbowAngle: 0.15,
  });
  
  // Initialize body animation controller
  useEffect(() => {
    if (enableBodyAnimation) {
      bodyControllerRef.current = new BodyAnimationController(BODY_ANIMATION_PRESETS[animationPreset]);
      
      // Apply initial poses
      if (fullBodyPose && FULL_BODY_POSES[fullBodyPose]) {
        const pose = FULL_BODY_POSES[fullBodyPose];
        bodyControllerRef.current.setHeadPreset(pose.head as keyof typeof HEAD_PRESETS);
        bodyControllerRef.current.setHandPreset(pose.hands as keyof typeof HAND_PRESETS);
        bodyControllerRef.current.setGesture('both', pose.gesture);
      } else {
        if (headPreset) bodyControllerRef.current.setHeadPreset(headPreset);
        if (handPreset) bodyControllerRef.current.setHandPreset(handPreset);
        if (gesture) bodyControllerRef.current.setGesture('both', gesture);
      }
    }
    return () => { bodyControllerRef.current = null; };
  }, [enableBodyAnimation, animationPreset, fullBodyPose, headPreset, handPreset, gesture]);
  
  // Update body animation each frame
  useFrame((state, delta) => {
    if (!enableBodyAnimation || !bodyControllerRef.current) return;
    
    // Update animation
    const newState = bodyControllerRef.current.update(delta, state.clock.elapsedTime);
    
    // Extract values for rendering
    setBodyState({
      headRotation: newState.head.rotation.clone(),
      leftHandPos: newState.leftHand.position.clone(),
      rightHandPos: newState.rightHand.position.clone(),
      leftArmRotation: newState.leftArm.shoulderRotation.clone(),
      rightArmRotation: newState.rightArm.shoulderRotation.clone(),
      leftElbowAngle: newState.leftArm.elbowAngle,
      rightElbowAngle: newState.rightArm.elbowAngle,
    });
  });
  
  // Proportions based on type
  const actualHeight = type === 'sitting' ? 1.2 : type === 'headshot' ? 0.5 : height;
  const headRadius = height / 16; // Head is ~1/8 of height, radius is half
  const headY = type === 'headshot' ? 0.25 : type === 'sitting' ? 1.05 : height - headRadius;
  const shoulderWidth = height * 0.23;
  const hipWidth = height * 0.15;
  const torsoTop = headY - headRadius - 0.03;
  const torsoBottom = type === 'sitting' ? 0.5 : height * 0.52;
  const armLength = height * 0.35;
  const legLength = type === 'sitting' ? 0 : height * 0.47;
  
  // Eye level calculation
  const eyeLevel = headY - headRadius * 0.2;
  
  const wireColor = '#555';
  const accentColor = '#00ff88';
  
  return (
    <group position={position}>
      {/* Head with animated rotation */}
      <group 
        position={[0, headY, 0]} 
        rotation={enableBodyAnimation ? [bodyState.headRotation.x, bodyState.headRotation.y, bodyState.headRotation.z] : [0, 0, 0]}
      >
        <mesh>
          <sphereGeometry args={[headRadius, 12, 8]} />
          <meshBasicMaterial color={wireColor} transparent opacity={0.6} wireframe />
        </mesh>
        
        {/* Face direction indicator (nose) - inside head group so it rotates with head */}
        <mesh position={[0, -headRadius * 0.3, headRadius * 0.9]}>
          <coneGeometry args={[headRadius * 0.15, headRadius * 0.3, 6]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.8} />
        </mesh>
      </group>
      
      {/* Eyes with catchlights - controlled by light sources */}
      {showEyes && (
        <group rotation={enableBodyAnimation ? [bodyState.headRotation.x, bodyState.headRotation.y, bodyState.headRotation.z] : [0, 0, 0]}>
          <EyeSystem
            position={[0, eyeLevel, 0]}
            height={height}
            gazeTarget={gazeTarget || [0, eyeLevel, 5]}
            irisColor={eyeColor}
            pupilDilation={0.5}
            lightSources={lightSources} // Full light data for shape/color/intensity
            lightPositions={lightPositions}
            lightColors={lightColors}
            lightIntensities={lightPositions.map(() => 1)}
            blinkState={eyeMovement.blinkState}
            showCatchlights={(lightSources?.length || 0) > 0 || lightPositions.length > 0}
            wireframe={false}
            enableAnimation={enableBodyAnimation}
          />
        </group>
      )}
      
      {/* Neck */}
      <mesh position={[0, torsoTop + 0.04, 0]}>
        <cylinderGeometry args={[headRadius * 0.4, headRadius * 0.5, 0.08, 8]} />
        <meshBasicMaterial color={wireColor} transparent opacity={0.5} wireframe />
      </mesh>
      
      {/* Torso */}
      <mesh position={[0, (torsoTop + torsoBottom) / 2, 0]}>
        <cylinderGeometry args={[shoulderWidth / 2, hipWidth / 2, torsoTop - torsoBottom, 12]} />
        <meshBasicMaterial color={wireColor} transparent opacity={0.5} wireframe />
      </mesh>
      
      {/* Shoulders line */}
      <Line
        points={[[-shoulderWidth / 2, torsoTop - 0.02, 0], [shoulderWidth / 2, torsoTop - 0.02, 0]]}
        color={wireColor}
        lineWidth={2}
      />
      
      {/* Left arm with animation */}
      <group position={[-shoulderWidth / 2, torsoTop - 0.02, 0]}>
        {/* Upper arm */}
        <group rotation={enableBodyAnimation 
          ? [bodyState.leftArmRotation.x, bodyState.leftArmRotation.y, Math.PI * 0.1 + bodyState.leftArmRotation.z]
          : [0, 0, Math.PI * 0.1]
        }>
          <mesh position={[0, -armLength * 0.25, 0]}>
            <cylinderGeometry args={[0.035, 0.03, armLength * 0.5, 6]} />
            <meshBasicMaterial color={wireColor} transparent opacity={0.5} wireframe />
          </mesh>
          {/* Lower arm (forearm) */}
          <group position={[0, -armLength * 0.5, 0]} rotation={[enableBodyAnimation ? -bodyState.leftElbowAngle : -0.15, 0, 0]}>
            <mesh position={[0, -armLength * 0.22, 0]}>
              <cylinderGeometry args={[0.03, 0.025, armLength * 0.45, 6]} />
              <meshBasicMaterial color={wireColor} transparent opacity={0.5} wireframe />
            </mesh>
            {/* Hand indicator */}
            <mesh position={enableBodyAnimation ? [bodyState.leftHandPos.x + shoulderWidth / 2, -armLength * 0.45, bodyState.leftHandPos.z] : [0, -armLength * 0.45, 0]}>
              <sphereGeometry args={[0.03, 8, 6]} />
              <meshBasicMaterial color={accentColor} transparent opacity={0.6} />
            </mesh>
          </group>
        </group>
      </group>
      
      {/* Right arm with animation */}
      <group position={[shoulderWidth / 2, torsoTop - 0.02, 0]}>
        {/* Upper arm */}
        <group rotation={enableBodyAnimation 
          ? [bodyState.rightArmRotation.x, bodyState.rightArmRotation.y, -Math.PI * 0.1 + bodyState.rightArmRotation.z]
          : [0, 0, -Math.PI * 0.1]
        }>
          <mesh position={[0, -armLength * 0.25, 0]}>
            <cylinderGeometry args={[0.035, 0.03, armLength * 0.5, 6]} />
            <meshBasicMaterial color={wireColor} transparent opacity={0.5} wireframe />
          </mesh>
          {/* Lower arm (forearm) */}
          <group position={[0, -armLength * 0.5, 0]} rotation={[enableBodyAnimation ? -bodyState.rightElbowAngle : -0.15, 0, 0]}>
            <mesh position={[0, -armLength * 0.22, 0]}>
              <cylinderGeometry args={[0.03, 0.025, armLength * 0.45, 6]} />
              <meshBasicMaterial color={wireColor} transparent opacity={0.5} wireframe />
            </mesh>
            {/* Hand indicator */}
            <mesh position={enableBodyAnimation ? [bodyState.rightHandPos.x - shoulderWidth / 2, -armLength * 0.45, bodyState.rightHandPos.z] : [0, -armLength * 0.45, 0]}>
              <sphereGeometry args={[0.03, 8, 6]} />
              <meshBasicMaterial color={accentColor} transparent opacity={0.6} />
            </mesh>
          </group>
        </group>
      </group>
      
      {/* Legs (only for standing/full body) */}
      {type === 'standing' && (
        <>
          {/* Left leg */}
          <mesh position={[-hipWidth / 2.5, legLength / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.035, legLength, 8]} />
            <meshBasicMaterial color={wireColor} transparent opacity={0.5} wireframe />
          </mesh>
          
          {/* Right leg */}
          <mesh position={[hipWidth / 2.5, legLength / 2, 0]}>
            <cylinderGeometry args={[0.05, 0.035, legLength, 8]} />
            <meshBasicMaterial color={wireColor} transparent opacity={0.5} wireframe />
          </mesh>
          
          {/* Ground contact circles */}
          <mesh position={[-hipWidth / 2.5, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.08, 16]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.3} />
          </mesh>
          <mesh position={[hipWidth / 2.5, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.08, 16]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.3} />
          </mesh>
        </>
      )}
      
      {/* Sitting legs */}
      {type === 'sitting' && (
        <>
          <mesh position={[-hipWidth / 2, 0.3, 0.25]} rotation={[Math.PI / 2.5, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.035, 0.5, 8]} />
            <meshBasicMaterial color={wireColor} transparent opacity={0.5} wireframe />
          </mesh>
          <mesh position={[hipWidth / 2, 0.3, 0.25]} rotation={[Math.PI / 2.5, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.035, 0.5, 8]} />
            <meshBasicMaterial color={wireColor} transparent opacity={0.5} wireframe />
          </mesh>
        </>
      )}
      
      {/* Eye level indicator */}
      <Line
        points={[[-0.4, headY - headRadius * 0.2, 0], [0.4, headY - headRadius * 0.2, 0]]}
        color={accentColor}
        lineWidth={2}
      />
      
      {showMeasurements && (
        <>
          {/* Eye level label */}
          <Html position={[0.5, headY - headRadius * 0.2, 0]}>
            <div style={{
              background: accentColor,
              color: 'black',
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '9px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap'}}>
              Eye Level {(headY - headRadius * 0.2).toFixed(2)}m
            </div>
          </Html>
          
          {/* Height indicator */}
          <Line
            points={[[0.35, 0, 0], [0.35, actualHeight, 0]]}
            color="#ffaa00"
            lineWidth={1}
            dashed
            dashSize={0.05}
          />
          <Html position={[0.45, actualHeight / 2, 0]}>
            <div style={{
              background: '#ffaa00',
              color: 'black',
              padding: '2px 4px',
              borderRadius: '3px',
              fontSize: '8px',
              fontWeight: 'bold'}}>
              {actualHeight.toFixed(2)}m
            </div>
          </Html>
          
          {/* Shoulder width indicator */}
          <Line
            points={[[-shoulderWidth / 2, torsoTop, 0.15], [shoulderWidth / 2, torsoTop, 0.15]]}
            color="#ff6688"
            lineWidth={1}
          />
          <Html position={[0, torsoTop + 0.08, 0.15]}>
            <div style={{
              background: '#ff6688',
              color: 'white',
              padding: '1px 4px',
              borderRadius: '2px',
              fontSize: '8px'}}>
              {(shoulderWidth * 100).toFixed(0)}cm
            </div>
          </Html>
        </>
      )}
    </group>
  );
};

// Main Studio Guides Component
export const StudioGuidesOverlay: React.FC<StudioGuidesProps> = ({
  showDistanceGuides = true,
  showAngleGuides = true,
  showPositionMarkers = true,
  showGridOverlay = true,
  subjectPosition = [0, 0, 0],
  backgroundDistance = 3,
  keyLightPosition = [2, 2, 2],
  fillPosition = [-1.5, 1.5, 1.5],
  cameraPosition = [0, 1.5, 4],
  lightSources: propLightSources,
}) => {
  // Get scene nodes to extract light sources
  const nodes = useNodes();
  
  // Extract light sources from scene nodes (or use prop)
  const sceneLightSources = useLightSourcesFromNodes(nodes);
  
  // Use provided light sources or fallback to scene-extracted ones
  const effectiveLightSources: LightSourceData[] = useMemo(() => {
    if (propLightSources && propLightSources.length > 0) {
      return propLightSources;
    }
    if (sceneLightSources.length > 0) {
      return sceneLightSources;
    }
    // Fallback to key/fill positions with default modifiers
    return [
      {
        position: keyLightPosition,
        color: '#fff8e0',
        intensity: 1,
        cct: 5500,
        modifier: 'softbox', // Default to softbox for rectangular catchlight
        modifierSize: 0.9, // 90cm softbox
        enabled: true,
        name: 'Key Light',
      },
      {
        position: fillPosition,
        color: '#e0e8ff',
        intensity: 0.5,
        cct: 6500,
        modifier: 'umbrella', // Umbrella for round catchlight
        modifierSize: 1.0, // 100cm umbrella
        enabled: true,
        name: 'Fill Light',
      },
    ];
  }, [propLightSources, sceneLightSources, keyLightPosition, fillPosition]);
  
  const backgroundPos: [number, number, number] = [
    subjectPosition[0],
    subjectPosition[1],
    subjectPosition[2] - backgroundDistance,
  ];

  return (
    <group>
      {/* Floor Grid */}
      {showGridOverlay && (
        <FloorGrid size={10} divisions={20} showMeasurements />
      )}

      {/* Subject silhouette with eyes and catchlights from actual light sources */}
      {showPositionMarkers && (
        <SubjectSilhouette 
          position={subjectPosition} 
          type="standing"
          showEyes={true}
          gazeTarget={cameraPosition}
          lightSources={effectiveLightSources}
        />
      )}

      {/* Position Markers */}
      {showPositionMarkers && (
        <>
          <PositionMarker 
            position={subjectPosition} 
            label="Subject" 
            color="#ff4488" 
          />
          <PositionMarker 
            position={backgroundPos} 
            label="Background" 
            color="#4488ff" 
          />
          <PositionMarker 
            position={keyLightPosition} 
            label="Key Light" 
            color="#ffcc00" 
          />
          <PositionMarker 
            position={fillPosition} 
            label="Fill/Reflector" 
            color="#88ccff" 
          />
        </>
      )}

      {/* Distance Guides */}
      {showDistanceGuides && (
        <>
          {/* Subject to Background */}
          <DistanceIndicator
            start={subjectPosition}
            end={backgroundPos}
            label="Subject to BG"
            color="#4488ff"
          />
          
          {/* Key Light to Subject */}
          <DistanceIndicator
            start={keyLightPosition}
            end={subjectPosition}
            label="Key to Subject"
            color="#ffcc00"
          />
          
          {/* Fill to Subject */}
          <DistanceIndicator
            start={fillPosition}
            end={subjectPosition}
            label="Fill to Subject"
            color="#88ccff"
          />
          
          {/* Camera to Subject */}
          <DistanceIndicator
            start={cameraPosition}
            end={subjectPosition}
            label="Camera to Subject"
            color="#ff8844"
          />
        </>
      )}

      {/* Light Placement Guides (circles at floor level) */}
      {showAngleGuides && (
        <>
          {/* Optimal key light distance circle */}
          <LightPlacementGuide
            center={subjectPosition}
            radius={1.5}
            label="1.5m (Close/Soft)"
            color="#ffcc00"
          />
          <LightPlacementGuide
            center={subjectPosition}
            radius={2}
            label="2m (Recommended)"
            color="#00ff88"
            recommended
          />
          <LightPlacementGuide
            center={subjectPosition}
            radius={3}
            label="3m (Groups)"
            color="#88ccff"
          />
          
          {/* Angle guides at 45 degrees */}
          <AngleIndicator
            center={subjectPosition}
            angle={45}
            radius={1.5}
            color="#ffaa00"
            label="45 Key"
          />
        </>
      )}

      {/* Height Guide */}
      {showPositionMarkers && (
        <HeightGuide
          position={[-3, 0, 0]}
          heights={[
            { value: 1.0, label: 'Eye (sitting)', color: '#88ccff' },
            { value: 1.6, label: 'Eye (standing)', color: '#00ff88' },
            { value: 2.0, label: 'Key Light', color: '#ffcc00' },
            { value: 2.5, label: 'Hair Light', color: '#ff88cc' },
          ]}
        />
      )}

      {/* Recommended zone highlight */}
      {showAngleGuides && (
        <mesh position={[subjectPosition[0], 0.01, subjectPosition[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.8, 2.2, 32]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  );
};

export default StudioGuidesOverlay;

