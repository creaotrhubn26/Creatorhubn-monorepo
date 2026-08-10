/**
 * role-room-work-time-routes.ts
 *
 * REST-flate for arbeidstid og AML-sjekk (Del A punkt 74 og 80).
 *
 * Regelmotoren og vakt-tjenesten var eksponert via MCP. En agent kunne altså
 * svare på om opptaksdagen var lovlig, mens produsenten som planla den ikke
 * kunne se det noe sted. Rutene er tynne — all vurdering ligger i
 * role-room-work-time-service.ts, slik at MCP og skjerm svarer likt.
 *
 *   GET    /api/role-room/projects/:projectId/work-time/check
 *   GET    /api/role-room/projects/:projectId/work-time/shifts
 *   POST   /api/role-room/projects/:projectId/work-time/generate
 *   PATCH  /api/role-room/work-time/shifts/:shiftId
 *   DELETE /api/role-room/work-time/shifts/:shiftId
 */

import type express from "express";
import type { Pool } from "pg";
import { canAccessRoleRoomProject } from "./role-room-projects-routes.js";
import { evaluateProjectWorkTime } from "./role-room-work-time-service.js";
import {
  deleteShift,
  generateShiftsForDay,
  getShiftProject,
  listShifts,
  updateShift,
} from "./role-room-work-shift-service.js";

export interface WorkTimeRoutesDeps {
  app: express.Application;
  pool: Pool;
  requireUserSession: (req: any, res: any) => any;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function setupRoleRoomWorkTimeRoutes(deps: WorkTimeRoutesDeps): void {
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

  /**
   * Vakter slås opp globalt på id, så tilgangen må sjekkes mot vaktens
   * FAKTISKE prosjekt — ikke mot et prosjekt kalleren oppgir.
   */
  async function guardShift(req: any, res: any): Promise<{ userId: string } | null> {
    const session = requireUserSession(req, res);
    if (!session) return null;
    const projectId = await getShiftProject(pool, String(req.params.shiftId ?? ""));
    if (!projectId) {
      res.status(404).json({ error: "Fant ikke vakten." });
      return null;
    }
    if (!(await canAccessRoleRoomProject(pool, session.userId, projectId))) {
      res.status(403).json({ error: "ingen_tilgang" });
      return null;
    }
    return session;
  }

  // ── Sjekken ──────────────────────────────────────────────────────────────
  app.get("/api/role-room/projects/:projectId/work-time/check", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    try {
      // Skriftlig avtale om redusert daglig hvile (AML § 10-8) er produksjonens
      // opplysning, ikke noe systemet kan utlede. Den kommer som parameter.
      const report = await evaluateProjectWorkTime(pool, String(req.params.projectId), {
        reducedDailyRestAgreed: req.query.reducedDailyRestAgreed === "true",
        collectiveAgreement: req.query.collectiveAgreement === "true",
      });
      res.json(report);
    } catch (err) {
      console.error("[work-time] sjekk feilet:", err);
      res.status(500).json({ error: "Kunne ikke kjøre arbeidstidssjekken." });
    }
  });

  // ── Vakter ───────────────────────────────────────────────────────────────
  app.get("/api/role-room/projects/:projectId/work-time/shifts", async (req, res) => {
    if (!(await guardProject(req, res))) return;
    try {
      res.json({ shifts: await listShifts(pool, String(req.params.projectId)) });
    } catch (err) {
      console.error("[work-time] henting av vakter feilet:", err);
      res.status(500).json({ error: "Kunne ikke hente vakter." });
    }
  });

  app.post("/api/role-room/projects/:projectId/work-time/generate", async (req, res) => {
    if (!(await guardProject(req, res))) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const productionDayId = typeof body.productionDayId === "string" ? body.productionDayId : "";
    const callTime = typeof body.callTime === "string" ? body.callTime : "";
    const wrapTime = typeof body.wrapTime === "string" ? body.wrapTime : "";

    if (!productionDayId) {
      res.status(400).json({ error: "productionDayId er påkrevd." });
      return;
    }
    // Tidene er valgfrie — utelates de brukes opptaksdagens egne. Oppgis de,
    // valideres formatet her framfor å la databasen avvise det: «wrap_time >
    // call_time» fra en CHECK-constraint sier ingenting om hva brukeren
    // skrev feil.
    for (const [field, value] of [["callTime", callTime], ["wrapTime", wrapTime]] as const) {
      if (value && !TIME_PATTERN.test(value)) {
        res.status(400).json({ error: `${field} må være på formen TT:MM.` });
        return;
      }
    }

    try {
      const result = await generateShiftsForDay(pool, {
        projectId: String(req.params.projectId),
        productionDayId,
        callTime: callTime || undefined,
        wrapTime: wrapTime || undefined,
        breakMinutes: typeof body.breakMinutes === "number" ? body.breakMinutes : undefined,
        replace: body.replace === true,
      });
      res.json(result);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "day_not_found") {
        res.status(404).json({ error: "Fant ikke opptaksdagen." });
        return;
      }
      if (code === "day_times_missing") {
        res.status(400).json({
          error: "Opptaksdagen mangler innkalling eller wrap. Fyll dem inn på dagen først.",
        });
        return;
      }
      console.error("[work-time] generering feilet:", err);
      res.status(500).json({ error: "Kunne ikke generere vakter." });
    }
  });

  app.patch("/api/role-room/work-time/shifts/:shiftId", async (req, res) => {
    if (!(await guardShift(req, res))) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    try {
      const updated = await updateShift(pool, String(req.params.shiftId), {
        callTime: typeof body.callTime === "string" ? body.callTime : undefined,
        wrapTime: typeof body.wrapTime === "string" ? body.wrapTime : undefined,
        actualWrapTime:
          body.actualWrapTime === null
            ? null
            : typeof body.actualWrapTime === "string"
              ? body.actualWrapTime
              : undefined,
        breakMinutes: typeof body.breakMinutes === "number" ? body.breakMinutes : undefined,
        notes: body.notes === null ? null : typeof body.notes === "string" ? body.notes : undefined,
      });
      if (!updated) {
        res.status(400).json({ error: "Ingen felter å oppdatere." });
        return;
      }
      res.json({ shift: updated });
    } catch (err) {
      // Tidsrekkefølgen håndheves av CHECK-constraints i migrering 0456.
      if ((err as { code?: string }).code === "23514") {
        res.status(400).json({ error: "Sluttidspunktet må være etter innkallingen." });
        return;
      }
      console.error("[work-time] oppdatering feilet:", err);
      res.status(500).json({ error: "Kunne ikke oppdatere vakten." });
    }
  });

  app.delete("/api/role-room/work-time/shifts/:shiftId", async (req, res) => {
    if (!(await guardShift(req, res))) return;
    try {
      res.json({ deleted: await deleteShift(pool, String(req.params.shiftId)) });
    } catch (err) {
      console.error("[work-time] sletting feilet:", err);
      res.status(500).json({ error: "Kunne ikke slette vakten." });
    }
  });
}
