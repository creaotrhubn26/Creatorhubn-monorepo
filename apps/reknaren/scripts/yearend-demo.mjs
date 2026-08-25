/**
 * Visuell demo av hele årsavslutningen: åpne Årsavslutning → skjermbilde av
 * skatt + disponering + næringsspesifikasjon → gjennomfør → skjermbilde av
 * låst/disponert år.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';

const BASE = 'http://localhost:4315';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = '/tmp/reknaren-yearend-shots';
const TOKEN = readFileSync('/tmp/reknaren-demo.tok', 'utf8').trim();
const ORG_ID = readFileSync('/tmp/reknaren-demo.org', 'utf8').trim();
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
await page.addInitScript(
  ([t, o]) => {
    sessionStorage.setItem('reknaren.token', t);
    sessionStorage.setItem('reknaren.orgId', o);
    sessionStorage.setItem('reknaren.email', 'yeardemo@reknaren.no');
  },
  [TOKEN, ORG_ID],
);
const fail = async (msg) => {
  await page.screenshot({ path: `${SHOTS}/FAILURE.png`, fullPage: true });
  console.error('FAIL:', msg);
  await browser.close();
  process.exit(1);
};

try {
  await page.goto(BASE);
  await page.waitForSelector('nav button:has-text("Årsavslutning")', { timeout: 10000 });
  await page.click('nav button:has-text("Årsavslutning")');

  // Plan + næringsspesifikasjon lastet.
  await page.waitForSelector('h2:has-text("Skattepostering som bokføres")', { timeout: 8000 });
  await page.waitForSelector('h2:has-text("Disponering av årsresultat")', { timeout: 8000 });
  await page.waitForSelector('h2:has-text("Næringsspesifikasjon (utkast)")', { timeout: 8000 });
  await page.waitForSelector('.confidence:has-text("Balansen går opp")', { timeout: 8000 });
  await page.screenshot({ path: `${SHOTS}/1-arsavslutning-for.png`, fullPage: true });

  // Gjennomfør årsavslutningen.
  await page.click('button:has-text("Gjennomfør årsavslutning")');
  await page.waitForSelector('text=avsluttet og låst', { timeout: 12000 });
  await page.waitForSelector('.confidence:has-text("Disponert")', { timeout: 8000 });
  await page.screenshot({ path: `${SHOTS}/2-arsavslutning-etter.png`, fullPage: true });

  console.log('YEAREND-DEMO OK →', SHOTS);
  await browser.close();
  process.exit(0);
} catch (err) {
  await fail(err.message);
}
