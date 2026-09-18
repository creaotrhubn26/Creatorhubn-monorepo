import crypto from "node:crypto";

export const AVID_MARKER_COLORS = new Set([
  "red",
  "green",
  "blue",
  "cyan",
  "magenta",
  "yellow",
  "black",
  "white",
]);

export type AvidFrameRate = {
  numerator: number;
  denominator: number;
  value: number;
  label: string;
};

export type CanonicalAvidMarker = {
  id: string;
  timecodeSec: number;
  title: string;
  note: string;
  color: string;
  completed: boolean;
  mustFix: boolean;
};

export type AvidMarkerParseResult = {
  markers: CanonicalAvidMarker[];
  rejected: Array<{ line: number; reason: string }>;
};

const CREATORHUB_ID = /\[\[creatorhub:id=([a-z0-9:._-]{1,500})\]\]/i;
const AVID_TRACK = /^(?:(?:V|A)[1-9][0-9]*|TC1)$/i;
const MAX_MARKERS = 5_000;
const MAX_FILE_BYTES = 2_000_000;

const oneLine = (value: unknown, fallback = ""): string => {
  const normalized = String(value ?? "")
    .replace(/[\t\r\n\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return normalized || fallback;
};

const markerIdentity = (frame: number, track: string, comment: string): string =>
  `avid:${crypto
    .createHash("sha256")
    .update(`${frame}\u0000${track}\u0000${comment}`)
    .digest("hex")
    .slice(0, 32)}`;

const safeMarkerId = (value: unknown, fallback: string): string => {
  const candidate = oneLine(value).slice(0, 500);
  return /^[a-z0-9:._-]{1,500}$/i.test(candidate) ? candidate : fallback;
};

export function parseAvidFrameRate(
  input: unknown,
  fallback = "25",
): AvidFrameRate {
  const raw = String(input ?? fallback).trim();
  const match = raw.match(/^(\d+(?:\.\d+)?)(?:\/(\d+(?:\.\d+)?))?$/);
  if (!match) throw new Error("invalid_avid_frame_rate");
  const numerator = Number(match[1]);
  const denominator = Number(match[2] || 1);
  const value = numerator / denominator;
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0 ||
    value < 1 ||
    value > 240
  ) {
    throw new Error("invalid_avid_frame_rate");
  }
  return {
    numerator,
    denominator,
    value,
    label: denominator === 1 ? String(numerator) : `${numerator}/${denominator}`,
  };
}

export function validateAvidTrack(input: unknown): string {
  const track = String(input || "V1").trim().toUpperCase();
  if (!AVID_TRACK.test(track)) throw new Error("invalid_avid_track");
  return track;
}

export function serializeAvidMarkerText(
  markers: Array<Partial<CanonicalAvidMarker>>,
  options: { frameRate?: unknown; track?: unknown; author?: unknown } = {},
): string {
  const frameRate = parseAvidFrameRate(options.frameRate);
  const track = validateAvidTrack(options.track);
  const author = oneLine(options.author, "CreatorHub").slice(0, 200);
  if (markers.length > MAX_MARKERS) throw new Error("too_many_avid_markers");

  return markers
    .map((marker, index) => {
      const seconds = Math.max(0, Number(marker.timecodeSec) || 0);
      const frame = Math.round(seconds * frameRate.value);
      const markerId = safeMarkerId(marker.id, `avid-export:${frame}:${index}`);
      const sourceComment = oneLine(marker.note || marker.title, `Markør ${index + 1}`);
      const withoutMetadata = sourceComment.replace(CREATORHUB_ID, "").trim();
      const statusPrefix = marker.completed
        ? "[FERDIG] "
        : marker.mustFix
          ? "[MÅ FIKSES] "
          : "";
      const identitySuffix = ` [[creatorhub:id=${markerId}]]`;
      const comment = `${statusPrefix}${withoutMetadata.slice(0, Math.max(0, 4_000 - statusPrefix.length - identitySuffix.length))}${identitySuffix}`;
      const requestedColor = String(marker.color || "").toLowerCase();
      const color = marker.completed
        ? "green"
        : marker.mustFix
          ? "red"
          : AVID_MARKER_COLORS.has(requestedColor)
            ? requestedColor
            : "blue";
      return [author, frame, track, color, oneLine(comment)].join("\t");
    })
    .join("\r\n");
}

export function parseAvidMarkerText(
  content: string,
  options: { frameRate?: unknown } = {},
): AvidMarkerParseResult {
  if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
    throw new Error("avid_marker_file_too_large");
  }
  const frameRate = parseAvidFrameRate(options.frameRate);
  const rows = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  const nonEmptyRows = rows.filter((row) => row.trim());
  if (nonEmptyRows.length > MAX_MARKERS) throw new Error("too_many_avid_markers");

  const markers: CanonicalAvidMarker[] = [];
  const rejected: Array<{ line: number; reason: string }> = [];
  const identities = new Set<string>();

  rows.forEach((row, index) => {
    if (!row.trim()) return;
    const columns = row.split("\t");
    if (
      index === 0 &&
      columns.length >= 5 &&
      columns.slice(0, 5).map((value) => value.trim().toLowerCase()).join("|") ===
        "name|frame|track|color|comment"
    ) {
      return;
    }
    if (columns.length < 5) {
      rejected.push({ line: index + 1, reason: "five_tab_delimited_fields_required" });
      return;
    }

    const author = columns[0].trim();
    const frameText = columns[1].trim();
    const track = columns[2].trim().toUpperCase();
    const color = columns[3].trim().toLowerCase();
    const rawComment = columns.slice(4).join("\t").trim();
    if (!author) {
      rejected.push({ line: index + 1, reason: "name_required" });
      return;
    }
    if (!/^\d+$/.test(frameText)) {
      rejected.push({ line: index + 1, reason: "non_negative_integer_frame_required" });
      return;
    }
    if (!AVID_TRACK.test(track)) {
      rejected.push({ line: index + 1, reason: "invalid_track" });
      return;
    }
    if (!AVID_MARKER_COLORS.has(color)) {
      rejected.push({ line: index + 1, reason: "invalid_color" });
      return;
    }
    if (!rawComment) {
      rejected.push({ line: index + 1, reason: "comment_required" });
      return;
    }

    const frame = Number(frameText);
    if (!Number.isSafeInteger(frame)) {
      rejected.push({ line: index + 1, reason: "frame_out_of_range" });
      return;
    }
    const embeddedId = rawComment.match(CREATORHUB_ID)?.[1] || null;
    const cleanComment = oneLine(
      rawComment
        .replace(CREATORHUB_ID, "")
        .replace(/^\[(?:FERDIG|MÅ FIKSES)\]\s*/i, ""),
      `Avid-markør ${frame}`,
    ).slice(0, 4_000);
    const id = embeddedId || markerIdentity(frame, track, cleanComment);
    if (identities.has(id)) {
      rejected.push({ line: index + 1, reason: "duplicate_marker_identity" });
      return;
    }
    identities.add(id);
    markers.push({
      id,
      timecodeSec: frame / frameRate.value,
      title: cleanComment.slice(0, 500),
      note: cleanComment,
      color,
      completed: /^\[FERDIG\]\s*/i.test(rawComment),
      mustFix: /^\[MÅ FIKSES\]\s*/i.test(rawComment),
    });
  });

  return { markers, rejected };
}
