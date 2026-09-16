/**
 * GDPR-rutene og samtykke-loggen.
 *
 * Det som testes er det som kan slå tilbake: at eksporten gir personen
 * beviset sitt, og at sletteteksten ikke lover mer enn vi gjør.
 */

import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { GENESIS_HASH, computeRowHash } from "./consent-ledger-service.js";
import { setupRoleRoomTalentGdprRoutes } from "./role-room-talent-gdpr-routes.js";

const USER_ID = "8f1b0c62-8f3e-4b44-9a3d-2a1f6b5c4d33";

// En ekte, gyldig rad: hashen er regnet med produksjonskoden, ellers ville
// kjedesjekken i eksporten vært pynt vi aldri så feile.
const LEDGER_CORE = {
  seq: 1,
  user_id: USER_ID,
  subject_type: "agency_share",
  subject_ref: "byra-1",
  document_hash: "a".repeat(64),
  action: "granted" as const,
  auth_method: "bankid" as const,
  auth_event_id: null,
  created_at: "2026-09-16T20:30:00.000Z",
};

const LEDGER_ROW = {
  ...LEDGER_CORE,
  seq: "1",
  prev_hash: GENESIS_HASH,
  row_hash: computeRowHash(GENESIS_HASH, LEDGER_CORE),
};

function fakePool(): Pool {
  const query = async (sql: string) => {
    if (sql.includes("FROM talents WHERE owner_user_id")) {
      return { rows: [{ id: "talent-1", display_name: "Kari" }], rowCount: 1 };
    }
    // Tellingen først: begge spørringene inneholder «FROM consent_ledger».
    if (sql.includes("count(*)")) return { rows: [{ n: "3" }], rowCount: 1 };
    if (sql.includes("FROM consent_ledger")) return { rows: [LEDGER_ROW], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  };
  return { query } as unknown as Pool;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  setupRoleRoomTalentGdprRoutes({
    app,
    pool: fakePool(),
    getActiveSession: () => ({ userId: USER_ID }),
  });
  return app;
}

describe("eksport", () => {
  it("tar med samtykke-loggen og kjedesjekken", async () => {
    const res = await request(buildApp()).get("/api/role-room/talents/me/export");
    expect(res.status).toBe(200);
    const body = JSON.parse(res.text);
    expect(body.consent_ledger.rader).toHaveLength(1);
    expect(body.consent_ledger.rader[0].row_hash).toBe(LEDGER_ROW.row_hash);
    // Rader uten kjedesjekk er bare rader — sjekken må følge med.
    expect(body.consent_ledger.kjede_verifisert).toMatchObject({ ok: true });
  });

  it("lekker ikke fødselsnummer-hash eller andre eID-felter", async () => {
    const res = await request(buildApp()).get("/api/role-room/talents/me/export");
    expect(res.text).not.toContain("ssn_hash");
  });
});

describe("sletting", () => {
  it("lover ikke at alt er borte når samtykke-loggen beholdes", async () => {
    const res = await request(buildApp())
      .delete("/api/role-room/talents/me")
      .send({ confirmation: "SLETT MIN PROFIL" });

    expect(res.status).toBe(200);
    // Den gamle teksten sa «All data er fjernet fra våre systemer». Det er
    // ikke sant når loggen blir stående, og usannhet om sletting er nettopp
    // det som felles i en klagesak.
    expect(res.body.message).not.toContain("All data er fjernet");
    expect(res.body.beholdt.samtykke_logg_rader).toBe(3);
    expect(res.body.beholdt.hvorfor).toContain("art. 17");
  });

  it("krever bekreftelsesteksten", async () => {
    const res = await request(buildApp()).delete("/api/role-room/talents/me").send({});
    expect(res.status).toBe(400);
  });
});
