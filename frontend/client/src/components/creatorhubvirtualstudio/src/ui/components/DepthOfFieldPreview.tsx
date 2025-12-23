/**
 * Depth of Field Preview
 * 
 * Visual guides for depth of field:
 * - Focus Plane
 * - In-Focus Zone (DoF volume)
 * - Hyperfocal Distance
 * - Near/Far Focus Limits
 */

import React, { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';

interface DepthOfFieldPreviewProps {
  showFocusPlane?: boolean;
  showInFocusZone?: boolean;
  showHyperfocalDistance?: boolean;
  showNearFarLimits?: boolean;
  cameraPosition: [number, number, number];
  focusDistance: number;
  focalLength: number; // in mm
  aperture: number; // f-number
  sensorWidth?: number; // in mm, default 36mm (full frame)
  circleOfConfusion?: number; // in mm, default 0.03mm
}

// Calculate depth of field parameters
function calculateDoF(
  focalLength: number,
  aperture: number,
  focusDistance: number,
  sensorWidth: number = 36,
  circleOfConfusion: number = 0.03
) {
  // Convert focal length to meters
  const f = focalLength / 1000;
  const coc = circleOfConfusion / 1000;
  const d = focusDistance;
  
  // Hyperfocal distance
  const H = (f * f) / (aperture * coc) + f;
  
  // Near focus limit
  const nearLimit = d > H ? H / 2 : (d * (H - f)) / (H + d - 2 * f);
  
  // Far focus limit
  const farLimit = d > H ? Infinity : (d * (H - f)) / (H - d);
  
  // Total depth of field
  const totalDoF = farLimit === Infinity ? Infinity : farLimit - nearLimit;
  
  return {
    hyperfocalDistance: H,
    nearLimit: Math.max(0.1, nearLimit),
    farLimit: Math.min(100, farLimit),
    totalDoF,
  };
}

// Focus Plane Visualization
const FocusPlane: React.FC<{
  cameraPosition: [number, number, number];
  focusDistance: number;
  cameraDirection?: THREE.Vector3;
}> = ({ cameraPosition, focusDistance }) => {
  const planePosition = useMemo(() => {
    const cam = new THREE.Vector3(...cameraPosition);
    // Assume camera looks toward origin or slightly down
    const lookAt = new THREE.Vector3(0, 1, 0);
    const direction = lookAt.sub(cam).normalize();
    
    const planeCenter = cam.clone().add(direction.multiplyScalar(focusDistance));
    return [planeCenter.x, planeCenter.y, planeCenter.z] as [number, number, number];
  }, [cameraPosition, focusDistance]);

  return (
    <group position={planePosition}>
      {/* Focus plane */}
      <mesh rotation={[0, 0, 0]}>
        <planeGeometry args={[3, 2]} />
        <meshBasicMaterial 
          color="#00ff88" 
          transparent 
          opacity={0.15} 
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Focus plane border */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(3, 2)]} />
        <lineBasicMaterial color="#00ff88" linewidth={2} />
      </lineSegments>
      {/* Focus distance label */}
      <Html position={[0, 1.2, 0]} center>
        <div style={{
          background: '#00ff88',
          color: '#000',
          padding: '4px 10px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold'}}>
          Focus: {focusDistance.toFixed(2)}m
        </div>
      </Html>
    </group>
  );
};

// In-Focus Zone (DoF Volume)
const InFocusZone: React.FC<{
  cameraPosition: [number, number, number];
  nearLimit: number;
  farLimit: number;
}> = ({ cameraPosition, nearLimit, farLimit }) => {
  const zoneGeometry = useMemo(() => {
    const cam = new THREE.Vector3(...cameraPosition);
    const lookAt = new THREE.Vector3(0, 1, 0);
    const direction = lookAt.sub(cam).normalize();
    
    const nearCenter = cam.clone().add(direction.clone().multiplyScalar(nearLimit));
    const farCenter = cam.clone().add(direction.clone().multiplyScalar(Math.min(farLimit, 10)));
    
    return {
      nearPosition: [nearCenter.x, nearCenter.y, nearCenter.z] as [number, number, number],
      farPosition: [farCenter.x, farCenter.y, farCenter.z] as [number, number, number],
      depth: Math.min(farLimit, 10) - nearLimit,
    };
  }, [cameraPosition, nearLimit, farLimit]);

  const width = 3;
  const height = 2;

  return (
    <group>
      {/* Near limit plane */}
      <mesh position={zoneGeometry.nearPosition}>
        <planeGeometry args={[width * 0.8, height * 0.8]} />
        <meshBasicMaterial 
          color="#ffcc00" 
          transparent 
          opacity={0.1} 
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Far limit plane */}
      <mesh position={zoneGeometry.farPosition}>
        <planeGeometry args={[width * 1.2, height * 1.2]} />
        <meshBasicMaterial 
          color="#ff6600" 
          transparent 
          opacity={0.1} 
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* Connecting lines (frustum edges) */}
      {[
        [-width * 0.4, -height * 0.4],
        [width * 0.4, -height * 0.4],
        [width * 0.4, height * 0.4],
        [-width * 0.4, height * 0.4],
      ].map((corner, i) => {
        const nearCorner: [number, number, number] = [
          zoneGeometry.nearPosition[0] + corner[0],
          zoneGeometry.nearPosition[1] + corner[1],
          zoneGeometry.nearPosition[2],
        ];
        const farCorner: [number, number, number] = [
          zoneGeometry.farPosition[0] + corner[0] * 1.5,
          zoneGeometry.farPosition[1] + corner[1] * 1.5,
          zoneGeometry.farPosition[2],
        ];
        return (
          <Line
            key={i}
            points={[nearCorner, farCorner]}
            color="#888888"
            lineWidth={1}
            dashed
            dashSize={0.1}
            dashScale={5}
          />
        );
      })}
      
      {/* Labels */}
      <Html position={zoneGeometry.nearPosition} center>
        <div style={{
          background: 'rgba(255,204,0,0.9)',
          color: '#000',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 'bold'}}>
          Near: {nearLimit.toFixed(2)}m
        </div>
      </Html>
      <Html position={zoneGeometry.farPosition} center>
        <div style={{
          background: 'rgba(255,102,0,0.9)',
          color: '#fff',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '9px',
          fontWeight: 'bold'}}>
          Far: {farLimit > 50 ? 'Infinity' : `${farLimit.toFixed(2)}m`}
        </div>
      </Html>
    </group>
  );
};

// Hyperfocal Distance Marker
const HyperfocalDistanceMarker: React.FC<{
  cameraPosition: [number, number, number];
  hyperfocalDistance: number;
}> = ({ cameraPosition, hyperfocalDistance }) => {
  const markerPosition = useMemo(() => {
    const cam = new THREE.Vector3(...cameraPosition);
    const lookAt = new THREE.Vector3(0, 1, 0);
    const direction = lookAt.sub(cam).normalize();
    
    // Cap at reasonable distance for visualization
    const displayDistance = Math.min(hyperfocalDistance, 20);
    const center = cam.clone().add(direction.multiplyScalar(displayDistance));
    
    return [center.x, center.y, center.z] as [number, number, number];
  }, [cameraPosition, hyperfocalDistance]);

  // Create ground ring at hyperfocal distance
  const ringPoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const segments = 48;
    const radius = Math.min(hyperfocalDistance, 20);
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push([
        cameraPosition[0] + Math.cos(angle) * radius,
        0.02,
        cameraPosition[2] + Math.sin(angle) * radius,
      ]);
    }
    return points;
  }, [cameraPosition, hyperfocalDistance]);

  return (
    <group>
      {/* Hyperfocal ring on ground */}
      <Line
        points={ringPoints}
        color="#ff00ff"
        lineWidth={2}
        dashed
        dashSize={0.2}
        dashScale={5}
      />
      
      {/* Vertical marker */}
      <Line
        points={[
          [markerPosition[0], 0, markerPosition[2]],
          [markerPosition[0], 3, markerPosition[2]],
        ]}
        color="#ff00ff"
        lineWidth={1}
        dashed
        dashSize={0.1}
        dashScale={10}
      />
      
      {/* Label */}
      <Html position={[markerPosition[0], 3.2, markerPosition[2]]} center>
        <div style={{
          background: 'rgba(255,0,255,0.9)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 'bold'}}>
          Hyperfocal: {hyperfocalDistance > 100 ? `${(hyperfocalDistance/1000).toFixed(1)}km` : `${hyperfocalDistance.toFixed(1)}m`}
        </div>
      </Html>
    </group>
  );
};

// Near/Far Focus Limit Lines on Ground
const NearFarLimitLines: React.FC<{
  cameraPosition: [number, number, number];
  nearLimit: number;
  farLimit: number;
}> = ({ cameraPosition, nearLimit, farLimit }) => {
  const nearRingPoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const segments = 48;
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push([
        cameraPosition[0] + Math.cos(angle) * nearLimit,
        0.02,
        cameraPosition[2] + Math.sin(angle) * nearLimit,
      ]);
    }
    return points;
  }, [cameraPosition, nearLimit]);

  const farRingPoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const segments = 48;
    const displayFar = Math.min(farLimit, 10);
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push([
        cameraPosition[0] + Math.cos(angle) * displayFar,
        0.02,
        cameraPosition[2] + Math.sin(angle) * displayFar,
      ]);
    }
    return points;
  }, [cameraPosition, farLimit]);

  return (
    <group>
      {/* Near limit ring */}
      <Line
        points={nearRingPoints}
        color="#ffcc00"
        lineWidth={2}
      />
      
      {/* Far limit ring */}
      <Line
        points={farRingPoints}
        color="#ff6600"
        lineWidth={2}
      />
      
      {/* DoF range indicator */}
      <Html position={[cameraPosition[0] + nearLimit + 0.5, 0.5, cameraPosition[2]]} center>
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '10px',
          border: '1px solid rgba(255,255,255,0.2)'}}>
          <div style={{ color: '#ffcc00', marginBottom: '3px' }}>Near: {nearLimit.toFixed(2)}m</div>
          <div style={{ color: '#ff6600', marginBottom: '3px' }}>Far: {farLimit > 50 ? 'INF' : `${farLimit.toFixed(2)}m`}</div>
          <div style={{ color: '#00ff88', fontWeight: 'bold' }}>
            DoF: {farLimit > 50 ?'INF' : `${(farLimit - nearLimit).toFixed(2)}m`}
          </div>
        </div>
      </Html>
    </group>
  );
};

// Main Depth of Field Preview Component
export const DepthOfFieldPreview: React.FC<DepthOfFieldPreviewProps> = ({
  showFocusPlane = true,
  showInFocusZone = true,
  showHyperfocalDistance = false,
  showNearFarLimits = true,
  cameraPosition,
  focusDistance,
  focalLength,
  aperture,
  sensorWidth = 36,
  circleOfConfusion = 0.03,
}) => {
  const dofParams = useMemo(() => {
    return calculateDoF(focalLength, aperture, focusDistance, sensorWidth, circleOfConfusion);
  }, [focalLength, aperture, focusDistance, sensorWidth, circleOfConfusion]);

  return (
    <group>
      {showFocusPlane && (
        <FocusPlane
          cameraPosition={cameraPosition}
          focusDistance={focusDistance}
        />
      )}
      
      {showInFocusZone && (
        <InFocusZone
          cameraPosition={cameraPosition}
          nearLimit={dofParams.nearLimit}
          farLimit={dofParams.farLimit}
        />
      )}
      
      {showHyperfocalDistance && (
        <HyperfocalDistanceMarker
          cameraPosition={cameraPosition}
          hyperfocalDistance={dofParams.hyperfocalDistance}
        />
      )}
      
      {showNearFarLimits && (
        <NearFarLimitLines
          cameraPosition={cameraPosition}
          nearLimit={dofParams.nearLimit}
          farLimit={dofParams.farLimit}
        />
      )}
    </group>
  );
};

export default DepthOfFieldPreview;

