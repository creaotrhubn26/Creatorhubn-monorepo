import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-konkurrent-pris.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  pulse: 'SANNTID',
  eyebrow: 'Agent-anbefaling',
  eyebrowIcon: 'price_change',
  head: 'Konkurrenten satte opp prisen — <em>du er nå billigst i markedet</em>',
  insightLabel: 'Agentens innsikt',
  insightIcon: 'storefront',
  insightVal: 'Jeg overvåket konkurrentens prisside og fanget en <b>økning på 18 %</b> i natt. Du ligger nå <b>300 kr lavere</b> — jeg foreslår et innlegg som fremhever prisfordelen mens den er fersk.',
  compRivalWho: 'Skogli Foto',
  compRivalPrice: '1 290 kr',
  compRivalDelta: '+18 % siste uke',
  compYouWho: 'Din pris',
  compYouPrice: '990 kr',
  compYouDelta: 'uendret',
  tall: '300 kr',
  tallLabel: 'lavere enn konkurrenten — prisfordel i din favør',
  cta: 'Utfør · Lag prisfordel-innlegg',
  foot: 'Du godkjenner før noe publiseres — Agenten venter på ditt klikk.'
};

const injected = html.replace(
  '<meta charset="UTF-8">',
  '<meta charset="UTF-8">\n<script>window.__CFG__ = ' + JSON.stringify(CFG) + ';</script>'
);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.load('400 24px "Material Icons Outlined"');
  await document.fonts.load('800 24px "Poppins"');
  await document.fonts.ready;
});
await page.waitForTimeout(1400);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-konkurrent-pris_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-konkurrent-pris_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
