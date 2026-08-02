// infographic-share.ts — GJENBRUKBAR delings-primitiv for Infographic Studio.
//
// «Kobles til hva som helst»: OG-/lenke-forhåndsvisningsbilder, e-post-grafikk, sosiale
// poster, klient-rapporter/PDF, iPad-delekort. Alle disse trenger ÉN ting — en validert
// `render.png`-URL bygget fra data + merkevare. Denne modulen er det ene stedet det gjøres,
// så «data → merkevaret bilde» er konsistent på tvers av produktene.
//
// Validerings-reglene speiler render.png-endepunktet (SSRF-/injeksjons-trygt): kun mal-id,
// /embed/-sti eller «auto»; source/accent/dims saniteres; data base64url-JSON (tak).

const TEMPLATE_ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const SAFE_TPL_RE = /^\/embed\/[A-Za-z0-9._/-]+\.html$/;
const SOURCE_RE = /^[A-Za-z0-9_-]{1,60}$/;
const WS_RE = /^[A-Za-z0-9_-]{1,40}$/;
const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const MIN_DIM = 64;
const MAX_DIM = 3000;
const MAX_DATA_BYTES = 8000; // hold URL-en under vanlige lengde-tak

const clampDim = (v: number | undefined, def: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(v))) : def;

export interface InfographicUrlOpts {
  /** Absolutt base (prod-domene) — PÅKREVD for e-post/OG (crawlere/klienter trenger absolutt URL). */
  base?: string;
  /** Mal: id | '/embed/…html' | 'auto' (default 'auto' → motoren velger fra data-formen). */
  tpl?: string;
  /** Workspace → merkevare-aksent + workspace-scopede maler. */
  ws?: string;
  /** Live metric/connector-nøkkel — verdien flettes inn fra DB (alltid fersk). */
  source?: string;
  /** Eksplisitt data (base64url-JSON). Utelates hvis for stor. */
  data?: Record<string, unknown>;
  /** Aksent-hex override (ellers fra workspace-merkevare). */
  accent?: string;
  w?: number;
  h?: number;
}

/** Bygg en validert `render.png`-URL. Ugyldige felter droppes trygt (aldri kastet inn i URL-en). */
export function buildInfographicUrl(opts: InfographicUrlOpts = {}): string {
  const { base = '', tpl = 'auto', ws, source, data, accent, w, h } = opts;
  const p = new URLSearchParams();

  const tplOk = tpl === 'auto' || TEMPLATE_ID_RE.test(tpl) || (SAFE_TPL_RE.test(tpl) && !tpl.includes('..'));
  p.set('tpl', tplOk ? tpl : 'auto');
  if (ws && WS_RE.test(ws)) p.set('ws', ws);
  if (source && SOURCE_RE.test(source)) p.set('source', source);
  if (accent && HEX_RE.test(accent)) p.set('accent', accent);

  const width = clampDim(w, 1200);
  const height = clampDim(h, 630);
  if (width !== 1200) p.set('w', String(width));
  if (height !== 630) p.set('h', String(height));

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const json = JSON.stringify(data);
    if (json.length <= MAX_DATA_BYTES) p.set('d', Buffer.from(json, 'utf8').toString('base64url'));
  }
  const q = p.toString();
  return `${base.replace(/\/$/, '')}/api/infographics/render.png${q ? `?${q}` : ''}`;
}

/** HTML-attributt-escape (OG/e-post-snippets). */
function attr(s: unknown): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** OG- + Twitter-kort-meta for delte lenker. `url` MÅ være absolutt (sett `base`). */
export function ogImageTags(url: string, opts: { width?: number; height?: number; alt?: string } = {}): string {
  const { width = 1200, height = 630, alt = 'Infographic' } = opts;
  const u = attr(url);
  return [
    `<meta property="og:image" content="${u}">`,
    `<meta property="og:image:width" content="${clampDim(width, 1200)}">`,
    `<meta property="og:image:height" content="${clampDim(height, 630)}">`,
    `<meta property="og:image:alt" content="${attr(alt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${u}">`,
  ].join('\n');
}

/** E-post-trygt <img> — e-postklienter kjører ikke JS, så en server-PNG er eneste vei til rik grafikk. */
export function emailImgTag(url: string, opts: { width?: number; alt?: string } = {}): string {
  const { width = 600, alt = 'Infographic' } = opts;
  return `<img src="${attr(url)}" alt="${attr(alt)}" width="${Math.round(width)}" style="max-width:100%;height:auto;display:block;border:0" />`;
}
