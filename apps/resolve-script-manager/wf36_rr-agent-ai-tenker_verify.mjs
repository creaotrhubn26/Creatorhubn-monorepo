import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-ai-tenker.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  eyebrow: 'Agenten arbeider',
  status: 'Tenker',
  statusFerdig: 'Ferdig',
  subtekst: 'Analyserer kontoene dine og bygger en anbefaling for sommerens bryllupskampanje …',
  steps: [
    { ic: 'travel_explore', t: 'Henter kontodata',  d: 'Instagram, Facebook og LinkedIn · siste 30 dager' },
    { ic: 'insights',       t: 'Analyserer mønstre', d: 'Engasjement, beste tidspunkt og toppinnlegg' },
    { ic: 'lightbulb',      t: 'Vurderer vinkler',   d: 'Behind-the-scenes presterer 38 % over snittet' },
    { ic: 'event_note',     t: 'Planlegger innhold', d: 'Bygger en 14-dagers kalender med caption-forslag' }
  ]
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-tenker_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-tenker_mid.png', omitBackground: true });

await browser.close();
console.log('done');
