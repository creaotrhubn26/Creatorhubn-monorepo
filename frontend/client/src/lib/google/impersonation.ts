/**
 * Client-side Google Impersonation Authentication
 * Calls backend API endpoint for token impersonation
 * Backend handles the actual authentication (see server/lib/google/impersonation.ts)
 */

export async function getImpersonatedAccessToken(scopes: string[] = []): Promise<string> {
  try {
    const response = await fetch('/api/auth/google/token', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ scopes }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get impersonated token: ${response.statusText}`);
    }

    const data = await response.json();
    return data.token || data.access_token;
  } catch (error) {
    console.error('Failed to get impersonated access token:', error);
    throw error;
  }
}

export async function getAuthHeader(scopes?: string[]) {
  const token = await getImpersonatedAccessToken(scopes);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Get authenticated Google API client
 * Note: This is a stub - actual OAuth2 client creation should be done server-side
 * For client-side usage, use the access token directly in API calls
 */
export async function getAuthenticatedClient(scopes: string[] = []) {
  const token = await getImpersonatedAccessToken(scopes);
  // Return a simple object that can be used for API calls
  return {
    getAccessToken: async () => ({ token }),
    setCredentials: () => {},
    credentials: { access_token: token },
  };
}





















