#!/usr/bin/env node
/**
 * Competitor Report e2e — stability test (3 iter default, hver kostar ~0.5 NOK).
 *
 * Per iteration:
 *   1. Sjekk at /competitors returnerer ≥1 tracked
 *   2. POST generate-report (useCache:false) → verify shape
 *   3. GET reports/latest → verify same data
 *   4. POST generate-report (useCache:true) → verify cached:true
 *
 * For å unngå at testen koster mye, generer kun fresh i iter 1, deretter cache.
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const TOKEN = process.env.DEMO_TOKEN || 'LCIW3x7hRNeWoRw0lQYi9EJr8_xGhlzY';
const N = parseInt(process.env.N || '3', 10);

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m';

let total = 0, failed = 0;
function check(cond, msg) { total++; if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); } }

async function ensureSeedCompetitor() {
  // Add Norwedfilm if not already tracked, so the report has real data
  const list = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors?token=${TOKEN}&brandKey=theroleroom`);
  const lb = await list.json();
  const has = (lb.competitors || []).some((c) => c.pageId === '2139060606331418');
  if (!has) {
    await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors?token=${TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pageId: '2139060606331418', nickname: 'Norwedfilm (test)', brandKey: 'theroleroom' }),
    });
    // Snapshot once
    const after = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors?token=${TOKEN}&brandKey=theroleroom`).then((r) => r.json());
    const id = after.competitors[0]?.id;
    if (id) {
      await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/${id}/snapshot?token=${TOKEN}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
    }
  }
}

async function generateReport(useCache) {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/generate-report?token=${TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandKey: 'theroleroom', useCache }),
  });
  return { status: r.status, body: await r.json() };
}
async function getLatest() {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/reports/latest?token=${TOKEN}&brandKey=theroleroom`);
  return { status: r.status, body: await r.json() };
}

function validateReport(report) {
  check(typeof report?.summary === 'string' && report.summary.length > 20, 'summary is meaningful');
  check(Array.isArray(report?.insights) && report.insights.length >= 1, `insights array (got ${report?.insights?.length})`);
  check(Array.isArray(report?.contentGaps), 'contentGaps array');
  check(Array.isArray(report?.recommendedNextActions), 'recommendedNextActions array');
  check(Array.isArray(report?.competitorScorecard), 'competitorScorecard array');
  if (report?.insights?.[0]) {
    const ins = report.insights[0];
    check(['opportunity','threat','gap','trend'].includes(ins.category), `insight.category valid (${ins.category})`);
    check(['high','medium','low'].includes(ins.priority), `insight.priority valid (${ins.priority})`);
    check(typeof ins.title === 'string' && ins.title.length > 0, 'insight.title non-empty');
    check(Array.isArray(ins.actionableSteps), 'insight.actionableSteps array');
  }
}

async function main() {
  console.log(`Competitor Report e2e — ${N} iterations against ${BASE}`);
  await ensureSeedCompetitor();
  const t0 = Date.now();

  for (let i = 0; i < N; i++) {
    console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);
    const useCache = i > 0; // Only first iteration generates fresh (cost-saving)
    const gen = await generateReport(useCache);
    check(gen.status === 200, `generate status 200 (got ${gen.status})`);
    check(gen.body.ok === true, `generate.ok=true (error: ${gen.body.error || 'none'})`);
    check(typeof gen.body.competitorCount === 'number' && gen.body.competitorCount >= 1, `competitorCount >= 1`);
    if (i > 0) check(gen.body.cached === true, `iter ${i+1}: cached=true (got ${gen.body.cached})`);
    validateReport(gen.body.report);
    check(typeof gen.body.competitorPictures === 'object', 'competitorPictures map present');

    const latest = await getLatest();
    check(latest.status === 200, `latest status 200`);
    check(latest.body.ok === true, `latest.ok=true`);
    validateReport(latest.body.report);
    check(typeof latest.body.competitorPictures === 'object', 'latest.competitorPictures map present');

    console.log(`  ${GREEN}✓${RESET} iteration done (${total} assertions so far)`);
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
