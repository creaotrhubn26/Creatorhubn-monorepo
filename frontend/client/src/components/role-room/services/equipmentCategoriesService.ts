/**
 * Equipment Categories Service
 * 
 * Provides settings-based persistence for custom equipment categories.
 */

import { settingsService } from './settingsService';

const SETTINGS_NAMESPACE = 'virtualStudio_equipmentCategories';

export const equipmentCategoriesService = {
  /**
   * Get custom categories for a project
   */
  async getCustomCategories(projectId: string): Promise<string[]> {
    if (!projectId) return [];

    try {
      const data = await settingsService.getSetting<string[]>(SETTINGS_NAMESPACE, { projectId });
      if (data) return data;
    } catch (error) {
      console.warn('Failed to fetch equipment categories from settings API:', error);
    }

    return [];
  },

  /**
   * Save custom categories for a project
   */
  async saveCustomCategories(projectId: string, categories: string[]): Promise<void> {
    if (!projectId) return;

    try {
      await settingsService.setSetting(SETTINGS_NAMESPACE, categories, { projectId });
    } catch (error) {
      console.warn('Failed to save equipment categories to settings API:', error);
    }
  },

  /**
   * Add a category
   */
  async addCategory(projectId: string, category: string): Promise<void> {
    const categories = await this.getCustomCategories(projectId);
    if (!categories.includes(category)) {
      categories.push(category);
      await this.saveCustomCategories(projectId, categories);
    }
  },

  /**
   * Remove a category
   */
  async removeCategory(projectId: string, category: string): Promise<void> {
    const categories = await this.getCustomCategories(projectId);
    const filtered = categories.filter(c => c !== category);
    await this.saveCustomCategories(projectId, filtered);
  },
};

export default equipmentCategoriesService;
