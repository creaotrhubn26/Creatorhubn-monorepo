#!/usr/bin/env node
/**
 * IG-konkurrent e2e — add → snapshot → verify metrics → delete-syklus.
 * Bruker StudioBinder (@studiobinder) som testfiksjon siden vi har bekreftet
 * den er IG Business-verifisert og synlig via business_discovery.
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '2', 10);

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m';

let total = 0, failed = 0;
function check(cond, msg) { total++; if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); } }

async function add(igUsername, nickname) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandKey: 'theroleroom-ig-test', accountType: 'instagram', igUsername, nickname }),
  });
  return { status: r.status, body: await r.json() };
}
async function snapshot(id) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/${id}/snapshot?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  return { status: r.status, body: await r.json() };
}
async function list() {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors?token=${TOKEN}&brandKey=theroleroom-ig-test`);
  return { status: r.status, body: await r.json() };
}
async function del(id) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/${id}?token=${TOKEN}`, { method: 'DELETE' });
  return { status: r.status, body: await r.json() };
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);
  const username = 'studiobinder';
  const nickname = `StudioBinder e2e-${i}-${Date.now()}`;

  // 1. Add as IG
  const a = await add(username, nickname);
  check(a.status === 200, `add IG status 200 (got ${a.status})`);
  check(a.body.ok === true, `add.ok=true`);
  check(a.body.competitor?.accountType === 'instagram', `accountType=instagram`);
  check(a.body.competitor?.igUsername === username.toLowerCase(), `igUsername normalized`);
  check(a.body.competitor?.pageId === `ig:${username.toLowerCase()}`, `pageId stored as 'ig:'-prefix`);
  const id = a.body.competitor?.id;

  // 2. List shows it as IG
  const l = await list();
  const found = l.body.competitors?.find((c) => c.id === id);
  check(found?.accountType === 'instagram', `list returns accountType=instagram`);

  // 3. Snapshot via business_discovery
  const s = await snapshot(id);
  check(s.status === 200, `snapshot status 200 (got ${s.status})`);
  check(s.body.ok === true, `snapshot.ok=true (err: ${s.body.fetchError || 'none'})`);
  check(typeof s.body.snapshot?.fanCount === 'number' && s.body.snapshot.fanCount > 1000,
        `IG followers > 1000 (got ${s.body.snapshot?.fanCount})`);
  check(s.body.snapshot?.name?.toLowerCase().includes('binder') || s.body.snapshot?.name === 'StudioBinder',
        `snapshot.name contains StudioBinder (${s.body.snapshot?.name})`);

  // 4. Delete cleanup
  const d = await del(id);
  check(d.body.ok === true, `delete.ok=true`);

  console.log(`  ${GREEN}✓${RESET} iteration done (${total} assertions so far)`);
}

async function main() {
  console.log(`IG-konkurrent e2e — ${N} iterations against ${BASE}`);
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
