import { describe, expect, it } from "vitest";

import {
  normalizePhotoComment,
  parsePhotoCommentScope,
  parsePhotoCommentStatus,
  parsePhotoReviewStatus,
  safePhotoReturnPath,
} from "./project-photo-room-model.js";

describe("Photo Room input model", () => {
  it("accepts only canonical review states", () => {
    expect(parsePhotoReviewStatus("approved")).toBe("approved");
    expect(parsePhotoReviewStatus(null)).toBeNull();
    expect(parsePhotoReviewStatus("admin_override")).toBeUndefined();
  });

  it("accepts only canonical comment fields", () => {
    expect(parsePhotoCommentScope("client")).toBe("client");
    expect(parsePhotoCommentScope("public")).toBeUndefined();
    expect(parsePhotoCommentStatus("resolved")).toBe("resolved");
    expect(parsePhotoCommentStatus("deleted")).toBeUndefined();
  });

  it("trims, bounds and rejects empty comments", () => {
    expect(normalizePhotoComment("  Ready  ")).toBe("Ready");
    expect(normalizePhotoComment("   ")).toBeNull();
    expect(normalizePhotoComment("a".repeat(5000))).toHaveLength(4000);
  });

  it("keeps checkout return paths inside the current workspace", () => {
    expect(safePhotoReturnPath("p1", "/workspace/p1/photo-room")).toBe("/workspace/p1/photo-room");
    expect(safePhotoReturnPath("p1", "/workspace/p2/photo-room")).toBe("/workspace/p1/photo-room");
    expect(safePhotoReturnPath("p1", "//evil.example")).toBe("/workspace/p1/photo-room");
  });
});
