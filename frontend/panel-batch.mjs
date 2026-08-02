// panel-batch.mjs — Fase 2-rest: fanger de 5 høyre-panel-skjermbildene til
// Screenplay Editor Guide (beat board, analysis, story structure, grammar,
// table read). Robust standalone-flyt: seed=basic → Story Writer → insertText
// (unngår flaky «opprett nytt»-dialog) → parse → åpne hvert panel + screenshot.
// Kjør fra frontend/: node panel-batch.mjs
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5001/e2e-casting-test.html';
const ASSETS = '/Users/danielqazi/monorepo-cto-audit-p1/frontend/client/public/role-room-assets';
const DIAG = '/Users/danielqazi/manuscript-explore';
const W = 1920, H = 1080;

const SCRIPT = [
  'INT. RESTAURANTKJØKKEN – KVELD', '',
  'Damp stiger fra grytene. LIV (40), kokk og eier, tørker hendene på forkleet. Foran henne står én siste tallerken, dekket til.', '',
  'LIV', '(lavt, til seg selv)', 'Tjue år. Og alt koker ned til én tallerken.', '',
  'Kjøkkendøra svinger opp. JONAS (25), lærling, står i døra med et brett.', '',
  'JONAS', 'Bord sju spør etter deg. Igjen.', '',
  'LIV', 'Da får bord sju lære seg tålmodighet. God mat har aldri skyndet seg.', '',
  'INT. RESTAURANT – SPISESAL – KVELD', '',
  'Fullt hus. Ved vinduet sitter MARGIT (70), alene, med et glass rødvin.', '',
  'MARGIT', 'Si til Liv at suppen smakte som i syttini.', '',
  'EXT. BAKGÅRD – KVELD', '',
  'Liv tenner en sigarett hun ikke røyker. Jonas følger etter.', '',
  'JONAS', 'Hvorfor nå? Stedet er fullt hver kveld.', '',
  'LIV', 'Fordi jeg vil gå mens det fortsatt smaker av noe.', '',
  'KLIPP TIL SVART.', '',
].join('\n');

const PANELS = [
  ['beat board',      'guide-beat-board'],
  ['analysis',        'guide-script-analysis'],
  ['story structure', 'guide-story-structure'],
  ['grammar',         'guide-grammar'],
  ['table read',      'guide-table-read'],
];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const pause = (ms) => page.waitForTimeout(ms);

  await page.goto(`${BASE}?seed=basic`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Siste servering').first().waitFor({ timeout: 40000 });
  await pause(1500);
  await page.getByText('Role Room Studio', { exact: true }).first().click(); await pause(1500);
  await page.getByText('Skriv manuskript').first().click();
  await page.getByText('Story Writer - Manuskript').first().waitFor({ timeout: 15000 }); await pause(1500);

  // Lukk guide-overlay hvis den åpner
  if (await page.getByText('Screenplay Editor Guide').count()) { await pause(600); await page.keyboard.press('Escape'); await pause(600); }

  // Skriv manus via insertText (robust — ingen create-dialog)
  const cands = ['.cm-content', '[contenteditable="true"]', 'textarea'];
  let ed = null;
  for (const s of cands) { const l = page.locator(s).first(); if (await l.count() && await l.isVisible().catch(() => false)) { ed = l; break; } }
  if (!ed) { console.log('!! editor ikke funnet'); await page.screenshot({ path: `${DIAG}/panelbatch-no-editor.png` }); await browser.close(); process.exit(1); }
  await ed.click(); await pause(300);
  await page.keyboard.insertText(SCRIPT);
  await pause(2000);

  // DIAGNOSE: hvilke panel-aria-labels finnes i DOM?
  const diag = {};
  for (const [aria] of PANELS) {
    const loc = page.locator(`[aria-label="${aria}"]`);
    const count = await loc.count();
    let visible = false, disabled = null;
    if (count) { visible = await loc.first().isVisible().catch(() => false); disabled = await loc.first().isDisabled().catch(() => null); }
    diag[aria] = { count, visible, disabled };
  }
  console.log('ARIA-DIAG', JSON.stringify(diag));
  await page.screenshot({ path: `${DIAG}/panelbatch-toolbar.png` });

  // Lukk onboarding-/status-toasts som ellers dekker nedre del av panelet
  const dismissToasts = async () => {
    const closers = page.locator('[aria-label="Lukk"], [aria-label="Close"], [data-testid="CloseIcon"]');
    const n = await closers.count();
    for (let i = n - 1; i >= 0; i--) { await closers.nth(i).click({ force: true }).catch(() => {}); }
    await page.keyboard.press('Escape').catch(() => {});
    await pause(400);
  };
  await dismissToasts();

  // Fang hvert panel
  const results = [];
  for (const [aria, name] of PANELS) {
    try {
      const btn = page.locator(`[aria-label="${aria}"]`).first();
      await btn.waitFor({ state: 'visible', timeout: 8000 });
      await btn.click({ force: true });
      await pause(1800);
      await dismissToasts(); // toasts kan dukke opp igjen ved panel-bytte
      await pause(500);
      await page.screenshot({ path: `${ASSETS}/${name}.png` });
      results.push(`OK   ${name}`);
    } catch (e) {
      results.push(`FAIL ${name}: ${String(e).split('\n')[0].slice(0, 100)}`);
    }
  }
  console.log(results.join('\n'));
  await context.close(); await browser.close();
})().catch((e) => { console.error('FEIL', e); process.exit(1); });
