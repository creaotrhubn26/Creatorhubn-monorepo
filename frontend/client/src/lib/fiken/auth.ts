/**
 * Fiken OAuth Authentication
 * Client-side authentication utilities for Fiken API integration
 */

import type { FikenOAuthTokens } from '@/../../shared/types/fiken';
import { FikenAuthState } from '@/../../shared/types/fiken';

const FIKEN_OAUTH_URL = 'https://fiken.no/oauth/authorize';
const FIKEN_TOKEN_URL = 'https://fiken.no/oauth/token';
const FIKEN_API_BASE_URL = 'https://api.fiken.no/api/v2';

/**
 * Get Fiken OAuth configuration from environment
 */
export function getFikenOAuthConfig() {
  return {
    clientId: process.env.NEXT_PUBLIC_FIKEN_CLIENT_ID || '',
    redirectUri: `${window.location.origin}/api/fiken/callback`,
    scopes: ['read','write'],
  };
}

/**
 * Generate OAuth state parameter for CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join(',');
}

/**
 * Store OAuth state in sessionStorage
 */
export function storeOAuthState(state: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('fiken_oauth_state', state);
  }
}

/**
 * Verify OAuth state matches stored value
 */
export function verifyOAuthState(state: string): boolean {
  if (typeof window === 'undefined') return false;

  const storedState = sessionStorage.getItem('fiken_oauth_state');
  sessionStorage.removeItem('fiken_oauth_state');

  return storedState === state;
}

/**
 * Build Fiken OAuth authorization URL
 */
export function buildFikenAuthUrl(): string {
  const config = getFikenOAuthConfig();
  const state = generateOAuthState();

  storeOAuthState(state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope: config.scopes.join(', '),
  });

  return `${FIKEN_OAUTH_URL}?${params.toString()}`;
}

/**
 * Initiate Fiken OAuth flow
 */
export function initiateFikenOAuth(): void {
  const authUrl = buildFikenAuthUrl();
  window.location.href = authUrl;
}

/**
 * Exchange authorization code for access token (backend call)
 */
export async function exchangeCodeForToken(code: string): Promise<FikenOAuthTokens> {
  const response = await fetch('/api/fiken/token', {
    method: 'POST',
    headers: {
      'Content-Type' : 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to exchange code for token');
  }

  return response.json();
}

/**
 * Refresh access token using refresh token (backend call)
 */
export async function refreshFikenToken(refreshToken: string): Promise<FikenOAuthTokens> {
  const response = await fetch('/api/fiken/token/refresh', {
    method: 'POST',
    headers: {
      'Content-Type' : 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to refresh token');
  }

  return response.json();
}

/**
 * Get current Fiken access token (from database via backend)
 */
export async function getFikenAccessToken(userId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/fiken/token?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type' : 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.accessToken || null;
  } catch (error) {
    console.error('Failed to get Fiken access token: ', error);
    return null;
  }
}

/**
 * Disconnect Fiken integration (revoke tokens)
 */
export async function disconnectFiken(userId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/fiken/disconnect?userId=${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type' : 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to disconnect Fiken:', error);
    return false;
  }
}

/**
 * Check if user has active Fiken integration
 */
export async function checkFikenConnection(userId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/fiken/status?userId=${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type' : 'application/json',
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.isConnected || false;
  } catch (error) {
    console.error('Failed to check Fiken connection:', error);
    return false;
  }
}

/**
 * Get Fiken companies accessible to user
 */
export async function getFikenCompanies(accessToken: string): Promise<any[]> {
  try {
    const response = await fetch(`${FIKEN_API_BASE_URL}/companies`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch Fiken companies');
    }

    return response.json();
  } catch (error) {
    console.error('Failed to get Fiken companies:', error);
    return [];
  }
}

/**
 * Build authorization header for Fiken API calls
 */
export function buildFikenAuthHeader(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}
