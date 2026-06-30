import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf32_rr-agent-mp-validering.html', 'utf8');

const CFG = {
  platform: 'instagram',
  title: 'Klar for publisering?',
  subtitle: 'Agent kontrollerte utkastet «Bak kulissene på settet» mot reglene for <b>Instagram</b>',
  c1: 'Tegngrense', c1d: 'Bildetekst innenfor maksgrense', c1v: '187 / 2200', c1ok: true,
  c2: 'Hashtags', c2d: 'Antall og relevans godkjent', c2v: '12 / 30', c2ok: true,
  c3: 'Bildeformat', c3d: 'Oppløsning og sideforhold ok', c3v: '1080×1350', c3ok: true,
  c4: 'Alt-tekst', c4d: 'Mangler beskrivelse for skjermlesere', c4v: 'Mangler', c4ok: false,
  c5: 'Lenker & omtaler', c5d: 'Ingen lenke i bildetekst – flytt til bio', c5v: 'OK', c5ok: true,
  verdict: '',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
await page.setContent(
  '<div style="background:linear-gradient(120deg,#1c1c22,#2a2230 55%,#0e0e16);min-height:100vh;padding:40px">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-mp-validering_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf32_rr-agent-mp-validering_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
