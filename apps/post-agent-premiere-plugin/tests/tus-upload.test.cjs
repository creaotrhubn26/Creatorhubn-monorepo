"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { TusUploadError, uploadFileTus } = require("../tus-upload");

const chunkSize = 5 * 1024 * 1024;

function ticket(change) {
  return {
    uid: "stream-1",
    versionId: "version-1",
    uploadUrl: "https://upload.videodelivery.net/tus/one",
    protocol: "tus",
    chunkSize,
    expiresAt: "2099-01-01T00:00:00.000Z",
    ...change,
  };
}

function response(status, offset) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name.toLowerCase() === "upload-offset" ? String(offset) : null },
  };
}

function memoryFs(bytes) {
  return {
    open: async () => 7,
    read: async (_fd, buffer, offset, length, position) => {
      const available = Math.min(length, bytes.length - position);
      new Uint8Array(buffer, offset, available).set(bytes.subarray(position, position + available));
      return { bytesRead: available, buffer };
    },
    close: async () => 0,
  };
}

test("resumes from Cloudflare's authoritative offset and uploads only remaining bytes", async () => {
  const bytes = new Uint8Array(chunkSize + 11).fill(9);
  let remoteOffset = chunkSize;
  const calls = [];
  const progress = [];
  const result = await uploadFileTus({
    ticket: ticket(),
    nativePath: "/tmp/review.mp4",
    sizeBytes: bytes.length,
    fsApi: memoryFs(bytes),
    fetchImpl: async (_url, init) => {
      calls.push(init);
      if (init.method === "HEAD") return response(200, remoteOffset);
      assert.equal(init.headers["Upload-Offset"], String(chunkSize));
      assert.equal(init.body.byteLength, 11);
      remoteOffset += init.body.byteLength;
      return response(204, remoteOffset);
    },
    onProgress: (value) => progress.push(value),
  });

  assert.deepEqual(result, { offset: bytes.length, sizeBytes: bytes.length, complete: true });
  assert.deepEqual(calls.map((call) => call.method), ["HEAD", "PATCH"]);
  assert.equal(progress.at(-1).percent, 100);
});

test("recovers a lost PATCH response with HEAD without duplicating video bytes", async () => {
  const bytes = new Uint8Array(chunkSize).fill(4);
  let remoteOffset = 0;
  let patchCount = 0;
  const result = await uploadFileTus({
    ticket: ticket(),
    nativePath: "/tmp/review.mp4",
    sizeBytes: bytes.length,
    fsApi: memoryFs(bytes),
    fetchImpl: async (_url, init) => {
      if (init.method === "HEAD") return response(200, remoteOffset);
      patchCount += 1;
      remoteOffset += init.body.byteLength;
      throw new Error("connection reset after upload");
    },
  });

  assert.equal(result.complete, true);
  assert.equal(patchCount, 1);
  assert.equal(remoteOffset, bytes.length);
});

test("uploads TUS through the Premiere File.read compatibility path", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  let remoteOffset = 0;
  const result = await uploadFileTus({
    ticket: ticket({ chunkSize: 5 * 1024 * 1024 }),
    nativePath: "/tmp/review.mp4",
    sizeBytes: bytes.length,
    fsApi: { open: async () => { throw new Error("Unimplemented method: open"); }, read: async () => null },
    file: { isFile: true, read: async () => bytes.buffer.slice(0) },
    binaryFormat: Symbol("binary"),
    fetchImpl: async (_url, init) => {
      if (init.method === "HEAD") return response(200, remoteOffset);
      remoteOffset += init.body.byteLength;
      return response(204, remoteOffset);
    },
  });
  assert.equal(result.complete, true);
  assert.equal(remoteOffset, bytes.length);
});

test("rejects expired tickets before opening the local export", async () => {
  let opened = false;
  await assert.rejects(
    () => uploadFileTus({
      ticket: ticket({ expiresAt: "2020-01-01T00:00:00.000Z" }),
      nativePath: "/tmp/review.mp4",
      sizeBytes: 10,
      fsApi: { open: async () => { opened = true; }, read: async () => null },
      fetchImpl: async () => response(200, 0),
    }),
    (error) => error instanceof TusUploadError && error.code === "ticket_expired",
  );
  assert.equal(opened, false);
});
