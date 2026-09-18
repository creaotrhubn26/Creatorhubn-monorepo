"use strict";

const MANAGED_TAG_RE = /(?:\r?\n\s*)?\[\[creatorhub:id=([A-Za-z0-9:._-]{1,500})\]\]\s*$/;
const COMPLETED_RE = /^\[FERDIG\]\s*/i;
const MUST_FIX_RE = /^\[MÅ FIKSES\]\s*/i;
const VERIFICATION_URL_RE = /^https:\/\/(?:www\.)?(?:creatorhubn\.com|theroleroom\.com)(?::443)?(?:\/|$)/i;

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function hash(value) {
  let current = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index);
    current = Math.imul(current, 16777619);
  }
  return (current >>> 0).toString(36);
}

function buildVerificationUrl(value, code) {
  const verification = text(value, 2000);
  if (!VERIFICATION_URL_RE.test(verification)) {
    throw new Error("Backend returnerte en innloggingsadresse som ikke tilhører CreatorHub.");
  }
  const separator = verification.includes("?") ? "&" : "?";
  return `${verification}${separator}code=${encodeURIComponent(text(code, 40))}`;
}

function decodeManagedComment(value) {
  const comments = text(value, 4500);
  const match = comments.match(MANAGED_TAG_RE);
  return {
    id: match ? match[1] : null,
    note: comments.replace(MANAGED_TAG_RE, "").trim(),
  };
}

function encodeManagedComment(note, id) {
  const safeNote = text(note, 4000);
  const safeId = text(id, 500);
  if (!/^[A-Za-z0-9:._-]+$/.test(safeId)) {
    throw new Error("Ugyldig CreatorHub-markør-ID.");
  }
  return `${safeNote}${safeNote ? "\n\n" : ""}[[creatorhub:id=${safeId}]]`;
}

function parseMarkerName(value) {
  const name = text(value, 500);
  const completed = COMPLETED_RE.test(name);
  const withoutCompleted = name.replace(COMPLETED_RE, "");
  const mustFix = MUST_FIX_RE.test(withoutCompleted);
  return {
    completed,
    mustFix,
    title: withoutCompleted.replace(MUST_FIX_RE, "").trim() || "Premiere-markør",
  };
}

function colorName(value) {
  const normalized = text(value, 40).toLowerCase();
  if (normalized === "green") return "Green";
  if (normalized === "red") return "Red";
  if (normalized === "magenta" || normalized === "magneta" || normalized === "pink") return "Magenta";
  if (normalized === "orange") return "Orange";
  if (normalized === "yellow") return "Yellow";
  if (normalized === "cyan") return "Cyan";
  return "Blue";
}

function localMarkerToVideoRoom(marker, sequenceGuid) {
  const decoded = decodeManagedComment(marker.comments);
  const parsedName = parseMarkerName(marker.name);
  const normalizedColor = colorName(marker.colorName);
  const startSeconds = Math.max(0, Number(marker.startSeconds) || 0);
  const startIdentity = text(marker.startTicks, 100) || startSeconds.toFixed(6);
  const note = decoded.note || parsedName.title;
  const id = decoded.id || `premiere-native:${hash([
    text(sequenceGuid, 200),
    startIdentity,
    parsedName.title,
    note,
    normalizedColor,
  ].join("|"))}`;
  return {
    id,
    timecodeSec: startSeconds,
    title: parsedName.title,
    note,
    color: normalizedColor,
    completed: parsedName.completed || normalizedColor === "Green",
    mustFix: parsedName.mustFix || normalizedColor === "Red" || normalizedColor === "Magenta",
  };
}

function premiereMarkersToVideoRoom(markers, sequenceGuid) {
  return (Array.isArray(markers) ? markers : []).map((marker) =>
    localMarkerToVideoRoom(marker, sequenceGuid),
  );
}

function cloudMarkerPresentation(marker) {
  const completed = Boolean(marker.completed);
  const mustFix = Boolean(marker.mustFix);
  const title = text(marker.title, 200) || "Video Room";
  const note = text(marker.note, 4000) || title;
  return {
    id: text(marker.id, 500),
    timecodeSec: Math.max(0, Number(marker.timecodeSec) || 0),
    name: `${completed ? "[FERDIG] " : mustFix ? "[MÅ FIKSES] " : ""}${title}`,
    comments: encodeManagedComment(note, marker.id),
    note,
    title,
    colorName: completed ? "Green" : mustFix ? "Red" : colorName(marker.color),
  };
}

function sameTime(left, right) {
  return Math.abs((Number(left) || 0) - (Number(right) || 0)) < 0.001;
}

function sameUnmanagedMarker(local, desired) {
  if (!sameTime(local.startSeconds, desired.timecodeSec)) return false;
  const parsedName = parseMarkerName(local.name);
  const decoded = decodeManagedComment(local.comments);
  return parsedName.title === desired.title &&
    (decoded.note || parsedName.title) === desired.note;
}

function createReconciliationPlan(localMarkers, cloudMarkers) {
  const local = Array.isArray(localMarkers) ? localMarkers : [];
  const cloud = (Array.isArray(cloudMarkers) ? cloudMarkers : [])
    .map(cloudMarkerPresentation)
    .filter((marker) => marker.id);
  const managedById = new Map();
  for (const marker of local) {
    const managedId = decodeManagedComment(marker.comments).id;
    if (managedId && !managedById.has(managedId)) managedById.set(managedId, marker);
  }

  const claimed = new Set();
  const updates = [];
  const additions = [];
  const conflicts = [];

  for (const desired of cloud) {
    let current = managedById.get(desired.id) || null;
    if (!current) {
      current = local.find((candidate) =>
        !claimed.has(candidate) &&
        !decodeManagedComment(candidate.comments).id &&
        sameUnmanagedMarker(candidate, desired),
      ) || null;
    }
    if (current) {
      claimed.add(current);
      updates.push({ current, desired });
      continue;
    }
    const collision = local.find((candidate) =>
      !claimed.has(candidate) &&
      !decodeManagedComment(candidate.comments).id &&
      sameTime(candidate.startSeconds, desired.timecodeSec),
    );
    if (collision) {
      conflicts.push({ desired, current: collision });
      continue;
    }
    additions.push(desired);
  }

  const cloudIds = new Set(cloud.map((marker) => marker.id));
  const removals = local.filter((marker) => {
    const managedId = decodeManagedComment(marker.comments).id;
    return managedId && !cloudIds.has(managedId);
  });

  return { updates, additions, removals, conflicts };
}

function markerSnapshotSignature(markers) {
  return JSON.stringify((Array.isArray(markers) ? markers : [])
    .map((marker) => ({
      id: marker.id,
      timecodeSec: Number(marker.timecodeSec) || 0,
      title: marker.title || "",
      note: marker.note || "",
      color: marker.color || "",
      completed: Boolean(marker.completed),
      mustFix: Boolean(marker.mustFix),
      revision: Number(marker.revision) || 0,
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id))));
}

module.exports = {
  buildVerificationUrl,
  cloudMarkerPresentation,
  createReconciliationPlan,
  decodeManagedComment,
  encodeManagedComment,
  localMarkerToVideoRoom,
  markerSnapshotSignature,
  parseMarkerName,
  premiereMarkersToVideoRoom,
};
