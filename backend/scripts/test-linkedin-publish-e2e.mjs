#!/usr/bin/env node
/**
 * LinkedIn auto-publish e2e — verifierer at PR 14 sin LinkedIn-bro fungerer.
 *
 * Per iteration:
 *   1. Compose en LinkedIn-draft fra en insight
 *   2. POST publish → forventer enten:
 *      - status 200 + ok=true + status='published' (hvis LinkedIn-connection finnes)
 *      - status 502 + ok=false + reason='connection_not_found' (graceful fall-back)
 *   3. GET drafts → verifiserer at status er oppdatert
 *   4. Cleanup: DELETE drafts
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '1', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

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
      insightTitle: 'E2E LinkedIn publish test',
      insightBody: 'En kort tekst som tester at LinkedIn-broen kobler mot dispatcher.',
      insightCategory: 'opportunity',
      actionableStep: 'Test LinkedIn publish flow.',
    }),
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
  return { status: r.status, body: await r.json() };
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);

  // 1. Compose
  const c = await compose();
  check(c.status === 200, `compose status 200 (got ${c.status})`);
  check(c.body.ok === true, `compose ok=true`);
  const draftId = c.body.draftId;
  check(typeof draftId === 'number', `draftId is number (${draftId})`);
  if (typeof draftId !== 'number') return;

  if (DRY_RUN) {
    note('DRY_RUN=1 — skipping actual publish, cleaning up');
    await deleteDraft(draftId);
    return;
  }

  // 2. Publish
  const p = await publish(draftId);
  const okPublished = p.status === 200 && p.body.ok === true && p.body.status === 'published';
  const okConnectionMissing = p.status === 502 && p.body.ok === false &&
    (p.body.reason === 'connection_not_found' || (p.body.error || '').includes('LinkedIn'));
  check(okPublished || okConnectionMissing,
    `publish returned valid state (status=${p.status}, ok=${p.body.ok}, body=${JSON.stringify(p.body).slice(0, 200)})`);

  if (okPublished) {
    note(`Published! externalPostId=${p.body.externalPostId}`);
    check(typeof p.body.permalink === 'string', `permalink present`);
  } else if (okConnectionMissing) {
    note(`Forventet failure-mode: LinkedIn-connection mangler i prod. Sjekket at koden ikke krasjer.`);
  }

  // 3. GET draft — verifiser status oppdatert
  const stored = await getDraft(draftId);
  if (stored) {
    if (okPublished) {
      check(stored.status === 'published', `stored status === published (got ${stored.status})`);
      check(typeof stored.externalPostId === 'string', `externalPostId stored`);
    } else {
      check(stored.status === 'failed', `stored status === failed (got ${stored.status})`);
      check(typeof stored.publishError === 'string' && stored.publishError.length > 0, `publishError stored`);
    }
  }

  // 4. Cleanup
  await deleteDraft(draftId);
  console.log(`  ${GREEN}✓${RESET} iteration done (${total} assertions so far)`);
}

async function main() {
  console.log(`LinkedIn publish e2e — ${N} iterations against ${BASE}`);
  if (DRY_RUN) console.log(`${YELLOW}DRY_RUN=1 — compose + cleanup only${RESET}`);
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
