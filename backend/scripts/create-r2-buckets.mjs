// Lager dedikerte R2-buckets via S3-kompatibel CreateBucket-API.
// Bruker admin-S3-token. Idempotent.

import { S3Client, CreateBucketCommand, ListBucketsCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const ACCOUNT_ID = process.env.R2_ADMIN_ACCOUNT_ID || 'bbda9f467577de94fefbc4f2954db032';
const ACCESS_KEY = process.env.R2_ADMIN_ACCESS_KEY;
const SECRET_KEY = process.env.R2_ADMIN_SECRET_KEY;

if (!ACCESS_KEY || !SECRET_KEY) {
  console.error('Sett R2_ADMIN_ACCESS_KEY og R2_ADMIN_SECRET_KEY i miljøet');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: true,
});

async function listExisting() {
  try {
    const r = await client.send(new ListBucketsCommand({}));
    return new Set((r.Buckets ?? []).map((b) => b.Name));
  } catch (err) {
    console.error('ListBuckets failed:', err.message);
    return new Set();
  }
}

async function ensureBucket(name) {
  try {
    await client.send(new HeadBucketCommand({ Bucket: name }));
    console.log(`  ✓ ${name} fantes`);
    return true;
  } catch {}
  try {
    await client.send(new CreateBucketCommand({ Bucket: name }));
    console.log(`  ✓ ${name} OPPRETTET`);
    return true;
  } catch (err) {
    if (err.name === 'BucketAlreadyExists' || err.name === 'BucketAlreadyOwnedByYou') {
      console.log(`  ✓ ${name} fantes (race)`);
      return true;
    }
    console.error(`  ✗ ${name}: ${err.name} — ${err.message}`);
    return false;
  }
}

console.log('Eksisterende buckets:');
const existing = await listExisting();
[...existing].sort().forEach((b) => console.log(`  • ${b}`));
if (existing.size === 0) console.log('  (ingen eller list-tilgang nektet)');

console.log('\nSørger for disse buckets:');
const targets = ['casting-videos', 'role-room-storyboards'];
for (const b of targets) await ensureBucket(b);

console.log('\nFinal state:');
const after = await listExisting();
[...after].sort().forEach((b) => console.log(`  • ${b}`));
