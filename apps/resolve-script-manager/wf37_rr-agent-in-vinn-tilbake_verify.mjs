import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-vinn-tilbake.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'restart_alt',
  head: 'Reaktivér en tapt kunde — <em>vinn dem tilbake</em>',
  sub: 'Byrå Nordlys har vært stille i 94 dager etter tre fullførte produksjoner. Jeg har skrevet en personlig vinn-tilbake-melding med et skreddersydd tilbud — klar til å sendes.',
  statIcon: 'person_add',
  tall: '38 200 kr',
  tallLabel: 'estimert gjenvunnet livstidsverdi',
  cta: 'Utfør · Send vinn-tilbake-tilbud',
  foot: 'Du godkjenner før noe sendes — Agenten venter på ditt klikk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-vinn-tilbake_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-vinn-tilbake_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
