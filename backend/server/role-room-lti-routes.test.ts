import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { createLtiRouter, pushScore, extractLtiIdentity, gradeToScore, buildToolConfiguration } from "./role-room-lti-routes.js";

describe("gradeToScore (fri-tekst-karakter → AGS-tallscore)", () => {
  it("bestått/godkjent → 1/1, ikke bestått → 0/1", () => {
    expect(gradeToScore("Bestått")).toEqual({ scoreGiven: 1, scoreMaximum: 1 });
    expect(gradeToScore("godkjent")).toEqual({ scoreGiven: 1, scoreMaximum: 1 });
    expect(gradeToScore("Ikke bestått")).toEqual({ scoreGiven: 0, scoreMaximum: 1 });
    expect(gradeToScore("underkjent")).toEqual({ scoreGiven: 0, scoreMaximum: 1 });
  });
  it("bokstavkarakter A–F → 5..0 av 5", () => {
    expect(gradeToScore("A")).toEqual({ scoreGiven: 5, scoreMaximum: 5 });
    expect(gradeToScore("c")).toEqual({ scoreGiven: 3, scoreMaximum: 5 });
    expect(gradeToScore("F")).toEqual({ scoreGiven: 0, scoreMaximum: 5 });
  });
  it("prosent → av 100", () => {
    expect(gradeToScore("85%")).toEqual({ scoreGiven: 85, scoreMaximum: 100 });
    expect(gradeToScore("72 %")).toEqual({ scoreGiven: 72, scoreMaximum: 100 });
  });
  it("tallkarakter 1–6 → av 6; komma godtas", () => {
    expect(gradeToScore("4")).toEqual({ scoreGiven: 4, scoreMaximum: 6 });
    expect(gradeToScore("5,5")).toEqual({ scoreGiven: 5.5, scoreMaximum: 6 });
  });
  it("poeng > 6 → av 100", () => {
    expect(gradeToScore("85")).toEqual({ scoreGiven: 85, scoreMaximum: 100 });
  });
  it("utolkbar karakter → null", () => {
    expect(gradeToScore("Meget bra!")).toBeNull();
    expect(gradeToScore("")).toBeNull();
  });
});

const ROLES = "https://purl.imsglobal.org/spec/lti/claim/roles";

describe("extractLtiIdentity (LTI id_token → identitet + rolle)", () => {
  it("henter e-post (lowercased) + navn fra OIDC-claims", () => {
    const id = extractLtiIdentity({ email: "Kari@Skole.No", name: "Kari Nordmann", [ROLES]: [] });
    expect(id.email).toBe("kari@skole.no");
    expect(id.name).toBe("Kari Nordmann");
  });
  it("faller tilbake til given_name + family_name når name mangler", () => {
    const id = extractLtiIdentity({ email: "a@b.no", given_name: "Ola", family_name: "Hansen", [ROLES]: [] });
    expect(id.name).toBe("Ola Hansen");
  });
  it("Instructor-rolle → faglærer", () => {
    const id = extractLtiIdentity({ email: "a@b.no", [ROLES]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"] });
    expect(id.educationRole).toBe("faglærer");
  });
  it("kun Learner-rolle → student", () => {
    const id = extractLtiIdentity({ email: "a@b.no", [ROLES]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"] });
    expect(id.educationRole).toBe("student");
  });
  it("både Instructor og Learner → faglærer (instruktør vinner)", () => {
    const id = extractLtiIdentity({ email: "a@b.no", [ROLES]: [
      "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner",
      "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor",
    ] });
    expect(id.educationRole).toBe("faglærer");
  });
  it("ingen roller → faglærer (default; launcher setter karakter)", () => {
    const id = extractLtiIdentity({ email: "a@b.no", [ROLES]: [] });
    expect(id.educationRole).toBe("faglærer");
  });
  it("uten e-post-claim → email null (uautentisert landing)", () => {
    const id = extractLtiIdentity({ [ROLES]: [] });
    expect(id.email).toBeNull();
  });
});

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
    // Må advertise BÅDE AGS- og NRPS-scope (ellers gir ikke Canvas roster-tilgang).
    expect(res.body.scopes).toContain("https://purl.imsglobal.org/spec/lti-ags/scope/score");
    expect(res.body.scopes).toContain("https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly");
    // Canvas-extensions m/ course_navigation-placement + public privacy_level.
    const canvasExt = res.body.extensions?.find((e: any) => e.platform === "canvas.instructure.com");
    expect(canvasExt?.privacy_level).toBe("public");
    expect(canvasExt?.settings?.placements?.map((p: any) => p.placement)).toContain("course_navigation");
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

describe("buildToolConfiguration (IMS dynamic-registration payload)", () => {
  it("produserer gyldig IMS tool-config med LTI-claim", () => {
    const c = buildToolConfiguration("The Role Room");
    expect(c.application_type).toBe("web");
    expect(c.grant_types).toEqual(expect.arrayContaining(["client_credentials", "implicit"]));
    expect(c.response_types).toContain("id_token");
    expect(c.token_endpoint_auth_method).toBe("private_key_jwt");
    expect(c.initiate_login_uri).toMatch(/\/lti\/login$/);
    expect(c.jwks_uri).toMatch(/\/lti\/jwks$/);
    expect(c.redirect_uris).toEqual(expect.arrayContaining([expect.stringMatching(/\/lti\/launch$/)]));
    expect(String(c.scope)).toContain("lineitem");            // AGS
    expect(String(c.scope)).toContain("contextmembership");   // NRPS
    const lti = (c as any)["https://purl.imsglobal.org/spec/lti-tool-configuration"];
    expect(lti.target_link_uri).toMatch(/\/lti\/launch$/);
    expect(lti.claims).toEqual(expect.arrayContaining(["sub", "name", "email", "roles"]));
    const types = lti.messages.map((m: any) => m.type);
    expect(types).toContain("LtiResourceLinkRequest");
    expect(types).toContain("LtiDeepLinkingRequest");
  });
});

describe("GET /lti/register (dynamic registration)", () => {
  const OIDC = "https://moodle.example.edu/mod/lti/openid-configuration";
  const openidConfig = {
    issuer: "https://moodle.example.edu",
    authorization_endpoint: "https://moodle.example.edu/mod/lti/auth.php",
    token_endpoint: "https://moodle.example.edu/mod/lti/token.php",
    jwks_uri: "https://moodle.example.edu/mod/lti/certs.php",
    registration_endpoint: "https://moodle.example.edu/mod/lti/openid-registration.php",
    "https://purl.imsglobal.org/spec/lti-platform-configuration": { product_family_code: "moodle" },
  };

  function stubFetch() {
    return vi.fn(async (url: string, init?: any) => {
      if (url === OIDC) return { ok: true, json: async () => openidConfig } as any;
      if (url === openidConfig.registration_endpoint) {
        return { ok: true, json: async () => ({
          client_id: "CLIENT123",
          "https://purl.imsglobal.org/spec/lti-tool-configuration": { deployment_id: "DEP1" },
        }) } as any;
      }
      throw new Error(`unexpected fetch ${url}`);
    });
  }

  it("registrerer plattform som pending og returnerer close-page", async () => {
    vi.stubGlobal("fetch", stubFetch());
    const upserts: any[] = [];
    const pool: any = { query: vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes("INSERT INTO role_room_lti_platforms")) { upserts.push(params); return { rows: [{ id: "p1" }] }; }
      return { rows: [] };
    }) };
    const rs = mountHandlers(createLtiRouter(pool, {}));
    const res = makeRes();
    await run(H(rs, "GET", "/lti/register"), { query: { openid_configuration: OIDC, registration_token: "regtok" } }, res);
    // close-page HTML
    expect(String(res.sent)).toContain("org.imsglobal.lti.close");
    // plattform lagret som pending + dynamic + product_family
    const p = upserts[0];
    expect(p).toContain("https://moodle.example.edu"); // issuer
    expect(p).toContain("CLIENT123");                  // client_id
    expect(p).toContain("DEP1");                        // deployment_id
    expect(p).toContain("pending");
    expect(p).toContain("dynamic");
    expect(p).toContain("moodle");
    vi.unstubAllGlobals();
  });

  it("avviser privat/ikke-https openid_configuration (SSRF)", async () => {
    const pool: any = { query: vi.fn(async () => ({ rows: [] })) };
    const rs = mountHandlers(createLtiRouter(pool, {}));
    const res = makeRes();
    await run(H(rs, "GET", "/lti/register"), { query: { openid_configuration: "http://127.0.0.1/openid" } }, res);
    expect(res.statusCode).toBe(400);
    expect(String(res.sent)).toMatch(/ugyldig|invalid/i);
  });

  it("feiler når openid-config mangler endepunkter", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ issuer: "https://x.edu" }) }) as any));
    const pool: any = { query: vi.fn(async () => ({ rows: [] })) };
    const rs = mountHandlers(createLtiRouter(pool, {}));
    const res = makeRes();
    await run(H(rs, "GET", "/lti/register"), { query: { openid_configuration: "https://x.edu/openid" } }, res);
    expect(res.statusCode).toBe(400);
    vi.unstubAllGlobals();
  });
});

describe("POST /lti/launch approval gate", () => {
  it("avviser launch fra pending plattform med 403", async () => {
    const pool: any = { query: vi.fn(async (sql: string) => {
      if (sql.includes("DELETE FROM role_room_lti_states")) return { rows: [{ nonce: "n", platform_id: "p1" }] };
      if (sql.includes("SELECT * FROM role_room_lti_platforms")) return { rows: [{ id: "p1", status: "pending", issuer: "https://moodle.example.edu", client_id: "C", jwks_url: "https://moodle.example.edu/certs" }] };
      return { rows: [] };
    }) };
    const rs = mountHandlers(createLtiRouter(pool, {}));
    const res = makeRes();
    // Minimal JWT med iss (unverified iss-uttrekk brukes til state-scoping).
    const fakeJwt = ["e30", Buffer.from(JSON.stringify({ iss: "https://moodle.example.edu" })).toString("base64url"), "sig"].join(".");
    await run(H(rs, "POST", "/lti/launch"), { body: { id_token: fakeJwt, state: "st" } }, res);
    expect(res.statusCode).toBe(403);
    expect(String(res.sent)).toContain("platform_not_approved");
  });
});

describe("LTI admin: approve/reject platforms", () => {
  const admin = { headers: { authorization: "Bearer admin" }, params: {}, body: {}, query: {} };
  const deps = { activeSessions: adminSessions as any };

  it("POST /lti/platforms/:id/approve setter status=approved", async () => {
    const calls: any[] = [];
    const pool: any = { query: vi.fn(async (sql: string, params: any[]) => {
      calls.push([sql, params]);
      if (sql.includes("UPDATE role_room_lti_platforms SET status")) return { rows: [{ id: params[0] }] };
      return { rows: [] };
    }) };
    const rs = mountHandlers(createLtiRouter(pool, deps));
    const res = makeRes();
    await run(H(rs, "POST", "/lti/platforms/:id/approve"), { ...admin, params: { id: "p1" } }, res);
    expect(res.body).toMatchObject({ success: true });
    expect(calls.some(([s]) => s.includes("SET status='approved'") || s.includes("SET status = 'approved'"))).toBe(true);
  });

  it("DELETE /lti/platforms/:id fjerner plattform", async () => {
    const pool: any = { query: vi.fn(async () => ({ rows: [{ id: "p1" }] })) };
    const rs = mountHandlers(createLtiRouter(pool, deps));
    const res = makeRes();
    await run(H(rs, "DELETE", "/lti/platforms/:id"), { ...admin, params: { id: "p1" } }, res);
    expect(res.body).toMatchObject({ success: true });
  });

  it("GET /lti/platforms inkluderer status", async () => {
    const pool: any = { query: vi.fn(async (sql: string) => {
      if (sql.includes("SELECT") && sql.includes("role_room_lti_platforms")) {
        return { rows: [{ id: "p1", issuer: "https://moodle.example.edu", status: "pending", product_family: "moodle", registered_via: "dynamic" }] };
      }
      return { rows: [] };
    }) };
    const rs = mountHandlers(createLtiRouter(pool, deps));
    const res = makeRes();
    await run(H(rs, "GET", "/lti/platforms"), admin, res);
    expect(res.body.platforms[0]).toMatchObject({ status: "pending", product_family: "moodle" });
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
