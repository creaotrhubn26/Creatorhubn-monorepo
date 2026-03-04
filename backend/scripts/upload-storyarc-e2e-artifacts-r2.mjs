#!/usr/bin/env node

import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { config as dotenv } from 'dotenv';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function parseArgs(argv) {
  const args = new Map();
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
  const single = firstNonEmpty(process.env.CLOUDFLARE_R2_BUCKET, process.env.CLOUDFLARE_R2_MODELS_BUCKET);
  if (single) return single;
  const multi = firstNonEmpty(process.env.CLOUDFLARE_R2_MODELS_BUCKETS, process.env.CLOUDFLARE_R2_BUCKETS);
  if (!multi) return '';
  return multi
    .split(',')
    .map((entry) => entry.trim())
    .find(Boolean) || '';
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.json') return 'application/json';
  return 'application/octet-stream';
}

async function main() {
  dotenv({ path: path.join(process.cwd(), '.env.local') });
  dotenv({ path: path.join(process.cwd(), '.env') });

  const args = parseArgs(process.argv.slice(2));
  const inputDir = path.resolve(process.cwd(), args.get('input-dir') || '');
  if (!inputDir) {
    throw new Error('Missing --input-dir');
  }

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
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error('Missing R2 credentials or bucket');
  }

  const expiresSeconds = Math.max(
    900,
    Math.min(7 * 24 * 3600, Number.parseInt(args.get('expires-seconds') || '', 10) || 72 * 3600)
  );
  const defaultPrefix = `datasets/storyarc-wedding-e2e/${new Date().toISOString().slice(0, 10)}/${crypto
    .createHash('sha1')
    .update(inputDir)
    .digest('hex')
    .slice(0, 12)}`;
  const prefix = firstNonEmpty(args.get('prefix'), defaultPrefix).replace(/\/+$/g, '');

  const requiredFiles = ['source.mp4', 'speech-raw.wav', 'speech-clean.wav', 'storyarc-wedding-e2e-result.json'];
  const files = [];
  for (const fileName of requiredFiles) {
    const filePath = path.join(inputDir, fileName);
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        files.push(filePath);
      }
    } catch {
      // optional if missing
    }
  }
  if (files.length === 0) {
    throw new Error(`No known artifacts found in ${inputDir}`);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });

  const uploads = [];
  for (const filePath of files) {
    const body = await fs.readFile(filePath);
    const key = `${prefix}/${path.basename(filePath)}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: guessContentType(filePath),
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
    uploads.push({
      fileName: path.basename(filePath),
      key,
      signedUrl,
      sizeBytes: body.byteLength,
    });
  }

  const outputPath = path.join(inputDir, 'storyarc-wedding-e2e-r2-links.json');
  await fs.writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        inputDir,
        bucket,
        prefix,
        expiresSeconds,
        uploads,
      },
      null,
      2
    )
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        uploadedCount: uploads.length,
        bucket,
        prefix,
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
