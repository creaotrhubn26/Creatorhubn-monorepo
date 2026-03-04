/**
 * Animation Hooks
 * 
 * React hooks for using animation systems in Virtual Studio components.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import type {
  EyeAnimationConfig,
  EyeAnimationState} from '../core/animations/EyeAnimations';
import {
  EyeAnimationController,
  EYE_ANIMATION_PRESETS,
} from '../core/animations/EyeAnimations';
import type {
  ActorAnimationConfig,
  ActorAnimationState} from '../core/animations/ActorAnimations';
import {
  ActorAnimationController,
  ACTOR_ANIMATION_PRESETS,
} from '../core/animations/ActorAnimations';
import type {
  CatchlightAnimationConfig,
  CatchlightAnimationState} from '../core/animations/CatchlightAnimations';
import {
  CatchlightAnimationController,
  CATCHLIGHT_ANIMATION_PRESETS,
} from '../core/animations/CatchlightAnimations';
import type {
  GuideAnimationConfig,
  GuideAnimationState} from '../core/animations/GuideAnimations';
import {
  GuideAnimationController,
  GUIDE_ANIMATION_PRESETS,
} from '../core/animations/GuideAnimations';
import type {
  BodyAnimationConfig,
  BodyAnimationState,
  HEAD_PRESETS,
  HAND_PRESETS,
  HandGesture} from '../core/animations/BodyAnimations';
import {
  BodyAnimationController,
  BODY_ANIMATION_PRESETS,
  FULL_BODY_POSES
} from '../core/animations/BodyAnimations';

// =============================================================================
// Eye Animation Hook
// =============================================================================

export interface UseEyeAnimationOptions {
  preset?: keyof typeof EYE_ANIMATION_PRESETS;
  config?: Partial<EyeAnimationConfig>;
  autoStart?: boolean;
}

export function useEyeAnimation(options: UseEyeAnimationOptions = {}) {
  const { preset = 'relaxed', config, autoStart = true } = options;
  
  const controllerRef = useRef<EyeAnimationController | null>(null);
  const [state, setState] = useState<EyeAnimationState | null>(null);
  
  // Initialize controller
  useEffect(() => {
    const presetConfig = EYE_ANIMATION_PRESETS[preset];
    controllerRef.current = new EyeAnimationController({
      ...presetConfig,
      ...config,
    });
    
    return () => {
      controllerRef.current = null;
    };
  }, [preset, config]);
  
  // Update animation state each frame
  useFrame((_, delta) => {
    if (!controllerRef.current) return;
    
    const newState = controllerRef.current.update(delta, performance.now() / 1000);
    setState(newState);
  });
  
  // API methods
  const saccadeTo = useCallback((target: THREE.Vector3, onComplete?: () => void) => {
    controllerRef.current?.saccadeTo(target, onComplete);
  }, []);
  
  const smoothPursuit = useCallback((target: THREE.Vector3, deltaTime: number) => {
    controllerRef.current?.smoothPursuit(target, deltaTime);
  }, []);
  
  const blink = useCallback((onComplete?: () => void) => {
    controllerRef.current?.blink(onComplete);
  }, []);
  
  const setLightIntensity = useCallback((intensity: number) => {
    controllerRef.current?.setLightIntensity(intensity);
  }, []);
  
  const setPreset = useCallback((presetName: keyof typeof EYE_ANIMATION_PRESETS) => {
    controllerRef.current?.setConfig(EYE_ANIMATION_PRESETS[presetName]);
  }, []);
  
  return {
    state,
    saccadeTo,
    smoothPursuit,
    blink,
    setLightIntensity,
    setPreset,
    getGazeWithMicroMovements: () => controllerRef.current?.getGazeWithMicroMovements(),
  };
}

// =============================================================================
// Actor Animation Hook
// =============================================================================

export interface UseActorAnimationOptions {
  preset?: keyof typeof ACTOR_ANIMATION_PRESETS;
  config?: Partial<ActorAnimationConfig>;
  initialPose?: string;
}

export function useActorAnimation(options: UseActorAnimationOptions = {}) {
  const { preset = 'portrait', config, initialPose = 'standing_neutral' } = options;
  
  const controllerRef = useRef<ActorAnimationController | null>(null);
  const [state, setState] = useState<ActorAnimationState | null>(null);
  
  // Initialize controller
  useEffect(() => {
    const presetConfig = ACTOR_ANIMATION_PRESETS[preset];
    controllerRef.current = new ActorAnimationController({
      ...presetConfig,
      ...config,
    });
    
    // Set initial pose
    if (initialPose) {
      controllerRef.current.transitionToPose(initialPose);
    }
    
    return () => {
      controllerRef.current = null;
    };
  }, [preset, config, initialPose]);
  
  // Update animation state each frame
  useFrame((_, delta) => {
    if (!controllerRef.current) return;
    
    const newState = controllerRef.current.update(delta, performance.now() / 1000);
    setState(newState);
  });
  
  // API methods
  const transitionToPose = useCallback((poseName: string) => {
    controllerRef.current?.transitionToPose(poseName);
  }, []);
  
  const lookAt = useCallback((target: THREE.Vector3, subjectPosition: THREE.Vector3) => {
    controllerRef.current?.lookAt(target, subjectPosition);
  }, []);
  
  const setBreathRate = useCallback((bpm: number) => {
    controllerRef.current?.setBreathRate(bpm);
  }, []);
  
  const setPreset = useCallback((presetName: keyof typeof ACTOR_ANIMATION_PRESETS) => {
    if (controllerRef.current) {
      controllerRef.current = new ActorAnimationController(ACTOR_ANIMATION_PRESETS[presetName]);
    }
  }, []);
  
  return {
    state,
    transitionToPose,
    lookAt,
    setBreathRate,
    setPreset,
    getBreathOffset: () => controllerRef.current?.getBreathOffset(),
    getBlendedPose: () => controllerRef.current?.getBlendedPose(),
  };
}

// =============================================================================
// Catchlight Animation Hook
// =============================================================================

export interface UseCatchlightAnimationOptions {
  preset?: keyof typeof CATCHLIGHT_ANIMATION_PRESETS;
  config?: Partial<CatchlightAnimationConfig>;
}

export function useCatchlightAnimation(options: UseCatchlightAnimationOptions = {}) {
  const { preset = 'smooth', config } = options;
  
  const controllerRef = useRef<CatchlightAnimationController | null>(null);
  const [states, setStates] = useState<Map<string, CatchlightAnimationState>>(new Map());
  
  // Initialize controller
  useEffect(() => {
    const presetConfig = CATCHLIGHT_ANIMATION_PRESETS[preset];
    controllerRef.current = new CatchlightAnimationController({
      ...presetConfig,
      ...config,
    });
    
    return () => {
      controllerRef.current = null;
    };
  }, [preset, config]);
  
  // Update animation state each frame
  useFrame((_, delta) => {
    if (!controllerRef.current) return;
    
    const newStates = controllerRef.current.update(delta, performance.now() / 1000);
    setStates(new Map(newStates));
  });
  
  // API methods
  const setCatchlight = useCallback((
    id: string,
    target: {
      intensity: number;
      position: THREE.Vector2;
      size: number;
      shape: string;
      color: THREE.Color;
    }
  ) => {
    controllerRef.current?.setCatchlight(id, target);
  }, []);
  
  const removeCatchlight = useCallback((id: string) => {
    controllerRef.current?.removeCatchlight(id);
  }, []);
  
  const setFlicker = useCallback((enabled: boolean, intensity?: number) => {
    controllerRef.current?.setFlicker(enabled, intensity);
  }, []);
  
  const flash = useCallback((id: string, peakIntensity?: number, duration?: number) => {
    controllerRef.current?.flash(id, peakIntensity, duration);
  }, []);
  
  return {
    states,
    setCatchlight,
    removeCatchlight,
    setFlicker,
    flash,
    getState: (id: string) => controllerRef.current?.getState(id),
  };
}

// =============================================================================
// Guide Animation Hook
// =============================================================================

export interface UseGuideAnimationOptions {
  defaultConfig?: Partial<GuideAnimationConfig>;
}

export function useGuideAnimation(options: UseGuideAnimationOptions = {}) {
  const { defaultConfig } = options;
  
  const controllerRef = useRef<GuideAnimationController | null>(null);
  const [states, setStates] = useState<Map<string, GuideAnimationState>>(new Map());
  
  // Initialize controller
  useEffect(() => {
    controllerRef.current = new GuideAnimationController();
    
    return () => {
      controllerRef.current = null;
    };
  }, []);
  
  // Update animation state each frame (using requestAnimationFrame for non-R3F components)
  useEffect(() => {
    let animationFrameId: number;
    
    const update = () => {
      if (!controllerRef.current) return;
      
      const newStates = controllerRef.current.update();
      setStates(new Map(newStates));
      
      animationFrameId = requestAnimationFrame(update);
    };
    
    animationFrameId = requestAnimationFrame(update);
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);
  
  // API methods
  const show = useCallback((id: string, config?: Partial<GuideAnimationConfig>) => {
    controllerRef.current?.show(id, { ...defaultConfig, ...config });
  }, [defaultConfig]);
  
  const hide = useCallback((id: string, config?: Partial<GuideAnimationConfig>) => {
    controllerRef.current?.hide(id, { ...defaultConfig, ...config });
  }, [defaultConfig]);
  
  const showStaggered = useCallback((
    ids: string[],
    config?: Partial<GuideAnimationConfig>,
    stagger?: { delayBetween?: number; startDelay?: number; direction?: 'forward' | 'reverse' | 'center' }
  ) => {
    controllerRef.current?.showStaggered(ids, { ...defaultConfig, ...config }, stagger);
  }, [defaultConfig]);
  
  const hideStaggered = useCallback((
    ids: string[],
    config?: Partial<GuideAnimationConfig>,
    stagger?: { delayBetween?: number; startDelay?: number; direction?: 'forward' | 'reverse' | 'center' }
  ) => {
    controllerRef.current?.hideStaggered(ids, { ...defaultConfig, ...config }, stagger);
  }, [defaultConfig]);
  
  const pulse = useCallback((id: string, intensity?: number, duration?: number) => {
    controllerRef.current?.pulse(id, intensity, duration);
  }, []);
  
  return {
    states,
    show,
    hide,
    showStaggered,
    hideStaggered,
    pulse,
    isAnimating: () => controllerRef.current?.isAnimating() ?? false,
    getState: (id: string) => controllerRef.current?.getState(id),
  };
}

// =============================================================================
// Body Animation Hook (Head, Hands, Arms)
// =============================================================================

export interface UseBodyAnimationOptions {
  preset?: keyof typeof BODY_ANIMATION_PRESETS;
  config?: Partial<BodyAnimationConfig>;
  initialPose?: keyof typeof FULL_BODY_POSES;
}

export function useBodyAnimation(options: UseBodyAnimationOptions = {}) {
  const { preset = 'portrait', config, initialPose } = options;
  
  const controllerRef = useRef<BodyAnimationController | null>(null);
  const [state, setState] = useState<BodyAnimationState | null>(null);
  
  // Initialize controller
  useEffect(() => {
    const presetConfig = BODY_ANIMATION_PRESETS[preset];
    controllerRef.current = new BodyAnimationController({
      ...presetConfig,
      ...config,
    });
    
    // Set initial pose if provided
    if (initialPose && FULL_BODY_POSES[initialPose]) {
      const pose = FULL_BODY_POSES[initialPose];
      controllerRef.current.setHeadPreset(pose.head as keyof typeof HEAD_PRESETS);
      controllerRef.current.setHandPreset(pose.hands as keyof typeof HAND_PRESETS);
      controllerRef.current.setGesture('both', pose.gesture);
    }
    
    return () => {
      controllerRef.current = null;
    };
  }, [preset, config, initialPose]);
  
  // Update animation state each frame
  useFrame((_, delta) => {
    if (!controllerRef.current) return;
    
    const newState = controllerRef.current.update(delta, performance.now() / 1000);
    setState(newState);
  });
  
  // Head API
  const lookAt = useCallback((target: THREE.Vector3, headPosition: THREE.Vector3) => {
    controllerRef.current?.lookAt(target, headPosition);
  }, []);
  
  const setHeadPreset = useCallback((presetName: keyof typeof HEAD_PRESETS) => {
    controllerRef.current?.setHeadPreset(presetName);
  }, []);
  
  const tiltHead = useCallback((amount: number) => {
    controllerRef.current?.tiltHead(amount);
  }, []);
  
  const nod = useCallback((progress: number) => {
    controllerRef.current?.nod(progress);
  }, []);
  
  const shake = useCallback((progress: number) => {
    controllerRef.current?.shake(progress);
  }, []);
  
  // Hand API
  const moveHand = useCallback((
    hand: 'left' | 'right',
    position: THREE.Vector3,
    rotation?: THREE.Euler
  ) => {
    controllerRef.current?.moveHand(hand, position, rotation);
  }, []);
  
  const setHandPreset = useCallback((presetName: keyof typeof HAND_PRESETS) => {
    controllerRef.current?.setHandPreset(presetName);
  }, []);
  
  const setGesture = useCallback((
    hand: 'left' | 'right' | 'both',
    gesture: HandGesture
  ) => {
    controllerRef.current?.setGesture(hand, gesture);
  }, []);
  
  const wave = useCallback((hand: 'left' | 'right', progress: number) => {
    controllerRef.current?.wave(hand, progress);
  }, []);
  
  // Arm API
  const setArmPose = useCallback((
    arm: 'left' |'right',
    shoulderRotation: THREE.Euler,
    elbowAngle: number,
    wristRotation?: THREE.Euler
  ) => {
    controllerRef.current?.setArmPose(arm, shoulderRotation, elbowAngle, wristRotation);
  }, []);
  
  const crossArms = useCallback(() => {
    controllerRef.current?.crossArms();
  }, []);
  
  const handsOnHips = useCallback(() => {
    controllerRef.current?.handsOnHips();
  }, []);
  
  const relaxedPose = useCallback(() => {
    controllerRef.current?.relaxedPose();
  }, []);
  
  // Full body pose
  const setFullBodyPose = useCallback((poseName: keyof typeof FULL_BODY_POSES) => {
    if (!controllerRef.current) return;
    const pose = FULL_BODY_POSES[poseName];
    controllerRef.current.setHeadPreset(pose.head as keyof typeof HEAD_PRESETS);
    controllerRef.current.setHandPreset(pose.hands as keyof typeof HAND_PRESETS);
    controllerRef.current.setGesture('both', pose.gesture);
  }, []);
  
  return {
    state,
    // Head
    lookAt,
    setHeadPreset,
    tiltHead,
    nod,
    shake,
    // Hands
    moveHand,
    setHandPreset,
    setGesture,
    wave,
    // Arms
    setArmPose,
    crossArms,
    handsOnHips,
    relaxedPose,
    // Full body
    setFullBodyPose,
  };
}

// =============================================================================
// Combined Animation Hook (for convenience)
// =============================================================================

export function useVirtualStudioAnimations(options: {
  eyePreset?: keyof typeof EYE_ANIMATION_PRESETS;
  actorPreset?: keyof typeof ACTOR_ANIMATION_PRESETS;
  bodyPreset?: keyof typeof BODY_ANIMATION_PRESETS;
  catchlightPreset?: keyof typeof CATCHLIGHT_ANIMATION_PRESETS;
} = {}) {
  const eye = useEyeAnimation({ preset: options.eyePreset });
  const actor = useActorAnimation({ preset: options.actorPreset });
  const body = useBodyAnimation({ preset: options.bodyPreset });
  const catchlight = useCatchlightAnimation({ preset: options.catchlightPreset });
  const guide = useGuideAnimation();
  
  return {
    eye,
    actor,
    body,
    catchlight,
    guide,
  };
}

