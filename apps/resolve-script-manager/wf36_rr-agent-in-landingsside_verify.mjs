import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-in-landingsside.html', 'utf8');

const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Agent',
  eyebrow: 'Agent-anbefaling',
  insight: 'Forbedre <span class="grad">landingssiden</span> for flere henvendelser',
  reason: 'Trafikken fra annonsene treffer landingssiden, men få går videre. Revisjonen peker på én avgjørende svakhet: handlingsknappen er for svak og ligger gjemt under folden.',
  mockUrl: 'studioqvist.no/casting',
  mockCta: 'Book gratis møte',
  a1t: 'Lastetid', a1s: '1,9 s — innenfor mål', a1tag: 'OK',
  a2t: 'Tydelig verdiløfte', a2s: 'Synlig over folden', a2tag: 'OK',
  a3t: 'Handlingsknapp', a3s: 'For svak — gjemt under folden', a3tag: 'FIKS',
  tall: '+38',
  tallSuffiks: '%',
  tallLabel: 'høyere konvertering estimert etter fiks',
  statIkon: 'trending_up',
  cta: 'Utfør',
  skip: 'Eller spør meg om revisjonen bak'
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-landingsside_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-landingsside_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
