import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-eng-dm.html', 'utf8');

const CFG = {
  dmName: 'Mariann Eikrem',
  dmHandle: '@mariann.eikrem',
  platName: 'Instagram',
  dmMsg1: 'Hei! Elsker den nye serien deres på Instagram. Hvordan booker jeg dere til et bryllup i august?',
  dmMsg2: 'Vi er to som gifter oss i Bergen — finnes det en pakke for hele dagen?',
  dmTime1: '14:32',
  dmTime2: '14:33',
  sgTag: 'Varm henvendelse · booking',
  sgConf: '96',
  sgText: 'Så hyggelig, Mariann — og gratulerer så mye! Ja, vi har en heldagspakke for bryllup i Bergen med både film og foto. Jeg sender deg gjerne et forslag med ledige datoer i august. Hva er datoen deres?',
  sgTone: 'vennlig & profesjonell',
  accent: '#a78bfa',
  ink: '#f5f3ff',
  logo: ''
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
html = html.replace('<script>\n(function () {', inject + '\n<script>\n(function () {');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

await page.setContent(
  '<div style="background:linear-gradient(120deg,#0a0612,#1a0f2e 55%,#241038);min-height:100vh;padding:40px">' + html + '</div>',
  { waitUntil: 'networkidle' }
);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-dm_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-eng-dm_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
