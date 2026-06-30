import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-in-konvertering-lekkasje.html', 'utf8');

const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Agent',
  eyebrow: 'Agent-anbefaling',
  insight: 'Trakten din <span class="grad">mister kundene</span> ved booking-steget',
  reason: 'Folk klikker seg helt frem til booking, men 8 av 10 faller fra rett før de fullfører. Skjemaet er for langt og betalingssteget skaper friksjon — det er her det lekker mest i kundereisen din.',
  stages: [
    { name: 'Så annonsen',           val: '12 400' },
    { name: 'Besøkte landingssiden', val: '3 850' },
    { name: 'Startet booking',       val: '920', leak: true, flag: 'Lekkasje' },
    { name: 'Fullførte kjøp',        val: '148' }
  ],
  tall: '-84',
  tallSuffiks: '%',
  tallLabel: 'fall fra «startet booking» til «fullført kjøp»',
  statIkon: 'water_drop',
  cta: 'Utfør',
  skip: 'Eller spør meg om hvordan vi tetter lekkasjen'
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-konvertering-lekkasje_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-konvertering-lekkasje_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
