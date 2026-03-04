/**
 * Character Animations
 * 
 * Defines preview animations for library cards and entrance animations
 * when characters are added to the scene.
 */

import type * as THREE from 'three';

// ============================================================================
// PREVIEW CARD ANIMATIONS (CSS-based for performance)
// ============================================================================

export interface PreviewAnimation {
  name: string;
  keyframes: string;
  duration: string;
  timing: string;
  delay?: string;
}

/**
 * Genre-specific idle animations for preview cards
 */
export const PREVIEW_ANIMATIONS: Record<string, PreviewAnimation> = {
  // Mysterious/Horror - subtle sway, occasional head tilt
  'cosmic-horror': {
    name: 'cosmicIdle',
    keyframes: `
      @keyframes cosmicIdle {
        0%, 100% { transform: translateY(0) rotate(0deg);, filter: brightness(1); }
        25% { transform: translateY(-2px) rotate(-1deg);, filter: brightness(0.95); }
        50% { transform: translateY(-1px) rotate(0.5deg);, filter: brightness(1.05); }
        75% { transform: translateY(-3px) rotate(-0.5deg);, filter: brightness(0.98); }
      }
    `,
    duration: '4s',
    timing: 'ease-in-out',
  },
  'horror': {
    name: 'horrorIdle',
    keyframes: `
      @keyframes horrorIdle {
        0%, 100% { transform: scale(1) translateY(0); }
        30% { transform: scale(1.01) translateY(-1px); }
        60% { transform: scale(0.99) translateY(1px); }
        90% { transform: scale(1.005) translateY(-2px); }
      }
    `,
    duration: '3s',
    timing: 'ease-in-out',
  },
  // Action - confident stance shifts
  'action': {
    name: 'actionIdle',
    keyframes: `
      @keyframes actionIdle {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        25% { transform: translateX(2px) rotate(0.5deg); }
        50% { transform: translateX(-1px) rotate(-0.3deg); }
        75% { transform: translateX(1px) rotate(0.2deg); }
      }
    `,
    duration: '2.5s',
    timing: 'ease-in-out',
  },
  // Sci-fi - tech flicker effect
  'sci-fi': {
    name: 'scifiIdle',
    keyframes: `
      @keyframes scifiIdle {
        0%, 100% { transform: translateY(0);, filter: hue-rotate(0deg) brightness(1); }
        25% { transform: translateY(-1px);, filter: hue-rotate(5deg) brightness(1.1); }
        50% { transform: translateY(0);, filter: hue-rotate(-3deg) brightness(0.95); }
        75% { transform: translateY(-2px);, filter: hue-rotate(2deg) brightness(1.05); }
      }
    `,
    duration: '3.5s',
    timing: 'linear',
  },
  // Fantasy - magical shimmer
  'fantasy': {
    name: 'fantasyIdle',
    keyframes: `
      @keyframes fantasyIdle {
        0%, 100% { transform: translateY(0) scale(1);, filter: drop-shadow(0 0 0px transparent); }
        50% { transform: translateY(-3px) scale(1.02);, filter: drop-shadow(0 0 8px rgba(147, 112, 219, 0.5)); }
      }
    `,
    duration: '4s',
    timing: 'ease-in-out',
  },
  // Western - steady stance with subtle weight shift
  'western': {
    name: 'westernIdle',
    keyframes: `
      @keyframes westernIdle {
        0%, 100% { transform: translateX(0) rotate(0deg); }
        50% { transform: translateX(1px) rotate(0.3deg); }
      }
    `,
    duration: '3s',
    timing: 'ease-in-out',
  },
  // Film Noir - dramatic shadow play
  'film-noir': {
    name: 'noirIdle',
    keyframes: `
      @keyframes noirIdle {
        0%, 100% { filter: contrast(1) brightness(1);, transform: translateY(0); }
        50% { filter: contrast(1.1) brightness(0.9);, transform: translateY(-1px); }
      }
    `,
    duration: '4s',
    timing: 'ease-in-out',
  },
  // Period Drama - elegant, subtle breathing
  'period-drama': {
    name: 'periodIdle',
    keyframes: `
      @keyframes periodIdle {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-1px) scale(1.005); }
      }
    `,
    duration: '4s',
    timing: 'ease-in-out',
  },
  // Asian Cinema - martial arts ready stance
  'asian-cinema': {
    name: 'asianIdle',
    keyframes: `
      @keyframes asianIdle {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        25% { transform: translateY(-2px) rotate(-0.5deg); }
        75% { transform: translateY(-1px) rotate(0.5deg); }
      }
    `,
    duration: '2.5s',
    timing: 'ease-in-out',
  },
  // Superhero - powerful hover
  'superhero': {
    name: 'superheroIdle',
    keyframes: `
      @keyframes superheroIdle {
        0%, 100% { transform: translateY(0) scale(1);, filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
        50% { transform: translateY(-4px) scale(1.02);, filter: drop-shadow(0 8px 12px rgba(0,0,0,0.4)); }
      }
    `,
    duration: '3s',
    timing: 'ease-in-out',
  },
  // Profession - working hands movement
  'profession': {
    name: 'professionIdle',
    keyframes: `
      @keyframes professionIdle {
        0%, 100% { transform: translateY(0) rotate(0deg); }
        25% { transform: translateY(-1px) rotate(0.3deg); }
        50% { transform: translateY(0) rotate(-0.2deg); }
        75% { transform: translateY(-2px) rotate(0.1deg); }
      }
    `,
    duration: '3s',
    timing: 'ease-in-out',
  },
  // Default for non-film characters
  'default': {
    name: 'defaultIdle',
    keyframes: `
      @keyframes defaultIdle {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
      }
    `,
    duration: '3s',
    timing: 'ease-in-out',
  },
};

/**
 * Get preview animation for a genre
 */
export function getPreviewAnimation(genre?: string): PreviewAnimation {
  return PREVIEW_ANIMATIONS[genre || 'default'] || PREVIEW_ANIMATIONS.default;
}

// ============================================================================
// ENTRANCE ANIMATIONS (Three.js based)
// ============================================================================

export interface EntranceAnimation {
  name: string;
  duration: number; // seconds
  setup: (mesh: THREE.Object3D) => void;
  animate: (mesh: THREE.Object3D, progress: number) => void;
  sound?: string; // Optional sound effect
}

/**
 * Easing functions for animations
 */
const easing = {
  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
  easeOutBounce: (t: number) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

/**
 * Genre-specific entrance animations
 */
export const ENTRANCE_ANIMATIONS: Record<string, EntranceAnimation> = {
  // Cosmic Horror - fade in with distortion
  'cosmic-horror': {
    name: 'Eldritch Manifestation',
    duration: 2.0,
    setup: (mesh) => {
      mesh.scale.set(0.1, 0.1, 0.1);
      mesh.rotation.y = Math.PI * 2;
      (mesh as any).material && ((mesh as any).material.opacity = 0);
    },
    animate: (mesh, progress) => {
      const easedProgress = easing.easeOutQuart(progress);
      const distortion = Math.sin(progress * Math.PI * 4) * (1 - progress) * 0.2;
      mesh.scale.set(
        easedProgress + distortion,
        easedProgress - distortion * 0.5,
        easedProgress + distortion * 0.3
      );
      mesh.rotation.y = Math.PI * 2 * (1 - easedProgress);
      if ((mesh as any).material) {
        (mesh as any).material.opacity = easedProgress;
      }
    },
  },
  // Horror - rise from ground with head tilt
  'horror': {
    name: 'Risen',
    duration: 1.8,
    setup: (mesh) => {
      mesh.position.y = -2;
      mesh.rotation.x = 0.3;
      (mesh as any).material && ((mesh as any).material.opacity = 0);
    },
    animate: (mesh, progress) => {
      const easedProgress = easing.easeOutQuart(progress);
      mesh.position.y = -2 + 2 * easedProgress;
      mesh.rotation.x = 0.3 * (1 - easedProgress);
      if ((mesh as any).material) {
        (mesh as any).material.opacity = Math.min(1, progress * 2);
      }
    },
  },
  // Action - dramatic landing/drop
  'action': {
    name: 'Hero Landing',
    duration: 1.2,
    setup: (mesh) => {
      mesh.position.y = 5;
      mesh.scale.set(0.8, 0.8, 0.8);
    },
    animate: (mesh, progress) => {
      if (progress < 0.6) {
        // Fast drop
        const dropProgress = progress / 0.6;
        mesh.position.y = 5 * (1 - easing.easeInOutQuad(dropProgress));
      } else {
        // Impact and recovery
        const impactProgress = (progress - 0.6) / 0.4;
        mesh.position.y = 0;
        const bounce = Math.sin(impactProgress * Math.PI) * 0.2 * (1 - impactProgress);
        mesh.scale.set(
          0.8 + 0.2 * impactProgress + bounce * 0.3,
          0.8 + 0.2 * impactProgress - bounce * 0.5,
          0.8 + 0.2 * impactProgress + bounce * 0.1
        );
      }
    },
  },
  // Sci-fi - teleport/materialize
  'sci-fi': {
    name: 'Teleport In',
    duration: 1.5,
    setup: (mesh) => {
      mesh.scale.set(0, 3, 0);
      (mesh as any).material && ((mesh as any).material.opacity = 0);
    },
    animate: (mesh, progress) => {
      if (progress < 0.5) {
        // Vertical beam
        const beamProgress = progress / 0.5;
        mesh.scale.set(0.1, 3 - beamProgress * 2, 0.1);
        if ((mesh as any).material) {
          (mesh as any).material.opacity = beamProgress * 0.5;
        }
      } else {
        // Materialize
        const materializeProgress = (progress - 0.5) / 0.5;
        const eased = easing.easeOutElastic(materializeProgress);
        mesh.scale.set(eased, 1, eased);
        if ((mesh as any).material) {
          (mesh as any).material.opacity = 0.5 + materializeProgress * 0.5;
        }
      }
    },
  },
  // Fantasy - magical appearance with sparkles
  'fantasy': {
    name: 'Magical Summon',
    duration: 1.8,
    setup: (mesh) => {
      mesh.scale.set(0, 0, 0);
      mesh.rotation.y = -Math.PI;
      (mesh as any).material && ((mesh as any).material.opacity = 0);
    },
    animate: (mesh, progress) => {
      const easedScale = easing.easeOutBack(progress);
      const easedRotation = easing.easeOutQuart(progress);
      mesh.scale.set(easedScale, easedScale, easedScale);
      mesh.rotation.y = -Math.PI * (1 - easedRotation);
      if ((mesh as any).material) {
        (mesh as any).material.opacity = progress;
      }
    },
  },
  // Western - walk in from side
  'western': {
    name: 'Showdown Entrance',
    duration: 2.0,
    setup: (mesh) => {
      mesh.position.x = -5;
      mesh.rotation.y = Math.PI / 4;
    },
    animate: (mesh, progress) => {
      const easedProgress = easing.easeOutQuart(progress);
      mesh.position.x = -5 * (1 - easedProgress);
      mesh.rotation.y = (Math.PI / 4) * (1 - easedProgress);
    },
  },
  // Film Noir - fade in from shadows
  'film-noir': {
    name: 'Emerge from Shadows',
    duration: 2.0,
    setup: (mesh) => {
      mesh.position.z = -2;
      (mesh as any).material && ((mesh as any).material.opacity = 0);
    },
    animate: (mesh, progress) => {
      const easedProgress = easing.easeOutQuart(progress);
      mesh.position.z = -2 * (1 - easedProgress);
      if ((mesh as any).material) {
        (mesh as any).material.opacity = easedProgress;
      }
    },
  },
  // Period Drama - graceful curtsey/bow entrance
  'period-drama': {
    name: 'Courtly Entrance',
    duration: 2.2,
    setup: (mesh) => {
      mesh.scale.set(0.9, 0.9, 0.9);
      mesh.rotation.x = 0.2;
      (mesh as any).material && ((mesh as any).material.opacity = 0);
    },
    animate: (mesh, progress) => {
      if (progress < 0.5) {
        // Fade in with slight bow
        const fadeProgress = progress / 0.5;
        if ((mesh as any).material) {
          (mesh as any).material.opacity = fadeProgress;
        }
      } else {
        // Rise to full height
        const riseProgress = (progress - 0.5) / 0.5;
        const easedRise = easing.easeOutQuart(riseProgress);
        mesh.scale.set(0.9 + 0.1 * easedRise, 0.9 + 0.1 * easedRise, 0.9 + 0.1 * easedRise);
        mesh.rotation.x = 0.2 * (1 - easedRise);
      }
    },
  },
  // Asian Cinema - martial arts stance reveal
  'asian-cinema': {
    name: 'Warrior Reveal',
    duration: 1.5,
    setup: (mesh) => {
      mesh.scale.set(0, 0, 0);
      mesh.rotation.y = Math.PI;
    },
    animate: (mesh, progress) => {
      if (progress < 0.3) {
        // Quick scale up
        const scaleProgress = progress / 0.3;
        const eased = easing.easeOutBack(scaleProgress);
        mesh.scale.set(eased, eased, eased);
      } else {
        // Rotate to face forward
        const rotateProgress = (progress - 0.3) / 0.7;
        const easedRotate = easing.easeOutQuart(rotateProgress);
        mesh.scale.set(1, 1, 1);
        mesh.rotation.y = Math.PI * (1 - easedRotate);
      }
    },
  },
  // Superhero - flying landing
  'superhero': {
    name: 'Super Landing',
    duration: 1.5,
    setup: (mesh) => {
      mesh.position.y = 8;
      mesh.position.z = -3;
      mesh.rotation.x = -0.5;
    },
    animate: (mesh, progress) => {
      if (progress < 0.7) {
        // Flying down
        const flyProgress = progress / 0.7;
        const eased = easing.easeInOutQuad(flyProgress);
        mesh.position.y = 8 * (1 - eased);
        mesh.position.z = -3 * (1 - eased);
        mesh.rotation.x = -0.5 * (1 - eased);
      } else {
        // Impact recovery
        const impactProgress = (progress - 0.7) / 0.3;
        mesh.position.y = 0;
        mesh.position.z = 0;
        mesh.rotation.x = 0;
        const bounce = Math.sin(impactProgress * Math.PI) * 0.3 * (1 - impactProgress);
        mesh.scale.set(1 + bounce * 0.2, 1 - bounce * 0.3, 1 + bounce * 0.2);
      }
    },
  },
  // Profession - step into frame with tools
  'profession': {
    name: 'Step Into Frame',
    duration: 1.4,
    setup: (mesh) => {
      mesh.position.x = 2;
      mesh.rotation.y = -0.3;
      (mesh as any).material && ((mesh as any).material.opacity = 0);
    },
    animate: (mesh, progress) => {
      const easedProgress = easing.easeOutQuart(progress);
      mesh.position.x = 2 * (1 - easedProgress);
      mesh.rotation.y = -0.3 * (1 - easedProgress);
      if ((mesh as any).material) {
        (mesh as any).material.opacity = Math.min(1, progress * 1.5);
      }
    },
  },
  // Default - simple fade and scale
  'default': {
    name: 'Fade In',
    duration: 1.0,
    setup: (mesh) => {
      mesh.scale.set(0.5, 0.5, 0.5);
      (mesh as any).material && ((mesh as any).material.opacity = 0);
    },
    animate: (mesh, progress) => {
      const eased = easing.easeOutQuart(progress);
      mesh.scale.set(0.5 + 0.5 * eased, 0.5 + 0.5 * eased, 0.5 + 0.5 * eased);
      if ((mesh as any).material) {
        (mesh as any).material.opacity = eased;
      }
    },
  },
};

/**
 * Get entrance animation for a genre
 */
export function getEntranceAnimation(genre?: string): EntranceAnimation {
  return ENTRANCE_ANIMATIONS[genre || 'default'] || ENTRANCE_ANIMATIONS.default;
}

/**
 * Play entrance animation on a mesh
 */
export function playEntranceAnimation(
  mesh: THREE.Object3D,
  genre?: string,
  onComplete?: () => void
): () => void {
  const animation = getEntranceAnimation(genre);
  const startTime = Date.now();
  let animationFrameId: number;

  // Setup initial state
  animation.setup(mesh);

  const animate = () => {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(1, elapsed / animation.duration);

    animation.animate(mesh, progress);

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      // Ensure final state
      mesh.scale.set(1, 1, 1);
      mesh.position.y = 0;
      mesh.rotation.set(0, 0, 0);
      onComplete?.();
    }
  };

  animationFrameId = requestAnimationFrame(animate);

  // Return cancel function
  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  };
}

/**
 * Mood-based idle animation parameters
 */
export const MOOD_ANIMATIONS: Record<string, { intensity: number; speed: number; variance: number }> = {
  mysterious: { intensity: 0.5, speed: 0.8, variance: 0.3 },
  dangerous: { intensity: 0.7, speed: 1.2, variance: 0.4 },
  heroic: { intensity: 0.6, speed: 1.0, variance: 0.2 },
  seductive: { intensity: 0.4, speed: 0.6, variance: 0.5 },
  menacing: { intensity: 0.8, speed: 0.9, variance: 0.3 },
  wise: { intensity: 0.3, speed: 0.5, variance: 0.2 },
  noble: { intensity: 0.4, speed: 0.7, variance: 0.2 },
  insane: { intensity: 1.0, speed: 1.5, variance: 0.8 },
  transforming: { intensity: 0.9, speed: 1.3, variance: 0.6 },
  otherworldly: { intensity: 0.6, speed: 0.4, variance: 0.7 },
  default: { intensity: 0.5, speed: 1.0, variance: 0.3 },
};

/**
 * Get mood animation parameters
 */
export function getMoodAnimation(mood?: string) {
  return MOOD_ANIMATIONS[mood ||'default'] || MOOD_ANIMATIONS.default;
}
