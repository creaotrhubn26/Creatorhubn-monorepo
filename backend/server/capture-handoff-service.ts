import crypto from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  captureAssets,
  captureSessions,
  type CaptureAsset,
} from '../migrations/capture-schema.js';
import { buildCaptureR2Config } from './capture-upload-service.js';

type Db = NodePgDatabase<Record<string, unknown>>;

const DEFAULT_HANDOFF_CONCURRENCY = 4;

export type HandoffFilter =
  | { kind: 'ids'; assetIds: string[] }
  | { kind: 'flagged' }
  | { kind: 'rating_at_least'; rating: number };

export interface HandoffInput {
  preset?: string;
  settings?: Record<string, unknown>;
  filter: HandoffFilter;
  preferredSource?: 'full' | 'preview';
}

export interface HandoffResult {
  handoffId: string;
  requestedCount: number;
  submittedCount: number;
  jobs: Array<{
    assetId: string;
    jobId: string | null;
    status: 'submitted' | 'skipped_no_storage_key' | 'failed';
    error?: string;
  }>;
}

interface EnhancerJobResponse {
  success: boolean;
  job?: { id: string };
}

async function submitToEnhancer(
  endpoint: string,
  body: Record<string, unknown>,
  ownerUserId: string,
): Promise<string | null> {
  const response = await fetch(`${endpoint}/api/photo-enhancer/jobs`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': ownerUserId,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`enhancer_submit_failed_${response.status}`);
  }
  const json = (await response.json()) as EnhancerJobResponse;
  if (!json.success || !json.job?.id) return null;
  return json.job.id;
}

function pickStorageKey(
  asset: Pick<CaptureAsset, 'previewKey' | 'fullKey'>,
  preferred: 'full' | 'preview',
): string | null {
  if (preferred === 'full') return asset.fullKey ?? asset.previewKey;
  return asset.previewKey ?? asset.fullKey;
}

async function selectAssets(
  db: Db,
  sessionId: string,
  filter: HandoffFilter,
): Promise<CaptureAsset[]> {
  const baseCondition = eq(captureAssets.sessionId, sessionId);
  switch (filter.kind) {
    case 'ids':
      if (filter.assetIds.length === 0) return [];
      return db
        .select()
        .from(captureAssets)
        .where(and(baseCondition, inArray(captureAssets.id, filter.assetIds)));
    case 'flagged':
      return db
        .select()
        .from(captureAssets)
        .where(and(baseCondition, eq(captureAssets.flaggedForClient, true)));
    case 'rating_at_least':
      return db
        .select()
        .from(captureAssets)
        .where(and(baseCondition, eq(captureAssets.rating, filter.rating)));
  }
}

async function processWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function runWorker(): Promise<void> {
    while (true) {
      const current = index++;
      if (current >= items.length) return;
      results[current] = await worker(items[current]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, runWorker);
  await Promise.all(workers);
  return results;
}

export async function performHandoff(
  db: Db,
  ownerUserId: string,
  sessionId: string,
  input: HandoffInput,
): Promise<HandoffResult | null> {
  const owns = await db
    .select({ id: captureSessions.id })
    .from(captureSessions)
    .where(
      and(eq(captureSessions.id, sessionId), eq(captureSessions.ownerUserId, ownerUserId)),
    )
    .limit(1);
  if (owns.length === 0) return null;

  const assets = await selectAssets(db, sessionId, input.filter);

  const cfg = buildCaptureR2Config();
  const endpoint =
    process.env.CAPTURE_HANDOFF_ENHANCER_URL?.trim() ||
    `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  const preferredSource = input.preferredSource ?? 'full';
  const handoffId = crypto.randomUUID();

  const jobs = await processWithConcurrency(assets, DEFAULT_HANDOFF_CONCURRENCY, async (asset) => {
    const key = pickStorageKey(asset, preferredSource);
    if (!key || !cfg.bucket) {
      return {
        assetId: asset.id,
        jobId: null,
        status: 'skipped_no_storage_key' as const,
      };
    }
    try {
      const jobId = await submitToEnhancer(
        endpoint,
        {
          source: {
            bucket: cfg.bucket,
            key,
            fileName: asset.originalFilename,
            mimeType: asset.mime,
            size: asset.sizeBytes ?? 0,
            originalHash: asset.checksumSha256 ?? undefined,
          },
          preset: input.preset ?? 'auto',
          settings: input.settings ?? {},
          metadata: {
            captureAssetId: asset.id,
            captureSessionId: sessionId,
            captureHandoffId: handoffId,
          },
        },
        ownerUserId,
      );
      if (!jobId) {
        return { assetId: asset.id, jobId: null, status: 'failed' as const };
      }
      return { assetId: asset.id, jobId, status: 'submitted' as const };
    } catch (err) {
      return {
        assetId: asset.id,
        jobId: null,
        status: 'failed' as const,
        error: err instanceof Error ? err.message : 'unknown',
      };
    }
  });

  return {
    handoffId,
    requestedCount: assets.length,
    submittedCount: jobs.filter((j) => j.status === 'submitted').length,
    jobs,
  };
}
