import { fork } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDirectory, "../..");
const tsxCli = path.join(repoRoot, "node_modules/tsx/dist/cli.mjs");
const workerPath = path.join(scriptDirectory, "realtime-fanout-process-worker.ts");

function encodeBulk(value) {
  const text = String(value);
  return `$${Buffer.byteLength(text)}\r\n${text}\r\n`;
}

function encodeArray(values) {
  return `*${values.length}\r\n${values.map(encodeBulk).join("")}`;
}

function parseRespArray(buffer) {
  if (buffer[0] !== 42) return null;
  const countEnd = buffer.indexOf("\r\n");
  if (countEnd < 0) return null;
  const count = Number(buffer.subarray(1, countEnd).toString());
  if (!Number.isInteger(count) || count < 0) throw new Error("Invalid RESP array");
  let offset = countEnd + 2;
  const values = [];
  for (let index = 0; index < count; index += 1) {
    if (buffer[offset] !== 36) throw new Error("Expected RESP bulk string");
    const lengthEnd = buffer.indexOf("\r\n", offset);
    if (lengthEnd < 0) return null;
    const length = Number(buffer.subarray(offset + 1, lengthEnd).toString());
    const start = lengthEnd + 2;
    const end = start + length;
    if (buffer.length < end + 2) return null;
    values.push(buffer.subarray(start, end).toString());
    offset = end + 2;
  }
  return { values, bytes: offset };
}

async function startRedisProtocolServer() {
  const subscribers = new Map();
  const server = createServer((socket) => {
    let buffered = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      buffered = Buffer.concat([buffered, chunk]);
      for (;;) {
        const parsed = parseRespArray(buffered);
        if (!parsed) break;
        buffered = buffered.subarray(parsed.bytes);
        const [rawCommand, ...args] = parsed.values;
        const command = rawCommand.toUpperCase();
        if (command === "CLIENT" || command === "SELECT") {
          socket.write("+OK\r\n");
        } else if (command === "INFO") {
          const info = "# Server\r\nredis_version:7.0.0\r\nloading:0\r\n";
          socket.write(encodeBulk(info));
        } else if (command === "SUBSCRIBE") {
          const channel = args[0];
          subscribers.set(socket, channel);
          socket.write(encodeArray(["subscribe", channel, "1"]));
        } else if (command === "PUBLISH") {
          const [channel, payload] = args;
          let delivered = 0;
          for (const [subscriber, subscribedChannel] of subscribers) {
            if (subscribedChannel === channel && !subscriber.destroyed) {
              subscriber.write(encodeArray(["message", channel, payload]));
              delivered += 1;
            }
          }
          socket.write(`:${delivered}\r\n`);
        } else if (command === "QUIT") {
          socket.end("+OK\r\n");
        } else {
          socket.write("-ERR unsupported command in test server\r\n");
        }
      }
    });
    socket.on("close", () => subscribers.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No Redis test port");
  return {
    url: `redis://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function spawnWorker(role, redisUrl) {
  return fork(tsxCli, [workerPath], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: {
      ...process.env,
      REALTIME_TEST_ROLE: role,
      REALTIME_TEST_REDIS_URL: redisUrl,
      REALTIME_TEST_INSTANCE_ID: `process-${role}`,
    },
  });
}

function waitFor(worker, expectedType, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${expectedType}`));
    }, timeoutMs);
    const onMessage = (message) => {
      if (message?.type !== expectedType) return;
      clearTimeout(timeout);
      worker.off("message", onMessage);
      resolve(message);
    };
    worker.on("message", onMessage);
    worker.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Worker exited before ${expectedType} (code ${code})`));
    });
  });
}

const redis = await startRedisProtocolServer();
const socketProcess = spawnWorker("socket", redis.url);
const eventProcess = spawnWorker("event", redis.url);
const stderr = [];
for (const worker of [socketProcess, eventProcess]) {
  worker.stderr.on("data", (chunk) => stderr.push(chunk.toString()));
}

try {
  await Promise.all([
    waitFor(socketProcess, "ready"),
    waitFor(eventProcess, "ready"),
  ]);
  const socketEvent = waitFor(socketProcess, "socket-event");
  const published = waitFor(eventProcess, "published");
  eventProcess.send({ type: "publish" });
  const [received] = await Promise.all([socketEvent, published]);
  if (
    received.event?.kind !== "board.updated" ||
    received.event?.projectId !== "process-test-project"
  ) {
    throw new Error("Socket process received the wrong event");
  }
  console.log("PASS: process B published through Redis and socket process A received it");
} catch (error) {
  if (stderr.length > 0) process.stderr.write(stderr.join(""));
  throw error;
} finally {
  socketProcess.send({ type: "shutdown" });
  eventProcess.send({ type: "shutdown" });
  await Promise.allSettled([
    new Promise((resolve) => socketProcess.once("exit", resolve)),
    new Promise((resolve) => eventProcess.once("exit", resolve)),
  ]);
  await redis.close();
}
