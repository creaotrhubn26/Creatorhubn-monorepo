/**
 * MotionPathVisualization - 3D visualization of animation trajectories
 * 
 * Features:
 * - Spline path rendering
 * - Keyframe markers
 * - Direction arrows
 * - Speed indicators (color gradient)
 * - Editable path points
 * - Camera preview positions
 */

import React, { useMemo, useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import { AnimationTrack, Keyframe } from '../../core/animation/SceneGraphAnimationEngine';

// ============================================================================
// Types
// ============================================================================

export interface MotionPathConfig {
  showPath: boolean;
  showKeyframes: boolean;
  showDirectionArrows: boolean;
  showSpeedGradient: boolean;
  showLabels: boolean;
  pathColor: string;
  keyframeColor: string;
  arrowColor: string;
  pathWidth: number;
  keyframeSize: number;
  arrowSize: number;
  curveSegments: number;
  labelScale: number;
}

export interface MotionPathProps {
  track: AnimationTrack;
  config?: Partial<MotionPathConfig>;
  currentTime?: number;
  onKeyframeClick?: (index: number) => void;
  onKeyframeDrag?: (index: number, newPosition: THREE.Vector3) => void;
  isEditable?: boolean;
}

// ============================================================================
// Default Config
// ============================================================================

const DEFAULT_CONFIG: MotionPathConfig = {
  showPath: true,
  showKeyframes: true,
  showDirectionArrows: true,
  showSpeedGradient: true,
  showLabels: true,
  pathColor: '#2196f3',
  keyframeColor: '#ff9800',
  arrowColor: '#4caf50',
  pathWidth: 2,
  keyframeSize: 0.15,
  arrowSize: 0.2,
  curveSegments: 100,
  labelScale: 0.5,
};

// ============================================================================
// Speed Gradient Colors
// ============================================================================

function getSpeedColor(speed: number): THREE.Color {
  // Map speed to color: slow=blue, medium=green, fast=red
  if (speed < 0.3) {
    return new THREE.Color('#2196f3, '); // Blue (slow)
  } else if (speed < 0.7) {
    return new THREE.Color('#4caf50,'); // Green (medium)
  } else {
    return new THREE.Color('#f44336'); // Red (fast)
  }
}

// ============================================================================
// Catmull-Rom Spline Interpolation
// ============================================================================

function catmullRomSpline(
  points: THREE.Vector3[],
  segments: number = 100
): THREE.Vector3[] {
  if (points.length < 2) return points;
  if (points.length === 2) {
    // Linear interpolation
    const result: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      result.push(new THREE.Vector3().lerpVectors(points[0], points[1], t));
    }
    return result;
  }

  const curve = new THREE.CatmullRomCurve3(points, false'centripetal', 0.5);
  return curve.getPoints(segments);
}

// ============================================================================
// Keyframe Marker Component
// ============================================================================

interface KeyframeMarkerProps {
  position: THREE.Vector3;
  index: number;
  time: number;
  isSelected: boolean;
  config: MotionPathConfig;
  onClick?: () => void;
  onDrag?: (newPosition: THREE.Vector3) => void;
  isEditable?: boolean;
}

function KeyframeMarker({
  position,
  index,
  time,
  isSelected,
  config,
  onClick,
  onDrag,
  isEditable,
}: KeyframeMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const color = isSelected ? '#f44336' : hovered ? '#ff9800' : config.keyframeColor;
  const size = config.keyframeSize * (isSelected ? 1.3 : hovered ? 1.1 : 1);

  // Animation
  useFrame((state) => {
    if (meshRef.current) {
      // Gentle pulse for selected
      if (isSelected) {
        meshRef.current.scale.setScalar(size * (1 + Math.sin(state.clock.elapsedTime * 3) * 0.1));
      }
    }
  });

  return (
    <group position={position}>
      {/* Diamond shape */}
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        rotation={[0, 0, Math.PI / 4]}
      >
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.5 : hovered ? 0.3 : 0.1}
        />
      </mesh>

      {/* Label */}
      {config.showLabels && (hovered || isSelected) && (
        <Html
          position={[0, size + 0.1, 0]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none'}}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.8)',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap'}}
          >
            #{index} @ {time.toFixed(2)}s
          </div>
        </Html>
      )}
    </group>
  );
}

// ============================================================================
// Direction Arrow Component
// ============================================================================

interface DirectionArrowProps {
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  size: number;
}

function DirectionArrow({ start, end, color, size }: DirectionArrowProps) {
  const direction = new THREE.Vector3().subVectors(end, start).normalize();
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  
  // Calculate rotation from direction
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  quaternion.setFromUnitVectors(up, direction);

  return (
    <group position={midpoint} quaternion={quaternion}>
      <mesh>
        <coneGeometry args={[size * 0.3, size, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

// ============================================================================
// Current Position Indicator
// ============================================================================

interface CurrentPositionProps {
  position: THREE.Vector3;
  color: string;
}

function CurrentPosition({ position, color }: CurrentPositionProps) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 2;
    }
  });

  return (
    <group position={position}>
      {/* Outer ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.3, 0.03, 8, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
      {/* Inner sphere */}
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

// ============================================================================
// Main Motion Path Component
// ============================================================================

export function MotionPath({
  track,
  config: partialConfig,
  currentTime = 0,
  onKeyframeClick,
  onKeyframeDrag,
  isEditable = false,
}: MotionPathProps) {
  const config = { ...DEFAULT_CONFIG, ...partialConfig };
  const [selectedKeyframe, setSelectedKeyframe] = useState<number | null>(null);

  // Extract positions from keyframes (only for position tracks)
  const keyframePositions = useMemo(() => {
    if (track.type !== 'position') return [];

    return track.keyframes.map((kf) => {
      const value = kf.value;
      if (value instanceof THREE.Vector3) {
        return value.clone();
      }
      if (value && typeof value === 'object' && 'x' in value) {
        return new THREE.Vector3(value.x, value.y, value.z);
      }
      return new THREE.Vector3();
    });
  }, [track]);

  // Generate smooth curve
  const curvePoints = useMemo(() => {
    if (keyframePositions.length < 2) return keyframePositions;
    return catmullRomSpline(keyframePositions, config.curveSegments);
  }, [keyframePositions, config.curveSegments]);

  // Calculate speeds for gradient
  const speedColors = useMemo(() => {
    if (curvePoints.length < 2) return [];

    const colors: THREE.Color[] = [];
    for (let i = 0; i < curvePoints.length; i++) {
      if (i === 0) {
        colors.push(new THREE.Color(config.pathColor));
        continue;
      }

      const prev = curvePoints[i - 1];
      const curr = curvePoints[i];
      const distance = prev.distanceTo(curr);
      
      // Normalize speed (assuming 0-1 range based on typical movements)
      const normalizedSpeed = Math.min(1, distance * 10);
      
      if (config.showSpeedGradient) {
        colors.push(getSpeedColor(normalizedSpeed));
      } else {
        colors.push(new THREE.Color(config.pathColor));
      }
    }

    return colors;
  }, [curvePoints, config.pathColor, config.showSpeedGradient]);

  // Calculate current position on path
  const currentPosition = useMemo(() => {
    if (track.keyframes.length === 0 || track.type !== 'position') return null;

    // Find surrounding keyframes
    let prevKf = track.keyframes[0];
    let nextKf = track.keyframes[track.keyframes.length - 1];

    for (let i = 0; i < track.keyframes.length - 1; i++) {
      if (currentTime >= track.keyframes[i].time && currentTime < track.keyframes[i + 1].time) {
        prevKf = track.keyframes[i];
        nextKf = track.keyframes[i + 1];
        break;
      }
    }

    // Interpolate
    const t = nextKf.time === prevKf.time
      ? 0
      : (currentTime - prevKf.time) / (nextKf.time - prevKf.time);

    const prevPos = prevKf.value instanceof THREE.Vector3
      ? prevKf.value
      : new THREE.Vector3(prevKf.value.x, prevKf.value.y, prevKf.value.z);
    
    const nextPos = nextKf.value instanceof THREE.Vector3
      ? nextKf.value
      : new THREE.Vector3(nextKf.value.x, nextKf.value.y, nextKf.value.z);

    return new THREE.Vector3().lerpVectors(prevPos, nextPos, Math.max(0, Math.min(1, t)));
  }, [track, currentTime]);

  // Direction arrows (every N points)
  const arrowPositions = useMemo(() => {
    if (curvePoints.length < 10 || !config.showDirectionArrows) return [];

    const arrows: Array<{ start: THREE.Vector3; end: THREE.Vector3 }> = [];
    const step = Math.floor(curvePoints.length / 5);

    for (let i = 0; i < curvePoints.length - step; i += step) {
      arrows.push({
        start: curvePoints[i],
        end: curvePoints[i + Math.min(step, curvePoints.length - i - 1)],
      });
    }

    return arrows;
  }, [curvePoints, config.showDirectionArrows]);

  if (track.type !== 'position' || keyframePositions.length === 0) {
    return null;
  }

  return (
    <group name={`motion-path-${track.id}`}>
      {/* Path line */}
      {config.showPath && curvePoints.length > 1 && (
        <Line
          points={curvePoints}
          color={config.pathColor}
          lineWidth={config.pathWidth}
          vertexColors={speedColors.length > 0 ? speedColors : undefined}
          transparent
          opacity={0.8}
        />
      )}

      {/* Keyframe markers */}
      {config.showKeyframes &&
        keyframePositions.map((pos, index) => (
          <KeyframeMarker
            key={index}
            position={pos}
            index={index}
            time={track.keyframes[index].time}
            isSelected={selectedKeyframe === index}
            config={config}
            onClick={() => {
              setSelectedKeyframe(index);
              onKeyframeClick?.(index);
            }}
            onDrag={(newPos) => onKeyframeDrag?.(index, newPos)}
            isEditable={isEditable}
          />
        ))}

      {/* Direction arrows */}
      {arrowPositions.map((arrow, index) => (
        <DirectionArrow
          key={index}
          start={arrow.start}
          end={arrow.end}
          color={config.arrowColor}
          size={config.arrowSize}
        />
      ))}

      {/* Current position indicator */}
      {currentPosition && (
        <CurrentPosition position={currentPosition} color="#f44336" />
      )}
    </group>
  );
}

// ============================================================================
// Multi-Path Visualization (for multiple tracks)
// ============================================================================

interface MultiMotionPathProps {
  tracks: AnimationTrack[];
  currentTime?: number;
  selectedTrackId?: string | null;
  onKeyframeClick?: (trackId: string, keyframeIndex: number) => void;
  colorPalette?: string[];
}

export function MultiMotionPath({
  tracks,
  currentTime = 0,
  selectedTrackId,
  onKeyframeClick,
  colorPalette = ['#2196f3','#4caf50','#ff9800', '#e91e63', '#9c27b0'],
}: MultiMotionPathProps) {
  const positionTracks = tracks.filter((t) => t.type === 'position');

  return (
    <group name="multi-motion-paths">
      {positionTracks.map((track, index) => (
        <MotionPath
          key={track.id}
          track={track}
          currentTime={currentTime}
          config={{
            pathColor: colorPalette[index % colorPalette.length],
            keyframeColor: selectedTrackId === track.id ? '#f44336' : '#ff9800',
            showLabels: selectedTrackId === track.id}}
          onKeyframeClick={(kfIndex) => onKeyframeClick?.(track.id, kfIndex)}
        />
      ))}
    </group>
  );
}

// ============================================================================
// Camera Preview Path (shows camera frustum at keyframe positions)
// ============================================================================

interface CameraPreviewPathProps {
  track: AnimationTrack;
  fov?: number;
  aspect?: number;
  previewCount?: number;
}

export function CameraPreviewPath({
  track,
  fov = 50,
  aspect = 16 / 9,
  previewCount = 5,
}: CameraPreviewPathProps) {
  const frustumMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.3,
      }),
    []
  );

  if (track.type !=='position' || track.keyframes.length === 0) {
    return null;
  }

  // Select evenly spaced keyframes for preview
  const step = Math.max(1, Math.floor(track.keyframes.length / previewCount));
  const previewKeyframes = track.keyframes.filter((_, i) => i % step === 0);

  return (
    <group name="camera-preview-path">
      {previewKeyframes.map((kf, index) => {
        const pos = kf.value instanceof THREE.Vector3
          ? kf.value
          : new THREE.Vector3(kf.value.x, kf.value.y, kf.value.z);

        // Create mini frustum
        const near = 0.1;
        const far = 1;
        const halfFovRad = (fov * Math.PI) / 360;
        const halfHeight = Math.tan(halfFovRad) * far;
        const halfWidth = halfHeight * aspect;

        const points = [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(-halfWidth, halfHeight, -far),
          new THREE.Vector3(halfWidth, halfHeight, -far),
          new THREE.Vector3(halfWidth, -halfHeight, -far),
          new THREE.Vector3(-halfWidth, -halfHeight, -far),
          new THREE.Vector3(-halfWidth, halfHeight, -far),
        ];

        return (
          <group key={index} position={pos}>
            <lineLoop geometry={new THREE.BufferGeometry().setFromPoints(points)}>
              <primitive object={frustumMaterial} attach="material" />
            </lineLoop>
            {/* Near plane */}
            <line
              geometry={new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(halfWidth, halfHeight, -far),
              ])}
            >
              <primitive object={frustumMaterial} attach="material" />
            </line>
            <line
              geometry={new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(-halfWidth, halfHeight, -far),
              ])}
            >
              <primitive object={frustumMaterial} attach="material" />
            </line>
            <line
              geometry={new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(halfWidth, -halfHeight, -far),
              ])}
            >
              <primitive object={frustumMaterial} attach="material" />
            </line>
            <line
              geometry={new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(-halfWidth, -halfHeight, -far),
              ])}
            >
              <primitive object={frustumMaterial} attach="material" />
            </line>
          </group>
        );
      })}
    </group>
  );
}

export default MotionPath;

