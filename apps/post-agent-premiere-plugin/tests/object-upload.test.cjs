"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { hashFileSha256, uploadFileObjectStorage } = require("../object-upload");
const { Sha256, sha256Hex } = require("../sha256");

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

function putResponse(etag = '"etag-1"') {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "etag" ? etag : null },
  };
}

test("incremental SHA-256 matches standard vectors and arbitrary chunk boundaries", () => {
  assert.equal(sha256Hex(new Uint8Array()), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  const abc = new TextEncoder().encode("abc");
  assert.equal(sha256Hex(abc), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const split = new Sha256().update(abc.subarray(0, 1)).update(abc.subarray(1)).digestHex();
  assert.equal(split, sha256Hex(abc));
});

test("hashes a native export incrementally without loading it through File.read", async () => {
  const bytes = new Uint8Array(9 * 1024 * 1024 + 7).fill(13);
  const progress = [];
  const checksum = await hashFileSha256({
    nativePath: "/tmp/review.mp4",
    sizeBytes: bytes.length,
    fsApi: memoryFs(bytes),
    onProgress: (value) => progress.push(value),
  });
  assert.equal(checksum, sha256Hex(bytes));
  assert.equal(progress.at(-1).percent, 100);
  assert.ok(progress.length >= 2);
});

test("hashes through UXP File.read when Premiere exposes but does not implement fs.open", async () => {
  const bytes = new Uint8Array([3, 1, 4, 1, 5, 9]);
  const checksum = await hashFileSha256({
    nativePath: "/tmp/review.mp4",
    sizeBytes: bytes.length,
    fsApi: { open: async () => { throw new Error("Unimplemented method: open"); }, read: async () => null },
    file: { isFile: true, read: async () => bytes.buffer.slice(0) },
    binaryFormat: Symbol("binary"),
  });
  assert.equal(checksum, sha256Hex(bytes));
});

test("uploads and completes a checksum-verified single S3 object", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const checksumSha256 = sha256Hex(bytes);
  const calls = [];
  let completed = null;
  const result = await uploadFileObjectStorage({
    ticket: {
      objectId: "object-1",
      versionId: "version-1",
      protocol: "s3",
      uploadUrl: "https://bucket.s3.eu-north-1.amazonaws.com/key?signature=opaque",
      requiredHeaders: {
        "content-type": "video/mp4",
        "x-amz-sdk-checksum-algorithm": "SHA256",
        "x-amz-checksum-sha256": "opaque",
      },
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
    nativePath: "/tmp/review.mp4",
    sizeBytes: bytes.length,
    checksumSha256,
    fsApi: memoryFs(bytes),
    fetchImpl: async (url, init) => { calls.push({ url, init }); return putResponse(); },
    complete: async (parts) => { completed = parts; },
  });

  assert.equal(result.complete, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.method, "PUT");
  assert.equal(calls[0].init.headers["x-amz-sdk-checksum-algorithm"], "SHA256");
  assert.equal(calls[0].init.body.byteLength, bytes.length);
  assert.deepEqual(completed, []);
});

test("uploads S3 multipart through the real Premiere 26.5 File.read compatibility path", async () => {
  const partSize = 5 * 1024 * 1024;
  const bytes = new Uint8Array(partSize + 2).fill(8);
  bytes[partSize] = 0;
  bytes[partSize + 1] = 9;
  let completed = null;
  const uploads = [];
  await uploadFileObjectStorage({
    ticket: {
      objectId: "object-uxp",
      versionId: "version-uxp",
      protocol: "s3-multipart",
      partSize,
      partCount: 2,
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
    nativePath: "/tmp/review.mp4",
    sizeBytes: bytes.length,
    checksumSha256: sha256Hex(bytes),
    fsApi: { open: async () => { throw new Error("Unimplemented method: open"); }, read: async () => null },
    file: { isFile: true, read: async () => bytes.buffer.slice(0) },
    binaryFormat: Symbol("binary"),
    status: async () => ({ uploadedParts: [] }),
    signParts: async ([part]) => ({ parts: [{
      partNumber: part.partNumber,
      uploadUrl: `https://bucket.s3.eu-north-1.amazonaws.com/key?partNumber=${part.partNumber}`,
      requiredHeaders: { "x-amz-checksum-sha256": "opaque" },
    }] }),
    fetchImpl: async (_url, init) => {
      uploads.push(new Uint8Array(init.body));
      return putResponse(`"etag-${uploads.length}"`);
    },
    complete: async (parts) => { completed = parts; },
  });

  assert.equal(uploads[0].byteLength, partSize);
  assert.deepEqual(uploads[1], new Uint8Array([0, 9]));
  assert.equal(completed.length, 2);
});

test("resumes multipart from verified remote parts and uploads only missing data", async () => {
  const partSize = 5 * 1024 * 1024;
  const bytes = new Uint8Array(partSize + 3).fill(7);
  const firstChecksum = sha256Hex(bytes.subarray(0, partSize));
  const secondChecksum = sha256Hex(bytes.subarray(partSize));
  const signed = [];
  const uploads = [];
  let completed = null;
  const result = await uploadFileObjectStorage({
    ticket: {
      objectId: "object-1",
      versionId: "version-1",
      protocol: "s3-multipart",
      partSize,
      partCount: 2,
      expiresAt: "2099-01-01T00:00:00.000Z",
    },
    nativePath: "/tmp/review.mp4",
    sizeBytes: bytes.length,
    checksumSha256: sha256Hex(bytes),
    fsApi: memoryFs(bytes),
    status: async () => ({
      uploadedParts: [{ partNumber: 1, etag: '"existing"', checksumSha256: firstChecksum, sizeBytes: partSize }],
    }),
    signParts: async (parts) => {
      signed.push(parts);
      return { parts: [{
        partNumber: 2,
        uploadUrl: "https://bucket.s3.eu-north-1.amazonaws.com/key?partNumber=2",
        requiredHeaders: { "x-amz-checksum-sha256": "opaque" },
      }] };
    },
    fetchImpl: async (url, init) => { uploads.push({ url, init }); return putResponse('"new"'); },
    complete: async (parts) => { completed = parts; },
  });

  assert.equal(result.complete, true);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].init.body.byteLength, 3);
  assert.deepEqual(signed, [[{ partNumber: 2, checksumSha256: secondChecksum }]]);
  assert.deepEqual(completed, [
    { partNumber: 1, etag: '"existing"', checksumSha256: firstChecksum },
    { partNumber: 2, etag: '"new"', checksumSha256: secondChecksum },
  ]);
});
