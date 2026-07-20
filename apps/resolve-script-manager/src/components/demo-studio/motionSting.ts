/**
 * motionSting.ts — «Motion»: gjør ett data-objekt om til en animert data-sting.
 *
 * Samme tall som lager still-plakaten emitteres her som en KEYFRAMET sekvens
 * (mark inn → funnel-wipe → hero teller opp → caption avsløres). To rene deler:
 *   - deriveStingTimeline(data)   → tidsatt keyframe-spec (motor/render kan lese)
 *   - buildMotionStingHtml(data)  → selvstendig animert HTML (preview + frame-capture)
 * + stingFromValues(): adapter fra en scenes felt-verdier → StingData, så
 *   «samme data-objekt» blir ekte og ikke en ny redigering.
 *
 * Ingen deps. Tekst HTML-escapes. HTML-en autospiller og eksponerer
 * window.__stingPlay() for replay/opptak.
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
  /** Funnel/bar-metrikker — vises stagger-et; typisk 2–4. */
  metrics: StingMetric[];
  caption?: string;
  accent: string;
  format?: StingFormat;
}

export interface StingKeyframe {
  /** Millisekund fra start. */
  at: number;
  kind: 'mark' | 'metric' | 'hero' | 'caption';
  /** For 'metric': indeks i metrics. */
  index?: number;
  /** Varighet på animasjonen (ms). */
  dur: number;
}

export interface StingTimeline {
  total: number;
  keyframes: StingKeyframe[];
}

const MARK_AT = 120;
const METRIC_START = 620;
const METRIC_STAGGER = 480;
const HERO_GAP = 520; // etter siste metric
const HERO_DUR = 1300;
const CAPTION_GAP = 1200; // etter hero starter
const TAIL = 700;

/** Tidsatt keyframe-spec. Rekkefølge er garantert: mark < metrics < hero < caption. */
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
/* Tall-parsing (nb-NO): «312 000 kr» → 312000 (+ suffix «kr»)         */
/* ------------------------------------------------------------------ */

/** Trekk ut første tall fra en streng. Space=tusenskille, komma=desimal. */
export function parseStingNumber(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  const s = String(raw).replace(/ /g, ' ');
  const m = s.match(/-?\d[\d\s.,]*\d|-?\d/);
  if (!m) return null;
  let t = m[0].replace(/\s/g, '');
  if (t.includes(',') && !t.includes('.')) t = t.replace(',', '.'); // komma-desimal
  else t = t.replace(/,/g, ''); // ellers komma = tusenskille
  const num = parseFloat(t);
  return isFinite(num) ? num : null;
}

/** Enhet etter tallet: «312 000 kr» → «kr», «38 %» → «%», «$1 200» → prefix «$». */
function affixOf(raw: string): { prefix?: string; suffix?: string } {
  const s = String(raw).replace(/ /g, ' ').trim();
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
 * Adapter: en scenes felt-verdier → StingData. Best-effort heuristikk:
 *  - Numeriske felt sorteres; det STØRSTE blir hero, resten (opptil 4) blir metrics.
 *  - Første ikke-numeriske tekstfelt (kort) blir caption.
 * `order` (feltnøkler i visningsrekkefølge) respekteres for metric-rekkefølge.
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

  // Hero = størst i absoluttverdi; behold visningsrekkefølge for metrics.
  let heroIdx = -1;
  let heroMag = -Infinity;
  numeric.forEach((f, i) => { const mag = Math.abs(f.value); if (mag > heroMag) { heroMag = mag; heroIdx = i; } });

  const heroF = heroIdx >= 0 ? numeric[heroIdx] : null;
  const metrics = numeric
    .filter((_, i) => i !== heroIdx)
    .slice(0, 4)
    .map<StingMetric>((f) => ({ label: f.label, value: f.value, display: f.raw.trim() }));

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
/* HTML-bygger — selvstendig animert sting (preview + frame-capture)   */
/* ------------------------------------------------------------------ */

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HERO_GOLD = '#f5c451';

function aspectFor(f: StingFormat): string {
  return f === '9:16' ? '9 / 16' : f === '1:1' ? '1 / 1' : '16 / 9';
}

/**
 * Bygg komplett, selvstendig HTML som spiller stingen. Autospiller ved last;
 * window.__stingPlay() replayer (brukes av preview-knapp OG frame-capture-render).
 */
export function buildMotionStingHtml(data: StingData, opts: { autoplay?: boolean } = {}): string {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(data.accent) ? data.accent : '#8b5cf6';
  const timeline = deriveStingTimeline(data);
  const format = data.format || '16:9';
  const autoplay = opts.autoplay !== false;

  const metricRows = data.metrics
    .map((m, i) => {
      const w = barWidth(data.metrics, i);
      const disp = m.display || fmt(m.value);
      return `<div class="row s${i}" data-kf="${i}">`
        + `<div class="bar" data-w="${w}%"></div>`
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
  color:#efecf9;padding:6% 6.5%;display:flex;flex-direction:column;justify-content:center;gap:3.2%}
.brand{display:flex;align-items:center;gap:2.5%;font-weight:700;font-size:clamp(11px,3.2vw,17px);opacity:0;transition:opacity .42s ease,transform .42s ease;transform:translateY(6px)}
.brand .mk{width:1.5em;height:1.5em;border-radius:.42em;flex:none;display:grid;place-items:center;color:#0c0a16;font-weight:900;font-size:.8em;background:linear-gradient(135deg,${accent},#6d28d9)}
.brand .tc{margin-left:auto;font-family:ui-monospace,"SF Mono",monospace;font-size:.62em;letter-spacing:.14em;color:#726c92;font-weight:500}
.funnel{display:flex;flex-direction:column;gap:2.6%}
.row{display:flex;align-items:center;gap:3.5%;opacity:0;transition:opacity .4s ease}
.row .bar{height:clamp(16px,4.4vw,30px);border-radius:.28em;width:0;background:linear-gradient(90deg,#6d28d9,${accent});box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);transition:width .7s cubic-bezier(.2,.8,.2,1);flex:none;position:relative;overflow:hidden}
.row .bar::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);transform:translateX(-120%)}
.row.lit .bar::after{animation:sheen 1s ease-out forwards}
@keyframes sheen{to{transform:translateX(120%)}}
.meta{display:flex;flex-direction:column;line-height:1.1}
.meta .lab{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(8px,2vw,10px);letter-spacing:.15em;text-transform:uppercase;color:#726c92}
.meta .val{font-weight:800;font-size:clamp(12px,3.4vw,18px);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.hero{opacity:0;transition:opacity .4s ease}
.hero .cap{font-family:ui-monospace,"SF Mono",monospace;font-size:clamp(8px,2vw,10.5px);letter-spacing:.18em;text-transform:uppercase;color:#a49dc2;margin-bottom:.3em}
.hero .num{font-size:clamp(30px,10vw,72px);font-weight:800;letter-spacing:-.035em;line-height:.92;font-variant-numeric:tabular-nums;color:${HERO_GOLD};text-shadow:0 0 40px ${HERO_GOLD}44}
.caption{font-size:clamp(12px,3vw,18px);font-weight:600;opacity:0;transform:translateY(8px);transition:opacity .5s ease,transform .5s ease}
#scrub{position:absolute;left:0;bottom:0;height:3px;width:0;background:linear-gradient(90deg,${accent},${HERO_GOLD});box-shadow:0 0 12px ${HERO_GOLD}88}
.on-mark .brand{opacity:1;transform:none}
</style></head><body>
<div id="stage">
  <div class="brand"><span class="mk">${esc(data.mark || '◆')}</span> ${esc(data.brandName)}<span class="tc" id="tc">${esc(data.eyebrow || '')}</span></div>
  <div class="funnel">${metricRows}</div>
  <div class="hero"><div class="cap">${esc(data.hero.label)}</div><div class="num"><span id="hero" data-count="${data.hero.value}" data-pre="${heroPrefix}" data-suf="${heroSuffix}">${heroPrefix}0${heroSuffix}</span></div></div>
  ${data.caption ? `<div class="caption">${esc(data.caption)}</div>` : ''}
  <div id="scrub"></div>
</div>
<script>
(function(){
  var TL = ${JSON.stringify(timeline)};
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nf = new Intl.NumberFormat('nb-NO');
  var stage = document.getElementById('stage');
  var scrub = document.getElementById('scrub');
  var timers = [];
  function clear(){ timers.forEach(function(t){ clearTimeout(t); }); timers = []; }
  function ease(t){ return 1 - Math.pow(1 - t, 3); }
  function count(el, target, dur){
    var pre = el.getAttribute('data-pre') || '', suf = el.getAttribute('data-suf') || '';
    var disp = el.getAttribute('data-disp');
    if(reduce){ el.textContent = pre + (disp || nf.format(target)) + suf; return; }
    var start = null;
    function step(ts){
      if(start===null) start = ts;
      var t = Math.min((ts - start) / dur, 1);
      el.textContent = pre + nf.format(Math.round(target * ease(t))) + suf;
      if(t < 1) requestAnimationFrame(step);
      else if(disp) el.textContent = pre + disp + suf;
    }
    requestAnimationFrame(step);
  }
  function reset(){
    clear(); stage.className = '';
    stage.querySelectorAll('.bar').forEach(function(b){ b.style.width = '0'; });
    stage.querySelectorAll('[data-count]').forEach(function(el){
      var pre = el.getAttribute('data-pre')||'', suf = el.getAttribute('data-suf')||'';
      el.textContent = pre + '0' + suf;
    });
    scrub.style.transition = 'none'; scrub.style.width = '0';
  }
  function play(){
    reset();
    if(reduce){
      stage.classList.add('on-mark');
      stage.querySelectorAll('.row').forEach(function(r){ r.style.opacity=1; r.querySelector('.bar').style.width=r.querySelector('.bar').getAttribute('data-w'); });
      stage.querySelectorAll('[data-count]').forEach(function(el){ var pre=el.getAttribute('data-pre')||'',suf=el.getAttribute('data-suf')||'',d=el.getAttribute('data-disp'); el.textContent=pre+(d||nf.format(+el.getAttribute('data-count')))+suf; });
      var h=document.querySelector('.hero'); if(h)h.style.opacity=1;
      var c=document.querySelector('.caption'); if(c){c.style.opacity=1;c.style.transform='none';}
      scrub.style.width='100%'; return;
    }
    requestAnimationFrame(function(){ scrub.style.transition = 'width ' + (TL.total/1000) + 's linear'; scrub.style.width = '100%'; });
    TL.keyframes.forEach(function(k){
      timers.push(setTimeout(function(){
        if(k.kind === 'mark'){ stage.classList.add('on-mark'); }
        else if(k.kind === 'metric'){
          var row = stage.querySelector('.row.s' + k.index);
          if(row){ row.style.opacity = 1; row.classList.add('lit'); var bar = row.querySelector('.bar'); bar.style.width = bar.getAttribute('data-w'); var v = row.querySelector('[data-count]'); if(v) count(v, +v.getAttribute('data-count'), 700); }
        } else if(k.kind === 'hero'){
          var hb = document.querySelector('.hero'); if(hb) hb.style.opacity = 1;
          var he = document.getElementById('hero'); if(he) count(he, +he.getAttribute('data-count'), k.dur);
        } else if(k.kind === 'caption'){
          var cap = document.querySelector('.caption'); if(cap){ cap.style.opacity = 1; cap.style.transform = 'none'; }
        }
      }, k.at));
    });
  }
  window.__stingPlay = play;
  ${autoplay ? 'play();' : ''}
})();
</script>
</body></html>`;
}

/** Funnel-bredder: avtagende, gulvet så små verdier fortsatt er synlige. */
function barWidth(metrics: StingMetric[], i: number): number {
  const max = Math.max(1, ...metrics.map((m) => Math.abs(m.value)));
  const frac = Math.abs(metrics[i].value) / max;
  // Komprimér til et pent funnel-spenn 100%→38% + gulv 22%.
  return Math.round(Math.max(22, 38 + frac * 62));
}
