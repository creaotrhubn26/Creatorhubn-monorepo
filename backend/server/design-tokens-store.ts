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

/** Sett/oppdater tokens for et workspace (admin). Slår sammen med eksisterende (patch). */
export async function setTokens(pool: Pool, workspace: string, patch: Record<string, unknown>): Promise<{ error: string } | { ok: true }> {
  const ws = workspace === 'global' ? 'global' : normalizeWorkspace(workspace);
  if (!ws) return { error: 'Ugyldig workspace.' };
  // Kun kjente string-tokens (hex-farger + fontFamily) — unngå vilkårlig JSON-injeksjon.
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch || {})) {
    if (typeof v === 'string' && v.length <= 200 && /^[A-Za-z0-9#,._"'()\-\s]*$/.test(v)) clean[k] = v;
  }
  await pool.query(
    `INSERT INTO workspace_design_tokens (workspace_id, tokens) VALUES ($1, $2::jsonb)
     ON CONFLICT (workspace_id) DO UPDATE SET tokens = workspace_design_tokens.tokens || EXCLUDED.tokens, updated_at = NOW()`,
    [ws, JSON.stringify(clean)],
  );
  invalidateTokensCache();
  return { ok: true };
}
