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

const parseCacheKey = (key: string): { userId: string; projectId: string; namespace: string } | null => {
  if (!key.startsWith(`${STORAGE_PREFIX}:`)) {
    return null;
  }

  const parts = key.split(':');
  if (parts.length < 4) {
    return null;
  }

  return {
    userId: parts[1] ?? '',
    projectId: parts[2] ?? '',
    namespace: parts.slice(3).join(':'),
  };
};

const readStorage = <T>(key: string): T | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const writeStorage = (key: string, data: unknown): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignore storage failures
  }
};

const deleteStorage = (key: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures
  }
};

const readCache = <T>(userId: string, namespace: string, projectId?: string): T | null => {
  const key = cacheKey(userId, namespace, projectId);
  const cached = settingsCache.get(key) as T | undefined;
  if (cached !== undefined) {
    return cached;
  }

  const stored = readStorage<T>(key);
  if (stored !== null) {
    settingsCache.set(key, stored);
    return stored;
  }

  return null;
};

const writeCache = (userId: string, namespace: string, data: unknown, projectId?: string) => {
  const key = cacheKey(userId, namespace, projectId);
  settingsCache.set(key, data);
  writeStorage(key, data);
};

const deleteCache = (userId: string, namespace: string, projectId?: string) => {
  const key = cacheKey(userId, namespace, projectId);
  settingsCache.delete(key);
  deleteStorage(key);
};

const fetchRemoteSetting = async <T>(
  userId: string,
  namespace: string,
  projectId?: string,
): Promise<T | null> => {
  if (typeof fetch !== 'function') {
    return null;
  }
  const params = new URLSearchParams({
    user_id: userId,
    namespace,
  });
  if (projectId) {
    params.set('project_id', projectId);
  }

  try {
    const response = await fetch(`/api/settings?${params.toString()}`, {
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    const payload = await response.json() as { data?: T | null };
    if (payload.data === undefined || payload.data === null) {
      return null;
    }
    writeCache(userId, namespace, payload.data, projectId);
    return payload.data;
  } catch {
    return null;
  }
};

const writeRemoteSetting = async (
  userId: string,
  namespace: string,
  data: unknown,
  projectId?: string,
): Promise<void> => {
  if (typeof fetch !== 'function') {
    return;
  }
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        namespace,
        projectId,
        data,
      }),
    });
  } catch {
    // Local cache is authoritative while offline; next save will retry.
  }
};

const deleteRemoteSetting = async (
  userId: string,
  namespace: string,
  projectId?: string,
): Promise<void> => {
  if (typeof fetch !== 'function') {
    return;
  }
  const params = new URLSearchParams({
    user_id: userId,
    namespace,
  });
  if (projectId) {
    params.set('project_id', projectId);
  }
  try {
    await fetch(`/api/settings?${params.toString()}`, {
      method: 'DELETE',
    });
  } catch {
    // Ignore network failures; local cache is already cleared.
  }
};

const listCacheEntries = (
  userId: string,
  namespacePrefix: string,
  projectId?: string,
): SettingsEntry[] => {
  const entries = new Map<string, SettingsEntry>();

  const addEntry = (key: string, data: unknown) => {
    const parsed = parseCacheKey(key);
    if (!parsed || parsed.userId !== userId) {
      return;
    }
    if (projectId !== undefined && parsed.projectId !== projectId) {
      return;
    }
    if (!parsed.namespace.startsWith(namespacePrefix)) {
      return;
    }

    entries.set(key, {
      projectId: parsed.projectId,
      namespace: parsed.namespace,
      data,
    });
  };

  for (const [key, value] of settingsCache.entries()) {
    addEntry(key, value);
  }

  if (typeof window !== 'undefined') {
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (!key || entries.has(key) || !key.startsWith(`${STORAGE_PREFIX}:`)) {
          continue;
        }
        const stored = readStorage<unknown>(key);
        if (stored === null) {
          continue;
        }
        settingsCache.set(key, stored);
        addEntry(key, stored);
      }
    } catch {
      // Ignore storage failures
    }
  }

  return Array.from(entries.values()).sort((left, right) => {
    if (left.projectId === right.projectId) {
      return left.namespace.localeCompare(right.namespace, 'nb-NO');
    }
    return left.projectId.localeCompare(right.projectId, 'nb-NO');
  });
};

export const settingsService = {
  async getSetting<T>(namespace: string, options?: { userId?: string; projectId?: string }): Promise<T | null> {
    const userId = options?.userId || getCurrentUserId();
    const projectId = options?.projectId;
    const remote = await fetchRemoteSetting<T>(userId, namespace, projectId);
    if (remote !== null) {
      return remote;
    }
    const cached = readCache<T>(userId, namespace, projectId);
    if (cached !== null) {
      return cached;
    }
    return null;
  },

  async setSetting<T>(namespace: string, data: T, options?: { userId?: string; projectId?: string }): Promise<T> {
    const userId = options?.userId || getCurrentUserId();
    const projectId = options?.projectId;
    writeCache(userId, namespace, data, projectId);
    await writeRemoteSetting(userId, namespace, data, projectId);
    return data;
  },

  async listSettings(namespacePrefix: string, options?: { userId?: string; projectId?: string }): Promise<SettingsEntry[]> {
    const userId = options?.userId || getCurrentUserId();
    const projectId = options?.projectId;
    return listCacheEntries(userId, namespacePrefix, projectId);
  },

  async deleteSetting(namespace: string, options?: { userId?: string; projectId?: string }): Promise<boolean> {
    const userId = options?.userId || getCurrentUserId();
    const projectId = options?.projectId;
    deleteCache(userId, namespace, projectId);
    await deleteRemoteSetting(userId, namespace, projectId);
    return true;
  },
};

export default settingsService;
