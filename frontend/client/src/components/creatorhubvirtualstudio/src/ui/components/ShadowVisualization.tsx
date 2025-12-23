/**
 * Shadow Visualization Component
 * 
 * Visualizes shadows and highlights in the 3D scene
 */

import React from 'react';
import * as THREE from 'three';
import type { ShadowInfo, HighlightInfo } from'@/core/services/shadowAnalysisService';

interface ShadowVisualizationProps {
  shadows: ShadowInfo[];
  highlights: HighlightInfo[];
  subjectPosition: [number, number, number];
  showShadows: boolean;
  showHighlights: boolean;
}

export function ShadowVisualization({
  shadows,
  highlights,
  subjectPosition,
  showShadows,
  showHighlights,
}: ShadowVisualizationProps) {
  return (
    <group>
      {/* Shadow Direction Indicators */}
      {showShadows &&
        shadows.map((shadow, index) => (
          <ShadowDirectionIndicator
            key={`shadow-${shadow.lightId}-${index}`}
            shadow={shadow}
            subjectPosition={subjectPosition}
          />
        ))}

      {/* Highlight Indicators */}
      {showHighlights &&
        highlights.map((highlight, index) => (
          <HighlightIndicator
            key={`highlight-${highlight.lightId}-${index}`}
            highlight={highlight}
          />
        ))}
    </group>
  );
}

/**
 * Shadow Direction Indicator
 * Shows the direction of shadows cast by each light
 */
function ShadowDirectionIndicator({
  shadow,
  subjectPosition,
}: {
  shadow: ShadowInfo;
  subjectPosition: [number, number, number];
}) {
  // Create arrow showing shadow direction
  const arrowLength = 1.5;
  const endPosition: [number, number, number] = [
    subjectPosition[0] + shadow.direction[0] * arrowLength,
    subjectPosition[1] + shadow.direction[1] * arrowLength,
    subjectPosition[2] + shadow.direction[2] * arrowLength,
  ];

  // Create line geometry
  const points = [
    new THREE.Vector3(...subjectPosition),
    new THREE.Vector3(...endPosition),
  ];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

  return (
    <group>
      {/* Shadow direction line */}
      <line geometry={lineGeometry}>
        <lineBasicMaterial
          color={shadow.color}
          opacity={shadow.intensity * 0.6}
          transparent
          linewidth={2}
        />
      </line>

      {/* Shadow cone on ground */}
      <mesh
        position={[endPosition[0], 0.01, endPosition[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.3 * (1 - shadow.softness), 32]} />
        <meshBasicMaterial
          color={shadow.color}
          opacity={shadow.intensity * 0.4}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Highlight Indicator
 * Shows areas of high intensity that may be clipping
 */
function HighlightIndicator({ highlight }: { highlight: HighlightInfo }) {
  if (!highlight.isClipping) return null;

  return (
    <group>
      {/* Warning sphere at light position */}
      <mesh position={highlight.position}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial
          color="#ff0000"
          opacity={0.6}
          transparent
        />
      </mesh>

      {/* Pulsing ring */}
      <mesh position={highlight.position} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.25, 32]} />
        <meshBasicMaterial
          color="#ff0000"
          opacity={0.8}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Animated Highlight Warning
 * Pulsing animation for clipping highlights
 */
export function AnimatedHighlightWarning({ position }: { position: [number, number, number] }) {
  const meshRef = React.useRef<THREE.Mesh>(null);

  // Animate pulsing
  React.useEffect(() => {
    if (!meshRef.current) return;

    let frame = 0;
    const animate = () => {
      if (!meshRef.current) return;
      frame += 0.05;
      const scale = 1 + Math.sin(frame) * 0.2;
      meshRef.current.scale.set(scale, scale, scale);
      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[0.1, 16, 16]} />
      <meshBasicMaterial color="#ff0000" opacity={0.5} transparent />
    </mesh>
  );
}

