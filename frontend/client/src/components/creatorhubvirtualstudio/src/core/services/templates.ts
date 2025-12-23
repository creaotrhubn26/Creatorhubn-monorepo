/**
 * Room Templates Service
 * 
 * Manages room template storage with DB-first persistence and localStorage fallback.
 */

import { useAppStore } from '@/state/store';
import { logger } from './logger';

const log = logger.module('Templates');

type RoomTemplate = { 
  id: string; 
  name: string; 
  size: [number, number, number];
  createdAt?: string;
  updatedAt?: string;
};

const KEY = 'CH_ROOM_TEMPLATES';
const API_BASE = '/api/virtual-studio/user-data';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch templates from server
 */
async function fetchFromServer(): Promise<RoomTemplate[]> {
  try {
    const response = await fetch(`${API_BASE}/room-templates, `, { 
      credentials: 'include',
      headers: { 'Content-Type' : 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    log.warn('Failed to fetch templates from server', error);
    return [];
  }
}

/**
 * Save templates to server
 */
async function saveToServer(templates: RoomTemplate[]): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/room-templates`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type' : 'application/json' },
      body: JSON.stringify({ templates }),
    });
    return response.ok;
  } catch (error) {
    log.warn('Failed to save templates to server', error);
    return false;
  }
}

// ============================================================================
// Local Cache Functions
// ============================================================================

function getLocalTemplates(): RoomTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function setLocalTemplates(templates: RoomTemplate[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(templates));
  } catch (error) {
    log.error('Failed to save templates to localStorage', error);
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List room templates (local cache, synchronous)
 */
export function listRoomTemplates(): RoomTemplate[] {
  return getLocalTemplates();
}

/**
 * List room templates - server first with local fallback (async)
 */
export async function listRoomTemplatesServerFirst(): Promise<RoomTemplate[]> {
  try {
    // Try server first
    const serverTemplates = await fetchFromServer();
    if (serverTemplates.length > 0) {
      // Update local cache
      setLocalTemplates(serverTemplates);
      return serverTemplates;
    }
    
    // Fallback to legacy KV API
    const r = await fetch(`/api/user/kv/${encodeURIComponent(KEY)}`, { credentials: 'include' });
    const j = r.ok ? await r.json().catch(() => null) : null;
    const v = j && typeof j === 'object' && 'value' in j ? j.value : j;
    if (Array.isArray(v) && v.length > 0) {
      setLocalTemplates(v as RoomTemplate[]);
      // Migrate to new API
      saveToServer(v as RoomTemplate[]).catch(() => {});
      return v as RoomTemplate[];
    }
  } catch (error) {
    log.warn('Server fetch failed, using local cache', error);
  }
  
  return getLocalTemplates();
}

/**
 * Save a new room template
 */
export async function saveRoomTemplate(): Promise<RoomTemplate | null> {
  const s = useAppStore.getState().scene;
  const list = getLocalTemplates();
  
  const template: RoomTemplate = {
    id: `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Room ${list.length + 1}`,
    size: s.environment.room?.size || [10, 6, 3],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const next = [...list, template];
  
  // Update local cache immediately
  setLocalTemplates(next);
  log.info('Saved room template', template.id);
  
  // Sync to server (async, non-blocking)
  saveToServer(next).then((success) => {
    if (!success) {
      // Also try legacy KV as backup
      fetch('/api/user/kv', {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key: KEY, value: next }),
      }).catch(() => {});
    }
  });
  
  return template;
}

/**
 * Delete a room template
 */
export async function deleteRoomTemplate(id: string): Promise<boolean> {
  const list = getLocalTemplates();
  const next = list.filter((t) => t.id !== id);
  
  if (next.length === list.length) {
    return false; // Not found
  }
  
  setLocalTemplates(next);
  log.info('Deleted room template', id);
  
  // Sync to server
  saveToServer(next);
  
  return true;
}

/**
 * Update a room template
 */
export async function updateRoomTemplate(id: string, updates: Partial<RoomTemplate>): Promise<RoomTemplate | null> {
  const list = getLocalTemplates();
  const index = list.findIndex((t) => t.id === id);
  
  if (index === -1) {
    return null;
  }
  
  const updated: RoomTemplate = {
    ...list[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  const next = [...list];
  next[index] = updated;
  
  setLocalTemplates(next);
  log.info('Updated room template', id);
  
  // Sync to server
  saveToServer(next);
  
  return updated;
}

/**
 * Load a room template into the current scene
 */
export async function loadRoomTemplate(id: string): Promise<boolean> {
  const list = getLocalTemplates();
  const template = list.find((t) => t.id === id);
  
  if (!template) {
    log.warn('Template not found', id);
    return false;
  }
  
  const { setScene } = useAppStore.getState() as any;
  const s = useAppStore.getState().scene;
  
  setScene({
    ...s,
    environment: {
      ...s.environment,
      room: {
        ...(s.environment.room || {}),
        size: template.size,
        wallColor: '#ffffff',
        floorColor: '#eeeeee',
      },
    },
  });
  
  log.info('Loaded room template', id);
  return true;
}
