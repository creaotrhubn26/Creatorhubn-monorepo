/**
 * reddit-app-helper.ts
 *
 * Playwright-helper som åpner Reddit's app-creation-side i en synlig
 * Chromium-browser. Persisterer cookies i en lokal user-data-dir så
 * du forblir innlogget mellom kjøringer.
 *
 * Når du navigerer til https://www.reddit.com/prefs/apps og scroller
 * til "create another app..."-skjemaet, autofyller scriptet feltene.
 * Du klikker "create app" selv, og når Reddit returnerer client_id +
 * secret, leser scriptet dem ut og skriver til terminal.
 *
 * Bruk:
 *   npx ts-node scripts/reddit-app-helper.ts
 *   ELLER
 *   npx playwright test scripts/reddit-app-helper.ts (men det er ikke en test)
 *
 * Direkte kjørbar:
 *   npx tsx scripts/reddit-app-helper.ts
 */

import { chromium } from '@playwright/test';
import * as path from 'node:path';
import * as os from 'node:os';

const REDDIT_APPS_URL = 'https://www.reddit.com/prefs/apps';

const FORM_VALUES = {
  name: 'The Role Room',
  description:
    'Engagement monitor for The Role Room community posts. Read-only: fetches upvotes and comments_count on our own published threads, and searches for mentions of "The Role Room". Compliant with Reddit\'s Responsible Builder Policy.',
  about_url: 'https://theroleroom.com',
  redirect_uri: 'http://localhost:8080',
};

async function main() {
  const userDataDir = path.join(os.homedir(), '.reddit-app-helper-profile');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  REDDIT APP-CREATION HELPER (Playwright)');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('  Åpner Reddit i en synlig Chromium-browser.');
  console.log(`  Cookies/login persisteres i: ${userDataDir}\n`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  // Reduser detection: skjul navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const page = await context.newPage();

  console.log('  → Navigerer til Reddit prefs/apps...');
  await page.goto(REDDIT_APPS_URL, { waitUntil: 'domcontentloaded' });

  console.log('\n  ✓ Browser åpen. Logg inn hvis du ikke allerede er det.');
  console.log('  ✓ Vent til siden viser din apps-liste.');
  console.log('  ✓ Scroll nederst til "create another app..."-skjemaet.\n');

  console.log('  Når create-app-skjemaet er synlig, autofyller scriptet:');
  console.log(`     name:         ${FORM_VALUES.name}`);
  console.log(`     description:  (lang beskrivelse)`);
  console.log(`     about url:    ${FORM_VALUES.about_url}`);
  console.log(`     redirect uri: ${FORM_VALUES.redirect_uri}\n`);

  // Vent til create-app-skjemaet er synlig (Reddit har ulike URL-er
  // avhengig av om gammel eller ny UI). Vi looper og prøver autofyll.
  const checkInterval = setInterval(async () => {
    try {
      // Gammel UI: name input med id="name"
      const nameInput = await page.$('input[name="name"]:visible');
      if (nameInput) {
        console.log('  ↻ Autofyller skjema...');
        await nameInput.fill(FORM_VALUES.name).catch(() => {});

        // Velg "script"-radio
        const scriptRadio = await page.$('input[type="radio"][value="script"]');
        if (scriptRadio) await scriptRadio.click().catch(() => {});

        const descTextarea = await page.$('textarea[name="description"]');
        if (descTextarea) await descTextarea.fill(FORM_VALUES.description).catch(() => {});

        const aboutInput = await page.$('input[name="about_url"]');
        if (aboutInput) await aboutInput.fill(FORM_VALUES.about_url).catch(() => {});

        const redirectInput = await page.$('input[name="redirect_uri"]');
        if (redirectInput) await redirectInput.fill(FORM_VALUES.redirect_uri).catch(() => {});

        console.log('  ✓ Autofylt. Klikk "create app"-knappen manuelt.\n');
        clearInterval(checkInterval);
      }
    } catch {
      // Ignore — siden er ikke klar ennå
    }
  }, 2000);

  // Lytt etter URL-endringer som indikerer at app-en er opprettet
  page.on('framenavigated', async () => {
    try {
      await page.waitForTimeout(1500);
      // Etter create-app navigerer Reddit til samme prefs/apps-side
      // med den nye app-en. client_id og secret vises på siden.
      const html = await page.content();

      // Match for Reddit's app-display-format:
      //   <h3>The Role Room</h3>
      //   ...
      //   <span>personal use script</span>: abcdef1234
      //   secret: ZyXwVuTsRqPoNmLkJiHgFeDcBa
      const idMatch = html.match(/personal use script[\s\S]{0,200}?([a-zA-Z0-9_-]{14,30})/);
      const secretMatch = html.match(/secret[\s\S]{0,200}?([a-zA-Z0-9_-]{20,60})/);

      if (idMatch && secretMatch) {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  ✓ APP OPPRETTET! Credentials hentet:');
        console.log('═══════════════════════════════════════════════════════════\n');
        console.log(`  REDDIT_CLIENT_ID=${idMatch[1]}`);
        console.log(`  REDDIT_CLIENT_SECRET=${secretMatch[1]}`);
        console.log(
          `  REDDIT_USER_AGENT=TheRoleRoom:engagement-monitor:v1.0 (by /u/<din-reddit-handle>)\n`,
        );
        console.log('  Kopier disse til Render env-vars og redeploy.');
        console.log('  Browser-vinduet kan lukkes når du er ferdig.\n');
      }
    } catch {
      // Ignore — siden er ikke klar ennå
    }
  });

  // Hold browseren åpen til brukeren manuelt lukker
  await new Promise<void>((resolve) => {
    context.on('close', () => resolve());
  });
}

main().catch((err) => {
  console.error('\n  ✗ Feil:', err.message);
  process.exit(1);
});
