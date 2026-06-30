import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-ld-varme.html', 'utf8');

const CFG = {
  title: 'Tre kunder venter på svar',
  sub: 'Prioritert etter intensjon og estimert verdi',
  foot: 'Følg opp innen 1 time for høyest konvertering',
  leads: [
    { name: 'Marte Lønne', source: 'Instagram', score: 96, value: 42000 },
    { name: 'Birk Sæthre', source: 'LinkedIn', score: 88, value: 68000 },
    { name: 'Åse Vågø', source: 'Facebook', score: 81, value: 31000 }
  ],
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-varme_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-varme_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
