import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-folger-kilde.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  eyebrow: 'AGENT-ANBEFALING',
  head: 'Ny følger-kilde dukket opp',
  sub: 'Jeg sporet hvor de nye følgerne dine kommer fra — <b>TikTok-deling</b> driver plutselig hele veksten.',
  kildeLabel: 'Hvor nye følgere kommer fra',
  tall: '+312',
  tallLabel: 'nye følgere fra TikTok denne uka',
  trendLabel: 'Ny kilde',
  cta: 'Utfør',
  ctaNote: 'Jeg lager <b>3 nye TikTok-klipp</b> for å holde tilstrømmingen oppe.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate((cfg) => window.applyConfig(cfg), CFG);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-folger-kilde_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-folger-kilde_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
