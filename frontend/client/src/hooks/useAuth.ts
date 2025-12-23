import { useState, useEffect } from 'react';
import { useGoogleSSO } from './useGoogleSSO';
import type { GoogleUser } from '../services/GoogleSSOService';

interface User extends GoogleUser {
  userType?: string;
  loginTime?: string;
  role?: 'learner' | 'instructor' | 'admin' | 'prototype_tester';
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

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>(() => {
    // Initialize from cache if available
    if (globalAuthCache.state) {
      return globalAuthCache.state;
    }
    return {
      user: null,
      isAuthenticated: false,
      isLoading: !globalAuthCache.fetched,
      error: null,
    };
  });

  const { signOut } = useGoogleSSO();

  const checkAuthStatus = async (force = false) => {
    // If already fetched and not forcing, skip
    if (globalAuthCache.fetched && !force) {
      if (globalAuthCache.state) {
        setAuthState(globalAuthCache.state);
      }
      return;
    }

    // If currently fetching, don't start another fetch
    if (globalAuthCache.fetching && !force) {
      return;
    }

    globalAuthCache.fetching = true;

    try {
      setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/auth/user', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type' : 'application/json',
        },
      });

      let newState: AuthState;
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          newState = {
            user: data.user as User,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          };
        } else {
          newState = {
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          };
        }
      } else {
        // User not authenticated
        newState = {
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        };
      }

      // Update global cache and notify all listeners
      globalAuthCache.state = newState;
      globalAuthCache.fetched = true;
      globalAuthCache.fetching = false;
      setAuthState(newState);
      authListeners.forEach(listener => listener(newState));

    } catch (error) {
      console.error('Auth check error: ', error);
      const errorState: AuthState = {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Failed to check authentication status',
      };
      globalAuthCache.state = errorState;
      globalAuthCache.fetched = true;
      globalAuthCache.fetching = false;
      setAuthState(errorState);
      authListeners.forEach(listener => listener(errorState));
    }
  };

  const logout = async () => {
    try {
      // Use unified Google SSO sign-out (clears OAuth + integration auth state)
      await signOut();

      // Best-effort legacy logout endpoint to clear any remaining session state
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type' : 'application/json',
          },
        });
      } catch (e) {
        console.warn('Legacy /api/auth/logout call failed, continuing logout flow', e);
      }

      const logoutState: AuthState = {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

      // Clear global cache on logout
      globalAuthCache.state = logoutState;
      globalAuthCache.fetched = false;
      setAuthState(logoutState);
      authListeners.forEach(listener => listener(logoutState));

      // Redirect to home page after logout
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      setAuthState((prev) => ({
        ...prev,
        error: 'Failed to logout',
      }));
    }
  };

  useEffect(() => {
    // Register this component as a listener for auth state changes
    const listener = (state: AuthState) => setAuthState(state);
    authListeners.add(listener);

    // Only fetch if not already fetched
    void checkAuthStatus();

    return () => {
      authListeners.delete(listener);
    };
  }, []);

  // Derived state for user roles
  const isPrototypeTester = authState.user?.role === 'prototype_tester';
  const isAdmin = authState.user?.role === 'admin';
  const isInstructor = authState.user?.role ==='instructor';

  return {
    ...authState,
    logout,
    refetch: () => checkAuthStatus(true), // Force refetch when explicitly called
    // Role checks
    isPrototypeTester,
    isAdmin,
    isInstructor,
  };
}
