import { describe, expect, it } from "vitest";
import { parseMockupCloudAssetRef } from "./mockupCloudAssets";

describe("private Mockup Studio asset references", () => {
  it("parses a project-scoped UUID reference and rejects local paths", () => {
    expect(parseMockupCloudAssetRef("mockup-cloud-file:rr-medside-1:11111111-1111-4111-8111-111111111111")).toEqual({
      projectId: "rr-medside-1",
      fileId: "11111111-1111-4111-8111-111111111111",
    });
    expect(parseMockupCloudAssetRef("/Users/example/figure.png")).toBeNull();
  });
});
