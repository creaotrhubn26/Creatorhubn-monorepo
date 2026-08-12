/**
 * Leadgrid Oversikt-policy — hvem ser hvilke kort på Oversikt-fanen.
 *
 * Hierarkiet (Daniel 2026-08-05):
 *   - org/admin bestemmer hva SALGSLEDERE ser (malgruppe "leder")
 *   - salgsleder bestemmer hva SELGERE ser (malgruppe "selger")
 *   - alle tilpasser sitt eget utvalg lokalt INNENFOR policyen (klient)
 *
 * Policyen er en liste over SKJULTE kort per målgruppe — tom liste =
 * alt synlig (default). Lazy tabell, samme mønster som møte-loggen.
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";
import { resolveOrgIdForUser } from "./leadgrid-org-resolver.js";

const GYLDIGE_KORT = new Set(["kpi", "dorsalg", "neste_handling", "oppgaver", "leads"]);
// Canvas-funksjonene org-en kan rolle-styre (samme hierarki som kortene).
const GYLDIGE_CANVAS_FUNKSJONER = new Set([
  "deling", "pdf", "bilder", "livekort", "tidsreise",
  "kundeminne", "bibliotek", "analyse",
]);
const GYLDIGE_MALGRUPPER = new Set(["selger", "leder"]);
const ADMIN_ROLLER = ["super_admin", "admin", "owner"];
const LEDER_ROLLER = [...ADMIN_ROLLER, "markedssjef", "salgssjef", "teamleder"];

let schemaReady = false;
async function ensureSchema(pool: Pool): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_oversikt_policy (
      organization_id TEXT NOT NULL,
      malgruppe TEXT NOT NULL,
      skjulte_kort JSONB NOT NULL DEFAULT '[]',
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, malgruppe)
    )`);
  // Canvas rolle-policy: org styrer salgslederes/selgeres Canvas-funksjoner.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leadgrid_canvas_policy (
      organization_id TEXT NOT NULL,
      malgruppe TEXT NOT NULL,
      skjulte_funksjoner JSONB NOT NULL DEFAULT '[]',
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (organization_id, malgruppe)
    )`);
  schemaReady = true;
}

async function hentRoller(pool: Pool, userId: string): Promise<{
  globalRole: string | null; orgRole: string | null;
}> {
  const u = await pool.query<{ role: string | null }>(
    `SELECT role FROM users WHERE id = $1`, [userId]);
  const m = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members
      WHERE user_id = $1 ORDER BY role = 'owner' DESC LIMIT 1`, [userId]);
  return {
    globalRole: u.rows[0]?.role ?? null,
    orgRole: m.rows[0]?.role ?? null,
  };
}

function harRolle(roller: { globalRole: string | null; orgRole: string | null },
                  tillatte: string[]): boolean {
  return tillatte.includes(roller.globalRole ?? "")
      || tillatte.includes(roller.orgRole ?? "");
}

export function registerLeadgridOversiktRoutes(deps: {
  app: Express;
  pool: Pool;
  requireUserSession: (req: Request, res: Response) => { userId: string } | null | Promise<{ userId: string } | null>;
}): void {
  const { app, pool, requireUserSession } = deps;

  /** Hele policyen for org-en (alle innloggede — klienten velger sitt lag). */
  app.get("/api/leadgrid/oversikt-policy", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.json({ selger: [], leder: [] }); return; }
      await ensureSchema(pool);
      const r = await pool.query<{ malgruppe: string; skjulte_kort: unknown }>(
        `SELECT malgruppe, skjulte_kort FROM leadgrid_oversikt_policy
          WHERE organization_id = $1`, [orgId]);
      const ut: Record<string, string[]> = { selger: [], leder: [] };
      for (const row of r.rows) {
        if (GYLDIGE_MALGRUPPER.has(row.malgruppe) && Array.isArray(row.skjulte_kort)) {
          ut[row.malgruppe] = (row.skjulte_kort as unknown[]).map(String)
            .filter((k) => GYLDIGE_KORT.has(k));
        }
      }
      res.json(ut);
    } catch (e) {
      console.error("[oversikt-policy] GET failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /**
   * Sett skjulte kort for en målgruppe.
   *   malgruppe "selger" → krever leder-rolle (admin/markedssjef/salgssjef/teamleder)
   *   malgruppe "leder"  → krever admin/owner (org-nivået)
   */
  app.put("/api/leadgrid/oversikt-policy", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const b = (req.body ?? {}) as Record<string, unknown>;
      const malgruppe = String(b.malgruppe ?? "");
      if (!GYLDIGE_MALGRUPPER.has(malgruppe)) {
        res.status(400).json({ error: "bad_request", message: "malgruppe må være selger eller leder" });
        return;
      }
      const skjulte = (Array.isArray(b.skjulte_kort) ? b.skjulte_kort : [])
        .map(String).filter((k) => GYLDIGE_KORT.has(k)).slice(0, 10);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(403).json({ error: "ingen_org" }); return; }
      const roller = await hentRoller(pool, session.userId);
      const krav = malgruppe === "leder" ? ADMIN_ROLLER : LEDER_ROLLER;
      if (!harRolle(roller, krav)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      await ensureSchema(pool);
      await pool.query(
        `INSERT INTO leadgrid_oversikt_policy
           (organization_id, malgruppe, skjulte_kort, updated_by, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, now())
         ON CONFLICT (organization_id, malgruppe)
         DO UPDATE SET skjulte_kort = EXCLUDED.skjulte_kort,
                       updated_by = EXCLUDED.updated_by,
                       updated_at = now()`,
        [orgId, malgruppe, JSON.stringify(skjulte), session.userId]);
      res.json({ ok: true, malgruppe, skjulte_kort: skjulte });
    } catch (e) {
      console.error("[oversikt-policy] PUT failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Canvas rolle-policy: hvilke Canvas-funksjoner er skjult per rolle. */
  app.get("/api/leadgrid/canvas-rolle-policy", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.json({ selger: [], leder: [] }); return; }
      await ensureSchema(pool);
      const r = await pool.query<{ malgruppe: string; skjulte_funksjoner: unknown }>(
        `SELECT malgruppe, skjulte_funksjoner FROM leadgrid_canvas_policy
          WHERE organization_id = $1`, [orgId]);
      const ut: Record<string, string[]> = { selger: [], leder: [] };
      for (const row of r.rows) {
        if (GYLDIGE_MALGRUPPER.has(row.malgruppe) && Array.isArray(row.skjulte_funksjoner)) {
          ut[row.malgruppe] = (row.skjulte_funksjoner as unknown[]).map(String)
            .filter((k) => GYLDIGE_CANVAS_FUNKSJONER.has(k));
        }
      }
      res.json(ut);
    } catch (e) {
      console.error("[canvas-policy] GET failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });

  /** Sett Canvas-funksjoner for en målgruppe (samme rolle-krav som kortene:
   *  «selger» krever leder-rolle, «leder» krever admin/owner). */
  app.put("/api/leadgrid/canvas-rolle-policy", async (req, res) => {
    try {
      const session = await requireUserSession(req, res);
      if (!session) return;
      const b = (req.body ?? {}) as Record<string, unknown>;
      const malgruppe = String(b.malgruppe ?? "");
      if (!GYLDIGE_MALGRUPPER.has(malgruppe)) {
        res.status(400).json({ error: "bad_request" });
        return;
      }
      const skjulte = (Array.isArray(b.skjulte_funksjoner) ? b.skjulte_funksjoner : [])
        .map(String).filter((k) => GYLDIGE_CANVAS_FUNKSJONER.has(k)).slice(0, 12);
      const orgId = await resolveOrgIdForUser(pool, session.userId).catch(() => null);
      if (!orgId) { res.status(403).json({ error: "ingen_org" }); return; }
      const roller = await hentRoller(pool, session.userId);
      const krav = malgruppe === "leder" ? ADMIN_ROLLER : LEDER_ROLLER;
      if (!harRolle(roller, krav)) { res.status(403).json({ error: "forbidden" }); return; }
      await ensureSchema(pool);
      await pool.query(
        `INSERT INTO leadgrid_canvas_policy
           (organization_id, malgruppe, skjulte_funksjoner, updated_by, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, now())
         ON CONFLICT (organization_id, malgruppe)
         DO UPDATE SET skjulte_funksjoner = EXCLUDED.skjulte_funksjoner,
                       updated_by = EXCLUDED.updated_by,
                       updated_at = now()`,
        [orgId, malgruppe, JSON.stringify(skjulte), session.userId]);
      res.json({ ok: true, malgruppe, skjulte_funksjoner: skjulte });
    } catch (e) {
      console.error("[canvas-policy] PUT failed:", e);
      res.status(500).json({ error: "internal_error" });
    }
  });
}
