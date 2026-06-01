#!/usr/bin/env node
/**
 * Post Drafts e2e — full compose → edit → publish-attempt → delete syklus.
 *
 * Hver iteration:
 *   1. Compose draft (Claude) — ~0.12 NOK
 *   2. GET list — verify present
 *   3. PATCH (rediger caption)
 *   4. POST publish (FB → success or LinkedIn → manual_copy)
 *   5. DELETE cleanup
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '2', 10);

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m';

let total = 0, failed = 0;
function check(cond, msg) { total++; if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); } }

async function compose(platform) {
  const r = await fetch(`${BASE}/api/role-room/agent/compose-post-from-insight?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      brandKey: 'theroleroom',
      platform,
      insightTitle: 'E2E-test insight',
      insightBody: 'Dette er en test-insight som ble brukt til å generere en draft i e2e-testen.',
      insightCategory: 'opportunity',
      actionableStep: `Publiser et innlegg om casting-håndverk på ${platform} for å bygge thought leadership.`,
    }),
  });
  return { status: r.status, body: await r.json() };
}
async function list() {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts?token=${TOKEN}&brandKey=theroleroom`);
  return { status: r.status, body: await r.json() };
}
async function patch(id, patchBody) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}?token=${TOKEN}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patchBody),
  });
  return { status: r.status, body: await r.json() };
}
async function publishDraft(id) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}/publish?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  return { status: r.status, body: await r.json() };
}
async function del(id) {
  const r = await fetch(`${BASE}/api/role-room/agent/post-drafts/${id}?token=${TOKEN}`, { method: 'DELETE' });
  return { status: r.status, body: await r.json() };
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);
  // Pick a platform that won't auto-publish (avoid spamming The Role Room FB during tests)
  const platform = 'linkedin';

  // 1. Compose
  const c = await compose(platform);
  check(c.status === 200, `compose status 200 (got ${c.status})`);
  check(c.body.ok === true, `compose.ok=true`);
  check(typeof c.body.draftId === 'number', `draftId is number (got ${c.body.draftId})`);
  check(typeof c.body.composed?.caption === 'string' && c.body.composed.caption.length > 30,
    `caption is meaningful (${c.body.composed?.caption?.length} chars)`);
  check(Array.isArray(c.body.composed?.hashtags), `hashtags array`);
  check(typeof c.body.composed?.imageBrief === 'string', `imageBrief string`);
  check(typeof c.body.composed?.ctaText === 'string', `ctaText string`);
  const draftId = c.body.draftId;

  // 2. List
  const l = await list();
  check(l.status === 200, `list status 200`);
  const found = l.body.drafts?.find((d) => d.id === draftId);
  check(!!found, `draft ${draftId} in list`);
  check(found?.status === 'draft', `initial status=draft`);

  // 3. Edit caption
  const newCaption = (c.body.composed.caption || '') + '\n\nEdited by e2e-test.';
  const p = await patch(draftId, { caption: newCaption });
  check(p.status === 200, `patch status 200`);
  check(p.body.draft?.caption?.endsWith('Edited by e2e-test.'), `caption edited`);
  check(p.body.draft?.status === 'edited', `status=edited after PATCH`);

  // 4. Publish (LinkedIn → manual_copy)
  const pb = await publishDraft(draftId);
  check(pb.status === 200, `publish status 200`);
  check(pb.body.status === 'manual_copy', `LinkedIn → manual_copy (got "${pb.body.status}")`);

  // 5. Delete
  const d = await del(draftId);
  check(d.status === 200, `delete status 200`);
  check(d.body.ok === true, `delete.ok=true`);
  console.log(`  ${GREEN}✓${RESET} iteration done (${total} assertions so far)`);
}

async function main() {
  console.log(`Post Drafts e2e — ${N} iterations against ${BASE}`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    try { await runIteration(i); }
    catch (err) { check(false, `iteration crashed: ${err.message}`); }
    if (i < N - 1) await new Promise((r) => setTimeout(r, 1_500));
  }
  console.log(`\n${DIM}════════════════════════════════════════════${RESET}`);
  console.log(`Total assertions: ${total}`);
  console.log(`Failed:           ${failed > 0 ? RED + failed + RESET : GREEN + '0' + RESET}`);
  console.log(`Iterations:       ${N}`);
  console.log(`Total elapsed:    ${Date.now() - t0}ms`);
  if (failed === 0) { console.log(`\n${GREEN}✓ STABLE — all passed.${RESET}`); process.exit(0); }
  else { console.log(`\n${RED}✗ UNSTABLE.${RESET}`); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(2); });
