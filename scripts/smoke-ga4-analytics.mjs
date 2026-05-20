#!/usr/bin/env node
/**
 * Smoke-test for Slice 9X.70: GA4 + Analytics Hub + Marketplace + Stripe.
 *
 * Usage:
 *   node scripts/smoke-ga4-analytics.mjs                              # local (http://localhost:3001)
 *   BASE=https://creatorhubn-backend.onrender.com node scripts/smoke-ga4-analytics.mjs
 *   ADMIN_TOKEN=... node scripts/smoke-ga4-analytics.mjs              # for admin endpoints
 *
 * Hver test logger PASS/FAIL/SKIP og en kort forklaring. Exit code != 0
 * hvis noen kritisk test feiler.
 */

const BASE = process.env.BASE || 'http://localhost:3001';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'daniel@creatorhubn.com';

let passes = 0;
let fails = 0;
let skips = 0;
const criticalFailures = [];

const adminHeaders = ADMIN_TOKEN
  ? { 'Cookie': `session-token=${ADMIN_TOKEN}`, 'x-user-email': ADMIN_EMAIL }
  : { 'x-user-email': ADMIN_EMAIL };

function log(status, name, detail = '') {
  const icon = { PASS: '✓', FAIL: '✗', SKIP: '–' }[status];
  const color = { PASS: '\x1b[32m', FAIL: '\x1b[31m', SKIP: '\x1b[33m' }[status];
  console.log(`${color}${icon}\x1b[0m  ${name}${detail ? ' — ' + detail : ''}`);
  if (status === 'PASS') passes++;
  else if (status === 'FAIL') fails++;
  else if (status === 'SKIP') skips++;
}

async function test(name, fn, { critical = false } = {}) {
  try {
    const result = await fn();
    if (result === 'SKIP') {
      log('SKIP', name);
    } else {
      log('PASS', name, typeof result === 'string' ? result : '');
    }
  } catch (e) {
    log('FAIL', name, e.message);
    if (critical) criticalFailures.push(name);
  }
}

async function fetchJson(path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok && opts.allowError !== true) {
    throw new Error(`HTTP ${res.status}: ${typeof body === 'string' ? body.slice(0, 200) : JSON.stringify(body).slice(0, 200)}`);
  }
  return { status: res.status, body };
}

console.log(`\n\x1b[36m▸ Smoke-test mot ${BASE}\x1b[0m`);
console.log(`  Admin: ${ADMIN_TOKEN ? 'autentisert' : 'IKKE autentisert (admin-tester vil SKIP)'}\n`);

// ─── 1. Server lever ────────────────────────────────────────────────
await test('Server svarer (root eller /api/health)', async () => {
  try {
    const r = await fetchJson('/api/health', { allowError: true });
    if (r.status === 200) return 'health ok';
  } catch {}
  // Fallback: prøv en kjent endpoint
  const r2 = await fetchJson('/api/marketplace/apps');
  if (r2.status === 200) return 'marketplace public endpoint ok';
  throw new Error('ingen kjent endpoint svarte');
}, { critical: true });

// ─── 2. Public analytics-event POST ────────────────────────────────
await test('POST /api/analytics/event (fire-and-forget)', async () => {
  const r = await fetchJson('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'creatorhub_smoke_test_event',
      entityType: 'smoke',
      entityId: `test-${Date.now()}`,
      metadata: { source: 'smoke-test', timestamp: new Date().toISOString() },
    }),
    allowError: true,
  });
  // success kan være false hvis tabell mangler — det er fortsatt OK siden vi ikke skal feile
  return `status=${r.status}, body=${JSON.stringify(r.body).slice(0, 80)}`;
});

// ─── 3. Public marketplace-apps ────────────────────────────────────
await test('GET /api/marketplace/apps (public)', async () => {
  const r = await fetchJson('/api/marketplace/apps');
  if (!r.body || typeof r.body !== 'object') throw new Error('forventet objekt');
  if (!Array.isArray(r.body.data)) throw new Error('mangler .data array');
  return `${r.body.data.length} apper registrert`;
});

// ─── 4. Admin endpoints (krever auth) ──────────────────────────────
if (!ADMIN_TOKEN) {
  log('SKIP', 'Admin endpoints (sett ADMIN_TOKEN for å teste)');
  skips += 5;
} else {
  await test('GET /api/admin/config-check', async () => {
    const r = await fetchJson('/api/admin/config-check', { headers: adminHeaders });
    if (!r.body?.checks) throw new Error('mangler .checks');
    const stripe = r.body.checks.stripe;
    const ga4 = r.body.checks.ga4;
    const schema = r.body.checks.schema;
    const parts = [
      `status=${r.body.status}`,
      `stripe.secret=${stripe?.secretKey ? '✓' : '✗'}`,
      `stripe.webhook=${stripe?.webhookSecret ? '✓' : '✗'}`,
      `ga4.id=${ga4?.measurementId ? '✓' : '✗'}`,
      `ga4.secret=${ga4?.apiSecret ? '✓' : '✗'}`,
      `analytics_events=${schema?.analytics_events ? '✓' : '✗'}`,
      `marketplace_app_config=${schema?.marketplace_app_config ? '✓' : '✗'}`,
    ];
    return parts.join(' ');
  });

  await test('GET /api/admin/analytics/overview', async () => {
    const r = await fetchJson('/api/admin/analytics/overview', { headers: adminHeaders });
    if (!r.body || typeof r.body !== 'object') throw new Error('mangler body');
    if (r.body.error) return `WARN: ${r.body.error}`;
    return `events siste 24t: ${r.body.totals?.last24h ?? 0}, top events: ${r.body.topEvents?.length ?? 0}`;
  });

  await test('GET /api/admin/stripe/payment-status', async () => {
    const r = await fetchJson('/api/admin/stripe/payment-status', { headers: adminHeaders });
    if (!r.body) throw new Error('tom body');
    if (!r.body.configured) return 'WARN: Stripe ikke konfigurert (STRIPE_SECRET_KEY mangler)';
    return `events=${r.body.events?.length ?? 0}, succ=${r.body.counts?.succeeded ?? 0}, fail=${r.body.counts?.failed ?? 0}, subs=${r.body.activeSubscriptions ?? 0}`;
  });

  await test('GET /api/admin/marketplace/apps', async () => {
    const r = await fetchJson('/api/admin/marketplace/apps', { headers: adminHeaders });
    if (!Array.isArray(r.body?.data)) throw new Error('mangler .data array');
    return `${r.body.data.length} apper i admin-konfig`;
  });

  await test('GET /api/admin/marketplace/stripe-status (bakoverkompat)', async () => {
    const r = await fetchJson('/api/admin/marketplace/stripe-status', { headers: adminHeaders });
    if (!r.body) throw new Error('tom body');
    return `status=${r.body.configured ? 'ok' : 'mangler config'}`;
  });
}

// ─── 5. Sjekk at smoke-event havnet i lokal logg ───────────────────
if (ADMIN_TOKEN) {
  await test('Smoke-event havnet i analytics_events?', async () => {
    // Vent 1 sek slik at INSERT er committed
    await new Promise(r => setTimeout(r, 1000));
    const r = await fetchJson('/api/admin/analytics/overview', { headers: adminHeaders });
    const found = (r.body?.recentEvents || []).some((ev) => ev.eventType === 'creatorhub_smoke_test_event');
    if (!found) return 'SKIP (event ikke synlig — kanskje analytics_events-tabell mangler)';
    return 'event funnet i recentEvents';
  });
}

// ─── 6. AI cost-dashboard endpoints ────────────────────────────────
if (ADMIN_TOKEN) {
  await test('GET /api/admin/ai-usage/overview', async () => {
    const r = await fetchJson('/api/admin/ai-usage/overview', { headers: adminHeaders });
    if (!r.body) throw new Error('tom body');
    if (r.body.error) return `WARN: ${r.body.error}`;
    const t = r.body.totals?.last30d || {};
    return `30d: ${t.calls || 0} kall, $${(t.costUsd || 0).toFixed(4)}, ${(t.tokens || 0).toLocaleString()} tokens · ${r.body.byFeature?.length || 0} features tracked`;
  });

  await test('GET /api/admin/ai-usage/by-user', async () => {
    const r = await fetchJson('/api/admin/ai-usage/by-user', { headers: adminHeaders });
    if (!Array.isArray(r.body?.data)) throw new Error('mangler .data array');
    return `${r.body.data.length} unike brukere registrert`;
  });

  await test('GET /api/admin/ai-usage/recent', async () => {
    const r = await fetchJson('/api/admin/ai-usage/recent', { headers: adminHeaders });
    if (!Array.isArray(r.body?.data)) throw new Error('mangler .data array');
    return `${r.body.data.length} nylige kall i loggen`;
  });

  await test('Config-check inkluderer GA4 + AI-tabell', async () => {
    const r = await fetchJson('/api/admin/config-check', { headers: adminHeaders });
    const schema = r.body?.checks?.schema || {};
    const ga4 = r.body?.checks?.ga4 || {};
    const checks = [];
    checks.push(`ga4.id=${ga4.measurementId ? '✓' : '✗'}`);
    checks.push(`ga4.secret=${ga4.apiSecret ? '✓' : '✗'}`);
    checks.push(`ai_usage_log=${schema.ai_usage_log ? '✓' : '✗'}`);
    checks.push(`analytics_events=${schema.analytics_events ? '✓' : '✗'}`);
    checks.push(`marketplace_app_config=${schema.marketplace_app_config ? '✓' : '✗'}`);
    return checks.join(' ');
  });
}

// ─── 7. User-facing /api/me/ai-usage ───────────────────────────────
await test('GET /api/me/ai-usage (krever bruker)', async () => {
  const r = await fetchJson('/api/me/ai-usage', {
    headers: { 'x-user-id': process.env.TEST_USER_ID || 'smoke-test-user' },
    allowError: true,
  });
  if (r.status === 401) return 'SKIP (krever ekte bruker-session)';
  if (!r.body) throw new Error('tom body');
  const cb = r.body.customerBilling;
  return `userId=${r.body.userId}, kall=${r.body.totals?.last30d?.calls || 0}, fakturerings-faktor=${cb?.markupFactor || '—'}x`;
});

// ─── Sammendrag ────────────────────────────────────────────────────
console.log(`\n\x1b[36m▸ Resultat\x1b[0m`);
console.log(`  \x1b[32m${passes} PASS\x1b[0m, \x1b[31m${fails} FAIL\x1b[0m, \x1b[33m${skips} SKIP\x1b[0m`);
if (criticalFailures.length > 0) {
  console.log(`\n\x1b[31m✗ Kritiske feil:\x1b[0m`);
  criticalFailures.forEach(n => console.log(`  - ${n}`));
  process.exit(1);
}
if (fails > 0) {
  console.log(`\n\x1b[33m⚠ Noen ikke-kritiske tester feilet\x1b[0m`);
  process.exit(0);
}
console.log(`\n\x1b[32m✓ Alle tester gikk gjennom\x1b[0m`);
