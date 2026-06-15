// infographicStudio — modell for Infographic Studio (Product Demo).
// Brukeren ser KUN enkle felter + et design-galleri. HTML/CSS ligger skjult her
// og er config-drevet: appen injiserer en JSON-config + en setProgress(p) som
// styrer animasjonen deterministisk (count-up, søyle-vekst, stagger). Samme HTML
// brukes til (a) live-preview (iframe srcdoc) og (b) alfa-capture → ProRes → Resolve.

export type InfographicStyle = 'light' | 'hud';

export interface InfographicField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'color';
  placeholder?: string;
}

export interface InfographicTemplate {
  id: string;
  name: string;
  desc: string;
  style: InfographicStyle;
  /** Forhåndsvisnings-glyph for galleriet (enkelt, ingen ekstra asset). */
  glyph: string;
  /** Enkle felter brukeren fyller (ingen HTML). */
  fields: InfographicField[];
  /** Standardverdier. */
  defaults: Record<string, string>;
  /** Default varighet på klippet i sekunder. */
  durationSec: number;
}

export const INFOGRAPHIC_TEMPLATES: InfographicTemplate[] = [
  {
    id: 'kpi-cards',
    name: 'KPI-kort (3 tall)',
    desc: 'Tre rene kort med ikon, stort tall som teller opp og etikett. Lys SaaS-stil.',
    style: 'light',
    glyph: '▦',
    durationSec: 5,
    fields: [
      { key: 'l1', label: 'Kort 1 – etikett', type: 'text', placeholder: 'Pasienter i dag' },
      { key: 'v1', label: 'Kort 1 – tall', type: 'text', placeholder: '124' },
      { key: 'l2', label: 'Kort 2 – etikett', type: 'text', placeholder: 'Digitale innsjekk' },
      { key: 'v2', label: 'Kort 2 – tall', type: 'text', placeholder: '76%' },
      { key: 'l3', label: 'Kort 3 – etikett', type: 'text', placeholder: 'Redusert ventetid' },
      { key: 'v3', label: 'Kort 3 – tall', type: 'text', placeholder: '-18%' },
    ],
    defaults: { l1: 'Pasienter i dag', v1: '124', l2: 'Digitale innsjekk', v2: '76%', l3: 'Redusert ventetid', v3: '-18%' },
  },
  {
    id: 'stat-bar',
    name: 'Live-analytics-bar (lower third)',
    desc: 'Horisontal bar med tittel + tre KPI-er med delta. Legg nederst i bildet.',
    style: 'light',
    glyph: '▭',
    durationSec: 6,
    fields: [
      { key: 'title', label: 'Tittel', type: 'text', placeholder: 'PreVisit AI' },
      { key: 'k1', label: 'KPI 1', type: 'text', placeholder: 'Utfylte skjema' },
      { key: 'kv1', label: 'KPI 1 – verdi', type: 'text', placeholder: '82%' },
      { key: 'k2', label: 'KPI 2', type: 'text', placeholder: 'Gj.sn. svartid' },
      { key: 'kv2', label: 'KPI 2 – verdi', type: 'text', placeholder: '2:14' },
      { key: 'k3', label: 'KPI 3', type: 'text', placeholder: 'Pasientforberedelse' },
      { key: 'kv3', label: 'KPI 3 – verdi', type: 'text', placeholder: '91%' },
    ],
    defaults: { title: 'PreVisit AI', k1: 'Utfylte skjema', kv1: '82%', k2: 'Gj.sn. svartid', kv2: '2:14', k3: 'Pasientforberedelse', kv3: '91%' },
  },
];

export interface InfographicBrand {
  accent: string;   // hex
  ink: string;      // hex (tekst)
  logo?: string;    // data-URL eller sti til logo (valgfritt)
}

/** Bygg config-JSON som HTML-malen leser (fra location.hash). */
export function buildInfographicConfig(
  tpl: InfographicTemplate,
  values: Record<string, string>,
  brand: InfographicBrand,
): Record<string, unknown> {
  const v = (k: string) => (values[k] ?? tpl.defaults[k] ?? '');
  if (tpl.id === 'kpi-cards') {
    return {
      layout: 'kpi-cards', accent: brand.accent, ink: brand.ink, logo: brand.logo,
      cards: [
        { icon: 'groups', label: v('l1'), value: v('v1') },
        { icon: 'task_alt', label: v('l2'), value: v('v2'), bars: [30, 38, 34, 48, 56, 50, 66, 72, 64, 80, 88, 100] },
        { icon: 'schedule', label: v('l3'), value: v('v3'), pill: 'vs. forrige måned' },
      ],
    };
  }
  // stat-bar
  return {
    layout: 'stat-bar', accent: brand.accent, ink: brand.ink, logo: brand.logo, title: v('title'),
    kpis: [
      { label: v('k1'), value: v('kv1') },
      { label: v('k2'), value: v('kv2') },
      { label: v('k3'), value: v('kv3') },
    ],
  };
}

/** Den config-drevne HTML-malen (skjult for brukeren). Leser cfg fra
 *  location.hash (#<base64 json>) og eksponerer window.setProgress(p). */
export const INFOGRAPHIC_HTML = String.raw`<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet">
<style>
 *{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif}
 html,body{background:transparent}
 #wrap{display:flex;gap:30px;align-items:center;padding:60px;width:max-content}
 .card{background:#fff;border-radius:24px;padding:28px 32px;min-width:380px;
   box-shadow:0 24px 60px rgba(20,40,80,.10),0 4px 14px rgba(20,40,80,.05);
   border:1px solid rgba(20,40,80,.05);opacity:0;transform:translateY(26px)}
 .top{display:flex;align-items:center;gap:16px}
 .ic{width:62px;height:62px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--soft)}
 .ic .material-icons-outlined{font-size:30px;color:var(--accent)}
 .lbl{color:#5b6b7d;font-size:20px;font-weight:500}
 .num{font-size:58px;font-weight:800;color:var(--ink);letter-spacing:-1px;line-height:1.05;margin-top:2px}
 .bars{display:flex;align-items:flex-end;gap:6px;height:58px;margin-top:12px}
 .bars i{flex:1;background:var(--soft2);border-radius:4px;height:0%}
 .bars i.hi{background:var(--accent)}
 .pill{display:inline-flex;align-items:center;gap:7px;background:var(--soft);color:var(--accent);
   font-weight:600;font-size:17px;padding:8px 15px;border-radius:30px;margin-top:14px;opacity:0}
 .pill .material-icons-outlined{font-size:17px}
 .chev{color:#c7d2e3;font-size:28px;flex:none;opacity:0}
 /* stat-bar */
 #bar{background:#fff;border-radius:26px;padding:26px 36px;display:flex;align-items:center;gap:38px;
   box-shadow:0 24px 60px rgba(20,40,80,.10);opacity:0;transform:translateY(24px)}
 #bar .ttl{font-size:34px;font-weight:800;color:var(--ink)}
 #bar .kpi{text-align:center}
 #bar .kpi .k{font-size:18px;color:#5b6b7d;font-weight:500;margin-bottom:4px}
 #bar .kpi .kv{font-size:42px;font-weight:800;color:var(--accent);letter-spacing:-.5px}
 #bar .sep{width:1px;height:64px;background:rgba(20,40,80,.08)}
 #bar .logo,.cardlogo{height:46px;width:auto;object-fit:contain;display:block}
 .cardlogo{position:absolute;top:22px;right:26px;height:30px;opacity:.9}
 .card{position:relative}
</style></head><body><div id="wrap"></div>
<script>
function ease(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}
function clamp(x){return Math.max(0,Math.min(1,x))}
function shade(hex,f){var n=parseInt(hex.replace('#',''),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  return 'rgba('+r+','+g+','+b+','+f+')';}
var CFG=window.__CFG__||{};
if(!window.__CFG__){try{CFG=JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));}catch(e){}}
var root=document.documentElement.style;
root.setProperty('--accent', CFG.accent||'#2f6df0');
root.setProperty('--ink', CFG.ink||'#1f2d4a');
root.setProperty('--soft', shade(CFG.accent||'#2f6df0',.12));
root.setProperty('--soft2', shade(CFG.accent||'#2f6df0',.28));
var wrap=document.getElementById('wrap');
function el(t,c,h){var e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;}
function isNum(s){return /^[-+]?\d/.test(String(s||''));}
function buildCards(){
 (CFG.cards||[]).forEach(function(c,idx){
  if(idx>0){var ch=el('span','material-icons-outlined chev','chevron_right');ch.dataset.d=0.08*idx;wrap.appendChild(ch);}
  var card=el('div','card');card.dataset.d=0.12*idx;
  var top=el('div','top');
  top.appendChild(el('div','ic','<span class="material-icons-outlined">'+(c.icon||'insights')+'</span>'));
  var col=el('div');col.appendChild(el('div','lbl',c.label||''));
  var num=el('div','num','0');num.dataset.to=c.value;col.appendChild(num);
  top.appendChild(col);card.appendChild(top);
  if(c.bars){var b=el('div','bars');b.dataset.bars=c.bars.join(',');
    c.bars.forEach(function(_,i){b.appendChild(el('i',i===c.bars.length-1?'hi':''));});card.appendChild(b);}
  if(c.pill){var p=el('div','pill','<span class="material-icons-outlined">south</span> '+c.pill);p.dataset.d=0.12*idx+0.25;card.appendChild(p);}
  if(idx===0&&CFG.logo){var cl=el('img','cardlogo');cl.src=CFG.logo;card.appendChild(cl);}
  wrap.appendChild(card);
 });
}
function buildBar(){
 var bar=el('div');bar.id='bar';bar.dataset.d=0;
 if(CFG.logo){var lg=el('img','logo');lg.src=CFG.logo;bar.appendChild(lg);}
 bar.appendChild(el('div','ttl',CFG.title||''));
 (CFG.kpis||[]).forEach(function(k,i){
   bar.appendChild(el('div','sep'));
   var kp=el('div','kpi');kp.dataset.d=0.12+0.1*i;
   kp.appendChild(el('div','k',k.label||''));
   var kv=el('div','kv','0');kv.dataset.tv=k.value;kp.appendChild(kv);
   bar.appendChild(kp);
 });
 wrap.appendChild(bar);
}
if(CFG.layout==='stat-bar')buildBar();else buildCards();
function animNum(elm,target,t){
  var s=String(target||'');if(!isNum(s)){elm.textContent=s;return;}
  var m=s.match(/^([-+]?)(\d+(?:[.,]\d+)?)(.*)$/);if(!m){elm.textContent=s;return;}
  var sign=m[1],n=parseFloat(m[2].replace(',','.')),suf=m[3];
  var dec=(m[2].split(/[.,]/)[1]||'').length;
  elm.textContent=sign+(n*t).toFixed(dec)+suf;
}
window.setProgress=function(p){
 document.querySelectorAll('[data-d]').forEach(function(e){
   var d=parseFloat(e.dataset.d||0),t=ease(clamp((p-d)/0.45));e.style.opacity=t;
   if(e.classList.contains('card')||e.id==='bar')e.style.transform='translateY('+(26*(1-t))+'px)';
 });
 document.querySelectorAll('.num[data-to]').forEach(function(e){animNum(e,e.dataset.to,ease(clamp((p-0.15)/0.6)));});
 document.querySelectorAll('.kv[data-tv]').forEach(function(e){animNum(e,e.dataset.tv,ease(clamp((p-0.2)/0.6)));});
 document.querySelectorAll('.bars[data-bars]').forEach(function(b){
   var vals=b.dataset.bars.split(',').map(Number),t=ease(clamp((p-0.2)/0.6));
   b.querySelectorAll('i').forEach(function(bar,i){bar.style.height=(vals[i]*t)+'%';});
 });
};
window.setProgress(0);
</script></body></html>`;
