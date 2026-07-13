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
  const editsIn = (patch as any)?.elementEdits;
  if (editsIn && typeof editsIn === 'object' && !Array.isArray(editsIn)) {
    const EDIT_PROPS = new Set(['color', 'background-color', 'background', 'border-color', 'border-radius',
      'border-width', 'border-style', 'font-size', 'font-weight', 'letter-spacing', 'text-align',
      'padding', 'margin', 'opacity', 'box-shadow', 'text-decoration']);
    const SEL_RE = /^[A-Za-z0-9#.\-_ >:()]{1,400}$/;
    const VAL_RE = /^[A-Za-z0-9#,.()%\-\s/]{0,120}$/;
    const elementEdits: Record<string, Record<string, string>> = {};
    let selCount = 0;
    for (const [sel, propsRaw] of Object.entries(editsIn as Record<string, unknown>)) {
      if (selCount >= 500) break;
      if (!SEL_RE.test(sel) || sel.includes('..') || !propsRaw || typeof propsRaw !== 'object') continue;
      const props: Record<string, string> = {};
      for (const [p, v] of Object.entries(propsRaw as Record<string, unknown>)) {
        if (EDIT_PROPS.has(p) && typeof v === 'string' && VAL_RE.test(v) && !/url\(/i.test(v)) props[p] = v;
      }
      if (Object.keys(props).length) { elementEdits[sel] = props; selCount++; }
    }
    clean.elementEdits = elementEdits;
  }
  // Per-element TEKST-overstyring (Edit-modus): { [selektor]: tekst }. textContent (ikke innerHTML)
  // → XSS-trygt av konstruksjon. Kun saniterte selektorer + lengdetak.
  const textIn = (patch as any)?.elementText;
  if (textIn && typeof textIn === 'object' && !Array.isArray(textIn)) {
    const SEL_RE = /^[A-Za-z0-9#.\-_ >:()]{1,400}$/;
    const elementText: Record<string, string> = {};
    let n = 0;
    for (const [sel, v] of Object.entries(textIn as Record<string, unknown>)) {
      if (n >= 500) break;
      if (SEL_RE.test(sel) && !sel.includes('..') && typeof v === 'string' && v.length <= 2000) { elementText[sel] = v; n++; }
    }
    clean.elementText = elementText;
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
