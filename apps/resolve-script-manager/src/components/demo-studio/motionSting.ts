/**
 * motionSting.ts — «Motion»: gjør ett data-objekt om til en animert data-sting.
 *
 * Samme tall som lager still-plakaten emitteres her som en KEYFRAMET sekvens
 * (mark inn → funnel-wipe → hero teller opp → caption avsløres). Rene deler:
 *   - deriveStingTimeline(data)      → tidsatt keyframe-spec
 *   - stingStateAt(data, t)          → DETERMINISTISK frame-tilstand ved tid t
 *                                       (samme matte som HTML-en; gjør stingen
 *                                        seekbar OG frame-capture-bar)
 *   - stingFrameTimes / captureSpec  → hva render-pipelinen skal fange
 *   - buildMotionStingHtml(data)     → selvstendig HTML: autospiller via samme
 *                                       tilstands-funksjon + window.__stingSeek(t)
 *   - stingFromValues                → adapter fra scene-felt → StingData
 *
 * Ingen deps. Tekst HTML-escapes. Autoplay OG seek deler ÉN applyAt(t) → preview
 * matcher det render-pipelinen vil fange, bilde for bilde.
 */

export type StingFormat = '16:9' | '9:16' | '1:1';

export interface StingMetric {
  label: string;
  value: number;
  /** Ferdig-formatert visning (ellers formateres value nb-NO). */
  display?: string;
}

export interface StingHero {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}

export interface StingData {
  brandName: string;
  mark?: string;
  eyebrow?: string;
  hero: StingHero;
  metrics: StingMetric[];
  caption?: string;
  accent: string;
  format?: StingFormat;
}

export interface StingKeyframe {
  at: number;
  kind: 'mark' | 'metric' | 'hero' | 'caption';
  index?: number;
  dur: number;
}

export interface StingTimeline {
  total: number;
  keyframes: StingKeyframe[];
}

const MARK_AT = 120;
const METRIC_START = 620;
const METRIC_STAGGER = 480;
const HERO_GAP = 520;
const HERO_DUR = 1300;
const CAPTION_GAP = 1200;
const TAIL = 700;
/** Lineær innblendings-varighet (ms) for hvert element. Delt av TS + HTML. */
const REVEAL = 280;

/** Tidsatt keyframe-spec. Rekkefølge garantert: mark < metrics < hero < caption. */
export function deriveStingTimeline(data: StingData): StingTimeline {
  const kf: StingKeyframe[] = [];
  kf.push({ at: MARK_AT, kind: 'mark', dur: 420 });

  const n = Math.max(0, data.metrics.length);
  for (let i = 0; i < n; i++) {
    kf.push({ at: METRIC_START + i * METRIC_STAGGER, kind: 'metric', index: i, dur: 700 });
  }
  const lastMetricAt = n > 0 ? METRIC_START + (n - 1) * METRIC_STAGGER : MARK_AT;
  const heroAt = lastMetricAt + HERO_GAP;
  kf.push({ at: heroAt, kind: 'hero', dur: HERO_DUR });

  const captionAt = heroAt + CAPTION_GAP;
  if (data.caption) kf.push({ at: captionAt, kind: 'caption', dur: 500 });

  const lastEnd = kf.reduce((mx, k) => Math.max(mx, k.at + k.dur), 0);
  return { total: lastEnd + TAIL, keyframes: kf };
}

/* ------------------------------------------------------------------ */
/* Deterministisk frame-tilstand — kjernen som gjør stingen seekbar    */
/* ------------------------------------------------------------------ */

export interface StingMetricState { opacity: number; value: number; barFrac: number }
export interface StingFrameState {
  t: number;
  mark: number;                 // opacity 0..1
  metrics: StingMetricState[];
  hero: { opacity: number; value: number };
  caption: number;              // opacity 0..1 (0 om ingen caption)
  scrub: number;                // 0..1
}

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);

/**
 * Visuell tilstand ved tid t (ms). REN funksjon — HTML-en speiler nøyaktig
 * samme matte, så preview == det render-pipelinen fanger bilde for bilde.
 */
export function stingStateAt(data: StingData, t: number): StingFrameState {
  const tl = deriveStingTimeline(data);
  const find = (kind: StingKeyframe['kind'], index?: number) =>
    tl.keyframes.find((k) => k.kind === kind && (index == null || k.index === index));
  const op = (kf?: StingKeyframe) => (kf ? clamp01((t - kf.at) / REVEAL) : 0);
  const pr = (kf?: StingKeyframe) => (kf ? easeOutCubic(clamp01((t - kf.at) / kf.dur)) : 0);

  const metrics = data.metrics.map<StingMetricState>((m, i) => {
    const kf = find('metric', i);
    const p = pr(kf);
    return { opacity: op(kf), value: Math.round(m.value * p), barFrac: p };
  });
  const hk = find('hero');
  const ck = find('caption');
  return {
    t,
    mark: op(find('mark')),
    metrics,
    hero: { opacity: op(hk), value: Math.round(data.hero.value * pr(hk)) },
    caption: ck ? op(ck) : 0,
    scrub: clamp01(t / tl.total),
  };
}

/** Frame-tidspunkt (ms) ved gitt fps, inkl. et eksakt sluttbilde på total. */
export function stingFrameTimes(total: number, fps: number): number[] {
  const step = 1000 / Math.max(1, fps);
  const out: number[] = [];
  for (let t = 0; t < total - 0.5; t += step) out.push(Math.round(t));
  out.push(Math.round(total));
  return out;
}

export interface StingCaptureSpec {
  width: number;
  height: number;
  fps: number;
  total: number;
  frames: number[];
}

/** Spec render-pipelinen konsumerer: dimensjoner + hvilke frame-tider å fange. */
export function buildStingCaptureSpec(data: StingData, opts: { fps?: number } = {}): StingCaptureSpec {
  const fps = opts.fps && opts.fps > 0 ? opts.fps : 30;
  const total = deriveStingTimeline(data).total;
  const [width, height] = data.format === '9:16' ? [1080, 1920] : data.format === '1:1' ? [1080, 1080] : [1920, 1080];
  return { width, height, fps, total, frames: stingFrameTimes(total, fps) };
}

/* ------------------------------------------------------------------ */
/* Tall-parsing (nb-NO): «312 000 kr» → 312000 (+ suffix «kr»)         */
/* ------------------------------------------------------------------ */

export function parseStingNumber(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  const s = String(raw).replace(/ /g, ' ');
  const m = s.match(/-?\d[\d\s.,]*\d|-?\d/);
  if (!m) return null;
  let t = m[0].replace(/\s/g, '');
  if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.');
  else t = t.replace(/,/g, '');
  const num = parseFloat(t);
  return isFinite(num) ? num : null;
}

function affixOf(raw: string): { prefix?: string; suffix?: string } {
  const s = String(raw).replace(/ /g, ' ').trim();
  const m = s.match(/-?\d[\d\s.,]*\d|-?\d/);
  if (!m) return {};
  const before = s.slice(0, m.index).trim();
  const after = s.slice((m.index ?? 0) + m[0].length).trim();
  const out: { prefix?: string; suffix?: string } = {};
  if (after) out.suffix = after.length <= 6 ? after : after.slice(0, 6);
  else if (before && /[^\d\s]/.test(before)) out.prefix = before.slice(0, 3);
  return out;
}

const fmt = (n: number): string => new Intl.NumberFormat('nb-NO').format(Math.round(n));

/**
 * Adapter: en scenes felt-verdier → StingData. Størst tall = hero, resten
 * (opptil 4, i visningsrekkefølge) = funnel; første korte tekstfelt = caption.
 */
export function stingFromValues(
  values: Record<string, string>,
  opts: { brandName: string; accent: string; mark?: string; eyebrow?: string; caption?: string; order?: string[] } = { brandName: '', accent: '#8b5cf6' },
): StingData {
  const keys = opts.order && opts.order.length ? opts.order.filter((k) => k in values) : Object.keys(values);
  const numeric: { key: string; label: string; value: number; raw: string; affix: { prefix?: string; suffix?: string } }[] = [];
  const textFields: string[] = [];

  for (const key of keys) {
    const raw = values[key];
    if (raw == null || String(raw).trim() === '') continue;
    const num = parseStingNumber(raw);
    if (num != null) {
      numeric.push({ key, label: humanizeKey(key), value: num, raw: String(raw), affix: affixOf(String(raw)) });
    } else if (String(raw).trim().length <= 60) {
      textFields.push(String(raw).trim());
    }
  }

  let heroIdx = -1;
  let heroMag = -Infinity;
  numeric.forEach((f, i) => { const mag = Math.abs(f.value); if (mag > heroMag) { heroMag = mag; heroIdx = i; } });

  const heroF = heroIdx >= 0 ? numeric[heroIdx] : null;
  const metrics = numeric
    .filter((_, i) => i !== heroIdx)
    .slice(0, 4)
    // Kort rå-tekst («312 000 kr») beholdes; lang («Dolly inn | 35mm») faller
    // tilbake til rent tall så bar-verdien ikke flommer ut av rammen.
    .map<StingMetric>((f) => ({ label: f.label, value: f.value, display: f.raw.trim().length <= 10 ? f.raw.trim() : fmt(f.value) }));

  const hero: StingHero = heroF
    ? { label: heroF.label, value: heroF.value, prefix: heroF.affix.prefix, suffix: heroF.affix.suffix }
    : { label: 'Resultat', value: 0 };

  return {
    brandName: opts.brandName || 'Merkevare',
    mark: opts.mark || (opts.brandName ? opts.brandName.slice(0, 1).toUpperCase() : '◆'),
    eyebrow: opts.eyebrow,
    hero,
    metrics,
    caption: opts.caption || textFields[0],
    accent: opts.accent,
  };
}

function humanizeKey(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : key;
}

/* ------------------------------------------------------------------ */
/* HTML-bygger — autoplay + seek deler ÉN applyAt(t)                    */
/* ------------------------------------------------------------------ */

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HERO_GOLD = '#f5c451';

function aspectFor(f: StingFormat): string {
  return f === '9:16' ? '9 / 16' : f === '1:1' ? '1 / 1' : '16 / 9';
}

/** Layout-knapper: plassering + luft + ramme. Relative verdier → format-trygt. */
export interface MotionLayoutOpts {
  align?: 'top' | 'center' | 'bottom';
  density?: 'tight' | 'normal' | 'airy';
  pad?: 'snug' | 'normal' | 'roomy';
  /** Avansert: fin, kontinuerlig element-mellomrom (%) — overstyrer density. */
  gap?: number;
  /** Avansert: ekstra topp-margin per element (data-r → em). */
  spacing?: Record<string, number>;
}
export function layoutVars(o: MotionLayoutOpts = {}): { align: string; gap: string; subGap: string; pad: string } {
  // Fin gap-override vinner over density-preset. subGap (barer/rader/liste-punkt)
  // skalerer MED gap-en, så «Luft» faktisk endrer det mest synlige mellomrommet.
  const g = typeof o.gap === 'number' && o.gap >= 0 ? o.gap : (o.density === 'tight' ? 1.6 : o.density === 'airy' ? 5.4 : 3.2);
  return {
    align: o.align === 'top' ? 'flex-start' : o.align === 'bottom' ? 'flex-end' : 'center',
    gap: `${g}%`,
    subGap: `${(g * 0.72).toFixed(2)}%`,
    pad: o.pad === 'snug' ? '4.5% 5.5%' : o.pad === 'roomy' ? '9.5% 9.5%' : '6.5% 7%',
  };
}

/** Bygg CSS for per-element ekstra topp-margin (data-r → em). */
export function spacingCss(spacing?: Record<string, number>): string {
  if (!spacing) return '';
  return Object.entries(spacing)
    .filter(([, v]) => typeof v === 'number' && v > 0)
    .map(([ref, v]) => `[data-r="${ref}"]{margin-top:${v}em}`)
    .join('');
}

function barWidth(metrics: StingMetric[], i: number): number {
  const max = Math.max(1, ...metrics.map((m) => Math.abs(m.value)));
  const frac = Math.abs(metrics[i].value) / max;
  return Math.round(Math.max(22, 38 + frac * 62));
}

export function buildMotionStingHtml(data: StingData, opts: { autoplay?: boolean; layout?: MotionLayoutOpts; tempo?: number } = {}): string {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(data.accent) ? data.accent : '#8b5cf6';
  const k = opts.tempo && opts.tempo > 0 ? opts.tempo : 1;
  const t0 = deriveStingTimeline(data);
  const timeline: StingTimeline = { total: Math.round(t0.total * k), keyframes: t0.keyframes.map((kf) => ({ ...kf, at: Math.round(kf.at * k), dur: Math.round(kf.dur * k) })) };
  const format = data.format || '16:9';
  const autoplay = opts.autoplay !== false;
  const L = layoutVars(opts.layout);

  const metricRows = data.metrics
    .map((m, i) => {
      const w = barWidth(data.metrics, i);
      const disp = m.display || fmt(m.value);
      return `<div class="row s${i}">`
        + `<div class="bar" data-w="${w}"></div>`
        + `<div class="meta"><span class="lab">${esc(m.label)}</span>`
        + `<span class="val" data-count="${m.value}" data-disp="${esc(disp)}">0</span></div></div>`;
    })
    .join('');

  const heroPrefix = esc(data.hero.prefix || '');
  const heroSuffix = data.hero.suffix ? ' ' + esc(data.hero.suffix) : '';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:transparent;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",system-ui,sans-serif;display:grid;place-items:center;overflow:hidden}
#stage{aspect-ratio:${aspectFor(format)};width:100%;max-width:100%;max-height:100%;position:relative;border-radius:14px;overflow:hidden;
  background:radial-gradient(120% 90% at 82% -10%, ${accent}33, transparent 55%), radial-gradient(90% 80% at -10% 110%, ${accent}22, transparent 55%), #0c0a16;
  color:#efecf9;padding:${L.pad};display:flex;flex-direction:column;justify-content:${L.align};gap:${L.gap}}
.brand{display:flex;align-items:center;gap:2.5%;font-weight:700;font-size:clamp(11px,3.2vw,17px);opacity:0}
.brand .mk{width:1.5em;height:1.5em;border-radius:.42em;flex:none;display:grid;place-items:center;color:#0c0a16;font-weight:900;font-size:.8em;background:linear-gradient(135deg,${accent},#6d28d9)}
.brand .tc{margin-left:auto;font-family:ui-monospace,"SF Mono",monospace;font-size:.62em;letter-spacing:.14em;color:#726c92;font-weight:500}
.funnel{display:flex;flex-direction:column;gap:${L.subGap}}
.row{display:flex;align-items:center;gap:3.5%;opacity:0}
.row .bar{height:clamp(16px,4.4vw,30px);border-radius:.28em;width:0;max-width:62%;background:linear-gradient(90deg,#6d28d9,${accent});box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);flex:none}
.meta{display:flex;flex-direction:column;line-height:1.1;flex:1;min-width:0}
.meta .lab{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(8px,2vw,10px);letter-spacing:.15em;text-transform:uppercase;color:#726c92;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta .val{font-weight:800;font-size:clamp(12px,3.4vw,18px);font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hero{opacity:0;min-width:0}
.hero .cap{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(8px,2vw,10.5px);letter-spacing:.18em;text-transform:uppercase;color:#a49dc2;margin-bottom:.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hero .num{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hero .num{font-size:clamp(30px,10vw,72px);font-weight:800;letter-spacing:-.035em;line-height:.92;font-variant-numeric:tabular-nums;color:${HERO_GOLD};text-shadow:0 0 40px ${HERO_GOLD}44}
.caption{font-size:clamp(12px,3vw,18px);font-weight:600;opacity:0}
#scrub{position:absolute;left:0;bottom:0;height:3px;width:0;background:linear-gradient(90deg,${accent},${HERO_GOLD});box-shadow:0 0 12px ${HERO_GOLD}88}
${spacingCss(opts.layout?.spacing)}
</style></head><body>
<div id="stage">
  <div class="brand" data-r="brand"><span class="mk">${esc(data.mark || '◆')}</span> ${esc(data.brandName)}<span class="tc">${esc(data.eyebrow || '')}</span></div>
  <div class="funnel" data-r="funnel">${metricRows}</div>
  <div class="hero" data-r="hero"><div class="cap">${esc(data.hero.label)}</div><div class="num"><span id="hero" data-count="${data.hero.value}" data-pre="${heroPrefix}" data-suf="${heroSuffix}">${heroPrefix}0${heroSuffix}</span></div></div>
  ${data.caption ? `<div class="caption" data-r="caption">${esc(data.caption)}</div>` : ''}
  <div id="scrub"></div>
</div>
<script>
(function(){
  var TL = ${JSON.stringify(timeline)};
  var REVEAL = ${REVEAL};
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = new Intl.NumberFormat('nb-NO');
  var stage = document.getElementById('stage');
  var scrub = document.getElementById('scrub');
  var rows = [].slice.call(stage.querySelectorAll('.row'));
  var brand = stage.querySelector('.brand');
  var heroBox = stage.querySelector('.hero');
  var heroEl = document.getElementById('hero');
  var capEl = stage.querySelector('.caption');
  function cl(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ease(x){ return 1 - Math.pow(1 - x, 3); }
  function kf(kind, index){ for(var i=0;i<TL.keyframes.length;i++){ var k=TL.keyframes[i]; if(k.kind===kind && (index==null||k.index===index)) return k; } return null; }
  function setVal(el, target, p){
    var pre = el.getAttribute('data-pre')||'', suf = el.getAttribute('data-suf')||'', disp = el.getAttribute('data-disp');
    el.textContent = pre + ((p >= 1 && disp) ? disp : nf.format(Math.round(target * p))) + suf;
  }
  // applyAt(t): identisk matte som stingStateAt i motionSting.ts
  function applyAt(t){
    var mk = kf('mark'); if(brand) brand.style.opacity = mk ? cl((t-mk.at)/REVEAL) : 1;
    rows.forEach(function(row,i){
      var k = kf('metric', i); if(!k) return;
      var p = ease(cl((t-k.at)/k.dur));
      row.style.opacity = cl((t-k.at)/REVEAL);
      row.querySelector('.bar').style.width = (p * parseFloat(row.querySelector('.bar').getAttribute('data-w'))) + '%';
      var v = row.querySelector('[data-count]'); if(v) setVal(v, +v.getAttribute('data-count'), p);
    });
    var hk = kf('hero');
    if(hk){ if(heroBox) heroBox.style.opacity = cl((t-hk.at)/REVEAL); if(heroEl) setVal(heroEl, +heroEl.getAttribute('data-count'), ease(cl((t-hk.at)/hk.dur))); }
    var ck = kf('caption');
    if(ck && capEl){ var cp = cl((t-ck.at)/REVEAL); capEl.style.opacity = cp; capEl.style.transform = 'translateY(' + (8*(1-cp)) + 'px)'; }
    scrub.style.width = (cl(t/TL.total) * 100) + '%';
  }
  window.__stingSeek = function(t){ applyAt(Math.max(0, Math.min(TL.total, t))); };
  // Render-kontrakt: pipelinen (playwright_render) driver tid via setProgress(p),
  // p 0..1, ett kall per utbilde → seek deterministisk til p*total. Stopper
  // autoplay slik at render-kallene tar over.
  window.setProgress = function(pp){ if(raf) cancelAnimationFrame(raf); applyAt(Math.max(0, Math.min(1, pp)) * TL.total); };
  var raf = null, startTs = null;
  function loop(ts){ if(startTs===null) startTs = ts; var t = ts - startTs; applyAt(t); if(t < TL.total) raf = requestAnimationFrame(loop); }
  window.__stingPlay = function(){ if(raf) cancelAnimationFrame(raf); startTs = null; if(reduce){ applyAt(TL.total); return; } raf = requestAnimationFrame(loop); };
  ${autoplay ? 'window.__stingPlay();' : 'applyAt(0);'}
})();
</script>
</body></html>`;
}
