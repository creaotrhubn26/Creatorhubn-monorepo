import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-lead-magnet.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  magnetLabel: 'Lead-magnet for produksjonen',
  magnetName: '«Sett-til-premiere: 12 grep» (PDF)',
  magnetIcon: 'picture_as_pdf',
  gateLbl: 'Bytt mot<br>e-post',
  pill1: 'Lenke i bio',
  pill2: 'E-postfangst',
  insight: 'Innholdet ditt om <b>«Nattskift»</b> samler mange engasjerte følgere — men du fanger ingen e-postadresser. En nedlastbar guide bak en e-postfangst gjør anonyme følgere til kontaktbare leads du <b>eier selv</b>.',
  tall: '180',
  tallLabel: 'Estimerte nye e-postleads',
  metricIcon: 'groups',
  trendTxt: 'per måned',
  cta: 'Utfør',
  ctaIcon: 'bolt'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
const injected = html.replace('<script>', '<script>window.__CFG__=' + JSON.stringify(CFG) + ';');
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-lead-magnet_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-lead-magnet_mid.png', omitBackground: true });

await browser.close();
console.log('done');
