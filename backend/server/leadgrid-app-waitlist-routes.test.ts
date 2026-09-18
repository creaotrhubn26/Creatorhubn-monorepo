import { readFileSync } from "node:fs";
import express, { type Express, type Request, type Response } from "express";
import type { Pool } from "pg";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mailMocks = vi.hoisted(() => ({
  isEmailConfigured: vi.fn(() => false),
  sendEmail: vi.fn(
    async (): Promise<{
      success: boolean;
      error?: string;
      messageId?: string;
      failureCertainty?: "definite_pre_delivery" | "uncertain";
    }> => ({
      success: true,
    }),
  ),
}));

vi.mock("./casting-reminder-sender.js", () => mailMocks);

import {
  LEADGRID_APP_WAITLIST_BODY_LIMIT_BYTES,
  registerLeadgridAppWaitlistRoutes,
  requireLeadgridAppWaitlistJsonEnvelope,
} from "./leadgrid-app-waitlist-routes.js";

type SessionData = { userId: string; role?: string; email?: string };

type FakeWaitlistRow = {
  id: string;
  email: string;
  notifiedAt?: string | null;
  notificationClaimId?: string | null;
  notificationClaimExpiresAt?: string | null;
  notificationDeliveryStartedAt?: string | null;
  notificationDeliveryUncertainAt?: string | null;
  notificationDeliveryError?: string | null;
  notificationMessageId?: string | null;
};

type BuildOptions = {
  activeSessions?: Map<string, SessionData>;
  persistedSessions?: Map<string, SessionData>;
  sessionVerificationUnavailable?: boolean;
  dbRole?: string | null;
  failDbRoleLookup?: boolean;
  insertRowCounts?: number[];
  pendingRows?: FakeWaitlistRow[];
  loseClaimBeforeRenew?: boolean;
  failDeliveryReceiptOnce?: boolean;
};

function readBearer(req: Request): string | null {
  const auth = req.headers.authorization;
  return auth?.startsWith("Bearer ")
    ? auth.slice("Bearer ".length).trim()
    : null;
}

function buildApp(options: BuildOptions = {}) {
  const activeSessions =
    options.activeSessions ?? new Map<string, SessionData>();
  const persistedSessions =
    options.persistedSessions ?? new Map(activeSessions);
  const insertRowCounts = [...(options.insertRowCounts ?? [1])];
  const waitlistRows = (options.pendingRows ?? []).map((row) => ({
    ...row,
    notifiedAt: row.notifiedAt ?? null,
    notificationClaimId: row.notificationClaimId ?? null,
    notificationClaimExpiresAt: row.notificationClaimExpiresAt ?? null,
    notificationDeliveryStartedAt:
      row.notificationDeliveryStartedAt ?? null,
    notificationDeliveryUncertainAt:
      row.notificationDeliveryUncertainAt ?? null,
    notificationDeliveryError: row.notificationDeliveryError ?? null,
    notificationMessageId: row.notificationMessageId ?? null,
  }));
  let claimWasLost = false;
  let deliveryReceiptFailed = false;

  const query = vi.fn(async (sqlValue: unknown, params: unknown[] = []) => {
    const sql = String(sqlValue);
    if (sql.includes("CREATE TABLE IF NOT EXISTS leadgrid_app_waitlist")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("ALTER TABLE leadgrid_app_waitlist")) {
      return { rows: [], rowCount: 0 };
    }
    if (
      sql.includes(
        "CREATE INDEX IF NOT EXISTS idx_leadgrid_app_waitlist_pending_delivery_v2",
      )
    ) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("INSERT INTO leadgrid_app_waitlist")) {
      return { rows: [], rowCount: insertRowCounts.shift() ?? 0, params };
    }
    if (sql.includes("LOWER(COALESCE(role")) {
      if (options.failDbRoleLookup) throw new Error("users unavailable");
      return {
        rows: options.dbRole ? [{ role: options.dbRole }] : [],
        rowCount: options.dbRole ? 1 : 0,
      };
    }
    if (sql.includes("count(*)::int AS total")) {
      return {
        rows: [{ total: 7, pending: 3, uncertain: 2, in_progress: 1 }],
        rowCount: 1,
      };
    }
    if (sql.includes("WITH claimable AS")) {
      const claimId = String(params[0]);
      const leaseSeconds = Number(params[1]);
      const now = Date.now();
      const claimed = waitlistRows
        .filter(
          (row) =>
            !row.notifiedAt &&
            !row.notificationDeliveryStartedAt &&
            (!row.notificationClaimId ||
              !row.notificationClaimExpiresAt ||
              Date.parse(row.notificationClaimExpiresAt) <= now),
        )
        .slice(0, 1);

      for (const row of claimed) {
        row.notificationClaimId = claimId;
        row.notificationClaimExpiresAt = new Date(
          now + leaseSeconds * 1_000,
        ).toISOString();
      }
      return {
        rows: claimed.map(({ id, email }) => ({ id, email })),
        rowCount: claimed.length,
      };
    }
    if (
      sql.includes("SET notification_delivery_started_at = now()") &&
      sql.includes("RETURNING id, email, notification_message_id AS message_id")
    ) {
      const row = waitlistRows.find(
        (candidate) =>
          candidate.id === params[0] &&
          candidate.notificationClaimId === params[1] &&
          !candidate.notifiedAt,
      );
      if (!row) return { rows: [], rowCount: 0 };
      if (options.loseClaimBeforeRenew && !claimWasLost) {
        claimWasLost = true;
        row.notificationClaimId = "00000000-0000-4000-8000-000000000099";
        return { rows: [], rowCount: 0 };
      }
      row.notificationDeliveryStartedAt = new Date().toISOString();
      row.notificationDeliveryUncertainAt = null;
      row.notificationDeliveryError = null;
      row.notificationMessageId = row.notificationMessageId ?? String(params[2]);
      return {
        rows: [
          {
            id: row.id,
            email: row.email,
            message_id: row.notificationMessageId,
          },
        ],
        rowCount: 1,
      };
    }
    if (sql.includes("SET notified_at = now()")) {
      if (options.failDeliveryReceiptOnce && !deliveryReceiptFailed) {
        deliveryReceiptFailed = true;
        throw new Error("receipt database unavailable");
      }
      const row = waitlistRows.find(
        (candidate) =>
          candidate.id === params[0] &&
          candidate.notificationClaimId === params[1] &&
          candidate.notificationDeliveryStartedAt &&
          !candidate.notifiedAt,
      );
      if (!row) return { rows: [], rowCount: 0 };
      row.notifiedAt = new Date().toISOString();
      row.notificationClaimId = null;
      row.notificationClaimExpiresAt = null;
      row.notificationDeliveryUncertainAt = null;
      row.notificationDeliveryError = null;
      return { rows: [], rowCount: 1 };
    }
    if (
      sql.includes(
        "SET notification_delivery_uncertain_at = COALESCE(notification_delivery_uncertain_at, now())",
      )
    ) {
      const row = waitlistRows.find(
        (candidate) =>
          candidate.id === params[0] &&
          candidate.notificationClaimId === params[1] &&
          candidate.notificationDeliveryStartedAt &&
          !candidate.notifiedAt,
      );
      if (!row) return { rows: [], rowCount: 0 };
      row.notificationDeliveryUncertainAt = new Date().toISOString();
      row.notificationDeliveryError = String(params[2]);
      row.notificationClaimExpiresAt = null;
      return { rows: [], rowCount: 1 };
    }
    if (
      sql.includes("SET notification_claim_id = NULL") &&
      sql.includes("notification_delivery_started_at = NULL")
    ) {
      const row = waitlistRows.find(
        (candidate) =>
          candidate.id === params[0] &&
          candidate.notificationClaimId === params[1] &&
          candidate.notificationDeliveryStartedAt &&
          !candidate.notificationDeliveryUncertainAt &&
          !candidate.notifiedAt,
      );
      if (!row) return { rows: [], rowCount: 0 };
      row.notificationClaimId = null;
      row.notificationClaimExpiresAt = null;
      row.notificationDeliveryStartedAt = null;
      row.notificationDeliveryUncertainAt = null;
      row.notificationDeliveryError = String(params[2]);
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  const resolveAuthoritativeSessionFromRequest = vi.fn(async (req: Request) => {
    if (options.sessionVerificationUnavailable) {
      return { status: "unavailable" as const };
    }
    const token = readBearer(req);
    if (!token) return { status: "unauthenticated" as const };
    const persisted = persistedSessions.get(token) ?? null;
    if (!persisted) {
      activeSessions.delete(token);
      return { status: "unauthenticated" as const };
    }
    activeSessions.set(token, persisted);
    return { status: "authenticated" as const, session: persisted };
  });

  const requireAdminRoomAccess = vi.fn((req: Request, res: Response) => {
    const token = readBearer(req);
    const session = token ? (activeSessions.get(token) ?? null) : null;
    if (!session) {
      res.status(401).json({ error: "Innlogging kreves" });
      return null;
    }
    if (
      String(session.email ?? "")
        .trim()
        .toLowerCase() !== "owner@example.test"
    ) {
      res
        .status(403)
        .json({ error: "Admin Room er kun tilgjengelig for produkteier" });
      return null;
    }
    return { userId: session.userId, email: "owner@example.test" };
  });

  const app: Express = express();
  app.use(express.json());
  registerLeadgridAppWaitlistRoutes({
    app,
    pool: { query } as unknown as Pool,
    resolveAuthoritativeSessionFromRequest,
    requireAdminRoomAccess,
  });
  return {
    app,
    query,
    waitlistRows,
    activeSessions,
    resolveAuthoritativeSessionFromRequest,
    requireAdminRoomAccess,
  };
}

describe("Leadgrid app waitlist routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mailMocks.isEmailConfigured.mockReturnValue(false);
    mailMocks.sendEmail.mockResolvedValue({ success: true });
  });

  it("is registered before the API catch-all with canonical auth dependencies", () => {
    const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const registration = source.indexOf("registerLeadgridAppWaitlistRoutes({");
    const catchAll = source.indexOf('app.all("/api/*"');
    const registrationBlock = source.slice(registration, registration + 260);

    expect(registration).toBeGreaterThan(-1);
    expect(catchAll).toBeGreaterThan(-1);
    expect(registration).toBeLessThan(catchAll);
    expect(registrationBlock).toContain(
      "resolveAuthoritativeSessionFromRequest",
    );
    expect(registrationBlock).toContain("requireAdminRoomAccess");
    expect(registrationBlock).not.toContain("activeSessions,");
    expect(registrationBlock).not.toContain("isAdminEmail");

    const resolverStart = source.indexOf(
      "async function resolveAuthoritativeSessionFromRequest(",
    );
    const resolverBlock = source.slice(resolverStart, resolverStart + 3_200);
    expect(resolverStart).toBeGreaterThan(-1);
    expect(source).toContain(
      'import { resolveAuthoritativeAuthSession } from "./auth-session-authority.js"',
    );
    expect(resolverBlock).toContain("resolveAuthoritativeAuthSession({");
    expect(resolverBlock).toContain("activeSessions,");
    expect(resolverBlock).toContain(
      "onEvict: (token) => adminRoleReconciledTokens.delete(token)",
    );

    const canonicalizer = source.indexOf("normalizeIncomingApiUrl(req.url)");
    const envelopeGuard = source.indexOf(
      "requireLeadgridAppWaitlistJsonEnvelope",
      canonicalizer,
    );
    const limitedParser = source.indexOf('limit: "2kb"', envelopeGuard);
    const globalParser = source.indexOf('express.json({ limit: "50mb" })');
    expect(canonicalizer).toBeGreaterThan(-1);
    expect(envelopeGuard).toBeGreaterThan(canonicalizer);
    expect(limitedParser).toBeGreaterThan(envelopeGuard);
    expect(globalParser).toBeGreaterThan(limitedParser);
  });

  it("rejects non-JSON and oversized public bodies at the small parser", async () => {
    const app = express();
    const reached = vi.fn();
    app.post(
      "/api/leadgrid/app-waitlist",
      requireLeadgridAppWaitlistJsonEnvelope,
      express.json({
        limit: LEADGRID_APP_WAITLIST_BODY_LIMIT_BYTES,
        strict: true,
        type: ["application/json", "application/*+json"],
      }),
      (_req, res) => {
        reached();
        res.status(204).end();
      },
    );

    await request(app)
      .post("/api/leadgrid/app-waitlist")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("email=owner%40example.test")
      .expect(415, { error: "content_type_must_be_json" });
    await request(app)
      .post("/api/leadgrid/app-waitlist")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ email: `${"x".repeat(3 * 1024)}@example.test` }))
      .expect(413);
    expect(reached).not.toHaveBeenCalled();
  });

  it("uses the canonical authenticated frontend client for admin calls", () => {
    const source = readFileSync(
      new URL(
        "../../frontend/client/src/pages/admin-workspace/LeadgridAppWaitlistTab.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    expect(source).toContain("import { apiFetch } from '@/lib/queryClient'");
    expect(source).toContain("apiFetch('/api/leadgrid/app-waitlist/status')");
    expect(source).toContain(
      "apiFetch('/api/leadgrid/app-waitlist/notify-launch'",
    );
    expect(source).not.toMatch(
      /fetch\(["']\/api\/leadgrid\/app-waitlist\/(?:status|notify-launch)/,
    );
  });

  it("normaliserer og lagrer en gyldig offentlig påmelding", async () => {
    const { app, query } = buildApp();

    await request(app)
      .post("/api/leadgrid/app-waitlist")
      .send({ email: "  DANIEL@Example.Test " })
      .expect(200, { ok: true });

    const insert = query.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO leadgrid_app_waitlist"),
    );
    const schemaSql = query.mock.calls.map(([sql]) => String(sql)).join("\n");
    expect(schemaSql).toContain(
      "ADD COLUMN IF NOT EXISTS notification_claim_id UUID",
    );
    expect(schemaSql).toContain(
      "ADD COLUMN IF NOT EXISTS notification_claim_expires_at TIMESTAMPTZ",
    );
    expect(schemaSql).toContain(
      "ADD COLUMN IF NOT EXISTS notification_delivery_started_at TIMESTAMPTZ",
    );
    expect(schemaSql).toContain(
      "ADD COLUMN IF NOT EXISTS notification_delivery_uncertain_at TIMESTAMPTZ",
    );
    expect(schemaSql).toContain(
      "CREATE INDEX IF NOT EXISTS idx_leadgrid_app_waitlist_pending_delivery_v2",
    );
    expect(insert?.[1]?.[1]).toBe("daniel@example.test");
    expect(mailMocks.sendEmail).not.toHaveBeenCalled();
  });

  it("varsler admin bare når INSERT faktisk oppretter en ny rad", async () => {
    mailMocks.isEmailConfigured.mockReturnValue(true);
    const { app } = buildApp({ insertRowCounts: [1, 0] });

    await request(app)
      .post("/api/leadgrid/app-waitlist")
      .send({ email: "duplicate@example.test" })
      .expect(200, { ok: true });
    await request(app)
      .post("/api/leadgrid/app-waitlist")
      .send({ email: "duplicate@example.test" })
      .expect(200, { ok: true });

    expect(mailMocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("avviser ugyldig e-post uten insert", async () => {
    const { app, query } = buildApp();

    await request(app)
      .post("/api/leadgrid/app-waitlist")
      .send({ email: "ikke-en-epost" })
      .expect(400, { error: "invalid_email" });

    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO leadgrid_app_waitlist"),
      ),
    ).toBe(false);
  });

  it("rate-limiter offentlig påmelding før videre behandling", async () => {
    const { app } = buildApp();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .post("/api/leadgrid/app-waitlist")
        .send({ email: "ikke-en-epost" })
        .expect(400);
    }
    await request(app)
      .post("/api/leadgrid/app-waitlist")
      .send({ email: "ikke-en-epost" })
      .expect(429, { error: "too_many_requests" });
  });

  it("uses the explicit trusted-hop client IP instead of Express proxy defaults", async () => {
    vi.stubEnv("LEADGRID_SELF_ONBOARD_TRUST_PROXY_HOPS", "1");
    const { app } = buildApp();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .post("/api/leadgrid/app-waitlist")
        .set("X-Forwarded-For", "198.51.100.10")
        .send({ email: "invalid" })
        .expect(400);
    }
    await request(app)
      .post("/api/leadgrid/app-waitlist")
      .set("X-Forwarded-For", "203.0.113.20")
      .send({ email: "invalid" })
      .expect(400);

    vi.unstubAllEnvs();
  });

  it("bruker canonical resolver og Admin Room-ownergrensen for status", async () => {
    const owner = {
      userId: "owner-1",
      role: "user",
      email: "owner@example.test",
    };
    const {
      app,
      resolveAuthoritativeSessionFromRequest,
      requireAdminRoomAccess,
    } = buildApp({
        persistedSessions: new Map([["persisted-token", owner]]),
      });

    await request(app)
      .get("/api/leadgrid/app-waitlist/status")
      .expect(401, { error: "ikke_innlogget" });

    await request(app)
      .get("/api/leadgrid/app-waitlist/status")
      .set("Authorization", "Bearer persisted-token")
      .expect(200, {
        total: 7,
        pending: 3,
        uncertain: 2,
        in_progress: 1,
      });

    expect(resolveAuthoritativeSessionFromRequest).toHaveBeenCalled();
    expect(requireAdminRoomAccess).toHaveBeenCalledTimes(1);
  });

  it("avviser og evikter et cachet token som passordreset har fjernet persistent", async () => {
    const revokedOwnerSession = {
      userId: "owner-1",
      role: "admin",
      email: "owner@example.test",
    };
    const { app, activeSessions, query, requireAdminRoomAccess } = buildApp({
      activeSessions: new Map([["revoked-after-password-reset", revokedOwnerSession]]),
      // Simuler deletePersistedAuthSessionsByUserId etter passordreset:
      // tokenet finnes fortsatt i denne prosessens cache, men ikke i DB.
      persistedSessions: new Map(),
      dbRole: "admin",
    });

    await request(app)
      .get("/api/leadgrid/app-waitlist/status")
      .set("Authorization", "Bearer revoked-after-password-reset")
      .expect(401, { error: "ikke_innlogget" });
    await request(app)
      .post("/api/leadgrid/app-waitlist/notify-launch")
      .set("Authorization", "Bearer revoked-after-password-reset")
      .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" })
      .expect(401, { error: "ikke_innlogget" });

    expect(activeSessions.has("revoked-after-password-reset")).toBe(false);
    expect(requireAdminRoomAccess).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(mailMocks.sendEmail).not.toHaveBeenCalled();
  });

  it("returnerer 503 når det autoritative sesjonslageret ikke kan verifiseres", async () => {
    const { app, query, requireAdminRoomAccess } = buildApp({
      activeSessions: new Map([
        [
          "cached-owner",
          {
            userId: "owner-1",
            role: "admin",
            email: "owner@example.test",
          },
        ],
      ]),
      sessionVerificationUnavailable: true,
      dbRole: "admin",
    });

    await request(app)
      .get("/api/leadgrid/app-waitlist/status")
      .set("Authorization", "Bearer cached-owner")
      .expect(503, { error: "session_verification_unavailable" });
    await request(app)
      .post("/api/leadgrid/app-waitlist/notify-launch")
      .set("Authorization", "Bearer cached-owner")
      .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" })
      .expect(503, { error: "session_verification_unavailable" });

    expect(requireAdminRoomAccess).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(mailMocks.sendEmail).not.toHaveBeenCalled();
  });

  it("avviser en vilkårlig activeSessions-admin uten produkteieridentitet", async () => {
    const { app, query } = buildApp({
      activeSessions: new Map([
        [
          "forged-admin",
          {
            userId: "attacker-1",
            role: "admin",
            email: "attacker@example.test",
          },
        ],
      ]),
    });

    await request(app)
      .get("/api/leadgrid/app-waitlist/status")
      .set("Authorization", "Bearer forged-admin")
      .expect(403);
    await request(app)
      .post("/api/leadgrid/app-waitlist/notify-launch")
      .set("Authorization", "Bearer forged-admin")
      .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" })
      .expect(403);

    expect(query).not.toHaveBeenCalled();
  });

  it("stoler ikke på session.role for global utsendelse", async () => {
    mailMocks.isEmailConfigured.mockReturnValue(true);
    const { app, query } = buildApp({
      activeSessions: new Map([
        [
          "stale-superadmin",
          {
            userId: "owner-1",
            role: "super_admin",
            email: "owner@example.test",
          },
        ],
      ]),
      dbRole: "user",
    });

    await request(app)
      .post("/api/leadgrid/app-waitlist/notify-launch")
      .set("Authorization", "Bearer stale-superadmin")
      .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" })
      .expect(403, { error: "krever_superadmin_eller_eier" });

    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("FROM users")),
    ).toBe(true);
    expect(mailMocks.sendEmail).not.toHaveBeenCalled();
  });

  it.each(["admin", "super_admin", "owner"])(
    "tillater DB-verifisert produkteier med rollen %s å sende til ventende",
    async (dbRole) => {
      mailMocks.isEmailConfigured.mockReturnValue(true);
      const { app, query } = buildApp({
        activeSessions: new Map([
          [
            "owner-token",
            {
              userId: "owner-1",
              role: "user",
              email: "owner@example.test",
            },
          ],
        ]),
        dbRole,
        pendingRows: [{ id: "wait-1", email: "waiting@example.test" }],
      });

      await request(app)
        .post("/api/leadgrid/app-waitlist/notify-launch")
        .set("Authorization", "Bearer owner-token")
        .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" })
        .expect(200, {
          ok: true,
          sent: 1,
          failed: 0,
          uncertain: 0,
          total: 1,
        });

      const roleLookup = query.mock.calls.find(([sql]) =>
        String(sql).includes("FROM users"),
      );
      expect(roleLookup?.[1]).toEqual(["owner-1", "owner@example.test"]);
      expect(mailMocks.sendEmail).toHaveBeenCalledTimes(1);
      const claimSql = String(
        query.mock.calls.find(([sql]) =>
          String(sql).includes("WITH claimable AS"),
        )?.[0],
      );
      expect(claimSql).toContain("FOR UPDATE SKIP LOCKED");
      expect(claimSql).toContain("LIMIT 1");
      expect(claimSql).toContain("UPDATE leadgrid_app_waitlist AS waitlist");
      expect(claimSql).toContain("RETURNING waitlist.id, waitlist.email");
      const claimCall = query.mock.calls.find(([sql]) =>
        String(sql).includes("WITH claimable AS"),
      );
      const message = mailMocks.sendEmail.mock.calls[0]?.[0];
      expect(message.smtpTimeoutMs).toBeGreaterThan(0);
      expect(message.messageId).toBe(
        "<leadgrid-app-launch-wait-1@creatorhubn.com>",
      );
      expect(message.smtpTimeoutMs).toBeLessThan(
        Number(claimCall?.[1]?.[1]) * 1_000,
      );
      expect(
        query.mock.calls.some(([sql]) =>
          String(sql).includes("SET notification_delivery_started_at = now()"),
        ),
      ).toBe(true);
      expect(
        query.mock.calls.some(([sql]) =>
          String(sql).includes("SET notified_at = now()"),
        ),
      ).toBe(true);
    },
  );

  it("claimer atomisk slik at to samtidige admin-kall aldri sender samme rad", async () => {
    mailMocks.isEmailConfigured.mockReturnValue(true);
    let signalFirstSendStarted!: () => void;
    let allowFirstSend!: () => void;
    const firstSendStarted = new Promise<void>((resolve) => {
      signalFirstSendStarted = resolve;
    });
    const firstSendMayFinish = new Promise<void>((resolve) => {
      allowFirstSend = resolve;
    });
    mailMocks.sendEmail.mockImplementation(async () => {
      if (mailMocks.sendEmail.mock.calls.length === 1) {
        signalFirstSendStarted();
        await firstSendMayFinish;
      }
      return { success: true };
    });

    const { app, query, waitlistRows } = buildApp({
      activeSessions: new Map([
        [
          "owner-token",
          {
            userId: "owner-1",
            role: "admin",
            email: "owner@example.test",
          },
        ],
      ]),
      dbRole: "admin",
      pendingRows: [
        { id: "wait-1", email: "one@example.test" },
        { id: "wait-2", email: "two@example.test" },
      ],
    });
    const postLaunch = () =>
      request(app)
        .post("/api/leadgrid/app-waitlist/notify-launch")
        .set("Authorization", "Bearer owner-token")
        .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" });

    const firstRequest = postLaunch();
    const firstResponsePromise = firstRequest.then((response) => response);
    await firstSendStarted;
    expect(waitlistRows[0]).toMatchObject({
      notificationClaimId: expect.any(String),
    });
    expect(waitlistRows[1]).toMatchObject({
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
    });
    const secondResponse = await postLaunch();
    allowFirstSend();
    const firstResponse = await firstResponsePromise;

    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body).toEqual({
      ok: true,
      sent: 1,
      failed: 0,
      uncertain: 0,
      total: 1,
    });
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual({
      ok: true,
      sent: 1,
      failed: 0,
      uncertain: 0,
      total: 1,
    });
    expect(
      mailMocks.sendEmail.mock.calls.map(([message]) => message.to).sort(),
    ).toEqual(["one@example.test", "two@example.test"]);
    expect(
      query.mock.calls.filter(([sql]) =>
        String(sql).includes("WITH claimable AS"),
      ),
    ).toHaveLength(4);
  });

  it("sender ikke når claim-eierskapet tapes før SMTP-kallet", async () => {
    mailMocks.isEmailConfigured.mockReturnValue(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { app, waitlistRows } = buildApp({
      activeSessions: new Map([
        [
          "owner-token",
          {
            userId: "owner-1",
            role: "admin",
            email: "owner@example.test",
          },
        ],
      ]),
      dbRole: "admin",
      loseClaimBeforeRenew: true,
      pendingRows: [{ id: "lost", email: "lost@example.test" }],
    });

    await request(app)
      .post("/api/leadgrid/app-waitlist/notify-launch")
      .set("Authorization", "Bearer owner-token")
      .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" })
      .expect(200, {
        ok: true,
        sent: 0,
        failed: 1,
        uncertain: 0,
        total: 1,
      });

    expect(mailMocks.sendEmail).not.toHaveBeenCalled();
    expect(waitlistRows[0]).toMatchObject({
      notifiedAt: null,
      notificationClaimId: "00000000-0000-4000-8000-000000000099",
    });
    warn.mockRestore();
  });

  it("reclaimer utløpt lease, men lar en aktiv claim være urørt", async () => {
    mailMocks.isEmailConfigured.mockReturnValue(true);
    const now = Date.now();
    const { app, waitlistRows } = buildApp({
      activeSessions: new Map([
        [
          "owner-token",
          {
            userId: "owner-1",
            role: "admin",
            email: "owner@example.test",
          },
        ],
      ]),
      dbRole: "admin",
      pendingRows: [
        {
          id: "expired",
          email: "expired@example.test",
          notificationClaimId: "00000000-0000-4000-8000-000000000001",
          notificationClaimExpiresAt: new Date(now - 60_000).toISOString(),
        },
        {
          id: "active",
          email: "active@example.test",
          notificationClaimId: "00000000-0000-4000-8000-000000000002",
          notificationClaimExpiresAt: new Date(now + 60_000).toISOString(),
        },
      ],
    });

    await request(app)
      .post("/api/leadgrid/app-waitlist/notify-launch")
      .set("Authorization", "Bearer owner-token")
      .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" })
      .expect(200, {
        ok: true,
        sent: 1,
        failed: 0,
        uncertain: 0,
        total: 1,
      });

    expect(mailMocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mailMocks.sendEmail.mock.calls[0]?.[0].to).toBe(
      "expired@example.test",
    );
    expect(waitlistRows.find((row) => row.id === "expired")).toMatchObject({
      notifiedAt: expect.any(String),
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
    });
    expect(waitlistRows.find((row) => row.id === "active")).toMatchObject({
      notifiedAt: null,
      notificationClaimId: "00000000-0000-4000-8000-000000000002",
    });
  });

  it("frigir bare en sikker pre-delivery-feil slik at neste kall kan prøve igjen", async () => {
    mailMocks.isEmailConfigured.mockReturnValue(true);
    mailMocks.sendEmail
      .mockResolvedValueOnce({
        success: false,
        error: "authentication rejected",
        failureCertainty: "definite_pre_delivery",
      })
      .mockResolvedValueOnce({ success: true });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { app, waitlistRows } = buildApp({
      activeSessions: new Map([
        [
          "owner-token",
          {
            userId: "owner-1",
            role: "admin",
            email: "owner@example.test",
          },
        ],
      ]),
      dbRole: "admin",
      pendingRows: [{ id: "retry", email: "retry@example.test" }],
    });
    const postLaunch = () =>
      request(app)
        .post("/api/leadgrid/app-waitlist/notify-launch")
        .set("Authorization", "Bearer owner-token")
        .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" });

    await postLaunch().expect(200, {
      ok: true,
      sent: 0,
      failed: 1,
      uncertain: 0,
      total: 1,
    });
    expect(waitlistRows[0]).toMatchObject({
      notifiedAt: null,
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
    });

    await postLaunch().expect(200, {
      ok: true,
      sent: 1,
      failed: 0,
      uncertain: 0,
      total: 1,
    });
    expect(waitlistRows[0]).toMatchObject({
      notifiedAt: expect.any(String),
      notificationClaimId: null,
      notificationClaimExpiresAt: null,
    });
    warn.mockRestore();
  });

  it("karantenerer tvetydig SMTP-timeout og sender aldri raden automatisk på nytt", async () => {
    mailMocks.isEmailConfigured.mockReturnValue(true);
    mailMocks.sendEmail.mockResolvedValue({
      success: false,
      error: "Timeout after DATA",
      failureCertainty: "uncertain",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { app, waitlistRows } = buildApp({
      activeSessions: new Map([
        [
          "owner-token",
          {
            userId: "owner-1",
            role: "admin",
            email: "owner@example.test",
          },
        ],
      ]),
      dbRole: "admin",
      pendingRows: [{ id: "ambiguous", email: "ambiguous@example.test" }],
    });
    const postLaunch = () =>
      request(app)
        .post("/api/leadgrid/app-waitlist/notify-launch")
        .set("Authorization", "Bearer owner-token")
        .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" });

    await postLaunch().expect(200, {
      ok: true,
      sent: 0,
      failed: 1,
      uncertain: 1,
      total: 1,
    });
    expect(waitlistRows[0]).toMatchObject({
      notifiedAt: null,
      notificationDeliveryStartedAt: expect.any(String),
      notificationDeliveryUncertainAt: expect.any(String),
      notificationDeliveryError: expect.stringContaining(
        "smtp_outcome_uncertain",
      ),
      notificationMessageId:
        "<leadgrid-app-launch-ambiguous@creatorhubn.com>",
    });

    // Selv en utløpt/manglende claim gjør aldri en startet levering auto-claimbar.
    waitlistRows[0]!.notificationClaimExpiresAt = new Date(
      Date.now() - 60_000,
    ).toISOString();
    await postLaunch().expect(200, {
      ok: true,
      sent: 0,
      failed: 0,
      uncertain: 0,
      total: 0,
    });
    expect(mailMocks.sendEmail).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("sender ikke på nytt når SMTP leverte men DB-kvitteringen feilet", async () => {
    mailMocks.isEmailConfigured.mockReturnValue(true);
    mailMocks.sendEmail.mockResolvedValue({
      success: true,
      messageId: "<leadgrid-app-launch-delivered@creatorhubn.com>",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { app, waitlistRows } = buildApp({
      activeSessions: new Map([
        [
          "owner-token",
          {
            userId: "owner-1",
            role: "admin",
            email: "owner@example.test",
          },
        ],
      ]),
      dbRole: "admin",
      failDeliveryReceiptOnce: true,
      pendingRows: [{ id: "delivered", email: "delivered@example.test" }],
    });
    const postLaunch = () =>
      request(app)
        .post("/api/leadgrid/app-waitlist/notify-launch")
        .set("Authorization", "Bearer owner-token")
        .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" });

    await postLaunch().expect(200, {
      ok: true,
      sent: 0,
      failed: 1,
      uncertain: 1,
      total: 1,
    });
    expect(waitlistRows[0]).toMatchObject({
      notifiedAt: null,
      notificationDeliveryStartedAt: expect.any(String),
      notificationDeliveryUncertainAt: expect.any(String),
      notificationDeliveryError: expect.stringContaining(
        "delivery_receipt_persist_failed",
      ),
    });

    waitlistRows[0]!.notificationClaimExpiresAt = new Date(
      Date.now() - 60_000,
    ).toISOString();
    await postLaunch().expect(200, {
      ok: true,
      sent: 0,
      failed: 0,
      uncertain: 0,
      total: 0,
    });
    expect(mailMocks.sendEmail).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("failer lukket når DB-rolle ikke kan verifiseres", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { app } = buildApp({
      activeSessions: new Map([
        [
          "owner-token",
          {
            userId: "owner-1",
            role: "super_admin",
            email: "owner@example.test",
          },
        ],
      ]),
      failDbRoleLookup: true,
    });

    await request(app)
      .post("/api/leadgrid/app-waitlist/notify-launch")
      .set("Authorization", "Bearer owner-token")
      .send({ appStoreUrl: "https://apps.apple.com/no/app/leadgrid/id123" })
      .expect(503, { error: "admin_verification_unavailable" });
    expect(mailMocks.sendEmail).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("avviser lookalike-host før global e-post sendes", async () => {
    mailMocks.isEmailConfigured.mockReturnValue(true);
    const { app } = buildApp({
      activeSessions: new Map([
        [
          "owner-token",
          {
            userId: "owner-1",
            email: "owner@example.test",
          },
        ],
      ]),
      dbRole: "super_admin",
    });

    await request(app)
      .post("/api/leadgrid/app-waitlist/notify-launch")
      .set("Authorization", "Bearer owner-token")
      .send({ appStoreUrl: "https://apps.apple.com.evil.test/app/leadgrid" })
      .expect(400, { error: "invalid_app_store_url" });

    expect(mailMocks.sendEmail).not.toHaveBeenCalled();
  });
});
