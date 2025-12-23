import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';

// Token cache for auth header
let cachedAuthToken = { token: "", exp: 0 };

/**
 * Get authorization header for API requests
 */
async function getAuthHeader(): Promise<Record<string, string>> {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid
  if (cachedAuthToken.token && cachedAuthToken.exp > now + 30) {
    return { Authorization: `Bearer ${cachedAuthToken.token}` };
  }

  try {
    // Try to get token from backend
    const response = await fetch('/api/auth/google/token', {
      method: 'POST',
      headers: { 'Content-Type' : 'application/json' },
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      const token = data.access_token || data.token;
      if (token) {
        cachedAuthToken = { token, exp: now + 290 };
        return { Authorization: `Bearer ${token}` };
      }
    }
  } catch (error) {
    console.warn('Failed to get auth token, continuing without auth: ', error);
  }

  // Return empty header if no token available
  return {};
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      queryFn: async ({ queryKey }) => {
        if (Array.isArray(queryKey)) {
          const [url, params] = queryKey;
          if (params && typeof params === 'object') {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                searchParams.append(key, String(value));
            }
          });
            const fullUrl = `${url}?${searchParams.toString()}`;
            return apiRequest(fullUrl);
        }
          return apiRequest(url as string);
      }
        return apiRequest(String(queryKey));
    },
  },
},
});

// Backend API URL from environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://backend-djm5.onrender.com';

// Default fetcher for React Query with OAuth support
export async function apiRequest(url: string, options?: RequestInit) {
  // Get auth headers from EnhancedMasterIntegrationProvider
  const authHeaders = await getAuthHeader();

  // In development, use relative URLs to go through Vite proxy
  // In production, use full URLs
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
  const fullUrl = url.startsWith('http') 
    ? url 
    : isDevelopment 
      ? url  // Use relative URL in dev (goes through Vite proxy)
      : `${API_BASE_URL}${url}`;  // Use full URL in production

  const requestOptions: RequestInit = {
    headers: {
      'Content-Type' : 'application/json',
      ...authHeaders, // Include OAuth headers
      ...options?.headers,
  },
    ...options,
};

  // Serialize body if it's an object
  if (options?.body && typeof options.body ==='object' && !(options.body instanceof FormData)) {
    requestOptions.body = JSON.stringify(options.body);
}

  const response = await fetch(fullUrl, requestOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status}: ${errorText}`);
}

  return response.json();
}
