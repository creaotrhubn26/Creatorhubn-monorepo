/**
 * Pose Library for Virtual Studio
 * Professional photography poses for portrait, fashion, and commercial work
 */

import { PoseData } from './IKSystem';

export interface PosePreset {
  id: string;
  name: string;
  category: 'portrait' | 'fashion' | 'commercial' | 'editorial' | 'fitness' | 'dance';
  description: string;
  thumbnail?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  pose: PoseData;
}

/**
 * Standard bone names for humanoid rigs
 */
export const BONE_NAMES = {
  // Spine
  HIPS: 'Hips',
  SPINE: 'Spine',
  SPINE1: 'Spine1',
  SPINE2: 'Spine2',
  NECK: 'Neck',
  HEAD: 'Head',
  
  // Left Arm
  LEFT_SHOULDER: 'LeftShoulder',
  LEFT_ARM: 'LeftArm',
  LEFT_FOREARM: 'LeftForeArm',
  LEFT_HAND: 'LeftHand',
  
  // Right Arm
  RIGHT_SHOULDER: 'RightShoulder',
  RIGHT_ARM: 'RightArm',
  RIGHT_FOREARM: 'RightForeArm',
  RIGHT_HAND: 'RightHand',
  
  // Left Leg
  LEFT_UP_LEG: 'LeftUpLeg',
  LEFT_LEG: 'LeftLeg',
  LEFT_FOOT: 'LeftFoot',
  
  // Right Leg
  RIGHT_UP_LEG: 'RightUpLeg',
  RIGHT_LEG: 'RightLeg',
  RIGHT_FOOT: 'RightFoot',
};

/**
 * Helper to create rotation data
 */
const rot = (x: number, y: number, z: number) => ({ x, y, z });

/**
 * Portrait Photography Poses
 */
export const PORTRAIT_POSES: PosePreset[] = [
  {
    id: 'portrait-neutral',
    name: 'Neutral Standing',
    category: 'portrait',
    description: 'Classic neutral standing pose for headshots and portraits',
    difficulty: 'beginner',
    pose: {
      name: 'portrait-neutral',
      bones: {
        [BONE_NAMES.HIPS]: { rotation: rot(0, 0, 0), position: [0, 0.95, 0] },
        [BONE_NAMES.SPINE]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.SPINE1]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.SPINE2]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.NECK]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.HEAD]: { rotation: rot(0, 0.1, 0) },
        
        [BONE_NAMES.LEFT_SHOULDER]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_ARM]: { rotation: rot(0, 0, -0.2) },
        [BONE_NAMES.LEFT_FOREARM]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_HAND]: { rotation: rot(0, 0, 0) },
        
        [BONE_NAMES.RIGHT_SHOULDER]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_ARM]: { rotation: rot(0, 0, 0.2) },
        [BONE_NAMES.RIGHT_FOREARM]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_HAND]: { rotation: rot(0, 0, 0) },
        
        [BONE_NAMES.LEFT_UP_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_FOOT]: { rotation: rot(0, 0, 0) },
        
        [BONE_NAMES.RIGHT_UP_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_FOOT]: { rotation: rot(0, 0, 0) },
      },
    },
  },
  
  {
    id: 'portrait-hand-on-hip',
    name: 'Hand on Hip',
    category: 'portrait',
    description: 'Confident pose with one hand on hip',
    difficulty: 'beginner',
    pose: {
      name: 'portrait-hand-on-hip',
      bones: {
        [BONE_NAMES.HIPS]: { rotation: rot(0, 0.2, 0), position: [0, 0.95, 0] },
        [BONE_NAMES.SPINE]: { rotation: rot(0, -0.1, 0.05) },
        [BONE_NAMES.SPINE1]: { rotation: rot(0, -0.1, 0.05) },
        [BONE_NAMES.SPINE2]: { rotation: rot(0, -0.1, 0) },
        [BONE_NAMES.NECK]: { rotation: rot(0, 0.15, -0.05) },
        [BONE_NAMES.HEAD]: { rotation: rot(0, 0.2, -0.05) },
        
        [BONE_NAMES.LEFT_SHOULDER]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_ARM]: { rotation: rot(0, 0, -0.3) },
        [BONE_NAMES.LEFT_FOREARM]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_HAND]: { rotation: rot(0, 0, 0) },
        
        [BONE_NAMES.RIGHT_SHOULDER]: { rotation: rot(0.3, 0, 0.5) },
        [BONE_NAMES.RIGHT_ARM]: { rotation: rot(0, 0, 0.8) },
        [BONE_NAMES.RIGHT_FOREARM]: { rotation: rot(0, 0, 1.2) },
        [BONE_NAMES.RIGHT_HAND]: { rotation: rot(0, 0, 0.3) },
        
        [BONE_NAMES.LEFT_UP_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_FOOT]: { rotation: rot(0, 0, 0) },
        
        [BONE_NAMES.RIGHT_UP_LEG]: { rotation: rot(0, 0.2, 0) },
        [BONE_NAMES.RIGHT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_FOOT]: { rotation: rot(0, 0.2, 0) },
      },
    },
  },
  
  {
    id: 'portrait-arms-crossed',
    name: 'Arms Crossed',
    category: 'portrait',
    description: 'Professional pose with arms crossed',
    difficulty: 'beginner',
    pose: {
      name: 'portrait-arms-crossed',
      bones: {
        [BONE_NAMES.HIPS]: { rotation: rot(0, 0, 0), position: [0, 0.95, 0] },
        [BONE_NAMES.SPINE]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.SPINE1]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.SPINE2]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.NECK]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.HEAD]: { rotation: rot(0, 0.1, 0) },
        
        [BONE_NAMES.LEFT_SHOULDER]: { rotation: rot(0.2, 0, -0.3) },
        [BONE_NAMES.LEFT_ARM]: { rotation: rot(0, 0, -0.8) },
        [BONE_NAMES.LEFT_FOREARM]: { rotation: rot(0, 0, -1.4) },
        [BONE_NAMES.LEFT_HAND]: { rotation: rot(0, 0, 0) },
        
        [BONE_NAMES.RIGHT_SHOULDER]: { rotation: rot(0.2, 0, 0.3) },
        [BONE_NAMES.RIGHT_ARM]: { rotation: rot(0, 0, 0.8) },
        [BONE_NAMES.RIGHT_FOREARM]: { rotation: rot(0, 0, 1.4) },
        [BONE_NAMES.RIGHT_HAND]: { rotation: rot(0, 0, 0) },
        
        [BONE_NAMES.LEFT_UP_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_FOOT]: { rotation: rot(0, 0, 0) },
        
        [BONE_NAMES.RIGHT_UP_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_FOOT]: { rotation: rot(0, 0, 0) },
      },
    },
  },
];

/**
 * Fashion Photography Poses
 */
export const FASHION_POSES: PosePreset[] = [
  {
    id: 'fashion-contrapposto',
    name: 'Contrapposto',
    category: 'fashion',
    description: 'Classic S-curve pose with weight on one leg',
    difficulty: 'intermediate',
    pose: {
      name: 'fashion-contrapposto',
      bones: {
        [BONE_NAMES.HIPS]: { rotation: rot(0, 0.3, 0.15), position: [0, 0.95, 0] },
        [BONE_NAMES.SPINE]: { rotation: rot(0, -0.2, -0.1) },
        [BONE_NAMES.SPINE1]: { rotation: rot(0, -0.15, -0.05) },
        [BONE_NAMES.SPINE2]: { rotation: rot(0, -0.1, 0) },
        [BONE_NAMES.NECK]: { rotation: rot(0, 0.2, 0.05) },
        [BONE_NAMES.HEAD]: { rotation: rot(0, 0.25, 0.05) },

        [BONE_NAMES.LEFT_SHOULDER]: { rotation: rot(0, 0, -0.2) },
        [BONE_NAMES.LEFT_ARM]: { rotation: rot(0, 0, -0.4) },
        [BONE_NAMES.LEFT_FOREARM]: { rotation: rot(0, 0, -0.3) },
        [BONE_NAMES.LEFT_HAND]: { rotation: rot(0, 0, -0.2) },

        [BONE_NAMES.RIGHT_SHOULDER]: { rotation: rot(0, 0, 0.2) },
        [BONE_NAMES.RIGHT_ARM]: { rotation: rot(0, 0, 0.5) },
        [BONE_NAMES.RIGHT_FOREARM]: { rotation: rot(0, 0, 0.4) },
        [BONE_NAMES.RIGHT_HAND]: { rotation: rot(0, 0, 0.2) },

        [BONE_NAMES.LEFT_UP_LEG]: { rotation: rot(0, 0, -0.1) },
        [BONE_NAMES.LEFT_LEG]: { rotation: rot(0.1, 0, 0) },
        [BONE_NAMES.LEFT_FOOT]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.RIGHT_UP_LEG]: { rotation: rot(0.2, 0.3, 0.1) },
        [BONE_NAMES.RIGHT_LEG]: { rotation: rot(0.3, 0, 0) },
        [BONE_NAMES.RIGHT_FOOT]: { rotation: rot(0, 0.3, 0) },
      },
    },
  },

  {
    id: 'fashion-power-pose',
    name: 'Power Pose',
    category: 'fashion',
    description: 'Strong, confident fashion pose',
    difficulty: 'intermediate',
    pose: {
      name: 'fashion-power-pose',
      bones: {
        [BONE_NAMES.HIPS]: { rotation: rot(0, 0, 0), position: [0, 0.95, 0] },
        [BONE_NAMES.SPINE]: { rotation: rot(-0.1, 0, 0) },
        [BONE_NAMES.SPINE1]: { rotation: rot(-0.05, 0, 0) },
        [BONE_NAMES.SPINE2]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.NECK]: { rotation: rot(0.1, 0, 0) },
        [BONE_NAMES.HEAD]: { rotation: rot(0.1, 0, 0) },

        [BONE_NAMES.LEFT_SHOULDER]: { rotation: rot(0.5, 0, -0.5) },
        [BONE_NAMES.LEFT_ARM]: { rotation: rot(0, 0, -1.2) },
        [BONE_NAMES.LEFT_FOREARM]: { rotation: rot(0, 0, -0.5) },
        [BONE_NAMES.LEFT_HAND]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.RIGHT_SHOULDER]: { rotation: rot(0.5, 0, 0.5) },
        [BONE_NAMES.RIGHT_ARM]: { rotation: rot(0, 0, 1.2) },
        [BONE_NAMES.RIGHT_FOREARM]: { rotation: rot(0, 0, 0.5) },
        [BONE_NAMES.RIGHT_HAND]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.LEFT_UP_LEG]: { rotation: rot(0, 0, -0.2) },
        [BONE_NAMES.LEFT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_FOOT]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.RIGHT_UP_LEG]: { rotation: rot(0, 0, 0.2) },
        [BONE_NAMES.RIGHT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_FOOT]: { rotation: rot(0, 0, 0) },
      },
    },
  },

  {
    id: 'fashion-walking',
    name: 'Walking Pose',
    category: 'fashion',
    description: 'Dynamic walking/runway pose',
    difficulty: 'advanced',
    pose: {
      name: 'fashion-walking',
      bones: {
        [BONE_NAMES.HIPS]: { rotation: rot(0, 0.4, 0.1), position: [0, 0.95, 0] },
        [BONE_NAMES.SPINE]: { rotation: rot(0, -0.3, -0.05) },
        [BONE_NAMES.SPINE1]: { rotation: rot(0, -0.2, 0) },
        [BONE_NAMES.SPINE2]: { rotation: rot(0, -0.1, 0) },
        [BONE_NAMES.NECK]: { rotation: rot(0, 0.3, 0) },
        [BONE_NAMES.HEAD]: { rotation: rot(0, 0.3, 0) },

        [BONE_NAMES.LEFT_SHOULDER]: { rotation: rot(0.3, 0, -0.3) },
        [BONE_NAMES.LEFT_ARM]: { rotation: rot(0, 0, -0.6) },
        [BONE_NAMES.LEFT_FOREARM]: { rotation: rot(0, 0, -0.4) },
        [BONE_NAMES.LEFT_HAND]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.RIGHT_SHOULDER]: { rotation: rot(-0.3, 0, 0.3) },
        [BONE_NAMES.RIGHT_ARM]: { rotation: rot(0, 0, 0.6) },
        [BONE_NAMES.RIGHT_FOREARM]: { rotation: rot(0, 0, 0.4) },
        [BONE_NAMES.RIGHT_HAND]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.LEFT_UP_LEG]: { rotation: rot(-0.4, 0, 0) },
        [BONE_NAMES.LEFT_LEG]: { rotation: rot(0.6, 0, 0) },
        [BONE_NAMES.LEFT_FOOT]: { rotation: rot(-0.2, 0, 0) },

        [BONE_NAMES.RIGHT_UP_LEG]: { rotation: rot(0.4, 0, 0) },
        [BONE_NAMES.RIGHT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_FOOT]: { rotation: rot(0, 0, 0) },
      },
    },
  },
];

/**
 * Commercial/Editorial Poses
 */
export const COMMERCIAL_POSES: PosePreset[] = [
  {
    id: 'commercial-sitting',
    name: 'Sitting Casual',
    category: 'commercial',
    description: 'Relaxed sitting pose for lifestyle photography',
    difficulty: 'beginner',
    pose: {
      name: 'commercial-sitting',
      bones: {
        [BONE_NAMES.HIPS]: { rotation: rot(0.8, 0, 0), position: [0, 0.5, 0] },
        [BONE_NAMES.SPINE]: { rotation: rot(-0.2, 0, 0) },
        [BONE_NAMES.SPINE1]: { rotation: rot(-0.1, 0, 0) },
        [BONE_NAMES.SPINE2]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.NECK]: { rotation: rot(0.1, 0, 0) },
        [BONE_NAMES.HEAD]: { rotation: rot(0.1, 0.1, 0) },

        [BONE_NAMES.LEFT_SHOULDER]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_ARM]: { rotation: rot(0, 0, -0.3) },
        [BONE_NAMES.LEFT_FOREARM]: { rotation: rot(0, 0, -0.5) },
        [BONE_NAMES.LEFT_HAND]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.RIGHT_SHOULDER]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_ARM]: { rotation: rot(0, 0, 0.3) },
        [BONE_NAMES.RIGHT_FOREARM]: { rotation: rot(0, 0, 0.5) },
        [BONE_NAMES.RIGHT_HAND]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.LEFT_UP_LEG]: { rotation: rot(1.4, 0, 0) },
        [BONE_NAMES.LEFT_LEG]: { rotation: rot(-1.2, 0, 0) },
        [BONE_NAMES.LEFT_FOOT]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.RIGHT_UP_LEG]: { rotation: rot(1.4, 0, 0) },
        [BONE_NAMES.RIGHT_LEG]: { rotation: rot(-1.2, 0, 0) },
        [BONE_NAMES.RIGHT_FOOT]: { rotation: rot(0, 0, 0) },
      },
    },
  },

  {
    id: 'commercial-leaning',
    name: 'Leaning Forward',
    category: 'commercial',
    description: 'Engaged, leaning forward pose',
    difficulty: 'beginner',
    pose: {
      name: 'commercial-leaning',
      bones: {
        [BONE_NAMES.HIPS]: { rotation: rot(0.3, 0, 0), position: [0, 0.95, 0] },
        [BONE_NAMES.SPINE]: { rotation: rot(0.2, 0, 0) },
        [BONE_NAMES.SPINE1]: { rotation: rot(0.2, 0, 0) },
        [BONE_NAMES.SPINE2]: { rotation: rot(0.1, 0, 0) },
        [BONE_NAMES.NECK]: { rotation: rot(-0.1, 0, 0) },
        [BONE_NAMES.HEAD]: { rotation: rot(-0.1, 0, 0) },

        [BONE_NAMES.LEFT_SHOULDER]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_ARM]: { rotation: rot(0, 0, -0.2) },
        [BONE_NAMES.LEFT_FOREARM]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_HAND]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.RIGHT_SHOULDER]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_ARM]: { rotation: rot(0, 0, 0.2) },
        [BONE_NAMES.RIGHT_FOREARM]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_HAND]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.LEFT_UP_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.LEFT_FOOT]: { rotation: rot(0, 0, 0) },

        [BONE_NAMES.RIGHT_UP_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_LEG]: { rotation: rot(0, 0, 0) },
        [BONE_NAMES.RIGHT_FOOT]: { rotation: rot(0, 0, 0) },
      },
    },
  },
];

/**
 * All pose presets combined
 */
export const ALL_POSES: PosePreset[] = [
  ...PORTRAIT_POSES,
  ...FASHION_POSES,
  ...COMMERCIAL_POSES,
];

/**
 * Get poses by category
 */
export function getPosesByCategory(category: PosePreset['category']): PosePreset[] {
  return ALL_POSES.filter((pose) => pose.category === category);
}

/**
 * Get pose by ID
 */
export function getPoseById(id: string): PosePreset | undefined {
  return ALL_POSES.find((pose) => pose.id === id);
}

/**
 * Get all categories
 */
export function getCategories(): PosePreset['category'][] {
  return ['portrait','fashion','commercial','editorial','fitness','dance'];
}

