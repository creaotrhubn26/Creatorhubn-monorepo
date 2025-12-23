/**
 * Animation Systems Index
 * 
 * Central export for all Virtual Studio animation systems.
 */

// Eye Animations
export {
  EyeAnimationController,
  EYE_ANIMATION_PRESETS,
  createEyeAnimationHook,
  type EyeAnimationState,
  type EyeAnimationConfig,
  type SaccadeParams,
} from './EyeAnimations';

// Actor Animations
export {
  ActorAnimationController,
  ACTOR_ANIMATION_PRESETS,
  POSE_PRESETS,
  type ActorAnimationState,
  type ActorAnimationConfig,
  type PoseDefinition,
} from './ActorAnimations';

// Body Animations (Head, Hands, Arms)
export {
  BodyAnimationController,
  BODY_ANIMATION_PRESETS,
  HEAD_PRESETS,
  HAND_PRESETS,
  GESTURE_DEFINITIONS,
  FULL_BODY_POSES,
  type BodyAnimationState,
  type BodyAnimationConfig,
  type HeadAnimationState,
  type HandAnimationState,
  type ArmAnimationState,
  type HandGesture,
} from './BodyAnimations';

// Catchlight Animations
export {
  CatchlightAnimationController,
  LightPowerAnimator,
  CATCHLIGHT_ANIMATION_PRESETS,
  type CatchlightAnimationState,
  type CatchlightAnimationConfig,
  type LightPowerAnimation,
} from './CatchlightAnimations';

// Guide Animations
export {
  GuideAnimationController,
  GUIDE_ANIMATION_PRESETS,
  STAGGER_PRESETS,
  type GuideAnimationState,
  type GuideAnimationConfig,
  type StaggerConfig,
  type AnimationType,
} from'./GuideAnimations';

