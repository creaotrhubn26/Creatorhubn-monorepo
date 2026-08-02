/// <reference types="vite/client" />
import { isRoleRoomStandaloneRuntime } from '../utils/runtime';
import { applyProfessionModeFromRole } from '../config/professionMode';

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

export type RoleRoomLoginUser = {
  id: number | string;
  email: string;
  role: string;
  display_name: string;
  name?: string;
  loginAs?: string;
  requestedRole?: string | null;
};

type SessionWindow = Window & {
  __currentUserId?: string;
  __roleRoomAuthToken?: string;
};

const TOKEN_STORAGE_KEY = 'role_room_auth_token';
const SESSION_STORAGE_KEY = 'role_room_auth_session';

let sessionCache: AuthSession = {};
let hydrated = false;
let hydratePromise: Promise<AuthSession> | null = null;

const readCreatorHubFallbackToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const token = window.localStorage.getItem('creatorhub_auth_token');
    return typeof token === 'string' && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
};

const shouldDiscardTokenlessStandaloneSession = (session: AuthSession | null | undefined): boolean => {
  if (typeof window === 'undefined') return false;
  if (!session?.adminUser || session.sessionToken) return false;
  if (readTokenMirror() || readCreatorHubFallbackToken()) return false;
  if (!isRoleRoomStandaloneRuntime()) return false;

  const hostname = window.location.hostname.trim().toLowerCase();
  const isLocalStandaloneRuntime =
    import.meta.env.DEV ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local');

  return !isLocalStandaloneRuntime;
};

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

const readStoredSession = (): AuthSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AuthSession | null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeStoredSession = (session: AuthSession): void => {
  if (typeof window === 'undefined') return;
  try {
    if (session.adminUser || session.currentUserId || session.sessionToken || session.selectedProfession) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      return;
    }
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
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
  writeStoredSession(session);
  broadcastUpdate();
};

export const authSessionService = {
  async loadSession(): Promise<AuthSession> {
    if (hydrated) return sessionCache;
    if (hydratePromise) return hydratePromise;

    hydratePromise = (async () => {
      // Feide/redirect-innlogging: ?rr_session=<token> i URL → adopter sesjonen
      // (backend har alt mintet den; vi henter brukeren og lagrer lokalt).
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const rrToken = params.get('rr_session');
          if (rrToken) {
            params.delete('rr_session');
            const clean = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
            window.history.replaceState({}, '', clean);
            try {
              const res = await fetch('/api/auth/user', { headers: { Authorization: `Bearer ${rrToken}` } });
              if (res.ok) {
                const data = (await res.json()) as { user?: { id: string | number; email?: string; name?: string; role?: string } | null };
                const u = data.user;
                if (u?.id != null) {
                  await persistSession({
                    adminUser: { id: u.id, email: u.email ?? '', role: u.role ?? 'user', display_name: u.name ?? u.email ?? '', name: u.name },
                    currentUserId: String(u.id),
                    sessionToken: rrToken,
                    selectedProfession: 'education',
                    lastUpdated: new Date().toISOString(),
                  });
                  const adopted = readStoredSession();
                  if (adopted) sessionCache = adopted;
                  applyProfessionModeFromRole('education');
                  hydrated = true;
                  return sessionCache;
                }
              }
            } catch { /* fall through til vanlig hydrering */ }
          }
        }
      } catch { /* ignore — URL/history utilgjengelig */ }

      const cached = readStoredSession();
      if (cached) {
        if (shouldDiscardTokenlessStandaloneSession(cached)) {
          sessionCache = {};
          updateWindowUserId(undefined);
          persistTokenMirror(undefined);
          writeStoredSession({});
          hydrated = true;
          return sessionCache;
        }

        sessionCache = cached;
        updateWindowUserId(cached.currentUserId || (cached.adminUser?.id ? String(cached.adminUser.id) : null));
        persistTokenMirror(cached.sessionToken);
        // Ved re-hydrering (retur-besøk / provisjonert innlogging): rout til
        // utdannings-workspacet fra lagret profession hvis ingen eksplisitt
        // modus alt er valgt.
        applyProfessionModeFromRole(cached.selectedProfession);
        hydrated = true;
        return cached;
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
      const fallbackToken = readCreatorHubFallbackToken();
      if (fallbackToken) {
        return { Authorization: `Bearer ${fallbackToken}` };
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
    // Bro profession → ProfessionMode: en provisjonert utdanningsinstitusjon
    // (selectedProfession='education') routes til utdannings-workspacet uten
    // manuelt modus-valg. Rører kun education (annet → no-op).
    applyProfessionModeFromRole(roleId);
  },

  async updateRoleContext(update: RoleContextUpdate): Promise<void> {
    if (!sessionCache.adminUser) return;
    const normalizedAccountRole = String(sessionCache.adminUser.role || '').trim().toLowerCase();
    if (normalizedAccountRole !== 'admin' && normalizedAccountRole !== 'owner') return;

    const nextAdminUser: AdminUser = {
      ...sessionCache.adminUser,
      // Keep the underlying account role stable for admins/owners. Preview mode
      // should only change the scoped Role Room context, not strip admin powers.
      role: sessionCache.adminUser.role,
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

  async applyRoleRoomLogin(user: RoleRoomLoginUser, sessionToken?: string | null): Promise<void> {
    const normalizedUser: AdminUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      display_name: user.display_name,
      name: user.name ?? user.display_name,
      loginAs: user.loginAs,
      requestedRole: user.requestedRole ?? null,
    };

    await persistSession({
      adminUser: normalizedUser,
      currentUserId: String(user.id),
      sessionToken: sessionToken ?? null,
      selectedProfession: user.requestedRole ?? sessionCache.selectedProfession,
      lastUpdated: new Date().toISOString(),
    });
  },

  async clearSession(): Promise<void> {
    sessionCache = {};
    updateWindowUserId(undefined);
    persistTokenMirror(undefined);
    writeStoredSession({});
    broadcastUpdate();
  },
};

export default authSessionService;
