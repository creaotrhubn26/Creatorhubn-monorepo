/**
 * Shot Planner API Service
 * 
 * Handles communication with the backend for shot planner 2D scenes
 */

import type { Scene2D } from './types';

const API_BASE = '/api/shot-planner';

export const shotPlannerApi = {
  /**
   * Get all scenes from database
   */
  async getScenes(projectId?: string): Promise<Scene2D[]> {
    try {
      const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      const response = await fetch(`${API_BASE}/scenes${query}`);
      if (!response.ok) {
        throw new Error('Failed to fetch scenes');
      }
      const data = await response.json();
      return data.scenes || [];
    } catch (error) {
      console.error('Error fetching scenes:', error);
      return [];
    }
  },

  /**
   * Get a specific scene by ID
   */
  async getScene(id: string, projectId?: string): Promise<Scene2D | null> {
    try {
      const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
      const response = await fetch(`${API_BASE}/scenes/${id}${query}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch scene');
      }
      const data = await response.json();
      return data.scene || null;
    } catch (error) {
      console.error('Error fetching scene:', error);
      return null;
    }
  },

  /**
   * Save or update a scene
   */
  async saveScene(scene: Scene2D): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/scenes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scene),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save scene');
      }
      
      return true;
    } catch (error) {
      console.error('Error saving scene:', error);
      return false;
    }
  },

  /**
   * Delete a scene
   */
  async deleteScene(id: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/scenes/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete scene');
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting scene:', error);
      return false;
    }
  },
};
