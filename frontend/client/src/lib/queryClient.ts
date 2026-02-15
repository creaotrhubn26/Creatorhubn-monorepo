import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';

// Token cache for auth header
let cachedAuthToken = { token: "", exp: 0 };

/**
 * Get authorization header for API requests
 */
async function getAuthHeader(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  try {
    const token =
      localStorage.getItem('creatorhub_auth_token') ||
      localStorage.getItem('token') ||
      '';
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const storedUserRaw = localStorage.getItem('creatorhub_auth_user');
    const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
    const userIdCandidate =
      storedUser?.id ||
      storedUser?.userId ||
      localStorage.getItem('userId') ||
      '';
    if (typeof userIdCandidate === 'string' && userIdCandidate.trim().length > 0) {
      headers['x-user-id'] = userIdCandidate.trim();
    }
  } catch {
    // Ignore storage parse issues and fall back to anonymous headers.
  }

  return headers;
}

// Backend API URL from environment — points to Render backend in production
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://evendi.onrender.com';

// Default fetcher for React Query with OAuth support
type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown>;
};

export async function apiRequest(url: string, options?: ApiRequestOptions) {
  // Get auth headers from EnhancedMasterIntegrationProvider
  const authHeaders = await getAuthHeader();

  // In development, use relative URLs (Vite proxy). In production, use full Render backend URL.
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
  const fullUrl = url.startsWith('http') 
    ? url 
    : isDevelopment 
      ? url
      : `${API_BASE_URL}${url}`;

  const isFormData = options?.body instanceof FormData;
  const requestOptions: RequestInit = {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders,
      ...options?.headers
    },
    ...options
  };

  const shouldSerializeBody =
    options?.body &&
    typeof options.body === 'object' &&
    !(options.body instanceof FormData) &&
    !(options.body instanceof Blob) &&
    !(options.body instanceof ArrayBuffer) &&
    !(options.body instanceof URLSearchParams) &&
    !ArrayBuffer.isView(options.body);

  if (shouldSerializeBody) {
    requestOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(fullUrl, requestOptions);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status}: ${errorText}`);
}

  return response.json();
}

// Create React Query client AFTER apiRequest is defined
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
