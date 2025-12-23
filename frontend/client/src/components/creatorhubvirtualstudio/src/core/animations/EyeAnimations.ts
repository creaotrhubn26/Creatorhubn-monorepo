/**
 * Eye Animation System
 * 
 * Provides realistic eye animations including:
 * - Saccades (rapid eye movements)
 * - Smooth pursuit (following objects)
 * - Blink animation with natural timing
 * - Pupil dilation reactive to light
 * - Micro-movements for realism
 */

import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export interface EyeAnimationState {
  gazeTarget: THREE.Vector3;
  gazeVelocity: THREE.Vector3;
  pupilDilation: number;
  blinkProgress: number; // 0 = open, 1 = closed
  isBlinking: boolean;
  lastBlinkTime: number;
  microMovementOffset: THREE.Vector2;
}

export interface EyeAnimationConfig {
  saccadeSpeed: number;        // Degrees per second (300-700 typical)
  smoothPursuitSpeed: number;  // Degrees per second (30-100 typical)
  blinkDuration: number;       // Milliseconds (100-400 typical)
  blinkInterval: number;       // Milliseconds between blinks (2000-10000)
  blinkVariance: number;       // Random variance in blink timing
  pupilReactionSpeed: number;  // How fast pupil reacts to light (0.1-1)
  microMovementAmount: number; // Amplitude of micro-movements (0-0.01)
  microMovementSpeed: number;  // Speed of micro-movements
}

export interface SaccadeParams {
  startTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  duration: number;
  onComplete?: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: EyeAnimationConfig = {
  saccadeSpeed: 500,          // deg/s
  smoothPursuitSpeed: 50,     // deg/s
  blinkDuration: 150,         // ms
  blinkInterval: 4000,        // ms
  blinkVariance: 2000,        // ms
  pupilReactionSpeed: 0.3,    // per frame
  microMovementAmount: 0.002, // radians
  microMovementSpeed: 2,      // Hz
};

// Blink curve - quick close, slightly slower open
const BLINK_CURVE = {
  close: (t: number) => Math.pow(t, 0.5),      // Fast close
  open: (t: number) => 1 - Math.pow(1 - t, 2), // Slower open
};

// =============================================================================
// Easing Functions
// =============================================================================

const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);
const easeInOutQuad = (t: number): number => 
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOutElastic = (t: number): number => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

// =============================================================================
// Eye Animation Controller
// =============================================================================

export class EyeAnimationController {
  private state: EyeAnimationState;
  private config: EyeAnimationConfig;
  private saccadeInProgress: boolean = false;
  private saccadeStartTime: number = 0;
  private saccadeStartTarget: THREE.Vector3 = new THREE.Vector3();
  private saccadeEndTarget: THREE.Vector3 = new THREE.Vector3();
  private saccadeDuration: number = 0;
  private targetLightIntensity: number = 0.5;
  private onBlinkCallback?: () => void;
  private onSaccadeCompleteCallback?: () => void;

  constructor(config: Partial<EyeAnimationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      gazeTarget: new THREE.Vector3(0, 0, 1),
      gazeVelocity: new THREE.Vector3(),
      pupilDilation: 0.5,
      blinkProgress: 0,
      isBlinking: false,
      lastBlinkTime: Date.now(),
      microMovementOffset: new THREE.Vector2(),
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Update animation state - call every frame
   */
  update(deltaTime: number, time: number): EyeAnimationState {
    this.updateSaccade(deltaTime, time);
    this.updateBlink(deltaTime, time);
    this.updatePupil(deltaTime);
    this.updateMicroMovements(time);
    this.checkAutoBlink(time);
    
    return { ...this.state };
  }

  /**
   * Start a saccade (rapid eye movement) to a new target
   */
  saccadeTo(target: THREE.Vector3, onComplete?: () => void): void {
    const distance = this.state.gazeTarget.angleTo(target);
    const duration = Math.max(30, Math.min(100, distance * 1000 / this.config.saccadeSpeed));
    
    this.saccadeStartTarget.copy(this.state.gazeTarget);
    this.saccadeEndTarget.copy(target);
    this.saccadeDuration = duration;
    this.saccadeStartTime = Date.now();
    this.saccadeInProgress = true;
    this.onSaccadeCompleteCallback = onComplete;
  }

  /**
   * Smooth pursuit - follow a moving target
   */
  smoothPursuit(target: THREE.Vector3, deltaTime: number): void {
    if (this.saccadeInProgress) return;
    
    const maxAngle = THREE.MathUtils.degToRad(this.config.smoothPursuitSpeed) * deltaTime;
    const direction = target.clone().sub(this.state.gazeTarget).normalize();
    const angle = this.state.gazeTarget.angleTo(target);
    
    if (angle > maxAngle) {
      // Move towards target at max speed
      const axis = new THREE.Vector3().crossVectors(this.state.gazeTarget, target).normalize();
      const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, maxAngle);
      this.state.gazeTarget.applyQuaternion(quaternion).normalize();
    } else {
      // Close enough - snap to target
      this.state.gazeTarget.copy(target).normalize();
    }
  }

  /**
   * Trigger a blink
   */
  blink(onComplete?: () => void): void {
    if (this.state.isBlinking) return;
    
    this.state.isBlinking = true;
    this.state.lastBlinkTime = Date.now();
    this.onBlinkCallback = onComplete;
  }

  /**
   * Set target light intensity for pupil reaction
   */
  setLightIntensity(intensity: number): void {
    this.targetLightIntensity = Math.max(0, Math.min(1, intensity));
  }

  /**
   * Get current gaze direction with micro-movements applied
   */
  getGazeWithMicroMovements(): THREE.Vector3 {
    const gaze = this.state.gazeTarget.clone();
    // Apply micro-movement as small rotation
    const offsetQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        this.state.microMovementOffset.y,
        this.state.microMovementOffset.x,
        0
      )
    );
    return gaze.applyQuaternion(offsetQuat);
  }

  /**
   * Get current state
   */
  getState(): EyeAnimationState {
    return { ...this.state };
  }

  /**
   * Update config
   */
  setConfig(config: Partial<EyeAnimationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private updateSaccade(deltaTime: number, time: number): void {
    if (!this.saccadeInProgress) return;
    
    const elapsed = Date.now() - this.saccadeStartTime;
    const progress = Math.min(1, elapsed / this.saccadeDuration);
    
    // Use easeOutQuint for natural saccade motion
    const easedProgress = easeOutQuint(progress);
    
    // Interpolate between start and end
    this.state.gazeTarget.lerpVectors(
      this.saccadeStartTarget,
      this.saccadeEndTarget,
      easedProgress
    ).normalize();
    
    // Calculate velocity for motion blur effects
    if (progress < 1) {
      const prevProgress = Math.max(0, (elapsed - deltaTime * 1000) / this.saccadeDuration);
      const prevEased = easeOutQuint(prevProgress);
      const prevTarget = new THREE.Vector3().lerpVectors(
        this.saccadeStartTarget,
        this.saccadeEndTarget,
        prevEased
      );
      this.state.gazeVelocity.subVectors(this.state.gazeTarget, prevTarget).divideScalar(deltaTime);
    }
    
    if (progress >= 1) {
      this.saccadeInProgress = false;
      this.state.gazeVelocity.set(0, 0, 0);
      this.onSaccadeCompleteCallback?.();
      this.onSaccadeCompleteCallback = undefined;
    }
  }

  private updateBlink(deltaTime: number, time: number): void {
    if (!this.state.isBlinking) return;
    
    const elapsed = Date.now() - this.state.lastBlinkTime;
    const halfDuration = this.config.blinkDuration / 2;
    
    if (elapsed < halfDuration) {
      // Closing phase
      const t = elapsed / halfDuration;
      this.state.blinkProgress = BLINK_CURVE.close(t);
    } else if (elapsed < this.config.blinkDuration) {
      // Opening phase
      const t = (elapsed - halfDuration) / halfDuration;
      this.state.blinkProgress = 1 - BLINK_CURVE.open(t);
    } else {
      // Blink complete
      this.state.blinkProgress = 0;
      this.state.isBlinking = false;
      this.onBlinkCallback?.();
      this.onBlinkCallback = undefined;
    }
  }

  private updatePupil(deltaTime: number): void {
    // Pupil dilates in low light, constricts in bright light
    // Inverse relationship: high light = low dilation
    const targetDilation = 1 - this.targetLightIntensity;
    
    // Smooth interpolation
    const diff = targetDilation - this.state.pupilDilation;
    this.state.pupilDilation += diff * this.config.pupilReactionSpeed;
    
    // Clamp to valid range
    this.state.pupilDilation = Math.max(0.2, Math.min(0.9, this.state.pupilDilation));
  }

  private updateMicroMovements(time: number): void {
    // Perlin-like noise using sine waves at different frequencies
    const t = time * this.config.microMovementSpeed;
    const amount = this.config.microMovementAmount;
    
    this.state.microMovementOffset.x = 
      Math.sin(t * 1.3) * amount * 0.7 +
      Math.sin(t * 2.7) * amount * 0.3;
    
    this.state.microMovementOffset.y = 
      Math.sin(t * 1.1 + 0.5) * amount * 0.7 +
      Math.sin(t * 2.3 + 1.2) * amount * 0.3;
  }

  private checkAutoBlink(time: number): void {
    if (this.state.isBlinking) return;
    
    const timeSinceLastBlink = Date.now() - this.state.lastBlinkTime;
    const nextBlinkTime = this.config.blinkInterval + 
      (Math.random() - 0.5) * this.config.blinkVariance;
    
    if (timeSinceLastBlink > nextBlinkTime) {
      this.blink();
    }
  }
}

// =============================================================================
// Animation Presets
// =============================================================================

export const EYE_ANIMATION_PRESETS = {
  /**
   * Natural relaxed eye movement
   */
  relaxed: {
    saccadeSpeed: 400,
    smoothPursuitSpeed: 40,
    blinkDuration: 200,
    blinkInterval: 4000,
    blinkVariance: 2000,
    pupilReactionSpeed: 0.2,
    microMovementAmount: 0.002,
    microMovementSpeed: 1.5,
  } as EyeAnimationConfig,

  /**
   * Alert/focused state
   */
  alert: {
    saccadeSpeed: 600,
    smoothPursuitSpeed: 80,
    blinkDuration: 100,
    blinkInterval: 6000,
    blinkVariance: 1000,
    pupilReactionSpeed: 0.5,
    microMovementAmount: 0.001,
    microMovementSpeed: 3,
  } as EyeAnimationConfig,

  /**
   * Tired/sleepy state
   */
  tired: {
    saccadeSpeed: 300,
    smoothPursuitSpeed: 30,
    blinkDuration: 300,
    blinkInterval: 2000,
    blinkVariance: 1000,
    pupilReactionSpeed: 0.1,
    microMovementAmount: 0.003,
    microMovementSpeed: 0.8,
  } as EyeAnimationConfig,

  /**
   * Nervous/anxious state
   */
  nervous: {
    saccadeSpeed: 700,
    smoothPursuitSpeed: 60,
    blinkDuration: 120,
    blinkInterval: 2500,
    blinkVariance: 1500,
    pupilReactionSpeed: 0.4,
    microMovementAmount: 0.004,
    microMovementSpeed: 4,
  } as EyeAnimationConfig,

  /**
   * Portrait photography - minimal movement
   */
  portrait: {
    saccadeSpeed: 300,
    smoothPursuitSpeed: 20,
    blinkDuration: 180,
    blinkInterval: 8000,
    blinkVariance: 3000,
    pupilReactionSpeed: 0.15,
    microMovementAmount: 0.001,
    microMovementSpeed: 1,
  } as EyeAnimationConfig,
};

// =============================================================================
// React Hook
// =============================================================================

export function createEyeAnimationHook() {
  let controller: EyeAnimationController | null = null;
  
  return {
    init: (config?: Partial<EyeAnimationConfig>) => {
      controller = new EyeAnimationController(config);
      return controller;
    },
    
    getController: () => controller,
    
    dispose: () => {
      controller = null;
    },
  };
}

export default EyeAnimationController;

