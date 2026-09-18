export const SHOT_SIZES = {
  'extreme-wide': 'extreme wide shot; environment and geography dominate the frame',
  wide: 'wide shot; full blocking and spatial relationships remain readable',
  medium: 'medium shot; performance and body language share emphasis',
  'medium-close-up': 'medium close-up; chest-up performance with readable environment',
  'close-up': 'close-up; facial performance and the dramatic beat dominate',
  'extreme-close-up': 'extreme close-up; isolate one precise expressive detail',
  'over-the-shoulder': 'over-the-shoulder shot; preserve eyeline and screen direction',
  'point-of-view': 'point-of-view shot from the named character’s physical position',
} as const;

export const CAMERA_ANGLES = {
  'eye-level': 'eye-level camera; neutral human perspective',
  low: 'low-angle camera; subject gains scale and power',
  high: 'high-angle camera; reveal spatial vulnerability',
  dutch: 'controlled Dutch angle; motivated visual instability',
  'birds-eye': 'bird’s-eye view; directly overhead spatial composition',
  'worms-eye': 'worm’s-eye view; camera extremely low and looking upward',
} as const;

export const CAMERA_MOVEMENTS = {
  static: 'locked static camera',
  dolly: 'controlled dolly movement through physical space',
  push: 'slow motivated push-in toward the dramatic subject',
  pull: 'controlled pull-back that reveals new spatial information',
  pan: 'motivated horizontal pan',
  tilt: 'motivated vertical tilt',
  truck: 'lateral truck movement parallel to the subject',
  crane: 'smooth crane movement with a clear start and end composition',
  handheld: 'restrained handheld movement with human micro-motion',
  steadicam: 'stable Steadicam movement following the blocking',
  orbit: 'controlled orbit around the dramatic subject',
} as const;

export const CINEMATOGRAPHY_LENSES_MM = [18, 24, 35, 50, 85, 135] as const;

const shotAliases: Record<string, keyof typeof SHOT_SIZES> = {
  ews: 'extreme-wide', extreme_wide: 'extreme-wide', 'extreme wide': 'extreme-wide',
  ws: 'wide', wide: 'wide', establishing: 'wide',
  ms: 'medium', medium: 'medium',
  mcu: 'medium-close-up', 'medium close-up': 'medium-close-up', 'medium-close': 'medium-close-up',
  'medium-close-up': 'medium-close-up',
  cu: 'close-up', closeup: 'close-up', 'close-up': 'close-up',
  ecu: 'extreme-close-up', 'extreme close-up': 'extreme-close-up', insert: 'extreme-close-up',
  ots: 'over-the-shoulder', 'over shoulder': 'over-the-shoulder', 'over-shoulder': 'over-the-shoulder',
  'over-the-shoulder': 'over-the-shoulder',
  pov: 'point-of-view', 'point of view': 'point-of-view',
};

const angleAliases: Record<string, keyof typeof CAMERA_ANGLES> = {
  'eye level': 'eye-level', eyelevel: 'eye-level', neutral: 'eye-level',
  low: 'low', 'low angle': 'low',
  high: 'high', 'high angle': 'high',
  dutch: 'dutch', 'dutch angle': 'dutch',
  overhead: 'birds-eye', "bird's-eye": 'birds-eye', 'birds eye': 'birds-eye',
  "worm's-eye": 'worms-eye', 'worms eye': 'worms-eye',
};

const movementAliases: Record<string, keyof typeof CAMERA_MOVEMENTS> = {
  static: 'static', locked: 'static',
  dolly: 'dolly', tracking: 'dolly',
  push: 'push', 'push in': 'push', 'push-in': 'push',
  pull: 'pull', 'pull out': 'pull', 'pull-out': 'pull',
  pan: 'pan', tilt: 'tilt', truck: 'truck', crane: 'crane',
  handheld: 'handheld', steadicam: 'steadicam', orbit: 'orbit',
};

function key(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
}

export function normalizeShotSize(value: string | null | undefined) {
  const normalized = shotAliases[key(value)];
  return normalized ? { id: normalized, prompt: SHOT_SIZES[normalized] } : null;
}

export function normalizeCameraAngle(value: string | null | undefined) {
  const normalized = angleAliases[key(value)];
  return normalized ? { id: normalized, prompt: CAMERA_ANGLES[normalized] } : null;
}

export function normalizeCameraMovement(value: string | null | undefined) {
  const normalized = movementAliases[key(value)];
  return normalized ? { id: normalized, prompt: CAMERA_MOVEMENTS[normalized] } : null;
}

export function isGrammarLens(value: number | null | undefined): boolean {
  return value != null && (CINEMATOGRAPHY_LENSES_MM as readonly number[]).includes(value);
}
