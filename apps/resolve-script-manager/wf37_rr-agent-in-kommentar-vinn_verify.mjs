import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const html = readFileSync('/tmp/wf37_rr-agent-in-kommentar-vinn.html', 'utf8');
const CFG = {
  accent: '#a78bfa', ink: '#f5f3ff', logo: '',
  brandName: 'The Role Room Agent',
  brandTag: 'Markedsføring · social · innsikt',
  eyebrow: 'Agent-anbefaling',
  recoIcon: 'forum',
  head: 'Vinn kommentarfeltet — <em>svar raskt</em> for mer rekkevidde',
  threadTitle: 'Nye kommentarer',
  liveTxt: 'Sanntid',
  c1name: 'Marte Bø',
  c1txt: 'Elsker dette settet! Hvilket objektiv brukte dere?',
  c2name: 'Jonas Lie',
  c2txt: 'Kan dere lage en bak-kulissene-video til neste gang?',
  replyName: 'Agentens svarforslag',
  replyTag: 'klart å sende',
  replyTxt: '«Takk, Marte! 35 mm på det meste — bak-kulissene kommer i Stories i kveld.»',
  statIcon: 'bolt',
  statCap: 'Effekt av rask respons',
  insightIcon: 'lightbulb',
  insightLabel: 'Agentens innsikt',
  insightVal: 'Algoritmen belønner samtaler de første <b>60 minuttene</b>. Jeg har skrevet svar i din tone — godkjenn, så svarer jeg alle nye kommentarer fortløpende.',
  ctaIcon: 'send',
  tall: '+38%',
  tallLabel: '<b>mer rekkevidde</b> når du svarer innen 30 minutter',
  cta: 'Utfør · Svar alle nå',
  foot: 'Du godkjenner før noe sendes — Agenten venter på ditt klikk.'
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 });
await page.addInitScript((cfg) => { window.__CFG__ = cfg; }, CFG);
// Inject CFG inline too so the template is genuinely config-driven under setContent
// (placed after the font links, before <style>, so charset stays first)
const injected = html.replace('<style>',
  '<script>window.__CFG__=' + JSON.stringify(CFG) + ';<\/script>\n<style>');
await page.setContent(injected, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1100);

await page.evaluate(() => window.setProgress(1));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-kommentar-vinn_end.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0.5));
await page.waitForTimeout(180);
await page.locator('#wrap').screenshot({ path: '/tmp/wf37_rr-agent-in-kommentar-vinn_mid.png', omitBackground: true });

await page.evaluate(() => window.setProgress(0));
await browser.close();
console.log('done');
