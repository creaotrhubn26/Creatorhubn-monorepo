// Sosial-optimaliserte maler (vertikal/kvadrat) — designet for 9:16 / 4:5 / 1:1.
// Selvstendig config-HTML: leser window.__CFG__ = {...feltverdier, accent, ink,
// logo} og definerer window.setProgress(p) for animasjon. #wrap er sentrert og
// portrett-orientert så format-render fitter det pent inn i lerretet.

import type { InfographicTemplate } from './infographicStudio';

// Delt basis-CSS/JS-hjelpere (count-up + stagger via setProgress). Holdes inline
// per mal så hver HTML er 100 % selvstendig (render-motoren tar bare `html`).
const BASE = `
*{margin:0;box-sizing:border-box}
html,body{height:100%;background:transparent}
body{display:grid;place-items:center;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.card{position:relative;overflow:hidden;border-radius:40px}
.acc{color:var(--accent,#3b82f6)}
`;

const COUNT = `
function numParts(s){var m=String(s==null?'':s).match(/^(\\D*)(-?[\\d\\s.,]*\\d)(.*)$/);return m?{pre:m[1],num:m[2],suf:m[3]}:null;}
function countTo(el,val,p){var q=numParts(val);if(!q){el.textContent=val;return;}var raw=q.num.replace(/\\s/g,'').replace(',', '.');var f=parseFloat(raw);if(isNaN(f)){el.textContent=val;return;}var dec=(raw.split('.')[1]||'').length;var cur=(f*Math.min(1,p));el.textContent=q.pre+cur.toFixed(dec).replace('.', ',')+q.suf;}
function ease(p){return 1-Math.pow(1-Math.max(0,Math.min(1,p)),3);}
function stagger(els,p,span){for(var i=0;i<els.length;i++){var t0=i*span,lp=Math.max(0,Math.min(1,(p-t0)/(1-t0||1)));els[i].style.opacity=lp;els[i].style.transform='translateY('+((1-ease(lp))*24)+'px)';}}
`;

export const SOCIAL_TEMPLATES: InfographicTemplate[] = [
  {
    id: 'social-stat',
    name: 'Sosial · Stort tall',
    desc: 'Ett stort tall som teller opp + etikett + støttelinje, på et rent kort med accent-topp. Bygd for 9:16/1:1 story & feed.',
    style: 'hud', glyph: '◆', durationSec: 5,
    fields: [
      { key: 'kicker', label: 'Kicker', type: 'text', placeholder: 'RESULTATER 2026' },
      { key: 'value', label: 'Stort tall', type: 'text', placeholder: '+248%' },
      { key: 'label', label: 'Etikett', type: 'text', placeholder: 'Vekst i leads' },
      { key: 'support', label: 'Støttelinje', type: 'text', placeholder: 'på seks måneder med AI-drevet oppfølging' },
    ],
    defaults: { kicker: 'RESULTATER 2026', value: '+248%', label: 'Vekst i leads', support: 'på seks måneder med AI-drevet oppfølging' },
    html: `<!DOCTYPE html><html lang="no"><head><meta charset="utf-8"><style>${BASE}
#wrap{width:900px}
.card{background:linear-gradient(160deg,#141b2b,#0b1120);padding:96px 84px;border:1px solid #27314a;box-shadow:0 40px 120px rgba(0,0,0,.4)}
.bar{position:absolute;top:0;left:0;right:0;height:12px;background:var(--accent,#3b82f6)}
.k{font-size:30px;letter-spacing:4px;font-weight:800;color:var(--accent,#3b82f6);margin-bottom:28px}
.v{font-size:210px;line-height:.9;font-weight:900;color:#fff;letter-spacing:-4px}
.l{font-size:58px;font-weight:800;color:#e8eefc;margin-top:24px}
.s{font-size:32px;color:#8a98b5;margin-top:22px;line-height:1.4;max-width:660px}
.logo{position:absolute;bottom:40px;right:56px;max-width:150px;max-height:60px;opacity:.9}
</style></head><body><div id="wrap"><div class="card"><div class="bar"></div>
<div class="k" id="k"></div><div class="v" id="v">0</div><div class="l" id="l"></div><div class="s" id="s"></div>
<img class="logo" id="logo" style="display:none"></div></div>
<script>var CFG=window.__CFG__||{};${COUNT}
document.getElementById('k').textContent=CFG.kicker||'';
document.getElementById('l').textContent=CFG.label||'';
document.getElementById('s').textContent=CFG.support||'';
if(CFG.logo){var lo=document.getElementById('logo');lo.src=CFG.logo;lo.style.display='block';}
window.setProgress=function(p){var els=[document.getElementById('k'),document.getElementById('v'),document.getElementById('l'),document.getElementById('s')];stagger(els,p,0.12);countTo(document.getElementById('v'),CFG.value||'0',ease(Math.max(0,(p-0.12)/0.88)));};
window.setProgress(0);</script></body></html>`,
  },
  {
    id: 'social-quote',
    name: 'Sosial · Sitat',
    desc: 'Stort sitat med forfatter + rolle og valgfri logo. Elegant for testimonials i story/feed.',
    style: 'hud', glyph: '◆', durationSec: 5,
    fields: [
      { key: 'quote', label: 'Sitat', type: 'text', placeholder: 'Vi doblet møtebookingene på under en måned.' },
      { key: 'author', label: 'Navn', type: 'text', placeholder: 'Ola Nordmann' },
      { key: 'role', label: 'Rolle', type: 'text', placeholder: 'Salgssjef, Dentum' },
    ],
    defaults: { quote: 'Vi doblet møtebookingene på under en måned.', author: 'Ola Nordmann', role: 'Salgssjef, Dentum' },
    html: `<!DOCTYPE html><html lang="no"><head><meta charset="utf-8"><style>${BASE}
#wrap{width:900px}
.card{background:linear-gradient(160deg,#161d2e,#0b1120);padding:110px 84px 90px;border:1px solid #27314a}
.mark{font-size:220px;line-height:.6;font-weight:900;color:var(--accent,#3b82f6);height:120px}
.q{font-size:64px;line-height:1.25;font-weight:800;color:#fff;margin:10px 0 52px}
.row{display:flex;align-items:center;gap:24px}
.dot{width:12px;height:56px;border-radius:6px;background:var(--accent,#3b82f6)}
.a{font-size:38px;font-weight:800;color:#e8eefc}
.r{font-size:28px;color:#8a98b5;margin-top:4px}
.logo{position:absolute;top:60px;right:64px;max-width:150px;max-height:56px;opacity:.9}
</style></head><body><div id="wrap"><div class="card">
<div class="mark" id="m">&ldquo;</div><div class="q" id="q"></div>
<div class="row" id="row"><div class="dot"></div><div><div class="a" id="a"></div><div class="r" id="r"></div></div></div>
<img class="logo" id="logo" style="display:none"></div></div>
<script>var CFG=window.__CFG__||{};${COUNT}
document.getElementById('q').textContent=CFG.quote||'';
document.getElementById('a').textContent=CFG.author||'';
document.getElementById('r').textContent=CFG.role||'';
if(CFG.logo){var lo=document.getElementById('logo');lo.src=CFG.logo;lo.style.display='block';}
window.setProgress=function(p){stagger([document.getElementById('m'),document.getElementById('q'),document.getElementById('row')],p,0.16);};
window.setProgress(0);</script></body></html>`,
  },
  {
    id: 'social-tips',
    name: 'Sosial · 3 tips',
    desc: 'Nummererte tips-rader som staggrer inn under en tittel. Perfekt carousel/story-innhold.',
    style: 'hud', glyph: '◆', durationSec: 6,
    fields: [
      { key: 'title', label: 'Tittel', type: 'text', placeholder: '3 grep som fikser oppfølgingen' },
      { key: 't1', label: 'Tips 1', type: 'text', placeholder: 'Svar innen 5 minutter' },
      { key: 't2', label: 'Tips 2', type: 'text', placeholder: 'Bruk maler, ikke fritekst' },
      { key: 't3', label: 'Tips 3', type: 'text', placeholder: 'Følg opp minst tre ganger' },
    ],
    defaults: { title: '3 grep som fikser oppfølgingen', t1: 'Svar innen 5 minutter', t2: 'Bruk maler, ikke fritekst', t3: 'Følg opp minst tre ganger' },
    html: `<!DOCTYPE html><html lang="no"><head><meta charset="utf-8"><style>${BASE}
#wrap{width:900px}
.card{background:linear-gradient(160deg,#141b2b,#0b1120);padding:88px 76px;border:1px solid #27314a}
.t{font-size:62px;font-weight:900;color:#fff;line-height:1.15;margin-bottom:56px}
.tip{display:flex;align-items:center;gap:30px;margin-bottom:34px}
.n{flex:none;width:92px;height:92px;border-radius:24px;background:var(--accent,#3b82f6);color:#fff;font-size:46px;font-weight:900;display:grid;place-items:center}
.tx{font-size:44px;font-weight:700;color:#e8eefc;line-height:1.2}
.logo{position:absolute;bottom:40px;right:56px;max-width:140px;max-height:54px;opacity:.9}
</style></head><body><div id="wrap"><div class="card">
<div class="t" id="t"></div>
<div class="tip" id="r1"><div class="n">1</div><div class="tx" id="x1"></div></div>
<div class="tip" id="r2"><div class="n">2</div><div class="tx" id="x2"></div></div>
<div class="tip" id="r3"><div class="n">3</div><div class="tx" id="x3"></div></div>
<img class="logo" id="logo" style="display:none"></div></div>
<script>var CFG=window.__CFG__||{};${COUNT}
document.getElementById('t').textContent=CFG.title||'';
document.getElementById('x1').textContent=CFG.t1||'';
document.getElementById('x2').textContent=CFG.t2||'';
document.getElementById('x3').textContent=CFG.t3||'';
if(CFG.logo){var lo=document.getElementById('logo');lo.src=CFG.logo;lo.style.display='block';}
window.setProgress=function(p){stagger([document.getElementById('t'),document.getElementById('r1'),document.getElementById('r2'),document.getElementById('r3')],p,0.14);};
window.setProgress(0);</script></body></html>`,
  },
  {
    id: 'social-announce',
    name: 'Sosial · Kunngjøring/CTA',
    desc: 'Kicker + stor tittel + undertittel + CTA-pille. Bygd for lansering/tilbud i story & feed.',
    style: 'hud', glyph: '◆', durationSec: 5,
    fields: [
      { key: 'kicker', label: 'Kicker', type: 'text', placeholder: 'NYHET' },
      { key: 'title', label: 'Tittel', type: 'text', placeholder: 'AI-oppfølging for tannklinikker' },
      { key: 'subtitle', label: 'Undertittel', type: 'text', placeholder: 'Fang hver pasient — automatisk, døgnet rundt.' },
      { key: 'cta', label: 'CTA', type: 'text', placeholder: 'Book demo →' },
    ],
    defaults: { kicker: 'NYHET', title: 'AI-oppfølging for tannklinikker', subtitle: 'Fang hver pasient — automatisk, døgnet rundt.', cta: 'Book demo →' },
    html: `<!DOCTYPE html><html lang="no"><head><meta charset="utf-8"><style>${BASE}
#wrap{width:900px}
.card{background:linear-gradient(160deg,#141b2b,#0b1120);padding:104px 84px;border:1px solid #27314a}
.k{display:inline-block;font-size:26px;letter-spacing:4px;font-weight:800;color:var(--accent,#3b82f6);border:2px solid var(--accent,#3b82f6);border-radius:999px;padding:10px 24px;margin-bottom:44px}
.t{font-size:88px;line-height:1.06;font-weight:900;color:#fff;letter-spacing:-2px}
.s{font-size:38px;color:#8a98b5;margin-top:32px;line-height:1.4;max-width:700px}
.cta{display:inline-block;margin-top:60px;background:var(--accent,#3b82f6);color:#fff;font-size:40px;font-weight:800;padding:26px 54px;border-radius:20px}
.logo{position:absolute;top:56px;right:64px;max-width:150px;max-height:56px;opacity:.9}
</style></head><body><div id="wrap"><div class="card">
<div class="k" id="k"></div><div class="t" id="t"></div><div class="s" id="s"></div><div class="cta" id="c"></div>
<img class="logo" id="logo" style="display:none"></div></div>
<script>var CFG=window.__CFG__||{};${COUNT}
document.getElementById('k').textContent=CFG.kicker||'';
document.getElementById('t').textContent=CFG.title||'';
document.getElementById('s').textContent=CFG.subtitle||'';
document.getElementById('c').textContent=CFG.cta||'';
if(CFG.logo){var lo=document.getElementById('logo');lo.src=CFG.logo;lo.style.display='block';}
window.setProgress=function(p){stagger([document.getElementById('k'),document.getElementById('t'),document.getElementById('s'),document.getElementById('c')],p,0.13);};
window.setProgress(0);</script></body></html>`,
  },
];

export const SOCIAL_TEMPLATE_IDS = SOCIAL_TEMPLATES.map((t) => t.id);
