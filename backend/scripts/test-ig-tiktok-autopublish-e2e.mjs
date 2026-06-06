#!/usr/bin/env node
/**
 * IG container-flow + TikTok auto-publish e2e — verifierer PR 18.
 *
 * Per iteration:
 *   1. Compose en IG-draft fra en insight
 *   2. PATCH image_url (gyldig HTTP-URL)
 *   3. POST /publish → forventer en av:
 *      - ok=true + status='published'/'queued' (hvis IG-connection + R2 finnes)
 *      - ok=false + reason='connection_not_found' (graceful fall-back)
 *      - ok=false + reason='image_required' hvis ingen image_url (skal IKKE skje siden vi setter den)
 *   4. Verifiser at status er enten 'published' eller 'failed' med riktig reason
 *   5. Cleanup: DELETE draft
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '1', 10);

// 1x1 PNG offentlig — Wikimedia. Bare for å vise at HTTP-URL aksepteres.
const TEST_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/The_Earth_seen_from_Apollo_17.jpg/220px-The_Earth_seen_from_Apollo_17.jpg';

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', YELLOW = '\x1b[33m';

let total = 0, failed = 0;
function check(cond, msg) { total++; if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); } }
function note(msg) { console.log(`  ${YELLOW}ℹ${RESET} ${msg}`); }

async function compose() {
  const r = await fetch(`${BASE}/api/role-room/agent/compose-post-from-insight?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brandKey: 'theroleroom',
      platform: 'instagram',
      insightTitle: 'E2E IG container-flow test',
      insightBody: 'Test at IG-broen kobler til container-publisher.',
      insightCategory: 'opportunity',
      actionableStep: 'Test IG publish flow.',
    }),
  });
  return { status: r.status, body: await r.json() };
}

async function patch(id, p) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}?token=${TOKEN}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
  return { status: r.status, body: await r.json() };
}

async function publish(id) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}/publish?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  });
  return { status: r.status, body: await r.json() };
}

async function getDraft(id) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts?token=${TOKEN}&brandKey=theroleroom`);
  const data = await r.json();
  return (data.drafts || []).find((d) => d.id === id);
}

async function deleteDraft(id) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}?token=${TOKEN}`, { method: 'DELETE' });
  return { status: r.status };
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);

  // 1. Compose IG draft
  const c = await compose();
  check(c.status === 200, `compose status 200 (got ${c.status})`);
  const draftId = c.body.draftId;
  check(typeof draftId === 'number', `draftId is number (${draftId})`);
  if (typeof draftId !== 'number') return;

  // 2. Sett image_url
  const p1 = await patch(draftId, { imageUrl: TEST_IMAGE_URL });
  check(p1.body.ok === true, `set imageUrl (status=${p1.status})`);
  check(p1.body.draft?.imageUrl === TEST_IMAGE_URL, `imageUrl persisted`);

  // 3. Publish — forventer en av tre terminale states
  const pub = await publish(draftId);
  const okPublished = pub.status === 200 && pub.body.ok === true &&
    (pub.body.status === 'published' || pub.body.status === 'queued' || pub.body.status === 'scheduled');
  const okConnectionMissing = (pub.status === 502 || pub.status === 503) && pub.body.ok === false &&
    (pub.body.reason === 'connection_not_found' || (pub.body.error || '').includes('IG Business'));
  const okR2Missing = pub.status === 502 && pub.body.ok === false &&
    (pub.body.reason === 'pipeline_error' || (pub.body.error || '').includes('R2') || (pub.body.error || '').includes('Image upload'));
  check(
    okPublished || okConnectionMissing || okR2Missing,
    `publish returned valid terminal state (status=${pub.status}, ok=${pub.body.ok}, reason=${pub.body.reason}, body=${JSON.stringify(pub.body).slice(0, 250)})`,
  );

  if (okPublished) {
    note(`Published! status=${pub.body.status}, externalPostId=${pub.body.externalPostId || pub.body.jobId}`);
  } else if (okConnectionMissing) {
    note(`Forventet failure-mode: IG-connection mangler i prod. Sjekket at koden ikke krasjer.`);
  } else if (okR2Missing) {
    note(`Forventet failure-mode: R2 ikke konfigurert lokalt. Sjekket at koden ikke krasjer.`);
  }

  // 4. GET draft → verifiser status
  const stored = await getDraft(draftId);
  if (stored) {
    if (okPublished && pub.body.status === 'published') {
      check(stored.status === 'published', `stored status === published (got ${stored.status})`);
    } else if (okConnectionMissing || okR2Missing) {
      check(stored.status === 'failed', `stored status === failed (got ${stored.status})`);
      check(typeof stored.publishError === 'string' && stored.publishError.length > 0, `publishError stored`);
    }
    check(stored.imageUrl === TEST_IMAGE_URL, `imageUrl preserved through publish-attempt`);
  }

  // 5. Cleanup
  await deleteDraft(draftId);
  console.log(`  ${GREEN}✓${RESET} iteration done (${total} assertions so far)`);
}

// ─── TikTok-iteration ────────────────────────────────────────────────────
const TEST_VIDEO_URL = 'https://download.samplelib.com/mp4/sample-5s.mp4';

async function composeTikTok() {
  const r = await fetch(`${BASE}/api/role-room/agent/compose-post-from-insight?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brandKey: 'theroleroom',
      platform: 'tiktok',
      insightTitle: 'E2E TikTok container-flow test',
      insightBody: 'Test at TikTok-broen kobler til Content Posting API.',
      insightCategory: 'opportunity',
      actionableStep: 'Test TikTok publish flow.',
    }),
  });
  return { status: r.status, body: await r.json() };
}

async function runTikTokIteration() {
  console.log(`\n${DIM}── TikTok iteration ──${RESET}`);

  const c = await composeTikTok();
  check(c.status === 200, `tiktok compose status 200 (got ${c.status})`);
  const draftId = c.body.draftId;
  check(typeof draftId === 'number', `tiktok draftId is number (${draftId})`);
  if (typeof draftId !== 'number') return;

  // Sett video_url
  const p1 = await patch(draftId, { videoUrl: TEST_VIDEO_URL });
  check(p1.body.ok === true, `set videoUrl (status=${p1.status})`);
  check(p1.body.draft?.videoUrl === TEST_VIDEO_URL, `videoUrl persisted`);

  // Publish — forventer connection_not_found i prod (ingen TikTok-konto enda)
  const pub = await publish(draftId);
  const okPublished = pub.status === 200 && pub.body.ok === true &&
    (pub.body.status === 'published' || pub.body.status === 'queued');
  const okConnectionMissing = (pub.status === 502 || pub.status === 503) && pub.body.ok === false &&
    (pub.body.reason === 'connection_not_found' || (pub.body.error || '').includes('TikTok'));
  check(
    okPublished || okConnectionMissing,
    `tiktok publish returned valid state (status=${pub.status}, reason=${pub.body.reason}, body=${JSON.stringify(pub.body).slice(0, 200)})`,
  );
  if (okPublished) note(`Published til TikTok! ${pub.body.message || ''}`);
  else if (okConnectionMissing) note(`Forventet failure-mode: TikTok-connection mangler. Sjekket at koden ikke krasjer.`);

  await deleteDraft(draftId);
  console.log(`  ${GREEN}✓${RESET} tiktok iteration done`);
}

async function main() {
  console.log(`IG + TikTok auto-publish e2e — ${N} iterations against ${BASE}`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    try { await runIteration(i); } catch (err) { check(false, `iteration crashed: ${err.message}`); }
    if (i < N - 1) await new Promise((r) => setTimeout(r, 1_500));
  }
  try { await runTikTokIteration(); } catch (err) { check(false, `tiktok iteration crashed: ${err.message}`); }
  console.log(`\n${DIM}════════════════════════════════════════════${RESET}`);
  console.log(`Total: ${total}, Failed: ${failed > 0 ? RED + failed + RESET : GREEN + '0' + RESET}, ${Date.now() - t0}ms`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
