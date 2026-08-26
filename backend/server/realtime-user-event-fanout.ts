import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import type { UserEvent } from "../../frontend/shared/realtime-user-events-contract.js";

export const REALTIME_USER_EVENTS_CHANNEL = "creatorhub:realtime:user-events:v1";
const FANOUT_ENVELOPE_VERSION = 1 as const;
const MAX_ENVELOPE_BYTES = 256 * 1024;
const SEEN_MESSAGE_TTL_MS = 2 * 60_000;
const MAX_SEEN_MESSAGES = 10_000;

interface FanoutEnvelope {
  version: typeof FANOUT_ENVELOPE_VERSION;
  type: "user_event_fanout";
  messageId: string;
  originInstanceId: string;
  userId: string;
  event: UserEvent;
  publishedAt: string;
}

export interface RedisFanoutClient {
  status: string;
  connect(): Promise<unknown>;
  subscribe(channel: string): Promise<unknown>;
  publish(channel: string, payload: string): Promise<unknown>;
  disconnect(reconnect?: boolean): void;
  on(event: "message", listener: (channel: string, payload: string) => void): this;
  on(event: "ready" | "close" | "end", listener: () => void): this;
  on(event: "error", listener: (error: Error) => void): this;
}

export interface RealtimeUserEventFanoutHealth {
  configured: boolean;
  required: boolean;
  ready: boolean;
  instanceId: string;
}

export interface RealtimeUserEventFanoutOptions {
  redisUrl: string;
  required: boolean;
  instanceId: string;
  onRemoteEvent: (userId: string, event: UserEvent) => void;
  createClients?: () => {
    publisher: RedisFanoutClient;
    subscriber: RedisFanoutClient;
  };
  now?: () => number;
}

function parseBoolean(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? "");
}

function isUserEvent(value: unknown): value is UserEvent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.kind === "string" &&
    record.kind.length > 0 &&
    record.kind.length <= 100 &&
    typeof record.timestamp === "string" &&
    record.timestamp.length > 0
  );
}

function parseEnvelope(payload: string): FanoutEnvelope | null {
  if (Buffer.byteLength(payload, "utf8") > MAX_ENVELOPE_BYTES) return null;
  try {
    const value = JSON.parse(payload) as Partial<FanoutEnvelope>;
    if (
      value.version !== FANOUT_ENVELOPE_VERSION ||
      value.type !== "user_event_fanout" ||
      typeof value.messageId !== "string" ||
      value.messageId.length < 8 ||
      value.messageId.length > 100 ||
      typeof value.originInstanceId !== "string" ||
      value.originInstanceId.length < 1 ||
      value.originInstanceId.length > 200 ||
      typeof value.userId !== "string" ||
      value.userId.length < 1 ||
      value.userId.length > 200 ||
      typeof value.publishedAt !== "string" ||
      !isUserEvent(value.event)
    ) {
      return null;
    }
    return value as FanoutEnvelope;
  } catch {
    return null;
  }
}

function createIoredisClients(redisUrl: string): {
  publisher: RedisFanoutClient;
  subscriber: RedisFanoutClient;
} {
  const options = {
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 10_000,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt: number) => Math.min(attempt * 250, 5_000),
  };
  return {
    publisher: new Redis(redisUrl, options) as unknown as RedisFanoutClient,
    subscriber: new Redis(redisUrl, options) as unknown as RedisFanoutClient,
  };
}

export class RealtimeUserEventFanout {
  private readonly publisher: RedisFanoutClient;
  private readonly subscriber: RedisFanoutClient;
  private readonly seenMessageIds = new Map<string, number>();
  private started = false;
  private closed = false;
  private subscriberReady = false;
  private publisherReady = false;
  private lastLoggedErrorAt = 0;

  constructor(private readonly options: RealtimeUserEventFanoutOptions) {
    const clients = options.createClients?.() ?? createIoredisClients(options.redisUrl);
    this.publisher = clients.publisher;
    this.subscriber = clients.subscriber;

    this.publisher.on("ready", () => { this.publisherReady = true; });
    this.publisher.on("close", () => { this.publisherReady = false; });
    this.publisher.on("end", () => { this.publisherReady = false; });
    this.publisher.on("error", (error) => this.logRedisError(error));
    this.subscriber.on("ready", () => { this.subscriberReady = true; });
    this.subscriber.on("close", () => { this.subscriberReady = false; });
    this.subscriber.on("end", () => { this.subscriberReady = false; });
    this.subscriber.on("error", (error) => this.logRedisError(error));
    this.subscriber.on("message", (channel, payload) => {
      if (channel !== REALTIME_USER_EVENTS_CHANNEL || this.closed) return;
      this.receive(payload);
    });
  }

  async start(): Promise<void> {
    if (this.started) return;
    if (this.closed) throw new Error("Realtime fanout has already been closed");
    try {
      await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
      await this.subscriber.subscribe(REALTIME_USER_EVENTS_CHANNEL);
      this.publisherReady = this.publisher.status === "ready";
      this.subscriberReady = this.subscriber.status === "ready";
      this.started = true;
    } catch (error) {
      this.publisher.disconnect(false);
      this.subscriber.disconnect(false);
      throw new Error(
        `Could not initialize realtime Redis fanout: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  async publish(userId: string, event: UserEvent): Promise<void> {
    if (!this.started || this.closed) return;
    const now = this.options.now?.() ?? Date.now();
    const envelope: FanoutEnvelope = {
      version: FANOUT_ENVELOPE_VERSION,
      type: "user_event_fanout",
      messageId: randomUUID(),
      originInstanceId: this.options.instanceId,
      userId,
      event,
      publishedAt: new Date(now).toISOString(),
    };
    this.remember(envelope.messageId, now);
    await this.publisher.publish(REALTIME_USER_EVENTS_CHANNEL, JSON.stringify(envelope));
  }

  health(): RealtimeUserEventFanoutHealth {
    return {
      configured: true,
      required: this.options.required,
      ready: this.started && !this.closed && this.publisherReady && this.subscriberReady,
      instanceId: this.options.instanceId,
    };
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.publisherReady = false;
    this.subscriberReady = false;
    this.publisher.disconnect(false);
    this.subscriber.disconnect(false);
  }

  private receive(payload: string): void {
    const envelope = parseEnvelope(payload);
    if (!envelope || envelope.originInstanceId === this.options.instanceId) return;
    const now = this.options.now?.() ?? Date.now();
    if (this.hasSeen(envelope.messageId, now)) return;
    this.remember(envelope.messageId, now);
    this.options.onRemoteEvent(envelope.userId, envelope.event);
  }

  private hasSeen(messageId: string, now: number): boolean {
    const seenAt = this.seenMessageIds.get(messageId);
    if (seenAt === undefined) return false;
    if (now - seenAt > SEEN_MESSAGE_TTL_MS) {
      this.seenMessageIds.delete(messageId);
      return false;
    }
    return true;
  }

  private remember(messageId: string, now: number): void {
    this.seenMessageIds.set(messageId, now);
    for (const [id, seenAt] of this.seenMessageIds) {
      if (now - seenAt > SEEN_MESSAGE_TTL_MS || this.seenMessageIds.size > MAX_SEEN_MESSAGES) {
        this.seenMessageIds.delete(id);
      } else {
        break;
      }
    }
  }

  private logRedisError(error: Error): void {
    const now = Date.now();
    if (now - this.lastLoggedErrorAt < 30_000) return;
    this.lastLoggedErrorAt = now;
    console.error("[realtime-fanout] Redis error:", error.message);
  }
}

let activeFanout: RealtimeUserEventFanout | null = null;
let configuredRequired = false;
let configuredInstanceId = process.env.RENDER_INSTANCE_ID ?? `local-${randomUUID()}`;

export async function initializeRealtimeUserEventFanout(
  onRemoteEvent: (userId: string, event: UserEvent) => void,
): Promise<RealtimeUserEventFanout | null> {
  const redisUrl = process.env.REALTIME_REDIS_URL?.trim() ?? "";
  const required = parseBoolean(process.env.REALTIME_DISTRIBUTED_FANOUT_REQUIRED);
  const instanceId = process.env.RENDER_INSTANCE_ID?.trim() || configuredInstanceId;
  configuredRequired = required;
  configuredInstanceId = instanceId;

  if (!redisUrl) {
    if (required) {
      throw new Error(
        "REALTIME_REDIS_URL is required when REALTIME_DISTRIBUTED_FANOUT_REQUIRED=true",
      );
    }
    return null;
  }

  const fanout = new RealtimeUserEventFanout({
    redisUrl,
    required,
    instanceId,
    onRemoteEvent,
  });
  await fanout.start();
  activeFanout = fanout;
  console.log(`[realtime-fanout] Redis pub/sub ready for instance ${instanceId}`);
  return fanout;
}

export async function publishRealtimeUserEvent(
  userId: string,
  event: UserEvent,
): Promise<void> {
  await activeFanout?.publish(userId, event);
}

export function getRealtimeUserEventFanoutHealth(): RealtimeUserEventFanoutHealth {
  return activeFanout?.health() ?? {
    configured: false,
    required: configuredRequired,
    ready: false,
    instanceId: configuredInstanceId,
  };
}

export async function closeRealtimeUserEventFanout(): Promise<void> {
  const fanout = activeFanout;
  activeFanout = null;
  await fanout?.close();
}
