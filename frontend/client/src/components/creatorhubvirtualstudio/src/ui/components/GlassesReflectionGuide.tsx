/**
 * Glasses Reflection Guide
 * 
 * Visual guide to help photographers avoid reflections in subject's glasses:
 * - Reflection angle visualization
 * - Safe light zones (no reflection)
 * - Danger zones (will cause reflection)
 * - Head tilt recommendations
 * - Light height recommendations
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Box, Typography, Slider, Switch, FormControlLabel, Alert, Chip, Stack, Card, CardContent, Divider } from '@mui/material';

interface GlassesReflectionGuideProps {
  enabled?: boolean;
  subjectPosition: [number, number, number];
  subjectHeight?: number;
  cameraPosition: [number, number, number];
  keyLightPosition: [number, number, number];
  fillLightPosition?: [number, number, number];
  headTiltAngle?: number; // degrees, negative = chin down
  glassesAngle?: number; // degrees from vertical (typical: 10-15 degrees)
}

// Calculate if light will cause reflection in glasses
function calculateReflection(
  lightPos: THREE.Vector3,
  eyePos: THREE.Vector3,
  cameraPos: THREE.Vector3,
  glassesNormal: THREE.Vector3 // Normal of glasses surface
): {
  willReflect: boolean;
  reflectionAngle: number;
  incidentAngle: number;
  reflectionRay: THREE.Vector3;
  safetyMargin: number; // degrees away from camera
} {
  // Direction from eye to light
  const toLight = lightPos.clone().sub(eyePos).normalize();
  
  // Incident angle (angle between light ray and glasses normal)
  const incidentAngle = Math.acos(Math.abs(toLight.dot(glassesNormal))) * (180 / Math.PI);
  
  // Calculate reflection ray (using law of reflection)
  // R = I - 2(I·N)N where I is incident ray, N is normal
  const dotProduct = toLight.dot(glassesNormal);
  const reflectionRay = toLight.clone().sub(
    glassesNormal.clone().multiplyScalar(2 * dotProduct)
  ).normalize();
  
  // Direction from eye to camera
  const toCamera = cameraPos.clone().sub(eyePos).normalize();
  
  // Angle between reflection ray and camera direction
  const reflectionAngle = Math.acos(reflectionRay.dot(toCamera)) * (180 / Math.PI);
  
  // If reflection ray points toward camera (within ~15 degrees), we'll see reflection
  const willReflect = reflectionAngle < 15;
  const safetyMargin = reflectionAngle - 15;
  
  return {
    willReflect,
    reflectionAngle,
    incidentAngle,
    reflectionRay,
    safetyMargin,
  };
}

// 3D Reflection Visualization
const ReflectionVisualization: React.FC<{
  subjectPosition: [number, number, number];
  eyeLevel: number;
  cameraPosition: [number, number, number];
  lightPosition: [number, number, number];
  lightName: string;
  headTiltAngle: number;
  glassesAngle: number;
}> = ({
  subjectPosition,
  eyeLevel,
  cameraPosition,
  lightPosition,
  lightName,
  headTiltAngle,
  glassesAngle,
}) => {
  const visualization = useMemo(() => {
    const eyePos = new THREE.Vector3(
      subjectPosition[0],
      eyeLevel,
      subjectPosition[2]
    );
    const lightPos = new THREE.Vector3(...lightPosition);
    const cameraPos = new THREE.Vector3(...cameraPosition);
    
    // Calculate glasses normal (perpendicular to glasses surface)
    // Glasses typically tilt back 10-15 degrees from vertical
    // Head tilt affects this angle
    const totalTilt = (glassesAngle + headTiltAngle) * (Math.PI / 180);
    const glassesNormal = new THREE.Vector3(
      0,
      Math.sin(totalTilt),
      Math.cos(totalTilt)
    ).normalize();
    
    const result = calculateReflection(lightPos, eyePos, cameraPos, glassesNormal);
    
    // Calculate ray endpoints for visualization
    const rayLength = 2;
    const incidentEnd = eyePos.clone().add(
      lightPos.clone().sub(eyePos).normalize().multiplyScalar(-rayLength)
    );
    const reflectionEnd = eyePos.clone().add(
      result.reflectionRay.clone().multiplyScalar(rayLength)
    );
    
    return {
      ...result,
      eyePos,
      incidentStart: lightPos,
      incidentEnd: eyePos,
      reflectionStart: eyePos,
      reflectionEnd,
      glassesNormal,
    };
  }, [subjectPosition, eyeLevel, cameraPosition, lightPosition, headTiltAngle, glassesAngle]);

  const statusColor = visualization.willReflect ? '#ff4444' : '#00ff88';

  return (
    <group>
      {/* Incident ray (from light to eye) */}
      <Line
        points={[
          [visualization.incidentStart.x, visualization.incidentStart.y, visualization.incidentStart.z],
          [visualization.incidentEnd.x, visualization.incidentEnd.y, visualization.incidentEnd.z],
        ]}
        color="#ffcc00"
        lineWidth={2}
        dashed
        dashSize={0.1}
        dashScale={5}
      />
      
      {/* Reflection ray */}
      <Line
        points={[
          [visualization.reflectionStart.x, visualization.reflectionStart.y, visualization.reflectionStart.z],
          [visualization.reflectionEnd.x, visualization.reflectionEnd.y, visualization.reflectionEnd.z],
        ]}
        color={statusColor}
        lineWidth={3}
      />
      
      {/* Arrow head on reflection ray */}
      <mesh 
        position={[visualization.reflectionEnd.x, visualization.reflectionEnd.y, visualization.reflectionEnd.z]}
        rotation={[
          0,
          Math.atan2(visualization.reflectionRay.x, visualization.reflectionRay.z),
          -Math.asin(visualization.reflectionRay.y),
        ]}
      >
        <coneGeometry args={[0.05, 0.15, 8]} />
        <meshBasicMaterial color={statusColor} />
      </mesh>
      
      {/* Glasses plane visualization (small rectangle at eye level) */}
      <mesh
        position={[visualization.eyePos.x, visualization.eyePos.y, visualization.eyePos.z + 0.1]}
        rotation={[-(glassesAngle + headTiltAngle) * (Math.PI / 180), 0, 0]}
      >
        <planeGeometry args={[0.15, 0.08]} />
        <meshBasicMaterial 
          color={visualization.willReflect ? '#ff4444' : '#00ff88'} 
          transparent 
          opacity={0.3} 
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Normal vector indicator */}
      <Line
        points={[
          [visualization.eyePos.x, visualization.eyePos.y, visualization.eyePos.z + 0.1],
          [
            visualization.eyePos.x + visualization.glassesNormal.x * 0.3,
            visualization.eyePos.y + visualization.glassesNormal.y * 0.3,
            visualization.eyePos.z + 0.1 + visualization.glassesNormal.z * 0.3,
          ],
        ]}
        color="#888888"
        lineWidth={1}
      />
      
      {/* Status label */}
      <Html position={[visualization.reflectionEnd.x, visualization.reflectionEnd.y + 0.2, visualization.reflectionEnd.z]} center>
        <div style={{
          background: visualization.willReflect ? 'rgba(255,68,68,0.95)' : 'rgba(0,255,136,0.95)',
          color: visualization.willReflect ? '#fff' : '#000',
          padding: '6px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 'bold',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'}}>
          <div>{lightName}</div>
          <div style={{ fontSize: '10px', fontWeight: 'normal' }}>
            {visualization.willReflect ? 'REFLECTION!' : 'Safe'}
          </div>
          <div style={{ fontSize: '9px', fontWeight: 'normal' }}>
            {visualization.safetyMargin > 0 
              ? `+${visualization.safetyMargin.toFixed(0)} margin`
              : `${visualization.safetyMargin.toFixed(0)} over`}
          </div>
        </div>
      </Html>
    </group>
  );
};

// Safe Zone Visualization (cone showing safe light positions)
const SafeZoneVisualization: React.FC<{
  subjectPosition: [number, number, number];
  eyeLevel: number;
  cameraPosition: [number, number, number];
  headTiltAngle: number;
  glassesAngle: number;
}> = ({
  subjectPosition,
  eyeLevel,
  cameraPosition,
  headTiltAngle,
  glassesAngle,
}) => {
  const safeZones = useMemo(() => {
    const eyePos = new THREE.Vector3(subjectPosition[0], eyeLevel, subjectPosition[2]);
    const cameraPos = new THREE.Vector3(...cameraPosition);
    
    // Calculate the "danger zone" - where light will reflect into camera
    const toCamera = cameraPos.clone().sub(eyePos).normalize();
    
    // Safe zone is generally:
    // - High above eye level (45+ degrees up)
    // - Far to the sides (past 45 degrees from camera axis)
    
    // Create safe zone indicators at various heights
    const zones: Array<{
      position: [number, number, number];
      radius: number;
      safe: boolean;
      label: string;
    }> = [];
    
    // Check positions around the subject
    const checkRadius = 2;
    for (let angle = 0; angle < 360; angle += 30) {
      for (let height = 1.5; height <= 3; height += 0.5) {
        const rad = angle * (Math.PI / 180);
        const pos = new THREE.Vector3(
          eyePos.x + Math.sin(rad) * checkRadius,
          height,
          eyePos.z + Math.cos(rad) * checkRadius
        );
        
        const totalTilt = (glassesAngle + headTiltAngle) * (Math.PI / 180);
        const glassesNormal = new THREE.Vector3(0, Math.sin(totalTilt), Math.cos(totalTilt)).normalize();
        
        const result = calculateReflection(pos, eyePos, cameraPos, glassesNormal);
        
        zones.push({
          position: [pos.x, pos.y, pos.z],
          radius: 0.1,
          safe: !result.willReflect,
          label: `${height}m / ${angle}`,
        });
      }
    }
    
    return zones;
  }, [subjectPosition, eyeLevel, cameraPosition, headTiltAngle, glassesAngle]);

  return (
    <group>
      {safeZones.map((zone, i) => (
        <mesh key={i} position={zone.position}>
          <sphereGeometry args={[zone.radius, 8, 8]} />
          <meshBasicMaterial 
            color={zone.safe ? '#00ff88' : '#ff4444'} 
            transparent 
            opacity={0.4}
          />
        </mesh>
      ))}
    </group>
  );
};

// Optimal Light Position Indicator
const OptimalLightPositions: React.FC<{
  subjectPosition: [number, number, number];
  eyeLevel: number;
  cameraPosition: [number, number, number];
}> = ({ subjectPosition, eyeLevel, cameraPosition }) => {
  const optimalPositions = useMemo(() => {
    const eyePos = new THREE.Vector3(subjectPosition[0], eyeLevel, subjectPosition[2]);
    const cameraPos = new THREE.Vector3(...cameraPosition);
    const toCamera = cameraPos.clone().sub(eyePos);
    const cameraAngle = Math.atan2(toCamera.x, toCamera.z);
    
    // Optimal positions for glasses:
    // 1. High and to the side (45+ degrees up, 45+ degrees to side)
    // 2. Behind the subject (rim/hair light position)
    // 3. Very high overhead (butterfly position)
    
    return [
      {
        label: 'Optimal Key (High Left)',
        position: [
          eyePos.x + Math.sin(cameraAngle + Math.PI / 3) * 2,
          eyeLevel + 1.0, // High
          eyePos.z + Math.cos(cameraAngle + Math.PI / 3) * 2,
        ] as [number, number, number],
        description: 'Raise light high, 45-60 degrees to side',
      },
      {
        label: 'Optimal Fill (High Right)',
        position: [
          eyePos.x + Math.sin(cameraAngle - Math.PI / 4) * 1.5,
          eyeLevel + 0.8,
          eyePos.z + Math.cos(cameraAngle - Math.PI / 4) * 1.5,
        ] as [number, number, number],
        description: 'Softer, higher than key',
      },
      {
        label: 'Butterfly (Overhead)',
        position: [
          eyePos.x,
          eyeLevel + 1.2,
          eyePos.z + 0.3, // Slightly in front
        ] as [number, number, number],
        description: 'Directly above, angled down',
      },
    ];
  }, [subjectPosition, eyeLevel, cameraPosition]);

  return (
    <group>
      {optimalPositions.map((pos, i) => (
        <group key={i}>
          {/* Position marker */}
          <mesh position={pos.position}>
            <octahedronGeometry args={[0.15, 0]} />
            <meshBasicMaterial color="#00ff88" wireframe />
          </mesh>
          
          {/* Line to eye level */}
          <Line
            points={[
              pos.position,
              [subjectPosition[0], eyeLevel, subjectPosition[2]],
            ]}
            color="#00ff88"
            lineWidth={1}
            dashed
            dashSize={0.1}
            dashScale={5}
          />
          
          {/* Label */}
          <Html position={[pos.position[0], pos.position[1] + 0.25, pos.position[2]]} center>
            <div style={{
              background: 'rgba(0,255,136,0.95)',
              color: '#000',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '9px',
              fontWeight: 'bold',
              textAlign: 'center',
              maxWidth: '120px'}}>
              <div>{pos.label}</div>
              <div style={{ fontSize: '8px', fontWeight: 'normal' }}>{pos.description}</div>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

// Main Glasses Reflection Guide Component
export const GlassesReflectionGuide: React.FC<GlassesReflectionGuideProps> = ({
  enabled = true,
  subjectPosition,
  subjectHeight = 1.7,
  cameraPosition,
  keyLightPosition,
  fillLightPosition,
  headTiltAngle = 0,
  glassesAngle = 12, // Typical glasses tilt
}) => {
  const eyeLevel = subjectHeight - 0.12; // Eyes slightly below top of head

  if (!enabled) return null;

  return (
    <group>
      {/* Key Light Reflection Check */}
      <ReflectionVisualization
        subjectPosition={subjectPosition}
        eyeLevel={eyeLevel}
        cameraPosition={cameraPosition}
        lightPosition={keyLightPosition}
        lightName="Key Light"
        headTiltAngle={headTiltAngle}
        glassesAngle={glassesAngle}
      />
      
      {/* Fill Light Reflection Check */}
      {fillLightPosition && (
        <ReflectionVisualization
          subjectPosition={subjectPosition}
          eyeLevel={eyeLevel}
          cameraPosition={cameraPosition}
          lightPosition={fillLightPosition}
          lightName="Fill Light"
          headTiltAngle={headTiltAngle}
          glassesAngle={glassesAngle}
        />
      )}
      
      {/* Safe Zone Indicators */}
      <SafeZoneVisualization
        subjectPosition={subjectPosition}
        eyeLevel={eyeLevel}
        cameraPosition={cameraPosition}
        headTiltAngle={headTiltAngle}
        glassesAngle={glassesAngle}
      />
      
      {/* Optimal Light Positions */}
      <OptimalLightPositions
        subjectPosition={subjectPosition}
        eyeLevel={eyeLevel}
        cameraPosition={cameraPosition}
      />
      
      {/* Info Panel */}
      <Html position={[subjectPosition[0] + 2, subjectHeight + 0.5, subjectPosition[2]]} center>
        <div style={{
          background: 'rgba(0,0,0,0.9)',
          color: '#fff',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '11px',
          maxWidth: '220px',
          border: '1px solid rgba(255,255,255,0.2)'}}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#ffcc00' }}>
            Glasses Reflection Guide
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#00ff88' }}>Green</span> = Safe (no reflection)
          </div>
          <div style={{ marginBottom: '6px' }}>
            <span style={{ color: '#ff4444' }}>Red</span> = Will cause reflection
          </div>
          <div style={{ marginBottom: '8px', fontSize: '10px', color: '#888' }}>
            Yellow = Incident light ray<br/>
            Colored = Reflection ray
          </div>
          <div style={{ 
            background: 'rgba(255,204,0,0.2)', 
            padding: '6px', 
            borderRadius: '4px',
            fontSize: '10px'}}>
            <strong>Tips:</strong><br/>
            - Raise lights higher<br/>
            - Move lights to the side<br/>
            - Have subject tilt chin down slightly<br/>
            - Use larger/softer light sources
          </div>
        </div>
      </Html>
    </group>
  );
};

// Control Panel for Glasses Reflection Guide
export const GlassesReflectionPanel: React.FC<{
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  headTiltAngle: number;
  onHeadTiltChange: (angle: number) => void;
  glassesAngle: number;
  onGlassesAngleChange: (angle: number) => void;
  hasReflection?: boolean;
}> = ({
  enabled,
  onEnabledChange,
  headTiltAngle,
  onHeadTiltChange,
  glassesAngle,
  onGlassesAngleChange,
  hasReflection = false,
}) => {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            Glasses Reflection Guide
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {enabled && (
              <Chip 
                label={hasReflection ? 'Reflection!' : 'Safe'} 
                size="small" 
                color={hasReflection ? 'error' : 'success'}
              />
            )}
            <Switch
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
            />
          </Stack>
        </Stack>
        
        {enabled && (
          <>
            <Alert 
              severity={hasReflection ? 'warning' : 'success'} 
              sx={{ mb: 2 }}
            >
              {hasReflection 
                ? 'Current light position will cause reflection in glasses. Adjust light position or have subject tilt head.' : 'Light positions are safe - no reflection expected in glasses.'
              }
            </Alert>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                Subject Head Tilt: {headTiltAngle}
              </Typography>
              <Slider
                value={headTiltAngle}
                onChange={(_, v) => onHeadTiltChange(v as number)}
                min={-20}
                max={20}
                step={1}
                marks={[
                  { value: -15, label: 'Chin Down' },
                  { value: 0, label: 'Level' },
                  { value: 15, label: 'Chin Up' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}`}
              />
              <Typography variant="caption" color="text.secondary">
                Negative = chin down (helps avoid reflections)
              </Typography>
            </Box>
            
            <Box>
              <Typography variant="body2" gutterBottom>
                Glasses Frame Angle: {glassesAngle}
              </Typography>
              <Slider
                value={glassesAngle}
                onChange={(_, v) => onGlassesAngleChange(v as number)}
                min={0}
                max={25}
                step={1}
                marks={[
                  { value: 5, label: 'Flat' },
                  { value: 12, label: 'Typical' },
                  { value: 20, label: 'Tilted' },
                ]}
                valueLabelDisplay="auto"
                valueLabelFormat={(v) => `${v}`}
              />
              <Typography variant="caption" color="text.secondary">
                Most glasses tilt back 10-15 from vertical
              </Typography>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Quick Fixes:
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="caption">
                1. Raise key light higher (above 45 from eye level)
              </Typography>
              <Typography variant="caption">
                2. Move light further to the side (past 45 from camera)
              </Typography>
              <Typography variant="caption">
                3. Ask subject to tilt chin down slightly (-5 to -10)
              </Typography>
              <Typography variant="caption">
                4. Use a larger/softer light source (spreads reflection)
              </Typography>
              <Typography variant="caption">
                5. Have subject push glasses down their nose slightly
              </Typography>
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default GlassesReflectionGuide;

