/**
 * Catchlight Animation System
 * 
 * Provides reactive catchlight animations including:
 * - Intensity fade when lights power change
 * - Position interpolation when lights move
 * - Shape morphing transitions
 * - Flicker effects
 */

import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export interface CatchlightAnimationState {
  intensity: number;
  targetIntensity: number;
  position: THREE.Vector2;
  targetPosition: THREE.Vector2;
  size: number;
  targetSize: number;
  shape: string;
  targetShape: string;
  shapeMorphProgress: number;
  flickerOffset: number;
  color: THREE.Color;
  targetColor: THREE.Color;
}

export interface CatchlightAnimationConfig {
  intensitySpeed: number;    // Fade speed (0-1 per second)
  positionSpeed: number;     // Position lerp speed
  sizeSpeed: number;         // Size change speed
  shapeMorphDuration: number; // Shape transition duration (ms)
  flickerEnabled: boolean;
  flickerIntensity: number;  // 0-1
  flickerSpeed: number;      // Hz
  colorSpeed: number;        // Color transition speed
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: CatchlightAnimationConfig = {
  intensitySpeed: 2,        // 2 units/sec = 0.5s for full fade
  positionSpeed: 5,         // Fast position follow
  sizeSpeed: 3,
  shapeMorphDuration: 300,  // 300ms shape transition
  flickerEnabled: false,
  flickerIntensity: 0.1,
  flickerSpeed: 10,
  colorSpeed: 2,
};

// =============================================================================
// Easing Functions
// =============================================================================

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);
const easeInOutCubic = (t: number): number => 
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// =============================================================================
// Catchlight Animation Controller
// =============================================================================

export class CatchlightAnimationController {
  private states: Map<string, CatchlightAnimationState> = new Map();
  private config: CatchlightAnimationConfig;
  private shapeMorphStartTimes: Map<string, number> = new Map();

  constructor(config: Partial<CatchlightAnimationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Initialize or update a catchlight
   */
  setCatchlight(
    id: string,
    target: {
      intensity: number;
      position: THREE.Vector2;
      size: number;
      shape: string;
      color: THREE.Color;
    }
  ): void {
    let state = this.states.get(id);
    
    if (!state) {
      // Create new state - start at target values
      state = {
        intensity: target.intensity,
        targetIntensity: target.intensity,
        position: target.position.clone(),
        targetPosition: target.position.clone(),
        size: target.size,
        targetSize: target.size,
        shape: target.shape,
        targetShape: target.shape,
        shapeMorphProgress: 1,
        flickerOffset: 0,
        color: target.color.clone(),
        targetColor: target.color.clone(),
      };
      this.states.set(id, state);
    } else {
      // Update targets
      state.targetIntensity = target.intensity;
      state.targetPosition.copy(target.position);
      state.targetSize = target.size;
      state.targetColor.copy(target.color);
      
      // Handle shape change
      if (target.shape !== state.targetShape) {
        state.targetShape = target.shape;
        state.shapeMorphProgress = 0;
        this.shapeMorphStartTimes.set(id, Date.now());
      }
    }
  }

  /**
   * Remove a catchlight
   */
  removeCatchlight(id: string): void {
    this.states.delete(id);
    this.shapeMorphStartTimes.delete(id);
  }

  /**
   * Update all catchlights - call every frame
   */
  update(deltaTime: number, time: number): Map<string, CatchlightAnimationState> {
    for (const [id, state] of this.states) {
      this.updateIntensity(state, deltaTime);
      this.updatePosition(state, deltaTime);
      this.updateSize(state, deltaTime);
      this.updateShapeMorph(id, state);
      this.updateFlicker(state, time);
      this.updateColor(state, deltaTime);
    }
    
    return new Map(this.states);
  }

  /**
   * Get animated state for a catchlight
   */
  getState(id: string): CatchlightAnimationState | undefined {
    return this.states.get(id);
  }

  /**
   * Enable/disable flicker effect
   */
  setFlicker(enabled: boolean, intensity?: number): void {
    this.config.flickerEnabled = enabled;
    if (intensity !== undefined) {
      this.config.flickerIntensity = intensity;
    }
  }

  /**
   * Trigger a flash effect (bright then fade)
   */
  flash(id: string, peakIntensity: number = 2, duration: number = 200): void {
    const state = this.states.get(id);
    if (!state) return;
    
    const originalTarget = state.targetIntensity;
    state.intensity = peakIntensity;
    
    // Restore after duration
    setTimeout(() => {
      if (this.states.has(id)) {
        state.targetIntensity = originalTarget;
      }
    }, duration);
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private updateIntensity(state: CatchlightAnimationState, deltaTime: number): void {
    const diff = state.targetIntensity - state.intensity;
    const change = Math.sign(diff) * Math.min(
      Math.abs(diff),
      this.config.intensitySpeed * deltaTime
    );
    state.intensity += change;
  }

  private updatePosition(state: CatchlightAnimationState, deltaTime: number): void {
    const speed = this.config.positionSpeed * deltaTime;
    state.position.lerp(state.targetPosition, Math.min(1, speed));
  }

  private updateSize(state: CatchlightAnimationState, deltaTime: number): void {
    const diff = state.targetSize - state.size;
    const change = Math.sign(diff) * Math.min(
      Math.abs(diff),
      this.config.sizeSpeed * deltaTime
    );
    state.size += change;
  }

  private updateShapeMorph(id: string, state: CatchlightAnimationState): void {
    if (state.shapeMorphProgress >= 1) return;
    
    const startTime = this.shapeMorphStartTimes.get(id) || Date.now();
    const elapsed = Date.now() - startTime;
    state.shapeMorphProgress = Math.min(1, elapsed / this.config.shapeMorphDuration);
    
    if (state.shapeMorphProgress >= 1) {
      state.shape = state.targetShape;
    }
  }

  private updateFlicker(state: CatchlightAnimationState, time: number): void {
    if (!this.config.flickerEnabled) {
      state.flickerOffset = 0;
      return;
    }
    
    // Random-ish flicker using layered sine waves
    const t = time * this.config.flickerSpeed;
    state.flickerOffset = (
      Math.sin(t * 13.7) * 0.3 +
      Math.sin(t * 7.3 + 0.5) * 0.4 +
      Math.sin(t * 3.1 + 1.2) * 0.3
    ) * this.config.flickerIntensity;
  }

  private updateColor(state: CatchlightAnimationState, deltaTime: number): void {
    const speed = this.config.colorSpeed * deltaTime;
    state.color.lerp(state.targetColor, Math.min(1, speed));
  }
}

// =============================================================================
// Light Power Animation Controller
// =============================================================================

export interface LightPowerAnimation {
  lightId: string;
  startPower: number;
  endPower: number;
  duration: number;
  startTime: number;
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
  onComplete?: () => void;
}

export class LightPowerAnimator {
  private animations: Map<string, LightPowerAnimation> = new Map();
  
  /**
   * Animate light power change
   */
  animate(
    lightId: string,
    fromPower: number,
    toPower: number,
    duration: number,
    easing: LightPowerAnimation['easing'] = 'easeOut',
    onComplete?: () => void
  ): void {
    this.animations.set(lightId, {
      lightId,
      startPower: fromPower,
      endPower: toPower,
      duration,
      startTime: Date.now(),
      easing,
      onComplete,
    });
  }
  
  /**
   * Update and get current power values
   */
  update(): Map<string, number> {
    const powers = new Map<string, number>();
    const completed: string[] = [];
    
    for (const [id, anim] of this.animations) {
      const elapsed = Date.now() - anim.startTime;
      let t = Math.min(1, elapsed / anim.duration);
      
      // Apply easing
      switch (anim.easing) {
        case 'easeIn':
          t = t * t;
          break;
        case 'easeOut':
          t = 1 - (1 - t) * (1 - t);
          break;
        case'easeInOut':
          t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          break;
      }
      
      const power = anim.startPower + (anim.endPower - anim.startPower) * t;
      powers.set(id, power);
      
      if (elapsed >= anim.duration) {
        completed.push(id);
        anim.onComplete?.();
      }
    }
    
    // Remove completed animations
    for (const id of completed) {
      this.animations.delete(id);
    }
    
    return powers;
  }
  
  /**
   * Check if a light is animating
   */
  isAnimating(lightId: string): boolean {
    return this.animations.has(lightId);
  }
  
  /**
   * Cancel animation
   */
  cancel(lightId: string): void {
    this.animations.delete(lightId);
  }
}

// =============================================================================
// Exports
// =============================================================================

export const CATCHLIGHT_ANIMATION_PRESETS = {
  instant: {
    intensitySpeed: 100,
    positionSpeed: 100,
    sizeSpeed: 100,
    shapeMorphDuration: 0,
    flickerEnabled: false,
    flickerIntensity: 0,
    flickerSpeed: 0,
    colorSpeed: 100,
  } as CatchlightAnimationConfig,
  
  smooth: {
    intensitySpeed: 2,
    positionSpeed: 5,
    sizeSpeed: 3,
    shapeMorphDuration: 300,
    flickerEnabled: false,
    flickerIntensity: 0,
    flickerSpeed: 0,
    colorSpeed: 2,
  } as CatchlightAnimationConfig,
  
  dramatic: {
    intensitySpeed: 1,
    positionSpeed: 3,
    sizeSpeed: 2,
    shapeMorphDuration: 500,
    flickerEnabled: false,
    flickerIntensity: 0,
    flickerSpeed: 0,
    colorSpeed: 1,
  } as CatchlightAnimationConfig,
  
  strobe: {
    intensitySpeed: 50,
    positionSpeed: 10,
    sizeSpeed: 10,
    shapeMorphDuration: 50,
    flickerEnabled: true,
    flickerIntensity: 0.5,
    flickerSpeed: 20,
    colorSpeed: 10,
  } as CatchlightAnimationConfig,
  
  candlelight: {
    intensitySpeed: 3,
    positionSpeed: 2,
    sizeSpeed: 2,
    shapeMorphDuration: 400,
    flickerEnabled: true,
    flickerIntensity: 0.15,
    flickerSpeed: 8,
    colorSpeed: 1.5,
  } as CatchlightAnimationConfig,
};

export default CatchlightAnimationController;

