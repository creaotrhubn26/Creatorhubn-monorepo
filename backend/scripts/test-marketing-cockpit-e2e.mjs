#!/usr/bin/env node
/**
 * Marketing Cockpit e2e — stability test.
 *
 * Hits /api/role-room/marketing-cockpit/summary against live prod with the
 * demo-bypass token and verifies:
 *   1. HTTP 200 OK
 *   2. JSON parses
 *   3. Top-level `ok: true`
 *   4. All 6 sections present (profile, mentions, cta, ig, leads, hashtags)
 *   5. Each section.ok is a boolean
 *   6. When section.ok=true, expected fields exist with correct types
 *   7. Response time < 30s
 *
 * Runs N iterations (default 5). All must pass for "stable" verdict.
 *
 * Usage:
 *   node backend/scripts/test-marketing-cockpit-e2e.mjs
 *   N=10 node backend/scripts/test-marketing-cockpit-e2e.mjs
 *   BASE=http://localhost:3000 node backend/scripts/test-marketing-cockpit-e2e.mjs
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '5', 10);

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', DIM = '\x1b[2m';

let totalAssertions = 0;
let failedAssertions = 0;

function assert(cond, msg) {
  totalAssertions++;
  if (!cond) {
    failedAssertions++;
    console.log(`  ${RED}✗${RESET} ${msg}`);
    return false;
  }
  return true;
}

function softAssert(cond, msg) {
  // Same as assert, but allows continued checking after a fail.
  return assert(cond, msg);
}

async function fetchCockpit() {
  const url = `${BASE}/api/role-room/marketing-cockpit/summary?token=${encodeURIComponent(TOKEN)}`;
  const t0 = Date.now();
  const resp = await fetch(url);
  const elapsed = Date.now() - t0;
  const text = await resp.text();
  let body;
  try { body = JSON.parse(text); }
  catch { body = { __parseError: text.slice(0, 200) }; }
  return { status: resp.status, body, elapsed };
}

function checkSection(data, key, expectedShape) {
  const section = data[key];
  if (!section) {
    softAssert(false, `${key}: section missing`);
    return;
  }
  softAssert(typeof section.ok === 'boolean', `${key}.ok is boolean`);
  if (section.ok) {
    if (expectedShape) expectedShape(section.data, key);
  } else {
    softAssert(typeof section.error === 'string', `${key}.error is string when degraded`);
  }
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);
  const r = await fetchCockpit();

  softAssert(r.status === 200, `HTTP status 200 (got ${r.status})`);
  if (r.body.__parseError) {
    softAssert(false, `JSON parses (got ${r.body.__parseError})`);
    return;
  }
  softAssert(r.body.ok === true, `top-level ok=true`);
  softAssert(typeof r.body.durationMs === 'number', `durationMs is number (${r.body.durationMs}ms)`);
  softAssert(typeof r.body.generatedAt === 'string', `generatedAt is ISO string`);
  softAssert(r.elapsed < 30_000, `response <30s (${r.elapsed}ms)`);
  softAssert(r.body.configured && typeof r.body.configured.pageId === 'boolean', `configured.pageId boolean`);

  // Profile
  checkSection(r.body, 'profile', (data, k) => {
    softAssert(typeof data.id === 'string' && data.id.length > 0, `${k}.id is non-empty string (${data.id})`);
    softAssert(typeof data.fanCount === 'number', `${k}.fanCount is number (${data.fanCount})`);
    softAssert(typeof data.name === 'string', `${k}.name is string (${data.name})`);
  });

  // Mentions
  checkSection(r.body, 'mentions', (data, k) => {
    softAssert(typeof data.count === 'number', `${k}.count is number (${data.count})`);
    softAssert(Array.isArray(data.recent), `${k}.recent is array`);
  });

  // CTA
  checkSection(r.body, 'cta', (data, k) => {
    softAssert('inferred' in data, `${k}.inferred present`);
    softAssert(data.rawFields && typeof data.rawFields === 'object', `${k}.rawFields object`);
  });

  // IG
  checkSection(r.body, 'ig', (data, k) => {
    softAssert(typeof data.userId === 'string', `${k}.userId string`);
    softAssert(typeof data.followersCount === 'number', `${k}.followersCount number`);
    softAssert(Array.isArray(data.upcomingEvents), `${k}.upcomingEvents array`);
  });

  // Leads
  checkSection(r.body, 'leads', (data, k) => {
    softAssert(typeof data.formCount === 'number', `${k}.formCount number`);
    softAssert(Array.isArray(data.forms), `${k}.forms array`);
  });

  // Hashtags
  checkSection(r.body, 'hashtags', (data, k) => {
    softAssert(Array.isArray(data.tracked), `${k}.tracked array`);
    if (Array.isArray(data.tracked) && data.tracked.length > 0) {
      const first = data.tracked[0];
      softAssert(typeof first.tag === 'string', `${k}.tracked[0].tag is string`);
      softAssert(typeof first.recentMediaCount === 'number', `${k}.tracked[0].recentMediaCount is number`);
    }
  });

  console.log(`  ${GREEN}✓${RESET} iteration completed (${r.elapsed}ms, ${totalAssertions} assertions so far)`);
}

async function main() {
  console.log(`Marketing Cockpit e2e — ${N} iterations against ${BASE}`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    try {
      await runIteration(i);
    } catch (err) {
      softAssert(false, `iteration crashed: ${err.message}`);
    }
    if (i < N - 1) await new Promise((r) => setTimeout(r, 2_000));
  }

  const totalElapsed = Date.now() - t0;
  console.log(`\n${DIM}════════════════════════════════════════════${RESET}`);
  console.log(`Total assertions: ${totalAssertions}`);
  console.log(`Failed:           ${failedAssertions > 0 ? RED + failedAssertions + RESET : GREEN + '0' + RESET}`);
  console.log(`Iterations:       ${N}`);
  console.log(`Total elapsed:    ${totalElapsed}ms (avg ${Math.round(totalElapsed / N)}ms/iter)`);
  if (failedAssertions === 0) {
    console.log(`\n${GREEN}✓ STABLE — all ${N} iterations passed.${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}✗ UNSTABLE — ${failedAssertions} assertion failures across ${N} iterations.${RESET}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${RED}Fatal:${RESET}`, err);
  process.exit(2);
});
