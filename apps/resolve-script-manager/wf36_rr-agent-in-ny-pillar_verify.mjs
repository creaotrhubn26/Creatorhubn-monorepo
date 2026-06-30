import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-in-ny-pillar.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Agent-anbefaling',
  head: 'En content-pillar mangler i planen din',
  insight: 'Jeg har gått gjennom de siste 30 innleggene dine. Du dekker <b>bak kulissene</b>, <b>kundehistorier</b> og <b>tips</b> godt — men <b>«Læring»</b>-temaet er helt fraværende. Følgerne dine engasjerer seg aller mest i nettopp lærende innhold.',
  pl1: 'Bak kulissene', pl2: 'Kundehistorier', pl3: 'Tips & triks', pl4: 'Læring', pl5: 'Kampanje',
  tall: '+34 %', tallLabel: 'Estimert økning i rekkevidde', statIcon: 'trending_up',
  cta: 'Utfør forslag', skip: 'Senere'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-ny-pillar_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-in-ny-pillar_mid.png', omitBackground: true });

await browser.close();
console.log('done');
