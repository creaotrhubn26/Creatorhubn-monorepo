/**
 * MotionPathEditor3D - Interactive 3D keyframe position editor
 * 
 * Features:
 * - Draggable keyframe handles in 3D
 * - Catmull-Rom spline visualization
 * - Transform gizmos
 * - Snapping to grid
 * - Multi-select keyframes
 * - Real-time path preview
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Line, Html, TransformControls } from '@react-three/drei';
import { AnimationTrack, Keyframe } from '../../core/animation/SceneGraphAnimationEngine';

// ============================================================================
// Types
// ============================================================================

export interface MotionPathEditor3DProps {
  track: AnimationTrack;
  currentTime: number;
  selectedKeyframeIndex: number | null;
  gridSnap?: number;
  onSelectKeyframe: (index: number | null) => void;
  onUpdateKeyframe: (index: number, position: THREE.Vector3) => void;
  onAddKeyframe: (time: number, position: THREE.Vector3) => void;
  onDeleteKeyframe: (index: number) => void;
  showPath?: boolean;
  showKeyframes?: boolean;
  showLabels?: boolean;
  pathColor?: string;
  keyframeColor?: string;
  selectedColor?: string;
}

interface DraggableKeyframeProps {
  position: THREE.Vector3;
  index: number;
  time: number;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
  onDragStart: () => void;
  onDrag: (position: THREE.Vector3) => void;
  onDragEnd: () => void;
  keyframeColor: string;
  selectedColor: string;
  showLabel: boolean;
}

// ============================================================================
// Draggable Keyframe Component
// ============================================================================

function DraggableKeyframe({
  position,
  index,
  time,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onDragStart,
  onDrag,
  onDragEnd,
  keyframeColor,
  selectedColor,
  showLabel,
}: DraggableKeyframeProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { camera, gl } = useThree();

  const color = isSelected ? selectedColor : isHovered ? '#ff9800' : keyframeColor;
  const scale = isSelected ? 1.4 : isHovered ? 1.2 : 1;

  // Handle drag
  const handlePointerDown = useCallback((e: THREE.Event) => {
    e.stopPropagation();
    setIsDragging(true);
    onDragStart();
    onSelect();
    (gl.domElement as HTMLElement).style.cursor = 'grabbing';
  }, [onDragStart, onSelect, gl]);

  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onDragEnd();
      (gl.domElement as HTMLElement).style.cursor = 'auto';
    }
  }, [isDragging, onDragEnd, gl]);

  // Update cursor on hover
  useEffect(() => {
    if (isHovered && !isDragging) {
      (gl.domElement as HTMLElement).style.cursor = 'grab';
    } else if (!isDragging) {
      (gl.domElement as HTMLElement).style.cursor = 'auto';
    }
  }, [isHovered, isDragging, gl]);

  // Animate selected keyframe
  useFrame((state) => {
    if (meshRef.current && isSelected) {
      const pulse = Math.sin(state.clock.elapsedTime * 4) * 0.1 + 1;
      meshRef.current.scale.setScalar(scale * pulse * 0.15);
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(scale * 0.15);
    }
  });

  return (
    <group position={position}>
      {/* Main keyframe diamond */}
      <mesh
        ref={meshRef}
        rotation={[0, 0, Math.PI / 4]}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOver={() => onHover(true)}
        onPointerOut={() => onHover(false)}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.5 : isHovered ? 0.3 : 0.1}
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>

      {/* Glow ring for selected */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.25, 0.02, 8, 32]} />
          <meshBasicMaterial color={selectedColor} transparent opacity={0.5} />
        </mesh>
      )}

      {/* Ground projection line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([0, 0, 0, 0, -position.y, 0])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#444" transparent opacity={0.3} />
      </line>

      {/* Ground marker */}
      <mesh position={[0, -position.y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.05, 0.08, 16]} />
        <meshBasicMaterial color="#444" transparent opacity={0.5} />
      </mesh>

      {/* Label */}
      {showLabel && (isSelected || isHovered) && (
        <Html position={[0, 0.3, 0]} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(0,0,0,0.9)',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              border: `1px solid ${color}`}}
          >
            <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Keyframe #{index}</div>
            <div style={{ color: '#888' }}>
              Time: {time.toFixed(2)}s
            </div>
            <div style={{ color: '#888', fontSize: 9 }}>
              ({position.x.toFixed(2)}, {position.y.toFixed(2)}, {position.z.toFixed(2)})
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

// ============================================================================
// Path Segment Component
// ============================================================================

interface PathSegmentProps {
  points: THREE.Vector3[];
  color: string;
  opacity?: number;
}

function PathSegment({ points, color, opacity = 1 }: PathSegmentProps) {
  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={3}
      transparent
      opacity={opacity}
    />
  );
}

// ============================================================================
// Current Position Indicator
// ============================================================================

interface CurrentPositionProps {
  position: THREE.Vector3;
}

function CurrentPositionIndicator({ position }: CurrentPositionProps) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 2;
    }
  });

  return (
    <group position={position}>
      {/* Outer animated ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.02, 8, 32]} />
        <meshBasicMaterial color="#f44336" />
      </mesh>
      {/* Inner sphere */}
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color="#f44336"
          emissive="#f44336"
          emissiveIntensity={0.5}
        />
      </mesh>
      {/* Direction indicator */}
      <mesh position={[0, 0, 0.15]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.05, 0.1, 8]} />
        <meshBasicMaterial color="#f44336" />
      </mesh>
    </group>
  );
}

// ============================================================================
// Add Keyframe Placeholder
// ============================================================================

interface AddKeyframePlaceholderProps {
  position: THREE.Vector3;
  onClick: () => void;
}

function AddKeyframePlaceholder({ position, onClick }: AddKeyframePlaceholderProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position}>
      <mesh
        onClick={onClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={hovered ? 1.2 : 1}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial
          color={hovered ? '#4caf50' : '#666'}
          transparent
          opacity={hovered ? 0.8 : 0.4}
        />
      </mesh>
      {hovered && (
        <Html position={[0, 0.2, 0]} center style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: '#4caf50',
              color: '#fff',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 10}}
          >
            + Add Keyframe
          </div>
        </Html>
      )}
    </group>
  );
}

// ============================================================================
// Main Motion Path Editor 3D Component
// ============================================================================

export function MotionPathEditor3D({
  track,
  currentTime,
  selectedKeyframeIndex,
  gridSnap = 0.5,
  onSelectKeyframe,
  onUpdateKeyframe,
  onAddKeyframe,
  onDeleteKeyframe,
  showPath = true,
  showKeyframes = true,
  showLabels = true,
  pathColor = '#2196f3',
  keyframeColor = '#ff9800',
  selectedColor = '#f44336',
}: MotionPathEditor3DProps) {
  const [hoveredKeyframe, setHoveredKeyframe] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef<THREE.Vector3 | null>(null);
  const { camera, raycaster, scene } = useThree();

  // Extract positions from keyframes
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

  // Generate smooth curve points
  const curvePoints = useMemo(() => {
    if (keyframePositions.length < 2) return keyframePositions;

    const curve = new THREE.CatmullRomCurve3(keyframePositions, false'centripetal', 0.5);
    return curve.getPoints(100);
  }, [keyframePositions]);

  // Calculate current position on path
  const currentPosition = useMemo(() => {
    if (track.keyframes.length === 0 || track.type !== 'position') return null;

    // Find surrounding keyframes
    let prevIdx = 0;
    let nextIdx = track.keyframes.length - 1;

    for (let i = 0; i < track.keyframes.length - 1; i++) {
      if (currentTime >= track.keyframes[i].time && currentTime < track.keyframes[i + 1].time) {
        prevIdx = i;
        nextIdx = i + 1;
        break;
      }
    }

    const prevKf = track.keyframes[prevIdx];
    const nextKf = track.keyframes[nextIdx];

    const t = nextKf.time === prevKf.time
      ? 0
      : (currentTime - prevKf.time) / (nextKf.time - prevKf.time);

    const prevPos = keyframePositions[prevIdx];
    const nextPos = keyframePositions[nextIdx];

    if (!prevPos || !nextPos) return null;

    return new THREE.Vector3().lerpVectors(prevPos, nextPos, Math.max(0, Math.min(1, t)));
  }, [track, currentTime, keyframePositions]);

  // Midpoint placeholders for adding keyframes
  const midpoints = useMemo(() => {
    if (keyframePositions.length < 2) return [];

    return keyframePositions.slice(0, -1).map((pos, i) => ({
      position: new THREE.Vector3().addVectors(pos, keyframePositions[i + 1]).multiplyScalar(0.5),
      prevTime: track.keyframes[i].time,
      nextTime: track.keyframes[i + 1].time,
    }));
  }, [keyframePositions, track.keyframes]);

  // Handle keyframe drag
  const handleDrag = useCallback((index: number, newPosition: THREE.Vector3) => {
    // Apply grid snapping
    if (gridSnap > 0) {
      newPosition.x = Math.round(newPosition.x / gridSnap) * gridSnap;
      newPosition.y = Math.round(newPosition.y / gridSnap) * gridSnap;
      newPosition.z = Math.round(newPosition.z / gridSnap) * gridSnap;
    }
    onUpdateKeyframe(index, newPosition);
  }, [gridSnap, onUpdateKeyframe]);

  // Handle adding keyframe at midpoint
  const handleAddAtMidpoint = useCallback((prevTime: number, nextTime: number, position: THREE.Vector3) => {
    const newTime = (prevTime + nextTime) / 2;
    onAddKeyframe(newTime, position);
  }, [onAddKeyframe]);

  // Keyboard handler for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeyframeIndex !== null) {
        onDeleteKeyframe(selectedKeyframeIndex);
        onSelectKeyframe(null);
      }
      if (e.key === 'Escape') {
        onSelectKeyframe(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeyframeIndex, onDeleteKeyframe, onSelectKeyframe]);

  if (track.type !=='position') {
    return null;
  }

  return (
    <group name={`motion-path-editor-${track.id}`}>
      {/* Path visualization */}
      {showPath && curvePoints.length > 1 && (
        <>
          {/* Main path */}
          <PathSegment points={curvePoints} color={pathColor} />
          
          {/* Shadow path on ground */}
          <PathSegment
            points={curvePoints.map((p) => new THREE.Vector3(p.x, 0.01, p.z))}
            color="#333"
            opacity={0.3}
          />
        </>
      )}

      {/* Keyframe handles */}
      {showKeyframes &&
        keyframePositions.map((pos, index) => (
          <DraggableKeyframe
            key={`kf-${index}`}
            position={pos}
            index={index}
            time={track.keyframes[index].time}
            isSelected={selectedKeyframeIndex === index}
            isHovered={hoveredKeyframe === index}
            onSelect={() => onSelectKeyframe(index)}
            onHover={(h) => setHoveredKeyframe(h ? index : null)}
            onDragStart={() => {
              setIsDragging(true);
              dragStartPos.current = pos.clone();
            }}
            onDrag={(newPos) => handleDrag(index, newPos)}
            onDragEnd={() => setIsDragging(false)}
            keyframeColor={keyframeColor}
            selectedColor={selectedColor}
            showLabel={showLabels}
          />
        ))}

      {/* Add keyframe placeholders at midpoints */}
      {!isDragging &&
        midpoints.map((mp, index) => (
          <AddKeyframePlaceholder
            key={`add-${index}`}
            position={mp.position}
            onClick={() => handleAddAtMidpoint(mp.prevTime, mp.nextTime, mp.position)}
          />
        ))}

      {/* Current position indicator */}
      {currentPosition && <CurrentPositionIndicator position={currentPosition} />}

      {/* Transform controls for selected keyframe */}
      {selectedKeyframeIndex !== null && keyframePositions[selectedKeyframeIndex] && (
        <TransformControls
          position={keyframePositions[selectedKeyframeIndex]}
          mode="translate"
          size={0.5}
          onObjectChange={(e) => {
            if (e?.target) {
              const newPos = new THREE.Vector3();
              (e.target as any).object?.getWorldPosition(newPos);
              if (newPos) {
                handleDrag(selectedKeyframeIndex, newPos);
              }
            }
          }}
        />
      )}

      {/* Connection lines between keyframes */}
      {keyframePositions.length > 1 &&
        keyframePositions.slice(0, -1).map((pos, i) => (
          <line key={`conn-${i}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([
                  pos.x, pos.y, pos.z,
                  keyframePositions[i + 1].x, keyframePositions[i + 1].y, keyframePositions[i + 1].z,
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#444" transparent opacity={0.2} />
          </line>
        ))}
    </group>
  );
}

export default MotionPathEditor3D;

