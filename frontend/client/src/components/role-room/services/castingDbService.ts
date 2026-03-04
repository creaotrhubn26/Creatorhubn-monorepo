/**
 * Casting Database Service
 * Handles persistence of casting data to PostgreSQL database
 */

import type { CastingProject } from '../models/casting';

/**
 * Save casting project to database
 */
export async function saveCastingProjectToDb(project: CastingProject): Promise<void> {
  try {
    const response = await fetch('/api/casting/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(project),
    });

    if (!response.ok) {
      throw new Error(`Failed to save project: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error saving project to database:', error);
    throw error;
  }
}

/**
 * Get all casting projects from database
 */
export async function getCastingProjectsFromDb(): Promise<CastingProject[]> {
  try {
    const response = await fetch('/api/casting/projects');

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const projects = await response.json();
    return projects;
  } catch (error) {
    console.error('Error fetching projects from database:', error);
    return [];
  }
}

/**
 * Get casting project by ID from database
 */
export async function getCastingProjectFromDb(id: string): Promise<CastingProject | null> {
  try {
    const response = await fetch(`/api/casting/projects/${id}`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch project: ${response.statusText}`);
    }

    const project = await response.json();
    return project;
  } catch (error) {
    console.error('Error fetching project from database:', error);
    return null;
  }
}

/**
 * Delete casting project from database
 */
export async function deleteCastingProjectFromDb(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/casting/projects/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete project: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting project from database:', error);
    throw error;
  }
}

/**
 * Check if database is available
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const response = await fetch('/api/casting/health');
    return response.ok;
  } catch (error) {
    return false;
  }
}












