/**
 * Agenda og frister i /admin-workspace.
 *
 * Bakgrunn: begge rutene svarte 500 i produksjon fordi spørringene filtrerte på
 * `casting_projects.user_id`, en kolonne som ikke finnes — den heter
 * `created_by`. Panelene sto tomme uten å si hvorfor, og det så ut som at
 * arbeidet som var lagt inn var borte.
 *
 * Testene holder på to ting: at eierfilteret bruker kolonnen som faktisk
 * finnes, og at en manglende samarbeidstabell gir svar i stedet for 500.
 */

import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { Pool } from "pg";

import { setupAdminWorkspaceAggregatorRoutes } from "./admin-workspace-aggregator-routes";

const BRUKER = "bruker-1";

interface Tilstand {
  spørringer: string[];
  /** Tabeller som ikke finnes i denne basen. */
  manglerTabell: string[];
}

function byggApp(t: Tilstand, innlogget = true) {
  const app = express();
  app.use(express.json());

  const pool = {
    query: async (sql: string) => {
      t.spørringer.push(sql);
      for (const tabell of t.manglerTabell) {
        if (sql.includes(tabell)) {
          throw new Error(`relation "${tabell}" does not exist`);
        }
      }
      // Postgres ville feilet på en kolonne som ikke finnes. Vi speiler det,
      // ellers ville testen godtatt akkurat feilen som førte til 500-ene.
      if (/\bp\.user_id\b/.test(sql)) {
        throw new Error('column p.user_id does not exist');
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;

  setupAdminWorkspaceAggregatorRoutes({
    app,
    pool,
    requireAdminRoomAccess: (_req, res) => {
      if (!innlogget) { res.status(401).json({ error: "Innlogging kreves" }); return null; }
      return { userId: BRUKER } as never;
    },
  } as never);
  return app;
}

describe("dagens agenda", () => {
  it("filtrerer på created_by — kolonnen som finnes", async () => {
    const t: Tilstand = { spørringer: [], manglerTabell: [] };
    const res = await request(byggApp(t)).get("/api/admin-room/workspace/today-agenda");

    expect(res.status).toBe(200);
    expect(t.spørringer.some((s) => s.includes("p.created_by = $1"))).toBe(true);
    expect(t.spørringer.some((s) => /\bp\.user_id\b/.test(s))).toBe(false);
  });

  it("svarer i stedet for 500 når samarbeidstabellen ikke finnes", async () => {
    // Tabellen mangler i produksjon. Da skal panelet vise brukerens egne
    // møter, ikke en tom skjerm uten forklaring.
    const t: Tilstand = { spørringer: [], manglerTabell: ["casting_project_collaborators"] };
    const res = await request(byggApp(t)).get("/api/admin-room/workspace/today-agenda");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("krever innlogging", async () => {
    const t: Tilstand = { spørringer: [], manglerTabell: [] };
    const res = await request(byggApp(t, false)).get("/api/admin-room/workspace/today-agenda");
    expect(res.status).toBe(401);
  });
});

describe("kommende frister", () => {
  it("filtrerer møter på created_by", async () => {
    const t: Tilstand = { spørringer: [], manglerTabell: [] };
    const res = await request(byggApp(t)).get("/api/admin-room/workspace/upcoming-deadlines?days=14");

    expect(res.status).toBe(200);
    expect(res.body.windowDays).toBe(14);
    expect(t.spørringer.some((s) => /\bp\.user_id\b/.test(s))).toBe(false);
  });

  it("hopper over sakene når tabellen mangler, i stedet for å felle hele fristlisten", async () => {
    const t: Tilstand = { spørringer: [], manglerTabell: ["admin_workspace_cases"] };
    const res = await request(byggApp(t)).get("/api/admin-room/workspace/upcoming-deadlines");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
