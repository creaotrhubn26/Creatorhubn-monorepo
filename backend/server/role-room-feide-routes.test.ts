import { describe, expect, it, vi } from "vitest";

import { readFeideConfig, makeStateStore, resolveFeideSession, createFeideRouter } from "./role-room-feide-routes.js";

// ── readFeideConfig ─────────────────────────────────────────────────────────
describe("readFeideConfig", () => {
  it("null uten client id/secret (env-gated → inaktiv)", () => {
    expect(readFeideConfig({} as any)).toBeNull();
    expect(readFeideConfig({ FEIDE_CLIENT_ID: "x" } as any)).toBeNull();
  });
  it("config m/ defaults når secrets satt", () => {
    const c = readFeideConfig({ FEIDE_CLIENT_ID: "cid", FEIDE_CLIENT_SECRET: "sec" } as any);
    expect(c).toMatchObject({ clientId: "cid", clientSecret: "sec" });
    expect(c?.authUrl).toContain("dataporten.no");
    expect(c?.scope).toContain("openid");
  });
});

// ── state-store (CSRF) ──────────────────────────────────────────────────────
describe("makeStateStore", () => {
  it("consume returnerer nonce én gang, deretter null", () => {
    let t = 1000;
    const s = makeStateStore(() => t);
    const state = s.create("nonce-1");
    expect(s.consume(state)).toEqual({ nonce: "nonce-1" });
    expect(s.consume(state)).toBeNull(); // engangsbruk
  });
  it("utløpt state → null", () => {
    let t = 0;
    const s = makeStateStore(() => t, 1000);
    const state = s.create("n");
    t = 2000;
    expect(s.consume(state)).toBeNull();
  });
  it("ukjent state → null", () => {
    expect(makeStateStore().consume("nope")).toBeNull();
  });
});

// ── resolveFeideSession (provisjonering + sesjon) ───────────────────────────
function makePool() {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("INSERT INTO users")) return { rows: [{ id: "u-1", role: "user" }] };
      if (sql.includes("creatorhub_auth_sessions") || sql.includes("INSERT INTO")) return { rows: [] };
      return { rows: [] };
    }),
  } as any;
}

describe("resolveFeideSession", () => {
  it("upsert bruker + mint sesjon m/ profession=education", async () => {
    const activeSessions = new Map();
    const r = await resolveFeideSession(makePool(), { email: "Larer@Skole.no", name: "Anne" }, {
      activeSessions, tokenFactory: () => "tok-abc", now: () => new Date(0),
    });
    expect(r).toMatchObject({ ok: true, token: "tok-abc", userId: "u-1" });
    const sess = activeSessions.get("tok-abc");
    expect(sess).toMatchObject({ userId: "u-1", email: "larer@skole.no", name: "Anne", profession: "education" });
  });
  it("uten e-post → feil", async () => {
    const r = await resolveFeideSession(makePool(), { name: "X" }, { activeSessions: new Map() });
    expect(r).toMatchObject({ ok: false, error: "email_missing" });
  });
});

// ── router: env-gating + login redirect ─────────────────────────────────────
function mountHandlers(router: any) {
  const out: Array<{ method: string; path: string; stack: any[] }> = [];
  for (const layer of router.stack) {
    if (layer.route) out.push({ method: Object.keys(layer.route.methods)[0].toUpperCase(), path: layer.route.path, stack: layer.route.stack.map((s: any) => s.handle) });
  }
  return out;
}
function makeRes() {
  const res: any = { statusCode: 200, body: undefined, redirectedTo: null };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  res.redirect = (u: string) => { res.redirectedTo = u; return res; };
  return res;
}
async function run(stack: any[], req: any, res: any) {
  for (const h of stack) { let n = false; await h(req, res, () => { n = true; }); if (!n) break; }
}
const H = (rs: any[], m: string, p: string) => rs.find((x) => x.method === m && x.path === p)!.stack;

describe("createFeideRouter", () => {
  it("status reflekterer env-gating", async () => {
    const rs = mountHandlers(createFeideRouter(makePool(), { activeSessions: new Map() }));
    const res = makeRes();
    await run(H(rs, "GET", "/feide/status"), { query: {} }, res);
    // Ingen env satt i testmiljø → ikke konfigurert.
    expect(res.body).toMatchObject({ configured: false });
  });
  it("login uten config → 503", async () => {
    const rs = mountHandlers(createFeideRouter(makePool(), { activeSessions: new Map() }));
    const res = makeRes();
    await run(H(rs, "GET", "/feide/login"), { query: {} }, res);
    expect(res.statusCode).toBe(503);
  });
});
