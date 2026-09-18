import { describe, expect, it } from "vitest";
import {
  hashVideoSharePassword,
  hashVideoShareToken,
  newVideoShareToken,
  normalizeVideoCommentInput,
  safeVideoReturnPath,
  selectActiveVideoVersion,
  sanitizeVideoAnnotation,
  sanitizeVideoChapters,
} from "./project-video-room-model";

describe("Video Room review model", () => {
  it("normalizes chapters in timeline order", () => {
    expect(
      sanitizeVideoChapters([
        { startSec: 20, title: "B" },
        { start_sec: -4, title: "A" },
      ]),
    ).toEqual([
      { startSec: 0, title: "A", intro: null },
      { startSec: 20, title: "B", intro: null },
    ]);
  });

  it("keeps rich comment fields and rejects invalid enums", () => {
    const input = normalizeVideoCommentInput({
      timecodeSec: 12.5,
      endTimecodeSec: 18,
      comment: "  More room tone  ",
      category: "audio",
      priority: "must-fix",
      isDecision: true,
      suggestedMediaUrl: "https://example.test/song",
    });
    expect(input).toMatchObject({
      comment: "More room tone",
      timecodeSec: 12.5,
      endTimecodeSec: 18,
      category: "audio",
      priority: "must-fix",
      isDecision: true,
    });
    expect(
      normalizeVideoCommentInput({
        comment: "x",
        category: "bad",
        priority: "bad",
      }),
    ).toMatchObject({ category: "other", priority: "suggestion" });
  });

  it("clamps frame annotations to normalized coordinates", () => {
    expect(
      sanitizeVideoAnnotation({
        paths: [
          {
            color: "#ff0000",
            width: 99,
            points: [
              { x: -1, y: 2 },
              { x: 0.5, y: 0.25 },
            ],
          },
        ],
      }),
    ).toEqual({
      paths: [
        {
          color: "#ff0000",
          width: 12,
          points: [
            { x: 0, y: 1 },
            { x: 0.5, y: 0.25 },
          ],
        },
      ],
    });
  });

  it("creates opaque, hash-only share credentials", () => {
    const first = newVideoShareToken();
    const second = newVideoShareToken();
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashVideoShareToken(first.token));
    expect(first.tokenHash).not.toContain(first.token);
    expect(hashVideoSharePassword("secret", "salt")).toBe(
      hashVideoSharePassword("secret", "salt"),
    );
  });

  it("only accepts an in-project checkout return path", () => {
    expect(safeVideoReturnPath("p1", "/workspace/p1/video-room")).toBe(
      "/workspace/p1/video-room",
    );
    expect(safeVideoReturnPath("p1", "https://evil.test")).toBe(
      "/workspace/p1/video-room",
    );
    expect(safeVideoReturnPath("p1", "/workspace/p2/video-room")).toBe(
      "/workspace/p1/video-room",
    );
  });

  it("selects the newest active revision when old states overlap", () => {
    const versions = [
      { id: "v1", status: "changes_requested" },
      { id: "v2", status: "under_review" },
    ];
    expect(selectActiveVideoVersion(versions)).toBe(versions[1]);
    expect(
      selectActiveVideoVersion([
        { id: "v1", status: "superseded" },
        { id: "v2", status: "approved" },
      ]),
    ).toMatchObject({ id: "v2" });
  });
});
