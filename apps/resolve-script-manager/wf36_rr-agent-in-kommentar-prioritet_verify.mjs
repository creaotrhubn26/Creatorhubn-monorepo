import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-kommentar-prioritet.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Agent',
  eyebrow: 'Agent-anbefaling',
  insight: 'Prioriter disse kommentarene — <span class="grad">tre er varme leads</span>',
  reason: 'Jeg sorterte de nye kommentarene dine etter kjøpsintensjon og sentiment. Disse tre øverst er verdt et svar nå, mens vinduet er åpent.',
  tall: '3', tallLabel: 'Kommentarer å svare først',
  statIkon: 'priority_high',
  prio: 'Svar innen 2 t',
  cta: 'Utfør',
  skip: 'Eller la meg foreslå svar'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-kommentar-prioritet_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-kommentar-prioritet_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
