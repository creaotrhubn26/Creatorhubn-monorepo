import { describe, expect, it, vi } from 'vitest';

import { createCastingManuscriptRevisionsService } from './casting-manuscript-revisions-service.js';

const createHarness = (options: { maxAutomaticSnapshots?: number } = {}) => {
  let revisions: Array<Record<string, unknown>> = [];
  let manuscript: Record<string, unknown> = {
    id: 'manuscript-1',
    projectId: 'project-1',
    title: 'Troll',
    content: 'Gjeldende tekst',
    version: 7,
  };
  let now = new Date('2026-09-10T10:00:00.000Z');
  const manuscriptsService = {
    getRevisions: vi.fn(async () => revisions),
    replaceRevisions: vi.fn(async (_id: string, next: Array<Record<string, unknown>>) => {
      revisions = next;
      return next;
    }),
    getManuscript: vi.fn(async () => manuscript),
    replaceManuscript: vi.fn(async (_id: string, next: Record<string, unknown>) => {
      manuscript = { ...next, version: Number(manuscript.version) + 1 };
      return manuscript;
    }),
  } as any;
  const service = createCastingManuscriptRevisionsService({
    manuscriptsService,
    now: () => now,
    automaticSnapshotIntervalMs: 5 * 60 * 1000,
    maxAutomaticSnapshots: options.maxAutomaticSnapshots ?? 2,
  });

  return {
    service,
    manuscriptsService,
    getRevisions: () => revisions,
    setRevisions: (next: Array<Record<string, unknown>>) => { revisions = next; },
    setNow: (next: string) => { now = new Date(next); },
    setManuscript: (next: Record<string, unknown>) => { manuscript = next; },
  };
};

describe('casting manuscript revision history', () => {
  it('captures a durable cloud snapshot, deduplicates it, and retains manual revisions', async () => {
    const harness = createHarness();
    harness.setRevisions([{
      id: 'manual-1',
      manuscriptId: 'manuscript-1',
      kind: 'manual',
      version: 'Draft 1',
      content: 'Manuell tekst',
      createdAt: '2026-09-10T09:00:00.000Z',
    }]);
    const cloudV7 = {
      id: 'manuscript-1',
      projectId: 'project-1',
      title: 'Troll',
      content: 'Skytekst v7',
      version: 7,
    };

    const first = await harness.service.captureAutomaticSnapshot(
      'manuscript-1',
      cloudV7,
      { actorUserId: 'user-1' },
    );
    const duplicate = await harness.service.captureAutomaticSnapshot(
      'manuscript-1',
      cloudV7,
      { actorUserId: 'user-1' },
    );

    expect(first).toMatchObject({
      kind: 'automatic_snapshot',
      content: 'Skytekst v7',
      sourceCloudVersion: 7,
      createdBy: 'user-1',
    });
    expect(duplicate).toBeNull();
    expect(harness.getRevisions().filter((entry) => entry.kind === 'automatic_snapshot')).toHaveLength(1);
    expect(harness.getRevisions().some((entry) => entry.id === 'manual-1')).toBe(true);
  });

  it('time-buckets automatic snapshots and prunes only old automatic entries', async () => {
    const harness = createHarness({ maxAutomaticSnapshots: 2 });
    const capture = async (content: string, version: number) => harness.service.captureAutomaticSnapshot(
      'manuscript-1',
      { id: 'manuscript-1', projectId: 'project-1', content, version },
      { actorUserId: 'user-1' },
    );

    await capture('A', 1);
    harness.setNow('2026-09-10T10:01:00.000Z');
    expect(await capture('B', 2)).toBeNull();
    harness.setNow('2026-09-10T10:06:00.000Z');
    await capture('C', 3);
    harness.setNow('2026-09-10T10:12:00.000Z');
    await capture('D', 4);

    const automatic = harness.getRevisions().filter((entry) => entry.kind === 'automatic_snapshot');
    expect(automatic).toHaveLength(2);
    expect(automatic.map((entry) => entry.content)).toEqual(['C', 'D']);
  });

  it('restores only manuscript fields and preserves the replaced cloud state', async () => {
    const harness = createHarness();
    harness.setManuscript({
      id: 'manuscript-1',
      projectId: 'project-1',
      title: 'Troll',
      content: 'Ny tekst som skal bevares',
      status: 'draft',
      version: 7,
    });
    harness.setRevisions([{
      id: 'revision-2',
      manuscriptId: 'manuscript-1',
      kind: 'manual',
      version: '2.0',
      content: 'Eldre tekst',
      changesSummary: 'Denne metadataen skal ikke inn i manuset',
      createdAt: '2026-09-09T10:00:00.000Z',
    }]);

    const result = await harness.service.restoreRevision('manuscript-1', 'revision-2', 'user-1');

    expect(result?.manuscript).toMatchObject({ content: 'Eldre tekst', version: 8 });
    expect(result?.manuscript).not.toHaveProperty('changesSummary');
    expect(harness.getRevisions().at(-1)).toMatchObject({
      kind: 'before_restore',
      content: 'Ny tekst som skal bevares',
      createdBy: 'user-1',
      restoredFromRevisionId: 'revision-2',
    });
  });

  it('restores legacy revisions that stored the manuscript in a nested field', async () => {
    const harness = createHarness();
    harness.setRevisions([{
      id: 'legacy-revision',
      manuscriptId: 'manuscript-1',
      manuscript: {
        content: 'Historisk tekst',
        title: 'Historisk tittel',
        createdBy: 'must-not-leak',
      },
    }]);

    const result = await harness.service.restoreRevision('manuscript-1', 'legacy-revision', 'user-1');

    expect(result?.manuscript).toMatchObject({
      content: 'Historisk tekst',
      title: 'Historisk tittel',
    });
    expect(result?.manuscript).not.toHaveProperty('createdBy');
  });
});
