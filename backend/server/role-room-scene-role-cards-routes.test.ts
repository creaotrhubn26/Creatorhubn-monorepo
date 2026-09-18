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

const sendtEpost = vi.fn(async () => ({ sent: true, provider: "resend" }));
vi.mock("./transactional-email-service.js", () => ({
  sendTransactionalEmail: (...a: unknown[]) => sendtEpost(...(a as [])),
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
  /** Flere kort bak samme lenke (samme person, flere scener samme dag). */
  offentligRader?: Record<string, unknown>[];
  oppdaterteRader: number;
  utsending?: Record<string, unknown>[];
  /** Lar «marker som åpnet»-spørringen feile, for å teste at kortet vises likevel. */
  feilPåMerking?: boolean;
}

function byggApp(t: Tilstand, innlogget = true) {
  const app = express();
  app.use(express.json());

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      t.spørringer.push({ sql, params: params ?? [] });

      if (sql.includes("SET response")) {
        return { rows: t.oppdaterteRader ? [{ id: KORT_ID }] : [], rowCount: t.oppdaterteRader };
      }
      if (sql.includes("SET opened_at")) {
        if (t.feilPåMerking) throw new Error("databasen sa nei");
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO scene_role_cards")) {
        return { rows: [{ id: KORT_ID, token: "hemmelig-token" }], rowCount: 1 };
      }
      // Rekkefølgen betyr noe: begge spørringene inneholder
      // «FROM scene_role_cards c», så den mest spesifikke må sjekkes først.
      if (sql.includes("COALESCE(t.email, c.contact_email)")) {
        return { rows: t.utsending ?? [], rowCount: (t.utsending ?? []).length };
      }
      if (sql.includes("FROM scene_role_cards c")) {
        const rader = t.offentligRader ?? (t.offentligRad ? [t.offentligRad] : []);
        return { rows: rader, rowCount: rader.length };
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

  it("lagrer manglende posisjon som SQL NULL, ikke JSON null", async () => {
    await request(byggApp(t))
      .post(`/api/role-room/projects/${PROSJEKT}/role-cards`)
      .send({ person_name: "Statist 5", action: "Stå bak disken." });

    const insert = t.spørringer.find((q) => q.sql.includes("INSERT"));
    // JSON.stringify(null) er strengen "null", og Postgres lagrer den som
    // JSON null. Da finner «WHERE position IS NULL» ingen av radene.
    // Verifisert mot ekte Postgres før denne testen ble skrevet.
    expect(insert?.params[8]).toBeNull();
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
        day_date: "2026-10-01",
        location_name: "Pizzeria Roma",
        location_address: "Storgata 1, Oslo",
        location_access: "Inngang gjennom bakgården.",
      },
    };
  });

  it("gir kortet uten innlogging", async () => {
    const res = await request(byggApp(t, false)).get("/api/role-room/role-cards/r/et-token");
    expect(res.status).toBe(200);
    expect(res.body.cards[0].card.action).toMatch(/bord 3/);
    expect(res.body.cards[0].scene.blocking.planUrl).toBeTruthy();
  });

  it("gir ALLE scenene bak lenken, ikke bare den første", async () => {
    const andre = { ...t.offentligRad, action: "Du går forbi i bakgrunnen.", scene_title: "Gaten utenfor" };
    const res = await request(byggApp({ ...t, offentligRader: [t.offentligRad, andre] }, false))
      .get("/api/role-room/role-cards/r/et-token");

    // Tre scener samme dag ga tre lenker før. Nå er det én lenke med tre deler.
    expect(res.body.cards).toHaveLength(2);
    expect(res.body.cards[1].scene.title).toBe("Gaten utenfor");
    // Stedet hører til dagen, ikke til hver scene.
    expect(res.body.meeting.name).toBe("Pizzeria Roma");
  });

  it("er hele lenken død når ett av kortene er trukket tilbake", async () => {
    const trukket = { ...t.offentligRad, revoked_at: "2026-09-20T10:00:00Z" };
    const res = await request(byggApp({ ...t, offentligRader: [t.offentligRad, trukket] }, false))
      .get("/api/role-room/role-cards/r/et-token");
    // En halv dag er verre enn ingen: da tror personen at hen har alt.
    expect(res.status).toBe(404);
  });

  it("gir BARE denne personens kort — ingen andre, ingen kontaktliste", async () => {
    const res = await request(byggApp(t, false)).get("/api/role-room/role-cards/r/et-token");
    const nøkler = Object.keys(res.body);
    // Strengt med vilje: hver nye toppnøkkel skal måtte forsvares her.
    expect(nøkler.sort()).toEqual(["cards", "meeting", "person", "project", "response"]);
    // Hele poenget: statisten skal ikke lete etter seg selv i scenen.
    // `cards` er nå personens EGNE scener — vakten må derfor være at ingen
    // andre personer finnes i svaret, ikke at nøkkelen mangler.
    const navn = res.body.cards.map((d: { card: { person_name: string } }) => d.card.person_name);
    expect([...new Set(navn)]).toEqual(["Statist 3"]);
    expect(res.body.cards[0].card.id).toBeUndefined();
  });

  it("merker kortet som åpnet — første gang, og bare da", async () => {
    const app = byggApp(t, false);
    await request(app).get("/api/role-room/role-cards/r/et-token");
    // Skrivingen er bevisst ikke ventet på i ruten (kortet skal vises uansett).
    await new Promise((r) => setTimeout(r, 0));

    const merking = t.spørringer.find((q) => q.sql.includes("SET opened_at"));
    expect(merking).toBeTruthy();
    // `opened_at IS NULL` gjør senere åpninger til et no-op: vi teller ikke
    // hvor mange ganger noen har sett kortet, bare at de har sett det.
    expect(merking?.sql).toContain("opened_at IS NULL");
    // På token: personen åpnet LENKEN, ikke ett kort av gangen.
    expect(merking?.sql).toContain("WHERE token = $1");
    expect(merking?.params).toEqual(["et-token"]);
  });

  it("viser kortet selv om åpnings-merkingen feiler", async () => {
    // Kvitteringen er mindre viktig enn at personen får se hva hen skal gjøre.
    const app = byggApp({ ...t, feilPåMerking: true }, false);
    const res = await request(app).get("/api/role-room/role-cards/r/et-token");
    expect(res.status).toBe(200);
    expect(res.body.cards[0].card.action).toMatch(/bord 3/);
  });

  it("gir ikke statisten beskjed om at åpningen blir registrert i svaret", async () => {
    const res = await request(byggApp(t, false)).get("/api/role-room/role-cards/r/et-token");
    // opened_at hører produksjonen til, ikke kortet personen leser.
    expect(JSON.stringify(res.body)).not.toContain("opened_at");
  });

  it("sier hvor personen skal møte, ikke bare når", async () => {
    const res = await request(byggApp(t, false)).get("/api/role-room/role-cards/r/et-token");
    expect(res.body.meeting).toEqual({
      name: "Pizzeria Roma",
      address: "Storgata 1, Oslo",
      access_notes: "Inngang gjennom bakgården.",
      date: "2026-10-01",
    });
  });

  it("finner dagen via scenen når kortet ikke peker på en dag", async () => {
    const res = await request(byggApp(t, false)).get("/api/role-room/role-cards/r/et-token");
    const spørring = t.spørringer.find((q) => q.sql.includes("casting_production_days"));
    // Stedet henger på dagen. Uten dette leddet mister kortene som ble laget
    // rett i scenebyggeren oppmøtestedet sitt.
    expect(spørring?.sql).toContain("d.scene_ids @> to_jsonb(c.scene_id)");
  });

  it("gir ingen meeting når dagen mangler sted", async () => {
    const utenSted = { ...t.offentligRad, location_name: null, location_address: null, location_access: null };
    const res = await request(byggApp({ ...t, offentligRad: utenSted }, false)).get("/api/role-room/role-cards/r/et-token");
    // Tom boks med overskriften «Sted» ser ut som noe som ikke lastet.
    expect(res.body.meeting).toBeNull();
  });

  it("gir ikke ut kontaktinfo til stedet", async () => {
    const res = await request(byggApp(t, false)).get("/api/role-room/role-cards/r/et-token");
    expect(JSON.stringify(res.body)).not.toContain("contact_info");
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

describe("kommer du?", () => {
  let t: Tilstand;
  beforeEach(() => {
    t = { spørringer: [], oppdaterteRader: 1, offentligRad: null };
  });

  const svarPå = (kropp: Record<string, unknown>) =>
    request(byggApp(t, false)).post("/api/role-room/role-cards/r/et-token/svar").send(kropp);

  it("lagrer svaret på hele lenken, ikke på ett kort", async () => {
    const res = await svarPå({ svar: "kommer" });
    expect(res.status).toBe(200);

    const skriving = t.spørringer.find((q) => q.sql.includes("SET response"));
    // Du kommer til DAGEN, ikke til scene 3 — derfor på token.
    expect(skriving?.sql).toContain("WHERE token = $1");
    expect(skriving?.params[0]).toBe("et-token");
    expect(skriving?.params[1]).toBe("kommer");
  });

  it("tar imot melding når personen ikke kan", async () => {
    const res = await svarPå({ svar: "kan_ikke", melding: "  Er syk  " });
    expect(res.status).toBe(200);
    const skriving = t.spørringer.find((q) => q.sql.includes("SET response"));
    expect(skriving?.params[2]).toBe("Er syk");
  });

  it("avviser noe annet enn de to svarene", async () => {
    // En tredje tilstand ville ingen skjerm visst hvordan den skulle vise.
    const res = await svarPå({ svar: "kanskje" });
    expect(res.status).toBe(400);
    expect(t.spørringer.some((q) => q.sql.includes("SET response"))).toBe(false);
  });

  it("svarer likt for ukjent og tilbaketrukket lenke", async () => {
    const res = await request(byggApp({ ...t, oppdaterteRader: 0 }, false))
      .post("/api/role-room/role-cards/r/finnes-ikke/svar").send({ svar: "kommer" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Lenken gjelder ikke lenger");
  });

  it("kutter en veldig lang melding i stedet for å avvise den", async () => {
    // Personen står kanskje på settet. Da er «for langt» en dårlig feilmelding.
    const res = await svarPå({ svar: "kan_ikke", melding: "a".repeat(900) });
    expect(res.status).toBe(200);
    const skriving = t.spørringer.find((q) => q.sql.includes("SET response"));
    expect(String(skriving?.params[2])).toHaveLength(500);
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

describe("utsending av lenker", () => {
  let t: Tilstand;
  // Token hører til personen og dagen, ikke til kortet: to ulike personer må
  // derfor ha ulike token, ellers havner de bak samme lenke.
  const rad = (over: Record<string, unknown> = {}) => ({
    id: KORT_ID, person_name: "Statist 3", action: "Du sitter ved bord 3.",
    cue: "Etter første bit.", call_time: null, token: "token-abc", sent_at: null,
    epost: "statist@eksempel.test", scene_title: "Pizzarestauranten", project_name: "Pizza", ...over,
  });

  beforeEach(() => {
    sendtEpost.mockClear();
    sendtEpost.mockResolvedValue({ sent: true, provider: "resend" } as never);
    t = { spørringer: [], offentligRad: null, oppdaterteRader: 1, utsending: [rad()] };
  });

  it("sender lenken og merker kortet som sendt", async () => {
    const res = await request(byggApp(t))
      .post(`/api/role-room/projects/${PROSJEKT}/role-cards/send`)
      .send({ scene_id: "scene-1" });

    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(1);
    expect(sendtEpost).toHaveBeenCalledTimes(1);
    const arg = sendtEpost.mock.calls[0][0] as { to: string; html: string };
    expect(arg.to).toBe("statist@eksempel.test");
    expect(arg.html).toContain("/statist/token-abc");
    expect(t.spørringer.some((q) => q.sql.includes("SET sent_at = now()"))).toBe(true);
  });

  it("hopper over dem som alt har fått lenken", async () => {
    t.utsending = [rad({ sent_at: "2026-09-18T09:00:00Z" })];
    const res = await request(byggApp(t))
      .post(`/api/role-room/projects/${PROSJEKT}/role-cards/send`).send({});

    expect(res.body.sent).toBe(0);
    expect(res.body.skipped[0].grunn).toBe("alt_sendt");
    // «Send til alle» skal ikke spamme dem som fikk lenken i går.
    expect(sendtEpost).not.toHaveBeenCalled();
  });

  it("sender likevel når kallet sier resend", async () => {
    t.utsending = [rad({ sent_at: "2026-09-18T09:00:00Z" })];
    const res = await request(byggApp(t))
      .post(`/api/role-room/projects/${PROSJEKT}/role-cards/send`).send({ resend: true });

    expect(res.body.sent).toBe(1);
  });

  it("sender ÉN e-post til en person med flere scener samme dag", async () => {
    t.utsending = [
      rad({ id: "a", scene_title: "Pizzarestauranten", call_time: "2026-10-01T07:30:00Z" }),
      rad({ id: "b", scene_title: "Gaten utenfor", call_time: "2026-10-01T11:00:00Z" }),
    ];
    const res = await request(byggApp(t))
      .post(`/api/role-room/projects/${PROSJEKT}/role-cards/send`).send({});

    // Tre like e-poster med hver sin lenke var hele problemet.
    expect(sendtEpost).toHaveBeenCalledTimes(1);
    // Kvitteringen teller personer: én person fikk beskjed, ikke to kort.
    expect(res.body.sent).toBe(1);
    expect(sendtEpost.mock.calls[0][0].subject).toMatch(/2 scener/);
    // Begge kortene er merket sendt, ellers ville «send til alle» sendt igjen.
    expect(res.body.sentIds.sort()).toEqual(["a", "b"]);
  });

  it("sender ikke kort uten handling eller uten adresse", async () => {
    t.utsending = [
      rad({ id: "a", action: null, token: "token-a", person_name: "Uten handling" }),
      rad({ id: "b", epost: null, token: "token-b", person_name: "Uten adresse" }),
    ];
    const res = await request(byggApp(t))
      .post(`/api/role-room/projects/${PROSJEKT}/role-cards/send`).send({});

    expect(res.body.sent).toBe(0);
    expect(res.body.skipped.map((s: { grunn: string }) => s.grunn).sort())
      .toEqual(["mangler_epost", "mangler_handling"]);
    expect(sendtEpost).not.toHaveBeenCalled();
  });

  it("rapporterer feil fra e-posttjenesten uten å merke kortet sendt", async () => {
    sendtEpost.mockResolvedValue({ sent: false, reason: "resend_domain_not_verified" } as never);
    const res = await request(byggApp(t))
      .post(`/api/role-room/projects/${PROSJEKT}/role-cards/send`).send({});

    expect(res.body.sent).toBe(0);
    expect(res.body.skipped[0].grunn).toBe("resend_domain_not_verified");
    // Ikke merket sendt: ellers ville «send til alle» hoppet over den neste gang.
    expect(t.spørringer.some((q) => q.sql.includes("SET sent_at = now()"))).toBe(false);
  });
});
