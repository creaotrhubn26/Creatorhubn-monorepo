import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-hashtag-kampanje.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room <span>Agent</span>',
  brandTag: 'Markedsføring · social · innsikt',
  eyebrow: 'Agent-anbefaling',
  head: 'Lanser din <em>egen emneknagg</em> — eierskap til samtalen',
  insightLabel: 'Hvorfor dette',
  recoIcon: 'tag',
  insightVal: 'En egen emneknagg <b>samler alt innholdet ditt på ett sted</b> og lar publikum gjenkjenne og dele kampanjen — du bygger din egen trend i stedet for å låne andres',
  tall: '+38 %', tallLabel: 'estimert økt synlighet over kampanjen',
  cta: 'Utfør · Bygg kampanjen',
  foot: 'Du godkjenner før noe publiseres — Agenten venter på ditt klikk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
// setContent does not trigger addInitScript, so inject __CFG__ inline.
const injected = html.replace('<head>', '<head>\n<script>window.__CFG__=' + JSON.stringify(CFG) + ';<\/script>');
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-hashtag-kampanje_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-hashtag-kampanje_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
