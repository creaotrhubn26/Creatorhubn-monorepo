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
    log('✓ Fant knappen. Lagrer sesjonen og åpner agenten…');
    await context.storageState({ path: STATE_PATH });
    await beat(page, 1200);
    await agentButton.click();
    await beat(page, 2000);

    // ── Scene 4: Fill research form ─────────────────────────────────
    log('Scene 4: fyller inn kundesignaler…');
    const websiteInput = page.getByLabel(/nettside/i).first();
    if (await websiteInput.count()) {
      await websiteInput.fill(DEMO_WEBSITE);
      await beat(page, 800);
    }
    const companyInput = page.getByLabel(/firmanavn/i).first();
    if (await companyInput.count()) {
      await companyInput.fill(DEMO_PROJECT_NAME);
      await beat(page, 800);
    }
    if (DEMO_ORG_NUMBER) {
      const orgInput = page.getByLabel(/org\.nr/i).first();
      if (await orgInput.count()) {
        await orgInput.fill(DEMO_ORG_NUMBER);
        await beat(page, 600);
      }
    }

    // ── Scene 5: Run analysis ───────────────────────────────────────
    log('Scene 5: starter analysen — Meta Pages-enrichment kjører automatisk…');
    const runButton = page.getByRole('button', { name: /analyser kunde/i }).first();
    if (await runButton.count()) {
      await runButton.click();
    }

    // The analysis takes 5-20 seconds; wait for the competitor cards
    // to render with Meta Page data attached.
    log('Venter på at competitor-analysen fullfører + at Meta-berikelsen henter public Page-metadata…');
    const metaPageBox = page.locator('[data-testid="competitor-meta-page"]').first();
    try {
      await metaPageBox.waitFor({ state: 'visible', timeout: 60_000 });
      log('✓ Meta Page Public Metadata rendret i competitor-cardet.');
    } catch {
      log('⚠ Meta-berikelse vistes ikke innen 60s — fortsetter opptak likevel slik at reviewer ser output-tilstanden.');
    }
    await beat(page, 3000);

    // ── Scene 6: Scroll + linger on competitor + Meta data ──────────
    log('Scene 6: scroller til competitor-seksjonen og dveler på Meta Page-kortet…');
    const competitorsHeader = page.getByText(/konkurrentanalyse|konkurrenter/i).first();
    if (await competitorsHeader.count()) {
      await competitorsHeader.scrollIntoViewIfNeeded();
      await beat(page, 2500);
    }
    if (await metaPageBox.count()) {
      await metaPageBox.scrollIntoViewIfNeeded();
      await beat(page, 4000);
    }

    // Extra beat so the reviewer has time to read every metadata field.
    log('Scene 7: extra still for reviewer…');
    await beat(page, 4000);

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
