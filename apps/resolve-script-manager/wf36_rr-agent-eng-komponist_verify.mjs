import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf36_rr-agent-eng-komponist.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  navn: 'Mariann Eikrem', handle: '@marianneik', kanal: 'Instagram',
  melding: 'Elsker den nye serien deres på Instagram! Hvordan booker jeg dere til bryllupet vårt i august? 😍',
  svar: 'Så hyggelig, Mariann — og gratulerer så mye! Vi har faktisk to ledige helger i august. Jeg sender deg en DM med pakker og priser nå, så finner vi noe som passer dagen deres perfekt.',
  score: 96,
  aktivTone: 1,
  tone0: 'Profesjonell', tone1: 'Vennlig', tone2: 'Kort & konkret',
  genLbl: 'Agent-utkast', sendLbl: 'Send svar',
  footTxt: 'Du kan redigere utkastet før du sender — Agent lærer av hvordan du svarer.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-komponist_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-komponist_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
