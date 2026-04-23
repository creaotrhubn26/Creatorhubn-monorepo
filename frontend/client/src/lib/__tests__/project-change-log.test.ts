import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clientOnly,
  fetchProjectChangeLog,
  humanizeChangeLogEntry,
  type ProjectChangeLogEntry,
} from '../project-change-log';

function entry(overrides: Partial<ProjectChangeLogEntry> = {}): ProjectChangeLogEntry {
  return {
    id: 'e1',
    projectId: 'p1',
    kind: 'asset.hearted',
    actorKind: 'client',
    actorLabel: 'Holy Crust',
    payload: {},
    createdAt: '2026-04-22T10:00:00Z',
    ...overrides,
  };
}

describe('humanizeChangeLogEntry', () => {
  it('asset.hearted with hearted=true (or omitted)', () => {
    expect(humanizeChangeLogEntry(entry())).toBe('Holy Crust hjertet et bilde');
    expect(
      humanizeChangeLogEntry(entry({ payload: { hearted: true } })),
    ).toBe('Holy Crust hjertet et bilde');
  });

  it('asset.hearted with hearted=false renders the un-heart phrasing', () => {
    expect(
      humanizeChangeLogEntry(entry({ payload: { hearted: false } })),
    ).toBe('Holy Crust fjernet hjerte fra et bilde');
  });

  it('asset.commented with preview text', () => {
    expect(
      humanizeChangeLogEntry(
        entry({ kind: 'asset.commented', payload: { preview: 'Fint bilde!' } }),
      ),
    ).toBe('Holy Crust kommenterte: "Fint bilde!"');
  });

  it('asset.commented truncates long preview', () => {
    const long = 'a'.repeat(120);
    const rendered = humanizeChangeLogEntry(
      entry({ kind: 'asset.commented', payload: { preview: long } }),
    );
    expect(rendered).toMatch(/^Holy Crust kommenterte: "/);
    expect(rendered.endsWith('…"')).toBe(true);
    // Full string fits within reasonable bounds — 80-char truncate + prefix.
    expect(rendered.length).toBeLessThan(130);
  });

  it('asset.commented without preview', () => {
    expect(
      humanizeChangeLogEntry(entry({ kind: 'asset.commented', payload: {} })),
    ).toBe('Holy Crust la igjen en kommentar');
  });

  it('quote.signed + contract.signed phrasing', () => {
    expect(humanizeChangeLogEntry(entry({ kind: 'quote.signed' }))).toBe(
      'Holy Crust signerte tilbudet',
    );
    expect(humanizeChangeLogEntry(entry({ kind: 'contract.signed' }))).toBe(
      'Holy Crust signerte kontrakten',
    );
  });

  it('falls back to actor kind when actorLabel is missing', () => {
    expect(
      humanizeChangeLogEntry(
        entry({ actorLabel: null, actorKind: 'client' }),
      ),
    ).toBe('Kunden hjertet et bilde');
    expect(
      humanizeChangeLogEntry(
        entry({ actorLabel: '  ', actorKind: 'photographer' }),
      ),
    ).toBe('Fotograf hjertet et bilde');
  });
});

describe('clientOnly', () => {
  it('filters out photographer-initiated entries', () => {
    const mixed = [
      entry({ id: '1', actorKind: 'client' }),
      entry({ id: '2', actorKind: 'photographer' }),
      entry({ id: '3', actorKind: 'client' }),
    ];
    expect(clientOnly(mixed).map((e) => e.id)).toEqual(['1', '3']);
  });
});

describe('fetchProjectChangeLog', () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('GETs the owner-gated endpoint and returns entries', async () => {
    const mock = vi.fn(async () =>
      new Response(JSON.stringify({ entries: [entry({ id: 'x' })] }), {
        status: 200,
      }),
    );
    globalThis.fetch = mock as unknown as typeof fetch;
    const result = await fetchProjectChangeLog('proj-1');
    expect(mock).toHaveBeenCalledWith('/api/projects/proj-1/change-log');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('x');
  });

  it('passes limit + before as query params', async () => {
    const mock = vi.fn(async () =>
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    );
    globalThis.fetch = mock as unknown as typeof fetch;
    await fetchProjectChangeLog('proj-1', {
      limit: 10,
      before: '2026-04-22T10:00:00Z',
    });
    const url = mock.mock.calls[0][0] as string;
    expect(url).toContain('limit=10');
    expect(url).toContain('before=2026-04-22T10');
  });

  it('URL-encodes the projectId', async () => {
    const mock = vi.fn(async () =>
      new Response(JSON.stringify({ entries: [] }), { status: 200 }),
    );
    globalThis.fetch = mock as unknown as typeof fetch;
    await fetchProjectChangeLog('proj with/slash');
    const url = mock.mock.calls[0][0] as string;
    expect(url).toBe('/api/projects/proj%20with%2Fslash/change-log');
  });

  it('throws a readable error on non-ok responses', async () => {
    globalThis.fetch = (async () =>
      new Response('not_found', { status: 404 })) as unknown as typeof fetch;
    await expect(fetchProjectChangeLog('proj-1')).rejects.toThrow(/404/);
  });

  it('returns an empty array when the server sends no entries field', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    expect(await fetchProjectChangeLog('proj-1')).toEqual([]);
  });
});
