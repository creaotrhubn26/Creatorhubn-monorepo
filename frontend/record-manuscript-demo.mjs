// record-manuscript-demo.mjs — MP4-marketing-demo av
// Role Room Studio › Story Writer › Manuskript. Oppretter et EKTE manuskript
// (Fountain) KUN i den demo-gatede klient-side harness-en (ingen backend,
// ingen prod-data). Produserer webm → konverteres til mp4 etterpå.
//
// Kjør fra frontend/: node record-manuscript-demo.mjs
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5001/e2e-casting-test.html';
const OUT_DIR = '/Users/danielqazi/manuscript-demo-video';
const W = 1920, H = 1080;
const log = (m) => console.log(`[rec] ${m}`);

const TITLE = 'Siste servering';
const AUTHOR = 'The Role Room — DEMO';

// Et ekte, komplett kort-manus i Fountain-format.
const SCRIPT = [
  'INT. RESTAURANTKJØKKEN – KVELD',
  '',
  'Damp stiger fra grytene. LIV (40) tørker hendene på forkleet og ser ut over det tomme kjøkkenet. En siste tallerken står klar.',
  '',
  'LIV',
  '(lavt)',
  'Tjue år. Og alt koker ned til én tallerken.',
  '',
  'Kjøkkendøra går opp. JONAS (25), kokkelærling, stopper i døra.',
  '',
  'JONAS',
  'De venter på deg der ute.',
  '',
  'LIV',
  'La dem vente. God mat har aldri lært seg å skynde seg.',
  '',
  'EXT. BAKGÅRD – KVELD',
  '',
  'Liv tenner en sigarett hun ikke røyker. Jonas følger etter.',
  '',
  'JONAS',
  'Hvorfor gir du deg nå? Stedet er fullt hver kveld.',
  '',
  'LIV',
  'Fordi jeg vil gå mens det fortsatt smaker av noe.',
  '',
  'Hun rekker ham kokkekniven. Han nøler.',
  '',
  'LIV (CONT’D)',
  'Den er din nå. Ikke skjær for fort.',
  '',
  'INT. RESTAURANT – SPISESAL – KVELD',
  '',
  'Gjestene reiser seg. Applaus. Liv går sakte gjennom rommet, nikker, men stopper ikke.',
  '',
  'JONAS (V.O.)',
  'Hun lærte meg aldri oppskriftene.',
  '',
  'INT. RESTAURANTKJØKKEN – SENERE',
  '',
  'Jonas står alene ved benken. Han løfter kniven, puster ut, og begynner.',
  '',
  'JONAS (V.O.)',
  'Hun lærte meg å høre når retten var ferdig.',
  '',
  'KLIPP TIL SVART.',
  '',
].join('\n');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT_DIR, size: { width: W, height: H } },
  });
  const page = await context.newPage();
  const pause = (ms) => page.waitForTimeout(ms);
  const safe = async (label, fn) => { try { await fn(); log(`ok: ${label}`); } catch (e) { log(`SKIP ${label}: ${String(e).split('\n')[0]}`); } };

  // 1) Last harness + seed demo-prosjekt (klient-side, demo-gated)
  log('laster harness + seed=basic (demo-gated)');
  await page.goto(`${BASE}?seed=basic`, { waitUntil: 'domcontentloaded' });
  await page.getByText('E2E Basic Test Project').first().waitFor({ timeout: 40000 });
  await pause(2600);

  // 2) Role Room Studio
  await safe('åpne Role Room Studio', async () => {
    await page.getByText('Role Room Studio', { exact: true }).first().click();
    await pause(2200);
  });

  // 3) Story Writer
  await safe('åpne Story Writer', async () => {
    await page.getByText('Skriv manuskript').first().click();
    await page.getByText('Story Writer - Manuskript').first().waitFor({ timeout: 15000 });
    await pause(2400);
  });

  // 4) Opprett nytt manuskript → fyll dialog
  await safe('åpne Nytt Manuskript-dialog', async () => {
    const emptyBtn = page.getByRole('button', { name: /opprett nytt manuskript/i }).first();
    if (await emptyBtn.count()) await emptyBtn.click();
    else await page.getByRole('button', { name: /nytt manuskript/i }).first().click();
    await page.getByText('Nytt Manuskript', { exact: true }).first().waitFor({ timeout: 8000 });
    await pause(1600);
  });

  await safe('fyll tittel + forfatter', async () => {
    const dialog = page.getByRole('dialog');
    const title = dialog.getByLabel(/tittel/i).first();
    await title.click();
    await title.type(TITLE, { delay: 55 });
    await pause(700);
    const author = dialog.getByLabel(/forfatter/i).first();
    if (await author.count()) { await author.click(); await author.type(AUTHOR, { delay: 35 }); }
    await pause(1200);
  });

  await safe('klikk OPPRETT', async () => {
    await page.getByRole('button', { name: /^opprett$/i }).first().click();
    await pause(2600);
  });

  // 5) Lukk evt. Screenplay Editor Guide
  await safe('lukk editor-guide om den åpner', async () => {
    if (await page.getByText('Screenplay Editor Guide').count()) {
      await pause(1400);
      await page.keyboard.press('Escape');
      await pause(1200);
    }
  });

  // 6) Skriv hele manuset i editoren (Fountain auto-styling live)
  await safe('fokuser editor + skriv manus', async () => {
    const candidates = ['.cm-content', '[contenteditable="true"]', 'textarea[class*="editor" i]', 'textarea'];
    let target = null;
    for (const sel of candidates) {
      const loc = page.locator(sel).first();
      if (await loc.count() && await loc.isVisible().catch(() => false)) { target = loc; break; }
    }
    if (!target) throw new Error('fant ikke editor-elementet');
    await target.click();
    await pause(600);
    // Linje for linje med eksplisitt Enter → rene linjeskift (unngår at
    // karakter-cue smelter sammen med replikk ved rask typing/autocomplete).
    const lines = SCRIPT.split('\n');
    for (const line of lines) {
      if (line.length) await page.keyboard.type(line, { delay: 26 });
      await page.keyboard.press('Escape'); // lukk evt. autocomplete-popup
      await page.keyboard.press('Enter');
      await pause(110);
    }
    await pause(2500);
  });

  // 7) Rolig avslutning
  await pause(2500);

  log('avslutter (finaliserer video)');
  await context.close();
  await browser.close();
  log(`ferdig → ${OUT_DIR}/*.webm`);
})().catch((e) => { console.error('[rec] FEIL', e); process.exit(1); });
