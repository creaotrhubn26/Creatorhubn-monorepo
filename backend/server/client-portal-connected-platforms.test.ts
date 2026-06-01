import { describe, expect, it } from 'vitest';

import {
  normalizeConnectionStatus,
  loadConnectedPlatforms,
  PLATFORM_ORDER,
} from './client-portal-connected-platforms.js';

const NOW = new Date('2026-06-01T12:00:00.000Z');

describe('normalizeConnectionStatus', () => {
  it('null/manglende rad → not_connected', () => {
    expect(normalizeConnectionStatus(null, NOW)).toBe('not_connected');
    expect(normalizeConnectionStatus(undefined, NOW)).toBe('not_connected');
  });

  it('tom eller disconnected state → not_connected', () => {
    expect(normalizeConnectionStatus({ connectionState: '' }, NOW)).toBe('not_connected');
    expect(normalizeConnectionStatus({ connectionState: 'disconnected' }, NOW)).toBe('not_connected');
  });

  it('connected uten utløp → connected', () => {
    expect(normalizeConnectionStatus({ connectionState: 'connected' }, NOW)).toBe('connected');
  });

  it('connected men utløpt token → expired', () => {
    const status = normalizeConnectionStatus(
      { connectionState: 'connected', expiryDate: '2026-05-01T00:00:00.000Z' },
      NOW,
    );
    expect(status).toBe('expired');
  });

  it('connected med fremtidig utløp → connected', () => {
    const status = normalizeConnectionStatus(
      { connectionState: 'connected', expiryDate: '2026-07-01T00:00:00.000Z' },
      NOW,
    );
    expect(status).toBe('connected');
  });

  it('expired/revoked/error går rett gjennom', () => {
    expect(normalizeConnectionStatus({ connectionState: 'expired' }, NOW)).toBe('expired');
    expect(normalizeConnectionStatus({ connectionState: 'revoked' }, NOW)).toBe('revoked');
    expect(normalizeConnectionStatus({ connectionState: 'error' }, NOW)).toBe('error');
  });

  it('ukjent state behandles konservativt som not_connected', () => {
    expect(normalizeConnectionStatus({ connectionState: 'banana' }, NOW)).toBe('not_connected');
  });
});

describe('loadConnectedPlatforms', () => {
  it('returnerer alle plattformer i fast rekkefølge, degraderer trygt når tabeller mangler', async () => {
    // Fake-pool der hver query kaster (simulerer DB uten migrasjoner kjørt).
    const throwingPool = {
      query: async () => {
        throw new Error('relation does not exist');
      },
    } as unknown as Parameters<typeof loadConnectedPlatforms>[0];

    const platforms = await loadConnectedPlatforms(throwingPool, 'proj-x', NOW);
    expect(platforms.map((p) => p.platform)).toEqual(PLATFORM_ORDER);
    // Alt skal være not_connected (ingen tokens lekket, ingen krasj).
    expect(platforms.every((p) => p.status === 'not_connected')).toBe(true);
    expect(platforms.every((p) => p.accountName === null)).toBe(true);
  });

  it('mapper en koblet LinkedIn-rad og avleder Facebook fra Instagram-side', async () => {
    const fakePool = {
      query: async (sql: string, params: unknown[]) => {
        if (/casting_projects/.test(sql)) {
          return { rows: [{ accountName: 'producer-1' }] };
        }
        if (/role_room_linkedin_connections/.test(sql)) {
          return {
            rows: [
              {
                connectionState: 'connected',
                expiryDate: '2026-12-01T00:00:00.000Z',
                accountName: 'Stig Produsent',
                updatedAt: '2026-05-20T10:00:00.000Z',
              },
            ],
          };
        }
        if (/role_room_instagram_connections/.test(sql)) {
          return {
            rows: [
              {
                connectionState: 'connected',
                expiryDate: '2026-08-01T00:00:00.000Z',
                accountName: 'northwind.official',
                facebookPageName: 'Northwind Drilling',
                facebookPageId: 'fb-page-123',
                updatedAt: '2026-05-22T09:00:00.000Z',
              },
            ],
          };
        }
        // tiktok + google → ingen rad
        void params;
        return { rows: [] };
      },
    } as unknown as Parameters<typeof loadConnectedPlatforms>[0];

    const platforms = await loadConnectedPlatforms(fakePool, 'proj-1', NOW);
    const byKey = Object.fromEntries(platforms.map((p) => [p.platform, p]));

    expect(byKey.linkedin.status).toBe('connected');
    expect(byKey.linkedin.accountName).toBe('Stig Produsent');
    expect(byKey.instagram.status).toBe('connected');
    expect(byKey.instagram.accountName).toBe('northwind.official');
    // Facebook avledet fra IG-siden
    expect(byKey.facebook.status).toBe('connected');
    expect(byKey.facebook.accountName).toBe('Northwind Drilling');
    // Ingen TikTok/Google-rad → not_connected
    expect(byKey.tiktok.status).toBe('not_connected');
    expect(byKey.google.status).toBe('not_connected');
  });
});
