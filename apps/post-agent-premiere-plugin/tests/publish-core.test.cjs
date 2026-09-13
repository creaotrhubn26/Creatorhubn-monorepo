"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildExportFileName,
  contentTypeForExtension,
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
