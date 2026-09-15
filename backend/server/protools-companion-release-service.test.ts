import { describe, expect, it } from "vitest";

import { parseProToolsCompanionReleaseManifest } from "./protools-companion-release-service.js";

function validManifest(): Record<string, unknown> {
  const version = "1.2.3";
  const prefix = `platform/releases/protools-companion/${version}`;
  const artifact = (id: string, filename: string, extra: Record<string, unknown> = {}) => ({
    id, filename, key: `${prefix}/${filename}`, sizeBytes: 42, sha256: "b".repeat(64), ...extra,
  });
  return {
    schemaVersion: 1,
    product: "protools-companion",
    version,
    publishedAt: "2026-09-14T10:00:00Z",
    notes: "Release notes",
    downloads: [
      artifact("mac-arm-dmg", "mac-arm.dmg", { os: "macOS", arch: "Apple Silicon", format: "DMG", signed: true }),
      artifact("mac-intel-dmg", "mac-intel.dmg", { os: "macOS", arch: "Intel", format: "DMG", signed: true }),
      artifact("windows-exe", "windows.exe", { os: "Windows", arch: "x64", format: "EXE", signed: true }),
      artifact("windows-msi", "windows.msi", { os: "Windows", arch: "x64", format: "MSI", signed: true }),
    ],
    updater: {
      "darwin-aarch64": artifact("updater-darwin-arm", "arm.tar.gz", { signature: "valid-signature-arm" }),
      "darwin-x86_64": artifact("updater-darwin-intel", "intel.tar.gz", { signature: "valid-signature-intel" }),
      "windows-x86_64": artifact("updater-windows-x64", "windows.zip", { signature: "valid-signature-windows" }),
    },
  };
}

describe("Pro Tools Companion release manifest", () => {
  it("accepts the complete immutable CreatorHub S3 manifest", () => {
    expect(parseProToolsCompanionReleaseManifest(validManifest())).toMatchObject({
      schemaVersion: 1,
      version: "1.2.3",
      downloads: expect.any(Array),
      updater: expect.any(Object),
    });
  });

  it("fails closed for a key outside the product release prefix", () => {
    const manifest = validManifest();
    (manifest.downloads as Array<Record<string, unknown>>)[0].key = "organizations/private/secret";
    expect(parseProToolsCompanionReleaseManifest(manifest)).toBeNull();
  });

  it("fails closed if an installer is unsigned or a required target is missing", () => {
    const unsigned = validManifest();
    (unsigned.downloads as Array<Record<string, unknown>>)[0].signed = false;
    expect(parseProToolsCompanionReleaseManifest(unsigned)).toBeNull();

    const incomplete = validManifest();
    delete (incomplete.updater as Record<string, unknown>)["windows-x86_64"];
    expect(parseProToolsCompanionReleaseManifest(incomplete)).toBeNull();
  });
});
