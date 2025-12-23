/**
 * Storyboard Animations - Comprehensive animation keyframes and utilities
 * 
 * Categories:
 * - Entry/Exit animations
 * - Interaction feedback
 * - State transitions
 * - Path animations
 * - Timeline animations
 */

import { keyframes } from '@mui/material/styles';

// =============================================================================
// Entry/Exit Animations
// =============================================================================

/** Scale in with spring bounce effect */
export const scaleInSpring = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
  }
  70% {
    transform: translate(-50%, -50%) scale(0.9);
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
`;

/** Scale out with fade */
export const scaleOutFade = keyframes`
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }
`;

/** Slide in from right */
export const slideInRight = keyframes`
  0% {
    transform: translateX(100%);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
`;

/** Slide out to left */
export const slideOutLeft = keyframes`
  0% {
    transform: translateX(0);
    opacity: 1;
  }
  100% {
    transform: translateX(-100%);
    opacity: 0;
  }
`;

/** Pop effect for duplicate */
export const popIn = keyframes`
  0% {
    transform: scale(0.8);
    opacity: 0;
  }
  50% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

/** Fade in up */
export const fadeInUp = keyframes`
  0% {
    transform: translateY(20px);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
`;

// =============================================================================
// Interaction Feedback
// =============================================================================

/** Hover lift effect */
export const hoverLift = keyframes`
  0% {
    transform: translate(-50%, -50%) translateY(0);
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  }
  100% {
    transform: translate(-50%, -50%) translateY(-4px);
    filter: drop-shadow(0 8px 16px rgba(0,0,0,0.3));
  }
`;

/** Click ripple */
export const ripple = keyframes`
  0% {
    transform: scale(0);
    opacity: 0.5;
  }
  100% {
    transform: scale(4);
    opacity: 0;
  }
`;

/** Drag tilt right */
export const dragTiltRight = keyframes`
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(5deg);
  }
`;

/** Drag tilt left */
export const dragTiltLeft = keyframes`
  0% {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  100% {
    transform: translate(-50%, -50%) rotate(-5deg);
  }
`;

/** Selection ring rotation */
export const selectionRing = keyframes`
  0% {
    stroke-dashoffset: 0;
  }
  100% {
    stroke-dashoffset: 50;
  }
`;

/** Subtle bounce on hover */
export const subtleBounce = keyframes`
  0%, 100% {
    transform: translate(-50%, -50%) translateY(0);
  }
  50% {
    transform: translate(-50%, -50%) translateY(-3px);
  }
`;

// =============================================================================
// State Transitions
// =============================================================================

/** Approval burst particles */
export const approvalBurst = keyframes`
  0% {
    transform: scale(0);
    opacity: 1;
  }
  50% {
    transform: scale(1.5);
    opacity: 0.8;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
`;

/** Green pulse for approval */
export const approvalPulse = keyframes`
  0% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
  }
  70% {
    box-shadow: 0 0 0 15px rgba(76, 175, 80, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
  }
`;

/** Revision shake */
export const revisionShake = keyframes`
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-4px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(4px);
  }
`;

/** Edit mode glow */
export const editGlow = keyframes`
  0%, 100% {
    box-shadow: 0 0 5px 2px rgba(33, 150, 243, 0.3);
  }
  50% {
    box-shadow: 0 0 15px 5px rgba(33, 150, 243, 0.6);
  }
`;

/** Lock wiggle */
export const lockWiggle = keyframes`
  0%, 100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-10deg);
  }
  75% {
    transform: rotate(10deg);
  }
`;

/** Color morph for status change */
export const colorMorph = keyframes`
  0% {
    filter: hue-rotate(0deg);
  }
  100% {
    filter: hue-rotate(360deg);
  }
`;

// =============================================================================
// Path Animations
// =============================================================================

/** Arrow flow animation (dashes moving) */
export const arrowFlow = keyframes`
  0% {
    stroke-dashoffset: 20;
  }
  100% {
    stroke-dashoffset: 0;
  }
`;

/** Camera dolly path */
export const cameraDolly = keyframes`
  0% {
    offset-distance: 0%;
  }
  100% {
    offset-distance: 100%;
  }
`;

/** Light rays pulsing outward */
export const lightRays = keyframes`
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.3);
    opacity: 0.3;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
`;

/** Focus brackets breathing */
export const focusBreathe = keyframes`
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.05);
  }
`;

/** Continuous glow for lights */
export const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 10px 4px currentColor;
    opacity: 0.8;
  }
  50% {
    box-shadow: 0 0 25px 10px currentColor;
    opacity: 1;
  }
`;

// =============================================================================
// Timeline Animations
// =============================================================================

/** 3D card flip */
export const cardFlip = keyframes`
  0% {
    transform: perspective(1000px) rotateY(0deg);
  }
  100% {
    transform: perspective(1000px) rotateY(180deg);
  }
`;

/** Playhead pulse on beat */
export const playheadPulse = keyframes`
  0%, 100% {
    transform: scaleX(1);
    opacity: 1;
  }
  50% {
    transform: scaleX(1.5);
    opacity: 0.7;
  }
`;

/** Duration stretch */
export const durationStretch = keyframes`
  0% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(1.1);
  }
  100% {
    transform: scaleX(1);
  }
`;

/** Stagger fade in for list items */
export const staggerFadeIn = keyframes`
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
`;

// =============================================================================
// Micro-interactions
// =============================================================================

/** Button press */
export const buttonPress = keyframes`
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.95);
  }
  100% {
    transform: scale(1);
  }
`;

/** Toggle switch */
export const toggleSwitch = keyframes`
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(100%);
  }
`;

/** Slider thumb bounce */
export const sliderBounce = keyframes`
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
`;

/** Tooltip appear */
export const tooltipAppear = keyframes`
  0% {
    opacity: 0;
    transform: translateY(5px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
`;

/** Checkmark draw */
export const checkmarkDraw = keyframes`
  0% {
    stroke-dashoffset: 100;
  }
  100% {
    stroke-dashoffset: 0;
  }
`;

/** Spinner rotate */
export const spinnerRotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

// =============================================================================
// Animation Utilities
// =============================================================================

export const animationDurations = {
  instant: '0.1s',
  fast: '0.2s',
  normal: '0.3s',
  slow: '0.5s',
  verySlow: '0.8s',
};

export const animationEasings = {
  easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  bounce: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
};

/** Get stagger delay for list items */
export const getStaggerDelay = (index: number, baseDelay = 0.05): string => {
  return `${index * baseDelay}s`;
};

/** Combine animation properties */
export const createAnimation = (
  name: ReturnType<typeof keyframes>,
  duration: string = animationDurations.normal,
  easing: string = animationEasings.easeOut,
  iterations: number | string = 1,
  fillMode: string ='forwards'
): string => {
  return `${name} ${duration} ${easing} ${iterations} ${fillMode}`;
};

