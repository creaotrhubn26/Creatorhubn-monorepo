import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CREATORHUB_DOWNLOAD_WINDOW_DAYS,
  mapCreatorHubMediaAccess,
  restoreCreatorHubMediaAccess,
  startCreatorHubMediaDownloadWindow,
} from './creatorhub-media-access';

const migration = readFileSync(
  new URL('../migrations/0674_creatorhub_media_trust_and_portability.sql', import.meta.url),
  'utf8',
);
const galleryRoutes = readFileSync(new URL('./client-gallery-routes.ts', import.meta.url), 'utf8');
const workspaceRoutes = readFileSync(new URL('./project-workspace-routes.ts', import.meta.url), 'utf8');

describe('CreatorHub 30-day media access policy', () => {
  it('keeps active accounts fully available and has no deletion state', () => {
    expect(mapCreatorHubMediaAccess(null)).toEqual(expect.objectContaining({
      state: 'active', canCreate: true, canDownload: true,
      retentionGuaranteed: true, automaticDeletion: false,
    }));
    expect(migration).not.toMatch(/DELETE FROM|DROP TABLE/i);
    expect(migration).toContain("CHECK (state IN ('active', 'download_only'))");
  });

  it('allows downloads during exactly the 30-day window', () => {
    const now = new Date('2026-09-24T10:00:00.000Z');
    const access = mapCreatorHubMediaAccess({
      state: 'download_only',
      reason: 'payment_failed',
      download_only_started_at: now,
      download_only_until: new Date(now.getTime() + CREATORHUB_DOWNLOAD_WINDOW_DAYS * 86_400_000),
    }, now);
    expect(access).toEqual(expect.objectContaining({
      state: 'download_only', canCreate: false, canDownload: true, daysRemaining: 30,
    }));
  });

  it('locks downloads after the deadline without marking media for deletion', () => {
    const access = mapCreatorHubMediaAccess({
      state: 'download_only',
      download_only_started_at: '2026-08-01T00:00:00.000Z',
      download_only_until: '2026-08-31T00:00:00.000Z',
    }, new Date('2026-09-01T00:00:00.000Z'));
    expect(access).toEqual(expect.objectContaining({
      state: 'expired', canCreate: false, canDownload: false,
      retentionGuaranteed: true, automaticDeletion: false,
    }));
  });

  it('uses the first deadline when Stripe retries the failed payment', async () => {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const firstDeadline = new Date('2026-10-24T10:00:00.000Z');
    const client = {
      query: async (sql: string, params: unknown[] = []) => {
        calls.push({ sql, params });
        if (sql.includes('RETURNING state')) return { rows: [{
          state: 'download_only', reason: 'payment_failed',
          download_only_started_at: new Date('2026-09-24T10:00:00.000Z'),
          download_only_until: firstDeadline,
        }] };
        return { rows: [] };
      },
      release: () => undefined,
    };
    await startCreatorHubMediaDownloadWindow({ connect: async () => client }, {
      userId: 'user-1', reason: 'payment_failed', source: 'stripe', sourceReference: 'in_retry_2',
      effectiveAt: new Date('2026-09-25T10:00:00.000Z'),
    });
    const upsert = calls.find((call) => call.sql.includes('ON CONFLICT (user_id)'));
    expect(upsert?.sql).toContain('LEAST(creatorhub_media_access_windows.download_only_until');
  });

  it('records a restore event when download-only access becomes active', async () => {
    const sql: string[] = [];
    const client = {
      query: async (statement: string) => {
        sql.push(statement);
        if (statement.includes('SELECT state')) return { rows: [{ state: 'download_only' }] };
        return { rows: [] };
      },
      release: () => undefined,
    };
    await restoreCreatorHubMediaAccess({ connect: async () => client }, {
      userId: 'user-1', source: 'stripe', sourceReference: 'in_recovered',
    });
    expect(sql.some((statement) => statement.includes("'access_restored'"))).toBe(true);
  });

  it('gates every gallery download path and the project download routes', () => {
    expect((galleryRoutes.match(/requireOwnerDownloadAccess/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(galleryRoutes).toContain('allowFullSize: mediaAccess.canDownload');
    expect(workspaceRoutes).toContain('error: "download_window_expired"');
    expect(workspaceRoutes).toContain('error: "creatorhub_download_only"');
  });

  it('stores immutable manifest receipts with integrity metadata', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS creatorhub_media_export_receipts');
    expect(migration).toContain('manifest_sha256');
    expect(migration).toContain('verified_checksum_count');
    expect(migration).not.toContain('ON DELETE CASCADE,\n  manifest_sha256');
  });
});
