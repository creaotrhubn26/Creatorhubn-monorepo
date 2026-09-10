import { expect, test } from "@playwright/test";
import { buildMusicVideoVariants, type MusicVideoSegment } from "../src/lib/musicVideoVariants";

const beats = Array.from({ length: 25 }, (_, index) => index * 0.5);
const baseSegments: MusicVideoSegment[] = [
  {
    segmentIndex: 0, startSec: 0, endSec: 4, durationSec: 4,
    clipPath: "/clips/wide.mov", clipName: "wide.mov", section: "intro",
    motionScore: 0.2, highlightScore: 0.5,
  },
  {
    segmentIndex: 1, startSec: 4, endSec: 8, durationSec: 4,
    clipPath: "/clips/performance.mov", clipName: "performance.mov", section: "verse",
    motionScore: 0.6, highlightScore: 0.7,
  },
  {
    segmentIndex: 2, startSec: 8, endSec: 12, durationSec: 4,
    clipPath: "/clips/hero.mov", clipName: "hero.mov", section: "chorus",
    motionScore: 0.95, highlightScore: 0.95,
  },
  {
    segmentIndex: 3, startSec: 12, endSec: 14, durationSec: 2,
    clipPath: "/clips/outro.mov", clipName: "outro.mov", section: "outro",
    motionScore: 0.15, highlightScore: 0.4,
  },
];

test("Music Video v2 lager distinkte performance-, narrative- og 9:16-varianter", () => {
  const result = buildMusicVideoVariants({
    baseSegments,
    beats,
    sections: [
      { startSec: 0, endSec: 4, label: "intro" },
      { startSec: 4, endSec: 8, label: "verse" },
      { startSec: 8, endSec: 12, label: "chorus" },
      { startSec: 12, endSec: 14, label: "outro" },
    ],
    alignments: [
      { clipPath: "/takes/a.mov", startSec: 0, endSec: 6, durationSec: 6, matchConfidence: 0.9 },
      { clipPath: "/takes/b.mov", startSec: 4, endSec: 12, durationSec: 8, matchConfidence: 0.88 },
      { clipPath: "/takes/c.mov", startSec: 12, endSec: 14, durationSec: 2, matchConfidence: 0.86 },
    ],
    mediaPoolClipCount: 7,
    offlineClipCount: 0,
    missingAudioCount: 0,
    socialDurationSec: 45,
  });

  expect(result.variants.map((variant) => variant.id)).toEqual(["performance", "narrative", "social"]);
  const performance = result.variants[0];
  const narrative = result.variants[1];
  const social = result.variants[2];
  expect(performance.syncedSegmentCount).toBe(4);
  expect(performance.segments[1].sourceStartSec).toBe(0);
  expect(narrative.transitionCount).toBeGreaterThan(0);
  expect(social.aspect).toBe("9:16");
  expect(social.musicStartSec).toBe(6);
  expect(social.durationSec).toBeLessThanOrEqual(45);
  expect(social.segments.length).toBeGreaterThan(narrative.segments.length);
  expect(result.coverage.score).toBe(100);
});

test("coverage blokkerer build ved offline media", () => {
  const result = buildMusicVideoVariants({
    baseSegments,
    beats,
    sections: [{ startSec: 0, endSec: 12, label: "verse" }],
    mediaPoolClipCount: 3,
    offlineClipCount: 2,
  });

  expect(result.coverage.blockers).toEqual(["2 offline klipp må relinkes."]);
  expect(result.coverage.checks.find((check) => check.id === "offline")?.status).toBe("error");
});
