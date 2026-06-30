import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-adv-malgruppe.html', 'utf8');

const CFG = {
  eyebrow: 'Annonse-målgruppe',
  title: 'Hvem annonsen treffer',
  subtitle: 'Agenten har bygget en målgruppe på <b>Aktive filmskapere & byråer</b>',
  reach: '34 200',
  reachLbl: 'Anslått rekkevidde',
  reachSub: 'personer per uke i valgt område',
  ages: [
    { lbl: '18–24', pct: 18 },
    { lbl: '25–34', pct: 41 },
    { lbl: '35–44', pct: 26 },
    { lbl: '45–54', pct: 11 },
    { lbl: '55+', pct: 4 }
  ],
  femalePct: 57,
  locations: [
    { name: 'Oslo', pct: 44 },
    { name: 'Bergen', pct: 21 },
    { name: 'Trondheim', pct: 14 },
    { name: 'Stavanger', pct: 9 }
  ],
  interests: [
    { t: 'Film & video', hot: true },
    { t: 'DaVinci Resolve', hot: false },
    { t: 'Innholdsskaping', hot: true },
    { t: 'Fotografi', hot: false },
    { t: 'Småbedrift', hot: false }
  ],
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-malgruppe_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-adv-malgruppe_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
