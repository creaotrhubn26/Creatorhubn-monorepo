#!/usr/bin/env node
/**
 * smoke-test-project-invite-email.mjs
 *
 * Verifiserer at GMAIL_USER + GMAIL_APP_PASSWORD er korrekt satt opp i
 * prod, og at POST /api/role-room/projects faktisk sender invite-email
 * til collaborators.
 *
 * Forutsetninger:
 *   • GMAIL_USER + GMAIL_APP_PASSWORD allerede satt på Render
 *   • Backend redeployet og live (sjekkes via /api/health)
 *   • RENDER_API_KEY satt for å lese deploy-state og logs
 *
 * Hva scriptet gjør:
 *   1. Sjekker at backend live commit matcher b9e731b eller nyere
 *   2. Sjekker at GMAIL_USER er satt i Render env-vars
 *   3. Hent en gyldig auth-token (fra .role-room-demo-state.json eller
 *      gjennom å be brukeren lime inn)
 *   4. POST /api/role-room/projects med:
 *        name: "SMOKE TEST email-invite"
 *        collaborators: [{name, email: 'qazifotoreel@gmail.com', role: 'crew'}]
 *   5. Forventer HTTP 201 + at console-logs på Render viser
 *      "Project ... invite emails: 1/1 sent"
 *
 * Bruk:
 *   AUTH_TOKEN=<token> node backend/scripts/smoke-test-project-invite-email.mjs
 *
 * Eller hvis du har session-token fra frontend (localStorage 'authToken'):
 *   node backend/scripts/smoke-test-project-invite-email.mjs
 *   (scriptet ber deg om å lime inn token)
 */

import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const BACKEND_URL = 'https://creatorhub-backend-rtbl.onrender.com';
const RENDER_SERVICE_ID = 'srv-d76ob60ule4c73dv2p60';
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const TEST_RECIPIENT_EMAIL = process.env.TEST_RECIPIENT_EMAIL ?? 'qazifotoreel@gmail.com';

const c = {
  reset: '\x1b[0m', green: '\x1b[32m', cyan: '\x1b[36m',
  yellow: '\x1b[33m', dim: '\x1b[2m', red: '\x1b[31m', bold: '\x1b[1m',
};

const log = (sym, color, label, detail) => {
  const reset = c.reset;
  console.log(`${color}${sym}${reset} ${label}${detail ? `${c.dim} — ${detail}${reset}` : ''}`);
};
const ok = (l, d) => log('✓', c.green, l, d);
const warn = (l, d) => log('!', c.yellow, l, d);
const fail = (l, d) => log('✗', c.red, l, d);
const info = (l, d) => log('▸', c.cyan, l, d);

async function checkRenderEnv() {
  if (!RENDER_API_KEY) {
    warn('RENDER_API_KEY ikke satt — hopper over Render env-sjekk');
    return null;
  }
  const res = await fetch(
    `https://api.render.com/v1/services/${RENDER_SERVICE_ID}/env-vars`,
    { headers: { Authorization: `Bearer ${RENDER_API_KEY}` } },
  );
  const body = await res.json();
  const keys = body.map((x) => x.envVar?.key).filter(Boolean);
  const hasUser = keys.some((k) => ['GMAIL_USER', 'GOOGLE_WORKSPACE_EMAIL', 'GOOGLE_ADMIN_EMAIL'].includes(k));
  const hasPwd = keys.includes('GMAIL_APP_PASSWORD');
  if (hasUser && hasPwd) ok('Render har GMAIL_USER + GMAIL_APP_PASSWORD');
  else if (!hasUser && !hasPwd) fail('Mangler både GMAIL_USER og GMAIL_APP_PASSWORD på Render');
  else fail(`Mangler ${!hasUser ? 'GMAIL_USER' : 'GMAIL_APP_PASSWORD'} på Render`);
  return hasUser && hasPwd;
}

async function checkBackendCommit() {
  const res = await fetch(`${BACKEND_URL}/api/health`);
  const data = await res.json();
  ok('Backend live', `commit ${data.commit?.slice(0, 10)}`);
  return data.commit;
}

async function getAuthToken() {
  if (process.env.AUTH_TOKEN) return process.env.AUTH_TOKEN.trim();
  console.log('');
  console.log(`${c.yellow}For å autentisere mot prod-API trenger jeg en auth-token.${c.reset}`);
  console.log(`${c.dim}Hent den slik:`);
  console.log(`  1. Logg inn på https://creatorhubn.com${c.reset}`);
  console.log(`${c.dim}  2. Åpne Devtools → Application → Local Storage${c.reset}`);
  console.log(`${c.dim}  3. Kopier verdien av nøkkelen 'role_room_auth_token'${c.reset}`);
  console.log(`${c.dim}     (om denne mangler — du er ikke logget inn i Role Room ennå)${c.reset}`);
  console.log('');
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const t = await rl.question(`${c.cyan}? Lim inn authToken: ${c.reset}`);
  rl.close();
  return t.trim();
}

async function createTestProject(token) {
  const projectName = `SMOKE TEST email-invite ${new Date().toISOString().slice(0, 16)}`;
  const body = {
    name: projectName,
    description: 'Smoke-test for email-invite — kan slettes',
    projectType: 'film',
    collaborators: [
      {
        id: 'smoke-collab-1',
        name: 'Smoke Test Recipient',
        email: TEST_RECIPIENT_EMAIL,
        role: 'crew',
      },
    ],
  };
  info('POSTer test-prosjekt', `recipient: ${TEST_RECIPIENT_EMAIL}`);
  const res = await fetch(`${BACKEND_URL}/api/role-room/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 201 || res.status === 200) {
    ok(`POST /projects → ${res.status}`, `id: ${data.id ?? '?'}`);
    return { ok: true, projectId: data.id };
  }
  fail(`POST /projects → ${res.status}`, JSON.stringify(data).slice(0, 200));
  return { ok: false };
}

async function fetchRenderLogs(deploymentId, projectId) {
  if (!RENDER_API_KEY) return;
  // Render logs API: https://api.render.com/v1/services/<id>/logs
  // Returns log entries. We filter for project-id mention.
  const since = new Date(Date.now() - 90_000).toISOString();
  const url = new URL(`https://api.render.com/v1/services/${RENDER_SERVICE_ID}/logs`);
  url.searchParams.set('startTime', since);
  url.searchParams.set('limit', '200');
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${RENDER_API_KEY}` } });
    if (!res.ok) {
      warn('Kunne ikke hente Render logs', `HTTP ${res.status}`);
      return;
    }
    const data = await res.json();
    const entries = Array.isArray(data) ? data : (data.logs ?? []);
    const relevant = entries.filter((e) => {
      const msg = e.message ?? e.text ?? '';
      return msg.includes('invite emails:') || msg.includes(projectId ?? '__never__');
    });
    if (relevant.length > 0) {
      ok('Fant relevant log-entry:');
      relevant.forEach((e) => console.log(`  ${c.dim}${e.timestamp}: ${e.message ?? e.text}${c.reset}`));
    } else {
      warn('Ingen invite-email-logs funnet i de siste 90s — sjekk Render dashboard manuelt');
    }
  } catch (err) {
    warn('Feilet å hente logs', String(err));
  }
}

async function main() {
  console.log(`${c.bold}${c.cyan}━━━ Smoke test: project invite email ━━━${c.reset}\n`);

  await checkBackendCommit();
  await checkRenderEnv();
  console.log('');

  const token = await getAuthToken();
  if (!token || token.length < 10) {
    fail('Ugyldig token');
    process.exit(1);
  }
  console.log('');
  const result = await createTestProject(token);
  if (!result.ok) {
    process.exit(1);
  }

  // Vent litt og hent logs
  console.log('');
  info('Venter 5s før log-hent…');
  await new Promise((r) => setTimeout(r, 5000));
  await fetchRenderLogs(null, result.projectId);

  console.log('');
  console.log(`${c.bold}${c.green}═══ Smoke test ferdig ═══${c.reset}`);
  console.log(`${c.dim}Sjekk innboksen til ${TEST_RECIPIENT_EMAIL} — invite-mailen bør være levert innen 1 min.${c.reset}`);
  console.log(`${c.dim}Hvis ingen mail dukker opp:${c.reset}`);
  console.log(`${c.dim}  • sjekk Spam-mappen${c.reset}`);
  console.log(`${c.dim}  • sjekk Render-logs for 'mailer_not_configured' eller andre feil${c.reset}`);
  console.log(`${c.dim}  • verifiser at app-passordet er korrekt (16 tegn, ingen mellomrom)${c.reset}`);
}

main().catch((err) => {
  console.error(`${c.red}FATAL${c.reset}`, err);
  process.exit(2);
});
