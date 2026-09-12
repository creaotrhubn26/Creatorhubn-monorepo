import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VideoRoomTab from "./VideoRoomTab";

const apiRequest = vi.fn();
vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: any[]) => apiRequest(...args),
}));
vi.mock("@/components/gallery/CinematicVideoPlayer", () => ({
  default: (props: any) => (
    <div data-testid="player">
      {props.src}|{props.comments?.[0]?.comment || "none"}
    </div>
  ),
}));
vi.mock("@/components/gallery/EditFeedbackSummary", () => ({
  default: () => <div>report</div>,
}));
vi.mock("../video-room/VideoVersionCompare", () => ({
  default: () => <div>compare</div>,
}));

const room = (selected: "v1" | "v2") => ({
  currentVersionId: selected,
  activeVersionId: "v2",
  permissions: { canEdit: true },
  versions: [
    {
      id: "v1",
      versionLabel: "V1",
      status: "superseded",
      fileUrl: "/v1.mp4",
      commentCount: 1,
      openCount: 1,
    },
    {
      id: "v2",
      versionLabel: "V2",
      status: "under_review",
      fileUrl: "/v2.mp4",
      commentCount: 1,
      openCount: 1,
    },
  ],
  chapters:
    selected === "v1"
      ? [{ startSec: 0, title: "V1 chapter" }]
      : [{ startSec: 4, title: "V2 chapter" }],
  comments: [
    {
      id: `c-${selected}`,
      timecodeSec: 2,
      comment: `${selected} comment`,
      status: "open",
    },
  ],
});

describe("VideoRoomTab version scoping", () => {
  beforeEach(() => {
    localStorage.clear();
    apiRequest.mockReset();
    apiRequest.mockImplementation((url: string) => {
      if (url.includes("/ai/config")) return Promise.resolve({});
      if (url.includes("/ai/credits")) return Promise.resolve({});
      if (url.includes("/ai/jobs")) return Promise.resolve({ jobs: [] });
      if (url.includes("versionId=v1")) return Promise.resolve(room("v1"));
      return Promise.resolve(room("v2"));
    });
  });

  it("reloads video, chapters and comments when an older version is selected", async () => {
    render(<VideoRoomTab projectId="project-1" />);
    expect((await screen.findByTestId("player")).textContent).toContain(
      "/v2.mp4|v2 comment",
    );
    fireEvent.click(screen.getByTestId("video-version-v1"));
    await waitFor(() =>
      expect(screen.getByTestId("player").textContent).toContain(
        "/v1.mp4|v1 comment",
      ),
    );
    expect(screen.getByText("V1 chapter")).toBeTruthy();
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/projects/project-1/video-room?versionId=v1",
    );
  });
});
