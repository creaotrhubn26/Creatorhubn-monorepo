export const PRODUCTION_SOUND_DAY_STATUSES = [
  "setup",
  "recording",
  "wrapped",
] as const;
export const PRODUCTION_SOUND_SOURCE_TYPES = [
  "boom",
  "lav",
  "plant",
  "mix",
  "other",
] as const;
export const PRODUCTION_SOUND_TRACK_STATUSES = [
  "ready",
  "active",
  "issue",
  "off",
] as const;
export const PRODUCTION_SOUND_QUALITIES = [
  "clean",
  "usable",
  "compromised",
  "unusable",
] as const;
export const PRODUCTION_SOUND_ISSUES = [
  "clothing_rustle",
  "radio_hit",
  "boom_shadow",
  "handling_noise",
  "background_noise",
  "distortion",
  "sync",
  "other",
] as const;
export const PRODUCTION_SOUND_RECORDING_TYPES = [
  "room_tone",
  "wild_track",
  "ambience",
  "sfx",
] as const;
export const PRODUCTION_SOUND_RECORDING_STATUSES = [
  "planned",
  "recorded",
  "delivered",
] as const;
export const PRODUCTION_SOUND_HANDOFF_STATUSES = [
  "draft",
  "ready_for_review",
] as const;
export const PRODUCTION_SOUND_TIMECODE_MODES = [
  "free_run",
  "record_run",
  "external",
] as const;

type SoundDayStatus = (typeof PRODUCTION_SOUND_DAY_STATUSES)[number];
type SoundSourceType = (typeof PRODUCTION_SOUND_SOURCE_TYPES)[number];
type SoundTrackStatus = (typeof PRODUCTION_SOUND_TRACK_STATUSES)[number];
type SoundQuality = (typeof PRODUCTION_SOUND_QUALITIES)[number];
type SoundIssue = (typeof PRODUCTION_SOUND_ISSUES)[number];
type SoundRecordingType = (typeof PRODUCTION_SOUND_RECORDING_TYPES)[number];
type SoundRecordingStatus =
  (typeof PRODUCTION_SOUND_RECORDING_STATUSES)[number];
type SoundHandoffStatus = (typeof PRODUCTION_SOUND_HANDOFF_STATUSES)[number];
type SoundTimecodeMode = (typeof PRODUCTION_SOUND_TIMECODE_MODES)[number];

export interface ProductionSoundOperations {
  dayStatus: SoundDayStatus;
  setup: {
    recorder?: string;
    soundRoll?: string;
    sampleRate: 48_000 | 96_000;
    bitDepth: 24 | 32;
    frameRate?: string;
    timecodeMode: SoundTimecodeMode;
    timecodeSource?: string;
    planNotes?: string;
    acousticRisks?: string;
  };
  tracks: Array<{
    id: string;
    trackName: string;
    sourceType: SoundSourceType;
    subject?: string;
    channel?: string;
    transmitter?: string;
    frequency?: string;
    status: SoundTrackStatus;
    notes?: string;
    updatedAt?: string;
  }>;
  takeReports: Array<{
    id: string;
    continuityTakeId: string;
    fileName?: string;
    recordingFileIds: string[];
    trackIds: string[];
    quality: SoundQuality;
    issueTags: SoundIssue[];
    needsAdr: boolean;
    notes?: string;
    updatedAt?: string;
  }>;
  unmatchedRecordings: Array<{
    id: string;
    fileName: string;
    sceneLabel?: string;
    takeLabel?: string;
    soundRoll?: string;
    timecodeStart?: string;
    durationSeconds?: number;
    notes?: string;
    recordedAt?: string;
  }>;
  additionalRecordings: Array<{
    id: string;
    type: SoundRecordingType;
    sceneId?: string;
    name: string;
    fileName?: string;
    timecodeStart?: string;
    durationSeconds?: number;
    status: SoundRecordingStatus;
    notes?: string;
    updatedAt?: string;
  }>;
  handoff: {
    status: SoundHandoffStatus;
    recipient?: string;
    mediaDestination?: string;
    notes?: string;
    updatedAt?: string;
  };
}

export interface ProductionSoundActivityEntry {
  id: string;
  type: "workspace_saved" | "recording_reconciled";
  message: string;
  actorUserId?: string;
  createdAt: string;
}

export class ProductionSoundValidationError extends Error {}

const DAY_STATUSES = new Set<string>(PRODUCTION_SOUND_DAY_STATUSES);
const SOURCE_TYPES = new Set<string>(PRODUCTION_SOUND_SOURCE_TYPES);
const TRACK_STATUSES = new Set<string>(PRODUCTION_SOUND_TRACK_STATUSES);
const QUALITIES = new Set<string>(PRODUCTION_SOUND_QUALITIES);
const ISSUES = new Set<string>(PRODUCTION_SOUND_ISSUES);
const RECORDING_TYPES = new Set<string>(PRODUCTION_SOUND_RECORDING_TYPES);
const RECORDING_STATUSES = new Set<string>(PRODUCTION_SOUND_RECORDING_STATUSES);
const HANDOFF_STATUSES = new Set<string>(PRODUCTION_SOUND_HANDOFF_STATUSES);
const TIMECODE_MODES = new Set<string>(PRODUCTION_SOUND_TIMECODE_MODES);
const FRAME_RATE_PATTERN =
  /^(23\.976|24|25|29\.97|29\.97DF|30|30DF|50|59\.94|60)$/;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(
  value: unknown,
  field: string,
  maxLength: number,
): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized.length > maxLength) {
    throw new ProductionSoundValidationError(
      `${field} må være mellom 1 og ${maxLength} tegn.`,
    );
  }
  return normalized;
}

function optionalString(
  value: unknown,
  field: string,
  maxLength: number,
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized.length > maxLength) {
    throw new ProductionSoundValidationError(
      `${field} kan ikke være lengre enn ${maxLength} tegn.`,
    );
  }
  return normalized || undefined;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: Set<string>,
  field: string,
): T {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new ProductionSoundValidationError(`${field} har en ugyldig verdi.`);
  }
  return value as T;
}

function limitedArray(
  value: unknown,
  field: string,
  maxLength: number,
): unknown[] {
  if (!Array.isArray(value))
    throw new ProductionSoundValidationError(`${field} må være en liste.`);
  if (value.length > maxLength) {
    throw new ProductionSoundValidationError(
      `${field} kan maksimalt inneholde ${maxLength} elementer.`,
    );
  }
  return value;
}

function uniqueBy<T>(items: T[], key: (item: T) => string, field: string): T[] {
  const seen = new Set<string>();
  for (const item of items) {
    const id = key(item);
    if (seen.has(id))
      throw new ProductionSoundValidationError(
        `${field} inneholder duplikater.`,
      );
    seen.add(id);
  }
  return items;
}

function stringList(
  value: unknown,
  field: string,
  maxLength: number,
  itemLength: number,
): string[] {
  return uniqueBy(
    limitedArray(value, field, maxLength).map((item, index) =>
      requiredString(item, `${field}[${index}]`, itemLength),
    ),
    (item) => item,
    field,
  );
}

function timestamp(value: unknown, field: string): string | undefined {
  const normalized = optionalString(value, field, 40);
  if (normalized && !Number.isFinite(Date.parse(normalized))) {
    throw new ProductionSoundValidationError(
      `${field} må være et gyldig tidspunkt.`,
    );
  }
  return normalized;
}

function duration(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 86_400) {
    throw new ProductionSoundValidationError(
      `${field} må være mellom 0 og 86400 sekunder.`,
    );
  }
  return normalized;
}

export function emptyProductionSoundOperations(): ProductionSoundOperations {
  return {
    dayStatus: "setup",
    setup: {
      sampleRate: 48_000,
      bitDepth: 24,
      timecodeMode: "free_run",
    },
    tracks: [],
    takeReports: [],
    unmatchedRecordings: [],
    additionalRecordings: [],
    handoff: { status: "draft" },
  };
}

/** Normalize untrusted browser data. Activity is server-owned and excluded. */
export function normalizeProductionSoundOperations(
  value: unknown,
): ProductionSoundOperations {
  const input = objectValue(value);
  if (!input)
    throw new ProductionSoundValidationError("operations må være et objekt.");
  const setupInput = objectValue(input.setup);
  if (!setupInput)
    throw new ProductionSoundValidationError("setup må være et objekt.");
  const handoffInput = objectValue(input.handoff);
  if (!handoffInput)
    throw new ProductionSoundValidationError("handoff må være et objekt.");

  const sampleRate = Number(setupInput.sampleRate);
  if (sampleRate !== 48_000 && sampleRate !== 96_000) {
    throw new ProductionSoundValidationError(
      "setup.sampleRate må være 48000 eller 96000.",
    );
  }
  const bitDepth = Number(setupInput.bitDepth);
  if (bitDepth !== 24 && bitDepth !== 32) {
    throw new ProductionSoundValidationError(
      "setup.bitDepth må være 24 eller 32.",
    );
  }
  const frameRate = optionalString(setupInput.frameRate, "setup.frameRate", 12);
  if (frameRate && !FRAME_RATE_PATTERN.test(frameRate)) {
    throw new ProductionSoundValidationError(
      "setup.frameRate har en ugyldig verdi.",
    );
  }

  const tracks = uniqueBy(
    limitedArray(input.tracks ?? [], "tracks", 64).map((entry, index) => {
      const item = objectValue(entry);
      if (!item)
        throw new ProductionSoundValidationError(
          `tracks[${index}] er ugyldig.`,
        );
      return {
        id: requiredString(item.id, `tracks[${index}].id`, 120),
        trackName: requiredString(
          item.trackName,
          `tracks[${index}].trackName`,
          80,
        ),
        sourceType: enumValue<SoundSourceType>(
          item.sourceType,
          SOURCE_TYPES,
          `tracks[${index}].sourceType`,
        ),
        subject: optionalString(item.subject, `tracks[${index}].subject`, 160),
        channel: optionalString(item.channel, `tracks[${index}].channel`, 40),
        transmitter: optionalString(
          item.transmitter,
          `tracks[${index}].transmitter`,
          120,
        ),
        frequency: optionalString(
          item.frequency,
          `tracks[${index}].frequency`,
          40,
        ),
        status: enumValue<SoundTrackStatus>(
          item.status,
          TRACK_STATUSES,
          `tracks[${index}].status`,
        ),
        notes: optionalString(item.notes, `tracks[${index}].notes`, 2_000),
        updatedAt: timestamp(item.updatedAt, `tracks[${index}].updatedAt`),
      };
    }),
    (item) => item.id,
    "tracks",
  );

  const trackIds = new Set(tracks.map((track) => track.id));
  const takeReports = uniqueBy(
    limitedArray(input.takeReports ?? [], "takeReports", 1_500).map(
      (entry, index) => {
        const item = objectValue(entry);
        if (!item)
          throw new ProductionSoundValidationError(
            `takeReports[${index}] er ugyldig.`,
          );
        const reportTrackIds = stringList(
          item.trackIds ?? [],
          `takeReports[${index}].trackIds`,
          64,
          120,
        );
        if (reportTrackIds.some((trackId) => !trackIds.has(trackId))) {
          throw new ProductionSoundValidationError(
            `takeReports[${index}] refererer til et ukjent spor.`,
          );
        }
        return {
          id: requiredString(item.id, `takeReports[${index}].id`, 120),
          continuityTakeId: requiredString(
            item.continuityTakeId,
            `takeReports[${index}].continuityTakeId`,
            120,
          ),
          fileName: optionalString(
            item.fileName,
            `takeReports[${index}].fileName`,
            255,
          ),
          recordingFileIds: stringList(
            item.recordingFileIds ?? [],
            `takeReports[${index}].recordingFileIds`,
            100,
            120,
          ),
          trackIds: reportTrackIds,
          quality: enumValue<SoundQuality>(
            item.quality,
            QUALITIES,
            `takeReports[${index}].quality`,
          ),
          issueTags: stringList(
            item.issueTags ?? [],
            `takeReports[${index}].issueTags`,
            PRODUCTION_SOUND_ISSUES.length,
            40,
          ).map((issue) =>
            enumValue<SoundIssue>(
              issue,
              ISSUES,
              `takeReports[${index}].issueTags`,
            ),
          ),
          needsAdr: item.needsAdr === true,
          notes: optionalString(
            item.notes,
            `takeReports[${index}].notes`,
            5_000,
          ),
          updatedAt: timestamp(
            item.updatedAt,
            `takeReports[${index}].updatedAt`,
          ),
        };
      },
    ),
    (item) => item.continuityTakeId,
    "takeReports",
  );

  const unmatchedRecordings = uniqueBy(
    limitedArray(
      input.unmatchedRecordings ?? [],
      "unmatchedRecordings",
      500,
    ).map((entry, index) => {
      const item = objectValue(entry);
      if (!item)
        throw new ProductionSoundValidationError(
          `unmatchedRecordings[${index}] er ugyldig.`,
        );
      return {
        id: requiredString(item.id, `unmatchedRecordings[${index}].id`, 120),
        fileName: requiredString(
          item.fileName,
          `unmatchedRecordings[${index}].fileName`,
          255,
        ),
        sceneLabel: optionalString(
          item.sceneLabel,
          `unmatchedRecordings[${index}].sceneLabel`,
          80,
        ),
        takeLabel: optionalString(
          item.takeLabel,
          `unmatchedRecordings[${index}].takeLabel`,
          80,
        ),
        soundRoll: optionalString(
          item.soundRoll,
          `unmatchedRecordings[${index}].soundRoll`,
          80,
        ),
        timecodeStart: optionalString(
          item.timecodeStart,
          `unmatchedRecordings[${index}].timecodeStart`,
          32,
        ),
        durationSeconds: duration(
          item.durationSeconds,
          `unmatchedRecordings[${index}].durationSeconds`,
        ),
        notes: optionalString(
          item.notes,
          `unmatchedRecordings[${index}].notes`,
          3_000,
        ),
        recordedAt: timestamp(
          item.recordedAt,
          `unmatchedRecordings[${index}].recordedAt`,
        ),
      };
    }),
    (item) => item.id,
    "unmatchedRecordings",
  );

  const additionalRecordings = uniqueBy(
    limitedArray(
      input.additionalRecordings ?? [],
      "additionalRecordings",
      500,
    ).map((entry, index) => {
      const item = objectValue(entry);
      if (!item)
        throw new ProductionSoundValidationError(
          `additionalRecordings[${index}] er ugyldig.`,
        );
      return {
        id: requiredString(item.id, `additionalRecordings[${index}].id`, 120),
        type: enumValue<SoundRecordingType>(
          item.type,
          RECORDING_TYPES,
          `additionalRecordings[${index}].type`,
        ),
        sceneId: optionalString(
          item.sceneId,
          `additionalRecordings[${index}].sceneId`,
          255,
        ),
        name: requiredString(
          item.name,
          `additionalRecordings[${index}].name`,
          200,
        ),
        fileName: optionalString(
          item.fileName,
          `additionalRecordings[${index}].fileName`,
          255,
        ),
        timecodeStart: optionalString(
          item.timecodeStart,
          `additionalRecordings[${index}].timecodeStart`,
          32,
        ),
        durationSeconds: duration(
          item.durationSeconds,
          `additionalRecordings[${index}].durationSeconds`,
        ),
        status: enumValue<SoundRecordingStatus>(
          item.status,
          RECORDING_STATUSES,
          `additionalRecordings[${index}].status`,
        ),
        notes: optionalString(
          item.notes,
          `additionalRecordings[${index}].notes`,
          3_000,
        ),
        updatedAt: timestamp(
          item.updatedAt,
          `additionalRecordings[${index}].updatedAt`,
        ),
      };
    }),
    (item) => item.id,
    "additionalRecordings",
  );

  return {
    dayStatus: enumValue<SoundDayStatus>(
      input.dayStatus,
      DAY_STATUSES,
      "dayStatus",
    ),
    setup: {
      recorder: optionalString(setupInput.recorder, "setup.recorder", 160),
      soundRoll: optionalString(setupInput.soundRoll, "setup.soundRoll", 80),
      sampleRate,
      bitDepth,
      frameRate,
      timecodeMode: enumValue<SoundTimecodeMode>(
        setupInput.timecodeMode,
        TIMECODE_MODES,
        "setup.timecodeMode",
      ),
      timecodeSource: optionalString(
        setupInput.timecodeSource,
        "setup.timecodeSource",
        160,
      ),
      planNotes: optionalString(setupInput.planNotes, "setup.planNotes", 5_000),
      acousticRisks: optionalString(
        setupInput.acousticRisks,
        "setup.acousticRisks",
        5_000,
      ),
    },
    tracks,
    takeReports,
    unmatchedRecordings,
    additionalRecordings,
    handoff: {
      status: enumValue<SoundHandoffStatus>(
        handoffInput.status,
        HANDOFF_STATUSES,
        "handoff.status",
      ),
      recipient: optionalString(
        handoffInput.recipient,
        "handoff.recipient",
        160,
      ),
      mediaDestination: optionalString(
        handoffInput.mediaDestination,
        "handoff.mediaDestination",
        500,
      ),
      notes: optionalString(handoffInput.notes, "handoff.notes", 5_000),
      updatedAt: timestamp(handoffInput.updatedAt, "handoff.updatedAt"),
    },
  };
}

export function readProductionSoundActivity(
  value: unknown,
): ProductionSoundActivityEntry[] {
  const input = objectValue(value);
  if (!input || !Array.isArray(input.activity)) return [];
  return input.activity
    .flatMap((entry) => {
      const item = objectValue(entry);
      if (
        !item ||
        !["workspace_saved", "recording_reconciled"].includes(String(item.type))
      )
        return [];
      try {
        return [
          {
            id: requiredString(item.id, "activity.id", 120),
            type: item.type as ProductionSoundActivityEntry["type"],
            message: requiredString(item.message, "activity.message", 400),
            actorUserId: optionalString(
              item.actorUserId,
              "activity.actorUserId",
              255,
            ),
            createdAt:
              timestamp(item.createdAt, "activity.createdAt") ??
              new Date(0).toISOString(),
          },
        ];
      } catch {
        return [];
      }
    })
    .slice(-99);
}

export function summarizeProductionSoundChanges(
  previous: ProductionSoundOperations | null,
  next: ProductionSoundOperations,
): string {
  const changed: string[] = [];
  if (previous?.dayStatus !== next.dayStatus) changed.push("dagsstatus");
  if (JSON.stringify(previous?.setup ?? {}) !== JSON.stringify(next.setup))
    changed.push("opptaksoppsett");
  if (JSON.stringify(previous?.tracks ?? []) !== JSON.stringify(next.tracks))
    changed.push("spor");
  if (
    JSON.stringify(previous?.takeReports ?? []) !==
    JSON.stringify(next.takeReports)
  )
    changed.push("take-lyd");
  if (
    JSON.stringify(previous?.unmatchedRecordings ?? []) !==
    JSON.stringify(next.unmatchedRecordings)
  )
    changed.push("avstemmingskø");
  if (
    JSON.stringify(previous?.additionalRecordings ?? []) !==
    JSON.stringify(next.additionalRecordings)
  )
    changed.push("tilleggsopptak");
  if (JSON.stringify(previous?.handoff ?? {}) !== JSON.stringify(next.handoff))
    changed.push("handoff");
  return changed.length > 0
    ? `Oppdaterte ${changed.join(", ")}.`
    : "Lagret lydrapporten uten innholdsendringer.";
}
