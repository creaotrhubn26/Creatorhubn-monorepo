#!/usr/bin/env node
/**
 * Konkurrent-monitor e2e — stability test.
 *
 * Per iteration:
 *   1. Add competitor (Page ID + nickname)
 *   2. GET list — verify new competitor present
 *   3. POST snapshot → verify ok=true + fanCount returned
 *   4. GET snapshots-history — verify ≥1 snapshot
 *   5. DELETE competitor — verify cleanup
 *
 * Uses Norwedfilm Page (since The Role Room's own app has API access to it
 * + we know it has real data — fan_count 226).
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '5', 10);
const NORWEDFILM_PAGE_ID = '2139060606331418';

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m';

let total = 0, failed = 0;
function check(cond, msg) {
  total++;
  if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); }
}

async function add(pageId, nickname) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pageId, nickname, brandKey: 'theroleroom-e2e' }),
  });
  return { status: r.status, body: await r.json() };
}
async function list() {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors?token=${TOKEN}&brandKey=theroleroom-e2e`);
  return { status: r.status, body: await r.json() };
}
async function snapshot(id) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/${id}/snapshot?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  return { status: r.status, body: await r.json() };
}
async function history(id) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/${id}/snapshots?token=${TOKEN}&days=30`);
  return { status: r.status, body: await r.json() };
}
async function del(id) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/${id}?token=${TOKEN}`, {
    method: 'DELETE',
  });
  return { status: r.status, body: await r.json() };
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);
  const t0 = Date.now();
  const nickname = `e2e-test-${i}-${Date.now()}`;

  // 1. Add
  const a = await add(NORWEDFILM_PAGE_ID, nickname);
  check(a.status === 200, `add status 200 (got ${a.status})`);
  check(a.body.ok === true, `add.ok=true`);
  check(typeof a.body.competitor?.id === 'number', `competitor.id is number (got ${a.body.competitor?.id})`);
  const competitorId = a.body.competitor?.id;

  // 2. List should include it
  const l = await list();
  check(l.status === 200, `list status 200`);
  check(Array.isArray(l.body.competitors), `list.competitors is array`);
  const found = l.body.competitors?.find((c) => c.id === competitorId);
  check(!!found, `competitor ${competitorId} present in list`);

  // 3. Snapshot
  const s = await snapshot(competitorId);
  check(s.status === 200, `snapshot status 200 (got ${s.status})`);
  check(s.body.ok === true, `snapshot.ok=true (err: ${s.body.fetchError || 'none'})`);
  check(typeof s.body.snapshot?.fanCount === 'number', `snapshot.fanCount is number (got ${s.body.snapshot?.fanCount})`);
  check(s.body.snapshot?.name === 'Norwedfilm', `snapshot.name=Norwedfilm (got ${s.body.snapshot?.name})`);

  // 4. History
  const h = await history(competitorId);
  check(h.status === 200, `history status 200`);
  check(Array.isArray(h.body.snapshots), `history.snapshots is array`);
  check(h.body.snapshots?.length >= 1, `history has ≥1 snapshot (got ${h.body.snapshots?.length})`);

  // 5. Delete (cleanup)
  const d = await del(competitorId);
  check(d.status === 200, `delete status 200`);
  check(d.body.ok === true, `delete.ok=true`);

  // 6. Verify deleted
  const lAfter = await list();
  const stillThere = lAfter.body.competitors?.find((c) => c.id === competitorId);
  check(!stillThere, `competitor ${competitorId} removed after delete`);

  const elapsed = Date.now() - t0;
  console.log(`  ${GREEN}✓${RESET} iteration done (${elapsed}ms, ${total} assertions so far)`);
}

async function main() {
  console.log(`Konkurrent-monitor e2e — ${N} iterations against ${BASE}`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    try { await runIteration(i); }
    catch (err) { check(false, `iteration crashed: ${err.message}`); }
    if (i < N - 1) await new Promise((r) => setTimeout(r, 1_000));
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
