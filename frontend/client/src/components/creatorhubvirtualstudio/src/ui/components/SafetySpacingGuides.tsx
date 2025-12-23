/**
 * Safety & Spacing Guides
 * 
 * Visual guides for studio safety and spacing:
 * - Equipment Clearance Zones
 * - Cable Routes
 * - Movement Zones
 * - Hot Light Warning Radius
 */

import React, { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';

interface SafetySpacingGuidesProps {
  showEquipmentClearance?: boolean;
  showCableRoutes?: boolean;
  showMovementZones?: boolean;
  showHotLightWarning?: boolean;
  subjectPosition?: [number, number, number];
  equipmentPositions?: Array<{
    position: [number, number, number];
    type: 'light_stand' | 'c_stand' | 'boom' | 'tripod';
    name?: string;
  }>;
  hotLightPositions?: Array<{
    position: [number, number, number];
    power: number; // watts
    name?: string;
  }>;
}

// Equipment Clearance Zones
const EquipmentClearanceZone: React.FC<{
  position: [number, number, number];
  type: 'light_stand' | 'c_stand' | 'boom' | 'tripod';
  name?: string;
}> = ({ position, type, name }) => {
  const clearanceRadius = useMemo(() => {
    switch (type) {
      case 'c_stand': return 1.0;
      case 'boom': return 1.5;
      case 'light_stand': return 0.6;
      case 'tripod': return 0.8;
      default: return 0.5;
    }
  }, [type]);

  const color = useMemo(() => {
    switch (type) {
      case 'c_stand': return '#ff8800';
      case 'boom': return '#ff4444';
      case 'light_stand': return '#ffcc00';
      case 'tripod': return '#88ff88';
      default: return '#888888';
    }
  }, [type]);

  // Create circle on ground
  const circlePoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push([
        position[0] + Math.cos(angle) * clearanceRadius,
        0.02,
        position[2] + Math.sin(angle) * clearanceRadius,
      ]);
    }
    return points;
  }, [position, clearanceRadius]);

  return (
    <group>
      {/* Clearance circle */}
      <Line
        points={circlePoints}
        color={color}
        lineWidth={2}
        dashed
        dashSize={0.1}
        dashScale={5}
      />
      
      {/* Center marker */}
      <mesh position={[position[0], 0.02, position[2]]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      
      {/* Warning zone fill */}
      <mesh position={[position[0], 0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[clearanceRadius * 0.8, clearanceRadius, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Label */}
      <Html position={[position[0], 0.3, position[2]]} center>
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          color: color,
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '9px',
          textAlign: 'center',
          border: `1px solid ${color}`}}>
          <div style={{ fontWeight: 'bold' }}>{name || type.replace('_', ', ')}</div>
          <div style={{ fontSize: '8px' }}>Clear: {clearanceRadius}m</div>
        </div>
      </Html>
    </group>
  );
};

// Cable Route Visualization
const CableRoute: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  via?: [number, number, number][];
}> = ({ start, end, via = [] }) => {
  const routePoints = useMemo(() => {
    const points: [number, number, number][] = [
      [start[0], 0.02, start[2]],
      ...via.map(p => [p[0], 0.02, p[2]] as [number, number, number]),
      [end[0], 0.02, end[2]],
    ];
    return points;
  }, [start, end, via]);

  return (
    <group>
      {/* Main cable line */}
      <Line
        points={routePoints}
        color="#444444"
        lineWidth={4}
      />
      
      {/* Cable tape markers (stripes) */}
      <Line
        points={routePoints}
        color="#ffcc00"
        lineWidth={2}
        dashed
        dashSize={0.3}
        dashScale={3}
      />
      
      {/* Direction arrows */}
      {routePoints.slice(0, -1).map((point, i) => {
        const nextPoint = routePoints[i + 1];
        const midX = (point[0] + nextPoint[0]) / 2;
        const midZ = (point[2] + nextPoint[2]) / 2;
        const angle = Math.atan2(nextPoint[2] - point[2], nextPoint[0] - point[0]);
        
        return (
          <mesh key={i} position={[midX, 0.03, midZ]} rotation={[-Math.PI / 2, 0, angle]}>
            <coneGeometry args={[0.05, 0.15, 3]} />
            <meshBasicMaterial color="#ffcc00" />
          </mesh>
        );
      })}
      
      {/* Cable label */}
      <Html position={[routePoints[Math.floor(routePoints.length / 2)][0], 0.2, routePoints[Math.floor(routePoints.length / 2)][2]]} center>
        <div style={{
          background: 'rgba(68,68,68,0.9)',
          color: '#ffcc00',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '8px'}}>
          CABLE ROUTE
        </div>
      </Html>
    </group>
  );
};

// Movement Zone
const MovementZone: React.FC<{
  center: [number, number, number];
  radius: number;
  type: 'subject' | 'photographer' | 'assistant';
}> = ({ center, radius, type }) => {
  const config = useMemo(() => {
    switch (type) {
      case 'subject':
        return { color: '#00ff88', label: 'Subject Zone', opacity: 0.15 };
      case 'photographer':
        return { color: '#4488ff', label: 'Photographer Zone', opacity: 0.1 };
      case 'assistant':
        return { color: '#ffaa00', label: 'Assistant Zone', opacity: 0.1 };
      default:
        return { color: '#888888', label: 'Zone', opacity: 0.1 };
    }
  }, [type]);

  const circlePoints = useMemo(() => {
    const points: [number, number, number][] = [];
    const segments = 48;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push([
        center[0] + Math.cos(angle) * radius,
        0.02,
        center[2] + Math.sin(angle) * radius,
      ]);
    }
    return points;
  }, [center, radius]);

  return (
    <group>
      {/* Zone fill */}
      <mesh position={[center[0], 0.01, center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 48]} />
        <meshBasicMaterial color={config.color} transparent opacity={config.opacity} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Zone border */}
      <Line
        points={circlePoints}
        color={config.color}
        lineWidth={2}
      />
      
      {/* Zone label */}
      <Html position={[center[0], 0.3, center[2] + radius - 0.2]} center>
        <div style={{
          background: config.color,
          color: '#000',
          padding: '3px 10px',
          borderRadius: '12px',
          fontSize: '10px',
          fontWeight: 'bold'}}>
          {config.label}
        </div>
      </Html>
    </group>
  );
};

// Hot Light Warning
const HotLightWarning: React.FC<{
  position: [number, number, number];
  power: number;
  name?: string;
}> = ({ position, power, name }) => {
  // Calculate danger radius based on power (simplified)
  const dangerRadius = useMemo(() => {
    // Rough estimate: 1m per 500W
    return Math.max(0.5, Math.sqrt(power / 500));
  }, [power]);

  const cautionRadius = dangerRadius * 1.5;

  // Create warning circles
  const createCirclePoints = (radius: number) => {
    const points: [number, number, number][] = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push([
        position[0] + Math.cos(angle) * radius,
        0.02,
        position[2] + Math.sin(angle) * radius,
      ]);
    }
    return points;
  };

  return (
    <group>
      {/* Danger zone (innermost) */}
      <mesh position={[position[0], 0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[dangerRadius, 32]} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
      <Line
        points={createCirclePoints(dangerRadius)}
        color="#ff0000"
        lineWidth={3}
      />
      
      {/* Caution zone (outer) */}
      <mesh position={[position[0], 0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[dangerRadius, cautionRadius, 32]} />
        <meshBasicMaterial color="#ffaa00" transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      <Line
        points={createCirclePoints(cautionRadius)}
        color="#ffaa00"
        lineWidth={2}
        dashed
        dashSize={0.1}
        dashScale={5}
      />
      
      {/* Warning icon at light position */}
      <Html position={[position[0], position[1] + 0.3, position[2]]} center>
        <div style={{
          background: 'linear-gradient(135deg, #ff0000, #ff6600)',
          color: '#fff',
          padding: '6px 10px',
          borderRadius: '6px',
          fontSize: '10px',
          fontWeight: 'bold',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(255,0,0,0.5)',
          animation: 'pulse 2s infinite'}}>
          <div>HOT SURFACE</div>
          <div style={{ fontSize: '9px', fontWeight: 'normal' }}>{name || 'Hot Light'}</div>
          <div style={{ fontSize: '8px', fontWeight: 'normal' }}>{power}W</div>
        </div>
      </Html>
      
      {/* Ground labels */}
      <Html position={[position[0] + dangerRadius, 0.1, position[2]]} center>
        <div style={{
          background: '#ff0000',
          color: '#fff',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '8px',
          fontWeight: 'bold'}}>
          DANGER
        </div>
      </Html>
      <Html position={[position[0] + cautionRadius, 0.1, position[2]]} center>
        <div style={{
          background: '#ffaa00',
          color: '#000',
          padding: '2px 6px',
          borderRadius: '3px',
          fontSize: '8px',
          fontWeight: 'bold'}}>
          CAUTION
        </div>
      </Html>
    </group>
  );
};

// Main Safety & Spacing Guides Component
export const SafetySpacingGuides: React.FC<SafetySpacingGuidesProps> = ({
  showEquipmentClearance = true,
  showCableRoutes = true,
  showMovementZones = true,
  showHotLightWarning = true,
  subjectPosition = [0, 0, 0],
  equipmentPositions = [
    { position: [-2, 0, 1], type: 'c_stand', name: 'Key Light Stand' },
    { position: [1.5, 0, 2], type: 'light_stand', name: 'Fill Stand' },
    { position: [0, 0, 3], type: 'tripod', name: 'Camera Tripod' },
  ],
  hotLightPositions = [],
}) => {
  return (
    <group>
      {/* Equipment clearance zones */}
      {showEquipmentClearance && equipmentPositions.map((eq, i) => (
        <EquipmentClearanceZone
          key={`eq-${i}`}
          position={eq.position}
          type={eq.type}
          name={eq.name}
        />
      ))}
      
      {/* Cable routes */}
      {showCableRoutes && (
        <>
          {/* Example cable route from power to key light */}
          <CableRoute
            start={[-4, 0, 3]}
            end={equipmentPositions[0]?.position || [-2, 0, 1]}
            via={[[-4, 0, 1]]}
          />
        </>
      )}
      
      {/* Movement zones */}
      {showMovementZones && (
        <>
          <MovementZone
            center={subjectPosition}
            radius={0.8}
            type="subject"
          />
          <MovementZone
            center={[subjectPosition[0], 0, subjectPosition[2] + 3]}
            radius={1.5}
            type="photographer"
          />
        </>
      )}
      
      {/* Hot light warnings */}
      {showHotLightWarning && hotLightPositions.map((light, i) => (
        <HotLightWarning
          key={`hot-${i}`}
          position={light.position}
          power={light.power}
          name={light.name}
        />
      ))}
    </group>
  );
};

export default SafetySpacingGuides;

