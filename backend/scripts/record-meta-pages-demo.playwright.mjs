#!/usr/bin/env node
/**
 * Record a demo video for Meta App Review — "Page Public Metadata Access".
 *
 * Navigates the producer through a live bootstrap, lets the Meta Pages
 * enrichment run, and pauses on the rendered competitor cards showing
 * the public metadata (follower count, category, About text) pulled
 * from Meta Graph API.
 *
 * Output: recordings/meta-pages-demo-<timestamp>.webm (Chromium's
 * native video format). Re-encode to MP4 via ffmpeg if Meta's upload
 * rejects webm — most modern reviewers accept webm directly.
 *
 * USAGE:
 *   APP_URL=https://app.creatorhubn.com \
 *   DEMO_PROJECT_NAME='Northwind Drilling demo' \
 *   DEMO_WEBSITE='https://www.northwind.no' \
 *   node backend/scripts/record-meta-pages-demo.playwright.mjs
 *
 * Env overrides:
 *   APP_URL                base URL (default https://theroleroom.com)
 *   VIDEO_DIR              where to write recording (default recordings/)
 *   DEMO_PROJECT_NAME      name to fill in the Role Room Agent form
 *   DEMO_WEBSITE           website to analyse
 *   DEMO_ORG_NUMBER        Brreg org number (optional)
 *   HEADLESS=1             run headless (no on-screen window)
 *   STATE_FILE             reusable login state (.role-room-demo-state.json)
 *
 * Expects the user to already have a Role Room admin account; first
 * run opens a visible browser for 10-minute manual login, then saves
 * state for subsequent headless runs.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP_URL = process.env.APP_URL || 'https://theroleroom.com';
const VIDEO_DIR = path.resolve(process.cwd(), process.env.VIDEO_DIR || 'recordings');
const STATE_PATH = path.resolve(process.cwd(), process.env.STATE_FILE || '.role-room-demo-state.json');
const HEADLESS = process.env.HEADLESS === '1';

// Default demo customer: Holy Crust — real Norwegian bakery in Oslo,
// an actual CreatorHub pilot client. Uses a real website so the
// producer-bootstrap has genuine signals to process, and Meta Pages
// Search resolves an actual public Facebook Page for reviewer demos.
const DEMO_PROJECT_NAME = process.env.DEMO_PROJECT_NAME || 'Holy Crust';
const DEMO_WEBSITE = process.env.DEMO_WEBSITE || 'https://holycrust.no';
const DEMO_ORG_NUMBER = process.env.DEMO_ORG_NUMBER || '';

const LOGIN_WAIT_SECONDS = 600;

function log(message) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${message}`);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadStorage() {
  try {
    await fs.access(STATE_PATH);
    return STATE_PATH;
  } catch {
    return undefined;
  }
}

async function waitForAgentButton(page, maxSeconds) {
  // More forgiving than URL-heuristics: just poll for the actual
  // "The Role Room Agent" button that opens the bootstrap dialog.
  // User can navigate wherever they want during login, we snap to
  // the button the moment it's rendered.
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const button = page.getByRole('button', { name: /^The Role Room Agent$/i }).first();
    if ((await button.count()) > 0) {
      try {
        await button.scrollIntoViewIfNeeded();
        return button;
      } catch {
        /* still rendering — retry */
      }
    }
    await page.waitForTimeout(1500);
  }
  return null;
}

// A short pause that reads well on video — not too fast, not too slow.
async function beat(page, ms = 1500) {
  await page.waitForTimeout(ms);
}

// Inject the caption+cursor styles once per page. Meta reviewers do not
// listen to audio (per their screen-recording guide), so every step is
// explained via on-screen English text overlays.
async function installStyles(page) {
  await page.addStyleTag({
    content: `
      #meta-demo-caption {
        position: fixed; z-index: 2147483647;
        left: 50%; top: 40px;
        transform: translateX(-50%);
        min-width: 480px; max-width: 1100px;
        padding: 18px 28px;
        background: rgba(8, 15, 30, 0.92);
        border: 1.5px solid rgba(59, 130, 246, 0.55);
        border-radius: 14px;
        color: #f1f5f9;
        font: 700 22px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        letter-spacing: 0.01em;
        box-shadow: 0 10px 40px rgba(0,0,0,0.45), 0 0 0 1px rgba(59,130,246,0.22) inset;
        pointer-events: none;
        opacity: 0;
        transition: opacity 420ms ease;
      }
      #meta-demo-caption.show { opacity: 1; }
      #meta-demo-caption .step {
        display: block;
        font: 800 11px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        letter-spacing: 0.22em;
        color: #93c5fd;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      #meta-demo-title {
        position: fixed; z-index: 2147483647;
        inset: 0;
        background: radial-gradient(circle at 50% 45%, rgba(30,58,138,0.92), rgba(2,6,23,0.98));
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        text-align: center;
        opacity: 0;
        transition: opacity 500ms ease;
      }
      #meta-demo-title.show { opacity: 1; }
      #meta-demo-title h1 {
        font-size: 46px; font-weight: 800;
        margin: 0 0 18px; letter-spacing: -0.01em;
      }
      #meta-demo-title h2 {
        font-size: 22px; font-weight: 500;
        margin: 0 0 8px; color: #bfdbfe;
      }
      #meta-demo-title p {
        font-size: 18px; font-weight: 400;
        max-width: 760px; color: #cbd5e1;
        margin: 24px 16px 0;
      }
      .meta-demo-spot {
        outline: 3px solid #38bdf8 !important;
        outline-offset: 4px;
        box-shadow: 0 0 0 6px rgba(59,130,246,0.32), 0 18px 48px rgba(56,189,248,0.28) !important;
        border-radius: 16px !important;
        animation: metaDemoPulse 1.8s ease-in-out infinite;
      }
      @keyframes metaDemoPulse {
        0%,100% { box-shadow: 0 0 0 6px rgba(59,130,246,0.28), 0 12px 32px rgba(56,189,248,0.24); }
        50%     { box-shadow: 0 0 0 14px rgba(59,130,246,0.10), 0 22px 60px rgba(56,189,248,0.42); }
      }
    `,
  });
}

async function showTitleCard(page, title, subtitle, body, durationMs) {
  await page.evaluate(({ title, subtitle, body }) => {
    const existing = document.getElementById('meta-demo-title');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = 'meta-demo-title';
    el.innerHTML =
      `<h2>${subtitle}</h2>` +
      `<h1>${title}</h1>` +
      `<p>${body}</p>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
  }, { title, subtitle, body });
  await page.waitForTimeout(durationMs);
  await page.evaluate(() => {
    const el = document.getElementById('meta-demo-title');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => el.remove(), 500);
  });
  await page.waitForTimeout(500);
}

async function showCaption(page, step, text) {
  await page.evaluate(({ step, text }) => {
    let el = document.getElementById('meta-demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'meta-demo-caption';
      document.body.appendChild(el);
    }
    el.innerHTML = `<span class="step">${step}</span>${text}`;
    requestAnimationFrame(() => el.classList.add('show'));
  }, { step, text });
}

async function hideCaption(page) {
  await page.evaluate(() => {
    const el = document.getElementById('meta-demo-caption');
    if (el) el.classList.remove('show');
  });
}

async function spotlight(page, locator) {
  const handle = await locator.elementHandle();
  if (!handle) return;
  await page.evaluate((el) => el?.classList.add('meta-demo-spot'), handle);
}

async function unspotlight(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.meta-demo-spot').forEach((el) => el.classList.remove('meta-demo-spot'));
  });
}

(async () => {
  await ensureDir(VIDEO_DIR);
  log(`Recording to ${VIDEO_DIR}`);

  const storageState = await loadStorage();
  const browser = await chromium.launch({ headless: HEADLESS, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState,
    locale: 'nb-NO',
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();

  try {
    log('Opening CreatorHub…');
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    log(`Logg inn + naviger til en side som viser knappen «The Role Room Agent» — opp til ${LOGIN_WAIT_SECONDS}s.`);
    log('Scriptet venter på at knappen dukker opp i DOM.');
    const agentButton = await waitForAgentButton(page, LOGIN_WAIT_SECONDS);
    if (!agentButton) throw new Error('«The Role Room Agent»-knappen dukket aldri opp — er du på rett produsent-panel?');
    log('✓ Fant knappen. Lagrer sesjonen.');
    await context.storageState({ path: STATE_PATH });

    await installStyles(page);
    // Meta reviewer cold-open: title card explicitly names the permission
    // being demonstrated and the concrete use case, so they know what
    // to look for before the flow begins.
    await showTitleCard(
      page,
      'Page Public Metadata Access',
      'CreatorHub One — Meta App Review Demo',
      'This screencast shows how CreatorHub One uses the Page Public Metadata Access permission: fetching a competitor\'s public Page data (fan count, category, about, verification status) from the Meta Graph API and rendering it inside our Competitor Intelligence view for content producers.',
      6000,
    );
    await beat(page, 600);

    // If the agent panel is already open (e.g. from a prior run's saved
    // state) the button we located may be inside the dialog itself and
    // occluded — skip the click and jump straight to the form.
    const websiteField = page.getByLabel(/nettside/i).first();
    const alreadyOpen = (await websiteField.count()) > 0 && (await websiteField.isVisible().catch(() => false));
    if (alreadyOpen) {
      log('Agent-skjemaet er allerede åpent — hopper over knappe-klikk.');
    } else {
      log('Åpner agenten…');
      await showCaption(page, 'Step 1 of 4', 'Producer opens The Role Room Agent to research a client\'s competitive landscape.');
      await beat(page, 1500);
      try {
        await agentButton.click({ timeout: 10_000 });
      } catch (err) {
        log(`Normal click feilet (${err.message}). Prøver force-click…`);
        await agentButton.click({ force: true });
      }
      await beat(page, 2500);
    }

    // ── Scene 4: Fill research form ─────────────────────────────────
    log('Scene 4: fyller inn kundesignaler…');
    await showCaption(page, 'Step 2 of 4', 'Producer enters the client\'s website. The app will analyse competitors and enrich them with Meta Graph API public Page metadata.');
    await beat(page, 2200);
    const websiteInput = page.getByLabel(/nettside/i).first();
    if (await websiteInput.count()) {
      await websiteInput.fill(DEMO_WEBSITE);
      await beat(page, 900);
    }
    const companyInput = page.getByLabel(/firmanavn/i).first();
    if (await companyInput.count()) {
      await companyInput.fill(DEMO_PROJECT_NAME);
      await beat(page, 900);
    }
    if (DEMO_ORG_NUMBER) {
      const orgInput = page.getByLabel(/org\.nr/i).first();
      if (await orgInput.count()) {
        await orgInput.fill(DEMO_ORG_NUMBER);
        await beat(page, 600);
      }
    }

    // ── Scene 5: Run analysis ───────────────────────────────────────
    // Attach a response listener BEFORE clicking so we capture the real
    // producer-bootstrap response — this tells us if the backend returned
    // competitors + metaPage data or if enrichment silently skipped.
    page.on('response', async (response) => {
      if (response.url().includes('/role-room/agent/producer-bootstrap')) {
        const status = response.status();
        log(`← producer-bootstrap response: ${status} (${response.request().method()})`);
        if (status === 200) {
          try {
            const body = await response.json();
            log(`  top-level keys: ${Object.keys(body).join(', ')}`);
            const result = body?.result ?? body;  // backend wraps payload in {success, result}
            log(`  result keys: ${Object.keys(result).join(', ')}`);
            const ca = result?.competitorAnalysis ?? {};
            const comps = ca.competitors ?? [];
            const withMeta = comps.filter((c) => c && c.metaPage);
            log(`  competitors=${comps.length}, withMetaPage=${withMeta.length}`);
            log(`  competitorAnalysis keys: ${Object.keys(ca).join(', ')}`);
            log(`  ca.status: ${ca.status}`);
            log(`  ca.source: ${ca.source}`);
            log(`  ca.marketContext: ${JSON.stringify(ca.marketContext).slice(0, 300)}`);
            log(`  ca.limitations: ${JSON.stringify(ca.limitations).slice(0, 400)}`);
            const retrieval = result?.retrievalMeta ?? {};
            log(`  retrievalMeta keys: ${Object.keys(retrieval).join(', ')}`);
            log(`  retrievalMeta: ${JSON.stringify(retrieval).slice(0, 600)}`);
            const bs = result?.businessSignals ?? null;
            if (bs) {
              log(`  businessSignals: primaryType=${bs.primaryType}, address=${bs.formattedAddress}`);
            } else {
              log(`  businessSignals: (null)`);
            }
            const brreg = result?.brregCompany ?? null;
            if (brreg) {
              log(`  brreg: name=${brreg.name}, municipality=${brreg.municipality}, industry=${brreg.industryCode?.description}`);
            } else {
              log(`  brreg: (null)`);
            }
            if (withMeta.length > 0) {
              log(`  first metaPage: ${JSON.stringify(withMeta[0].metaPage).slice(0, 200)}`);
            }
          } catch (e) {
            log(`  (could not parse response body: ${e.message})`);
          }
        }
      }
    });

    log('Scene 5: starter analysen — Meta Pages-enrichment kjører automatisk…');
    await showCaption(page, 'Step 3 of 4', 'Producer triggers the analysis. Backend calls the Meta Graph API /pages/search endpoint, then fetches public fields (fan_count, about, category, verification_status) for each matched competitor Page.');
    await beat(page, 3000);
    const runButton = page.getByRole('button', { name: /analyser kunde/i }).first();
    if (await runButton.count()) {
      await runButton.click();
    }

    // The full producer-bootstrap (Brreg + website scrape + Google Places
    // x2 + Meta enrichment) can take 60-120s sequentially. Give it 180s
    // before giving up on the Meta box specifically.
    log('Venter på at competitor-analysen fullfører + at Meta-berikelsen henter public Page-metadata (opp til 180s)…');
    const metaPageBox = page.locator('[data-testid="competitor-meta-page"]').first();
    let metaRendered = false;
    try {
      await metaPageBox.waitFor({ state: 'visible', timeout: 180_000 });
      metaRendered = true;
      log('✓ Meta Page Public Metadata rendret i competitor-cardet.');
    } catch {
      log('⚠ Meta-berikelse vistes ikke innen 180s — fortsetter opptak likevel.');
    }
    await beat(page, 2000);

    // ── Scene 6: Scroll + linger on competitor + Meta data ──────────
    log('Scene 6: scroller til competitor-seksjonen og dveler på Meta Page-kortet…');
    await showCaption(page, 'Step 4 of 4', 'Public Page metadata from Meta Graph API is rendered directly in the Competitor Intelligence view — highlighted below in blue.');
    await beat(page, 1500);
    const competitorsHeader = page.getByText(/konkurrentanalyse|konkurrenter/i).first();
    if (await competitorsHeader.count()) {
      await competitorsHeader.scrollIntoViewIfNeeded();
      await beat(page, 2200);
    }
    if (metaRendered && (await metaPageBox.count())) {
      await metaPageBox.scrollIntoViewIfNeeded();
      await spotlight(page, metaPageBox);
      // Long still so the reviewer can read every metadata field in the
      // highlighted Meta Page card. Meta's screencast guide stresses that
      // rendered data must be clearly visible and tied to the feature.
      await beat(page, 8000);
      await unspotlight(page);
      await beat(page, 1500);
    } else {
      // No Meta card rendered — still show the competitor area so the
      // reviewer sees the feature UI context.
      await beat(page, 4000);
    }

    await hideCaption(page);
    await beat(page, 500);
    await showTitleCard(
      page,
      'Page Public Metadata → Competitor Intelligence',
      'Use case',
      'CreatorHub One requests Page Public Metadata Access strictly to analyse and display public Facebook Page data for industry and competitor research inside the Producer workflow. No private data is accessed and no data is stored outside the producer\'s own workspace.',
      6000,
    );

    log('Demo complete — closing context to flush video.');
  } catch (error) {
    console.error('Skript feilet:', error?.message ?? error);
    await page.screenshot({ path: path.join(VIDEO_DIR, `failure-${Date.now()}.png`), fullPage: true }).catch(() => {});
    if (!HEADLESS) await page.waitForTimeout(60_000);
    process.exitCode = 2;
  } finally {
    await context.close();
    const videoPath = await page.video()?.path();
    if (videoPath) {
      const finalName = path.join(VIDEO_DIR, `meta-pages-demo-${Date.now()}.webm`);
      try {
        await fs.rename(videoPath, finalName);
        console.log(`\n✓ Video skrevet til ${finalName}`);
        console.log(`  Hvis Meta ikke aksepterer webm, re-encode med:`);
        console.log(`    ffmpeg -i ${finalName} -c:v libx264 -crf 22 -preset medium ${finalName.replace(/\.webm$/, '.mp4')}\n`);
      } catch {
        console.log(`\nVideo ligger på ${videoPath}`);
      }
    }
    await browser.close();
  }
})();
