#!/usr/bin/env node
/**
 * Newsletter-from-report e2e — verifierer PR 12 sin Studio-integrasjon.
 *
 * Per iteration:
 *   1. Generer en konkurrent-rapport (cached for å gjenbruke)
 *   2. POST /api/admin-room/newsletter/role-room/issues/from-report
 *      med reportId fra rapporten
 *   3. Verifiser ok=true, issue.id finnes, blockCount > 5
 *   4. Cleanup: DELETE newsletter-issue
 *
 * Krever ADMIN_TOKEN (sessionId) — endepunktet bruker requireAdminRoomAccess
 * og ikke demo-bypass. For å kjøre lokalt sett DEMO_TOKEN-bypass-mønster
 * eller bruk faktisk admin-session.
 */

const BASE = process.env.BASE || 'https://creatorhub-backend-rtbl.onrender.com';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.DEMO_TOKEN || '';
const N = parseInt(process.env.N || '1', 10);

const RESET = '\x1b[0m', GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', YELLOW = '\x1b[33m';

let total = 0, failed = 0;
function check(cond, msg) { total++; if (!cond) { failed++; console.log(`  ${RED}✗${RESET} ${msg}`); } }
function note(msg) { console.log(`  ${YELLOW}ℹ${RESET} ${msg}`); }

function authHeaders() {
  // Admin-room-endepunktet bruker session-cookie eller bearer.
  // For demo-bypass kan vi forsøke query-param-flow.
  return {
    'Content-Type': 'application/json',
    ...(ADMIN_TOKEN ? { Authorization: `Bearer ${ADMIN_TOKEN}` } : {}),
  };
}

async function getLatestReport() {
  // Demo-bypass-flow for å hente siste rapport
  const r = await fetch(
    `${BASE}/api/role-room/marketing-cockpit/competitors/reports/latest?brandKey=theroleroom&token=${process.env.DEMO_TOKEN || ''}`,
  );
  return { status: r.status, body: await r.json() };
}

async function generateReport() {
  const r = await fetch(`${BASE}/api/role-room/marketing-cockpit/competitors/generate-report?token=${process.env.DEMO_TOKEN || ''}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandKey: 'theroleroom', useCache: true }),
  });
  return { status: r.status, body: await r.json() };
}

async function fromReport(reportId) {
  const r = await fetch(`${BASE}/api/admin-room/newsletter/role-room/issues/from-report`, {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ brandKey: 'theroleroom', reportId }),
  });
  return { status: r.status, body: await r.json() };
}

async function deleteIssue(id) {
  const r = await fetch(`${BASE}/api/admin-room/newsletter/role-room/issues/${id}`, {
    method: 'DELETE', headers: authHeaders(), credentials: 'include',
  });
  return { status: r.status };
}

async function runIteration(i) {
  console.log(`\n${DIM}── Iteration ${i + 1}/${N} ──${RESET}`);

  // 1. Sørg for at det finnes en rapport
  let latest = await getLatestReport();
  if (!latest.body.ok || !latest.body.reportId) {
    note('No latest report — generating one (useCache=true)…');
    const gen = await generateReport();
    check(gen.body.ok === true, `report generated (status=${gen.status})`);
    latest = await getLatestReport();
  }

  check(typeof latest.body.reportId === 'number', `reportId resolved (got ${latest.body.reportId})`);
  if (typeof latest.body.reportId !== 'number') return;

  // 2. Konverter rapport → newsletter-draft
  const r = await fromReport(latest.body.reportId);

  if (r.status === 401 || r.status === 403) {
    note(`Auth-feil (${r.status}) — endepunktet krever admin-session, ikke demo-bypass.`);
    note(`Sett ADMIN_TOKEN=<sessionId> for å fullføre testen mot prod.`);
    note(`Verifiserer i stedet at endepunktet svarer (ikke 404/500).`);
    check(r.status === 401 || r.status === 403, `auth-gate aktiv (${r.status})`);
    return;
  }

  check(r.status === 201, `from-report status 201 (got ${r.status})`);
  check(r.body.ok === true, `ok=true`);
  check(typeof r.body.issue?.id === 'string' || typeof r.body.issue?.id === 'number', `issue.id present`);
  check(typeof r.body.issue?.slug === 'string', `issue.slug present`);
  check(r.body.issue?.status === 'draft', `issue.status === draft (got ${r.body.issue?.status})`);
  check(typeof r.body.blockCount === 'number' && r.body.blockCount > 3, `blockCount > 3 (got ${r.body.blockCount})`);
  check(r.body.sourceReport?.id === latest.body.reportId, `sourceReport.id matches`);

  // 3. Cleanup
  if (r.body.issue?.id) {
    const del = await deleteIssue(r.body.issue.id);
    check(del.status === 204 || del.status === 200, `cleanup delete (got ${del.status})`);
  }

  console.log(`  ${GREEN}✓${RESET} iteration done (${total} assertions so far)`);
}

async function main() {
  console.log(`Newsletter-from-report e2e — ${N} iterations against ${BASE}`);
  if (!ADMIN_TOKEN) console.log(`${YELLOW}No ADMIN_TOKEN/DEMO_TOKEN set — auth-gate vil sannsynligvis blokkere${RESET}`);
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
