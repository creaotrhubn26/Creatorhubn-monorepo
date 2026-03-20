import { QueryClient } from '@tanstack/react-query';
import { normalizeRequestUrl } from './normalizeRequestUrl';

/**
 * Get authorization header for API requests
 */
export async function getAuthHeader(): Promise<Record<string, string>> {
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

function isSerializableBody(
  body: BodyInit | Record<string, unknown> | undefined,
): body is Record<string, unknown> {
  return (
    !!body &&
    typeof body === 'object' &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !(body instanceof URLSearchParams) &&
    !ArrayBuffer.isView(body)
  );
}

export async function apiRequest(url: string, options?: ApiRequestOptions) {
  // Get auth headers from EnhancedMasterIntegrationProvider
  const authHeaders = await getAuthHeader();
  const normalizedUrl = normalizeRequestUrl(url);

  // In development, use relative URLs (Vite proxy). In production, use full Render backend URL.
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
  const fullUrl = normalizedUrl.startsWith('http')
    ? normalizedUrl
    : isDevelopment 
      ? normalizedUrl
      : `${API_BASE_URL}${normalizedUrl}`;

  const { body, ...restOptions } = options ?? {};
  const isFormData = body instanceof FormData;
  const requestOptions: RequestInit = {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders,
      ...options?.headers
    },
    ...restOptions
  };

  if (isSerializableBody(body)) {
    requestOptions.body = JSON.stringify(body);
  } else if (body !== undefined) {
    requestOptions.body = body;
  }

  const response = await fetch(fullUrl, requestOptions);

  if (!response.ok) {
    const errorText = await response.text();
    let parsedError: Record<string, unknown> | null = null;

    try {
      const candidate = JSON.parse(errorText) as unknown;
      if (candidate && typeof candidate === 'object') {
        parsedError = candidate as Record<string, unknown>;
      }
    } catch {
      parsedError = null;
    }

    const message = typeof parsedError?.error === 'string'
      ? parsedError.error
      : typeof parsedError?.message === 'string'
        ? parsedError.message
        : errorText;

    const error = new Error(`${response.status}: ${message}`) as Error & {
      status?: number;
      details?: Record<string, unknown> | null;
    };
    error.status = response.status;
    error.details = parsedError;
    throw error;
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
