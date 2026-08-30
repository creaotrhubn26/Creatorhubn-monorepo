import { readFileSync } from "node:fs";
import express, { type Express } from "express";
import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  createLeadgridMagicConsumeRateLimiter,
  hashLeadgridMagicToken,
  LEADGRID_SELF_ONBOARD_BODY_LIMIT_BYTES,
  registerOrgSelfOnboardRoutes,
  requireLeadgridSelfOnboardJsonEnvelope,
} from "./org-self-onboard-routes.js";

const RAW_TOKEN = "ab".repeat(32);

type CandidateOverrides = Partial<{
  expiresAt: string;
  organizationId: string | null;
}>;

function buildCandidate(overrides: CandidateOverrides = {}) {
  return {
    id: "user-1",
    email: "owner@example.test",
    first_name: "Ola",
    last_name: "Nordmann",
    username: null,
    role: "member",
    auth_session_version: "4",
    is_active: true,
    meta: {
      magic_token_hash: hashLeadgridMagicToken(RAW_TOKEN),
      magic_expires:
        overrides.expiresAt ?? new Date(Date.now() + 60_000).toISOString(),
    },
    organization_id:
      overrides.organizationId === undefined
        ? "org-1"
        : overrides.organizationId,
    organization_name: "Nordmann AS",
    organization_slug: "nordmann-as",
    organization_plan: "solo_free",
  };
}

function buildApp(
  options: {
    candidate?: ReturnType<typeof buildCandidate> | null;
    failSessionInsert?: boolean;
    sessionStoreReady?: boolean;
  } = {},
) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const candidate =
    options.candidate === undefined ? buildCandidate() : options.candidate;
  const client = {
    query: vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      statements.push({ sql, params });
      if (sql.includes("FROM users u") && sql.includes("FOR UPDATE OF u")) {
        return {
          rows: candidate ? [candidate] : [],
          rowCount: candidate ? 1 : 0,
        };
      }
      if (
        sql.includes("INSERT INTO creatorhub_auth_sessions") &&
        options.failSessionInsert
      ) {
        throw new Error("session insert unavailable");
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn(async () => client),
  } as unknown as Pool;
  const activeSessions = new Map<string, any>();
  const app: Express = express();
  app.use(express.json());
  registerOrgSelfOnboardRoutes({
    app,
    pool,
    activeSessions,
    ensureSessionStore: vi.fn(async () => options.sessionStoreReady !== false),
  });
  return { app, activeSessions, client, pool, statements };
}

describe("Leadgrid self-onboard magic-token consumer", () => {
  it("bounds and prunes the process-local magic consume limiter", () => {
    const limiter = createLeadgridMagicConsumeRateLimiter({
      windowMs: 100,
      maxAttempts: 2,
      maxBuckets: 3,
      pruneEvery: 1,
    });

    expect(limiter.isLimited("ip-a", 0)).toBe(false);
    expect(limiter.isLimited("ip-b", 1)).toBe(false);
    expect(limiter.isLimited("ip-c", 2)).toBe(false);
    expect(limiter.isLimited("ip-d", 3)).toBe(false);
    expect(limiter.isLimited("ip-e", 4)).toBe(true);
    expect(limiter.bucketCount()).toBe(3);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      expect(limiter.isLimited("ip-e", 5 + attempt / 100)).toBe(true);
    }
    expect(limiter.largestBucketDepth()).toBeLessThanOrEqual(3);

    expect(limiter.isLimited("ip-fresh", 200)).toBe(false);
    expect(limiter.bucketCount()).toBe(1);
  });

  it("hashes issued tokens and never stores new raw magic tokens", () => {
    expect(hashLeadgridMagicToken(RAW_TOKEN)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashLeadgridMagicToken(RAW_TOKEN)).not.toBe(RAW_TOKEN);

    const source = readFileSync(
      new URL("./org-self-onboard-routes.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("jsonb_build_object('magic_token_hash'");
    expect(source).not.toContain("jsonb_build_object('magic_token',");
    expect(source).toContain("#token=${magicToken}");
  });

  it("atomically removes the token and persists a real auth session", async () => {
    const { app, activeSessions, client, statements } = buildApp();

    const response = await request(app)
      .post("/api/leadgrid/self-onboard/consume-magic")
      .send({ token: RAW_TOKEN })
      .expect(200);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body).toMatchObject({
      success: true,
      user: {
        id: "user-1",
        email: "owner@example.test",
        name: "Ola Nordmann",
        role: "member",
        verified_email: true,
      },
      organization: { id: "org-1", name: "Nordmann AS", plan: "solo_free" },
    });
    expect(response.body.token).toMatch(/^[0-9a-f-]{36}$/);

    const select = statements.find(({ sql }) =>
      sql.includes("FOR UPDATE OF u"),
    );
    expect(select?.sql).toContain("magic_token_hash");
    expect(select?.sql).toContain("magic_token' = $2");
    expect(select?.params).toEqual([
      hashLeadgridMagicToken(RAW_TOKEN),
      RAW_TOKEN,
    ]);

    const consumeIndex = statements.findIndex(({ sql }) =>
      sql.includes("last_login_at = NOW()"),
    );
    const sessionIndex = statements.findIndex(({ sql }) =>
      sql.includes("INSERT INTO creatorhub_auth_sessions"),
    );
    const commitIndex = statements.findIndex(({ sql }) => sql === "COMMIT");
    expect(consumeIndex).toBeGreaterThan(-1);
    expect(sessionIndex).toBeGreaterThan(consumeIndex);
    expect(commitIndex).toBeGreaterThan(sessionIndex);
    expect(statements[consumeIndex].sql).toContain("- 'magic_token_hash'");
    expect(client.release).toHaveBeenCalledOnce();

    const persistedSession = activeSessions.get(response.body.token);
    expect(persistedSession).toMatchObject({
      userId: "user-1",
      email: "owner@example.test",
      name: "Ola Nordmann",
      authSessionVersion: "4",
      loginAt: expect.any(String),
    });
  });

  it("consumes an expired token without creating a session", async () => {
    const { app, activeSessions, statements } = buildApp({
      candidate: buildCandidate({
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    });

    await request(app)
      .post("/api/leadgrid/self-onboard/consume-magic")
      .send({ token: RAW_TOKEN })
      .expect(410, { error: "magic_token_expired" });

    expect(
      statements.some(({ sql }) => sql.includes("- 'magic_token_hash'")),
    ).toBe(true);
    expect(
      statements.some(({ sql }) =>
        sql.includes("INSERT INTO creatorhub_auth_sessions"),
      ),
    ).toBe(false);
    expect(statements.some(({ sql }) => sql === "COMMIT")).toBe(true);
    expect(activeSessions.size).toBe(0);
  });

  it("rolls token consumption back when persistent session creation fails", async () => {
    const { app, activeSessions, statements } = buildApp({
      failSessionInsert: true,
    });

    await request(app)
      .post("/api/leadgrid/self-onboard/consume-magic")
      .send({ token: RAW_TOKEN })
      .expect(503, { error: "session_creation_failed" });

    const consumeIndex = statements.findIndex(({ sql }) =>
      sql.includes("last_login_at = NOW()"),
    );
    const rollbackIndex = statements.findLastIndex(
      ({ sql }) => sql === "ROLLBACK",
    );
    expect(consumeIndex).toBeGreaterThan(-1);
    expect(rollbackIndex).toBeGreaterThan(consumeIndex);
    expect(statements.some(({ sql }) => sql === "COMMIT")).toBe(false);
    expect(activeSessions.size).toBe(0);
  });

  it("does not lock or consume anything for malformed, used, or unavailable tokens", async () => {
    const malformed = buildApp();
    await request(malformed.app)
      .post("/api/leadgrid/self-onboard/consume-magic")
      .send({ token: "short" })
      .expect(400, { error: "invalid_magic_token_format" });
    expect(malformed.pool.connect).not.toHaveBeenCalled();

    const used = buildApp({ candidate: null });
    await request(used.app)
      .post("/api/leadgrid/self-onboard/consume-magic")
      .send({ token: RAW_TOKEN })
      .expect(401, { error: "invalid_or_used_magic_token" });
    expect(used.statements.some(({ sql }) => sql === "ROLLBACK")).toBe(true);

    const unavailable = buildApp({ sessionStoreReady: false });
    await request(unavailable.app)
      .post("/api/leadgrid/self-onboard/consume-magic")
      .send({ token: RAW_TOKEN })
      .expect(503, { error: "session_store_unavailable" });
    expect(unavailable.pool.connect).not.toHaveBeenCalled();
  });

  it("rate-limits repeated consume attempts before touching the database", async () => {
    const limited = buildApp();
    const statuses: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const response = await request(limited.app)
        .post("/api/leadgrid/self-onboard/consume-magic")
        .send({ token: "malformed" });
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
    expect(limited.pool.connect).not.toHaveBeenCalled();
  });
});

const VALID_SELF_ONBOARD_BODY = {
  email: "owner@example.test",
  orgName: "Eksempel Byrå AS",
  templateKey: "solo",
  website: "https://example.test",
  contactName: "Ola Nordmann",
  turnstileToken: "turnstile-token",
};

describe("Leadgrid self-onboard JSON envelope", () => {
  function buildEnvelopeApp() {
    const app: Express = express();
    const parserReached = vi.fn();
    app.post(
      "/self-onboard",
      requireLeadgridSelfOnboardJsonEnvelope,
      (_req, _res, next) => {
        parserReached();
        next();
      },
      express.json({
        limit: LEADGRID_SELF_ONBOARD_BODY_LIMIT_BYTES,
        strict: true,
        type: ["application/json", "application/*+json"],
      }),
      (_req, res) => res.status(204).end(),
    );
    return { app, parserReached };
  }

  it("accepts JSON suffix media types before parsing", async () => {
    const setup = buildEnvelopeApp();

    const response = await request(setup.app)
      .post("/self-onboard")
      .set("Content-Type", "application/vnd.leadgrid+json")
      .send(JSON.stringify({ ok: true }))
      .expect(204);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(setup.parserReached).toHaveBeenCalledOnce();
  });

  it("rejects non-JSON and declared oversized bodies before parsing", async () => {
    const wrongType = buildEnvelopeApp();
    await request(wrongType.app)
      .post("/self-onboard")
      .set("Content-Type", "text/plain")
      .send("not-json")
      .expect(415, { error: "content_type_must_be_json" });
    expect(wrongType.parserReached).not.toHaveBeenCalled();

    const formEncoded = buildEnvelopeApp();
    await request(formEncoded.app)
      .post("/self-onboard")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("email=owner%40example.test&orgName=Oversized+bypass")
      .expect(415, { error: "content_type_must_be_json" });
    expect(formEncoded.parserReached).not.toHaveBeenCalled();

    const oversized = buildEnvelopeApp();
    await request(oversized.app)
      .post("/self-onboard")
      .set("Content-Type", "application/json")
      .send(
        JSON.stringify({
          value: "x".repeat(LEADGRID_SELF_ONBOARD_BODY_LIMIT_BYTES),
        }),
      )
      .expect(413, { error: "request_body_too_large" });
    expect(oversized.parserReached).not.toHaveBeenCalled();
  });
});

function buildSelfOnboardApp(
  options: {
    rateLimitAllowed?: boolean;
    rateLimitError?: boolean;
    turnstileConfigured?: boolean;
    turnstileSuccess?: boolean;
    turnstileError?: boolean;
    turnstileReason?: string;
    production?: boolean;
    existingOrganization?: boolean;
    includeNaceResult?: boolean;
    templateEligible?: boolean;
    validatedPlanKey?: string | null;
    stripePriceId?: string | null;
    stripeClient?: any;
  } = {},
) {
  const events: string[] = [];
  const clientStatements: Array<{ sql: string; params: unknown[] }> = [];
  const poolStatements: Array<{ sql: string; params: unknown[] }> = [];

  const client = {
    query: vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      clientStatements.push({ sql, params });
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        events.push(sql.toLowerCase());
      }
      if (sql.includes("JOIN plan_limits plan")) {
        if (options.validatedPlanKey === null) {
          return { rows: [], rowCount: 0 };
        }
        return {
          rows: [
            {
              template_key: "solo",
              validated_plan_key: options.validatedPlanKey ?? "solo_free",
              provisioned_plan_key:
                options.stripePriceId == null
                  ? options.validatedPlanKey ?? "solo_free"
                  : "solo_free",
              stripe_price_id_monthly: options.stripePriceId ?? null,
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("AS template_eligible")) {
        return {
          rows: [{ template_eligible: options.templateEligible !== false }],
          rowCount: 1,
        };
      }
      if (
        sql.includes("FROM users u") &&
        sql.includes("organization_members")
      ) {
        return options.existingOrganization
          ? {
              rows: [
                {
                  user_id: "user-existing",
                  organization_id: "org-existing",
                  org_name: "Eksisterende AS",
                },
              ],
              rowCount: 1,
            }
          : { rows: [], rowCount: 0 };
      }
      if (sql.includes("INSERT INTO organizations")) {
        return { rows: [{ id: "org-created" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(() => {
      events.push("release");
    }),
  };

  const pool = {
    query: vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
      const sql = String(sqlValue);
      poolStatements.push({ sql, params });
      if (sql.includes("leadgrid_public_rate_limit_buckets")) {
        events.push("rate-limit");
        if (options.rateLimitError) throw new Error("rate limiter unavailable");
        return {
          rows: [
            {
              allowed: options.rateLimitAllowed !== false,
              remaining: options.rateLimitAllowed === false ? 0 : 2,
              retry_after_seconds: 120,
            },
          ],
          rowCount: 1,
        };
      }
      if (sql.includes("UPDATE organizations SET nace_code")) {
        events.push("nace-update");
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }),
    connect: vi.fn(async () => {
      events.push("connect");
      return client;
    }),
  } as unknown as Pool;

  const verifyTurnstile = vi.fn(async () => {
    events.push("turnstile");
    if (options.turnstileError) throw new Error("siteverify unavailable");
    return {
      configured: options.turnstileConfigured !== false,
      success: options.turnstileSuccess !== false,
      hostname: "theroleroom.com",
      action: "leadgrid_self_onboard",
      errorCodes: [],
      reason: options.turnstileReason,
    };
  });
  const turnstileService = {
    getRoleRoomTurnstileSecretKey: vi.fn(() =>
      options.turnstileConfigured === false ? "" : "test-secret",
    ),
    getRoleRoomTurnstileExpectedHostnames: vi.fn(
      () => new Set(["127.0.0.1", "theroleroom.com"]),
    ),
    verifyRoleRoomTurnstileToken: verifyTurnstile,
  };
  const hashPlaceholderPassword = vi.fn(async () => {
    events.push("bcrypt");
    return "password-hash";
  });
  const getStripeClient = vi.fn(() => {
    events.push("stripe");
    return options.stripeClient ?? null;
  });
  const sendWelcomeEmail = vi.fn(async () => {
    events.push("email");
    return { sent: true };
  });
  const notifyAdminsFn = vi.fn(async () => {
    events.push("notify");
  });
  const lookupCompany = vi.fn(async () => {
    events.push("nace-lookup");
    return options.includeNaceResult
      ? {
          found: true,
          company: {
            naceCode: "62.010",
            naceDescription: "Programmeringstjenester",
          },
        }
      : { found: false, company: null };
  });

  const app: Express = express();
  app.use(express.json({ limit: "100kb" }));
  registerOrgSelfOnboardRoutes({
    app,
    pool,
    activeSessions: new Map(),
    turnstileService,
    hashPlaceholderPassword,
    getStripeClient: getStripeClient as any,
    sendWelcomeEmail: sendWelcomeEmail as any,
    notifyAdminsFn: notifyAdminsFn as any,
    lookupCompany: lookupCompany as any,
    isProduction: () => options.production === true,
  });

  return {
    app,
    pool,
    client,
    events,
    clientStatements,
    poolStatements,
    verifyTurnstile,
    hashPlaceholderPassword,
    getStripeClient,
    sendWelcomeEmail,
    notifyAdminsFn,
    lookupCompany,
  };
}

describe("Leadgrid public self-onboard abuse protection", () => {
  it("rejects malformed and unbounded input before rate limit, connection, or side effects", async () => {
    const setup = buildSelfOnboardApp();
    const invalidBodies = [
      { ...VALID_SELF_ONBOARD_BODY, email: "not-an-email" },
      { ...VALID_SELF_ONBOARD_BODY, orgName: "x".repeat(161) },
      { ...VALID_SELF_ONBOARD_BODY, templateKey: "../../admin" },
      { ...VALID_SELF_ONBOARD_BODY, website: "http://127.0.0.1/private" },
      { ...VALID_SELF_ONBOARD_BODY, orgNumber: "123456789" },
      { ...VALID_SELF_ONBOARD_BODY, cta: "unbounded-public-field" },
      ["not", "an", "object"],
    ];

    for (const body of invalidBodies) {
      await request(setup.app)
        .post("/api/leadgrid/self-onboard")
        .send(body)
        .expect(400);
    }
    await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .set("Content-Type", "text/plain")
      .send(JSON.stringify(VALID_SELF_ONBOARD_BODY))
      .expect(415);
    await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .send({ ...VALID_SELF_ONBOARD_BODY, orgName: "x".repeat(20_000) })
      .expect(413);

    expect(setup.pool.query).not.toHaveBeenCalled();
    expect(setup.pool.connect).not.toHaveBeenCalled();
    expect(setup.verifyTurnstile).not.toHaveBeenCalled();
    expect(setup.hashPlaceholderPassword).not.toHaveBeenCalled();
    expect(setup.getStripeClient).not.toHaveBeenCalled();
    expect(setup.sendWelcomeEmail).not.toHaveBeenCalled();
    expect(setup.notifyAdminsFn).not.toHaveBeenCalled();
  });

  it("fails closed when the distributed limiter is unavailable", async () => {
    const setup = buildSelfOnboardApp({ rateLimitError: true });

    await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .send(VALID_SELF_ONBOARD_BODY)
      .expect(503, { error: "signup_protection_unavailable" });

    expect(setup.events).toEqual(["rate-limit"]);
    expect(setup.pool.connect).not.toHaveBeenCalled();
    expect(setup.verifyTurnstile).not.toHaveBeenCalled();
    expect(setup.hashPlaceholderPassword).not.toHaveBeenCalled();
  });

  it("atomically blocks exhausted IP/email buckets before Turnstile and expensive work", async () => {
    const setup = buildSelfOnboardApp({ rateLimitAllowed: false });

    const response = await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .send(VALID_SELF_ONBOARD_BODY)
      .expect(429);

    expect(response.headers["retry-after"]).toBe("120");
    expect(setup.events).toEqual(["rate-limit"]);
    expect(setup.verifyTurnstile).not.toHaveBeenCalled();
    expect(setup.pool.connect).not.toHaveBeenCalled();
    expect(setup.hashPlaceholderPassword).not.toHaveBeenCalled();

    const limiter = setup.poolStatements[0];
    expect(limiter.sql).toContain(
      "ON CONFLICT (scope, key_hash, window_start) DO UPDATE",
    );
    expect(limiter.sql).toContain("request_count < EXCLUDED.request_limit");
    expect(limiter.params.slice(0, 2)).toEqual([
      expect.stringMatching(/^[a-f0-9]{64}$/),
      expect.stringMatching(/^[a-f0-9]{64}$/),
    ]);
    expect(limiter.params).not.toContain(VALID_SELF_ONBOARD_BODY.email);
  });

  it("requires configured Turnstile in production before opening a transaction", async () => {
    const setup = buildSelfOnboardApp({
      production: true,
      turnstileConfigured: false,
    });

    await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .send({ ...VALID_SELF_ONBOARD_BODY, turnstileToken: undefined })
      .expect(503, { error: "signup_protection_unavailable" });

    expect(setup.events).toEqual(["rate-limit"]);
    expect(setup.pool.connect).not.toHaveBeenCalled();
    expect(setup.hashPlaceholderPassword).not.toHaveBeenCalled();
  });

  it("accepts Turnstile verification for every production Leadgrid hostname", async () => {
    const setup = buildSelfOnboardApp({ production: true });

    await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .send(VALID_SELF_ONBOARD_BODY)
      .expect(201);

    const expectedHostnames = setup.verifyTurnstile.mock.calls[0]?.[0]
      ?.expectedHostnames as Set<string>;
    expect([...expectedHostnames]).toEqual(
      expect.arrayContaining([
        "leadgrid.no",
        "www.leadgrid.no",
        "leadgrid.theroleroom.com",
      ]),
    );
  });

  it("rejects or fails closed on Turnstile before pool.connect, bcrypt, Stripe, and email", async () => {
    const rejected = buildSelfOnboardApp({ turnstileSuccess: false });
    await request(rejected.app)
      .post("/api/leadgrid/self-onboard")
      .send(VALID_SELF_ONBOARD_BODY)
      .expect(403, { error: "human_verification_failed" });
    expect(rejected.events).toEqual(["rate-limit", "turnstile"]);
    expect(rejected.pool.connect).not.toHaveBeenCalled();
    expect(rejected.hashPlaceholderPassword).not.toHaveBeenCalled();
    expect(rejected.getStripeClient).not.toHaveBeenCalled();
    expect(rejected.sendWelcomeEmail).not.toHaveBeenCalled();

    const unavailable = buildSelfOnboardApp({ turnstileError: true });
    await request(unavailable.app)
      .post("/api/leadgrid/self-onboard")
      .send(VALID_SELF_ONBOARD_BODY)
      .expect(503, { error: "signup_protection_unavailable" });
    expect(unavailable.events).toEqual(["rate-limit", "turnstile"]);
    expect(unavailable.pool.connect).not.toHaveBeenCalled();
  });

  it("maps Turnstile timeout/unavailable outcomes to 503, not human rejection", async () => {
    for (const reason of ["verification_timeout", "verification_unavailable"]) {
      const setup = buildSelfOnboardApp({
        turnstileSuccess: false,
        turnstileReason: reason,
      });

      await request(setup.app)
        .post("/api/leadgrid/self-onboard")
        .send(VALID_SELF_ONBOARD_BODY)
        .expect(503, { error: "signup_protection_unavailable" });

      expect(setup.events).toEqual(["rate-limit", "turnstile"]);
      expect(setup.pool.connect).not.toHaveBeenCalled();
      expect(setup.hashPlaceholderPassword).not.toHaveBeenCalled();
    }
  });

  it("ignores arbitrary X-Forwarded-For by default", async () => {
    vi.stubEnv("LEADGRID_SELF_ONBOARD_TRUST_PROXY_HOPS", "0");
    const setup = buildSelfOnboardApp({ rateLimitAllowed: false });

    await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .set("X-Forwarded-For", "198.51.100.10")
      .send(VALID_SELF_ONBOARD_BODY)
      .expect(429);
    await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .set("X-Forwarded-For", "203.0.113.99")
      .send({ ...VALID_SELF_ONBOARD_BODY, email: "second@example.test" })
      .expect(429);

    expect(setup.poolStatements[0].params[0]).toBe(
      setup.poolStatements[1].params[0],
    );
    vi.unstubAllEnvs();
  });

  it("fails closed on template/plan drift before any user or organization write", async () => {
    const setup = buildSelfOnboardApp({
      templateEligible: true,
      validatedPlanKey: null,
    });

    await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .send(VALID_SELF_ONBOARD_BODY)
      .expect(503, { error: "signup_plan_unavailable" });

    const validation = setup.clientStatements.find(({ sql }) =>
      sql.includes("JOIN plan_limits plan"),
    );
    expect(validation?.sql).toContain("plan.is_active = TRUE");
    expect(validation?.sql).toContain("FOR SHARE OF template, plan");
    expect(setup.events).toEqual([
      "rate-limit",
      "turnstile",
      "connect",
      "begin",
      "rollback",
      "release",
    ]);
    expect(
      setup.clientStatements.some(
        ({ sql }) =>
          sql.includes("FROM users u") ||
          sql.includes("INSERT INTO organizations"),
      ),
    ).toBe(false);
    expect(setup.hashPlaceholderPassword).not.toHaveBeenCalled();
    expect(setup.getStripeClient).not.toHaveBeenCalled();
    expect(setup.sendWelcomeEmail).not.toHaveBeenCalled();
    expect(setup.notifyAdminsFn).not.toHaveBeenCalled();
  });

  it("keeps a paid target provisional until Stripe payment activates it", async () => {
    const stripeClient = {
      customers: {
        create: vi.fn(async () => ({ id: "cus_self_onboard" })),
      },
      checkout: {
        sessions: {
          create: vi.fn(async () => ({
            url: "https://checkout.stripe.test/session",
          })),
        },
      },
    };
    const setup = buildSelfOnboardApp({
      validatedPlanKey: "solo_pro",
      stripePriceId: "price_solo_pro",
      stripeClient,
    });

    const response = await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .send(VALID_SELF_ONBOARD_BODY)
      .expect(201);

    const orgInsert = setup.clientStatements.find(({ sql }) =>
      sql.includes("INSERT INTO organizations"),
    );
    expect(orgInsert?.params[6]).toBe("solo_free");
    expect(response.body.organization.plan).toBe("solo_free");
    expect(response.body.organization.requested_plan).toBe("solo_pro");
    expect(response.body.checkout_url).toBe(
      "https://checkout.stripe.test/session",
    );
    expect(stripeClient.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ plan_key: "solo_pro" }),
      }),
    );
    expect(stripeClient.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [{ price: "price_solo_pro", quantity: 1 }],
        metadata: expect.objectContaining({ plan_key: "solo_pro" }),
        subscription_data: {
          metadata: expect.objectContaining({ plan_key: "solo_pro" }),
        },
      }),
    );
    expect(setup.notifyAdminsFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        summary: expect.stringContaining(
          "plan: solo_free · ønsket plan etter betaling: solo_pro",
        ),
      }),
    );
  });

  it("runs Turnstile first and starts NACE only after commit using pool.query", async () => {
    const setup = buildSelfOnboardApp({ includeNaceResult: true });

    const response = await request(setup.app)
      .post("/api/leadgrid/self-onboard")
      .send({
        ...VALID_SELF_ONBOARD_BODY,
        email: " OWNER@EXAMPLE.TEST ",
        orgNumber: "923609016",
      })
      .expect(201);

    expect(response.body).toMatchObject({
      organization: {
        id: "org-created",
        name: "Eksempel Byrå AS",
        plan: "solo_free",
      },
      magic_link_sent: true,
    });
    expect(setup.events.indexOf("rate-limit")).toBeLessThan(
      setup.events.indexOf("turnstile"),
    );
    expect(setup.events.indexOf("turnstile")).toBeLessThan(
      setup.events.indexOf("connect"),
    );
    expect(setup.events.indexOf("connect")).toBeLessThan(
      setup.events.indexOf("bcrypt"),
    );
    expect(setup.events.indexOf("commit")).toBeLessThan(
      setup.events.indexOf("nace-lookup"),
    );
    expect(setup.events.indexOf("nace-lookup")).toBeLessThan(
      setup.events.indexOf("stripe"),
    );
    await vi.waitFor(() => {
      expect(setup.events).toContain("nace-update");
    });
    expect(
      setup.clientStatements.some(({ sql }) =>
        sql.includes("UPDATE organizations SET nace_code"),
      ),
    ).toBe(false);
    expect(setup.sendWelcomeEmail).toHaveBeenCalledOnce();
    expect(setup.notifyAdminsFn).toHaveBeenCalledOnce();
  });

  it("mounts the 16 KiB parser before the global 50 MB parser and after raw webhooks", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const rawWebhook = source.indexOf(
      'express.raw({ type: "application/json" })',
    );
    const urlCanonicalizer = source.indexOf(
      "normalizeIncomingApiUrl(req.url)",
      rawWebhook,
    );
    const boundedLeadgridParser = source.indexOf(
      "createLeadgridBodyParserBoundary",
      urlCanonicalizer,
    );
    const globalParser = source.indexOf('express.json({ limit: "50mb" })');
    expect(rawWebhook).toBeGreaterThan(-1);
    expect(urlCanonicalizer).toBeGreaterThan(rawWebhook);
    expect(boundedLeadgridParser).toBeGreaterThan(urlCanonicalizer);
    expect(globalParser).toBeGreaterThan(boundedLeadgridParser);
  });

  it("seeds valid Solo plans and adds a safe forward-only plan foreign key", () => {
    const seed = readFileSync(
      new URL(
        "../migrations/0311_org_setup_templates_and_superadmin_audit.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(seed).toContain("NULL, 'solo_free', TRUE, 10");
    expect(seed).toContain("'healthtech_b2b', 'solo_free', FALSE, 40");

    const integrityMigration = readFileSync(
      new URL(
        "../migrations/0462_org_setup_template_plan_integrity.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(integrityMigration).toContain("default_plan IN ('free', 'solo')");
    expect(integrityMigration).toContain("SET plan = 'solo_pro'");
    expect(integrityMigration).toContain("stripe_subscription_id IS NOT NULL");
    expect(integrityMigration).toContain("UPDATE organizations");
    expect(integrityMigration).toContain("plan IN ('free', 'solo')");
    expect(integrityMigration).toContain("stripe_subscription_id IS NULL");
    expect(integrityMigration).toContain("REFERENCES plan_limits(plan_key)");
    expect(integrityMigration).toContain("NOT VALID");
    expect(integrityMigration).toContain(
      "VALIDATE CONSTRAINT org_setup_templates_default_plan_fk",
    );
  });
});
