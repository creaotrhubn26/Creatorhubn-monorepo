import { afterEach, describe, expect, it } from "vitest";
import {
  closeRealtimeUserEventFanout,
  initializeRealtimeUserEventFanout,
  REALTIME_USER_EVENTS_CHANNEL,
  RealtimeUserEventFanout,
  type RedisFanoutClient,
} from "./realtime-user-event-fanout";

type Listener = (...args: never[]) => void;

class FakeRedisBus {
  readonly subscribers = new Set<FakeRedisClient>();
  duplicateDeliveries = false;

  async publish(channel: string, payload: string): Promise<number> {
    for (const subscriber of this.subscribers) {
      subscriber.emit("message", channel, payload);
      if (this.duplicateDeliveries) {
        subscriber.emit("message", channel, payload);
      }
    }
    return this.subscribers.size;
  }
}

class FakeRedisClient implements RedisFanoutClient {
  status = "wait";
  private readonly listeners = new Map<string, Listener[]>();

  constructor(
    private readonly bus: FakeRedisBus,
    private readonly failConnect = false,
  ) {}

  async connect(): Promise<void> {
    if (this.failConnect) throw new Error("connection refused");
    this.status = "ready";
    this.emit("ready");
  }

  async subscribe(channel: string): Promise<number> {
    expect(channel).toBe(REALTIME_USER_EVENTS_CHANNEL);
    this.bus.subscribers.add(this);
    return 1;
  }

  async publish(channel: string, payload: string): Promise<number> {
    return this.bus.publish(channel, payload);
  }

  disconnect(): void {
    this.status = "end";
    this.bus.subscribers.delete(this);
    this.emit("end");
  }

  on(event: string, listener: Listener): this {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  emit(event: string, ...args: never[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }
}

function clientPair(bus: FakeRedisBus, failConnect = false) {
  return {
    publisher: new FakeRedisClient(bus, failConnect),
    subscriber: new FakeRedisClient(bus, failConnect),
  };
}

describe("realtime Redis user-event fanout", () => {
  const originalRedisUrl = process.env.REALTIME_REDIS_URL;
  const originalRequired = process.env.REALTIME_DISTRIBUTED_FANOUT_REQUIRED;

  afterEach(async () => {
    await closeRealtimeUserEventFanout();
    if (originalRedisUrl === undefined) delete process.env.REALTIME_REDIS_URL;
    else process.env.REALTIME_REDIS_URL = originalRedisUrl;
    if (originalRequired === undefined) {
      delete process.env.REALTIME_DISTRIBUTED_FANOUT_REQUIRED;
    } else {
      process.env.REALTIME_DISTRIBUTED_FANOUT_REQUIRED = originalRequired;
    }
  });

  it("delivers an event from process B to process A exactly once", async () => {
    const bus = new FakeRedisBus();
    bus.duplicateDeliveries = true;
    const receivedByA: unknown[] = [];
    const receivedByB: unknown[] = [];
    const processA = new RealtimeUserEventFanout({
      redisUrl: "redis://fake",
      required: true,
      instanceId: "process-a",
      onRemoteEvent: (userId, event) => receivedByA.push({ userId, event }),
      createClients: () => clientPair(bus),
    });
    const processB = new RealtimeUserEventFanout({
      redisUrl: "redis://fake",
      required: true,
      instanceId: "process-b",
      onRemoteEvent: (userId, event) => receivedByB.push({ userId, event }),
      createClients: () => clientPair(bus),
    });
    await Promise.all([processA.start(), processB.start()]);

    const event = {
      kind: "board.updated" as const,
      projectId: "project-1",
      timestamp: "2026-08-26T20:00:00.000Z",
    };
    await processB.publish("user-1", event);

    expect(receivedByA).toEqual([{ userId: "user-1", event }]);
    expect(receivedByB).toEqual([]);
    expect(processA.health()).toMatchObject({ configured: true, required: true, ready: true });
    await Promise.all([processA.close(), processB.close()]);
  });

  it("fails closed when distributed fanout is required without a URL", async () => {
    delete process.env.REALTIME_REDIS_URL;
    process.env.REALTIME_DISTRIBUTED_FANOUT_REQUIRED = "true";
    await expect(initializeRealtimeUserEventFanout(() => {})).rejects.toThrow(
      "REALTIME_REDIS_URL is required",
    );
  });

  it("fails startup when Redis cannot be reached", async () => {
    const bus = new FakeRedisBus();
    const fanout = new RealtimeUserEventFanout({
      redisUrl: "redis://fake",
      required: true,
      instanceId: "process-a",
      onRemoteEvent: () => {},
      createClients: () => clientPair(bus, true),
    });
    await expect(fanout.start()).rejects.toThrow("Could not initialize realtime Redis fanout");
    expect(fanout.health().ready).toBe(false);
  });
});
