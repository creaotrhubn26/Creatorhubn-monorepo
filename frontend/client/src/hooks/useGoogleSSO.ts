import { useState, useEffect, useCallback } from 'react';
import type { GoogleUser } from '../services/GoogleSSOService';
import { googleSSOService } from '../services/GoogleSSOService';
import { useEnhancedMasterIntegration } from '../integration/EnhancedMasterIntegrationProvider';
import {
  buildCreatorHubGoogleReturnPath,
  startCreatorHubGoogleSso,
} from '@/lib/creatorhubGoogleAuth';

/**
 * Hook for Google SSO with service account impersonation support
 * Integrates with EnhancedMasterIntegrationProvider's auth system
 */
export const useGoogleSSO = () => {
  const { auth, analytics } = useEnhancedMasterIntegration();
  const [isInitializing, setIsInitializing] = useState(false);

  // No localStorage persistence for user data; rely on integration provider

  /**
   * Sign in with Google (tries impersonation first, falls back to OAuth)
   */
  const signIn = useCallback(
    async (loginType?: 'general' | 'prototype') => {
      try {
        setIsInitializing(true);

        // Store login type if provided
        if (loginType) {
          localStorage.setItem('login_type', loginType);
        }

        // Try service account impersonation first
        try {
          const result = await googleSSOService.signInWithImpersonation();

          analytics.trackEvent('google_sso_sign_in', {
            method: 'impersonation',
            loginType,
            userRole: result.user.role,
          });

          return result;
        } catch (impersonationError) {
          console.log('Impersonation not available, using CreatorHub Google redirect...');

          analytics.trackEvent('google_sso_sign_in_redirect', {
            loginType,
            reason:
              impersonationError instanceof Error
                ? impersonationError.message
                : 'impersonation_unavailable',
          });

          await startCreatorHubGoogleSso({
            returnPath: buildCreatorHubGoogleReturnPath(),
          });

          return null;
        }
      } catch (error) {
        analytics.trackEvent('google_sso_sign_in_failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        setIsInitializing(false);
      }
    },
    [analytics],
  );

  /**
   * Sign out from Google
   */
  const signOut = useCallback(async () => {
    try {
      await googleSSOService.signOut();
      await auth.logout();

      analytics.trackEvent('google_sso_sign_out', {});
    } catch (error) {
      console.error('Sign out error: ', error);
      throw error;
    }
  }, [auth, analytics]);

  /**
   * Get current user from service or integration provider
   */
  const getCurrentUser = useCallback(async (): Promise<GoogleUser | null> => {
    // First check integration provider
    if (auth.state.isAuthenticated && auth.state.user) {
      const rawRole = String(auth.state.user.role ?? '').trim().replace(/,$/, '');
      const normalizedRole: GoogleUser['role'] =
        rawRole === 'admin' ||
        rawRole === 'prototype_tester' ||
        rawRole === 'learner' ||
        rawRole === 'instructor'
          ? rawRole
          : 'learner';

      return {
        id: auth.state.user.id,
        email: auth.state.user.email,
        name: auth.state.user.name,
        picture: auth.state.user.picture || '',
        verified_email: true,
        role: normalizedRole,
        permissions: auth.state.user.permissions,
        organization: auth.state.user.organization,
        isAdmin: normalizedRole === 'admin',
      };
    }

    // Fallback to SSO service
    return await googleSSOService.getCurrentUser();
  }, [auth.state]);

  /**
   * Check if user is authenticated
   */
  const isAuthenticated = useCallback(() => {
    return auth.state.isAuthenticated || googleSSOService.isAuthenticated();
  }, [auth.state.isAuthenticated]);

  /**
   * Get user's role
   */
  const getUserRole = useCallback(() => {
    return auth.state.user?.role || null;
  }, [auth.state.user]);

  /**
   * Check if user has specific permission
   */
  const hasPermission = useCallback(
    (permission: string) => {
      return auth.hasPermission(permission);
    },
    [auth],
  );

  /**
   * Check if user is admin
   */
  const isAdmin = useCallback(() => {
    return auth.hasRole('admin');
  }, [auth]);

  /**
   * Get authentication header for API calls
   */
  const getAuthHeader = useCallback(async () => {
    return await auth.getAuthHeader();
  }, [auth]);

  return {
    // State
    isAuthenticated: isAuthenticated(),
    isLoading: auth.state.isLoading || isInitializing,
    user: auth.state.user,
    error: auth.state.error,

    // Methods
    signIn,
    signOut,
    getCurrentUser,
    getUserRole,
    hasPermission,
    isAdmin,
    getAuthHeader,

    // Integration provider auth (for advanced usage)
    integrationAuth: auth,
  };
};

export default useGoogleSSO;
