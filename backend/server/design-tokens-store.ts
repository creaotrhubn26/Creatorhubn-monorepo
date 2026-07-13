// design-tokens-store.ts — merkevare (farge/type/spacing) som DATA per workspace.
//
// getTokens(ws) = 'global'-basis MERGET med workspace-overstyringer → produkt-flatene
// blir on-brand uten deploy, og justerings-knottene i CreatorHub Design skrur på disse.
// Robust mot manglende tabell (før migrasjon) → innebygde defaults.

import type { Pool } from 'pg';
import { normalizeWorkspace } from './infographic-templates-store.js';

export interface DesignTokens {
  accent: string;
  accentDark: string;
  bgSoft: string;
  text: string;
  fontFamily: string;
  [key: string]: unknown; // fremtidige tokens (spacing, radius, …)
}

// Innebygd fallback hvis 'global'-raden mangler (før migrasjon).
const BUILTIN_GLOBAL: DesignTokens = {
  accent: '#2f6df0', accentDark: '#2456c9', bgSoft: '#eef2fb', text: '#1f2d4a',
  fontFamily: 'Inter, "Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif',
};

const CACHE_TTL_MS = 60_000;
const _cache = new Map<string, { tokens: DesignTokens; at: number }>();

export function invalidateTokensCache(): void { _cache.clear(); }

async function readRow(pool: Pool, wsId: string): Promise<Record<string, unknown> | null> {
  const r = await pool.query<{ tokens: Record<string, unknown> }>(
    `SELECT tokens FROM workspace_design_tokens WHERE workspace_id = $1`, [wsId],
  );
  return r.rows[0]?.tokens ?? null;
}

/** Effektive tokens for et workspace: global-basis + workspace-overstyringer. Cachet. */
export async function getTokens(pool: Pool, workspace?: string | null): Promise<DesignTokens> {
  const ws = normalizeWorkspace(workspace);
  const key = ws ?? 'global';
  const now = Date.now();
  const hit = _cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.tokens;
  let merged: DesignTokens = { ...BUILTIN_GLOBAL };
  try {
    const global = await readRow(pool, 'global');
    if (global) merged = { ...merged, ...global };
    if (ws) { const own = await readRow(pool, ws); if (own) merged = { ...merged, ...own }; }
  } catch { /* tabell ikke migrert → behold innebygd */ }
  _cache.set(key, { tokens: merged, at: now });
  return merged;
}

/** RÅ overstyringer for et workspace — KUN eksplisitt satte tokens (ikke global-basis).
 *  Brukes av flater som må beholde sine egne literaler til en admin faktisk overstyrer
 *  (f.eks. Role Room Talents: tom rad → ingen --rr-*-vars → literalene i theme.ts gjelder). */
export async function getRawTokens(pool: Pool, workspace?: string | null): Promise<Record<string, unknown>> {
  const ws = normalizeWorkspace(workspace);
  if (!ws) return {};
  try { return (await readRow(pool, ws)) ?? {}; } catch { return {}; }
}

// ── Gjenbrukbare per-element-saniterere (brukes av BÅDE topp-nivå OG varianter — én kilde til
//    sannhet for sikkerhet). Hver returnerer et rent objekt (aldri rå input). ────────────────────
const CHD_SEL_RE = /^[A-Za-z0-9#.\-_ >:()\[\]="']{1,400}$/;
const chdSafeUrl = (u: unknown): u is string => typeof u === 'string' && u.length <= 600
  && (/^\//.test(u) || /^https:\/\//i.test(u)) && !/[<>"'\\]/.test(u) && !/javascript:/i.test(u);
function sanitizeElementEdits(input: unknown): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const EDIT_PROPS = new Set(['color', 'background-color', 'background', 'border-color', 'border-radius',
    'border-width', 'border-style', 'font-size', 'font-weight', 'letter-spacing', 'text-align', 'padding', 'margin', 'opacity', 'box-shadow', 'text-decoration',
    // Auto-layout (flex): container-oppsett.
    'display', 'flex-direction', 'gap', 'align-items', 'justify-content', 'flex-wrap',
    // Finjuster-nudge (translate flytter visuelt uten å reflow'e naboer). VAL_RE tillater translate(px,px).
    'transform']);
  const VAL_RE = /^[A-Za-z0-9#,.()%\-\s/]{0,120}$/;
  let n = 0;
  for (const [sel, propsRaw] of Object.entries(input as Record<string, unknown>)) {
    if (n >= 500) break;
    if (!CHD_SEL_RE.test(sel) || sel.includes('..') || !propsRaw || typeof propsRaw !== 'object') continue;
    const props: Record<string, string> = {};
    for (const [p, v] of Object.entries(propsRaw as Record<string, unknown>)) {
      if (EDIT_PROPS.has(p) && typeof v === 'string' && VAL_RE.test(v) && !/url\(/i.test(v)) props[p] = v;
    }
    if (Object.keys(props).length) { out[sel] = props; n++; }
  }
  return out;
}
function sanitizeElementText(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  let n = 0;
  for (const [sel, v] of Object.entries(input as Record<string, unknown>)) {
    if (n >= 500) break;
    if (CHD_SEL_RE.test(sel) && !sel.includes('..') && typeof v === 'string' && v.length <= 2000) { out[sel] = v; n++; }
  }
  return out;
}
// Bytt bildekilde på et EKSISTERENDE <img> (f.eks. logo): selektor → trygg URL (relativ eller https,
// aldri javascript:/data-uri-scripts). Runtime setter img.src.
function sanitizeElementSrc(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  let n = 0;
  for (const [sel, url] of Object.entries(input as Record<string, unknown>)) {
    if (n >= 200) break;
    if (CHD_SEL_RE.test(sel) && !sel.includes('..') && chdSafeUrl(url)) { out[sel] = url; n++; }
  }
  return out;
}
function sanitizeElementAnim(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const PRESETS = new Set(['fade-in', 'slide-up', 'slide-down', 'zoom-in', 'pulse', 'bounce', 'float']);
  let n = 0;
  for (const [sel, v] of Object.entries(input as Record<string, unknown>)) {
    if (n >= 500) break;
    if (CHD_SEL_RE.test(sel) && !sel.includes('..') && typeof v === 'string' && PRESETS.has(v)) { out[sel] = v; n++; }
  }
  return out;
}
function sanitizeElementBindings(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  let n = 0;
  for (const [sel, key] of Object.entries(input as Record<string, unknown>)) {
    if (n >= 500) break;
    if (CHD_SEL_RE.test(sel) && !sel.includes('..') && typeof key === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(key)) { out[sel] = key; n++; }
  }
  return out;
}
function sanitizeElementInserts(input: unknown): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const TYPES = new Set(['heading', 'text', 'button', 'divider', 'image', 'infographic', 'component']);
  let ac = 0;
  for (const [anchor, specs] of Object.entries(input as Record<string, unknown>)) {
    if (ac >= 200) break;
    if (!CHD_SEL_RE.test(anchor) || anchor.includes('..') || !Array.isArray(specs)) continue;
    const arr: Record<string, unknown>[] = [];
    for (const s of (specs as unknown[]).slice(0, 20)) {
      const so = s as Record<string, unknown>;
      if (!so || typeof so !== 'object' || !TYPES.has(so.type as string)) continue;
      if (typeof so.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(so.id)) continue;
      const spec: Record<string, unknown> = { id: so.id, type: so.type as string, pos: so.pos === 'before' ? 'before' : 'after' };
      if (typeof so.text === 'string' && so.text.length <= 500) spec.text = so.text;
      if (chdSafeUrl(so.href)) spec.href = so.href;
      if (chdSafeUrl(so.src)) spec.src = so.src;
      // Live datakilde for tekst/overskrift-innsettinger: runtime setter teksten = connector/metric-verdi.
      if (typeof so.source === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(so.source)) spec.source = so.source;
      if (typeof so.label === 'string' && so.label.length <= 80) spec.label = so.label;
      if (so.type === 'component') {
        if (typeof so.component !== 'string' || !/^[A-Za-z0-9 _-]{1,60}$/.test(so.component)) continue;
        spec.component = so.component;
        if (so.slots && typeof so.slots === 'object' && !Array.isArray(so.slots)) {
          const slots: Record<string, string> = {};
          for (const [cid, srck] of Object.entries(so.slots as Record<string, unknown>)) {
            if (/^[A-Za-z0-9_-]{1,40}$/.test(cid) && typeof srck === 'string' && /^[A-Za-z0-9_-]{1,60}$/.test(srck)) slots[cid] = srck;
          }
          spec.slots = slots;
        }
      }
      arr.push(spec);
    }
    if (arr.length) { out[anchor] = arr; ac++; }
  }
  return out;
}

/** Sett/oppdater tokens for et workspace (admin). Slår sammen med eksisterende (patch). */
export async function setTokens(pool: Pool, workspace: string, patch: Record<string, unknown>): Promise<{ error: string } | { ok: true }> {
  const ws = workspace === 'global' ? 'global' : normalizeWorkspace(workspace);
  if (!ws) return { error: 'Ugyldig workspace.' };
  // Kun kjente string-tokens (hex-farger + fontFamily) — unngå vilkårlig JSON-injeksjon.
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (typeof v === 'string' && v.length <= 200 && /^[A-Za-z0-9#,._"'()\-\s]*$/.test(v)) clean[k] = v;
  }
  // CreatorHub Design (Nivå 2): strukturerte overstyringer som DATA.
  //  nav  = patch pr. nav-key (label/badge/hidden/order/group) — shell-en slår den på WS_NAV.
  //  copy = strengoverstyringer (knapper/gruppetitler). Erstatter hele under-objektet ved lagring
  //  (JSONB `||` er grunn merge), så editoren sender fullt nav/copy-objekt pr. save.
  const navIn = (patch as any)?.nav;
  if (navIn && typeof navIn === 'object' && !Array.isArray(navIn)) {
    const nav: Record<string, Record<string, unknown>> = {};
    for (const [key, raw] of Object.entries(navIn as Record<string, unknown>)) {
      if (!/^[a-z0-9-]{1,40}$/.test(key) || !raw || typeof raw !== 'object') continue;
      const o = raw as Record<string, unknown>; const item: Record<string, unknown> = {};
      if (typeof o.label === 'string' && o.label.length <= 120) item.label = o.label;
      if (typeof o.badge === 'number' && o.badge >= 0 && o.badge <= 9999) item.badge = Math.floor(o.badge);
      if (typeof o.hidden === 'boolean') item.hidden = o.hidden;
      if (typeof o.order === 'number' && Number.isFinite(o.order)) item.order = o.order;
      if (o.group === 'hoved' || o.group === 'rom' || o.group === 'klient') item.group = o.group;
      if (Object.keys(item).length) nav[key] = item;
    }
    clean.nav = nav;
  }
  const copyIn = (patch as any)?.copy;
  if (copyIn && typeof copyIn === 'object' && !Array.isArray(copyIn)) {
    const copy: Record<string, string> = {};
    for (const [k, v] of Object.entries(copyIn as Record<string, unknown>)) {
      if (/^[a-zA-Z0-9._-]{1,60}$/.test(k) && typeof v === 'string' && v.length <= 200) copy[k] = v;
    }
    clean.copy = copy;
  }
  // CreatorHub Design (Fase B): shell-chrome-palett som DATA (bakgrunn/panel/ramme/tekst).
  // WorkspaceShell setter --ws-<key> på :root fra chrome; tomt = de mørke literalene.
  // Hvitlistede farge-nøkler (hex/rgba) — ikke vilkårlig JSON.
  const chromeIn = (patch as any)?.chrome;
  if (chromeIn && typeof chromeIn === 'object' && !Array.isArray(chromeIn)) {
    const ALLOWED = new Set(['bg', 'bgSidebar', 'panel', 'panelSolid', 'panelAlt', 'panelInput', 'border', 'borderSoft', 'text', 'textDim', 'textFaint']);
    const chrome: Record<string, string> = {};
    for (const [k, v] of Object.entries(chromeIn as Record<string, unknown>)) {
      if (ALLOWED.has(k) && typeof v === 'string' && v.length <= 120 && /^[A-Za-z0-9#,.()\-\s%]*$/.test(v)) chrome[k] = v;
    }
    clean.chrome = chrome;
  }
  // CreatorHub Design (per-element-lag): stil-overstyringer pr. element fra Edit-modus.
  // Form: { [selektor]: { [css-prop]: verdi } }. Kun hvitlistede trygge props + saniterte
  // selektorer/verdier (ingen url()/expression/vilkårlig CSS). Tak på antall selektorer.
  if ((patch as any)?.elementEdits !== undefined) clean.elementEdits = sanitizeElementEdits((patch as any).elementEdits);
  // Responsiv: egne stil-overstyringer pr. breakpoint (nettbrett ≤900px, mobil ≤600px) — samme
  // saniterer, runtime pakker dem i @media. Base (elementEdits) gjelder alle skjermer.
  if ((patch as any)?.elementEditsTablet !== undefined) clean.elementEditsTablet = sanitizeElementEdits((patch as any).elementEditsTablet);
  if ((patch as any)?.elementEditsMobile !== undefined) clean.elementEditsMobile = sanitizeElementEdits((patch as any).elementEditsMobile);
  // Per-element TEKST-overstyring (Edit-modus): { [selektor]: tekst }. textContent (ikke innerHTML)
  // → XSS-trygt av konstruksjon. Kun saniterte selektorer + lengdetak.
  if ((patch as any)?.elementText !== undefined) clean.elementText = sanitizeElementText((patch as any).elementText);
  // Per-element BILDEKILDE (bytt logo/bilde): { [selektor]: trygg URL }.
  if ((patch as any)?.elementSrc !== undefined) clean.elementSrc = sanitizeElementSrc((patch as any).elementSrc);
  // Per-element ANIMASJON (Edit-modus): { [selektor]: preset-nøkkel }. Kun nøkler fra fast katalog.
  if ((patch as any)?.elementAnim !== undefined) clean.elementAnim = sanitizeElementAnim((patch as any).elementAnim);
  // Per-element INNSATTE elementer (Insert-modus): { [anker-selektor]: [{ id, type, pos, text?, href?, src? }] }.
  // Runtime bygger DOM fra denne strukturerte dataen (createElement + textContent) → aldri rå HTML.
  // Kun hvitlistede typer + saniterte URL-er (relativ/https, ingen javascript:/<>"').
  if ((patch as any)?.elementInserts !== undefined) clean.elementInserts = sanitizeElementInserts((patch as any).elementInserts);
  // Marketing-metrics (dynamiske infographic-kilder): { [nøkkel]: { value, label } }. Infographics
  // med ?source=<nøkkel> flettes med disse server-side → «koblet opp» (én kilde, mange visninger).
  const metricsIn = (patch as any)?.metrics;
  if (metricsIn && typeof metricsIn === 'object' && !Array.isArray(metricsIn)) {
    const metrics: Record<string, { value?: string | number; label?: string }> = {};
    let n = 0;
    for (const [k, v] of Object.entries(metricsIn as Record<string, unknown>)) {
      if (n >= 200) break;
      if (!/^[A-Za-z0-9_-]{1,60}$/.test(k) || !v || typeof v !== 'object') continue;
      const vo = v as Record<string, unknown>; const m: { value?: string | number; label?: string } = {};
      if (typeof vo.value === 'string' && vo.value.length <= 120) m.value = vo.value;
      else if (typeof vo.value === 'number' && Number.isFinite(vo.value)) m.value = vo.value;
      if (typeof vo.label === 'string' && vo.label.length <= 200) m.label = vo.label;
      if (Object.keys(m).length) { metrics[k] = m; n++; }
    }
    clean.metrics = metrics;
  }
  // Data-BINDINGER: { [selektor]: kilde-nøkkel } — elementets tekst kobles til en metric-verdi.
  // Runtime setter textContent = metrics[<kilde>].value → live, koblet tall/stat på hvilket som helst element.
  if ((patch as any)?.elementBindings !== undefined) clean.elementBindings = sanitizeElementBindings((patch as any).elementBindings);
  // INTERAKSJONER: { [selektor]: { action: 'scroll'|'link', target } } — gjør et element klikkbart
  // (scroll til en seksjon / naviger til en trygg lenke). Runtime kobler en delegert klikk-lytter.
  const intxIn = (patch as any)?.elementInteractions;
  if (intxIn && typeof intxIn === 'object' && !Array.isArray(intxIn)) {
    const elementInteractions: Record<string, { action: string; target: string }> = {};
    let n = 0;
    for (const [sel, raw] of Object.entries(intxIn as Record<string, unknown>)) {
      if (n >= 300) break;
      if (!CHD_SEL_RE.test(sel) || sel.includes('..') || !raw || typeof raw !== 'object') continue;
      const o = raw as Record<string, unknown>;
      if (o.action === 'scroll' && typeof o.target === 'string' && CHD_SEL_RE.test(o.target) && !o.target.includes('..')) { elementInteractions[sel] = { action: 'scroll', target: o.target }; n++; }
      else if (o.action === 'link' && chdSafeUrl(o.target)) { elementInteractions[sel] = { action: 'link', target: o.target }; n++; }
    }
    clean.elementInteractions = elementInteractions;
  }
  // Navngitte VARIANTER: { [navn]: { elementEdits?, elementText?, elementAnim?, elementInserts?,
  //   elementBindings? } } — hver en komplett, alternativ design-tilstand. GJENBRUKER de samme
  //   saniterings-funksjonene → identisk sikkerhet som topp-nivå. Maks 30 varianter.
  const variantsIn = (patch as any)?.designVariants;
  if (variantsIn && typeof variantsIn === 'object' && !Array.isArray(variantsIn)) {
    const NAME_RE = /^[A-Za-z0-9 _-]{1,60}$/;
    const designVariants: Record<string, Record<string, unknown>> = {};
    let nv = 0;
    for (const [name, vraw] of Object.entries(variantsIn as Record<string, unknown>)) {
      if (nv >= 30) break;
      if (!NAME_RE.test(name) || !vraw || typeof vraw !== 'object') continue;
      const v = vraw as Record<string, unknown>;
      designVariants[name] = {
        elementEdits: sanitizeElementEdits(v.elementEdits),
        elementEditsTablet: sanitizeElementEdits(v.elementEditsTablet),
        elementEditsMobile: sanitizeElementEdits(v.elementEditsMobile),
        elementText: sanitizeElementText(v.elementText),
        elementAnim: sanitizeElementAnim(v.elementAnim),
        elementInserts: sanitizeElementInserts(v.elementInserts),
        elementBindings: sanitizeElementBindings(v.elementBindings),
      };
      nv++;
    }
    clean.designVariants = designVariants;
  }
  // Variant-konfig: hvilken variant er aktiv, eller A/B-test over flere. { mode, active, ab[] }.
  const vcIn = (patch as any)?.variantConfig;
  if (vcIn && typeof vcIn === 'object' && !Array.isArray(vcIn)) {
    const NAME_RE = /^[A-Za-z0-9 _-]{1,60}$/;
    const mode = ['off', 'active', 'ab'].includes((vcIn as any).mode) ? (vcIn as any).mode : 'off';
    const active = typeof (vcIn as any).active === 'string' && NAME_RE.test((vcIn as any).active) ? (vcIn as any).active : '';
    const ab = Array.isArray((vcIn as any).ab) ? ((vcIn as any).ab as unknown[]).filter((x) => typeof x === 'string' && NAME_RE.test(x)).slice(0, 10) : [];
    // Konverterings-mål: en trygg selektor (klikk → konvertering for A/B-attribusjon).
    const goalRaw = (vcIn as any).goal;
    const goal = typeof goalRaw === 'string' && CHD_SEL_RE.test(goalRaw) && !goalRaw.includes('..') ? goalRaw : '';
    clean.variantConfig = { mode, active, ab, goal };
  }
  // Gjenbrukbare KOMPONENTER: { [navn]: InsertSpec[] } — en navngitt blokk (samme trygge spec-typer
  // som elementInserts) som kan settes inn hvor som helst. Løv-typer (ingen nesting av komponenter).
  const compIn = (patch as any)?.designComponents;
  if (compIn && typeof compIn === 'object' && !Array.isArray(compIn)) {
    const TYPES = new Set(['heading', 'text', 'button', 'divider', 'image', 'infographic']);
    const NAME_RE = /^[A-Za-z0-9 _-]{1,60}$/;
    const safeUrl = (u: unknown): u is string => typeof u === 'string' && u.length <= 600
      && (/^\//.test(u) || /^https:\/\//i.test(u)) && !/[<>"'\\]/.test(u) && !/javascript:/i.test(u);
    const designComponents: Record<string, unknown[]> = {};
    let nc = 0;
    for (const [name, specs] of Object.entries(compIn as Record<string, unknown>)) {
      if (nc >= 100) break;
      if (!NAME_RE.test(name) || !Array.isArray(specs)) continue;
      const arr: Record<string, string>[] = [];
      for (const s of (specs as unknown[]).slice(0, 20)) {
        const so = s as Record<string, unknown>;
        if (!so || typeof so !== 'object' || !TYPES.has(so.type as string)) continue;
        if (typeof so.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(so.id)) continue;
        const spec: Record<string, string> = { id: so.id, type: so.type as string, pos: so.pos === 'before' ? 'before' : 'after' };
        if (typeof so.text === 'string' && so.text.length <= 500) spec.text = so.text;
        if (safeUrl(so.href)) spec.href = so.href;
        if (safeUrl(so.src)) spec.src = so.src;
        arr.push(spec);
      }
      if (arr.length) { designComponents[name] = arr; nc++; }
    }
    clean.designComponents = designComponents;
  }
  // HTML-KOMPONENTER: { [navn]: html } — en klonet seksjon fra siden (høy-fidelity). Den EKTE
  // saneringen skjer med DOMPurify i klienten BÅDE ved lagring og ved render (defense-in-depth);
  // her et grovt server-belte (strip script/iframe/on*=/javascript:) + lengde/antall-tak.
  const htmlIn = (patch as any)?.htmlComponents;
  if (htmlIn && typeof htmlIn === 'object' && !Array.isArray(htmlIn)) {
    const NAME_RE = /^[A-Za-z0-9 _-]{1,60}$/;
    const htmlComponents: Record<string, string> = {};
    let n = 0;
    for (const [name, html] of Object.entries(htmlIn as Record<string, unknown>)) {
      if (n >= 50) break;
      if (!NAME_RE.test(name) || typeof html !== 'string' || html.length > 40000) continue;
      htmlComponents[name] = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/\son\w+\s*=/gi, ' data-x=')
        .replace(/javascript:/gi, '');
      n++;
    }
    clean.htmlComponents = htmlComponents;
  }
  await pool.query(
    `INSERT INTO workspace_design_tokens (workspace_id, tokens) VALUES ($1, $2::jsonb)
     ON CONFLICT (workspace_id) DO UPDATE SET tokens = workspace_design_tokens.tokens || EXCLUDED.tokens, updated_at = NOW()`,
    [ws, JSON.stringify(clean)],
  );
  invalidateTokensCache();
  return { ok: true };
}

// Kanonisk merkevare-seed pr. produkt (matcher mig 0380) — brukes ved reset så en flate
// aldri faller til den nøytrale globale blåen ved «tilbakestill».
const CANONICAL_SEED: Record<string, Record<string, string>> = {
  creatorhub: { accent: '#ff8c00', accentDark: '#e07b00', bgSoft: '#fff4e6' },
  leadgrid: { accent: '#2f6df0' },
};

/** Reset (Fase D): fjern ALLE admin-overstyringer for et workspace → tilbake til standard.
 *  Produkter med kanonisk merkevare re-seedes (creatorhub→oransje), ellers ren (arver
 *  literaler/global). Idempotent. */
export async function resetTokens(pool: Pool, workspace: string): Promise<{ error: string } | { ok: true }> {
  const ws = workspace === 'global' ? 'global' : normalizeWorkspace(workspace);
  if (!ws) return { error: 'Ugyldig workspace.' };
  await pool.query(`DELETE FROM workspace_design_tokens WHERE workspace_id = $1`, [ws]);
  const seed = CANONICAL_SEED[ws];
  if (seed) {
    await pool.query(
      `INSERT INTO workspace_design_tokens (workspace_id, tokens) VALUES ($1, $2::jsonb)
       ON CONFLICT (workspace_id) DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = NOW()`,
      [ws, JSON.stringify(seed)],
    );
  }
  invalidateTokensCache();
  return { ok: true };
}

/** ERSTATT hele overstyrings-raden med `full` (ikke merge). Brukes av «Angre siste endring»
 *  (Fase D) for å gjenopprette den EKSAKTE tilstanden før en endring. Tom → slett raden. */
export async function replaceTokens(pool: Pool, workspace: string, full: Record<string, unknown>): Promise<{ error: string } | { ok: true }> {
  const ws = workspace === 'global' ? 'global' : normalizeWorkspace(workspace);
  if (!ws) return { error: 'Ugyldig workspace.' };
  if (!full || Object.keys(full).length === 0) {
    await pool.query(`DELETE FROM workspace_design_tokens WHERE workspace_id = $1`, [ws]);
  } else {
    await pool.query(
      `INSERT INTO workspace_design_tokens (workspace_id, tokens) VALUES ($1, $2::jsonb)
       ON CONFLICT (workspace_id) DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = NOW()`,
      [ws, JSON.stringify(full)],
    );
  }
  invalidateTokensCache();
  return { ok: true };
}

// ── Versjonshistorikk ────────────────────────────────────────────────────────────────────────
// Navngitte gjenopprettingspunkter for hele design-tilstanden. Lagres i en EGEN rad («<ws>::history»)
// så de ikke bloat-er den vanlige token-raden (og aldri leses av getTokens). Bounded til 15.
const HIST_MAX = 15;
type DesignSnapshot = { id: string; at: number; label: string; tokens: Record<string, unknown> };
function histWs(workspace: string): string | null { return workspace === 'global' ? 'global' : normalizeWorkspace(workspace); }
async function readHistory(pool: Pool, wsId: string): Promise<DesignSnapshot[]> {
  try {
    const r = await pool.query<{ tokens: { snapshots?: DesignSnapshot[] } }>('SELECT tokens FROM workspace_design_tokens WHERE workspace_id = $1', [`${wsId}::history`]);
    const s = r.rows[0]?.tokens?.snapshots;
    return Array.isArray(s) ? s : [];
  } catch { return []; }
}
export async function saveDesignSnapshot(pool: Pool, workspace: string, label: string): Promise<{ error: string } | { ok: true; id: string }> {
  const ws = histWs(workspace); if (!ws) return { error: 'Ugyldig workspace.' };
  const tokens = await getRawTokens(pool, ws).catch(() => ({}));
  const snap: DesignSnapshot = { id: `v${Date.now()}${Math.floor(Math.random() * 1000)}`, at: Date.now(), label: String(label || '').slice(0, 80), tokens };
  const next = [snap, ...(await readHistory(pool, ws))].slice(0, HIST_MAX);
  try {
    await pool.query(`INSERT INTO workspace_design_tokens (workspace_id, tokens) VALUES ($1, $2::jsonb)
       ON CONFLICT (workspace_id) DO UPDATE SET tokens = EXCLUDED.tokens, updated_at = NOW()`, [`${ws}::history`, JSON.stringify({ snapshots: next })]);
  } catch { return { error: 'Kunne ikke lagre versjon.' }; }
  return { ok: true, id: snap.id };
}
export async function listDesignSnapshots(pool: Pool, workspace: string): Promise<Array<{ id: string; at: number; label: string }>> {
  const ws = histWs(workspace); if (!ws) return [];
  return (await readHistory(pool, ws)).map((s) => ({ id: s.id, at: s.at, label: s.label }));
}
export async function restoreDesignSnapshot(pool: Pool, workspace: string, id: string): Promise<{ error: string } | { ok: true }> {
  const ws = histWs(workspace); if (!ws) return { error: 'Ugyldig workspace.' };
  const snap = (await readHistory(pool, ws)).find((s) => s.id === id);
  if (!snap) return { error: 'Fant ikke versjonen.' };
  await saveDesignSnapshot(pool, ws, 'Auto: før gjenoppretting').catch(() => undefined); // gjenoppretting reversibel
  return replaceTokens(pool, ws, snap.tokens);
}
