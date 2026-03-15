import { useCallback, useEffect, useState } from 'react';
import { castingService } from '../services/castingService';
import type {
  CastingProject,
  CastingShot,
  LiveSetScene,
  SceneBreakdown,
  ShotList,
} from '../models/casting';

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const compactText = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    const parsed = asString(value);
    if (parsed) return parsed;
  }
  return undefined;
};

const parseNumberString = (value: string): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeRoleLabel = (value: unknown): string | undefined => {
  const text = asString(value);
  if (!text) return undefined;
  const normalized = text.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return undefined;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const STORYBOARD_LIBRARY_STORAGE_PREFIX = 'role-room:storyboard-library';

const buildStoryboardLibraryStorageKey = (scopeKey: string): string =>
  `${STORYBOARD_LIBRARY_STORAGE_PREFIX}:${scopeKey || 'global'}`;

const normalizeSceneNumberKey = (value: unknown): string | undefined => {
  const text = asString(value);
  if (!text) return undefined;
  const normalized = text
    .replace(/^scene\s*/i, '')
    .replace(/^sc\.\s*/i, '')
    .replace(/[^\w]+/g, '')
    .toLowerCase();
  return normalized || undefined;
};

const normalizeSceneHeadingKey = (value: unknown): string | undefined => {
  const text = asString(value);
  if (!text) return undefined;
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return normalized || undefined;
};

const extractStoryboardSortKey = (tile: StoryboardTile): [number, string, string] => {
  const combined = `${tile.title || ''} ${tile.description || ''}`;
  const match = combined.match(/(?:shot\s*)?(\d+)\s*([A-Za-z]?)/i);
  if (!match) return [Number.MAX_SAFE_INTEGER, '', combined.toLowerCase()];
  const numeric = Number(match[1]);
  const suffix = (match[2] || '').toUpperCase();
  return [Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER, suffix, combined.toLowerCase()];
};

const sortStoryboardTiles = (tiles: StoryboardTile[]): StoryboardTile[] => {
  return [...tiles].sort((left, right) => {
    const [leftNum, leftSuffix, leftText] = extractStoryboardSortKey(left);
    const [rightNum, rightSuffix, rightText] = extractStoryboardSortKey(right);
    if (leftNum !== rightNum) return leftNum - rightNum;
    if (leftSuffix !== rightSuffix) return leftSuffix.localeCompare(rightSuffix, 'nb-NO');
    return leftText.localeCompare(rightText, 'nb-NO');
  });
};

const parseStoryboardLibraryItems = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  const payload = value as { items?: unknown };
  return Array.isArray(payload.items) ? payload.items : [];
};

const loadStoryboardLibraryItemsForScopes = (scopeKeys: string[]): unknown[] => {
  if (typeof window === 'undefined') return [];

  const items: unknown[] = [];
  scopeKeys.forEach((scopeKey) => {
    const storageKey = buildStoryboardLibraryStorageKey(scopeKey);
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      items.push(...parseStoryboardLibraryItems(parsed));
    } catch {
      // Ignore malformed local payloads to keep context loading resilient.
    }
  });

  return items;
};

const loadStoryboardLibraryTilesByScene = (projectId: string, scenes: LiveSetScene[]): Record<string, StoryboardTile[]> => {
  if (typeof window === 'undefined') return {};

  const scopeKeys = new Set<string>([projectId || 'global', 'global']);
  scenes.forEach((scene) => {
    const projectScope = compactText((scene as { projectId?: unknown }).projectId);
    const manuscriptScope = compactText((scene as { manuscriptId?: unknown }).manuscriptId);
    if (projectScope) scopeKeys.add(projectScope);
    if (manuscriptScope) scopeKeys.add(manuscriptScope);
  });

  const sceneIdSet = new Set(
    scenes
      .map((scene) => compactText(scene.id, scene.sceneId))
      .filter((sceneId): sceneId is string => Boolean(sceneId)),
  );
  const sceneIdByNumber = new Map<string, string>();
  const sceneIdByHeading = new Map<string, string>();
  scenes.forEach((scene) => {
    const sceneId = compactText(scene.id, scene.sceneId);
    if (!sceneId) return;

    const numberKey = normalizeSceneNumberKey((scene as { sceneNumber?: unknown }).sceneNumber);
    if (numberKey && !sceneIdByNumber.has(numberKey)) {
      sceneIdByNumber.set(numberKey, sceneId);
    }

    const headingKey = normalizeSceneHeadingKey(
      compactText(
        (scene as { heading?: unknown }).heading,
        (scene as { sceneName?: unknown }).sceneName,
        (scene as { name?: unknown }).name,
      ),
    );
    if (headingKey && !sceneIdByHeading.has(headingKey)) {
      sceneIdByHeading.set(headingKey, sceneId);
    }
  });
  const byScene: Record<string, StoryboardTile[]> = {};
  const seenByScene = new Set<string>();
  const items = loadStoryboardLibraryItemsForScopes(Array.from(scopeKeys));

  items.forEach((rawItem, itemIndex) => {
    if (!rawItem || typeof rawItem !== 'object') return;
    const item = rawItem as Record<string, unknown>;
    const frame = item.frame;
    if (!frame || typeof frame !== 'object') return;
    const frameRecord = frame as Record<string, unknown>;

    let sourceSceneId = compactText(item.sourceSceneId, frameRecord.sceneId);
    if (!sourceSceneId || !sceneIdSet.has(sourceSceneId)) {
      const numberKey = normalizeSceneNumberKey(item.sourceSceneNumber);
      if (numberKey) {
        sourceSceneId = sceneIdByNumber.get(numberKey) || sourceSceneId;
      }
    }
    if (!sourceSceneId || !sceneIdSet.has(sourceSceneId)) {
      const headingKey = normalizeSceneHeadingKey(item.sourceSceneHeading);
      if (headingKey) {
        sourceSceneId = sceneIdByHeading.get(headingKey) || sourceSceneId;
      }
    }
    if (!sourceSceneId || !sceneIdSet.has(sourceSceneId)) return;

    const imageUrl = compactText(frameRecord.imageUrl, frameRecord.thumbnailUrl, frameRecord.sketch);
    if (!imageUrl) return;

    const tileId = compactText(item.id, frameRecord.id, `${sourceSceneId}-library-${itemIndex + 1}`) || `${sourceSceneId}-library-${itemIndex + 1}`;
    const dedupeKey = `${sourceSceneId}::${tileId}::${imageUrl.toLowerCase()}`;
    if (seenByScene.has(dedupeKey)) return;
    seenByScene.add(dedupeKey);

    const shotLabel = compactText(frameRecord.shotNumber);
    const title = compactText(
      shotLabel ? `Shot ${shotLabel}` : undefined,
      frameRecord.description,
      item.sourceSceneHeading,
      'Storyboard',
    ) || 'Storyboard';

    const description = compactText(
      frameRecord.notes,
      frameRecord.cameraAngle,
      frameRecord.movement,
      frameRecord.description,
      typeof item.authorName === 'string' ? `Av ${item.authorName}` : undefined,
    );

    const existing = byScene[sourceSceneId] ?? [];
    byScene[sourceSceneId] = [
      ...existing,
      {
        id: tileId,
        imageUrl,
        title,
        description,
        source: 'library',
        sourceSceneId,
        sourceSceneNumber: asString(item.sourceSceneNumber),
      },
    ];
  });
  Object.keys(byScene).forEach((sceneId) => {
    byScene[sceneId] = sortStoryboardTiles(byScene[sceneId] ?? []);
  });

  return byScene;
};

const mergeStoryboardTiles = (...sources: Array<StoryboardTile[] | undefined>): StoryboardTile[] => {
  const merged: StoryboardTile[] = [];
  const seenIds = new Set<string>();
  const seenImages = new Set<string>();

  sources.forEach((source) => {
    (source ?? []).forEach((tile) => {
      const id = compactText(tile.id);
      const imageUrl = compactText(tile.imageUrl);
      if (!imageUrl) return;

      const imageKey = imageUrl.toLowerCase();
      if ((id && seenIds.has(id)) || seenImages.has(imageKey)) return;

      const fallbackId = id || `storyboard-${merged.length + 1}`;
      seenIds.add(fallbackId);
      seenImages.add(imageKey);
      merged.push({
        id: fallbackId,
        imageUrl,
        title: compactText(tile.title, `Storyboard ${merged.length + 1}`) || `Storyboard ${merged.length + 1}`,
        description: compactText(tile.description),
      });
    });
  });

  return merged;
};

export interface ShotOption {
  id: string;
  label: string;
  description?: string;
}

export interface StoryboardTile {
  id: string;
  imageUrl: string;
  title: string;
  description?: string;
  source?: 'scene' | 'shot-list' | 'library';
  sourceSceneId?: string;
  sourceSceneNumber?: string;
}

export interface PresenceRosterEntry {
  id: string;
  name: string;
  subtitle?: string;
}

export interface SceneCoordinates {
  lat: number;
  lon: number;
}

export interface LiveSetContextState {
  loading: boolean;
  contextError: string | null;
  sceneOptions: LiveSetScene[];
  shotOptionsByScene: Record<string, ShotOption[]>;
  scriptByScene: Record<string, string>;
  storyboardsByScene: Record<string, StoryboardTile[]>;
  sceneShotListMap: Record<string, string>;
  crewRoster: PresenceRosterEntry[];
  equipmentRoster: PresenceRosterEntry[];
  sceneCoordinatesById: Record<string, SceneCoordinates>;
}

const DEFAULT_CONTEXT_STATE: LiveSetContextState = {
  loading: false,
  contextError: null,
  sceneOptions: [],
  shotOptionsByScene: {},
  scriptByScene: {},
  storyboardsByScene: {},
  sceneShotListMap: {},
  crewRoster: [],
  equipmentRoster: [],
  sceneCoordinatesById: {},
};

export function useLiveSetContext(projectId: string) {
  const [context, setContext] = useState<LiveSetContextState>(DEFAULT_CONTEXT_STATE);

  const loadContext = useCallback(async () => {
    if (!projectId) {
      setContext(DEFAULT_CONTEXT_STATE);
      return;
    }

    setContext((current) => ({ ...current, loading: true, contextError: null }));

    try {
      const [project, shotLists] = await Promise.all([
        castingService.getProject(projectId),
        castingService.getShotLists(projectId),
      ]);

      const sceneMap = new Map<string, LiveSetScene>();
      const scripts: Record<string, string> = {};
      const storyboards: Record<string, StoryboardTile[]> = {};
      const shotOptions: Record<string, ShotOption[]> = {};
      const shotListByScene: Record<string, string> = {};

      const projectData = project as CastingProject | null;
      const sceneBreakdowns = Array.isArray(projectData?.sceneBreakdowns)
        ? (projectData.sceneBreakdowns as SceneBreakdown[])
        : [];

      sceneBreakdowns.forEach((scene, index) => {
        const sceneId = compactText(scene.id, scene.sceneId, `scene-${index + 1}`) || `scene-${index + 1}`;
        const sceneNumber = compactText(scene.sceneNumber, scene.heading, scene.sceneName, `#${index + 1}`) || `#${index + 1}`;
        const entry: LiveSetScene = {
          ...scene,
          id: sceneId,
          sceneNumber,
          location: compactText(scene.locationName, scene.location),
          synopsis: compactText(scene.description, scene.heading),
          intExt: compactText(scene.intExt, scene.int_ext),
          timeOfDay: compactText(scene.timeOfDay, scene.time_of_day),
          pageCount: asNumber(scene.pageLength),
        };
        sceneMap.set(sceneId, entry);
        scripts[sceneId] = compactText(scene.description, scene.heading, scene.sceneName) || '';

        const rawStoryboardFrames = Array.isArray((scene as { storyboardFrames?: unknown }).storyboardFrames)
          ? (((scene as { storyboardFrames?: unknown[] }).storyboardFrames) ?? [])
          : [];

        const sceneStoryboardFrames = rawStoryboardFrames.reduce<StoryboardTile[]>((acc, rawFrame, frameIndex) => {
          if (!rawFrame || typeof rawFrame !== 'object') return acc;
          const frame = rawFrame as Record<string, unknown>;
          const imageUrl = compactText(frame.imageUrl, frame.thumbnailUrl, frame.sketch);
          if (!imageUrl) return acc;

          acc.push({
            id: compactText(frame.id, `${sceneId}-frame-${frameIndex + 1}`) || `${sceneId}-frame-${frameIndex + 1}`,
            imageUrl,
            title:
              compactText(frame.shotNumber, frame.title, frame.description, `Frame ${frameIndex + 1}`)
              || `Frame ${frameIndex + 1}`,
            description: compactText(frame.description, frame.notes, frame.cameraAngle, frame.movement),
            source: 'scene',
            sourceSceneId: sceneId,
            sourceSceneNumber: asString(sceneNumber),
          });
          return acc;
        }, []);

        if (sceneStoryboardFrames.length > 0) {
          storyboards[sceneId] = mergeStoryboardTiles(sceneStoryboardFrames, storyboards[sceneId]);
        }
      });

      const locations = Array.isArray(projectData?.locations) ? projectData.locations : [];
      const locationNameById = new Map<string, string>();
      const locationCoordinatesById = new Map<string, SceneCoordinates>();
      const locationCoordinatesByName = new Map<string, SceneCoordinates>();
      locations.forEach((location) => {
        const id = compactText(location.id);
        const name = compactText(location.name, location.locationName);
        const coordinates = location.coordinates as { lat?: unknown; lng?: unknown } | undefined;
        const lat = asNumber(coordinates?.lat);
        const lon = asNumber(coordinates?.lng);
        if (id && name) locationNameById.set(id, name);
        if (lat != null && lon != null) {
          if (id) locationCoordinatesById.set(id, { lat, lon });
          if (name) locationCoordinatesByName.set(name.toLowerCase(), { lat, lon });
        }
      });

      const lists = Array.isArray(shotLists) ? (shotLists as ShotList[]) : [];
      lists.forEach((list, listIndex) => {
        const sceneId = compactText(list.sceneId, list.scene_id, `scene-${listIndex + 1}`) || `scene-${listIndex + 1}`;
        const listId = compactText(list.id);
        if (listId) shotListByScene[sceneId] = listId;
        if (!sceneMap.has(sceneId)) {
          sceneMap.set(sceneId, {
            id: sceneId,
            sceneId,
            sceneNumber: compactText(list.sceneName, sceneId) || sceneId,
            location: undefined,
            synopsis: compactText(list.notes),
            shotListId: listId,
          });
        } else {
          const existing = sceneMap.get(sceneId);
          if (existing && listId) existing.shotListId = listId;
        }

        const shots = Array.isArray(list.shots) ? (list.shots as CastingShot[]) : [];
        shotOptions[sceneId] = shots.map((shot, shotIndex) => {
          const shotId = compactText(shot.id, `shot-${sceneId}-${shotIndex + 1}`) || `shot-${sceneId}-${shotIndex + 1}`;
          return {
            id: shotId,
            label: compactText(shot.description, shot.name, `Shot ${shotIndex + 1}`) || `Shot ${shotIndex + 1}`,
            description: compactText(shot.notes, shot.fieldNotes),
          };
        });

        const storyboardFrames: StoryboardTile[] = [];
        shots.forEach((shot, shotIndex) => {
          const imageUrl = compactText(shot.imageUrl, shot.thumbnailUrl);
          if (!imageUrl) return;
          storyboardFrames.push({
            id: compactText(shot.id, `${sceneId}-frame-${shotIndex + 1}`) || `${sceneId}-frame-${shotIndex + 1}`,
            imageUrl,
            title: compactText(shot.description, `Shot ${shotIndex + 1}`) || `Shot ${shotIndex + 1}`,
            description: compactText(shot.notes, shot.shotType),
            source: 'shot-list',
            sourceSceneId: sceneId,
            sourceSceneNumber: asString(sceneMap.get(sceneId)?.sceneNumber),
          });
        });
        storyboards[sceneId] = mergeStoryboardTiles(storyboards[sceneId], storyboardFrames);

        if (!scripts[sceneId]) {
          scripts[sceneId] = compactText(list.notes, list.sceneName) || '';
        }
      });

      const storyboardLibraryByScene = loadStoryboardLibraryTilesByScene(
        projectId,
        Array.from(sceneMap.values()),
      );
      Object.entries(storyboardLibraryByScene).forEach(([sceneId, tiles]) => {
        storyboards[sceneId] = sortStoryboardTiles(mergeStoryboardTiles(storyboards[sceneId], tiles));
      });

      const productionDays = Array.isArray(projectData?.productionDays) ? projectData.productionDays : [];
      productionDays.forEach((day) => {
        const sceneIds = Array.isArray(day.scenes) ? day.scenes : [];
        const dayLocationName = compactText(day.locationName) || locationNameById.get(compactText(day.locationId, day.location_id) || '');
        sceneIds.forEach((rawSceneId) => {
          const sceneId = compactText(rawSceneId);
          if (!sceneId) return;
          const scene = sceneMap.get(sceneId);
          if (!scene) return;
          if (!compactText(scene.location) && dayLocationName) {
            scene.location = dayLocationName;
          }
          if (!compactText(scene.shootingDate)) {
            scene.shootingDate = compactText(day.date);
          }
        });
      });

      const sortedScenes = Array.from(sceneMap.values()).sort((left, right) => {
        const leftValue = parseNumberString((compactText(left.sceneNumber, left.id) || '').replace(/[^\d.]/g, ''));
        const rightValue = parseNumberString((compactText(right.sceneNumber, right.id) || '').replace(/[^\d.]/g, ''));
        if (leftValue != null && rightValue != null) return leftValue - rightValue;
        return (compactText(left.sceneNumber, left.id) || '').localeCompare(compactText(right.sceneNumber, right.id) || '', 'nb-NO');
      });

      const sceneCoordinates: Record<string, SceneCoordinates> = {};
      sortedScenes.forEach((scene) => {
        const sceneId = compactText(scene.id, scene.sceneId);
        if (!sceneId) return;
        const locationId = compactText(
          (scene as { locationId?: unknown }).locationId,
          (scene as { location_id?: unknown }).location_id,
        );
        const locationName = compactText(scene.location);
        const byId = locationId ? locationCoordinatesById.get(locationId) : undefined;
        const byName = locationName ? locationCoordinatesByName.get(locationName.toLowerCase()) : undefined;
        const selected = byId || byName;
        if (selected) {
          sceneCoordinates[sceneId] = selected;
        }
      });

      const crewList = Array.isArray(projectData?.crew) ? projectData.crew : [];
      const equipmentList = Array.isArray(projectData?.props) ? projectData.props : [];

      const parsedCrewRoster: PresenceRosterEntry[] = crewList.map((member, index) => {
        const id = compactText(member.id, `crew-${index + 1}`) || `crew-${index + 1}`;
        const name = compactText(member.name, id) || `Crew ${index + 1}`;
        const role = normalizeRoleLabel(member.role);
        const department = normalizeRoleLabel(member.department);
        const subtitle = compactText(role, department);
        return { id, name, subtitle };
      });

      const parsedEquipmentRoster: PresenceRosterEntry[] = equipmentList.map((item, index) => {
        const id = compactText(item.id, `equipment-${index + 1}`) || `equipment-${index + 1}`;
        const name = compactText(item.name, item.description, `Utstyr ${index + 1}`) || `Utstyr ${index + 1}`;
        const category = normalizeRoleLabel(item.category);
        const availability = normalizeRoleLabel(item.availability);
        const subtitle = compactText(category, availability);
        return { id, name, subtitle };
      });

      setContext({
        loading: false,
        contextError: null,
        sceneOptions: sortedScenes,
        shotOptionsByScene: shotOptions,
        scriptByScene: scripts,
        storyboardsByScene: storyboards,
        sceneShotListMap: shotListByScene,
        crewRoster: parsedCrewRoster,
        equipmentRoster: parsedEquipmentRoster,
        sceneCoordinatesById: sceneCoordinates,
      });
    } catch (error) {
      setContext((current) => ({
        ...current,
        loading: false,
        contextError: error instanceof Error ? error.message : 'Kunne ikke laste live set-kontekst',
      }));
    }
  }, [projectId]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStoryboardLibraryUpdated = () => {
      void loadContext();
    };

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !event.key.startsWith(`${STORYBOARD_LIBRARY_STORAGE_PREFIX}:`)) return;
      void loadContext();
    };

    window.addEventListener('role-room:storyboard-library-updated', handleStoryboardLibraryUpdated as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('role-room:storyboard-library-updated', handleStoryboardLibraryUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadContext]);

  return {
    ...context,
    reloadContext: loadContext,
  };
}
