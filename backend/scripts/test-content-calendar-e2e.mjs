#!/usr/bin/env node
/**
 * Content-kalender e2e — verifierer GET /content-calendar + PATCH schedule.
 *
 * Per iteration:
 *   1. GET content-calendar med default window → returns scheduled[] + unscheduled[]
 *   2. GET med custom window → verify dates respected
 *   3. PATCH suggestedPublishTime på en eksisterende draft → verify saved
 *   4. PATCH suggestedPublishTime=null → unschedules
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '2', 10);

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m';

let total = 0, failed = 0;
function check(cond, msg) { total++; if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); } }

async function getCal(from, to) {
  const q = new URLSearchParams({ brandKey: 'theroleroom', token: TOKEN });
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/content-calendar?${q}`);
  return { status: r.status, body: await r.json() };
}

async function ensureDraftExists() {
  // Try to compose a draft to use for PATCH test
  const r = await fetch(`${BASE}/api/role-room/agent/compose-post-from-insight?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brandKey: 'theroleroom',  // match getCal default brandKey
      platform: 'linkedin',
      insightTitle: 'E2E calendar test insight',
      insightBody: 'En kort body for å lage en draft som vi kan bruke til schedule-test.',
      insightCategory: 'opportunity',
      actionableStep: 'Test calendar scheduling.',
    }),
  });
  const d = await r.json();
  return d.draftId;
}

async function patchDraft(id, patch) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}?token=${TOKEN}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return { status: r.status, body: await r.json() };
}

async function deleteDraft(id) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}?token=${TOKEN}`, { method: 'DELETE' });
  return { status: r.status, body: await r.json() };
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);

  // 1. Default window
  const def = await getCal();
  check(def.status === 200, `default-window status 200`);
  check(def.body.ok === true, `default ok=true`);
  check(Array.isArray(def.body.scheduled), `scheduled[] array`);
  check(Array.isArray(def.body.unscheduled), `unscheduled[] array`);
  check(typeof def.body.counts === 'object', `counts object`);
  check(typeof def.body.from === 'string' && typeof def.body.to === 'string', `from/to ISO strings`);

  // 2. Custom window — Jan 2026
  const from = '2026-01-01T00:00:00Z';
  const to = '2026-01-31T23:59:59Z';
  const custom = await getCal(from, to);
  check(custom.body.from?.startsWith('2026-01-01'), `custom from honored (${custom.body.from})`);

  // 3. Compose + schedule
  const draftId = await ensureDraftExists();
  check(typeof draftId === 'number', `composed draft for schedule-test (id=${draftId})`);
  if (typeof draftId === 'number') {
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const p1 = await patchDraft(draftId, { suggestedPublishTime: futureDate });
    check(p1.body.ok === true, `PATCH suggestedPublishTime ok=true`);
    check(typeof p1.body.draft?.suggestedPublishTime === 'string', `draft.suggestedPublishTime saved`);

    // 4. Verify it appears in calendar
    const cal = await getCal(new Date(Date.now()).toISOString(), new Date(Date.now() + 14 * 86400000).toISOString());
    const found = cal.body.scheduled?.find((p) => p.id === draftId);
    check(!!found, `scheduled draft appears in calendar`);

    // 5. Unschedule
    const p2 = await patchDraft(draftId, { suggestedPublishTime: null });
    check(p2.body.ok === true, `PATCH unschedule ok=true`);

    // Cleanup
    await deleteDraft(draftId);
  }

  console.log(`  ${GREEN}✓${RESET} iteration done (${total} assertions so far)`);
}

async function main() {
  console.log(`Content-calendar e2e — ${N} iterations against ${BASE}`);
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
