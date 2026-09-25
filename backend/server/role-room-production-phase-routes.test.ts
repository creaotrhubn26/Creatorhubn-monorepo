/**
 * Produksjonsfase og varsel om pre-produksjon.
 *
 * Det som testes er de fire reglene varselet står og faller på: at det henger
 * på OVERGANGEN og ikke på tilstanden, at uannonserte produksjoner ikke lekker
 * ut, at ingen får det samme varselet to ganger, og at en produksjon ikke kan
 * havne i en fase ingen skjerm kjenner.
 */

import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { setupRoleRoomProductionPhaseRoutes } from "./role-room-production-phase-routes";

const PROSJEKT = "prosjekt-1";

vi.mock("./casting-project-ownership.js", () => ({
  userCanAccessCastingProject: async (_pool: unknown, projectId: string) => projectId === PROSJEKT,
}));

const sendtEpost = vi.fn(async () => ({ sent: true, provider: "resend" }));
vi.mock("./transactional-email-service.js", () => ({
  sendTransactionalEmail: (...a: unknown[]) => sendtEpost(...(a as [])),
}));

interface Tilstand {
  spørringer: { sql: string; params: unknown[] }[];
  /** Fasen prosjektet står i FØR kallet. */
  forrigeFase: string | null;
  /** Raden UPDATE-en returnerer. */
  etter: Record<string, unknown>;
  mottakere: Record<string, unknown>[];
  /** Er produksjonen annonsert? Styrer om interesse kan meldes. */
  annonsert?: boolean;
  interesserte?: Record<string, unknown>[];
  harTalentProfil?: boolean;
}

function tilstand(over: Partial<Tilstand> = {}): Tilstand {
  return {
    spørringer: [],
    forrigeFase: "utvikling",
    etter: {
      id: PROSJEKT,
      name: "Pizza – kampanje",
      project_type: "reklame",
      phase: "pre_produksjon",
      phase_changed_at: "2026-09-18T10:00:00Z",
      announced_at: "2026-09-18T10:00:00Z",
    },
    mottakere: [{ id: "talent-1", display_name: "Kari", email: "kari@eksempel.test" }],
    annonsert: true,
    ...over,
  };
}

function byggApp(t: Tilstand, innlogget = true) {
  const app = express();
  app.use(express.json());

  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      t.spørringer.push({ sql, params: params ?? [] });
      if (sql.includes("FROM casting_projects\n          WHERE id = $1 AND announced_at IS NOT NULL")
          || (sql.includes("SELECT id FROM casting_projects") && sql.includes("announced_at IS NOT NULL"))) {
        return { rows: t.annonsert ? [{ id: PROSJEKT }] : [], rowCount: t.annonsert ? 1 : 0 };
      }
      if (sql.includes("INSERT INTO production_interests")) {
        return { rows: [{ created_at: "2026-09-21T10:00:00Z", melding: null }], rowCount: 1 };
      }
      if (sql.includes("UPDATE production_interests")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM production_interests i")) {
        return { rows: t.interesserte ?? [], rowCount: (t.interesserte ?? []).length };
      }
      if (sql.includes("SELECT id FROM talents WHERE owner_user_id")) {
        return { rows: t.harTalentProfil === false ? [] : [{ id: "talent-1" }], rowCount: t.harTalentProfil === false ? 0 : 1 };
      }
      if (sql.includes("SELECT phase, announced_at FROM casting_projects")) {
        return { rows: [{ phase: t.forrigeFase, announced_at: t.etter.announced_at }], rowCount: 1 };
      }
      if (sql.includes("UPDATE casting_projects")) {
        return { rows: [t.etter], rowCount: 1 };
      }
      if (sql.includes("FROM talent_production_alerts a")) {
        return { rows: t.mottakere, rowCount: t.mottakere.length };
      }
      if (sql.includes("INSERT INTO production_alert_sends")) {
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes("FROM casting_projects") && sql.includes("announced_at IS NOT NULL")) {
        return { rows: [{ id: PROSJEKT, name: "Pizza", phase: "pre_produksjon" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
  } as unknown as Pool;

  setupRoleRoomProductionPhaseRoutes({
    app,
    pool,
    getActiveSession: () => (innlogget ? { userId: "bruker-1" } : null),
  });
  return app;
}

beforeEach(() => {
  sendtEpost.mockClear();
  sendtEpost.mockResolvedValue({ sent: true, provider: "resend" } as never);
});

describe("fasen", () => {
  it("krever innlogging", async () => {
    const res = await request(byggApp(tilstand(), false))
      .put(`/api/role-room/projects/${PROSJEKT}/fase`).send({ fase: "opptak" });
    expect(res.status).toBe(401);
  });

  it("svarer 404 — ikke 403 — for et prosjekt du ikke har tilgang til", async () => {
    const res = await request(byggApp(tilstand()))
      .put("/api/role-room/projects/annet-prosjekt/fase").send({ fase: "opptak" });
    expect(res.status).toBe(404);
  });

  it("avviser en fase ingen skjerm kjenner", async () => {
    const t = tilstand();
    const res = await request(byggApp(t)).put(`/api/role-room/projects/${PROSJEKT}/fase`).send({ fase: "kaffepause" });
    expect(res.status).toBe(400);
    expect(t.spørringer.some((q) => q.sql.includes("UPDATE casting_projects"))).toBe(false);
  });

  it("lar annonseringen stå når feltet ikke sendes", async () => {
    const t = tilstand();
    await request(byggApp(t)).put(`/api/role-room/projects/${PROSJEKT}/fase`).send({ fase: "opptak" });
    const oppdatering = t.spørringer.find((q) => q.sql.includes("UPDATE casting_projects"));
    // null = «ikke rør annonseringen». Å annonsere er et eget valg.
    expect(oppdatering?.params[2]).toBeNull();
  });
});

describe("varselet", () => {
  it("sendes ved overgangen INN i pre-produksjon", async () => {
    const t = tilstand({ forrigeFase: "utvikling" });
    const res = await request(byggApp(t)).put(`/api/role-room/projects/${PROSJEKT}/fase`).send({ fase: "pre_produksjon" });

    expect(res.body.varsel).toEqual({ sendt: 1, hoppet: 0 });
    expect(sendtEpost).toHaveBeenCalledTimes(1);
    expect(sendtEpost.mock.calls[0][0].subject).toContain("pre-produksjon");
  });

  it("sendes IKKE når fasen settes til pre-produksjon på nytt", async () => {
    // Varselet henger på overgangen, ikke på tilstanden. Ellers ville et
    // uskyldig lagre-klikk sendt e-post til alle en gang til.
    const t = tilstand({ forrigeFase: "pre_produksjon" });
    const res = await request(byggApp(t)).put(`/api/role-room/projects/${PROSJEKT}/fase`).send({ fase: "pre_produksjon" });

    expect(res.body.varsel).toBeNull();
    expect(sendtEpost).not.toHaveBeenCalled();
  });

  it("sendes IKKE for en produksjon som ikke er annonsert", async () => {
    // Mange produksjoner er under NDA lenge etter at de er reelle.
    const t = tilstand({ etter: { ...tilstand().etter, announced_at: null } });
    const res = await request(byggApp(t)).put(`/api/role-room/projects/${PROSJEKT}/fase`).send({ fase: "pre_produksjon" });

    expect(res.body.varsel).toBeNull();
    expect(sendtEpost).not.toHaveBeenCalled();
  });

  it("spør bare etter dem som ikke alt har fått varselet", async () => {
    const t = tilstand();
    await request(byggApp(t)).put(`/api/role-room/projects/${PROSJEKT}/fase`).send({ fase: "pre_produksjon" });

    const utvalg = t.spørringer.find((q) => q.sql.includes("FROM talent_production_alerts a"));
    expect(utvalg?.sql).toContain("NOT EXISTS");
    expect(utvalg?.sql).toContain("production_alert_sends");
    // Tom typeliste = alle typer: et filter som stilltiende utelukker
    // produksjoner er verre enn ingen filter.
    expect(utvalg?.sql).toContain("cardinality(a.prosjekttyper) = 0");
  });

  it("merker ikke som sendt når e-posten ikke gikk", async () => {
    sendtEpost.mockResolvedValue({ sent: false, reason: "resend_domain_not_verified" } as never);
    const t = tilstand();
    const res = await request(byggApp(t)).put(`/api/role-room/projects/${PROSJEKT}/fase`).send({ fase: "pre_produksjon" });

    expect(res.body.varsel).toEqual({ sendt: 0, hoppet: 1 });
    // Ellers ville personen aldri fått varselet: raden hadde sagt at det var sendt.
    expect(t.spørringer.some((q) => q.sql.includes("INSERT INTO production_alert_sends"))).toBe(false);
  });

  it("setter fasen selv om varslingen feiler", async () => {
    sendtEpost.mockRejectedValue(new Error("e-posttjenesten er nede") as never);
    const t = tilstand();
    const res = await request(byggApp(t)).put(`/api/role-room/projects/${PROSJEKT}/fase`).send({ fase: "pre_produksjon" });

    // Produsentens egen tilstand skal ikke rulles tilbake av en e-postfeil.
    expect(res.status).toBe(200);
    expect(res.body.prosjekt.phase).toBe("pre_produksjon");
    expect(res.body.varsel).toBeNull();
  });
});

describe("interessemelding", () => {
  it("lar en skuespiller melde seg på en annonsert produksjon", async () => {
    const t = tilstand();
    const res = await request(byggApp(t)).post(`/api/role-room/produksjoner/${PROSJEKT}/interesse`).send({});
    expect(res.status).toBe(201);
    expect(res.body.interesse.created_at).toBeTruthy();
  });

  it("gjenbruker raden når noen melder seg igjen etter å ha trukket seg", async () => {
    const t = tilstand();
    await request(byggApp(t)).post(`/api/role-room/produksjoner/${PROSJEKT}/interesse`).send({ melding: "Kan alle dager" });
    const skriving = t.spørringer.find((q) => q.sql.includes("INSERT INTO production_interests"));
    // To rader for samme person hjelper ingen.
    expect(skriving?.sql).toContain("ON CONFLICT (project_id, talent_id)");
    expect(skriving?.sql).toContain("withdrawn_at = NULL");
  });

  it("avviser interesse på en produksjon som ikke er annonsert", async () => {
    // Ellers kunne man bekrefte at en hemmelig produksjon finnes ved å gjette id.
    const res = await request(byggApp(tilstand({ annonsert: false })))
      .post(`/api/role-room/produksjoner/${PROSJEKT}/interesse`).send({});
    expect(res.status).toBe(404);
  });

  it("krever talent-profil, ikke bare innlogging", async () => {
    const res = await request(byggApp(tilstand({ harTalentProfil: false })))
      .post(`/api/role-room/produksjoner/${PROSJEKT}/interesse`).send({});
    expect(res.status).toBe(401);
  });

  it("trekker interessen uten å slette raden", async () => {
    const t = tilstand();
    const res = await request(byggApp(t)).delete(`/api/role-room/produksjoner/${PROSJEKT}/interesse`);
    expect(res.status).toBe(200);
    const q = t.spørringer.find((s) => s.sql.includes("production_interests SET withdrawn_at"));
    // Produsenten skal se at noen meldte seg og ombestemte seg.
    expect(q).toBeTruthy();
    expect(t.spørringer.some((s) => s.sql.includes("DELETE FROM production_interests"))).toBe(false);
  });

  it("gir produsenten de interesserte, også de som trakk seg — sist", async () => {
    const t = tilstand({ interesserte: [{ id: "i1", display_name: "Kari", withdrawn_at: null }] });
    const res = await request(byggApp(t)).get(`/api/role-room/projects/${PROSJEKT}/interesse`);
    expect(res.status).toBe(200);
    expect(res.body.interesserte).toHaveLength(1);
    const q = t.spørringer.find((s) => s.sql.includes("FROM production_interests i"));
    expect(q?.sql).toContain("ORDER BY i.withdrawn_at IS NOT NULL");
  });

  it("svarer 404 for et prosjekt produsenten ikke har tilgang til", async () => {
    const res = await request(byggApp(tilstand())).get("/api/role-room/projects/annet-prosjekt/interesse");
    expect(res.status).toBe(404);
  });
});

describe("listen skuespilleren ser", () => {
  it("krever innlogging — dette er ikke en offentlig bransjeoversikt", async () => {
    const res = await request(byggApp(tilstand(), false)).get("/api/role-room/produksjoner/pa-vei");
    expect(res.status).toBe(401);
  });

  it("viser bare annonserte produksjoner", async () => {
    const t = tilstand();
    const res = await request(byggApp(t)).get("/api/role-room/produksjoner/pa-vei");
    expect(res.status).toBe(200);

    const spørring = t.spørringer.find((q) => q.sql.includes("FROM casting_projects"));
    expect(spørring?.sql).toContain("announced_at IS NOT NULL");
    // Utvikling hører ikke hjemme her: da finnes prosjektet bare på papir.
    expect(spørring?.sql).toContain("phase IN ('pre_produksjon', 'opptak')");
  });

  it("gir fasen et navn folk leser, ikke en nøkkel", async () => {
    const res = await request(byggApp(tilstand())).get("/api/role-room/produksjoner/pa-vei");
    expect(res.body.produksjoner[0].fase_navn).toBe("Pre-produksjon");
  });
});
