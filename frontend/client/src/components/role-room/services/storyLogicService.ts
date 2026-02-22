/**
 * Story Logic Service
 * Handles persistence for story logic data (concept, logline, theme)
 * Uses database with localStorage fallback
 */

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

// Storage key for localStorage fallback
const STORAGE_KEY = 'story-logic-data';

/**
 * Get all story logic data from localStorage
 */
function getStorageData(): Record<string, StoryLogicRecord> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to read story logic from localStorage:', error);
    return {};
  }
}

/**
 * Save all story logic data to localStorage
 */
function saveStorageData(data: Record<string, StoryLogicRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save story logic to localStorage:', error);
  }
}

export const storyLogicService = {
  /**
   * Get story logic data for a project
   */
  async getStoryLogic(projectId: string): Promise<StoryLogicState | null> {
    // Try database first
    try {
      const response = await fetch(`/api/projects/${projectId}/story-logic`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.storyLogic) {
          // Also update localStorage as cache
          const storageData = getStorageData();
          storageData[projectId] = {
            id: `story-logic-${projectId}`,
            projectId,
            data: data.storyLogic,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          };
          saveStorageData(storageData);
          return data.storyLogic;
        }
      }
    } catch (error) {
      console.warn('Failed to fetch story logic from API, using localStorage:', error);
    }

    // Fallback to localStorage
    const storageData = getStorageData();
    const record = storageData[projectId];
    return record?.data || null;
  },

  /**
   * Save story logic data for a project
   */
  async saveStoryLogic(projectId: string, data: StoryLogicState): Promise<void> {
    const now = new Date().toISOString();
    const dataToSave = { ...data, lastSaved: now };

    // Always save to localStorage first for immediate persistence
    const storageData = getStorageData();
    const existingRecord = storageData[projectId];
    storageData[projectId] = {
      id: existingRecord?.id || `story-logic-${projectId}`,
      projectId,
      data: dataToSave,
      createdAt: existingRecord?.createdAt || now,
      updatedAt: now,
    };
    saveStorageData(storageData);

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
    const storageData = getStorageData();
    delete storageData[projectId];
    saveStorageData(storageData);

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
   * New format: Unified storage under STORAGE_KEY
   */
  migrateOldFormat(): void {
    try {
      const allKeys = Object.keys(localStorage);
      const storyLogicKeys = allKeys.filter(k => k.startsWith('story-logic-') && k !== STORAGE_KEY);
      
      if (storyLogicKeys.length === 0) return;

      const storageData = getStorageData();
      let migrated = 0;

      for (const key of storyLogicKeys) {
        const projectId = key.replace('story-logic-', '');
        if (projectId === 'default' || storageData[projectId]) continue;

        try {
          const oldData = localStorage.getItem(key);
          if (oldData) {
            const parsed = JSON.parse(oldData) as StoryLogicState;
            storageData[projectId] = {
              id: `story-logic-${projectId}`,
              projectId,
              data: parsed,
              createdAt: parsed.lastSaved || new Date().toISOString(),
              updatedAt: parsed.lastSaved || new Date().toISOString(),
            };
            migrated++;
          }
        } catch (e) {
          console.warn(`Failed to migrate story logic for key ${key}:`, e);
        }
      }

      if (migrated > 0) {
        saveStorageData(storageData);
        console.log(`✓ Migrated ${migrated} story logic records to new format`);
      }
    } catch (error) {
      console.error('Failed to migrate old story logic format:', error);
    }
  },
};

// Run migration on module load
storyLogicService.migrateOldFormat();
