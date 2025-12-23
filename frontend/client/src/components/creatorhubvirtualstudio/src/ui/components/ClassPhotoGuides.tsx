/**
 * Class Photo Visual Guides
 * 
 * Visual aids for positioning students in group/class photos:
 * - Head alignment lines
 * - Camera FOV cone
 * - Edge warning zones
 * - Spacing rulers
 * - Center/symmetry line
 * - Height gap indicators
 * - Eye line convergence
 * - Depth of field preview
 */

import React, { useMemo } from 'react';
import { Line, Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import {
  ClassPhotoSession,
  Student,
  SPACING,
} from '../../core/services/classPhotoService';

// =============================================================================
// Types
// =============================================================================

export interface ClassPhotoGuidesProps {
  session: ClassPhotoSession;
  showHeadLines?: boolean;
  showFOV?: boolean;
  showEdgeWarnings?: boolean;
  showSpacingRulers?: boolean;
  showCenterLine?: boolean;
  showHeightGaps?: boolean;
  showEyeLine?: boolean;
  showDOFPreview?: boolean;
  showAspectRatioFrame?: boolean;
  aspectRatio?: '4x6' | '5x7' | '8x10' | '8.5x11';
  cameraFOV?: number;
}

export interface GuideSettingsProps {
  settings: {
    showHeadLines: boolean;
    showFOV: boolean;
    showEdgeWarnings: boolean;
    showSpacingRulers: boolean;
    showCenterLine: boolean;
    showHeightGaps: boolean;
    showEyeLine: boolean;
    showDOFPreview: boolean;
    showAspectRatioFrame: boolean;
    aspectRatio: '4x6' | '5x7' | '8x10' | '8.5x11';
  };
  onChange: (settings: GuideSettingsProps['settings']) => void;
}

// =============================================================================
// Constants
// =============================================================================

const COLORS = {
  headLine: '#00ff88',
  centerLine: '#ffffff',
  edgeWarning: '#ff4444',
  edgeCaution: '#ff9900',
  spacing: '#4488ff',
  fov: '#ffff00',
  heightGap: '#ff00ff',
  eyeLine: '#00ffff',
  dof: '#88ff88',
  aspectFrame: '#ff88ff',
};

const ASPECT_RATIOS = {
  '4x6': 6 / 4,       // 1.5 (landscape)
  '5x7': 7 / 5,       // 1.4
  '8x10': 10 / 8,     // 1.25
  '8.5x11': 11 / 8.5, // 1.29
};

// =============================================================================
// Head Alignment Lines
// =============================================================================

const HeadAlignmentLines: React.FC<{
  session: ClassPhotoSession;
}> = ({ session }) => {
  const lines = useMemo(() => {
    const result: { y: number; z: number; label: string }[] = [];
    const students = Array.from(session.students.values());
    
    for (const row of session.rows) {
      // Get students in this row
      const rowStudents = row.studentIds
        .map(id => session.students.get(id))
        .filter(Boolean) as Student[];
      
      if (rowStudents.length === 0) continue;
      
      // Calculate average head height for this row
      const avgHeadHeight = rowStudents.reduce((sum, s) => {
        const headY = s.position3D.y + (s.height / 100) * 0.95; // Top of head
        return sum + headY;
      }, 0) / rowStudents.length;
      
      result.push({
        y: avgHeadHeight,
        z: row.zPosition,
        label: `Row ${row.index + 1}`,
      });
    }
    
    return result;
  }, [session]);
  
  const width = session.sceneWidth + 1;
  
  return (
    <group name="HeadAlignmentLines">
      {lines.map((line, idx) => (
        <group key={idx}>
          {/* Main line */}
          <Line
            points={[
              [-width / 2, line.y, line.z],
              [width / 2, line.y, line.z],
            ]}
            color={COLORS.headLine}
            lineWidth={1.5}
            transparent
            opacity={0.6}
            dashed
            dashSize={0.1}
            dashScale={3}
          />
          
          {/* Label */}
          <Html
            position={[width / 2 + 0.2, line.y, line.z]}
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              background: COLORS.headLine,
              color: '#000',
              padding: '1px 4px',
              borderRadius: '2px',
              fontSize: '9px',
              whiteSpace: 'nowrap'}}>
              Head Line {idx + 1}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

// =============================================================================
// Camera FOV Cone
// =============================================================================

const CameraFOVCone: React.FC<{
  session: ClassPhotoSession;
  fov?: number;
}> = ({ session, fov = 50 }) => {
  const { cameraPosition, cameraTarget, sceneWidth, sceneDepth } = session;
  
  const fovLines = useMemo(() => {
    // Calculate FOV edges
    const distance = cameraPosition.distanceTo(cameraTarget);
    const halfFOV = (fov / 2) * (Math.PI / 180);
    const halfWidth = Math.tan(halfFOV) * distance;
    
    // Aspect ratio (assume 3:2)
    const aspectRatio = 1.5;
    const halfHeight = halfWidth / aspectRatio;
    
    // Ground level intersection points
    const groundZ = -sceneDepth;
    const groundDistance = cameraPosition.z - groundZ;
    const groundHalfWidth = Math.tan(halfFOV) * groundDistance;
    
    return {
      halfWidth,
      halfHeight,
      groundHalfWidth,
      groundZ,
    };
  }, [cameraPosition, cameraTarget, fov, sceneDepth]);
  
  const camPos: [number, number, number] = [
    cameraPosition.x,
    cameraPosition.y,
    cameraPosition.z,
  ];
  
  return (
    <group name="CameraFOVCone">
      {/* Left FOV line */}
      <Line
        points={[
          camPos,
          [-fovLines.groundHalfWidth, 0, fovLines.groundZ],
        ]}
        color={COLORS.fov}
        lineWidth={1}
        transparent
        opacity={0.4}
      />
      
      {/* Right FOV line */}
      <Line
        points={[
          camPos,
          [fovLines.groundHalfWidth, 0, fovLines.groundZ],
        ]}
        color={COLORS.fov}
        lineWidth={1}
        transparent
        opacity={0.4}
      />
      
      {/* FOV ground arc */}
      <Line
        points={[
          [-fovLines.groundHalfWidth, 0.02, fovLines.groundZ],
          [fovLines.groundHalfWidth, 0.02, fovLines.groundZ],
        ]}
        color={COLORS.fov}
        lineWidth={2}
        transparent
        opacity={0.5}
      />
      
      {/* FOV label */}
      <Html
        position={[0, 0.1, fovLines.groundZ]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          background: 'rgba(0,0,0,0.7)',
          color: COLORS.fov,
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px'}}>
          FOV: {fov}deg ({(fovLines.groundHalfWidth * 2).toFixed(1)}m wide)
        </div>
      </Html>
    </group>
  );
};

// =============================================================================
// Edge Warning Zones
// =============================================================================

const EdgeWarningZones: React.FC<{
  session: ClassPhotoSession;
  fov?: number;
}> = ({ session, fov = 50 }) => {
  const { cameraPosition, sceneDepth } = session;
  
  const zones = useMemo(() => {
    const halfFOV = (fov / 2) * (Math.PI / 180);
    const groundZ = -sceneDepth;
    const groundDistance = cameraPosition.z - groundZ;
    const frameHalfWidth = Math.tan(halfFOV) * groundDistance;
    
    // Warning zone is 10% from edge
    const warningWidth = frameHalfWidth * 0.1;
    // Caution zone is 10-20% from edge
    const cautionWidth = frameHalfWidth * 0.1;
    
    return {
      frameHalfWidth,
      warningWidth,
      cautionWidth,
      groundZ,
      depth: sceneDepth + 2,
    };
  }, [cameraPosition, fov, sceneDepth]);
  
  const height = 2.5; // Height of warning zone
  
  return (
    <group name="EdgeWarningZones">
      {/* Left warning zone */}
      <mesh position={[-zones.frameHalfWidth + zones.warningWidth / 2, height / 2, -zones.depth / 2]}>
        <boxGeometry args={[zones.warningWidth, height, zones.depth]} />
        <meshBasicMaterial color={COLORS.edgeWarning} transparent opacity={0.15} />
      </mesh>
      
      {/* Right warning zone */}
      <mesh position={[zones.frameHalfWidth - zones.warningWidth / 2, height / 2, -zones.depth / 2]}>
        <boxGeometry args={[zones.warningWidth, height, zones.depth]} />
        <meshBasicMaterial color={COLORS.edgeWarning} transparent opacity={0.15} />
      </mesh>
      
      {/* Left caution zone */}
      <mesh position={[-zones.frameHalfWidth + zones.warningWidth + zones.cautionWidth / 2, height / 2, -zones.depth / 2]}>
        <boxGeometry args={[zones.cautionWidth, height, zones.depth]} />
        <meshBasicMaterial color={COLORS.edgeCaution} transparent opacity={0.1} />
      </mesh>
      
      {/* Right caution zone */}
      <mesh position={[zones.frameHalfWidth - zones.warningWidth - zones.cautionWidth / 2, height / 2, -zones.depth / 2]}>
        <boxGeometry args={[zones.cautionWidth, height, zones.depth]} />
        <meshBasicMaterial color={COLORS.edgeCaution} transparent opacity={0.1} />
      </mesh>
      
      {/* Edge labels */}
      <Html position={[-zones.frameHalfWidth + 0.3, height + 0.2, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: COLORS.edgeWarning, fontSize: '10px', fontWeight: 'bold' }}>
          EDGE
        </div>
      </Html>
      <Html position={[zones.frameHalfWidth - 0.3, height + 0.2, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: COLORS.edgeWarning, fontSize: '10px', fontWeight: 'bold' }}>
          EDGE
        </div>
      </Html>
    </group>
  );
};

// =============================================================================
// Spacing Rulers
// =============================================================================

const SpacingRulers: React.FC<{
  session: ClassPhotoSession;
}> = ({ session }) => {
  const rulers = useMemo(() => {
    const result: {
      start: [number, number, number];
      end: [number, number, number];
      distance: number;
      label: string;
    }[] = [];
    
    // For each row, show spacing between first few students
    for (const row of session.rows) {
      const rowStudents = row.studentIds
        .map(id => session.students.get(id))
        .filter(Boolean) as Student[];
      
      if (rowStudents.length < 2) continue;
      
      // Only show ruler between first two students per row
      const s1 = rowStudents[0];
      const s2 = rowStudents[1];
      const y = row.baseHeight + 0.05;
      
      const distance = Math.abs(s2.position3D.x - s1.position3D.x);
      
      result.push({
        start: [s1.position3D.x, y, row.zPosition + 0.1],
        end: [s2.position3D.x, y, row.zPosition + 0.1],
        distance,
        label: `${(distance * 100).toFixed(0)}cm`,
      });
    }
    
    return result;
  }, [session]);
  
  return (
    <group name="SpacingRulers">
      {rulers.map((ruler, idx) => (
        <group key={idx}>
          {/* Ruler line */}
          <Line
            points={[ruler.start, ruler.end]}
            color={COLORS.spacing}
            lineWidth={2}
          />
          
          {/* Start tick */}
          <Line
            points={[
              [ruler.start[0], ruler.start[1], ruler.start[2]],
              [ruler.start[0], ruler.start[1] + 0.1, ruler.start[2]],
            ]}
            color={COLORS.spacing}
            lineWidth={2}
          />
          
          {/* End tick */}
          <Line
            points={[
              [ruler.end[0], ruler.end[1], ruler.end[2]],
              [ruler.end[0], ruler.end[1] + 0.1, ruler.end[2]],
            ]}
            color={COLORS.spacing}
            lineWidth={2}
          />
          
          {/* Distance label */}
          <Html
            position={[
              (ruler.start[0] + ruler.end[0]) / 2,
              ruler.start[1] + 0.15,
              ruler.start[2],
            ]}
            center
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              background: COLORS.spacing,
              color: '#fff',
              padding: '1px 4px',
              borderRadius: '2px',
              fontSize: '9px'}}>
              {ruler.label}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

// =============================================================================
// Center/Symmetry Line
// =============================================================================

const CenterLine: React.FC<{
  session: ClassPhotoSession;
}> = ({ session }) => {
  const { sceneDepth, cameraPosition } = session;
  
  return (
    <group name="CenterLine">
      {/* Vertical center line on floor */}
      <Line
        points={[
          [0, 0.02, 1],
          [0, 0.02, -sceneDepth - 1],
        ]}
        color={COLORS.centerLine}
        lineWidth={1}
        transparent
        opacity={0.5}
        dashed
        dashSize={0.2}
        dashScale={2}
      />
      
      {/* Center marker */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.15, 32]} />
        <meshBasicMaterial color={COLORS.centerLine} transparent opacity={0.5} />
      </mesh>
      
      {/* Center label */}
      <Html position={[0.25, 0.1, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: COLORS.centerLine,
          fontSize: '10px',
          opacity: 0.7}}>
          CENTER
        </div>
      </Html>
      
      {/* Camera-to-center line */}
      <Line
        points={[
          [cameraPosition.x, 0.02, cameraPosition.z],
          [0, 0.02, 0],
        ]}
        color={COLORS.centerLine}
        lineWidth={1}
        transparent
        opacity={0.3}
      />
    </group>
  );
};

// =============================================================================
// Height Gap Indicators
// =============================================================================

const HeightGapIndicators: React.FC<{
  session: ClassPhotoSession;
}> = ({ session }) => {
  const gaps = useMemo(() => {
    const result: {
      row1: number;
      row2: number;
      y1: number;
      y2: number;
      z: number;
      gap: number;
      isGood: boolean;
    }[] = [];
    
    for (let i = 0; i < session.rows.length - 1; i++) {
      const frontRow = session.rows[i];
      const backRow = session.rows[i + 1];
      
      // Get average head heights
      const frontStudents = frontRow.studentIds
        .map(id => session.students.get(id))
        .filter(Boolean) as Student[];
      const backStudents = backRow.studentIds
        .map(id => session.students.get(id))
        .filter(Boolean) as Student[];
      
      if (frontStudents.length === 0 || backStudents.length === 0) continue;
      
      const frontAvgHead = frontStudents.reduce((sum, s) => 
        sum + s.position3D.y + (s.height / 100) * 0.95, 0) / frontStudents.length;
      const backAvgHead = backStudents.reduce((sum, s) => 
        sum + s.position3D.y + (s.height / 100) * 0.95, 0) / backStudents.length;
      
      const gap = backAvgHead - frontAvgHead;
      
      result.push({
        row1: i,
        row2: i + 1,
        y1: frontAvgHead,
        y2: backAvgHead,
        z: (frontRow.zPosition + backRow.zPosition) / 2,
        gap,
        isGood: gap >= SPACING.minHeadGap,
      });
    }
    
    return result;
  }, [session]);
  
  const x = session.sceneWidth / 2 + 0.5;
  
  return (
    <group name="HeightGapIndicators">
      {gaps.map((gap, idx) => (
        <group key={idx}>
          {/* Vertical gap line */}
          <Line
            points={[
              [x, gap.y1, gap.z],
              [x, gap.y2, gap.z],
            ]}
            color={gap.isGood ? '#00ff00' : COLORS.heightGap}
            lineWidth={2}
          />
          
          {/* Top tick */}
          <Line
            points={[
              [x - 0.05, gap.y2, gap.z],
              [x + 0.05, gap.y2, gap.z],
            ]}
            color={gap.isGood ? '#00ff00' : COLORS.heightGap}
            lineWidth={2}
          />
          
          {/* Bottom tick */}
          <Line
            points={[
              [x - 0.05, gap.y1, gap.z],
              [x + 0.05, gap.y1, gap.z],
            ]}
            color={gap.isGood ? '#00ff00' : COLORS.heightGap}
            lineWidth={2}
          />
          
          {/* Gap label */}
          <Html
            position={[x + 0.15, (gap.y1 + gap.y2) / 2, gap.z]}
            style={{ pointerEvents: 'none' }}
          >
            <div style={{
              background: gap.isGood ? '#00ff00' : COLORS.heightGap,
              color: gap.isGood ? '#000' : '#fff',
              padding: '1px 4px',
              borderRadius: '2px',
              fontSize: '9px'}}>
              {(gap.gap * 100).toFixed(0)}cm
              {!gap.isGood && ' (min 15cm)'}
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
};

// =============================================================================
// Eye Line Convergence
// =============================================================================

const EyeLineGuide: React.FC<{
  session: ClassPhotoSession;
}> = ({ session }) => {
  const { cameraPosition, cameraTarget } = session;
  
  // Calculate eye convergence point (slightly above camera)
  const eyeTarget: [number, number, number] = [
    cameraPosition.x,
    cameraPosition.y + 0.1,
    cameraPosition.z,
  ];
  
  const students = Array.from(session.students.values());
  
  // Only draw lines from corner students
  const cornerStudents = useMemo(() => {
    const corners: Student[] = [];
    
    for (const row of session.rows) {
      const rowStudents = row.studentIds
        .map(id => session.students.get(id))
        .filter(Boolean) as Student[];
      
      if (rowStudents.length > 0) {
        corners.push(rowStudents[0]); // First
        if (rowStudents.length > 1) {
          corners.push(rowStudents[rowStudents.length - 1]); // Last
        }
      }
    }
    
    return corners;
  }, [session]);
  
  return (
    <group name="EyeLineGuide">
      {/* Eye target marker */}
      <mesh position={eyeTarget}>
        <sphereGeometry args={[0.08, 16, 8]} />
        <meshBasicMaterial color={COLORS.eyeLine} transparent opacity={0.5} />
      </mesh>
      
      {/* Eye lines from corners */}
      {cornerStudents.map((student, idx) => {
        const eyeHeight = student.position3D.y + (student.height / 100) * 0.9;
        const studentEye: [number, number, number] = [
          student.position3D.x,
          eyeHeight,
          student.position3D.z,
        ];
        
        return (
          <Line
            key={idx}
            points={[studentEye, eyeTarget]}
            color={COLORS.eyeLine}
            lineWidth={1}
            transparent
            opacity={0.3}
            dashed
            dashSize={0.1}
            dashScale={5}
          />
        );
      })}
      
      {/* Label */}
      <Html position={[eyeTarget[0] + 0.2, eyeTarget[1], eyeTarget[2]]} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: COLORS.eyeLine,
          fontSize: '10px'}}>
          Look Here
        </div>
      </Html>
    </group>
  );
};

// =============================================================================
// Depth of Field Preview
// =============================================================================

const DOFPreview: React.FC<{
  session: ClassPhotoSession;
  aperture?: number;
  focusDistance?: number;
}> = ({ session, aperture = 8, focusDistance }) => {
  const { cameraPosition, rows } = session;
  
  // Calculate focus distance (default to middle row)
  const focus = focusDistance || (
    rows.length > 0 
      ? cameraPosition.z - rows[Math.floor(rows.length / 2)].zPosition 
      : 5
  );
  
  // Simplified DOF calculation
  const dof = useMemo(() => {
    const circleOfConfusion = 0.03; // mm
    const focalLength = 50; // mm
    
    // Hyperfocal distance
    const hyperfocal = (focalLength * focalLength) / (aperture * circleOfConfusion) + focalLength;
    
    // Near and far limits
    const nearLimit = (focus * (hyperfocal - focalLength)) / (hyperfocal + focus - 2 * focalLength);
    const farLimit = (focus * (hyperfocal - focalLength)) / (hyperfocal - focus);
    
    return {
      near: Math.max(0.5, nearLimit / 1000), // Convert to meters
      far: Math.min(100, farLimit / 1000),
      focus: focus,
    };
  }, [focus, aperture]);
  
  const width = session.sceneWidth + 2;
  
  return (
    <group name="DOFPreview">
      {/* In-focus zone */}
      <mesh position={[0, 1, cameraPosition.z - dof.focus]} rotation={[0, 0, 0]}>
        <planeGeometry args={[width, 2.5]} />
        <meshBasicMaterial color={COLORS.dof} transparent opacity={0.1} side={THREE.DoubleSide} />
      </mesh>
      
      {/* Focus plane line */}
      <Line
        points={[
          [-width / 2, 0.02, cameraPosition.z - dof.focus],
          [width / 2, 0.02, cameraPosition.z - dof.focus],
        ]}
        color={COLORS.dof}
        lineWidth={2}
      />
      
      {/* Near focus limit */}
      <Line
        points={[
          [-width / 2, 0.02, cameraPosition.z - dof.near],
          [width / 2, 0.02, cameraPosition.z - dof.near],
        ]}
        color={COLORS.dof}
        lineWidth={1}
        transparent
        opacity={0.5}
        dashed
        dashSize={0.1}
        dashScale={3}
      />
      
      {/* Far focus limit */}
      <Line
        points={[
          [-width / 2, 0.02, cameraPosition.z - dof.far],
          [width / 2, 0.02, cameraPosition.z - dof.far],
        ]}
        color={COLORS.dof}
        lineWidth={1}
        transparent
        opacity={0.5}
        dashed
        dashSize={0.1}
        dashScale={3}
      />
      
      {/* Labels */}
      <Html position={[width / 2 + 0.2, 0.1, cameraPosition.z - dof.focus]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: COLORS.dof, fontSize: '9px' }}>
          Focus: {dof.focus.toFixed(1)}m
        </div>
      </Html>
      <Html position={[width / 2 + 0.2, 0.1, cameraPosition.z - dof.near]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: COLORS.dof, fontSize: '8px', opacity: 0.7 }}>
          Near: {dof.near.toFixed(1)}m
        </div>
      </Html>
      <Html position={[width / 2 + 0.2, 0.1, cameraPosition.z - dof.far]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: COLORS.dof, fontSize: '8px', opacity: 0.7 }}>
          Far: {dof.far.toFixed(1)}m
        </div>
      </Html>
    </group>
  );
};

// =============================================================================
// Aspect Ratio Frame
// =============================================================================

const AspectRatioFrame: React.FC<{
  session: ClassPhotoSession;
  aspectRatio: '4x6' | '5x7' | '8x10' | '8.5x11';
  fov?: number;
}> = ({ session, aspectRatio, fov = 50 }) => {
  const { cameraPosition, sceneDepth } = session;
  
  const frame = useMemo(() => {
    const halfFOV = (fov / 2) * (Math.PI / 180);
    const groundZ = -sceneDepth / 2;
    const groundDistance = cameraPosition.z - groundZ;
    const frameHalfWidth = Math.tan(halfFOV) * groundDistance;
    
    const ratio = ASPECT_RATIOS[aspectRatio];
    const frameHalfHeight = frameHalfWidth / ratio;
    
    return {
      halfWidth: frameHalfWidth * 0.95, // Slightly inside FOV
      halfHeight: frameHalfHeight * 0.95,
      centerY: 1.2, // Approximate group center height
      centerZ: groundZ,
    };
  }, [cameraPosition, fov, aspectRatio, sceneDepth]);
  
  // Frame corners at a vertical plane
  const y = frame.centerY;
  const z = frame.centerZ;
  
  return (
    <group name="AspectRatioFrame">
      {/* Frame outline */}
      <Line
        points={[
          [-frame.halfWidth, y - frame.halfHeight, z],
          [frame.halfWidth, y - frame.halfHeight, z],
          [frame.halfWidth, y + frame.halfHeight, z],
          [-frame.halfWidth, y + frame.halfHeight, z],
          [-frame.halfWidth, y - frame.halfHeight, z],
        ]}
        color={COLORS.aspectFrame}
        lineWidth={2}
        transparent
        opacity={0.6}
      />
      
      {/* Corner markers */}
      {[
        [-frame.halfWidth, y - frame.halfHeight, z],
        [frame.halfWidth, y - frame.halfHeight, z],
        [frame.halfWidth, y + frame.halfHeight, z],
        [-frame.halfWidth, y + frame.halfHeight, z],
      ].map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshBasicMaterial color={COLORS.aspectFrame} />
        </mesh>
      ))}
      
      {/* Aspect ratio label */}
      <Html position={[0, y + frame.halfHeight + 0.15, z]} center style={{ pointerEvents: 'none' }}>
        <div style={{
          background: COLORS.aspectFrame,
          color: '#000',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px'}}>
          {aspectRatio} Frame
        </div>
      </Html>
    </group>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ClassPhotoGuides: React.FC<ClassPhotoGuidesProps> = ({
  session,
  showHeadLines = true,
  showFOV = true,
  showEdgeWarnings = true,
  showSpacingRulers = true,
  showCenterLine = true,
  showHeightGaps = false,
  showEyeLine = false,
  showDOFPreview = false,
  showAspectRatioFrame = false,
  aspectRatio ='4x6',
  cameraFOV = 50,
}) => {
  return (
    <group name="ClassPhotoGuides">
      {showCenterLine && <CenterLine session={session} />}
      {showHeadLines && <HeadAlignmentLines session={session} />}
      {showFOV && <CameraFOVCone session={session} fov={cameraFOV} />}
      {showEdgeWarnings && <EdgeWarningZones session={session} fov={cameraFOV} />}
      {showSpacingRulers && <SpacingRulers session={session} />}
      {showHeightGaps && <HeightGapIndicators session={session} />}
      {showEyeLine && <EyeLineGuide session={session} />}
      {showDOFPreview && <DOFPreview session={session} />}
      {showAspectRatioFrame && <AspectRatioFrame session={session} aspectRatio={aspectRatio} />}
    </group>
  );
};

export default ClassPhotoGuides;

