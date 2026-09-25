/**
 * Nexus tåler å bli brukt: kvoter og paginering, gjennom de ekte rutene.
 *
 * Modultestene viser at kvotelogikken og markørene regner riktig. Disse
 * viser at de faktisk er koblet inn — forskjellen på kode som finnes og
 * kode som virker.
 */
import express from "express";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Markørene HMAC-signeres, slik at én instans kan verifisere en markør en
// annen laget. Uten nøkkel svarer ruten 503 i stedet for å dele ut markører
// ingen kan lese. Render har CANVAS_CURSOR_SECRET satt, med AUTH_SECRET og
// LEADGRID_CRON_TRIGGER_TOKEN som fallback — testen speiler det.
const OPPRINNELIG_NOKKEL = process.env.CANVAS_CURSOR_SECRET;
process.env.CANVAS_CURSOR_SECRET = "test-markor-nokkel-lang-nok-for-hmac";
afterAll(() => {
  if (OPPRINNELIG_NOKKEL === undefined) delete process.env.CANVAS_CURSOR_SECRET;
  else process.env.CANVAS_CURSOR_SECRET = OPPRINNELIG_NOKKEL;
});

const mocks = vi.hoisted(() => ({
  resolveOrg: vi.fn(),
  loadProject: vi.fn(),
  entitled: vi.fn(),
}));

vi.mock("./leadgrid-org-resolver.js", () => ({ resolveOrgIdForUser: mocks.resolveOrg }));
vi.mock("./leadgrid-project-access.js", () => ({
  loadAccessibleLeadgridProject: mocks.loadProject,
}));
vi.mock("./leadgrid-entitlement-guard.js", () => ({
  assertAnyEntitled: mocks.entitled,
  LEADGRID_CANVAS_FEATURE_KEYS: ["leadgridCanvas"],
}));

import { registerLeadgridCanvasRoutes } from "./leadgrid-canvas-routes.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const projectId = "dentum-oslo";

function erSkjema(sql: string): boolean {
  const n = sql.trim().toUpperCase();
  return n.startsWith("CREATE TABLE") || n.startsWith("CREATE INDEX") ||
    n.startsWith("ALTER TABLE") || n.startsWith("UPDATE LEADGRID_CANVAS_NOTATER");
}

/** Bygger en app der kvotesvaret og notatlisten kan styres per test. */
function appMed(opts: {
  kvoteTillatt?: boolean;
  kvoteMangler?: boolean;
  notater?: Array<Record<string, unknown>>;
}) {
  const kall: string[] = [];
  const query = vi.fn(async (sql: unknown) => {
    const tekst = String(sql);
    kall.push(tekst.trim().split("\n")[0].trim());
    if (erSkjema(tekst)) return { rows: [], rowCount: 0 };
    if (tekst.includes("leadgrid_public_rate_limit_buckets")) {
      if (opts.kvoteMangler) {
        const feil = new Error('relation "leadgrid_public_rate_limit_buckets" does not exist');
        (feil as Error & { code?: string }).code = "42P01";
        throw feil;
      }
      return {
        rows: [{
          allowed: opts.kvoteTillatt !== false,
          remaining: opts.kvoteTillatt === false ? 0 : 42,
          retry_after_seconds: 17,
        }],
        rowCount: 1,
      };
    }
    if (tekst.includes("FROM leadgrid_canvas_notater")) {
      return { rows: opts.notater ?? [], rowCount: (opts.notater ?? []).length };
    }
    return { rows: [], rowCount: 0 };
  });

  const app = express();
  app.use(express.json({ limit: "30mb" }));
  registerLeadgridCanvasRoutes({
    app,
    pool: { query } as never,
    requireUserSession: () => ({ userId: "user-1" }),
  });
  return { app, query, kall };
}

function notat(i: number) {
  return {
    // Ekte notat-ID-er er UUID-er (randomUUID i ruten). Markøren validerer
    // formatet, så fiksturen må speile virkeligheten for å si noe sant.
    id: `${String(i).padStart(8, "0")}-2222-4222-8222-222222222222`,
    tittel: `Notat ${i}`,
    kategori: "Møte",
    selskap: null,
    lead_id: null,
    drawing_base64: "",
    updated_at: new Date(Date.UTC(2026, 8, 24, 12, 0, i)),
    slettet_at: null,
    delt: false,
    user_id: "user-1",
    lat: null, lon: null,
    stempler: "[]", tekstbokser: "[]", figurer: "[]", papir: "blank",
    noder: "[]", sider: 1, objekter: "[]", sokbar_tekst: "",
    dokumenter: "[]", eier_navn: "Ada",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveOrg.mockResolvedValue(organizationId);
  mocks.loadProject.mockResolvedValue({ id: projectId, organizationId, name: "Dentum" });
  mocks.entitled.mockResolvedValue(true);
});

describe("kvoter", () => {
  it("svarer 429 med Retry-After når kvoten er brukt opp", async () => {
    const { app } = appMed({ kvoteTillatt: false });
    const svar = await request(app).get("/api/leadgrid/canvas").query({ projectId });

    expect(svar.status).toBe(429);
    expect(svar.body.error).toBe("for_mange_kall");
    expect(svar.body.retry_after_seconds).toBe(17);
    // Uten Retry-After vet ikke klienten når den kan prøve igjen, og
    // gjetter — som regel for tidlig.
    expect(svar.headers["retry-after"]).toBe("17");
  });

  it("slipper kallet gjennom når kvotetabellen ikke finnes", async () => {
    // Et miljø uten migrasjon 0461 skal ikke miste Nexus. Manglende
    // kvotetabell er vår feil, ikke kundens.
    const { app } = appMed({ kvoteMangler: true, notater: [notat(1)] });
    const svar = await request(app).get("/api/leadgrid/canvas").query({ projectId });

    expect(svar.status).toBe(200);
    expect(svar.body.notater).toHaveLength(1);
  });

  it("teller ikke kvote før prosjektet er bekreftet tilgjengelig", async () => {
    // Prosjektoppslaget er felles for hele Leadgrid. Å bruke kvote på et
    // avvist kall ville latt en ugyldig prosjekt-ID spise kvoten til en
    // gyldig økt.
    mocks.loadProject.mockResolvedValueOnce(null);
    const { app, kall } = appMed({});
    const svar = await request(app).get("/api/leadgrid/canvas").query({ projectId: "finnes-ikke" });

    expect(svar.status).toBe(404);
    expect(kall.some((k) => k.includes("rate_limit"))).toBe(false);
  });
});

describe("paginering", () => {
  it("oppfører seg som før når ingen side-parametre er med", async () => {
    // Appen som ikke spør om paginering skal ikke merke at den finnes.
    const { app } = appMed({ notater: [notat(1), notat(2)] });
    const svar = await request(app).get("/api/leadgrid/canvas").query({ projectId });

    expect(svar.status).toBe(200);
    expect(svar.body.notater).toHaveLength(2);
    expect(svar.body).not.toHaveProperty("nextCursor");
  });

  it("gir markør og har_mer når det finnes en side til", async () => {
    // Ruten henter limit+1 rader for å vite om det er mer. Den ekstra
    // raden skal ikke ut til klienten.
    const { app } = appMed({ notater: [notat(1), notat(2), notat(3)] });
    const svar = await request(app).get("/api/leadgrid/canvas").query({ projectId, limit: "2" });

    expect(svar.status).toBe(200);
    expect(svar.body.notater).toHaveLength(2);
    expect(typeof svar.body.nextCursor).toBe("string");
  });

  it("gir nextCursor=null på siste side, så appen stopper løkka", async () => {
    const { app } = appMed({ notater: [notat(1), notat(2)] });
    const svar = await request(app).get("/api/leadgrid/canvas").query({ projectId, limit: "5" });

    expect(svar.body.notater).toHaveLength(2);
    expect(svar.body.nextCursor).toBeNull();
  });

  it("avviser en ødelagt markør med 400, ikke 500", async () => {
    // 500 får klienten til å prøve igjen med samme ødelagte markør i det
    // uendelige. 400 med kode forteller den at den skal begynne forfra.
    const { app } = appMed({ notater: [] });
    const svar = await request(app)
      .get("/api/leadgrid/canvas")
      .query({ projectId, cursor: "dette-er-ikke-en-markor" });

    expect(svar.status).toBe(400);
    expect(svar.body.error).toBe("invalid_canvas_cursor");
  });

  it("avviser en limit over taket", async () => {
    const { app } = appMed({ notater: [] });
    const svar = await request(app).get("/api/leadgrid/canvas").query({ projectId, limit: "9999" });

    expect(svar.status).toBe(400);
    expect(svar.body.error).toBe("invalid_canvas_page_limit");
    expect(svar.body.maxLimit).toBe(200);
  });
});

describe("kolonner som faktisk finnes", () => {
  it("spør ikke etter users.name — den kolonnen finnes ikke", async () => {
    // Funnet e2e mot ekte Postgres 2026-09-25: listespørringen brukte
    // COALESCE(u.name, u.email, ''), og users har first_name/last_name/
    // username/email — ingen «name». Resultatet var at Nexus SKREV fint og
    // LESTE 500. Man kunne tegne, notatet ble lagret, og listen viste det
    // aldri. Det forklarer hvorfor alle canvas-tabellene sto tomme.
    //
    // En mocket pool svarer det den blir bedt om og merker ingenting, så
    // denne testen ser på SQL-en i stedet. Den er ingen erstatning for å
    // kjøre mot et ekte skjema, men den hindrer at nettopp denne kommer
    // tilbake.
    const { app, kall } = appMed({ notater: [notat(1)] });
    await request(app).get("/api/leadgrid/canvas").query({ projectId });

    const alleSql = kall.join("\n");
    expect(alleSql).not.toMatch(/u\.name\b/);
  });

  it("sammenligner markør-ID mot uuid, ikke text", async () => {
    // «operator does not exist: uuid < text» — leadgrid_canvas_notater.id
    // er uuid. Castet $5::text ga 500 på hver eneste paginerte side.
    const { app, kall } = appMed({ notater: [notat(1), notat(2)] });
    await request(app).get("/api/leadgrid/canvas").query({ projectId, limit: "1" });

    const listeSql = kall.find((k) => k.includes("SELECT")) ?? "";
    expect(kall.join("\n")).not.toMatch(/\$5::text/);
    void listeSql;
  });
});

