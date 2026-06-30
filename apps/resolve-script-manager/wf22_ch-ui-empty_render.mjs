import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const rawHtml = readFileSync('/tmp/wf22_ch-ui-empty.html','utf8');
const CFG = {
  accent:'#ffba6c',
  ink:'#fff5e8',
  logo:'',
  tittel:'Ingen prosjekter her ennå',
  tekst:'Når du oppretter ditt første prosjekt, samles opptak, klipp og leveranser her — klart for å dele med teamet ditt.',
  cta:'Opprett prosjekt'
};
const inject = '<script>window.__CFG__='+JSON.stringify(CFG)+';</'+'script>';
const html = rawHtml.replace('</head>', inject+'</head>');

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor:2 });
await page.setContent(html, { waitUntil:'networkidle' });
await page.waitForTimeout(1200);

const wrap = page.locator('#wrap');

await page.evaluate(()=>window.setProgress(1));
await page.waitForTimeout(250);
await wrap.screenshot({ path:'/tmp/wf22_ch-ui-empty_end.png', omitBackground:true });

await page.evaluate(()=>window.setProgress(0.5));
await page.waitForTimeout(250);
await wrap.screenshot({ path:'/tmp/wf22_ch-ui-empty_mid.png', omitBackground:true });

await page.evaluate(()=>window.setProgress(0));
await browser.close();
console.log('done');
