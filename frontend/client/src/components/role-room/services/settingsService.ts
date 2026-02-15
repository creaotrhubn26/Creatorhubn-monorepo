type SettingsEntry = {
  projectId: string;
  namespace: string;
  data: unknown;
};

const STORAGE_PREFIX = 'app_settings_cache';

type SessionWindow = Window & { __currentUserId?: string };

export const getCurrentUserId = (): string => {
  if (typeof window === 'undefined') return 'default-user';
  const sessionWindow = window as SessionWindow;
  if (sessionWindow.__currentUserId) return sessionWindow.__currentUserId;
  return 'default-user';
};

const cacheKey = (userId: string, namespace: string, projectId?: string) =>
  `${STORAGE_PREFIX}:${userId}:${projectId || ''}:${namespace}`;

const settingsCache = new Map<string, unknown>();

const readCache = <T>(userId: string, namespace: string, projectId?: string): T | null => {
  const key = cacheKey(userId, namespace, projectId);
  return (settingsCache.get(key) as T | undefined) ?? null;
};

const writeCache = (userId: string, namespace: string, data: unknown, projectId?: string) => {
  const key = cacheKey(userId, namespace, projectId);
  settingsCache.set(key, data);
};

export const settingsService = {
  async getSetting<T>(namespace: string, options?: { userId?: string; projectId?: string }): Promise<T | null> {
    const userId = options?.userId || getCurrentUserId();
    const projectId = options?.projectId;
    try {
      const params = new URLSearchParams({ user_id: userId, namespace });
      if (projectId) params.set('project_id', projectId);
      const response = await fetch(`/api/settings?${params.toString()}`);
      if (response.ok) {
        const data = (await response.json()) as { data?: T | null };
        if (data?.data !== undefined) {
          writeCache(userId, namespace, data.data, projectId);
          return data.data ?? null;
        }
      }
    } catch {
      // Ignore network errors
    }
    return typeof window === 'undefined' ? null : readCache<T>(userId, namespace, projectId);
  },

  async setSetting<T>(namespace: string, data: T, options?: { userId?: string; projectId?: string }): Promise<T> {
    const userId = options?.userId || getCurrentUserId();
    const projectId = options?.projectId;
    writeCache(userId, namespace, data, projectId);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, projectId, namespace, data }),
      });
    } catch {
      // Ignore network errors
    }
    return data;
  },

  async listSettings(namespacePrefix: string, options?: { userId?: string; projectId?: string }): Promise<SettingsEntry[]> {
    const userId = options?.userId || getCurrentUserId();
    const projectId = options?.projectId;
    try {
      const params = new URLSearchParams({ user_id: userId, namespace_prefix: namespacePrefix });
      if (projectId) params.set('project_id', projectId);
      const response = await fetch(`/api/settings/list?${params.toString()}`);
      if (response.ok) {
        const data = (await response.json()) as { entries?: SettingsEntry[] };
        return data.entries || [];
      }
    } catch {
      // Ignore network errors
    }
    return [];
  },

  async deleteSetting(namespace: string, options?: { userId?: string; projectId?: string }): Promise<boolean> {
    const userId = options?.userId || getCurrentUserId();
    const projectId = options?.projectId;
    try {
      const params = new URLSearchParams({ user_id: userId, namespace });
      if (projectId) params.set('project_id', projectId);
      const response = await fetch(`/api/settings?${params.toString()}`, { method: 'DELETE' });
      if (response.ok) {
        return true;
      }
    } catch {
      // Ignore network errors
    }
    return false;
  },
};

export default settingsService;
