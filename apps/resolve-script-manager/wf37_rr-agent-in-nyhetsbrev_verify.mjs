import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-nyhetsbrev.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  head: 'Tema for neste nyhetsbrev',
  insight: 'Jeg har sett på hva abonnentene dine åpner mest. <b>Bak kulissene</b>-historier og <b>konkrete arbeidsmetoder</b> får dobbelt så mange klikk som tilbud. Neste utgave bør handle om hvordan dere planlegger en hel innholdssesong på forhånd.',
  newsFrom: 'Nyhetsbrev · utkast',
  newsEyebrow: 'Foreslått tema',
  newsTitle: '«Slik forberedte vi en hel sesong med innhold på én innspillingsdag»',
  newsReadmore: 'Les hele saken',
  tall: '+38 %', tallLabel: 'Estimert åpningsrate', statIcon: 'mark_email_read',
  cta: 'Utfør', skip: 'Senere'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-nyhetsbrev_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-nyhetsbrev_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
