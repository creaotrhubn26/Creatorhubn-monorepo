import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-hashtag.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  head: 'Nye <em>emneknagger</em> å ta i bruk denne uka',
  tags: [
    { tag: 'bakomfilm', p: 'instagram', isNew: true },
    { tag: 'norskproduksjon', p: 'tiktok', isNew: true },
    { tag: 'settetdagbok', p: 'instagram' },
    { tag: 'produksjonsliv', p: 'linkedin', isNew: true }
  ],
  insightLabel: 'Hvorfor disse',
  insightIcon: 'tips_and_updates',
  insightVal: 'Disse emneknaggene <b>vokser raskt i din nisje</b>, men er fortsatt lite brukt av konkurrentene dine — du rekker å bli synlig først',
  recoIcon: 'tag',
  tall: '+38 %', tallLabel: 'estimert ekstra rekkevidde',
  cta: 'Utfør · Legg til i neste innlegg',
  foot: 'Du godkjenner før noe publiseres — Agenten venter på ditt klikk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-hashtag_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-hashtag_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
