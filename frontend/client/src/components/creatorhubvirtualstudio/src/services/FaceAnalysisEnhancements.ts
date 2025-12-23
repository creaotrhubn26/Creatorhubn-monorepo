/**
 * Face Analysis Enhancements Service
 * 
 * Provides utilities to enhance the Virtual Studio scene based on FaceXFormer analysis results:
 * - Auto-adjust camera based on head pose
 * - Face-aware lighting using parsing masks
 * - Landmark-based composition guides
 * - Real-time analysis integration
 */

import { logger } from '../core/services/logger';
import { getMainCamera } from '../core/services/viewports';

const log = logger.module('FaceAnalysisEnhancements');

export interface HeadPose {
  pitch: number; // Vertical rotation (nodding)
  yaw: number;   // Horizontal rotation (turning)
  roll: number;  // Tilt (leaning)
}

export interface FaceLandmarks {
  x: number;
  y: number;
}

export interface FaceAnalysisResults {
  headpose?: HeadPose;
  landmarks?: FaceLandmarks[];
  parsing?: string; // Base64 image of parsing mask
  attributes?: number[];
}

export interface CameraAdjustment {
  position?: [number, number, number];
  rotation?: [number, number, number];
  target?: [number, number, number];
}

export interface LightingAdjustment {
  nodeId: string;
  intensity?: number;
  color?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Calculate camera adjustment based on head pose
 * Matches camera angle to face orientation for optimal framing
 */
export function calculateCameraAdjustment(
  headPose: HeadPose,
  currentCamera?: { position: [number, number, number]; rotation: [number, number, number] }
): CameraAdjustment {
  // Convert head pose angles (degrees) to camera adjustments
  // Invert head pose to match camera to face orientation
  const yawAdjustment = -headPose.yaw * 0.5; // Reduce sensitivity
  const pitchAdjustment = -headPose.pitch * 0.5;
  const rollAdjustment = -headPose.roll * 0.3;

  // Default camera position (eye level, 2m away)
  const defaultPosition: [number, number, number] = [0, 1.65, 2];
  const defaultRotation: [number, number, number] = [0, 0, 0];

  // Get current values or use defaults
  const currentPos = currentCamera?.position || defaultPosition;
  const currentRot = currentCamera?.rotation || defaultRotation;

  // Calculate new rotation (additive adjustment)
  const newRotation: [number, number, number] = [
    currentRot[0] + pitchAdjustment * (Math.PI / 180),
    currentRot[1] + yawAdjustment * (Math.PI / 180),
    currentRot[2] + rollAdjustment * (Math.PI / 180),
  ];

  // Adjust camera distance based on head tilt (closer for downward, farther for upward)
  const distanceMultiplier = 1 + (headPose.pitch / 45) * 0.2; // ±20% distance adjustment
  
  // Calculate distance from origin
  const currentDistance = Math.sqrt(
    currentPos[0] ** 2 + currentPos[1] ** 2 + currentPos[2] ** 2
  ) || 2; // Fallback to 2m if at origin
  
  const newDistance = currentDistance * distanceMultiplier;
  
  // Maintain direction but adjust distance
  const direction = currentDistance > 0.1 ? [
    currentPos[0] / currentDistance,
    currentPos[1] / currentDistance,
    currentPos[2] / currentDistance,
  ] : [0, 0, 1]; // Default forward direction
  
  const newPosition: [number, number, number] = [
    direction[0] * newDistance,
    currentPos[1] + (headPose.pitch / 45) * 0.3, // Vertical offset
    direction[2] * newDistance,
  ];

  return {
    position: newPosition,
    rotation: newRotation,
    target: [0, 1.65, 0], // Focus on face center
  };
}

/**
 * Calculate face-aware lighting adjustments
 * Uses parsing mask to determine face region and adjust lighting accordingly
 */
export function calculateFaceAwareLighting(
  results: FaceAnalysisResults,
  lightNodes: Array<{ id: string; transform?: { position: [number, number, number] }; light?: any }>
): LightingAdjustment[] {
  const adjustments: LightingAdjustment[] = [];

  if (!results.headpose || !results.parsing) {
    return adjustments;
  }

  // Find key light (main light source)
  const keyLight = lightNodes.find((n) => n.light?.modifier === 'key' || n.light?.role === 'key');
  if (keyLight) {
    // Adjust key light based on head pose
    const { yaw, pitch } = results.headpose;

    // Position key light opposite to face direction for better definition
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;

    const keyLightPosition: [number, number, number] = [
      -Math.sin(yawRad) * 2, // Opposite side of face
      1.65 + Math.sin(pitchRad) * 0.5, // Slightly above/below based on pitch
      Math.cos(yawRad) * 2,
    ];

    adjustments.push({
      nodeId: keyLight.id,
      position: keyLightPosition,
      intensity: 1.0, // Full intensity for key light
    });
  }

  // Find fill light
  const fillLight = lightNodes.find((n) => n.light?.modifier === 'fill' || n.light?.role === 'fill');
  if (fillLight) {
    // Position fill light on opposite side from key light
    const { yaw } = results.headpose;
    const yawRad = (yaw * Math.PI) / 180;

    const fillLightPosition: [number, number, number] = [
      Math.sin(yawRad) * 1.5, // Opposite from key light
      1.5, // Slightly lower
      Math.cos(yawRad) * 1.5,
    ];

    adjustments.push({
      nodeId: fillLight.id,
      position: fillLightPosition,
      intensity: 0.4, // Softer fill light
    });
  }

  // Find rim/back light
  const rimLight = lightNodes.find((n) => n.light?.modifier === 'rim' || n.light?.role === 'rim');
  if (rimLight) {
    // Position behind subject based on head pose
    const { yaw } = results.headpose;
    const yawRad = (yaw * Math.PI) / 180;

    const rimLightPosition: [number, number, number] = [
      -Math.sin(yawRad) * 1.2,
      1.8, // Higher up
      -Math.cos(yawRad) * 1.2, // Behind
    ];

    adjustments.push({
      nodeId: rimLight.id,
      position: rimLightPosition,
      intensity: 0.6,
    });
  }

  return adjustments;
}

/**
 * Calculate composition guides based on landmarks
 * Returns ideal framing positions based on facial landmarks
 */
export function calculateCompositionGuides(landmarks: FaceLandmarks[]): {
  ruleOfThirds?: { x: number; y: number };
  eyeLine?: number;
  faceCenter?: { x: number; y: number };
  goldenRatio?: { x: number; y: number };
} {
  if (!landmarks || landmarks.length < 68) {
    return {};
  }

  // Extract key landmarks (0-indexed, 68-point standard)
  const leftEye = landmarks[36]; // Left eye center
  const rightEye = landmarks[45]; // Right eye center
  const noseTip = landmarks[30]; // Nose tip
  const mouthCenter = landmarks[66]; // Mouth center (approximate)

  if (!leftEye || !rightEye || !noseTip) {
    return {};
  }

  // Calculate eye line (horizontal line through eyes)
  const eyeLineY = (leftEye.y + rightEye.y) / 2;

  // Calculate face center
  const faceCenterX = (leftEye.x + rightEye.x) / 2;
  const faceCenterY = (noseTip.y + eyeLineY) / 2;

  // Rule of thirds (place eyes on upper third line)
  const ruleOfThirdsY = eyeLineY; // Should be at ~33% from top

  // Golden ratio (place face center at golden ratio point)
  const goldenRatio = 1.618;
  const goldenRatioY = faceCenterY;

  return {
    ruleOfThirds: { x: faceCenterX, y: ruleOfThirdsY },
    eyeLine: eyeLineY,
    faceCenter: { x: faceCenterX, y: faceCenterY },
    goldenRatio: { x: faceCenterX, y: goldenRatioY },
  };
}

/**
 * Apply camera adjustment to scene
 */
export function applyCameraAdjustment(
  adjustment: CameraAdjustment,
  updateNode: (id: string, updates: any) => void,
  cameraNodeId?: string,
  cameraNode?: any
): void {
  // Try to update Three.js camera directly first (more immediate)
  const mainCamera = getMainCamera();
  if (mainCamera) {
    try {
      if (adjustment.rotation) {
        mainCamera.rotation.set(...adjustment.rotation);
      }
      if (adjustment.position) {
        mainCamera.position.set(...adjustment.position);
      }
      if (adjustment.target) {
        mainCamera.lookAt(...adjustment.target);
      }
      log.info('Camera adjusted via Three.js object');
    } catch (err) {
      log.warn('Failed to update Three.js camera directly', err);
    }
  }

  // Also update camera node in store for persistence
  if (cameraNodeId) {
    const updates: any = {};
    
    // Get current transform from node if available
    const currentTransform = cameraNode?.transform || {};
    
    if (adjustment.position) {
      updates.transform = {
        ...currentTransform,
        position: adjustment.position,
      };
    }
    if (adjustment.rotation) {
      updates.transform = {
        ...(updates.transform || currentTransform),
        rotation: adjustment.rotation,
      };
    }
    
    if (Object.keys(updates).length > 0) {
      updateNode(cameraNodeId, updates);
      log.info('Camera node updated in store', updates);
    }
  } else if (!mainCamera) {
    log.warn('No camera found to adjust (neither Three.js object nor node ID provided)');
  }
}

/**
 * Apply lighting adjustments to scene
 */
export function applyLightingAdjustments(
  adjustments: LightingAdjustment[],
  updateNode: (id: string, updates: any) => void,
  lightNodes?: Array<{ id: string; light?: any; transform?: any }>
): void {
  if (adjustments.length === 0) {
    return;
  }

  adjustments.forEach((adj) => {
    // Find the light node to get current properties
    const lightNode = lightNodes?.find((n) => n.id === adj.nodeId);
    const currentLight = lightNode?.light || {};
    const currentTransform = lightNode?.transform || {};

    const updates: any = {};

    // Merge light properties
    if (adj.intensity !== undefined || adj.color) {
      updates.light = {
        ...currentLight,
        ...(adj.intensity !== undefined && { power: adj.intensity }),
        ...(adj.color && { color: adj.color }),
      };
    }

    // Merge transform properties
    if (adj.position || adj.rotation) {
      updates.transform = {
        ...currentTransform,
        ...(adj.position && { position: adj.position }),
        ...(adj.rotation && { rotation: adj.rotation }),
      };
    }

    if (Object.keys(updates).length > 0) {
      updateNode(adj.nodeId, updates);
      log.debug(`Updated light node ${adj.nodeId}`, updates);
    } else {
      log.warn(`No updates to apply for light node ${adj.nodeId}`);
    }
  });

  log.info(`Applied ${adjustments.length} lighting adjustments`);
}

/**
 * Get recommended camera settings based on face attributes
 */
export function getRecommendedCameraSettings(attributes: number[]): {
  fov?: number;
  distance?: number;
  angle?: string;
} {
  if (!attributes || attributes.length === 0) {
    return {};
  }

  // Attribute indices (based on FaceXFormer attribute format)
  // This is a simplified mapping - adjust based on actual attribute format
  const hasGlasses = attributes[15] === 1; // Example index
  const hasBeard = attributes[16] === 1;
  const isSmiling = attributes[18] === 1;

  const settings: any = {};

  // Adjust FOV based on attributes
  if (hasGlasses) {
    settings.fov = 50; // Wider FOV to show glasses
  } else {
    settings.fov = 60; // Standard portrait FOV
  }

  // Adjust distance
  if (isSmiling) {
    settings.distance = 1.8; // Closer for smiling portraits
  } else {
    settings.distance = 2.2; // Standard distance
  }

  // Angle recommendation
  if (hasBeard) {
    settings.angle = 'slightly_low'; // Show beard definition
  } else {
    settings.angle ='eye_level'; // Standard portrait angle
  }

  return settings;
}


