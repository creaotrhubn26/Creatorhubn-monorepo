/**
 * Character Profile Service
 * 
 * Provides settings-based persistence for character profiles.
 * Used by ManuscriptPanel to store character metadata (alias, description, age, role).
 */

import { settingsService } from './settingsService';

export interface CharacterProfile {
  name: string;
  alias?: string;
  description?: string;
  age?: string;
  role: 'lead' | 'supporting' | 'minor' | 'extra';
}

const SETTINGS_NAMESPACE = 'virtualStudio_characterProfiles';

export const characterProfileService = {
  /**
   * Get character profiles for a manuscript
   */
  async getProfiles(manuscriptId: string): Promise<Record<string, CharacterProfile>> {
    if (!manuscriptId) return {};

    try {
      const data = await settingsService.getSetting<Record<string, CharacterProfile>>(SETTINGS_NAMESPACE, {
        projectId: manuscriptId,
      });
      if (data) return data;
    } catch (error) {
      console.warn('Failed to fetch character profiles from settings API:', error);
    }

    return {};
  },

  /**
   * Save character profiles for a manuscript
   */
  async saveProfiles(manuscriptId: string, profiles: Record<string, CharacterProfile>): Promise<void> {
    if (!manuscriptId) return;

    try {
      await settingsService.setSetting(SETTINGS_NAMESPACE, profiles, { projectId: manuscriptId });
    } catch (error) {
      console.warn('Failed to save character profiles to settings API:', error);
    }
  },

  /**
   * Update a single character profile
   */
  async updateProfile(manuscriptId: string, characterName: string, profile: CharacterProfile): Promise<void> {
    const profiles = await this.getProfiles(manuscriptId);
    profiles[characterName] = profile;
    await this.saveProfiles(manuscriptId, profiles);
  },

  /**
   * Delete a character profile
   */
  async deleteProfile(manuscriptId: string, characterName: string): Promise<void> {
    const profiles = await this.getProfiles(manuscriptId);
    delete profiles[characterName];
    await this.saveProfiles(manuscriptId, profiles);
  },

  /**
   * Delete all profiles for a manuscript
   */
  async deleteAllProfiles(manuscriptId: string): Promise<void> {
    if (!manuscriptId) return;
    try {
      await settingsService.deleteSetting(SETTINGS_NAMESPACE, { projectId: manuscriptId });
    } catch (error) {
      console.warn('Failed to delete character profiles from settings API:', error);
    }
  },

  
};

export default characterProfileService;
