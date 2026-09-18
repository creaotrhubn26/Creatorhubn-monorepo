/**
 * Logg inn med LinkedIn (web). Speiler creatorhubGoogleAuth.ts:
 *
 *   startCreatorHubLinkedInLogin()        → POST /api/auth/linkedin/oauth/start → LinkedIn
 *   (callback)                            → returnPath?chLinkedInStatus=success&chLinkedInTransfer=…
 *   bootstrapCreatorHubLinkedInLoginRedirect() ved oppstart
 *     → GET /api/auth/linkedin/session-result/:id (one-shot) → storeCreatorHubAuthSession
 *
 * Feil legges i samme sessionStorage-nøkkel som Google-feil, så
 * innloggingsmodalen viser dem uten egen kode.
 */
import {
  fetchCreatorHubJson,
  normalizeCreatorHubAuthUser,
  storeCreatorHubAuthSession,
  writeCreatorHubLoginError,
  type CreatorHubAuthUser,
} from './creatorhubGoogleAuth';
import { isLeadgridDedicatedHost } from '@/components/role-room/utils/runtime';

/**
 * Logg inn med LinkedIn hører til Leadgrid-flaten. Den samme LoginModal brukes
 * av CreatorHub (/login), admin-hosten og Role Room, og der skal knappen ikke
 * vises. Sann på en Leadgrid-dedikert host (leadgrid.no) og på /leadgrid-stier
 * når Leadgrid serveres fra en delt host (/leadgrid/login).
 */
export function isLeadgridLoginSurface(location?: { hostname?: string; pathname?: string }): boolean {
  const host = location?.hostname
    ?? (typeof window !== 'undefined' ? window.location.hostname : undefined);
  const path = location?.pathname
    ?? (typeof window !== 'undefined' ? window.location.pathname : undefined);

  if (isLeadgridDedicatedHost(host)) {
    return true;
  }
  const normalized = (path ?? '').trim().toLowerCase();
  return normalized === '/leadgrid' || normalized.startsWith('/leadgrid/');
}

const LINKEDIN_CALLBACK_PARAMS = ['chLinkedInStatus', 'chLinkedInTransfer', 'chLinkedInMessage'] as const;

export type CreatorHubLinkedInCallbackIntent = {
  status: 'success' | 'error' | null;
  transferId: string | null;
  message: string | null;
};

type LinkedInTransferResponse = {
  success?: boolean;
  sessionToken?: string | null;
  user?: Record<string, unknown> | null;
  isNew?: boolean;
  error?: string;
};

export function readCreatorHubLinkedInCallbackIntent(params: URLSearchParams): CreatorHubLinkedInCallbackIntent {
  const status = params.get('chLinkedInStatus');
  return {
    status: status === 'success' || status === 'error' ? status : null,
    transferId: params.get('chLinkedInTransfer'),
    message: params.get('chLinkedInMessage'),
  };
}

export function hasCreatorHubLinkedInCallbackState(params: URLSearchParams): boolean {
  return LINKEDIN_CALLBACK_PARAMS.some((param) => params.has(param));
}

function removeLinkedInCallbackParams(url: URL): void {
  LINKEDIN_CALLBACK_PARAMS.forEach((param) => url.searchParams.delete(param));
}

export function buildCreatorHubLinkedInReturnPath(): string {
  if (typeof window === 'undefined') return '/';
  const url = new URL(window.location.href);
  removeLinkedInCallbackParams(url);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function clearCreatorHubLinkedInIntentFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  removeLinkedInCallbackParams(url);
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

/** Om knappen skal vises. Feil → skjult (forebygg en knapp som ikke virker). */
export async function fetchCreatorHubLinkedInLoginEnabled(): Promise<boolean> {
  try {
    const response = await fetchCreatorHubJson<{ enabled?: boolean }>('/api/auth/linkedin/login-status');
    return response.enabled === true;
  } catch {
    return false;
  }
}

export async function startCreatorHubLinkedInLogin(options?: { returnPath?: string }): Promise<void> {
  if (typeof window === 'undefined') return;
  const response = await fetchCreatorHubJson<{ authorizationUrl?: string }>('/api/auth/linkedin/oauth/start', {
    method: 'POST',
    body: {
      browserOrigin: window.location.origin,
      returnPath: options?.returnPath ?? buildCreatorHubLinkedInReturnPath(),
    },
  });
  if (!response.authorizationUrl) {
    throw new Error('Kunne ikke starte LinkedIn-innloggingen.');
  }
  window.location.assign(response.authorizationUrl);
}

export async function completeCreatorHubLinkedInLoginTransfer(transferId: string): Promise<CreatorHubAuthUser> {
  const transfer = await fetchCreatorHubJson<LinkedInTransferResponse>(
    `/api/auth/linkedin/session-result/${encodeURIComponent(transferId)}`,
  );
  if (!transfer.sessionToken || !transfer.user) {
    throw new Error('LinkedIn-innloggingen mangler en gyldig brukerøkt.');
  }
  const user = normalizeCreatorHubAuthUser({ ...transfer.user, verified_email: true });
  if (!user) {
    throw new Error('Klarte ikke å lese brukeren fra LinkedIn-innloggingen.');
  }
  storeCreatorHubAuthSession(transfer.sessionToken, user);
  return user;
}

export async function bootstrapCreatorHubLinkedInLoginRedirect(): Promise<void> {
  if (typeof window === 'undefined') return;
  const intent = readCreatorHubLinkedInCallbackIntent(new URLSearchParams(window.location.search));
  if (!intent.status) return;

  try {
    if (intent.status === 'error') {
      throw new Error(intent.message || 'LinkedIn-innloggingen feilet.');
    }
    if (!intent.transferId) return;
    await completeCreatorHubLinkedInLoginTransfer(intent.transferId);
  } catch (error) {
    writeCreatorHubLoginError(error instanceof Error ? error.message : 'LinkedIn-innloggingen feilet.');
  } finally {
    clearCreatorHubLinkedInIntentFromUrl();
  }
}
