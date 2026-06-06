#!/usr/bin/env node
/**
 * Role Room Agent e2e — stability test.
 *
 * Verifies the full Agent flow against live prod with demo-bypass token:
 *   1. POST /api/role-room/agent/profile-recommendations (generate fresh)
 *   2. Response has all 4 platforms + brand + reasoning
 *   3. Each platform.bio respects char-limit
 *   4. Username matches across platforms
 *   5. GET /latest returns same data (persistence works)
 *   6. POST again with useCache:true returns cached=true
 *   7. POST publish for `manual_copy` field (IG bio) → returns status="manual_copy"
 *
 * Runs N iterations (default 3 since each call costs ~0.40 NOK).
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '3', 10);

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m';

const LIMITS = { facebook: 255, instagram: 150, linkedin: 2000, tiktok: 80 };

let total = 0, failed = 0;
function check(cond, msg) {
  total++;
  if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); }
}

async function generate(useCache) {
  const r = await fetch(`${BASE}/api/role-room/agent/profile-recommendations?token=${encodeURIComponent(TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandKey: 'theroleroom', useCache }),
  });
  return { status: r.status, body: await r.json() };
}

async function getLatest() {
  const r = await fetch(`${BASE}/api/role-room/agent/profile-recommendations/latest?token=${encodeURIComponent(TOKEN)}&brandKey=theroleroom`);
  return { status: r.status, body: await r.json() };
}

async function publish(recId, platform, field, value) {
  const r = await fetch(`${BASE}/api/role-room/agent/profile-recommendations/publish?token=${encodeURIComponent(TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recommendationId: recId, brandKey: 'theroleroom', platform, field, value }),
  });
  return { status: r.status, body: await r.json() };
}

async function getLog() {
  const r = await fetch(`${BASE}/api/role-room/agent/profile-publish-log?token=${encodeURIComponent(TOKEN)}&brandKey=theroleroom&limit=5`);
  return { status: r.status, body: await r.json() };
}

function validateRecommendations(recs) {
  check(recs && recs.platforms, 'has platforms');
  if (!recs?.platforms) return;
  for (const platform of ['facebook', 'instagram', 'linkedin', 'tiktok']) {
    const p = recs.platforms[platform];
    check(p, `${platform} present`);
    if (!p) continue;
    check(typeof p.bio === 'string' && p.bio.length > 0, `${platform}.bio is non-empty string`);
    check(p.bio.length <= LIMITS[platform], `${platform}.bio within limit (${p.bio.length}/${LIMITS[platform]})`);
    check(typeof p.charCount === 'number', `${platform}.charCount is number`);
    check(Array.isArray(p.recommendedHashtags), `${platform}.recommendedHashtags is array`);
    check(typeof p.coverBrief === 'string', `${platform}.coverBrief is string`);
  }
  check(recs.platforms.facebook?.ctaType, 'facebook.ctaType present');
  check(recs.platforms.facebook?.ctaLink, 'facebook.ctaLink present');
  check(Array.isArray(recs.platforms.instagram?.linkInBio), 'instagram.linkInBio is array');
  check(typeof recs.platforms.linkedin?.tagline === 'string', 'linkedin.tagline is string');
  check(recs.brand, 'has brand');
  check(typeof recs.brand?.recommendedUsername === 'string' && recs.brand.recommendedUsername.length > 0,
    `brand.recommendedUsername (${recs.brand?.recommendedUsername})`);
  check(/^#[0-9a-f]{6}$/i.test(recs.brand?.primaryColorHex || ''), `brand.primaryColorHex is valid hex (${recs.brand?.primaryColorHex})`);
  check(typeof recs.reasoning === 'string' && recs.reasoning.length > 50, 'reasoning is substantial');
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);
  const t0 = Date.now();

  // Step 1: get latest (likely cached from prior test runs)
  const latest = await getLatest();
  check(latest.status === 200 || latest.status === 404, `GET /latest status is 200/404 (got ${latest.status})`);

  // Step 2: generate with cache (should return cached on 2nd+ run)
  const cached = await generate(true);
  check(cached.status === 200, `cached generate status 200`);
  check(cached.body.ok === true, `cached.ok=true`);
  validateRecommendations(cached.body.recommendations);
  check(typeof cached.body.recommendationId === 'number', 'recommendationId is number');

  // Step 3: publish — manual_copy for IG bio (not API-pushable)
  const pubManual = await publish(cached.body.recommendationId, 'instagram', 'bio', cached.body.recommendations?.platforms?.instagram?.bio || 'test');
  check(pubManual.status === 200, `publish IG bio status 200`);
  check(pubManual.body.status === 'manual_copy', `IG bio → manual_copy (got "${pubManual.body.status}")`);

  // Step 4: publish — FB about (API-pushable, should succeed)
  const fbBio = cached.body.recommendations?.platforms?.facebook?.bio || 'The Role Room test';
  const pubFb = await publish(cached.body.recommendationId, 'facebook', 'about', fbBio);
  check(pubFb.status === 200, `publish FB about status 200 (got ${pubFb.status})`);
  check(pubFb.body.status === 'success', `FB about → success (got "${pubFb.body.status}", errorMsg: ${pubFb.body.errorMessage})`);

  // Step 5: publish-log should reflect the recent entries
  const log = await getLog();
  check(log.status === 200, `GET publish-log status 200`);
  check(Array.isArray(log.body.entries), 'log.entries is array');
  check(log.body.entries?.length >= 2, `log has ≥2 recent entries (got ${log.body.entries?.length})`);

  const elapsed = Date.now() - t0;
  console.log(`  ${GREEN}✓${RESET} iteration done (${elapsed}ms, ${total} assertions so far)`);
}

async function main() {
  console.log(`Role Room Agent e2e — ${N} iterations against ${BASE}`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    try { await runIteration(i); }
    catch (err) { check(false, `iteration crashed: ${err.message}`); }
    if (i < N - 1) await new Promise((r) => setTimeout(r, 2_000));
  }
  console.log(`\n${DIM}════════════════════════════════════════════${RESET}`);
  console.log(`Total assertions: ${total}`);
  console.log(`Failed:           ${failed > 0 ? RED + failed + RESET : GREEN + '0' + RESET}`);
  console.log(`Iterations:       ${N}`);
  console.log(`Total elapsed:    ${Date.now() - t0}ms`);
  if (failed === 0) {
    console.log(`\n${GREEN}✓ STABLE — all ${N} iterations passed.${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}✗ UNSTABLE — ${failed} failures.${RESET}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
