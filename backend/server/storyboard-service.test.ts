import { describe, expect, it, vi } from "vitest";

import {
  mergeStoryboardSourceMetadata,
  storyboardSourceDocumentChanged,
  type Storyboard,
  updateStoryboard,
} from "./storyboard-service.js";

function storyboard(strokes: unknown[]): Storyboard {
  return {
    id: "storyboard-1",
    projectId: "project-1",
    sceneId: "scene-1",
    frameId: "frame-1",
    title: "Shot 1A",
    strokes,
    imageData: "data:image/png;base64,pencil",
    width: 1920,
    height: 1080,
    workflowLevel: "drawn",
    metadata: {
      sourceRevision: 4,
      aiOutputStale: false,
      aiOutputStaleReason: "",
    },
    createdBy: "user-1",
    createdAt: "2026-08-29T10:00:00.000Z",
    updatedAt: "2026-08-29T10:00:00.000Z",
  };
}

const serverOwnedMetadata = {
  aiVideo: { jobId: "job-current", bindingFingerprint: "binding-current" },
  aiPaintoverState: { version: 1, videoStale: true },
  cameraMotionTrack: { version: 1, opaqueTestValue: "server" },
  cameraMotionRevision: 3,
  cameraMotionUpdatedAt: "2026-08-30T12:00:00.000Z",
  cameraMotionFingerprint: "motion-current",
  cameraMotionBaseFramingFingerprint: "framing-current",
  cameraMotionStatus: "valid",
  shotDuration: { value: 2, timescale: 1 },
  durationRevision: 4,
};

describe("storyboard source metadata authority", () => {
  it("increments revision and re-arms stale for every source mutation", () => {
    expect(mergeStoryboardSourceMetadata({
      sourceRevision: 4,
      aiOutputStale: false,
      aiOutputStaleReason: "",
    }, {
      aiOutputStale: false,
      sourceRevision: 99,
    }, true)).toMatchObject({
      sourceRevision: 5,
      aiOutputStale: true,
      aiOutputStaleReason: "source-document-changed",
    });
  });

  it("does not let generic metadata patches clear authoritative stale", () => {
    expect(mergeStoryboardSourceMetadata({
      sourceRevision: 5,
      aiOutputStale: true,
      aiOutputStaleReason: "source-document-changed",
    }, {
      aiOutputStale: false,
      aiOutputStaleReason: "",
      clientNote: "keep",
    }, false)).toEqual({
      sourceRevision: 5,
      aiOutputStale: true,
      aiOutputStaleReason: "source-document-changed",
      clientNote: "keep",
    });
  });

  it("preserves server-owned video, paintover, motion and timing on update", () => {
    const tampered = {
      aiVideo: { jobId: "forged" },
      aiPaintoverState: { version: 1, videoStale: false },
      cameraMotionTrack: { version: 2, injected: true },
      cameraMotionRevision: 999,
      cameraMotionUpdatedAt: "forged",
      cameraMotionFingerprint: "forged",
      cameraMotionBaseFramingFingerprint: "forged",
      cameraMotionStatus: "needsRebase",
      shotDuration: { value: 99, timescale: 1 },
      durationRevision: 999,
      clientNote: "allowed",
    };

    expect(mergeStoryboardSourceMetadata(
      { sourceRevision: 4, ...serverOwnedMetadata },
      tampered,
      false,
    )).toEqual({
      sourceRevision: 4,
      ...serverOwnedMetadata,
      clientNote: "allowed",
    });
  });

  it("strips server-owned metadata injection when creating a normalized row", () => {
    const result = mergeStoryboardSourceMetadata({}, {
      ...serverOwnedMetadata,
      clientNote: "allowed",
    }, false);

    expect(result).toEqual({ sourceRevision: 0, clientNote: "allowed" });
    for (const key of Object.keys(serverOwnedMetadata)) {
      expect(result).not.toHaveProperty(key);
    }
  });

  it.each(["Color", "Atmosphere"])(
    "keeps source revision and Pencil approval current for a %s-only edit",
    (layer) => {
      const current = storyboard([
        { id: "drawing-1", boardLayer: "Drawing", points: [{ x: 1, y: 1 }] },
        { id: `${layer}-old`, boardLayer: layer, points: [{ x: 2, y: 2 }] },
      ]);
      const patch = {
        strokes: [
          { id: "drawing-1", boardLayer: "Drawing", points: [{ x: 1, y: 1 }] },
          { id: `${layer}-new`, boardLayer: layer, points: [{ x: 3, y: 3 }] },
        ],
      };

      const changed = storyboardSourceDocumentChanged(current, patch);
      const metadata = mergeStoryboardSourceMetadata(
        current.metadata,
        undefined,
        changed,
      );

      expect(changed).toBe(false);
      expect(metadata).toMatchObject({
        sourceRevision: 4,
        aiOutputStale: false,
        aiOutputStaleReason: "",
      });
    },
  );

  it("increments source revision and stales approval for a Drawing edit", () => {
    const current = storyboard([
      { id: "drawing-1", boardLayer: "Drawing", points: [{ x: 1, y: 1 }] },
      { id: "color-1", boardLayer: "Color", points: [{ x: 2, y: 2 }] },
    ]);
    const patch = {
      strokes: [
        { id: "drawing-1", boardLayer: "Drawing", points: [{ x: 9, y: 9 }] },
        { id: "color-1", boardLayer: "Color", points: [{ x: 2, y: 2 }] },
      ],
    };

    const changed = storyboardSourceDocumentChanged(current, patch);
    const metadata = mergeStoryboardSourceMetadata(
      current.metadata,
      undefined,
      changed,
    );

    expect(changed).toBe(true);
    expect(metadata).toMatchObject({
      sourceRevision: 5,
      aiOutputStale: true,
      aiOutputStaleReason: "source-document-changed",
    });
  });
});

describe("storyboard update transaction", () => {
  it("merges from the row lock and preserves freshly written server sidecars", async () => {
    const lockedMetadata = {
      sourceRevision: 7,
      ...serverOwnedMetadata,
      serverMarker: "latest",
    };
    const lockedRow = {
      id: "storyboard-1",
      project_id: "project-1",
      scene_id: "scene-1",
      frame_id: "frame-1",
      title: "Shot 1A",
      strokes: [],
      image_data: "data:image/png;base64,pencil",
      width: 1920,
      height: 1080,
      workflow_level: "drawn",
      metadata: lockedMetadata,
      created_by: "user-1",
      created_at: "2026-08-29T10:00:00.000Z",
      updated_at: "2026-08-30T12:00:00.000Z",
    };
    let persistedMetadata: Record<string, unknown> | undefined;
    const client = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql === "BEGIN" || sql === "COMMIT") {
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes("SELECT * FROM casting_storyboards")) {
          return { rows: [lockedRow], rowCount: 1 };
        }
        if (sql.includes("UPDATE casting_storyboards")) {
          persistedMetadata = JSON.parse(String(params[0]));
          return {
            rows: [{
              ...lockedRow,
              metadata: persistedMetadata,
              updated_at: "2026-08-30T12:01:00.000Z",
            }],
            rowCount: 1,
          };
        }
        throw new Error(`unexpected query: ${sql}`);
      }),
      release: vi.fn(),
    };
    const pool = {
      query: vi.fn(),
      connect: vi.fn(async () => client),
    };

    const result = await updateStoryboard(pool as never, "storyboard-1", {
      metadata: {
        ...serverOwnedMetadata,
        aiVideo: { jobId: "forged" },
        cameraMotionRevision: 999,
        clientNote: "allowed",
      },
    });

    expect(client.query.mock.calls[0]?.[0]).toBe("BEGIN");
    expect(client.query.mock.calls[1]?.[0]).toContain("FOR UPDATE");
    expect(client.query.mock.calls[2]?.[0]).toContain("UPDATE casting_storyboards");
    expect(client.query.mock.calls[3]?.[0]).toBe("COMMIT");
    expect(pool.query).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledOnce();
    expect(persistedMetadata).toEqual({
      ...lockedMetadata,
      clientNote: "allowed",
    });
    expect(result?.metadata).toEqual(persistedMetadata);
  });
});
