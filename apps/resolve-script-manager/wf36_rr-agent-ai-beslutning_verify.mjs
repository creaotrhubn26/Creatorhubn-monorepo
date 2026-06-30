import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-ai-beslutning.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · leads · innsikt',
  eyebrow: 'Neste beslutning',
  head: 'Hvordan vil du følge opp de varme leadene?',
  sub: 'Jeg har segmentert henvendelsene. Velg hvordan vi går videre — jeg utfører valget med én gang.',
  ctxLabel: 'Situasjonen nå', ctxIcon: 'insights',
  ctxVal: '14 varme leads · 6 lunkne · siste kampanje ga 3,2× ROAS',
  secLabel: 'Velg et alternativ',
  rec: 'Anbefalt',
  valg1: 'Send personlig SMS + e-post nå', meta1: 'Claude skriver én melding per lead — du godkjenner før utsending', ikon1: 'bolt',
  valg2: 'Planlegg oppfølging til i morgen kl. 09', meta2: 'Legg leadene i køen og varsle selgeren automatisk', ikon2: 'schedule_send',
  valg3: 'Diskutér strategien med meg først', meta3: 'Vi går gjennom segmentene sammen før noe sendes', ikon3: 'forum',
  foot: 'Du har full kontroll — ingenting sendes før du godkjenner valget.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-beslutning_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-beslutning_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
