// @vitest-environment jsdom
// Porten til Admin Room. Den avgjørende egenskapen: en gammel produkteier-
// email i localStorage skal ikke åpne noe. Verifisert i produksjon at den
// gjorde nettopp det — linsen åpnet for danielqazi99@gmail.com fordi en
// tidligere sesjon hadde lagt igjen daniel@creatorhubn.com lokalt.
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSuperAdminGate } from './useSuperAdminGate';

const OWNER = 'daniel@creatorhubn.com';
const OTHER = 'danielqazi99@gmail.com';

const mockServer = (email: string | null, ok = true) => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok,
    json: async () => (email ? { user: { email } } : {}),
  })));
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('useSuperAdminGate', () => {
  it('opens only when the server confirms the owner', async () => {
    mockServer(OWNER);
    const { result } = renderHook(() => useSuperAdminGate());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isSuperAdmin).toBe(true);
    expect(result.current.email).toBe(OWNER);
  });

  it('stays shut when a stale owner email lingers in localStorage', async () => {
    window.localStorage.setItem('userEmail', OWNER);
    mockServer(OTHER);

    const { result } = renderHook(() => useSuperAdminGate());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isSuperAdmin).toBe(false);
    expect(result.current.email).toBe(OTHER);
  });

  it('stays shut when the server cannot answer', async () => {
    window.localStorage.setItem('userEmail', OWNER);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));

    const { result } = renderHook(() => useSuperAdminGate());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isSuperAdmin).toBe(false);
  });

  it('is not ready before the server has answered', () => {
    mockServer(OWNER);
    const { result } = renderHook(() => useSuperAdminGate());

    expect(result.current.ready).toBe(false);
    expect(result.current.isSuperAdmin).toBe(false);
  });
});
