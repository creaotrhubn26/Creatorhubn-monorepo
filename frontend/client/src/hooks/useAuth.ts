import { useState, useEffect, useCallback } from 'react';
import { useGoogleSSO } from './useGoogleSSO';
import type { GoogleUser } from '../services/GoogleSSOService';

// Prefer same-origin /api on CreatorHub unless an explicit backend URL is configured.
const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || '';
const isDev = typeof window !== 'undefined' && (import.meta.env.DEV || window.location.hostname === 'localhost');

/** Build absolute URL for auth endpoints */
function authUrl(path: string): string {
  return isDev || !API_BASE_URL ? path : `${API_BASE_URL}${path}`;
}

interface User extends Omit<GoogleUser, 'role'> {
  userType?: string;
  loginTime?: string;
  role?: GoogleUser['role'] | 'couple' | 'vendor' | 'super_admin';
  vendorId?: string;
  businessName?: string;
  profession?: string;
  coupleProfileId?: string;
  displayName?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Global cache for auth state to prevent duplicate API calls across component instances
const globalAuthCache: { state: AuthState | null; fetching: boolean; fetched: boolean } = {
  state: null,
  fetching: false,
  fetched: false
};
const authListeners: Set<(state: AuthState) => void> = new Set();

const AUTH_TOKEN_KEY = 'creatorhub_auth_token';
const AUTH_USER_KEY = 'creatorhub_auth_user';
const USER_ID_KEY = 'userId';
const USER_EMAIL_KEY = 'userEmail';
const DEV_ADMIN_DEMO_EMAIL = 'academy-guest@creatorhubn.com';
const DEV_ADMIN_DEMO_PASSWORD = 'guest-access';

const DEFAULT_DEV_USER: User = {
  id: 'local-admin',
  email: 'admin@local.dev',
  name: 'Local Admin',
  picture: '',
  verified_email: true,
  role: 'admin',
  isAdmin: true,
  profession: 'photographer',
  displayName: 'Local Admin',
};

function dispatchAuthChanged() {
  if (typeof window === 'undefined') {
    return;
  }

  const notify = () => window.dispatchEvent(new Event('auth-changed'));
  if (typeof window.queueMicrotask === 'function') {
    window.queueMicrotask(notify);
    return;
  }
  window.setTimeout(notify, 0);
}

function buildDevFallbackUser(storedUser?: User | null): User | null {
  if (!isDev) {
    return null;
  }

  if (storedUser?.id && storedUser?.email) {
    return {
      ...DEFAULT_DEV_USER,
      ...storedUser,
      id: storedUser.id,
      email: storedUser.email,
    };
  }

  return DEFAULT_DEV_USER;
}

function getStoredToken(): string | null {
  try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
}

function getStoredUser(): User | null {
  try {
    const s = localStorage.getItem(AUTH_USER_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function storeAuth(token: string, user: User) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(USER_ID_KEY, user.id);
    localStorage.setItem(USER_EMAIL_KEY, user.email);
    dispatchAuthChanged();
  } catch { /* ignore */ }
}

function storeUserIdentity(user: User) {
  try {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    localStorage.setItem(USER_ID_KEY, user.id);
    localStorage.setItem(USER_EMAIL_KEY, user.email);
    dispatchAuthChanged();
  } catch { /* ignore */ }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    dispatchAuthChanged();
  } catch { /* ignore */ }
}

async function readApiPayload(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function createDevAdminUser(email: string): User {
  return {
    ...DEFAULT_DEV_USER,
    id: 'local-admin',
    email,
    name: 'CreatorHub Admin',
    role: 'admin',
    isAdmin: true,
    displayName: 'CreatorHub Admin',
  };
}

function canUseDevAdminFallback(email: string, password: string): boolean {
  if (!isDev) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  return (
    normalizedEmail === DEV_ADMIN_DEMO_EMAIL &&
    (normalizedPassword.length === 0 ||
      normalizedPassword === 'auto' ||
      normalizedPassword === DEV_ADMIN_DEMO_PASSWORD)
  );
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    if (globalAuthCache.state) {
      return globalAuthCache.state;
    }
    // Check localStorage for existing session
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    if (storedUser && isDev) {
      if (isDev) {
        storeUserIdentity(storedUser);
      }
      return {
        user: storedUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    }
    if (storedUser && storedToken) {
      return {
        user: storedUser,
        isAuthenticated: false,
        isLoading: true,
        error: null,
      };
    }
    const devUser = buildDevFallbackUser(storedUser);
    if (devUser) {
      storeUserIdentity(devUser);
      return {
        user: devUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    }
    return {
      user: null,
      isAuthenticated: false,
      isLoading: !globalAuthCache.fetched,
      error: null,
    };
  });

  const { signOut } = useGoogleSSO();

  const broadcastState = useCallback((state: AuthState) => {
    globalAuthCache.state = state;
    globalAuthCache.fetched = true;
    globalAuthCache.fetching = false;
    setAuthState(state);
    authListeners.forEach(listener => listener(state));
  }, []);

  const checkAuthStatus = useCallback(async (force = false) => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();

    if (isDev && storedUser && !force) {
      storeUserIdentity(storedUser);
      const state: AuthState = {
        user: storedUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
      broadcastState(state);
      return;
    }

    if (storedToken) {
      // Slice 9X.60 — KUN clear stored session ved harde auth-feil (401/403).
      // Et 200 + { authenticated: false } kan komme i kort race-vindu etter
      // login (in-memory cache wiped på Render-restart, DB-fallback enda
      // ikke kjørt). Hvis vi clearer der, bouncer brukeren tilbake til
      // /login selv om token egentlig er gyldig.
      let shouldClearStoredSession = false;
      try {
        const resp = await fetch(authUrl('/api/auth/user'), {
          headers: { 'Authorization': `Bearer ${storedToken}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.authenticated && data.user) {
            storeAuth(storedToken, data.user);
            broadcastState({
              user: data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return;
          }
          // 200 + authenticated:false → behold stored session som fallback
        } else if (resp.status === 401 || resp.status === 403) {
          shouldClearStoredSession = true;
        }
      } catch {
        if (storedUser) {
          broadcastState({
            user: storedUser,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return;
        }
      }

      if (shouldClearStoredSession) {
        clearStoredAuth();
      } else if (storedUser) {
        broadcastState({
          user: storedUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return;
      }
    }

    const devUser = buildDevFallbackUser(storedUser);
    if (devUser) {
      storeUserIdentity(devUser);
      broadcastState({
        user: devUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return;
    }

    // No valid session
    broadcastState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  }, [broadcastState]);

  const login = useCallback(async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const devFallbackLogin = () => {
      const user = createDevAdminUser(normalizedEmail);
      const token = 'dev-admin-local-session';
      storeAuth(token, user);
      broadcastState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return { success: true, token, user };
    };

    const parseLoginError = (response: Response, payload: unknown): string => {
      if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        if (typeof record.error === 'string' && record.error.trim()) {
          return record.error;
        }
        if (typeof record.message === 'string' && record.message.trim()) {
          return record.message;
        }
      }

      if (typeof payload === 'string' && payload.trim()) {
        return payload.trim();
      }

      if (response.status >= 500) {
        return 'Innlogging feilet fordi backend svarte ugyldig eller ikke svarte i det hele tatt.';
      }

      return 'Innlogging feilet';
    };

    // Try /api/auth/login first (new unified endpoint), fallback to /api/couples/login
    let resp: Response;
    let data: any;

    try {
      resp = await fetch(authUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      data = await readApiPayload(resp);
    } catch (_error) {
      if (canUseDevAdminFallback(normalizedEmail, password)) {
        return devFallbackLogin();
      }

      // /api/auth/login not available, try couples login
      resp = await fetch(authUrl('/api/couples/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      data = await readApiPayload(resp);

      if (!resp.ok && canUseDevAdminFallback(normalizedEmail, password)) {
        return devFallbackLogin();
      }
    }

    // Handle new format: { success, token, user }
    if (
      data &&
      typeof data === 'object' &&
      (data as Record<string, unknown>).success &&
      (data as Record<string, unknown>).token &&
      (data as Record<string, unknown>).user
    ) {
      storeAuth(data.token, data.user);
      broadcastState({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return data;
    }

    // Handle deployed format: { couple, sessionToken }
    if (
      data &&
      typeof data === 'object' &&
      (data as Record<string, unknown>).couple &&
      (data as Record<string, unknown>).sessionToken
    ) {
      const user: User = {
        id: data.couple.id,
        email: data.couple.email,
        name: data.couple.displayName || data.couple.email,
        picture: '',
        verified_email: false,
        role: 'couple',
        coupleProfileId: data.couple.id,
        displayName: data.couple.displayName,
      };
      storeAuth(data.sessionToken, user);
      broadcastState({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return { success: true, token: data.sessionToken, user };
    }

    // Error case — /api/auth/login returned 404 HTML, try couples login
    if (
      !resp.ok ||
      (data && typeof data === 'object' && (data as Record<string, unknown>).error)
    ) {
      if (canUseDevAdminFallback(normalizedEmail, password) && resp.status >= 500) {
        return devFallbackLogin();
      }

      // If first attempt was 404 on /api/auth/login, try couples login
      if (resp.status === 404 || (typeof data === 'string' && data.includes('Cannot POST'))) {
        const coupleResp = await fetch(authUrl('/api/couples/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const coupleData = await readApiPayload(coupleResp) as any;

        if (coupleData.couple && coupleData.sessionToken) {
          const user: User = {
            id: coupleData.couple.id,
            email: coupleData.couple.email,
            name: coupleData.couple.displayName || coupleData.couple.email,
            picture: '',
            verified_email: false,
            role: 'couple',
            coupleProfileId: coupleData.couple.id,
            displayName: coupleData.couple.displayName,
          };
          storeAuth(coupleData.sessionToken, user);
          broadcastState({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return { success: true, token: coupleData.sessionToken, user };
        }

        if (coupleData.error) {
          throw new Error(coupleData.error);
        }
      }
      throw new Error(parseLoginError(resp, data));
    }

    if (canUseDevAdminFallback(normalizedEmail, password)) {
      return devFallbackLogin();
    }

    throw new Error(
      typeof data === 'string' && data.trim()
        ? data.trim()
        : 'Ukjent responsformat fra innloggingstjenesten',
    );
  }, [broadcastState]);

  const logout = useCallback(async () => {
    const token = getStoredToken();
    if (token) {
      try {
        await fetch(authUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch { /* ignore */ }
    }

    await signOut();
    clearStoredAuth();

    globalAuthCache.state = null;
    globalAuthCache.fetched = false;
    broadcastState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    window.location.href = '/';
  }, [signOut, broadcastState]);

  useEffect(() => {
    const listener = (state: AuthState) => setAuthState(state);
    authListeners.add(listener);
    void checkAuthStatus();
    return () => { authListeners.delete(listener); };
  }, []);

  useEffect(() => {
    const syncFromStorage = () => {
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();

      if (storedUser && (storedToken || isDev)) {
        broadcastState({
          user: storedUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return;
      }

      const devUser = buildDevFallbackUser(storedUser);
      if (devUser) {
        broadcastState({
          user: devUser,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
        return;
      }

      broadcastState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    };

    window.addEventListener('auth-changed', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);

    return () => {
      window.removeEventListener('auth-changed', syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, [broadcastState]);

  const isPrototypeTester = authState.user?.role === 'prototype_tester';
  const isAdmin = authState.user?.role === 'admin' || authState.user?.role === 'super_admin';
  const isInstructor = authState.user?.role === 'instructor';
  const isCouple = authState.user?.role === 'couple';
  const isVendor = authState.user?.role === 'vendor';

  return {
    ...authState,
    login,
    logout,
    refetch: () => checkAuthStatus(true),
    isPrototypeTester,
    isAdmin,
    isInstructor,
    isCouple,
    isVendor,
  };
}
