/**
 * Color & Exposure Guides
 * 
 * Visual guides for color and exposure:
 * - Color Temperature Scale
 * - Gray Card Position
 * - Exposure Zone System
 * - Color Checker Position
 */

import React, { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { Box, Typography } from '@mui/material';
import * as THREE from 'three';

interface ColorExposureGuidesProps {
  showColorTemperatureScale?: boolean;
  showGrayCardPosition?: boolean;
  showExposureZones?: boolean;
  showColorCheckerPosition?: boolean;
  subjectPosition?: [number, number, number];
  lightColorTemperature?: number; // Kelvin
}

// Color temperature data
const COLOR_TEMPERATURES = [
  { kelvin: 1800, label: 'Candle', color: '#ff9329' },
  { kelvin: 2700, label: 'Tungsten', color: '#ffb46b' },
  { kelvin: 3200, label: 'Halogen', color: '#ffc89c' },
  { kelvin: 4000, label: 'Moonlight', color: '#ffdfc7' },
  { kelvin: 5000, label: 'Horizon', color: '#fff4e5' },
  { kelvin: 5500, label: 'Daylight', color: '#ffffff' },
  { kelvin: 6500, label: 'Cloudy', color: '#e6f0ff' },
  { kelvin: 7500, label: 'Shade', color: '#cce0ff' },
  { kelvin: 10000, label: 'Blue Sky', color: '#99c2ff' },
];

// Exposure zone system data
const EXPOSURE_ZONES = [
  { zone: 0, label: 'Pure Black', description: 'No detail', color: '#000000' },
  { zone: 1, label: 'Near Black', description: 'Slight tonality', color: '#1a1a1a' },
  { zone: 2, label: 'Deep Shadow', description: 'First detail', color: '#333333' },
  { zone: 3, label: 'Shadow', description: 'Dark detail', color: '#4d4d4d' },
  { zone: 4, label: 'Dark Mid', description: 'Open shadow', color: '#666666' },
  { zone: 5, label: 'Middle Gray', description: '18% gray', color: '#808080' },
  { zone: 6, label: 'Light Mid', description: 'Caucasian skin', color: '#999999' },
  { zone: 7, label: 'Highlight', description: 'Light detail', color: '#b3b3b3' },
  { zone: 8, label: 'Bright', description: 'White with texture', color: '#cccccc' },
  { zone: 9, label: 'Near White', description: 'Slight tonality', color: '#e6e6e6' },
  { zone: 10, label: 'Pure White', description: 'Specular', color: '#ffffff' },
];

// Color Temperature Scale (2D overlay)
const ColorTemperatureScale: React.FC<{
  currentKelvin?: number;
}> = ({ currentKelvin = 5500 }) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        background: 'rgba(0,0,0,0.85)',
        borderRadius: 2,
        p: 1.5,
        minWidth: 200}}
    >
      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 'bold', mb: 1, display: 'block' }}>
        Color Temperature (K)
      </Typography>
      
      {/* Gradient bar */}
      <Box
        sx={{
          height: 20,
          borderRadius: 1,
          background: 'linear-gradient(to right, #ff9329, #ffb46b, #ffc89c, #ffdfc7, #fff4e5, #ffffff, #e6f0ff, #cce0ff, #99c2ff)',
          position: 'relative',
          mb: 1}}
      >
        {/* Current position marker */}
        <Box
          sx={{
            position: 'absolute',
            left: `${((currentKelvin - 1800) / (10000 - 1800)) * 100}%`,
            top: -4,
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '8px solid #fff'}}
        />
      </Box>
      
      {/* Scale labels */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#888' }}>
        <span>1800K</span>
        <span>5500K</span>
        <span>10000K</span>
      </Box>
      
      {/* Current value */}
      <Box sx={{ textAlign: 'center', mt: 1 }}>
        <Typography
          variant="body2"
          sx={{
            color: COLOR_TEMPERATURES.find(t => Math.abs(t.kelvin - currentKelvin) < 500)?.color || '#fff',
            fontWeight: 'bold'}}
        >
          Current: {currentKelvin}K
        </Typography>
      </Box>
    </Box>
  );
};

// Gray Card Position (3D)
const GrayCardPosition: React.FC<{
  subjectPosition: [number, number, number];
}> = ({ subjectPosition }) => {
  const cardPosition: [number, number, number] = [
    subjectPosition[0],
    subjectPosition[1] + 1.2, // Chest level
    subjectPosition[2] + 0.3,
  ];

  return (
    <group>
      {/* Gray card mesh */}
      <mesh position={cardPosition} rotation={[0, 0, 0]}>
        <planeGeometry args={[0.25, 0.2]} />
        <meshBasicMaterial color="#808080" side={THREE.DoubleSide} />
      </mesh>
      
      {/* Card border */}
      <lineSegments position={cardPosition}>
        <edgesGeometry args={[new THREE.PlaneGeometry(0.25, 0.2)]} />
        <lineBasicMaterial color="#ffffff" />
      </lineSegments>
      
      {/* Position indicator line */}
      <Line
        points={[
          [cardPosition[0], 0, cardPosition[2]],
          [cardPosition[0], cardPosition[1], cardPosition[2]],
        ]}
        color="#808080"
        lineWidth={1}
        dashed
        dashSize={0.05}
        dashScale={10}
      />
      
      {/* Label */}
      <Html position={[cardPosition[0], cardPosition[1] + 0.2, cardPosition[2]]} center>
        <div style={{
          background: 'rgba(128,128,128,0.9)',
          color: '#fff',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 'bold',
          textAlign: 'center'}}>
          <div>18% Gray Card</div>
          <div style={{ fontSize: '8px', fontWeight: 'normal' }}>Hold at chest level</div>
        </div>
      </Html>
      
      {/* Optimal placement zone */}
      <mesh position={[cardPosition[0], cardPosition[1], cardPosition[2] - 0.01]} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.15, 0.2, 32]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// Exposure Zone System (2D overlay)
const ExposureZoneSystem: React.FC = () => {
  return (
    <Box
      sx={{
        position: 'absolute',
        right: 20,
        top: '50%',
        transform: 'translateY(-50%)',
        background: 'rgba(0,0,0,0.85)',
        borderRadius: 2,
        p: 1,
        width: 120}}
    >
      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 'bold', mb: 1, display: 'block', textAlign: 'center' }}>
        Zone System
      </Typography>
      
      {EXPOSURE_ZONES.map((zone) => (
        <Box
          key={zone.zone}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mb: 0.3}}
        >
          <Box
            sx={{
              width: 16,
              height: 16,
              borderRadius: '2px',
              bgcolor: zone.color,
              border: '1px solid rgba(255,255,255,0.3)',
              flexShrink: 0}}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: '#fff', fontSize: '8px', display: 'block', lineHeight: 1.2 }}>
              {zone.zone}: {zone.label}
            </Typography>
          </Box>
        </Box>
      ))}
      
      {/* Middle gray highlight */}
      <Box
        sx={{
          mt: 1,
          p: 0.5,
          background: 'rgba(128,128,128,0.3)',
          borderRadius: 1,
          textAlign: 'center'}}
      >
        <Typography variant="caption" sx={{ color: '#00ff88', fontSize: '9px' }}>
          Zone V = 18% Gray
        </Typography>
      </Box>
    </Box>
  );
};

// Color Checker Position (3D)
const ColorCheckerPosition: React.FC<{
  subjectPosition: [number, number, number];
}> = ({ subjectPosition }) => {
  const checkerPosition: [number, number, number] = [
    subjectPosition[0] + 0.4,
    subjectPosition[1] + 1.0,
    subjectPosition[2] + 0.3,
  ];

  // Simplified color checker colors (6x4 grid)
  const colors = [
    ['#735244','#c29682','#627a9d','#576c43','#8580b1','#67bdaa'],
    ['#d67e2c','#505ba6','#c15a63','#5e3c6c','#9dbc40','#e0a32e'],
    ['#383d96','#469449','#af363c','#e7c71f','#bb5695','#0885a1'],
    ['#f3f3f2','#c8c8c8','#a0a0a0','#7a7a7a''#555555','#343434'],
  ];

  const cellSize = 0.04;
  const gap = 0.005;

  return (
    <group position={checkerPosition}>
      {/* Color checker cells */}
      {colors.map((row, rowIdx) => (
        row.map((color, colIdx) => (
          <mesh
            key={`${rowIdx}-${colIdx}`}
            position={[
              colIdx * (cellSize + gap) - (5 * (cellSize + gap)) / 2,
              -rowIdx * (cellSize + gap) + (3 * (cellSize + gap)) / 2,
              0,
            ]}
          >
            <planeGeometry args={[cellSize, cellSize]} />
            <meshBasicMaterial color={color} side={THREE.DoubleSide} />
          </mesh>
        ))
      ))}
      
      {/* Border */}
      <mesh position={[0, 0, -0.001]}>
        <planeGeometry args={[6 * (cellSize + gap) + 0.02, 4 * (cellSize + gap) + 0.02]} />
        <meshBasicMaterial color="#1a1a1a" side={THREE.DoubleSide} />
      </mesh>
      
      {/* Label */}
      <Html position={[0, 0.15, 0]} center>
        <div style={{
          background: 'rgba(0,0,0,0.9)',
          color: '#fff',
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 'bold'}}>
          Color Checker
        </div>
      </Html>
      
      {/* Position indicator */}
      <Line
        points={[
          [0, -0.5, 0],
          [0, -0.15, 0],
        ]}
        color="#888888"
        lineWidth={1}
        dashed
        dashSize={0.03}
        dashScale={10}
      />
    </group>
  );
};

// Main Color & Exposure Guides Component (for 2D overlays)
export const ColorExposureOverlay: React.FC<{
  showColorTemperatureScale?: boolean;
  showExposureZones?: boolean;
  lightColorTemperature?: number;
}> = ({
  showColorTemperatureScale = true,
  showExposureZones = true,
  lightColorTemperature = 5500,
}) => {
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1}}
    >
      {showColorTemperatureScale && (
        <ColorTemperatureScale currentKelvin={lightColorTemperature} />
      )}
      
      {showExposureZones && (
        <ExposureZoneSystem />
      )}
    </Box>
  );
};

// Main Color & Exposure Guides Component (for 3D scene)
export const ColorExposureGuides: React.FC<ColorExposureGuidesProps> = ({
  showGrayCardPosition = true,
  showColorCheckerPosition = true,
  subjectPosition = [0, 0, 0],
}) => {
  return (
    <group>
      {showGrayCardPosition && (
        <GrayCardPosition subjectPosition={subjectPosition} />
      )}
      
      {showColorCheckerPosition && (
        <ColorCheckerPosition subjectPosition={subjectPosition} />
      )}
    </group>
  );
};

export default ColorExposureGuides;

