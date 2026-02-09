/**
 * Google SSO Service
 * Handles Google OAuth 2.0 authentication
 * Integrates with EnhancedMasterIntegrationProvider's service account impersonation
 */

import { getImpersonatedAccessToken } from '@/lib/google/impersonation';
import { getAllProfessionFeatures } from '../../../shared/profession-feature-matrix';

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  verified_email: boolean;
  // Extended for integration with your system
  role?: 'learner' | 'instructor' | 'admin' | 'prototype_tester';
  profession?: string; // dynamic, DB-backed profession id
  permissions?: string[];
  organization?: string;
  isAdmin?: boolean;
}

export interface GoogleAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token: string;
}

export interface GoogleSSOConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string[];
}

export class GoogleSSOService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private scope: string[];

  private readonly GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
  private readonly GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
  private readonly GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

  constructor(config?: GoogleSSOConfig) {
    this.clientId = config?.clientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    this.clientSecret = config?.clientSecret || import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';
    this.redirectUri = config?.redirectUri || import.meta.env.VITE_GOOGLE_REDIRECT_URI || '';
    this.scope = config?.scope || ['openid','email','profile'];
  }

  /**
   * Generate Google OAuth URL for login
   */
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scope.join(''),
      access_type: 'offline',
      prompt: 'consent',
      ...(state && { state }),
    });

    return `${this.GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Open Google Sign-In popup
   */
  async signInWithPopup(): Promise<GoogleAuthResponse> {
    return new Promise((resolve, reject) => {
      const width = 500;
      const height = 600;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const state = this.generateState();
      const authUrl = this.getAuthUrl(state);

      const popup = window.open(
        authUrl,
        'Google Sign In',
        `width=${width},height=${height},left=${left},top=${top}`,
      );

      if (!popup) {
        reject(new Error('Failed to open popup window'));
        return;
      }

      // Listen for messages from popup
      const messageHandler = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        const { type, code, error, receivedState } = event.data;

        if (type === 'google-oauth-callback') {
          window.removeEventListener('message', messageHandler);
          popup?.close();

          if (error) {
            reject(new Error(error));
            return;
          }

          // Verify state to prevent CSRF
          if (receivedState !== state) {
            reject(new Error('State mismatch - possible CSRF attack'));
            return;
          }

          try {
            const tokens = await this.exchangeCodeForTokens(code);
            resolve(tokens);
          } catch (err) {
            reject(err);
          }
        }
      };

      window.addEventListener('message', messageHandler);

      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageHandler);
          reject(new Error('Authentication cancelled'));
        }
      }, 500);
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleAuthResponse> {
    try {
      const response = await fetch(this.GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Failed to exchange code for tokens');
      }

      return await response.json();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Token exchange failed');
    }
  }

  /**
   * Get user info from Google
   */
  async getUserInfo(accessToken: string): Promise<GoogleUser> {
    try {
      const response = await fetch(this.GOOGLE_USERINFO_URL, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      return await response.json();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get user info');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<GoogleAuthResponse> {
    try {
      const response = await fetch(this.GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error_description || 'Failed to refresh token');
      }

      return await response.json();
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Token refresh failed');
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(this.GOOGLE_REVOKE_URL, {
        method: 'POST',
        headers: {
          'Content-Type' : 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ token }),
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to revoke token: ', error);
      return false;
    }
  }

  /**
   * Verify ID token
   */
  async verifyIdToken(idToken: string): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);

      if (!response.ok) {
        throw new Error('Invalid ID token');
      }

      const tokenInfo = (await response.json()) as Record<string, unknown>;

      // Verify token is for this app
      if ((tokenInfo['aud'] as string) !== this.clientId) {
        throw new Error('Token audience mismatch');
      }

      // Verify token hasn't expired
      const exp = Number(tokenInfo['exp']);
      if (Number.isFinite(exp) && Date.now() >= exp * 1000) {
        throw new Error('Token has expired');
      }

      return tokenInfo;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Token verification failed');
    }
  }

  /**
   * Complete sign-in flow
   */
  async signIn(): Promise<{ user: GoogleUser; tokens: GoogleAuthResponse }> {
    try {
      const tokens = await this.signInWithPopup();
      const user = await this.getUserInfo(tokens.access_token);

      // Optionally fetch server profile (DB-backed profession/role)
      const serverProfile = await this.fetchServerProfile();

      // Enhance user with role, profession and permissions
      const enhancedUser: GoogleUser = {
        ...user,
        role: this.determineUserRole(user.email),
        profession: (serverProfile?.profession as string) || this.determineUserProfession(user.email),
        permissions: this.getUserPermissions(user.email),
        organization: import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || 'creatorhubn.com',
        isAdmin: this.isAdminUser(user.email),
      };

      // Store tokens securely
      this.storeTokens(tokens);

      return { user: enhancedUser, tokens };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Sign in failed');
    }
  }

  /**
   * Sign in using service account impersonation (for backend integration)
   * This connects with EnhancedMasterIntegrationProvider's auth system
   */
  async signInWithImpersonation(): Promise<{ user: GoogleUser; token: string }> {
    try {
      // Get impersonated access token from backend
      const token = await getImpersonatedAccessToken();

      // Fetch user info using the impersonated token
      const user = await this.getUserInfo(token);

      const serverProfile = await this.fetchServerProfile();

      // Enhance user with backend role and permissions
      const enhancedUser: GoogleUser = {
        ...user,
        role: this.determineUserRole(user.email),
        profession: (serverProfile?.profession as string) || this.determineUserProfession(user.email),
        permissions: this.getUserPermissions(user.email),
        organization: import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || 'creatorhubn.com',
        isAdmin: this.isAdminUser(user.email),
      };

      // Do not persist token in localStorage; rely on server session/cookies
      return { user: enhancedUser, token };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Impersonation sign in failed');
    }
  }

  /**
   * Determine user role based on email
   */
  private determineUserRole(
    email: string,
  ): 'learner' | 'instructor' | 'admin' | 'prototype_tester' {
    // Prefer server-designated role (if available via /api/auth/user)
    // Fallback to heuristics; no localStorage dependency

    // Admin emails
    const adminEmails = [
      import.meta.env.VITE_GOOGLE_ADMIN_EMAIL,
      import.meta.env.VITE_GOOGLE_IMPERSONATE_USER,
      'daniel@creatorhubn.com',
    ];
    if (adminEmails.includes(email)) return 'admin';

    // Check if instructor based on domain or pattern
    if (email.includes('instructor') || email.includes('teacher')) return 'instructor';

    // Default to learner
    return 'learner';
  }

  /**
   * Determine user profession for UI context
   */
  private determineUserProfession(email: string): string {
    // Prefer server profile when available; otherwise heuristic fallback

    // Basic heuristic fallback (can be replaced by onboarding/profile source)
    if (email.includes('video')) return 'videographer';
    if (email.includes('music')) return 'music_producer';
    if (email.includes('vendor')) return 'vendor';

    return 'photographer';
  }

  /**
   * Get user permissions based on role
   */
  private getUserPermissions(email: string): string[] {
    const role = this.determineUserRole(email);

    let rolePermissions: string[];
    switch (role) {
      case 'admin':
        rolePermissions = [
          'visual-editor','course-management','user-management','admin-access','analytics-full','settings-management',
        ];
        break;
      case 'instructor':
        rolePermissions = [
          'course-creation','course-management','content-management','analytics-basic',
        ];
        break;
      case 'prototype_tester':
        rolePermissions = [
          'test-data-generator','prototype-tester-tools','feedback-tools','beta-features',
        ];
        break;
      case 'learner':
      default:
        rolePermissions = ['course-access','content-view','progress-tracking'];
        break;
    }

    // Merge with profession-specific permissions derived from feature matrix
    // Prefer profession from persisted user (server-backed), fallback to heuristic
    let profession: string | null = null;
    // Server-side profession is preferred; callers pass merged enhancedUser where possible
    profession = this.determineUserProfession(email);
    let professionPermissions: string[] = [];
    if (profession) {
      const features = getAllProfessionFeatures(profession).filter((f) => f.enabled);
      if (features.length > 0) {
        professionPermissions = features.map((f) => `feature:${f.featureId}`);
      } else {
        // Fallback to a base feature set for unknown professions
        const base = getAllProfessionFeatures('photographer').filter((f) => f.enabled);
        professionPermissions = base.map((f) => `feature:${f.featureId}`);
      }
    }

    // De-duplicate when merging
    const merged = Array.from(new Set([...rolePermissions, ...professionPermissions]));
    return merged;
  }

  /**
   * Fetch server profile (includes DB-backed profession if available) - DISABLED
   */
  private async fetchServerProfile(): Promise<Partial<GoogleUser> | null> {
    // Authentication disabled - return mock admin profile
    return {
      email: 'admin@local.dev',
      name: 'Local Admin',
      role: 'admin',
      profession: 'photographer'
    };
  }

  /**
   * Check if user is admin
   */
  private isAdminUser(email: string): boolean {
    const adminEmails = [
      import.meta.env.VITE_GOOGLE_ADMIN_EMAIL,
      import.meta.env.VITE_GOOGLE_IMPERSONATE_USER,
      'daniel@creatorhubn.com',
    ];
    return adminEmails.includes(email);
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    const tokens = this.getStoredTokens();

    if (tokens?.access_token) {
      await this.revokeToken(tokens.access_token);
    }

    this.clearTokens();
  }

  /**
   * Store tokens securely in localStorage - DISABLED
   */
  private storeTokens(tokens: GoogleAuthResponse): void {
    // Authentication disabled - no token storage needed
  }

  /**
   * Get stored tokens
   */
  getStoredTokens(): GoogleAuthResponse | null {
    // Prefer server-managed tokens; client should not access raw tokens
    return null;
  }

  /**
   * Clear stored tokens - DISABLED
   */
  private clearTokens(): void {
    // Authentication disabled - no token clearing needed
  }

  /**
   * Generate random state for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(',');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const tokens = this.getStoredTokens();
    return tokens !== null;
  }

  /**
   * Get current user info if authenticated
   */
  async getCurrentUser(): Promise<GoogleUser | null> {
    const tokens = this.getStoredTokens();

    if (!tokens) return null;

    try {
      return await this.getUserInfo(tokens.access_token);
    } catch {
      // Token might be expired, try to refresh
      if (tokens.refresh_token) {
        try {
          const newTokens = await this.refreshAccessToken(tokens.refresh_token);
          this.storeTokens(newTokens);
          return await this.getUserInfo(newTokens.access_token);
        } catch {
          this.clearTokens();
          return null;
        }
      }

      this.clearTokens();
      return null;
    }
  }
}

// Singleton instance
export const googleSSOService = new GoogleSSOService();
