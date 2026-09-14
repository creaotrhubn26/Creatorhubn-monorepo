import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./capture-upload-service.js", () => ({
  describeCaptureStorageKey: (key: string) => key.includes("/photo-room/")
    ? { bucket: "creatorhub-private", storage: "creatorhub_s3" }
    : null,
}));

import { performHandoff } from "./capture-handoff-service.js";

function handoffDb() {
  let selection = 0;
  return {
    select: () => {
      selection += 1;
      const rows = selection === 1
        ? [{ id: "session-1", projectId: "project-1" }]
        : [{
            id: "asset-1",
            sessionId: "session-1",
            originalFilename: "IMG_0001.CR3",
            mime: "image/x-canon-cr3",
            sizeBytes: 1234,
            checksumSha256: "a".repeat(64),
            previewKey: null,
            fullKey: "organizations/personal-user-1/users/user-1/projects/project-1/photo-room/capture/sessions/session-1/assets/asset-1/full/original.cr3",
          }];
      const chain: any = {};
      chain.from = () => chain;
      chain.where = () => Object.assign(Promise.resolve(rows), {
        limit: async () => rows,
      });
      return chain;
    },
  } as any;
}

describe("Capture handoff storage contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("submits CreatorHub S3 as the enhancer source without a Role Room bucket", async () => {
    let submitted: any = null;
    let submittedHeaders: HeadersInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url, init: RequestInit) => {
      submitted = JSON.parse(String(init.body));
      submittedHeaders = init.headers;
      return new Response(JSON.stringify({ success: true, job: { id: "job-1" } }), {
        status: 202,
        headers: { "content-type": "application/json" },
      });
    }));

    const result = await performHandoff(handoffDb(), "user-1", "session-1", {
      filter: { kind: "ids", assetIds: ["asset-1"] },
      preferredSource: "full",
      authorization: "Bearer capture-session",
    });

    expect(result?.submittedCount).toBe(1);
    expect(submitted.projectId).toBe("project-1");
    expect(submitted.source).toMatchObject({
      bucket: "creatorhub-private",
      storage: "creatorhub_s3",
    });
    expect(submitted.source.bucket).not.toMatch(/role|b2/i);
    expect(submittedHeaders).toMatchObject({
      authorization: "Bearer capture-session",
    });
  });
});
