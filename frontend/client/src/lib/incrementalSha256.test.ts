import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { IncrementalSha256 } from "./incrementalSha256";

describe("Sound Room incremental browser checksum", () => {
  it("matches SHA-256 reference vectors across uneven upload chunks", () => {
    const input = new TextEncoder().encode("CreatorHub Sound Room multipart checksum");
    const hasher = new IncrementalSha256();
    hasher.update(input.subarray(0, 1));
    hasher.update(input.subarray(1, 17));
    hasher.update(input.subarray(17));
    expect(hasher.digestHex()).toBe(createHash("sha256").update(input).digest("hex"));
  });

  it("handles a payload spanning several SHA blocks", () => {
    const input = new Uint8Array(1027).map((_, index) => index % 251);
    const hasher = new IncrementalSha256();
    for (let offset = 0; offset < input.length; offset += 63) hasher.update(input.subarray(offset, offset + 63));
    expect(hasher.digestHex()).toBe(createHash("sha256").update(input).digest("hex"));
  });
});
