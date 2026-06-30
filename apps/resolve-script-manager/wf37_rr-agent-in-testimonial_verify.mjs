import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-testimonial.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  live: 'Live innsikt',
  eyebrow: 'Agent-anbefaling',
  head: 'En kunde ga deg terningkast seks — <em>del omtalen</em>',
  insightLabel: 'Agentens innsikt',
  insightIcon: 'reviews',
  insightVal: 'En fersk <b>femstjerners omtale</b> ligger ubrukt i innboksen din. Sosialt bevis fra ekte kunder er det som overbeviser nye byråer — jeg gjør den om til et <b>delbart kort</b> for feeden.',
  qtext: '«The Role Room ga oss orden fra idé til ferdig film. Vi sparte uker og leverte vår beste kampanje noensinne.»',
  qname: 'Ingrid Lønnberg',
  qrole: 'Daglig leder · Nordlys Byrå',
  qav: 'IL',
  qverif: 'Verifisert kunde',
  recoIcon: 'send',
  tall: '5,0', tallLabel: 'snitt av 38 verifiserte kundeomtaler',
  cta: 'Utfør · Del omtalen',
  foot: 'Du godkjenner kortet før det publiseres — Agenten venter på ditt klikk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
const injected = '<script>window.__CFG__=' + JSON.stringify(CFG) + ';<\/script>\n' + html;
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-testimonial_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-testimonial_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
