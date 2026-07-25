import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { createLtiRouter, pushScore } from "./role-room-lti-routes.js";

function mountHandlers(router: any) {
  const out: Array<{ method: string; path: string; stack: any[] }> = [];
  for (const layer of router.stack) {
    if (layer.route) out.push({ method: Object.keys(layer.route.methods)[0].toUpperCase(), path: layer.route.path, stack: layer.route.stack.map((s: any) => s.handle) });
  }
  return out;
}
function makeRes() {
  const res: any = { statusCode: 200, body: undefined, redirectedTo: null, sent: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  res.redirect = (u: string) => { res.redirectedTo = u; return res; };
  res.send = (b: unknown) => { res.sent = b; return res; };
  return res;
}
async function run(stack: any[], req: any, res: any) {
  for (const h of stack) { let n = false; await h(req, res, () => { n = true; }); if (!n) break; }
}
const H = (rs: any[], m: string, p: string) => rs.find((x) => x.method === m && x.path === p)!.stack;

const adminSessions = new Map([["admin", { userId: "a1", email: "daniel@creatorhubn.com", name: "", role: "user", loginAt: "" }]]);

describe("LTI routes: jwks + config (offentlig)", () => {
  it("GET /lti/jwks genererer + returnerer JWKS", async () => {
    const inserted: any[] = [];
    const pool: any = { query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT kid, private_pem")) return { rows: [] }; // ingen nøkkel enda
      if (sql.includes("INSERT INTO role_room_lti_tool_keys")) { inserted.push(params); return { rows: [] }; }
      return { rows: [] };
    }) };
    const rs = mountHandlers(createLtiRouter(pool, {}));
    const res = makeRes();
    await run(H(rs, "GET", "/lti/jwks"), { query: {} }, res);
    expect(res.body.keys).toHaveLength(1);
    expect(res.body.keys[0]).toMatchObject({ kty: "RSA", use: "sig", alg: "RS256" });
    expect(inserted).toHaveLength(1); // nøkkel lagret
  });

  it("GET /lti/config eksponerer tool-endepunktene", async () => {
    const rs = mountHandlers(createLtiRouter({ query: vi.fn() } as any, {}));
    const res = makeRes();
    await run(H(rs, "GET", "/lti/config"), { query: {} }, res);
    expect(res.body).toMatchObject({ title: "The Role Room" });
    expect(res.body.oidc_initiation_url).toContain("/lti/login");
    expect(res.body.scopes.length).toBeGreaterThan(0);
  });
});

describe("LTI routes: plattform-registrering (super-admin)", () => {
  it("uten super-admin → 403", async () => {
    const rs = mountHandlers(createLtiRouter({ query: vi.fn(async () => ({ rows: [] })) } as any, { activeSessions: new Map() as any }));
    const res = makeRes();
    await run(H(rs, "POST", "/lti/platforms"), { headers: {}, body: {} }, res);
    expect(res.statusCode).toBe(403);
  });
  it("super-admin uten issuer → 400", async () => {
    const rs = mountHandlers(createLtiRouter({ query: vi.fn(async () => ({ rows: [] })) } as any, { activeSessions: adminSessions as any }));
    const res = makeRes();
    await run(H(rs, "POST", "/lti/platforms"), { headers: { authorization: "Bearer admin" }, body: { client_id: "c" } }, res);
    expect(res.statusCode).toBe(400);
  });
  it("super-admin m/ alle felt → 201", async () => {
    const pool: any = { query: vi.fn(async (sql: string) => sql.includes("INSERT INTO role_room_lti_platforms") ? { rows: [{ id: "plat-1" }] } : { rows: [] }) };
    const rs = mountHandlers(createLtiRouter(pool, { activeSessions: adminSessions as any }));
    const res = makeRes();
    await run(H(rs, "POST", "/lti/platforms"), { headers: { authorization: "Bearer admin" }, body: {
      issuer: "https://canvas", client_id: "c", auth_login_url: "https://canvas/auth", token_url: "https://canvas/token", jwks_url: "https://canvas/jwks",
    } }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toMatchObject({ platformId: "plat-1" });
  });
});

describe("pushScore (AGS grade-passback)", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  function toolKeyPool(extra: (sql: string, params: any[]) => any) {
    return { query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("SELECT kid, private_pem")) return { rows: [] };
      if (sql.includes("INSERT INTO role_room_lti_tool_keys")) return { rows: [] };
      return extra(sql, params);
    }) } as any;
  }

  it("henter token, poster score til eksisterende lineitem → ok", async () => {
    const pool = toolKeyPool((sql) => {
      if (sql.includes("FROM role_room_lti_launches")) return { rows: [{ id: "l1", platform_id: "p1", lti_user_sub: "u9", ags_lineitem: "https://lms/li/1", ags_lineitems: null, resource_link_id: "rl1" }] };
      if (sql.includes("FROM role_room_lti_platforms")) return { rows: [{ id: "p1", client_id: "c", token_url: "https://lms/token" }] };
      return { rows: [] };
    });
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url: any) => {
      calls.push(String(url));
      if (String(url).includes("/token")) return { ok: true, json: async () => ({ access_token: "AT" }) } as any;
      return { ok: true, json: async () => ({}) } as any; // score post
    }) as any;
    const r = await pushScore(pool, "l1", { scoreGiven: 85, scoreMaximum: 100, comment: "Bra" });
    expect(r).toMatchObject({ ok: true });
    expect(calls.some((u) => u.includes("/token"))).toBe(true);
    expect(calls.some((u) => u.includes("/scores"))).toBe(true);
  });

  it("launch finnes ikke → 404", async () => {
    const pool = toolKeyPool((sql) => sql.includes("FROM role_room_lti_launches") ? { rows: [] } : { rows: [] });
    const r = await pushScore(pool, "nope", { scoreGiven: 1, scoreMaximum: 2 });
    expect(r).toMatchObject({ ok: false, status: 404 });
  });

  it("token-endepunkt feiler → token_failed", async () => {
    const pool = toolKeyPool((sql) => {
      if (sql.includes("FROM role_room_lti_launches")) return { rows: [{ id: "l1", platform_id: "p1", lti_user_sub: "u9", ags_lineitem: "https://lms/li/1" }] };
      if (sql.includes("FROM role_room_lti_platforms")) return { rows: [{ id: "p1", client_id: "c", token_url: "https://lms/token" }] };
      return { rows: [] };
    });
    globalThis.fetch = vi.fn(async () => ({ ok: false, json: async () => ({}) }) as any) as any;
    const r = await pushScore(pool, "l1", { scoreGiven: 1, scoreMaximum: 2 });
    expect(r).toMatchObject({ ok: false, error: "token_failed" });
  });
});
