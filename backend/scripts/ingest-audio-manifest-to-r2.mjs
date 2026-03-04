#!/usr/bin/env node

import crypto from 'node:crypto';
import path from 'node:path';
import { config as dotenv } from 'dotenv';
import fs from 'node:fs/promises';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args.set(key, 'true');
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return args;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function resolveBucket() {
  const direct = firstNonEmpty(
    process.env.CLOUDFLARE_R2_BUCKET,
    process.env.CLOUDFLARE_R2_MODELS_BUCKET
  );
  if (direct) {
    return direct;
  }
  const multi = firstNonEmpty(
    process.env.CLOUDFLARE_R2_MODELS_BUCKETS,
    process.env.CLOUDFLARE_R2_BUCKETS
  );
  if (!multi) {
    return '';
  }
  return multi
    .split(',')
    .map((part) => part.trim())
    .find(Boolean) || '';
}

function sha12(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function normalizeCaseId(value) {
  return (value || 'case').replace(/[^a-z0-9_-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function extensionFromUrl(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const ext = path.extname(url.pathname).toLowerCase();
    if (ext) {
      return ext;
    }
  } catch {
    // ignore and use fallback
  }
  return '.wav';
}

function guessContentType(ext) {
  const normalized = (ext || '').toLowerCase();
  if (normalized === '.wav' || normalized === '.wave') return 'audio/wav';
  if (normalized === '.mp3') return 'audio/mpeg';
  if (normalized === '.flac') return 'audio/flac';
  if (normalized === '.m4a') return 'audio/mp4';
  if (normalized === '.aac') return 'audio/aac';
  if (normalized === '.ogg') return 'audio/ogg';
  if (normalized === '.webm') return 'audio/webm';
  return 'application/octet-stream';
}

async function downloadSource(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) {
    throw new Error(`Download failed ${url} (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  dotenv({ path: path.join(process.cwd(), '.env.local') });
  dotenv({ path: path.join(process.cwd(), '.env') });

  const args = parseArgs(process.argv.slice(2));
  const sourceManifestPath = path.resolve(
    process.cwd(),
    args.get('source-manifest') || 'scripts/storyarc-audio-benchmark.manifest.ifaa-web.json'
  );
  const outputManifestPath = path.resolve(
    process.cwd(),
    args.get('output-manifest') || 'scripts/storyarc-audio-benchmark.manifest.ifaa-r2.json'
  );
  const expiresSeconds = Math.max(
    900,
    Math.min(7 * 24 * 3600, Number.parseInt(args.get('expires-seconds') || '', 10) || 72 * 3600)
  );
  const defaultPrefix = `datasets/storyarc-audio-benchmark/ifaa/${new Date().toISOString().slice(0, 10)}`;
  const prefix = firstNonEmpty(args.get('prefix'), defaultPrefix).replace(/\/+$/g, '');

  const accountId = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ACCOUNT_ID,
    process.env.R2_ACCOUNT_ID,
    process.env.CLOUDFLARE_ACCOUNT_ID
  );
  const endpoint = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ENDPOINT,
    accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''
  );
  const accessKeyId = firstNonEmpty(
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    process.env.R2_ACCESS_KEY_ID
  );
  const secretAccessKey = firstNonEmpty(
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    process.env.R2_SECRET_ACCESS_KEY
  );
  const bucket = resolveBucket();

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('Missing R2 config (endpoint/access key/secret/bucket)');
  }

  const rawManifest = await fs.readFile(sourceManifestPath, 'utf8');
  const sourceManifest = JSON.parse(rawManifest);
  if (!Array.isArray(sourceManifest?.cases) || sourceManifest.cases.length === 0) {
    throw new Error(`Invalid or empty manifest: ${sourceManifestPath}`);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  const cache = new Map();
  let uploaded = 0;
  let reused = 0;

  const mapToR2Url = async (kind, caseId, sourceUrl) => {
    if (!sourceUrl) {
      return sourceUrl;
    }
    if (!/^https?:\/\//i.test(sourceUrl)) {
      throw new Error(`Expected http(s) source URL, got: ${sourceUrl}`);
    }
    const cacheHit = cache.get(sourceUrl);
    if (cacheHit) {
      reused += 1;
      return cacheHit.signedUrl;
    }

    const ext = extensionFromUrl(sourceUrl);
    const key = `${prefix}/${kind}/${normalizeCaseId(caseId)}-${sha12(sourceUrl)}${ext}`;
    const body = await downloadSource(sourceUrl);
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: guessContentType(ext),
      })
    );
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: expiresSeconds }
    );

    uploaded += 1;
    const payload = { key, signedUrl };
    cache.set(sourceUrl, payload);
    return signedUrl;
  };

  const outputCases = [];
  for (const entry of sourceManifest.cases) {
    const caseId = entry?.id || `case-${outputCases.length + 1}`;
    const noisyPath = await mapToR2Url('noisy', caseId, entry?.noisyPath);
    const cleanPath = entry?.cleanPath ? await mapToR2Url('clean', caseId, entry.cleanPath) : undefined;
    outputCases.push({
      ...entry,
      id: caseId,
      noisyPath,
      cleanPath,
    });
  }

  const outputManifest = {
    datasetName: `${sourceManifest.datasetName || 'audio'}-r2`,
    description: `${sourceManifest.description || ''} (ingested to Cloudflare R2 with signed URLs)`.trim(),
    sourceManifest: sourceManifestPath,
    generatedAt: new Date().toISOString(),
    r2: {
      bucket,
      prefix,
      endpoint,
      signedUrlExpiresSeconds: expiresSeconds,
    },
    counts: {
      sourceCases: sourceManifest.cases.length,
      outputCases: outputCases.length,
      uniqueUploadedObjects: uploaded,
      reusedObjects: reused,
    },
    cases: outputCases,
  };

  await fs.writeFile(outputManifestPath, JSON.stringify(outputManifest, null, 2));
  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceManifestPath,
        outputManifestPath,
        bucket,
        prefix,
        uploaded,
        reused,
        caseCount: outputCases.length,
        expiresSeconds,
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
