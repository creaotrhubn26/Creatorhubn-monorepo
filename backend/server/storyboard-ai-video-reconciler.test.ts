import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  IMAGE_AI_BILLING_SWEEP_INTERVAL_MS,
  LEGACY_AI_BILLING_SWEEP_INTERVAL_MS,
  STORYBOARD_AI_VIDEO_SUBMIT_GRACE_SECONDS,
  normalizeStoryboardAiVideoLifecycle,
  storyboardAiVideoSubmittingNormalizationDecision,
  startStoryboardAiVideoReconciler,
  tickStoryboardAiVideoReconciler,
} from './storyboard-ai-video-reconciler.js';

interface QueryCall {
  sql: string;
  values: unknown[];
}

interface ClaimedRow {
  id: string;
  project_id: string;
  storyboard_id: string;
}

class ReconcilerPool {
  readonly calls: QueryCall[] = [];
  claimRows: ClaimedRow[] = [];
  releaseFailure: Error | null = null;
  normalizationRowCounts = {
    providerId: 0,
    statusUrl: 0,
    active: 0,
    completed: 0,
  };

  async query(sql: string, values: unknown[] = []): Promise<any> {
    this.calls.push({ sql, values });
    if (sql.includes('storyboard-ai-video-normalize:provider-id')) {
      return { rows: [], rowCount: this.normalizationRowCounts.providerId };
    }
    if (sql.includes('storyboard-ai-video-normalize:status-url')) {
      return { rows: [], rowCount: this.normalizationRowCounts.statusUrl };
    }
    if (sql.includes('storyboard-ai-video-normalize:active')) {
      return { rows: [], rowCount: this.normalizationRowCounts.active };
    }
    if (sql.includes('storyboard-ai-video-normalize:completed')) {
      return { rows: [], rowCount: this.normalizationRowCounts.completed };
    }
    if (sql.includes('WITH due_jobs AS')) {
      return { rows: this.claimRows, rowCount: this.claimRows.length };
    }
    if (sql.includes('SET reconcile_lease_owner = NULL')) {
      if (this.releaseFailure) throw this.releaseFailure;
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
}

const asPool = (pool: ReconcilerPool) => pool as unknown as Pool;

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('tickStoryboardAiVideoReconciler', () => {
  it('claims only due active Higgsfield jobs with an atomic skip-locked lease', async () => {
    const db = new ReconcilerPool();
    db.claimRows = [
      { id: 'job-1', project_id: 'project-1', storyboard_id: 'board-1' },
      { id: 'job-2', project_id: 'project-2', storyboard_id: 'board-2' },
    ];
    const poll = vi.fn().mockResolvedValue({ status: 'queued' });

    const stats = await tickStoryboardAiVideoReconciler(asPool(db), {
      workerId: 'worker-a',
      batchSize: 4,
      leaseSeconds: 45,
      poll,
    });

    expect(stats).toEqual({
      claimed: 2,
      polled: 2,
      failed: 0,
      leaseReleaseFailed: 0,
    });
    expect(poll).toHaveBeenCalledTimes(2);
    expect(poll).toHaveBeenNthCalledWith(1, asPool(db), {
      projectId: 'project-1',
      storyboardId: 'board-1',
      jobId: 'job-1',
    });
    expect(poll).toHaveBeenNthCalledWith(2, asPool(db), {
      projectId: 'project-2',
      storyboardId: 'board-2',
      jobId: 'job-2',
    });

    const claim = db.calls.find((call) => call.sql.includes('WITH due_jobs AS'))!;
    expect(claim.sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(claim.sql).toContain("provider = 'higgsfield'");
    expect(claim.sql).toContain("provider_status IN ('queued', 'in_progress')");
    expect(claim.sql).toContain("status IN ('queued', 'running', 'processing')");
    expect(claim.sql).toContain('next_poll_at <= NOW()');
    expect(claim.sql).toContain('reconcile_lease_expires_at <= NOW()');
    expect(claim.sql).toContain('SET reconcile_lease_owner = $1');
    expect(claim.sql).toContain('reconcile_lease_expires_at = NOW()');
    expect(claim.values.slice(0, 3)).toEqual(['worker-a', 4, 45]);
    expect(claim.values[3]).toBe(
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    );
    expect(claim.values[4]).toContain('https://api[.]higgsfield[.]ai/requests/');
    expect(claim.sql).toContain('provider_request_id ~ $4');
    expect(claim.sql).toContain('provider_status_url ~ $5');
    expect(claim.sql).toContain("|| provider_request_id || '/status'");
    const claimIndex = db.calls.indexOf(claim);
    expect(db.calls.slice(0, claimIndex)).toHaveLength(4);
    expect(db.calls.slice(0, claimIndex).every((call) => (
      call.sql.includes('storyboard-ai-video-normalize:')
    ))).toBe(true);

    const releases = db.calls.filter((call) => (
      call.sql.includes('SET reconcile_lease_owner = NULL')
    ));
    expect(releases).toHaveLength(2);
    expect(releases.map((call) => call.values)).toEqual([
      ['job-1', 'worker-a', null, 10],
      ['job-2', 'worker-a', null, 10],
    ]);
    for (const release of releases) {
      expect(release.sql).toContain('reconcile_lease_expires_at = NULL');
      expect(release.sql).toContain('last_poll_error = $3');
      expect(release.sql).toContain('last_polled_at = NOW()');
      expect(release.sql).toContain('updated_at = NOW()');
      expect(release.sql).toContain('AND reconcile_lease_owner = $2');
    }
  });

  it('does not poll when no due job was claimed', async () => {
    const db = new ReconcilerPool();
    const poll = vi.fn();

    const stats = await tickStoryboardAiVideoReconciler(asPool(db), {
      workerId: 'worker-idle',
      poll,
    });

    expect(stats).toEqual({
      claimed: 0,
      polled: 0,
      failed: 0,
      leaseReleaseFailed: 0,
    });
    expect(poll).not.toHaveBeenCalled();
    expect(db.calls).toHaveLength(5);
  });

  it('records a poll failure, schedules about ten seconds later, and releases its lease', async () => {
    const db = new ReconcilerPool();
    db.claimRows = [
      { id: 'job-error', project_id: 'project-1', storyboard_id: 'board-1' },
    ];
    const poll = vi.fn().mockRejectedValue(new Error('provider GET timed out'));

    const stats = await tickStoryboardAiVideoReconciler(asPool(db), {
      workerId: 'worker-error',
      poll,
    });

    expect(poll).toHaveBeenCalledTimes(1);
    expect(stats).toEqual({
      claimed: 1,
      polled: 1,
      failed: 1,
      leaseReleaseFailed: 0,
    });
    const release = db.calls.find((call) => (
      call.sql.includes('SET reconcile_lease_owner = NULL')
    ));
    expect(release?.values).toEqual([
      'job-error',
      'worker-error',
      'provider GET timed out',
      10,
    ]);
    expect(release?.sql).toContain("THEN NOW() + make_interval(secs => $4::int)");
    expect(release?.sql).toContain('ELSE next_poll_at');
  });

  it('isolates one failed poll and still polls and releases every claimed job once', async () => {
    const db = new ReconcilerPool();
    db.claimRows = [
      { id: 'job-1', project_id: 'project-1', storyboard_id: 'board-1' },
      { id: 'job-2', project_id: 'project-2', storyboard_id: 'board-2' },
    ];
    const poll = vi.fn()
      .mockRejectedValueOnce(new Error('temporary GET failure'))
      .mockResolvedValueOnce({ status: 'running' });

    const stats = await tickStoryboardAiVideoReconciler(asPool(db), {
      workerId: 'worker-batch',
      poll,
    });

    expect(poll).toHaveBeenCalledTimes(2);
    expect(stats).toEqual({
      claimed: 2,
      polled: 2,
      failed: 1,
      leaseReleaseFailed: 0,
    });
    expect(db.calls.filter((call) => (
      call.sql.includes('SET reconcile_lease_owner = NULL')
    ))).toHaveLength(2);
  });

  it('surfaces a lease-release database failure without repeating the poll', async () => {
    const db = new ReconcilerPool();
    db.claimRows = [
      { id: 'job-1', project_id: 'project-1', storyboard_id: 'board-1' },
    ];
    db.releaseFailure = new Error('database unavailable');
    const poll = vi.fn().mockResolvedValue({ status: 'queued' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const stats = await tickStoryboardAiVideoReconciler(asPool(db), {
      workerId: 'worker-release-error',
      poll,
    });

    expect(poll).toHaveBeenCalledTimes(1);
    expect(stats.leaseReleaseFailed).toBe(1);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('normalizeStoryboardAiVideoLifecycle', () => {
  it('normalizes legacy lifecycle and archive fields idempotently before claim', async () => {
    const db = new ReconcilerPool();
    db.normalizationRowCounts = {
      providerId: 2,
      statusUrl: 1,
      active: 3,
      completed: 4,
    };

    const stats = await normalizeStoryboardAiVideoLifecycle(asPool(db));

    expect(stats).toEqual({
      providerIdsBound: 2,
      statusUrlsNormalized: 1,
      activeRowsNormalized: 3,
      completedRowsNormalized: 4,
    });
    expect(db.calls).toHaveLength(4);

    const idBinding = db.calls[0];
    expect(idBinding.sql).toContain('provider_request_id = LOWER(jobs.fal_request_id)');
    expect(idBinding.sql).toContain("jobs.provider = 'higgsfield'");
    expect(idBinding.sql).toContain("jobs.status <> 'prepared'");
    expect(idBinding.sql).toContain('jobs.fal_request_id ~* $1');
    expect(idBinding.sql).toContain('AND NOT EXISTS');
    expect(idBinding.sql).toContain('duplicate.id <> jobs.id');

    const urlBinding = db.calls[1];
    expect(urlBinding.sql).toContain('jobs.provider_request_id ~ $1');
    expect(urlBinding.sql).toContain('jobs.provider_status_url ~ $2');
    expect(urlBinding.sql).toContain('jobs.response_url ~ $2');
    expect(urlBinding.sql).toContain("|| jobs.provider_request_id || '/status'");
    expect(urlBinding.sql).toContain('ELSE NULL');
    expect(urlBinding.sql).toContain(
      'WHEN normalized.normalized_url IS NULL THEN NULL',
    );
    expect(urlBinding.sql).toContain("jobs.status <> 'prepared'");

    const active = db.calls[2];
    expect(active.sql).toContain("jobs.status IN ('running', 'processing') THEN 'in_progress'");
    expect(active.sql).toContain("THEN 'submission_unknown'");
    expect(active.sql).toContain("THEN 'accepted_contract_unknown'");
    expect(active.sql).toContain('THEN COALESCE(jobs.next_poll_at, NOW())');
    expect(active.sql).toContain(
      "jobs.status IN ('submitting', 'queued', 'running', 'processing')",
    );
    expect(active.sql).not.toContain("jobs.status IN ('prepared'");
    expect(active.sql).toContain("jobs.status <> 'submitting'");
    expect(active.sql).toContain('jobs.submit_started_at');
    expect(active.sql).toContain('NOW() - make_interval(secs => $1::int)');
    expect(active.values).toEqual([STORYBOARD_AI_VIDEO_SUBMIT_GRACE_SECONDS]);

    const completed = db.calls[3];
    expect(completed.sql).toContain("jobs.status = 'completed'");
    expect(completed.sql).toContain("jobs.output_b2_key IS NOT NULL THEN 'archived'");
    expect(completed.sql).toContain("jobs.archive_status = 'not_ready' THEN 'pending'");
    expect(completed.sql).toContain("+ INTERVAL '6 days'");
    expect(completed.sql).toContain('archive_next_attempt_at');
    expect(completed.sql).toContain('archive_deadline_at');
  });
});

describe('submitting normalization race policy', () => {
  const now = new Date('2026-08-29T20:00:00.000Z');

  it('leaves a fresh submitting provider POST untouched', () => {
    const decision = storyboardAiVideoSubmittingNormalizationDecision({
      hasVerifiedProviderHandle: false,
      submitStartedAt: new Date(
        now.getTime() - (STORYBOARD_AI_VIDEO_SUBMIT_GRACE_SECONDS - 1) * 1_000,
      ),
      updatedAt: null,
      createdAt: new Date('2026-08-29T19:00:00.000Z'),
      now,
    });

    expect(decision).toBe('defer');
  });

  it('parks a stale submitting row only after the full grace period', () => {
    const decision = storyboardAiVideoSubmittingNormalizationDecision({
      hasVerifiedProviderHandle: false,
      submitStartedAt: new Date(
        now.getTime() - STORYBOARD_AI_VIDEO_SUBMIT_GRACE_SECONDS * 1_000,
      ),
      updatedAt: null,
      createdAt: new Date('2026-08-29T19:00:00.000Z'),
      now,
    });

    expect(decision).toBe('park_orphan');
  });

  it('normalizes an accepted handle without waiting or discarding it', async () => {
    const decision = storyboardAiVideoSubmittingNormalizationDecision({
      hasVerifiedProviderHandle: true,
      submitStartedAt: new Date(now.getTime() - 1_000),
      updatedAt: now,
      createdAt: now,
      now,
    });
    expect(decision).toBe('normalize_accepted');

    const db = new ReconcilerPool();
    await normalizeStoryboardAiVideoLifecycle(asPool(db));
    const active = db.calls.find((call) => (
      call.sql.includes('storyboard-ai-video-normalize:active')
    ))!;
    expect(active.sql).toContain('jobs.provider_request_id IS NOT NULL');
    expect(active.sql).toContain('jobs.provider_status_url IS NOT NULL');
    expect(active.sql).not.toContain('SET provider_request_id');
    expect(active.sql).not.toContain('provider_status_url = NULL');
  });
});

describe('startStoryboardAiVideoReconciler', () => {
  it('can be stopped before its first scheduled tick', async () => {
    vi.useFakeTimers();
    const db = new ReconcilerPool();
    const poll = vi.fn();
    const handle = startStoryboardAiVideoReconciler(asPool(db), {
      initialDelayMs: 1_000,
      intervalMs: 2_000,
      workerId: 'worker-stopped',
      poll,
    });

    handle.stop();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(db.calls).toHaveLength(0);
    expect(poll).not.toHaveBeenCalled();
  });

  it('runs isolated image and legacy billing sweeps on their slower cadences', async () => {
    vi.useFakeTimers();
    const db = new ReconcilerPool();
    const legacyBillingTick = vi.fn().mockResolvedValue({
      quarantined: 0,
      expired: 0,
      claimed: 0,
      completed: 0,
      retrying: 0,
      permanentlyFailed: 0,
      deliveryUnknown: 0,
    });
    const billingTick = vi.fn().mockResolvedValue({
      claimed: 0, completed: 0, retrying: 0,
      permanentlyFailed: 0, deliveryUnknown: 0,
    });
    const archiveTick = vi.fn().mockResolvedValue({
      expired: 0, claimed: 0, archived: 0, retrying: 0, failed: 0,
    });
    const imageBillingTick = vi.fn().mockResolvedValue({
      recoveredCompletions: 0, abandonedReservations: 0, expired: 0,
      claimed: 0, completed: 0, retrying: 0,
      permanentlyFailed: 0, deliveryUnknown: 0,
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const handle = startStoryboardAiVideoReconciler(asPool(db), {
      initialDelayMs: 0,
      intervalMs: 2_000,
      workerId: 'worker-cadence',
      poll: vi.fn(),
      billingTick,
      archiveTick,
      legacyBillingTick,
      imageBillingTick,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(legacyBillingTick).toHaveBeenCalledTimes(1);
    expect(imageBillingTick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(
      IMAGE_AI_BILLING_SWEEP_INTERVAL_MS - 1,
    );
    expect(legacyBillingTick).toHaveBeenCalledTimes(1);
    expect(imageBillingTick).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(legacyBillingTick).toHaveBeenCalledTimes(1);
    expect(imageBillingTick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(
      LEGACY_AI_BILLING_SWEEP_INTERVAL_MS
        - IMAGE_AI_BILLING_SWEEP_INTERVAL_MS - 1,
    );
    expect(legacyBillingTick).toHaveBeenCalledTimes(1);
    expect(imageBillingTick).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(legacyBillingTick).toHaveBeenCalledTimes(2);
    expect(imageBillingTick).toHaveBeenCalledTimes(3);
    expect(legacyBillingTick).toHaveBeenLastCalledWith(asPool(db), {
      workerId: 'worker-cadence:legacy-billing',
      batchSize: 4,
      leaseSeconds: 90,
    });
    expect(imageBillingTick).toHaveBeenLastCalledWith(asPool(db), {
      workerId: 'worker-cadence:image-billing',
      batchSize: 4,
      leaseSeconds: 90,
    });

    handle.stop();
  });

  it('keeps polling while billing, archive, and image lanes await I/O', async () => {
    vi.useFakeTimers();
    const db = new ReconcilerPool();
    let releaseBilling!: () => void;
    let releaseArchive!: () => void;
    let releaseImageBilling!: () => void;
    const billingBlocked = new Promise<void>((resolve) => {
      releaseBilling = resolve;
    });
    const archiveBlocked = new Promise<void>((resolve) => {
      releaseArchive = resolve;
    });
    const imageBillingBlocked = new Promise<void>((resolve) => {
      releaseImageBilling = resolve;
    });
    const billingTick = vi.fn(async () => {
      await billingBlocked;
      return {
        claimed: 0, completed: 0, retrying: 0,
        permanentlyFailed: 0, deliveryUnknown: 0,
      };
    });
    const archiveTick = vi.fn(async () => {
      await archiveBlocked;
      return {
        expired: 0, claimed: 0, archived: 0, retrying: 0, failed: 0,
      };
    });
    const legacyBillingTick = vi.fn().mockResolvedValue({
      quarantined: 0, expired: 0, claimed: 0, completed: 0,
      retrying: 0, permanentlyFailed: 0, deliveryUnknown: 0,
    });
    const imageBillingTick = vi.fn(async () => {
      await imageBillingBlocked;
      return {
        recoveredCompletions: 0, abandonedReservations: 0, expired: 0,
        claimed: 0, completed: 0, retrying: 0,
        permanentlyFailed: 0, deliveryUnknown: 0,
      };
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const handle = startStoryboardAiVideoReconciler(asPool(db), {
      initialDelayMs: 0,
      intervalMs: 2_000,
      workerId: 'worker-isolated',
      poll: vi.fn(),
      billingTick,
      archiveTick,
      legacyBillingTick,
      imageBillingTick,
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4_000);

    expect(billingTick).toHaveBeenCalledTimes(1);
    expect(archiveTick).toHaveBeenCalledTimes(1);
    expect(imageBillingTick).toHaveBeenCalledTimes(1);
    expect(db.calls.filter((call) =>
      call.sql.includes('WITH due_jobs AS'))).toHaveLength(3);
    expect(billingTick).toHaveBeenCalledWith(asPool(db), {
      workerId: 'worker-isolated:billing',
      batchSize: undefined,
      leaseSeconds: 90,
    });
    expect(archiveTick).toHaveBeenCalledWith(asPool(db), {
      workerId: 'worker-isolated:archive',
      batchSize: undefined,
      leaseSeconds: 180,
    });
    expect(imageBillingTick).toHaveBeenCalledWith(asPool(db), {
      workerId: 'worker-isolated:image-billing',
      batchSize: 4,
      leaseSeconds: 90,
    });

    releaseBilling();
    releaseArchive();
    releaseImageBilling();
    await vi.advanceTimersByTimeAsync(0);
    handle.stop();
  });
});
