import type {
  Course,
  CourseResource,
  Lesson,
  LessonResource,
} from '@/contexts/AcademyContext';

type VideoResource = CourseResource | LessonResource;

const VIDEO_URL_PATTERN =
  /\.(mp4|webm|ogg|m3u8|mov|m4v)(?:[?#].*)?$/i;
const VIDEO_HOST_HINT_PATTERN =
  /(youtube\.com|youtu\.be|vimeo\.com|wistia\.|mux\.|cloudflarestream\.com|stream\.)/i;

const normalizeUrl = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const probeVideoDurationSeconds = async (
  value: unknown,
  timeoutMs = 10000,
): Promise<number | null> => {
  const url = normalizeUrl(value);
  if (!url || typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  return await new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;

    const finish = (duration: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      video.pause();
      video.removeAttribute('src');
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

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    video.addEventListener('error', handleError, { once: true });
    video.src = url;
  });
};

const isLikelyVideoUrl = (value: unknown): boolean => {
  const url = normalizeUrl(value);
  if (!url) return false;
  if (/^data:/i.test(url)) return false;
  return VIDEO_URL_PATTERN.test(url) || VIDEO_HOST_HINT_PATTERN.test(url);
};

const pickVideoFromResources = (resources: VideoResource[] | undefined): string => {
  if (!Array.isArray(resources) || resources.length === 0) return '';

  const typedVideo = resources.find((resource) => {
    if (String(resource?.type || '').toLowerCase() !== 'video') return false;
    return normalizeUrl(resource?.url).length > 0;
  });
  if (typedVideo?.url) return normalizeUrl(typedVideo.url);

  const hintedVideo = resources.find((resource) => isLikelyVideoUrl(resource?.url));
  if (hintedVideo?.url) return normalizeUrl(hintedVideo.url);

  return '';
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

  const directCourseUrl = normalizeUrl(course.videoUrl);
  if (directCourseUrl) return directCourseUrl;

  const lessons = Array.isArray(course.lessons) ? (course.lessons as Lesson[]) : [];
  const preferredLesson = preferredLessonId
    ? lessons.find((lesson) => String(lesson.id) === String(preferredLessonId))
    : null;
  const preferredLessonVideo = normalizeUrl(preferredLesson?.videoUrl);
  if (preferredLessonVideo) return preferredLessonVideo;

  const firstLessonWithVideo = lessons.find((lesson) => normalizeUrl(lesson.videoUrl).length > 0);
  if (firstLessonWithVideo?.videoUrl) return normalizeUrl(firstLessonWithVideo.videoUrl);

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
