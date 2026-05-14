/**
 * Casting Database Service
 * Handles persistence of casting data to PostgreSQL database
 */

import type { CastingProject } from '../models/casting';
import {
  CONTENT_PRODUCER_DEMO_PROJECT_ID,
  TROLL_DEMO_PROJECT_ID,
} from '../constants/producerDemo';
import { shouldUseRoleRoomLocalFallback } from '../utils/runtime';

function normalizeRequiredProjectId(projectId: string | null | undefined, operation: string): string {
  const normalized = String(projectId || '').trim();
  if (!normalized) {
    throw new Error(`Mangler prosjekt-ID for ${operation}.`);
  }
  const lowered = normalized.toLowerCase();
  if (
    lowered === 'default' ||
    lowered === 'default-project' ||
    lowered === 'demo' ||
    lowered === 'undefined' ||
    lowered === 'null' ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    normalized.includes('..')
  ) {
    throw new Error(`Ugyldig prosjekt-ID for ${operation}: ${normalized}`);
  }
  return normalized;
}

function assertCanWriteProject(projectId: string, operation: string): void {
  const normalized = normalizeRequiredProjectId(projectId, operation);
  if (
    (normalized === CONTENT_PRODUCER_DEMO_PROJECT_ID || normalized === TROLL_DEMO_PROJECT_ID)
  ) {
    throw new Error('Demo-ID er låst i dette miljøet. Lag en kopi før du endrer prosjektdata.');
  }
}

/**
 * Save casting project to database
 */
export async function saveCastingProjectToDb(project: CastingProject): Promise<void> {
  project = { ...project, id: normalizeRequiredProjectId(project.id, 'saveCastingProjectToDb') };
  assertCanWriteProject(project.id, 'saveCastingProjectToDb');
  if (shouldUseRoleRoomLocalFallback()) {
    return;
  }

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
  if (shouldUseRoleRoomLocalFallback()) {
    return [];
  }

  try {
    const response = await fetch('/api/casting/projects');

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const payload = await response.json();
    // Backend kan returnere enten { projects: [...] } eller bare [...]
    // Begge støttes for robust deserialisering.
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload && Array.isArray(payload.projects)) {
      return payload.projects;
    }
    return [];
  } catch (error) {
    console.error('Error fetching projects from database:', error);
    return [];
  }
}

/**
 * Get casting project by ID from database
 */
export async function getCastingProjectFromDb(id: string): Promise<CastingProject | null> {
  id = normalizeRequiredProjectId(id, 'getCastingProjectFromDb');
  if (shouldUseRoleRoomLocalFallback()) {
    return null;
  }

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
  id = normalizeRequiredProjectId(id, 'deleteCastingProjectFromDb');
  assertCanWriteProject(id, 'deleteCastingProjectFromDb');
  if (shouldUseRoleRoomLocalFallback()) {
    return;
  }

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
  if (shouldUseRoleRoomLocalFallback()) {
    return false;
  }

  try {
    const response = await fetch('/api/casting/health');
    return response.ok;
  } catch {
    return false;
  }
}








