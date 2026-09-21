import type {
  CastingProject,
  ProductionContinuityTake,
  ProductionDay,
  ProductionSoundOperations,
  ProductionSoundTakeReport,
} from "../../models/casting";

export const PRODUCTION_SOUND_SURFACES = [
  "overview",
  "setup",
  "takes",
  "additional",
  "handoff",
] as const;
export type ProductionSoundSurface = (typeof PRODUCTION_SOUND_SURFACES)[number];

export function isProductionSoundSurface(
  value: unknown,
): value is ProductionSoundSurface {
  return (
    typeof value === "string" &&
    PRODUCTION_SOUND_SURFACES.includes(value as ProductionSoundSurface)
  );
}

export function createEmptyProductionSoundOperations(): ProductionSoundOperations {
  return {
    dayStatus: "setup",
    setup: { sampleRate: 48000, bitDepth: 24, timecodeMode: "free_run" },
    tracks: [],
    takeReports: [],
    unmatchedRecordings: [],
    additionalRecordings: [],
    handoff: { status: "draft" },
    activity: [],
  };
}

export function mergeProductionSoundOperations(
  value?: ProductionSoundOperations | null,
): ProductionSoundOperations {
  const empty = createEmptyProductionSoundOperations();
  if (!value) return empty;
  return {
    ...empty,
    ...value,
    setup: { ...empty.setup, ...(value.setup ?? {}) },
    tracks: Array.isArray(value.tracks) ? value.tracks : [],
    takeReports: Array.isArray(value.takeReports)
      ? value.takeReports.map((report) => ({
          ...report,
          recordingFileIds: Array.isArray(report.recordingFileIds)
            ? report.recordingFileIds
            : [],
        }))
      : [],
    unmatchedRecordings: Array.isArray(value.unmatchedRecordings)
      ? value.unmatchedRecordings
      : [],
    additionalRecordings: Array.isArray(value.additionalRecordings)
      ? value.additionalRecordings
      : [],
    handoff: { ...empty.handoff, ...(value.handoff ?? {}) },
    activity: Array.isArray(value.activity) ? value.activity : [],
  };
}

export function createProductionSoundId(
  prefix: "track" | "take-report" | "unmatched" | "recording",
): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export function canonicalTakesForDay(
  day?: ProductionDay | null,
): ProductionContinuityTake[] {
  return Array.isArray(day?.productionContinuity?.takes)
    ? day.productionContinuity.takes
    : [];
}

export interface ProductionSoundDayBrief {
  day: ProductionDay;
  label: string;
  sceneCount: number;
  takeCount: number;
  reportedTakeCount: number;
  compromisedTakeCount: number;
  adrTakeCount: number;
  unresolvedFileCount: number;
  missingRoomToneSceneCount: number;
  handoffReady: boolean;
}

export function buildProductionSoundDayBrief(
  project: CastingProject,
  day: ProductionDay,
): ProductionSoundDayBrief {
  const operations = mergeProductionSoundOperations(day.productionSound);
  const takes = canonicalTakesForDay(day);
  const reportByTake = new Map(
    operations.takeReports.map((report) => [report.continuityTakeId, report]),
  );
  const recordedRoomToneScenes = new Set(
    operations.additionalRecordings
      .filter(
        (recording) =>
          recording.type === "room_tone" &&
          recording.status !== "planned" &&
          recording.sceneId,
      )
      .map((recording) => recording.sceneId as string),
  );
  const date = day.date ? new Date(`${day.date}T12:00:00`) : null;
  const dateLabel =
    date && Number.isFinite(date.getTime())
      ? new Intl.DateTimeFormat("nb-NO", {
          weekday: "short",
          day: "2-digit",
          month: "short",
        }).format(date)
      : day.id;
  const location = (project.locations ?? []).find(
    (entry) => entry.id === day.locationId,
  )?.name;
  return {
    day,
    label: location ? `${dateLabel} · ${location}` : dateLabel,
    sceneCount: day.scenes?.length ?? 0,
    takeCount: takes.length,
    reportedTakeCount: takes.filter((take) => reportByTake.has(take.id)).length,
    compromisedTakeCount: operations.takeReports.filter((report) =>
      ["compromised", "unusable"].includes(report.quality),
    ).length,
    adrTakeCount: operations.takeReports.filter((report) => report.needsAdr)
      .length,
    unresolvedFileCount: operations.unmatchedRecordings.length,
    missingRoomToneSceneCount: (day.scenes ?? []).filter(
      (sceneId) => !recordedRoomToneScenes.has(sceneId),
    ).length,
    handoffReady: operations.handoff.status === "ready_for_review",
  };
}

export function sceneLabel(project: CastingProject, sceneId: string): string {
  const scene = (project.sceneBreakdowns ?? []).find(
    (entry) => String(entry.id) === sceneId,
  );
  if (!scene) return sceneId;
  const number = String(scene.sceneNumber ?? "").trim();
  const heading = String(
    scene.heading ?? scene.sceneHeading ?? scene.sceneName ?? "",
  ).trim();
  return [number ? `Scene ${number}` : "Scene", heading]
    .filter(Boolean)
    .join(" · ");
}

export function upsertProductionSoundTakeReport(
  operations: ProductionSoundOperations,
  report: ProductionSoundTakeReport,
): ProductionSoundOperations {
  return {
    ...operations,
    takeReports: [
      ...operations.takeReports.filter(
        (item) => item.continuityTakeId !== report.continuityTakeId,
      ),
      report,
    ],
  };
}

function csvCell(value: unknown): string {
  const normalized = String(value ?? "");
  // Spreadsheet applications can execute cells beginning with these
  // characters as formulas. Preserve the visible value while forcing text.
  const safeValue = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  return /[",\r\n]/.test(safeValue)
    ? `"${safeValue.replace(/"/g, '""')}"`
    : safeValue;
}

/** Portable report for editorial/post. No media is moved or marked delivered. */
export function buildProductionSoundCsv(
  project: CastingProject,
  day: ProductionDay,
): string {
  const operations = mergeProductionSoundOperations(day.productionSound);
  const reportByTake = new Map(
    operations.takeReports.map((report) => [report.continuityTakeId, report]),
  );
  const header = [
    "Project",
    "Date",
    "Scene",
    "Take",
    "Slate",
    "Sound roll",
    "File name",
    "Start TC",
    "End TC",
    "Duration",
    "Quality",
    "Issues",
    "ADR",
    "Tracks",
    "Notes",
  ];
  const rows = canonicalTakesForDay(day).map((take) => {
    const report = reportByTake.get(take.id);
    const trackNames = (report?.trackIds ?? []).map(
      (id) =>
        operations.tracks.find((track) => track.id === id)?.trackName ?? id,
    );
    return [
      project.name,
      day.date,
      sceneLabel(project, take.sceneId),
      take.takeNumber,
      take.slate,
      take.soundRoll || operations.setup.soundRoll,
      report?.fileName,
      take.timecodeStart,
      take.timecodeEnd,
      take.durationSeconds,
      report?.quality,
      report?.issueTags.join("|"),
      report?.needsAdr ? "yes" : "no",
      trackNames.join("|"),
      report?.notes || take.soundNotes,
    ];
  });
  return [header, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
