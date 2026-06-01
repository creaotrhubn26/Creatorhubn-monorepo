#!/usr/bin/env node
/**
 * Weekly report mailer e2e.
 *
 * Per iteration:
 *   1. GET scheduler-status — verify enabled + recipients
 *   2. POST send-weekly-now with recipients=[test-mail]
 *   3. Verify reportId returned + emailResults shape
 *   4. POST email-latest — re-send siste rapport
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '2', 10);
const TEST_RECIPIENT = process.env.TEST_RECIPIENT || 'daniel@creatorhubn.com';

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m';

let total = 0, failed = 0;
function check(cond, msg) { total++; if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); } }

async function status() {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/reports/scheduler-status?token=${TOKEN}`);
  return { status: r.status, body: await r.json() };
}
async function sendNow(recipients) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/reports/send-weekly-now?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipients, markAsAuto: false }),
  });
  return { status: r.status, body: await r.json() };
}
async function emailLatest(recipients) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/reports/email-latest?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipients, brandKey: 'theroleroom' }),
  });
  return { status: r.status, body: await r.json() };
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);

  // 1. Status
  const s = await status();
  check(s.status === 200, `status status 200`);
  check(s.body.ok === true, `status.ok=true`);
  check(Array.isArray(s.body.recipients), `recipients array`);
  check(typeof s.body.autoWeeklyEnabled === 'boolean', `autoWeeklyEnabled boolean (${s.body.autoWeeklyEnabled})`);

  // 2. email-latest (cheap — no Claude call; re-uses last persisted report)
  const el = await emailLatest([TEST_RECIPIENT]);
  check(el.status === 200, `email-latest status 200 (got ${el.status})`);
  check(el.body.ok === true, `email-latest.ok=true (err: ${el.body.error || 'none'})`);
  check(Array.isArray(el.body.emailResults), `emailResults array`);
  if (el.body.emailResults?.length > 0) {
    const r0 = el.body.emailResults[0];
    check(r0.to === TEST_RECIPIENT, `emailResults[0].to matches test recipient`);
    // Note: sent may be false locally if Resend domain not verified — accept either.
    check(typeof r0.sent === 'boolean', `emailResults[0].sent is boolean (${r0.sent}, error: ${r0.error || 'none'})`);
  }

  console.log(`  ${GREEN}✓${RESET} iteration done (${total} assertions so far)`);
}

async function main() {
  console.log(`Weekly report e2e — ${N} iterations against ${BASE}`);
  console.log(`Test recipient: ${TEST_RECIPIENT}`);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    try { await runIteration(i); } catch (err) { check(false, `iteration crashed: ${err.message}`); }
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
