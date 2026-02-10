import { useState, useEffect, useCallback } from 'react';
import { useGoogleSSO } from './useGoogleSSO';
import type { GoogleUser } from '../services/GoogleSSOService';

// Backend API URL — points to Render backend in production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://evendi.onrender.com';
const isDev = typeof window !== 'undefined' && (import.meta.env.DEV || window.location.hostname === 'localhost');

/** Build absolute URL for auth endpoints */
function authUrl(path: string): string {
  return isDev ? path : `${API_BASE_URL}${path}`;
}

interface User extends GoogleUser {
  userType?: string;
  loginTime?: string;
  role?: 'learner' | 'instructor' | 'admin' | 'prototype_tester' | 'couple' | 'vendor';
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
let globalAuthCache: { state: AuthState | null; fetching: boolean; fetched: boolean } = {
  state: null,
  fetching: false,
  fetched: false
};
const authListeners: Set<(state: AuthState) => void> = new Set();

const AUTH_TOKEN_KEY = 'creatorhub_auth_token';
const AUTH_USER_KEY = 'creatorhub_auth_user';

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
  } catch { /* ignore */ }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch { /* ignore */ }
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    if (globalAuthCache.state) {
      return globalAuthCache.state;
    }
    // Check localStorage for existing session
    const storedUser = getStoredUser();
    const storedToken = getStoredToken();
    if (storedUser && storedToken) {
      return {
        user: storedUser,
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

    if (storedToken && storedUser && !force) {
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
        }
      } catch { /* token invalid */ }
      clearStoredAuth();
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
    // Try /api/auth/login first (new unified endpoint), fallback to /api/couples/login
    let resp: Response;
    let data: any;

    try {
      resp = await fetch(authUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      data = await resp.json();
    } catch {
      // /api/auth/login not available, try couples login
      resp = await fetch(authUrl('/api/couples/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      data = await resp.json();
    }

    // Handle new format: { success, token, user }
    if (data.success && data.token && data.user) {
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
    if (data.couple && data.sessionToken) {
      const user: User = {
        id: data.couple.id,
        email: data.couple.email,
        name: data.couple.displayName || data.couple.email,
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
    if (!resp.ok || data.error) {
      // If first attempt was 404 on /api/auth/login, try couples login
      if (resp.status === 404 || (typeof data === 'string' && data.includes('Cannot POST'))) {
        const coupleResp = await fetch(authUrl('/api/couples/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const coupleData = await coupleResp.json();

        if (coupleData.couple && coupleData.sessionToken) {
          const user: User = {
            id: coupleData.couple.id,
            email: coupleData.couple.email,
            name: coupleData.couple.displayName || coupleData.couple.email,
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
      throw new Error(data.error || 'Innlogging feilet');
    }

    throw new Error('Ukjent responsformat');
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

  const isPrototypeTester = authState.user?.role === 'prototype_tester';
  const isAdmin = authState.user?.role === 'admin';
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
