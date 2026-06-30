import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-nur-1.html', 'utf8');

const CFG = {
  studio: 'Nordlys Studio',
  seqLabel: 'Trinn 1',
  eyebrow: 'Nurture-sekvens · velkomst',
  title: 'Velkomst-SMS sendt automatisk',
  sub: 'Agenten starter oppfølgingen i det leadet kommer inn',
  leadName: 'Kari Nordmann',
  phone: '+47 912 34 567',
  message: 'Hei Kari! Tusen takk for at du tok kontakt om bryllupsfilming. Jeg er Agenten til Nordlys Studio og følger deg opp. Du hører fra oss innen kort tid — her er en smakebit: nordlys.no/bryllup',
  deliveredLabel: 'Levert',
  timestamp: 'nå · 02 sek',
  steps: [
    { icon: 'sms', t: 'Velkomst-SMS', d: 'Nå · sendt' },
    { icon: 'mail_outline', t: 'Intro-e-post', d: 'Om 1 time' },
    { icon: 'photo_library', t: 'Referansegalleri', d: 'Dag 2' },
    { icon: 'event_available', t: 'Tilbud om prat', d: 'Dag 4' }
  ],
  tokens: ['Fornavn', 'Bryllupsfilming', 'Studio-signatur'],
  stats: [
    { lab: 'Responstid', val: 2, unit: 'sek', pct: 92 },
    { lab: 'Leveringsrate', val: 99, unit: '%', pct: 99 },
    { lab: 'Trinn i løp', val: 4, unit: '', pct: 25 }
  ],
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-nur-1_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-nur-1_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
