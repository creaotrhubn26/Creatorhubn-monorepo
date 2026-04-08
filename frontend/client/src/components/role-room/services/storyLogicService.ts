/**
 * Story Logic Service
 * Handles persistence for story logic data (concept, logline, theme)
 * Uses database with localStorage fallback
 */

import { shouldUseRoleRoomLocalFallback } from '../utils/runtime';

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
  isLocked: boolean;
}

export interface StoryLogicRecord {
  id: string;
  projectId: string;
  data: StoryLogicState;
  createdAt: string;
  updatedAt: string;
}

const LEGACY_STORAGE_KEY = 'story-logic-data';
const STORAGE_KEY_PREFIX = 'story-logic-data:';

const buildStorageKey = (projectId: string): string => `${STORAGE_KEY_PREFIX}${projectId}`;

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
    if (shouldUseRoleRoomLocalFallback()) {
      return getStorageData(projectId)?.data || null;
    }

    // Try database first
    try {
      const response = await fetch(`/api/projects/${projectId}/story-logic`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.storyLogic) {
          // Also update localStorage as cache
          saveStorageData(projectId, {
            id: `story-logic-${projectId}`,
            projectId,
            data: data.storyLogic,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          });
          return data.storyLogic;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch story logic from API, using localStorage:', error);
    }

    // Fallback to localStorage
    return getStorageData(projectId)?.data || null;
  },

  /**
   * Save story logic data for a project
   */
  async saveStoryLogic(projectId: string, data: StoryLogicState): Promise<void> {
    const now = new Date().toISOString();
    const dataToSave = { ...data, lastSaved: now };

    // Always save to localStorage first for immediate persistence
    const existingRecord = getStorageData(projectId);
    saveStorageData(projectId, {
      id: existingRecord?.id || `story-logic-${projectId}`,
      projectId,
      data: dataToSave,
      createdAt: existingRecord?.createdAt || now,
      updatedAt: now,
    });

    if (shouldUseRoleRoomLocalFallback()) {
      return;
    }

    // Then try to sync with database
    try {
      const response = await fetch(`/api/projects/${projectId}/story-logic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyLogic: dataToSave,
          updatedAt: now,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save story logic: ${response.statusText}`);
      }

      console.log('✓ Story logic saved to database for project:', projectId);
    } catch (error) {
      console.warn('Failed to save story logic to API, using localStorage only:', error);
      // Data is already in localStorage, so user can continue working
    }
  },

  /**
   * Delete story logic data for a project
   */
  async deleteStoryLogic(projectId: string): Promise<void> {
    // Remove from localStorage
    deleteStorageData(projectId);

    if (shouldUseRoleRoomLocalFallback()) {
      return;
    }

    // Try to delete from database
    try {
      const response = await fetch(`/api/projects/${projectId}/story-logic`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        console.warn('Failed to delete story logic from API:', response.statusText);
      }
    } catch (error) {
      console.warn('Failed to delete story logic from API:', error);
    }
  },

  /**
   * Check if story logic data exists for a project
   */
  async hasStoryLogic(projectId: string): Promise<boolean> {
    const data = await this.getStoryLogic(projectId);
    return data !== null;
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
