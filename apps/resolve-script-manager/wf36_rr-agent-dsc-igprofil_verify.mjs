import { chromium } from 'playwright';
import { readFileSync } from 'fs';

let html = readFileSync('/tmp/wf36_rr-agent-dsc-igprofil.html', 'utf8');

const CFG = {
  name: 'Bjørk Studio',
  handle: '@bjork.studio',
  verified: true,
  scanTag: 'Profil-skann · Instagram',
  followers: 14200,
  posts: 348,
  following: 612,
  engagement: 6.4,
  bio1: 'Bryllups- & portrettfotograf i Bergen',
  bio2: 'Naturlig lys · ærlige øyeblikk · DM for booking',
  bio3: 'bjorkstudio.no/ledige-datoer',
  posts3: [
    { type:'collections', likes:1820, comments:64,  cap:'Bryllup i Fana — sommerlys',  c1:'#3a1d4f', c2:'#6d2f8a' },
    { type:'slideshow',   likes:2410, comments:112, cap:'Bak kamera: høstsesongen',    c1:'#5a1f3a', c2:'#a8336b' },
    { type:'image',       likes:1340, comments:38,  cap:'Portrett · gyllen time',      c1:'#2c1b4d', c2:'#4f3b8a' }
  ],
  fresh: 'Oppdatert nå',
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
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-dsc-igprofil_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(150);
await page.locator('#wrap').screenshot({ path: '/tmp/wf36_rr-agent-dsc-igprofil_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));

await browser.close();
console.log('done');
