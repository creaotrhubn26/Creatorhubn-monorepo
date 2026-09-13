"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ApiError, createApiClient } = require("../api-client");

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  };
}

test("uses the Premiere marker endpoint with bearer auth and encoded ids", async () => {
  const calls = [];
  const client = createApiClient({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, { markers: [] });
    },
  });
  await client.fetchMarkers("secret-token", "project/one", "version two");
  assert.match(calls[0].url, /project%2Fone\/video-marker-sync\/premiere\?versionId=version%20two$/);
  assert.equal(calls[0].init.headers.Authorization, "Bearer secret-token");
  assert.equal(calls[0].init.credentials, "omit");
});

test("push payload matches the backend versionId and markers contract", async () => {
  const calls = [];
  const client = createApiClient({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, { imported: 1, revision: 4 });
    },
  });
  const markers = [{
    id: "premiere-native:abc",
    timecodeSec: 7.25,
    title: "Fiks klipp",
    note: "To frames for sent",
    color: "Red",
    mustFix: true,
  }];
  const result = await client.pushMarkers("token", "project-id", "version-id", markers);
  assert.match(calls[0].url, /\/api\/projects\/project-id\/video-marker-sync\/premiere$/);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].init.body), { versionId: "version-id", markers });
  assert.deepEqual(result, { imported: 1, revision: 4 });
});

test("pairing accepts pending 202 responses", async () => {
  const client = createApiClient({ fetchImpl: async () => response(202, { status: "pending" }) });
  assert.deepEqual(await client.pollPairing("ABC123"), { status: "pending" });
});

test("surfaces structured API failures without including credentials", async () => {
  const client = createApiClient({ fetchImpl: async () => response(401, { error: "post_agent_token_revoked" }) });
  await assert.rejects(
    () => client.listProjects("do-not-log-me"),
    (error) => error instanceof ApiError && error.status === 401 && !error.message.includes("do-not-log-me"),
  );
});

test("review console reads one exact version and writes collaboration actions", async () => {
  const calls = [];
  const client = createApiClient({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, { ok: true });
    },
  });

  await client.fetchCollaboration("token", "project/one", "version two", "dialog søk");
  await client.createComment("token", "project/one", "version two", {
    timecodeSec: 8.5,
    comment: "Bytt klipp",
    priority: "must-fix",
  });
  await client.updateTask("token", "project/one", "task/one", { status: "done" });

  assert.match(calls[0].url, /project%2Fone\/video-collaboration\?versionId=version\+two&q=dialog\+s%C3%B8k$/);
  assert.equal(calls[0].init.method, "GET");
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    timecodeSec: 8.5,
    comment: "Bytt klipp",
    priority: "must-fix",
    versionId: "version two",
  });
  assert.match(calls[2].url, /video-tasks\/task%2Fone$/);
  assert.equal(calls[2].init.method, "PATCH");
  assert.equal(calls[2].init.headers.Authorization, "Bearer token");
});

test("live review uses optimistic revision updates and an explicit DELETE to end", async () => {
  const calls = [];
  const client = createApiClient({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, { ok: true });
    },
  });

  await client.updateLiveReview("token", "project", "session", { revision: 4, playheadSec: 9, isPlaying: false });
  await client.endLiveReview("token", "project", "session");

  assert.equal(calls[0].init.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[0].init.body), { revision: 4, playheadSec: 9, isPlaying: false });
  assert.equal(calls[1].init.method, "DELETE");
  assert.equal(calls[1].init.body, undefined);
});

test("publishing provisions, retries and polls one project-scoped Stream version", async () => {
  const calls = [];
  const client = createApiClient({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, { ready: false });
    },
  });

  await client.provisionVideoVersionTus("token", "project/one", { fileName: "cut.mp4", sizeBytes: 42 });
  await client.retryVideoVersionTus("token", "project/one", "version/two", { expectedStreamUid: "stream-1" });
  await client.fetchVideoVersionStreamStatus("token", "project/one", "version/two");

  assert.match(calls[0].url, /project%2Fone\/video-versions\/tus$/);
  assert.match(calls[1].url, /project%2Fone\/video-versions\/version%2Ftwo\/tus-retry$/);
  assert.match(calls[2].url, /project%2Fone\/video-versions\/version%2Ftwo\/stream-status$/);
  assert.deepEqual(calls.map(({ init }) => init.method), ["POST", "POST", "GET"]);
  assert.equal(calls[2].init.headers.Authorization, "Bearer token");
});
