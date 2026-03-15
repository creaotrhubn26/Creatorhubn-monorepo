import type {
  Course,
  CourseResource,
  Lesson,
  LessonResource,
} from "@/contexts/AcademyContext";

type LinkedVideoCarrier =
  | Pick<
      Course,
      | "videoUrl"
      | "duration"
      | "linkedVideoAssetId"
      | "linkedVideoAssetVersion"
      | "linkedVideoAssetName"
      | "linkedVideoUpdatedAt"
      | "linkedVideoFingerprint"
    >
  | Pick<
      Lesson,
      | "videoUrl"
      | "duration"
      | "linkedVideoAssetId"
      | "linkedVideoAssetVersion"
      | "linkedVideoAssetName"
      | "linkedVideoUpdatedAt"
      | "linkedVideoFingerprint"
    >;

type MediaResourceCarrier =
  | Pick<
      CourseResource,
      | "title"
      | "url"
      | "size"
      | "mediaAssetId"
      | "mediaVersion"
      | "mediaUpdatedAt"
      | "mediaFingerprint"
    >
  | Pick<
      LessonResource,
      | "title"
      | "url"
      | "size"
      | "mediaAssetId"
      | "mediaVersion"
      | "mediaUpdatedAt"
      | "mediaFingerprint"
    >;

export interface AcademyMediaAssetSnapshot {
  id: string;
  url: string;
  name: string;
  version: number;
  updatedAt: string;
  duration: number;
  fingerprint: string;
}

export interface LinkedVideoVersionState {
  hasVideo: boolean;
  assetId: string;
  linkedVersion: number;
  currentVersion: number;
  displayName: string;
  versionStatus: "none" | "untracked" | "current" | "update-available";
  hasUpdate: boolean;
  currentSnapshot: AcademyMediaAssetSnapshot | null;
}

const normalizeLinkUrl = (value: string | undefined | null): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const normalized =
      typeof window !== "undefined"
        ? new URL(raw, window.location.origin)
        : new URL(raw, "https://academy.local");
    return normalized.toString();
  } catch {
    return raw;
  }
};

export const normalizeMediaAssetId = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const normalizeMediaVersion = (
  value: unknown,
  fallback = 1,
): number => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(1, Math.round(parsed));
  }
  return Math.max(1, Math.round(fallback));
};

export const buildMediaUploadFingerprint = (file: {
  name: string;
  size: number;
  lastModified: number;
  type: string;
}): string =>
  [
    "upload",
    String(file.name || "").trim().toLowerCase(),
    Number.isFinite(Number(file.size)) ? String(Math.max(0, Number(file.size))) : "0",
    Number.isFinite(Number(file.lastModified))
      ? String(Math.max(0, Math.round(Number(file.lastModified))))
      : "0",
    String(file.type || "").trim().toLowerCase(),
  ].join(":");

export const buildUrlMediaFingerprint = (
  url: string | undefined | null,
): string => {
  const normalizedUrl = normalizeLinkUrl(url);
  return normalizedUrl ? `url:${normalizedUrl}` : "";
};

export const extractMediaDisplayName = (
  value: string | undefined | null,
  fallback: string,
): string => {
  const raw = String(value || "").trim();
  if (!raw) return fallback;

  try {
    const normalized =
      typeof window !== "undefined"
        ? new URL(raw, window.location.origin)
        : new URL(raw, "https://academy.local");
    const pathname = normalized.pathname || "";
    const lastSegment = pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(lastSegment || normalized.hostname || fallback);
  } catch {
    const lastSegment = raw.split("/").filter(Boolean).pop() || fallback;
    try {
      return decodeURIComponent(lastSegment);
    } catch {
      return lastSegment;
    }
  }
};

const registerSnapshot = (
  map: Map<string, AcademyMediaAssetSnapshot>,
  snapshot: AcademyMediaAssetSnapshot,
): void => {
  if (!snapshot.id || !snapshot.url) return;
  const existing = map.get(snapshot.id);
  if (!existing) {
    map.set(snapshot.id, snapshot);
    return;
  }

  const currentUpdatedAt = Date.parse(existing.updatedAt || "");
  const nextUpdatedAt = Date.parse(snapshot.updatedAt || "");
  const nextIsNewerVersion = snapshot.version > existing.version;
  const nextIsNewerTimestamp =
    snapshot.version === existing.version &&
    Number.isFinite(nextUpdatedAt) &&
    (!Number.isFinite(currentUpdatedAt) || nextUpdatedAt > currentUpdatedAt);

  if (nextIsNewerVersion || nextIsNewerTimestamp) {
    map.set(snapshot.id, {
      ...existing,
      ...snapshot,
      name: snapshot.name || existing.name,
      duration: snapshot.duration || existing.duration,
      fingerprint: snapshot.fingerprint || existing.fingerprint,
    });
    return;
  }

  map.set(snapshot.id, {
    ...existing,
    name:
      existing.name.length >= snapshot.name.length ? existing.name : snapshot.name,
    duration: existing.duration || snapshot.duration,
    fingerprint: existing.fingerprint || snapshot.fingerprint,
  });
};

const resourceToSnapshot = (
  resource: MediaResourceCarrier,
  fallbackName: string,
): AcademyMediaAssetSnapshot | null => {
  const assetId = normalizeMediaAssetId(resource.mediaAssetId);
  const url = normalizeLinkUrl(resource.url);
  if (!assetId || !url) return null;

  return {
    id: assetId,
    url,
    name: String(resource.title || "").trim() || fallbackName,
    version: normalizeMediaVersion(resource.mediaVersion, 1),
    updatedAt: String(resource.mediaUpdatedAt || "").trim() || "",
    duration: 0,
    fingerprint:
      String(resource.mediaFingerprint || "").trim() ||
      buildUrlMediaFingerprint(url),
  };
};

export const collectCourseMediaAssetSnapshots = (
  course: Course | null | undefined,
): Map<string, AcademyMediaAssetSnapshot> => {
  const map = new Map<string, AcademyMediaAssetSnapshot>();
  if (!course) return map;

  (Array.isArray(course.resources) ? course.resources : []).forEach((resource) => {
    const snapshot = resourceToSnapshot(resource, String(resource.title || "Media"));
    if (snapshot) registerSnapshot(map, snapshot);
  });

  (Array.isArray(course.lessons) ? course.lessons : []).forEach((lesson, lessonIndex) => {
    (Array.isArray(lesson.resources) ? lesson.resources : []).forEach((resource) => {
      const snapshot = resourceToSnapshot(
        resource,
        String(resource.title || lesson.title || `Skill ${lessonIndex + 1}`),
      );
      if (snapshot) registerSnapshot(map, snapshot);
    });
  });

  const courseAssetId = normalizeMediaAssetId(course.linkedVideoAssetId);
  const courseVideoUrl = normalizeLinkUrl(course.videoUrl);
  if (courseAssetId && courseVideoUrl) {
    registerSnapshot(map, {
      id: courseAssetId,
      url: courseVideoUrl,
      name:
        String(course.linkedVideoAssetName || "").trim() ||
        extractMediaDisplayName(courseVideoUrl, "Course video"),
      version: normalizeMediaVersion(course.linkedVideoAssetVersion, 1),
      updatedAt: String(course.linkedVideoUpdatedAt || "").trim() || "",
      duration: Number(course.duration || 0),
      fingerprint:
        String(course.linkedVideoFingerprint || "").trim() ||
        buildUrlMediaFingerprint(courseVideoUrl),
    });
  }

  (Array.isArray(course.lessons) ? course.lessons : []).forEach((lesson, lessonIndex) => {
    const assetId = normalizeMediaAssetId(lesson.linkedVideoAssetId);
    const videoUrl = normalizeLinkUrl(lesson.videoUrl);
    if (!assetId || !videoUrl) return;

    registerSnapshot(map, {
      id: assetId,
      url: videoUrl,
      name:
        String(lesson.linkedVideoAssetName || "").trim() ||
        extractMediaDisplayName(
          videoUrl,
          lesson.title || `Skill ${lessonIndex + 1} video`,
        ),
      version: normalizeMediaVersion(lesson.linkedVideoAssetVersion, 1),
      updatedAt: String(lesson.linkedVideoUpdatedAt || "").trim() || "",
      duration: Number(lesson.duration || 0),
      fingerprint:
        String(lesson.linkedVideoFingerprint || "").trim() ||
        buildUrlMediaFingerprint(videoUrl),
    });
  });

  return map;
};

export const resolveLinkedVideoVersionState = ({
  carrier,
  course,
  fallbackName,
}: {
  carrier: LinkedVideoCarrier | null | undefined;
  course: Course | null | undefined;
  fallbackName: string;
}): LinkedVideoVersionState => {
  const videoUrl = normalizeLinkUrl(carrier?.videoUrl);
  if (!videoUrl) {
    return {
      hasVideo: false,
      assetId: "",
      linkedVersion: 0,
      currentVersion: 0,
      displayName: fallbackName,
      versionStatus: "none",
      hasUpdate: false,
      currentSnapshot: null,
    };
  }

  const snapshots = collectCourseMediaAssetSnapshots(course);
  const explicitAssetId = normalizeMediaAssetId(carrier?.linkedVideoAssetId);
  const inferredSnapshot =
    explicitAssetId
      ? snapshots.get(explicitAssetId) || null
      : Array.from(snapshots.values()).find(
          (snapshot) => normalizeLinkUrl(snapshot.url) === videoUrl,
        ) || null;

  const assetId = explicitAssetId || inferredSnapshot?.id || "";
  const linkedVersion = normalizeMediaVersion(
    carrier?.linkedVideoAssetVersion,
    inferredSnapshot?.version || 1,
  );
  const currentVersion = inferredSnapshot?.version || linkedVersion;
  const displayName =
    String(carrier?.linkedVideoAssetName || "").trim() ||
    inferredSnapshot?.name ||
    extractMediaDisplayName(videoUrl, fallbackName);

  if (!assetId) {
    return {
      hasVideo: true,
      assetId: "",
      linkedVersion,
      currentVersion,
      displayName,
      versionStatus: "untracked",
      hasUpdate: false,
      currentSnapshot: inferredSnapshot,
    };
  }

  const hasUpdate = Boolean(
    inferredSnapshot && inferredSnapshot.version > linkedVersion,
  );

  return {
    hasVideo: true,
    assetId,
    linkedVersion,
    currentVersion,
    displayName,
    versionStatus: hasUpdate ? "update-available" : "current",
    hasUpdate,
    currentSnapshot: inferredSnapshot,
  };
};

