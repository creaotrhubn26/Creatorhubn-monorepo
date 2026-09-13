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
