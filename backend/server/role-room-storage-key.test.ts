import { describe, expect, it } from "vitest";
import {
  canonicalizeRoleRoomR2StorageKey,
  canonicalizeRoleRoomStorageKey,
} from "./role-room-storage-key.js";

describe("canonicalizeRoleRoomStorageKey", () => {
  it("moves shared binaries and models under platform", () => {
    expect(canonicalizeRoleRoomStorageKey("downloads/post-agent/1.2.3/app.dmg"))
      .toBe("platform/releases/post-agent/1.2.3/app.dmg");
    expect(canonicalizeRoleRoomStorageKey("models/gfpgan/weights/model.pth"))
      .toBe("platform/models/legacy-b2/gfpgan/weights/model.pth");
  });

  it("removes original filenames from legacy user keys", () => {
    expect(canonicalizeRoleRoomStorageKey(
      "users/user-1/11111111-1111-4111-8111-111111111111-private-name.jpg",
    )).toBe("users/user-1/files/11111111-1111-4111-8111-111111111111/original.jpg");
  });

  it("turns legacy workspace names and filenames into opaque paths", () => {
    const key = canonicalizeRoleRoomStorageKey(
      "workspace/a-project-name/storyboards/11111111-1111-4111-8111-111111111111/animation-sources/client-name.png",
    );
    expect(key).toMatch(/^workspaces\/[0-9a-f-]{36}\/storyboards\/11111111-1111-4111-8111-111111111111\/animation-sources\/[0-9a-f-]{36}\/source\.png$/);
    expect(key).not.toContain("project-name");
    expect(key).not.toContain("client-name");
  });

  it("is idempotent for canonical keys", () => {
    const key = "organizations/org-1/projects/project-1/files/file-1/original.pdf";
    expect(canonicalizeRoleRoomStorageKey(key)).toBe(key);
  });
});

describe("canonicalizeRoleRoomR2StorageKey", () => {
  it("places model and dataset buckets under platform", () => {
    expect(canonicalizeRoleRoomR2StorageKey("ml-models", "models/sam2/model.pt"))
      .toBe("platform/models/sam2/model.pt");
    expect(canonicalizeRoleRoomR2StorageKey("ml-models", "datasets/golden/case.wav"))
      .toBe("platform/datasets/golden/case.wav");
    expect(canonicalizeRoleRoomR2StorageKey("ml-models2", "svd/model.json"))
      .toBe("platform/models/svd/model.json");
  });

  it("assigns personal R2 uploads to the user hierarchy", () => {
    expect(canonicalizeRoleRoomR2StorageKey(
      "casting-videos",
      "protools-bounces/user-id/bounce-id/private-name.wav",
    )).toBe("users/user-id/services/protools/bounces/bounce-id/original.wav");
  });
});
