import { describe, expect, it, vi } from "vitest";
import {
  builtInReferenceDescriptor,
  libraryReferenceId,
  parseLibraryReferenceId,
  readBuiltInStoryboardReference,
  resolveApprovedProviderReferences,
} from "./storyboard-reference-library.js";

const approvedRow = {
  id: "ref-troll-creature-v1",
  project_id: "troll-project-2026",
  pack_id: "troll-production-bible",
  pack_version: "v1",
  entity_type: "character",
  entity_id: "trollet",
  scene_ids: ["scene-8"],
  name: "Trollet — skapning og skala",
  description: "40 meter høyt fjelltroll.",
  reference_image_id: "builtin://troll/v1/troll-creature-scale",
  approval_status: "approved",
  locked: true,
  metadata: {},
  created_by: "owner",
  approved_by: "director",
  approved_at: new Date("2026-08-26T10:00:00Z"),
  created_at: new Date("2026-08-26T09:00:00Z"),
  updated_at: new Date("2026-08-26T10:00:00Z"),
};

describe("storyboard reference library", () => {
  it("parses only opaque library IDs", () => {
    expect(
      parseLibraryReferenceId(libraryReferenceId("ref-troll-creature-v1")),
    ).toBe("ref-troll-creature-v1");
    expect(
      parseLibraryReferenceId("https://169.254.169.254/latest/meta-data"),
    ).toBeNull();
    expect(parseLibraryReferenceId("library:../../etc/passwd")).toBeNull();
  });

  it("resolves built-in assets through the explicit allow-list and validates PNG bytes", async () => {
    expect(
      builtInReferenceDescriptor("builtin://troll/v1/troll-creature-scale"),
    ).not.toBeNull();
    expect(builtInReferenceDescriptor("file:///etc/passwd")).toBeNull();

    const file = await readBuiltInStoryboardReference(
      "builtin://troll/v1/troll-creature-scale",
    );
    expect(file.contentType).toBe("image/png");
    expect(file.bytes.length).toBeGreaterThan(100_000);
    expect([...file.bytes.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  it("revalidates project ownership and approval before provider use", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [approvedRow] });
    const resolved = await resolveApprovedProviderReferences({ query } as any, {
      projectId: "troll-project-2026",
      referenceIds: [
        "library:ref-troll-creature-v1",
        "https://example.com/untrusted.png",
        "library:ref-troll-creature-v1",
      ],
    });

    expect(resolved).toHaveLength(1);
    expect(resolved[0].asset.id).toBe("ref-troll-creature-v1");
    expect(resolved[0].bytes.length).toBeGreaterThan(100_000);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("approval_status = 'approved'"),
      ["troll-project-2026", ["ref-troll-creature-v1"]],
    );
  });
});
