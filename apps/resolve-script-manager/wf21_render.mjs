import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf21_ch-ui-upload.html','utf8');
const CFG = {
  accent: '#ffba6c',
  ink: '#fff5e8',
  logo: '',
  tekst: 'Dra og slipp opptak, eller bla gjennom mappene dine',
  filnavn: 'Råopptak_intervju_dag2_København.mov',
  cta_tekst: 'Start opplasting'
};

const inject = `<script>window.__CFG__=${JSON.stringify(CFG)};</script>`;
const htmlWithCfg = html.replace('</head>', inject + '</head>');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(htmlWithCfg, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const wrap = page.locator('#wrap');

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(250);
await wrap.screenshot({ path: '/tmp/wf21_ch-ui-upload_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(250);
await wrap.screenshot({ path: '/tmp/wf21_ch-ui-upload_mid.png', omitBackground: true });

await browser.close();
console.log('done');
