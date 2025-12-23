/**
 * Face Analysis Overlay
 * 
 * Visual overlays for FaceXFormer analysis results on 3D scene:
 * - 68-point facial landmarks as 3D spheres
 * - Composition guide lines (rule of thirds, eye line, golden ratio)
 * - Head pose indicator (3D arrows showing orientation)
 * - Face center marker
 */

import React, { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Line, Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { FaceLandmarks, HeadPose } from'../../services/FaceAnalysisEnhancements';

interface FaceAnalysisOverlayProps {
  landmarks?: FaceLandmarks[];
  headPose?: HeadPose;
  compositionGuides?: {
    ruleOfThirds?: { x: number; y: number };
    eyeLine?: number;
    faceCenter?: { x: number; y: number };
    goldenRatio?: { x: number; y: number };
  };
  showLandmarks?: boolean;
  showCompositionGuides?: boolean;
  showHeadPose?: boolean;
  showFaceCenter?: boolean;
  facePosition?: [number, number, number]; // 3D position of face in scene
  scale?: number; // Scale factor for overlay elements
}

/**
 * Convert 2D landmark coordinates to 3D positions
 * Projects landmarks onto a plane in front of the face
 */
function projectLandmarksTo3D(
  landmarks: FaceLandmarks[],
  facePosition: [number, number, number],
  scale: number
): [number, number, number][] {
  // Assume landmarks are normalized 0-1, convert to 3D space
  // Face is typically ~0.2m wide, so scale accordingly
  const faceWidth = 0.2 * scale;
  const faceHeight = 0.25 * scale;
  
  return landmarks.map((landmark) => {
    // Convert from image coordinates (0-1) to 3D space
    // Center landmarks around face position
    const x = facePosition[0] + (landmark.x - 0.5) * faceWidth;
    const y = facePosition[1] + (0.5 - landmark.y) * faceHeight; // Invert Y
    const z = facePosition[2]; // Same depth as face
    
    return [x, y, z] as [number, number, number];
  });
}

/**
 * Landmark visualization component
 */
const LandmarksOverlay: React.FC<{
  landmarks: FaceLandmarks[];
  facePosition: [number, number, number];
  scale: number;
}> = ({ landmarks, facePosition, scale }) => {
  const landmarkPositions = useMemo(
    () => projectLandmarksTo3D(landmarks, facePosition, scale),
    [landmarks, facePosition, scale]
  );

  // Key landmark indices for connections (simplified face mesh)
  const connections = useMemo(() => {
    const conns: Array<[number, number]> = [];
    
    // Face outline (0-16)
    for (let i = 0; i < 16; i++) {
      conns.push([i, i + 1]);
    }
    
    // Left eyebrow (17-21)
    for (let i = 17; i < 21; i++) {
      conns.push([i, i + 1]);
    }
    
    // Right eyebrow (22-26)
    for (let i = 22; i < 26; i++) {
      conns.push([i, i + 1]);
    }
    
    // Nose (27-35)
    for (let i = 27; i < 35; i++) {
      conns.push([i, i + 1]);
    }
    
    // Left eye (36-41)
    for (let i = 36; i < 41; i++) {
      conns.push([i, i + 1]);
    }
    conns.push([41, 36]); // Close eye
    
    // Right eye (42-47)
    for (let i = 42; i < 47; i++) {
      conns.push([i, i + 1]);
    }
    conns.push([47, 42]); // Close eye
    
    // Mouth (48-67)
    for (let i = 48; i < 67; i++) {
      conns.push([i, i + 1]);
    }
    conns.push([67, 48]); // Close mouth
    
    return conns;
  }, []);

  return (
    <group>
      {/* Landmark points */}
      {landmarkPositions.map((pos, idx) => (
        <Sphere key={`landmark-${idx}`} args={[0.005 * scale, 16, 16]} position={pos}>
          <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.5} />
        </Sphere>
      ))}
      
      {/* Landmark connections */}
      {connections.map(([start, end], idx) => {
        if (start >= landmarkPositions.length || end >= landmarkPositions.length) return null;
        return (
          <Line
            key={`connection-${idx}`}
            points={[landmarkPositions[start], landmarkPositions[end]]}
            color="#00ff88"
            lineWidth={1}
            opacity={0.3}
          />
        );
      })}
    </group>
  );
};

/**
 * Composition guides visualization
 */
const CompositionGuidesOverlay: React.FC<{
  guides: NonNullable<FaceAnalysisOverlayProps['compositionGuides']>;
  facePosition: [number, number, number];
  scale: number;
}> = ({ guides, facePosition, scale }) => {
  const { camera } = useThree();
  
  // Convert 2D guide positions to 3D
  const faceWidth = 0.2 * scale;
  const faceHeight = 0.25 * scale;
  
  return (
    <group>
      {/* Rule of thirds lines */}
      {guides.ruleOfThirds && (
        <>
          {/* Horizontal line at 1/3 from top */}
          <Line
            points={[
              [facePosition[0] - faceWidth, facePosition[1] + (guides.ruleOfThirds.y - 0.5) * faceHeight, facePosition[2]],
              [facePosition[0] + faceWidth, facePosition[1] + (guides.ruleOfThirds.y - 0.5) * faceHeight, facePosition[2]],
            ]}
            color="#ffaa00"
            lineWidth={2}
            dashed
            dashScale={0.1}
          />
          {/* Vertical line at 1/3 from left */}
          <Line
            points={[
              [facePosition[0] + (guides.ruleOfThirds.x - 0.5) * faceWidth, facePosition[1] - faceHeight, facePosition[2]],
              [facePosition[0] + (guides.ruleOfThirds.x - 0.5) * faceWidth, facePosition[1] + faceHeight, facePosition[2]],
            ]}
            color="#ffaa00"
            lineWidth={2}
            dashed
            dashScale={0.1}
          />
        </>
      )}
      
      {/* Eye line */}
      {guides.eyeLine !== undefined && (
        <Line
          points={[
            [facePosition[0] - faceWidth, facePosition[1] + (guides.eyeLine - 0.5) * faceHeight, facePosition[2]],
            [facePosition[0] + faceWidth, facePosition[1] + (guides.eyeLine - 0.5) * faceHeight, facePosition[2]],
          ]}
          color="#00aaff"
          lineWidth={2}
          dashed
          dashScale={0.1}
        />
      )}
      
      {/* Face center marker */}
      {guides.faceCenter && (
        <group position={[
          facePosition[0] + (guides.faceCenter.x - 0.5) * faceWidth,
          facePosition[1] + (0.5 - guides.faceCenter.y) * faceHeight,
          facePosition[2]
        ]}>
          <Sphere args={[0.01 * scale, 16, 16]}>
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.8} />
          </Sphere>
          <Text
            position={[0, 0.02 * scale, 0]}
            fontSize={0.02 * scale}
            color="#ff0000"
            anchorX="center"
            anchorY="middle"
          >
            Face Center
          </Text>
        </group>
      )}
      
      {/* Golden ratio guide */}
      {guides.goldenRatio && (
        <Line
          points={[
            [facePosition[0] + (guides.goldenRatio.x - 0.5) * faceWidth, facePosition[1] - faceHeight, facePosition[2]],
            [facePosition[0] + (guides.goldenRatio.x - 0.5) * faceWidth, facePosition[1] + faceHeight, facePosition[2]],
          ]}
          color="#ff00ff"
          lineWidth={1.5}
          dashed
          dashScale={0.08}
        />
      )}
    </group>
  );
};

/**
 * Head pose indicator (3D arrows showing orientation)
 */
const HeadPoseIndicator: React.FC<{
  headPose: HeadPose;
  facePosition: [number, number, number];
  scale: number;
}> = ({ headPose, facePosition, scale }) => {
  const arrowLength = 0.1 * scale;
  
  // Convert angles to direction vectors
  const yawRad = (headPose.yaw * Math.PI) / 180;
  const pitchRad = (headPose.pitch * Math.PI) / 180;
  const rollRad = (headPose.roll * Math.PI) / 180;
  
  // Yaw (horizontal rotation) - red arrow
  const yawDirection: [number, number, number] = [
    Math.sin(yawRad) * arrowLength,
    0,
    Math.cos(yawRad) * arrowLength,
  ];
  
  // Pitch (vertical rotation) - green arrow
  const pitchDirection: [number, number, number] = [
    0,
    Math.sin(pitchRad) * arrowLength,
    Math.cos(pitchRad) * arrowLength,
  ];
  
  // Roll (tilt) - blue arrow
  const rollDirection: [number, number, number] = [
    Math.cos(rollRad) * arrowLength,
    Math.sin(rollRad) * arrowLength,
    0,
  ];
  
  return (
    <group position={facePosition}>
      {/* Yaw indicator (red) */}
      <Line
        points={[[0, 0, 0], yawDirection]}
        color="#ff0000"
        lineWidth={3}
      />
      <Sphere args={[0.008 * scale, 16, 16]} position={yawDirection}>
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" />
      </Sphere>
      
      {/* Pitch indicator (green) */}
      <Line
        points={[[0, 0, 0], pitchDirection]}
        color="#00ff00"
        lineWidth={3}
      />
      <Sphere args={[0.008 * scale, 16, 16]} position={pitchDirection}>
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" />
      </Sphere>
      
      {/* Roll indicator (blue) */}
      <Line
        points={[[0, 0, 0], rollDirection]}
        color="#0000ff"
        lineWidth={3}
      />
      <Sphere args={[0.008 * scale, 16, 16]} position={rollDirection}>
        <meshStandardMaterial color="#0000ff" emissive="#0000ff" />
      </Sphere>
      
      {/* Center point */}
      <Sphere args={[0.01 * scale, 16, 16]}>
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </Sphere>
    </group>
  );
};

/**
 * Main Face Analysis Overlay component
 */
export const FaceAnalysisOverlay: React.FC<FaceAnalysisOverlayProps> = ({
  landmarks,
  headPose,
  compositionGuides,
  showLandmarks = true,
  showCompositionGuides = true,
  showHeadPose = true,
  showFaceCenter = true,
  facePosition = [0, 1.65, 0], // Default face position (eye level)
  scale = 1,
}) => {
  if (!landmarks && !headPose && !compositionGuides) {
    return null;
  }

  return (
    <group>
      {/* Landmarks overlay */}
      {showLandmarks && landmarks && landmarks.length >= 68 && (
        <LandmarksOverlay landmarks={landmarks} facePosition={facePosition} scale={scale} />
      )}
      
      {/* Composition guides */}
      {showCompositionGuides && compositionGuides && (
        <CompositionGuidesOverlay guides={compositionGuides} facePosition={facePosition} scale={scale} />
      )}
      
      {/* Head pose indicator */}
      {showHeadPose && headPose && (
        <HeadPoseIndicator headPose={headPose} facePosition={facePosition} scale={scale} />
      )}
      
      {/* Face center marker (if not already shown in composition guides) */}
      {showFaceCenter && compositionGuides?.faceCenter && (
        <group position={[
          facePosition[0] + (compositionGuides.faceCenter.x - 0.5) * 0.2 * scale,
          facePosition[1] + (0.5 - compositionGuides.faceCenter.y) * 0.25 * scale,
          facePosition[2]
        ]}>
          <Sphere args={[0.015 * scale, 16, 16]}>
            <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.6} />
          </Sphere>
        </group>
      )}
    </group>
  );
};

export default FaceAnalysisOverlay;


