#!/usr/bin/env node
/**
 * CRM workflow walkthrough — records a video of the full photographer (Simen)
 * journey through the Universal CRM, end to end, in a real browser.
 *
 * Usage:
 *   BASE_URL=http://localhost:5174 \
 *   SESSION_TOKEN=dev-admin-local-session \
 *   VIDEO_DIR=/tmp/crm-recording \
 *   node scripts/crm-walkthrough.mjs
 *
 * Requires the app running (vite proxying /api to the backend) and a valid
 * session token (the dev-local-admin token works when NODE_ENV!=production).
 * The token is injected into localStorage before the CRM mounts so its
 * apiRequest calls are authenticated. Reaches the CRM via the /crm deep-link.
 *
 * Each step is best-effort (wrapped in step()) so one missing element never
 * aborts the recording — the video captures as much of the journey as renders.
 */
import pw from 'playwright';
const { chromium } = pw;

const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const TOKEN = process.env.SESSION_TOKEN || 'dev-admin-local-session';
const VIDEO_DIR = process.env.VIDEO_DIR || '/tmp/crm-recording';
const STAMP = process.env.STAMP || String(Date.now());
const CUSTOMER = `REC-DEMO Nora Bryllup ${STAMP}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Seed a rich demo customer via the API so the recording shows a POPULATED
// CRM. (The in-UI "Ny kunde"/"Faktura" buttons are feature-gated and disabled
// for the dev-local-admin session, so we seed through the API the same token
// authenticates.) Returns the customer id, or null on failure.
async function seedDemo() {
  const api = (path, opts = {}) => fetch(`${BASE_URL}/api${path}`, {
    ...opts,
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'x-user-id': 'local-admin' },
  }).then((r) => r.json().catch(() => ({})));
  try {
    const c = await api('/universal-crm/customers', { method: 'POST', body: JSON.stringify({ name: CUSTOMER, email: `rec-demo-${STAMP}@example.com`, phone: '90011223', projectType: 'bryllup', budget: 35000, source: 'referral', status: 'active', profession: 'photographer' }) });
    const id = c?.customer?.id;
    if (!id) return null;
    await api('/universal-crm/activities', { method: 'POST', body: JSON.stringify({ customerId: id, type: 'call', subject: 'Anrop', description: 'Ringte Nora — avtalte befaring på lokasjonen.', direction: 'outbound' }) });
    await api('/universal-crm/deals', { method: 'POST', body: JSON.stringify({ customerId: id, title: `Bryllup ${CUSTOMER}`, value: 35000, probability: 80, stage: 'proposal' }) });
    await api('/universal-crm/deals', { method: 'POST', body: JSON.stringify({ customerId: id, title: 'Forlovelsesfoto', value: 6000, probability: 100, stage: 'closed_won' }) });
    const inv = await api('/universal-crm/invoices', { method: 'POST', body: JSON.stringify({ customerId: id, totalAmount: 35000, depositAmount: 8000, description: 'Bryllupsfotografering' }) });
    if (inv?.invoice?.id) await api(`/universal-crm/invoices/${inv.invoice.id}`, { method: 'PUT', body: JSON.stringify({ paidAmount: 8000 }) });
    await api('/universal-crm/reviews', { method: 'POST', body: JSON.stringify({ customerId: id, rating: 5, npsScore: 10, testimonialText: 'Helt fantastiske bilder — anbefales!', publicConsent: true }) });
    return id;
  } catch { return null; }
}

async function main() {
  const seededId = await seedDemo();
  console.log(seededId ? `Seeded demo customer ${seededId}` : 'Seed skipped/failed — recording read-only views');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  // Authenticate before any page script runs (CRM uses apiRequest Bearer token).
  await context.addInitScript((token) => {
    localStorage.setItem('creatorhub_auth_token', token);
    localStorage.setItem('userId', 'local-admin');
    localStorage.setItem('userEmail', 'admin@local.dev');
  }, TOKEN);

  const page = await context.newPage();
  const results = [];
  const step = async (name, fn) => {
    try { await fn(); results.push(`✅ ${name}`); }
    catch (e) { results.push(`⚠️  ${name} — ${String(e.message).split('\n')[0].slice(0, 80)}`); }
    await sleep(700); // let the video breathe
  };

  await step('Åpne CRM (/crm) — populert kundeoversikt', async () => {
    await page.goto(`${BASE_URL}/crm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // Søk fram demo-kunden så kortet vises tydelig.
    const search = page.getByPlaceholder('Søk etter navn, e-post eller firma');
    await search.waitFor({ timeout: 25000 });
    await search.fill('REC-DEMO');
    await page.getByText(CUSTOMER, { exact: false }).first().waitFor({ timeout: 15000 });
    await sleep(1200);
  });

  await step('Åpne kundedetalj — tidslinje, quick-log, anmeldelse', async () => {
    await page.getByRole('button', { name: 'Detaljer' }).first().click();
    const note = page.getByPlaceholder('Hva skjedde?');
    await note.waitFor({ timeout: 12000 });
    await note.fill('Sendte galleriforhåndsvisning til Nora.');
    await page.getByRole('button', { name: 'Logg' }).click();
    await sleep(1400); // la tidslinjen + anmeldelser være synlige
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(600);
  });

  await step('Pipeline-board (deals)', async () => {
    await page.getByRole('button', { name: 'Pipeline' }).first().click();
    await sleep(1500);
    await page.getByRole('button', { name: 'Liste' }).first().click().catch(() => {});
  });

  await step('Handlingskø', async () => {
    await page.getByRole('button', { name: 'Handlinger' }).first().click();
    await sleep(1500);
    await page.getByRole('button', { name: 'Lukk' }).first().click().catch(() => {});
  });

  await step('Rapporter', async () => {
    await page.getByRole('button', { name: 'Rapporter' }).first().click();
    await sleep(2000);
    await page.getByRole('button', { name: 'Lukk' }).first().click().catch(() => {});
  });

  await sleep(800);
  await page.close();
  const videoPath = await page.video()?.path().catch(() => null);
  await context.close();
  await browser.close();

  console.log('\n=== CRM walkthrough ===');
  results.forEach((r) => console.log(r));
  console.log(`\nVideo: ${videoPath || VIDEO_DIR}`);
  const failed = results.filter((r) => r.startsWith('⚠')).length;
  console.log(failed === 0 ? 'RESULT: PASS (alle steg)' : `RESULT: ${results.length - failed}/${results.length} steg ok`);
}

main().catch((e) => { console.error('walkthrough crashed:', e); process.exit(1); });
