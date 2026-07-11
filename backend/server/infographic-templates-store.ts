// infographic-templates-store.ts — maler som DATA (tabell `infographic_templates`).
// Nye maler kan legges til via admin uten app-deploy: html + kategori lagres i DB,
// render.png laster html herfra, mal-velger + auto-velg (detectCategory) leser registeret.
//
// In-memory cache (TTL) foran DB — render.png er offentlig + rate-limitet; vi vil ikke
// treffe DB per bilde. Cache invalideres ved admin-skriv.

import type { Pool } from 'pg';
import { detectCategory, type InfographicCategory } from './infographic-engine.js';

export interface TemplateRow {
  id: string;
  label: string;
  category: InfographicCategory | 'other';
  autoPriority: number;
  accentDefault: string | null;
  isBuiltin: boolean;
  active: boolean;
}
export interface TemplateFull extends TemplateRow { html: string; }

const CACHE_TTL_MS = 60_000;
let _cache: { rows: TemplateRow[]; at: number } | null = null;
const _htmlCache = new Map<string, { html: string; at: number }>();

export function invalidateTemplateCache(): void { _cache = null; _htmlCache.clear(); }

/** Aktive maler (uten html) — til mal-velger + auto-velg. Cachet. Robust: DB-feil
 *  (f.eks. tabell ikke migrert enda) → tom liste, ikke kast. */
export async function listTemplates(pool: Pool): Promise<TemplateRow[]> {
  const now = Date.now();
  if (_cache && now - _cache.at < CACHE_TTL_MS) return _cache.rows;
  try {
    const r = await pool.query(
      `SELECT id, label, category, auto_priority, accent_default, is_builtin, active
         FROM infographic_templates WHERE active = TRUE
         ORDER BY is_builtin DESC, auto_priority DESC, label ASC`,
    );
    const rows: TemplateRow[] = r.rows.map((x: any) => ({
      id: x.id, label: x.label, category: x.category, autoPriority: x.auto_priority,
      accentDefault: x.accent_default, isBuiltin: x.is_builtin, active: x.active,
    }));
    _cache = { rows, at: now };
    return rows;
  } catch {
    return [];
  }
}

/** Alle maler inkl. inaktive (til admin-liste). Ikke cachet. */
export async function listTemplatesAdmin(pool: Pool): Promise<TemplateRow[]> {
  const r = await pool.query(
    `SELECT id, label, category, auto_priority, accent_default, is_builtin, active
       FROM infographic_templates ORDER BY is_builtin DESC, label ASC`,
  );
  return r.rows.map((x: any) => ({
    id: x.id, label: x.label, category: x.category, autoPriority: x.auto_priority,
    accentDefault: x.accent_default, isBuiltin: x.is_builtin, active: x.active,
  }));
}

/** Mal-HTML ved id. Cachet (render.png-hyppig). null hvis ukjent/inaktiv. */
export async function getTemplateHtml(pool: Pool, id: string): Promise<string | null> {
  const now = Date.now();
  const hit = _htmlCache.get(id);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.html;
  try {
    const r = await pool.query(
      `SELECT html FROM infographic_templates WHERE id = $1 AND active = TRUE`, [id],
    );
    if (!r.rows.length) return null;
    const html = r.rows[0].html as string;
    _htmlCache.set(id, { html, at: now });
    return html;
  } catch {
    return null; // tabell ikke migrert enda → kalleren faller til /embed-fetch
  }
}

// Kategori → innebygd mal-id (fallback når DB-registeret er tomt, f.eks. før migrasjon).
const CATEGORY_TO_BUILTIN_ID: Record<InfographicCategory, string> = {
  single: 'big-number', percent: 'donut', kpis: 'stat-bar', comparison: 'comparison', timeline: 'timeline',
};

/** Auto-velg: data-form → kategori → aktiv mal med den kategorien (høyest prioritet). */
export async function pickTemplateId(pool: Pool, data: Record<string, unknown> | null | undefined): Promise<string> {
  const cat = detectCategory(data);
  const rows = await listTemplates(pool);
  const match = rows.filter((r) => r.category === cat).sort((a, b) => b.autoPriority - a.autoPriority)[0];
  if (match) return match.id;
  if (rows.length) { const single = rows.find((r) => r.category === 'single'); if (single) return single.id; return rows[0].id; }
  return CATEGORY_TO_BUILTIN_ID[cat]; // tomt register → innebygd id (route faller til /embed)
}

export interface UpsertInput {
  id: string; label: string; html: string;
  category: TemplateRow['category']; autoPriority?: number; accentDefault?: string | null; active?: boolean;
}

const ID_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;
const VALID_CATEGORIES = new Set(['single', 'percent', 'kpis', 'comparison', 'timeline', 'other']);

/** Opprett/oppdater en (custom) mal. Validerer id + kontrakt. Returnerer feilmelding el. null. */
export async function upsertTemplate(pool: Pool, input: UpsertInput): Promise<{ error: string } | { ok: true }> {
  const id = String(input.id || '').trim().toLowerCase();
  if (!ID_RE.test(id)) return { error: 'Ugyldig id — små bokstaver/tall/bindestrek, 2–64 tegn.' };
  if (!VALID_CATEGORIES.has(input.category)) return { error: 'Ugyldig kategori.' };
  const html = String(input.html || '');
  if (html.length < 20) return { error: 'Mal-HTML mangler.' };
  if (html.length > 500_000) return { error: 'Mal-HTML for stor (maks 500 KB).' };
  // Kontrakt-sjekk: må definere setProgress og ha en #wrap-rot.
  if (!/setProgress/.test(html) || !/id\s*=\s*["']wrap["']/.test(html)) {
    return { error: 'Malen må definere window.setProgress(p) og ha et element med id="wrap".' };
  }
  // Ikke la admin overskrive en innebygd mal med DO UPDATE som endrer is_builtin.
  await pool.query(
    `INSERT INTO infographic_templates (id, label, html, category, auto_priority, accent_default, is_builtin, active)
     VALUES ($1,$2,$3,$4,$5,$6,FALSE,$7)
     ON CONFLICT (id) DO UPDATE SET
       label=EXCLUDED.label, html=EXCLUDED.html, category=EXCLUDED.category,
       auto_priority=EXCLUDED.auto_priority, accent_default=EXCLUDED.accent_default,
       active=EXCLUDED.active, updated_at=NOW()`,
    [id, String(input.label || id).slice(0, 200), html, input.category,
      Number.isFinite(input.autoPriority) ? input.autoPriority : 0,
      input.accentDefault ?? null, input.active !== false],
  );
  invalidateTemplateCache();
  return { ok: true };
}

/** Slett en custom mal. Innebygde (is_builtin) kan ikke slettes. */
export async function deleteTemplate(pool: Pool, id: string): Promise<{ error: string } | { ok: true }> {
  const r = await pool.query(`SELECT is_builtin FROM infographic_templates WHERE id = $1`, [id]);
  if (!r.rows.length) return { error: 'Ukjent mal.' };
  if (r.rows[0].is_builtin) return { error: 'Innebygde maler kan ikke slettes (deaktiver i stedet).' };
  await pool.query(`DELETE FROM infographic_templates WHERE id = $1`, [id]);
  invalidateTemplateCache();
  return { ok: true };
}
