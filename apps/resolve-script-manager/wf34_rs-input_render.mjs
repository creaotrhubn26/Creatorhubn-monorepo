import { chromium } from 'playwright';
import fs from 'fs';

const ID = 'rr-agent-rs-input';
const htmlPath = `/tmp/wf34_${ID}.html`;
let html = fs.readFileSync(htmlPath, 'utf8');

const CFG = {
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: '',
  nettside: 'https://nordlysbakeri.no',
  orgnr: '923 184 770',
  firma: 'Nordlys Håndverksbakeri AS',
};

// inject CFG before the template script runs
html = html.replace('</head>',
  `<script>window.__CFG__ = ${JSON.stringify(CFG)};</script></head>`);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
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
