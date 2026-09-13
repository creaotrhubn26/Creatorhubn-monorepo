"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildExportFileName,
  contentTypeForExtension,
  maxStreamDurationSeconds,
  publishErrorMessage,
  validateUploadTicket,
} = require("../publish-core");

const validTicket = {
  uid: "stream-1",
  versionId: "version-1",
  versionNumber: 2,
  uploadUrl: "https://upload.videodelivery.net/tus/one?token=opaque",
  protocol: "tus",
  chunkSize: 50 * 1024 * 1024,
  expiresAt: "2099-01-01T00:00:00.000Z",
};

test("builds a filesystem-safe review filename from sequence and version", () => {
  assert.equal(buildExportFileName("Episode 1: Offline/Lock", "V2?", ".MP4"), "Episode 1- Offline-Lock - V2-.mp4");
  assert.equal(contentTypeForExtension("mov"), "video/quicktime");
});

test("accepts only exact private Cloudflare Stream TUS tickets", () => {
  assert.deepEqual(validateUploadTicket(validTicket), {
    ...validTicket,
    uploadUrl: validTicket.uploadUrl,
    protocol: "tus",
  });
  for (const uploadUrl of [
    "http://upload.videodelivery.net/tus/one",
    "https://upload.videodelivery.net.attacker.example/tus/one",
    "https://user:pass@upload.videodelivery.net/tus/one",
  ]) {
    assert.throws(() => validateUploadTicket({ ...validTicket, uploadUrl }), /Cloudflare Stream/);
  }
  assert.throws(() => validateUploadTicket({ ...validTicket, chunkSize: 5_000_000 }), /TUS/);
});

test("accepts only trusted HTTPS object-storage upload tickets", () => {
  const ticket = validateUploadTicket({
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
  });
  assert.equal(ticket.protocol, "s3");
  assert.equal(ticket.objectId, "object-1");
  assert.equal(ticket.requiredHeaders["x-amz-sdk-checksum-algorithm"], "SHA256");
  for (const uploadUrl of [
    "http://bucket.s3.eu-north-1.amazonaws.com/key",
    "https://amazonaws.com.attacker.example/key",
    "https://user:pass@bucket.s3.eu-north-1.amazonaws.com/key",
  ]) {
    assert.throws(() => validateUploadTicket({ ...ticket, uploadUrl }), /objektlagring/);
  }
  assert.throws(() => validateUploadTicket({
    ...ticket,
    requiredHeaders: { Authorization: "must-not-be-forwarded" },
  }), /ukjent opplastingshode/);
  assert.throws(() => validateUploadTicket({
    ...ticket,
    requiredHeaders: { "x-amz-sdk-checksum-algorithm": "CRC32" },
  }), /checksum-algoritme/);
});

test("reserves a bounded Stream duration close to the actual sequence", () => {
  assert.equal(maxStreamDurationSeconds(3), 60);
  assert.equal(maxStreamDurationSeconds(600.2), 631);
  assert.equal(maxStreamDurationSeconds(50_000), 36_000);
  assert.equal(maxStreamDurationSeconds(null), undefined);
});

test("turns Cloudflare capacity failures into actionable, non-raw guidance", () => {
  const message = publishErrorMessage(Object.assign(new Error("provider failure"), {
    code: "cloudflare_stream_capacity_exceeded",
  }));
  assert.match(message, /Aktiver eller øk Stream-lagring/);
  assert.match(message, /uten ny eksport/);
  assert.doesNotMatch(message, /provider failure/);
});
