import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-bio-lenke.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room',
  eyebrow: 'Agent-anbefaling',
  titleLbl: 'Profiloptimalisering',
  titleMain: 'Oppdater lenke i bio',
  mainIcon: 'link',
  insight: 'Lenken i bioen din peker fortsatt på <b>«Vårkampanjen»</b> som ble avsluttet for tre uker siden. Følgerne klikker, men lander på en blindvei. Bytt til billettsiden for «Nattskift»-premieren mens engasjementet er på topp.',
  linkOld: 'linktr.ee/vaarkampanje-23',
  linkNew: 'therole.room/nattskift-premiere',
  tall: '1 248',
  tallLabel: 'Klikk siste 7 dager',
  metricIcon: 'touch_app',
  trendIcon: 'north_east',
  trendTxt: 'lander på feil side',
  cta: 'Utfør',
  ctaIcon: 'bolt'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-bio-lenke_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-bio-lenke_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
