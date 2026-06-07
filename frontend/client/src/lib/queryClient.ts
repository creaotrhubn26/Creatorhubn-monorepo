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

function buildApiUrl(url: string): string {
  const normalizedUrl = normalizeRequestUrl(url);
  const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || '';
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';

  if (normalizedUrl.startsWith('http')) {
    return normalizedUrl;
  }

  return isDevelopment || !apiBaseUrl
    ? normalizedUrl
    : `${apiBaseUrl}${normalizedUrl}`;
}

async function hydrateStoredUserFromToken(token: string): Promise<Record<string, unknown> | null> {
  if (typeof window === 'undefined' || !token.trim()) {
    return null;
  }

  try {
    const response = await fetch(buildApiUrl('/api/auth/user'), {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token.trim()}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json().catch(() => null) as
      | { authenticated?: boolean; user?: Record<string, unknown> | null }
      | null;

    const user = payload?.authenticated && payload.user && typeof payload.user === 'object'
      ? payload.user
      : null;
    const userId = typeof user?.id === 'string'
      ? user.id.trim()
      : typeof user?.userId === 'string'
        ? user.userId.trim()
        : '';
    const userEmail = typeof user?.email === 'string'
      ? user.email.trim().toLowerCase()
      : typeof user?.userEmail === 'string'
        ? user.userEmail.trim().toLowerCase()
        : '';

    if (!user || !userId || !userEmail) {
      return null;
    }

    localStorage.setItem('creatorhub_auth_user', JSON.stringify(user));
    localStorage.setItem('userId', userId);
    localStorage.setItem('userEmail', userEmail);
    window.dispatchEvent(new Event('auth-changed'));
    return user;
  } catch {
    return null;
  }
}

/**
 * Get authorization header for API requests
 */
export async function getAuthHeader(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  try {
    // Role Room logger inn via Google Workspace og lagrer tokenet i
    // role_room_auth_token (TOKEN_STORAGE_KEY i authSessionService).
    // Uten denne fallback-en sender apiRequest fetch UTEN Bearer-token
    // når brukeren kom inn via Role Room-flowen → 401-flom på alle
    // /api/casting/projects + /api/settings-kall.
    const token =
      localStorage.getItem('creatorhub_auth_token') ||
      localStorage.getItem('role_room_auth_token') ||
      localStorage.getItem('token') ||
      '';
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const storedUserRaw = localStorage.getItem('creatorhub_auth_user');
    let storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
    let userIdCandidate =
      storedUser?.id ||
      storedUser?.userId ||
      localStorage.getItem('userId') ||
      '';
    let userEmailCandidate =
      storedUser?.email ||
      storedUser?.userEmail ||
      localStorage.getItem('userEmail') ||
      '';

    if (token && (!userIdCandidate || !userEmailCandidate)) {
      const hydratedUser = await hydrateStoredUserFromToken(token);
      if (hydratedUser) {
        storedUser = hydratedUser;
        userIdCandidate =
          storedUser?.id ||
          storedUser?.userId ||
          localStorage.getItem('userId') ||
          '';
        userEmailCandidate =
          storedUser?.email ||
          storedUser?.userEmail ||
          localStorage.getItem('userEmail') ||
          '';
      }
    }

    if (typeof userIdCandidate === 'string' && userIdCandidate.trim().length > 0) {
      headers['x-user-id'] = userIdCandidate.trim();
    }

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
  '/api/analytics/realtime',
  '/api/analytics/traffic-sources',
  '/api/analytics/top-events',
  '/api/analytics/top-pages',
  '/api/ai/analytics/insights',
  '/api/ai/analytics/predictions',
  '/api/ai/analytics/report',
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

/**
 * Like apiRequest, but returns the raw Response instead of parsing JSON —
 * for endpoints that stream binary (e.g. the RAW→JPEG preview). Reuses the
 * same base-URL resolution and auth headers so it works in prod (where the
 * API lives on a different origin) exactly like apiRequest.
 */
export async function apiFetch(url: string, options?: ApiRequestOptions): Promise<Response> {
  const authHeaders = await getAuthHeader();
  const fullUrl = buildApiUrl(url);
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
    requestOptions.body = body as BodyInit;
  }
  return fetch(fullUrl, requestOptions);
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
    // Slice 9X.60 iter 3 — Tidligere: HVER 401 fra HVILKEN SOM HELST endpoint
    // ryddet auth-state. Dette kicket bruker ut fra dashboard hvis ÉN spesifikk
    // query (f.eks. /api/onboarding/status, /api/admin/x, role-baserte
    // endepunkter) returnerte 401. Resultatet var bounce-loop etter login.
    //
    // Ny logikk: clear KUN hvis 401 kommer fra auth-spesifikke endepunkter
    // som faktisk indikerer at sesjonen er ugyldig (ikke bare "denne
    // ressursen krever annen permission"). For andre 401-er logger vi en
    // advarsel og lar useAuth selv avgjøre via /api/auth/user.
    if (response.status === 401) {
      // Slice 9X.60 — Clear KUN på 401 fra auth-spesifikke endepunkter.
      // Andre 401-er er permission-issues (rolle-/feature-flag-baserte
      // queries), ikke logout-grunn. Tidligere: enhver 401 wipet hele
      // sesjonen → user bouncet etter login fordi /api/onboarding/status
      // eller lignende returnerte 401.
      const isAuthEndpoint = /\/(auth|session)\/(user|me|status|validate|refresh)\b/i.test(normalizedUrl);
      // RoleRoom/dance/casting/talent — disse krever Bearer-token og
      // backend returnerer 401 KUN når token ikke kan resolves. Det er
      // alltid en stale-session-situasjon, ikke en permission-feil.
      const isRoleRoomAuthed = /^\/api\/(dance|role-room|casting|talent|cms)\b/i.test(normalizedUrl);

      if (isAuthEndpoint || isRoleRoomAuthed) {
        // Broadcast event slik at globalt SessionExpiredModal kan vise
        // brukervennlig melding + re-login-knapp. Vi clearer ikke auth-
        // staten her — modalen styrer det basert på user-handling.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('creatorhub:session-expired', {
              detail: {
                returnUrl: window.location.pathname + window.location.search,
                triggeredBy: normalizedUrl,
                isAuthEndpoint,
              },
            }),
          );
        }
        if (isAuthEndpoint) {
          // Auth-spesifikke endpoints clearer fortsatt umiddelbart
          // (token er definitivt død — bruker var allerede logget ut)
          clearClientAuthState();
        }
      }
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
