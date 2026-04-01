import type {
  Course,
  CourseResource,
  Lesson,
  LessonResource,
} from "@/contexts/AcademyContext";

type VideoResource = CourseResource | LessonResource;
type VideoCarrierLike = {
  videoUrl?: string;
  url?: string;
  videoSourceType?: Course["videoSourceType"] | Lesson["videoSourceType"];
  googleDriveFileId?: string;
  googleDriveMimeType?: string;
  googleDriveWebViewLink?: string;
  googleDrivePlaybackUrl?: string;
  linkedVideoAssetName?: string;
};

export type AcademyVideoSourceType =
  | "direct"
  | "google-drive-video"
  | "google-vids"
  | "external-link";

const GOOGLE_VIDS_MIME_TYPES = new Set(["application/vnd.google-apps.vid"]);

const VIDEO_URL_PATTERN = /\.(mp4|webm|ogg|m3u8|mov|m4v)(?:[?#].*)?$/i;
const VIDEO_HOST_HINT_PATTERN =
  /(youtube\.com|youtu\.be|vimeo\.com|wistia\.|mux\.|cloudflarestream\.com|stream\.)/i;
const GOOGLE_VIDEO_HOST_HINT_PATTERN =
  /(docs\.google\.com|drive\.google\.com|vids\.google\.com)/i;
const GOOGLE_VIDEO_PLAYBACK_HOST_HINT_PATTERN =
  /(googleusercontent\.com|driveusercontent\.google\.com)/i;

const normalizeUrl = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const getCarrierVideoUrl = (
  carrier: Pick<VideoCarrierLike, "videoUrl" | "url"> | null | undefined,
): string => normalizeUrl(carrier?.videoUrl) || normalizeUrl(carrier?.url);

const normalizeVideoSourceType = (
  value: unknown,
): AcademyVideoSourceType | undefined => {
  const normalized = String(value || "").trim();
  return normalized === "direct" ||
    normalized === "google-drive-video" ||
    normalized === "google-vids" ||
    normalized === "external-link"
    ? normalized
    : undefined;
};

export const buildGoogleDriveMediaAssetId = (fileId: unknown): string => {
  const normalized = String(fileId || "").trim();
  return normalized ? `gdrive:${normalized}` : "";
};

export const isGoogleVidsMimeType = (value: unknown): boolean =>
  GOOGLE_VIDS_MIME_TYPES.has(
    String(value || "")
      .trim()
      .toLowerCase(),
  );

export const getAcademyVideoSourceType = (
  carrier:
    | Pick<
        VideoCarrierLike,
        | "videoUrl"
        | "url"
        | "videoSourceType"
        | "googleDriveFileId"
        | "googleDriveMimeType"
        | "googleDriveWebViewLink"
        | "googleDrivePlaybackUrl"
      >
    | null
    | undefined,
): AcademyVideoSourceType => {
  const explicitType = normalizeVideoSourceType(carrier?.videoSourceType);
  if (explicitType) return explicitType;

  if (isGoogleVidsMimeType(carrier?.googleDriveMimeType)) {
    return "google-vids";
  }

  if (normalizeUrl(carrier?.googleDriveFileId)) {
    return normalizeUrl(carrier?.googleDrivePlaybackUrl)
      ? "google-drive-video"
      : "external-link";
  }

  const videoUrl = getCarrierVideoUrl(carrier);
  if (!videoUrl) return "direct";
  if (GOOGLE_VIDEO_PLAYBACK_HOST_HINT_PATTERN.test(videoUrl)) {
    return "google-drive-video";
  }
  if (GOOGLE_VIDEO_HOST_HINT_PATTERN.test(videoUrl)) {
    return "external-link";
  }
  if (VIDEO_HOST_HINT_PATTERN.test(videoUrl)) {
    return "external-link";
  }
  return "direct";
};

export const getAcademyPreferredPlaybackUrl = (
  carrier:
    | Pick<
        VideoCarrierLike,
        | "videoUrl"
        | "url"
        | "videoSourceType"
        | "googleDrivePlaybackUrl"
        | "googleDriveMimeType"
      >
    | null
    | undefined,
): string => {
  const sourceType = getAcademyVideoSourceType(carrier);
  if (sourceType === "google-drive-video") {
    return (
      normalizeUrl(carrier?.googleDrivePlaybackUrl) ||
      getCarrierVideoUrl(carrier)
    );
  }
  return getCarrierVideoUrl(carrier);
};

export const getAcademyVideoExternalLink = (
  carrier:
    | Pick<
        VideoCarrierLike,
        | "videoUrl"
        | "url"
        | "googleDriveWebViewLink"
        | "videoSourceType"
        | "googleDriveMimeType"
      >
    | null
    | undefined,
): string => {
  const sourceType = getAcademyVideoSourceType(carrier);
  if (sourceType === "google-vids" || sourceType === "external-link") {
    return (
      normalizeUrl(carrier?.googleDriveWebViewLink) ||
      getCarrierVideoUrl(carrier)
    );
  }
  return (
    normalizeUrl(carrier?.googleDriveWebViewLink) || getCarrierVideoUrl(carrier)
  );
};

export const isAcademyVideoPlayableInNativePlayer = (
  carrier:
    | Pick<
        VideoCarrierLike,
        | "videoUrl"
        | "url"
        | "googleDrivePlaybackUrl"
        | "videoSourceType"
        | "googleDriveMimeType"
      >
    | null
    | undefined,
): boolean => {
  const sourceType = getAcademyVideoSourceType(carrier);
  if (sourceType === "google-vids" || sourceType === "external-link") {
    return false;
  }
  const playbackUrl = getAcademyPreferredPlaybackUrl(carrier);
  if (!playbackUrl) return false;
  return (
    VIDEO_URL_PATTERN.test(playbackUrl) ||
    GOOGLE_VIDEO_PLAYBACK_HOST_HINT_PATTERN.test(playbackUrl)
  );
};

export const probeVideoDurationSeconds = async (
  value: unknown,
  timeoutMs = 10000,
): Promise<number | null> => {
  const url = normalizeUrl(value);
  if (
    !url ||
    typeof document === "undefined" ||
    typeof window === "undefined"
  ) {
    return null;
  }

  return await new Promise((resolve) => {
    const video = document.createElement("video");
    let settled = false;

    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (!Number.isFinite(Number(duration)) || Number(duration) <= 0) {
        resolve(null);
        return;
      }
      resolve(Math.round(Number(duration)));
    };

    const handleLoadedMetadata = () => finish(video.duration);
    const handleError = () => finish(null);
    const timeoutId = window.setTimeout(() => finish(null), timeoutMs);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.addEventListener("loadedmetadata", handleLoadedMetadata, {
      once: true,
    });
    video.addEventListener("error", handleError, { once: true });
    video.src = url;
  });
};

const isLikelyVideoUrl = (value: unknown): boolean => {
  const url = normalizeUrl(value);
  if (!url) return false;
  if (/^data:/i.test(url)) return false;
  return (
    VIDEO_URL_PATTERN.test(url) ||
    VIDEO_HOST_HINT_PATTERN.test(url) ||
    GOOGLE_VIDEO_HOST_HINT_PATTERN.test(url) ||
    GOOGLE_VIDEO_PLAYBACK_HOST_HINT_PATTERN.test(url)
  );
};

const pickVideoFromResources = (
  resources: VideoResource[] | undefined,
): string => {
  if (!Array.isArray(resources) || resources.length === 0) return "";

  const typedVideo = resources.find((resource) => {
    if (String(resource?.type || "").toLowerCase() !== "video") return false;
    return (
      getAcademyPreferredPlaybackUrl(resource).length > 0 ||
      normalizeUrl(resource?.url).length > 0
    );
  });
  if (typedVideo?.url) {
    return (
      getAcademyPreferredPlaybackUrl(typedVideo) || normalizeUrl(typedVideo.url)
    );
  }

  const hintedVideo = resources.find((resource) =>
    isLikelyVideoUrl(resource?.url),
  );
  if (hintedVideo?.url) {
    return (
      getAcademyPreferredPlaybackUrl(hintedVideo) ||
      normalizeUrl(hintedVideo.url)
    );
  }

  return "";
};

export const resolveAcademyVideoUrl = ({
  course,
  preferredLessonId,
  fallbackUrl,
}: {
  course?: Course | null;
  preferredLessonId?: string | null;
  fallbackUrl: string;
}): string => {
  const safeFallback = normalizeUrl(fallbackUrl);
  if (!course) return safeFallback;

  const directCourseUrl =
    getAcademyPreferredPlaybackUrl(course) || normalizeUrl(course.videoUrl);
  if (directCourseUrl) return directCourseUrl;

  const lessons = Array.isArray(course.lessons)
    ? (course.lessons as Lesson[])
    : [];
  const preferredLesson = preferredLessonId
    ? lessons.find((lesson) => String(lesson.id) === String(preferredLessonId))
    : null;
  const preferredLessonVideo =
    getAcademyPreferredPlaybackUrl(preferredLesson) ||
    normalizeUrl(preferredLesson?.videoUrl);
  if (preferredLessonVideo) return preferredLessonVideo;

  const firstLessonWithVideo = lessons.find((lesson) => {
    return (
      getAcademyPreferredPlaybackUrl(lesson).length > 0 ||
      normalizeUrl(lesson.videoUrl).length > 0
    );
  });
  if (firstLessonWithVideo?.videoUrl) {
    return (
      getAcademyPreferredPlaybackUrl(firstLessonWithVideo) ||
      normalizeUrl(firstLessonWithVideo.videoUrl)
    );
  }

  const preferredLessonResourceVideo = pickVideoFromResources(
    Array.isArray(preferredLesson?.resources) ? preferredLesson.resources : [],
  );
  if (preferredLessonResourceVideo) return preferredLessonResourceVideo;

  const courseResourceVideo = pickVideoFromResources(
    Array.isArray(course.resources) ? course.resources : [],
  );
  if (courseResourceVideo) return courseResourceVideo;

  for (const lesson of lessons) {
    const lessonResourceVideo = pickVideoFromResources(
      Array.isArray(lesson.resources) ? lesson.resources : [],
    );
    if (lessonResourceVideo) return lessonResourceVideo;
  }

  return safeFallback;
};
