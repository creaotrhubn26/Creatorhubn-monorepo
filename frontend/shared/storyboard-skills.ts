/**
 * Canonical Storyboard Room skill contract shared by web and backend.
 *
 * Skills are proposal-only. They may describe frame mutations, but the user
 * must accept a persisted suggestion before a client applies those changes.
 */

export const STORYBOARD_SKILL_IDS = [
  'plan_scene_coverage',
  'audit_visual_continuity',
  'design_shot_variants',
  'translate_artist_marks',
  'audit_board_readability',
  'build_animatic_pass',
  'audit_production_feasibility',
] as const;

export type StoryboardSkillId = (typeof STORYBOARD_SKILL_IDS)[number];

export type StoryboardSkillScope = 'scene' | 'frame';
export type StoryboardSkillOperation = 'create-frame' | 'update-frame';
export type StoryboardSkillSeverity = 'info' | 'warning' | 'blocking';

export interface StoryboardSkillDefinition {
  id: StoryboardSkillId;
  version: string;
  title: string;
  shortTitle: string;
  description: string;
  scope: StoryboardSkillScope;
  icon: string;
  dependsOn: string[];
  outputCapabilities: Array<'analysis' | 'frame-patch' | 'frame-create' | 'alternatives'>;
  evaluationCriteria: string[];
  provider: 'local';
  estimatedCostUsd: 0;
}

export interface StoryboardSkillDialogueLine {
  lineNumber?: number;
  characterName?: string;
  text: string;
}

export interface StoryboardSkillProductionMark {
  strokeId: string;
  kind: string;
  direction?: {
    dx: number;
    dy: number;
    angleDegrees: number;
  } | null;
  stamp?: {
    variantName?: string;
    depth?: 'foreground' | 'midground' | 'background';
    continuityId?: string | null;
    parameters?: Record<string, string>;
  } | null;
}

export interface StoryboardSkillFramePatch {
  description?: string;
  notes?: string;
  shotType?: string;
  cameraAngle?: string;
  movement?: string;
  lensMm?: number;
  duration?: number;
  transition?: string;
  focusDepth?: string;
  location?: string;
  timeOfDay?: string;
  weather?: string;
  screenDirection?: 'left-to-right' | 'right-to-left' | 'static';
  beatTag?: string;
  continuityNotes?: string;
  productionNotes?: string;
  vfxNotes?: string;
  tags?: string[];
}

export interface StoryboardSkillFrame {
  id: string;
  shotNumber: string;
  description: string;
  notes?: string;
  shotType?: string;
  cameraAngle?: string;
  movement?: string;
  lensMm?: number;
  duration?: number;
  transition?: string;
  focusDepth?: string;
  location?: string;
  timeOfDay?: string;
  weather?: string;
  screenDirection?: 'left-to-right' | 'right-to-left' | 'static';
  beatTag?: string;
  continuityNotes?: string;
  productionNotes?: string;
  vfxNotes?: string;
  tags?: string[];
  imageUrl?: string;
  scriptLineRange?: [number, number];
  productionMarks?: StoryboardSkillProductionMark[];
}

export interface StoryboardSkillContext {
  project: {
    id: string;
    title?: string;
    cinemaFormat?: string;
  };
  scene: {
    id: string;
    heading: string;
    action?: string;
    intExt?: string;
    location?: string;
    timeOfDay?: string;
    characters?: string[];
    dialogue?: StoryboardSkillDialogueLine[];
  };
  frames: StoryboardSkillFrame[];
  activeFrameId?: string;
  userIntent?: string;
}

export interface StoryboardSkillEvidence {
  id: string;
  label: string;
  detail: string;
  frameIds?: string[];
  scriptLineRange?: [number, number];
}

export interface StoryboardSkillChange {
  id: string;
  operation: StoryboardSkillOperation;
  frameId?: string;
  afterFrameId?: string;
  label: string;
  reason: string;
  patch: StoryboardSkillFramePatch;
}

export interface StoryboardSkillAlternative {
  id: string;
  title: string;
  tradeoff: string;
  changes: StoryboardSkillChange[];
}

export interface StoryboardSkillResult {
  contractVersion: 'storyboard-skill-result-v1';
  skillId: StoryboardSkillId;
  skillVersion: string;
  title: string;
  summary: string;
  rationale: string;
  confidence: number;
  severity: StoryboardSkillSeverity;
  contextFingerprint: string;
  evidence: StoryboardSkillEvidence[];
  recommendedChanges: StoryboardSkillChange[];
  alternatives: StoryboardSkillAlternative[];
  warnings: string[];
  cost: {
    provider: 'local';
    estimatedUsd: 0;
  };
}

export interface StoryboardSkillSuggestion {
  id: string;
  projectId: string;
  suggestionType: 'storyboard.skill-result';
  payload: StoryboardSkillResult;
  sourceType: 'scene' | 'project';
  sourceId: string;
  agentName: string;
  modelVersion: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected' | 'superseded' | 'applied';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export const STORYBOARD_SKILL_DEFINITIONS: readonly StoryboardSkillDefinition[] = [
  {
    id: 'plan_scene_coverage',
    version: '1.0.0',
    title: 'Planlegg scenedekning',
    shortTitle: 'Coverage',
    description: 'Finner manglende beats og foreslår shots som kan klippes sammen.',
    scope: 'scene',
    icon: 'coverage',
    dependsOn: ['scene.action', 'scene.dialogue', 'frames'],
    outputCapabilities: ['analysis', 'frame-create'],
    evaluationCriteria: ['beat-traceability', 'shot-variety', 'no-duplicate-coverage'],
    provider: 'local',
    estimatedCostUsd: 0,
  },
  {
    id: 'audit_visual_continuity',
    version: '1.0.0',
    title: 'Kontroller visuell kontinuitet',
    shortTitle: 'Kontinuitet',
    description: 'Kontrollerer skjermretning, geografi og produksjonsdetaljer mellom shots.',
    scope: 'scene',
    icon: 'continuity',
    dependsOn: ['frames', 'scene.location', 'scene.timeOfDay'],
    outputCapabilities: ['analysis', 'frame-patch'],
    evaluationCriteria: ['adjacent-shot-evidence', '180-degree-safety', 'production-consistency'],
    provider: 'local',
    estimatedCostUsd: 0,
  },
  {
    id: 'design_shot_variants',
    version: '1.0.0',
    title: 'Design shotalternativer',
    shortTitle: 'Varianter',
    description: 'Lager tre tydelige alternativer for størrelse, linse, vinkel og bevegelse.',
    scope: 'frame',
    icon: 'variants',
    dependsOn: ['activeFrame', 'scene.action'],
    outputCapabilities: ['analysis', 'frame-patch', 'alternatives'],
    evaluationCriteria: ['distinct-options', 'camera-coherence', 'explicit-tradeoffs'],
    provider: 'local',
    estimatedCostUsd: 0,
  },
  {
    id: 'translate_artist_marks',
    version: '1.0.0',
    title: 'Tolk artistmerker',
    shortTitle: 'Artistmerker',
    description: 'Oversetter Pencil-merker og produksjonsstempler til redigerbare shotnotater.',
    scope: 'frame',
    icon: 'marks',
    dependsOn: ['activeFrame.productionMarks'],
    outputCapabilities: ['analysis', 'frame-patch'],
    evaluationCriteria: ['typed-mark-only', 'geometry-preservation', 'no-freeform-injection'],
    provider: 'local',
    estimatedCostUsd: 0,
  },
  {
    id: 'audit_board_readability',
    version: '1.0.0',
    title: 'Vurder board-lesbarhet',
    shortTitle: 'Lesbarhet',
    description: 'Vurderer silhuett, fokus, dybde, geografi og trygg komposisjon.',
    scope: 'scene',
    icon: 'readability',
    dependsOn: ['frames', 'frame.assists'],
    outputCapabilities: ['analysis', 'frame-patch'],
    evaluationCriteria: ['clear-subject', 'depth-cues', 'sequence-legibility'],
    provider: 'local',
    estimatedCostUsd: 0,
  },
  {
    id: 'build_animatic_pass',
    version: '1.0.0',
    title: 'Bygg animatic-pass',
    shortTitle: 'Animatic',
    description: 'Foreslår shotvarighet og overganger fra dialog, action og beat.',
    scope: 'scene',
    icon: 'animatic',
    dependsOn: ['frames', 'scene.dialogue'],
    outputCapabilities: ['analysis', 'frame-patch'],
    evaluationCriteria: ['dialogue-readability', 'beat-emphasis', 'duration-bounds'],
    provider: 'local',
    estimatedCostUsd: 0,
  },
  {
    id: 'audit_production_feasibility',
    version: '1.0.0',
    title: 'Sjekk produksjonsgjennomføring',
    shortTitle: 'Gjennomføring',
    description: 'Flagger krevende VFX-, rigg-, stunt-, vær- og locationvalg med alternativer.',
    scope: 'scene',
    icon: 'feasibility',
    dependsOn: ['scene.action', 'frames.productionNotes', 'frames.vfxNotes'],
    outputCapabilities: ['analysis', 'frame-patch'],
    evaluationCriteria: ['evidence-not-assumption', 'actionable-alternative', 'safety-first'],
    provider: 'local',
    estimatedCostUsd: 0,
  },
] as const;

export function isStoryboardSkillId(value: unknown): value is StoryboardSkillId {
  return typeof value === 'string' && (STORYBOARD_SKILL_IDS as readonly string[]).includes(value);
}

export function storyboardSkillDefinition(
  skillId: StoryboardSkillId,
): StoryboardSkillDefinition {
  const definition = STORYBOARD_SKILL_DEFINITIONS.find((entry) => entry.id === skillId);
  if (!definition) throw new Error(`Unknown storyboard skill: ${skillId}`);
  return definition;
}
