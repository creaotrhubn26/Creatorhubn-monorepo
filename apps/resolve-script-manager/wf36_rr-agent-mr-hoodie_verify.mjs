import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-mr-hoodie.html', 'utf8');

const CFG = {
  produksjon: 'Sommernatt – kortfilm',
  tag: 'Foreslått av Agenten',
  produkt: 'Crew-hettegenser',
  beskrivelse: 'Premium børstet bomull, brodert logo på brystet. Begrenset opplag.',
  pris: '649 kr',
  foer: '799 kr',
  storrelser: 'XS–XXL',
  farger: 'Sort · Lilla · Grå',
  levering: 'Print-on-demand',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-hoodie_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-mr-hoodie_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
