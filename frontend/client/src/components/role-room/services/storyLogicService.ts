/**
 * Story Logic Service
 * Handles persistence for story logic data (concept, logline, theme)
 * Uses authenticated Role Room API persistence with local cache only after server confirmation.
 */

import authSessionService from './authSessionService';
import {
  isRoleRoomDemoProjectId,
  isRoleRoomDemoSeedAllowed,
} from '../constants/producerDemo';

// Story Logic types (matching StoryLogicPanel)
export interface ConceptData {
  corePremise: string;
  genre: string;
  subGenre: string;
  tone: string[];
  targetAudience: string;
  audienceAge: string;
  whyNow: string;
  uniqueAngle: string;
  marketComparables: string;
}

export interface LoglineData {
  protagonist: string;
  protagonistTrait: string;
  goal: string;
  antagonisticForce: string;
  stakes: string;
  fullLogline: string;
  loglineScore: number;
}

export interface ThemeData {
  centralTheme: string;
  themeStatement: string;
  protagonistFlaw: string;
  flawOrigin: string;
  whatMustChange: string;
  transformationArc: string;
  emotionalJourney: string[];
  moralArgument: string;
}

export interface PhaseLocks {
  concept: boolean;
  logline: boolean;
  theme: boolean;
}

export interface StoryVersion {
  id: string;
  label: string;
  timestamp: string;
  snapshot: string;
}

export interface StoryLogicState {
  concept: ConceptData;
  logline: LoglineData;
  theme: ThemeData;
  currentPhase: number;
  phaseStatus: {
    concept: 'incomplete' | 'weak' | 'ready';
    logline: 'incomplete' | 'weak' | 'ready';
    theme: 'incomplete' | 'weak' | 'ready';
  };
  lastSaved: string | null;
  locks?: PhaseLocks;
  versions?: StoryVersion[];
  isLocked?: boolean;
}

export interface StoryLogicRecord {
  id: string;
  projectId: string;
  data: StoryLogicState;
  version?: number;
  createdAt: string;
  updatedAt: string;
}

export type StoryLogicSyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'local_only' | 'error' | 'conflict';

export interface StoryLogicSyncMeta {
  projectId: string;
  status: StoryLogicSyncStatus;
  source: 'server' | 'local' | 'none';
  version?: number;
  lastLoadedAt?: string;
  lastSyncedAt?: string;
  lastError?: string;
}

interface StoryLogicApiResponse {
  success?: boolean;
  projectId?: string;
  storyLogic?: StoryLogicState | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  error?: string;
  current?: StoryLogicApiResponse;
}

const LEGACY_STORAGE_KEY = 'story-logic-data';
const STORAGE_KEY_PREFIX = 'story-logic-data:';
const SYNC_META_PREFIX = 'story-logic-sync-meta:';
const ROLE_ROOM_STORY_LOGIC_API_PREFIX = '/api/role-room/projects';

const buildStorageKey = (projectId: string): string => `${STORAGE_KEY_PREFIX}${projectId}`;
const buildSyncMetaKey = (projectId: string): string => `${SYNC_META_PREFIX}${projectId}`;

function normalizeStoryLogicProjectId(projectId: string): string {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) {
    throw new Error('Story Logic krever gyldig prosjekt-ID.');
  }

  if (normalizedProjectId === 'default' || normalizedProjectId === 'default-project') {
    throw new Error('Story Logic kan ikke lagres mot standardprosjekt. Velg et ekte prosjekt først.');
  }

  if (isRoleRoomDemoProjectId(normalizedProjectId) && !isRoleRoomDemoSeedAllowed()) {
    throw new Error('Story Logic kan ikke lagres mot låst demo-ID i produksjon. Lag en kopi først.');
  }

  return normalizedProjectId;
}

function shouldUseExplicitStoryLogicLocalFallback(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('roleRoomLocalFallback') === '1'
    || params.get('storyLogicLocalFallback') === '1';
}

function getStoryLogicApiUrl(projectId: string): string {
  return `${ROLE_ROOM_STORY_LOGIC_API_PREFIX}/${encodeURIComponent(projectId)}/story-logic`;
}

function getRequiredAuthHeaders(): Record<string, string> {
  const authHeaders = authSessionService.getAuthHeadersSync();
  if (!authHeaders.Authorization) {
    throw new Error('Story Logic krever gyldig Role Room-session.');
  }
  return authHeaders;
}

async function readApiPayload(response: Response): Promise<StoryLogicApiResponse> {
  try {
    return await response.json() as StoryLogicApiResponse;
  } catch {
    return {};
  }
}

function writeSyncMeta(projectId: string, meta: Omit<StoryLogicSyncMeta, 'projectId'>): StoryLogicSyncMeta {
  const nextMeta: StoryLogicSyncMeta = { projectId, ...meta };
  try {
    localStorage.setItem(buildSyncMetaKey(projectId), JSON.stringify(nextMeta));
  } catch (error) {
    console.warn('Failed to write story logic sync meta:', error);
  }
  return nextMeta;
}

function getSyncMeta(projectId: string): StoryLogicSyncMeta {
  try {
    const raw = localStorage.getItem(buildSyncMetaKey(projectId));
    if (raw) {
      const parsed = JSON.parse(raw) as StoryLogicSyncMeta;
      return {
        projectId,
        status: parsed.status || 'idle',
        source: parsed.source || 'none',
        version: typeof parsed.version === 'number' ? parsed.version : undefined,
        lastLoadedAt: parsed.lastLoadedAt,
        lastSyncedAt: parsed.lastSyncedAt,
        lastError: parsed.lastError,
      };
    }
  } catch (error) {
    console.warn('Failed to read story logic sync meta:', error);
  }

  return { projectId, status: 'idle', source: 'none' };
}

function assertMatchingProjectPayload(projectId: string, payload: StoryLogicApiResponse): void {
  if (payload.projectId && payload.projectId !== projectId) {
    throw new Error('Serveren returnerte Story Logic for feil prosjekt.');
  }
}

/**
 * Get story logic data from localStorage for one project
 */
function getStorageData(projectId: string): StoryLogicRecord | null {
  try {
    const data = localStorage.getItem(buildStorageKey(projectId));
    return data ? JSON.parse(data) as StoryLogicRecord : null;
  } catch (error) {
    console.error('Failed to read story logic from localStorage:', error);
    return null;
  }
}

/**
 * Save story logic data to localStorage for one project
 */
function saveStorageData(projectId: string, data: StoryLogicRecord): void {
  try {
    localStorage.setItem(buildStorageKey(projectId), JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save story logic to localStorage:', error);
  }
}

function deleteStorageData(projectId: string): void {
  try {
    localStorage.removeItem(buildStorageKey(projectId));
  } catch (error) {
    console.error('Failed to delete story logic from localStorage:', error);
  }
}

export const storyLogicService = {
  /**
   * Get story logic data for a project
   */
  async getStoryLogic(projectId: string): Promise<StoryLogicState | null> {
    const normalizedProjectId = normalizeStoryLogicProjectId(projectId);

    if (shouldUseExplicitStoryLogicLocalFallback()) {
      writeSyncMeta(normalizedProjectId, {
        status: 'local_only',
        source: 'local',
        lastLoadedAt: new Date().toISOString(),
      });
      return getStorageData(normalizedProjectId)?.data || null;
    }

    writeSyncMeta(normalizedProjectId, {
      ...getSyncMeta(normalizedProjectId),
      status: 'loading',
      source: 'server',
    });

    try {
      const response = await fetch(getStoryLogicApiUrl(normalizedProjectId), {
        headers: getRequiredAuthHeaders(),
      });
      const payload = await readApiPayload(response);

      // 404 = "ingen data ennå" for begge scenarioer:
      //   • story_logic_not_found  → prosjektet finnes, men ingen story-logic-rad
      //   • project_not_found      → prosjektet er nyopprettet på frontend og
      //     ikke persistert til casting_projects ennå (typisk for fresh
      //     content-producer projects før første save). Backend bootstrap-
      //     funksjonen krever write-scope og kan ikke seede prosjektet på
      //     en GET. Vi behandler det som tom state — workspace renderer
      //     defaults og første save vil opprette prosjektet via POST.
      if (response.status === 404 && (
        payload.error === 'story_logic_not_found'
        || payload.error === 'project_not_found'
      )) {
        writeSyncMeta(normalizedProjectId, {
          status: 'synced',
          source: 'server',
          lastLoadedAt: new Date().toISOString(),
        });
        return null;
      }

      if (!response.ok) {
        throw new Error(payload.error || `Kunne ikke hente Story Logic (${response.status})`);
      }

      assertMatchingProjectPayload(normalizedProjectId, payload);
      if (payload.success && payload.storyLogic) {
        saveStorageData(normalizedProjectId, {
          id: `story-logic-${normalizedProjectId}`,
          projectId: normalizedProjectId,
          data: payload.storyLogic,
          version: payload.version,
          createdAt: payload.createdAt || new Date().toISOString(),
          updatedAt: payload.updatedAt || new Date().toISOString(),
        });
        writeSyncMeta(normalizedProjectId, {
          status: 'synced',
          source: 'server',
          version: payload.version,
          lastLoadedAt: new Date().toISOString(),
          lastSyncedAt: payload.updatedAt || new Date().toISOString(),
        });
        return payload.storyLogic;
      }

      writeSyncMeta(normalizedProjectId, {
        status: 'synced',
        source: 'server',
        version: payload.version,
        lastLoadedAt: new Date().toISOString(),
      });
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke hente Story Logic.';
      writeSyncMeta(normalizedProjectId, {
        ...getSyncMeta(normalizedProjectId),
        status: 'error',
        source: 'server',
        lastError: message,
      });
      throw error;
    }
  },

  /**
   * Save story logic data for a project
   */
  async saveStoryLogic(projectId: string, data: StoryLogicState): Promise<void> {
    const normalizedProjectId = normalizeStoryLogicProjectId(projectId);
    const now = new Date().toISOString();
    const dataToSave = { ...data, lastSaved: now };

    if (shouldUseExplicitStoryLogicLocalFallback()) {
      const existingRecord = getStorageData(normalizedProjectId);
      saveStorageData(normalizedProjectId, {
        id: existingRecord?.id || `story-logic-${normalizedProjectId}`,
        projectId: normalizedProjectId,
        data: dataToSave,
        version: existingRecord?.version,
        createdAt: existingRecord?.createdAt || now,
        updatedAt: now,
      });
      writeSyncMeta(normalizedProjectId, {
        status: 'local_only',
        source: 'local',
        version: existingRecord?.version,
        lastSyncedAt: now,
      });
      return;
    }

    const currentMeta = getSyncMeta(normalizedProjectId);
    writeSyncMeta(normalizedProjectId, {
      ...currentMeta,
      status: 'saving',
      source: 'server',
      lastError: undefined,
    });

    try {
      const response = await fetch(getStoryLogicApiUrl(normalizedProjectId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getRequiredAuthHeaders(),
        },
        body: JSON.stringify({
          projectId: normalizedProjectId,
          storyLogic: dataToSave,
          expectedVersion: currentMeta.version,
          updatedAt: now,
        }),
      });
      const payload = await readApiPayload(response);

      if (response.status === 409) {
        writeSyncMeta(normalizedProjectId, {
          ...currentMeta,
          status: 'conflict',
          source: 'server',
          version: payload.current?.version ?? currentMeta.version,
          lastError: payload.error || 'Story Logic-konflikt. Last inn siste serverversjon før du lagrer igjen.',
        });
        throw new Error(payload.error || 'Story Logic-konflikt. Last inn siste serverversjon før du lagrer igjen.');
      }

      if (!response.ok) {
        throw new Error(payload.error || `Kunne ikke lagre Story Logic (${response.status})`);
      }

      assertMatchingProjectPayload(normalizedProjectId, payload);

      const confirmResponse = await fetch(getStoryLogicApiUrl(normalizedProjectId), {
        headers: getRequiredAuthHeaders(),
      });
      const confirmedPayload = await readApiPayload(confirmResponse);
      if (!confirmResponse.ok || !confirmedPayload.storyLogic) {
        throw new Error(confirmedPayload.error || 'Serverbekreftelse for Story Logic-save feilet.');
      }
      assertMatchingProjectPayload(normalizedProjectId, confirmedPayload);

      saveStorageData(normalizedProjectId, {
        id: `story-logic-${normalizedProjectId}`,
        projectId: normalizedProjectId,
        data: confirmedPayload.storyLogic,
        version: confirmedPayload.version ?? payload.version,
        createdAt: confirmedPayload.createdAt || payload.createdAt || now,
        updatedAt: confirmedPayload.updatedAt || payload.updatedAt || now,
      });
      writeSyncMeta(normalizedProjectId, {
        status: 'synced',
        source: 'server',
        version: confirmedPayload.version ?? payload.version,
        lastSyncedAt: confirmedPayload.updatedAt || payload.updatedAt || now,
        lastLoadedAt: now,
        lastError: undefined,
      });
    } catch (error) {
      if (getSyncMeta(normalizedProjectId).status !== 'conflict') {
        const message = error instanceof Error ? error.message : 'Kunne ikke lagre Story Logic.';
        writeSyncMeta(normalizedProjectId, {
          ...currentMeta,
          status: 'error',
          source: 'server',
          lastError: message,
        });
      }
      throw error;
    }
  },

  /**
   * Delete story logic data for a project
   */
  async deleteStoryLogic(projectId: string): Promise<void> {
    const normalizedProjectId = normalizeStoryLogicProjectId(projectId);

    if (shouldUseExplicitStoryLogicLocalFallback()) {
      deleteStorageData(normalizedProjectId);
      writeSyncMeta(normalizedProjectId, {
        status: 'local_only',
        source: 'local',
        lastSyncedAt: new Date().toISOString(),
      });
      return;
    }

    writeSyncMeta(normalizedProjectId, {
      ...getSyncMeta(normalizedProjectId),
      status: 'saving',
      source: 'server',
    });

    try {
      const response = await fetch(getStoryLogicApiUrl(normalizedProjectId), {
        method: 'DELETE',
        headers: getRequiredAuthHeaders(),
      });
      const payload = await readApiPayload(response);

      if (!response.ok) {
        throw new Error(payload.error || `Kunne ikke slette Story Logic (${response.status})`);
      }

      deleteStorageData(normalizedProjectId);
      writeSyncMeta(normalizedProjectId, {
        status: 'synced',
        source: 'server',
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kunne ikke slette Story Logic.';
      writeSyncMeta(normalizedProjectId, {
        ...getSyncMeta(normalizedProjectId),
        status: 'error',
        source: 'server',
        lastError: message,
      });
      throw error;
    }
  },

  /**
   * Check if story logic data exists for a project
   */
  async hasStoryLogic(projectId: string): Promise<boolean> {
    const data = await this.getStoryLogic(projectId);
    return data !== null;
  },

  getStoryLogicSyncMeta(projectId: string): StoryLogicSyncMeta {
    return getSyncMeta(normalizeStoryLogicProjectId(projectId));
  },

  /**
   * Migrate old localStorage format to new format
   * Old format: `story-logic-${projectId}` directly in localStorage
   * New format: One key per project under STORAGE_KEY_PREFIX
   */
  migrateOldFormat(): void {
    try {
      const allKeys = Object.keys(localStorage);
      let migrated = 0;

      const legacyAggregateRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyAggregateRaw) {
        try {
          const parsed = JSON.parse(legacyAggregateRaw) as Record<string, StoryLogicRecord>;
          for (const [projectId, record] of Object.entries(parsed ?? {})) {
            if (!projectId || projectId === 'default' || getStorageData(projectId)) {
              continue;
            }
            if (!record || typeof record !== 'object') {
              continue;
            }
            saveStorageData(projectId, {
              id: record.id || `story-logic-${projectId}`,
              projectId,
              data: record.data,
              createdAt: record.createdAt || record.data?.lastSaved || new Date().toISOString(),
              updatedAt: record.updatedAt || record.data?.lastSaved || new Date().toISOString(),
            });
            migrated++;
          }
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (e) {
          console.warn('Failed to migrate aggregated story logic store:', e);
        }
      }

      const storyLogicKeys = allKeys.filter(k => k.startsWith('story-logic-') && k !== LEGACY_STORAGE_KEY);
      for (const key of storyLogicKeys) {
        const projectId = key.replace('story-logic-', '');
        if (projectId === 'default' || getStorageData(projectId)) continue;

        try {
          const oldData = localStorage.getItem(key);
          if (oldData) {
            const parsed = JSON.parse(oldData) as StoryLogicState;
            saveStorageData(projectId, {
              id: `story-logic-${projectId}`,
              projectId,
              data: parsed,
              createdAt: parsed.lastSaved || new Date().toISOString(),
              updatedAt: parsed.lastSaved || new Date().toISOString(),
            });
            migrated++;
          }
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to migrate story logic for key ${key}:`, e);
        }
      }

      if (migrated > 0) {
        console.log(`✓ Migrated ${migrated} story logic records to new format`);
      }
    } catch (error) {
      console.error('Failed to migrate old story logic format:', error);
    }
  },
};

// Run migration on module load
storyLogicService.migrateOldFormat();
