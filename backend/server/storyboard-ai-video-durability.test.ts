import type { Pool } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { creditMoveMock, emitMeterMock, getSettingsMock } = vi.hoisted(() => ({
  creditMoveMock: vi.fn(),
  emitMeterMock: vi.fn(),
  getSettingsMock: vi.fn(),
}));

vi.mock('./ai-credits.js', () => ({ creditMove: creditMoveMock }));
vi.mock('./generative-media.js', () => ({
  emitGenAiMeter: emitMeterMock,
  getGenSettings: getSettingsMock,
}));

import {
  archiveStoryboardVideoOutput,
  deliverStoryboardVideoBillingSettlementNow,
  downloadTrustedStoryboardVideoOutput,
  enqueueStoryboardVideoBillingSettlement,
  tickLegacyGenerativeAiBillingSettlements,
  tickStoryboardVideoArchiveWorker,
  tickStoryboardVideoBillingSettlements,
  trustedStoryboardVideoOutputUrl,
} from './storyboard-ai-video-durability.js';

beforeEach(() => {
  vi.clearAllMocks();
  getSettingsMock.mockResolvedValue({
    enabled: true,
    billingMode: 'metered',
    dailyCapUsd: 20,
    whitelist: [],
    includedQuota: 0,
    markupMultiplier: 3,
    creditPacks: [],
  });
});

describe('storyboard video billing durability', () => {
  it('never backfills historical generative jobs without an explicit billing intent', async () => {
    const query = vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('legacy-generative-ai-billing:quarantine')) {
        expect(params).toEqual([
          null,
          null,
          '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$',
        ]);
        expect(sql).not.toContain('::timestamptz');
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('legacy-generative-ai-billing:expire')) {
        expect(params).toEqual([null, null]);
        expect(sql).not.toContain('::timestamptz');
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('legacy-generative-ai-billing:claim')) {
        expect(sql).toContain(
          "input#>>'{legacyBilling,mode}' IN ('metered','credits')",
        );
        expect(sql).toContain(
          "input#>>'{legacyBilling,status}' IN ('pending','retry_wait')",
        );
        expect(sql).toContain('FOR UPDATE SKIP LOCKED');
        expect(sql).toContain("AT TIME ZONE 'UTC'");
        expect(sql).toContain('YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
        expect(sql).toContain(
          "input#>>'{legacyBilling,status}'='delivering'",
        );
        expect(sql).toContain(
          "input#>>'{legacyBilling,leaseExpiresAt}' <=",
        );
        expect(sql).not.toContain('::timestamptz');
        expect(params.slice(1)).toEqual([4, 130, null, null]);
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });

    await expect(tickLegacyGenerativeAiBillingSettlements(
      { query } as unknown as Pool,
      { workerId: 'legacy-worker' },
    )).resolves.toEqual({
      quarantined: 0,
      expired: 0,
      claimed: 0,
      completed: 0,
      retrying: 0,
      permanentlyFailed: 0,
      deliveryUnknown: 0,
    });
    expect(emitMeterMock).not.toHaveBeenCalled();
    expect(creditMoveMock).not.toHaveBeenCalled();
  });

  it('persists a stable exact-value credit debit intent before delivery', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ id: 'settlement-1' }] });
    await expect(enqueueStoryboardVideoBillingSettlement({ query } as never, {
      jobId: '11111111-1111-4111-8111-111111111111',
      kind: 'credit_debit',
      userId: 'user-1',
      model: 'higgsfield-dop-i2v',
      amountUsd: 0.81,
      billingMode: 'credits',
    })).resolves.toBe(true);

    expect(query).toHaveBeenCalledOnce();
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (job_id,kind)');
    expect(query.mock.calls[0][0]).toContain('amount_usd=EXCLUDED.amount_usd');
    expect(query.mock.calls[0][1][7]).toBe(
      'job:11111111-1111-4111-8111-111111111111',
    );
  });

  it('delivers a credit debit with the existing ledger idempotency ref', async () => {
    const row = {
      id: 'settlement-1',
      job_id: '11111111-1111-4111-8111-111111111111',
      kind: 'credit_debit',
      user_id: 'user-1',
      model: 'higgsfield-dop-i2v',
      amount_usd: '0.81',
      billing_mode: 'credits',
      external_ref: 'job:11111111-1111-4111-8111-111111111111',
      attempts: 1,
      delivery_deadline_at: null,
      lease_owner: 'worker-now',
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('UPDATE storyboard_ai_video_billing_settlements')) {
        return { rows: [row], rowCount: 1 };
      }
      if (sql.startsWith('WITH completed AS')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected SQL: ${sql}`);
    });
    creditMoveMock.mockResolvedValue(true);

    await expect(deliverStoryboardVideoBillingSettlementNow(
      { query } as unknown as Pool,
      { jobId: row.job_id, kind: 'credit_debit' },
    )).resolves.toBe('completed');
    expect(creditMoveMock).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      'spend',
      -0.81,
      row.external_ref,
      'higgsfield-dop-i2v',
    );
  });

  it('recognizes an already completed debit after a crash before provider claim', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ status: 'completed' }], rowCount: 1 });
    await expect(deliverStoryboardVideoBillingSettlementNow(
      { query } as unknown as Pool,
      {
        jobId: '11111111-1111-4111-8111-111111111111',
        kind: 'credit_debit',
      },
    )).resolves.toBe('completed');
    expect(creditMoveMock).not.toHaveBeenCalled();
  });

  it('retries a refund after a transient ledger read error instead of calling it insufficient', async () => {
    const row = {
      id: 'settlement-refund',
      job_id: '22222222-2222-4222-8222-222222222222',
      kind: 'credit_refund',
      user_id: 'user-2',
      model: 'higgsfield-dop-i2v',
      amount_usd: '0.81',
      billing_mode: 'credits',
      external_ref: 'job-refund:22222222-2222-4222-8222-222222222222',
      attempts: 1,
      delivery_deadline_at: null,
      lease_owner: 'billing-worker',
    };
    const calls: string[] = [];
    const query = vi.fn(async (sql: string) => {
      calls.push(sql);
      if (sql.includes("last_error=COALESCE(last_error,'meter_delivery_window_expired')")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('WITH due AS')) return { rows: [row], rowCount: 1 };
      if (sql.includes('FROM ai_credit_ledger')) throw new Error('db unavailable');
      if (sql.includes("SET status=CASE WHEN kind='meter'")) {
        return { rows: [{ status: 'retry_wait' }], rowCount: 1 };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });
    creditMoveMock.mockResolvedValue(false);

    const stats = await tickStoryboardVideoBillingSettlements(
      { query } as unknown as Pool,
      { workerId: 'billing-worker', batchSize: 50, leaseSeconds: 90 },
    );
    expect(stats).toMatchObject({ claimed: 1, retrying: 1, permanentlyFailed: 0 });
    const claim = query.mock.calls.find(([sql]) =>
      String(sql).includes('WITH due AS'));
    expect(claim?.[1]).toEqual(['billing-worker', 8, 230]);
    expect(calls.some((sql) => sql.includes("SET status='permanent_failed'")))
      .toBe(false);
  });

  it('completes an orphan refund as a no-op instead of minting credits', async () => {
    const jobId = '44444444-4444-4444-8444-444444444444';
    const row = {
      id: 'settlement-orphan-refund',
      job_id: jobId,
      kind: 'credit_refund',
      user_id: 'user-orphan',
      model: 'higgsfield-dop-i2v',
      amount_usd: '0.81',
      billing_mode: 'credits',
      external_ref: `job-refund:${jobId}`,
      attempts: 1,
      delivery_deadline_at: null,
      lease_owner: 'worker-now',
    };
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('UPDATE storyboard_ai_video_billing_settlements')) {
        return { rows: [row], rowCount: 1 };
      }
      if (sql.includes('FROM ai_credit_ledger')) {
        expect(params).toEqual([`job:${jobId}`]);
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes("WHERE job_id=$1 AND kind='credit_debit'")) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.startsWith('WITH completed AS')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected SQL: ${sql}`);
    });

    await expect(deliverStoryboardVideoBillingSettlementNow(
      { query } as unknown as Pool,
      { jobId, kind: 'credit_refund' },
    )).resolves.toBe('completed');
    expect(creditMoveMock).not.toHaveBeenCalled();
  });

  it('fails a refund permanently when the debit ref belongs to different money or ownership', async () => {
    const jobId = '55555555-5555-4555-8555-555555555555';
    const row = {
      id: 'settlement-corrupt-refund',
      job_id: jobId,
      kind: 'credit_refund',
      user_id: 'user-expected',
      model: 'higgsfield-dop-i2v',
      amount_usd: '0.81',
      billing_mode: 'credits',
      external_ref: `job-refund:${jobId}`,
      attempts: 1,
      delivery_deadline_at: null,
      lease_owner: 'worker-now',
    };
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('UPDATE storyboard_ai_video_billing_settlements')) {
        return { rows: [row], rowCount: 1 };
      }
      if (sql.includes('FROM ai_credit_ledger')) {
        expect(params).toEqual([`job:${jobId}`]);
        return {
          rows: [{ user_id: 'different-user', type: 'spend', amount_usd: -0.81 }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('WITH failed AS')) {
        expect(params[1]).toBe('credit_debit_reference_conflict');
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });

    await expect(deliverStoryboardVideoBillingSettlementNow(
      { query } as unknown as Pool,
      { jobId, kind: 'credit_refund' },
    )).resolves.toBe('permanent_failed');
    expect(creditMoveMock).not.toHaveBeenCalled();
  });

  it('refunds a legacy direct debit only when its stable spend ledger matches', async () => {
    const jobId = '66666666-6666-4666-8666-666666666666';
    const row = {
      id: 'settlement-legacy-refund',
      job_id: jobId,
      kind: 'credit_refund',
      user_id: 'user-legacy',
      model: 'higgsfield-dop-i2v',
      amount_usd: '0.81',
      billing_mode: 'credits',
      external_ref: `job-refund:${jobId}`,
      attempts: 1,
      delivery_deadline_at: null,
      lease_owner: 'worker-now',
    };
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('UPDATE storyboard_ai_video_billing_settlements')) {
        return { rows: [row], rowCount: 1 };
      }
      if (sql.includes('FROM ai_credit_ledger')) {
        expect(params).toEqual([`job:${jobId}`]);
        return {
          rows: [{ user_id: row.user_id, type: 'spend', amount_usd: -0.81 }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('WITH completed AS')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected SQL: ${sql}`);
    });
    creditMoveMock.mockResolvedValue(true);

    await expect(deliverStoryboardVideoBillingSettlementNow(
      { query } as unknown as Pool,
      { jobId, kind: 'credit_refund' },
    )).resolves.toBe('completed');
    expect(creditMoveMock).toHaveBeenCalledWith(
      expect.anything(),
      row.user_id,
      'refund',
      0.81,
      row.external_ref,
      'higgsfield-dop-i2v provider failure',
    );
    expect(query.mock.calls.some(([sql]) =>
      String(sql).includes("WHERE job_id=$1 AND kind='credit_debit'")))
      .toBe(false);
  });

  it('recognizes an idempotently completed refund without crediting twice', async () => {
    const jobId = '77777777-7777-4777-8777-777777777777';
    const row = {
      id: 'settlement-idempotent-refund',
      job_id: jobId,
      kind: 'credit_refund',
      user_id: 'user-idempotent',
      model: 'higgsfield-dop-i2v',
      amount_usd: '0.81',
      billing_mode: 'credits',
      external_ref: `job-refund:${jobId}`,
      attempts: 2,
      delivery_deadline_at: null,
      lease_owner: 'worker-now',
    };
    const query = vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('UPDATE storyboard_ai_video_billing_settlements')) {
        return { rows: [row], rowCount: 1 };
      }
      if (sql.includes('FROM ai_credit_ledger')) {
        if (params[0] === `job:${jobId}`) {
          return {
            rows: [{ user_id: row.user_id, type: 'spend', amount_usd: -0.81 }],
            rowCount: 1,
          };
        }
        expect(params).toEqual([row.external_ref]);
        return {
          rows: [{ user_id: row.user_id, type: 'refund', amount_usd: 0.81 }],
          rowCount: 1,
        };
      }
      if (sql.startsWith('WITH completed AS')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected SQL: ${sql}`);
    });
    // creditMove returns false for a duplicate ref. The matching refund ledger
    // proves the previous attempt committed, so recovery only closes the outbox.
    creditMoveMock.mockResolvedValue(false);

    await expect(deliverStoryboardVideoBillingSettlementNow(
      { query } as unknown as Pool,
      { jobId, kind: 'credit_refund' },
    )).resolves.toBe('completed');
    expect(creditMoveMock).toHaveBeenCalledOnce();
  });

  it('uses both the stable meter identifier and request idempotency key', async () => {
    const jobId = '33333333-3333-4333-8333-333333333333';
    const row = {
      id: 'settlement-meter',
      job_id: jobId,
      kind: 'meter',
      user_id: 'user-3',
      model: 'higgsfield-dop-i2v',
      amount_usd: '0.81',
      billing_mode: 'metered',
      external_ref: `storyboard-video-meter:${jobId}`,
      attempts: 1,
      delivery_deadline_at: new Date(Date.now() + 60_000),
      lease_owner: 'worker-now',
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('UPDATE storyboard_ai_video_billing_settlements')) {
        return { rows: [row], rowCount: 1 };
      }
      if (sql.startsWith('WITH completed AS')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected SQL: ${sql}`);
    });
    emitMeterMock.mockResolvedValue({ emitted: true, billedUsd: 0.81 });

    await deliverStoryboardVideoBillingSettlementNow(
      { query } as unknown as Pool,
      { jobId, kind: 'meter' },
    );
    expect(emitMeterMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      billedUsdOverride: 0.81,
      meterEventIdentifier: `storyboard-video-${jobId}`,
      idempotencyKey: `storyboard-video-meter:${jobId}`,
      stripeTimeoutMs: 20_000,
      stripeMaxNetworkRetries: 0,
    }));
  });

  it('quarantines malformed legacy schedules without attempting delivery', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('legacy-generative-ai-billing:quarantine')) {
        expect(sql).toContain("'legacy_billing_schedule_malformed'");
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('legacy-generative-ai-billing:expire')
          || sql.includes('legacy-generative-ai-billing:claim')) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });

    await expect(tickLegacyGenerativeAiBillingSettlements(
      { query } as unknown as Pool,
      { workerId: 'legacy-worker' },
    )).resolves.toMatchObject({
      quarantined: 1,
      claimed: 0,
      completed: 0,
    });
    expect(emitMeterMock).not.toHaveBeenCalled();
    expect(creditMoveMock).not.toHaveBeenCalled();
  });

  it('sizes the canonical legacy lease for the full sequential batch', async () => {
    const row = {
      id: 'legacy-job-1',
      project_id: 'project-1',
      input: {
        legacyBilling: {
          status: 'delivering',
          mode: 'metered',
          amountUsd: 1.5,
          userId: 'user-legacy',
          model: 'legacy-video',
          externalRef: 'legacy-generative-ai-meter:legacy-job-1',
          meterEventIdentifier: 'legacy-generative-ai-legacy-job-1',
          deadlineAt: new Date(Date.now() + 60 * 60 * 1_000).toISOString(),
          attempts: 1,
          leaseOwner: 'legacy-worker',
          leaseExpiresAt: new Date(Date.now() + 90_000).toISOString(),
        },
      },
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('legacy-generative-ai-billing:quarantine')
          || sql.includes('legacy-generative-ai-billing:expire')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('legacy-generative-ai-billing:claim')) {
        expect(sql).toContain(
          "'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"'",
        );
        return { rows: [row], rowCount: 1 };
      }
      if (sql.includes('legacy-generative-ai-billing:patch')) {
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`unexpected SQL: ${sql}`);
    });
    emitMeterMock.mockResolvedValue({ emitted: true, billedUsd: 1.5 });

    await expect(tickLegacyGenerativeAiBillingSettlements(
      { query } as unknown as Pool,
      { workerId: 'legacy-worker', leaseSeconds: 20 },
    )).resolves.toMatchObject({ claimed: 1, completed: 1 });
    expect(emitMeterMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        stripeTimeoutMs: 20_000,
        stripeMaxNetworkRetries: 0,
      }),
    );
    const claim = query.mock.calls.find(([sql]) =>
      String(sql).includes('legacy-generative-ai-billing:claim'));
    expect(claim?.[1]?.[2]).toBe(130);
  });
});

describe('storyboard video archive durability', () => {
  it('allows only credential-free HTTPS URLs on verified provider/CDN hosts', () => {
    expect(trustedStoryboardVideoOutputUrl('https://cdn.higgsfield.ai/a.mp4'))
      .not.toBeNull();
    expect(trustedStoryboardVideoOutputUrl('http://cdn.higgsfield.ai/a.mp4'))
      .toBeNull();
    expect(trustedStoryboardVideoOutputUrl('https://user:pass@fal.media/a.mp4'))
      .toBeNull();
    expect(trustedStoryboardVideoOutputUrl('https://higgsfield.ai.attacker.test/a.mp4'))
      .toBeNull();
  });

  it('rejects redirects and oversized declared bodies before B2 upload', async () => {
    const archive = vi.fn();
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe('error');
      return new Response('x', {
        status: 200,
        headers: {
          'content-type': 'video/mp4',
          'content-length': String(129 * 1024 * 1024),
        },
      });
    }) as unknown as typeof fetch;

    await expect(archiveStoryboardVideoOutput({
      projectId: 'project-1',
      storyboardId: 'board-1',
      jobId: 'job-1',
      providerUrl: 'https://cdn.higgsfield.ai/output.mp4',
      fetchImpl,
      archive,
    })).rejects.toThrow('archive_content_length_rejected');
    expect(archive).not.toHaveBeenCalled();
  });

  it('rejects active SVG content when the shared downloader expects an image', async () => {
    const fetchImpl = vi.fn(async () => new Response('<svg/>', {
      status: 200,
      headers: { 'content-type': 'image/svg+xml', 'content-length': '6' },
    })) as unknown as typeof fetch;
    await expect(downloadTrustedStoryboardVideoOutput({
      providerUrl: 'https://fal.media/output.svg', fetchImpl,
      expectedKind: 'image',
    })).rejects.toThrow('archive_content_type_rejected');
  });

  it.each([
    { currentJob: 'archive-job', updatesMirror: true },
    { currentJob: 'newer-job', updatesMirror: false },
  ])('archives durably and updates only a same-job mirror: $currentJob', async ({
    currentJob,
    updatesMirror,
  }) => {
    const compat = [{
      id: 'scene-1',
      storyboardFrames: [{
        id: 'frame-1',
        aiVideoJobId: currentJob,
        aiVideoURL: 'https://cdn.higgsfield.ai/output.mp4',
        updatedAt: '2026-01-01T00:00:00.000Z',
      }],
    }];
    const clientCalls: Array<{ sql: string; values: unknown[] }> = [];
    const client = {
      query: vi.fn(async (sql: string, values: unknown[] = []) => {
        clientCalls.push({ sql, values });
        if (sql.includes('SELECT id FROM storyboard_ai_video_jobs')) {
          return { rows: [{ id: 'archive-job' }], rowCount: 1 };
        }
        if (sql.includes('SELECT scene_id,frame_id,metadata')) {
          return {
            rows: [{
              scene_id: 'scene-1', frame_id: 'frame-1',
              metadata: { aiVideo: { jobId: currentJob } },
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('SELECT manuscript_id')) {
          return { rows: [{ manuscript_id: 'manuscript-1' }], rowCount: 1 };
        }
        if (sql.includes('SELECT store_value')) {
          return { rows: [{ store_value: compat }], rowCount: 1 };
        }
        if (sql.includes('UPDATE storyboard_ai_video_jobs')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };
    let poolCalls = 0;
    const pool = {
      query: vi.fn(async (sql: string) => {
        poolCalls += 1;
        if (poolCalls === 1) return { rows: [], rowCount: 0 };
        if (sql.includes('WITH due AS')) {
          return {
            rows: [{
              id: 'archive-job', project_id: 'project-1', storyboard_id: 'board-1',
              output_url_temp: 'https://cdn.higgsfield.ai/output.mp4',
              archive_attempts: 1,
            }],
            rowCount: 1,
          };
        }
        throw new Error(`unexpected pool SQL: ${sql}`);
      }),
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const archive = vi.fn(async (key: string, bytes: Uint8Array) => ({
      bucket: 'test', key, size: bytes.byteLength,
    }));
    const fetchImpl = vi.fn(async () => new Response(Buffer.from('video'), {
      status: 200,
      headers: { 'content-type': 'video/mp4', 'content-length': '5' },
    })) as unknown as typeof fetch;

    const stats = await tickStoryboardVideoArchiveWorker(pool, {
      workerId: 'archive-worker', fetchImpl, archive,
    });
    expect(stats).toMatchObject({ claimed: 1, archived: 1, failed: 0 });
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    const normalizedUpdate = clientCalls.find(({ sql }) => (
      sql.includes('UPDATE casting_storyboards')
    ));
    const compatUpdate = clientCalls.find(({ sql }) => (
      sql.includes('SET store_value=$2::jsonb')
    ));
    expect(Boolean(normalizedUpdate)).toBe(updatesMirror);
    expect(Boolean(compatUpdate)).toBe(updatesMirror);
    if (compatUpdate) {
      const scenes = JSON.parse(String(compatUpdate.values[1]));
      expect(scenes[0].storyboardFrames[0]).toMatchObject({
        aiVideoStatus: 'completed-archived',
        aiVideoURL: null,
        aiVideoArchiveKey:
          'workspace/project-1/storyboards/board-1/animations/archive-job.mp4',
      });
    }
  });
});
