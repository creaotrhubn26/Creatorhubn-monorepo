import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import {
  RealtimeUserEventFanout,
} from "../server/realtime-user-event-fanout.js";
import {
  deliverUserEventLocally,
  registerUserClientForTests,
} from "../server/realtime-user-events.js";

const role = process.env.REALTIME_TEST_ROLE;
const redisUrl = process.env.REALTIME_TEST_REDIS_URL;
const instanceId = process.env.REALTIME_TEST_INSTANCE_ID;
if (!role || !redisUrl || !instanceId || !process.send) {
  throw new Error("Realtime process fixture requires role, Redis URL, instance ID and IPC");
}

class ProcessTestSocket extends EventEmitter {
  readyState = WebSocket.OPEN;

  send(payload: string): void {
    const frame = JSON.parse(payload) as { type?: string; event?: unknown };
    if (frame.type === "user_event") {
      process.send?.({ type: "socket-event", event: frame.event });
    }
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  }

  terminate(): void {
    this.close();
  }

  ping(): void {}
}

const fanout = new RealtimeUserEventFanout({
  redisUrl,
  required: true,
  instanceId,
  onRemoteEvent: deliverUserEventLocally,
});

let cleanupSocket: (() => void) | null = null;
if (role === "socket") {
  cleanupSocket = registerUserClientForTests(
    "process-test-user",
    new ProcessTestSocket() as unknown as WebSocket,
  );
}

await fanout.start();
process.send({ type: "ready", role });

process.on("message", (message: unknown) => {
  if (!message || typeof message !== "object") return;
  const command = message as { type?: string };
  if (command.type === "publish" && role === "event") {
    void fanout.publish("process-test-user", {
      kind: "board.updated",
      projectId: "process-test-project",
      timestamp: "2026-08-26T20:00:00.000Z",
    }).then(() => {
      process.send?.({ type: "published" });
    });
  }
  if (command.type === "shutdown") {
    cleanupSocket?.();
    void fanout.close().finally(() => process.exit(0));
  }
});
