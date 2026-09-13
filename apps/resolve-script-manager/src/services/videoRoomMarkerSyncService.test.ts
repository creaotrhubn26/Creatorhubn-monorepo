import { describe, expect, it } from "vitest";

import {
  resolveMarkersToVideoRoom,
  videoRoomMarkersForResolve,
} from "./videoRoomMarkerSyncService";

const state = (markers: any[]) => ({
  connected: true,
  projectName: "Resolve project",
  timelineName: "V2",
  fps: 25,
  timelineDurationFrames: 2500,
  markers,
  clipCount: 10,
  sampledAt: Date.now(),
});
describe("Video Room Resolve marker mapping", () => {
  it("round-trips canonical ids, completion and must-fix state", () => {
    const mapped = resolveMarkersToVideoRoom(state([{
      frame: 250,
      sec: 10,
      name: "[FERDIG] Bytt musikk",
      note: "Ny låt er lagt inn",
      color: "Green",
      customData: "ce:creatorhub:550e8400-e29b-41d4-a716-446655440000",
    }]));
    expect(mapped[0]).toMatchObject({
      id: "creatorhub:550e8400-e29b-41d4-a716-446655440000",
      title: "Bytt musikk",
      completed: true,
    });
    expect(videoRoomMarkersForResolve([{ ...mapped[0], mustFix: true }])[0].label).toBe("[FERDIG] Bytt musikk");
  });

  it("adopts native markers but excludes markers owned by other tools", () => {
    const mapped = resolveMarkersToVideoRoom(state([
      { frame: 100, sec: 4, name: "[MÅ FIKSES] Stabiliser", note: "Rister", color: "Red", customData: "" },
      { frame: 200, sec: 8, name: "AI beat", note: "", color: "Purple", customData: "ce:audio:beat:1" },
    ]));
    expect(mapped).toHaveLength(1);
    expect(mapped[0]).toMatchObject({ title: "Stabiliser", mustFix: true });
    expect(mapped[0].id).toMatch(/^resolve-native:/);
  });
});
