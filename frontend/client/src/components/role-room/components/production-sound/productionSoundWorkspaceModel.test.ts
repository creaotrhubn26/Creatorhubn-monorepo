import { describe, expect, it } from "vitest";
import type { CastingProject, ProductionDay } from "../../models/casting";
import {
  buildProductionSoundCsv,
  buildProductionSoundDayBrief,
  createEmptyProductionSoundOperations,
  upsertProductionSoundTakeReport,
} from "./productionSoundWorkspaceModel";

const day: ProductionDay = {
  id: "day-1",
  date: "2026-09-21",
  scenes: ["scene-1"],
  crew: [],
  props: [],
  productionContinuity: {
    sceneRecords: [],
    entries: [],
    deviations: [],
    comments: [],
    revisions: [],
    activity: [],
    takes: [
      {
        id: "take-1",
        sceneId: "scene-1",
        takeNumber: 2,
        status: "good",
        circled: true,
        soundRoll: "A001",
        timecodeStart: "10:00:00:00",
      },
    ],
  },
};
const project = {
  id: "troll",
  name: "Troll",
  productionDays: [day],
  sceneBreakdowns: [
    { id: "scene-1", sceneNumber: "12", heading: "EXT. FJELL - NATT" },
  ],
} as CastingProject;

describe("productionSoundWorkspaceModel", () => {
  it("derives readiness from canonical continuity takes", () => {
    const operations = upsertProductionSoundTakeReport(
      createEmptyProductionSoundOperations(),
      {
        id: "report-1",
        continuityTakeId: "take-1",
        trackIds: [],
        quality: "compromised",
        issueTags: ["background_noise"],
        needsAdr: true,
      },
    );
    const brief = buildProductionSoundDayBrief(project, {
      ...day,
      productionSound: operations,
    });
    expect(brief).toMatchObject({
      takeCount: 1,
      reportedTakeCount: 1,
      compromisedTakeCount: 1,
      adrTakeCount: 1,
      missingRoomToneSceneCount: 1,
    });
  });

  it("exports the canonical take identity and the sound detail", () => {
    const operations = upsertProductionSoundTakeReport(
      createEmptyProductionSoundOperations(),
      {
        id: "report-1",
        continuityTakeId: "take-1",
        fileName: "A001_012T02.wav",
        trackIds: [],
        quality: "clean",
        issueTags: [],
        needsAdr: false,
      },
    );
    const csv = buildProductionSoundCsv(project, {
      ...day,
      productionSound: operations,
    });
    expect(csv).toContain("Troll,2026-09-21,Scene 12 · EXT. FJELL - NATT,2");
    expect(csv).toContain("A001_012T02.wav");
  });

  it("exports user-entered cells as text instead of spreadsheet formulas", () => {
    const operations = upsertProductionSoundTakeReport(
      createEmptyProductionSoundOperations(),
      {
        id: "report-1",
        continuityTakeId: "take-1",
        fileName: '=HYPERLINK("https://invalid.test")',
        trackIds: [],
        quality: "clean",
        issueTags: [],
        needsAdr: false,
        notes: "@SUM(1+1)",
      },
    );
    const csv = buildProductionSoundCsv(project, {
      ...day,
      productionSound: operations,
    });
    expect(csv).toContain('"\'=HYPERLINK(""https://invalid.test"")"');
    expect(csv).toContain("'@SUM(1+1)");
  });
});
