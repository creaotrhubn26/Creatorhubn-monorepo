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

const DEMO_PROJECT_NAME = process.env.DEMO_PROJECT_NAME || 'Northwind Drilling demo';
const DEMO_WEBSITE = process.env.DEMO_WEBSITE || 'https://www.northwind.no';
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

async function waitForLogin(page, maxSeconds) {
  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    const pathname = new URL(page.url()).pathname;
    const isAppPath =
      pathname.startsWith('/dashboard')
      || pathname.startsWith('/role-room')
      || pathname.startsWith('/smart-dashboard')
      || pathname.startsWith('/universal-dashboard');
    if (isAppPath) {
      const hasAppShell =
        (await page.getByRole('tab', { name: /The Role Room/i }).count()) > 0
        || (await page.locator('[data-testid="universal-dashboard"], header.MuiAppBar-root').count()) > 0;
      if (hasAppShell) return true;
    }
    await page.waitForTimeout(1500);
  }
  return false;
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
    await page.goto(`${APP_URL}/dashboard`, { waitUntil: 'domcontentloaded' });

    if (!storageState && !HEADLESS) {
      log(`Logg inn som admin — opp til ${LOGIN_WAIT_SECONDS}s på å fullføre.`);
      const ok = await waitForLogin(page, LOGIN_WAIT_SECONDS);
      if (!ok) throw new Error('Login timed out.');
      await context.storageState({ path: STATE_PATH });
      log('Login saved.');
    }

    // ── Scene 1: Open The Role Room tab ─────────────────────────────
    log('Scene 1: åpner The Role Room…');
    const roleRoomTab = page.getByRole('tab', { name: /The Role Room/i }).first();
    await roleRoomTab.waitFor({ timeout: 15_000 });
    await roleRoomTab.scrollIntoViewIfNeeded();
    await roleRoomTab.click();
    await beat(page, 2000);

    // ── Scene 2: Pick or create a project ───────────────────────────
    log('Scene 2: velger demo-prosjekt…');
    // Try project list first.
    const firstProject = page.locator('[role="listitem"] button, ul [role="button"], .MuiListItemButton-root').first();
    if (await firstProject.count()) {
      await firstProject.click();
      await beat(page, 1500);
    } else {
      log('Ingen prosjekt i listen — hopper rett til agent-dialogen.');
    }

    // ── Scene 3: Open The Role Room Agent ───────────────────────────
    log('Scene 3: åpner The Role Room Agent…');
    // The Agent opens via a button or icon in the project panel.
    const agentOpener = page.getByRole('button', { name: /agent|analyser kunde|bootstrap/i }).first();
    if (await agentOpener.count()) {
      await agentOpener.click();
      await beat(page, 2000);
    }

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
