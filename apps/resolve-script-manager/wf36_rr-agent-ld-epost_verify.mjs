import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-ld-epost.html', 'utf8');

const CFG = {
  lead: 'Kari Nordmann',
  email: 'kari@blomstereng.no',
  warm: 'Varm lead',
  subject: 'Takk for praten — her er et forslag til neste steg',
  greet: 'Hei Kari,',
  body1: 'Takk for at du tok kontakt om <span class="hl">innholdsproduksjon for høstkampanjen</span>. Jeg har satt sammen et kort forslag basert på det vi snakket om.',
  body2: 'Vi kan levere <span class="hl">12 ferdige innlegg + 4 reels</span> i måneden, med fast publiseringsplan og månedlig innsiktsrapport.',
  sign: 'Daniel — The Role Room',
  tip: 'Send før kl. 10 — 38 % høyere åpningsrate for denne mottakeren',
  sched: 'Planlagt i morgen 09:00',
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
await page.waitForTimeout(160);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-epost_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(160);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-epost_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
