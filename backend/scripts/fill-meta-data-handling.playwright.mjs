#!/usr/bin/env node
/**
 * Fill Meta App Review's Data Handling Questions automatically.
 *
 * Opens the app's dashboard using the saved Playwright session, then
 * — once the user has navigated to the Data Handling form — auto-
 * populates:
 *   • "Do you have data processors?" → Yes
 *   • Processors list textarea
 *   • Responsible entity → Creatorhub AS
 *   • Country → Norway
 *   • National security requests → No
 *
 * Leaves the final "Submit" button for the user to click after
 * reviewing the filled answers — Meta's submit is destructive
 * (starts a 1-3 week review) so we never press it unattended.
 */

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const STATE_PATH = process.env.META_PLAYWRIGHT_STATE
  || path.resolve(process.cwd(), '.meta-playwright-state.json');
const APP_ID = process.env.META_APP_ID || '1042181045651851';

const RESPONSIBLE_ENTITY = 'Creatorhub AS';
const COUNTRY = 'Norway';

const PROCESSORS_BLOCK = `Data processors accessing Platform Data from Meta:

Functional integrations:
- Anthropic PBC (Claude AI) — AI caption and recipe generation on explicit user consent (US, SCCs)
- Google LLC — OAuth, Drive, Workspace integrations (US, EU-US Data Privacy Framework)
- Stripe, Inc. — subscription billing (US, EU-US Data Privacy Framework)
- Cohere Inc. — research retrieval re-ranking on anonymised snippets (Canada, adequacy decision)

Infrastructure processors:
- Render Services, Inc. — application hosting (US, SCCs)
- Neon, Inc. — managed PostgreSQL database (EU-west-2, Ireland)
- Cloudflare, Inc. — R2 object storage for uploaded images, carousel media and reels video (EU jurisdiction, SCCs)
- Vercel Inc. — static frontend and legal-page hosting (US, SCCs)

All processors are bound by written data processing agreements. Instagram tokens and media are accessed only by these processors in the course of delivering the service. Never shared with advertising networks, data brokers, or analytics third parties.`;

function log(message) {
  console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${message}`);
}

async function loadStorage() {
  try {
    await fs.access(STATE_PATH);
    return STATE_PATH;
  } catch {
    return undefined;
  }
}

/**
 * Try multiple strategies to locate a form control by its visible
 * question text. Meta renders these forms with custom shadow-y
 * components, so a single selector isn't stable.
 */
async function locateFieldByQuestion(page, questionFragment) {
  // Anchor on the question text.
  const questionNode = page.locator(`text=${questionFragment}`).first();
  if (!(await questionNode.count())) return null;
  // Return a scope locator that covers the question + the field(s)
  // right after it. We'll .locator(child) inside this.
  const container = questionNode.locator('xpath=ancestor::*[self::div or self::fieldset or self::section][1]');
  return (await container.count()) ? container.first() : questionNode;
}

async function clickRadioByLabel(scope, label) {
  const strategies = [
    () => scope.getByLabel(label, { exact: false }).first(),
    () => scope.getByRole('radio', { name: new RegExp(label, 'i') }).first(),
    () => scope.locator(`text=${label}`).first(),
  ];
  for (const build of strategies) {
    const locator = build();
    try {
      if (await locator.count()) {
        await locator.click({ timeout: 3000 });
        return true;
      }
    } catch {
      /* try next strategy */
    }
  }
  return false;
}

async function fillProcessorsTextarea(scope) {
  // The "List all data processors" field appears after the user picks
  // "Yes" on the prior question. Wait a moment so the reveal animation
  // finishes.
  await scope.page().waitForTimeout(800);
  const candidates = [
    scope.locator('textarea').first(),
    scope.locator('[contenteditable="true"]').first(),
  ];
  for (const locator of candidates) {
    if (await locator.count()) {
      await locator.fill(PROCESSORS_BLOCK).catch(() => locator.type(PROCESSORS_BLOCK));
      return true;
    }
  }
  return false;
}

async function fillEntityInput(scope, value) {
  const locator = scope.locator('input[type="text"], input:not([type])').first();
  if (await locator.count()) {
    await locator.fill(value);
    return true;
  }
  return false;
}

async function pickCountry(scope, country) {
  // Meta usually uses a combobox / searchable select. Try typing into
  // the combobox first.
  const opener = scope.locator('[role="combobox"], select, [aria-label*="country" i], [aria-label*="Select" i]').first();
  if (await opener.count()) {
    try {
      await opener.click();
    } catch {
      /* may be a native select, fall through */
    }
  }
  const option = scope.page().locator(`text=${country}`).first();
  try {
    await option.waitFor({ timeout: 3000 });
    await option.click();
    return true;
  } catch {
    return false;
  }
}

(async () => {
  const storageState = await loadStorage();
  if (!storageState) {
    console.error(`No Meta Playwright state at ${STATE_PATH}. Log in once via fetch-meta-credentials.playwright.mjs first.`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    storageState,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    log(`Åpner app ${APP_ID} — App Review…`);
    await page.goto(`https://developers.facebook.com/apps/${APP_ID}/app-review/`, {
      waitUntil: 'domcontentloaded',
    });

    log('');
    log('⏸  I nettleseren:');
    log('   1. Naviger til "Data Handling Questions" / "Data Use Checkup"');
    log('   2. Skriptet skanner etter skjemafeltene hvert 2. sekund.');
    log('   Du ser "✓ fylt inn" for hvert felt etterhvert som det låses.');
    log('');

    const deadline = Date.now() + 15 * 60 * 1000;
    const done = { processors: false, entity: false, country: false, national: false };

    while (Date.now() < deadline && !(done.processors && done.entity && done.country && done.national)) {
      // ── Processors ─────────────────────────────────────────────
      if (!done.processors) {
        const scope = await locateFieldByQuestion(page, 'data processors or service providers');
        if (scope) {
          if (await clickRadioByLabel(scope, 'Yes')) {
            log('✓ Markerte "Yes" på data-processors-spørsmålet');
            if (await fillProcessorsTextarea(scope)) {
              log('✓ Fylte inn prosessor-listen');
              done.processors = true;
            }
          }
        }
      }
      // ── Responsible entity ─────────────────────────────────────
      if (!done.entity) {
        const scope = await locateFieldByQuestion(page, 'responsible for all Platform Data');
        if (scope && (await fillEntityInput(scope, RESPONSIBLE_ENTITY))) {
          log(`✓ Ansvarlig entitet: ${RESPONSIBLE_ENTITY}`);
          done.entity = true;
        }
      }
      // ── Country ────────────────────────────────────────────────
      if (!done.country) {
        const scope = await locateFieldByQuestion(page, 'country where this person or entity is located');
        if (scope && (await pickCountry(scope, COUNTRY))) {
          log(`✓ Land: ${COUNTRY}`);
          done.country = true;
        }
      }
      // ── National security requests ─────────────────────────────
      if (!done.national) {
        const scope = await locateFieldByQuestion(page, 'national security requests');
        if (scope && (await clickRadioByLabel(scope, 'No'))) {
          log('✓ Nasjonal-sikkerhets-forespørsler: No');
          done.national = true;
        }
      }

      if (done.processors && done.entity && done.country && done.national) break;
      await page.waitForTimeout(2000);
    }

    console.log('');
    console.log('========================================================');
    if (done.processors && done.entity && done.country && done.national) {
      console.log(' ✓ Alle fire felt fylt inn. Skjekk svarene og klikk');
      console.log('   "Save" / "Submit" selv når du er klar.');
    } else {
      console.log(' ⚠  Noen felt ble ikke fylt. Se ovenfor — fyll manuelt.');
      console.log(`   processors=${done.processors} entity=${done.entity} country=${done.country} national=${done.national}`);
    }
    console.log('========================================================');
    console.log('Vinduet står åpent i 5 minutter så du kan ta de siste stegene.');
    await page.waitForTimeout(5 * 60 * 1000);

    await context.storageState({ path: STATE_PATH });
  } catch (error) {
    console.error('Skript feilet:', error?.message ?? error);
    await page.waitForTimeout(120_000);
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
})();
