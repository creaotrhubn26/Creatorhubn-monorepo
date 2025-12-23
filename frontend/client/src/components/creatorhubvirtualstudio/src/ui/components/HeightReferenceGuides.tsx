/**
 * Height Reference Guides
 * 
 * Visual guides for standard heights:
 * - Subject Heights (standing, sitting, child)
 * - Camera Heights (eye level, low, high)
 * - Light Heights (key, fill, hair)
 * - Background Height Coverage
 */

import React, { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';

interface HeightReferenceGuidesProps {
  showSubjectHeights?: boolean;
  showCameraHeights?: boolean;
  showLightHeights?: boolean;
  showBackgroundHeight?: boolean;
  position?: [number, number, number];
  backdropHeight?: number;
  backdropWidth?: number;
}

// Height marker data
const SUBJECT_HEIGHTS = [
  { label: 'Child (6yr)', height: 1.1, color: '#88ccff' },
  { label: 'Sitting', height: 1.2, color: '#ffcc00' },
  { label: 'Teen', height: 1.5, color: '#88ff88' },
  { label: 'Average', height: 1.7, color: '#00ff88' },
  { label: 'Tall', height: 1.85, color: '#ff8888' },
];

const CAMERA_HEIGHTS = [
  { label: 'Low Angle', height: 0.5, color: '#ff6600', description: 'Dramatic, powerful' },
  { label: 'Waist Level', height: 1.0, color: '#ffaa00', description: 'Fashion, casual' },
  { label: 'Eye Level (Sit)', height: 1.2, color: '#ffcc00', description: 'Natural seated' },
  { label: 'Chest Level', height: 1.4, color: '#88ff88', description: 'Flattering portraits' },
  { label: 'Eye Level (Stand)', height: 1.6, color: '#00ff88', description: 'Natural standing' },
  { label: 'High Angle', height: 2.0, color: '#8888ff', description: 'Slimming effect' },
];

const LIGHT_HEIGHTS = [
  { label: 'Floor Fill', height: 0.3, color: '#666666' },
  { label: 'Fill Light', height: 1.5, color: '#88ccff' },
  { label: 'Key Light', height: 2.0, color: '#ffcc00' },
  { label: 'Hair Light', height: 2.5, color: '#ff88cc' },
  { label: 'Background', height: 1.0, color: '#8888ff' },
];

// Subject Height Markers
const SubjectHeightMarkers: React.FC<{
  position: [number, number, number];
}> = ({ position }) => {
  return (
    <group position={position}>
      {/* Vertical scale line */}
      <Line
        points={[[0, 0, 0], [0, 2.2, 0]]}
        color="#444444"
        lineWidth={1}
      />
      
      {/* Height markers */}
      {SUBJECT_HEIGHTS.map((h, i) => (
        <group key={i} position={[0, h.height, 0]}>
          {/* Horizontal tick */}
          <Line
            points={[[-0.15, 0, 0], [0.15, 0, 0]]}
            color={h.color}
            lineWidth={2}
          />
          {/* Label */}
          <Html position={[0.25, 0, 0]}>
            <div style={{
              background: 'rgba(0,0,0,0.85)',
              color: h.color,
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              whiteSpace: 'nowrap',
              border: `1px solid ${h.color}`}}>
              {h.label}: {h.height}m
            </div>
          </Html>
        </group>
      ))}
      
      {/* Scale title */}
      <Html position={[0, 2.3, 0]} center>
        <div style={{
          background: '#00ff88',
          color: '#000',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold'}}>
          Subject Heights
        </div>
      </Html>
    </group>
  );
};

// Camera Height Markers
const CameraHeightMarkers: React.FC<{
  position: [number, number, number];
}> = ({ position }) => {
  return (
    <group position={position}>
      {/* Vertical scale line */}
      <Line
        points={[[0, 0, 0], [0, 2.5, 0]]}
        color="#444444"
        lineWidth={1}
      />
      
      {/* Camera icon indicators */}
      {CAMERA_HEIGHTS.map((h, i) => (
        <group key={i} position={[0, h.height, 0]}>
          {/* Camera icon (simplified) */}
          <mesh>
            <boxGeometry args={[0.08, 0.05, 0.06]} />
            <meshBasicMaterial color={h.color} />
          </mesh>
          <mesh position={[0.05, 0, 0]}>
            <cylinderGeometry args={[0.015, 0.02, 0.04, 8]} />
            <meshBasicMaterial color={h.color} />
          </mesh>
          
          {/* Label */}
          <Html position={[-0.25, 0, 0]}>
            <div style={{
              background: 'rgba(0,0,0,0.85)',
              color: h.color,
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '9px',
              whiteSpace: 'nowrap',
              textAlign: 'right'}}>
              <div style={{ fontWeight: 'bold' }}>{h.label}</div>
              <div style={{ fontSize: '8px', color: '#888' }}>{h.description}</div>
            </div>
          </Html>
        </group>
      ))}
      
      {/* Scale title */}
      <Html position={[0, 2.6, 0]} center>
        <div style={{
          background: '#ffcc00',
          color: '#000',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold'}}>
          Camera Heights
        </div>
      </Html>
    </group>
  );
};

// Light Height Markers
const LightHeightMarkers: React.FC<{
  position: [number, number, number];
}> = ({ position }) => {
  return (
    <group position={position}>
      {/* Vertical scale line */}
      <Line
        points={[[0, 0, 0], [0, 3, 0]]}
        color="#444444"
        lineWidth={1}
      />
      
      {/* Light markers */}
      {LIGHT_HEIGHTS.map((h, i) => (
        <group key={i} position={[0, h.height, 0]}>
          {/* Light bulb icon */}
          <mesh>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color={h.color} />
          </mesh>
          
          {/* Horizontal line to show height */}
          <Line
            points={[[-0.1, 0, 0], [0.1, 0, 0]]}
            color={h.color}
            lineWidth={2}
          />
          
          {/* Label */}
          <Html position={[0.2, 0, 0]}>
            <div style={{
              background: 'rgba(0,0,0,0.85)',
              color: h.color,
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '10px',
              whiteSpace: 'nowrap'}}>
              {h.label}: {h.height}m
            </div>
          </Html>
        </group>
      ))}
      
      {/* Scale title */}
      <Html position={[0, 3.1, 0]} center>
        <div style={{
          background: '#ff88cc',
          color: '#000',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold'}}>
          Light Heights
        </div>
      </Html>
    </group>
  );
};

// Background Height Coverage
const BackgroundHeightCoverage: React.FC<{
  position: [number, number, number];
  height: number;
  width: number;
}> = ({ position, height, width }) => {
  const coverageZones = useMemo(() => {
    return [
      { label: 'Headshot Zone', yStart: height * 0.6, yEnd: height, color: '#00ff88' },
      { label: 'Half Body', yStart: height * 0.3, yEnd: height, color: '#ffcc00' },
      { label: 'Full Body', yStart: 0, yEnd: height, color: '#ff8888' },
    ];
  }, [height]);

  return (
    <group position={position}>
      {/* Background plane outline */}
      <Line
        points={[
          [-width / 2, 0, 0],
          [width / 2, 0, 0],
          [width / 2, height, 0],
          [-width / 2, height, 0],
          [-width / 2, 0, 0],
        ]}
        color="#888888"
        lineWidth={2}
      />
      
      {/* Coverage zone indicators */}
      {coverageZones.map((zone, i) => (
        <group key={i}>
          {/* Zone bracket */}
          <Line
            points={[
              [width / 2 + 0.1, zone.yStart, 0],
              [width / 2 + 0.2, zone.yStart, 0],
              [width / 2 + 0.2, zone.yEnd, 0],
              [width / 2 + 0.1, zone.yEnd, 0],
            ]}
            color={zone.color}
            lineWidth={2}
          />
          
          {/* Zone label */}
          <Html position={[width / 2 + 0.35, (zone.yStart + zone.yEnd) / 2, 0]}>
            <div style={{
              background: 'rgba(0,0,0,0.85)',
              color: zone.color,
              padding: '2px 6px',
              borderRadius: '3px',
              fontSize: '9px',
              whiteSpace: 'nowrap'}}>
              {zone.label}
            </div>
          </Html>
        </group>
      ))}
      
      {/* Height dimension */}
      <Html position={[-width / 2 - 0.3, height / 2, 0]}>
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          writingMode: 'vertical-lr',
          textOrientation: 'mixed'}}>
          {height}m
        </div>
      </Html>
      
      {/* Width dimension */}
      <Html position={[0, -0.2, 0]} center>
        <div style={{
          background: 'rgba(0,0,0,0.85)',
          color: '#fff',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '10px'}}>
          {width}m
        </div>
      </Html>
    </group>
  );
};

// Main Height Reference Guides Component
export const HeightReferenceGuides: React.FC<HeightReferenceGuidesProps> = ({
  showSubjectHeights = true,
  showCameraHeights = true,
  showLightHeights = true,
  showBackgroundHeight = true,
  position = [0, 0, 0],
  backdropHeight = 2.7,
  backdropWidth = 3,
}) => {
  return (
    <group>
      {showSubjectHeights && (
        <SubjectHeightMarkers
          position={[position[0] - 3.5, position[1], position[2]]}
        />
      )}
      
      {showCameraHeights && (
        <CameraHeightMarkers
          position={[position[0] + 3.5, position[1], position[2] + 2]}
        />
      )}
      
      {showLightHeights && (
        <LightHeightMarkers
          position={[position[0] - 3.5, position[1], position[2] - 2]}
        />
      )}
      
      {showBackgroundHeight && (
        <BackgroundHeightCoverage
          position={[position[0], position[1], position[2] - 3]}
          height={backdropHeight}
          width={backdropWidth}
        />
      )}
    </group>
  );
};

export default HeightReferenceGuides;

