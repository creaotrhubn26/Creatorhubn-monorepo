/**
 * Rollekort.
 *
 * Testene dekker det som gjør kortet til et kort, og det som gjør lenken
 * trygg: at kortet må si hva personen skal GJØRE, at den offentlige
 * visningen bare gir ett kort og ikke resten av scenen, og at en
 * tilbaketrukket lenke svarer likt som en som aldri fantes.
 */

import express from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupRoleRoomSceneRoleCardsRoutes } from "./role-room-scene-role-cards-routes.js";

const PROSJEKT = "troll";
const KORT_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("./casting-project-ownership.js", () => ({
  userCanAccessCastingProject: async (_pool: unknown, projectId: string) => projectId === PROSJEKT,
}));

vi.mock("./storyboard-service.js", () => ({
  listStoryboards: async () => ([
    { id: "ramme-1", frameId: "f1", title: "Bord 3, vidt", imageData: "data:image/png;base64,AAAA", updatedAt: "2026-09-18T10:00:00Z" },
    { id: "ramme-2", frameId: "f2", title: "Nærbilde servitør", imageData: null, updatedAt: "2026-09-18T10:05:00Z" },
  ]),
}));

interface Tilstand {
  spørringer: { sql: string; params: unknown[] }[];
  offentligRad: Record<string, unknown> | null;
  oppdaterteRader: number;
}

function byggApp(t: Tilstand, innlogget = true) {
  const app = express();
  app.use(express.json());

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      t.spørringer.push({ sql, params: params ?? [] });
      if (sql.includes("FROM scene_role_cards c")) {
        return { rows: t.offentligRad ? [t.offentligRad] : [], rowCount: t.offentligRad ? 1 : 0 };
      }
      if (sql.includes("INSERT INTO scene_role_cards")) {
        return { rows: [{ id: KORT_ID, token: "hemmelig-token" }], rowCount: 1 };
      }
      if (sql.includes("image_data FROM casting_storyboards")) {
        return { rows: [{ image_data: "data:image/png;base64,AAAA" }], rowCount: 1 };
      }
      if (sql.includes("UPDATE casting_scenes")) {
        return { rows: t.oppdaterteRader ? [{ id: 'scene-1', blocking: { planUrl: 'https://eksempel.test/plan.png' } }] : [], rowCount: t.oppdaterteRader };
      }
      if (sql.includes("FROM casting_scenes")) {
        return { rows: [{ blocking: null }], rowCount: 1 };
      }
      if (sql.includes("UPDATE scene_role_cards") || sql.includes("DELETE FROM scene_role_cards")) {
        return { rows: t.oppdaterteRader ? [{ id: KORT_ID }] : [], rowCount: t.oppdaterteRader };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;

  setupRoleRoomSceneRoleCardsRoutes({
    app,
    pool,
    getActiveSession: () => (innlogget ? { userId: "bruker-1" } : null),
  });
  return app;
}

describe("produksjonens side", () => {
  let t: Tilstand;
  beforeEach(() => { t = { spørringer: [], offentligRad: null, oppdaterteRader: 1 }; });

  it("krever innlogging", async () => {
    const res = await request(byggApp(t, false)).get(`/api/role-room/projects/${PROSJEKT}/role-cards`);
    expect(res.status).toBe(401);
  });

  it("svarer 404 — ikke 403 — for et prosjekt du ikke har tilgang til", async () => {
    // 403 ville bekreftet at prosjektet finnes.
    const res = await request(byggApp(t)).get("/api/role-room/projects/annet-prosjekt/role-cards");
    expect(res.status).toBe(404);
  });

  it("krever at kortet sier hva personen skal gjøre", async () => {
    const res = await request(byggApp(t))
      .post(`/api/role-room/projects/${PROSJEKT}/role-cards`)
      .send({ person_name: "Statist 3" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/gjøre/);
    expect(t.spørringer.some((q) => q.sql.includes("INSERT"))).toBe(false);
  });

  it("lager et token som ikke kan gjettes", async () => {
    const res = await request(byggApp(t))
      .post(`/api/role-room/projects/${PROSJEKT}/role-cards`)
      .send({ person_name: "Statist 3", action: "Du sitter ved bord 3 og ser opp når servitøren går forbi." });

    expect(res.status).toBe(201);
    const insert = t.spørringer.find((q) => q.sql.includes("INSERT"));
    const token = insert?.params[13] as string;
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).not.toContain("Statist");
  });

  it("normaliserer posisjonen til 0–1, så plantegningen kan byttes", async () => {
    await request(byggApp(t))
      .post(`/api/role-room/projects/${PROSJEKT}/role-cards`)
      .send({ person_name: "Statist 3", action: "Reis deg.", position: { x: 4.2, y: -1 } });

    const insert = t.spørringer.find((q) => q.sql.includes("INSERT"));
    expect(JSON.parse(insert?.params[8] as string)).toEqual({ x: 1, y: 0 });
  });

  it("har project_id i WHERE ved endring, så et kort fra et annet prosjekt ikke treffes", async () => {
    await request(byggApp(t))
      .patch(`/api/role-room/projects/${PROSJEKT}/role-cards/${KORT_ID}`)
      .send({ action: "Bli sittende." });

    const update = t.spørringer.find((q) => q.sql.includes("UPDATE scene_role_cards"));
    expect(update?.sql).toContain("project_id = $2");
    expect(update?.params[1]).toBe(PROSJEKT);
  });
});

describe("statistens side", () => {
  let t: Tilstand;
  beforeEach(() => {
    t = {
      spørringer: [],
      oppdaterteRader: 1,
      offentligRad: {
        id: KORT_ID,
        person_name: "Statist 3",
        person_kind: "extra",
        action: "Du sitter ved bord 3. Når servitøren går forbi, ser du opp og smiler.",
        cue: "Etter at hovedrollen tar første bit.",
        position: { x: 0.42, y: 0.61 },
        wardrobe: "Egne klær, mørke farger",
        frame_image_url: "https://eksempel.test/ramme.jpg",
        call_time: "2026-10-01T07:30:00Z",
        revoked_at: null,
        scene_title: "Pizzarestauranten, kveld",
        scene_setting: "Restaurant",
        time_of_day: "NIGHT",
        int_ext: "INT",
        blocking: { planUrl: "https://eksempel.test/plan.png", camera: { x: 0.9, y: 0.5 } },
        project_name: "Pizza – kampanje",
      },
    };
  });

  it("gir kortet uten innlogging", async () => {
    const res = await request(byggApp(t, false)).get("/api/role-room/role-cards/r/et-token");
    expect(res.status).toBe(200);
    expect(res.body.card.action).toMatch(/bord 3/);
    expect(res.body.scene.blocking.planUrl).toBeTruthy();
  });

  it("gir BARE denne personens kort — ingen andre, ingen kontaktliste", async () => {
    const res = await request(byggApp(t, false)).get("/api/role-room/role-cards/r/et-token");
    const nøkler = Object.keys(res.body);
    expect(nøkler.sort()).toEqual(["card", "project", "scene"]);
    // Hele poenget: statisten skal ikke lete etter seg selv i scenen.
    expect(JSON.stringify(res.body)).not.toContain("cards");
    expect(res.body.card.id).toBeUndefined();
  });

  it("svarer likt for tilbaketrukket og ukjent lenke", async () => {
    const trukket = { ...t.offentligRad, revoked_at: "2026-09-20T10:00:00Z" };
    const a = await request(byggApp({ ...t, offentligRad: trukket }, false)).get("/api/role-room/role-cards/r/et-token");
    const b = await request(byggApp({ ...t, offentligRad: null }, false)).get("/api/role-room/role-cards/r/finnes-ikke");

    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    // Ulik ordlyd ville latt noen prøve seg fram til hvilke lenker som finnes.
    expect(a.body.error).toBe(b.body.error);
  });
});

describe("plantegning og kamera", () => {
  let t: Tilstand;
  beforeEach(() => { t = { spørringer: [], offentligRad: null, oppdaterteRader: 1 }; });

  it("lagrer i scenens breakdown, ikke i en egen tabell", async () => {
    const res = await request(byggApp(t))
      .put(`/api/role-room/projects/${PROSJEKT}/scenes/scene-1/blocking`)
      .send({ planUrl: "https://eksempel.test/plan.png", camera: { x: 0.9, y: 0.5 } });

    expect(res.status).toBe(200);
    const q = t.spørringer.find((x) => x.sql.includes("UPDATE casting_scenes"));
    expect(q?.sql).toContain("jsonb_set");
    // create_missing: scener uten breakdown fra før skal få nøkkelen, ikke feile.
    expect(q?.sql).toContain("true");
    // Både scene og prosjekt i WHERE — en scene-id fra et annet prosjekt
    // skal ikke kunne skrives til ved å gjette.
    expect(q?.sql).toContain("id = $1 AND project_id = $2");
  });

  it("avviser en plantegning som ikke er en http-adresse", async () => {
    const res = await request(byggApp(t))
      .put(`/api/role-room/projects/${PROSJEKT}/scenes/scene-1/blocking`)
      .send({ planUrl: "javascript:alert(1)" });

    expect(res.status).toBe(400);
    expect(t.spørringer.some((q) => q.sql.includes("UPDATE casting_scenes"))).toBe(false);
  });

  it("klemmer kameraet til 0–1 som resten av posisjonene", async () => {
    await request(byggApp(t))
      .put(`/api/role-room/projects/${PROSJEKT}/scenes/scene-1/blocking`)
      .send({ planUrl: "https://eksempel.test/plan.png", camera: { x: 9, y: -3 } });

    const q = t.spørringer.find((x) => x.sql.includes("UPDATE casting_scenes"));
    expect(JSON.parse(q?.params[2] as string).camera).toEqual({ x: 1, y: 0 });
  });

  it("krever prosjekt-tilgang", async () => {
    const res = await request(byggApp(t))
      .put("/api/role-room/projects/annet-prosjekt/scenes/scene-1/blocking")
      .send({ planUrl: "https://eksempel.test/plan.png" });
    expect(res.status).toBe(404);
  });
});

describe("storyboard-rammer", () => {
  let t: Tilstand;
  beforeEach(() => { t = { spørringer: [], offentligRad: null, oppdaterteRader: 1 }; });

  it("lister rammene UTEN bildene", async () => {
    const res = await request(byggApp(t)).get(`/api/role-room/projects/${PROSJEKT}/scenes/scene-1/frames`);

    expect(res.status).toBe(200);
    expect(res.body.frames).toHaveLength(2);
    expect(res.body.frames[0]).toEqual(expect.objectContaining({ id: "ramme-1", hasImage: true }));
    // En scene med tjue rammer skal ikke sende tjue fullstørrelses bilder
    // for å tegne en liste.
    expect(JSON.stringify(res.body)).not.toContain("base64");
  });

  it("gir bildet først når én ramme velges", async () => {
    const res = await request(byggApp(t)).get(`/api/role-room/projects/${PROSJEKT}/frames/ramme-1/image`);
    expect(res.status).toBe(200);
    expect(res.body.imageData).toContain("base64");
    const q = t.spørringer.find((x) => x.sql.includes("image_data FROM casting_storyboards"));
    // project_id i WHERE: en ramme-id fra et annet prosjekt skal ikke kunne hentes.
    expect(q?.sql).toContain("project_id = $2");
  });

  it("krever prosjekt-tilgang for rammene", async () => {
    const res = await request(byggApp(t)).get("/api/role-room/projects/annet-prosjekt/scenes/scene-1/frames");
    expect(res.status).toBe(404);
  });
});
