import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf31_ch-landing-modules.html', 'utf8');

const CFG = {
  title: 'Et system bygget for kreative arbeidsflyter',
  m1: 'Kjerneplattform', d1: 'Prosjekter, klienter og leveranser samlet på ett sted.',
  m2: 'The Role Room', d2: 'Casting, produksjon og talent fra idé til ferdig sett.',
  m3: 'Creatorhub Academy', d3: 'Kurs og veiledning som løfter håndverket ditt.',
  m4: 'Community', d4: 'Et fellesskap av kreative som deler og vokser sammen.',
  accent: '#ffba6c',
  ink: '#f6f2ea',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf31_ch-landing-modules_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf31_ch-landing-modules_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
