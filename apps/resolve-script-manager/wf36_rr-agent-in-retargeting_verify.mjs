import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-retargeting.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Agent',
  eyebrow: 'Agent-anbefaling',
  insight: '214 besøkende engasjerte seg, men ingen ble fanget opp — <span class="grad">sett opp retargeting</span>',
  reason: 'Folk som så innholdet ditt forrige uke forsvant uten oppfølging. Jeg anbefaler en retargeting-kampanje mot dem som allerede kjenner deg — de konverterer langt billigere enn kalde publikum.',
  funnel: {
    sett: '3 980', settCap: 'Så innhold',
    engasjert: '214', engasjertCap: 'Engasjerte',
    tapt: '214', taptCap: 'Ikke fulgt opp'
  },
  tall: '214', tallSuffiks: 'stk',
  tallLabel: 'Varme kontakter klare for retargeting',
  statIkon: 'replay',
  trend: '62 % lavere kostnad',
  cta: 'Utfør',
  skip: 'Eller spør meg om publikumet først'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-retargeting_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-retargeting_mid.png', omitBackground: true });

await browser.close();
console.log('done');
