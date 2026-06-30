import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-ld-lunkne.html', 'utf8');

const CFG = {
  eyebrow: 'Lead-oppfølging',
  titleWord: 'lunkne leads',
  subtitle: 'Vurderer fortsatt — fortjener en mild dytt før de blir kalde.',
  brandTag: 'Sanntid',
  fuLabel: 'Foreslått oppfølging',
  followup: 'Send en vennlig <b>påminnelse på e-post</b> i dag med en konkret referanse fra forrige opptak — best respons innen 48 timer.',
  leads: [
    { name: 'Kari Nordmann', initials: 'KN', source: 'Instagram', color: '#E1306C', meta: 'Lastet ned prislisten', action: 'Følg opp' },
    { name: 'Jonas Bråthen', initials: 'JB', source: 'Facebook',  color: '#1877F2', meta: 'Åpnet tilbudet 2 ganger', action: 'Send e-post' },
    { name: 'Linnéa Sørlie', initials: 'LS', source: 'LinkedIn',  color: '#0A66C2', meta: 'Spurte om bryllupspakke', action: 'Book møte' }
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-lunkne_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ld-lunkne_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
