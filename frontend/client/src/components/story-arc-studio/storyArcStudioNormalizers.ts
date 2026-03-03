import type { StoryArc } from '../../services/storyArcDataIntegration';
import type {
  StoryArcSceneDetectionProgress,
  StoryArcSceneDetectionScene,
} from './sections/StoryArcSceneDetectionDialog';

export interface AIGeneratedTimelineClipInput {
  id?: string;
  name?: string;
  beatName?: string;
  start?: number;
  duration?: number;
  trackId?: string;
  sourceFile?: string;
  metadata?: Record<string, unknown>;
}

export interface AIGeneratedStoryArcInput {
  title?: string;
  musicSuggestions?: StoryArc['musicSuggestions'];
  transitionPoints?: StoryArc['transitionEffects'];
}

export interface AIGeneratedTimelineInput {
  clips?: AIGeneratedTimelineClipInput[];
  totalDuration?: number;
}

export interface AIGeneratedPayload {
  storyArc?: AIGeneratedStoryArcInput;
  timeline?: AIGeneratedTimelineInput;
  scenes?: unknown[];
}

export function toErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return fallback;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function toSceneNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

export function normalizeSceneDetectionScene(
  value: unknown
): StoryArcSceneDetectionScene | null {
  if (!isRecord(value)) {
    return null;
  }

  const sceneNumber = toSceneNumber(value.scene_number);
  const startTime = toSceneNumber(value.start_time);
  const endTime = toSceneNumber(value.end_time);
  const duration = toSceneNumber(value.duration);
  if (
    sceneNumber === null ||
    startTime === null ||
    endTime === null ||
    duration === null
  ) {
    return null;
  }

  return {
    scene_number: sceneNumber,
    start_time: startTime,
    end_time: endTime,
    duration,
  };
}

export function normalizeSceneDetectionScenes(
  value: unknown
): StoryArcSceneDetectionScene[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((scene) => normalizeSceneDetectionScene(scene))
    .filter((scene): scene is StoryArcSceneDetectionScene => scene !== null);
}

export function extractSceneDetectionScenesFromPayload(
  payload: unknown
): StoryArcSceneDetectionScene[] {
  if (!isRecord(payload)) {
    return [];
  }

  const directScenes = normalizeSceneDetectionScenes(payload.scenes);
  if (directScenes.length > 0) {
    return directScenes;
  }

  if (isRecord(payload.result)) {
    const nestedScenes = normalizeSceneDetectionScenes(payload.result.scenes);
    if (nestedScenes.length > 0) {
      return nestedScenes;
    }

    if (isRecord(payload.result.result)) {
      return normalizeSceneDetectionScenes(payload.result.result.scenes);
    }
  }

  return [];
}

export function normalizeSceneDetectionProgress(
  payload: unknown
): StoryArcSceneDetectionProgress {
  const scenes = extractSceneDetectionScenesFromPayload(payload);
  if (!isRecord(payload)) {
    return {
      status: 'processing',
      progress: 0,
      scenes,
    };
  }

  return {
    status: typeof payload.status === 'string' ? payload.status : 'processing',
    progress: typeof payload.progress === 'number' ? payload.progress : 0,
    message: typeof payload.message === 'string' ? payload.message : undefined,
    error: typeof payload.error === 'string' ? payload.error : undefined,
    scenes,
  };
}

export function normalizeAIGeneratedPayload(payload: unknown): AIGeneratedPayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const storyArc = isRecord(payload.storyArc)
    ? ({
        title: typeof payload.storyArc.title === 'string' ? payload.storyArc.title : undefined,
        musicSuggestions: Array.isArray(payload.storyArc.musicSuggestions)
          ? (payload.storyArc.musicSuggestions as StoryArc['musicSuggestions'])
          : undefined,
        transitionPoints: Array.isArray(payload.storyArc.transitionPoints)
          ? (payload.storyArc.transitionPoints as StoryArc['transitionEffects'])
          : undefined,
      } satisfies AIGeneratedStoryArcInput)
    : undefined;

  const timeline = isRecord(payload.timeline)
    ? ({
        clips: Array.isArray(payload.timeline.clips)
          ? (payload.timeline.clips as AIGeneratedTimelineClipInput[])
          : undefined,
        totalDuration:
          typeof payload.timeline.totalDuration === 'number'
            ? payload.timeline.totalDuration
            : undefined,
      } satisfies AIGeneratedTimelineInput)
    : undefined;

  const scenes = Array.isArray(payload.scenes) ? payload.scenes : undefined;

  return {
    storyArc,
    timeline,
    scenes,
  };
}
