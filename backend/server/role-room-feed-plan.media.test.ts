import { describe, expect, it } from "vitest";
import { normalizeFeedPostsPayload } from "./role-room-feed-plan.js";

describe("feed plan media normalization", () => {
  it("persists ordered carousel assets and reel video fields", () => {
    const [carousel, reel] = normalizeFeedPostsPayload([
      {
        id: "carousel-1",
        concept: "educational",
        title: "Tre steg",
        caption: "Sveip",
        hashtags: [],
        callToAction: "Les",
        imageStyle: "brand",
        mediaType: "carousel",
        customImageUrls: ["/api/output/1", "/api/output/2"],
        customImageNames: ["slide-1.png", "slide-2.png"],
      },
      {
        id: "reel-1",
        concept: "behind_the_scenes",
        title: "Bak kulissene",
        caption: "Se",
        hashtags: [],
        callToAction: "Spill",
        imageStyle: "motion",
        mediaType: "reel",
        customVideoDataUrl: "/api/output/video",
        customVideoName: "reel.webm",
      },
    ]);

    expect(carousel.customImageUrls).toEqual([
      "/api/output/1",
      "/api/output/2",
    ]);
    expect(carousel.customImageNames).toEqual(["slide-1.png", "slide-2.png"]);
    expect(reel.customVideoDataUrl).toBe("/api/output/video");
    expect(reel.customVideoName).toBe("reel.webm");
  });
});
