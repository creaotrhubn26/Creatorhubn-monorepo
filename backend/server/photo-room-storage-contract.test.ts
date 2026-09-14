import { describe, expect, it } from "vitest";

import {
  buildPhotoRoomAiResultKey,
  buildPhotoRoomCaptureAssetPrefix,
  buildPhotoRoomCaptureKey,
  buildPhotoRoomDeliveryKey,
  buildPhotoRoomEnhancerSourceKey,
  isCreatorHubPhotoRoomKey,
} from "./photo-room-storage-contract.js";

describe("Photo Room CreatorHub S3 key contract", () => {
  const scope = { organizationId: null, userId: "user/../1", projectId: "project-1" };

  it("places Capture media in a tenant and project scoped Photo Room prefix", () => {
    const key = buildPhotoRoomCaptureKey({
      ...scope, sessionId: "session-1", assetId: "asset-1", kind: "full", fileName: "RAW 01.CR3",
    });
    expect(key).toBe("organizations/personal-user-..-1/users/user-..-1/projects/project-1/photo-room/capture/sessions/session-1/assets/asset-1/full/original.cr3");
    expect(key.startsWith(buildPhotoRoomCaptureAssetPrefix({ ...scope, sessionId: "session-1", assetId: "asset-1" }))).toBe(true);
    expect(isCreatorHubPhotoRoomKey(key)).toBe(true);
  });

  it("keeps AI results and gallery deliveries inside the same product boundary", () => {
    expect(buildPhotoRoomAiResultKey({ ...scope, jobId: "job-1", mediaKind: "image" }))
      .toContain("/photo-room/ai/images/job-1/result.png");
    expect(buildPhotoRoomDeliveryKey({ ...scope, galleryId: "gallery-1", objectId: "object-1", fileName: "../final.jpg" }))
      .toContain("/photo-room/galleries/gallery-1/deliveries/object-1-final.jpg");
    expect(buildPhotoRoomEnhancerSourceKey({ ...scope, objectId: "source-1", fileName: "capture.CR3" }))
      .toContain("/photo-room/enhancer/sources/source-1/original.cr3");
  });

  it("gives each Capture review recording its own S3 object", () => {
    const first = buildPhotoRoomCaptureKey({
      ...scope, sessionId: "session-1", assetId: "asset-1", kind: "review-audio", fileName: "review-1.m4a",
    });
    const second = buildPhotoRoomCaptureKey({
      ...scope, sessionId: "session-1", assetId: "asset-1", kind: "review-audio", fileName: "review-2.m4a",
    });
    expect(first).toContain("/review-audio/review-1.m4a");
    expect(second).toContain("/review-audio/review-2.m4a");
    expect(first).not.toBe(second);
  });

  it("does not treat legacy R2 or Role Room keys as CreatorHub keys", () => {
    expect(isCreatorHubPhotoRoomKey("capture/user/session/file.jpg")).toBe(false);
    expect(isCreatorHubPhotoRoomKey("workspace/project/ai-edits/job.png")).toBe(false);
  });
});
