/**
 * Eye System Component
 * 
 * Realistic eye rendering with:
 * - Eye movement/gaze direction
 * - Catchlight simulation from scene lights
 * - Light source controlled catchlights (shape, color, intensity from modifiers)
 * - Iris color customization
 * - Pupil dilation
 * - Specular highlights
 * - Blink animation support
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EyeAnimationController, EYE_ANIMATION_PRESETS, EyeAnimationConfig } from '../../core/animations/EyeAnimations';

// =============================================================================
// Types
// =============================================================================

export interface EyeSystemProps {
  position: [number, number, number]; // Head position
  height?: number; // Total human height for proportions
  gazeTarget?: [number, number, number]; // Where eyes are looking
  irisColor?: string;
  pupilDilation?: number; // 0-1, affects pupil size
  lightSources?: LightSourceData[]; // Full light source data
  // Legacy props for backward compatibility
  lightPositions?: Array<[number, number, number]>;
  lightColors?: string[];
  lightIntensities?: number[];
  blinkState?: number; // 0 = open, 1 = closed
  eyeSpacing?: number; // Override default spacing
  showCatchlights?: boolean;
  wireframe?: boolean; // For guide mode
  // Animation options
  animationPreset?: keyof typeof EYE_ANIMATION_PRESETS;
  animationConfig?: Partial<EyeAnimationConfig>;
  enableAnimation?: boolean; // Enable animated eye movement
  followCamera?: boolean; // Eyes follow camera position
  autoLook?: boolean; // Random gaze changes
}

export interface EyeProps {
  position: [number, number, number];
  gazeDirection: THREE.Vector3;
  irisColor: string;
  pupilDilation: number;
  catchlights: CatchlightData[];
  blinkState: number;
  isLeftEye: boolean;
  wireframe?: boolean;
}

export interface CatchlightData {
  position: THREE.Vector2; // UV position on eye surface
  intensity: number;
  color: string;
  size: number;
  shape: 'round' | 'rectangular' | 'octagon' | 'strip' | 'ring';
  aspectRatio: number; // width/height for rectangular shapes
  rotation: number; // rotation angle in radians
}

// Light source data from scene
export interface LightSourceData {
  position: [number, number, number];
  color?: string;
  intensity?: number; // 0-1 power
  cct?: number; // Color temperature in Kelvin
  modifier?: string; // softbox, umbrella, beauty_dish, etc.
  modifierSize?: number; // Size in meters
  beam?: number; // Beam angle in degrees
  enabled?: boolean;
  name?: string;
}

// =============================================================================
// Constants
// =============================================================================

const EYE_COLORS = {
  brown: '#4a3728',
  blue: '#3d6b99',
  green: '#4a7c59',
  hazel: '#8b7355',
  gray: '#6b7b8c',
  amber: '#c4a35a',
};

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert color temperature (Kelvin) to RGB hex color
 */
function cctToColor(kelvin: number): string {
  const temp = kelvin / 100;
  let r, g, b;
  
  if (temp <= 66) {
    r = 255;
    g = temp;
    g = 99.4708025861 * Math.log(g) - 161.1195681661;
    if (temp <= 19) {
      b = 0;
    } else {
      b = temp - 10;
      b = 138.5177312231 * Math.log(b) - 305.0447927307;
    }
  } else {
    r = temp - 60;
    r = 329.698727446 * Math.pow(r, -0.1332047592);
    g = temp - 60;
    g = 288.1221695283 * Math.pow(g, -0.0755148492);
    b = 255;
  }
  
  r = Math.max(0, Math.min(255, Math.round(r)));
  g = Math.max(0, Math.min(255, Math.round(g)));
  b = Math.max(0, Math.min(255, Math.round(b)));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get catchlight shape based on light modifier
 */
function getModifierShape(modifier?: string): { 
  shape: CatchlightData['shape']; 
  aspectRatio: number;
} {
  if (!modifier) return { shape: 'round', aspectRatio: 1 };
  
  const mod = modifier.toLowerCase();
  
  // Softboxes - rectangular
  if (mod.includes('softbox')) {
    if (mod.includes('strip')) return { shape: 'strip', aspectRatio: 4 };
    if (mod.includes('octa')) return { shape: 'octagon', aspectRatio: 1 };
    return { shape: 'rectangular', aspectRatio: 1.3 };
  }
  
  // Beauty dish - round
  if (mod.includes('beauty') || mod.includes('dish')) {
    return { shape: 'round', aspectRatio: 1 };
  }
  
  // Umbrella - round
  if (mod.includes('umbrella')) {
    return { shape: 'round', aspectRatio: 1 };
  }
  
  // Ring light - ring shape
  if (mod.includes('ring')) {
    return { shape: 'ring', aspectRatio: 1 };
  }
  
  // Octabox
  if (mod.includes('octa')) {
    return { shape: 'octagon', aspectRatio: 1 };
  }
  
  // Stripbox
  if (mod.includes('strip')) {
    return { shape: 'strip', aspectRatio: 4 };
  }
  
  // Snoot, grid, bare - small round
  if (mod.includes('snoot') || mod.includes('grid') || mod.includes('bare')) {
    return { shape: 'round', aspectRatio: 1 };
  }
  
  // Parabolic - large round
  if (mod.includes('para')) {
    return { shape: 'round', aspectRatio: 1 };
  }
  
  // Default
  return { shape: 'round', aspectRatio: 1 };
}

/**
 * Calculate catchlight positions based on light sources
 */
function calculateCatchlightsFromSources(
  eyePosition: THREE.Vector3,
  eyeNormal: THREE.Vector3, // Eye looking direction
  lightSources: LightSourceData[]
): CatchlightData[] {
  const catchlights: CatchlightData[] = [];
  
  for (const light of lightSources) {
    // Skip disabled lights
    if (light.enabled === false) continue;
    
    const lightPos = new THREE.Vector3(...light.position);
    const toLight = lightPos.clone().sub(eyePosition).normalize();
    
    // Check if light is in front of eye (visible for reflection)
    const dotProduct = toLight.dot(eyeNormal);
    if (dotProduct < 0) continue; // Light behind eye
    
    // Calculate reflection position on eye surface (simplified spherical mapping)
    // Reflection vector: R = 2(N·L)N - L
    const reflection = eyeNormal.clone()
      .multiplyScalar(2 * dotProduct)
      .sub(toLight)
      .normalize();
    
    // Map to UV coordinates on eye surface
    const u = 0.5 + Math.atan2(reflection.x, reflection.z) / (2 * Math.PI);
    const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, reflection.y))) / Math.PI;
    
    // Calculate size based on distance and modifier size
    const distance = lightPos.distanceTo(eyePosition);
    const modifierSize = light.modifierSize || 0.6; // Default 60cm
    let size = Math.min(0.4, (modifierSize * 0.15) / (distance * 0.5));
    
    // Beam angle affects size (narrow beam = smaller catchlight)
    if (light.beam) {
      size *= Math.min(1, light.beam / 90);
    }
    
    // Get color from CCT or direct color
    const color = light.cct ? cctToColor(light.cct) : (light.color || '#ffffff');
    
    // Get shape from modifier
    const { shape, aspectRatio } = getModifierShape(light.modifier);
    
    // Calculate rotation based on light position (catchlight tilts with angle)
    const rotation = Math.atan2(lightPos.x - eyePosition.x, lightPos.y - eyePosition.y);
    
    catchlights.push({
      position: new THREE.Vector2(u, v),
      intensity: (light.intensity ?? 1) * dotProduct,
      color,
      size,
      shape,
      aspectRatio,
      rotation,
    });
  }
  
  return catchlights;
}

/**
 * Calculate catchlight positions based on legacy props (backward compatibility)
 */
function calculateCatchlightsLegacy(
  eyePosition: THREE.Vector3,
  eyeNormal: THREE.Vector3,
  lightPositions: Array<[number, number, number]>,
  lightColors: string[],
  lightIntensities: number[]
): CatchlightData[] {
  const lightSources: LightSourceData[] = lightPositions.map((pos, i) => ({
    position: pos,
    color: lightColors[i],
    intensity: lightIntensities[i],
  }));
  return calculateCatchlightsFromSources(eyePosition, eyeNormal, lightSources);
}

/**
 * Calculate gaze direction from target
 */
function calculateGazeDirection(
  eyePosition: THREE.Vector3,
  target: THREE.Vector3
): THREE.Vector3 {
  return target.clone().sub(eyePosition).normalize();
}

// =============================================================================
// Catchlight Shape Geometry Component
// =============================================================================

const CatchlightShape: React.FC<{
  catchlight: CatchlightData;
  irisRadius: number;
  eyeRadius: number;
}> = ({ catchlight, irisRadius, eyeRadius }) => {
  const { position, intensity, color, size, shape, aspectRatio, rotation } = catchlight;
  
  const x = (position.x - 0.5) * irisRadius * 1.5;
  const y = (position.y - 0.5) * irisRadius * 1.5;
  const z = eyeRadius * 0.88;
  const baseSize = size * eyeRadius;
  
  // Create geometry based on shape
  const geometry = useMemo(() => {
    switch (shape) {
      case 'rectangular':
        return new THREE.PlaneGeometry(baseSize * aspectRatio, baseSize);
      
      case 'strip':
        return new THREE.PlaneGeometry(baseSize * 0.3, baseSize * aspectRatio);
      
      case 'octagon': {
        const octShape = new THREE.Shape();
        const radius = baseSize;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 - Math.PI / 8;
          const px = Math.cos(angle) * radius;
          const py = Math.sin(angle) * radius;
          if (i === 0) octShape.moveTo(px, py);
          else octShape.lineTo(px, py);
        }
        octShape.closePath();
        return new THREE.ShapeGeometry(octShape);
      }
      
      case 'ring': {
        const ringOuter = new THREE.RingGeometry(baseSize * 0.6, baseSize, 32);
        return ringOuter;
      }
      
      case 'round':
      default:
        return new THREE.CircleGeometry(baseSize, 24);
    }
  }, [shape, baseSize, aspectRatio]);
  
  return (
    <mesh position={[x, y, z]} rotation={[0, 0, rotation]}>
      <primitive object={geometry} attach="geometry" />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={Math.min(1, intensity * 0.8)}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

// =============================================================================
// Single Eye Component
// =============================================================================

const Eye: React.FC<EyeProps> = ({
  position,
  gazeDirection,
  irisColor,
  pupilDilation,
  catchlights,
  blinkState,
  isLeftEye,
  wireframe = false,
}) => {
  const eyeRef = useRef<THREE.Group>(null);
  const irisRef = useRef<THREE.Mesh>(null);
  const pupilRef = useRef<THREE.Mesh>(null);
  
  // Eye dimensions
  const eyeRadius = 0.012; // ~24mm diameter
  const irisRadius = eyeRadius * 0.45;
  const pupilBaseRadius = irisRadius * 0.35;
  const pupilRadius = pupilBaseRadius * (0.5 + pupilDilation * 0.5);
  
  // Create eye geometry and materials
  const { scleraMaterial, irisMaterial, pupilMaterial, corneaMaterial } = useMemo(() => {
    return {
      // Sclera (white of eye) with slight veins
      scleraMaterial: new THREE.MeshStandardMaterial({
        color: wireframe ? '#666666' : '#f8f8f0',
        roughness: 0.3,
        metalness: 0.0,
        wireframe,
      }),
      // Iris with color
      irisMaterial: new THREE.MeshStandardMaterial({
        color: wireframe ? '#888888' : irisColor,
        roughness: 0.4,
        metalness: 0.1,
        wireframe,
      }),
      // Pupil (black)
      pupilMaterial: new THREE.MeshStandardMaterial({
        color: wireframe ? '#333333' : '#0a0a0a',
        roughness: 0.1,
        metalness: 0.0,
        wireframe,
      }),
      // Cornea (transparent dome over iris)
      corneaMaterial: new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.0,
        metalness: 0.0,
        transmission: wireframe ? 0 : 0.95,
        thickness: 0.001,
        ior: 1.376, // Cornea IOR
        transparent: true,
        opacity: wireframe ? 0.3 : 0.15,
        wireframe,
      }),
    };
  }, [irisColor, wireframe]);
  
  // Update eye rotation based on gaze
  useEffect(() => {
    if (!eyeRef.current) return;
    
    // Calculate rotation to look at gaze direction
    const eyePos = new THREE.Vector3(...position);
    const targetPos = eyePos.clone().add(gazeDirection);
    
    // Create rotation to look at target
    const quaternion = new THREE.Quaternion();
    const matrix = new THREE.Matrix4();
    matrix.lookAt(eyePos, targetPos, new THREE.Vector3(0, 1, 0));
    quaternion.setFromRotationMatrix(matrix);
    
    eyeRef.current.quaternion.copy(quaternion);
  }, [position, gazeDirection]);
  
  // Blink animation (scale Y of eyelid area)
  const eyelidScale = 1 - blinkState * 0.9;
  
  return (
    <group ref={eyeRef} position={position}>
      {/* Eyeball (sclera) */}
      <mesh>
        <sphereGeometry args={[eyeRadius, 24, 16]} />
        <primitive object={scleraMaterial} attach="material" />
      </mesh>
      
      {/* Iris */}
      <mesh ref={irisRef} position={[0, 0, eyeRadius * 0.85]}>
        <circleGeometry args={[irisRadius, 32]} />
        <primitive object={irisMaterial} attach="material" />
      </mesh>
      
      {/* Pupil */}
      <mesh ref={pupilRef} position={[0, 0, eyeRadius * 0.86]}>
        <circleGeometry args={[pupilRadius, 24]} />
        <primitive object={pupilMaterial} attach="material" />
      </mesh>
      
      {/* Cornea (transparent dome) */}
      <mesh position={[0, 0, eyeRadius * 0.3]}>
        <sphereGeometry args={[eyeRadius * 0.7, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <primitive object={corneaMaterial} attach="material" />
      </mesh>
      
      {/* Catchlights with proper shapes */}
      {!wireframe && catchlights.map((catchlight, i) => (
        <CatchlightShape
          key={i}
          catchlight={catchlight}
          irisRadius={irisRadius}
          eyeRadius={eyeRadius}
        />
      ))}
      
      {/* Eyelids (simplified) */}
      <group scale={[1, eyelidScale, 1]}>
        {/* Upper eyelid */}
        <mesh position={[0, eyeRadius * 0.6, eyeRadius * 0.3]} rotation={[Math.PI / 6, 0, 0]}>
          <planeGeometry args={[eyeRadius * 2.2, eyeRadius * 0.8]} />
          <meshStandardMaterial color="#d4a574" side={THREE.DoubleSide} />
        </mesh>
        
        {/* Lower eyelid */}
        <mesh position={[0, -eyeRadius * 0.5, eyeRadius * 0.3]} rotation={[-Math.PI / 8, 0, 0]}>
          <planeGeometry args={[eyeRadius * 2, eyeRadius * 0.5]} />
          <meshStandardMaterial color="#d4a574" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
};

// =============================================================================
// Eye System Component (Both Eyes)
// =============================================================================

export const EyeSystem: React.FC<EyeSystemProps> = ({
  position,
  height = 1.7,
  gazeTarget,
  irisColor = EYE_COLORS.brown,
  pupilDilation: propPupilDilation = 0.5,
  lightSources,
  lightPositions = [],
  lightColors = [],
  lightIntensities = [],
  blinkState: propBlinkState = 0,
  eyeSpacing,
  showCatchlights = true,
  wireframe = false,
  animationPreset = 'relaxed',
  animationConfig,
  enableAnimation = false,
  followCamera = false,
  autoLook = false,
}) => {
  // Animation controller
  const animControllerRef = useRef<EyeAnimationController | null>(null);
  const [animState, setAnimState] = useState<{
    gazeDirection: THREE.Vector3;
    blinkState: number;
    pupilDilation: number;
  }>({
    gazeDirection: new THREE.Vector3(0, 0, 1),
    blinkState: 0,
    pupilDilation: propPupilDilation,
  });
  
  // Initialize animation controller
  useEffect(() => {
    if (enableAnimation) {
      const presetConfig = EYE_ANIMATION_PRESETS[animationPreset];
      animControllerRef.current = new EyeAnimationController({
        ...presetConfig,
        ...animationConfig,
      });
      
      // Set initial gaze target
      if (gazeTarget) {
        const target = new THREE.Vector3(...gazeTarget);
        animControllerRef.current.saccadeTo(target);
      }
    }
    
    return () => {
      animControllerRef.current = null;
    };
  }, [enableAnimation, animationPreset, animationConfig]);
  
  // Update animation each frame
  useFrame((state, delta) => {
    if (!enableAnimation || !animControllerRef.current) return;
    
    // Update light intensity for pupil reaction
    const avgLightIntensity = lightSources?.length 
      ? lightSources.reduce((sum, l) => sum + (l.intensity || 0.5), 0) / lightSources.length
      : 0.5;
    animControllerRef.current.setLightIntensity(avgLightIntensity);
    
    // Follow camera if enabled
    if (followCamera) {
      const cameraPos = state.camera.position;
      animControllerRef.current.smoothPursuit(cameraPos, delta);
    }
    
    // Update animation
    const newState = animControllerRef.current.update(delta, state.clock.elapsedTime);
    
    setAnimState({
      gazeDirection: animControllerRef.current.getGazeWithMicroMovements() || new THREE.Vector3(0, 0, 1),
      blinkState: newState.blinkProgress,
      pupilDilation: newState.pupilDilation,
    });
  });
  
  // Calculate eye positions based on head
  const headRadius = height / 16; // Head radius
  const spacing = eyeSpacing || headRadius * 0.65; // Eye spacing
  const eyeY = position[1]; // Eyes at provided height
  const eyeZ = position[2] + headRadius * 0.85; // Eyes forward from head center
  
  const leftEyePos: [number, number, number] = [position[0] - spacing / 2, eyeY, eyeZ];
  const rightEyePos: [number, number, number] = [position[0] + spacing / 2, eyeY, eyeZ];
  
  // Use animated gaze if animation enabled, otherwise use prop
  const gazeDirection = useMemo(() => {
    if (enableAnimation) {
      return animState.gazeDirection;
    }
    if (gazeTarget) {
      const eyeCenter = new THREE.Vector3(position[0], eyeY, eyeZ);
      const target = new THREE.Vector3(...gazeTarget);
      return calculateGazeDirection(eyeCenter, target);
    }
    // Default: look forward
    return new THREE.Vector3(0, 0, 1);
  }, [enableAnimation, animState.gazeDirection, gazeTarget, position, eyeY, eyeZ]);
  
  // Use animated values if animation enabled, otherwise use props
  const blinkState = enableAnimation ? animState.blinkState : propBlinkState;
  const pupilDilation = enableAnimation ? animState.pupilDilation : propPupilDilation;
  
  // Calculate catchlights for each eye
  const leftCatchlights = useMemo(() => {
    if (!showCatchlights) return [];
    
    // Use full light sources if provided, otherwise fall back to legacy
    if (lightSources && lightSources.length > 0) {
      const eyePos = new THREE.Vector3(...leftEyePos);
      return calculateCatchlightsFromSources(eyePos, gazeDirection, lightSources);
    }
    
    if (lightPositions.length === 0) return [];
    const eyePos = new THREE.Vector3(...leftEyePos);
    return calculateCatchlightsLegacy(eyePos, gazeDirection, lightPositions, lightColors, lightIntensities);
  }, [leftEyePos, gazeDirection, lightSources, lightPositions, lightColors, lightIntensities, showCatchlights]);
  
  const rightCatchlights = useMemo(() => {
    if (!showCatchlights) return [];
    
    // Use full light sources if provided, otherwise fall back to legacy
    if (lightSources && lightSources.length > 0) {
      const eyePos = new THREE.Vector3(...rightEyePos);
      return calculateCatchlightsFromSources(eyePos, gazeDirection, lightSources);
    }
    
    if (lightPositions.length === 0) return [];
    const eyePos = new THREE.Vector3(...rightEyePos);
    return calculateCatchlightsLegacy(eyePos, gazeDirection, lightPositions, lightColors, lightIntensities);
  }, [rightEyePos, gazeDirection, lightSources, lightPositions, lightColors, lightIntensities, showCatchlights]);
  
  return (
    <group>
      <Eye
        position={leftEyePos}
        gazeDirection={gazeDirection}
        irisColor={irisColor}
        pupilDilation={pupilDilation}
        catchlights={leftCatchlights}
        blinkState={blinkState}
        isLeftEye={true}
        wireframe={wireframe}
      />
      <Eye
        position={rightEyePos}
        gazeDirection={gazeDirection}
        irisColor={irisColor}
        pupilDilation={pupilDilation}
        catchlights={rightCatchlights}
        blinkState={blinkState}
        isLeftEye={false}
        wireframe={wireframe}
      />
    </group>
  );
};

// =============================================================================
// Eye Movement Controller Hook
// =============================================================================

export interface UseEyeMovementOptions {
  autoLook?: boolean; // Automatically look around
  followMouse?: boolean; // Follow mouse cursor
  blinkInterval?: number; // ms between blinks
}

export function useEyeMovement(options: UseEyeMovementOptions = {}) {
  const { autoLook = false, followMouse = false, blinkInterval = 4000 } = options;
  
  const [gazeTarget, setGazeTarget] = React.useState<[number, number, number]>([0, 1.6, 5]);
  const [blinkState, setBlinkState] = React.useState(0);
  const [pupilDilation, setPupilDilation] = React.useState(0.5);
  
  // Auto blink
  useEffect(() => {
    const blinkDuration = 150;
    
    const doBlink = () => {
      setBlinkState(1);
      setTimeout(() => setBlinkState(0), blinkDuration);
    };
    
    const interval = setInterval(doBlink, blinkInterval + Math.random() * 2000);
    return () => clearInterval(interval);
  }, [blinkInterval]);
  
  // Auto look around
  useEffect(() => {
    if (!autoLook) return;
    
    const lookAround = () => {
      const x = (Math.random() - 0.5) * 2;
      const y = 1.5 + (Math.random() - 0.5) * 0.3;
      const z = 3 + Math.random() * 2;
      setGazeTarget([x, y, z]);
    };
    
    const interval = setInterval(lookAround, 2000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [autoLook]);
  
  // Follow mouse
  useEffect(() => {
    if (!followMouse) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Map mouse position to 3D space (simplified)
      const x = ((e.clientX / window.innerWidth) - 0.5) * 4;
      const y = 1.6 + ((0.5 - e.clientY / window.innerHeight)) * 1;
      setGazeTarget([x, y, 3]);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [followMouse]);
  
  return {
    gazeTarget,
    setGazeTarget,
    blinkState,
    setBlinkState,
    pupilDilation,
    setPupilDilation,
    // Trigger a manual blink
    blink: () => {
      setBlinkState(1);
      setTimeout(() => setBlinkState(0), 150);
    },
  };
}

// =============================================================================
// Catchlight Preview Component (for lighting guides)
// =============================================================================

export interface CatchlightPreviewProps {
  subjectPosition: [number, number, number];
  subjectHeight?: number;
  lightSources?: LightSourceData[]; // Full light source data
  // Legacy props
  lightPositions?: Array<[number, number, number]>;
  lightColors?: string[];
  lightIntensities?: number[];
  showGuides?: boolean;
}

export const CatchlightPreview: React.FC<CatchlightPreviewProps> = ({
  subjectPosition,
  subjectHeight = 1.7,
  lightSources,
  lightPositions = [],
  lightColors = [],
  lightIntensities = [],
  showGuides = true,
}) => {
  const eyeLevel = subjectPosition[1] + subjectHeight - subjectHeight / 16 - subjectHeight / 32;
  
  // Use light sources or fall back to legacy positions
  const effectiveLightPositions = lightSources?.map(l => l.position) || lightPositions;
  const effectiveLightColors = lightSources?.map(l => l.cct ? cctToColor(l.cct) : (l.color || '#ffffff')) || lightColors;
  
  return (
    <group>
      <EyeSystem
        position={[subjectPosition[0], eyeLevel, subjectPosition[2]]}
        height={subjectHeight}
        lightSources={lightSources}
        lightPositions={lightPositions}
        lightColors={effectiveLightColors.length ? effectiveLightColors : effectiveLightPositions.map(() => '#ffffff')}
        lightIntensities={lightIntensities.length ? lightIntensities : effectiveLightPositions.map(() => 1)}
        showCatchlights={true}
        wireframe={false}
      />
      
      {/* Light direction indicators */}
      {showGuides && effectiveLightPositions.map((lightPos, i) => {
        const eyePos = new THREE.Vector3(subjectPosition[0], eyeLevel, subjectPosition[2] + subjectHeight / 16 * 0.85);
        const lightVec = new THREE.Vector3(...lightPos);
        const direction = lightVec.clone().sub(eyePos).normalize();
        const midpoint = eyePos.clone().add(direction.multiplyScalar(0.3));
        
        return (
          <group key={i}>
            {/* Line from eye to light */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([
                    eyePos.x, eyePos.y, eyePos.z,
                    lightPos[0], lightPos[1], lightPos[2],
                  ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color={effectiveLightColors[i] || '#ffff00'} transparent opacity={0.3} />
            </line>
          </group>
        );
      })}
    </group>
  );
};

// =============================================================================
// Hook to extract light sources from scene nodes
// =============================================================================

export function useLightSourcesFromNodes(nodes: any[]): LightSourceData[] {
  return useMemo(() => {
    return nodes
      .filter((n) => n.type ==='light' || n.light)
      .map((n) => ({
        position: n.transform?.position || [0, 2, 0],
        color: n.light?.color,
        intensity: n.light?.power ?? 1,
        cct: n.light?.cct,
        modifier: n.userData?.modifier || n.light?.modifier,
        modifierSize: n.userData?.modifierSize || n.light?.modifierSize,
        beam: n.light?.beam,
        enabled: n.visible !== false,
        name: n.name,
      }));
  }, [nodes]);
}

// =============================================================================
// Exports
// =============================================================================

export { EYE_COLORS, cctToColor, getModifierShape };
export default EyeSystem;
