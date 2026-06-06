#!/usr/bin/env node
/**
 * Post engagement e2e — verifierer endepunkter (uten å kreve faktisk
 * publisert post, siden det vil spamme FB Page).
 *
 * Per iteration:
 *   1. GET /post-drafts/:id/engagement på en ikke-eksisterende draft → 200 + empty
 *   2. POST /refresh-engagement på unpublished draft → 400 'draft not yet published'
 *   3. GET /top-performers → 200 + array (kan være tom)
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '2', 10);

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m';

let total = 0, failed = 0;
function check(cond, msg) { total++; if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); } }

async function topPerformers() {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/top-performers?token=${TOKEN}&days=30`);
  return { status: r.status, body: await r.json() };
}
async function engagementForDraft(id) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}/engagement?token=${TOKEN}`);
  return { status: r.status, body: await r.json() };
}
async function refreshEngagement(id) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}/refresh-engagement?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  return { status: r.status, body: await r.json() };
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);

  // 1. top-performers list
  const tp = await topPerformers();
  check(tp.status === 200, `top-performers status 200`);
  check(tp.body.ok === true, `top-performers ok=true`);
  check(Array.isArray(tp.body.topPerformers), `topPerformers array (count=${tp.body.topPerformers?.length})`);

  // 2. engagement for non-existent draft 9999999
  const e = await engagementForDraft(9999999);
  check(e.status === 200, `engagement-history for non-existent status 200`);
  check(Array.isArray(e.body.snapshots), `snapshots array (empty for non-existent)`);
  check(e.body.snapshots.length === 0, `empty for non-existent draft (got ${e.body.snapshots.length})`);

  // 3. refresh-engagement on non-existent draft 9999999
  const rf = await refreshEngagement(9999999);
  check(rf.body.ok === false, `refresh on non-existent draft → ok=false`);
  check(typeof rf.body.error === 'string', `error message present`);

  console.log(`  ${GREEN}✓${RESET} iteration done (${total} assertions so far)`);
}

async function main() {
  console.log(`Post-engagement e2e — ${N} iterations against ${BASE}`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    try { await runIteration(i); } catch (err) { check(false, `iteration crashed: ${err.message}`); }
    if (i < N - 1) await new Promise((r) => setTimeout(r, 1_000));
  }
  console.log(`\n${DIM}════════════════════════════════════════════${RESET}`);
  console.log(`Total: ${total}, Failed: ${failed > 0 ? RED + failed + RESET : GREEN + '0' + RESET}, ${Date.now() - t0}ms`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
