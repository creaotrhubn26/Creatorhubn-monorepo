/**
 * role-room-stripboard-routes.ts
 *
 * REST-flate for stripboard og fremdrift (Del A punkt 72, 73, 84, 87).
 *
 * Bakgrunnen er en kartlegging som fant to halvferdige halvdeler: en rik
 * stripboard-UI som hentet fra `/api/production/...` — et endepunkt som ikke
 * fantes noe sted i backend — og en ferdig, testet datamodell som bare var
 * eksponert via MCP. UI-et falt tilbake på demodata for en produksjon som het
 * «TROLL», og skriving gikk til en cache i minnet.
 *
 * Disse rutene er sømmen mellom dem. De er tynne med vilje: all logikk ligger
 * i role-room-stripboard-service.ts, slik at MCP og skjerm svarer likt.
 *
 *   GET   /api/role-room/projects/:projectId/stripboard
 *   GET   /api/role-room/projects/:projectId/stripboard/progress
 *   POST  /api/role-room/projects/:projectId/stripboard/assign
 *   POST  /api/role-room/projects/:projectId/stripboard/reorder
 *   PATCH /api/role-room/projects/:projectId/scenes/:sceneId/shoot-status
 */

import type express from "express";
import type { Pool } from "pg";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
import {
  assignSceneToDay,
  getShootProgress,
  getStripboard,
} from "./role-room-stripboard-service.js";

export interface StripboardRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

const SHOOT_STATUSES = new Set(["not_shot", "partial", "shot", "omitted"]);

export function setupRoleRoomStripboardRoutes(deps: StripboardRoutesDeps): void {
  const { app, pool, requireUserSession } = deps;

  async function guardProject(req: any, res: any): Promise<{ userId: string } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    if (!(await canAccessRoleRoomProject(pool, session.userId, String(req.params.projectId ?? "")))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return null;
    }
    return session;
  }

  app.get("/api/role-room/projects/:projectId/stripboard", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    try {
      res.json(await getStripboard(pool, String(req.params.projectId)));
    } catch (err) {
      console.error("[stripboard] henting feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente stripboardet." });
    }
  });

  /**
   * Medvirkende utledet av scenene.
   *
   * Egen rute framfor å tvinge kallere til å hente hele stripboardet: dagplan-
   * leggeren trenger bare navnene. Samme utledning som stripboard-svaret, så
   * de to kan ikke komme i utakt.
   */
  app.get("/api/role-room/projects/:projectId/cast", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    try {
      const projectId = String(req.params.projectId);
      const board = await getStripboard(pool, projectId);
      res.json({ cast: board.cast });
    } catch (err) {
      console.error("[stripboard] cast feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente medvirkende." });
    }
  });

  app.get("/api/role-room/projects/:projectId/stripboard/progress", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    try {
      res.json(await getShootProgress(pool, String(req.params.projectId)));
    } catch (err) {
      console.error("[stripboard] fremdrift feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente fremdriften." });
    }
  });

  /**
   * Legger en scene på en dag — eller tilbake i «ikke planlagt» når
   * productionDayId er null. Det er en gyldig handling, ikke en manglende
   * verdi, og skilles derfor fra at feltet er utelatt.
   */
  app.post("/api/role-room/projects/:projectId/stripboard/assign", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sceneId = typeof body.sceneId === "string" ? body.sceneId : "";
    if (!sceneId) {
      res.status(400).json({ error: "sceneId er påkrevd." });
      return;
    }
    if (!("productionDayId" in body)) {
      res.status(400).json({ error: "productionDayId er påkrevd (null for å ta scenen av planen)." });
      return;
    }

    const projectId = String(req.params.projectId);
    try {
      // Scenen må høre til prosjektet. Uten denne sjekken kunne en id fra et
      // annet prosjekt havnet på denne produksjonens dager.
      const scene = await pool.query(
        `SELECT 1 FROM casting_scenes WHERE id = $1 AND project_id = $2 LIMIT 1`,
        [sceneId, projectId],
      );
      if (scene.rowCount === 0) {
        res.status(404).json({ error: "Fant ikke scenen i dette prosjektet." });
        return;
      }

      const productionDayId =
        typeof body.productionDayId === "string" && body.productionDayId ? body.productionDayId : null;
      if (productionDayId) {
        const day = await pool.query(
          `SELECT 1 FROM casting_production_days WHERE id = $1 AND project_id = $2 LIMIT 1`,
          [productionDayId, projectId],
        );
        if (day.rowCount === 0) {
          res.status(404).json({ error: "Fant ikke opptaksdagen i dette prosjektet." });
          return;
        }
      }

      const result = await assignSceneToDay(pool, {
        projectId,
        sceneId,
        productionDayId,
        sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : undefined,
        setupMinutes: typeof body.setupMinutes === "number" ? body.setupMinutes : undefined,
      });
      res.json(result);
    } catch (err) {
      console.error("[stripboard] tildeling feilet:", err);
      res.status(500).json({ error: "Kunne ikke flytte scenen." });
    }
  });

  /**
   * Ny rekkefølge innad i en dag.
   *
   * Hele dagens rekkefølge sendes samlet, ikke én scene om gangen: rekkefølgen
   * er en egenskap ved dagen, og en delvis oppdatering ville etterlatt to
   * scener med samme sort_order etter en avbrutt drag-operasjon.
   */
  app.post("/api/role-room/projects/:projectId/stripboard/reorder", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sceneIds = Array.isArray(body.sceneIds) ? body.sceneIds.map(String) : null;
    if (!sceneIds || sceneIds.length === 0) {
      res.status(400).json({ error: "sceneIds er påkrevd." });
      return;
    }

    const projectId = String(req.params.projectId);
    const productionDayId =
      typeof body.productionDayId === "string" && body.productionDayId ? body.productionDayId : null;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      let updated = 0;
      for (const [index, sceneId] of sceneIds.entries()) {
        const r = await client.query(
          `UPDATE role_room_stripboard_entries
              SET sort_order = $1, updated_at = NOW()
            WHERE project_id = $2 AND scene_id = $3
              AND production_day_id IS NOT DISTINCT FROM $4`,
          [index, projectId, sceneId, productionDayId],
        );
        updated += r.rowCount ?? 0;
      }
      await client.query("COMMIT");
      // Scener uten rad telles ikke som oppdatert. Differansen er informasjon,
      // ikke en feil: den betyr at klienten sendte en scene som ikke ligger på
      // denne dagen.
      res.json({ updated, requested: sceneIds.length });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      console.error("[stripboard] omrokering feilet:", err);
      res.status(500).json({ error: "Kunne ikke lagre rekkefølgen." });
    } finally {
      client.release();
    }
  });

  app.patch("/api/role-room/projects/:projectId/scenes/:sceneId/shoot-status", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const status = typeof body.shootStatus === "string" ? body.shootStatus : "";
    if (!SHOOT_STATUSES.has(status)) {
      res.status(400).json({
        error: "shootStatus må være not_shot, partial, shot eller omitted.",
      });
      return;
    }

    try {
      const r = await pool.query(
        `UPDATE casting_scenes
            SET shoot_status = $1,
                -- Tidspunktet settes når scenen går i boks, og nullstilles
                -- hvis den åpnes igjen. Et gammelt shot_at på en scene som
                -- skal tas om igjen ville lest som at den var ferdig.
                shot_at = CASE WHEN $1 = 'shot' THEN COALESCE(shot_at, NOW()) ELSE NULL END,
                take_count = COALESCE($2::int, take_count)
          WHERE id = $3 AND project_id = $4
        RETURNING id, shoot_status, shot_at, take_count`,
        [
          status,
          typeof body.takeCount === "number" ? Math.max(0, Math.trunc(body.takeCount)) : null,
          String(req.params.sceneId),
          String(req.params.projectId),
        ],
      );
      if (r.rowCount === 0) {
        res.status(404).json({ error: "Fant ikke scenen i dette prosjektet." });
        return;
      }
      res.json({ scene: r.rows[0] });
    } catch (err) {
      console.error("[stripboard] statusendring feilet:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere scenestatusen." });
    }
  });
}
