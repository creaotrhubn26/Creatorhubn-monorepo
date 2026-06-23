/**
 * lead-map-promotion-routes.ts
 *
 * Forfremmelses-wizard. Endrer rolle + (valgfritt) tittel + team + kvote
 * i én atomisk transaksjon, og logger til member_role_changes for audit.
 *
 *   POST /organizations/:id/members/:userId/promote
 *     {
 *       to_role: 'salgssjef' | 'teamleder' | ...,
 *       new_title?: string,
 *       team_transition: 'kept' | 'left' | 'reassigned',
 *       new_sales_team_id?: string (krevd hvis 'reassigned'),
 *       new_quota_nok?: number,
 *       year_month?: 'YYYY-MM' (default: inneværende),
 *       reason?: string,
 *     }
 *
 *   GET  /members/:userId/role-history (siste 20 rolle-endringer)
 *
 * Tilgang:
 *   - Krever 'members.change_role' permission (default admin/salgssjef)
 *   - Ekstra-sjekk: kan ikke forfremme NOEN til admin (mig 285 begrenser
 *     'siste admin'-vern; vi tillater bare admin-tildeling via direkte
 *     PATCH /members/:userId-endepunktet med ekstra sjekk)
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };
interface Deps {
  app: Express;
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUser(
  req: Request,
  activeSessions: Map<string, SessionData>,
): SessionData | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return activeSessions.get(auth.slice(7)) ?? null;
  }
  return null;
}

const ROLE_RANK: Record<string, number> = {
  admin: 7,
  salgssjef: 6,
  teamleder: 5,
  salgskonsulent: 4,
  promotor: 3,
  member: 2,
  viewer: 1,
};

function classifyChange(from: string | null, to: string): string {
  const fr = ROLE_RANK[from ?? ""] ?? 0;
  const tr = ROLE_RANK[to] ?? 0;
  if (fr < tr) return "promotion";
  if (fr > tr) return "demotion";
  return "lateral";
}

const VALID_TARGET_ROLES = new Set([
  "salgssjef", "teamleder", "salgskonsulent", "promotor", "member", "viewer",
]);

function yearMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function callerCanChangeRoles(
  pool: Pool, callerId: string, orgId: string,
): Promise<boolean> {
  const r = await pool.query<{ role: string }>(
    `SELECT role FROM organization_members
      WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
    [orgId, callerId],
  );
  const role = r.rows[0]?.role;
  if (!role) return false;
  // admin har alle permissions; ellers sjekk role_permissions
  if (role === "admin") return true;
  const p = await pool.query(
    `SELECT 1 FROM role_permissions
      WHERE role = $1 AND permission_key = 'members.change_role' LIMIT 1`,
    [role],
  );
  return (p.rowCount ?? 0) > 0;
}

export function registerLeadMapPromotionRoutes({ app, pool, activeSessions }: Deps): void {
  // ─── POST /members/:userId/promote ──────────────────────────────
  app.post(
    "/api/admin-room/lead-map/organizations/:id/members/:userId/promote",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const orgId = req.params.id;
      const targetUserId = req.params.userId;
      const body = req.body as {
        to_role?: string;
        new_title?: string;
        team_transition?: "kept" | "left" | "reassigned";
        new_sales_team_id?: string;
        new_quota_nok?: number;
        year_month?: string;
        reason?: string;
      };

      if (!body.to_role || !VALID_TARGET_ROLES.has(body.to_role)) {
        return res.status(400).json({ error: "ugyldig_rolle" });
      }
      if (!body.team_transition || !["kept","left","reassigned"].includes(body.team_transition)) {
        return res.status(400).json({ error: "ugyldig_team_transition" });
      }
      if (body.team_transition === "reassigned" && !body.new_sales_team_id) {
        return res.status(400).json({ error: "mangler_nytt_team" });
      }

      const canChange = await callerCanChangeRoles(pool, session.userId, orgId);
      if (!canChange) {
        return res.status(403).json({ error: "mangler_change_role_permission" });
      }
      if (targetUserId === session.userId) {
        return res.status(400).json({ error: "kan_ikke_forfremme_seg_selv" });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        // Hent eksisterende status
        const memRes = await client.query<{
          role: string; sales_team_id: string | null;
        }>(
          `SELECT role, sales_team_id::text
             FROM organization_members
            WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
          [orgId, targetUserId],
        );
        if (memRes.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ error: "ikke_medlem" });
        }
        const fromRole = memRes.rows[0].role;
        const fromTeamId = memRes.rows[0].sales_team_id;

        const profRes = await client.query<{
          title: string | null; quota_monthly_nok: string | null;
        }>(
          `SELECT title, quota_monthly_nok::text
             FROM user_profiles
            WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
          [orgId, targetUserId],
        );
        const fromTitle = profRes.rows[0]?.title ?? null;
        const fromQuota = profRes.rows[0]?.quota_monthly_nok
          ? Number(profRes.rows[0].quota_monthly_nok)
          : null;

        // Beregn permissions-diff fra role_permissions
        const fromPerms = await client.query<{ permission_key: string }>(
          `SELECT permission_key FROM role_permissions WHERE role = $1`,
          [fromRole],
        );
        const toPerms = await client.query<{ permission_key: string }>(
          `SELECT permission_key FROM role_permissions WHERE role = $1`,
          [body.to_role],
        );
        const fromSet = new Set(fromPerms.rows.map((r) => r.permission_key));
        const toSet = new Set(toPerms.rows.map((r) => r.permission_key));
        const gained = Array.from(toSet).filter((p) => !fromSet.has(p)).length;
        const lost = Array.from(fromSet).filter((p) => !toSet.has(p)).length;

        // 1. Oppdater rolle + team
        const newTeamId =
          body.team_transition === "kept" ? fromTeamId
          : body.team_transition === "left" ? null
          : body.new_sales_team_id ?? null;
        await client.query(
          `UPDATE organization_members
              SET role = $3, sales_team_id = $4
            WHERE organization_id = $1 AND user_id = $2`,
          [orgId, targetUserId, body.to_role, newTeamId],
        );

        // 2. Oppdater tittel (hvis sendt)
        if (typeof body.new_title === "string") {
          await client.query(
            `INSERT INTO user_profiles (user_id, organization_id, title)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, organization_id) DO UPDATE
               SET title = EXCLUDED.title, updated_at = NOW()`,
            [targetUserId, orgId, body.new_title],
          );
        }

        // 3. Sett ny kvote (hvis sendt)
        if (typeof body.new_quota_nok === "number") {
          const ym = body.year_month ?? yearMonth();
          await client.query(
            `INSERT INTO lead_quota_targets (
               organization_id, user_id, year_month, target_nok, set_by_user_id
             ) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (organization_id, user_id, year_month) DO UPDATE
               SET target_nok = EXCLUDED.target_nok, updated_at = NOW()`,
            [orgId, targetUserId, ym, body.new_quota_nok, session.userId],
          );
        }

        // 4. Audit-log
        const change_type = classifyChange(fromRole, body.to_role);
        await client.query(
          `INSERT INTO member_role_changes (
             organization_id, user_id,
             from_role, to_role, change_type,
             from_title, to_title,
             from_sales_team_id, to_sales_team_id,
             from_quota_nok, to_quota_nok,
             performed_by_user_id, reason,
             team_transition,
             permissions_gained, permissions_lost
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
           )`,
          [
            orgId, targetUserId,
            fromRole, body.to_role, change_type,
            fromTitle, body.new_title ?? fromTitle,
            fromTeamId, newTeamId,
            fromQuota, body.new_quota_nok ?? fromQuota,
            session.userId, body.reason ?? null,
            body.team_transition,
            gained, lost,
          ],
        );

        await client.query("COMMIT");
        return res.json({
          ok: true,
          change_type,
          from_role: fromRole,
          to_role: body.to_role,
          permissions_gained: gained,
          permissions_lost: lost,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        return res.status(500).json({ error: "promote_failed", detail: String(err) });
      } finally {
        client.release();
      }
    },
  );

  // ─── GET /members/:userId/role-history ──────────────────────────
  app.get(
    "/api/admin-room/lead-map/organizations/:id/members/:userId/role-history",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      try {
        const r = await pool.query(
          `SELECT mrc.id::text, mrc.from_role, mrc.to_role, mrc.change_type,
                  mrc.from_title, mrc.to_title,
                  mrc.from_sales_team_id::text, mrc.to_sales_team_id::text,
                  mrc.from_quota_nok::text, mrc.to_quota_nok::text,
                  mrc.permissions_gained, mrc.permissions_lost,
                  mrc.team_transition, mrc.reason,
                  mrc.performed_at::text,
                  NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '') AS performed_by_name,
                  u.email AS performed_by_email,
                  st_from.name AS from_team_name,
                  st_to.name AS to_team_name
             FROM member_role_changes mrc
             LEFT JOIN users u ON u.id = mrc.performed_by_user_id
             LEFT JOIN sales_teams st_from ON st_from.id = mrc.from_sales_team_id
             LEFT JOIN sales_teams st_to ON st_to.id = mrc.to_sales_team_id
            WHERE mrc.organization_id = $1 AND mrc.user_id = $2
            ORDER BY mrc.performed_at DESC
            LIMIT 20`,
          [req.params.id, req.params.userId],
        );
        return res.json({ history: r.rows });
      } catch (err) {
        return res.status(500).json({ error: "history_failed", detail: String(err) });
      }
    },
  );

  // ─── GET /promotion-preview ─────────────────────────────────────
  // Returnerer permission-diff og forslag-tittel/kvote for en
  // hypotetisk rolle-endring (uten å committe).
  app.get(
    "/api/admin-room/lead-map/organizations/:id/members/:userId/promotion-preview",
    async (req: Request, res: Response) => {
      const session = getUser(req, activeSessions);
      if (!session?.userId) return res.status(401).json({ error: "Innlogging kreves" });
      const toRole = req.query.to_role as string;
      if (!toRole || !VALID_TARGET_ROLES.has(toRole)) {
        return res.status(400).json({ error: "ugyldig_to_role" });
      }
      try {
        const memRes = await pool.query<{ role: string; sales_team_id: string | null }>(
          `SELECT role, sales_team_id::text
             FROM organization_members
            WHERE organization_id = $1 AND user_id = $2 LIMIT 1`,
          [req.params.id, req.params.userId],
        );
        if (memRes.rows.length === 0) return res.status(404).json({ error: "ikke_medlem" });
        const fromRole = memRes.rows[0].role;

        const fromPerms = await pool.query<{ permission_key: string }>(
          `SELECT permission_key FROM role_permissions WHERE role = $1`,
          [fromRole],
        );
        const toPerms = await pool.query<{ permission_key: string }>(
          `SELECT permission_key FROM role_permissions WHERE role = $1`,
          [toRole],
        );
        const fromSet = new Set(fromPerms.rows.map((r) => r.permission_key));
        const toSet = new Set(toPerms.rows.map((r) => r.permission_key));
        const gained = Array.from(toSet).filter((p) => !fromSet.has(p));
        const lost = Array.from(fromSet).filter((p) => !toSet.has(p));

        // Hent permission-katalog-detaljer for gained/lost
        const catRes = await pool.query<{ key: string; category: string; description: string }>(
          `SELECT key, category, description FROM permissions
            WHERE key = ANY($1::text[])`,
          [Array.from(new Set([...gained, ...lost]))],
        );
        const catalogByKey = new Map(catRes.rows.map((r) => [r.key, r]));

        return res.json({
          from_role: fromRole,
          to_role: toRole,
          change_type: classifyChange(fromRole, toRole),
          permissions_gained: gained.map((k) => catalogByKey.get(k) ?? { key: k, category: "?", description: k }),
          permissions_lost: lost.map((k) => catalogByKey.get(k) ?? { key: k, category: "?", description: k }),
          /** Forslag basert på rolle-maler */
          suggestion: roleTemplate(toRole),
        });
      } catch (err) {
        return res.status(500).json({ error: "preview_failed", detail: String(err) });
      }
    },
  );
}

/** Standard maler: tittel + kvote per rolle */
function roleTemplate(role: string): { title?: string; quota_nok?: number } {
  switch (role) {
    case "salgssjef":
      return { title: "Salgssjef", quota_nok: 500_000 };
    case "teamleder":
      return { title: "Teamleder", quota_nok: 300_000 };
    case "salgskonsulent":
      return { title: "Salgskonsulent", quota_nok: 200_000 };
    case "promotor":
      return { title: "Promotør", quota_nok: 100_000 };
    default:
      return {};
  }
}
