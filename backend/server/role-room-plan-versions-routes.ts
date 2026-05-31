/**
 * Versjonering for markedsplaner — analog til intake-versions.
 *
 * Hver gang Agent genererer en ny plan (eller bruker editerer), kaller
 * vi snapshotPlanVersion() som lagrer { plan, pillars, posts } som én
 * snapshot. Brukeren kan deretter rulle tilbake til en gammel versjon.
 *
 * Endepunkter:
 *   GET    /api/role-room/marketing-plan/:projectId/versions
 *   POST   /api/role-room/marketing-plan/:projectId/versions/:versionId/activate
 *   POST   /api/role-room/marketing-plan/:projectId/versions/:versionId/label
 *   DELETE /api/role-room/marketing-plan/:projectId/versions/:versionId
 */

import type { Express, Request, Response } from "express";
import type { Pool } from "pg";

type SessionData = { userId: string; role?: string; email?: string };

interface Deps {
  pool: Pool;
  activeSessions: Map<string, SessionData>;
}

function getUserIdFromRequest(
  req: Request, activeSessions: Map<string, SessionData>,
): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const session = activeSessions.get(token);
    if (session?.userId) return session.userId;
  }
  return null;
}

async function viewerCanAccessProject(
  pool: Pool, projectId: string, viewerId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ owns: boolean; member: boolean }>(
    `SELECT
       EXISTS(SELECT 1 FROM casting_projects
               WHERE id = $1 AND created_by = $2) AS owns,
       EXISTS(SELECT 1 FROM casting_user_roles
               WHERE project_id = $1 AND user_id = $2
                 AND deactivated_at IS NULL) AS member`,
    [projectId, viewerId],
  );
  return rows[0]?.owns === true || rows[0]?.member === true;
}

/**
 * Skriv en snapshot av nåværende plan + pillars + posts. Brukes etter
 * hver write til marketing-plan-flyten.
 */
export async function snapshotPlanVersion(
  pool: Pool,
  args: {
    projectId: string;
    generatedByUserId: string | null;
    generatedByKind?: 'user' | 'agent';
    label?: string | null;
  },
): Promise<{ versionId: string; versionNumber: number } | null> {
  const { projectId, generatedByUserId } = args;
  const kind = args.generatedByKind ?? 'agent';
  const label = args.label ?? null;
  try {
    // Hent aktiv plan
    const { rows: planRows } = await pool.query<{
      planId: string; plan: Record<string, unknown>;
    }>(
      `SELECT id AS "planId", to_jsonb(role_room_marketing_plans.*) AS plan
         FROM role_room_marketing_plans
        WHERE project_id = $1 AND status = 'active'
        ORDER BY created_at DESC LIMIT 1`,
      [projectId],
    );
    if (planRows.length === 0) return null;
    const planId = planRows[0].planId;

    // Hent pillars + posts
    const { rows: pillarRows } = await pool.query<{ pillar: unknown }>(
      `SELECT to_jsonb(role_room_marketing_plan_pillars.*) AS pillar
         FROM role_room_marketing_plan_pillars
        WHERE plan_id = $1 ORDER BY sort_order`,
      [planId],
    );
    const { rows: postRows } = await pool.query<{ post: unknown }>(
      `SELECT to_jsonb(role_room_marketing_plan_posts.*) AS post
         FROM role_room_marketing_plan_posts
        WHERE plan_id = $1 ORDER BY day_offset NULLS LAST, sort_order`,
      [planId],
    );

    const snapshot = {
      plan: planRows[0].plan,
      pillars: pillarRows.map(r => r.pillar),
      posts: postRows.map(r => r.post),
    };

    const { rows: nRows } = await pool.query<{ next_n: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_n
         FROM role_room_marketing_plans_versions
        WHERE project_id = $1`,
      [projectId],
    );
    const versionNumber = nRows[0]?.next_n ?? 1;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE role_room_marketing_plans_versions
            SET is_active = FALSE
          WHERE project_id = $1 AND is_active = TRUE`,
        [projectId],
      );
      const { rows: insRows } = await client.query<{ id: string }>(
        `INSERT INTO role_room_marketing_plans_versions
           (project_id, plan_id, version_number, label, snapshot,
            generated_by_user_id, generated_by_kind, is_active)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, TRUE)
         RETURNING id`,
        [projectId, planId, versionNumber, label,
         JSON.stringify(snapshot), generatedByUserId, kind],
      );
      await client.query("COMMIT");
      return { versionId: insRows[0].id, versionNumber };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.warn("[plan-versions] snapshot feilet", e);
    return null;
  }
}

export function registerRoleRoomPlanVersionsRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  app.get(
    "/api/role-room/marketing-plan/:projectId/versions",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = req.params.projectId;
      if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
        res.status(403).json({ error: "ingen_tilgang" }); return;
      }
      const { rows } = await pool.query<{
        id: string; versionNumber: number; label: string | null;
        generatedByKind: string; generatedByUserId: string | null;
        generatedByName: string | null;
        isActive: boolean; createdAt: Date;
        valueProp: string | null; pillarCount: number; postCount: number;
      }>(
        `SELECT v.id::text,
                v.version_number    AS "versionNumber",
                v.label,
                v.generated_by_kind AS "generatedByKind",
                v.generated_by_user_id::text AS "generatedByUserId",
                u.email             AS "generatedByName",
                v.is_active         AS "isActive",
                v.created_at        AS "createdAt",
                v.snapshot->'plan'->'strategy'->'positioning'->>'valueProp'
                                                AS "valueProp",
                jsonb_array_length(v.snapshot->'pillars') AS "pillarCount",
                jsonb_array_length(v.snapshot->'posts')   AS "postCount"
           FROM role_room_marketing_plans_versions v
           LEFT JOIN users u ON u.id = v.generated_by_user_id
          WHERE v.project_id = $1
          ORDER BY v.version_number DESC
          LIMIT 50`,
        [projectId],
      );
      res.status(200).json({ ok: true, versions: rows });
    },
  );

  // Activate er mer komplisert enn intake — vi må re-skrive 3 tabeller
  // fra snapshot. For MVP: vi nuller posts + pillars og insert-er fra
  // snapshot. Plan-id bevares (vi oppdaterer strategy + horizon).
  app.post(
    "/api/role-room/marketing-plan/:projectId/versions/:versionId/activate",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = req.params.projectId;
      const versionId = req.params.versionId;
      if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
        res.status(403).json({ error: "ingen_tilgang" }); return;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const { rows } = await client.query<{ snapshot: {
          plan: Record<string, unknown>;
          pillars: Array<Record<string, unknown>>;
          posts: Array<Record<string, unknown>>;
        } }>(
          `SELECT snapshot FROM role_room_marketing_plans_versions
            WHERE id = $1 AND project_id = $2`,
          [versionId, projectId],
        );
        if (rows.length === 0) {
          await client.query("ROLLBACK");
          res.status(404).json({ error: "versjon_ikke_funnet" }); return;
        }
        const snap = rows[0].snapshot;
        const planId = snap.plan.id as string;

        // Sjekk at planen fortsatt finnes — hvis Daniel slettet den, har
        // vi ingen target-rad å oppdatere. Da gir vi feil.
        const { rows: planChk } = await client.query(
          `SELECT 1 FROM role_room_marketing_plans WHERE id = $1`, [planId],
        );
        if (planChk.length === 0) {
          await client.query("ROLLBACK");
          res.status(400).json({ error: "plan_slettet_kan_ikke_aktiveres" });
          return;
        }

        // Oppdater plan-strategy + horizon + status='active'
        await client.query(
          `UPDATE role_room_marketing_plans SET
              strategy = $1::jsonb,
              horizon_days = $2,
              start_date = $3,
              status = 'active',
              updated_at = now()
            WHERE id = $4`,
          [
            JSON.stringify(snap.plan.strategy ?? {}),
            (snap.plan.horizon_days as number) ?? 30,
            (snap.plan.start_date as string | null) ?? null,
            planId,
          ],
        );

        // Drop+insert pillars
        await client.query(
          `DELETE FROM role_room_marketing_plan_pillars WHERE plan_id = $1`,
          [planId],
        );
        for (const p of snap.pillars) {
          await client.query(
            `INSERT INTO role_room_marketing_plan_pillars
               (id, plan_id, name, description, rationale,
                target_kpi, sort_order, is_active, is_custom,
                created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, now(), now())`,
            [
              p.id, planId, p.name, p.description ?? null,
              p.rationale ?? null,
              p.target_kpi ? JSON.stringify(p.target_kpi) : null,
              p.sort_order ?? 0,
              p.is_active !== false,
              p.is_custom === true,
            ],
          );
        }

        // Drop+insert posts
        await client.query(
          `DELETE FROM role_room_marketing_plan_posts WHERE plan_id = $1`,
          [planId],
        );
        for (const post of snap.posts) {
          await client.query(
            `INSERT INTO role_room_marketing_plan_posts
               (id, plan_id, pillar_id, sort_order, day_offset,
                hook, format, script, caption_draft, call_to_action,
                primary_platform, cross_post_plan, goal_kpi, status,
                created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                     $11, $12::jsonb, $13::jsonb, $14, now(), now())`,
            [
              post.id, planId, post.pillar_id ?? null,
              post.sort_order ?? 0, post.day_offset ?? null,
              post.hook ?? "", post.format ?? "image",
              post.script ?? null, post.caption_draft ?? null,
              post.call_to_action ?? null,
              post.primary_platform ?? null,
              post.cross_post_plan ? JSON.stringify(post.cross_post_plan) : '[]',
              post.goal_kpi ? JSON.stringify(post.goal_kpi) : null,
              post.status ?? 'proposed',
            ],
          );
        }

        // Flipp aktiv
        await client.query(
          `UPDATE role_room_marketing_plans_versions
              SET is_active = FALSE
            WHERE project_id = $1 AND is_active = TRUE`,
          [projectId],
        );
        await client.query(
          `UPDATE role_room_marketing_plans_versions
              SET is_active = TRUE
            WHERE id = $1`,
          [versionId],
        );
        await client.query("COMMIT");
        res.status(200).json({ ok: true, activatedVersionId: versionId });
      } catch (e) {
        await client.query("ROLLBACK");
        console.error("[plan-versions] activate feilet", e);
        res.status(500).json({ error: "aktivering_feilet" });
      } finally {
        client.release();
      }
    },
  );

  app.post(
    "/api/role-room/marketing-plan/:projectId/versions/:versionId/label",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = req.params.projectId;
      const versionId = req.params.versionId;
      const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
      const label = typeof body.label === "string" ? body.label.slice(0, 120) : null;
      if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
        res.status(403).json({ error: "ingen_tilgang" }); return;
      }
      const { rowCount } = await pool.query(
        `UPDATE role_room_marketing_plans_versions
            SET label = $1
          WHERE id = $2 AND project_id = $3`,
        [label, versionId, projectId],
      );
      if (rowCount === 0) {
        res.status(404).json({ error: "versjon_ikke_funnet" }); return;
      }
      res.status(200).json({ ok: true });
    },
  );

  app.delete(
    "/api/role-room/marketing-plan/:projectId/versions/:versionId",
    async (req: Request, res: Response) => {
      const viewerId = getUserIdFromRequest(req, activeSessions);
      if (!viewerId) {
        res.status(401).json({ error: "krever_innlogging" }); return;
      }
      const projectId = req.params.projectId;
      const versionId = req.params.versionId;
      if (!await viewerCanAccessProject(pool, projectId, viewerId)) {
        res.status(403).json({ error: "ingen_tilgang" }); return;
      }
      const { rows: chk } = await pool.query<{ isActive: boolean }>(
        `SELECT is_active AS "isActive"
           FROM role_room_marketing_plans_versions
          WHERE id = $1 AND project_id = $2`,
        [versionId, projectId],
      );
      if (chk.length === 0) {
        res.status(404).json({ error: "versjon_ikke_funnet" }); return;
      }
      if (chk[0].isActive) {
        res.status(400).json({ error: "kan_ikke_slette_aktiv_versjon" }); return;
      }
      await pool.query(
        `DELETE FROM role_room_marketing_plans_versions
          WHERE id = $1 AND project_id = $2`,
        [versionId, projectId],
      );
      res.status(200).json({ ok: true });
    },
  );
}
