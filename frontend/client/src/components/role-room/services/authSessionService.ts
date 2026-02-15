import settingsService from './settingsService';

export type AdminUser = {
  id: number | string;
  email: string;
  role: string;
  display_name: string;
};

export type AuthSession = {
  adminUser?: AdminUser | null;
  currentUserId?: string | null;
  selectedProfession?: string | null;
  lastUpdated?: string | null;
};

type SessionWindow = Window & { __currentUserId?: string };

const SESSION_USER_ID = 'auth-session';
const SESSION_NAMESPACE = 'virtualStudio_authSession';

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

  async setCurrentUserId(userId: string | null): Promise<void> {
    const next: AuthSession = {
      ...sessionCache,
      currentUserId: userId,
      lastUpdated: new Date().toISOString(),
    };
    await persistSession(next);
  },

  async clearSession(): Promise<void> {
    sessionCache = {};
    updateWindowUserId(undefined);
    await settingsService.deleteSetting(SESSION_NAMESPACE, { userId: SESSION_USER_ID });
    broadcastUpdate();
  },
};

export default authSessionService;
