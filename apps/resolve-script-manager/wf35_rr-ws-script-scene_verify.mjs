import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf35_rr-ws-script-scene.html', 'utf8');

const CFG = {
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: '',
  nr: '14',
  intext: 'INT',
  lokasjon: 'Bestemors kjøkken, Røros',
  tid: 'NATT',
  synopsis: 'Astrid kommer hjem til et mørklagt hus og finner brevet på kjøkkenbordet. Hun nøler før hun åpner det – kameraet holder på hendene hennes mens regnet trommer mot vinduet.',
  medvirkende: 'Astrid Berg, Jonas Lie, Øystein Våge, Statist · nabo'
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(
  '<div style="background:linear-gradient(135deg,#2b2b33,#141418 60%,#0c0c10);min-height:100vh">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1200);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf35_rr-ws-script-scene_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf35_rr-ws-script-scene_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
