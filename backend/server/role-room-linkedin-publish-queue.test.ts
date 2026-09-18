import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatchPublish: vi.fn(),
  upload: vi.fn(),
  sign: vi.fn(),
  remove: vi.fn(),
  markScheduled: vi.fn(),
  markPublished: vi.fn(),
  markFailed: vi.fn(),
}));

vi.mock('./social-publisher.js', () => ({ dispatchPublish: mocks.dispatchPublish }));
vi.mock('./role-room-instagram-image-upload.js', () => ({
  uploadImageForInstagram: mocks.upload,
  signInstagramHostedImageUrl: mocks.sign,
  deleteInstagramHostedImage: mocks.remove,
}));
vi.mock('./role-room-feed-plan.js', () => ({
  markFeedPlanPostScheduledInTransaction: mocks.markScheduled,
  markFeedPlanPostPublished: mocks.markPublished,
  markFeedPlanPostFailed: mocks.markFailed,
}));

import {
  claimDueLinkedInPublishJobs,
  computeLinkedInRetryAt,
  enqueueLinkedInPublishJob,
  processDueLinkedInPublishJobs,
  recoverStuckLinkedInPublishJobs,
} from './role-room-linkedin-publish-queue.js';

const FUTURE = new Date('2035-01-02T12:00:00.000Z');

function jobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    user_id: 'user-1',
    project_id: 'project-1',
    connection_id: 'connection-1',
    feed_plan_post_id: 'post-1',
    idempotency_key: 'idem-1',
    media_kind: 'image',
    caption: 'Hello LinkedIn',
    extras: {},
    media_parts: [],
    author_type: 'personal',
    organization_urn: null,
    status: 'queued',
    scheduled_for: FUTURE,
    available_at: FUTURE,
    attempt_count: 1,
    max_attempts: 5,
    claimed_at: null,
    last_attempt_at: null,
    last_error: null,
    external_post_id: null,
    permalink: null,
    published_at: null,
    created_at: new Date('2035-01-01T00:00:00.000Z'),
    updated_at: new Date('2035-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function enqueueInput(overrides: Record<string, unknown> = {}) {
  return {
    userId: 'user-1',
    projectId: 'project-1',
    connectionId: 'connection-1',
    feedPlanPostId: 'post-1',
    mediaKind: 'image' as const,
    caption: 'Hello LinkedIn',
    imageUrl: 'data:image/png;base64,YQ==',
    scheduledFor: FUTURE,
    changedBy: 'producer@example.test',
    ...overrides,
  };
}

describe('durable LinkedIn publish queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upload.mockResolvedValue({
      bucket: 'media',
      key: 'role-room/linkedin/a.png',
      publicUrl: 'https://signed.invalid/upload',
      contentType: 'image/png',
      bytes: 1,
    });
    mocks.remove.mockResolvedValue(undefined);
    mocks.markScheduled.mockResolvedValue({ touched: true });
    mocks.markPublished.mockResolvedValue({ touched: true });
    mocks.markFailed.mockResolvedValue({ touched: true });
  });

  it('rejects more than twenty carousel images before DB access or upload', async () => {
    const pool = { query: vi.fn() } as never;
    await expect(enqueueLinkedInPublishJob(pool, enqueueInput({
      mediaKind: 'carousel',
      imageUrl: undefined,
      imageUrls: Array.from({ length: 21 }, () => 'data:image/png;base64,YQ=='),
    }))).rejects.toThrow('2-20 bilder');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect((pool as { query: ReturnType<typeof vi.fn> }).query).not.toHaveBeenCalled();
  });

  it('rejects a carousel over the total media cap before DB access or upload', async () => {
    const pool = { query: vi.fn() } as never;
    const sixMegabyteImage = 'data:image/png;base64,' + 'A'.repeat(8 * 1024 * 1024);
    await expect(enqueueLinkedInPublishJob(pool, enqueueInput({
      mediaKind: 'carousel',
      imageUrl: undefined,
      imageUrls: Array.from({ length: 20 }, () => sixMegabyteImage),
    }))).rejects.toThrow('100 MB totalt');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect((pool as { query: ReturnType<typeof vi.fn> }).query).not.toHaveBeenCalled();
  });

  it('uploads media to R2, persists only object metadata and marks the post scheduled', async () => {
    const queries: Array<{ sql: string; args: unknown[] }> = [];
    const inserted = jobRow({
      media_parts: [{
        kind: 'image', bucket: 'media', key: 'role-room/linkedin/a.png',
        contentType: 'image/png', bytes: 1,
      }],
    });
    const client = {
      query: vi.fn(async (sql: string, args: unknown[] = []) => {
        queries.push({ sql, args });
        if (sql.includes('INSERT INTO role_room_linkedin_publish_jobs')) {
          return { rows: [inserted], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string, args: unknown[] = []) => {
        queries.push({ sql, args });
        if (sql.includes('FROM role_room_linkedin_connections')) {
          return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => client),
    } as never;

    const result = await enqueueLinkedInPublishJob(pool, enqueueInput({
      extras: {
        altText: 'Accessible image',
        ignoredDataUrl: 'data:image/png;base64,SECRET',
      },
    }));

    expect(result.deduped).toBe(false);
    expect(mocks.upload).toHaveBeenCalledOnce();
    const insert = queries.find((entry) => entry.sql.includes('INSERT INTO role_room_linkedin_publish_jobs'))!;
    expect(String(insert.args[7])).toContain('Accessible image');
    expect(String(insert.args[7])).not.toContain('SECRET');
    expect(String(insert.args[8])).toContain('role-room/linkedin/a.png');
    expect(String(insert.args[8])).not.toContain('data:image');
    expect(mocks.markScheduled).toHaveBeenCalledWith(
      client,
      'project-1',
      'post-1',
      'job-1',
      FUTURE,
      'producer@example.test',
    );
    expect(queries.find((entry) => entry.sql.includes('idempotency_key'))?.sql)
      .not.toContain("'failed'");
    expect(queries.find((entry) => entry.sql.includes('feed_plan_post_id'))?.sql)
      .toContain("'uncertain'");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back the queue insert when feed-plan approval changes before commit', async () => {
    const transcript: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        transcript.push(sql);
        if (sql.includes('INSERT INTO role_room_linkedin_publish_jobs')) {
          return { rows: [jobRow()], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(async (sql: string) =>
        sql.includes('FROM role_room_linkedin_connections')
          ? { rows: [{ '?column?': 1 }], rowCount: 1 }
          : { rows: [], rowCount: 0 }),
      connect: vi.fn(async () => client),
    } as never;
    mocks.markScheduled.mockResolvedValueOnce({ touched: false });

    await expect(enqueueLinkedInPublishJob(pool, enqueueInput()))
      .rejects.toThrow('feed_plan_approval_changed_before_enqueue_commit');

    expect(transcript[0]).toBe('BEGIN');
    expect(transcript.some((sql) => sql.includes('INSERT INTO role_room_linkedin_publish_jobs')))
      .toBe(true);
    expect(transcript).toContain('ROLLBACK');
    expect(transcript).not.toContain('COMMIT');
    expect(mocks.remove).toHaveBeenCalledWith('media', 'role-room/linkedin/a.png');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('claims due rows transactionally with FOR UPDATE SKIP LOCKED', async () => {
    const transcript: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        transcript.push(sql);
        return sql.includes('WITH due AS')
          ? { rows: [jobRow({ status: 'processing' })] }
          : { rows: [] };
      }),
      release: vi.fn(),
    };
    const jobs = await claimDueLinkedInPublishJobs({
      connect: vi.fn(async () => client),
    } as never, 4);

    expect(jobs).toHaveLength(1);
    expect(transcript[0]).toBe('BEGIN');
    expect(transcript[1]).toContain('FOR UPDATE SKIP LOCKED');
    expect(transcript[2]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('reconstructs R2 media and records a successful organization publish', async () => {
    const queued = jobRow({
      status: 'processing',
      author_type: 'organization',
      organization_urn: 'urn:li:organization:42',
      extras: { altText: 'Alt' },
      media_parts: [{
        kind: 'image', bucket: 'media', key: 'role-room/linkedin/a.png',
        contentType: 'image/png', bytes: 1,
      }],
    });
    const client = {
      query: vi.fn(async (sql: string) =>
        sql.includes('WITH due AS') ? { rows: [queued] } : { rows: [] }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(async () => client),
      query: vi.fn(async (sql: string) => {
        if (sql.includes("WHERE status IN ('processing', 'publishing')") && sql.includes('RETURNING *')) {
          return { rows: [] };
        }
        if (sql.includes("SET status = 'publishing'")) return { rows: [{ id: 'job-1' }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      }),
    } as never;
    mocks.sign.mockResolvedValue('https://signed.invalid/a.png');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(Buffer.from('a'), {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })));
    mocks.dispatchPublish.mockResolvedValue({
      ok: true,
      status: 'published',
      externalPostId: 'share-1',
      permalink: 'https://linkedin.test/share-1',
    });

    const stats = await processDueLinkedInPublishJobs(pool, 1);

    expect(stats.published).toBe(1);
    expect(mocks.dispatchPublish).toHaveBeenCalledWith('linkedin', expect.objectContaining({
      userId: 'user-1',
      projectId: 'project-1',
      imageUrl: 'data:image/png;base64,YQ==',
      scheduledFor: null,
      extras: expect.objectContaining({ linkedInOrganizationUrn: 'urn:li:organization:42' }),
    }));
    expect(mocks.markPublished).toHaveBeenCalledWith(
      pool,
      'project-1',
      'post-1',
      expect.objectContaining({ jobId: 'job-1', externalPostId: 'share-1' }),
    );
    expect(mocks.remove).toHaveBeenCalledWith('media', 'role-room/linkedin/a.png');
    vi.unstubAllGlobals();
  });

  it('uses a bounded timeout and safely retries an aborted R2 download', async () => {
    const sql: Array<{ statement: string; args: unknown[] }> = [];
    const queued = jobRow({
      status: 'processing',
      media_parts: [{
        kind: 'image', bucket: 'media', key: 'role-room/linkedin/a.png',
        contentType: 'image/png', bytes: 1,
      }],
    });
    const client = {
      query: vi.fn(async (statement: string) =>
        statement.includes('WITH due AS') ? { rows: [queued] } : { rows: [] }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(async () => client),
      query: vi.fn(async (statement: string, args: unknown[] = []) => {
        sql.push({ statement, args });
        return { rows: [], rowCount: 1 };
      }),
    } as never;
    const timeoutController = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal);
    let receivedSignal: AbortSignal | null = null;
    mocks.sign.mockResolvedValue('https://signed.invalid/a.png');
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      receivedSignal = init?.signal ?? null;
      throw new DOMException('download timed out', 'AbortError');
    }));

    try {
      const stats = await processDueLinkedInPublishJobs(pool, 1);

      expect(timeoutSpy).toHaveBeenCalledWith(30_000);
      expect(receivedSignal).toBe(timeoutController.signal);
      expect(stats.retrying).toBe(1);
      expect(stats.uncertain).toBe(0);
      expect(mocks.dispatchPublish).not.toHaveBeenCalled();
      const retry = sql.find(({ statement }) => statement.includes("SET status = 'queued'"));
      expect(retry?.args[2]).toContain('download timed out');
      expect(sql.some(({ statement }) => statement.includes("SET status = 'publishing'")))
        .toBe(false);
    } finally {
      vi.unstubAllGlobals();
      timeoutSpy.mockRestore();
    }
  });

  it('stops a chunked R2 response once the streamed image byte cap is exceeded', async () => {
    const sql: Array<{ statement: string; args: unknown[] }> = [];
    const queued = jobRow({
      status: 'processing',
      media_parts: [{
        kind: 'image', bucket: 'media', key: 'role-room/linkedin/a.png',
        contentType: 'image/png', bytes: 1,
      }],
    });
    const client = {
      query: vi.fn(async (statement: string) =>
        statement.includes('WITH due AS') ? { rows: [queued] } : { rows: [] }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(async () => client),
      query: vi.fn(async (statement: string, args: unknown[] = []) => {
        sql.push({ statement, args });
        return { rows: [], rowCount: 1 };
      }),
    } as never;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(10 * 1024 * 1024));
        controller.enqueue(new Uint8Array(10 * 1024 * 1024 + 1));
      },
      cancel() {
        cancel();
      },
    });
    mocks.sign.mockResolvedValue('https://signed.invalid/a.png');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(stream, {
      status: 200,
      headers: { 'content-type': 'image/png' },
    })));

    try {
      const stats = await processDueLinkedInPublishJobs(pool, 1);

      expect(stats.retrying).toBe(1);
      expect(stats.uncertain).toBe(0);
      expect(cancel).toHaveBeenCalledOnce();
      expect(mocks.dispatchPublish).not.toHaveBeenCalled();
      const retry = sql.find(({ statement }) => statement.includes("SET status = 'queued'"));
      expect(retry?.args[2]).toContain('R2-media overstiger tillatt størrelse');
      expect(sql.some(({ statement }) => statement.includes("SET status = 'publishing'")))
        .toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('moves stuck publishing jobs to uncertain and never requeues them', async () => {
    const uncertain = jobRow({
      status: 'uncertain',
      last_error: '[publish outcome unknown; verify LinkedIn manually]',
    });
    const pool = {
      query: vi.fn(async () => ({ rows: [uncertain] })),
    } as never;

    const result = await recoverStuckLinkedInPublishJobs(pool);

    expect(result).toEqual({ requeued: 0, failed: 0, uncertain: 1 });
    const sql = (pool as { query: ReturnType<typeof vi.fn> }).query.mock.calls[0][0] as string;
    expect(sql).toContain("WHEN status = 'publishing' THEN 'uncertain'");
    expect(mocks.markFailed).toHaveBeenCalledWith(
      pool,
      'project-1',
      'post-1',
      'Utfallet er ukjent. Kontroller LinkedIn manuelt før du forsøker på nytt.',
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it.each([
    { reason: 'network_error', error: 'socket closed' },
    { reason: 'linkedin_api_error', error: 'publisering feilet: upstream HTTP 500' },
  ])('marks $reason after dispatch as uncertain and never retries it', async ({ reason, error }) => {
    const sql: string[] = [];
    const queued = jobRow({ status: 'processing', media_kind: 'text' });
    const client = {
      query: vi.fn(async (statement: string) => {
        sql.push(statement);
        return statement.includes('WITH due AS') ? { rows: [queued] } : { rows: [] };
      }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(async () => client),
      query: vi.fn(async (statement: string) => {
        sql.push(statement);
        if (statement.includes('SET status = CASE')) return { rows: [], rowCount: 0 };
        if (statement.includes("SET status = 'publishing'")) {
          return { rows: [{ id: 'job-1' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    } as never;
    mocks.dispatchPublish.mockResolvedValue({
      ok: false,
      status: 'failed',
      reason,
      error,
    });

    const stats = await processDueLinkedInPublishJobs(pool, 1);

    expect(stats.uncertain).toBe(1);
    expect(stats.retrying).toBe(0);
    expect(sql.some((statement) => statement.includes("SET status = 'uncertain'"))).toBe(true);
    expect(sql.some((statement) => statement.includes("SET status = 'queued'"))).toBe(false);
    expect(mocks.markFailed).toHaveBeenCalledWith(
      pool,
      'project-1',
      'post-1',
      expect.stringContaining('Kontroller LinkedIn manuelt'),
    );
  });

  it('does not retry a definitive permission denial', async () => {
    const sql: string[] = [];
    const queued = jobRow({ status: 'processing', media_kind: 'text' });
    const client = {
      query: vi.fn(async (statement: string) =>
        statement.includes('WITH due AS') ? { rows: [queued] } : { rows: [] }),
      release: vi.fn(),
    };
    const pool = {
      connect: vi.fn(async () => client),
      query: vi.fn(async (statement: string) => {
        sql.push(statement);
        if (statement.includes('SET status = CASE')) return { rows: [], rowCount: 0 };
        if (statement.includes("SET status = 'publishing'")) {
          return { rows: [{ id: 'job-1' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    } as never;
    mocks.dispatchPublish.mockResolvedValue({
      ok: false,
      status: 'failed',
      reason: 'permission_denied',
      error: 'LinkedIn avviste rettighetene.',
    });

    const stats = await processDueLinkedInPublishJobs(pool, 1);

    expect(stats.failed).toBe(1);
    expect(stats.retrying).toBe(0);
    expect(sql.some((statement) => statement.includes("SET status = 'failed'"))).toBe(true);
    expect(sql.some((statement) => statement.includes("SET status = 'queued'"))).toBe(false);
  });

  it('uses bounded exponential retry delays', () => {
    const now = Date.parse('2035-01-01T00:00:00.000Z');
    expect(computeLinkedInRetryAt(1, now)?.toISOString()).toBe('2035-01-01T00:01:00.000Z');
    expect(computeLinkedInRetryAt(2, now)?.toISOString()).toBe('2035-01-01T00:05:00.000Z');
    expect(computeLinkedInRetryAt(5, now)).toBeNull();
  });
});
