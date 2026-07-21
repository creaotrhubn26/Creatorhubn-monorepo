/**
 * motionReveal.ts — generell «reveal-koreografi»: hver mal-form deklarerer HVA
 * som avsløres, NÅR og HVORDAN. Én seekbar tolk kjører spec-en.
 *
 * Dette er svaret på «hvorfor er ikke Motion hovedløsningen for alle maler?»:
 * i stedet for én hardkodet sting projiserer vi ulike innholds-former til ulike
 * reveal-koreografier. Fortsatt deterministisk (still = siste bilde) og
 * frame-capture-bar via window.__motionSeek(t) — samme mønster som sting.
 *
 * Ingen deps. Tekst HTML-escapes. TS-tilstand (motionStateAt) speiler HTML-tolkens
 * matte nøyaktig, så preview == det render-pipelinen fanger.
 */

import type { StingFormat } from './motionSting.js';

export type RevealKind = 'fade' | 'slideUp' | 'pop' | 'countUp' | 'barGrow' | 'wipe';

export interface RevealOp {
  /** Data-r-attributt på elementet (unikt), f.eks. «hero». */
  ref: string;
  kind: RevealKind;
  at: number;
  dur: number;
}

export interface MotionLayout {
  /** Ferdig HTML for stage-innholdet (elementer bærer data-r/data-count/data-w). */
  bodyHtml: string;
  reveals: RevealOp[];
  total: number;
}

const FADE = 260;
const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);

export interface RevealState { opacity: number; p: number }

/** Deterministisk tilstand per reveal-op ved tid t. Ren; speiles i HTML-tolken. */
export function motionStateAt(reveals: RevealOp[], t: number): Record<string, RevealState> {
  const out: Record<string, RevealState> = {};
  for (const op of reveals) {
    out[op.ref] = {
      opacity: clamp01((t - op.at) / FADE),
      p: easeOutCubic(clamp01((t - op.at) / op.dur)),
    };
  }
  return out;
}

export function layoutTotal(reveals: RevealOp[], tail = 700): number {
  const end = reveals.reduce((mx, r) => Math.max(mx, r.at + r.dur), 0);
  return end + tail;
}

/* ------------------------------------------------------------------ */
/* Delte hjelpere                                                      */
/* ------------------------------------------------------------------ */

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const fmt = (n: number): string => new Intl.NumberFormat('nb-NO').format(Math.round(n));

/** Tall-parsing gjenbrukt fra sting (space=tusenskille, komma=desimal). */
export function num(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  const m = String(raw).replace(/ /g, ' ').match(/-?\d[\d\s.,]*\d|-?\d/);
  if (!m) return null;
  let t = m[0].replace(/\s/g, '');
  if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.');
  else t = t.replace(/,/g, '');
  const v = parseFloat(t);
  return isFinite(v) ? v : null;
}
function affix(raw: string): { prefix?: string; suffix?: string } {
  const s = String(raw).replace(/ /g, ' ').trim();
  const m = s.match(/-?\d[\d\s.,]*\d|-?\d/);
  if (!m) return {};
  const after = s.slice((m.index ?? 0) + m[0].length).trim();
  const before = s.slice(0, m.index).trim();
  if (after) return { suffix: after.slice(0, 6) };
  if (before && /[^\d\s]/.test(before)) return { prefix: before.slice(0, 3) };
  return {};
}
function humanize(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key;
}

/* ================================================================== */
/* Arketype 1 — STAT-CALLOUT: én stor tall som popper + teller, m/ delta */
/* ================================================================== */

export interface StatData { label: string; value: number; prefix?: string; suffix?: string; delta?: string; sub?: string }

export function statLayout(d: StatData): MotionLayout {
  const pre = esc(d.prefix || '');
  const suf = d.suffix ? ' ' + esc(d.suffix) : '';
  const reveals: RevealOp[] = [
    { ref: 'label', kind: 'fade', at: 120, dur: 300 },
    { ref: 'num', kind: 'countUp', at: 380, dur: 1200 },
  ];
  let body =
    `<div class="st-label" data-r="label">${esc(d.label)}</div>` +
    `<div class="st-num"><span data-r="num" data-count="${d.value}" data-pre="${pre}" data-suf="${suf}">${pre}0${suf}</span></div>`;
  if (d.delta) { body += `<div class="st-delta" data-r="delta">${esc(d.delta)}</div>`; reveals.push({ ref: 'delta', kind: 'pop', at: 1420, dur: 360 }); }
  if (d.sub) { body += `<div class="st-sub" data-r="sub">${esc(d.sub)}</div>`; reveals.push({ ref: 'sub', kind: 'slideUp', at: 1720, dur: 420 }); }
  return { bodyHtml: `<div class="arc arc-stat">${body}</div>`, reveals, total: layoutTotal(reveals) };
}

/* ================================================================== */
/* Arketype 2 — QUOTE: sitat wiper inn, sitattegn fader, kilde slider   */
/* ================================================================== */

export interface QuoteData { quote: string; author?: string; role?: string }

export function quoteLayout(d: QuoteData): MotionLayout {
  const reveals: RevealOp[] = [
    { ref: 'mark', kind: 'fade', at: 120, dur: 360 },
    { ref: 'quote', kind: 'wipe', at: 320, dur: 1000 },
  ];
  let body =
    `<div class="q-mark" data-r="mark">&ldquo;</div>` +
    `<div class="q-text" data-r="quote">${esc(d.quote)}</div>`;
  if (d.author) {
    const who = d.role ? `${esc(d.author)} <span class="q-role">· ${esc(d.role)}</span>` : esc(d.author);
    body += `<div class="q-author" data-r="author">${who}</div>`;
    reveals.push({ ref: 'author', kind: 'slideUp', at: 1420, dur: 440 });
  }
  return { bodyHtml: `<div class="arc arc-quote">${body}</div>`, reveals, total: layoutTotal(reveals) };
}

/* ================================================================== */
/* Arketype 3 — COMPARE: barer «racer» samtidig, vinneren fremheves     */
/* ================================================================== */

export interface CompareItem { label: string; value: number; display?: string }
export interface CompareData { title?: string; items: CompareItem[] }

export function compareLayout(d: CompareData): MotionLayout {
  const items = d.items.slice(0, 4);
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  const winIdx = items.reduce((best, it, i) => (Math.abs(it.value) > Math.abs(items[best].value) ? i : best), 0);
  const reveals: RevealOp[] = [];
  if (d.title) reveals.push({ ref: 'title', kind: 'fade', at: 120, dur: 300 });
  let rows = '';
  items.forEach((it, i) => {
    const w = Math.round(Math.max(12, (Math.abs(it.value) / max) * 100));
    const disp = it.display || fmt(it.value);
    rows +=
      `<div class="cmp-row${i === winIdx ? ' cmp-win' : ''}">` +
      `<span class="cmp-lab">${esc(it.label)}</span>` +
      `<span class="cmp-track"><span class="cmp-bar" data-r="bar${i}" data-w="${w}"></span></span>` +
      `<span class="cmp-val" data-r="val${i}" data-count="${it.value}" data-disp="${esc(disp)}">0</span></div>`;
    // alle barer starter samtidig (racet)
    reveals.push({ ref: `bar${i}`, kind: 'barGrow', at: 380, dur: 1050 });
    reveals.push({ ref: `val${i}`, kind: 'countUp', at: 380, dur: 1050 });
  });
  reveals.push({ ref: 'winner', kind: 'pop', at: 1520, dur: 380 });
  const body =
    (d.title ? `<div class="cmp-title" data-r="title">${esc(d.title)}</div>` : '') +
    `<div class="cmp-rows">${rows}</div>` +
    `<div class="cmp-winner" data-r="winner">▲ ${esc(items[winIdx]?.label || '')} vinner</div>`;
  return { bodyHtml: `<div class="arc arc-compare">${body}</div>`, reveals, total: layoutTotal(reveals) };
}

/* ================================================================== */
/* Adaptere: scene-verdier → arketype-data                              */
/* ================================================================== */

interface Field { key: string; label: string; raw: string; value: number | null; len: number }
function fields(values: Record<string, string>, order?: string[]): Field[] {
  const keys = order && order.length ? order.filter((k) => k in values) : Object.keys(values);
  return keys
    .filter((k) => values[k] != null && String(values[k]).trim() !== '')
    .map((k) => ({ key: k, label: humanize(k), raw: String(values[k]).trim(), value: num(values[k]), len: String(values[k]).trim().length }));
}

export function statFrom(values: Record<string, string>, order?: string[]): StatData {
  const fs = fields(values, order);
  const nums = fs.filter((f) => f.value != null);
  const hero = nums.slice().sort((a, b) => Math.abs(b.value!) - Math.abs(a.value!))[0];
  // Delta = et annet endrings-felt: starter med +/-/▲/▼ eller inneholder %/pp/x.
  const delta = nums.find((f) => f !== hero && /^[+\-▲▼]|%|pp\b|x\b/i.test(f.raw))?.raw;
  const sub = fs.find((f) => f.value == null && f.len <= 60)?.raw;
  const af = hero ? affix(hero.raw) : {};
  return { label: hero?.label || 'Resultat', value: hero?.value ?? 0, prefix: af.prefix, suffix: af.suffix, delta, sub };
}

export function quoteFrom(values: Record<string, string>, order?: string[]): QuoteData {
  const fs = fields(values, order).filter((f) => f.value == null);
  const quote = fs.slice().sort((a, b) => b.len - a.len)[0]?.raw || '';
  const rest = fs.filter((f) => f.raw !== quote);
  const author = rest.sort((a, b) => a.len - b.len)[0]?.raw;
  const role = rest.filter((f) => f.raw !== author).sort((a, b) => a.len - b.len)[0]?.raw;
  return { quote, author, role };
}

export function compareFrom(values: Record<string, string>, order?: string[]): CompareData {
  const fs = fields(values, order);
  const items = fs.filter((f) => f.value != null).slice(0, 4).map((f) => ({ label: f.label, value: f.value!, display: f.raw.length <= 8 ? f.raw : fmt(f.value!) }));
  const title = fs.find((f) => f.value == null && f.len <= 48)?.raw;
  return { title, items };
}

/* ================================================================== */
/* Arketype-velger — HVILKEN koreografi passer innholdet?               */
/* ================================================================== */

export type Archetype = 'sting' | 'stat' | 'quote' | 'compare';

/**
 * Velg arketype fra mal-id + data-form. Heuristikk; dialogen lar bruker overstyre.
 *  - quote/testimonial-mal ELLER (langt tekstfelt + kort forfatter, få tall) → quote
 *  - ≥2 tall av lik størrelsesorden → compare
 *  - nøyaktig 1 dominant tall (+ ev. %-delta) → stat
 *  - ellers (funnel-aktig: hero + flere avtagende tall) → sting
 */
export function pickArchetype(templateId: string, values: Record<string, string>): Archetype {
  const id = (templateId || '').toLowerCase();
  const fs = fields(values);
  const nums = fs.filter((f) => f.value != null);
  const longText = fs.some((f) => f.value == null && f.len >= 40);

  if (/quote|testimonial|sitat|review|omtale/.test(id)) return 'quote';
  if (longText && nums.length <= 1) return 'quote';
  if (nums.length === 1) return 'stat';
  if (nums.length >= 2) {
    const mags = nums.map((f) => Math.abs(f.value!)).sort((a, b) => b - a);
    const ratio = mags[0] / Math.max(1, mags[mags.length - 1]);
    // lik størrelsesorden → sammenligning; stort sprang → funnel/sting
    return ratio <= 6 ? 'compare' : 'sting';
  }
  return 'sting';
}

/* ================================================================== */
/* HTML-bygger — delt shell + seekbar tolk for ALLE arketyper           */
/* ================================================================== */

function aspectFor(f: StingFormat): string {
  return f === '9:16' ? '9 / 16' : f === '1:1' ? '1 / 1' : '16 / 9';
}
const GOLD = '#f5c451';

export function buildMotionHtml(
  layout: MotionLayout,
  opts: { accent?: string; format?: StingFormat; autoplay?: boolean } = {},
): string {
  const accent = opts.accent && /^#[0-9a-fA-F]{3,8}$/.test(opts.accent) ? opts.accent : '#8b5cf6';
  const format = opts.format || '16:9';
  const autoplay = opts.autoplay !== false;

  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:transparent;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif;display:grid;place-items:center;overflow:hidden}
#stage{aspect-ratio:${aspectFor(format)};width:100%;max-width:100%;max-height:100%;position:relative;border-radius:14px;overflow:hidden;color:#efecf9;
  background:radial-gradient(120% 90% at 82% -10%, ${accent}33, transparent 55%), radial-gradient(90% 80% at -10% 110%, ${accent}22, transparent 55%), #0c0a16;
  display:flex;flex-direction:column;justify-content:center;padding:6.5% 7%}
[data-r]{opacity:0}
.arc{display:flex;flex-direction:column;max-width:100%;min-width:0}
[data-r],.arc>*{max-width:100%}
.st-label,.st-sub,.q-text,.q-author,.cmp-title,.cmp-lab,.cmp-val{overflow:hidden;text-overflow:ellipsis}
/* stat */
.arc-stat{gap:2%}
.st-label{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(9px,2.3vw,13px);letter-spacing:.2em;text-transform:uppercase;color:#a49dc2;white-space:nowrap}
.st-num{font-size:clamp(40px,13vw,104px);font-weight:800;letter-spacing:-.04em;line-height:.92;font-variant-numeric:tabular-nums;color:${GOLD};text-shadow:0 0 46px ${GOLD}44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st-delta{align-self:flex-start;font-size:clamp(12px,2.6vw,17px);font-weight:700;color:#34d399;background:rgba(52,211,153,.14);border:1px solid rgba(52,211,153,.4);padding:.25em .7em;border-radius:999px;margin-top:1%}
.st-sub{font-size:clamp(12px,2.6vw,17px);color:#c9c3dd;margin-top:1.5%;max-width:22ch}
/* quote */
.arc-quote{gap:2.5%}
.q-mark{font-size:clamp(48px,12vw,110px);line-height:.6;font-weight:800;color:${accent}}
.q-text{font-size:clamp(17px,4vw,34px);font-weight:600;line-height:1.32;letter-spacing:-.01em;max-width:22ch;clip-path:inset(0 100% 0 0)}
.q-author{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(10px,2.3vw,14px);letter-spacing:.12em;text-transform:uppercase;color:#a49dc2}
.q-author .q-role{color:#726c92}
/* compare */
.arc-compare{gap:3%}
.cmp-title{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(9px,2.3vw,13px);letter-spacing:.2em;text-transform:uppercase;color:#a49dc2}
.cmp-rows{display:flex;flex-direction:column;gap:3%}
.cmp-row{display:flex;align-items:center;gap:3%}
.cmp-lab{flex:none;width:26%;font-size:clamp(11px,2.6vw,16px);font-weight:600;color:#c9c3dd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmp-track{flex:1;height:clamp(18px,4.6vw,32px);border-radius:.3em;background:rgba(255,255,255,.05);overflow:hidden}
.cmp-bar{display:block;height:100%;width:0;border-radius:.3em;background:linear-gradient(90deg,#6d28d9,${accent})}
.cmp-win .cmp-bar{background:linear-gradient(90deg,${accent},${GOLD})}
.cmp-val{flex:none;min-width:3.5em;max-width:6em;text-align:right;font-weight:800;font-variant-numeric:tabular-nums;font-size:clamp(12px,2.8vw,18px);white-space:nowrap}
.cmp-winner{align-self:flex-start;font-size:clamp(11px,2.5vw,15px);font-weight:700;color:${GOLD};margin-top:1%}
#scrub{position:absolute;left:0;bottom:0;height:3px;width:0;background:linear-gradient(90deg,${accent},${GOLD});box-shadow:0 0 12px ${GOLD}88}
</style></head><body>
<div id="stage">${layout.bodyHtml}<div id="scrub"></div></div>
<script>
(function(){
  var R = ${JSON.stringify(layout.reveals)};
  var TOTAL = ${layout.total};
  var FADE = ${FADE};
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = new Intl.NumberFormat('nb-NO');
  var stage = document.getElementById('stage');
  var scrub = document.getElementById('scrub');
  function cl(x){ return x<0?0:x>1?1:x; }
  function ease(x){ return 1 - Math.pow(1-x,3); }
  // applyReveals(t): speiler motionStateAt i motionReveal.ts
  function applyReveals(t){
    for(var i=0;i<R.length;i++){
      var op = R[i];
      var el = stage.querySelector('[data-r="'+op.ref+'"]');
      if(!el) continue;
      var opac = cl((t-op.at)/FADE);
      var p = ease(cl((t-op.at)/op.dur));
      el.style.opacity = opac;
      if(op.kind==='slideUp') el.style.transform = 'translateY('+(12*(1-p))+'px)';
      else if(op.kind==='pop') el.style.transform = 'scale('+(0.85+0.15*p)+')';
      else if(op.kind==='wipe') el.style.clipPath = 'inset(0 '+((1-p)*100)+'% 0 0)';
      else if(op.kind==='barGrow') el.style.width = (p*parseFloat(el.getAttribute('data-w')))+'%';
      else if(op.kind==='countUp'){
        var pre=el.getAttribute('data-pre')||'',suf=el.getAttribute('data-suf')||'',disp=el.getAttribute('data-disp');
        el.textContent = pre + ((p>=1&&disp)?disp:nf.format(Math.round(+el.getAttribute('data-count')*p))) + suf;
      }
    }
    scrub.style.width = (cl(t/TOTAL)*100)+'%';
  }
  window.__motionSeek = function(t){ applyReveals(Math.max(0, Math.min(TOTAL, t))); };
  var raf=null, start=null;
  function loop(ts){ if(start===null)start=ts; var t=ts-start; applyReveals(t); if(t<TOTAL) raf=requestAnimationFrame(loop); }
  window.__motionPlay = function(){ if(raf)cancelAnimationFrame(raf); start=null; if(reduce){applyReveals(TOTAL);return;} raf=requestAnimationFrame(loop); };
  ${autoplay ? 'window.__motionPlay();' : 'applyReveals(0);'}
})();
</script>
</body></html>`;
}
