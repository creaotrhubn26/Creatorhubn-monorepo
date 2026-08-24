/**
 * Workflow-orkestrering etter prosjektopprettelse.
 *
 * Frontend (WorkflowIntegrationService.orchestrateCompleteWorkflow) kaller
 * disse rett etter at et prosjekt er opprettet. De fantes ikke før — kallene
 * 404-et og orchestreringen ble hoppet over (non-fatal siden PR #2059).
 *
 * Endepunkter:
 *   - POST /api/showcase/auto-create        (merk prosjektet showcase-klart)
 *   - POST /api/showcase/link-memory-cards  (lagre minnekort-formål på prosjektet)
 *   - POST /api/event-timeline/auto-create  (opprett rad i event_timelines,
 *                                            idempotent per prosjekt)
 *
 * Bryllupstidslinje har allerede en full rute
 * (POST /api/wedding/timeline/project/:projectId i wedding-timeline-routes.ts)
 * — frontend-servicen kaller den direkte, så den dupliseres ikke her.
 *
 * Auth: compatResolveUserId; alle skriv krever at innloggeren eier prosjektet
 * (legacy.projects.user_id) — ellers kunne man tagge/opprette tidslinjer på
 * andres prosjekter.
 *
 * Wire opp i backend/server/index.ts:
 *
 *   import { setupWorkflowOrchestrationRoutes } from "./workflow-orchestration-routes";
 *   setupWorkflowOrchestrationRoutes({ app, pool, compatResolveUserId });
 */

import type express from "express";
import type { Pool } from "pg";
import crypto from "crypto";

export interface WorkflowOrchestrationRoutesDeps {
  app: express.Express;
  pool: Pool;
  compatResolveUserId: (req: any) => string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function setupWorkflowOrchestrationRoutes(
  deps: WorkflowOrchestrationRoutesDeps,
): void {
  const { app, pool, compatResolveUserId } = deps;

  // Eierskapssjekk mot legacy.projects; returnerer raden eller null.
  async function ownedProject(
    projectId: string,
    userId: string,
  ): Promise<Record<string, any> | null> {
    const result = await pool.query(
      `SELECT id, name, title, category, profession, client_email, client_phone,
              event_date, date, location
         FROM legacy.projects
        WHERE id = $1 AND user_id = $2
        LIMIT 1`,
      [projectId, userId],
    );
    return result.rows[0] ?? null;
  }

  async function mergeProjectMetadata(
    projectId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    await pool.query(
      `UPDATE legacy.projects
          SET metadata = COALESCE(metadata, '{}')::jsonb || $1::jsonb,
              updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(patch), projectId],
    );
  }

  // POST /api/showcase/auto-create — merk prosjektet som showcase-integrert.
  // Selve showcase-items opprettes først ved opplasting; her registreres bare
  // koblingen slik at showcase-flatene kan finne prosjektkonteksten.
  app.post("/api/showcase/auto-create", async (req, res) => {
    try {
      const userId = compatResolveUserId(req);
      if (!UUID_RE.test(userId)) {
        return res.status(401).json({ error: "krever_innlogging" });
      }
      const projectId = readString(req.body?.projectId);
      if (!projectId) {
        return res.status(400).json({ error: "projectId er påkrevd" });
      }
      const project = await ownedProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Prosjekt ikke funnet" });
      }

      await mergeProjectMetadata(projectId, {
        showcaseIntegrated: true,
        showcaseAutoCreatedAt: new Date().toISOString(),
      });

      res.status(201).json({
        success: true,
        projectId,
        projectTitle:
          readString(project.title) || readString(project.name) || "Prosjekt",
      });
    } catch (error) {
      console.error("Error auto-creating showcase link:", error);
      res.status(500).json({ error: "Kunne ikke koble showcase" });
    }
  });

  // POST /api/showcase/link-memory-cards — lagre { kortId: formål }-kartet
  // fra opprettelsesmodalen på prosjektet.
  app.post("/api/showcase/link-memory-cards", async (req, res) => {
    try {
      const userId = compatResolveUserId(req);
      if (!UUID_RE.test(userId)) {
        return res.status(401).json({ error: "krever_innlogging" });
      }
      const projectId = readString(req.body?.projectId);
      const memoryCards = req.body?.memoryCards;
      if (!projectId || typeof memoryCards !== "object" || !memoryCards) {
        return res
          .status(400)
          .json({ error: "projectId og memoryCards er påkrevd" });
      }
      if (!(await ownedProject(projectId, userId))) {
        return res.status(404).json({ error: "Prosjekt ikke funnet" });
      }

      await mergeProjectMetadata(projectId, {
        memoryCardPurposes: memoryCards,
      });

      res.json({ success: true, projectId });
    } catch (error) {
      console.error("Error linking memory cards:", error);
      res.status(500).json({ error: "Kunne ikke koble minnekort" });
    }
  });

  // POST /api/event-timeline/auto-create — universal tidslinje for alle
  // prosjekttyper. Idempotent: finnes det alt en tidslinje for prosjektet,
  // returneres den i stedet for å opprette en dublett.
  app.post("/api/event-timeline/auto-create", async (req, res) => {
    try {
      const userId = compatResolveUserId(req);
      if (!UUID_RE.test(userId)) {
        return res.status(401).json({ error: "krever_innlogging" });
      }
      const body = req.body ?? {};
      const projectId = readString(body.projectId);
      if (!projectId) {
        return res.status(400).json({ error: "projectId er påkrevd" });
      }
      const project = await ownedProject(projectId, userId);
      if (!project) {
        return res.status(404).json({ error: "Prosjekt ikke funnet" });
      }

      const existing = await pool.query(
        "SELECT * FROM event_timelines WHERE project_id = $1 ORDER BY created_at DESC LIMIT 1",
        [projectId],
      );
      if (existing.rows.length > 0) {
        return res.json({ ...existing.rows[0], alreadyExisted: true });
      }

      const rawDate =
        readString(body.eventDate) ||
        readString(project.event_date) ||
        readString(project.date);
      const eventDate =
        rawDate && !Number.isNaN(Date.parse(rawDate)) ? new Date(rawDate) : null;

      const result = await pool.query(
        `INSERT INTO event_timelines
           (project_id, user_id, project_type, client_name, client_email,
            client_phone, event_date, event_location, status,
            client_access_enabled, client_access_code, metadata,
            created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $11, NOW(), NOW())
         RETURNING *`,
        [
          projectId,
          userId,
          readString(body.projectType) || readString(project.category) || "other",
          readString(body.clientName) ||
            readString(project.client_email) ||
            "",
          readString(body.clientEmail) || readString(project.client_email) || null,
          readString(body.clientPhone) || readString(project.client_phone) || null,
          eventDate,
          readString(body.venue) || readString(project.location) || "",
          body.clientAccessEnabled !== false,
          crypto.randomUUID().slice(0, 8),
          JSON.stringify({ autoCreated: true }),
        ],
      );

      await mergeProjectMetadata(projectId, {
        eventTimelineId: result.rows[0].id,
        eventTimelineIntegrated: true,
      }).catch(() => {});

      console.log(
        `📅 Event-tidslinje opprettet for prosjekt ${projectId} (${result.rows[0].project_type})`,
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error auto-creating event timeline:", error);
      res.status(500).json({ error: "Kunne ikke opprette tidslinje" });
    }
  });
}
