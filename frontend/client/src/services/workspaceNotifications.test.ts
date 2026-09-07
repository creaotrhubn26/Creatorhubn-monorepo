/**
 * Tester for varsel-klienten.
 *
 * Denne finnes på grunn av en konkret feil: AdminWorkspace leste
 * `data.items`, mens /api/notifications/inbox svarer med
 * `{ notifications: [...] }` i camelCase. Innboksen var derfor PERMANENT
 * tom — også når backend hadde data — og fordi den samme koden svelget
 * feil ved å returnere [], så «backend nede» helt identisk ut som «ingen
 * varsler».
 *
 * Testene under låser begge halvdelene: riktig konvolutt-nøkkel, og at
 * feil KASTER i stedet for å bli til en tom liste.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { workspaceNotificationsApi } from './adminRoomApi';

const originalFetch = globalThis.fetch;

function mockResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('workspaceNotificationsApi.inbox', () => {
  it('leser { notifications: [...] } — konvolutten backend faktisk sender', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockResponse({
        notifications: [
          {
            id: 'n1',
            title: 'Ny lead',
            message: 'Kari har fylt ut skjemaet',
            type: 'info',
            priority: 'high',
            actionLabel: 'Åpne',
            actionUrl: '/leads/1',
            createdAt: '2026-09-07T10:00:00Z',
          },
        ],
      }),
    );

    const items = await workspaceNotificationsApi.inbox();

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: 'n1',
      title: 'Ny lead',
      message: 'Kari har fylt ut skjemaet',
      type: 'info',
      priority: 'high',
      actionLabel: 'Åpne',
      actionUrl: '/leads/1',
      createdAt: '2026-09-07T10:00:00Z',
    });
  });

  it('godtar også en bar array, som noen eldre kall returnerer', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockResponse([{ id: 'n2', title: 'Varsel' }]),
    );

    const items = await workspaceNotificationsApi.inbox();
    expect(items.map((n) => n.id)).toEqual(['n2']);
  });

  it('gir tom liste når det faktisk ikke er varsler', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse({ notifications: [] }));
    await expect(workspaceNotificationsApi.inbox()).resolves.toEqual([]);
  });

  it('KASTER ved HTTP-feil — «nede» skal ikke se ut som «tomt»', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockResponse({ error: 'Kunne ikke hente varsler' }, false, 500),
    );

    await expect(workspaceNotificationsApi.inbox()).rejects.toThrow(/500/);
  });

  it('tar med serverens feilmelding, så flaten kan vise hva som gikk galt', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockResponse({ error: 'Databasen svarer ikke' }, false, 503),
    );

    await expect(workspaceNotificationsApi.inbox()).rejects.toThrow(/Databasen svarer ikke/);
  });

  it('dropper rader uten id i stedet for å rendre tomme kort', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockResponse({ notifications: [{ title: 'uten id' }, { id: 'ok', title: 'med id' }] }),
    );

    const items = await workspaceNotificationsApi.inbox();
    expect(items.map((n) => n.id)).toEqual(['ok']);
  });

  it('normaliserer manglende felter til null, ikke undefined', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockResponse({ notifications: [{ id: 'n3' }] }),
    );

    const [item] = await workspaceNotificationsApi.inbox();
    expect(item.title).toBeNull();
    expect(item.message).toBeNull();
    expect(item.actionUrl).toBeNull();
    expect(item.createdAt).toBeNull();
  });

  it('tåler at id kommer som tall', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      mockResponse({ notifications: [{ id: 7, title: 'numerisk id' }] }),
    );

    const [item] = await workspaceNotificationsApi.inbox();
    expect(item.id).toBe('7');
  });
});

describe('workspaceNotificationsApi.markSeen', () => {
  it('POSTer til seen-endepunktet', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse({ success: true }));

    await workspaceNotificationsApi.markSeen('n1');

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toContain('/api/notifications/n1/seen');
    expect((init as RequestInit).method).toBe('POST');
  });

  it('kaster ved feil, så optimistisk fjerning kan rulles tilbake', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(mockResponse({}, false, 500));
    await expect(workspaceNotificationsApi.markSeen('n1')).rejects.toThrow(/500/);
  });
});
