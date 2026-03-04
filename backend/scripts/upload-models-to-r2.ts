#!/usr/bin/env tsx

import crypto from 'node:crypto';
import path from 'node:path';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { config as dotenv } from 'dotenv';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

interface CliOptions {
  manifestPath: string;
  prefix: string;
  skipExisting: boolean;
  dryRun: boolean;
  reportPath: string;
}

interface LocalSource {
  type: 'local';
  path: string;
}

interface UrlSource {
  type: 'url';
  url: string;
  headers?: Record<string, string>;
}

type ModelSource = LocalSource | UrlSource;

interface ModelManifestEntry {
  id: string;
  description?: string;
  optional?: boolean;
  contentType?: string;
  r2Key: string;
  sha256?: string;
  source: ModelSource;
}

interface ModelManifestFile {
  manifestVersion: number;
  description?: string;
  models: ModelManifestEntry[];
}

interface UploadResult {
  id: string;
  key: string;
  source: string;
  status: 'uploaded' | 'skipped' | 'validated';
  sizeBytes: number;
  sha256: string;
}

interface FailedResult {
  id: string;
  key: string;
  source: string;
  optional: boolean;
  error: string;
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, 'true');
      continue;
    }
    args.set(key, next);
    index += 1;
  }

  const manifestPath = path.resolve(
    process.cwd(),
    args.get('manifest') || 'scripts/storyarc-models.manifest.json'
  );
  const prefix = normalizePrefix(args.get('prefix') || '');
  const reportPath = path.resolve(
    process.cwd(),
    args.get('report') || path.join('tmp', `storyarc-model-upload-report-${Date.now()}.json`)
  );

  return {
    manifestPath,
    prefix,
    skipExisting: parseBoolean(args.get('skip-existing'), true),
    dryRun: parseBoolean(args.get('dry-run'), false),
    reportPath,
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizePrefix(value: string): string {
  return value.replace(/^\/+/, '').replace(/\/+$/, '');
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function resolveBucket(): string {
  const single = firstNonEmpty(process.env.CLOUDFLARE_R2_BUCKET, process.env.CLOUDFLARE_R2_MODELS_BUCKET);
  if (single) return single;
  const multi = firstNonEmpty(process.env.CLOUDFLARE_R2_MODELS_BUCKETS, process.env.CLOUDFLARE_R2_BUCKETS);
  if (!multi) return '';
  return (
    multi
      .split(',')
      .map((entry) => entry.trim())
      .find(Boolean) || ''
  );
}

function normalizeKey(prefix: string, key: string): string {
  const safeKey = key.replace(/^\/+/, '');
  if (!prefix) return safeKey;
  return `${prefix}/${safeKey}`;
}

function guessContentType(key: string, explicit?: string): string {
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }
  const ext = path.extname(key).toLowerCase();
  if (ext === '.json') return 'application/json';
  if (ext === '.yaml' || ext === '.yml') return 'application/x-yaml';
  if (ext === '.bin') return 'application/octet-stream';
  if (ext === '.pt' || ext === '.pth' || ext === '.th' || ext === '.ckpt' || ext === '.onnx') {
    return 'application/octet-stream';
  }
  if (ext === '.txt' || ext === '.md') return 'text/plain; charset=utf-8';
  if (ext === '.rnnn') return 'application/octet-stream';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.mp3') return 'audio/mpeg';
  return 'application/octet-stream';
}

function hashSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function withTimeout(signalMs: number): AbortSignal {
  return AbortSignal.timeout(Math.max(1_000, signalMs));
}

function isHuggingFaceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === 'huggingface.co';
  } catch {
    return false;
  }
}

async function readSourceBuffer(source: ModelSource): Promise<{ buffer: Buffer; sourceLabel: string }> {
  if (source.type === 'local') {
    const localPath = path.resolve(process.cwd(), source.path);
    if (!existsSync(localPath)) {
      throw new Error(`Local source file not found: ${localPath}`);
    }
    const buffer = await fs.readFile(localPath);
    if (!buffer.length) {
      throw new Error(`Local source file is empty: ${localPath}`);
    }
    return { buffer, sourceLabel: localPath };
  }

  const headers = new Headers(source.headers || {});
  const huggingFaceToken =
    firstNonEmpty(process.env.HUGGINGFACE_TOKEN, process.env.HF_TOKEN) || '';
  if (isHuggingFaceUrl(source.url) && huggingFaceToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${huggingFaceToken}`);
  }

  const response = await fetch(source.url, {
    method: 'GET',
    headers,
    signal: withTimeout(900_000),
  });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${source.url}`);
  }

  const payload = Buffer.from(await response.arrayBuffer());
  if (!payload.length) {
    throw new Error(`Downloaded file is empty: ${source.url}`);
  }
  return {
    buffer: payload,
    sourceLabel: source.url,
  };
}

function normalizeManifest(payload: unknown): ModelManifestFile {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Manifest must be a JSON object');
  }
  const raw = payload as Record<string, unknown>;
  const manifestVersion = Number(raw.manifestVersion);
  if (!(manifestVersion > 0)) {
    throw new Error('Manifest must include positive manifestVersion');
  }
  const rawModels = Array.isArray(raw.models) ? raw.models : [];
  if (rawModels.length === 0) {
    throw new Error('Manifest must include at least one model entry');
  }

  const models: ModelManifestEntry[] = rawModels.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Invalid model entry at index ${index}`);
    }
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === 'string' && record.id.trim().length > 0 ? record.id.trim() : '';
    const r2Key = typeof record.r2Key === 'string' && record.r2Key.trim().length > 0 ? record.r2Key.trim() : '';
    if (!id || !r2Key) {
      throw new Error(`Model entry at index ${index} must include id and r2Key`);
    }

    const sourceRaw = record.source;
    if (!sourceRaw || typeof sourceRaw !== 'object') {
      throw new Error(`Model entry "${id}" is missing source`);
    }
    const sourceRecord = sourceRaw as Record<string, unknown>;
    const sourceType = typeof sourceRecord.type === 'string' ? sourceRecord.type : '';
    let source: ModelSource;
    if (sourceType === 'local') {
      const sourcePath =
        typeof sourceRecord.path === 'string' && sourceRecord.path.trim().length > 0
          ? sourceRecord.path.trim()
          : '';
      if (!sourcePath) {
        throw new Error(`Model entry "${id}" local source must include path`);
      }
      source = {
        type: 'local',
        path: sourcePath,
      };
    } else if (sourceType === 'url') {
      const url =
        typeof sourceRecord.url === 'string' && sourceRecord.url.trim().length > 0
          ? sourceRecord.url.trim()
          : '';
      if (!url) {
        throw new Error(`Model entry "${id}" url source must include url`);
      }
      const headersRaw =
        sourceRecord.headers && typeof sourceRecord.headers === 'object'
          ? (sourceRecord.headers as Record<string, unknown>)
          : {};
      const headers: Record<string, string> = {};
      Object.entries(headersRaw).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim()) {
          headers[key] = value.trim();
        }
      });
      source = {
        type: 'url',
        url,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
      };
    } else {
      throw new Error(`Model entry "${id}" has unsupported source.type: ${sourceType}`);
    }

    const optional = record.optional === true;
    const contentType =
      typeof record.contentType === 'string' && record.contentType.trim().length > 0
        ? record.contentType.trim()
        : undefined;
    const sha256 =
      typeof record.sha256 === 'string' && record.sha256.trim().length > 0
        ? record.sha256.trim().toLowerCase()
        : undefined;
    const description =
      typeof record.description === 'string' && record.description.trim().length > 0
        ? record.description.trim()
        : undefined;

    return {
      id,
      description,
      optional,
      contentType,
      r2Key,
      sha256,
      source,
    };
  });

  return {
    manifestVersion,
    description:
      typeof raw.description === 'string' && raw.description.trim().length > 0
        ? raw.description.trim()
        : undefined,
    models,
  };
}

async function main(): Promise<void> {
  dotenv({ path: path.join(process.cwd(), '.env.local') });
  dotenv({ path: path.join(process.cwd(), '.env') });

  const options = parseArgs(process.argv.slice(2));
  const manifestRaw = await fs.readFile(options.manifestPath, 'utf8');
  const manifest = normalizeManifest(JSON.parse(manifestRaw));

  const accountId = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    process.env.R2_ACCOUNT_ID,
    process.env.CLOUDFLARE_ACCOUNT_ID
  );
  const endpoint = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ENDPOINT,
    accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''
  );
  const accessKeyId = firstNonEmpty(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, process.env.R2_ACCESS_KEY_ID);
  const secretAccessKey = firstNonEmpty(
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY
  );
  const bucket = resolveBucket();
  const hasR2Config = Boolean(endpoint && accessKeyId && secretAccessKey && bucket);
  if (!hasR2Config && !options.dryRun) {
    throw new Error('Missing R2 config (endpoint/access key/secret/bucket)');
  }
  if (!hasR2Config && options.dryRun) {
    console.warn('[warn] R2 config missing; running dry-run source validation only');
  }

  const r2 = hasR2Config
    ? new S3Client({
        region: 'auto',
        endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
      })
    : null;

  const uploaded: UploadResult[] = [];
  const failed: FailedResult[] = [];
  const startedAt = new Date().toISOString();

  for (const model of manifest.models) {
    const key = normalizeKey(options.prefix, model.r2Key);
    try {
      if (options.skipExisting && !options.dryRun && r2) {
        try {
          const head = await r2.send(
            new HeadObjectCommand({
              Bucket: bucket,
              Key: key,
            })
          );
          uploaded.push({
            id: model.id,
            key,
            source: model.source.type === 'local' ? model.source.path : model.source.url,
            status: 'skipped',
            sizeBytes: Number(head.ContentLength || 0),
            sha256: '',
          });
          console.log(`[skip] ${model.id} already exists at r2://${bucket}/${key}`);
          continue;
        } catch {
          // Upload when object does not exist or permission does not allow HEAD.
        }
      }

      const { buffer, sourceLabel } = await readSourceBuffer(model.source);
      const checksum = hashSha256(buffer);
      if (model.sha256 && checksum !== model.sha256) {
        throw new Error(`SHA256 mismatch for ${model.id}: expected ${model.sha256}, got ${checksum}`);
      }

      if (!options.dryRun && r2) {
        await r2.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: guessContentType(key, model.contentType),
            Metadata: {
              model_id: model.id,
              manifest_version: String(manifest.manifestVersion),
            },
          })
        );
      }

      const status: UploadResult['status'] = options.dryRun ? 'validated' : 'uploaded';
      uploaded.push({
        id: model.id,
        key,
        source: sourceLabel,
        status,
        sizeBytes: buffer.byteLength,
        sha256: checksum,
      });
      console.log(
        `${options.dryRun ? '[dry-run]' : '[upload]'} ${model.id} -> r2://${bucket}/${key} (${buffer.byteLength} bytes)`
      );
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : 'Unknown upload error';
      failed.push({
        id: model.id,
        key,
        source: model.source.type === 'local' ? model.source.path : model.source.url,
        optional: model.optional === true,
        error: message,
      });
      if (!model.optional) {
        throw new Error(`Required model "${model.id}" failed: ${message}`);
      }
      console.warn(`[warn] optional model ${model.id} failed: ${message}`);
    }
  }

  await fs.mkdir(path.dirname(options.reportPath), { recursive: true });
  const summary = {
    ok: failed.every((item) => item.optional),
    startedAt,
    completedAt: new Date().toISOString(),
    manifestPath: options.manifestPath,
    manifestVersion: manifest.manifestVersion,
    bucket: bucket || null,
    prefix: options.prefix || null,
    dryRun: options.dryRun,
    skipExisting: options.skipExisting,
    uploadedCount: uploaded.filter((item) => item.status === 'uploaded').length,
    validatedCount: uploaded.filter((item) => item.status === 'validated').length,
    skippedCount: uploaded.filter((item) => item.status === 'skipped').length,
    failedCount: failed.length,
    failedRequiredCount: failed.filter((item) => !item.optional).length,
    uploaded,
    failed,
  };
  await fs.writeFile(options.reportPath, JSON.stringify(summary, null, 2));

  console.log(
    JSON.stringify(
      {
        ...summary,
        reportPath: options.reportPath,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
