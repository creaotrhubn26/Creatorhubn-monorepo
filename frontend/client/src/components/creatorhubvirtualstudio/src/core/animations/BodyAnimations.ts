/**
 * Body Animation System
 * 
 * Provides detailed body part animations including:
 * - Head position, rotation, and tilt
 * - Hand positions and gestures
 * - Arm poses and movements
 * - Finger positions
 * - Shoulder/torso adjustments
 */

import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export interface HeadAnimationState {
  position: THREE.Vector3;     // Offset from base position
  rotation: THREE.Euler;       // Pitch, yaw, roll
  targetRotation: THREE.Euler;
  isMoving: boolean;
  tiltAmount: number;          // Side tilt (-1 to 1)
  nodAmount: number;           // Nod progress (0 to 1)
}

export interface HandAnimationState {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  targetPosition: THREE.Vector3;
  targetRotation: THREE.Euler;
  gesture: HandGesture;
  fingerSpread: number;        // 0 = closed, 1 = spread
  fingerCurl: number[];        // Per-finger curl (thumb, index, middle, ring, pinky)
  isMoving: boolean;
}

export interface ArmAnimationState {
  shoulderRotation: THREE.Euler;
  elbowAngle: number;          // 0 = straight, PI = fully bent
  wristRotation: THREE.Euler;
  targetShoulderRotation: THREE.Euler;
  targetElbowAngle: number;
}

export interface BodyAnimationState {
  head: HeadAnimationState;
  leftHand: HandAnimationState;
  rightHand: HandAnimationState;
  leftArm: ArmAnimationState;
  rightArm: ArmAnimationState;
  torsoRotation: THREE.Euler;
  torsoLean: THREE.Vector2;    // Forward/back, left/right lean
}

export type HandGesture = 
  | 'relaxed'
  | 'fist'
  | 'open'
  | 'pointing'
  | 'peace'
  | 'thumbsUp'
  | 'ok'
  | 'grip'
  | 'pinch'
  | 'wave';

export interface BodyAnimationConfig {
  headSpeed: number;           // Rotation speed (deg/s)
  headSmoothing: number;       // Smoothing factor (0-1)
  handSpeed: number;           // Hand movement speed (m/s)
  handSmoothing: number;
  armSpeed: number;            // Arm rotation speed (deg/s)
  gestureTransitionTime: number; // Time to change gestures (ms)
  microMovementEnabled: boolean;
  microMovementAmount: number;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: BodyAnimationConfig = {
  headSpeed: 60,
  headSmoothing: 0.1,
  handSpeed: 0.5,
  handSmoothing: 0.15,
  armSpeed: 45,
  gestureTransitionTime: 300,
  microMovementEnabled: true,
  microMovementAmount: 0.002,
};

// Head rotation limits (radians)
const HEAD_LIMITS = {
  pitch: { min: -0.7, max: 0.5 },    // Look down/up
  yaw: { min: -1.2, max: 1.2 },      // Look left/right
  roll: { min: -0.3, max: 0.3 },     // Tilt head
};

// Arm limits
const ARM_LIMITS = {
  shoulderPitch: { min: -0.5, max: 2.5 },   // Arm forward/back
  shoulderYaw: { min: -0.3, max: 1.5 },     // Arm out/in
  shoulderRoll: { min: -1.0, max: 1.0 },    // Arm rotation
  elbow: { min: 0, max: 2.5 },              // Elbow bend
  wristPitch: { min: -1.2, max: 1.2 },      // Wrist up/down
  wristYaw: { min: -0.5, max: 0.5 },        // Wrist side
  wristRoll: { min: -1.5, max: 1.5 },       // Wrist rotation
};

// =============================================================================
// Gesture Definitions
// =============================================================================

export const GESTURE_DEFINITIONS: Record<HandGesture, number[]> = {
  relaxed: [0.2, 0.3, 0.35, 0.35, 0.4],    // Slightly curled
  fist: [0.9, 0.95, 0.95, 0.95, 0.95],     // Fully closed
  open: [0, 0, 0, 0, 0],                    // Flat hand
  pointing: [0.9, 0, 0.95, 0.95, 0.95],    // Index extended
  peace: [0.9, 0, 0, 0.95, 0.95],          // Index + middle extended
  thumbsUp: [0, 0.95, 0.95, 0.95, 0.95],   // Thumb up, rest closed
  ok: [0.3, 0.8, 0, 0, 0],                 // Thumb + index circle
  grip: [0.6, 0.7, 0.7, 0.7, 0.7],         // Gripping something
  pinch: [0.5, 0.5, 0.9, 0.9, 0.9],        // Thumb + index pinch
  wave: [0, 0, 0, 0, 0],                   // Open for waving
};

// =============================================================================
// Head/Hand Preset Positions
// =============================================================================

export const HEAD_PRESETS = {
  forward: { pitch: 0, yaw: 0, roll: 0, tilt: 0 },
  slightLeft: { pitch: 0, yaw: 0.2, roll: 0, tilt: 0.05 },
  slightRight: { pitch: 0, yaw: -0.2, roll: 0, tilt: -0.05 },
  tiltLeft: { pitch: 0, yaw: 0, roll: 0.15, tilt: 0.1 },
  tiltRight: { pitch: 0, yaw: 0, roll: -0.15, tilt: -0.1 },
  lookUp: { pitch: -0.3, yaw: 0, roll: 0, tilt: 0 },
  lookDown: { pitch: 0.2, yaw: 0, roll: 0, tilt: 0 },
  thoughtful: { pitch: 0.05, yaw: 0.15, roll: 0.08, tilt: 0.05 },
  confident: { pitch: -0.1, yaw: 0, roll: 0, tilt: 0 },
  shy: { pitch: 0.15, yaw: 0.1, roll: 0.05, tilt: 0.08 },
};

export const HAND_PRESETS = {
  atSide: {
    left: { x: -0.25, y: 0.5, z: 0.05 },
    right: { x: 0.25, y: 0.5, z: 0.05 },
  },
  onHip: {
    left: { x: -0.2, y: 0.85, z: 0.1 },
    right: { x: 0.2, y: 0.85, z: 0.1 },
  },
  crossed: {
    left: { x: 0.1, y: 1.0, z: 0.15 },
    right: { x: -0.1, y: 1.0, z: 0.15 },
  },
  inFront: {
    left: { x: -0.15, y: 0.9, z: 0.25 },
    right: { x: 0.15, y: 0.9, z: 0.25 },
  },
  onLap: {
    left: { x: -0.15, y: 0.6, z: 0.2 },
    right: { x: 0.15, y: 0.6, z: 0.2 },
  },
  gesturing: {
    left: { x: -0.3, y: 1.1, z: 0.3 },
    right: { x: 0.3, y: 1.1, z: 0.3 },
  },
  onChin: {
    left: { x: -0.05, y: 1.5, z: 0.15 },
    right: { x: 0.05, y: 1.5, z: 0.15 },
  },
  prayerPose: {
    left: { x: 0.05, y: 1.1, z: 0.2 },
    right: { x: -0.05, y: 1.1, z: 0.2 },
  },
};

// =============================================================================
// Easing Functions
// =============================================================================

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);
const easeInOutCubic = (t: number): number => 
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// =============================================================================
// Body Animation Controller
// =============================================================================

export class BodyAnimationController {
  private state: BodyAnimationState;
  private config: BodyAnimationConfig;
  private gestureTransitions: Map<string, { start: number[]; end: number[]; startTime: number }> = new Map();

  constructor(config: Partial<BodyAnimationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.createDefaultState();
  }

  // ---------------------------------------------------------------------------
  // Public API - Head
  // ---------------------------------------------------------------------------

  /**
   * Look at a world position
   */
  lookAt(target: THREE.Vector3, headPosition: THREE.Vector3): void {
    const direction = target.clone().sub(headPosition).normalize();
    
    // Calculate pitch (up/down) and yaw (left/right)
    const yaw = Math.atan2(direction.x, direction.z);
    const pitch = -Math.asin(direction.y);
    
    // Clamp to limits
    this.state.head.targetRotation.set(
      THREE.MathUtils.clamp(pitch, HEAD_LIMITS.pitch.min, HEAD_LIMITS.pitch.max),
      THREE.MathUtils.clamp(yaw, HEAD_LIMITS.yaw.min, HEAD_LIMITS.yaw.max),
      this.state.head.targetRotation.z
    );
  }

  /**
   * Set head to a preset position
   */
  setHeadPreset(preset: keyof typeof HEAD_PRESETS): void {
    const p = HEAD_PRESETS[preset];
    this.state.head.targetRotation.set(p.pitch, p.yaw, p.roll);
    this.state.head.tiltAmount = p.tilt;
  }

  /**
   * Tilt head
   */
  tiltHead(amount: number): void {
    this.state.head.tiltAmount = THREE.MathUtils.clamp(amount, -1, 1);
    this.state.head.targetRotation.z = amount * HEAD_LIMITS.roll.max;
  }

  /**
   * Nod head (0 to 1 progress)
   */
  nod(progress: number): void {
    this.state.head.nodAmount = progress;
    // Nod is a pitch animation
    const nodPitch = Math.sin(progress * Math.PI * 2) * 0.15;
    this.state.head.targetRotation.x = nodPitch;
  }

  /**
   * Shake head (0 to 1 progress)
   */
  shake(progress: number): void {
    const shakeYaw = Math.sin(progress * Math.PI * 4) * 0.2;
    this.state.head.targetRotation.y = shakeYaw;
  }

  // ---------------------------------------------------------------------------
  // Public API - Hands
  // ---------------------------------------------------------------------------

  /**
   * Move hand to position
   */
    moveHand(
      hand: 'left' | 'right',
      position: THREE.Vector3,
      rotation?: THREE.Euler
  ): void {
    const handState = hand === 'left' ? this.state.leftHand : this.state.rightHand;
    handState.targetPosition.copy(position);
    if (rotation) {
      handState.targetRotation.copy(rotation);
    }
  }

  /**
   * Set hands to preset positions
   */
  setHandPreset(preset: keyof typeof HAND_PRESETS): void {
    const p = HAND_PRESETS[preset];
    this.state.leftHand.targetPosition.set(p.left.x, p.left.y, p.left.z);
    this.state.rightHand.targetPosition.set(p.right.x, p.right.y, p.right.z);
  }

  /**
   * Set hand gesture
   */
  setGesture(hand: 'left' | 'right' | 'both', gesture: HandGesture): void {
    const targetCurl = GESTURE_DEFINITIONS[gesture];
    
    if (hand === 'left' || hand === 'both') {
      this.startGestureTransition('left', this.state.leftHand.fingerCurl, targetCurl);
      this.state.leftHand.gesture = gesture;
    }
    if (hand === 'right' || hand === 'both') {
      this.startGestureTransition('right', this.state.rightHand.fingerCurl, targetCurl);
      this.state.rightHand.gesture = gesture;
    }
  }

  /**
   * Wave animation
   */
  wave(hand: 'left' | 'right', progress: number): void {
    const handState = hand === 'left' ? this.state.leftHand : this.state.rightHand;
    const armState = hand === 'left' ? this.state.leftArm : this.state.rightArm;
    
    // Raise arm
    armState.targetShoulderRotation.x = -1.2; // Raise up
    armState.targetElbowAngle = 1.5;          // Bend elbow
    
    // Wave motion
    const waveAngle = Math.sin(progress * Math.PI * 4) * 0.4;
    handState.targetRotation.z = waveAngle;
    
    // Open hand for wave
    this.setGesture(hand, 'wave');
  }

  // ---------------------------------------------------------------------------
  // Public API - Arms
  // ---------------------------------------------------------------------------

  /**
   * Set arm pose
   */
  setArmPose(
    arm: 'left' | 'right',
    shoulderRotation: THREE.Euler,
    elbowAngle: number,
    wristRotation?: THREE.Euler
  ): void {
    const armState = arm === 'left' ? this.state.leftArm : this.state.rightArm;
    
    armState.targetShoulderRotation.copy(shoulderRotation);
    armState.targetElbowAngle = THREE.MathUtils.clamp(
      elbowAngle, 
      ARM_LIMITS.elbow.min, 
      ARM_LIMITS.elbow.max
    );
    
    if (wristRotation) {
      armState.wristRotation.copy(wristRotation);
    }
  }

  /**
   * Cross arms
   */
  crossArms(): void {
    this.setHandPreset('crossed');
    this.state.leftArm.targetShoulderRotation.set(0.3, 0.8, 0.2);
    this.state.rightArm.targetShoulderRotation.set(0.3, -0.8, -0.2);
    this.state.leftArm.targetElbowAngle = 1.8;
    this.state.rightArm.targetElbowAngle = 1.8;
    this.setGesture('both','grip');
  }

  /**
   * Hands on hips
   */
  handsOnHips(): void {
    this.setHandPreset('onHip');
    this.state.leftArm.targetShoulderRotation.set(0.2, 0.5, 0.3);
    this.state.rightArm.targetShoulderRotation.set(0.2, -0.5, -0.3);
    this.state.leftArm.targetElbowAngle = 1.5;
    this.state.rightArm.targetElbowAngle = 1.5;
    this.setGesture('both', 'relaxed');
  }

  /**
   * Relaxed pose (arms at side)
   */
  relaxedPose(): void {
    this.setHandPreset('atSide');
    this.state.leftArm.targetShoulderRotation.set(0.05, 0.1, 0);
    this.state.rightArm.targetShoulderRotation.set(0.05, -0.1, 0);
    this.state.leftArm.targetElbowAngle = 0.15;
    this.state.rightArm.targetElbowAngle = 0.15;
    this.setGesture('both', 'relaxed');
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  /**
   * Update animation state - call every frame
   */
  update(deltaTime: number, time: number): BodyAnimationState {
    this.updateHead(deltaTime, time);
    this.updateHand(this.state.leftHand, deltaTime, time);
    this.updateHand(this.state.rightHand, deltaTime, time);
    this.updateArm(this.state.leftArm, deltaTime);
    this.updateArm(this.state.rightArm, deltaTime);
    this.updateGestureTransitions();
    
    if (this.config.microMovementEnabled) {
      this.addMicroMovements(time);
    }
    
    return { ...this.state };
  }

  /**
   * Get current state
   */
  getState(): BodyAnimationState {
    return { ...this.state };
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private createDefaultState(): BodyAnimationState {
    return {
      head: {
        position: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        targetRotation: new THREE.Euler(),
        isMoving: false,
        tiltAmount: 0,
        nodAmount: 0,
      },
      leftHand: this.createDefaultHandState(),
      rightHand: this.createDefaultHandState(),
      leftArm: this.createDefaultArmState(),
      rightArm: this.createDefaultArmState(),
      torsoRotation: new THREE.Euler(),
      torsoLean: new THREE.Vector2(),
    };
  }

  private createDefaultHandState(): HandAnimationState {
    return {
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      targetPosition: new THREE.Vector3(),
      targetRotation: new THREE.Euler(),
      gesture: 'relaxed',
      fingerSpread: 0.2,
      fingerCurl: [...GESTURE_DEFINITIONS.relaxed],
      isMoving: false,
    };
  }

  private createDefaultArmState(): ArmAnimationState {
    return {
      shoulderRotation: new THREE.Euler(),
      elbowAngle: 0.1,
      wristRotation: new THREE.Euler(),
      targetShoulderRotation: new THREE.Euler(),
      targetElbowAngle: 0.1,
    };
  }

  private updateHead(deltaTime: number, time: number): void {
    const head = this.state.head;
    const smoothing = this.config.headSmoothing;
    
    // Smoothly interpolate rotation
    head.rotation.x += (head.targetRotation.x - head.rotation.x) * smoothing;
    head.rotation.y += (head.targetRotation.y - head.rotation.y) * smoothing;
    head.rotation.z += (head.targetRotation.z - head.rotation.z) * smoothing;
    
    // Check if still moving
    const diff = Math.abs(head.targetRotation.x - head.rotation.x) +
                 Math.abs(head.targetRotation.y - head.rotation.y) +
                 Math.abs(head.targetRotation.z - head.rotation.z);
    head.isMoving = diff > 0.001;
  }

  private updateHand(hand: HandAnimationState, deltaTime: number, time: number): void {
    const smoothing = this.config.handSmoothing;
    
    // Smoothly interpolate position
    hand.position.lerp(hand.targetPosition, smoothing);
    
    // Smoothly interpolate rotation
    hand.rotation.x += (hand.targetRotation.x - hand.rotation.x) * smoothing;
    hand.rotation.y += (hand.targetRotation.y - hand.rotation.y) * smoothing;
    hand.rotation.z += (hand.targetRotation.z - hand.rotation.z) * smoothing;
    
    // Check if still moving
    const posDiff = hand.position.distanceTo(hand.targetPosition);
    hand.isMoving = posDiff > 0.001;
  }

  private updateArm(arm: ArmAnimationState, deltaTime: number): void {
    const speed = THREE.MathUtils.degToRad(this.config.armSpeed) * deltaTime;
    
    // Interpolate shoulder rotation
    arm.shoulderRotation.x += Math.sign(arm.targetShoulderRotation.x - arm.shoulderRotation.x) * 
      Math.min(Math.abs(arm.targetShoulderRotation.x - arm.shoulderRotation.x), speed);
    arm.shoulderRotation.y += Math.sign(arm.targetShoulderRotation.y - arm.shoulderRotation.y) * 
      Math.min(Math.abs(arm.targetShoulderRotation.y - arm.shoulderRotation.y), speed);
    arm.shoulderRotation.z += Math.sign(arm.targetShoulderRotation.z - arm.shoulderRotation.z) * 
      Math.min(Math.abs(arm.targetShoulderRotation.z - arm.shoulderRotation.z), speed);
    
    // Interpolate elbow angle
    const elbowDiff = arm.targetElbowAngle - arm.elbowAngle;
    arm.elbowAngle += Math.sign(elbowDiff) * Math.min(Math.abs(elbowDiff), speed);
  }

  private startGestureTransition(hand: string, start: number[], end: number[]): void {
    this.gestureTransitions.set(hand, {
      start: [...start],
      end: [...end],
      startTime: Date.now(),
    });
  }

  private updateGestureTransitions(): void {
    const now = Date.now();
    
    for (const [hand, transition] of this.gestureTransitions) {
      const elapsed = now - transition.startTime;
      const progress = Math.min(1, elapsed / this.config.gestureTransitionTime);
      const eased = easeInOutCubic(progress);
      
      const handState = hand === 'left' ? this.state.leftHand : this.state.rightHand;
      
      // Interpolate each finger
      for (let i = 0; i < 5; i++) {
        handState.fingerCurl[i] = THREE.MathUtils.lerp(
          transition.start[i],
          transition.end[i],
          eased
        );
      }
      
      if (progress >= 1) {
        this.gestureTransitions.delete(hand);
      }
    }
  }

  private addMicroMovements(time: number): void {
    const amount = this.config.microMovementAmount;
    
    // Head micro-movements
    this.state.head.rotation.x += Math.sin(time * 1.3) * amount;
    this.state.head.rotation.y += Math.sin(time * 0.9 + 0.5) * amount;
    
    // Hand micro-movements
    this.state.leftHand.position.x += Math.sin(time * 1.1) * amount * 0.5;
    this.state.leftHand.position.y += Math.sin(time * 1.4 + 0.3) * amount * 0.5;
    this.state.rightHand.position.x += Math.sin(time * 1.2 + 0.7) * amount * 0.5;
    this.state.rightHand.position.y += Math.sin(time * 1.5 + 1.0) * amount * 0.5;
  }
}

// =============================================================================
// Animation Presets
// =============================================================================

export const BODY_ANIMATION_PRESETS = {
  portrait: {
    headSpeed: 40,
    headSmoothing: 0.08,
    handSpeed: 0.3,
    handSmoothing: 0.1,
    armSpeed: 30,
    gestureTransitionTime: 400,
    microMovementEnabled: true,
    microMovementAmount: 0.001,
  } as BodyAnimationConfig,
  
  fashion: {
    headSpeed: 60,
    headSmoothing: 0.12,
    handSpeed: 0.5,
    handSmoothing: 0.15,
    armSpeed: 50,
    gestureTransitionTime: 250,
    microMovementEnabled: true,
    microMovementAmount: 0.002,
  } as BodyAnimationConfig,
  
  dramatic: {
    headSpeed: 80,
    headSmoothing: 0.15,
    handSpeed: 0.7,
    handSmoothing: 0.2,
    armSpeed: 70,
    gestureTransitionTime: 200,
    microMovementEnabled: true,
    microMovementAmount: 0.003,
  } as BodyAnimationConfig,
  
  subtle: {
    headSpeed: 25,
    headSmoothing: 0.05,
    handSpeed: 0.2,
    handSmoothing: 0.08,
    armSpeed: 20,
    gestureTransitionTime: 500,
    microMovementEnabled: true,
    microMovementAmount: 0.0005,
  } as BodyAnimationConfig,
};

// =============================================================================
// Full Body Pose Presets
// =============================================================================

export const FULL_BODY_POSES = {
  neutral: {
    head: 'forward',
    hands: 'atSide',
    gesture: 'relaxed' as HandGesture,
  },
  confident: {
    head: 'confident',
    hands: 'onHip',
    gesture: 'relaxed' as HandGesture,
  },
  thoughtful: {
    head: 'thoughtful',
    hands: 'onChin',
    gesture: 'relaxed' as HandGesture,
  },
  open: {
    head: 'forward',
    hands: 'gesturing',
    gesture: 'open' as HandGesture,
  },
  crossed: {
    head: 'slightLeft',
    hands: 'crossed',
    gesture: 'grip' as HandGesture,
  },
  shy: {
    head: 'shy',
    hands: 'inFront',
    gesture: 'relaxed' as HandGesture,
  },
  professional: {
    head: 'forward',
    hands: 'inFront',
    gesture: 'relaxed' as HandGesture,
  },
};

export default BodyAnimationController;

