import express, { type Express } from "express";
import type { Pool } from "pg";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const eventMocks = vi.hoisted(() => ({
  publishEvent: vi.fn(async () => undefined),
  emitWebhook: vi.fn(async () => undefined),
}));

vi.mock("./leadgrid-workflow-engine.js", () => ({
  publishEvent: eventMocks.publishEvent,
}));
vi.mock("./webhook-emitter.js", () => ({
  emitWebhook: eventMocks.emitWebhook,
}));

import {
  computeWorkflowEventSignature,
  registerLeadgridWorkflowTriggerRoutes,
} from "./leadgrid-workflow-triggers-routes.js";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_ORGANIZATION_ID = "33333333-3333-4333-8333-333333333333";
const PROPOSAL_ID = "44444444-4444-4444-8444-444444444444";
const MEETING_ID = "55555555-5555-4555-8555-555555555555";
const SIGNING_SECRET = "workflow-signing-secret-for-tests-000000000";
const OTHER_SIGNING_SECRET = "other-tenant-signing-secret-for-tests-000000";
const SERVICE_TOKEN = "workflow-service-token-for-tests-0000000000";

type SessionData = { userId: string; role?: string; email?: string };

type ClaimRow = {
  requestHash: string;
  responseStatus: number;
  responseBody: Record<string, unknown>;
};

type TestState = {
  customerExists: boolean;
  membershipExists: boolean;
  memberRole: string;
  meetingPermission: boolean;
  superAdmin: boolean;
  proposalBound: boolean;
  meetingBound: boolean;
  meetingUpdateExists: boolean;
  localContractExists: boolean;
  contractBound: boolean;
  claims: Map<string, ClaimRow>;
  eventWrites: string[];
  meetingUpdates: number;
};

const EVENT_CASES: Array<{
  path: string;
  body: Record<string, unknown>;
}> = [
  {
    path: "/api/leadgrid/events/email/opened",
    body: { organization_id: ORGANIZATION_ID, customer_id: CUSTOMER_ID, email_id: "mail-1" },
  },
  {
    path: "/api/leadgrid/events/email/link-clicked",
    body: {
      customer_id: CUSTOMER_ID,
      organization_id: ORGANIZATION_ID,
      email_id: "mail-1",
      link_url: "https://example.test/landing",
    },
  },
  {
    path: "/api/leadgrid/events/meetings/booked",
    body: {
      customer_id: CUSTOMER_ID,
      organization_id: ORGANIZATION_ID,
      meeting_id: MEETING_ID,
      meeting_type: "discovery",
    },
  },
  {
    path: "/api/leadgrid/events/meetings/no-show",
    body: { organization_id: ORGANIZATION_ID, customer_id: CUSTOMER_ID, meeting_id: MEETING_ID },
  },
  {
    path: "/api/leadgrid/events/proposals/opened",
    body: { organization_id: ORGANIZATION_ID, customer_id: CUSTOMER_ID, proposal_id: PROPOSAL_ID },
  },
  {
    path: "/api/leadgrid/events/contracts/signed",
    body: {
      customer_id: CUSTOMER_ID,
      organization_id: ORGANIZATION_ID,
      contract_id: "provider-contract-1",
      provider: "docusign",
    },
  },
];

function claimKey(params: unknown[]): string {
  return [params[0], params[1], params[2], params[3]].join("|");
}

function createTestApp(
  overrides: Partial<TestState> = {},
  activeSessions = new Map<string, SessionData>(),
): { app: Express; state: TestState; query: ReturnType<typeof vi.fn> } {
  const state: TestState = {
    customerExists: true,
    membershipExists: true,
    memberRole: "member",
    meetingPermission: true,
    superAdmin: false,
    proposalBound: true,
    meetingBound: true,
    meetingUpdateExists: true,
    localContractExists: false,
    contractBound: true,
    claims: new Map(),
    eventWrites: [],
    meetingUpdates: 0,
    ...overrides,
  };

  const query = vi.fn(async (sqlValue: unknown, paramsValue?: unknown[]) => {
    const sql = String(sqlValue);
    const params = paramsValue ?? [];

    if (
      sql.includes("CREATE TABLE IF NOT EXISTS idempotency_keys_v1") ||
      sql.includes("CREATE INDEX IF NOT EXISTS idempotency_keys_v1")
    ) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("FROM crm_customers")) {
      return {
        rows: state.customerExists
          ? [{ id: CUSTOMER_ID, organization_id: ORGANIZATION_ID }]
          : [],
        rowCount: state.customerExists ? 1 : 0,
      };
    }
    if (sql.includes("FROM users WHERE") && sql.includes("super_admin")) {
      return {
        rows: state.superAdmin ? [{ ok: 1 }] : [],
        rowCount: state.superAdmin ? 1 : 0,
      };
    }
    if (sql.includes("SELECT role FROM organization_members")) {
      return {
        rows: state.membershipExists ? [{ role: state.memberRole }] : [],
        rowCount: state.membershipExists ? 1 : 0,
      };
    }
    if (sql.includes("SELECT permission_key FROM role_permissions")) {
      return {
        rows: state.meetingPermission
          ? [{ permission_key: "workflow_events.meeting_booked" }, { permission_key: "workflow_events.meeting_no_show" }]
          : [],
        rowCount: state.meetingPermission ? 2 : 0,
      };
    }
    if (sql.includes("FROM user_permission_overrides")) {
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes("SELECT key FROM permissions")) {
      return {
        rows: [
          { key: "workflow_events.meeting_booked" },
          { key: "workflow_events.meeting_no_show" },
        ],
        rowCount: 2,
      };
    }
    if (sql.includes("FROM leadgrid_proposals")) {
      return {
        rows: state.proposalBound ? [{ ok: 1 }] : [],
        rowCount: state.proposalBound ? 1 : 0,
      };
    }
    if (sql.includes("FROM leadgrid_meetings") && sql.includes("SELECT 1")) {
      return {
        rows: state.meetingBound ? [{ ok: 1 }] : [],
        rowCount: state.meetingBound ? 1 : 0,
      };
    }
    if (sql.includes("FROM contracts c")) {
      return {
        rows: state.localContractExists
          ? [{
              client_id: state.contractBound ? CUSTOMER_ID : "99999999-9999-4999-8999-999999999999",
              client_email: "signer@example.test",
              organization_bound: state.contractBound,
            }]
          : [],
        rowCount: state.localContractExists ? 1 : 0,
      };
    }
    if (
      sql.includes("INSERT INTO idempotency_keys_v1") &&
      sql.includes("RETURNING idempotency_key")
    ) {
      const key = claimKey(params);
      if (state.claims.has(key)) return { rows: [], rowCount: 0 };
      state.claims.set(key, {
        requestHash: String(params[4]),
        responseStatus: 202,
        responseBody: JSON.parse(String(params[5])),
      });
      return { rows: [{ idempotency_key: params[3] }], rowCount: 1 };
    }
    if (
      sql.includes("FROM idempotency_keys_v1") &&
      sql.includes("SELECT request_hash")
    ) {
      const stored = state.claims.get(claimKey(params));
      return {
        rows: stored
          ? [
              {
                request_hash: stored.requestHash,
                response_status: stored.responseStatus,
                response_body: stored.responseBody,
              },
            ]
          : [],
        rowCount: stored ? 1 : 0,
      };
    }
    if (sql.includes("UPDATE idempotency_keys_v1")) {
      for (const stored of state.claims.values()) {
        if (stored.requestHash === params[2] && stored.responseStatus === 202) {
          stored.responseStatus = 200;
          stored.responseBody = JSON.parse(String(params[3]));
        }
      }
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("DELETE FROM idempotency_keys_v1")) {
      for (const [key, stored] of state.claims.entries()) {
        if (stored.requestHash === params[2] && stored.responseStatus === 202) {
          state.claims.delete(key);
        }
      }
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO leadgrid_email_tracking_events")) {
      state.eventWrites.push("email");
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO leadgrid_proposal_views")) {
      state.eventWrites.push("proposal");
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("INSERT INTO leadgrid_contract_events")) {
      state.eventWrites.push("contract");
      return { rows: [], rowCount: 1 };
    }
    if (
      sql.includes("UPDATE leadgrid_meetings") &&
      sql.includes("RETURNING id")
    ) {
      state.meetingUpdates += 1;
      return {
        rows: state.meetingUpdateExists ? [{ id: MEETING_ID }] : [],
        rowCount: state.meetingUpdateExists ? 1 : 0,
      };
    }

    throw new Error(`Unexpected test query: ${sql}`);
  });

  const app = express();
  app.use(express.json());
  registerLeadgridWorkflowTriggerRoutes({
    app,
    pool: { query } as unknown as Pool,
    activeSessions,
  });
  return { app, state, query };
}

function signedPost(
  app: Express,
  path: string,
  body: Record<string, unknown>,
  deliveryId: string,
  timestamp = String(Date.now()),
  secret = SIGNING_SECRET,
) {
  const signature = computeWorkflowEventSignature(
    secret,
    timestamp,
    deliveryId,
    path,
    body,
  );
  return request(app)
    .post(path)
    .set("X-Leadgrid-Timestamp", timestamp)
    .set("X-Leadgrid-Delivery-Id", deliveryId)
    .set("X-Leadgrid-Signature", signature)
    .send(body);
}

describe("Leadgrid workflow event security contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv(
      "LEADGRID_WORKFLOW_EVENT_SIGNING_SECRETS_JSON",
      JSON.stringify({
        [ORGANIZATION_ID]: Object.fromEntries(
          EVENT_CASES.map((event) => [
            event.path.includes("link-clicked")
              ? "email.link_clicked"
              : event.path.includes("email/opened")
                ? "email.opened"
                : event.path.includes("meetings/booked")
                  ? "meeting.booked"
                  : event.path.includes("no-show")
                    ? "meeting.no_show"
                    : event.path.includes("proposals")
                      ? "proposal.opened"
                      : "contract.signed",
            SIGNING_SECRET,
          ]),
        ),
        [OTHER_ORGANIZATION_ID]: {
          "email.opened": OTHER_SIGNING_SECRET,
        },
      }),
    );
    vi.stubEnv("LEADGRID_WORKFLOW_EVENT_SERVICE_TOKEN", SERVICE_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("avviser alle seks eventruter uten autentisering før databasebruk", async () => {
    const { app, query } = createTestApp();

    for (const event of EVENT_CASES) {
      const response = await request(app)
        .post(event.path)
        .send(event.body)
        .expect(401);
      expect(response.body).toEqual({ error: "workflow_event_auth_required" });
    }

    expect(query).not.toHaveBeenCalled();
    expect(eventMocks.publishEvent).not.toHaveBeenCalled();
    expect(eventMocks.emitWebhook).not.toHaveBeenCalled();
  });

  it("godtar eksplisitt HMAC-kontrakt for alle seks eventtyper", async () => {
    const { app, state, query } = createTestApp();

    for (const [index, event] of EVENT_CASES.entries()) {
      await signedPost(
        app,
        event.path,
        event.body,
        `provider-delivery-${index + 1}`,
      ).expect(200, { ok: true });
    }

    expect(eventMocks.publishEvent).toHaveBeenCalledTimes(6);
    expect(eventMocks.emitWebhook).toHaveBeenCalledTimes(6);
    for (const [payload] of eventMocks.publishEvent.mock.calls) {
      expect(payload).toMatchObject({
        organizationId: ORGANIZATION_ID,
        leadId: CUSTOMER_ID,
      });
    }
    for (const call of eventMocks.emitWebhook.mock.calls) {
      expect(call[3]).toBe(ORGANIZATION_ID);
    }
    expect(state.eventWrites).toEqual([
      "email",
      "email",
      "proposal",
      "contract",
    ]);
    expect(state.meetingUpdates).toBe(1);

    const proposalLookup = query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM leadgrid_proposals"),
    );
    expect(String(proposalLookup?.[0])).toContain("lead_id = $2::uuid");
    expect(String(proposalLookup?.[0])).toContain("organization_id = $3");
    expect(proposalLookup?.[1]).toEqual([
      PROPOSAL_ID,
      CUSTOMER_ID,
      ORGANIZATION_ID,
    ]);

    const meetingUpdate = query.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE leadgrid_meetings"),
    );
    expect(String(meetingUpdate?.[0])).toContain("organization_id = $2::uuid");
    expect(String(meetingUpdate?.[0])).toContain("customer_id = $3::uuid");
    expect(meetingUpdate?.[1]?.slice(0, 3)).toEqual([
      MEETING_ID,
      ORGANIZATION_ID,
      CUSTOMER_ID,
    ]);
  });

  it("avviser utløpt timestamp og ugyldig signatur før oppslag", async () => {
    const { app, query } = createTestApp();
    const event = EVENT_CASES[0];

    const stale = await signedPost(
      app,
      event.path,
      event.body,
      "provider-stale-1",
      String(Date.now() - 6 * 60 * 1000),
    ).expect(401);
    expect(stale.body.error).toBe("workflow_event_timestamp_expired");

    const invalid = await request(app)
      .post(event.path)
      .set("X-Leadgrid-Timestamp", String(Date.now()))
      .set("X-Leadgrid-Delivery-Id", "provider-invalid-1")
      .set("X-Leadgrid-Signature", `sha256=${"0".repeat(64)}`)
      .send(event.body)
      .expect(401);
    expect(invalid.body.error).toBe("workflow_event_signature_invalid");
    expect(query).not.toHaveBeenCalled();
  });

  it("feiler lukket når signeringshemmeligheten mangler", async () => {
    vi.stubEnv("LEADGRID_WORKFLOW_EVENT_SIGNING_SECRETS_JSON", "");
    const { app, query } = createTestApp();
    const event = EVENT_CASES[0];

    const response = await request(app)
      .post(event.path)
      .set("X-Leadgrid-Timestamp", String(Date.now()))
      .set("X-Leadgrid-Delivery-Id", "provider-no-config-1")
      .set("X-Leadgrid-Signature", `sha256=${"0".repeat(64)}`)
      .send(event.body)
      .expect(503);

    expect(response.body.error).toBe("workflow_event_signing_not_configured");
    expect(query).not.toHaveBeenCalled();
  });

  it("bruker kundens kanoniske org og avviser body-org fra annen tenant", async () => {
    const { app, state } = createTestApp();
    const body = {
      ...EVENT_CASES[0].body,
      organization_id: OTHER_ORGANIZATION_ID,
    };

    const response = await signedPost(
      app,
      EVENT_CASES[0].path,
      body,
      "provider-cross-tenant-1",
      String(Date.now()),
      OTHER_SIGNING_SECRET,
    ).expect(403);

    expect(response.body.error).toBe("organization_mismatch");
    expect(state.claims.size).toBe(0);
    expect(state.eventWrites).toHaveLength(0);
  });

  it("avviser signatur fra en annen tenants event-secret før databaseoppslag", async () => {
    const { app, query } = createTestApp();
    const event = EVENT_CASES[0];

    const response = await signedPost(
      app,
      event.path,
      event.body,
      "provider-wrong-tenant-secret-1",
      String(Date.now()),
      OTHER_SIGNING_SECRET,
    ).expect(401);

    expect(response.body.error).toBe("workflow_event_signature_invalid");
    expect(query).not.toHaveBeenCalled();
  });

  it("avviser vanlig session for provider-observerte eventer", async () => {
    const sessions = new Map<string, SessionData>([
      ["user-session-token", { userId: "org-member-1" }],
    ]);
    const { app, state } = createTestApp({}, sessions);

    for (const index of [0, 1, 4, 5]) {
      const response = await request(app)
        .post(EVENT_CASES[index].path)
        .set("Authorization", "Bearer user-session-token")
        .set("Idempotency-Key", `session-provider-forbidden-${index}`)
        .send(EVENT_CASES[index].body)
        .expect(403);
      expect(response.body.error).toBe("workflow_event_session_not_allowed");
    }
    expect(state.eventWrites).toHaveLength(0);
  });

  it("krever mål-org-medlemskap og event-permission for møte-session", async () => {
    const sessions = new Map<string, SessionData>([
      ["user-session-token", { userId: "user-outside-org" }],
    ]);
    const { app, state } = createTestApp(
      { membershipExists: false, meetingPermission: false },
      sessions,
    );

    const response = await request(app)
      .post(EVENT_CASES[2].path)
      .set("Authorization", "Bearer user-session-token")
      .set("Idempotency-Key", "session-denied-1")
      .send(EVENT_CASES[2].body)
      .expect(403);

    expect(response.body.error).toBe("workflow_event_permission_denied");
    expect(state.meetingUpdates).toBe(0);
  });

  it("godtar møte-session med eksplisitt event-permission og viderefører aktør", async () => {
    const sessions = new Map<string, SessionData>([
      ["meeting-session", { userId: "org-member-1" }],
    ]);
    const { app, query } = createTestApp({}, sessions);

    await request(app)
      .post(EVENT_CASES[2].path)
      .set("Authorization", "Bearer meeting-session")
      .set("Idempotency-Key", "meeting-session-delivery-1")
      .send(EVENT_CASES[2].body)
      .expect(200, { ok: true });

    expect(eventMocks.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        leadId: CUSTOMER_ID,
        actorUserId: "org-member-1",
        data: expect.objectContaining({
          delivery_id: "meeting-session-delivery-1",
        }),
      }),
    );
    const permissionLookup = query.mock.calls.find(([sql]) =>
      String(sql).includes("FROM role_permissions"),
    );
    expect(permissionLookup).toBeTruthy();
  });

  it("godtar intern service-token kun med fersk delivery-kontrakt", async () => {
    const { app } = createTestApp();
    const event = EVENT_CASES[0];

    await request(app)
      .post(event.path)
      .set("Authorization", `Bearer ${SERVICE_TOKEN}`)
      .set("X-Leadgrid-Timestamp", String(Date.now()))
      .set("X-Leadgrid-Delivery-Id", "internal-mailer-1")
      .send(event.body)
      .expect(200, { ok: true });

    expect(eventMocks.publishEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: ORGANIZATION_ID,
        actorUserId: null,
      }),
    );
  });

  it("avviser forslag som ikke er bundet til samme kunde og org", async () => {
    const { app, state } = createTestApp({ proposalBound: false });
    const event = EVENT_CASES[4];

    const response = await signedPost(
      app,
      event.path,
      event.body,
      "provider-proposal-mismatch-1",
    ).expect(404);

    expect(response.body.error).toBe("proposal_not_found_for_customer");
    expect(state.claims.size).toBe(0);
    expect(state.eventWrites).toHaveLength(0);
  });

  it("avviser no-show når møtet ikke tilhører samme kunde og org", async () => {
    const { app, state } = createTestApp({ meetingBound: false });
    const event = EVENT_CASES[3];

    const response = await signedPost(
      app,
      event.path,
      event.body,
      "provider-meeting-mismatch-1",
    ).expect(404);

    expect(response.body.error).toBe("meeting_not_found_for_customer");
    expect(state.claims.size).toBe(0);
    expect(state.meetingUpdates).toBe(0);
  });

  it("avviser lokal kontrakt som ikke er bundet til samme kunde og org", async () => {
    const { app, state } = createTestApp({
      localContractExists: true,
      contractBound: false,
    });
    const event = EVENT_CASES[5];

    const response = await signedPost(
      app,
      event.path,
      event.body,
      "provider-contract-mismatch-1",
    ).expect(404);

    expect(response.body.error).toBe("contract_not_found_for_customer");
    expect(state.eventWrites).toHaveLength(0);
  });

  it("returnerer cached respons ved replay uten nye sideeffekter", async () => {
    const { app, state } = createTestApp();
    const event = EVENT_CASES[0];

    await signedPost(app, event.path, event.body, "provider-replay-1").expect(
      200,
      { ok: true },
    );
    const replay = await signedPost(
      app,
      event.path,
      event.body,
      "provider-replay-1",
    ).expect(200);

    expect(replay.headers["idempotent-replayed"]).toBe("true");
    expect(replay.body).toEqual({ ok: true, duplicate: true });
    expect(state.eventWrites).toEqual(["email"]);
    expect(eventMocks.publishEvent).toHaveBeenCalledTimes(1);
    expect(eventMocks.emitWebhook).toHaveBeenCalledTimes(1);
  });

  it("avviser gjenbrukt delivery-ID med endret body", async () => {
    const { app, state } = createTestApp();
    const event = EVENT_CASES[0];

    await signedPost(app, event.path, event.body, "provider-conflict-1").expect(
      200,
    );
    const changedBody = { ...event.body, email_id: "mail-2" };
    const conflict = await signedPost(
      app,
      event.path,
      changedBody,
      "provider-conflict-1",
    ).expect(409);

    expect(conflict.body.error).toBe("workflow_event_delivery_id_conflict");
    expect(state.eventWrites).toEqual(["email"]);
    expect(eventMocks.publishEvent).toHaveBeenCalledTimes(1);
  });

  it("fullfører ikke delivery-claim før workflow og webhook er forsøkt", async () => {
    let releasePublish: (() => void) | undefined;
    eventMocks.publishEvent.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          releasePublish = resolve;
        }),
    );
    const { app, state } = createTestApp();
    const event = EVENT_CASES[0];

    const pendingResponse = signedPost(
      app,
      event.path,
      event.body,
      "provider-await-side-effects-1",
    ).then((response) => response);

    await vi.waitFor(() => {
      expect(eventMocks.publishEvent).toHaveBeenCalledTimes(1);
    });
    const claim = [...state.claims.values()][0];
    expect(claim.responseStatus).toBe(202);

    releasePublish?.();
    const response = await pendingResponse;

    expect(response.status).toBe(200);
    expect(claim.responseStatus).toBe(200);
    expect(eventMocks.emitWebhook).toHaveBeenCalledTimes(1);
  });
});
