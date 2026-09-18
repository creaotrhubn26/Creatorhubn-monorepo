import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootstrapCreatorHubLinkedInLoginRedirect,
  buildCreatorHubLinkedInReturnPath,
  fetchCreatorHubLinkedInLoginEnabled,
  hasCreatorHubLinkedInCallbackState,
  readCreatorHubLinkedInCallbackIntent,
} from './creatorhubLinkedInAuth';
import {
  CREATORHUB_AUTH_TOKEN_KEY,
  CREATORHUB_AUTH_USER_KEY,
  CREATORHUB_GOOGLE_LOGIN_ERROR_KEY,
} from './creatorhubGoogleAuth';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('readCreatorHubLinkedInCallbackIntent', () => {
  it('reads status, transfer and message and ignores unknown statuses', () => {
    const params = new URLSearchParams('chLinkedInStatus=success&chLinkedInTransfer=t-1');
    expect(readCreatorHubLinkedInCallbackIntent(params)).toEqual({ status: 'success', transferId: 't-1', message: null });
    expect(readCreatorHubLinkedInCallbackIntent(new URLSearchParams('chLinkedInStatus=weird')).status).toBeNull();
    expect(hasCreatorHubLinkedInCallbackState(new URLSearchParams('chLinkedInMessage=x'))).toBe(true);
    expect(hasCreatorHubLinkedInCallbackState(new URLSearchParams('chGoogleStatus=x'))).toBe(false);
  });
});

describe('buildCreatorHubLinkedInReturnPath', () => {
  it('strips only the LinkedIn callback params from the current URL', () => {
    window.history.replaceState({}, '', '/leadgrid/markedsforing?ws=1&chLinkedInStatus=error&chLinkedInMessage=x#top');
    expect(buildCreatorHubLinkedInReturnPath()).toBe('/leadgrid/markedsforing?ws=1#top');
  });
});

describe('bootstrapCreatorHubLinkedInLoginRedirect', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.history.replaceState({}, '', '/');
  });

  it('completes a successful transfer, stores the session and cleans the URL', async () => {
    window.history.replaceState({}, '', '/workspace?chLinkedInStatus=success&chLinkedInTransfer=t-9');
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/api/auth/linkedin/session-result/t-9');
      return jsonResponse(200, {
        success: true,
        sessionToken: 'tok-1',
        user: { id: 'user-1', email: 'Kari@Example.com', name: 'Kari Nordmann', role: 'member', picture: 'https://cdn/x.jpg' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await bootstrapCreatorHubLinkedInLoginRedirect();

    expect(window.localStorage.getItem(CREATORHUB_AUTH_TOKEN_KEY)).toBe('tok-1');
    const stored = JSON.parse(window.localStorage.getItem(CREATORHUB_AUTH_USER_KEY) ?? '{}');
    expect(stored).toMatchObject({ id: 'user-1', email: 'kari@example.com', picture: 'https://cdn/x.jpg', verified_email: true });
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/workspace');
    expect(window.sessionStorage.getItem(CREATORHUB_GOOGLE_LOGIN_ERROR_KEY)).toBeNull();
  });

  it('surfaces a callback error through the shared login-error key', async () => {
    window.history.replaceState({}, '', '/login?chLinkedInStatus=error&chLinkedInMessage=Innloggingen%20ble%20avbrutt.');
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    await bootstrapCreatorHubLinkedInLoginRedirect();

    const raw = window.sessionStorage.getItem(CREATORHUB_GOOGLE_LOGIN_ERROR_KEY);
    expect(raw && JSON.parse(raw).message).toBe('Innloggingen ble avbrutt.');
    expect(window.localStorage.getItem(CREATORHUB_AUTH_TOKEN_KEY)).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('does nothing without callback params', async () => {
    window.history.replaceState({}, '', '/login');
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await bootstrapCreatorHubLinkedInLoginRedirect();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchCreatorHubLinkedInLoginEnabled', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('is false when the backend is unreachable and true only on enabled:true', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
    expect(await fetchCreatorHubLinkedInLoginEnabled()).toBe(false);
    globalThis.fetch = vi.fn(async () => jsonResponse(200, { enabled: true })) as unknown as typeof fetch;
    expect(await fetchCreatorHubLinkedInLoginEnabled()).toBe(true);
  });
});
