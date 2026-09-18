/**
 * Tests the new `broadcastLeadCreated` helper + SSE-event payload-shape
 * iPad expects for pulse-animasjon på nye pins.
 *
 * Vi tester den rene routing-laget — emit() driver alle klienter
 * basert på channel-match. Vi spy-er på singleton-instance for
 * å fange emit-calls uten å åpne en ekte WebSocket-server.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import {
  LeadgridRealtimeConnectionLimiter,
  LeadgridRealtimeServer,
  LEADGRID_REALTIME_AUTHORIZATION_FRESHNESS_MS,
  LEADGRID_REALTIME_CLOSE_GRACE_MS,
  LEADGRID_REALTIME_MAX_BUFFERED_AMOUNT_BYTES,
  LEADGRID_REALTIME_MAX_CHANNELS,
  LEADGRID_REALTIME_MAX_PENDING_MESSAGES,
  leadgridRealtime,
  broadcastFollowupDue,
  broadcastLeadCreated,
  broadcastRecommendation,
} from "./leadgrid-realtime";

describe("broadcastLeadCreated", () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Stub ut emit på singleton — vi vil bare verifisere call-args.
    spy = vi.spyOn(leadgridRealtime, "emit").mockImplementation(() => {});
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("emitter bare kanonisk org-kanal når både org- og bruker-id er gitt", () => {
    broadcastLeadCreated("org-1", "user-1", {
      lead_id: "lead-abc",
      organization_id: "forged-org",
      source: "batch",
      batch_id: "batch-xyz",
      latitude: 60.1,
      longitude: 11.0,
      name: "Acme AS",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const first = spy.mock.calls[0]![0] as {
      type: string;
      channel: string;
      data: Record<string, unknown>;
    };
    expect(first.channel).toBe("org:org-1");
    expect(first.type).toBe("lead.created");
    expect(first.data.organization_id).toBe("org-1");
  });

  it("failer lukket når orgId er null selv om bruker-id matcher", () => {
    broadcastLeadCreated(null, "user-1", {
      lead_id: "lead-abc",
      source: "manual",
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it("dropper user-kanal når userId er null (org-wide broadcast fra cron)", () => {
    broadcastLeadCreated("org-1", null, {
      lead_id: "lead-abc",
      source: "discovery",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const evt = spy.mock.calls[0]![0] as { channel: string };
    expect(evt.channel).toBe("org:org-1");
  });

  it("sender tenantbundet anbefaling bare på kanonisk org-kanal", () => {
    broadcastRecommendation("org-1", "assigned-user", {
      lead_id: "lead-abc",
      organization_id: "forged-org",
    });

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      type: "recommendation.created",
      channel: "org:org-1",
      data: { lead_id: "lead-abc", organization_id: "org-1" },
    });
  });

  it("krever kanonisk org for follow-up og faller aldri tilbake til user-kanal", () => {
    broadcastFollowupDue("assigned-user", { lead_id: "lead-abc" });
    expect(spy).not.toHaveBeenCalled();

    broadcastFollowupDue("assigned-user", {
      lead_id: "lead-abc",
      organization_id: "org-1",
    });
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0]?.[0]).toMatchObject({
      type: "followup.due",
      channel: "org:org-1",
      data: {
        lead_id: "lead-abc",
        organization_id: "org-1",
        assigned_user_id: "assigned-user",
      },
    });
  });

  it("propagerer alle data-felt til payload — iPad bruker disse for pulse-state", () => {
    broadcastLeadCreated("org-1", null, {
      lead_id: "lead-abc",
      organization_id: "org-1",
      project_id: "proj-1",
      name: "Acme AS",
      latitude: 60.1,
      longitude: 11.0,
      source: "batch",
      batch_id: "batch-xyz",
      confidence: "exact",
    });

    const evt = spy.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(evt.data.lead_id).toBe("lead-abc");
    expect(evt.data.organization_id).toBe("org-1");
    expect(evt.data.project_id).toBe("proj-1");
    expect(evt.data.source).toBe("batch");
    expect(evt.data.batch_id).toBe("batch-xyz");
    expect(evt.data.confidence).toBe("exact");
    expect(evt.data.latitude).toBe(60.1);
    expect(evt.data.longitude).toBe(11.0);
    expect(evt.data.name).toBe("Acme AS");
  });

  it("emitter ingenting når begge org-id og user-id er null", () => {
    broadcastLeadCreated(null, null, {
      lead_id: "lead-abc",
      source: "manual",
    });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("Leadgrid realtime tenant delivery", () => {
  type TestClient = {
    ws: {
      readyState: number;
      bufferedAmount?: number;
      send: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };
    token: string;
    userId: string;
    channels: Set<string>;
    lastPing: number;
    lastValidatedAt: number;
    validating: boolean;
    messageQueue: Promise<void>;
    pendingMessages: number;
    releaseConnection?: ReturnType<typeof vi.fn>;
  };

  const clients = (leadgridRealtime as unknown as { clients: Set<TestClient> })
    .clients;

  afterEach(() => {
    clients.clear();
  });

  it.each(["membership_removed", "organization_suspended"])(
    "does not deliver lead data over a stale user channel after %s",
    (membershipState) => {
      const send = vi.fn();
      const close = vi.fn();
      const userId = `user-${membershipState}`;
      clients.add({
        ws: { readyState: 1, send, close },
        token: "stale-token",
        userId,
        channels: new Set([`user:${userId}`]),
        lastPing: Date.now(),
        lastValidatedAt: Date.now(),
        validating: false,
        messageQueue: Promise.resolve(),
        pendingMessages: 0,
      });

      leadgridRealtime.emit({
        type: "lead.created",
        channel: `user:${userId}`,
        data: {
          lead_id: "tenant-lead",
          organization_id: "org-revoked",
          membership_state: membershipState,
        },
      });

      expect(send).not.toHaveBeenCalled();
    },
  );

  it("preserves delivery to an authorized org channel", () => {
    const send = vi.fn();
    const close = vi.fn();
    const channel = "org:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    clients.add({
      ws: { readyState: 1, send, close },
      token: "active-token",
      userId: "active-user",
      channels: new Set([channel]),
      lastPing: Date.now(),
      lastValidatedAt: Date.now(),
      validating: false,
      messageQueue: Promise.resolve(),
      pendingMessages: 0,
    });

    leadgridRealtime.emit({
      type: "lead.created",
      channel,
      data: {
        lead_id: "lead-1",
        organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    });

    expect(send).toHaveBeenCalledOnce();
    expect(JSON.parse(String(send.mock.calls[0]?.[0]))).toMatchObject({
      type: "lead.created",
      channel,
      data: {
        lead_id: "lead-1",
        organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
    });
  });

  it("keeps a slow CLOSING socket reserved until terminate fallback tears it down", () => {
    vi.useFakeTimers();
    try {
      const limiter = new LeadgridRealtimeConnectionLimiter({
        global: 1,
        perToken: 1,
        perUser: 1,
        perRemotePeer: 1,
      });
      const reservationResult = limiter.reserve("slow-token", "203.0.113.70");
      expect(reservationResult.allowed).toBe(true);
      if (!reservationResult.allowed) throw new Error("reservation_failed");
      expect(reservationResult.reservation.associateUser("slow-user")).toEqual({
        allowed: true,
      });

      const server = new LeadgridRealtimeServer({
        connectionLimiter: limiter,
      });
      const send = vi.fn();
      const releaseConnection = vi.fn(reservationResult.reservation.release);
      const channel = "org:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
      const ws = Object.assign(new EventEmitter(), {
        readyState: WebSocket.OPEN,
        bufferedAmount: LEADGRID_REALTIME_MAX_BUFFERED_AMOUNT_BYTES,
        send,
        close: vi.fn(),
        terminate: vi.fn(),
      });
      ws.close.mockImplementation(() => {
        ws.readyState = WebSocket.CLOSING;
      });
      ws.terminate.mockImplementation(() => {
        ws.readyState = WebSocket.CLOSED;
      });
      const client: TestClient = {
        ws,
        token: "slow-token",
        userId: "slow-user",
        channels: new Set([channel]),
        lastPing: Date.now(),
        lastValidatedAt: Date.now(),
        validating: false,
        messageQueue: Promise.resolve(),
        pendingMessages: 0,
        releaseConnection,
      };
      const internals = server as unknown as {
        clients: Set<TestClient>;
        releaseClient: (target: TestClient) => void;
      };
      internals.clients.add(client);
      ws.on("close", () => internals.releaseClient(client));

      server.emit({
        type: "lead.created",
        channel,
        data: { lead_id: "slow" },
      });

      expect(send).not.toHaveBeenCalled();
      expect(ws.close).toHaveBeenCalledWith(1008, "outbound_backpressure");
      expect(ws.readyState).toBe(WebSocket.CLOSING);
      expect(releaseConnection).not.toHaveBeenCalled();
      expect(limiter.snapshot().active).toBe(1);
      expect(limiter.reserve("new-token", "203.0.113.71")).toEqual({
        allowed: false,
        scope: "global",
      });

      vi.advanceTimersByTime(LEADGRID_REALTIME_CLOSE_GRACE_MS);

      expect(ws.terminate).toHaveBeenCalledOnce();
      expect(releaseConnection).toHaveBeenCalledOnce();
      expect(limiter.snapshot().active).toBe(0);
      expect(internals.clients.has(client)).toBe(false);
      const replacement = limiter.reserve("new-token", "203.0.113.71");
      expect(replacement.allowed).toBe(true);
      if (replacement.allowed) replacement.reservation.release();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the same prospective backpressure guard for heartbeat payloads", () => {
    const server = new LeadgridRealtimeServer();
    const send = vi.fn();
    const ws = {
      readyState: WebSocket.OPEN,
      bufferedAmount: LEADGRID_REALTIME_MAX_BUFFERED_AMOUNT_BYTES - 1,
      send,
      close: vi.fn(() => {
        ws.readyState = WebSocket.CLOSED;
      }),
    };
    const client: TestClient = {
      ws,
      token: "ping-token",
      userId: "ping-user",
      channels: new Set(),
      lastPing: Date.now(),
      lastValidatedAt: Date.now(),
      validating: false,
      messageQueue: Promise.resolve(),
      pendingMessages: 0,
    };
    const internals = server as unknown as {
      clients: Set<TestClient>;
      sendClientPayload: (target: TestClient, payload: string) => boolean;
    };
    internals.clients.add(client);

    expect(
      internals.sendClientPayload(client, JSON.stringify({ type: "ping" })),
    ).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(ws.close).toHaveBeenCalledWith(1008, "outbound_backpressure");
  });

  it("drops stale org delivery and starts only one authorization refresh", () => {
    const server = new LeadgridRealtimeServer();
    const channel = "org:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const send = vi.fn();
    const close = vi.fn();
    const client: TestClient = {
      ws: { readyState: 1, send, close },
      token: "stale-org-token",
      userId: "stale-org-user",
      channels: new Set([channel]),
      lastPing: Date.now(),
      lastValidatedAt:
        Date.now() - LEADGRID_REALTIME_AUTHORIZATION_FRESHNESS_MS - 1,
      validating: false,
      messageQueue: Promise.resolve(),
      pendingMessages: 0,
    };
    const internals = server as unknown as {
      clients: Set<TestClient>;
      authorizationContext: {
        pool: unknown;
        activeSessions: Map<string, { userId: string }>;
      };
      revalidateClient: ReturnType<typeof vi.fn>;
    };
    internals.clients.add(client);
    internals.authorizationContext = {
      pool: {},
      activeSessions: new Map([[client.token, { userId: client.userId }]]),
    };
    internals.revalidateClient = vi.fn(async () => {
      client.validating = true;
    });

    server.emit({ type: "lead.created", channel, data: { lead_id: "one" } });
    server.emit({ type: "lead.created", channel, data: { lead_id: "two" } });

    expect(send).not.toHaveBeenCalled();
    expect(internals.revalidateClient).toHaveBeenCalledOnce();
  });

  it("rejects an oversized channel list before any authorization checks", async () => {
    const server = new LeadgridRealtimeServer();
    const send = vi.fn();
    const client: TestClient = {
      ws: { readyState: 1, send, close: vi.fn() },
      token: "bounded-token",
      userId: "bounded-user",
      channels: new Set(),
      lastPing: Date.now(),
      lastValidatedAt: Date.now(),
      validating: false,
      messageQueue: Promise.resolve(),
      pendingMessages: 0,
    };
    const canSubscribe = vi.fn(async () => true);
    const internals = server as unknown as {
      canSubscribe: typeof canSubscribe;
      enqueueClientMessage: (
        pool: unknown,
        target: TestClient,
        raw: Buffer,
      ) => void;
    };
    internals.canSubscribe = canSubscribe;
    const channels = Array.from(
      { length: LEADGRID_REALTIME_MAX_CHANNELS + 1 },
      (_, index) =>
        `org:11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    );

    internals.enqueueClientMessage(
      {},
      client,
      Buffer.from(JSON.stringify({ type: "subscribe", channels })),
    );
    await client.messageQueue;

    expect(canSubscribe).not.toHaveBeenCalled();
    expect(client.channels.size).toBe(0);
    expect(JSON.parse(String(send.mock.calls[0]?.[0]))).toMatchObject({
      type: "error",
      code: "channel_limit_exceeded",
      maxChannels: LEADGRID_REALTIME_MAX_CHANNELS,
    });
  });

  it("serializes duplicate subscribe bursts and performs one DB check", async () => {
    const server = new LeadgridRealtimeServer();
    const channel = "org:cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const send = vi.fn();
    const client: TestClient = {
      ws: { readyState: 1, send, close: vi.fn() },
      token: "serialized-token",
      userId: "serialized-user",
      channels: new Set(),
      lastPing: Date.now(),
      lastValidatedAt: Date.now(),
      validating: false,
      messageQueue: Promise.resolve(),
      pendingMessages: 0,
    };
    let resolveAuthorization!: (allowed: boolean) => void;
    const authorization = new Promise<boolean>((resolve) => {
      resolveAuthorization = resolve;
    });
    const canSubscribe = vi.fn(() => authorization);
    const internals = server as unknown as {
      canSubscribe: typeof canSubscribe;
      enqueueClientMessage: (
        pool: unknown,
        target: TestClient,
        raw: Buffer,
      ) => void;
    };
    internals.canSubscribe = canSubscribe;
    const raw = Buffer.from(
      JSON.stringify({ type: "subscribe", channels: [channel, channel] }),
    );

    internals.enqueueClientMessage({}, client, raw);
    internals.enqueueClientMessage({}, client, raw);
    await vi.waitFor(() => expect(canSubscribe).toHaveBeenCalledOnce());
    expect(client.pendingMessages).toBe(2);
    resolveAuthorization(true);
    await client.messageQueue;

    expect(canSubscribe).toHaveBeenCalledOnce();
    expect(client.channels).toEqual(new Set([channel]));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("closes a socket when its serialized message queue exceeds the bound", async () => {
    const server = new LeadgridRealtimeServer();
    const channel = "org:dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const send = vi.fn();
    const ws = {
      readyState: 1,
      send,
      close: vi.fn(() => {
        ws.readyState = 3;
      }),
    };
    const client: TestClient = {
      ws,
      token: "burst-token",
      userId: "burst-user",
      channels: new Set(),
      lastPing: Date.now(),
      lastValidatedAt: Date.now(),
      validating: false,
      messageQueue: Promise.resolve(),
      pendingMessages: 0,
    };
    let resolveAuthorization!: (allowed: boolean) => void;
    const authorization = new Promise<boolean>((resolve) => {
      resolveAuthorization = resolve;
    });
    const internals = server as unknown as {
      canSubscribe: () => Promise<boolean>;
      enqueueClientMessage: (
        pool: unknown,
        target: TestClient,
        raw: Buffer,
      ) => void;
    };
    internals.canSubscribe = () => authorization;
    const raw = Buffer.from(
      JSON.stringify({ type: "subscribe", channels: [channel] }),
    );

    for (
      let index = 0;
      index <= LEADGRID_REALTIME_MAX_PENDING_MESSAGES;
      index += 1
    ) {
      internals.enqueueClientMessage({}, client, raw);
    }

    expect(ws.close).toHaveBeenCalledWith(1008, "message_backpressure");
    resolveAuthorization(false);
    await client.messageQueue;
  });
});
