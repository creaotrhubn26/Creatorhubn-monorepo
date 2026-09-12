#!/usr/bin/env node
/**
 * Drive a RAW through the Photo Enhancer QUEUE path (the real product flow
 * for large files), instead of the sync /enhance path which OOMs on big RAW.
 *
 *   multipart init → proxy-part upload → complete → POST /jobs → poll
 *
 * Usage:
 *   node scripts/enhance-via-queue.mjs --url https://backend --raw shot.cr2 [--lens] [--auth TOKEN]
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const has = (n) => process.argv.includes(`--${n}`);

const baseUrl = (arg('url', process.env.PHOTO_ENHANCER_VERIFY_URL) || '').replace(/\/+$/, '');
const rawPath = arg('raw', null);
const lens = has('lens');
const authToken = arg('auth', process.env.PHOTO_ENHANCER_VERIFY_TOKEN || '');
if (!baseUrl || !rawPath) { console.error('Usage: --url <backend> --raw <file> [--lens] [--auth TOKEN]'); process.exit(1); }

const H = authToken ? { Authorization: `Bearer ${authToken}` } : {};
const jhdr = { 'Content-Type': 'application/json', ...H };

function rawMime(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ '.cr2': 'image/x-canon-cr2', '.cr3': 'image/x-canon-cr3', '.nef': 'image/x-nikon-nef',
    '.arw': 'image/x-sony-arw', '.raf': 'image/x-fuji-raf', '.dng': 'image/x-adobe-dng' })[ext] || 'application/octet-stream';
}
const api = (p) => `${baseUrl}/api/photo-enhancer${p}`;
async function jpost(p, body) {
  const r = await fetch(api(p), { method: 'POST', headers: jhdr, body: JSON.stringify(body) });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = { _raw: t.slice(0, 200) }; }
  if (!r.ok) throw new Error(`POST ${p} → HTTP ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const buffer = await readFile(rawPath);
  const fileName = path.basename(rawPath);
  const contentType = rawMime(rawPath);
  console.log(`→ ${fileName} (${(buffer.length / 1048576).toFixed(1)} MB), lens=${lens}`);

  // 1) init multipart
  const init = await jpost('/uploads/multipart', {
    fileName, contentType, size: buffer.length, preferredPartSizeBytes: 8 * 1024 * 1024,
  });
  const up = init.upload || init;
  const { bucket, key, uploadId, partSize, partCount } = up;
  console.log(`  multipart: ${partCount} part(s) × ${(partSize / 1048576).toFixed(0)} MB  (uploadId ${String(uploadId).slice(0, 12)}…)`);

  // 2) upload parts via server proxy
  const parts = [];
  for (let n = 1; n <= partCount; n++) {
    const start = (n - 1) * partSize;
    const chunk = buffer.subarray(start, Math.min(buffer.length, start + partSize));
    const fd = new FormData();
    fd.append('bucket', bucket); fd.append('key', key); fd.append('uploadId', uploadId);
    fd.append('partNumber', String(n));
    fd.append('part', new Blob([chunk], { type: 'application/octet-stream' }), `${fileName}.part-${n}`);
    const r = await fetch(api('/uploads/multipart/proxy-part'), { method: 'POST', headers: H, body: fd });
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = {}; }
    if (!r.ok) throw new Error(`proxy-part ${n} → HTTP ${r.status}: ${t.slice(0, 200)}`);
    const etag = j.part?.etag || j.etag;
    if (!etag) throw new Error(`proxy-part ${n}: no etag`);
    parts.push({ partNumber: n, etag });
    console.log(`  part ${n}/${partCount} uploaded`);
  }

  // 3) complete
  const completed = await jpost('/uploads/multipart/complete', {
    bucket, key, uploadId, fileName, contentType, size: buffer.length, parts,
  });
  const source = completed.source || completed;
  console.log('  upload complete → R2 source ready');

  // 4) create job
  const settings = {
    lensCorrection: { enabled: lens, auto: true, distortion: 0, vignette: 0, chromaticAberration: 0 },
    perFaceOverrides: [],
  };
  const created = await jpost('/jobs', { source, preset: 'auto', settings, projectId: 'verify-lens' });
  const jobId = created.job?.id || created.id;
  console.log(`  job created: ${jobId}`);

  // 5) poll
  let job = created.job || created;
  for (let i = 0; i < 120; i++) {
    if (['completed', 'failed', 'cancelled'].includes(job.status)) break;
    await sleep(3000);
    const r = await fetch(api(`/jobs/${encodeURIComponent(jobId)}`), { headers: H });
    const j = await r.json().catch(() => ({}));
    job = j.job || j;
    process.stdout.write(`  [${i}] status=${job.status} progress=${Math.round(job.progress || 0)}%   \r`);
  }
  console.log('');

  const result = job.result || {};
  const enhancedUrl = result.enhancedImageUrl || result.imageUrl || result.url || '';
  console.log('—'.repeat(50));
  console.log(`  final status:          ${job.status}`);
  console.log(`  rawConverter:          ${result.rawConverter ?? job.rawConverter ?? '(n/a)'}`);
  console.log(`  lensCorrectionApplied: ${Boolean(result.lensCorrectionApplied ?? job.lensCorrectionApplied)}`);
  console.log(`  enhanced image:        ${enhancedUrl ? '✓ produced (' + (enhancedUrl.startsWith('data:') ? 'data url' : enhancedUrl.slice(0, 60)) + ')' : '✖ none'}`);
  const convErrors = result.conversionErrors ?? job.conversionErrors;
  if (Array.isArray(convErrors) && convErrors.length) {
    console.log('  conversionErrors (swallowed converter failures):');
    for (const e of convErrors) console.log(`    - ${e}`);
  }
  if (job.failureReason) console.log(`  failureReason:         ${job.failureReason}`);

  if (job.status !== 'completed' || !enhancedUrl) {
    console.error('\n✖ Queue enhance did not complete with a result.');
    process.exit(1);
  }
  console.log('\n✓ Queue enhance completed successfully.');
  process.exit(0);
} catch (e) {
  console.error(`\n✖ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
