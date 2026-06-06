#!/usr/bin/env node
/**
 * Campaign Actions e2e — stability test.
 *
 * Verifies the 2 quick-action endpoints in marketing-cockpit-routes.ts:
 *   - POST /api/role-room/marketing-cockpit/actions/set-cta
 *   - POST /api/role-room/marketing-cockpit/actions/publish-event
 *
 * Each iteration:
 *   1. Set CTA to LEARN_MORE → website-felt (modern Meta API)
 *   2. Verify ok=true, modernApi.field=='website'
 *   3. Publish an IG event with random title
 *   4. Verify ok=true and eventId returned
 *   5. Cleanup: try to set CTA back to BOOK_NOW (phone-felt)
 *
 * Runs N iterations. Each publishes a NEW event so we'll accumulate
 * test-events on the IG account — that's fine for a brand-new Page.
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '3', 10);

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m';

let total = 0, failed = 0;
function check(cond, msg) {
  total++;
  if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); }
}

async function setCta(ctaType, ctaUrl) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/actions/set-cta?token=${encodeURIComponent(TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ctaType, ctaUrl }),
  });
  return { status: r.status, body: await r.json() };
}

async function publishEvent(title, startTime, opts = {}) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/actions/publish-event?token=${encodeURIComponent(TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, startTime, ...opts }),
  });
  return { status: r.status, body: await r.json() };
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);
  const t0 = Date.now();

  // Step 1: Set CTA to LEARN_MORE
  const ctaUrl = `https://theroleroom.com/test-${i}-${Date.now()}`;
  const cta1 = await setCta('LEARN_MORE', ctaUrl);
  check(cta1.status === 200, `set-cta LEARN_MORE status 200 (got ${cta1.status})`);
  check(cta1.body.ok === true, `cta1.ok=true (note: ${cta1.body.note || ''})`);
  check(cta1.body.modernApi?.field === 'website', `modernApi.field=website (got ${cta1.body.modernApi?.field})`);
  check(cta1.body.modernApi?.ok === true, `modernApi.ok=true`);

  // Step 2: Publish IG event
  const startTime = new Date(Date.now() + (24 + i) * 3600 * 1000).toISOString();
  const evt = await publishEvent(
    `Test e2e Open Casting ${i}-${Date.now()}`,
    startTime,
    { venueName: 'Filmens Hus, Oslo (test)', description: 'E2E-test — kan slettes.' },
  );
  check(evt.status === 200, `publish-event status 200 (got ${evt.status})`);
  check(evt.body.ok === true, `event.ok=true (error: ${evt.body.error || 'none'})`);
  check(typeof evt.body.eventId === 'string' && evt.body.eventId.length > 0, `eventId is non-empty string (got ${evt.body.eventId})`);

  // Step 3: Set CTA to BOOK_NOW (uses phone-felt)
  const cta2 = await setCta('BOOK_NOW', '+4799999999');
  check(cta2.status === 200, `set-cta BOOK_NOW status 200`);
  check(cta2.body.ok === true, `cta2.ok=true`);
  check(cta2.body.modernApi?.field === 'phone', `modernApi.field=phone (got ${cta2.body.modernApi?.field})`);

  const elapsed = Date.now() - t0;
  console.log(`  ${GREEN}✓${RESET} iteration done (${elapsed}ms, ${total} assertions so far)`);
}

async function main() {
  console.log(`Campaign Actions e2e — ${N} iterations against ${BASE}`);
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
  if (failed === 0) {
    console.log(`\n${GREEN}✓ STABLE — all ${N} iterations passed.${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}✗ UNSTABLE — ${failed} failures.${RESET}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(2); });
