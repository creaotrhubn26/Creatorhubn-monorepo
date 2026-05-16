/**
 * poseLibrary — pre-tegnede stick-figure-templates som artisten kan
 * sette inn i et frame for å starte med god proporsjon.
 *
 * Hver pose er en samling line-segmenter med normaliserte koordinater
 * (0..1 langs hver akse). Setting-in-flyten skalerer dem til target-
 * canvas-størrelse + transformerer til PencilStroke[].
 *
 * Inspirasjon: Procreate Dreams' "rigging assist", Toon Boom's pose
 * library, Storyboarder's quick-character-templates.
 */

export interface PosePoint {
  x: number;
  y: number;
}

/** En "limb" er en strek mellom punkter (hode, arm, ben osv.). */
export interface PoseLimb {
  /** Beskrivelse til debug/UI ("right arm", "torso"). */
  name: string;
  /** Punkter i normaliserte koordinater (0..1). */
  points: PosePoint[];
  /** Tykkelse-multiplikator (1 = normal, 0.5 = tynnere). */
  weight?: number;
}

export interface Pose {
  id: string;
  name: string;
  description: string;
  /** Hovedkategori: gesture/action/conversation osv. */
  category: 'gesture' | 'action' | 'conversation' | 'rest' | 'special';
  /** Tags for søk og filter. */
  tags: string[];
  limbs: PoseLimb[];
  /** Foreslått aspect ratio for komposisjon. */
  preferredFraming?: 'wide' | 'medium' | 'close-up';
}

// ============================================================================
// Pose data (normaliserte koordinater 0..1)
// ============================================================================
// Konvensjon: origo øverst-venstre, x går høyre, y går ned.
// Stick-figure-anatomi:
//   - Hode: liten sirkel approksimert som tett polygon
//   - Hals/torso: en strek
//   - Armer/ben: to-segments-streker (skulder → albue → hånd, hofte → kne → fot)

function circle(cx: number, cy: number, r: number, segments = 12): PosePoint[] {
  const pts: PosePoint[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  return pts;
}

// Helper for å lage standard stick-figure med custom limb-punkter.
function buildFigure(opts: {
  head: { cx: number; cy: number; r: number };
  neck: PosePoint;
  pelvis: PosePoint;
  leftShoulder: PosePoint;
  rightShoulder: PosePoint;
  leftElbow: PosePoint;
  rightElbow: PosePoint;
  leftHand: PosePoint;
  rightHand: PosePoint;
  leftHip: PosePoint;
  rightHip: PosePoint;
  leftKnee: PosePoint;
  rightKnee: PosePoint;
  leftFoot: PosePoint;
  rightFoot: PosePoint;
}): PoseLimb[] {
  return [
    { name: 'head', points: circle(opts.head.cx, opts.head.cy, opts.head.r), weight: 1 },
    { name: 'spine', points: [opts.neck, opts.pelvis], weight: 1.1 },
    { name: 'shoulders', points: [opts.leftShoulder, opts.rightShoulder], weight: 0.9 },
    { name: 'hips', points: [opts.leftHip, opts.rightHip], weight: 0.8 },
    { name: 'left-arm', points: [opts.leftShoulder, opts.leftElbow, opts.leftHand], weight: 0.9 },
    { name: 'right-arm', points: [opts.rightShoulder, opts.rightElbow, opts.rightHand], weight: 0.9 },
    { name: 'left-leg', points: [opts.leftHip, opts.leftKnee, opts.leftFoot], weight: 1 },
    { name: 'right-leg', points: [opts.rightHip, opts.rightKnee, opts.rightFoot], weight: 1 },
  ];
}

const POSE_STANDING_FRONT: Pose = {
  id: 'standing-front',
  name: 'Stående front',
  description: 'Nøytral stående figur sett rett forfra. Bra utgangspunkt for portrett-shots.',
  category: 'rest',
  tags: ['standing', 'front', 'neutral', 'portrait'],
  preferredFraming: 'medium',
  limbs: buildFigure({
    head: { cx: 0.5, cy: 0.13, r: 0.05 },
    neck: { x: 0.5, y: 0.2 },
    pelvis: { x: 0.5, y: 0.55 },
    leftShoulder: { x: 0.42, y: 0.22 },
    rightShoulder: { x: 0.58, y: 0.22 },
    leftElbow: { x: 0.38, y: 0.36 },
    rightElbow: { x: 0.62, y: 0.36 },
    leftHand: { x: 0.36, y: 0.52 },
    rightHand: { x: 0.64, y: 0.52 },
    leftHip: { x: 0.45, y: 0.58 },
    rightHip: { x: 0.55, y: 0.58 },
    leftKnee: { x: 0.44, y: 0.76 },
    rightKnee: { x: 0.56, y: 0.76 },
    leftFoot: { x: 0.43, y: 0.95 },
    rightFoot: { x: 0.57, y: 0.95 },
  }),
};

const POSE_WALKING: Pose = {
  id: 'walking',
  name: 'Går',
  description: 'Figur i gå-bevegelse — venstre ben fremover, høyre arm fremover.',
  category: 'action',
  tags: ['walking', 'side', 'movement', 'casual'],
  preferredFraming: 'wide',
  limbs: buildFigure({
    head: { cx: 0.5, cy: 0.13, r: 0.05 },
    neck: { x: 0.5, y: 0.2 },
    pelvis: { x: 0.5, y: 0.55 },
    leftShoulder: { x: 0.42, y: 0.22 },
    rightShoulder: { x: 0.58, y: 0.22 },
    leftElbow: { x: 0.35, y: 0.34 },
    rightElbow: { x: 0.66, y: 0.32 },
    leftHand: { x: 0.32, y: 0.5 },
    rightHand: { x: 0.7, y: 0.46 },
    leftHip: { x: 0.46, y: 0.58 },
    rightHip: { x: 0.54, y: 0.58 },
    leftKnee: { x: 0.4, y: 0.76 },
    rightKnee: { x: 0.6, y: 0.74 },
    leftFoot: { x: 0.36, y: 0.95 },
    rightFoot: { x: 0.64, y: 0.92 },
  }),
};

const POSE_RUNNING: Pose = {
  id: 'running',
  name: 'Løper',
  description: 'Full sprint — luten lent fremover, dramatisk arm-/ben-vinkel.',
  category: 'action',
  tags: ['running', 'sprint', 'movement', 'action'],
  preferredFraming: 'wide',
  limbs: buildFigure({
    head: { cx: 0.52, cy: 0.13, r: 0.05 },
    neck: { x: 0.5, y: 0.2 },
    pelvis: { x: 0.48, y: 0.55 },
    leftShoulder: { x: 0.42, y: 0.21 },
    rightShoulder: { x: 0.56, y: 0.23 },
    leftElbow: { x: 0.3, y: 0.32 },
    rightElbow: { x: 0.68, y: 0.36 },
    leftHand: { x: 0.24, y: 0.42 },
    rightHand: { x: 0.74, y: 0.5 },
    leftHip: { x: 0.45, y: 0.58 },
    rightHip: { x: 0.52, y: 0.58 },
    leftKnee: { x: 0.34, y: 0.72 },
    rightKnee: { x: 0.62, y: 0.7 },
    leftFoot: { x: 0.28, y: 0.86 },
    rightFoot: { x: 0.68, y: 0.92 },
  }),
};

const POSE_SITTING: Pose = {
  id: 'sitting',
  name: 'Sitter',
  description: 'Figur sittende — kne i 90 grader, lent litt bakover.',
  category: 'rest',
  tags: ['sitting', 'rest', 'dialogue', 'casual'],
  preferredFraming: 'medium',
  limbs: buildFigure({
    head: { cx: 0.5, cy: 0.18, r: 0.05 },
    neck: { x: 0.5, y: 0.25 },
    pelvis: { x: 0.5, y: 0.55 },
    leftShoulder: { x: 0.42, y: 0.27 },
    rightShoulder: { x: 0.58, y: 0.27 },
    leftElbow: { x: 0.38, y: 0.42 },
    rightElbow: { x: 0.62, y: 0.42 },
    leftHand: { x: 0.4, y: 0.58 },
    rightHand: { x: 0.6, y: 0.58 },
    leftHip: { x: 0.45, y: 0.58 },
    rightHip: { x: 0.55, y: 0.58 },
    leftKnee: { x: 0.36, y: 0.7 },
    rightKnee: { x: 0.64, y: 0.7 },
    leftFoot: { x: 0.34, y: 0.92 },
    rightFoot: { x: 0.66, y: 0.92 },
  }),
};

const POSE_CROUCHING: Pose = {
  id: 'crouching',
  name: 'Huker seg ned',
  description: 'Lavt kroppspunkt — spent, klar til handling. Bra for actionscener.',
  category: 'action',
  tags: ['crouching', 'low', 'tense', 'action'],
  preferredFraming: 'medium',
  limbs: buildFigure({
    head: { cx: 0.5, cy: 0.32, r: 0.05 },
    neck: { x: 0.5, y: 0.4 },
    pelvis: { x: 0.5, y: 0.62 },
    leftShoulder: { x: 0.43, y: 0.42 },
    rightShoulder: { x: 0.57, y: 0.42 },
    leftElbow: { x: 0.38, y: 0.55 },
    rightElbow: { x: 0.62, y: 0.55 },
    leftHand: { x: 0.4, y: 0.7 },
    rightHand: { x: 0.6, y: 0.7 },
    leftHip: { x: 0.46, y: 0.64 },
    rightHip: { x: 0.54, y: 0.64 },
    leftKnee: { x: 0.36, y: 0.82 },
    rightKnee: { x: 0.64, y: 0.82 },
    leftFoot: { x: 0.38, y: 0.96 },
    rightFoot: { x: 0.62, y: 0.96 },
  }),
};

const POSE_FIGHTING_STANCE: Pose = {
  id: 'fighting-stance',
  name: 'Kampstilling',
  description: 'Klassisk boxe-stilling — knyttede nevner, lett bøyde knær, åpen kropps-stilling.',
  category: 'action',
  tags: ['fighting', 'boxing', 'martial-arts', 'action'],
  preferredFraming: 'medium',
  limbs: buildFigure({
    head: { cx: 0.5, cy: 0.14, r: 0.05 },
    neck: { x: 0.5, y: 0.22 },
    pelvis: { x: 0.5, y: 0.58 },
    leftShoulder: { x: 0.42, y: 0.24 },
    rightShoulder: { x: 0.58, y: 0.24 },
    leftElbow: { x: 0.36, y: 0.38 },
    rightElbow: { x: 0.62, y: 0.4 },
    leftHand: { x: 0.42, y: 0.5 },
    rightHand: { x: 0.56, y: 0.52 },
    leftHip: { x: 0.45, y: 0.6 },
    rightHip: { x: 0.55, y: 0.6 },
    leftKnee: { x: 0.4, y: 0.76 },
    rightKnee: { x: 0.6, y: 0.78 },
    leftFoot: { x: 0.36, y: 0.94 },
    rightFoot: { x: 0.64, y: 0.94 },
  }),
};

const POSE_POINTING: Pose = {
  id: 'pointing',
  name: 'Peker',
  description: 'Karakter peker mot noe — bra for reveal/direction-shots.',
  category: 'gesture',
  tags: ['pointing', 'gesture', 'direction', 'reveal'],
  preferredFraming: 'medium',
  limbs: buildFigure({
    head: { cx: 0.5, cy: 0.13, r: 0.05 },
    neck: { x: 0.5, y: 0.2 },
    pelvis: { x: 0.5, y: 0.55 },
    leftShoulder: { x: 0.42, y: 0.22 },
    rightShoulder: { x: 0.58, y: 0.22 },
    leftElbow: { x: 0.4, y: 0.36 },
    rightElbow: { x: 0.7, y: 0.26 },
    leftHand: { x: 0.42, y: 0.52 },
    rightHand: { x: 0.88, y: 0.22 },
    leftHip: { x: 0.45, y: 0.58 },
    rightHip: { x: 0.55, y: 0.58 },
    leftKnee: { x: 0.44, y: 0.76 },
    rightKnee: { x: 0.56, y: 0.76 },
    leftFoot: { x: 0.43, y: 0.95 },
    rightFoot: { x: 0.57, y: 0.95 },
  }),
};

const POSE_HUGGING: Pose = {
  id: 'hugging',
  name: 'Klemmer',
  description: 'Arms-utstrakt-fram klem-gest — emosjonell, varm. Funker for to-figur-komposisjon.',
  category: 'gesture',
  tags: ['hugging', 'embrace', 'emotional', 'two-shot'],
  preferredFraming: 'medium',
  limbs: buildFigure({
    head: { cx: 0.5, cy: 0.14, r: 0.05 },
    neck: { x: 0.5, y: 0.21 },
    pelvis: { x: 0.5, y: 0.55 },
    leftShoulder: { x: 0.42, y: 0.23 },
    rightShoulder: { x: 0.58, y: 0.23 },
    leftElbow: { x: 0.34, y: 0.34 },
    rightElbow: { x: 0.66, y: 0.34 },
    leftHand: { x: 0.5, y: 0.4 },
    rightHand: { x: 0.5, y: 0.4 },
    leftHip: { x: 0.45, y: 0.58 },
    rightHip: { x: 0.55, y: 0.58 },
    leftKnee: { x: 0.44, y: 0.76 },
    rightKnee: { x: 0.56, y: 0.76 },
    leftFoot: { x: 0.43, y: 0.95 },
    rightFoot: { x: 0.57, y: 0.95 },
  }),
};

const POSE_JUMPING: Pose = {
  id: 'jumping',
  name: 'Hopper',
  description: 'Midt-i-luften — armer over hode, ben strukket nedover. Energi/jubel.',
  category: 'action',
  tags: ['jumping', 'celebration', 'air', 'action'],
  preferredFraming: 'wide',
  limbs: buildFigure({
    head: { cx: 0.5, cy: 0.13, r: 0.05 },
    neck: { x: 0.5, y: 0.2 },
    pelvis: { x: 0.5, y: 0.55 },
    leftShoulder: { x: 0.42, y: 0.22 },
    rightShoulder: { x: 0.58, y: 0.22 },
    leftElbow: { x: 0.36, y: 0.1 },
    rightElbow: { x: 0.64, y: 0.1 },
    leftHand: { x: 0.32, y: 0.02 },
    rightHand: { x: 0.68, y: 0.02 },
    leftHip: { x: 0.46, y: 0.58 },
    rightHip: { x: 0.54, y: 0.58 },
    leftKnee: { x: 0.42, y: 0.76 },
    rightKnee: { x: 0.58, y: 0.76 },
    leftFoot: { x: 0.4, y: 0.92 },
    rightFoot: { x: 0.6, y: 0.92 },
  }),
};

const POSE_LOOKING_UP: Pose = {
  id: 'looking-up',
  name: 'Ser opp',
  description: 'Hode tilbake, kropp åpen — kontemplativ eller awe-struck.',
  category: 'gesture',
  tags: ['looking-up', 'awe', 'contemplative', 'mood'],
  preferredFraming: 'close-up',
  limbs: buildFigure({
    head: { cx: 0.5, cy: 0.16, r: 0.05 },
    neck: { x: 0.5, y: 0.23 },
    pelvis: { x: 0.5, y: 0.55 },
    leftShoulder: { x: 0.42, y: 0.25 },
    rightShoulder: { x: 0.58, y: 0.25 },
    leftElbow: { x: 0.38, y: 0.4 },
    rightElbow: { x: 0.62, y: 0.4 },
    leftHand: { x: 0.36, y: 0.56 },
    rightHand: { x: 0.64, y: 0.56 },
    leftHip: { x: 0.45, y: 0.58 },
    rightHip: { x: 0.55, y: 0.58 },
    leftKnee: { x: 0.44, y: 0.76 },
    rightKnee: { x: 0.56, y: 0.76 },
    leftFoot: { x: 0.43, y: 0.95 },
    rightFoot: { x: 0.57, y: 0.95 },
  }),
};

const POSE_CARRYING: Pose = {
  id: 'carrying',
  name: 'Bærer noe',
  description: 'Begge armer fremover, kropp lent litt bak for balanse. Bra for prop-scener.',
  category: 'action',
  tags: ['carrying', 'prop', 'effort', 'action'],
  preferredFraming: 'medium',
  limbs: buildFigure({
    head: { cx: 0.5, cy: 0.13, r: 0.05 },
    neck: { x: 0.5, y: 0.2 },
    pelvis: { x: 0.5, y: 0.55 },
    leftShoulder: { x: 0.42, y: 0.22 },
    rightShoulder: { x: 0.58, y: 0.22 },
    leftElbow: { x: 0.36, y: 0.36 },
    rightElbow: { x: 0.64, y: 0.36 },
    leftHand: { x: 0.4, y: 0.46 },
    rightHand: { x: 0.6, y: 0.46 },
    leftHip: { x: 0.45, y: 0.58 },
    rightHip: { x: 0.55, y: 0.58 },
    leftKnee: { x: 0.44, y: 0.76 },
    rightKnee: { x: 0.56, y: 0.76 },
    leftFoot: { x: 0.43, y: 0.95 },
    rightFoot: { x: 0.57, y: 0.95 },
  }),
};

const POSE_FALLEN: Pose = {
  id: 'fallen',
  name: 'Falt',
  description: 'På bakken — bra for impact/defeat-scener.',
  category: 'special',
  tags: ['fallen', 'defeat', 'ground', 'action'],
  preferredFraming: 'wide',
  limbs: buildFigure({
    head: { cx: 0.18, cy: 0.55, r: 0.05 },
    neck: { x: 0.25, y: 0.58 },
    pelvis: { x: 0.55, y: 0.6 },
    leftShoulder: { x: 0.25, y: 0.5 },
    rightShoulder: { x: 0.3, y: 0.65 },
    leftElbow: { x: 0.14, y: 0.4 },
    rightElbow: { x: 0.36, y: 0.78 },
    leftHand: { x: 0.06, y: 0.36 },
    rightHand: { x: 0.42, y: 0.88 },
    leftHip: { x: 0.55, y: 0.55 },
    rightHip: { x: 0.55, y: 0.65 },
    leftKnee: { x: 0.72, y: 0.5 },
    rightKnee: { x: 0.74, y: 0.7 },
    leftFoot: { x: 0.9, y: 0.46 },
    rightFoot: { x: 0.92, y: 0.74 },
  }),
};

export const POSE_LIBRARY: Pose[] = [
  POSE_STANDING_FRONT,
  POSE_WALKING,
  POSE_RUNNING,
  POSE_SITTING,
  POSE_CROUCHING,
  POSE_FIGHTING_STANCE,
  POSE_POINTING,
  POSE_HUGGING,
  POSE_JUMPING,
  POSE_LOOKING_UP,
  POSE_CARRYING,
  POSE_FALLEN,
];

// ============================================================================
// Filter / søk
// ============================================================================

export function getPosesByCategory(category: Pose['category']): Pose[] {
  return POSE_LIBRARY.filter((pose) => pose.category === category);
}

export function searchPoses(query: string): Pose[] {
  const q = query.trim().toLowerCase();
  if (!q) return POSE_LIBRARY;
  return POSE_LIBRARY.filter((pose) => {
    if (pose.name.toLowerCase().includes(q)) return true;
    if (pose.description.toLowerCase().includes(q)) return true;
    return pose.tags.some((tag) => tag.toLowerCase().includes(q));
  });
}

// ============================================================================
// Insertion: konverter pose til PencilStroke[]
// ============================================================================

export interface PoseInsertionOptions {
  /** Target-canvas-bredde i piksler. */
  canvasWidth: number;
  /** Target-canvas-høyde i piksler. */
  canvasHeight: number;
  /** Hvor bredt poseboksen skal være (0..1, default 0.4 = 40 % av canvas). */
  scale?: number;
  /** Sentrum-X for posen (0..1, default 0.5 = sentrum). */
  centerX?: number;
  /** Sentrum-Y for posen (0..1, default 0.5 = sentrum). */
  centerY?: number;
  /** Hvor lys posen skal være — typisk grå-tone så artisten kan tegne over. */
  color?: string;
  /** Speilvend horisontalt — for å snu posen til motsatt side. */
  flipHorizontal?: boolean;
  /** Stroke-id-prefix (gjør at flere innsettinger ikke kolliderer). */
  idPrefix?: string;
}

export interface PoseStroke {
  id: string;
  color: string;
  width: number;
  opacity: number;
  brush?: { type: string };
  points: Array<{ x: number; y: number; pressure: number; t: number }>;
}

/**
 * Konverter en pose til PencilStroke-kompatible objects som kan legges
 * inn på lerretet. Layer-arbeidsflyten i FrameDrawingEditor tar disse
 * direkte og rendrer dem som vanlige strokes.
 */
export function buildStrokesFromPose(
  pose: Pose,
  options: PoseInsertionOptions,
): PoseStroke[] {
  const scale = options.scale ?? 0.4;
  const centerX = options.centerX ?? 0.5;
  const centerY = options.centerY ?? 0.5;
  const color = options.color ?? '#9ca3af'; // nøytral grå
  const flip = options.flipHorizontal === true;
  const idPrefix = options.idPrefix ?? `pose-${pose.id}-${Date.now()}`;
  const t0 = Date.now();

  // Normalisert pose er 1x1 og sentrert om sin egen midt; vi mapper til
  // canvas-koordinater.
  const baseWidth = options.canvasWidth * scale;
  const baseHeight = options.canvasHeight * scale;
  const offsetX = options.canvasWidth * centerX - baseWidth / 2;
  const offsetY = options.canvasHeight * centerY - baseHeight / 2;

  return pose.limbs.map((limb, index) => {
    const points = limb.points.map((p, ptIdx) => {
      const localX = flip ? 1 - p.x : p.x;
      return {
        x: offsetX + localX * baseWidth,
        y: offsetY + p.y * baseHeight,
        pressure: 0.6,
        t: t0 + ptIdx,
      };
    });
    return {
      id: `${idPrefix}-${index}-${limb.name}`,
      color,
      width: 2 * (limb.weight ?? 1),
      opacity: 0.55,
      brush: { type: 'pencil' },
      points,
    };
  });
}
