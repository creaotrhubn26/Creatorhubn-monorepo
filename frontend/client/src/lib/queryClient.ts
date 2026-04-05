import { QueryClient } from '@tanstack/react-query';
import { normalizeRequestUrl } from './normalizeRequestUrl';

const AUTH_STORAGE_KEYS = [
  'creatorhub_auth_token',
  'creatorhub_auth_user',
  'userId',
  'userEmail',
  'token',
] as const;

function clearClientAuthState() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    for (const key of AUTH_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
    window.dispatchEvent(new Event('auth-changed'));
  } catch {
    // Ignore storage cleanup errors.
  }
}

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

    const userEmailCandidate =
      storedUser?.email ||
      storedUser?.userEmail ||
      '';
    if (typeof userEmailCandidate === 'string' && userEmailCandidate.trim().length > 0) {
      headers['x-user-email'] = userEmailCandidate.trim().toLowerCase();
    }
  } catch {
    // Ignore storage parse issues and fall back to anonymous headers.
  }

  return headers;
}

// Prefer same-origin /api on CreatorHub unless an explicit backend URL is configured.
const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || '';

// These admin/analytics feeds are not deployed on the current production backend yet.
// Guarding them client-side avoids noisy 404 spam and lets the UI render stable placeholders.
const KNOWN_UNAVAILABLE_API_ENDPOINTS = new Set([
  '/api/integrations/features',
  '/api/admin/dashboard',
  '/api/admin/crm/overview',
  '/api/admin/billing/overview',
  '/api/admin/analytics/platform',
  '/api/admin/audit/recent',
  '/api/admin/system/health',
  '/api/admin/integrations/status',
  '/api/admin/security/status',
  '/api/admin/automations/status',
  '/api/admin/platform-stats',
  '/api/admin/profession-stats',
  '/api/admin/academy/analytics/overview',
  '/api/academy/admin/revenue/overview',
  '/api/admin/email-conversion-stats',
  '/api/admin/activity-feed',
  '/api/admin/pending-counts',
  '/api/admin/analytics/cancellations',
  '/api/admin/analytics/refunds',
  '/api/admin/analytics/revenue-trends',
  '/api/admin/analytics/churn-rate',
  '/api/analytics/realtime',
  '/api/analytics/traffic-sources',
  '/api/analytics/top-events',
  '/api/analytics/top-pages',
  '/api/ai/analytics/insights',
  '/api/ai/analytics/predictions',
  '/api/ai/analytics/report',
  '/api/seo-bot/analytics',
  '/api/seo-bot/crawl-budget',
  '/api/seo-bot/mobile-tests',
  '/api/seo-bot/recommendations',
  '/api/seo-bot/visits',
]);

export function isKnownUnavailableApiEndpoint(url: string): boolean {
  const normalizedUrl = normalizeRequestUrl(url);
  const pathname = normalizedUrl.startsWith('http')
    ? new URL(normalizedUrl).pathname
    : normalizedUrl.split('?')[0];

  return KNOWN_UNAVAILABLE_API_ENDPOINTS.has(pathname);
}

// Default fetcher for React Query with OAuth support
type ApiRequestOptions = Omit<RequestInit, 'body'> & {
  body?: BodyInit | Record<string, unknown>;
};

export function isApiEndpointMissing(error: unknown): boolean {
  const record = typeof error === 'object' && error !== null
    ? (error as { status?: unknown; message?: unknown })
    : null;
  const status = typeof record?.status === 'number' ? record.status : undefined;
  const message = String(record?.message ?? error ?? '');

  return (
    status === 404 ||
    message.includes('404') ||
    /endpoint not implemented/i.test(message) ||
    /cannot (get|post|put|delete)/i.test(message)
  );
}

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
    : isDevelopment || !API_BASE_URL
      ? normalizedUrl
      : `${API_BASE_URL}${normalizedUrl}`;

  const { body, headers: callerHeaders, ...restOptions } = options ?? {};
  const isFormData = body instanceof FormData;
  const requestOptions: RequestInit = {
    ...restOptions,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders,
      ...callerHeaders,
    },
  };

  if (isSerializableBody(body)) {
    requestOptions.body = JSON.stringify(body);
  } else if (body !== undefined) {
    requestOptions.body = body;
  }

  const response = await fetch(fullUrl, requestOptions);

  if (!response.ok) {
    if (response.status === 401) {
      clearClientAuthState();
    }

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
