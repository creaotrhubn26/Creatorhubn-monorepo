import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-boost.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Agent',
  eyebrow: 'Agent-anbefaling',
  insight: 'Ett innlegg presterer langt over snittet — <span class="grad">boost det nå</span>',
  reason: 'Reelen «Bak kulissene på settet» har 3× høyere engasjement enn de siste 30 innleggene dine. Jeg anbefaler å løfte den til et bredere publikum mens den er varm.',
  tall: '3', tallSuffiks: '×',
  tallLabel: 'Høyere engasjement enn snittet',
  statIkon: 'trending_up',
  trend: 'Stigende',
  cta: 'Utfør',
  skip: 'Eller spør meg om detaljene'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-boost_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-boost_mid.png', omitBackground: true });

await browser.close();
console.log('done');
