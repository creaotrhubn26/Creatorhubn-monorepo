/**
 * Actor Animation System
 * 
 * Provides realistic actor/subject animations including:
 * - Breathing animation (chest/shoulder movement)
 * - Idle micro-movements (weight shifts, sway)
 * - Pose transitions with blending
 * - Head movements (turns, tilts, nods)
 */

import * as THREE from 'three';
import { logger } from '../services/logger';

const log = logger.module('ActorAnimations');

// =============================================================================
// Types
// =============================================================================

export interface ActorAnimationState {
  // Breathing
  breathPhase: number;        // 0-1 breath cycle
  breathIntensity: number;    // 0-1 how deep the breath
  
  // Idle movement
  idleSwayOffset: THREE.Vector3;
  idleRotationOffset: THREE.Euler;
  weightShiftOffset: THREE.Vector3;
  
  // Head
  headRotation: THREE.Euler;
  headTargetRotation: THREE.Euler;
  
  // Pose blending
  currentPose: string;
  targetPose: string;
  poseBlendProgress: number;
  
  // Overall transform offsets to apply
  positionOffset: THREE.Vector3;
  rotationOffset: THREE.Euler;
  scaleOffset: THREE.Vector3;
}

export interface ActorAnimationConfig {
  // Breathing
  breathRate: number;           // Breaths per minute (12-20 typical)
  breathDepth: number;          // 0-1 intensity
  breathVariance: number;       // Random variance
  
  // Idle
  idleSwayAmount: number;       // Max sway distance (meters)
  idleSwaySpeed: number;        // Sway frequency (Hz)
  weightShiftInterval: number;  // Time between weight shifts (ms)
  weightShiftAmount: number;    // Max shift distance
  
  // Head
  headMovementSpeed: number;    // Degrees per second
  headMicroMovement: number;    // Micro-movement amount
  
  // Pose
  poseTransitionDuration: number; // Duration of pose blending (ms)
}

export interface PoseDefinition {
  name: string;
  spine: THREE.Euler;
  leftShoulder: THREE.Euler;
  rightShoulder: THREE.Euler;
  leftArm: THREE.Euler;
  rightArm: THREE.Euler;
  leftLeg: THREE.Euler;
  rightLeg: THREE.Euler;
  head: THREE.Euler;
  hips: THREE.Vector3;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: ActorAnimationConfig = {
  breathRate: 15,           // 15 breaths/min
  breathDepth: 0.5,
  breathVariance: 0.1,
  idleSwayAmount: 0.01,     // 1cm sway
  idleSwaySpeed: 0.3,       // Slow sway
  weightShiftInterval: 5000, // 5s between shifts
  weightShiftAmount: 0.02,   // 2cm shift
  headMovementSpeed: 30,     // 30 deg/s
  headMicroMovement: 0.5,    // degrees
  poseTransitionDuration: 800, // 800ms transition
};

// =============================================================================
// Easing Functions
// =============================================================================

const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;
const easeInOutCubic = (t: number): number => 
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// =============================================================================
// Pose Presets
// =============================================================================

export const POSE_PRESETS: Record<string, Partial<PoseDefinition>> = {
  standing_neutral: {
    name: 'Standing Neutral',
    spine: new THREE.Euler(0, 0, 0),
    leftShoulder: new THREE.Euler(0, 0, -0.05),
    rightShoulder: new THREE.Euler(0, 0, 0.05),
    leftArm: new THREE.Euler(0, 0, -0.1),
    rightArm: new THREE.Euler(0, 0, 0.1),
    leftLeg: new THREE.Euler(0, 0, 0),
    rightLeg: new THREE.Euler(0, 0, 0),
    head: new THREE.Euler(0, 0, 0),
    hips: new THREE.Vector3(0, 0, 0),
  },
  
  standing_relaxed: {
    name: 'Standing Relaxed',
    spine: new THREE.Euler(0.02, 0, 0.01),
    leftShoulder: new THREE.Euler(0, 0, -0.08),
    rightShoulder: new THREE.Euler(0, 0, 0.05),
    leftArm: new THREE.Euler(0, 0, -0.15),
    rightArm: new THREE.Euler(0, 0, 0.1),
    leftLeg: new THREE.Euler(0, 0, 0.02),
    rightLeg: new THREE.Euler(0.05, 0, -0.02),
    head: new THREE.Euler(0, 0.05, 0.02),
    hips: new THREE.Vector3(0.01, 0, 0),
  },
  
  standing_confident: {
    name: 'Standing Confident',
    spine: new THREE.Euler(-0.02, 0, 0),
    leftShoulder: new THREE.Euler(-0.05, 0, -0.1),
    rightShoulder: new THREE.Euler(-0.05, 0, 0.1),
    leftArm: new THREE.Euler(0, 0.05, -0.12),
    rightArm: new THREE.Euler(0, -0.05, 0.12),
    leftLeg: new THREE.Euler(0, 0, 0),
    rightLeg: new THREE.Euler(0, 0, 0),
    head: new THREE.Euler(-0.03, 0, 0),
    hips: new THREE.Vector3(0, 0, 0),
  },
  
  sitting_neutral: {
    name: 'Sitting Neutral',
    spine: new THREE.Euler(0.05, 0, 0),
    leftShoulder: new THREE.Euler(0.02, 0, -0.05),
    rightShoulder: new THREE.Euler(0.02, 0, 0.05),
    leftArm: new THREE.Euler(0.3, 0, -0.1),
    rightArm: new THREE.Euler(0.3, 0, 0.1),
    leftLeg: new THREE.Euler(1.57, 0, 0),
    rightLeg: new THREE.Euler(1.57, 0, 0),
    head: new THREE.Euler(0, 0, 0),
    hips: new THREE.Vector3(0, -0.4, 0),
  },
  
  sitting_relaxed: {
    name: 'Sitting Relaxed',
    spine: new THREE.Euler(0.08, 0, 0.02),
    leftShoulder: new THREE.Euler(0.05, 0, -0.08),
    rightShoulder: new THREE.Euler(0.03, 0, 0.05),
    leftArm: new THREE.Euler(0.35, 0.05, -0.15),
    rightArm: new THREE.Euler(0.25, -0.05, 0.1),
    leftLeg: new THREE.Euler(1.5, 0, 0.1),
    rightLeg: new THREE.Euler(1.6, 0, -0.05),
    head: new THREE.Euler(0.02, 0.05, 0.02),
    hips: new THREE.Vector3(0.01, -0.42, 0),
  },
  
  headshot: {
    name: 'Headshot',
    spine: new THREE.Euler(-0.02, 0, 0),
    leftShoulder: new THREE.Euler(-0.03, 0, -0.05),
    rightShoulder: new THREE.Euler(-0.03, 0, 0.05),
    leftArm: new THREE.Euler(0, 0, -0.08),
    rightArm: new THREE.Euler(0, 0, 0.08),
    leftLeg: new THREE.Euler(0, 0, 0),
    rightLeg: new THREE.Euler(0, 0, 0),
    head: new THREE.Euler(-0.02, 0.03, 0.01),
    hips: new THREE.Vector3(0, 0, 0),
  },
};

// =============================================================================
// Actor Animation Controller
// =============================================================================

export class ActorAnimationController {
  private state: ActorAnimationState;
  private config: ActorAnimationConfig;
  private lastWeightShiftTime: number = 0;
  private poseTransitionStartTime: number = 0;
  private startPose: Partial<PoseDefinition> = {};
  private endPose: Partial<PoseDefinition> = {};

  constructor(config: Partial<ActorAnimationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      breathPhase: 0,
      breathIntensity: this.config.breathDepth,
      idleSwayOffset: new THREE.Vector3(),
      idleRotationOffset: new THREE.Euler(),
      weightShiftOffset: new THREE.Vector3(),
      headRotation: new THREE.Euler(),
      headTargetRotation: new THREE.Euler(),
      currentPose: 'standing_neutral',
      targetPose: 'standing_neutral',
      poseBlendProgress: 1,
      positionOffset: new THREE.Vector3(),
      rotationOffset: new THREE.Euler(),
      scaleOffset: new THREE.Vector3(1, 1, 1),
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Update animation state - call every frame
   */
  update(deltaTime: number, time: number): ActorAnimationState {
    this.updateBreathing(deltaTime, time);
    this.updateIdleMovement(deltaTime, time);
    this.updateWeightShift(deltaTime, time);
    this.updateHeadMovement(deltaTime, time);
    this.updatePoseTransition(deltaTime);
    this.computeFinalOffsets();
    
    return { ...this.state };
  }

  /**
   * Transition to a new pose
   */
  transitionToPose(poseName: string): void {
    if (!POSE_PRESETS[poseName]) {
      log.warn(`Unknown pose: ${poseName}`);
      return;
    }
    
    if (poseName === this.state.currentPose && this.state.poseBlendProgress >= 1) {
      return; // Already in this pose
    }
    
    this.startPose = POSE_PRESETS[this.state.currentPose] || POSE_PRESETS.standing_neutral;
    this.endPose = POSE_PRESETS[poseName];
    this.state.targetPose = poseName;
    this.state.poseBlendProgress = 0;
    this.poseTransitionStartTime = Date.now();
  }

  /**
   * Look at a target position
   */
  lookAt(target: THREE.Vector3, subjectPosition: THREE.Vector3): void {
    const direction = target.clone().sub(subjectPosition).normalize();
    
    // Calculate yaw (left/right) and pitch (up/down)
    const yaw = Math.atan2(direction.x, direction.z);
    const pitch = -Math.asin(direction.y);
    
    // Clamp to realistic head rotation limits
    const maxYaw = THREE.MathUtils.degToRad(70);
    const maxPitch = THREE.MathUtils.degToRad(40);
    
    this.state.headTargetRotation.set(
      THREE.MathUtils.clamp(pitch, -maxPitch, maxPitch),
      THREE.MathUtils.clamp(yaw, -maxYaw, maxYaw),
      0
    );
  }

  /**
   * Set breathing rate
   */
  setBreathRate(bpm: number): void {
    this.config.breathRate = Math.max(8, Math.min(30, bpm));
  }

  /**
   * Get current state
   */
  getState(): ActorAnimationState {
    return { ...this.state };
  }

  /**
   * Get chest/shoulder offset for breathing
   */
  getBreathOffset(): { chest: THREE.Vector3; shoulders: THREE.Vector3 } {
    const breathAmount = Math.sin(this.state.breathPhase * Math.PI * 2) * this.state.breathIntensity;
    
    return {
      chest: new THREE.Vector3(0, breathAmount * 0.01, breathAmount * 0.005),
      shoulders: new THREE.Vector3(0, breathAmount * 0.005, 0),
    };
  }

  /**
   * Get current blended pose
   */
  getBlendedPose(): Partial<PoseDefinition> {
    if (this.state.poseBlendProgress >= 1) {
      return POSE_PRESETS[this.state.currentPose] || POSE_PRESETS.standing_neutral;
    }
    
    const t = easeInOutCubic(this.state.poseBlendProgress);
    return this.blendPoses(this.startPose, this.endPose, t);
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private updateBreathing(deltaTime: number, time: number): void {
    // Breathing cycle based on breath rate
    const breathDuration = 60 / this.config.breathRate; // seconds per breath
    const variance = (Math.sin(time * 0.1) * 0.5 + 0.5) * this.config.breathVariance;
    
    this.state.breathPhase += (deltaTime / (breathDuration + variance));
    if (this.state.breathPhase >= 1) {
      this.state.breathPhase -= 1;
    }
    
    // Vary breath intensity slightly
    this.state.breathIntensity = this.config.breathDepth + 
      Math.sin(time * 0.05) * this.config.breathDepth * 0.2;
  }

  private updateIdleMovement(deltaTime: number, time: number): void {
    const t = time * this.config.idleSwaySpeed;
    const amount = this.config.idleSwayAmount;
    
    // Natural sway using layered sine waves
    this.state.idleSwayOffset.set(
      Math.sin(t * 0.7) * amount + Math.sin(t * 1.3) * amount * 0.3,
      Math.sin(t * 0.5 + 0.5) * amount * 0.5,
      Math.sin(t * 0.9 + 1.0) * amount * 0.7
    );
    
    // Subtle rotation sway
    this.state.idleRotationOffset.set(
      Math.sin(t * 0.4) * 0.005,
      Math.sin(t * 0.6 + 0.3) * 0.008,
      Math.sin(t * 0.5 + 0.7) * 0.003
    );
  }

  private updateWeightShift(deltaTime: number, time: number): void {
    const now = Date.now();
    
    if (now - this.lastWeightShiftTime > this.config.weightShiftInterval) {
      // Trigger a weight shift
      this.lastWeightShiftTime = now;
      
      // Randomly shift weight left or right
      const direction = Math.random() > 0.5 ? 1 : -1;
      this.state.weightShiftOffset.set(
        direction * this.config.weightShiftAmount,
        0,
        (Math.random() - 0.5) * this.config.weightShiftAmount * 0.5
      );
    }
    
    // Smooth interpolation towards target
    this.state.weightShiftOffset.multiplyScalar(0.98);
  }

  private updateHeadMovement(deltaTime: number, time: number): void {
    // Smoothly interpolate head rotation towards target
    const speed = THREE.MathUtils.degToRad(this.config.headMovementSpeed) * deltaTime;
    
    const diff = new THREE.Euler(
      this.state.headTargetRotation.x - this.state.headRotation.x,
      this.state.headTargetRotation.y - this.state.headRotation.y,
      this.state.headTargetRotation.z - this.state.headRotation.z
    );
    
    // Move towards target with speed limit
    this.state.headRotation.x += Math.sign(diff.x) * Math.min(Math.abs(diff.x), speed);
    this.state.headRotation.y += Math.sign(diff.y) * Math.min(Math.abs(diff.y), speed);
    this.state.headRotation.z += Math.sign(diff.z) * Math.min(Math.abs(diff.z), speed);
    
    // Add micro-movements
    const micro = THREE.MathUtils.degToRad(this.config.headMicroMovement);
    this.state.headRotation.x += Math.sin(time * 1.1) * micro * 0.5;
    this.state.headRotation.y += Math.sin(time * 0.9 + 0.5) * micro;
    this.state.headRotation.z += Math.sin(time * 1.3 + 1.0) * micro * 0.3;
  }

  private updatePoseTransition(deltaTime: number): void {
    if (this.state.poseBlendProgress >= 1) return;
    
    const elapsed = Date.now() - this.poseTransitionStartTime;
    this.state.poseBlendProgress = Math.min(1, elapsed / this.config.poseTransitionDuration);
    
    if (this.state.poseBlendProgress >= 1) {
      this.state.currentPose = this.state.targetPose;
    }
  }

  private computeFinalOffsets(): void {
    const breathOffset = this.getBreathOffset();
    
    // Combine all offsets
    this.state.positionOffset.copy(this.state.idleSwayOffset)
      .add(this.state.weightShiftOffset)
      .add(breathOffset.chest);
    
    this.state.rotationOffset.copy(this.state.idleRotationOffset);
  }

  private blendPoses(
    start: Partial<PoseDefinition>,
    end: Partial<PoseDefinition>,
    t: number
  ): Partial<PoseDefinition> {
    const result: Partial<PoseDefinition> = {};
    
    // Blend each property
    const blendEuler = (a?: THREE.Euler, b?: THREE.Euler): THREE.Euler => {
      if (!a || !b) return a || b || new THREE.Euler();
      return new THREE.Euler(
        THREE.MathUtils.lerp(a.x, b.x, t),
        THREE.MathUtils.lerp(a.y, b.y, t),
        THREE.MathUtils.lerp(a.z, b.z, t)
      );
    };
    
    const blendVector3 = (a?: THREE.Vector3, b?: THREE.Vector3): THREE.Vector3 => {
      if (!a || !b) return a || b || new THREE.Vector3();
      return new THREE.Vector3().lerpVectors(a, b, t);
    };
    
    result.spine = blendEuler(start.spine, end.spine);
    result.leftShoulder = blendEuler(start.leftShoulder, end.leftShoulder);
    result.rightShoulder = blendEuler(start.rightShoulder, end.rightShoulder);
    result.leftArm = blendEuler(start.leftArm, end.leftArm);
    result.rightArm = blendEuler(start.rightArm, end.rightArm);
    result.leftLeg = blendEuler(start.leftLeg, end.leftLeg);
    result.rightLeg = blendEuler(start.rightLeg, end.rightLeg);
    result.head = blendEuler(start.head, end.head);
    result.hips = blendVector3(start.hips, end.hips);
    
    return result;
  }
}

// =============================================================================
// Animation Presets
// =============================================================================

export const ACTOR_ANIMATION_PRESETS = {
  /**
   * Natural portrait session
   */
  portrait: {
    breathRate: 14,
    breathDepth: 0.4,
    breathVariance: 0.05,
    idleSwayAmount: 0.005,
    idleSwaySpeed: 0.2,
    weightShiftInterval: 8000,
    weightShiftAmount: 0.01,
    headMovementSpeed: 20,
    headMicroMovement: 0.3,
    poseTransitionDuration: 1000,
  } as ActorAnimationConfig,

  /**
   * Fashion/editorial - more movement
   */
  fashion: {
    breathRate: 16,
    breathDepth: 0.5,
    breathVariance: 0.1,
    idleSwayAmount: 0.015,
    idleSwaySpeed: 0.4,
    weightShiftInterval: 4000,
    weightShiftAmount: 0.03,
    headMovementSpeed: 40,
    headMicroMovement: 0.5,
    poseTransitionDuration: 600,
  } as ActorAnimationConfig,

  /**
   * Corporate - minimal movement
   */
  corporate: {
    breathRate: 13,
    breathDepth: 0.3,
    breathVariance: 0.03,
    idleSwayAmount: 0.003,
    idleSwaySpeed: 0.15,
    weightShiftInterval: 10000,
    weightShiftAmount: 0.008,
    headMovementSpeed: 15,
    headMicroMovement: 0.2,
    poseTransitionDuration: 1200,
  } as ActorAnimationConfig,

  /**
   * Dramatic - expressive movement
   */
  dramatic: {
    breathRate: 18,
    breathDepth: 0.7,
    breathVariance: 0.15,
    idleSwayAmount: 0.02,
    idleSwaySpeed: 0.5,
    weightShiftInterval: 3000,
    weightShiftAmount: 0.04,
    headMovementSpeed: 50,
    headMicroMovement: 0.8,
    poseTransitionDuration: 500,
  } as ActorAnimationConfig,

  /**
   * Static - for product/still shots
   */
  static: {
    breathRate: 12,
    breathDepth: 0.2,
    breathVariance: 0.02,
    idleSwayAmount: 0.001,
    idleSwaySpeed: 0.1,
    weightShiftInterval: 20000,
    weightShiftAmount: 0.005,
    headMovementSpeed: 10,
    headMicroMovement: 0.1,
    poseTransitionDuration: 1500,
  } as ActorAnimationConfig,
};

export default ActorAnimationController;

