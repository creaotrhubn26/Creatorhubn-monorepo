import { describe, expect, it } from "vitest";
import { workspaceCategoryForProjectType } from "./profession-types";

describe("workspaceCategoryForProjectType", () => {
  it.each([
    "film",
    "Film & video",
    "photography",
    "bryllupsfotografi",
    "video-story-arc",
  ])("maps %s to the visual workspace", (projectType) => {
    expect(workspaceCategoryForProjectType(projectType)).toBe("visual");
  });

  it.each(["music", "audio", "recording", "podcast"])(
    "maps %s to the music workspace",
    (projectType) => {
      expect(workspaceCategoryForProjectType(projectType)).toBe("music");
    },
  );

  it("keeps ambiguous project types on the profession fallback path", () => {
    expect(workspaceCategoryForProjectType("event")).toBeNull();
    expect(workspaceCategoryForProjectType("client-project")).toBeNull();
  });
});
