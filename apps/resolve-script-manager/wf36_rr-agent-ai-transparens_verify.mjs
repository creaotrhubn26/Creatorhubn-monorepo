import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-ai-transparens.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  merke: 'Innsyn i KI-laget',
  eyebrow: 'Åpenhet om databehandling',
  modell: 'Claude Opus 4.7',
  modellUnder: 'Anthropic · kjørt på Role Rooms infrastruktur',
  modellStatus: 'Aktiv',
  feltTittel: 'Datafelt delt med modellen',
  felter: [
    { ikon: 'tag', tekst: 'Innleggstekster' },
    { ikon: 'insights', tekst: 'Engasjementsdata' },
    { ikon: 'schedule', tekst: 'Publiseringstider' },
    { ikon: 'groups', tekst: 'Målgruppe (anonymisert)' }
  ],
  enhetTittel: 'Behandlede enheter',
  enheter: [
    { navn: 'Innlegg', antall: 248, enhet: 'analysert', ikon: 'image', farge: '#E1306C' },
    { navn: 'Leads', antall: 64, enhet: 'segmentert', ikon: 'person_search', farge: '#a855f7' },
    { navn: 'Kommentarer', antall: 1230, enhet: 'tolket', ikon: 'forum', farge: '#1877F2' }
  ],
  tillit: '<b>Ingen kundedata brukes til trening.</b> Alt behandles per økt og lagres kryptert.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-transparens_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-ai-transparens_mid.png', omitBackground: true });

await browser.close();
console.log('done');
