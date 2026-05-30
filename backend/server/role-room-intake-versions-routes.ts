/**
 * Research-versjonering for klient-intake.
 *
 * Hver lagring av klient-intake (research-flowen) skal nå ALSO skrive
 * en snapshot til role_room_client_intake_versions. Innholdsprodusenten
 * kan bla i historikken og bytte aktiv versjon når Agent re-genererer
 * noe han ikke liker.
 *
 * Endepunkter:
 *   GET    /api/role-room/research/:projectId/versions
 *   POST   /api/role-room/research/:projectId/versions/:versionId/activate
 *   POST   /api/role-room/research/:projectId/versions/:versionId/label
 *   DELETE /api/role-room/research/:projectId/versions/:versionId
 *
 * Snapshot-funksjonen er separat eksportert slik at de tre eksisterende
 * INSERT-stedene (role-room-routes.ts:8475, :14535,
 * role-room-integrations-v1-routes.ts:2404) kan trigge den uten
 * sirkulær import.
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
 * Skriv en ny snapshot av nåværende intake-rad. Setter is_active=true
 * på den nye versjonen og false på alle andre versjoner for samme
 * prosjekt. Idempotent når intake-raden ikke har endret seg —
 * versjon_number øker uansett (vi bruker ikke content-hash).
 */
export async function snapshotIntakeVersion(
  pool: Pool,
  args: {
    projectId: string;
    generatedByUserId: string | null;
    generatedByKind?: 'user' | 'agent';
    label?: string | null;
  },
): Promise<{ versionId: string; versionNumber: number } | null> {
  const { projectId, generatedByUserId, label } = args;
  const kind = args.generatedByKind ?? 'user';
  try {
    // Hent nåværende intake-rad som JSON
    const { rows } = await pool.query<{ snapshot: unknown }>(
      `SELECT to_jsonb(role_room_client_intake.*) AS snapshot
         FROM role_room_client_intake
        WHERE project_id = $1`,
      [projectId],
    );
    if (rows.length === 0) return null;

    // Neste versjons-nummer
    const { rows: nRows } = await pool.query<{ next_n: number }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_n
         FROM role_room_client_intake_versions
        WHERE project_id = $1`,
      [projectId],
    );
    const versionNumber = nRows[0]?.next_n ?? 1;

    // Deaktiver gamle aktiv-versjoner + insert ny som aktiv (samme tx)
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE role_room_client_intake_versions
            SET is_active = FALSE
          WHERE project_id = $1 AND is_active = TRUE`,
        [projectId],
      );
      const { rows: insRows } = await client.query<{ id: string }>(
        `INSERT INTO role_room_client_intake_versions
           (project_id, version_number, label, snapshot,
            generated_by_user_id, generated_by_kind, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id`,
        [projectId, versionNumber, label ?? null,
         rows[0].snapshot, generatedByUserId, kind],
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
    console.warn("[intake-versions] snapshot feilet", e);
    return null;
  }
}

export function registerRoleRoomIntakeVersionsRoutes(
  app: Express, deps: Deps,
): void {
  const { pool, activeSessions } = deps;

  // List alle versjoner for prosjektet
  app.get(
    "/api/role-room/research/:projectId/versions",
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
        goalPreview: string | null;
      }>(
        `SELECT v.id::text,
                v.version_number    AS "versionNumber",
                v.label,
                v.generated_by_kind AS "generatedByKind",
                v.generated_by_user_id::text AS "generatedByUserId",
                u.email             AS "generatedByName",
                v.is_active         AS "isActive",
                v.created_at        AS "createdAt",
                LEFT(v.snapshot->>'project_goal', 120) AS "goalPreview"
           FROM role_room_client_intake_versions v
           LEFT JOIN users u ON u.id = v.generated_by_user_id
          WHERE v.project_id = $1
          ORDER BY v.version_number DESC
          LIMIT 50`,
        [projectId],
      );
      res.status(200).json({ ok: true, versions: rows });
    },
  );

  // Bytt aktiv versjon — skriver snapshot tilbake til role_room_client_intake
  app.post(
    "/api/role-room/research/:projectId/versions/:versionId/activate",
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
        // Hent snapshot
        const { rows } = await client.query<{ snapshot: Record<string, unknown> }>(
          `SELECT snapshot FROM role_room_client_intake_versions
            WHERE id = $1 AND project_id = $2`,
          [versionId, projectId],
        );
        if (rows.length === 0) {
          await client.query("ROLLBACK");
          res.status(404).json({ error: "versjon_ikke_funnet" }); return;
        }
        const snap = rows[0].snapshot;
        // Skriv snapshot tilbake til live-tabellen via JSONB-felt-mapping.
        // Vi setter alle skrivbare felter eksplisitt for å unngå at en
        // gammel snapshot med færre felter "blanker" newer kolonner.
        await client.query(
          `UPDATE role_room_client_intake SET
              project_goal       = COALESCE($2::text, project_goal),
              deliverables       = COALESCE($3::text, deliverables),
              target_audience    = COALESCE($4::text, target_audience),
              key_message        = COALESCE($5::text, key_message),
              timing_constraints = COALESCE($6::text, timing_constraints),
              brand_notes        = COALESCE($7::text, brand_notes),
              material_overview  = COALESCE($8::text, material_overview),
              reference_links    = COALESCE($9::text, reference_links),
              contact_name       = COALESCE($10::text, contact_name),
              contact_email      = COALESCE($11::text, contact_email),
              contact_phone      = COALESCE($12::text, contact_phone),
              additional_notes   = COALESCE($13::text, additional_notes),
              metadata           = COALESCE($14::jsonb, metadata),
              updated_at         = now()
           WHERE project_id = $1`,
          [
            projectId,
            (snap.project_goal as string | null) ?? null,
            (snap.deliverables as string | null) ?? null,
            (snap.target_audience as string | null) ?? null,
            (snap.key_message as string | null) ?? null,
            (snap.timing_constraints as string | null) ?? null,
            (snap.brand_notes as string | null) ?? null,
            (snap.material_overview as string | null) ?? null,
            (snap.reference_links as string | null) ?? null,
            (snap.contact_name as string | null) ?? null,
            (snap.contact_email as string | null) ?? null,
            (snap.contact_phone as string | null) ?? null,
            (snap.additional_notes as string | null) ?? null,
            snap.metadata ? JSON.stringify(snap.metadata) : null,
          ],
        );
        await client.query(
          `UPDATE role_room_client_intake_versions
              SET is_active = FALSE
            WHERE project_id = $1 AND is_active = TRUE`,
          [projectId],
        );
        await client.query(
          `UPDATE role_room_client_intake_versions
              SET is_active = TRUE
            WHERE id = $1`,
          [versionId],
        );
        await client.query("COMMIT");
        res.status(200).json({ ok: true, activatedVersionId: versionId });
      } catch (e) {
        await client.query("ROLLBACK");
        console.error("[intake-versions] activate feilet", e);
        res.status(500).json({ error: "aktivering_feilet" });
      } finally {
        client.release();
      }
    },
  );

  app.post(
    "/api/role-room/research/:projectId/versions/:versionId/label",
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
        `UPDATE role_room_client_intake_versions
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
    "/api/role-room/research/:projectId/versions/:versionId",
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
           FROM role_room_client_intake_versions
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
        `DELETE FROM role_room_client_intake_versions
          WHERE id = $1 AND project_id = $2`,
        [versionId, projectId],
      );
      res.status(200).json({ ok: true });
    },
  );
}
