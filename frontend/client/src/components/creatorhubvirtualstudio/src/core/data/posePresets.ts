/**
 * Pose Presets Library
 * 
 * Collection of pre-defined poses for virtual actors.
 * Poses include joint rotations for humanoid rigs.
 */

export type PoseCategory = 
  | 'standing' 
  | 'sitting' 
  | 'action' 
  | 'portrait'
  | 'fashion'
  | 'business'
  | 'casual'
  | 'dance'
  | 'sports'
  | 'emotional';

export interface JointRotation {
  x: number; // degrees
  y: number;
  z: number;
}

export interface PoseData {
  spine: JointRotation;
  spine1?: JointRotation;
  spine2?: JointRotation;
  neck: JointRotation;
  head: JointRotation;
  leftShoulder: JointRotation;
  leftArm: JointRotation;
  leftForeArm: JointRotation;
  leftHand: JointRotation;
  rightShoulder: JointRotation;
  rightArm: JointRotation;
  rightForeArm: JointRotation;
  rightHand: JointRotation;
  leftUpLeg: JointRotation;
  leftLeg: JointRotation;
  leftFoot: JointRotation;
  rightUpLeg: JointRotation;
  rightLeg: JointRotation;
  rightFoot: JointRotation;
}

export interface PosePreset {
  id: string;
  name: string;
  description: string;
  category: PoseCategory;
  gender?: 'male' | 'female' | 'neutral';
  thumbnailPath?: string;
  pose: PoseData;
  tags?: string[];
}

// Default neutral pose
const NEUTRAL_POSE: PoseData = {
  spine: { x: 0, y: 0, z: 0 },
  spine1: { x: 0, y: 0, z: 0 },
  spine2: { x: 0, y: 0, z: 0 },
  neck: { x: 0, y: 0, z: 0 },
  head: { x: 0, y: 0, z: 0 },
  leftShoulder: { x: 0, y: 0, z: 0 },
  leftArm: { x: 0, y: 0, z: -45 },
  leftForeArm: { x: 0, y: 0, z: 0 },
  leftHand: { x: 0, y: 0, z: 0 },
  rightShoulder: { x: 0, y: 0, z: 0 },
  rightArm: { x: 0, y: 0, z: 45 },
  rightForeArm: { x: 0, y: 0, z: 0 },
  rightHand: { x: 0, y: 0, z: 0 },
  leftUpLeg: { x: 0, y: 0, z: 0 },
  leftLeg: { x: 0, y: 0, z: 0 },
  leftFoot: { x: 0, y: 0, z: 0 },
  rightUpLeg: { x: 0, y: 0, z: 0 },
  rightLeg: { x: 0, y: 0, z: 0 },
  rightFoot: { x: 0, y: 0, z: 0 },
};

// ============================================================================
// Standing Poses
// ============================================================================
export const STANDING_POSES: PosePreset[] = [
  {
    id: 'standing-neutral',
    name: 'Standing Neutral',
    description: 'Basic standing pose with arms at sides',
    category: 'standing',
    gender: 'neutral',
    pose: NEUTRAL_POSE,
    tags: ['basic','neutral','default'],
  },
  {
    id: 'standing-confident',
    name: 'Confident Stance',
    description: 'Shoulders back, chest out, confident posture',
    category: 'standing',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -5, y: 0, z: 0 },
      spine2: { x: -3, y: 0, z: 0 },
      leftArm: { x: 0, y: 10, z: -30 },
      rightArm: { x: 0, y: -10, z: 30 },
    },
    tags: ['confident','power','strong'],
  },
  {
    id: 'standing-relaxed',
    name: 'Relaxed Stance',
    description: 'Weight on one leg, casual posture',
    category: 'standing',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: 0, y: 5, z: 3 },
      rightUpLeg: { x: 0, y: 5, z: 10 },
      leftUpLeg: { x: 0, y: -3, z: -5 },
      leftArm: { x: 0, y: 15, z: -35 },
      rightArm: { x: 0, y: -5, z: 40 },
    },
    tags: ['relaxed','casual','natural'],
  },
  {
    id: 'standing-crossed-arms',
    name: 'Arms Crossed',
    description: 'Standing with arms crossed',
    category: 'standing',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -3, y: 0, z: 0 },
      leftArm: { x: 45, y: 0, z: 60 },
      leftForeArm: { x: 90, y: -45, z: 0 },
      rightArm: { x: 45, y: 0, z: -60 },
      rightForeArm: { x: 90, y: 45, z: 0 },
    },
    tags: ['defensive','thoughtful','closed'],
  },
  {
    id: 'standing-hands-hips',
    name: 'Hands on Hips',
    description: 'Power pose with hands on hips',
    category: 'standing',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -5, y: 0, z: 0 },
      leftArm: { x: 0, y: 30, z: -50 },
      leftForeArm: { x: 0, y: 90, z: -90 },
      rightArm: { x: 0, y: -30, z: 50 },
      rightForeArm: { x: 0, y: -90, z: 90 },
    },
    tags: ['power','confident','assertive'],
  },
];

// ============================================================================
// Sitting Poses
// ============================================================================
export const SITTING_POSES: PosePreset[] = [
  {
    id: 'sitting-chair-formal',
    name: 'Formal Chair Sitting',
    description: 'Upright sitting position for business portraits',
    category: 'sitting',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -10, y: 0, z: 0 },
      leftUpLeg: { x: -90, y: 0, z: 0 },
      rightUpLeg: { x: -90, y: 0, z: 0 },
      leftLeg: { x: 90, y: 0, z: 0 },
      rightLeg: { x: 90, y: 0, z: 0 },
      leftArm: { x: 0, y: 0, z: -30 },
      rightArm: { x: 0, y: 0, z: 30 },
    },
    tags: ['formal','business','professional'],
  },
  {
    id: 'sitting-chair-relaxed',
    name: 'Relaxed Chair Sitting',
    description: 'Casual sitting position, leaning back',
    category: 'sitting',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: 15, y: 0, z: 3 },
      neck: { x: -5, y: 5, z: 0 },
      leftUpLeg: { x: -95, y: 10, z: 15 },
      rightUpLeg: { x: -90, y: -5, z: -10 },
      leftLeg: { x: 80, y: 0, z: 0 },
      rightLeg: { x: 95, y: 0, z: 0 },
    },
    tags: ['relaxed','casual','comfortable'],
  },
  {
    id: 'sitting-crossed-legs',
    name: 'Crossed Legs',
    description: 'Elegant sitting with legs crossed',
    category: 'sitting',
    gender: 'female',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -8, y: 3, z: 0 },
      leftUpLeg: { x: -90, y: 0, z: 0 },
      rightUpLeg: { x: -80, y: 30, z: 30 },
      leftLeg: { x: 85, y: 0, z: 0 },
      rightLeg: { x: 60, y: 0, z: 0 },
      leftArm: { x: -15, y: 0, z: -25 },
      rightArm: { x: -20, y: 0, z: 35 },
    },
    tags: ['elegant','feminine','professional'],
  },
  {
    id: 'sitting-stool',
    name: 'Stool Sitting',
    description: 'Sitting on a stool, feet resting on bar',
    category: 'sitting',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -5, y: 0, z: 0 },
      leftUpLeg: { x: -70, y: 5, z: 5 },
      rightUpLeg: { x: -75, y: -5, z: -5 },
      leftLeg: { x: 110, y: 0, z: 0 },
      rightLeg: { x: 100, y: 0, z: 0 },
    },
    tags: ['stool','casual','bar'],
  },
];

// ============================================================================
// Portrait Poses
// ============================================================================
export const PORTRAIT_POSES: PosePreset[] = [
  {
    id: 'portrait-three-quarter',
    name: 'Three-Quarter View',
    description: 'Classic portrait pose angled 45 degrees',
    category: 'portrait',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -3, y: 25, z: 0 },
      neck: { x: 0, y: -10, z: 0 },
      head: { x: -5, y: -15, z: 3 },
      leftArm: { x: 0, y: 15, z: -30 },
      rightArm: { x: 10, y: -10, z: 35 },
    },
    tags: ['classic','headshot','professional'],
  },
  {
    id: 'portrait-profile',
    name: 'Profile View',
    description: 'Side profile pose',
    category: 'portrait',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -5, y: 90, z: 0 },
      neck: { x: 5, y: 0, z: 0 },
      head: { x: -3, y: 0, z: 2 },
    },
    tags: ['profile','dramatic','artistic'],
  },
  {
    id: 'portrait-chin-on-hand',
    name: 'Chin on Hand',
    description: 'Thoughtful pose with chin resting on hand',
    category: 'portrait',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -8, y: 15, z: 0 },
      head: { x: 5, y: -10, z: -5 },
      rightArm: { x: 70, y: -20, z: 30 },
      rightForeArm: { x: 90, y: 0, z: 0 },
      rightHand: { x: -20, y: 0, z: 0 },
    },
    tags: ['thoughtful','contemplative','artistic'],
  },
  {
    id: 'portrait-over-shoulder',
    name: 'Looking Over Shoulder',
    description: 'Looking back over shoulder',
    category: 'portrait',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: 0, y: 120, z: 0 },
      neck: { x: 0, y: -30, z: 5 },
      head: { x: -5, y: -45, z: 0 },
    },
    tags: ['dramatic','mysterious','fashion'],
  },
];

// ============================================================================
// Fashion Poses
// ============================================================================
export const FASHION_POSES: PosePreset[] = [
  {
    id: 'fashion-runway-walk',
    name: 'Runway Walk',
    description: 'Mid-stride runway walking pose',
    category: 'fashion',
    gender: 'female',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -5, y: 0, z: 0 },
      leftUpLeg: { x: 25, y: 0, z: 0 },
      rightUpLeg: { x: -35, y: 0, z: 0 },
      leftLeg: { x: -10, y: 0, z: 0 },
      rightLeg: { x: 45, y: 0, z: 0 },
      leftArm: { x: 15, y: 0, z: -25 },
      rightArm: { x: -20, y: 0, z: 30 },
    },
    tags: ['runway','walk','dynamic'],
  },
  {
    id: 'fashion-editorial-1',
    name: 'Editorial Pose 1',
    description: 'High fashion editorial pose',
    category: 'fashion',
    gender: 'female',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: 10, y: 20, z: 8 },
      neck: { x: -10, y: -15, z: -5 },
      head: { x: 5, y: -5, z: 8 },
      leftArm: { x: -20, y: 90, z: -45 },
      leftForeArm: { x: 0, y: 90, z: 0 },
      rightArm: { x: 0, y: -20, z: 45 },
    },
    tags: ['editorial','dramatic','high-fashion'],
  },
  {
    id: 'fashion-hand-on-waist',
    name: 'Hand on Waist',
    description: 'Classic fashion pose with hand on waist',
    category: 'fashion',
    gender: 'female',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -3, y: 10, z: 5 },
      leftUpLeg: { x: 0, y: 0, z: -15 },
      rightUpLeg: { x: 15, y: 15, z: 10 },
      leftArm: { x: 0, y: 30, z: -50 },
      leftForeArm: { x: 0, y: 100, z: -100 },
      rightArm: { x: 0, y: -5, z: 35 },
    },
    tags: ['classic','feminine','elegant'],
  },
];

// ============================================================================
// Action Poses
// ============================================================================
export const ACTION_POSES: PosePreset[] = [
  {
    id: 'action-running',
    name: 'Running',
    description: 'Mid-stride running pose',
    category: 'action',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -15, y: 0, z: 0 },
      leftUpLeg: { x: 60, y: 0, z: 0 },
      rightUpLeg: { x: -45, y: 0, z: 0 },
      leftLeg: { x: -30, y: 0, z: 0 },
      rightLeg: { x: 80, y: 0, z: 0 },
      leftArm: { x: -45, y: 0, z: -30 },
      leftForeArm: { x: 90, y: 0, z: 0 },
      rightArm: { x: 60, y: 0, z: 30 },
      rightForeArm: { x: 70, y: 0, z: 0 },
    },
    tags: ['running','dynamic','athletic'],
  },
  {
    id: 'action-jumping',
    name: 'Jumping',
    description: 'Mid-air jump pose',
    category: 'action',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -10, y: 0, z: 0 },
      leftUpLeg: { x: -20, y: -15, z: -10 },
      rightUpLeg: { x: -20, y: 15, z: 10 },
      leftLeg: { x: 30, y: 0, z: 0 },
      rightLeg: { x: 30, y: 0, z: 0 },
      leftArm: { x: 0, y: 0, z: -120 },
      rightArm: { x: 0, y: 0, z: 120 },
    },
    tags: ['jumping','dynamic','energetic'],
  },
  {
    id: 'action-punching',
    name: 'Punching',
    description: 'Boxing punch pose',
    category: 'action',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -5, y: 30, z: 0 },
      leftUpLeg: { x: 0, y: 0, z: -20 },
      rightUpLeg: { x: -20, y: 30, z: 0 },
      rightLeg: { x: 25, y: 0, z: 0 },
      leftArm: { x: 60, y: 0, z: 60 },
      leftForeArm: { x: 120, y: -60, z: 0 },
      rightArm: { x: 80, y: -20, z: -30 },
      rightForeArm: { x: -10, y: 0, z: 0 },
    },
    tags: ['boxing','fighting','dynamic'],
  },
];

// ============================================================================
// Business Poses
// ============================================================================
export const BUSINESS_POSES: PosePreset[] = [
  {
    id: 'business-handshake',
    name: 'Handshake Ready',
    description: 'Professional handshake position',
    category: 'business',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -5, y: 15, z: 0 },
      rightArm: { x: 45, y: -15, z: 30 },
      rightForeArm: { x: 0, y: 0, z: 0 },
      rightHand: { x: -10, y: 0, z: 0 },
    },
    tags: ['professional','greeting','formal'],
  },
  {
    id: 'business-presentation',
    name: 'Presentation Gesture',
    description: 'Gesturing during presentation',
    category: 'business',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -5, y: 0, z: 0 },
      rightArm: { x: 30, y: -30, z: 60 },
      rightForeArm: { x: 0, y: 30, z: 0 },
      rightHand: { x: 0, y: -15, z: 0 },
      leftArm: { x: 0, y: 15, z: -35 },
    },
    tags: ['presentation','speaking','professional'],
  },
  {
    id: 'business-thinking',
    name: 'Business Thinking',
    description: 'Thoughtful business pose',
    category: 'business',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -3, y: 0, z: 0 },
      neck: { x: 5, y: 10, z: 0 },
      rightArm: { x: 60, y: 0, z: 30 },
      rightForeArm: { x: 100, y: 0, z: 0 },
      rightHand: { x: -15, y: 0, z: 0 },
    },
    tags: ['thinking','contemplative','professional'],
  },
];

// ============================================================================
// Emotional Poses
// ============================================================================
export const EMOTIONAL_POSES: PosePreset[] = [
  {
    id: 'emotional-joy',
    name: 'Joy/Celebration',
    description: 'Arms raised in celebration',
    category: 'emotional',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: -10, y: 0, z: 0 },
      neck: { x: -10, y: 0, z: 0 },
      head: { x: -15, y: 0, z: 0 },
      leftArm: { x: 0, y: 0, z: -150 },
      leftForeArm: { x: 0, y: -30, z: 0 },
      rightArm: { x: 0, y: 0, z: 150 },
      rightForeArm: { x: 0, y: 30, z: 0 },
    },
    tags: ['happy','celebration','victory'],
  },
  {
    id: 'emotional-sadness',
    name: 'Sadness/Grief',
    description: 'Head bowed, shoulders slumped',
    category: 'emotional',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: 15, y: 0, z: 0 },
      neck: { x: 20, y: 0, z: 0 },
      head: { x: 30, y: 0, z: 0 },
      leftShoulder: { x: 10, y: 0, z: 5 },
      rightShoulder: { x: 10, y: 0, z: -5 },
      leftArm: { x: 0, y: 10, z: -20 },
      rightArm: { x: 0, y: -10, z: 20 },
    },
    tags: ['sad','grief','melancholy'],
  },
  {
    id: 'emotional-defensive',
    name: 'Defensive/Protective',
    description: 'Arms wrapped protectively',
    category: 'emotional',
    gender: 'neutral',
    pose: {
      ...NEUTRAL_POSE,
      spine: { x: 10, y: 0, z: 3 },
      neck: { x: 10, y: 0, z: 0 },
      leftArm: { x: 80, y: 0, z: 60 },
      leftForeArm: { x: 90, y: -60, z: 0 },
      rightArm: { x: 75, y: 0, z: -55 },
      rightForeArm: { x: 85, y: 60, z: 0 },
    },
    tags: ['defensive','protective','closed'],
  },
];

// ============================================================================
// Export all poses
// ============================================================================
export const ALL_POSES: PosePreset[] = [
  ...STANDING_POSES,
  ...SITTING_POSES,
  ...PORTRAIT_POSES,
  ...FASHION_POSES,
  ...ACTION_POSES,
  ...BUSINESS_POSES,
  ...EMOTIONAL_POSES,
];

export const POSES_BY_CATEGORY: Record<PoseCategory, PosePreset[]> = {
  standing: STANDING_POSES,
  sitting: SITTING_POSES,
  portrait: PORTRAIT_POSES,
  fashion: FASHION_POSES,
  action: ACTION_POSES,
  business: BUSINESS_POSES,
  emotional: EMOTIONAL_POSES,
  casual: [],
  dance: [],
  sports: [],
};

/**
 * Get pose by ID
 */
export function getPoseById(id: string): PosePreset | undefined {
  return ALL_POSES.find(pose => pose.id === id);
}

/**
 * Search poses by tag
 */
export function searchPosesByTag(tag: string): PosePreset[] {
  return ALL_POSES.filter(pose => pose.tags?.includes(tag.toLowerCase()));
}

