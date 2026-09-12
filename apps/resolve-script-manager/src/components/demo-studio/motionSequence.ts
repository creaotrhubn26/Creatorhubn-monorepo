/**
 * motionSequence.ts — «continuous data-film»: kjed flere scener sine motions til
 * ÉN sammenhengende, seekbar animasjon med overganger (crossfade + slide), som
 * rendres til ÉN ProRes-fil via samme setProgress-kontrakt.
 *
 * Alle arketyper uttrykkes som MotionLayout {bodyHtml, reveals, total} (sting
 * via stingLayoutFor her), så N scener komponeres uniformt. Refs prefikses per
 * scene (s{i}_) for å unngå kollisjon. Ren logikk (timeline/prefiks/tilstand) er
 * testbar; HTML-en autospiller + eksponerer window.setProgress(p) over HELE filmen.
 */
import {
  layoutVars, themeColors, spacingCss, stingFromValues,
  type StingData, type StingFormat, type MotionLayoutOpts,
} from './motionSting.js';
import {
  statLayout, quoteLayout, compareLayout, listLayout,
  statFrom, quoteFrom, compareFrom, listFrom, pickArchetype,
  type MotionLayout, type RevealOp, type Archetype,
} from './motionReveal.js';

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const fmt = (n: number): string => new Intl.NumberFormat('nb-NO').format(Math.round(n));

/* ------------------------------------------------------------------ */
/* Overgang + kamera (per scene) — «legg inn alt»                       */
/* ------------------------------------------------------------------ */

/** Hvordan en scene kommer INN (styrer også overlappens geometri). */
export type TransKind = 'cut' | 'cross' | 'slide' | 'slideX' | 'wipe' | 'zoom' | 'morph';
/** Rolig kamerabevegelse over scenens levetid (Ken Burns). */
export type CamKind = 'none' | 'in' | 'out' | 'panL' | 'panR' | 'drift';
/** Per-scene filmiske effekter. `len` = overlapp (ms) FØR denne scenen. */
export interface SceneFx { trans?: TransKind; cam?: CamKind; len?: number }

export const TRANS_KINDS: TransKind[] = ['cut', 'cross', 'slide', 'slideX', 'wipe', 'zoom', 'morph'];
export const CAM_KINDS: CamKind[] = ['none', 'in', 'out', 'panL', 'panR', 'drift'];
export const TRANS_LABEL: Record<TransKind, string> = {
  cut: 'Kutt', cross: 'Krysston', slide: 'Skyv opp', slideX: 'Skyv inn', wipe: 'Sveip', zoom: 'Zoom', morph: 'Morph',
};
export const CAM_LABEL: Record<CamKind, string> = {
  none: 'Ingen', in: 'Push inn', out: 'Trekk ut', panL: 'Panorer ◀', panR: 'Panorer ▶', drift: 'Drift opp',
};

/** Utgangs-scene («brand outro»): merke + navn + CTA, i layout-modellen. */
export function outroLayoutFor(o: { brandName: string; cta?: string; mark?: string }): MotionLayout {
  const reveals: RevealOp[] = [
    { ref: 'ocmark', kind: 'pop', at: 120, dur: 540 },
    { ref: 'ocname', kind: 'fade', at: 380, dur: 480 },
  ];
  if (o.cta) reveals.push({ ref: 'occta', kind: 'slideUp', at: 760, dur: 520 });
  const total = (o.cta ? 760 + 520 : 380 + 480) + 780;
  const body = `<div class="arc oc">`
    + `<div class="oc-mark" data-r="ocmark">${esc(o.mark || '◆')}</div>`
    + `<div class="oc-name" data-r="ocname">${esc(o.brandName)}</div>`
    + (o.cta ? `<div class="oc-cta" data-r="occta">${esc(o.cta)}</div>` : '')
    + `</div>`;
  return { bodyHtml: body, reveals, total };
}

/** Sting uttrykt i layout-modellen (brand/funnel/hero/caption som reveals). */
export function stingLayoutFor(d: StingData): MotionLayout {
  const reveals: RevealOp[] = [{ ref: 'brand', kind: 'fade', at: 120, dur: 360 }];
  const pre = esc(d.hero.prefix || '');
  const suf = d.hero.suffix ? ' ' + esc(d.hero.suffix) : '';
  const max = Math.max(1, ...d.metrics.map((m) => Math.abs(m.value)));
  let rows = '';
  d.metrics.slice(0, 4).forEach((m, i) => {
    const w = Math.round(Math.max(20, 30 + (Math.abs(m.value) / max) * 40));
    const disp = m.display || fmt(m.value);
    rows += `<div class="sq-row" data-r="row${i}"><span class="sq-bar" data-r="bar${i}" data-w="${w}"></span>`
      + `<div class="sq-meta"><span class="sq-lab">${esc(m.label)}</span>`
      + `<span class="sq-val" data-r="val${i}" data-count="${m.value}" data-disp="${esc(disp)}">0</span></div></div>`;
    reveals.push({ ref: `row${i}`, kind: 'fade', at: 620 + i * 480, dur: 300 });
    reveals.push({ ref: `bar${i}`, kind: 'barGrow', at: 620 + i * 480, dur: 700 });
    reveals.push({ ref: `val${i}`, kind: 'countUp', at: 620 + i * 480, dur: 700 });
  });
  const heroAt = 620 + Math.max(0, d.metrics.length - 1) * 480 + 520;
  reveals.push({ ref: 'hero', kind: 'countUp', at: heroAt, dur: 1300 });
  if (d.caption) reveals.push({ ref: 'caption', kind: 'slideUp', at: heroAt + 1200, dur: 500 });
  const total = reveals.reduce((mx, r) => Math.max(mx, r.at + r.dur), 0) + 700;
  const body =
    `<div class="sq-brand" data-r="brand"><span class="sq-mk">${esc(d.mark || '◆')}</span> ${esc(d.brandName)}</div>`
    + `<div class="sq-funnel">${rows}</div>`
    + `<div class="sq-hero"><div class="sq-cap">${esc(d.hero.label)}</div><div class="sq-num"><span data-r="hero" data-count="${d.hero.value}" data-pre="${pre}" data-suf="${suf}">${pre}0${suf}</span></div></div>`
    + (d.caption ? `<div class="sq-caption" data-r="caption">${esc(d.caption)}</div>` : '');
  return { bodyHtml: `<div class="arc arc-sting">${body}</div>`, reveals, total };
}

/** Auto-utled layout for en scenes felt-verdier (alle arketyper). */
export function sceneLayoutForValues(
  values: Record<string, string>,
  opts: { templateId?: string; brandName?: string; accent?: string; order?: string[]; arch?: Archetype } = {},
): { layout: MotionLayout; archetype: Archetype } {
  const arch = opts.arch || pickArchetype(opts.templateId || '', values);
  if (arch === 'sting') {
    const d = stingFromValues(values, { brandName: opts.brandName || 'Merkevare', accent: opts.accent || '#8b5cf6', order: opts.order });
    return { layout: stingLayoutFor(d), archetype: arch };
  }
  const layout =
    arch === 'stat' ? statLayout(statFrom(values, opts.order))
      : arch === 'quote' ? quoteLayout(quoteFrom(values, opts.order))
        : arch === 'compare' ? compareLayout(compareFrom(values, opts.order))
          : listLayout(listFrom(values, opts.order));
  return { layout, archetype: arch };
}

/* ------------------------------------------------------------------ */
/* Sekvens-timeline (ren)                                              */
/* ------------------------------------------------------------------ */

export interface SequenceTimeline { total: number; starts: number[]; transMs: number }

/**
 * Scener overlapper med transMs (crossfade). `trans` = skalar (samme overlapp
 * overalt) ELLER per-grense-array (overlaps[i] = ms mellom scene i og i+1) så
 * hver overgang kan ha egen lengde (kutt = 0). Ren → testbar.
 */
export function buildSequenceTimeline(totals: number[], trans: number | number[] = 550): SequenceTimeline {
  const ov = (i: number): number => {
    const v = Array.isArray(trans) ? trans[i] : trans;
    return typeof v === 'number' && v >= 0 ? v : 550;
  };
  const starts: number[] = [];
  let cursor = 0;
  totals.forEach((t, i) => {
    starts.push(cursor);
    cursor += t - (i < totals.length - 1 ? ov(i) : 0);
  });
  const total = totals.length ? starts[starts.length - 1] + totals[totals.length - 1] : 0;
  return { total, starts, transMs: ov(0) };
}

/** Prefiks alle refs i en layout med s{i}_ (unngå kollisjon på tvers av scener). */
export function prefixLayout(layout: MotionLayout, i: number): MotionLayout {
  const p = `s${i}_`;
  return {
    total: layout.total,
    reveals: layout.reveals.map((r) => ({ ...r, ref: p + r.ref })),
    bodyHtml: layout.bodyHtml.replace(/data-r="([^"]+)"/g, (_m, ref) => `data-r="${p}${ref}"`),
  };
}

/* ------------------------------------------------------------------ */
/* HTML-bygger for hele sekvensen                                      */
/* ------------------------------------------------------------------ */

function aspectFor(f: StingFormat): string {
  return f === '9:16' ? '9 / 16' : f === '1:1' ? '1 / 1' : '16 / 9';
}

export interface SequenceResult { html: string; total: number; timeline: SequenceTimeline }

/**
 * Komponer N scene-layouts til ÉN film. Én accent/tema/format for hele filmen.
 * autospiller + window.setProgress(p) driver HELE sekvensen (frame-capture-bar).
 */
export function buildSequenceHtml(
  layouts: MotionLayout[],
  opts: { accent?: string; format?: StingFormat; place?: MotionLayoutOpts; transitionMs?: number; autoplay?: boolean; fx?: SceneFx[] } = {},
): SequenceResult {
  const accent = opts.accent && /^#[0-9a-fA-F]{3,8}$/.test(opts.accent) ? opts.accent : '#8b5cf6';
  const format = opts.format || '16:9';
  const L = layoutVars(opts.place);
  const T = themeColors(opts.place?.theme);
  const GOLD = T.hero;
  const transMs = opts.transitionMs ?? 550;
  const autoplay = opts.autoplay !== false;
  const fx = opts.fx || [];

  const prefixed = layouts.map((l, i) => prefixLayout(l, i));
  // Overgang pr. scene (scene 0 default = kutt/instant, resten = skyv opp som før).
  const kinds: TransKind[] = prefixed.map((_l, i) => fx[i]?.trans || (i === 0 ? 'cut' : 'slide'));
  const cams: CamKind[] = prefixed.map((_l, i) => fx[i]?.cam || 'none');
  // Overlapp pr. grense: bestemt av NESTE scenes overgang (kutt = 0, ellers len ?? transMs).
  const overlaps: number[] = prefixed.slice(0, -1).map((_l, i) => {
    if (kinds[i + 1] === 'cut') return 0;
    const len = fx[i + 1]?.len;
    return typeof len === 'number' && len >= 0 ? len : transMs;
  });
  const timeline = buildSequenceTimeline(prefixed.map((l) => l.total), overlaps.length ? overlaps : transMs);
  const REVEAL = 260;

  const scenesHtml = prefixed
    .map((l, i) => `<div class="seq-scene" data-i="${i}" style="opacity:0"><div class="seq-inner">${l.bodyHtml}</div></div>`)
    .join('');
  const allReveals = prefixed.flatMap((l, i) => l.reveals.map((r) => ({ ...r, scene: i })));

  return {
    total: timeline.total,
    timeline,
    html: `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:transparent;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif;display:grid;place-items:center;overflow:hidden}
#stage{aspect-ratio:${aspectFor(format)};width:100%;max-width:100%;max-height:100%;position:relative;border-radius:14px;overflow:hidden;color:${T.ink};
  background:radial-gradient(120% 90% at 82% -10%, ${accent}33, transparent 55%), radial-gradient(90% 80% at -10% 110%, ${accent}22, transparent 55%), ${T.ground}}
.seq-scene{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:${L.align};padding:${L.pad};gap:${L.gap};will-change:opacity,transform}
.seq-inner{display:flex;flex-direction:column;justify-content:inherit;gap:${L.gap};min-width:0;width:100%;transform-origin:50% 50%;will-change:transform}
[data-r]{opacity:0}
/* brand outro */
.oc{align-items:center;text-align:center;gap:.7em}
.oc-mark{width:1.9em;height:1.9em;border-radius:.5em;display:grid;place-items:center;color:${T.chip};font-weight:900;font-size:clamp(26px,7vw,52px);background:linear-gradient(135deg,${accent},#6d28d9);box-shadow:0 0 44px ${accent}55}
.oc-name{font-size:clamp(20px,5.5vw,40px);font-weight:800;letter-spacing:-.02em;color:${T.ink}}
.oc-cta{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(10px,2.4vw,14px);letter-spacing:.16em;text-transform:uppercase;color:${GOLD}}
.arc{display:flex;flex-direction:column;max-width:100%;min-width:0;gap:${L.gap}}
.st-label,.st-sub,.q-text,.q-author,.cmp-title,.cmp-lab,.cmp-val,.sq-lab,.sq-val,.sq-cap{overflow:hidden;text-overflow:ellipsis}
/* sting */
.arc-sting{gap:${L.gap}}
.sq-brand{display:flex;align-items:center;gap:.6em;font-weight:700;font-size:clamp(11px,3.2vw,17px)}
.sq-mk{width:1.5em;height:1.5em;border-radius:.42em;flex:none;display:grid;place-items:center;color:${T.chip};font-weight:900;font-size:.8em;background:linear-gradient(135deg,${accent},#6d28d9)}
.sq-funnel{display:flex;flex-direction:column;gap:${L.subGap}}
.sq-row{display:flex;align-items:center;gap:3.5%}
.sq-bar{height:clamp(16px,4.4vw,30px);border-radius:.28em;width:0;max-width:62%;background:linear-gradient(90deg,#6d28d9,${accent});flex:none}
.sq-meta{display:flex;flex-direction:column;line-height:1.1;flex:1;min-width:0}
.sq-lab{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(8px,2vw,10px);letter-spacing:.15em;text-transform:uppercase;color:${T.faint};white-space:nowrap}
.sq-val{font-weight:800;font-size:clamp(12px,3.4vw,18px);font-variant-numeric:tabular-nums;white-space:nowrap}
.sq-hero .sq-cap{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(8px,2vw,10.5px);letter-spacing:.18em;text-transform:uppercase;color:${T.soft};margin-bottom:.3em;white-space:nowrap}
.sq-num{font-size:clamp(30px,10vw,72px);font-weight:800;letter-spacing:-.035em;line-height:.92;font-variant-numeric:tabular-nums;color:${GOLD};text-shadow:0 0 40px ${GOLD}44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sq-caption{font-size:clamp(12px,3vw,18px);font-weight:600}
/* stat */
.st-label{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(9px,2.3vw,13px);letter-spacing:.2em;text-transform:uppercase;color:${T.soft};white-space:nowrap}
.st-num{font-size:clamp(40px,13vw,104px);font-weight:800;letter-spacing:-.04em;line-height:.92;font-variant-numeric:tabular-nums;color:${GOLD};text-shadow:0 0 46px ${GOLD}44;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st-delta{align-self:flex-start;font-size:clamp(12px,2.6vw,17px);font-weight:700;color:#34d399;background:rgba(52,211,153,.14);border:1px solid rgba(52,211,153,.4);padding:.25em .7em;border-radius:999px;margin-top:1%}
.st-sub{font-size:clamp(12px,2.6vw,17px);color:${T.ink};margin-top:1.5%;max-width:22ch}
/* quote */
.q-mark{font-size:clamp(48px,12vw,110px);line-height:.6;font-weight:800;color:${accent}}
.q-text{font-size:clamp(17px,4vw,34px);font-weight:600;line-height:1.32;max-width:22ch;clip-path:inset(0 100% 0 0)}
.q-author{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(10px,2.3vw,14px);letter-spacing:.12em;text-transform:uppercase;color:${T.soft}}
.q-author .q-role{color:${T.faint}}
/* compare */
.cmp-title{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(9px,2.3vw,13px);letter-spacing:.2em;text-transform:uppercase;color:${T.soft}}
.cmp-rows{display:flex;flex-direction:column;gap:${L.subGap}}
.cmp-row{display:flex;align-items:center;gap:3%}
.cmp-lab{flex:none;width:26%;font-size:clamp(11px,2.6vw,16px);font-weight:600;color:${T.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmp-track{flex:1;height:clamp(18px,4.6vw,32px);border-radius:.3em;background:${T.barTop};overflow:hidden}
.cmp-bar{display:block;height:100%;width:0;border-radius:.3em;background:linear-gradient(90deg,#6d28d9,${accent})}
.cmp-win .cmp-bar{background:linear-gradient(90deg,${accent},${GOLD})}
.cmp-val{flex:none;min-width:3.5em;max-width:6em;text-align:right;font-weight:800;font-variant-numeric:tabular-nums;font-size:clamp(12px,2.8vw,18px);white-space:nowrap}
.cmp-winner{align-self:flex-start;font-size:clamp(11px,2.5vw,15px);font-weight:700;color:${GOLD};margin-top:1%}
/* list */
.arc-list{gap:${L.gap}}
.ls-title{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(9px,2.3vw,13px);letter-spacing:.2em;text-transform:uppercase;color:${T.soft};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ls-list{display:flex;flex-direction:column;gap:${L.subGap}}
.ls-item{display:flex;align-items:center;gap:3%;min-width:0}
.ls-idx{flex:none;width:1.7em;height:1.7em;border-radius:.45em;display:grid;place-items:center;font-weight:800;font-size:clamp(11px,2.4vw,15px);color:${T.chip};background:linear-gradient(135deg,${accent},#6d28d9)}
.ls-body{display:flex;flex-direction:column;min-width:0}
.ls-lab{font-weight:650;font-size:clamp(13px,3vw,20px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ls-sub{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(8px,1.9vw,10.5px);letter-spacing:.12em;text-transform:uppercase;color:${T.faint};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#scrub{position:absolute;left:0;bottom:0;height:3px;width:0;background:linear-gradient(90deg,${accent},${GOLD});box-shadow:0 0 12px ${GOLD}88;z-index:5}
${spacingCss(opts.place?.spacing)}
</style></head><body>
<div id="stage">${scenesHtml}<div id="scrub"></div></div>
<script>
(function(){
  var R = ${JSON.stringify(allReveals)};
  var STARTS = ${JSON.stringify(timeline.starts)};
  var TOTALS = ${JSON.stringify(prefixed.map((l) => l.total))};
  var OV = ${JSON.stringify(overlaps)};
  var KINDS = ${JSON.stringify(kinds)};
  var CAMS = ${JSON.stringify(cams)};
  var TOTAL = ${timeline.total};
  var REVEAL = ${REVEAL};
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = new Intl.NumberFormat('nb-NO');
  var stage = document.getElementById('stage');
  var scrub = document.getElementById('scrub');
  var scenes = [].slice.call(stage.querySelectorAll('.seq-scene'));
  var inners = scenes.map(function(s){ return s.querySelector('.seq-inner'); });
  function cl(x){ return x<0?0:x>1?1:x; }
  function ease(x){ return 1 - Math.pow(1-x,3); }
  // Kamerabevegelse (Ken Burns) over scenens levetid cp=0..1.
  function camTf(kind, cp){
    if(kind==='in') return 'scale(' + (1 + 0.06*cp).toFixed(4) + ')';
    if(kind==='out') return 'scale(' + (1.06 - 0.06*cp).toFixed(4) + ')';
    if(kind==='panL') return 'translateX(' + (-2.4*cp).toFixed(2) + '%) scale(1.045)';
    if(kind==='panR') return 'translateX(' + (2.4*cp).toFixed(2) + '%) scale(1.045)';
    if(kind==='drift') return 'translateY(' + (1.3 - 2.6*cp).toFixed(2) + '%) scale(1.045)';
    return 'none';
  }
  // Inngangs-transform for scene i gitt eased intro/outro (0..1).
  function sceneTf(kind, ei, eo){
    if(kind==='slide') return 'translateY(' + ((1-ei)*22 - (1-eo)*22).toFixed(2) + 'px)';
    if(kind==='slideX') return 'translateX(' + ((1-ei)*46).toFixed(2) + 'px)';
    if(kind==='zoom') return 'scale(' + (0.9 + 0.1*ei).toFixed(4) + ')';
    if(kind==='morph') return 'scale(' + ((1.10 - 0.10*ei) * (1 - 0.05*(1-eo))).toFixed(4) + ')';
    return 'none'; // cut, cross, wipe → ingen transform
  }
  function applyAt(t){
    // scene-container overganger (pr-scene type + lengde) + kamera
    for(var i=0;i<scenes.length;i++){
      var s0 = STARTS[i], dur = TOTALS[i], localT = t - s0;
      var last = i === scenes.length - 1;
      var inOv = i > 0 ? OV[i-1] : 0;      // overlapp før denne scenen
      var outOv = !last ? OV[i] : 0;       // overlapp etter denne scenen
      var kind = KINDS[i] || 'slide';
      var intro = i === 0 ? 1 : (inOv <= 1 ? (localT >= 0 ? 1 : 0) : cl(localT / inOv));
      var outro = last ? 1 : (outOv <= 1 ? (localT < dur ? 1 : 0) : cl((dur - localT) / outOv));
      var active = localT >= -1 && localT <= dur + 1;
      var ei = ease(intro), eo = ease(outro);
      var vis = active ? ei * eo : 0;
      scenes[i].style.opacity = vis;
      scenes[i].style.transform = active ? sceneTf(kind, ei, eo) : sceneTf(kind, 0, 1);
      scenes[i].style.clipPath = (active && kind==='wipe') ? ('inset(0 ' + ((1-ei)*100).toFixed(2) + '% 0 0)') : 'none';
      if(inners[i]) inners[i].style.transform = active ? camTf(CAMS[i], cl(dur>0?localT/dur:1)) : 'none';
    }
    // reveals per scene ved lokal tid
    for(var j=0;j<R.length;j++){
      var op = R[j];
      var lt = t - STARTS[op.scene];
      var el = stage.querySelector('[data-r="' + op.ref + '"]');
      if(!el) continue;
      var opac = cl((lt - op.at) / REVEAL);
      var p = ease(cl((lt - op.at) / op.dur));
      el.style.opacity = opac;
      if(op.kind==='slideUp') el.style.transform = 'translateY(' + (12*(1-p)) + 'px)';
      else if(op.kind==='pop') el.style.transform = 'scale(' + (0.85+0.15*p) + ')';
      else if(op.kind==='wipe') el.style.clipPath = 'inset(0 ' + ((1-p)*100) + '% 0 0)';
      else if(op.kind==='barGrow') el.style.width = (p*parseFloat(el.getAttribute('data-w'))) + '%';
      else if(op.kind==='countUp'){
        var pre=el.getAttribute('data-pre')||'',suf=el.getAttribute('data-suf')||'',disp=el.getAttribute('data-disp');
        el.textContent = pre + ((p>=1&&disp)?disp:nf.format(Math.round(+el.getAttribute('data-count')*p))) + suf;
      }
    }
    scrub.style.width = (cl(t/TOTAL)*100) + '%';
  }
  window.__motionSeek = function(t){ applyAt(Math.max(0, Math.min(TOTAL, t))); };
  window.setProgress = function(pp){ if(raf)cancelAnimationFrame(raf); applyAt(cl(pp)*TOTAL); };
  var raf=null, start=null;
  function loop(ts){ if(start===null)start=ts; var t=ts-start; applyAt(t); if(t<TOTAL) raf=requestAnimationFrame(loop); }
  window.__motionPlay = function(){ if(raf)cancelAnimationFrame(raf); start=null; if(reduce){applyAt(TOTAL);return;} raf=requestAnimationFrame(loop); };
  ${autoplay ? 'window.__motionPlay();' : 'applyAt(0);'}
})();
</script>
</body></html>`,
  };
}
