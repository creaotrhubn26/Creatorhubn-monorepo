import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { setupRoleRoomTalentCreditsRoutes } from "./role-room-talent-credits-routes.js";

const TALENT_ID = "11111111-1111-4111-8111-111111111111";
const CREDIT_ID = "22222222-2222-4222-8222-222222222222";

interface State {
  hasTalent: boolean;
  queries: { sql: string; params: unknown[] }[];
  updateRowCount: number;
}

function buildApp(state: State, signedIn = true) {
  const app = express();
  app.use(express.json());

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      state.queries.push({ sql, params: params ?? [] });
      if (sql.includes("SELECT id FROM talents")) {
        return { rows: state.hasTalent ? [{ id: TALENT_ID }] : [], rowCount: state.hasTalent ? 1 : 0 };
      }
      if (sql.includes("COUNT(*)::int AS n")) return { rows: [{ n: 2 }], rowCount: 1 };
      if (sql.includes("INSERT INTO talent_credits")) {
        return { rows: [{ id: CREDIT_ID, talent_id: TALENT_ID }], rowCount: 1 };
      }
      if (sql.includes("UPDATE talent_credits") || sql.includes("DELETE FROM talent_credits")) {
        return { rows: state.updateRowCount ? [{ id: CREDIT_ID }] : [], rowCount: state.updateRowCount };
      }
      if (sql.includes("FROM talent_credits")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;

  setupRoleRoomTalentCreditsRoutes({
    app,
    pool,
    getActiveSession: () => (signedIn ? { userId: "user-1" } : null),
  });

  return app;
}

describe("talent-krediteringer", () => {
  let state: State;

  beforeEach(() => {
    state = { hasTalent: true, queries: [], updateRowCount: 1 };
  });

  it("krever innlogging", async () => {
    const res = await request(buildApp(state, false)).get("/api/role-room/talents/me/credits");
    expect(res.status).toBe(401);
  });

  it("krever tittel", async () => {
    const res = await request(buildApp(state))
      .post("/api/role-room/talents/me/credits")
      .send({ category: "theatre", role_name: "Blanche DuBois" });

    expect(res.status).toBe(400);
    expect(state.queries.some((q) => q.sql.includes("INSERT INTO talent_credits"))).toBe(false);
  });

  it("lagrer en kreditering og normaliserer ugyldig kategori og rolletype", async () => {
    const res = await request(buildApp(state))
      .post("/api/role-room/talents/me/credits")
      .send({
        title: "A Streetcar Named Desire",
        category: "tullekategori",
        role_type: "HOVEDROLLE",
        role_name: "Blanche DuBois",
        year: 2023,
      });

    expect(res.status).toBe(201);
    const insert = state.queries.find((q) => q.sql.includes("INSERT INTO talent_credits"));
    expect(insert?.params).toContain("film_tv"); // ukjent kategori faller tilbake
    expect(insert?.params).toContain(null); // ukjent rolletype blir null
    expect(insert?.params).toContain(2023);
  });

  it("avviser årstall utenfor rimelig intervall", async () => {
    await request(buildApp(state))
      .post("/api/role-room/talents/me/credits")
      .send({ title: "Hamlet", year: 1600 });

    const insert = state.queries.find((q) => q.sql.includes("INSERT INTO talent_credits"));
    expect(insert?.params).toContain(null);
    expect(insert?.params).not.toContain(1600);
  });

  it("krever https på ekstern lenke", async () => {
    await request(buildApp(state))
      .post("/api/role-room/talents/me/credits")
      .send({ title: "Hamlet", external_url: "javascript:alert(1)" });

    const insert = state.queries.find((q) => q.sql.includes("INSERT INTO talent_credits"));
    expect(insert?.params).not.toContain("javascript:alert(1)");
  });

  it("scoper oppdatering til egen talent-rad", async () => {
    await request(buildApp(state))
      .patch(`/api/role-room/talents/me/credits/${CREDIT_ID}`)
      .send({ title: "Ny tittel" });

    const update = state.queries.find((q) => q.sql.includes("UPDATE talent_credits"));
    expect(update?.sql).toContain("WHERE id = $1 AND talent_id = $2");
    expect(update?.params[1]).toBe(TALENT_ID);
  });

  it("gir 404 når krediteringen tilhører en annen", async () => {
    state.updateRowCount = 0;
    const res = await request(buildApp(state))
      .patch(`/api/role-room/talents/me/credits/${CREDIT_ID}`)
      .send({ title: "Kapret" });

    expect(res.status).toBe(404);
  });

  it("scoper sletting til egen talent-rad", async () => {
    await request(buildApp(state)).delete(`/api/role-room/talents/me/credits/${CREDIT_ID}`);
    const del = state.queries.find((q) => q.sql.includes("DELETE FROM talent_credits"));
    expect(del?.sql).toContain("talent_id = $2");
  });

  it("foreslår kun verdier som deles av flere, eller er ens egne", async () => {
    await request(buildApp(state)).get(
      "/api/role-room/talents/credits/suggest?field=director&q=Stubø",
    );

    const suggest = state.queries.find((q) => q.sql.includes("GROUP BY value"));
    expect(suggest?.sql).toContain("HAVING COUNT(DISTINCT talent_id) > 1 OR bool_or(talent_id = $2)");
  });

  it("krever minst to tegn for forslag", async () => {
    const res = await request(buildApp(state)).get(
      "/api/role-room/talents/credits/suggest?field=title&q=H",
    );

    expect(res.body.suggestions).toEqual([]);
    expect(state.queries.some((q) => q.sql.includes("GROUP BY value"))).toBe(false);
  });
});

describe("rekkefølge", () => {
  let state: State;

  beforeEach(() => {
    state = { hasTalent: true, queries: [], updateRowCount: 1 };
  });

  it("krever innlogging", async () => {
    const res = await request(buildApp(state, false))
      .post("/api/role-room/talents/me/credits/reorder")
      .send({ ids: [CREDIT_ID] });
    expect(res.status).toBe(401);
  });

  it("avviser noe annet enn en liste med id-er", async () => {
    const res = await request(buildApp(state))
      .post("/api/role-room/talents/me/credits/reorder")
      .send({ ids: [{ id: CREDIT_ID }] });

    expect(res.status).toBe(400);
    expect(state.queries.some((q) => q.sql.includes("UPDATE talent_credits"))).toBe(false);
  });

  it("skriver rekkefølgen med talent_id i WHERE, slik at andres rader ikke treffes", async () => {
    const res = await request(buildApp(state))
      .post("/api/role-room/talents/me/credits/reorder")
      .send({ ids: [CREDIT_ID, "33333333-3333-4333-8333-333333333333"] });

    expect(res.status).toBe(200);
    const update = state.queries.find((q) => q.sql.includes("UPDATE talent_credits"));
    // Uten talent_id her kunne hvem som helst omsortere en annen
    // skuespillers CV ved å gjette id-er.
    expect(update?.sql).toContain("c.talent_id = $1");
    expect(update?.params[0]).toBe(TALENT_ID);
    // Posisjonen kommer fra rekkefølgen i lista, ikke fra klienten.
    expect(update?.sql).toContain("WITH ORDINALITY");
    expect(update?.params[1]).toEqual([CREDIT_ID, "33333333-3333-4333-8333-333333333333"]);
  });
});
