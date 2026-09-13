import { describe, expect, it } from "vitest";
import {
  buildVideoRoomStateUrl,
  filterVideoComments,
  groupVideoCommentReplies,
} from "./videoRoomModel";

describe("Video Room state model", () => {
  it("requests a complete state snapshot for the selected version", () => {
    expect(buildVideoRoomStateUrl("project one", "old/version")).toBe(
      "/api/projects/project%20one/video-room?versionId=old%2Fversion",
    );
  });

  it("keeps replies under their parent and decisions filterable", () => {
    const comments = [
      { id: "parent", parentId: null, status: "open", isDecision: true },
      { id: "reply", parentId: "parent", status: "open" },
      { id: "resolved", parentId: null, status: "resolved" },
    ];
    expect(groupVideoCommentReplies(comments).parent).toEqual([comments[1]]);
    expect(filterVideoComments(comments, "beslutninger")).toEqual([
      comments[0],
    ]);
    expect(filterVideoComments(comments, "loste")).toEqual([comments[2]]);
  });
});
