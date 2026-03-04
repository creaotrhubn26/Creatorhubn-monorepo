import { readFileSync } from 'fs';
import { config as dotenv } from 'dotenv';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

dotenv({ path: '/Users/usmanqazi/github/creatorhub/backend/.env' });

const rawBucket =
  process.env.CLOUDFLARE_R2_BUCKET ||
  process.env.CLOUDFLARE_R2_MODELS_BUCKET ||
  process.env.CLOUDFLARE_R2_MODELS_BUCKETS ||
  'ml-models';
const bucket = rawBucket.split(',')[0].trim();

const key = 'models/audio/rnnoise/leavened-quisling-2018-08-31-lq.rnnn';
const filePath = '/Users/usmanqazi/github/creatorhub/backend/config/models/rnnoise/lq.rnnn';
const body = readFileSync(filePath);

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

if (!accountId || !endpoint || !accessKeyId || !secretAccessKey || !bucket) {
  throw new Error('Missing R2 endpoint/account/credentials/bucket in backend/.env');
}

const s3 = new S3Client({
  region: 'auto',
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey }
});

await s3.send(new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  Body: body,
  ContentType: 'application/octet-stream'
}));

const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

console.log(
  JSON.stringify(
    {
      bucket,
      key,
      size: head.ContentLength,
      etag: head.ETag,
      endpoint
    },
    null,
    2
  )
);
