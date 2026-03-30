import type {
  CameraAngle,
  CastingProject,
  CameraMovement,
  CastingShot,
  SceneBreakdown,
  ShotList,
  ShotType,
  StoryboardFrame,
} from '../models/casting';
import { castingService } from './castingService';

export type StoryboardLibrarySourceType = 'scene-frame' | 'library-item';

export interface StoryboardSeedCandidate {
  id: string;
  sourceType: StoryboardLibrarySourceType;
  sceneId: string;
  frameId: string;
  libraryItemId?: string;
  shotNumber: string;
  title: string;
  description: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  shotType?: ShotType;
  cameraAngle?: string;
  movement?: string;
  duration?: number;
  detailLevel?: string;
  sourceLabel: string;
}

export interface StoryboardLibraryItemSummary {
  id: string;
  sourceSceneId?: string;
  sourceSceneNumber?: string | number;
  sourceSceneHeading?: string;
  authorName?: string;
  folderId?: string;
  tags: string[];
  frame: {
    id: string;
    shotNumber: string;
    description: string;
    imageUrl?: string;
    thumbnailUrl?: string;
    shotType?: ShotType;
    cameraAngle?: string;
    movement?: string;
    duration?: number;
    detailLevel?: string;
  };
}

export interface StoryboardLibraryFolderSummary {
  id: string;
  name: string;
  createdAt?: string;
  createdByName?: string;
}

export interface StoryboardLibrarySummaryPayload {
  items: StoryboardLibraryItemSummary[];
  folders: StoryboardLibraryFolderSummary[];
}

export interface StoryboardLibraryProjectPayload {
  items: unknown[];
  folders: unknown[];
}

export interface StoryboardLibraryScopeStore {
  [scopeKey: string]: StoryboardLibraryProjectPayload;
}

const STORYBOARD_LIBRARY_STORAGE_PREFIX = 'role-room:storyboard-library';
const STORYBOARD_LIBRARY_PROJECT_FIELD = 'storyboardLibraryByScope';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];

const dispatchStoryboardLibraryUpdated = (scopeKey: string): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('role-room:storyboard-library-updated', {
      detail: {
        scopeKey,
        storageKey: buildStoryboardLibraryStorageKey(scopeKey),
      },
    }),
  );
};

export const buildStoryboardLibraryStorageKey = (scopeKey: string): string =>
  `${STORYBOARD_LIBRARY_STORAGE_PREFIX}:${scopeKey || 'global'}`;

const parseStoryboardLibraryItem = (value: unknown): StoryboardLibraryItemSummary | null => {
  if (!isObject(value) || !isObject(value.frame)) return null;

  const frame = value.frame;
  const frameId = asString(frame.id);
  const shotNumber = asString(frame.shotNumber) || '1A';

  if (!frameId) {
    return null;
  }

  return {
    id: asString(value.id) || `storyboard-library-item-${frameId}`,
    sourceSceneId: asString(value.sourceSceneId),
    sourceSceneNumber:
      typeof value.sourceSceneNumber === 'string' || typeof value.sourceSceneNumber === 'number'
        ? value.sourceSceneNumber
        : undefined,
    sourceSceneHeading: asString(value.sourceSceneHeading),
    authorName: asString(value.authorName),
    folderId: asString(value.folderId),
    tags: asStringArray(value.tags),
    frame: {
      id: frameId,
      shotNumber,
      description: asString(frame.description) || 'Storyboard frame',
      imageUrl: asString(frame.imageUrl),
      thumbnailUrl: asString(frame.thumbnailUrl),
      shotType: asString(frame.shotType) as ShotType | undefined,
      cameraAngle: asString(frame.cameraAngle),
      movement: asString(frame.movement),
      duration: typeof frame.duration === 'number' && Number.isFinite(frame.duration) ? frame.duration : undefined,
      detailLevel: asString(frame.detailLevel),
    },
  };
};

const parseStoryboardLibraryFolder = (value: unknown): StoryboardLibraryFolderSummary | null => {
  if (!isObject(value)) return null;
  const id = asString(value.id);
  const name = asString(value.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    createdAt: asString(value.createdAt),
    createdByName: asString(value.createdByName),
  };
};

const parseStoryboardLibraryPayload = (value: unknown): StoryboardLibrarySummaryPayload => {
  const itemsRaw =
    Array.isArray(value)
      ? value
      : isObject(value) && Array.isArray(value.items)
        ? value.items
        : [];
  const foldersRaw =
    isObject(value) && Array.isArray(value.folders)
      ? value.folders
      : [];

  const items = itemsRaw
    .map((entry) => parseStoryboardLibraryItem(entry))
    .filter((entry): entry is StoryboardLibraryItemSummary => Boolean(entry));
  const folders = foldersRaw
    .map((entry) => parseStoryboardLibraryFolder(entry))
    .filter((entry): entry is StoryboardLibraryFolderSummary => Boolean(entry));

  return { items, folders };
};

const loadRawStoryboardLibraryPayloadForScope = (
  scopeKey: string,
): StoryboardLibraryProjectPayload | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(buildStoryboardLibraryStorageKey(scopeKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return { items: parsed, folders: [] };
    }
    if (!isObject(parsed)) {
      return null;
    }

    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    };
  } catch {
    return null;
  }
};

const readStoryboardLibraryScopeStore = (
  project: CastingProject | null | undefined,
): StoryboardLibraryScopeStore => {
  const raw = project?.[STORYBOARD_LIBRARY_PROJECT_FIELD];
  if (!isObject(raw)) return {};

  return Object.entries(raw).reduce<StoryboardLibraryScopeStore>((acc, [scopeKey, payload]) => {
    if (!isObject(payload)) return acc;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const folders = Array.isArray(payload.folders) ? payload.folders : [];
    acc[scopeKey] = { items, folders };
    return acc;
  }, {});
};

export const getStoryboardLibraryProjectPayload = (
  project: CastingProject | null | undefined,
  scopeKey: string,
): StoryboardLibraryProjectPayload | null => {
  const store = readStoryboardLibraryScopeStore(project);
  return store[scopeKey] || null;
};

export const loadStoryboardLibraryPayloadForScope = (scopeKey: string): StoryboardLibrarySummaryPayload => {
  if (typeof window === 'undefined') return { items: [], folders: [] };

  try {
    const raw = window.localStorage.getItem(buildStoryboardLibraryStorageKey(scopeKey));
    if (!raw) return { items: [], folders: [] };
    return parseStoryboardLibraryPayload(JSON.parse(raw));
  } catch {
    return { items: [], folders: [] };
  }
};

export const loadStoryboardLibraryItemsForScope = (scopeKey: string): StoryboardLibraryItemSummary[] => {
  return loadStoryboardLibraryPayloadForScope(scopeKey).items;
};

export const loadStoryboardLibraryPayloadForProject = async (
  projectId: string | undefined,
  scopeKey: string,
): Promise<StoryboardLibrarySummaryPayload> => {
  const fallbackPayload = loadStoryboardLibraryPayloadForScope(scopeKey);
  const rawFallbackPayload = loadRawStoryboardLibraryPayloadForScope(scopeKey);
  if (!projectId) {
    return fallbackPayload;
  }

  try {
    const project = await castingService.getProject(projectId);
    const projectPayload = getStoryboardLibraryProjectPayload(project, scopeKey);
    if (projectPayload) {
      return parseStoryboardLibraryPayload(projectPayload);
    }

    if (rawFallbackPayload && (rawFallbackPayload.items.length > 0 || rawFallbackPayload.folders.length > 0)) {
      await saveStoryboardLibraryPayloadForProject(projectId, scopeKey, rawFallbackPayload);
    }
  } catch (error) {
    console.warn('Failed to load storyboard library from project, using local fallback.', error);
  }

  return fallbackPayload;
};

export const loadRawStoryboardLibraryPayloadForProject = async (
  projectId: string | undefined,
  scopeKey: string,
): Promise<StoryboardLibraryProjectPayload | null> => {
  if (!projectId) return null;

  try {
    const project = await castingService.getProject(projectId);
    return getStoryboardLibraryProjectPayload(project, scopeKey);
  } catch (error) {
    console.warn('Failed to load raw storyboard library payload from project.', error);
    return null;
  }
};

export const loadStoryboardLibraryItemsForProject = async (
  projectId: string | undefined,
  scopeKey: string,
): Promise<StoryboardLibraryItemSummary[]> => {
  const payload = await loadStoryboardLibraryPayloadForProject(projectId, scopeKey);
  return payload.items;
};

export const saveStoryboardLibraryPayloadForProject = async (
  projectId: string | undefined,
  scopeKey: string,
  payload: StoryboardLibraryProjectPayload,
): Promise<void> => {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        buildStoryboardLibraryStorageKey(scopeKey),
        JSON.stringify(payload),
      );
    } catch {
      // keep going; project persistence is still the primary path
    }
  }

  if (projectId) {
    try {
      const project = await castingService.getProject(projectId);
      if (project) {
        const currentStore = readStoryboardLibraryScopeStore(project);
        const nextProject: CastingProject = {
          ...project,
          [STORYBOARD_LIBRARY_PROJECT_FIELD]: {
            ...currentStore,
            [scopeKey]: payload,
          },
        };
        await castingService.saveProject(nextProject);
      }
    } catch (error) {
      console.warn('Failed to persist storyboard library into project, local fallback retained.', error);
    }
  }

  dispatchStoryboardLibraryUpdated(scopeKey);
};

const buildSceneFrameCandidate = (
  scene: SceneBreakdown,
  frame: Record<string, unknown>,
): StoryboardSeedCandidate | null => {
  const frameId = asString(frame.id);
  if (!frameId) return null;

  const shotNumber = asString(frame.shotNumber) || 'Shot';
  const description = asString(frame.description) || 'Storyboard frame';
  const title = `${shotNumber} · ${description}`;

  return {
    id: `scene-frame:${frameId}`,
    sourceType: 'scene-frame',
    sceneId: scene.id,
    frameId,
    shotNumber,
    title,
    description,
    imageUrl: asString(frame.imageUrl),
    thumbnailUrl: asString(frame.thumbnailUrl),
    shotType: asString(frame.shotType) as ShotType | undefined,
    cameraAngle: asString(frame.cameraAngle),
    movement: asString(frame.movement),
    duration: typeof frame.duration === 'number' && Number.isFinite(frame.duration) ? frame.duration : undefined,
    detailLevel: asString(frame.detailLevel),
    sourceLabel: 'Scene storyboard',
  };
};

export const buildSceneStoryboardCandidates = (
  scene: SceneBreakdown,
  libraryItems: StoryboardLibraryItemSummary[],
): StoryboardSeedCandidate[] => {
  const sceneFrames = Array.isArray(scene.storyboardFrames) ? scene.storyboardFrames : [];

  const directCandidates = sceneFrames
    .map((frame) => (isObject(frame) ? buildSceneFrameCandidate(scene, frame) : null))
    .filter((entry): entry is StoryboardSeedCandidate => Boolean(entry));

  const libraryCandidates = libraryItems
    .filter((item) => item.sourceSceneId === scene.id)
    .map<StoryboardSeedCandidate>((item) => ({
      id: `library-item:${item.id}`,
      sourceType: 'library-item',
      sceneId: scene.id,
      frameId: item.frame.id,
      libraryItemId: item.id,
      shotNumber: item.frame.shotNumber,
      title: `${item.frame.shotNumber} · ${item.frame.description}`,
      description: item.frame.description,
      imageUrl: item.frame.imageUrl,
      thumbnailUrl: item.frame.thumbnailUrl,
      shotType: item.frame.shotType,
      cameraAngle: item.frame.cameraAngle,
      movement: item.frame.movement,
      duration: item.frame.duration,
      detailLevel: item.frame.detailLevel,
      sourceLabel: item.folderId ? 'Storyboard library · mapped' : 'Storyboard library',
    }));

  const seen = new Set<string>();
  return [...directCandidates, ...libraryCandidates].filter((candidate) => {
    const key = `${candidate.sourceType}:${candidate.libraryItemId || candidate.frameId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const CAMERA_ANGLES: CameraAngle[] = [
  'Eye Level',
  'High Angle',
  'Low Angle',
  'Birds Eye',
  'Worms Eye',
  'Dutch Angle',
  'Overhead',
];

const CAMERA_MOVEMENTS: CameraMovement[] = [
  'Static',
  'Pan',
  'Tilt',
  'Dolly',
  'Truck',
  'Crane',
  'Handheld',
  'Steadicam',
  'Zoom',
  'Orbit',
];

const SHOT_TYPES: ShotType[] = [
  'Wide',
  'Medium',
  'Close-up',
  'Extreme Close-up',
  'Establishing',
  'Detail',
  'Two Shot',
  'Over Shoulder',
  'Point of View',
];

const normalizeShotType = (value: string | undefined, fallback: ShotType): ShotType => {
  if (!value) return fallback;
  const match = SHOT_TYPES.find((entry) => entry.toLowerCase() === value.toLowerCase());
  return match || fallback;
};

const normalizeCameraAngle = (value: string | undefined, fallback: CameraAngle): CameraAngle => {
  if (!value) return fallback;
  const match = CAMERA_ANGLES.find((entry) => entry.toLowerCase() === value.toLowerCase());
  return match || fallback;
};

const normalizeCameraMovement = (
  value: string | undefined,
  fallback: CameraMovement,
): CameraMovement => {
  if (!value) return fallback;
  const match = CAMERA_MOVEMENTS.find((entry) => entry.toLowerCase() === value.toLowerCase());
  return match || fallback;
};

const formatStoryboardShotNumber = (frameCount: number): string => `${frameCount + 1}A`;

export interface ResolvedStoryboardShotLink {
  status: 'linked' | 'missing' | 'unlinked';
  sceneId: string;
  candidate?: StoryboardSeedCandidate;
  frameIndex?: number;
  previewUrl?: string;
  label?: string;
}

export const resolveStoryboardShotLink = (
  shot: CastingShot,
  scene: SceneBreakdown | null | undefined,
  libraryItems: StoryboardLibraryItemSummary[],
): ResolvedStoryboardShotLink => {
  const sceneId = scene?.id || shot.storyboardLinkedSceneId || shot.sceneId || '';
  if (!scene || !sceneId) {
    return { status: 'unlinked', sceneId };
  }

  if (!shot.storyboardFrameId && !shot.storyboardLibraryItemId) {
    return { status: 'unlinked', sceneId };
  }

  const candidates = buildSceneStoryboardCandidates(scene, libraryItems);
  const candidate = candidates.find((entry) => {
    if (shot.storyboardLibraryItemId && entry.libraryItemId === shot.storyboardLibraryItemId) {
      return true;
    }
    if (shot.storyboardFrameId && entry.frameId === shot.storyboardFrameId) {
      return true;
    }
    return false;
  });

  if (!candidate) {
    return {
      status: 'missing',
      sceneId,
      previewUrl: shot.imageUrl,
      label: shot.storyboardFrameId || shot.storyboardLibraryItemId || 'Storyboard link',
    };
  }

  const sceneFrames = Array.isArray(scene.storyboardFrames) ? scene.storyboardFrames : [];
  const frameIndex = sceneFrames.findIndex((frame) => frame.id === candidate.frameId);

  return {
    status: 'linked',
    sceneId,
    candidate,
    frameIndex: frameIndex >= 0 ? frameIndex : undefined,
    previewUrl: candidate.thumbnailUrl || candidate.imageUrl || shot.imageUrl,
    label: `${candidate.sourceLabel} · ${candidate.shotNumber}`,
  };
};

export const applyStoryboardCandidateToShot = (
  shot: CastingShot,
  candidate: StoryboardSeedCandidate,
  sceneId: string,
): CastingShot => ({
  ...shot,
  shotType: normalizeShotType(candidate.shotType, shot.shotType || 'Medium'),
  description: candidate.description || shot.description,
  cameraAngle: normalizeCameraAngle(candidate.cameraAngle, shot.cameraAngle || 'Eye Level'),
  cameraMovement: normalizeCameraMovement(candidate.movement, shot.cameraMovement || 'Static'),
  duration:
    typeof candidate.duration === 'number' && Number.isFinite(candidate.duration)
      ? Math.max(1, Math.round(candidate.duration))
      : shot.duration,
  imageUrl: candidate.thumbnailUrl || candidate.imageUrl || shot.imageUrl,
  notes: candidate ? `${candidate.sourceLabel} · ${candidate.shotNumber}` : shot.notes,
  storyboardFrameId: candidate.frameId,
  storyboardLibraryItemId: candidate.libraryItemId,
  storyboardLinkedSceneId: sceneId,
  storyboardSourceType: candidate.sourceType,
  updatedAt: new Date().toISOString(),
});

export const clearStoryboardLinkFromShot = (shot: CastingShot): CastingShot => ({
  ...shot,
  storyboardFrameId: undefined,
  storyboardLibraryItemId: undefined,
  storyboardLinkedSceneId: undefined,
  storyboardSourceType: undefined,
  updatedAt: new Date().toISOString(),
});

export const createSceneStoryboardFrameFromShot = (
  shot: CastingShot,
  scene: SceneBreakdown,
): StoryboardFrame => {
  const sceneFrames = Array.isArray(scene.storyboardFrames) ? scene.storyboardFrames : [];
  const now = new Date().toISOString();
  const frameId = `scene-frame-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  const shotNumber = formatStoryboardShotNumber(sceneFrames.length);

  return {
    id: frameId,
    shotNumber,
    title: shot.description || shot.shotType || `Shot ${sceneFrames.length + 1}`,
    description: shot.description || shot.notes || 'Storyboard frame fra shot',
    imageUrl: shot.imageUrl,
    thumbnailUrl: shot.imageUrl,
    shotType: shot.shotType,
    cameraAngle: shot.cameraAngle,
    cameraMovement: shot.cameraMovement,
    duration:
      typeof shot.duration === 'number' && Number.isFinite(shot.duration)
        ? Math.max(1, Math.round(shot.duration))
        : 5,
    createdAt: now,
    updatedAt: now,
    linkedShotId: shot.id,
  };
};

export const syncShotListWithSceneStoryboard = (
  shotList: ShotList,
  scene: SceneBreakdown,
  libraryItems: StoryboardLibraryItemSummary[],
): { shotList: ShotList; changed: boolean; syncedCount: number } => {
  let changed = false;
  let syncedCount = 0;

  const nextShots = shotList.shots.map((shot) => {
    const resolved = resolveStoryboardShotLink(shot, scene, libraryItems);
    if (resolved.status !== 'linked' || !resolved.candidate) {
      return shot;
    }
    const patched = applyStoryboardCandidateToShot(shot, resolved.candidate, scene.id);
    const shotChanged = JSON.stringify(patched) !== JSON.stringify(shot);
    if (shotChanged) {
      changed = true;
      syncedCount += 1;
      return patched;
    }
    return shot;
  });

  if (!changed) {
    return { shotList, changed: false, syncedCount: 0 };
  }

  return {
    shotList: {
      ...shotList,
      shots: nextShots,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
    syncedCount,
  };
};
