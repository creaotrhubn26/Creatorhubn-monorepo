import settingsService from './settingsService';

export type AdminUser = {
  id: number | string;
  email: string;
  role: string;
  display_name: string;
  name?: string;
  loginAs?: string;
  requestedRole?: string | null;
};

export type AuthSession = {
  adminUser?: AdminUser | null;
  currentUserId?: string | null;
  sessionToken?: string | null;
  selectedProfession?: string | null;
  lastUpdated?: string | null;
};

export type RoleContextUpdate = {
  role?: string;
  loginAs?: string | null;
  requestedRole?: string | null;
  selectedProfession?: string | null;
};

type SessionWindow = Window & {
  __currentUserId?: string;
  __roleRoomAuthToken?: string;
};

const SESSION_USER_ID = 'auth-session';
const SESSION_NAMESPACE = 'virtualStudio_authSession';
const TOKEN_STORAGE_KEY = 'role_room_auth_token';

let sessionCache: AuthSession = {};
let hydrated = false;
let hydratePromise: Promise<AuthSession> | null = null;

const updateWindowUserId = (userId?: string | null) => {
  if (typeof window === 'undefined') return;
  const sessionWindow = window as SessionWindow;
  if (userId) {
    sessionWindow.__currentUserId = userId;
  } else {
    delete sessionWindow.__currentUserId;
  }
};

const updateWindowAuthToken = (token?: string | null) => {
  if (typeof window === 'undefined') return;
  const sessionWindow = window as SessionWindow;
  if (token) {
    sessionWindow.__roleRoomAuthToken = token;
  } else {
    delete sessionWindow.__roleRoomAuthToken;
  }
};

const persistTokenMirror = (token?: string | null) => {
  updateWindowAuthToken(token);
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures.
  }
};

const readTokenMirror = (): string | null => {
  if (typeof window === 'undefined') return null;
  const sessionWindow = window as SessionWindow;
  if (typeof sessionWindow.__roleRoomAuthToken === 'string' && sessionWindow.__roleRoomAuthToken.trim()) {
    return sessionWindow.__roleRoomAuthToken.trim();
  }
  try {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
};

const broadcastUpdate = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('auth-session-updated'));
};


const persistSession = async (session: AuthSession): Promise<void> => {
  sessionCache = session;
  if (session.currentUserId) {
    updateWindowUserId(session.currentUserId);
  } else if (session.adminUser?.id !== undefined && session.adminUser?.id !== null) {
    updateWindowUserId(String(session.adminUser.id));
  } else {
    updateWindowUserId(undefined);
  }
  persistTokenMirror(session.sessionToken);
  await settingsService.setSetting(SESSION_NAMESPACE, session, { userId: SESSION_USER_ID });
  broadcastUpdate();
};

export const authSessionService = {
  async loadSession(): Promise<AuthSession> {
    if (hydrated) return sessionCache;
    if (hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      try {
        const cached = await settingsService.getSetting<AuthSession>(SESSION_NAMESPACE, {
          userId: SESSION_USER_ID,
        });
        if (cached) {
          sessionCache = cached;
          updateWindowUserId(cached.currentUserId || (cached.adminUser?.id ? String(cached.adminUser.id) : null));
          persistTokenMirror(cached.sessionToken);
          hydrated = true;
          return cached;
        }

      } catch {
        // Ignore hydrate errors
      }

      hydrated = true;
      return sessionCache;
    })();

    const result = await hydratePromise;
    hydratePromise = null;
    return result;
  },

  getSessionSync(): AuthSession {
    return sessionCache;
  },

  getSessionTokenSync(): string | null {
    if (typeof sessionCache.sessionToken === 'string' && sessionCache.sessionToken.trim()) {
      return sessionCache.sessionToken.trim();
    }
    return readTokenMirror();
  },

  getAuthHeadersSync(): Record<string, string> {
    const sessionToken = this.getSessionTokenSync();
    if (sessionToken) {
      return { Authorization: `Bearer ${sessionToken}` };
    }

    if (typeof window !== 'undefined') {
      try {
        const fallbackToken = window.localStorage.getItem('creatorhub_auth_token');
        if (fallbackToken && fallbackToken.trim()) {
          return { Authorization: `Bearer ${fallbackToken.trim()}` };
        }
      } catch {
        // Ignore storage failures.
      }
    }

    return {};
  },

  async setAdminUser(adminUser: AdminUser | null): Promise<void> {
    const next: AuthSession = {
      ...sessionCache,
      adminUser,
      currentUserId: adminUser?.id ? String(adminUser.id) : sessionCache.currentUserId,
      lastUpdated: new Date().toISOString(),
    };
    await persistSession(next);
  },

  async setSelectedProfession(roleId: string | null): Promise<void> {
    const next: AuthSession = {
      ...sessionCache,
      selectedProfession: roleId,
      lastUpdated: new Date().toISOString(),
    };
    await persistSession(next);
  },

  async updateRoleContext(update: RoleContextUpdate): Promise<void> {
    if (!sessionCache.adminUser) return;

    const nextAdminUser: AdminUser = {
      ...sessionCache.adminUser,
      role: update.role ?? sessionCache.adminUser.role,
      loginAs: update.loginAs === undefined ? sessionCache.adminUser.loginAs : update.loginAs || undefined,
      requestedRole:
        update.requestedRole === undefined
          ? sessionCache.adminUser.requestedRole
          : update.requestedRole,
    };

    const next: AuthSession = {
      ...sessionCache,
      adminUser: nextAdminUser,
      selectedProfession:
        update.selectedProfession === undefined
          ? sessionCache.selectedProfession
          : update.selectedProfession,
      currentUserId:
        nextAdminUser.id !== undefined && nextAdminUser.id !== null
          ? String(nextAdminUser.id)
          : sessionCache.currentUserId,
      lastUpdated: new Date().toISOString(),
    };

    await persistSession(next);
  },

  async setCurrentUserId(userId: string | null): Promise<void> {
    const next: AuthSession = {
      ...sessionCache,
      currentUserId: userId,
      lastUpdated: new Date().toISOString(),
    };
    await persistSession(next);
  },

  async setSessionToken(sessionToken: string | null): Promise<void> {
    const next: AuthSession = {
      ...sessionCache,
      sessionToken,
      lastUpdated: new Date().toISOString(),
    };
    await persistSession(next);
  },

  async clearSession(): Promise<void> {
    sessionCache = {};
    updateWindowUserId(undefined);
    persistTokenMirror(undefined);
    await settingsService.deleteSetting(SESSION_NAMESPACE, { userId: SESSION_USER_ID });
    broadcastUpdate();
  },
};

export default authSessionService;
