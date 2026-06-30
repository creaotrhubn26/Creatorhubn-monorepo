import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-nur-sekvens.html', 'utf8');

const CFG = {
  brandkicker: 'Agent',
  seclabel: 'Nurture-sekvens',
  heading: '5-trinns <span class="hl">oppfølgingsløp</span>',
  subline: 'Automatisk varming fra ny lead til signert avtale',
  leadname: 'Kari Nordbø',
  leadsub: 'Fjordby Tannklinikk · Ålesund',
  leadtag: 'Lunken lead',
  steps: [
    { title: 'Velkomst-DM',   chan: 'instagram', desc: 'Personlig hilsen + lenke til 90-sekunders intro',        when: 'Dag 0',  stat: 'done' },
    { title: 'Verdimail',     chan: 'mail',      desc: 'Tre konkrete grep klinikken kan ta allerede denne uken',  when: 'Dag 2',  stat: 'done' },
    { title: 'Case study',    chan: 'mail',      desc: '«3,2× flere påmeldinger» fra en lik klinikk i samme by',  when: 'Dag 5',  stat: 'now'  },
    { title: 'Sosialt bevis', chan: 'linkedin',  desc: 'Kundeomtale + invitasjon til 15-min gjennomgang',         when: 'Dag 9',  stat: 'wait' },
    { title: 'Tilbud + CTA',  chan: 'sms',       desc: 'Skreddersydd pakke med tidsbegrenset oppstartsrabatt',    when: 'Dag 14', stat: 'wait' }
  ],
  f1val: 2, f1suf: '/5', f1lbl: 'Sendt',
  f2val: 86, f2suf: '%', f2lbl: 'Åpnet',
  f3val: 14, f3suf: ' dgr', f3lbl: 'Til signert',
  aitip: 'Agenten justerer tempoet etter engasjement — trinn 4 utløses først når case-studien er åpnet.',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(160);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-nur-sekvens_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(160);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-nur-sekvens_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
