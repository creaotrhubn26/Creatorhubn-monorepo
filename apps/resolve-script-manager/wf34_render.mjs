import { chromium } from 'playwright';
import fs from 'fs';

const ID = 'rr-agent-rs-summary';
const htmlPath = `/tmp/wf34_${ID}.html`;
let html = fs.readFileSync(htmlPath, 'utf8');

const CFG = {
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: '',
  sammendrag: 'Vi leste nettsiden, sjekket Brønnøysund og fant kontoene deres – her er et kjapt bilde av bedriften.',
  b1: 'Håndverksbakeri og kafé',
  b2: 'Familier og kaffeelskere i nærområdet',
  b3: 'Varm, ekte og litt leken',
  b4: 'Instagram, Facebook og Google',
};

html = html.replace('__CFG__', JSON.stringify(CFG));

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);

async function shot(p, file) {
  await page.evaluate((pp) => window.setProgress(pp), p);
  await page.waitForTimeout(400);
  const el = await page.$('#wrap');
  await el.screenshot({ path: file, omitBackground: true });
}

await shot(1, `/tmp/wf34_${ID}_end.png`);
await shot(0.5, `/tmp/wf34_${ID}_mid.png`);

await browser.close();
console.log('done');
