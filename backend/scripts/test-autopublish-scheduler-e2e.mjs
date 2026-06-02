#!/usr/bin/env node
/**
 * Auto-publish scheduler e2e — verifierer PR 11.
 *
 * Per iteration:
 *   1. Compose en LinkedIn-draft + sett suggestedPublishTime til 1 sek frem
 *   2. PATCH autoPublishEnabled=true
 *   3. POST /autopublish-scheduler/tick (manuell trigger)
 *   4. Verifiser at draft har auto_publish_attempts >= 1
 *   5. GET /status — verifiser config + state oppdatert
 *   6. Cleanup: DELETE draft
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '1', 10);

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', YELLOW = '\x1b[33m';

let total = 0, failed = 0;
function check(cond, msg) { total++; if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); } }
function note(msg) { console.log(`  ${YELLOW}ℹ${RESET} ${msg}`); }

async function compose() {
  const r = await fetch(`${BASE}/api/role-room/agent/compose-post-from-insight?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brandKey: 'theroleroom',
      platform: 'linkedin',
      insightTitle: 'E2E autopublish scheduler',
      insightBody: 'Test at scheduler plukker opp og trigger publish.',
      insightCategory: 'opportunity',
      actionableStep: 'Test scheduler tick.',
    }),
  });
  return { status: r.status, body: await r.json() };
}

async function patch(id, patchBody) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}?token=${TOKEN}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patchBody),
  });
  return { status: r.status, body: await r.json() };
}

async function deleteDraft(id) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}?token=${TOKEN}`, { method: 'DELETE' });
  return { status: r.status };
}

async function tick() {
  const r = await fetch(`${BASE}/api/role-room/agent/autopublish-scheduler/tick?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
  });
  return { status: r.status, body: await r.json() };
}

async function status() {
  const r = await fetch(`${BASE}/api/role-room/agent/autopublish-scheduler/status?token=${TOKEN}`);
  return { status: r.status, body: await r.json() };
}

async function getDraft(id) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts?token=${TOKEN}&brandKey=theroleroom`);
  const data = await r.json();
  return (data.drafts || []).find((d) => d.id === id);
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);

  // 1. Compose
  const c = await compose();
  const draftId = c.body.draftId;
  check(typeof draftId === 'number', `composed draft (id=${draftId})`);
  if (typeof draftId !== 'number') return;

  // 2. Sett suggestedPublishTime = nå (litt i fortid for sikkerhets skyld) + enable auto-publish
  const past = new Date(Date.now() - 5_000).toISOString();
  const p1 = await patch(draftId, { suggestedPublishTime: past });
  check(p1.body.ok === true, `set suggestedPublishTime (status=${p1.status})`);

  const p2 = await patch(draftId, { autoPublishEnabled: true });
  check(p2.body.ok === true, `enable autoPublish (status=${p2.status})`);
  check(p2.body.draft?.autoPublishEnabled === true, `autoPublishEnabled returned true`);

  // 3. Status før tick — verifiser at draft er due
  const s1 = await status();
  check(s1.body.ok === true, `status endpoint ok`);
  check(typeof s1.body.dueCount === 'number' && s1.body.dueCount >= 1, `dueCount >= 1 (got ${s1.body.dueCount})`);
  check(s1.body.config?.maxAttempts === 3, `config.maxAttempts === 3`);

  // 4. Manuell tick
  const t = await tick();
  check(t.body.ok === true, `tick ok`);
  check(typeof t.body.processed === 'number' && t.body.processed >= 1, `processed >= 1 (got ${t.body.processed})`);

  // 5. Verifiser at draft har attempts >= 1 nå
  const draft = await getDraft(draftId);
  if (draft) {
    check((draft.autoPublishAttempts ?? 0) >= 1, `draft.autoPublishAttempts >= 1 (got ${draft.autoPublishAttempts})`);
    check(typeof draft.autoPublishAttemptedAt === 'string', `autoPublishAttemptedAt populated`);
    note(`Draft etter tick: status=${draft.status}, attempts=${draft.autoPublishAttempts}, error=${draft.publishError || 'none'}`);
  }

  // 6. Cleanup
  await deleteDraft(draftId);
  console.log(`  ${GREEN}✓${RESET} iteration done (${total} assertions so far)`);
}

async function main() {
  console.log(`Auto-publish scheduler e2e — ${N} iterations against ${BASE}`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    try { await runIteration(i); } catch (err) { check(false, `iteration crashed: ${err.message}`); }
    if (i < N - 1) await new Promise((r) => setTimeout(r, 1_500));
  }
  console.log(`\n${DIM}════════════════════════════════════════════${RESET}`);
  console.log(`Total: ${total}, Failed: ${failed > 0 ? RED + failed + RESET : GREEN + '0' + RESET}, ${Date.now() - t0}ms`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
