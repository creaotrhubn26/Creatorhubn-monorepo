/**
 * Tester for Marketing Cockpit-aggregatoren.
 *
 * Modulen importerer bare TYPER fra express, så den kan monteres mot et
 * bittelite fake-app-objekt uten å dra inn hele serveren. Meta Graph API
 * mockes på global fetch.
 *
 * Det som bevises her:
 *   1. Summary slår sammen alle seks seksjoner fra Meta-svarene.
 *   2. Per-seksjon degradering: én feilende Meta-kall tar IKKE med seg
 *      resten — det er hele designløftet i denne flaten.
 *   3. Manglende env-vars gir degradert modus, ikke krasj.
 *   4. set-cta og publish-event validerer input før de skriver til Meta.
 *   5. Auth-gaten stopper uautoriserte kall før noe Meta-arbeid gjøres.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupMarketingCockpitRoutes } from "./role-room-marketing-cockpit-routes";

type Handler = (req: any, res: any) => Promise<void> | void;

/** Minimal app som bare fanger rutene modulen registrerer. */
function makeApp() {
  const routes = new Map<string, Handler>();
  const app = {
    get: (path: string, h: Handler) => routes.set(`GET ${path}`, h),
    post: (path: string, h: Handler) => routes.set(`POST ${path}`, h),
  } as any;
  return { app, routes };
}

/** Fanger status + body fra en Express-respons. */
function makeRes() {
  const out: { status: number; body: any } = { status: 200, body: undefined };
  const res: any = {
    status(code: number) { out.status = code; return res; },
    json(body: unknown) { out.body = body; return res; },
    send(body: unknown) { out.body = body; return res; },
  };
  return { res, out };
}

const ENV_KEYS = [
  "THEROLERROOM_PAGE_ID",
  "THEROLERROOM_PAGE_ACCESS_TOKEN",
  "THEROLERROOM_IG_USER_ID",
  "THEROLERROOM_TRACKED_HASHTAGS",
] as const;

const savedEnv: Record<string, string | undefined> = {};

function configureEnv() {
  process.env.THEROLERROOM_PAGE_ID = "page-1";
  process.env.THEROLERROOM_PAGE_ACCESS_TOKEN = "tok-1";
  process.env.THEROLERROOM_IG_USER_ID = "ig-1";
  process.env.THEROLERROOM_TRACKED_HASHTAGS = "norskcasting,theroleroom";
}

/**
 * Mock av Meta Graph. `overrides` lar en enkelt sti feile, slik at vi kan
 * bevise at nabo-seksjonene overlever.
 */
function mockMeta(overrides: Record<string, { ok: boolean; status?: number; body: any }> = {}) {
  const calls: string[] = [];
  globalThis.fetch = vi.fn(async (input: any) => {
    const url = String(input);
    calls.push(url);
    for (const [needle, resp] of Object.entries(overrides)) {
      if (url.includes(needle)) {
        return {
          ok: resp.ok,
          status: resp.status ?? (resp.ok ? 200 : 400),
          json: async () => resp.body,
        } as Response;
      }
    }
    // Standard-svar dekker profile/cta (page-felter), mentions, ig, leads, hashtags.
    let body: any = {};
    if (url.includes("/tagged")) body = { data: [{ id: "t1", from: { name: "Kari" }, message: "Hei", created_time: "2026-09-01T10:00:00Z", permalink_url: "https://fb/1" }] };
    else if (url.includes("/leadgen_forms")) body = { data: [{ id: "f1", name: "Skjema", status: "ACTIVE", leads_count: 12 }] };
    else if (url.includes("ig_hashtag_search")) body = { data: [{ id: "h1" }] };
    else if (url.includes("/recent_media")) body = { data: [{ id: "m1" }, { id: "m2" }] };
    else if (url.includes("/events")) body = { data: [{ id: "e1", name: "Webinar", start_time: "2026-09-20T17:00:00Z" }] };
    else if (url.includes("ig-1")) body = { id: "ig-1", username: "theroleroom", name: "The Role Room", biography: "Casting", followers_count: 1893, media_count: 214 };
    else body = { id: "page-1", name: "The Role Room", about: "Casting", fan_count: 2481, category: "Media", website: "https://theroleroom.com", phone: "+4740000000" };
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as any;
  return calls;
}

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  vi.restoreAllMocks();
});

function mount(allow = true) {
  const { app, routes } = makeApp();
  const gate = vi.fn(() => allow);
  setupMarketingCockpitRoutes({ app, requireAdminOrDemoBypass: gate as any });
  return { routes, gate };
}

describe("registrering", () => {
  it("registrerer de fire endepunktene cockpiten bruker", () => {
    const { routes } = mount();
    expect([...routes.keys()].sort()).toEqual([
      "GET /api/role-room/marketing-cockpit/health",
      "GET /api/role-room/marketing-cockpit/summary",
      "POST /api/role-room/marketing-cockpit/actions/publish-event",
      "POST /api/role-room/marketing-cockpit/actions/set-cta",
    ]);
  });
});

describe("GET summary", () => {
  it("slår sammen alle seks seksjoner når Meta svarer", async () => {
    configureEnv();
    mockMeta();
    const { routes } = mount();
    const { res, out } = makeRes();
    await routes.get("GET /api/role-room/marketing-cockpit/summary")!({ query: {} }, res);

    expect(out.body.ok).toBe(true);
    expect(out.body.configured).toEqual({
      pageId: true, pageToken: true, igUserId: true,
      trackedHashtags: ["norskcasting", "theroleroom"],
    });

    // Alle seks seksjoner finnes og er ok.
    for (const key of ["profile", "mentions", "cta", "ig", "leads", "hashtags"]) {
      expect(out.body[key], `seksjon ${key}`).toBeDefined();
      expect(out.body[key].ok, `seksjon ${key} ok`).toBe(true);
    }

    expect(out.body.profile.data.fanCount).toBe(2481);
    expect(out.body.profile.data.name).toBe("The Role Room");
    expect(out.body.ig.data.followersCount).toBe(1893);
    expect(out.body.mentions.data.count).toBe(1);
    expect(out.body.leads.data.formCount).toBe(1);
    expect(out.body.leads.data.forms[0].leadsCount).toBe(12);
    expect(out.body.hashtags.data.tracked).toHaveLength(2);
    expect(typeof out.body.durationMs).toBe("number");
  });

  it("utleder CTA fra telefon når den finnes", async () => {
    configureEnv();
    mockMeta();
    const { routes } = mount();
    const { res, out } = makeRes();
    await routes.get("GET /api/role-room/marketing-cockpit/summary")!({ query: {} }, res);
    expect(out.body.cta.data.inferred).toEqual({ type: "CALL_NOW", link: "tel:+4740000000" });
  });

  it("DEGRADERER PER SEKSJON — én feilende Meta-kall dreper ikke resten", async () => {
    configureEnv();
    // Bare mentions-kallet feiler.
    mockMeta({
      "/tagged": { ok: false, status: 190, body: { error: { message: "Session has expired" } } },
    });
    const { routes } = mount();
    const { res, out } = makeRes();
    await routes.get("GET /api/role-room/marketing-cockpit/summary")!({ query: {} }, res);

    expect(out.body.mentions.ok).toBe(false);
    expect(out.body.mentions.error).toContain("Session has expired");
    expect(out.body.mentions.status).toBe(190);
    expect(out.body.mentions.data).toBeNull();

    // Nabo-seksjonene lever fortsatt — dette er hele poenget.
    expect(out.body.profile.ok).toBe(true);
    expect(out.body.ig.ok).toBe(true);
    expect(out.body.leads.ok).toBe(true);
    expect(out.body.ok).toBe(true);
  });

  it("gir degradert modus, ikke krasj, når env-vars mangler", async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    mockMeta();
    const { routes } = mount();
    const { res, out } = makeRes();
    await routes.get("GET /api/role-room/marketing-cockpit/summary")!({ query: {} }, res);

    expect(out.status).toBe(200);
    expect(out.body.configured.pageId).toBe(false);
    expect(out.body.configured.igUserId).toBe(false);
    for (const key of ["profile", "mentions", "cta", "ig", "leads", "hashtags"]) {
      expect(out.body[key].ok, `seksjon ${key}`).toBe(false);
      expect(out.body[key].error).toMatch(/not configured/);
    }
  });

  it("bruker standard-hashtags når env-varen ikke er satt", async () => {
    configureEnv();
    delete process.env.THEROLERROOM_TRACKED_HASHTAGS;
    mockMeta();
    const { routes } = mount();
    const { res, out } = makeRes();
    await routes.get("GET /api/role-room/marketing-cockpit/summary")!({ query: {} }, res);
    expect(out.body.configured.trackedHashtags.length).toBeGreaterThan(0);
    expect(out.body.configured.trackedHashtags).toContain("theroleroom");
  });

  it("stopper på auth-gaten før noe Meta-arbeid gjøres", async () => {
    configureEnv();
    const calls = mockMeta();
    const { routes, gate } = mount(false);
    const { res, out } = makeRes();
    await routes.get("GET /api/role-room/marketing-cockpit/summary")!({ query: {} }, res);
    expect(gate).toHaveBeenCalled();
    expect(out.body).toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});

describe("POST set-cta", () => {
  it("avviser manglende ctaType/ctaUrl med 400", async () => {
    configureEnv();
    mockMeta();
    const { routes } = mount();
    const { res, out } = makeRes();
    await routes.get("POST /api/role-room/marketing-cockpit/actions/set-cta")!({ body: {} }, res);
    expect(out.status).toBe(400);
    expect(out.body.ok).toBe(false);
    expect(out.body.error).toMatch(/required/i);
  });

  it("avviser når env-vars mangler, med 503", async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    mockMeta();
    const { routes } = mount();
    const { res, out } = makeRes();
    await routes.get("POST /api/role-room/marketing-cockpit/actions/set-cta")!(
      { body: { ctaType: "LEARN_MORE", ctaUrl: "https://theroleroom.com" } }, res,
    );
    expect(out.status).toBe(503);
  });

  it("krever auth", async () => {
    configureEnv();
    const calls = mockMeta();
    const { routes, gate } = mount(false);
    const { res, out } = makeRes();
    await routes.get("POST /api/role-room/marketing-cockpit/actions/set-cta")!(
      { body: { ctaType: "LEARN_MORE", ctaUrl: "https://x.no" } }, res,
    );
    expect(gate).toHaveBeenCalled();
    expect(out.body).toBeUndefined();
    expect(calls).toHaveLength(0);
  });
});

describe("POST publish-event", () => {
  it("avviser manglende tittel/starttid", async () => {
    configureEnv();
    mockMeta();
    const { routes } = mount();
    const { res, out } = makeRes();
    await routes.get("POST /api/role-room/marketing-cockpit/actions/publish-event")!({ body: {} }, res);
    expect(out.status).toBeGreaterThanOrEqual(400);
    expect(out.body.ok).toBe(false);
  });

  it("krever auth", async () => {
    configureEnv();
    const calls = mockMeta();
    const { routes, gate } = mount(false);
    const { res, out } = makeRes();
    await routes.get("POST /api/role-room/marketing-cockpit/actions/publish-event")!(
      { body: { title: "Webinar", startTime: "2026-09-20T17:00:00Z" } }, res,
    );
    expect(gate).toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
});

describe("GET health", () => {
  it("rapporterer manglende konfigurasjon uten å kaste", async () => {
    for (const k of ENV_KEYS) delete process.env[k];
    mockMeta();
    const { routes } = mount();
    const { res, out } = makeRes();
    await routes.get("GET /api/role-room/marketing-cockpit/health")!({ query: {} }, res);
    expect(out.body.ok).toBe(false);
    expect(out.body.reason).toBe("env_missing");
    expect(out.body.configured).toEqual({ pageId: false, pageToken: false });
  });
});
