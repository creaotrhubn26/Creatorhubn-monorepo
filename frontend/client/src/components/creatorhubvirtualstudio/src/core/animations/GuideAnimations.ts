/**
 * Guide Animation System
 * 
 * Provides entrance/exit animations for studio guides including:
 * - Fade in/out
 * - Slide animations
 * - Scale animations
 * - Stagger effects for multiple guides
 * - Pulse/highlight effects
 */

import * as THREE from 'three';

// =============================================================================
// Types
// =============================================================================

export type AnimationType = 
  | 'fade'
  | 'slideUp'
  | 'slideDown'
  | 'slideLeft'
  | 'slideRight'
  | 'scale'
  | 'scaleSpring'
  | 'reveal';

export interface GuideAnimationState {
  opacity: number;
  scale: THREE.Vector3;
  position: THREE.Vector3;
  isAnimating: boolean;
  isVisible: boolean;
}

export interface GuideAnimationConfig {
  type: AnimationType;
  duration: number;        // Duration in ms
  delay: number;           // Delay before start in ms
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'spring' | 'bounce';
  slideDistance: number;   // Distance for slide animations
  initialScale: number;    // Starting scale for scale animations
}

export interface StaggerConfig {
  delayBetween: number;    // Delay between each item (ms)
  startDelay: number;      // Initial delay before first item
  direction: 'forward' | 'reverse' | 'center';
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: GuideAnimationConfig = {
  type: 'fade',
  duration: 300,
  delay: 0,
  easing: 'easeOut',
  slideDistance: 0.5,
  initialScale: 0.8,
};

const DEFAULT_STAGGER: StaggerConfig = {
  delayBetween: 50,
  startDelay: 0,
  direction: 'forward',
};

// =============================================================================
// Easing Functions
// =============================================================================

const EASINGS: Record<GuideAnimationConfig['easing'], (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  spring: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : 
      Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  bounce: (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

// =============================================================================
// Guide Animation Controller
// =============================================================================

export class GuideAnimationController {
  private states: Map<string, GuideAnimationState> = new Map();
  private animations: Map<string, {
    config: GuideAnimationConfig;
    startTime: number;
    entering: boolean;
    startState: GuideAnimationState;
  }> = new Map();

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Show a guide with animation
   */
  show(
    id: string,
    config: Partial<GuideAnimationConfig> = {}
  ): void {
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    const currentState = this.states.get(id) || this.createDefaultState();
    
    this.animations.set(id, {
      config: finalConfig,
      startTime: Date.now() + finalConfig.delay,
      entering: true,
      startState: { ...currentState },
    });
    
    // Ensure state exists
    if (!this.states.has(id)) {
      const state = this.createDefaultState();
      state.isVisible = true;
      this.setInitialState(state, finalConfig);
      this.states.set(id, state);
    }
  }

  /**
   * Hide a guide with animation
   */
  hide(
    id: string,
    config: Partial<GuideAnimationConfig> = {}
  ): void {
    const state = this.states.get(id);
    if (!state || !state.isVisible) return;
    
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    this.animations.set(id, {
      config: finalConfig,
      startTime: Date.now() + finalConfig.delay,
      entering: false,
      startState: { ...state },
    });
  }

  /**
   * Show multiple guides with stagger effect
   */
  showStaggered(
    ids: string[],
    config: Partial<GuideAnimationConfig> = {},
    stagger: Partial<StaggerConfig> = {}
  ): void {
    const staggerConfig = { ...DEFAULT_STAGGER, ...stagger };
    const orderedIds = staggerConfig.direction === 'reverse' 
      ? [...ids].reverse()
      : staggerConfig.direction === 'center'
        ? this.centerOrder(ids)
        : ids;
    
    orderedIds.forEach((id, index) => {
      const delay = staggerConfig.startDelay + index * staggerConfig.delayBetween;
      this.show(id, { ...config, delay });
    });
  }

  /**
   * Hide multiple guides with stagger effect
   */
  hideStaggered(
    ids: string[],
    config: Partial<GuideAnimationConfig> = {},
    stagger: Partial<StaggerConfig> = {}
  ): void {
    const staggerConfig = { ...DEFAULT_STAGGER, ...stagger };
    const orderedIds = staggerConfig.direction === 'reverse' 
      ? [...ids].reverse()
      : ids;
    
    orderedIds.forEach((id, index) => {
      const delay = staggerConfig.startDelay + index * staggerConfig.delayBetween;
      this.hide(id, { ...config, delay });
    });
  }

  /**
   * Update animations - call every frame
   */
  update(): Map<string, GuideAnimationState> {
    const now = Date.now();
    const completed: string[] = [];
    
    for (const [id, anim] of this.animations) {
      const state = this.states.get(id);
      if (!state) continue;
      
      // Check if animation has started
      if (now < anim.startTime) {
        state.isAnimating = true;
        continue;
      }
      
      const elapsed = now - anim.startTime;
      const progress = Math.min(1, elapsed / anim.config.duration);
      const eased = EASINGS[anim.config.easing](progress);
      
      this.applyAnimation(state, anim.startState, anim.config, eased, anim.entering);
      
      state.isAnimating = progress < 1;
      
      if (progress >= 1) {
        completed.push(id);
        if (!anim.entering) {
          state.isVisible = false;
        }
      }
    }
    
    // Remove completed animations
    for (const id of completed) {
      this.animations.delete(id);
    }
    
    return new Map(this.states);
  }

  /**
   * Get state for a guide
   */
  getState(id: string): GuideAnimationState | undefined {
    return this.states.get(id);
  }

  /**
   * Check if any animation is running
   */
  isAnimating(): boolean {
    return this.animations.size > 0;
  }

  /**
   * Pulse/highlight effect
   */
  pulse(id: string, intensity: number = 0.2, duration: number = 500): void {
    const state = this.states.get(id);
    if (!state) return;
    
    const originalScale = state.scale.clone();
    const pulseScale = 1 + intensity;
    
    // Scale up
    this.animations.set(`${id}_pulse_up`, {
      config: {
        ...DEFAULT_CONFIG,
        type: 'scale',
        duration: duration / 2,
        easing: 'easeOut',
        initialScale: pulseScale,
      },
      startTime: Date.now(),
      entering: true,
      startState: { ...state },
    });
    
    // Scale back down
    setTimeout(() => {
      const currentState = this.states.get(id);
      if (currentState) {
        this.animations.set(`${id}_pulse_down`, {
          config: {
            ...DEFAULT_CONFIG,
            type: 'scale',
            duration: duration / 2,
            easing: 'easeIn',
            initialScale: 1,
          },
          startTime: Date.now(),
          entering: true,
          startState: { ...currentState, scale: new THREE.Vector3(pulseScale, pulseScale, pulseScale) },
        });
      }
    }, duration / 2);
  }

  // ---------------------------------------------------------------------------
  // Private Methods
  // ---------------------------------------------------------------------------

  private createDefaultState(): GuideAnimationState {
    return {
      opacity: 0,
      scale: new THREE.Vector3(1, 1, 1),
      position: new THREE.Vector3(0, 0, 0),
      isAnimating: false,
      isVisible: false,
    };
  }

  private setInitialState(state: GuideAnimationState, config: GuideAnimationConfig): void {
    switch (config.type) {
      case 'fade':
        state.opacity = 0;
        break;
      case 'slideUp':
        state.opacity = 0;
        state.position.y = -config.slideDistance;
        break;
      case 'slideDown':
        state.opacity = 0;
        state.position.y = config.slideDistance;
        break;
      case 'slideLeft':
        state.opacity = 0;
        state.position.x = -config.slideDistance;
        break;
      case 'slideRight':
        state.opacity = 0;
        state.position.x = config.slideDistance;
        break;
      case 'scale':
      case 'scaleSpring':
        state.opacity = 0;
        state.scale.setScalar(config.initialScale);
        break;
      case 'reveal':
        state.opacity = 0;
        state.scale.y = 0;
        break;
    }
  }

  private applyAnimation(
    state: GuideAnimationState,
    startState: GuideAnimationState,
    config: GuideAnimationConfig,
    progress: number,
    entering: boolean
  ): void {
    const t = entering ? progress : 1 - progress;
    
    switch (config.type) {
      case 'fade':
        state.opacity = t;
        break;
        
      case 'slideUp':
      case 'slideDown':
        state.opacity = t;
        state.position.y = entering
          ? THREE.MathUtils.lerp(startState.position.y, 0, progress)
          : THREE.MathUtils.lerp(0, config.type === 'slideUp' ? config.slideDistance : -config.slideDistance, progress);
        break;
        
      case 'slideLeft':
      case 'slideRight':
        state.opacity = t;
        state.position.x = entering
          ? THREE.MathUtils.lerp(startState.position.x, 0, progress)
          : THREE.MathUtils.lerp(0, config.type === 'slideLeft' ? config.slideDistance : -config.slideDistance, progress);
        break;
        
      case 'scale':
      case 'scaleSpring':
        state.opacity = t;
        const scaleValue = entering
          ? THREE.MathUtils.lerp(config.initialScale, 1, progress)
          : THREE.MathUtils.lerp(1, config.initialScale, progress);
        state.scale.setScalar(scaleValue);
        break;
        
      case 'reveal':
        state.opacity = t;
        state.scale.y = t;
        break;
    }
  }

  private centerOrder(ids: string[]): string[] {
    const result: string[] = [];
    const mid = Math.floor(ids.length / 2);
    
    for (let i = 0; i <= mid; i++) {
      if (mid + i < ids.length) result.push(ids[mid + i]);
      if (i > 0 && mid - i >= 0) result.push(ids[mid - i]);
    }
    
    return result;
  }
}

// =============================================================================
// Animation Presets
// =============================================================================

export const GUIDE_ANIMATION_PRESETS = {
  fadeIn: {
    type: 'fade' as AnimationType,
    duration: 200,
    delay: 0,
    easing: 'easeOut' as const,
    slideDistance: 0,
    initialScale: 1,
  },
  
  fadeOut: {
    type: 'fade' as AnimationType,
    duration: 150,
    delay: 0,
    easing: 'easeIn' as const,
    slideDistance: 0,
    initialScale: 1,
  },
  
  slideUp: {
    type: 'slideUp' as AnimationType,
    duration: 300,
    delay: 0,
    easing: 'easeOut' as const,
    slideDistance: 0.3,
    initialScale: 1,
  },
  
  slideDown: {
    type: 'slideDown' as AnimationType,
    duration: 300,
    delay: 0,
    easing: 'easeOut' as const,
    slideDistance: 0.3,
    initialScale: 1,
  },
  
  scaleIn: {
    type: 'scale' as AnimationType,
    duration: 250,
    delay: 0,
    easing: 'easeOut' as const,
    slideDistance: 0,
    initialScale: 0.8,
  },
  
  springIn: {
    type: 'scaleSpring' as AnimationType,
    duration: 400,
    delay: 0,
    easing: 'spring' as const,
    slideDistance: 0,
    initialScale: 0.5,
  },
  
  bounceIn: {
    type: 'scale' as AnimationType,
    duration: 500,
    delay: 0,
    easing: 'bounce' as const,
    slideDistance: 0,
    initialScale: 0,
  },
  
  reveal: {
    type: 'reveal' as AnimationType,
    duration: 300,
    delay: 0,
    easing: 'easeInOut' as const,
    slideDistance: 0,
    initialScale: 1,
  },
};

export const STAGGER_PRESETS = {
  fast: {
    delayBetween: 30,
    startDelay: 0,
    direction: 'forward' as const,
  },
  
  normal: {
    delayBetween: 50,
    startDelay: 0,
    direction: 'forward' as const,
  },
  
  slow: {
    delayBetween: 100,
    startDelay: 0,
    direction: 'forward' as const,
  },
  
  reverse: {
    delayBetween: 50,
    startDelay: 0,
    direction: 'reverse' as const,
  },
  
  center: {
    delayBetween: 40,
    startDelay: 0,
    direction: 'center' as const,
  },
};

export default GuideAnimationController;

