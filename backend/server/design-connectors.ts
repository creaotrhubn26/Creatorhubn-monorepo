// design-connectors.ts — LIVE datakilder for design-systemet (infographics/bindinger).
//
// I motsetning til `metrics` (admin-satte tall) resolver disse fra den EKTE databasen: en bind
// mot en connector viser alltid gjeldende verdi. Registeret ligger i KODEN (ikke frontend-hardkodet),
// så «sjekker databasen for riktige koblinger» = disse SQL-ene kjøres og verifiseres.
//
// SIKKERHET: kun `publicSafe`-connectors kan rendres på offentlige flater (landinger). Hold dem til
// markedsførings-vennlige aggregater (antall, ikke PII). Alle spørringer kjøres defensivt (mangler
// tabell/feil → null → «⚠ ingen data», aldri kræsj). COUNT(*) unngår kolonne-antakelser.
import type { Pool } from 'pg';

export type LiveConnector = {
  key: string;
  label: string;
  type: 'number' | 'text';
  workspaces: string[];      // hvilke produkter kan bruke den
  publicSafe: boolean;       // trygg å rendre på offentlige sider?
  sql: string;               // må returnere kolonne `v`
};

// Seed-register. Utvid ved å legge til her (med en trygg COUNT-spørring).
export const LIVE_CONNECTORS: LiveConnector[] = [
  { key: 'casting_projects', label: 'Castingprosjekter', type: 'number', workspaces: ['theroleroom', 'creatorhub'], publicSafe: true, sql: 'SELECT COUNT(*)::int AS v FROM casting_projects' },
  { key: 'academy_enrollments', label: 'Academy-påmeldinger', type: 'number', workspaces: ['creatorhub', 'theroleroom'], publicSafe: true, sql: 'SELECT COUNT(*)::int AS v FROM academy_enrollments' },
  { key: 'agency_leads', label: 'Leads generert', type: 'number', workspaces: ['leadgrid'], publicSafe: true, sql: 'SELECT COUNT(*)::int AS v FROM agency_leads' },
];

/** Resolver én connector til sin gjeldende verdi fra DB. `requirePublicSafe` for offentlig render. */
export async function resolveConnector(pool: Pool, key: string, opts: { requirePublicSafe?: boolean } = {}): Promise<number | string | null> {
  const c = LIVE_CONNECTORS.find((x) => x.key === key);
  if (!c || (opts.requirePublicSafe && !c.publicSafe)) return null;
  try {
    const r = await pool.query<{ v: number | string }>(c.sql);
    const v = r.rows[0]?.v;
    return v == null ? null : v;
  } catch { return null; }
}

/** List connectors for et workspace MED resolvert verdi + ok-flagg (for picker + verifisering). */
export async function listLiveConnectors(pool: Pool, ws: string): Promise<Array<{ key: string; label: string; type: string; value: number | string | null; ok: boolean; live: true }>> {
  const list = LIVE_CONNECTORS.filter((c) => c.workspaces.includes(ws));
  const out: Array<{ key: string; label: string; type: string; value: number | string | null; ok: boolean; live: true }> = [];
  for (const c of list) {
    const value = await resolveConnector(pool, c.key);
    out.push({ key: c.key, label: c.label, type: c.type, value, ok: value != null, live: true });
  }
  return out;
}
