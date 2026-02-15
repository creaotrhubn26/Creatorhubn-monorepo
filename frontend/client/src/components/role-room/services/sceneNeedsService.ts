/**
 * Scene Needs Service
 * 
 * Provides settings-based persistence for scene needs (camera, light, sound requirements).
 */

import { settingsService } from './settingsService';

export interface SceneNeeds {
  cam: boolean;
  light: boolean;
  sound: boolean;
}

const SETTINGS_NAMESPACE = 'virtualStudio_sceneNeeds';

export const sceneNeedsService = {
  /**
   * Get scene needs for a project
   */
  async getSceneNeeds(projectId: string): Promise<Record<string, SceneNeeds>> {
    if (!projectId) return {};

    try {
      const data = await settingsService.getSetting<Record<string, SceneNeeds>>(SETTINGS_NAMESPACE, { projectId });
      if (data) return data;
    } catch (error) {
      console.warn('Failed to fetch scene needs from settings API:', error);
    }

    return {};
  },

  /**
   * Save scene needs for a project
   */
  async saveSceneNeeds(projectId: string, needs: Record<string, SceneNeeds>): Promise<void> {
    if (!projectId) return;

    try {
      await settingsService.setSetting(SETTINGS_NAMESPACE, needs, { projectId });
    } catch (error) {
      console.warn('Failed to save scene needs to settings API:', error);
    }
  },

  /**
   * Update a single scene's needs
   */
  async updateSceneNeeds(projectId: string, sceneId: string, needs: SceneNeeds): Promise<void> {
    const allNeeds = await this.getSceneNeeds(projectId);
    allNeeds[sceneId] = needs;
    await this.saveSceneNeeds(projectId, allNeeds);
  },

  /**
   * Delete scene needs for a project
   */
  async deleteSceneNeeds(projectId: string): Promise<void> {
    if (!projectId) return;
    try {
      await settingsService.deleteSetting(SETTINGS_NAMESPACE, { projectId });
    } catch (error) {
      console.warn('Failed to delete scene needs from settings API:', error);
    }
  },
};

export default sceneNeedsService;
