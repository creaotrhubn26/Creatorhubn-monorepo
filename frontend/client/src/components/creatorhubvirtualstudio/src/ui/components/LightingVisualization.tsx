/**
 * Lighting Visualization Guides
 * 
 * Visual guides for lighting setup:
 * - Shadow Direction
 * - Light Fall-off (Inverse Square Law)
 * - Catchlight Preview
 * - Lighting Ratio Indicator
 * - Reflector Bounce Path
 */

import React, { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';

interface LightingVisualizationProps {
  showShadowDirection?: boolean;
  showLightFalloff?: boolean;
  showCatchlightPreview?: boolean;
  showLightingRatio?: boolean;
  showReflectorBounce?: boolean;
  keyLightPosition: [number, number, number];
  fillLightPosition?: [number, number, number];
  reflectorPosition?: [number, number, number];
  subjectPosition: [number, number, number];
  subjectHeight?: number;
  keyLightPower?: number;
  fillLightPower?: number;
}

// Shadow Direction Arrow
const ShadowDirectionGuide: React.FC<{
  lightPosition: [number, number, number];
  subjectPosition: [number, number, number];
}> = ({ lightPosition, subjectPosition }) => {
  const shadowDirection = useMemo(() => {
    const light = new THREE.Vector3(...lightPosition);
    const subject = new THREE.Vector3(...subjectPosition);
    const direction = subject.clone().sub(light).normalize();
    
    // Project shadow onto ground (y=0)
    const shadowLength = 2;
    const shadowEnd = subject.clone().add(direction.multiplyScalar(shadowLength));
    shadowEnd.y = 0;
    
    return {
      start: [subject.x, 0.02, subject.z] as [number, number, number],
      end: [shadowEnd.x, 0.02, shadowEnd.z] as [number, number, number],
    };
  }, [lightPosition, subjectPosition]);

  const arrowHead = useMemo(() => {
    const start = new THREE.Vector3(...shadowDirection.start);
    const end = new THREE.Vector3(...shadowDirection.end);
    const dir = end.clone().sub(start).normalize();
    const perpendicular = new THREE.Vector3(-dir.z, 0, dir.x);
    
    const arrowSize = 0.15;
    const arrowBase = end.clone().sub(dir.clone().multiplyScalar(arrowSize));
    
    return [
      shadowDirection.end,
      [arrowBase.x + perpendicular.x * arrowSize * 0.5, 0.02, arrowBase.z + perpendicular.z * arrowSize * 0.5] as [number, number, number],
      [arrowBase.x - perpendicular.x * arrowSize * 0.5, 0.02, arrowBase.z - perpendicular.z * arrowSize * 0.5] as [number, number, number],
    ];
  }, [shadowDirection]);

  return (
    <group>
      {/* Shadow line */}
      <Line
        points={[shadowDirection.start, shadowDirection.end]}
        color="#333333"
        lineWidth={3}
        dashed
        dashSize={0.1}
        dashScale={5}
      />
      {/* Arrow head */}
      <mesh position={[shadowDirection.end[0], 0.02, shadowDirection.end[2]]}>
        <coneGeometry args={[0.08, 0.2, 8]} />
        <meshBasicMaterial color="#333333" />
      </mesh>
      {/* Shadow label */}
      <Html position={shadowDirection.end} center>
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          color: '#888',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '10px',
          whiteSpace: 'nowrap'}}>
          Shadow
        </div>
      </Html>
    </group>
  );
};

// Light Fall-off Visualization (Inverse Square Law)
const LightFalloffGuide: React.FC<{
  lightPosition: [number, number, number];
  subjectPosition: [number, number, number];
  maxDistance?: number;
}> = ({ lightPosition, subjectPosition, maxDistance = 4 }) => {
  const falloffRings = useMemo(() => {
    const rings: { distance: number; intensity: number; points: [number, number, number][] }[] = [];
    const light = new THREE.Vector3(...lightPosition);
    const subject = new THREE.Vector3(...subjectPosition);
    const direction = subject.clone().sub(light).normalize();
    
    // Calculate initial distance
    const initialDistance = light.distanceTo(subject);
    
    // Create rings at 1x, 2x, 3x, 4x initial distance
    [1, 1.5, 2, 3].forEach((multiplier) => {
      const distance = initialDistance * multiplier;
      if (distance > maxDistance * 1.5) return;
      
      // Intensity falls off with square of distance
      const intensity = 1 / (multiplier * multiplier);
      
      const center = light.clone().add(direction.clone().multiplyScalar(distance));
      const points: [number, number, number][] = [];
      const segments = 32;
      const radius = 0.3 + (multiplier - 1) * 0.2;
      
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        // Create ring perpendicular to light direction
        const perpX = new THREE.Vector3(1, 0, 0);
        if (Math.abs(direction.dot(perpX)) > 0.9) {
          perpX.set(0, 1, 0);
        }
        const perpY = direction.clone().cross(perpX).normalize();
        perpX.crossVectors(perpY, direction).normalize();
        
        const point = center.clone()
          .add(perpX.clone().multiplyScalar(Math.cos(angle) * radius))
          .add(perpY.clone().multiplyScalar(Math.sin(angle) * radius));
        
        points.push([point.x, point.y, point.z]);
      }
      
      rings.push({ distance, intensity, points });
    });
    
    return rings;
  }, [lightPosition, subjectPosition, maxDistance]);

  return (
    <group>
      {falloffRings.map((ring, i) => (
        <group key={i}>
          <Line
            points={ring.points}
            color={`hsl(${60 - ring.intensity * 60}, 100%, 50%)`}
            lineWidth={2}
            transparent
            opacity={ring.intensity}
          />
          <Html position={ring.points[0]} center>
            <div style={{
              background: 'rgba(0,0,0,0.8)',
              color: `hsl(${60 - ring.intensity * 60}, 100%, 50%)`,
              padding: '2px 5px',
              borderRadius: '3px',
              fontSize: '9px',
              whiteSpace: 'nowrap'}}>
              {Math.round(ring.intensity * 100)}%
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

// Catchlight Preview (shows where catchlights will appear in eyes)
const CatchlightPreview: React.FC<{
  lightPosition: [number, number, number];
  subjectPosition: [number, number, number];
  subjectHeight: number;
}> = ({ lightPosition, subjectPosition, subjectHeight }) => {
  const catchlightPosition = useMemo(() => {
    const light = new THREE.Vector3(...lightPosition);
    const eyeLevel = new THREE.Vector3(subjectPosition[0], subjectHeight - 0.15, subjectPosition[2]);
    
    // Calculate direction from eye to light
    const toLight = light.clone().sub(eyeLevel).normalize();
    
    // Catchlight position relative to eye (simplified)
    // In real eyes, this would be a reflection calculation
    const catchlightOffset = 0.02; // Small offset for visualization
    const catchlight = eyeLevel.clone().add(toLight.clone().multiplyScalar(catchlightOffset));
    
    return {
      left: [catchlight.x - 0.03, catchlight.y, catchlight.z + 0.1] as [number, number, number],
      right: [catchlight.x + 0.03, catchlight.y, catchlight.z + 0.1] as [number, number, number],
      angle: Math.atan2(toLight.x, toLight.z) * (180 / Math.PI),
    };
  }, [lightPosition, subjectPosition, subjectHeight]);

  return (
    <group>
      {/* Left eye catchlight */}
      <mesh position={catchlightPosition.left}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Right eye catchlight */}
      <mesh position={catchlightPosition.right}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Info label */}
      <Html position={[subjectPosition[0], subjectHeight + 0.3, subjectPosition[2]]} center>
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          color: '#333',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'}}>
          Catchlight: {catchlightPosition.angle > 0 ? 'R' : 'L'} {Math.abs(Math.round(catchlightPosition.angle))}
        </div>
      </Html>
    </group>
  );
};

// Lighting Ratio Indicator
const LightingRatioIndicator: React.FC<{
  keyLightPower: number;
  fillLightPower: number;
  keyLightPosition: [number, number, number];
  fillLightPosition: [number, number, number];
  subjectPosition: [number, number, number];
}> = ({ keyLightPower, fillLightPower, keyLightPosition, fillLightPosition, subjectPosition }) => {
  const ratioInfo = useMemo(() => {
    const keyDist = new THREE.Vector3(...keyLightPosition).distanceTo(new THREE.Vector3(...subjectPosition));
    const fillDist = new THREE.Vector3(...fillLightPosition).distanceTo(new THREE.Vector3(...subjectPosition));
    
    // Calculate effective intensity at subject (inverse square law)
    const keyIntensity = keyLightPower / (keyDist * keyDist);
    const fillIntensity = fillLightPower / (fillDist * fillDist);
    
    // Calculate ratio
    const ratio = keyIntensity / Math.max(fillIntensity, 0.01);
    
    // Determine lighting style
    let style = 'Flat';
    if (ratio > 8) style = 'Dramatic';
    else if (ratio > 4) style = 'Contrasty';
    else if (ratio > 2) style = 'Natural';
    else if (ratio > 1.5) style = 'Soft';
    
    return {
      ratio: ratio.toFixed(1),
      ratioSimple: `${Math.round(ratio)}:1`,
      style,
      keyStops: Math.log2(ratio).toFixed(1),
    };
  }, [keyLightPower, fillLightPower, keyLightPosition, fillLightPosition, subjectPosition]);

  return (
    <Html position={[subjectPosition[0] + 1.5, subjectPosition[1] + 1, subjectPosition[2]]} center>
      <div style={{
        background: 'linear-gradient(135deg, rgba(40,40,40,0.95), rgba(20,20,20,0.95))',
        color: '#fff',
        padding: '10px 15px',
        borderRadius: '8px',
        fontSize: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.1)'}}>
        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#ffcc00' }}>
          Lighting Ratio
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{ratioInfo.ratioSimple}</div>
            <div style={{ fontSize: '10px', color: '#888' }}>Key:Fill</div>
          </div>
          <div>
            <div style={{ fontSize: '14px' }}>{ratioInfo.style}</div>
            <div style={{ fontSize: '10px', color: '#888' }}>{ratioInfo.keyStops} stops</div>
          </div>
        </div>
      </div>
    </Html>
  );
};

// Reflector Bounce Path
const ReflectorBouncePath: React.FC<{
  keyLightPosition: [number, number, number];
  reflectorPosition: [number, number, number];
  subjectPosition: [number, number, number];
}> = ({ keyLightPosition, reflectorPosition, subjectPosition }) => {
  const bouncePath = useMemo(() => {
    const light = new THREE.Vector3(...keyLightPosition);
    const reflector = new THREE.Vector3(...reflectorPosition);
    const subject = new THREE.Vector3(...subjectPosition);
    
    // Calculate reflection
    const toReflector = reflector.clone().sub(light).normalize();
    const reflectorNormal = subject.clone().sub(reflector).normalize();
    
    // Incident ray hits reflector
    const incidentEnd = reflector.clone();
    
    // Reflected ray goes to subject
    const reflectedEnd = subject.clone();
    
    return {
      incident: {
        start: [light.x, light.y, light.z] as [number, number, number],
        end: [incidentEnd.x, incidentEnd.y, incidentEnd.z] as [number, number, number],
      },
      reflected: {
        start: [incidentEnd.x, incidentEnd.y, incidentEnd.z] as [number, number, number],
        end: [reflectedEnd.x, reflectedEnd.y, reflectedEnd.z] as [number, number, number],
      },
    };
  }, [keyLightPosition, reflectorPosition, subjectPosition]);

  return (
    <group>
      {/* Incident ray (from light to reflector) */}
      <Line
        points={[bouncePath.incident.start, bouncePath.incident.end]}
        color="#ffcc00"
        lineWidth={2}
        dashed
        dashSize={0.15}
        dashScale={5}
      />
      {/* Reflected ray (from reflector to subject) */}
      <Line
        points={[bouncePath.reflected.start, bouncePath.reflected.end]}
        color="#88ccff"
        lineWidth={2}
      />
      {/* Reflector marker */}
      <mesh position={bouncePath.incident.end}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshBasicMaterial color="#silver" side={THREE.DoubleSide} transparent opacity={0.6} />
      </mesh>
      {/* Labels */}
      <Html position={bouncePath.incident.end} center>
        <div style={{
          background: 'rgba(136,204,255,0.9)',
          color: '#000',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px'}}>
          Bounce
        </div>
      </Html>
    </group>
  );
};

// Main Lighting Visualization Component
export const LightingVisualization: React.FC<LightingVisualizationProps> = ({
  showShadowDirection = true,
  showLightFalloff = true,
  showCatchlightPreview = true,
  showLightingRatio = true,
  showReflectorBounce = false,
  keyLightPosition,
  fillLightPosition = [-1.5, 1.5, 1.5],
  reflectorPosition,
  subjectPosition,
  subjectHeight = 1.7,
  keyLightPower = 1,
  fillLightPower = 0.5,
}) => {
  return (
    <group>
      {showShadowDirection && (
        <ShadowDirectionGuide
          lightPosition={keyLightPosition}
          subjectPosition={subjectPosition}
        />
      )}
      
      {showLightFalloff && (
        <LightFalloffGuide
          lightPosition={keyLightPosition}
          subjectPosition={subjectPosition}
        />
      )}
      
      {showCatchlightPreview && (
        <CatchlightPreview
          lightPosition={keyLightPosition}
          subjectPosition={subjectPosition}
          subjectHeight={subjectHeight}
        />
      )}
      
      {showLightingRatio && fillLightPosition && (
        <LightingRatioIndicator
          keyLightPower={keyLightPower}
          fillLightPower={fillLightPower}
          keyLightPosition={keyLightPosition}
          fillLightPosition={fillLightPosition}
          subjectPosition={subjectPosition}
        />
      )}
      
      {showReflectorBounce && reflectorPosition && (
        <ReflectorBouncePath
          keyLightPosition={keyLightPosition}
          reflectorPosition={reflectorPosition}
          subjectPosition={subjectPosition}
        />
      )}
    </group>
  );
};

export default LightingVisualization;

