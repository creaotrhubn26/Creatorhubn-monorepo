// infographic-engine.ts — portabel, avhengighets-lett kjerne for Infographic Studio.
// «Kobles til hva som helst»: Post Agent, Resume Builder (thumbnails), dashboards, CMS.
//
// KONTRAKT: en mal er et selvstendig HTML-fragment/dokument som leser `window.__CFG__`
// (data inn) og definerer `window.setProgress(p)` (animasjon 0..1). `#wrap` er rota.
//
// Motoren er RENE STRENG-FUNKSJONER — ingen React, ingen Tauri, ingen browser/puppeteer.
// Node + browser. Render-til-PNG er en ADAPTER (se render-engine.ts) som tar output-
// strengen herfra — den hører ikke hjemme i kjernen.

export interface InfographicField { key: string; label: string; type: 'text' | 'number' | 'color' | 'icon'; }

export interface AssembleOpts {
  fontsCss?: string;     // valgfri @font-face-CSS (bundlet/subsett) injiseres i <head>
  autoplaySec?: number;  // > 0 → self-playing over N sek; ellers statisk frossen frame
  loop?: boolean;        // loop autoplay
  progress?: number;     // statisk frame ved p (default 1) når autoplaySec ikke er satt
  fit?: boolean;         // self-fit #wrap til viewport (default true)
  width?: number;        // valgfri fast viewport-bredde (thumbnail)
  height?: number;
}

const RESERVED = new Set(['accent', 'ink', 'logo', 'layout']);

/** Data-skjemaet: alle `__CFG__.<key>` / `CFG.<key>`-referanser i malen. */
export function deriveSchema(templateHtml: string): InfographicField[] {
  const keys = new Set<string>();
  const re = /(?:__CFG__|CFG)\.([a-zA-Z_]\w*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(templateHtml))) if (!RESERVED.has(m[1])) keys.add(m[1]);
  return [...keys].map((k) => ({ key: k, label: k, type: 'text' as const }));
}

/** JSON trygt for inline <script> (< + linjeseparatorer U+2028/U+2029 → escapes). Uten
 *  dette taper et felt som inneholder «</script>» eller en linjeseparator ALL data. */
export function cfgJson(obj: unknown): string {
  const bad = new RegExp('[<' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');
  return JSON.stringify(obj).replace(bad, (c) => '\\u' + ('000' + c.charCodeAt(0).toString(16)).slice(-4));
}

// Fjern eksterne CDN-font-lenker: et ennå-ventende <link rel=stylesheet> BLOKKERER
// etterfølgende parser-script i WebKit/strenge runtimes → malens setProgress kjører aldri.
function stripExternalFontLinks(html: string): string {
  return html.replace(/<link\b[^>]*\bhref\s*=\s*["']https?:\/\/[^"'>]*["'][^>]*>/gi, '');
}

// Self-fit: skalér #wrap inn i viewporten (transform-origin top-left, sentrert).
const FIT = `(function(){function fit(){try{var w=document.getElementById('wrap');if(!w)return;`
  + `document.documentElement.style.background='transparent';var b=document.body;if(b){b.style.margin='0';b.style.background='transparent';}`
  + `w.style.position='absolute';w.style.top='0';w.style.left='0';w.style.transformOrigin='top left';w.style.transform='none';`
  + `var vw=window.innerWidth||1,vh=window.innerHeight||1,ww=w.scrollWidth||1,wh=w.scrollHeight||1;`
  + `var k=Math.min(1,(vw-16)/ww,(vh-16)/wh);if(!(k>0))k=1;var tx=(vw-ww*k)/2,ty=Math.max(0,(vh-wh*k)/2);`
  + `w.style.transform='translate('+tx.toFixed(1)+'px,'+ty.toFixed(1)+'px) scale('+k.toFixed(4)+')';}catch(e){}}`
  + `window.__igFit=fit;if(document.readyState!=='loading')fit();else addEventListener('load',fit);[60,250,600].forEach(function(d){setTimeout(fit,d);});addEventListener('resize',fit);})();`;

const driver = (autoplaySec: number | undefined, loop: boolean, progress: number): string => {
  if (autoplaySec && autoplaySec > 0) {
    return `(function(){var D=${autoplaySec}*1000,L=${loop};function p(){var s=Date.now();(function t(){var q=Math.min(1,(Date.now()-s)/D);try{window.setProgress&&window.setProgress(q);}catch(e){}if(q<1)requestAnimationFrame(t);else if(L)setTimeout(p,900);})();}`
      + `function b(){if(typeof window.setProgress==='function')p();else setTimeout(b,50);}b();})();`;
  }
  // statisk frossen frame ved gitt progresjon (thumbnail-modus)
  return `(function(){function b(){if(typeof window.setProgress==='function'){try{window.setProgress(${progress});}catch(e){}}else setTimeout(b,50);}b();})();`;
};

/** Bygg en SELVSTENDIG, portabel HTML-artefakt fra mal + data. Rendrer i en hvilken som
 *  helst browser, embed via <iframe>, eller headless → PNG (thumbnail — trygt, bare bilde). */
export function assembleHtml(templateHtml: string, cfg: Record<string, unknown>, opts: AssembleOpts = {}): string {
  const { fontsCss, autoplaySec, loop = false, progress = 1, fit = true, width, height } = opts;
  let html = stripExternalFontLinks(templateHtml);
  const dims = width && height ? `body{width:${width}px;height:${height}px;overflow:hidden}` : '';
  const headInject = (fontsCss ? `<style>${fontsCss}</style>` : '') + `<style>html,body{margin:0;background:transparent}${dims}</style>`;
  html = html.includes('</head>') ? html.replace('</head>', headInject + '</head>') : headInject + html;
  return `<script>window.__CFG__=${cfgJson(cfg)}</script>`
    + html
    + (fit ? `<script>${FIT}</script>` : '')
    + `<script>${driver(autoplaySec, loop, progress)}</script>`;
}

// ── SMART AUTO-VELG ─────────────────────────────────────────────────────────
// «Kobles til hva som helst» → gi vilkårlig data, motoren velger malen fra data-
// formen. Ren funksjon (testbar), returnerer KUN kjente bibliotek-stier (SSRF-trygt).

export const INFOGRAPHIC_TEMPLATE_LIBRARY = {
  bigNumber: '/embed/templates/big-number.html',
  statBar: '/embed/templates/stat-bar.html',
  donut: '/embed/templates/donut.html',
  comparison: '/embed/templates/comparison.html',
  timeline: '/embed/templates/timeline.html',
} as const;

export type InfographicTemplateKey = keyof typeof INFOGRAPHIC_TEMPLATE_LIBRARY;

function looksLikePercent(v: unknown): boolean {
  if (typeof v === 'number') return v > 0 && v <= 1;
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s.endsWith('%')) return true;
  // Number() (STRENGT) framfor parseFloat: «1 247» (tusenskille-mellomrom) → NaN, ikke 1.
  // parseFloat leste «1» → n≤1 → tall som «1 247 CV-er» ble feilklassifisert som prosent (donut).
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n <= 1;
}

/** Mal-KATEGORIER — data-formen mappes til én av disse. Registeret (kode-innebygde
 *  + DB-maler) knytter hver mal til en kategori, så nye maler kan delta i auto-velg
 *  uten kodeendring. */
export type InfographicCategory = 'single' | 'percent' | 'kpis' | 'comparison' | 'timeline';

/**
 * Detekter data-formens KATEGORI (den «smarte» delen — inherent kode). Presedens:
 *  1. steps[] / kort med desc|when|date  → timeline
 *  2. before&after / eksakt 2 kort       → comparison
 *  3. ett tall som ser ut som prosent    → percent
 *  4. ett tall / ett kort                → single
 *  5. ≥2 kort                            → kpis
 * Mapping kategori→mal er DATA (se templates-store), ikke her.
 */
export function detectCategory(data: Record<string, unknown> | null | undefined): InfographicCategory {
  const d = data || {};
  const cards = Array.isArray(d.cards) ? (d.cards as Record<string, unknown>[]) : [];

  if (Array.isArray(d.steps) && d.steps.length > 0) return 'timeline';
  if (cards.length >= 2 && cards.some((c) => c && (c.desc != null || c.when != null || c.date != null))) return 'timeline';

  if (d.before != null && d.after != null) return 'comparison';
  if (cards.length === 2) return 'comparison';

  const single = d.value != null ? d.value : cards.length === 1 ? cards[0]?.value : undefined;
  if (single != null && cards.length <= 1) {
    return looksLikePercent(single) ? 'percent' : 'single';
  }

  if (cards.length >= 2) return 'kpis';
  return 'single';
}

/** Standard kategori→innebygd-mal-nøkkel (fallback når DB-registeret ikke er lastet). */
const CATEGORY_TO_BUILTIN: Record<InfographicCategory, keyof typeof INFOGRAPHIC_TEMPLATE_LIBRARY> = {
  single: 'bigNumber', percent: 'donut', kpis: 'statBar', comparison: 'comparison', timeline: 'timeline',
};

/** Back-compat: velg innebygd mal-STI ut fra data-formen (uten DB-register). */
export function pickTemplate(data: Record<string, unknown> | null | undefined): string {
  return INFOGRAPHIC_TEMPLATE_LIBRARY[CATEGORY_TO_BUILTIN[detectCategory(data)]];
}
