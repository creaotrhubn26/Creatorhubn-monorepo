import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-podcast.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  eyebrow: 'Agent-anbefaling',
  head: 'Klipp et høydepunkt fra <em>podcasten til en Reel</em>',
  clipIcon: 'graphic_eq',
  clabel: 'Innsikt · klipp fra podcast',
  src: 'Podcast',
  dst: 'Reel',
  cdesc: 'Jeg fant et sterkt 38-sekunders øyeblikk om regi i episode 12. Det egner seg perfekt som en vertikal Reel med teksting på norsk.',
  tall: '4,2×',
  tallLabel: 'forventet rekkevidde mot et vanlig klipp',
  cta: 'Utfør · Lag Reel',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-podcast_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-podcast_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
