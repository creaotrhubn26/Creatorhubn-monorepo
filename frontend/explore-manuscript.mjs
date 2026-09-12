// explore-manuscript.mjs — E2E-gjennomgang + QA av HELE manuskript-grensesnittet
// med troverdig produksjon (Nordlys Film · «Siste servering»). Setter opp et ekte
// manus, klikker gjennom hver fane/verktøy, tar navngitte skjermbilder, og logger
// console-feil + feilede klikk (= bugs). Kjør fra frontend/: node explore-manuscript.mjs
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:5001/e2e-casting-test.html';
const OUT = '/Users/danielqazi/manuscript-explore';
const W = 1600, H = 1000;
const findings = [];
const consoleErrors = [];

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
  'INT. RESTAURANTKJØKKEN – KVELD', '',
  'Liv rekker Jonas kokkekniven — slitt skaft, blankt blad.', '',
  'LIV', 'Den var min mors. Ikke skjær for fort med den.', '',
  'JONAS', '(nøler)', 'Jeg er ikke klar.', '',
  'LIV', 'Ingen er det. Man begynner likevel.', '',
  'EXT. BAKGÅRD – KVELD', '',
  'Liv tenner en sigarett hun ikke røyker. Jonas følger etter.', '',
  'JONAS', 'Hvorfor nå? Stedet er fullt hver kveld.', '',
  'LIV', 'Fordi jeg vil gå mens det fortsatt smaker av noe.', '',
  'INT. RESTAURANT – SPISESAL – NATT', '',
  'Gjestene reiser seg. Applaus. Liv går sakte gjennom rommet, nikker til Margit, men stopper ikke.', '',
  'INT. RESTAURANTKJØKKEN – NATT', '',
  'Jonas står alene ved benken. Han løfter morens kniv, puster ut, og begynner.', '',
  'JONAS (V.O.)', 'Hun lærte meg aldri oppskriftene. Hun lærte meg å høre når det var ferdig.', '',
  'KLIPP TIL SVART.', '',
].join('\n');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  const pause = (ms) => page.waitForTimeout(ms);
  const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => {});
  const step = async (name, fn, capture = true) => {
    const before = consoleErrors.length;
    try { await fn(); if (capture) await shot(name); findings.push({ step: name, ok: true, newConsoleErrors: consoleErrors.length - before }); console.log(`OK   ${name}`); }
    catch (e) { if (capture) await shot(`FAIL-${name}`); findings.push({ step: name, ok: false, error: String(e).split('\n')[0].slice(0, 160), newConsoleErrors: consoleErrors.length - before }); console.log(`FAIL ${name}: ${String(e).split('\n')[0].slice(0,120)}`); }
  };

  // ── Oppsett (Nordlys Film · Siste servering) ─────────────────────────────
  await page.goto(`${BASE}?seed=basic`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Siste servering').first().waitFor({ timeout: 40000 });
  await pause(2000);
  await shot('00-oversikt-prosjekt');
  await step('setup-role-room-studio', async () => { await page.getByText('Role Room Studio', { exact: true }).first().click(); await pause(1500); });
  await step('setup-story-writer', async () => { await page.getByText('Skriv manuskript').first().click(); await page.getByText('Story Writer - Manuskript').first().waitFor({ timeout: 15000 }); await pause(1500); });
  await step('setup-open-nytt-dialog', async () => {
    const b = page.getByRole('button', { name: /opprett nytt manuskript/i }).first();
    if (await b.count()) await b.click(); else await page.getByRole('button', { name: /nytt manuskript/i }).first().click();
    await page.getByText('Nytt Manuskript', { exact: true }).first().waitFor({ timeout: 8000 }); await pause(800);
  });
  await step('setup-fill+opprett', async () => {
    const d = page.getByRole('dialog'); const t = d.getByLabel(/tittel/i).first(); await t.click(); await t.type('Siste servering', { delay: 12 });
    const a = d.getByLabel(/forfatter/i).first(); if (await a.count()) { await a.click(); await a.type('Ingrid Solvang', { delay: 12 }); }
    await pause(600);
    await page.getByRole('button', { name: /^opprett$/i }).first().click(); await pause(2200);
  });
  await step('setup-close-guide', async () => { if (await page.getByText('Screenplay Editor Guide').count()) { await pause(800); await page.keyboard.press('Escape'); await pause(800); } }, false);
  await step('setup-type-script', async () => {
    const cands = ['.cm-content', '[contenteditable="true"]', 'textarea'];
    let ed = null; for (const s of cands) { const l = page.locator(s).first(); if (await l.count() && await l.isVisible().catch(() => false)) { ed = l; break; } }
    if (!ed) throw new Error('editor ikke funnet'); await ed.click(); await pause(400);
    // Rent manus uten autocomplete-artefakter: insertText (paste-lignende).
    await page.keyboard.insertText(SCRIPT);
    await pause(2000);
  }, false);
  await shot('01-editor-full');

  // Commit den live parsingen til data-modellen (ellers er Scener/Karakterer/Akter tomme)
  await step('setup-parser-til-scener', async () => {
    await page.getByRole('button', { name: /parser til scener/i }).first().click({ force: true });
    await page.getByText('Parser Manuskript til Scener').first().waitFor({ timeout: 8000 });
    await pause(1200);
    await shot('01b-parse-dialog'); // for å verifisere karakter-uttrekket (ingen «KLIPP TIL SVART.»)
    await page.getByRole('button', { name: /^parser scener$/i }).first().click({ force: true }); // bekreft i dialogen
    await pause(2500);
  });

  page.setDefaultTimeout(12000); // feilede klikk skal ikke brenne 30s

  // Robust: velg fanen (role=tab) som INNEHOLDER et element med eksakt label-tekst
  // (uavhengig av badge-tall som «6»).
  // Scope til manuskript-fanelista (den som inneholder «Editor») → unngår topp-nav.
  // Ren substring-match (badge-tall konkateneres inn: «Scener6»). force pga. badge-hit-test.
  const manuscriptTabs = () => page.getByRole('tablist').filter({ hasText: 'Editor' }).first();
  const clickTab = async (label) => {
    const tab = manuscriptTabs().getByRole('tab').filter({ hasText: label }).first();
    await tab.click({ force: true });
    await pause(1900);
  };

  // ── Fane-tur (Editor..Storyboard; Production View til slutt — den bytter layout) ──
  const TABS = ['Editor', 'Akter', 'Scener', 'Karakterer', 'Dialog', 'Breakdown', 'Revisjoner', 'Timeline', 'Storyboard'];
  let i = 2;
  for (const tab of TABS) {
    const n = String(i).padStart(2, '0'); i++;
    await step(`${n}-tab-${tab.replace(/\s+/g, '-').toLowerCase()}`, async () => { await clickTab(tab); });
  }

  // ── Topp-toolbar-verktøy (fortsatt i Story Writer-layout) ────────────────
  await step('back-to-editor', async () => { await clickTab('Editor'); }, false);
  const TOOLS = [
    { name: '20-tool-maler', label: /^maler$/i, close: true },
    { name: '21-tool-dine-manuskripter', label: /dine manuskripter/i, close: true },
    { name: '22-tool-sett-mal-lengde', label: /sett mål-lengde/i, close: true },
    { name: '23-tool-importer', label: /^importer$/i, close: true },
    { name: '24-tool-eksporter-manus', label: /eksporter manus/i, close: true },
    { name: '25-tool-auto-breakdown', label: /^auto breakdown$/i, close: false },
  ];
  for (const t of TOOLS) {
    await step(t.name, async () => { await page.getByRole('button', { name: t.label }).first().click(); await pause(1400); });
    if (t.close) { await page.keyboard.press('Escape').catch(() => {}); await pause(600); }
  }

  // ── Production View til slutt (bytter til produksjons-cockpit) ───────────
  await step('back-to-editor-2', async () => { await clickTab('Editor'); }, false);
  await step('29-tab-production-view', async () => { await clickTab('Production View'); await pause(1500); });

  // ── Guide-panel-captures (åpne hvert høyre-panel-verktøy i editoren) ─────
  const ASSETS = '/Users/danielqazi/monorepo-cto-audit-p1/frontend/client/public/role-room-assets';
  await step('back-to-editor-3', async () => { await clickTab('Editor'); await pause(1200); }, false);
  const PANELS = [
    ['beat board', 'guide-beat-board'],
    ['analysis', 'guide-script-analysis'],
    ['story structure', 'guide-story-structure'],
    ['grammar', 'guide-grammar'],
    ['table read', 'guide-table-read'],
  ];
  for (const [aria, name] of PANELS) {
    await step(`panel-${name}`, async () => {
      await page.locator(`[aria-label="${aria}"]`).first().click({ force: true });
      await pause(1900);
      await page.screenshot({ path: `${ASSETS}/${name}.png` });
    });
  }

  writeFileSync(`${OUT}/findings.json`, JSON.stringify({ findings, consoleErrorCount: consoleErrors.length, consoleErrorsSample: [...new Set(consoleErrors)].slice(0, 50) }, null, 2));
  console.log(`\n=== ${findings.filter(f => f.ok).length}/${findings.length} steg ok · ${consoleErrors.length} console-feil ===`);
  await context.close(); await browser.close();
})().catch((e) => { console.error('FEIL', e); process.exit(1); });
