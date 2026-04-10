export interface StoryArcNavigationFocus {
  sceneId?: string;
  shotId?: string;
}

const STORY_ARC_ARTIFACT_PREFIX = 'story-arc:';

const normalizeText = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const normalizeStoryArcNavigationFocus = (
  focus?: StoryArcNavigationFocus | null,
): StoryArcNavigationFocus | null => {
  if (!focus || typeof focus !== 'object') {
    return null;
  }
  const sceneId = normalizeText(focus.sceneId);
  const shotId = normalizeText(focus.shotId);
  if (!sceneId && !shotId) {
    return null;
  }
  return {
    sceneId,
    shotId,
  };
};

export const buildStoryArcArtifactId = (
  focus?: StoryArcNavigationFocus | null,
): string | undefined => {
  const normalized = normalizeStoryArcNavigationFocus(focus);
  if (!normalized) {
    return undefined;
  }
  const params = new URLSearchParams();
  if (normalized.sceneId) {
    params.set('sceneId', normalized.sceneId);
  }
  if (normalized.shotId) {
    params.set('shotId', normalized.shotId);
  }
  const query = params.toString();
  return query ? `${STORY_ARC_ARTIFACT_PREFIX}${query}` : undefined;
};

export const parseStoryArcArtifactId = (
  artifactId?: string | null,
): StoryArcNavigationFocus | null => {
  const normalizedArtifactId = normalizeText(artifactId);
  if (!normalizedArtifactId || !normalizedArtifactId.startsWith(STORY_ARC_ARTIFACT_PREFIX)) {
    return null;
  }
  const rawQuery = normalizedArtifactId.slice(STORY_ARC_ARTIFACT_PREFIX.length);
  if (!rawQuery) {
    return null;
  }
  try {
    const params = new URLSearchParams(rawQuery);
    return normalizeStoryArcNavigationFocus({
      sceneId: params.get('sceneId') ?? undefined,
      shotId: params.get('shotId') ?? undefined,
    });
  } catch {
    return null;
  }
};
