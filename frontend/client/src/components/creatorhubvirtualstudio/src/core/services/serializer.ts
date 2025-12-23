/**
 * Scene Serializer
 * 
 * Handles scene persistence with DB-first storage and localStorage fallback.
 */

import { Scene } from '@/core/models/scene';
import { logger } from './logger';

const log = logger.module('Serializer');

const KEY = 'virtual-studio-scene';
const API_BASE = '/api/virtual-studio/user-data';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Save scene to server
 */
async function saveToServer(scene: Scene): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auto-save`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type' : 'application/json' },
      body: JSON.stringify({ 
        sceneData: scene,
        lastSavedAt: new Date().toISOString(),
      }),
    });
    return response.ok;
  } catch (error) {
    log.warn('Failed to save scene to server', error);
    return false;
  }
}

/**
 * Load scene from server
 */
async function loadFromServer(): Promise<Scene | null> {
  try {
    const response = await fetch(`${API_BASE}/auto-save`, {
      credentials: 'include',
      headers: { 'Content-Type' : 'application/json' },
    });
    if (!response.ok) return null;
    
    const data = await response.json();
    return data?.sceneData || null;
  } catch (error) {
    log.warn('Failed to load scene from server', error);
    return null;
  }
}

// ============================================================================
// Local Cache Functions
// ============================================================================

function saveToLocalStorage(scene: Scene): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(scene));
  } catch (error) {
    log.error('Failed to save scene to localStorage', error);
  }
}

function loadFromLocalStorage(): Scene | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Scene) : null;
  } catch {
    return null;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Save scene to local storage and sync to server
 */
export async function saveLocal(scene: Scene): Promise<void> {
  // Save to local cache immediately
  saveToLocalStorage(scene);
  log.debug('Saved scene to localStorage');
  
  // Sync to server (async, non-blocking)
  saveToServer(scene).then((success) => {
    if (success) {
      log.debug('Scene synced to server');
    } else {
      // Fallback to legacy KV API
      fetch('/api/user/kv', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: KEY, value: scene }),
      }).catch(() => {
        log.warn('Failed to sync scene to legacy KV');
      });
    }
  });
}

/**
 * Load scene from local storage (synchronous)
 */
export function loadLocal(): Scene | null {
  const scene = loadFromLocalStorage();
  if (scene) {
    log.debug('Loaded scene from localStorage');
  }
  return scene;
}

/**
 * Load scene - server first with local fallback (async)
 */
export async function loadServerFirst(): Promise<Scene | null> {
  try {
    // Try new API first
    const serverScene = await loadFromServer();
    if (serverScene) {
      // Update local cache
      saveToLocalStorage(serverScene);
      log.info('Loaded scene from server');
      return serverScene;
    }
    
    // Fallback to legacy KV API
    const r = await fetch(`/api/user/kv/${encodeURIComponent(KEY)}`, { credentials: 'include' });
    const j = r.ok ? await r.json().catch(() => null) : null;
    const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
    if (v) {
      saveToLocalStorage(v as Scene);
      // Migrate to new API
      saveToServer(v as Scene).catch(() => {});
      log.info('Loaded scene from legacy KV and migrated');
      return v as Scene;
    }
  } catch (error) {
    log.warn('Server load failed, using local cache', error);
  }
  
  return loadLocal();
}

/**
 * Export scene to JSON string
 */
export function toJSON(scene: Scene): string {
  return JSON.stringify(scene, null, 2);
}

/**
 * Import scene from JSON string
 */
export function fromJSON(raw: string): Scene {
  try {
    const scene = JSON.parse(raw) as Scene;
    log.debug('Parsed scene from JSON');
    return scene;
  } catch (error) {
    log.error('Failed to parse scene JSON', error);
    throw new Error('Invalid scene JSON');
  }
}

/**
 * Clear all saved scene data
 */
export async function clearScene(): Promise<void> {
  try {
    localStorage.removeItem(KEY);
    await fetch(`${API_BASE}/auto-save`, {
      method: 'DELETE',
      credentials: 'include',
    });
    log.info('Cleared scene data');
  } catch (error) {
    log.error('Failed to clear scene data', error);
  }
}

/**
 * Check if there's a saved scene
 */
export async function hasSavedScene(): Promise<boolean> {
  // Check local first (fast)
  if (loadFromLocalStorage()) {
    return true;
  }
  
  // Check server
  const serverScene = await loadFromServer();
  return serverScene !== null;
}
